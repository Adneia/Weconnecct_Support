from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    periodo_dias: int = 30,
    categoria: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    base_query = {}
    if categoria:
        base_query["categoria"] = categoria
    total_geral = await db.chamados.count_documents(base_query)
    total_pendentes = await db.chamados.count_documents({**base_query, "pendente": True})
    total_resolvidos = await db.chamados.count_documents({**base_query, "pendente": False})
    atendimento_mais_antigo = await db.chamados.find_one({"pendente": True}, {"_id": 0, "data_abertura": 1, "id_atendimento": 1})
    dias_mais_antigo = 0
    id_mais_antigo = None
    if atendimento_mais_antigo:
        data_abertura = parse_date_safe(atendimento_mais_antigo.get('data_abertura'))
        dias_mais_antigo = (now - data_abertura).days
        id_mais_antigo = atendimento_mais_antigo.get('id_atendimento')
    pipeline_categoria = [{"$match": {"pendente": True}}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_categoria = await db.chamados.aggregate(pipeline_categoria).to_list(100)
    pipeline_atendente = [{"$match": {"pendente": True}}, {"$group": {"_id": "$atendente", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_atendente = await db.chamados.aggregate(pipeline_atendente).to_list(100)
    pipeline_parceiro = [{"$match": {"pendente": True}}, {"$group": {"_id": "$parceiro", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_parceiro = await db.chamados.aggregate(pipeline_parceiro).to_list(100)
    tres_dias_atras = (now - timedelta(days=3)).isoformat()
    chamados_atencao = await db.chamados.find({"pendente": True, "data_abertura": {"$lt": tres_dias_atras}}, {"_id": 0}).sort("data_abertura", 1).to_list(10)
    for c in chamados_atencao:
        data_abertura = parse_date_safe(c.get('data_abertura'))
        c['dias_aberto'] = (now - data_abertura).days
    dias_grafico = min(periodo_dias, 30)
    ultimos_dias = []
    for i in range(dias_grafico - 1, -1, -1):
        dia = now - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        abertos_dia = await db.chamados.count_documents({"data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}})
        resolvidos_dia = await db.chamados.count_documents({"data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}})
        ultimos_dias.append({"data": dia.strftime("%d/%m"), "abertos": abertos_dia, "resolvidos": resolvidos_dia})
    atendimentos_por_mes = []
    for i in range(5, -1, -1):
        mes = now - timedelta(days=i*30)
        mes_inicio = mes.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if mes.month == 12:
            mes_fim = mes.replace(year=mes.year + 1, month=1, day=1) - timedelta(seconds=1)
        else:
            mes_fim = mes.replace(month=mes.month + 1, day=1) - timedelta(seconds=1)
        count = await db.chamados.count_documents({"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}})
        atendimentos_por_mes.append({"mes": mes.strftime("%b/%y"), "total": count})
    pipeline_tempo = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}}},
        {"$project": {"tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    tempo_result = await db.chamados.aggregate(pipeline_tempo).to_list(1)
    media_tempo_ms = tempo_result[0]['media'] if tempo_result else 0
    media_tempo_dias = round(media_tempo_ms / (1000 * 60 * 60 * 24), 2) if media_tempo_ms else 0
    total_pedidos = await db.pedidos_erp.count_documents({})
    return {
        "total_geral": total_geral, "total_pendentes": total_pendentes, "total_resolvidos": total_resolvidos,
        "total_pedidos_base": total_pedidos, "dias_mais_antigo": dias_mais_antigo, "id_mais_antigo": id_mais_antigo,
        "por_categoria": [{"categoria": item['_id'], "count": item['count']} for item in por_categoria if item['_id']],
        "por_atendente": {item['_id']: item['count'] for item in por_atendente if item['_id']},
        "por_parceiro": {item['_id']: item['count'] for item in por_parceiro if item['_id']},
        "chamados_atencao": chamados_atencao, "ultimos_dias": ultimos_dias,
        "atendimentos_por_mes": atendimentos_por_mes, "media_tempo_resolucao_dias": media_tempo_dias,
        "periodo_dias": periodo_dias
    }


# ============== DASHBOARD V2 ==============

@router.get("/dashboard/v2/visao-geral")
async def get_dashboard_visao_geral(
    periodo_dias: int = 30,
    canal: Optional[str] = None,
    fornecedor: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    base_query = {}
    if canal:
        base_query["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    if fornecedor:
        base_query["codigo_fornecedor"] = fornecedor
    total = await db.chamados.count_documents(base_query)
    pendentes = await db.chamados.count_documents({**base_query, "pendente": True})
    resolvidos = await db.chamados.count_documents({**base_query, "pendente": False})
    mais_antigo = await db.chamados.find_one({"pendente": True}, {"_id": 0, "data_abertura": 1, "id_atendimento": 1}, sort=[("data_abertura", 1)])
    dias_mais_antigo = 0
    data_mais_antigo = None
    id_mais_antigo = None
    if mais_antigo:
        data_abertura = parse_date_safe(mais_antigo.get('data_abertura'))
        dias_mais_antigo = (now - data_abertura).days
        data_mais_antigo = mais_antigo['data_abertura']
        id_mais_antigo = mais_antigo.get('id_atendimento')
    pipeline_tempo = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}}},
        {"$project": {"tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    tempo_result = await db.chamados.aggregate(pipeline_tempo).to_list(1)
    tempo_medio = round((tempo_result[0]['media'] / (1000 * 60 * 60 * 24)), 2) if tempo_result and tempo_result[0]['media'] else 0
    por_mes = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_ref.replace(year=mes_ref.year + 1, month=1, day=1) if mes_ref.month == 12 else mes_ref.replace(month=mes_ref.month + 1, day=1)) - timedelta(seconds=1)
        count = await db.chamados.count_documents({"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}})
        por_mes.append({"mes": mes_ref.strftime("%b/%y"), "total": count})
    dias_grafico = min(periodo_dias, 30)
    por_dia = []
    for i in range(dias_grafico - 1, -1, -1):
        dia = now - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        abertos = await db.chamados.count_documents({"data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}})
        resolvidos_dia = await db.chamados.count_documents({"data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}})
        por_dia.append({"data": dia.strftime("%d/%m"), "abertos": abertos, "resolvidos": resolvidos_dia})
    total_pedidos = await db.pedidos_erp.count_documents({})

    # Dias uteis e canais diarios
    dias_uteis = []
    hoje = now.date()
    dia_inicio_ref = datetime(2026, 3, 2, tzinfo=timezone.utc)
    dia_iter = dia_inicio_ref
    while dia_iter.date() <= hoje:
        if dia_iter.weekday() < 5:
            dias_uteis.append(dia_iter)
        dia_iter += timedelta(days=1)

    CANAIS_CONFIG = [
        {"nome": "Reclame aqui", "variacoes": ["Reclame aqui", "Reclame Aqui", "RECLAME AQUI"], "buscar_solicitacao": True},
        {"nome": "ZAP/E-mail", "variacoes": ["ZAP", "E-mail", "Email", "Zap", "zap"], "buscar_solicitacao": True},
        {"nome": "Mercado Livre", "variacoes": ["Mercado Livre"]},
        {"nome": "LL Loyalty", "variacoes": ["LL Loyalty", "LL Loyalt"]},
        {"nome": "Sicredi", "variacoes": ["Sicredi", "SICREDI"]},
        {"nome": "CSU", "variacoes": ["CSU"]},
        {"nome": "Nicequest", "variacoes": ["Nicequest", "NiceQuest", "NICEQUEST"]},
        {"nome": "GRS", "variacoes": ["Global Rewards", "GRS"]},
        {"nome": "LTM", "variacoes": ["LTM"]},
        {"nome": "Camicado", "variacoes": ["Camicado"]},
        {"nome": "Coopera", "variacoes": ["Coopera"]},
        {"nome": "Livelo", "variacoes": ["Livelo"]},
        {"nome": "Tudo Azul", "variacoes": ["Tudo Azul"]},
        {"nome": "SENFF", "variacoes": ["Senff", "SENFF"]},
        {"nome": "ShopHub", "variacoes": ["ShopHub", "SHOPHUB"]},
        {"nome": "Bradesco", "variacoes": ["Bradesco"]},
    ]
    por_canal_dia = []
    totais_por_dia = {}
    for dia in dias_uteis:
        totais_por_dia[dia.strftime("%d/%m")] = {"ar": 0, "a": 0, "f": 0}
    for canal_config in CANAIS_CONFIG:
        canal_nome = canal_config["nome"]
        variacoes = canal_config["variacoes"]
        canal_data = {"canal": canal_nome, "dias": {}}
        total_canal = {"ar": 0, "a": 0, "f": 0}
        for dia in dias_uteis:
            dia_key = dia.strftime("%d/%m")
            dia_str = dia.strftime("%Y-%m-%d")
            dia_regex = f"^{dia_str}"
            canal_or_conditions = []
            buscar_solicitacao = canal_config.get("buscar_solicitacao", False)
            for var in variacoes:
                if buscar_solicitacao:
                    canal_or_conditions.append({"solicitacao": {"$regex": var, "$options": "i"}})
                else:
                    canal_or_conditions.append({"parceiro": var})
                    canal_or_conditions.append({"canal_vendas": var})
            ar = await db.chamados.count_documents({"$or": canal_or_conditions, "data_abertura": {"$regex": dia_regex}})
            if dia.date() == hoje:
                a = await db.chamados.count_documents({"$or": canal_or_conditions, "pendente": True})
            else:
                dia_fim_str = f"{dia_str}T23:59:59"
                a = await db.chamados.count_documents({"$or": canal_or_conditions, "pendente": True, "data_abertura": {"$lte": dia_fim_str}})
            f = await db.chamados.count_documents({"$or": canal_or_conditions, "pendente": False, "data_fechamento": {"$regex": dia_regex}})
            canal_data["dias"][dia_key] = {"ar": ar, "a": a, "f": f}
            total_canal["ar"] += ar
            total_canal["f"] += f
            if dia_key not in totais_por_dia:
                totais_por_dia[dia_key] = {"ar": 0, "a": 0, "f": 0}
            totais_por_dia[dia_key]["ar"] += ar
            totais_por_dia[dia_key]["a"] += a
            totais_por_dia[dia_key]["f"] += f
        if dias_uteis:
            ultimo_dia_key = dias_uteis[-1].strftime("%d/%m")
            total_canal["a"] = canal_data["dias"].get(ultimo_dia_key, {}).get("a", 0)
        canal_data["total"] = total_canal
        por_canal_dia.append(canal_data)
    dias_headers = []
    dias_semana_pt = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    for dia in dias_uteis:
        dias_headers.append({"data": dia.strftime("%d/%m"), "dia_semana": dias_semana_pt[dia.weekday()], "dia_num": dia.strftime("%d")})
    pipeline_por_canal = [
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "total": {"$sum": 1},
                    "pendentes": {"$sum": {"$cond": [{"$eq": ["$pendente", True]}, 1, 0]}},
                    "fechados": {"$sum": {"$cond": [{"$eq": ["$pendente", False]}, 1, 0]}}}},
        {"$match": {"_id": {"$ne": None}}}, {"$sort": {"total": -1}}
    ]
    por_canal_raw = await db.chamados.aggregate(pipeline_por_canal).to_list(50)
    por_canal = [{"canal": item['_id'] or 'Sem Canal', "ar": item['total'], "a": item['pendentes'], "f": item['fechados']} for item in por_canal_raw]
    return {
        "total": total, "pendentes": pendentes, "resolvidos": resolvidos,
        "tempo_medio": tempo_medio, "dias_mais_antigo": dias_mais_antigo,
        "data_mais_antigo": data_mais_antigo, "id_mais_antigo": id_mais_antigo,
        "total_pedidos": total_pedidos, "por_mes": por_mes, "por_dia": por_dia,
        "por_canal": por_canal, "por_canal_dia": por_canal_dia,
        "dias_headers": dias_headers, "totais_por_dia": totais_por_dia
    }


@router.get("/dashboard/v2/volume-canal")
async def get_dashboard_volume_canal(periodo_dias: int = 30, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {}
    pipeline_canal = [{"$match": base_match}, {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    total = sum(c['count'] for c in por_canal)
    ranking = [{"canal": c['_id'] or 'Não informado', "total": c['count'], "percentual": round((c['count']/total)*100, 1) if total > 0 else 0} for c in por_canal if c['_id']]
    por_mes_canal = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_inicio.replace(month=mes_inicio.month % 12 + 1, day=1) if mes_inicio.month < 12 else mes_inicio.replace(year=mes_inicio.year + 1, month=1, day=1)) - timedelta(seconds=1)
        pipeline = [{"$match": {"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}}}, {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}]
        result = await db.chamados.aggregate(pipeline).to_list(50)
        mes_data = {"mes": mes_ref.strftime("%b/%y")}
        for r in result:
            if r['_id']:
                mes_data[r['_id']] = r['count']
        por_mes_canal.append(mes_data)
    return {"ranking": ranking, "por_mes_canal": por_mes_canal, "total": total}


@router.get("/dashboard/v2/classificacao")
async def get_dashboard_classificacao(periodo_dias: int = 30, canal: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    if canal:
        base_match["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    pipeline_cat = [{"$match": base_match}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_categoria = await db.chamados.aggregate(pipeline_cat).to_list(50)
    pipeline_pend_cat = [{"$match": {**base_match, "pendente": True}}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    pend_categoria = await db.chamados.aggregate(pipeline_pend_cat).to_list(50)
    pipeline_motivo = [{"$match": {**base_match, "pendente": True}}, {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    pend_motivo = await db.chamados.aggregate(pipeline_motivo).to_list(50)
    pipeline_prod = [{"$match": base_match}, {"$group": {"_id": "$produto", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 10}]
    top_produtos = await db.chamados.aggregate(pipeline_prod).to_list(10)
    pipeline_forn = [{"$match": base_match}, {"$group": {"_id": "$codigo_fornecedor", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_fornecedor = await db.chamados.aggregate(pipeline_forn).to_list(50)
    return {
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in por_categoria],
        "pend_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in pend_categoria],
        "pend_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count']} for c in pend_motivo],
        "top_produtos": [{"produto": c['_id'] or 'N/A', "total": c['count']} for c in top_produtos],
        "por_fornecedor": [{"fornecedor": c['_id'] or 'N/A', "total": c['count']} for c in por_fornecedor]
    }


@router.get("/dashboard/v2/performance")
async def get_dashboard_performance(periodo_dias: int = 30, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {"pendente": False, "data_fechamento": {"$ne": None}}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    pipeline_canal = [
        {"$match": base_match},
        {"$project": {"canal": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": "$canal", "media": {"$avg": "$tempo"}, "count": {"$sum": 1}}}, {"$sort": {"media": -1}}
    ]
    tempo_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    pipeline_forn = [
        {"$match": base_match},
        {"$project": {"fornecedor": "$codigo_fornecedor", "tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": "$fornecedor", "media": {"$avg": "$tempo"}, "count": {"$sum": 1}}}, {"$sort": {"media": -1}}
    ]
    tempo_fornecedor = await db.chamados.aggregate(pipeline_forn).to_list(50)
    ms_to_days = 1000 * 60 * 60 * 24
    return {
        "tempo_por_canal": [{"canal": t['_id'] or 'N/A', "dias": round(t['media']/ms_to_days, 2), "atendimentos": t['count']} for t in tempo_canal if t['_id']],
        "tempo_por_fornecedor": [{"fornecedor": t['_id'] or 'N/A', "dias": round(t['media']/ms_to_days, 2), "atendimentos": t['count']} for t in tempo_fornecedor if t['_id']]
    }


@router.get("/dashboard/v2/pendencias")
async def get_dashboard_pendencias(periodo_dias: int = 30, canal: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    base_match = {"pendente": True}
    if canal:
        base_match["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    total = await db.chamados.count_documents(base_match)
    pipeline_cat = [{"$match": base_match}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_categoria = await db.chamados.aggregate(pipeline_cat).to_list(50)
    pipeline_motivo = [{"$match": base_match}, {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_motivo = await db.chamados.aggregate(pipeline_motivo).to_list(50)
    pipeline_canal = [{"$match": base_match}, {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    pendentes = await db.chamados.find(base_match, {"_id": 0}).sort("data_abertura", 1).to_list(100)
    for p in pendentes:
        data_abertura = parse_date_safe(p.get('data_abertura'))
        p['dias_aberto'] = (now - data_abertura).days
    return {
        "total": total,
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in por_categoria],
        "por_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count']} for c in por_motivo],
        "por_canal": [{"canal": c['_id'] or 'N/A', "total": c['count']} for c in por_canal if c['_id']],
        "detalhes": pendentes[:50]
    }


@router.get("/dashboard/v2/estornos")
async def get_dashboard_estornos(periodo_dias: int = 30, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {"categoria": {"$in": ["Arrependimento", "Estorno", "Cancelamento"]}}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    total_estornos = await db.chamados.count_documents(base_match)
    total_geral = await db.chamados.count_documents({"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {})
    percentual_geral = round((total_estornos/total_geral)*100, 2) if total_geral > 0 else 0
    por_mes = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_inicio.replace(month=mes_inicio.month % 12 + 1, day=1) if mes_inicio.month < 12 else mes_inicio.replace(year=mes_inicio.year + 1, month=1, day=1)) - timedelta(seconds=1)
        estornos_mes = await db.chamados.count_documents({**base_match, "data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}})
        total_mes = await db.chamados.count_documents({"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}})
        por_mes.append({"mes": mes_ref.strftime("%b/%y"), "estornos": estornos_mes, "total": total_mes, "percentual": round((estornos_mes/total_mes)*100, 2) if total_mes > 0 else 0})
    pipeline_canal = [{"$match": base_match}, {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    canal_data = []
    for c in por_canal:
        if c['_id']:
            total_canal = await db.chamados.count_documents(
                {"$or": [{"parceiro": c['_id']}, {"canal_vendas": c['_id']}], "data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else
                {"$or": [{"parceiro": c['_id']}, {"canal_vendas": c['_id']}]}
            )
            canal_data.append({"canal": c['_id'], "estornos": c['count'], "percentual": round((c['count']/total_canal)*100, 2) if total_canal > 0 else 0})
    return {"total": total_estornos, "percentual_geral": percentual_geral, "por_mes": por_mes, "por_canal": sorted(canal_data, key=lambda x: x['percentual'], reverse=True)}


@router.get("/dashboard/v2/reincidencia")
async def get_dashboard_reincidencia(periodo_dias: int = 30, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {}
    pipeline_reincidencia = [{"$match": base_match}, {"$group": {"_id": "$cpf_cliente", "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}]
    reincidentes = await db.chamados.aggregate(pipeline_reincidencia).to_list(1000)
    total_atendimentos = await db.chamados.count_documents(base_match)
    total_reincidentes = sum(r['count'] for r in reincidentes) - len(reincidentes)
    taxa_geral = round((total_reincidentes/total_atendimentos)*100, 2) if total_atendimentos > 0 else 0
    pipeline_canal = [{"$match": base_match}, {"$group": {"_id": {"canal": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "cpf": "$cpf_cliente"}, "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}, {"$group": {"_id": "$_id.canal", "reincidentes": {"$sum": 1}}}]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    pipeline_produto = [{"$match": base_match}, {"$group": {"_id": {"produto": "$produto", "cpf": "$cpf_cliente"}, "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}, {"$group": {"_id": "$_id.produto", "reincidentes": {"$sum": 1}}}, {"$sort": {"reincidentes": -1}}, {"$limit": 10}]
    por_produto = await db.chamados.aggregate(pipeline_produto).to_list(10)
    return {
        "taxa_geral": taxa_geral, "total_reincidentes": len(reincidentes),
        "por_canal": [{"canal": c['_id'] or 'N/A', "reincidentes": c['reincidentes']} for c in por_canal if c['_id']],
        "por_produto": [{"produto": p['_id'] or 'N/A', "reincidentes": p['reincidentes']} for p in por_produto if p['_id']]
    }


@router.get("/dashboard/v2/filtros")
async def get_dashboard_filtros(current_user: dict = Depends(get_current_user)):
    pipeline_canais = [{"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}}}, {"$sort": {"_id": 1}}]
    canais = await db.chamados.aggregate(pipeline_canais).to_list(100)
    canais_normalizados = {}
    for c in canais:
        if c['_id']:
            key = c['_id'].lower()
            if key not in canais_normalizados:
                canais_normalizados[key] = 'NiceQuest' if key == 'nicequest' else c['_id']
    pipeline_forn = [{"$group": {"_id": "$codigo_fornecedor"}}, {"$sort": {"_id": 1}}]
    fornecedores = await db.chamados.aggregate(pipeline_forn).to_list(100)
    return {
        "canais": sorted(canais_normalizados.values()),
        "fornecedores": [f['_id'] for f in fornecedores if f['_id']]
    }
