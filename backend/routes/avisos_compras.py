"""
Módulo: Avisos de Compras (Smart Compras → ELO)

Recebe avisos do Smart Compras V2 de que um item de um pedido NÃO vai chegar
(item órfão — o fornecedor não vai faturar o saldo) e os expõe no card do
atendimento (NovoChamado) como um alerta vermelho "identificado pelo Smart Compras".

Coleção ISOLADA `avisos_compras`. Na gravação NÃO toca em pedidos_erp, cancelamentos
nem chamados — se algo aqui falhar, o fluxo da atendente fica 100% intacto.

Ciclo de status:
  aberto    -> Smart Compras detectou que o item não vem (atendente decide similar/cancela)
  faturado  -> o item foi faturado DEPOIS (reversão / "Estado B"); pede nova atuação
  tratado   -> atendente resolveu (some do card)
  cancelado -> aviso descartado

Chave de casamento: numero_pedido = a Entrega (id_entrega), o mesmo identificador
que o ELO usa em pedidos_erp.numero_pedido e em todo o card. O Smart Compras envia
o id_entrega aqui como numero_pedido.
"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone

from utils.auth import get_current_user
from utils.database import db

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# Status que ainda aparecem no card da atendente
STATUS_ATIVOS = ("aberto", "faturado")


def _iso_now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_pedido(numero_pedido: str) -> str:
    # Mesma normalização do resto do ELO: tira espaços e o sufixo ".0"
    return str(numero_pedido).strip().split(".")[0]


# ============== MODELS ==============
class AvisoCompraCreate(BaseModel):
    numero_pedido: str                       # Entrega (id_entrega) — chave do card
    sku: str                                 # cod_terceiro
    pedido_externo: Optional[str] = None     # ped_externo (ex.: SCD-...)
    produto: Optional[str] = None            # descrição do item
    comentario: Optional[str] = None         # comentário do operador (Allan) ao enviar
    motivo: Optional[str] = None             # resolver_sem | resolver_xd | trocar_filial | ...
    # Rastreio Smart Compras (necessário para a reconciliação do Estado B)
    numero_po: Optional[str] = None
    po_id: Optional[int] = None
    po_item_id: Optional[int] = None
    cod_fornecedor: Optional[str] = None
    fornecedor: Optional[str] = None


class AvisoCompraUpdate(BaseModel):
    status: Optional[str] = None             # aberto | faturado | tratado | cancelado
    comentario: Optional[str] = None
    motivo: Optional[str] = None
    faturado_em: Optional[str] = None
    chamado_id: Optional[str] = None


# ============== ENDPOINTS ==============
@router.post("/avisos-compras")
async def criar_aviso(aviso: AvisoCompraCreate, current_user: dict = Depends(get_current_user)):
    """
    Smart Compras grava um aviso de "produto não vem" para um item de um pedido.
    Idempotente por (numero_pedido, sku) em estado ativo: reenvio ATUALIZA o comentário
    em vez de duplicar o alerta no card.
    """
    pedido = _norm_pedido(aviso.numero_pedido)
    sku = str(aviso.sku).strip()
    if not pedido or not sku:
        raise HTTPException(status_code=400, detail="numero_pedido e sku são obrigatórios")

    agora = _iso_now_utc()
    criado_por = current_user.get("email") or current_user.get("name") or "smart_compras"

    existente = await db.avisos_compras.find_one(
        {"numero_pedido": pedido, "sku": sku, "status": {"$in": list(STATUS_ATIVOS)}},
        {"_id": 0, "id": 1},
    )
    if existente:
        await db.avisos_compras.update_one(
            {"id": existente["id"]},
            {"$set": {
                "comentario": aviso.comentario,
                "motivo": aviso.motivo,
                "pedido_externo": aviso.pedido_externo,
                "produto": aviso.produto,
                "numero_po": aviso.numero_po,
                "po_id": aviso.po_id,
                "po_item_id": aviso.po_item_id,
                "cod_fornecedor": aviso.cod_fornecedor,
                "fornecedor": aviso.fornecedor,
                "atualizado_em": agora,
                "atualizado_por": criado_por,
            }},
        )
        doc = await db.avisos_compras.find_one({"id": existente["id"]}, {"_id": 0})
        logger.info(f"[avisos_compras] aviso atualizado pedido={pedido} sku={sku} por={criado_por}")
        return {"ok": True, "novo": False, "aviso": doc}

    doc = {
        "id": str(uuid.uuid4()),
        "numero_pedido": pedido,
        "sku": sku,
        "pedido_externo": aviso.pedido_externo,
        "produto": aviso.produto,
        "origem": "smart_compras",
        "status": "aberto",
        "comentario": aviso.comentario,
        "motivo": aviso.motivo,
        "numero_po": aviso.numero_po,
        "po_id": aviso.po_id,
        "po_item_id": aviso.po_item_id,
        "cod_fornecedor": aviso.cod_fornecedor,
        "fornecedor": aviso.fornecedor,
        "criado_por": criado_por,
        "criado_em": agora,
        "atualizado_em": agora,
        "faturado_em": None,
        "chamado_id": None,
    }
    await db.avisos_compras.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"[avisos_compras] novo aviso pedido={pedido} sku={sku} por={criado_por}")
    # notifica a Adneia no sino (só no aviso NOVO; reenvio cai no ramo de update acima)
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "tipo": "aviso_compras",
            "destinatario_email": "adneia@weconnect360.com.br",
            "titulo": "Novo aviso de Compras",
            "mensagem": f"Pedido {pedido} · {aviso.produto or sku}: item sem previsão de chegada.",
            "lida": False,
            "data_criacao": agora,
            "dados_extras": {"numero_pedido": pedido, "sku": sku, "aviso_id": doc["id"]},
        })
    except Exception:
        logger.exception("[avisos_compras] notificacao do sino falhou")
    return {"ok": True, "novo": True, "aviso": doc}


@router.get("/avisos-compras")
async def listar_pendentes(current_user: dict = Depends(get_current_user)):
    """Lista global dos avisos pendentes (aberto/faturado) — pra página e contador do menu."""
    docs = (
        await db.avisos_compras.find(
            {"status": {"$in": list(STATUS_ATIVOS)}}, {"_id": 0}
        )
        .sort("criado_em", -1)
        .to_list(500)
    )
    docs.sort(key=lambda d: 0 if d.get("status") == "faturado" else 1)  # faturado (voltou) primeiro
    return {"total": len(docs), "avisos": docs}


@router.get("/avisos-compras/check/{numero_pedido}")
async def check_avisos(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """
    Usado pelo card (NovoChamado) para mostrar o alerta vermelho "identificado pelo
    Smart Compras". Retorna só os avisos ATIVOS (aberto/faturado). Espelha o
    /api/cancelamentos/check/{numero_pedido}.
    """
    pedido = _norm_pedido(numero_pedido)
    docs = await db.avisos_compras.find(
        {"numero_pedido": pedido, "status": {"$in": list(STATUS_ATIVOS)}},
        {"_id": 0},
    ).to_list(50)
    return {
        "has_aviso": len(docs) > 0,
        "numero_pedido": pedido,
        "avisos": docs,
    }


@router.get("/avisos-compras/{numero_pedido}")
async def listar_avisos(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """Lista todos os avisos de um pedido (qualquer status), para histórico/debug."""
    pedido = _norm_pedido(numero_pedido)
    docs = (
        await db.avisos_compras.find({"numero_pedido": pedido}, {"_id": 0})
        .sort("criado_em", -1)
        .to_list(50)
    )
    return {"numero_pedido": pedido, "total": len(docs), "avisos": docs}


@router.put("/avisos-compras/{aviso_id}")
async def atualizar_aviso(
    aviso_id: str, upd: AvisoCompraUpdate, current_user: dict = Depends(get_current_user)
):
    """Atualiza status/comentário de um aviso (ex.: atendente marca 'tratado')."""
    aviso = await db.avisos_compras.find_one({"id": aviso_id}, {"_id": 0})
    if not aviso:
        raise HTTPException(status_code=404, detail="Aviso não encontrado")
    campos = {k: v for k, v in upd.model_dump().items() if v is not None}
    if not campos:
        return {"ok": True, "aviso": aviso}
    campos["atualizado_em"] = _iso_now_utc()
    campos["atualizado_por"] = current_user.get("email") or current_user.get("name")
    await db.avisos_compras.update_one({"id": aviso_id}, {"$set": campos})
    doc = await db.avisos_compras.find_one({"id": aviso_id}, {"_id": 0})
    return {"ok": True, "aviso": doc}


class ReverterRequest(BaseModel):
    numero_pedido: str                # Entrega (id_entrega)
    sku: Optional[str] = None         # cod_terceiro — limita o reverter a esse item
    comentario: Optional[str] = None


@router.post("/avisos-compras/reverter")
async def reverter_aviso(req: ReverterRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """
    Estado B: o item antes marcado "não vem" foi FATURADO. Marca o(s) aviso(s)
    como faturado, grava observação no chamado do pedido e REABRE o chamado se
    estava fechado, pra a atendente retomar o atendimento.
    """
    pedido = _norm_pedido(req.numero_pedido)
    agora = _iso_now_utc()
    quem = current_user.get("name") or current_user.get("email") or "Smart Compras"

    # 1) marca o(s) aviso(s) ativo(s) como faturado
    filtro = {"numero_pedido": pedido, "status": "aberto"}
    if req.sku:
        filtro["sku"] = str(req.sku).strip()
    avisos = await db.avisos_compras.find(filtro, {"_id": 0, "id": 1, "sku": 1}).to_list(50)
    for a in avisos:
        await db.avisos_compras.update_one(
            {"id": a["id"]},
            {"$set": {"status": "faturado", "faturado_em": agora, "atualizado_em": agora}},
        )

    # idempotência: sem aviso ativo pra reverter, não toca em chamado
    if not avisos:
        return {"ok": True, "numero_pedido": pedido, "avisos_faturados": 0,
                "chamado_id": None, "reaberto": False, "anotado": False}

    sku_txt = (req.sku or avisos[0].get("sku") or "").strip()

    # 2) escolhe o chamado certo: prefere o ÚLTIMO FECHADO (data_fechamento tem hora →
    # sort determinístico; é o que a atendente fechou ao tratar a falta). Sem fechado,
    # anota no aberto mais recente. Só reabre se estava fechado.
    fechados = await db.chamados.find(
        {"numero_pedido": pedido, "pendente": False}
    ).sort("data_fechamento", -1).to_list(50)
    if fechados:
        chamado = fechados[0]
    else:
        chamado = await db.chamados.find_one(
            {"numero_pedido": pedido, "pendente": True}, sort=[("data_abertura", -1)]
        )

    reaberto = False
    anotado = False
    chamado_id = None
    if chamado:
        chamado_id = chamado["id"]
        hoje = datetime.now(timezone.utc).strftime("%d/%m/%Y")
        nota = f"[{hoje}] Smart Compras: item {sku_txt or '(item)'} foi identificado como falta MAS FOI FATURADO — retornar/tratar."
        if req.comentario:
            nota += f" ({req.comentario})"
        obs = chamado.get("anotacoes") or ""
        novas = (nota + ("\n\n" + obs if obs else "")).strip()
        upd = {"anotacoes": novas, "retornar_chamado": True, "verificar_adneia": True}
        if not chamado.get("pendente", True):
            upd["pendente"] = True
            upd["data_fechamento"] = None
            reaberto = True
        await db.chamados.update_one({"id": chamado_id}, {"$set": upd})
        anotado = True
        # espelha na planilha de gestão (igual o reabrir oficial), sem bloquear
        try:
            from routes.chamados import sync_update_to_google_sheets
            background_tasks.add_task(sync_update_to_google_sheets, pedido, upd)
        except Exception:
            logger.exception("[avisos_compras] sheets sync do reverter falhou")
        try:
            from models.historico import Historico
            h = Historico(
                chamado_id=chamado_id,
                tipo_acao="Reabertura" if reaberto else "Nota",
                descricao=f"Smart Compras: item {sku_txt} faturado após aviso de falta ({'reaberto' if reaberto else 'anotado'})",
                usuario_id=current_user.get("id", ""),
                usuario_nome=quem,
            )
            hd = h.model_dump()
            hd["data_hora"] = hd["data_hora"].isoformat()
            await db.historico.insert_one(hd)
        except Exception:
            logger.exception("[avisos_compras] historico do reverter falhou")

    logger.info(f"[avisos_compras] reverter pedido={pedido} sku={sku_txt} avisos={len(avisos)} reaberto={reaberto} anotado={anotado}")
    return {
        "ok": True,
        "numero_pedido": pedido,
        "avisos_faturados": len(avisos),
        "chamado_id": chamado_id,
        "reaberto": reaberto,
        "anotado": anotado,
    }
