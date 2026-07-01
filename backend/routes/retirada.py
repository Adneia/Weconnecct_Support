"""
Módulo: Disponível para Retirada
Gerencia o acompanhamento de pedidos aguardando retirada na agência dos Correios.
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from utils.auth import get_current_user
from utils.database import db
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BRT = timezone(timedelta(hours=-3))


def _is_total(transportadora: str) -> bool:
    if not transportadora:
        return False
    return "total" in transportadora.lower()


@router.get("/api/retirada")
async def listar_retirada(current_user: dict = Depends(get_current_user)):
    """
    Lista pedidos Disponíveis para Retirada.
    Inclui AGUARDANDO RETIRADA do tabelão + todos que já foram acompanhados.
    """
    # 1. Todos os AGUARDANDO RETIRADA no tabelão (deduplicado por nota_fiscal)
    pipeline_ag = [
        {"$match": {"status_pedido": "AGUARDANDO RETIRADA"}},
        {"$sort": {"data_status": -1}},
        {"$group": {
            "_id": "$nota_fiscal",
            "numero_pedido": {"$first": "$numero_pedido"},
            "nota_fiscal": {"$first": "$nota_fiscal"},
            "canal_vendas": {"$first": "$canal_vendas"},
            "transportadora": {"$first": "$transportadora"},
            "nome_cliente": {"$first": "$nome_cliente"},
            "fone_cliente": {"$first": "$fone_cliente"},
            "email_cliente": {"$first": "$email_cliente"},
            "produto": {"$first": "$produto"},
            "status_pedido": {"$first": "$status_pedido"},
            "data_status": {"$first": "$data_status"},
        }}
    ]
    pedidos_ag = await db.pedidos_erp.aggregate(pipeline_ag).to_list(2000)
    pedidos_dict = {p["nota_fiscal"]: p for p in pedidos_ag if p.get("nota_fiscal")}

    # 2. Todos os acompanhamentos existentes
    acomp_list = await db.retirada_acompanhamento.find({}, {"_id": 0}).to_list(5000)
    acomp_dict = {a["nota_fiscal"]: a for a in acomp_list if a.get("nota_fiscal")}

    # 3. Para notas já acompanhadas, buscar status atual no tabelão (podem ter mudado)
    notas_extra = [n for n in acomp_dict if n not in pedidos_dict]
    if notas_extra:
        pipeline_extra = [
            {"$match": {"nota_fiscal": {"$in": notas_extra}}},
            {"$sort": {"data_status": -1}},
            {"$group": {
                "_id": "$nota_fiscal",
                "numero_pedido": {"$first": "$numero_pedido"},
                "nota_fiscal": {"$first": "$nota_fiscal"},
                "canal_vendas": {"$first": "$canal_vendas"},
                "transportadora": {"$first": "$transportadora"},
                "nome_cliente": {"$first": "$nome_cliente"},
                "fone_cliente": {"$first": "$fone_cliente"},
                "email_cliente": {"$first": "$email_cliente"},
                "produto": {"$first": "$produto"},
                "status_pedido": {"$first": "$status_pedido"},
                "data_status": {"$first": "$data_status"},
            }}
        ]
        for p in await db.pedidos_erp.aggregate(pipeline_extra).to_list(2000):
            pedidos_dict[p["nota_fiscal"]] = p

    # Mapeamento de status do tabelão → status_final
    AUTO_FINALIZE = {
        "ENTREGUE": "Entregue",
        "EM DEVOLUÇÃO": "Em Devolução",
        "DEVOLVIDO": "Em Devolução",
    }

    # 4. Resultado unificado
    all_notas = set(pedidos_dict.keys()) | set(acomp_dict.keys())
    result = []
    for nota in all_notas:
        pedido = pedidos_dict.get(nota, {})
        acomp = acomp_dict.get(nota, {})
        # Inserção manual: a nota fiscal NÃO é única (mesma nota em entregas diferentes).
        # Busca o pedido pela ENTREGA específica para não pegar a entrega errada na colisão.
        if acomp.get("inserido_manual") and acomp.get("numero_pedido"):
            ped_ent = await db.pedidos_erp.find_one(
                {"numero_pedido": acomp["numero_pedido"]}, {"_id": 0}
            )
            if ped_ent:
                pedido = ped_ent
        acoes = acomp.get("acoes", [])
        ultima_acao = acoes[-1]["data"] if acoes else None
        transportadora = pedido.get("transportadora") or acomp.get("transportadora", "")
        status_pedido = pedido.get("status_pedido", "AGUARDANDO RETIRADA")
        status_final = acomp.get("status_final")

        # Auto-finalizar se o tabelão indica entrega/devolução e ainda não foi finalizado
        # Verifica se alguma chave do AUTO_FINALIZE está contida no status (case-insensitive)
        status_upper = status_pedido.upper()
        matched_key = next((k for k in AUTO_FINALIZE if k in status_upper), None)
        if not status_final and matched_key:
            status_final = AUTO_FINALIZE[matched_key]
            await db.retirada_acompanhamento.update_one(
                {"nota_fiscal": nota},
                {
                    "$set": {
                        "status_final": status_final,
                        "finalizado_por": "Sistema (Tabelão)",
                        "finalizado_em": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "$setOnInsert": {
                        "nota_fiscal": nota,
                        "criado_em": datetime.now(timezone.utc).isoformat(),
                        "acoes": [],
                    },
                },
                upsert=True
            )

        # ENTRADA = quando o pedido CAIU em AGUARDANDO RETIRADA no BSeller (data_status).
        # NÃO usar acomp.criado_em (data do clique/automação no ELO) — isso fazia
        # pedidos antigos finalizados hoje aparecerem como "entrada hoje" no dashboard,
        # inflando a coluna AR (entrada do dia).
        data_status = pedido.get("data_status") or ""
        criado_em_iso = ""
        if data_status:
            s = str(data_status).strip().split(".")[0]
            for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
                try:
                    criado_em_iso = datetime.strptime(s, fmt).strftime("%Y-%m-%d")
                    break
                except Exception:
                    continue
        if not criado_em_iso:
            criado_em_iso = acomp.get("criado_em", "")

        result.append({
            "nota_fiscal": nota,
            "numero_pedido": pedido.get("numero_pedido") or acomp.get("numero_pedido", ""),
            "canal_vendas": pedido.get("canal_vendas") or acomp.get("canal_vendas", ""),
            "transportadora": transportadora,
            "nome_cliente": pedido.get("nome_cliente") or acomp.get("nome_cliente", ""),
            "fone_cliente": pedido.get("fone_cliente") or acomp.get("fone_cliente", ""),
            "email_cliente": pedido.get("email_cliente") or acomp.get("email_cliente", ""),
            "produto": pedido.get("produto") or acomp.get("produto", ""),
            "status_pedido": status_pedido,
            "rastreio": acomp.get("rastreio", ""),
            "endereco_retirada": acomp.get("endereco_retirada", ""),
            "prazo_retirada": acomp.get("prazo_retirada", ""),
            "acoes": acoes,
            "num_acionamentos": len(acoes),
            "ultima_acao": ultima_acao,
            "status_final": status_final,
            "alerta_transportadora": not _is_total(transportadora),
            # Datas para o saldo rolante do dashboard (entrada x resolução)
            "criado_em": criado_em_iso,
            "finalizado_em": acomp.get("finalizado_em", ""),
        })

    # Ordenação: nunca acionado > mais antigo > finalizados
    def sort_key(x):
        is_done = x["status_final"] is not None
        if x["ultima_acao"]:
            try:
                d = datetime.strptime(x["ultima_acao"], "%d/%m/%Y %H:%M")
                days_ago = (datetime.now() - d).days
            except Exception:
                days_ago = 0
        else:
            days_ago = 9999
        return (is_done, -days_ago)

    result.sort(key=sort_key)
    return result


@router.post("/api/retirada/inserir-manual")
async def inserir_retirada_manual(payload: dict, current_user: dict = Depends(get_current_user)):
    """Insere manualmente um pedido na lista de Disponível para Retirada.
    Aceita o número da ENTREGA ou da NOTA FISCAL. Busca o pedido no tabelão para
    enriquecer os dados; cria um registro de acompanhamento (aparece na lista)."""
    ident = str(payload.get("identificador") or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Informe a entrega ou a nota fiscal")
    ident_num = ident.split(".")[0]

    pedido = await db.pedidos_erp.find_one(
        {"$or": [
            {"numero_pedido": ident_num}, {"numero_pedido": ident},
            {"nota_fiscal": ident}, {"nota_fiscal": ident_num},
        ]},
        {"_id": 0},
    )
    if not pedido:
        raise HTTPException(status_code=404, detail=f"Pedido/nota '{ident}' não encontrado no tabelão")

    nota = str(pedido.get("nota_fiscal") or "").split(".")[0]
    if not nota:
        raise HTTPException(status_code=400, detail="Pedido sem nota fiscal — não é possível inserir na retirada")

    if await db.retirada_acompanhamento.find_one({"nota_fiscal": nota}):
        return {"ok": True, "ja_existia": True, "nota_fiscal": nota,
                "numero_pedido": pedido.get("numero_pedido", "")}

    now = datetime.now(timezone.utc).isoformat()
    user_name = current_user.get("name") or current_user.get("email", "")
    doc = {
        "nota_fiscal": nota,
        "numero_pedido": pedido.get("numero_pedido", ""),
        "canal_vendas": pedido.get("canal_vendas", ""),
        "transportadora": pedido.get("transportadora", ""),
        "nome_cliente": pedido.get("nome_cliente", ""),
        "fone_cliente": pedido.get("fone_cliente", ""),
        "email_cliente": pedido.get("email_cliente", ""),
        "produto": pedido.get("produto", ""),
        "rastreio": str(payload.get("rastreio") or "").strip(),
        "endereco_retirada": str(payload.get("endereco_retirada") or "").strip(),
        "prazo_retirada": str(payload.get("prazo_retirada") or "").strip(),
        "acoes": [],
        "inserido_manual": True,
        "inserido_por": user_name,
        "criado_em": now,
        "updated_at": now,
    }
    await db.retirada_acompanhamento.insert_one(doc)
    return {"ok": True, "nota_fiscal": nota, "numero_pedido": doc["numero_pedido"]}


@router.put("/api/retirada/{nota_fiscal}/rastreio")
async def atualizar_rastreio(nota_fiscal: str, payload: dict, current_user: dict = Depends(get_current_user)):
    rastreio = payload.get("rastreio", "").strip()
    endereco = payload.get("endereco_retirada", "").strip()
    prazo = payload.get("prazo_retirada", "").strip()
    await db.retirada_acompanhamento.update_one(
        {"nota_fiscal": nota_fiscal},
        {
            "$set": {
                "rastreio": rastreio,
                "endereco_retirada": endereco,
                "prazo_retirada": prazo,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$setOnInsert": {
                "nota_fiscal": nota_fiscal,
                "criado_em": datetime.now(timezone.utc).isoformat(),
                "acoes": [],
            },
        },
        upsert=True
    )
    return {"ok": True}


@router.post("/api/retirada/{nota_fiscal}/acionar")
async def acionar_cliente(nota_fiscal: str, payload: dict, current_user: dict = Depends(get_current_user)):
    tipo = payload.get("tipo", "ZAP")
    rastreio = payload.get("rastreio", "").strip()
    endereco = payload.get("endereco_retirada", "").strip()
    prazo = payload.get("prazo_retirada", "").strip()

    acao = {
        "data": datetime.now(BRT).strftime("%d/%m/%Y %H:%M"),
        "tipo": tipo,
        "registrado_por": current_user.get("name") or current_user.get("email", "?"),
        "registrado_em": datetime.now(timezone.utc).isoformat(),
    }

    set_data = {
        "ultima_acao": acao["data"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if rastreio:
        set_data["rastreio"] = rastreio
    if endereco:
        set_data["endereco_retirada"] = endereco
    if prazo:
        set_data["prazo_retirada"] = prazo

    # Salvar dados do pedido no acompanhamento (para caso o pedido saia do tabelão)
    pedido = await db.pedidos_erp.find_one({"nota_fiscal": nota_fiscal}, {"_id": 0})
    if pedido:
        set_data.update({
            "numero_pedido": pedido.get("numero_pedido"),
            "canal_vendas": pedido.get("canal_vendas"),
            "transportadora": pedido.get("transportadora"),
            "nome_cliente": pedido.get("nome_cliente"),
            "fone_cliente": pedido.get("fone_cliente"),
            "email_cliente": pedido.get("email_cliente"),
            "produto": pedido.get("produto"),
        })

    await db.retirada_acompanhamento.update_one(
        {"nota_fiscal": nota_fiscal},
        {
            "$push": {"acoes": acao},
            "$set": set_data,
            "$setOnInsert": {
                "nota_fiscal": nota_fiscal,
                "criado_em": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True
    )
    return {"ok": True, "acao": acao}


@router.put("/api/retirada/{nota_fiscal}/finalizar")
async def finalizar_retirada(nota_fiscal: str, payload: dict, current_user: dict = Depends(get_current_user)):
    status_final = payload.get("status_final")  # "Entregue" | "Em Devolução"
    await db.retirada_acompanhamento.update_one(
        {"nota_fiscal": nota_fiscal},
        {
            "$set": {
                "status_final": status_final,
                "finalizado_por": current_user.get("name") or current_user.get("email", "?"),
                "finalizado_em": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$setOnInsert": {
                "nota_fiscal": nota_fiscal,
                "criado_em": datetime.now(timezone.utc).isoformat(),
                "acoes": [],
            },
        },
        upsert=True
    )
    return {"ok": True}
