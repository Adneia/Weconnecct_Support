from fastapi import APIRouter, HTTPException, Depends

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import calcular_dias_uteis

router = APIRouter(prefix="/api")


@router.get("/relatorios/ag-compras")
async def get_relatorio_ag_compras(current_user: dict = Depends(get_current_user)):
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Compras", "pendente": True}, {"_id": 0}
    ).to_list(5000)
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

    # Bulk query estoque
    codigo_items = []
    for chamado in chamados:
        pedido = pedidos_dict.get(chamado.get('numero_pedido'))
        if pedido:
            ci = pedido.get('codigo_item_bseller', '')
            if ci:
                ci_str = str(ci)
                if ci_str.endswith('.0'):
                    ci_str = ci_str[:-2]
                codigo_items.append(ci_str)
    estoques_raw = await db.estoque_sigeq.find(
        {"id_item": {"$in": codigo_items}}, {"_id": 0}
    ).to_list(len(codigo_items)) if codigo_items else []
    estoques_dict = {e['id_item']: e for e in estoques_raw}

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

        codigo_item = pedido.get('codigo_item_bseller', '')
        estoque_disponivel = None
        if codigo_item:
            ci_str = str(codigo_item)
            if ci_str.endswith('.0'):
                ci_str = ci_str[:-2]
            estoque = estoques_dict.get(ci_str)
            if estoque:
                estoque_disponivel = estoque.get('disp_venda', 0)

        resultado.append({
            "fornecedor": fornecedor,
            "produto": pedido.get('produto', '') or chamado.get('produto', ''),
            "id_produto": pedido.get('codigo_item_bseller', ''),
            "sku": pedido.get('codigo_item_vtex', ''),
            "quantidade": pedido.get('quantidade', ''),
            "codigo_fornecedor": pedido.get('codigo_fornecedor', ''),
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
    STATUS_LOGISTICA = [
        'entregue a transportadora', 'nota fiscal emitida',
        'nota fiscal aprovada', 'separado'
    ]
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
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        incluir = False
        if 'pedido aprovado' in status_pedido:
            incluir = True
        else:
            for status_valido in STATUS_LOGISTICA:
                if status_valido in status_pedido:
                    dias_no_status = calcular_dias_uteis(data_status)
                    if dias_no_status >= 2:
                        incluir = True
                        break
        if not incluir:
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
            "status_atendimento": status_atendimento
        })
    return resultado
