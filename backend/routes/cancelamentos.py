"""
Módulo: Cancelamentos
Gerencia cancelamentos de pedidos com 3 fluxos:
- AES (Compras): solicitação por falta de estoque no fornecedor
- ETR (Produção): identificado na produção (perda, quebra, falha cadastro)
- Erro na Nota: nota rejeitada, requer acionar cliente + lançar nova entrega
"""
import uuid
import logging
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from utils.auth import get_current_user
from utils.database import db

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


# ============== MODELS ==============
class CancelamentoCreate(BaseModel):
    tipo: str = Field(..., description="aes | etr | erro_nota")
    numero_pedido: str  # Entrega
    motivo: Optional[str] = None
    acao: Optional[str] = None  # Cancelar / Reenviar
    motivo_rejeicao: Optional[str] = None  # para erro_nota
    ticket: Optional[str] = None
    instancia: Optional[str] = None
    zerado_reserva: Optional[bool] = None
    observacao: Optional[str] = None
    # Para erro_nota
    cliente_confirmado_nome: Optional[str] = None
    cliente_confirmado_cpf: Optional[str] = None
    cliente_confirmado_endereco: Optional[str] = None
    nova_entrega: Optional[str] = None


class CancelamentoUpdate(BaseModel):
    motivo: Optional[str] = None
    acao: Optional[str] = None
    motivo_rejeicao: Optional[str] = None
    ticket: Optional[str] = None
    instancia: Optional[str] = None
    zerado_reserva: Optional[bool] = None
    observacao: Optional[str] = None
    cliente_confirmado_nome: Optional[str] = None
    cliente_confirmado_cpf: Optional[str] = None
    cliente_confirmado_endereco: Optional[str] = None
    nova_entrega: Optional[str] = None
    data_encerramento: Optional[str] = None
    status: Optional[str] = None  # pendente | em_andamento | encerrado
    prioridade: Optional[bool] = None
    sku_similar: Optional[str] = None   # SKU do item similar (AES)
    nome_similar: Optional[str] = None  # Nome do produto similar (auto-preenchido)
    id_similar: Optional[str] = None    # ID BSeller do produto similar (auto-preenchido)
    em_compras: Optional[bool] = None   # True = item movido para a caixa Compras (acionando estoque)
    analise_similar: Optional[str] = None  # pendente | proposto | cancelar | sem_similar
    similares_propostos: Optional[list] = None  # lista de SKUs escolhidos pelo analista


def _br_now():
    return datetime.now(timezone(timedelta(hours=-3)))


def _iso_now_utc():
    return datetime.now(timezone.utc).isoformat()


# Statuses do pedido (em pedidos_erp.status_pedido) que MANTÊM um cancelamento AES como 'pendente'.
# Regra de negócio: cancelamento AES é criado quando há falta de estoque (status "Aguardando estoque").
# Ao acionar o cancelamento, o pedido é cancelado no parceiro → status vai pra "Cancelado/Cancelada".
# Qualquer outro status indica que o pedido avançou na esteira (NF emitida, enviado, entregue, etc.)
# e o cancelamento não pode mais ser efetivado → deve ser encerrado automaticamente.
# Threshold para tratar XD como "consta estoque" — gera alerta + nota na observação + entra na relação Compras.
_XD_THRESHOLD = 10

# Statuses do pedido que indicam que cancelamento já foi consumado (não adianta acionar Compras)
_AES_STATUS_JA_CANCELADO = {"Cancelado", "Cancelada", "CANCELADO", "Entrega cancelada"}


_AES_STATUS_MANTER_PENDENTE = {
    "",  # sem dados de status — não temos info pra decidir
    "Aguardando estoque",
    # Acionamento de cancelamento foi bem-sucedido — usuário faz a baixa manualmente
    # através do encerramento do atendimento (chamado). Não auto-fechar pelo status do pedido.
    "Cancelado", "Cancelada", "CANCELADO", "Entrega cancelada",
    # Pré-faturamento — ainda no início do fluxo, cancelamento viável
    "Pedido Incluido", "Pagamento OK", "Pedido aprovado",
    "Aguardando aprovação de pagamento", "Aguardando liberacao do SAC",
}


