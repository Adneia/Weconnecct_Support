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


def _br_now():
    return datetime.now(timezone(timedelta(hours=-3)))


def _iso_now_utc():
    return datetime.now(timezone.utc).isoformat()


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
    query = {}
    if tipo:
        query["tipo"] = tipo
    if status:
        query["status"] = status

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
        {"$addFields": {
            "tem_atendimento": {"$gt": [{"$size": "$chamados_relacionados"}, 0]},
            "id_atendimento": {"$arrayElemAt": ["$chamados_relacionados.id_atendimento", 0]},
            "solicitacao_atendimento": {"$arrayElemAt": ["$chamados_relacionados.solicitacao", 0]},
        }},
        {"$project": {"_id": 0, "chamados_relacionados": 0}},
    ]
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
    Verifica se um pedido tem cancelamento em AES, ETR ou Erro na Nota.
    Usado no NovoChamado para mostrar alerta ao atendente.
    Retorna lista de todos os tipos encontrados, com status (pendente/encerrado).
    """
    pedido = str(numero_pedido).strip().split(".")[0]
    docs = await db.cancelamentos.find(
        {"numero_pedido": pedido},
        {"_id": 0, "id": 1, "tipo": 1, "status": 1, "data": 1, "data_encerramento": 1,
         "ticket": 1, "instancia": 1, "observacao": 1, "motivo": 1, "motivo_rejeicao": 1,
         "acao": 1, "criado_por": 1, "nova_entrega": 1}
    ).to_list(20)

    if not docs:
        return {"has_cancelamento": False, "numero_pedido": pedido, "tipos": []}

    # Agrupa por tipo (pega o mais recente de cada)
    por_tipo = {}
    for d in docs:
        t = d.get("tipo")
        if not t:
            continue
        if t not in por_tipo:
            por_tipo[t] = d
        else:
            # Prioriza pendente sobre encerrado
            if por_tipo[t].get("status") == "encerrado" and d.get("status") != "encerrado":
                por_tipo[t] = d

    return {
        "has_cancelamento": True,
        "numero_pedido": pedido,
        "tipos": list(por_tipo.values()),  # lista dos cancelamentos (1 por tipo)
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
