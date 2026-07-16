from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe, BRT_TZ, now_brt, today_brt

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ============== VERIFICAR CANAIS ==============

CANAIS_DIARIOS = [
    "Reclame aqui", "ZAP/E-mail", "Mercado Livre", "LL Loyalty",
    "Sicredi", "CSU", "Nicequest", "GRS", "LTM", "Camicado",
    "Coopera", "Livelo", "Tudo Azul", "SENFF", "ShopHub", "Bradesco"
]


async def _verificar_canais():
    """
    Retorna canais classificados em 3 categorias hoje:
    - encerrado: tem check do dashboard (independente de chamados)
    - em_andamento: tem chamados mas SEM check do dashboard
    - sem_atividade: SEM chamados e SEM check
    """
    # "Hoje" em horário de Brasília. O servidor roda em UTC; sem essa conversão,
    # entre 21:00 e 23:59 BRT a notificação trataria o "hoje" como o dia seguinte.
    hoje_brt = now_brt()
    hoje_str = hoje_brt.strftime("%Y-%m-%d")
    # Início do dia BRT convertido pra UTC (campo data_abertura no Mongo é UTC).
    dia_inicio_utc = hoje_brt.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

    # Carrega TODOS os checks de canais marcados hoje (dashboard)
    checks_hoje = await db.canal_checks.find(
        {"data": hoje_str},
        {"_id": 0}
    ).to_list(200)
    checks_por_canal = {c["canal"]: c for c in checks_hoje}

    encerrado_detalhes = []  # [{canal, atendimentos, check_por, check_em}]
    em_andamento_detalhes = []  # [{canal, atendimentos}]
    sem_atividade = []  # [canal names]

    for canal in CANAIS_DIARIOS:
        count = await db.chamados.count_documents({
            "$or": [{"parceiro": canal}, {"canal_vendas": canal}],
            "data_abertura": {"$gte": dia_inicio_utc.isoformat()}
        })
        check = checks_por_canal.get(canal)

        if check:
            # Encerrado: foi marcado como verificado
            encerrado_detalhes.append({
                "canal": canal,
                "atendimentos": count,
                "check_por": check.get("marcado_por", ""),
                "check_em": check.get("marcado_em", ""),
            })
        elif count > 0:
            # Em andamento: tem chamados mas ninguém marcou o check ainda
            em_andamento_detalhes.append({
                "canal": canal,
                "atendimentos": count,
            })
        else:
            # Sem atividade: sem chamados e sem check
            sem_atividade.append(canal)

    return encerrado_detalhes, em_andamento_detalhes, sem_atividade


@router.get("/atendimentos/verificar-canais")
async def verificar_canais_sem_atividade(current_user: dict = Depends(get_current_user)):
    encerrado_detalhes, em_andamento_detalhes, sem = await _verificar_canais()
    return {
        "encerrado": [d["canal"] for d in encerrado_detalhes],
        "encerrado_detalhes": encerrado_detalhes,
        "em_andamento": [d["canal"] for d in em_andamento_detalhes],
        "em_andamento_detalhes": em_andamento_detalhes,
        "canais_sem_atividade": sem,
        # Mantidos por compatibilidade com o modal de "Finalizar Atendimentos do Dia"
        "canais_com_atividade": [d["canal"] for d in encerrado_detalhes] + [d["canal"] for d in em_andamento_detalhes],
        "canais_com_atividade_detalhes": encerrado_detalhes + em_andamento_detalhes,
        "total_canais": len(CANAIS_DIARIOS)
    }


