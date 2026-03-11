from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ============== VERIFICAR CANAIS ==============

@router.get("/atendimentos/verificar-canais")
async def verificar_canais_sem_atividade(current_user: dict = Depends(get_current_user)):
    CANAIS_DIARIOS = [
        "Reclame aqui", "ZAP/E-mail", "Mercado Livre", "LL Loyalty",
        "Sicredi", "CSU", "Nicequest", "GRS", "LTM", "Camicado",
        "Coopera", "Livelo", "Tudo Azul", "SENFF", "ShopHub", "Bradesco"
    ]
    hoje = datetime.now(timezone.utc)
    dia_inicio = hoje.replace(hour=0, minute=0, second=0, microsecond=0)
    canais_sem_atividade = []
    canais_com_atividade = []
    for canal in CANAIS_DIARIOS:
        count = await db.chamados.count_documents({
            "$or": [{"parceiro": canal}, {"canal_vendas": canal}],
            "data_abertura": {"$gte": dia_inicio.isoformat()}
        })
        if count == 0:
            canais_sem_atividade.append(canal)
        else:
            canais_com_atividade.append({"canal": canal, "atendimentos": count})
    return {
        "canais_sem_atividade": canais_sem_atividade,
        "canais_com_atividade": canais_com_atividade,
        "total_canais": len(CANAIS_DIARIOS)
    }


@router.post("/atendimentos/finalizar-dia")
async def finalizar_dia(current_user: dict = Depends(get_current_user)):
    hoje = datetime.now(timezone.utc)
    dia_inicio = hoje.replace(hour=0, minute=0, second=0, microsecond=0)
    abertos_hoje = await db.chamados.count_documents({"data_abertura": {"$gte": dia_inicio.isoformat()}})
    fechados_hoje = await db.chamados.count_documents({"data_fechamento": {"$gte": dia_inicio.isoformat()}})
    pendentes = await db.chamados.count_documents({"pendente": True})
    return {
        "data": hoje.strftime("%d/%m/%Y"),
        "abertos_hoje": abertos_hoje,
        "fechados_hoje": fechados_hoje,
        "pendentes_total": pendentes,
        "saldo": fechados_hoje - abertos_hoje
    }


# ============== NOTIFICACOES ==============

@router.get("/notificacoes")
async def list_notificacoes(current_user: dict = Depends(get_current_user)):
    notificacoes = await db.notifications.find(
        {"destinatario_email": current_user['email']}, {"_id": 0}
    ).sort("data_criacao", -1).to_list(50)
    nao_lidas = sum(1 for n in notificacoes if not n.get('lida', False))
    return {
        "notificacoes": notificacoes,
        "nao_lidas": nao_lidas
    }


@router.put("/notificacoes/{notificacao_id}/lida")
async def marcar_notificacao_lida(notificacao_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notificacao_id, "destinatario_email": current_user['email']},
        {"$set": {"lida": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return {"message": "Notificação marcada como lida"}


@router.put("/notificacoes/marcar-todas-lidas")
async def marcar_todas_lidas(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"destinatario_email": current_user['email'], "lida": False},
        {"$set": {"lida": True}}
    )
    return {"message": "Todas notificações marcadas como lidas"}