async def _auto_encerrar_aes_por_status_pedido() -> dict:
    """
    Encerra automaticamente cancelamentos AES pendentes em DUAS situações:

    1) Pedido avançou para status que invalida o cancelamento (NFe Aprovada,
       Entregue a Transportadora, EM TRÂNSITO, Entregue ao Cliente, etc.) →
       cancelamento falhou, o pedido foi adiante. Encerra com nota indicando
       o status novo.
    2) Chamado/atendimento vinculado (mesmo numero_pedido) foi encerrado
       (pendente=false). Sinal de que o time já tratou e finalizou o caso.
       Encerra com nota indicando o id do atendimento encerrado.

    Status do pedido que NÃO disparam encerramento (whitelist):
        Aguardando estoque, Cancelado/Cancelada/CANCELADO/Entrega cancelada,
        pré-faturamento (Pedido Incluido, Pagamento OK, etc.).
    Idempotente: cancelamentos já encerrados não são re-processados.
    """
    pipeline = [
        {"$match": {"tipo": "aes", "status": "pendente"}},
        # Lookup status atual no tabelão
        {"$lookup": {
            "from": "pedidos_erp",
            "localField": "numero_pedido",
            "foreignField": "numero_pedido",
            "as": "_pe",
        }},
        # Lookup chamado/atendimento vinculado
        {"$lookup": {
            "from": "chamados",
            "localField": "numero_pedido",
            "foreignField": "numero_pedido",
            "as": "_chamado",
        }},
        {"$addFields": {
            "_status_atual": {"$ifNull": [{"$arrayElemAt": ["$_pe.status_pedido", 0]}, ""]},
            "_chamado_pendente": {"$arrayElemAt": ["$_chamado.pendente", 0]},
            "_chamado_id_atd": {"$arrayElemAt": ["$_chamado.id_atendimento", 0]},
            "_tem_ticket": {"$ne": [{"$ifNull": ["$ticket", ""]}, ""]},
        }},
        # Filtra os elegíveis: pedido avançou OU chamado encerrado
        {"$match": {
            "$or": [
                {"_status_atual": {"$nin": list(_AES_STATUS_MANTER_PENDENTE)}},
                {"_chamado_pendente": False},
            ]
        }},
        {"$project": {
            "_id": 0, "id": 1, "numero_pedido": 1, "observacao": 1,
            "_status_atual": 1, "_chamado_pendente": 1, "_chamado_id_atd": 1, "_tem_ticket": 1,
        }},
    ]
    docs = await db.cancelamentos.aggregate(pipeline).to_list(1000)
    if not docs:
        return {"encerrados": 0, "ids": [], "alertados": 0}

    now_iso = _iso_now_utc()
    data_br_curta = _br_now().strftime("%d/%m")
    data_br_completa = _br_now().strftime("%Y-%m-%d")
    ids_encerrados = []
    alertados = 0
    for d in docs:
        novo_status = d.get("_status_atual", "") or ""
        chamado_encerrado = d.get("_chamado_pendente") is False
        id_atd = d.get("_chamado_id_atd") or ""
        tem_ticket = d.get("_tem_ticket") is True
        obs_atual = d.get("observacao", "") or ""
        status_eh_invalido = novo_status not in _AES_STATUS_MANTER_PENDENTE

        # CASO ESPECIAL: pedido MOVIMENTOU mas há TICKET de cancelamento aberto.
        # Não encerra — mantém pendente e alerta, pois há acionamento ativo a acompanhar.
        # (só vale quando o gatilho foi o status do pedido, não o chamado encerrado)
        if status_eh_invalido and tem_ticket and not chamado_encerrado:
            nota = f"{data_br_curta} - ⚠️ Pedido movimentou para '{novo_status}' com ticket aberto — verificar acionamento com o canal/transportadora"
            if "movimentou" not in obs_atual or nota not in obs_atual:
                if nota not in obs_atual:
                    nova_obs = (nota + ("\n" + obs_atual if obs_atual else "")).strip()
                    await db.cancelamentos.update_one(
                        {"id": d["id"]},
                        {"$set": {"observacao": nova_obs, "movimentou_com_ticket": True, "updated_at": now_iso}},
                    )
                    alertados += 1
            continue

        # Define a nota conforme o gatilho. Chamado encerrado tem prioridade
        # se o status do pedido ainda for válido (whitelist).
        if chamado_encerrado and not status_eh_invalido:
            nota = f"{data_br_curta} - Encerrado automaticamente: atendimento {id_atd} foi encerrado"
        else:
            nota = f"{data_br_curta} - Encerrado automaticamente: pedido alterado para '{novo_status}'"

        if nota not in obs_atual:
            nova_obs = (nota + ("\n" + obs_atual if obs_atual else "")).strip()
        else:
            nova_obs = obs_atual

        update_doc = {
            "status": "encerrado",
            "data_encerramento": data_br_completa,
            "observacao": nova_obs,
            "encerrado_automaticamente": True,
            "updated_at": now_iso,
        }
        if novo_status:
            update_doc["status_pedido"] = novo_status

        await db.cancelamentos.update_one({"id": d["id"]}, {"$set": update_doc})
        ids_encerrados.append(d["id"])
    logger.info(f"[auto-encerrar AES] {len(ids_encerrados)} encerrado(s), {alertados} mantido(s) com alerta (ticket aberto + movimentou)")
    return {"encerrados": len(ids_encerrados), "ids": ids_encerrados, "alertados": alertados}


async def _auto_nota_consta_estoque() -> dict:
    """
    Para AES pendentes que TÊM ticket aberto, estoque XD > _XD_THRESHOLD
    e pedido AINDA não cancelado, adiciona nota na observação:
    "DD/MM - Consta estoque, verificar possibilidade de segurar o cancelamento."
    Idempotente: não duplica.
    """
    pipeline = [
        {"$match": {"tipo": "aes", "status": "pendente", "em_compras": {"$ne": True}}},
        {"$lookup": {
            "from": "estoque_sigeq",
            "let": {"sku": "$codigo_item_vtex"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$cod_terceiro", "$$sku"]},
                    {"$eq": ["$source", "SIGEQ425"]},
                ]}}},
                {"$limit": 1},
                {"$project": {"_id": 0, "disp_venda": 1}},
            ],
            "as": "_xd",
        }},
        {"$addFields": {
            "_xd_disp": {"$ifNull": [{"$arrayElemAt": ["$_xd.disp_venda", 0]}, 0]},
            "_ticket_preenchido": {"$ne": [{"$ifNull": ["$ticket", ""]}, ""]},
        }},
        {"$match": {
            "_xd_disp": {"$gt": _XD_THRESHOLD},
            "_ticket_preenchido": True,
        }},
        {"$project": {"_id": 0, "id": 1, "observacao": 1}},
    ]
    docs = await db.cancelamentos.aggregate(pipeline).to_list(2000)
    if not docs:
        return {"adicionadas": 0}
    data_br = _br_now().strftime("%d/%m")
    nota_texto = f"{data_br} - Consta estoque, verificar possibilidade de segurar o cancelamento."
    adicionadas = 0
    for d in docs:
        obs = d.get("observacao") or ""
        if "Consta estoque, verificar possibilidade de segurar" in obs:
            continue
        nova_obs = (nota_texto + ("\n" + obs if obs else "")).strip()
        await db.cancelamentos.update_one(
            {"id": d["id"]},
            {"$set": {"observacao": nova_obs, "updated_at": _iso_now_utc()}},
        )
        adicionadas += 1
    if adicionadas:
        logger.info(f"[auto-nota consta-estoque] {adicionadas} nota(s) adicionada(s)")
    return {"adicionadas": adicionadas}