@router.post("/atendimentos/finalizar-dia")
async def finalizar_dia(current_user: dict = Depends(get_current_user)):
    import uuid
    # "Hoje" em BRT — sem isso, depois das 21h BRT a notificação contaria o dia errado.
    hoje_brt = now_brt()
    dia_inicio_utc = hoje_brt.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    abertos_hoje = await db.chamados.count_documents({"data_abertura": {"$gte": dia_inicio_utc.isoformat()}})
    fechados_hoje = await db.chamados.count_documents({"data_fechamento": {"$gte": dia_inicio_utc.isoformat()}})
    pendentes = await db.chamados.count_documents({"pendente": True})

    # Classifica canais em 3 categorias
    encerrado_detalhes, em_andamento_detalhes, sem = await _verificar_canais()

    # Pré-processa horário BRT do check de cada canal encerrado
    for d in encerrado_detalhes:
        try:
            from datetime import datetime as _dt
            check_em = d.get("check_em", "")
            if check_em:
                dt = _dt.fromisoformat(check_em.replace("Z", "+00:00"))
                dt_brt = dt.astimezone(BRT_TZ)
                d["check_hora"] = dt_brt.strftime("%H:%M")
        except Exception:
            pass

    # Monta a mensagem
    user_name = current_user.get("name") or current_user.get("email", "Sistema")
    data_str = hoje_brt.strftime("%d/%m/%Y")
    partes = [
        f"{abertos_hoje} aberto(s)",
        f"{fechados_hoje} fechado(s)",
        f"{pendentes} pendente(s) no total",
    ]
    mensagem = f"Dia {data_str} finalizado por {user_name}. {', '.join(partes)}."

    # Cria notificação somente para admins (dia_finalizado é operacional)
    try:
        usuarios = await db.users.find(
            {"role": "admin"},
            {"email": 1, "_id": 0}
        ).to_list(50)
        emails = set(u["email"] for u in usuarios if u.get("email"))
        # Sempre inclui o próprio usuário que finalizou
        if current_user.get("email"):
            emails.add(current_user["email"])

        for email in emails:
            notif = {
                "id": str(uuid.uuid4()),
                "tipo": "dia_finalizado",
                "titulo": f"Dia {data_str} finalizado",
                "mensagem": mensagem,
                "destinatario_email": email,
                "dados_extras": {
                    "data": data_str,
                    "abertos_hoje": abertos_hoje,
                    "fechados_hoje": fechados_hoje,
                    "pendentes_total": pendentes,
                    "saldo": fechados_hoje - abertos_hoje,
                    "encerrado_detalhes": encerrado_detalhes,
                    "em_andamento_detalhes": em_andamento_detalhes,
                    "canais_sem_atividade": sem,
                    "finalizado_por": user_name,
                },
                "data_criacao": datetime.now(timezone.utc).isoformat(),
                "lida": False,
                "criado_por_nome": user_name,
            }
            await db.notifications.insert_one(notif)
    except Exception as e:
        logger.warning(f"Erro ao criar notificação de finalização do dia: {e}")

    return {
        "success": True,
        "data": data_str,
        "abertos_hoje": abertos_hoje,
        "fechados_hoje": fechados_hoje,
        "pendentes_total": pendentes,
        "saldo": fechados_hoje - abertos_hoje,
        "encerrado": [d["canal"] for d in encerrado_detalhes],
        "em_andamento": [d["canal"] for d in em_andamento_detalhes],
        "canais_sem_atividade": sem,
        "mensagem": mensagem
    }


# ============== NOTIFICACOES ==============

@router.get("/notificacoes")
async def list_notificacoes(
    limit: int = 50,
    apenas_nao_lidas: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Lista notificações do usuário (mais recentes primeiro).
    limit: quantas retornar (máx. 2000; padrão 50 — o sininho usa o padrão).
    apenas_nao_lidas=1: só as não lidas. Retorna também os TOTAIS reais
    (contados no banco, independente do limit)."""
    limit = max(1, min(int(limit or 50), 2000))
    q = {"destinatario_email": current_user['email']}
    total = await db.notifications.count_documents(q)
    nao_lidas = await db.notifications.count_documents({**q, "lida": {"$ne": True}})
    if apenas_nao_lidas:
        q["lida"] = {"$ne": True}
    notificacoes = await db.notifications.find(q, {"_id": 0}).sort("data_criacao", -1).to_list(limit)
    return {
        "notificacoes": notificacoes,
        "nao_lidas": nao_lidas,
        "total": total,
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
