"""
Módulo: Pagamento Não Aprovado
Gerencia pedidos com "Aguardando aprovação de pagamento" do canal Tudo Azul.
Pedidos com 7+ dias no status precisam de instância + cancelamento.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from utils.auth import get_current_user
from utils.database import db
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BRT = timezone(timedelta(hours=-3))

INSTANCIA_TEMPLATE = {
    "assunto": "Troca/Cancelamento antes da NF",
    "categoria": "Falha de Vendas",
    "motivo": "Pagamento não Aprovado",
    "observacao": "Pedido cancelado por falta de pagamento. Prazo de 7 dias expirado.",
}

CANCELAMENTO_STEPS = "Pedidos de Saída → Pagamentos → Análise Manual → Meio Pagto: 2 (Boleto) → Cliente: {cpf} → Status Reprovar → Processar"


def _dias_no_status(data_status: str):
    """Calcula dias desde a data do status até hoje. Aceita DD/MM/YYYY ou YYYY-MM-DD.
    Usa apenas a parte da data (sem hora) para evitar que o horário do status
    atrase a contagem — ex: status às 23h do dia 6 ainda conta como dia 6."""
    if not data_status:
        return None
    s = str(data_status).strip().split(".")[0]  # remove microsegundos
    formatos = [
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]
    # "Hoje" em BRT — date_type.today() pegaria a data do SO (UTC) e induziria erros
    # de "dias no status" próximo da virada do dia em UTC (que é 21h BRT).
    hoje_brt = datetime.now(BRT).date()
    for fmt in formatos:
        try:
            dt = datetime.strptime(s, fmt)
            return (hoje_brt - dt.date()).days
        except Exception:
            continue
    return None


def _data_status_iso(data_status: str) -> str:
    """Converte a data do status (DD/MM/YYYY ... ou YYYY-MM-DD ...) para 'YYYY-MM-DD'.
    Usada como data de ENTRADA no saldo rolante quando o pedido veio do tabelão
    sem registro de acompanhamento (sem criado_em)."""
    if not data_status:
        return ""
    s = str(data_status).strip().split(".")[0]
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    return ""


@router.get("/api/pagamento")
async def listar_pagamento(current_user: dict = Depends(get_current_user)):
    """
    Lista todos os pedidos com status Aguardando Aprovação de Pagamento (Tudo Azul).
    Inclui pedidos ativos no tabelão + todos já acompanhados.
    """
    # 1. Pedidos ativos no tabelão (Tudo Azul + status pagamento)
    pipeline_ag = [
        {"$match": {
            "status_pedido": {"$regex": "aguardando aprovação de pagamento", "$options": "i"},
            "canal_vendas": {"$regex": "tudo azul", "$options": "i"},
        }},
        {"$sort": {"data_status": 1}},
        {"$group": {
            "_id": "$numero_pedido",
            "numero_pedido": {"$first": "$numero_pedido"},
            "nota_fiscal": {"$first": "$nota_fiscal"},
            "canal_vendas": {"$first": "$canal_vendas"},
            "nome_cliente": {"$first": "$nome_cliente"},
            "cpf_cliente": {"$first": "$cpf_cliente"},
            "fone_cliente": {"$first": "$fone_cliente"},
            "email_cliente": {"$first": "$email_cliente"},
            "produto": {"$first": "$produto"},
            "status_pedido": {"$first": "$status_pedido"},
            "data_status": {"$first": "$data_status"},
        }},
    ]
    pedidos_ag = await db.pedidos_erp.aggregate(pipeline_ag).to_list(2000)
    pedidos_dict = {p["numero_pedido"]: p for p in pedidos_ag if p.get("numero_pedido")}

    # 2. Todos os acompanhamentos existentes
    acomp_list = await db.pagamento_acompanhamento.find({}, {"_id": 0}).to_list(5000)
    acomp_dict = {a["numero_pedido"]: a for a in acomp_list if a.get("numero_pedido")}

    # 3. Para pedidos já acompanhados que saíram do tabelão, buscar status atual
    pedidos_extra = [n for n in acomp_dict if n not in pedidos_dict]
    if pedidos_extra:
        pipeline_extra = [
            {"$match": {"numero_pedido": {"$in": pedidos_extra}}},
            {"$sort": {"data_status": -1}},
            {"$group": {
                "_id": "$numero_pedido",
                "numero_pedido": {"$first": "$numero_pedido"},
                "nota_fiscal": {"$first": "$nota_fiscal"},
                "canal_vendas": {"$first": "$canal_vendas"},
                "nome_cliente": {"$first": "$nome_cliente"},
                "cpf_cliente": {"$first": "$cpf_cliente"},
                "fone_cliente": {"$first": "$fone_cliente"},
                "email_cliente": {"$first": "$email_cliente"},
                "produto": {"$first": "$produto"},
                "status_pedido": {"$first": "$status_pedido"},
                "data_status": {"$first": "$data_status"},
            }},
        ]
        for p in await db.pedidos_erp.aggregate(pipeline_extra).to_list(2000):
            pedidos_dict[p["numero_pedido"]] = p

    # 4. Resultado unificado
    all_pedidos = set(pedidos_dict.keys()) | set(acomp_dict.keys())
    result = []

    for num in all_pedidos:
        pedido = pedidos_dict.get(num, {})
        acomp = acomp_dict.get(num, {})

        data_status = pedido.get("data_status") or acomp.get("data_status", "")
        dias = _dias_no_status(data_status)

        result.append({
            "numero_pedido": num,
            "nota_fiscal": str(pedido.get("nota_fiscal") or acomp.get("nota_fiscal", "")).split(".")[0],
            "canal_vendas": pedido.get("canal_vendas") or acomp.get("canal_vendas", "Tudo Azul"),
            "nome_cliente": pedido.get("nome_cliente") or acomp.get("nome_cliente", ""),
            "cpf_cliente": pedido.get("cpf_cliente") or acomp.get("cpf_cliente", ""),
            "fone_cliente": pedido.get("fone_cliente") or acomp.get("fone_cliente", ""),
            "email_cliente": pedido.get("email_cliente") or acomp.get("email_cliente", ""),
            "produto": pedido.get("produto") or acomp.get("produto", ""),
            "status_pedido": pedido.get("status_pedido", ""),
            "data_status": data_status,
            "dias_no_status": dias,
            "instancia": acomp.get("instancia", ""),
            "status_final": acomp.get("status_final"),
            "data_instancia": acomp.get("data_instancia"),
            "registrado_por": acomp.get("registrado_por"),
            # Datas para o saldo rolante do dashboard (entrada x resolução).
            # Fallback: pedidos vindos do tabelão sem acompanhamento usam a data do status.
            "criado_em": acomp.get("criado_em") or acomp.get("registrado_em") or _data_status_iso(data_status),
            "updated_at": acomp.get("updated_at", ""),
        })

    # Ordenação: urgentes (7+ dias, sem processar) primeiro → por dias desc → finalizados por último
    def sort_key(x):
        is_done = x["status_final"] is not None
        dias = x["dias_no_status"] if x["dias_no_status"] is not None else 9999
        return (is_done, -dias)

    result.sort(key=sort_key)

    return {
        "pedidos": result,
        "instancia_template": INSTANCIA_TEMPLATE,
    }


@router.post("/api/pagamento/{numero_pedido}/processar")
async def processar_pedido(
    numero_pedido: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Registra número da instância e marca pedido como Cancelado.
    """
    instancia = payload.get("instancia", "").strip()
    agora_brt = datetime.now(BRT).strftime("%d/%m/%Y %H:%M")

    set_data = {
        "instancia": instancia,
        "status_final": "Cancelado",
        "data_instancia": agora_brt,
        "registrado_por": current_user.get("name") or current_user.get("email", "?"),
        "registrado_em": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Salvar dados do pedido para caso saia do tabelão
    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    if pedido:
        set_data.update({
            "nota_fiscal": str(pedido.get("nota_fiscal", "")).split(".")[0],
            "canal_vendas": pedido.get("canal_vendas"),
            "nome_cliente": pedido.get("nome_cliente"),
            "cpf_cliente": pedido.get("cpf_cliente"),
            "fone_cliente": pedido.get("fone_cliente"),
            "email_cliente": pedido.get("email_cliente"),
            "produto": pedido.get("produto"),
            "data_status": pedido.get("data_status"),
        })

    await db.pagamento_acompanhamento.update_one(
        {"numero_pedido": numero_pedido},
        {
            "$set": set_data,
            "$setOnInsert": {
                "numero_pedido": numero_pedido,
                "criado_em": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True,
    )
    return {"ok": True}