async def _analisar_similares_pendentes(limit: int = 200) -> dict:
    """
    Para AES pendentes ainda NÃO analisados (sem campo analise_similar ou em estado
    recomputável), busca similares no catálogo (mesma tensão, com estoque).
    - Encontrou similares → analise_similar='pendente', grava similares_sugeridos.
    - Não encontrou → analise_similar='sem_similar' (segue como cancelamento normal).
    Não mexe em quem o analista já decidiu (proposto / cancelar).
    Idempotente. Pesado (Postgres) — chamar em lote controlado (criação, backlog, sync).
    """
    from routes.produtos_busca import computar_similares_compactos
    # Estados que devem ser (re)analisados: ainda não decididos pelo analista.
    # Pula quem já é Similar (analista escolheu manualmente) — esses não viram picker.
    query = {
        "tipo": "aes",
        "status": "pendente",
        "acao": {"$not": {"$regex": "similar", "$options": "i"}},
        "$or": [
            {"analise_similar": {"$exists": False}},
            {"analise_similar": {"$in": ["pendente", "sem_similar"]}},
        ],
    }
    docs = await db.cancelamentos.find(
        query, {"_id": 0, "id": 1, "codigo_item_vtex": 1, "numero_pedido": 1}
    ).to_list(limit)
    if not docs:
        return {"analisados": 0, "com_similar": 0}

    analisados = 0
    com_similar = 0
    for d in docs:
        sku = d.get("codigo_item_vtex") or ""
        if not sku:
            await db.cancelamentos.update_one(
                {"id": d["id"]},
                {"$set": {"analise_similar": "sem_similar", "similares_sugeridos": [], "updated_at": _iso_now_utc()}},
            )
            analisados += 1
            continue
        res = await computar_similares_compactos(sku, d.get("numero_pedido"), max_propostos=5)
        if res.get("found"):
            await db.cancelamentos.update_one(
                {"id": d["id"]},
                {"$set": {
                    "analise_similar": "pendente",
                    "similares_sugeridos": res["propostos"],
                    "updated_at": _iso_now_utc(),
                }},
            )
            com_similar += 1
        else:
            await db.cancelamentos.update_one(
                {"id": d["id"]},
                {"$set": {"analise_similar": "sem_similar", "similares_sugeridos": [], "updated_at": _iso_now_utc()}},
            )
        analisados += 1
    logger.info(f"[analisar-similares] {analisados} analisados, {com_similar} com similar")
    return {"analisados": analisados, "com_similar": com_similar}


async def _auto_voltar_de_compras() -> dict:
    """
    Para cancelamentos AES marcados como em_compras=true, desfaz a marcação se:
      - XD zerou (não tem mais estoque pra acionar), OU
      - Ticket foi preenchido (atendente acionou o canal — agora aguarda retorno).
    Adiciona nota na observação explicando a razão.
    """
    pipeline = [
        {"$match": {"tipo": "aes", "status": "pendente", "em_compras": True}},
        {"$lookup": {
            "from": "estoque_sigeq",
            "let": {"sku": "$codigo_item_vtex"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$cod_terceiro", "$$sku"]},
                    {"$eq": ["$source", "SIGEQ425"]},
                ]}}},
                {"$limit": 1},
                {"$project": {"_id": 0, "disp_venda": 1}},
            ],
            "as": "_xd",
        }},
        {"$addFields": {
            "_xd_disp": {"$ifNull": [{"$arrayElemAt": ["$_xd.disp_venda", 0]}, 0]},
            "_ticket_str": {"$ifNull": ["$ticket", ""]},
        }},
        {"$match": {"$or": [
            {"_xd_disp": {"$lte": 0}},
            {"_ticket_str": {"$nin": ["", None]}},
        ]}},
        {"$project": {"_id": 0, "id": 1, "observacao": 1, "_xd_disp": 1, "_ticket_str": 1}},
    ]
    docs = await db.cancelamentos.aggregate(pipeline).to_list(2000)
    if not docs:
        return {"voltados": 0}
    data_br = _br_now().strftime("%d/%m")
    voltados = 0
    for d in docs:
        xd = d.get("_xd_disp", 0)
        ticket = (d.get("_ticket_str") or "").strip()
        if ticket:
            nota = f"{data_br} - Compras: ticket aberto ({ticket}), aguardando retorno do canal"
        else:
            nota = f"{data_br} - Compras: estoque zerou, voltou para o canal"
        obs = d.get("observacao") or ""
        nova_obs = obs if nota in obs else (nota + ("\n" + obs if obs else "")).strip()
        await db.cancelamentos.update_one(
            {"id": d["id"]},
            {"$set": {"observacao": nova_obs, "em_compras": False, "updated_at": _iso_now_utc()}},
        )
        voltados += 1
    if voltados:
        logger.info(f"[auto-voltar Compras] {voltados} cancelamento(s) retornaram ao canal")
    return {"voltados": voltados}


async def _auto_mover_para_compras() -> dict:
    """
    Para cada AES pendente cujo SKU tem estoque cross-dock > _XD_THRESHOLD
    e cujo TICKET ainda está vazio (canal não foi acionado):
      - Marca em_compras=true (move para a caixa Compras)
      - Adiciona nota: "DD/MM - Acionar compras para verificar o estoque"
    Regra olha SOMENTE o ticket (status do pedido não importa — se houver
    estoque pode-se subir pedido manual mesmo que o pedido esteja cancelado).
    Idempotente: só age em quem ainda não está em_compras.
    """
    pipeline = [
        {"$match": {"tipo": "aes", "status": "pendente", "em_compras": {"$ne": True}}},
        # XD lookup
        {"$lookup": {
            "from": "estoque_sigeq",
            "let": {"sku": "$codigo_item_vtex"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$cod_terceiro", "$$sku"]},
                    {"$eq": ["$source", "SIGEQ425"]},
                ]}}},
                {"$limit": 1},
                {"$project": {"_id": 0, "disp_venda": 1}},
            ],
            "as": "_xd",
        }},
        {"$addFields": {
            "_xd_disp": {"$ifNull": [{"$arrayElemAt": ["$_xd.disp_venda", 0]}, 0]},
            # Ticket considerado "vazio" se for null, ausente ou string em branco
            "_ticket_vazio": {"$or": [
                {"$eq": [{"$ifNull": ["$ticket", ""]}, ""]},
                {"$eq": [{"$type": "$ticket"}, "missing"]},
            ]},
        }},
        {"$match": {
            "_xd_disp": {"$gt": _XD_THRESHOLD},
            "_ticket_vazio": True,
        }},
        {"$project": {"_id": 0, "id": 1, "observacao": 1, "_xd_disp": 1}},
    ]
    docs = await db.cancelamentos.aggregate(pipeline).to_list(2000)
    if not docs:
        return {"movidos": 0}

    data_br_curta = _br_now().strftime("%d/%m")
    nota_texto = f"{data_br_curta} - Acionar compras para verificar o estoque"
    movidos = 0
    for d in docs:
        obs = d.get("observacao") or ""
        nova_obs = obs if "Acionar compras para verificar o estoque" in obs \
                       else (nota_texto + ("\n" + obs if obs else "")).strip()
        await db.cancelamentos.update_one(
            {"id": d["id"]},
            {"$set": {
                "observacao": nova_obs,
                "em_compras": True,
                "updated_at": _iso_now_utc(),
            }},
        )
        movidos += 1
    if movidos:
        logger.info(f"[auto-mover Compras] {movidos} cancelamento(s) movido(s) automaticamente")
    return {"movidos": movidos}


