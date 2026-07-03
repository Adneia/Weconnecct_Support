from fastapi import APIRouter, HTTPException, Depends

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import calcular_dias_uteis

router = APIRouter(prefix="/api")


@router.get("/relatorios/ag-compras")
async def get_relatorio_ag_compras(current_user: dict = Depends(get_current_user)):
    # Pedidos que já estão na lista de cancelamento AES devem ser excluídos do relatório
    # (qualquer status: pendentes ainda em andamento ou encerrados já tratados)
    aes_pedidos = await db.cancelamentos.find(
        {"tipo": "aes"}, {"_id": 0, "numero_pedido": 1}
    ).to_list(5000)
    aes_numeros_pedido = {c["numero_pedido"] for c in aes_pedidos if c.get("numero_pedido")}

    chamados_query = {"motivo_pendencia": "Ag. Compras", "pendente": True}
    if aes_numeros_pedido:
        chamados_query["numero_pedido"] = {"$nin": list(aes_numeros_pedido)}

    chamados = await db.chamados.find(chamados_query, {"_id": 0}).to_list(5000)
    fornecedores_dict = {}
    fornecedores = await db.fornecedores.find({}, {"_id": 0}).to_list(100)
    for f in fornecedores:
        fornecedores_dict[f.get('nome', '').lower()] = f.get('dias_extras_padrao', 5)

    # Bulk query pedidos (evita N+1)
    pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
    pedidos_raw = await db.pedidos_erp.find(
        {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
    ).to_list(len(pedido_numbers)) if pedido_numbers else []
    pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

    # Estoque XD (cross-dock) = estoque_sigeq com source 'SIGEQ425', casado pelo SKU
    # (cod_terceiro = codigo_item_vtex). Item sem registro XD → 0 (nunca "-").
    skus = [str(p.get('codigo_item_vtex') or '').strip()
            for p in pedidos_dict.values() if p.get('codigo_item_vtex')]
    xd_raw = await db.estoque_sigeq.find(
        {"cod_terceiro": {"$in": skus}, "source": "SIGEQ425"},
        {"_id": 0, "cod_terceiro": 1, "disp_venda": 1, "codigo_fornecedor": 1}
    ).to_list(len(skus)) if skus else []
    xd_dict = {e['cod_terceiro']: e for e in xd_raw}

    resultado = []
    for chamado in chamados:
        pedido = pedidos_dict.get(chamado.get('numero_pedido'))
        if not pedido:
            continue
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        fornecedor = pedido.get('departamento', '')
        incluir = False
        if 'pedido aprovado' in status_pedido:
            incluir = True
        elif 'aguardando estoque' in status_pedido:
            dias_extras = fornecedores_dict.get(fornecedor.lower(), 5)
            dias_em_estoque = calcular_dias_uteis(data_status)
            if dias_em_estoque >= dias_extras:
                incluir = True
        if not incluir:
            continue

        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"

        sku = str(pedido.get('codigo_item_vtex') or '').strip()
        xd = xd_dict.get(sku)
        # Estoque XD: sempre número (0 quando não há registro), nunca None/"-"
        estoque_disponivel = int(xd.get('disp_venda') or 0) if xd else 0

        resultado.append({
            "fornecedor": fornecedor,
            "produto": pedido.get('produto', '') or chamado.get('produto', ''),
            "id_produto": pedido.get('codigo_item_bseller', ''),
            "sku": pedido.get('codigo_item_vtex', ''),
            "quantidade": pedido.get('quantidade', ''),
            "codigo_fornecedor": (xd.get('codigo_fornecedor') if xd and xd.get('codigo_fornecedor') else pedido.get('codigo_fornecedor', '')),
            "entrega": chamado.get('numero_pedido', ''),
            "parceiro_canal": pedido.get('canal_vendas', ''),
            "cidade": pedido.get('cidade', ''),
            "uf": pedido.get('uf', ''),
            "estoque_disponivel": estoque_disponivel,
            "status_atendimento": status_atendimento,
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status
        })
    return resultado


@router.get("/relatorios/ag-logistica")
async def get_relatorio_ag_logistica(current_user: dict = Depends(get_current_user)):
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Logística", "pendente": True}, {"_id": 0}
    ).to_list(5000)

    # Bulk query pedidos (evita N+1)
    pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
    pedidos_raw = await db.pedidos_erp.find(
        {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
    ).to_list(len(pedido_numbers)) if pedido_numbers else []
    pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

    resultado = []
    for chamado in chamados:
        pedido = pedidos_dict.get(chamado.get('numero_pedido'))
        if not pedido:
            continue
        status_pedido = (pedido.get('status_pedido', '') or '').lower()
        data_status = pedido.get('data_status', '')
        # Regra (definida pela Adneia): SÓ pedidos em ETR (Entregue a Transportadora),
        # com MAIS DE 2 dias úteis nesse status. 'Pedido aprovado' e demais status NÃO entram.
        if 'entregue a transportadora' not in status_pedido:
            continue
        dias_no_status = calcular_dias_uteis(data_status)
        if dias_no_status <= 2:  # "mais de 2 dias úteis" = > 2 (inclui a partir de 3)
            continue

        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"

        resultado.append({
            "entrega": chamado.get('numero_pedido', ''),
            "nota": str(pedido.get('nota_fiscal', '')).replace('.0', '') if pedido.get('nota_fiscal') else '',
            "galpao": pedido.get('filial', ''),
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status,
            "dias_no_status": dias_no_status,
            "status_atendimento": status_atendimento
        })
    # Relatório em ORDEM DE GALPÃO (e, dentro de cada galpão, os mais parados primeiro)
    resultado.sort(key=lambda r: ((r.get('galpao') or '').upper(), -int(r.get('dias_no_status') or 0), str(r.get('entrega') or '')))
    return resultado