async def _enrich_from_tabelao(numero_pedido: str) -> dict:
    """Busca dados do pedido no tabelão para preenchimento automático."""
    pedido = await db.pedidos_erp.find_one(
        {"numero_pedido": numero_pedido},
        {"_id": 0}
    )
    if not pedido:
        return {}
    return {
        "canal_vendas": pedido.get("canal_vendas", ""),
        "parceiro": pedido.get("canal_vendas", ""),
        "nome_cliente": pedido.get("nome_cliente", ""),
        "cpf_cliente": pedido.get("cpf_cliente", ""),
        "fone_cliente": pedido.get("fone_cliente", ""),
        "email_cliente": pedido.get("email_cliente", ""),
        "endereco_rua": pedido.get("endereco_rua", ""),
        "endereco_numero": pedido.get("endereco_numero", ""),
        "endereco_complemento": pedido.get("endereco_complemento", ""),
        "endereco_bairro": pedido.get("endereco_bairro", ""),
        "cidade": pedido.get("cidade", ""),
        "uf": pedido.get("uf", ""),
        "cep": pedido.get("cep", ""),
        "produto": pedido.get("produto", ""),
        "codigo_item_bseller": pedido.get("codigo_item_bseller", ""),
        "codigo_item_vtex": pedido.get("codigo_item_vtex", ""),  # SKU/Cód. Terceiro
        "codigo_fornecedor": pedido.get("codigo_fornecedor", ""),
        "departamento": pedido.get("departamento", ""),
        "filial": pedido.get("filial", ""),
        "nota_fiscal": pedido.get("nota_fiscal", ""),
        "serie_nf": pedido.get("serie_nf", ""),
        "chave_nota": pedido.get("chave_nota", ""),
        "preco_final": pedido.get("preco_final", ""),  # Valor da venda
        "quantidade": pedido.get("quantidade", ""),
        "transportadora": pedido.get("transportadora", ""),
        "status_pedido": pedido.get("status_pedido", ""),
        "data_status": pedido.get("data_status", ""),
    }


# ============== ENDPOINTS ==============

@router.get("/cancelamentos")
async def listar_cancelamentos(
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 1000,
    current_user: dict = Depends(get_current_user),
):
    """Lista cancelamentos com filtros opcionais. Cruza com chamados para indicar atendimentos existentes."""
    # Antes de listar, verifica se há AES pendentes cujo pedido avançou de status (auto-encerramento)
    try:
        await _auto_encerrar_aes_por_status_pedido()
    except Exception as e:
        logger.warning(f"auto-encerrar AES falhou (seguindo com a listagem): {e}")

    # Move automaticamente para a caixa Compras quem tem XD > threshold + pedido ativo + ticket vazio
    try:
        await _auto_mover_para_compras()
    except Exception as e:
        logger.warning(f"auto-mover Compras falhou (seguindo com a listagem): {e}")

    # Nota: para quem tem ticket aberto + XD > threshold, sinaliza pro atendente segurar o cancelamento
    try:
        await _auto_nota_consta_estoque()
    except Exception as e:
        logger.warning(f"auto-nota consta-estoque falhou (seguindo com a listagem): {e}")

    # Auto-volta de Compras: cancelamentos em_compras cujo XD zerou voltam ao canal
    try:
        await _auto_voltar_de_compras()
    except Exception as e:
        logger.warning(f"auto-voltar Compras falhou (seguindo com a listagem): {e}")

    query = {}
    if tipo:
        query["tipo"] = tipo
    if status:
        query["status"] = status

    # O lookup de estoque (cross-dock) só interessa para AES ainda pendentes — em
    # encerrados o XD não é acionável. Evita varrer estoque_sigeq em listas grandes.
    incluir_estoque = (tipo == "aes") and (status != "encerrado")

    add_fields = {
        "tem_atendimento": {"$gt": [{"$size": "$chamados_relacionados"}, 0]},
        "id_atendimento": {"$arrayElemAt": ["$chamados_relacionados.id_atendimento", 0]},
        "solicitacao_atendimento": {"$arrayElemAt": ["$chamados_relacionados.solicitacao", 0]},
        "pedido_externo": {"$arrayElemAt": ["$pedido_erp_match.pedido_externo", 0]},
        "status_pedido_atual": {"$ifNull": [{"$arrayElemAt": ["$pedido_erp_match.status_pedido", 0]}, ""]},
    }
    project_remove = {"_id": 0, "chamados_relacionados": 0, "pedido_erp_match": 0}

    pipeline = [
        {"$match": query},
        {"$sort": {"data_criacao": -1}},
        {"$limit": limit},
        # Lookup com chamados pra ver se já tem atendimento aberto
        {"$lookup": {
            "from": "chamados",
            "localField": "numero_pedido",
            "foreignField": "numero_pedido",
            "as": "chamados_relacionados",
        }},
        # Lookup com pedidos_erp para trazer pedido_externo (LLL-xxx para LL Loyalty)
        {"$lookup": {
            "from": "pedidos_erp",
            "localField": "numero_pedido",
            "foreignField": "numero_pedido",
            "as": "pedido_erp_match",
        }},
    ]
    if incluir_estoque:
        pipeline.append({"$lookup": {
            "from": "estoque_sigeq",
            "localField": "codigo_item_vtex",
            "foreignField": "cod_terceiro",
            "as": "estoque_xd_match",
        }})
        add_fields["estoque_xd_disp"] = {"$let": {
            "vars": {"m": {"$first": {"$filter": {
                "input": "$estoque_xd_match",
                "cond": {"$eq": ["$$this.source", "SIGEQ425"]},
            }}}},
            "in": {"$ifNull": ["$$m.disp_venda", 0]},
        }}
        project_remove["estoque_xd_match"] = 0

    pipeline.append({"$addFields": add_fields})
    pipeline.append({"$project": project_remove})
    docs = await db.cancelamentos.aggregate(pipeline).to_list(limit)

    # Calcular dias em status para cada um
    for d in docs:
        dt_str = d.get("data_criacao", "")
        try:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            d["dias_em_status"] = (datetime.now(timezone.utc) - dt).days
        except Exception:
            d["dias_em_status"] = 0
    return {"total": len(docs), "cancelamentos": docs}


@router.get("/cancelamentos/stats")
async def stats_cancelamentos(current_user: dict = Depends(get_current_user)):
    """Cards de resumo no topo da tela."""
    pipeline_por_tipo = [
        {"$group": {
            "_id": {"tipo": "$tipo", "status": "$status"},
            "count": {"$sum": 1}
        }}
    ]
    resultados = await db.cancelamentos.aggregate(pipeline_por_tipo).to_list(None)
    stats = {
        "aes": {"total": 0, "pendentes": 0, "encerrados": 0},
        "etr": {"total": 0, "pendentes": 0, "encerrados": 0},
        "erro_nota": {"total": 0, "pendentes": 0, "encerrados": 0},
    }
    for r in resultados:
        t = r["_id"].get("tipo")
        s = r["_id"].get("status")
        if t in stats:
            stats[t]["total"] += r["count"]
            if s == "encerrado":
                stats[t]["encerrados"] += r["count"]
            else:
                stats[t]["pendentes"] += r["count"]
    return stats


@router.get("/cancelamentos/produto-alerta/{sku}")
async def alerta_produto(
    sku: str,
    dias: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """
    Verifica se um produto (por SKU/código terceiro) teve cancelamentos recorrentes.
    Retorna alerta se >3 nos últimos N dias.
    """
    dt_limite = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
    count = await db.cancelamentos.count_documents({
        "$or": [
            {"codigo_item_vtex": sku},
            {"codigo_item_bseller": sku},
        ],
        "data_criacao": {"$gte": dt_limite}
    })
    return {
        "sku": sku,
        "total_cancelamentos": count,
        "periodo_dias": dias,
        "alerta": count > 3,
        "mensagem": f"⚠️ Este produto teve {count} cancelamentos nos últimos {dias} dias. Verificar com Compras/Produção antes de prosseguir." if count > 3 else None
    }


@router.post("/cancelamentos")
async def criar_cancelamento(
    payload: CancelamentoCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Cria um novo registro de cancelamento.
    Preenche automaticamente dados do pedido a partir do tabelão.
    """
    if payload.tipo not in ("aes", "etr", "erro_nota"):
        raise HTTPException(status_code=400, detail="tipo inválido (use aes, etr ou erro_nota)")

    # Enriquecer com dados do tabelão
    dados_tabelao = await _enrich_from_tabelao(payload.numero_pedido)

    # Verifica alerta de recorrência
    alerta_info = None
    sku = dados_tabelao.get("codigo_item_vtex") or dados_tabelao.get("codigo_item_bseller")
    if sku:
        alerta = await alerta_produto(sku, dias=30, current_user=current_user)
        if alerta.get("alerta"):
            alerta_info = alerta

    user_name = current_user.get("name") or current_user.get("email", "Sistema")
    now = _iso_now_utc()
    now_br = _br_now()

    # Verifica se já existe chamado para esse pedido — se sim, prepend observação
    chamado_existente = await db.chamados.find_one(
        {"numero_pedido": payload.numero_pedido},
        {"_id": 0, "id_atendimento": 1, "solicitacao": 1}
    )
    observacao_final = payload.observacao or ""
    if chamado_existente:
        data_br = now_br.strftime("%d/%m")
        nota = f"{data_br} - já consta no atendimento"
        if nota not in observacao_final:
            observacao_final = (nota + ("\n" + observacao_final if observacao_final else "")).strip()

    doc = {
        "id": str(uuid.uuid4()),
        "tipo": payload.tipo,
        "status": "pendente",
        "numero_pedido": payload.numero_pedido,
        "data_criacao": now,
        "data": now_br.strftime("%Y-%m-%d"),
        "criado_por": user_name,
        "criado_por_email": current_user.get("email", ""),
        # Campos do form
        "motivo": payload.motivo or "",
        "acao": payload.acao or "Cancelar",
        "motivo_rejeicao": payload.motivo_rejeicao or "",
        "ticket": payload.ticket or "",
        "instancia": payload.instancia or "",
        "zerado_reserva": payload.zerado_reserva,
        "observacao": observacao_final,
        # Para erro_nota
        "cliente_confirmado_nome": payload.cliente_confirmado_nome or "",
        "cliente_confirmado_cpf": payload.cliente_confirmado_cpf or "",
        "cliente_confirmado_endereco": payload.cliente_confirmado_endereco or "",
        "nova_entrega": payload.nova_entrega or "",
        # Dados enriquecidos do tabelão
        **dados_tabelao,
        "updated_at": now,
    }

    await db.cancelamentos.insert_one(doc)
    doc.pop("_id", None)

    # AES: busca similares no catálogo (mesma tensão, com estoque) já na criação
    if payload.tipo == "aes":
        try:
            from routes.produtos_busca import computar_similares_compactos
            sku_item = doc.get("codigo_item_vtex") or ""
            res = await computar_similares_compactos(sku_item, doc.get("numero_pedido"), max_propostos=5) if sku_item else {"found": False, "propostos": []}
            novo_estado = "pendente" if res.get("found") else "sem_similar"
            await db.cancelamentos.update_one(
                {"id": doc["id"]},
                {"$set": {"analise_similar": novo_estado, "similares_sugeridos": res.get("propostos", [])}},
            )
            doc["analise_similar"] = novo_estado
            doc["similares_sugeridos"] = res.get("propostos", [])
        except Exception as e:
            logger.warning(f"[criar_cancelamento] busca similar falhou: {e}")

    return {
        "success": True,
        "cancelamento": doc,
        "alerta_produto": alerta_info
    }


@router.put("/cancelamentos/{cancelamento_id}")
async def atualizar_cancelamento(
    cancelamento_id: str,
    payload: CancelamentoUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Atualiza um cancelamento (observação, ticket, instância, status, etc)."""
    update_fields = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="nenhum campo para atualizar")

    update_fields["updated_at"] = _iso_now_utc()

    # Se mudou para encerrado, marca data_encerramento se não veio explícita
    if update_fields.get("status") == "encerrado" and not update_fields.get("data_encerramento"):
        update_fields["data_encerramento"] = _br_now().strftime("%Y-%m-%d")

    # Se sku_similar foi enviado, busca nome e ID do produto no pedidos_erp
    if "sku_similar" in update_fields and update_fields["sku_similar"]:
        sku = update_fields["sku_similar"].strip().upper()
        prod = await db.pedidos_erp.find_one(
            {"codigo_item_vtex": sku},
            {"produto": 1, "codigo_item_bseller": 1, "_id": 0}
        )
        if prod and prod.get("produto"):
            update_fields["nome_similar"] = prod["produto"]
            update_fields["id_similar"] = prod.get("codigo_item_bseller") or ""

    result = await db.cancelamentos.update_one(
        {"id": cancelamento_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="cancelamento não encontrado")

    doc = await db.cancelamentos.find_one({"id": cancelamento_id}, {"_id": 0})
    return {"success": True, "cancelamento": doc}


@router.delete("/cancelamentos/{cancelamento_id}")
async def deletar_cancelamento(
    cancelamento_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove um cancelamento (uso administrativo)."""
    result = await db.cancelamentos.delete_one({"id": cancelamento_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="cancelamento não encontrado")
    return {"success": True}


@router.post("/cancelamentos/enriquecer-atendimentos")
async def enriquecer_atendimentos(current_user: dict = Depends(get_current_user)):
    """
    One-time: para cada cancelamento que tem chamado relacionado em ELO Atendimentos,
    prepend a observação com 'DD/MM - já consta no atendimento' usando a data do cancelamento.
    Não duplica se a nota já existir.
    """
    atualizados = 0
    ja_tinha_nota = 0
    sem_chamado = 0
    cursor = db.cancelamentos.find({}, {"id": 1, "numero_pedido": 1, "observacao": 1, "data": 1, "_id": 0})
    async for c in cursor:
        chamado = await db.chamados.find_one(
            {"numero_pedido": c["numero_pedido"]},
            {"_id": 0, "id_atendimento": 1}
        )
        if not chamado:
            sem_chamado += 1
            continue

        # Data DD/MM da criação do cancelamento (ou hoje se não tiver)
        data_str = c.get("data", "")
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", data_str)
        if m:
            data_br = f"{m.group(3)}/{m.group(2)}"
        else:
            data_br = _br_now().strftime("%d/%m")

        nota = f"{data_br} - já consta no atendimento"
        obs_atual = c.get("observacao", "") or ""
        if "já consta no atendimento" in obs_atual:
            ja_tinha_nota += 1
            continue

        nova_obs = (nota + ("\n" + obs_atual if obs_atual else "")).strip()
        await db.cancelamentos.update_one(
            {"id": c["id"]},
            {"$set": {"observacao": nova_obs}}
        )
        atualizados += 1

    return {
        "atualizados": atualizados,
        "ja_tinha_nota": ja_tinha_nota,
        "sem_chamado": sem_chamado,
    }


@router.get("/cancelamentos/check/{numero_pedido}")
async def check_cancelamentos(
    numero_pedido: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Verifica se um pedido tem cancelamento PENDENTE em AES, ETR ou Erro na Nota.
    Usado no NovoChamado para mostrar alerta ao atendente.
    Cancelamentos já encerrados não disparam o alerta — só os ainda em aberto.
    """
    pedido = str(numero_pedido).strip().split(".")[0]
    # Filtra direto na query: apenas pendentes (ignora encerrados)
    docs = await db.cancelamentos.find(
        {"numero_pedido": pedido, "status": {"$ne": "encerrado"}},
        {"_id": 0, "id": 1, "tipo": 1, "status": 1, "data": 1, "data_encerramento": 1,
         "ticket": 1, "instancia": 1, "observacao": 1, "motivo": 1, "motivo_rejeicao": 1,
         "acao": 1, "criado_por": 1, "nova_entrega": 1}
    ).to_list(20)

    if not docs:
        return {"has_cancelamento": False, "numero_pedido": pedido, "tipos": []}

    # Agrupa por tipo (pega o mais recente de cada — só tem pendentes nesta lista)
    por_tipo = {}
    for d in docs:
        t = d.get("tipo")
        if not t:
            continue
        if t not in por_tipo:
            por_tipo[t] = d

    return {
        "has_cancelamento": True,
        "numero_pedido": pedido,
        "tipos": list(por_tipo.values()),  # lista dos cancelamentos pendentes (1 por tipo)
        "tipos_keys": list(por_tipo.keys()),  # ex: ['aes', 'etr']
    }


@router.get("/cancelamentos/lookup/{numero_pedido}")
async def lookup_pedido(
    numero_pedido: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Busca dados do pedido para preenchimento automático no form de cancelamento.
    Inclui informação de alerta de recorrência por produto.
    """
    dados = await _enrich_from_tabelao(numero_pedido)
    if not dados:
        return {"encontrado": False, "numero_pedido": numero_pedido}

    sku = dados.get("codigo_item_vtex") or dados.get("codigo_item_bseller")
    alerta = None
    if sku:
        a = await alerta_produto(sku, dias=30, current_user=current_user)
        if a.get("alerta"):
            alerta = a

    return {
        "encontrado": True,
        "numero_pedido": numero_pedido,
        "dados": dados,
        "alerta_produto": alerta
    }


@router.get("/cancelamentos/lookup-sku/{sku}")
async def lookup_sku_similar(
    sku: str,
    current_user: dict = Depends(get_current_user),
):
    """Busca produto pelo SKU VTEX: primeiro no MongoDB (pedidos_erp), depois no catálogo PostgreSQL."""
    import os as _os
    import psycopg2
    from psycopg2.extras import RealDictCursor

    sku_clean = sku.strip().upper()

    # 1) MongoDB
    prod = await db.pedidos_erp.find_one(
        {"codigo_item_vtex": sku_clean},
        {"produto": 1, "codigo_item_bseller": 1, "_id": 0}
    )
    if prod and prod.get("produto"):
        return {"found": True, "sku": sku_clean, "nome": prod["produto"],
                "id_bseller": prod.get("codigo_item_bseller") or "", "fonte": "pedidos_erp"}

    # 2) PostgreSQL (itens + item_propriedades)
    pg_host = _os.getenv("PG_HOST")
    if not pg_host:
        raise HTTPException(status_code=404, detail=f"SKU '{sku_clean}' não encontrado no servidor")
    try:
        conn = psycopg2.connect(
            host=pg_host, port=_os.getenv("PG_PORT", "5432"),
            dbname=_os.getenv("PG_DB", "bigdata"), user=_os.getenv("PG_USER"),
            password=_os.getenv("PG_PASSWORD"), connect_timeout=5,
        )
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT ON (ip.cod_terceiro)
                    ip.id_item_bseller::text AS id_bseller,
                    i.descricao AS nome
                FROM item_propriedades ip
                JOIN itens i ON i.cod_terceiro = ip.cod_terceiro
                WHERE UPPER(ip.cod_terceiro) = %s
                LIMIT 1
            """, (sku_clean,))
            row = cur.fetchone()
        conn.close()
    except Exception:
        raise HTTPException(status_code=404, detail=f"SKU '{sku_clean}' não encontrado no servidor")

    if not row:
        raise HTTPException(status_code=404, detail=f"SKU '{sku_clean}' não encontrado no servidor")

    return {"found": True, "sku": sku_clean, "nome": row["nome"],
            "id_bseller": str(row["id_bseller"]) if row["id_bseller"] else "", "fonte": "catalogo"}


@router.post("/cancelamentos/auto-encerrar")
async def auto_encerrar_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Executa manualmente o auto-encerramento de cancelamentos AES cujo pedido
    avançou para 'NFe Aprovada' ou 'Entregue a Transportadora'. Retorna IDs
    encerrados e quantidade.
    """
    return await _auto_encerrar_aes_por_status_pedido()


@router.post("/cancelamentos/analisar-similares")
async def analisar_similares_endpoint(current_user: dict = Depends(get_current_user)):
    """Roda a busca de similares para o passivo de AES pendentes ainda não analisados."""
    return await _analisar_similares_pendentes(limit=500)


@router.post("/cancelamentos/{cancelamento_id}/propor-similares")
async def propor_similares(
    cancelamento_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Analista escolheu um ou mais similares para propor. O item vira 'Similar'
    (acao=Similar), NÃO segue como cancelamento. Os SKUs escolhidos vão para o texto.
    payload: {"skus": ["SKU1", "SKU2", ...]}
    """
    skus = [s.strip().upper() for s in (payload.get("skus") or []) if s and s.strip()]
    if not skus:
        raise HTTPException(status_code=400, detail="Selecione ao menos um similar")

    canc = await db.cancelamentos.find_one({"id": cancelamento_id}, {"_id": 0})
    if not canc:
        raise HTTPException(status_code=404, detail="cancelamento não encontrado")

    sugeridos = {s["sku"]: s for s in (canc.get("similares_sugeridos") or [])}
    escolhidos = [sugeridos[s] for s in skus if s in sugeridos]
    # Se o analista digitou um SKU fora da sugestão, ainda aceitamos (busca rápida no pedidos_erp)
    for s in skus:
        if s not in sugeridos:
            prod = await db.pedidos_erp.find_one({"codigo_item_vtex": s}, {"_id": 0, "produto": 1, "codigo_item_bseller": 1})
            escolhidos.append({
                "sku": s,
                "nome": (prod or {}).get("produto", ""),
                "id_bseller": (prod or {}).get("codigo_item_bseller", "") or "",
                "xd": 0, "ufs": [], "alerta_filial": None,
            })

    # Busca a imagem (VTEX) de cada similar escolhido
    try:
        from routes.produtos_busca import buscar_imagem_vtex
        for e in escolhidos:
            e["image_url"] = await buscar_imagem_vtex(e.get("sku", "")) or ""
    except Exception as ex:
        logger.warning(f"[propor] busca de imagem falhou: {ex}")

    primeiro = escolhidos[0] if escolhidos else {}
    data_br = _br_now().strftime("%d/%m")
    nomes = ", ".join(e["sku"] for e in escolhidos)
    nota = f"{data_br} - Proposto similar(es): {nomes}"

    # Aplica a decisão a TODOS os AES pendentes do mesmo SKU (mesma avaliação serve para todos)
    sku_item = (canc.get("codigo_item_vtex") or "").strip()
    if sku_item:
        irmaos = await db.cancelamentos.find(
            {"tipo": "aes", "status": "pendente", "codigo_item_vtex": sku_item},
            {"_id": 0, "id": 1, "observacao": 1},
        ).to_list(500)
    else:
        irmaos = [{"id": cancelamento_id, "observacao": canc.get("observacao") or ""}]

    for irmao in irmaos:
        obs = irmao.get("observacao") or ""
        nova_obs = obs if nota in obs else (nota + ("\n" + obs if obs else "")).strip()
        await db.cancelamentos.update_one(
            {"id": irmao["id"]},
            {"$set": {
                "acao": "Similar",
                "analise_similar": "proposto",
                "similares_propostos": skus,
                # Detalhe (sku, nome, id, imagem) de cada similar escolhido — usado no texto padrão
                "similares_propostos_detalhe": [
                    {"sku": e.get("sku", ""), "nome": e.get("nome", ""),
                     "id_bseller": e.get("id_bseller", ""), "image_url": e.get("image_url", "")}
                    for e in escolhidos
                ],
                "sku_similar": primeiro.get("sku", ""),
                "nome_similar": primeiro.get("nome", ""),
                "id_similar": primeiro.get("id_bseller", ""),
                "observacao": nova_obs,
                "updated_at": _iso_now_utc(),
            }},
        )
    doc = await db.cancelamentos.find_one({"id": cancelamento_id}, {"_id": 0})
    return {"success": True, "cancelamento": doc, "aplicados": len(irmaos)}


@router.post("/cancelamentos/{cancelamento_id}/seguir-cancelamento")
async def seguir_cancelamento(
    cancelamento_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Analista decidiu NÃO propor similar — segue como cancelamento normal (regra atual).
    Aplica a TODOS os AES pendentes do mesmo SKU."""
    canc = await db.cancelamentos.find_one({"id": cancelamento_id}, {"_id": 0})
    if not canc:
        raise HTTPException(status_code=404, detail="cancelamento não encontrado")
    data_br = _br_now().strftime("%d/%m")
    nota = f"{data_br} - Seguir com o cancelamento (sem similar)"

    sku_item = (canc.get("codigo_item_vtex") or "").strip()
    if sku_item:
        irmaos = await db.cancelamentos.find(
            {"tipo": "aes", "status": "pendente", "codigo_item_vtex": sku_item},
            {"_id": 0, "id": 1, "observacao": 1},
        ).to_list(500)
    else:
        irmaos = [{"id": cancelamento_id, "observacao": canc.get("observacao") or ""}]

    for irmao in irmaos:
        obs = irmao.get("observacao") or ""
        nova_obs = obs if "Seguir com o cancelamento" in obs else (nota + ("\n" + obs if obs else "")).strip()
        await db.cancelamentos.update_one(
            {"id": irmao["id"]},
            {"$set": {
                "acao": "Cancelar",
                "analise_similar": "cancelar",
                "observacao": nova_obs,
                "updated_at": _iso_now_utc(),
            }},
        )
    doc = await db.cancelamentos.find_one({"id": cancelamento_id}, {"_id": 0})
    return {"success": True, "cancelamento": doc, "aplicados": len(irmaos)}


@router.get("/cancelamentos/relacao-compras")
async def relacao_compras(current_user: dict = Depends(get_current_user)):
    """
    Relação de cancelamentos AES pendentes que TÊM estoque cross-dock
    (XD > threshold) e cujo pedido ainda NÃO foi cancelado.
    Retorna lista com: codigo_fornecedor, produto, sku, xd, ufs_estoque, entrega.
    Usado pelo botão "Relação Compras" da tela de Cancelamentos.
    """
    # 1) AES pendentes com XD > threshold e pedido ainda ativo
    pipeline = [
        {"$match": {"tipo": "aes", "status": "pendente"}},
        {"$lookup": {
            "from": "estoque_sigeq",
            "let": {"sku": "$codigo_item_vtex"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$cod_terceiro", "$$sku"]},
                    {"$eq": ["$source", "SIGEQ425"]},
                ]}}},
                {"$limit": 1},
                {"$project": {"_id": 0, "disp_venda": 1, "codigo_fornecedor": 1, "fornecedor": 1}},
            ],
            "as": "_xd",
        }},
        {"$lookup": {
            "from": "pedidos_erp",
            "localField": "numero_pedido",
            "foreignField": "numero_pedido",
            "as": "_pe",
        }},
        {"$addFields": {
            "xd_disp": {"$ifNull": [{"$arrayElemAt": ["$_xd.disp_venda", 0]}, 0]},
            "cod_fornec": {"$ifNull": [{"$arrayElemAt": ["$_xd.codigo_fornecedor", 0]}, "$codigo_fornecedor"]},
            "fornecedor_nome": {"$ifNull": [{"$arrayElemAt": ["$_xd.fornecedor", 0]}, {"$ifNull": ["$fornecedor", ""]}]},
            "status_pedido_atual": {"$ifNull": [{"$arrayElemAt": ["$_pe.status_pedido", 0]}, ""]},
            "_ticket_vazio": {"$eq": [{"$ifNull": ["$ticket", ""]}, ""]},
        }},
        {"$match": {
            "xd_disp": {"$gt": _XD_THRESHOLD},
            "_ticket_vazio": True,
        }},
        {"$project": {
            "_id": 0,
            "numero_pedido": 1,
            "codigo_item_vtex": 1,
            "produto": 1,
            "cod_fornec": 1,
            "fornecedor_nome": 1,
            "xd_disp": 1,
            "canal_vendas": 1,
            "status_pedido_atual": 1,
        }},
        {"$sort": {"fornecedor_nome": 1, "produto": 1}},
    ]
    docs = await db.cancelamentos.aggregate(pipeline).to_list(5000)
    if not docs:
        return {"total": 0, "itens": []}

    # 2) Para cada SKU, descobre as UFs onde está o estoque XD (Postgres estoque_xd)
    skus = sorted({d["codigo_item_vtex"] for d in docs if d.get("codigo_item_vtex")})
    ufs_por_sku: dict = {}
    if skus:
        import os as _os
        import psycopg2 as _pg
        from psycopg2.extras import RealDictCursor as _RDC
        try:
            conn = _pg.connect(
                host=_os.getenv("PG_HOST"), port=_os.getenv("PG_PORT", "5432"),
                dbname=_os.getenv("PG_DB", "bigdata"), user=_os.getenv("PG_USER"),
                password=_os.getenv("PG_PASSWORD"), connect_timeout=10,
            )
            with conn.cursor(cursor_factory=_RDC) as cur:
                cur.execute(
                    """
                    SELECT cod_terceiro, filial_id, SUM(disp_venda) AS qtd
                    FROM (
                      SELECT DISTINCT ON (cod_terceiro, filial_id)
                             cod_terceiro, filial_id, disp_venda
                      FROM estoque_xd
                      WHERE UPPER(cod_terceiro) = ANY(%s)
                        AND tipo_deposito = 'XD'
                      ORDER BY cod_terceiro, filial_id, snapshot_date DESC
                    ) t
                    WHERE disp_venda > 0
                    GROUP BY cod_terceiro, filial_id
                    """,
                    ([s.upper() for s in skus],),
                )
                ESTAB_UF = {4: "ES", 5: "ES", 7: "SP", 8: "SP", 10: "SC", 11: "SC"}
                for r in cur.fetchall():
                    sku = r["cod_terceiro"]
                    uf = ESTAB_UF.get(r["filial_id"])
                    if not uf:
                        continue
                    bucket = ufs_por_sku.setdefault(sku, {})
                    bucket[uf] = bucket.get(uf, 0) + int(r["qtd"])
            conn.close()
        except Exception as e:
            logger.warning(f"[relacao-compras] erro no postgres lookup: {e}")

    # 3) Monta saída
    itens = []
    for d in docs:
        sku = d.get("codigo_item_vtex") or ""
        ufs_dict = ufs_por_sku.get(sku.upper()) or {}
        ufs_str = ", ".join(f"{u} ({q})" for u, q in sorted(ufs_dict.items()))
        itens.append({
            "fornecedor": d.get("fornecedor_nome") or "",
            "codigo_fornecedor": d.get("cod_fornec") or "",
            "produto": d.get("produto") or "",
            "sku": sku,
            "xd": int(d.get("xd_disp") or 0),
            "ufs_estoque": ufs_str or "—",
            "ufs_dict": ufs_dict,  # raw para frontend formatar
            "entrega": d.get("numero_pedido") or "",
            "canal_vendas": d.get("canal_vendas") or "",
            "status_pedido": d.get("status_pedido_atual") or "",
        })
    return {"total": len(itens), "itens": itens}
