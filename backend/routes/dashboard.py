from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import asyncio

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe, BRT_TZ, now_brt, today_brt, date_brt_str

import logging
logger = logging.getLogger(__name__)

_visao_geral_cache: dict = {}
_CACHE_TTL = 120  # segundos

# Alias local para compatibilidade com chamadas existentes neste arquivo.
_data_brt_str = date_brt_str

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
    # ── Cache ──
    cache_key = f"{periodo_dias}:{canal}:{fornecedor}"
    now_ts = datetime.now(timezone.utc).timestamp()
    if cache_key in _visao_geral_cache:
        cached_ts, cached_data = _visao_geral_cache[cache_key]
        if now_ts - cached_ts < _CACHE_TTL:
            return cached_data

    now = datetime.now(timezone.utc)
    base_query: dict = {}
    if canal:
        base_query["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    if fornecedor:
        pedidos_forn = await db.pedidos_erp.distinct("numero_pedido", {"departamento": fornecedor})
        base_query["numero_pedido"] = {"$in": pedidos_forn}

    pipeline_tempo = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}}},
        {"$project": {"tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    pipeline_sla = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}, "data_abertura": {"$ne": None}}},
        {"$project": {"tempo_ms": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
        {"$group": {"_id": None, "total": {"$sum": 1},
            "em_1d": {"$sum": {"$cond": [{"$lte": ["$tempo_ms", 86400000]}, 1, 0]}},
            "em_3d": {"$sum": {"$cond": [{"$lte": ["$tempo_ms", 259200000]}, 1, 0]}},
            "em_7d": {"$sum": {"$cond": [{"$lte": ["$tempo_ms", 604800000]}, 1, 0]}}}}
    ]
    pipeline_por_canal = [
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "total": {"$sum": 1},
                    "pendentes": {"$sum": {"$cond": [{"$eq": ["$pendente", True]}, 1, 0]}},
                    "fechados": {"$sum": {"$cond": [{"$eq": ["$pendente", False]}, 1, 0]}}}},
        {"$match": {"_id": {"$ne": None}}}, {"$sort": {"total": -1}}
    ]

    # ── 1. Queries de topo em paralelo ──
    (total, pendentes, resolvidos, mais_antigo,
     tempo_result, sla_raw, por_canal_raw, total_pedidos) = await asyncio.gather(
        db.chamados.count_documents(base_query),
        db.chamados.count_documents({**base_query, "pendente": True}),
        db.chamados.count_documents({**base_query, "pendente": False}),
        db.chamados.find_one({"pendente": True}, {"_id": 0, "data_abertura": 1, "id_atendimento": 1}, sort=[("data_abertura", 1)]),
        db.chamados.aggregate(pipeline_tempo).to_list(1),
        db.chamados.aggregate(pipeline_sla).to_list(1),
        db.chamados.aggregate(pipeline_por_canal).to_list(50),
        db.pedidos_erp.count_documents({}),
    )

    dias_mais_antigo = 0
    data_mais_antigo = None
    id_mais_antigo = None
    if mais_antigo:
        data_abertura = parse_date_safe(mais_antigo.get('data_abertura'))
        dias_mais_antigo = (now - data_abertura).days
        data_mais_antigo = mais_antigo['data_abertura']
        id_mais_antigo = mais_antigo.get('id_atendimento')

    tempo_medio = round((tempo_result[0]['media'] / 86400000), 2) if tempo_result and tempo_result[0]['media'] else 0

    sla_data = {"em_1d": 0, "em_3d": 0, "em_7d": 0}
    if sla_raw and sla_raw[0]["total"] > 0:
        sla_t = sla_raw[0]["total"]
        sla_data = {k: round(sla_raw[0][k] / sla_t * 100, 1) for k in ("em_1d", "em_3d", "em_7d")}

    por_canal = [{"canal": item['_id'] or 'Sem Canal', "ar": item['total'], "a": item['pendentes'], "f": item['fechados']} for item in por_canal_raw]
    taxa_contato = round((total / total_pedidos) * 100, 1) if total_pedidos > 0 else 0
    taxa_pendencia = round((pendentes / total_pedidos) * 100, 1) if total_pedidos > 0 else 0
    taxa_resolucao = round((resolvidos / total) * 100, 1) if total > 0 else 0

    # ── 2. Por dia (gráfico) em paralelo ──
    dias_grafico = min(periodo_dias, 30)
    # Dashboards agrupam por DATA DE BRASÍLIA (UTC-3). Sem essa conversão, atendimentos
    # criados entre 21:00 e 23:59 BRT vão pro dia seguinte na grade.
    hoje = now.astimezone(BRT_TZ).date()

    async def get_dia_chart(i):
        dia = now - timedelta(days=i)
        d0 = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        d1 = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        ab, res = await asyncio.gather(
            db.chamados.count_documents({"data_abertura": {"$gte": d0, "$lte": d1}}),
            db.chamados.count_documents({"data_fechamento": {"$gte": d0, "$lte": d1}})
        )
        return {"data": dia.strftime("%d/%m"), "abertos": ab, "resolvidos": res}

    por_dia = list(await asyncio.gather(*[get_dia_chart(i) for i in range(dias_grafico - 1, -1, -1)]))

    # ── 3. Por mês em paralelo ──
    async def get_mes_chart(i):
        mes_ref = now - timedelta(days=i * 30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_ref.replace(year=mes_ref.year + 1, month=1, day=1) if mes_ref.month == 12
                   else mes_ref.replace(month=mes_ref.month + 1, day=1)) - timedelta(seconds=1)
        count = await db.chamados.count_documents({"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}})
        return {"mes": mes_ref.strftime("%b/%y"), "total": count,
                "taxa_contato": round(count / total_pedidos * 100, 2) if total_pedidos > 0 else 0}

    por_mes = list(await asyncio.gather(*[get_mes_chart(i) for i in range(5, -1, -1)]))

    # ── 4. Dias úteis desde 02/03/2026 (em datas BRT) ──
    dias_uteis = []
    dia_iter = datetime(2026, 3, 2, tzinfo=BRT_TZ)
    while dia_iter.date() <= hoje:
        if dia_iter.weekday() < 5:
            dias_uteis.append(dia_iter)
        dia_iter += timedelta(days=1)

    CANAIS_CONFIG = [
        {"nome": "Reclame aqui", "variacoes": ["reclame aqui"], "buscar_solicitacao": True, "usar_data_ra": True},
        {"nome": "ZAP/E-mail", "variacoes": ["zap", "e-mail", "email"], "buscar_solicitacao": True},
        {"nome": "Mercado Livre", "variacoes": ["Mercado Livre"]},
        {"nome": "LL Loyalty", "variacoes": ["LL Loyalty", "LL Loyalt", "LL Loyalts", "LL loyals", "LL Loyals"]},
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

    # ── 5. 1 query só — processa tudo em Python ──
    chamados_all = await db.chamados.find(
        {},
        {"parceiro": 1, "canal_vendas": 1, "solicitacao": 1,
         "data_abertura": 1, "data_fechamento": 1, "pendente": 1,
         "data_reclame_aqui": 1, "_id": 0}
    ).to_list(None)

    # Pré-calcula prefixos de data uma vez só — convertendo de UTC para BRT
    # para que a grade reflita corretamente o dia em horário de Brasília.
    for c in chamados_all:
        ab = c.get("data_abertura") or ""
        c["_ab10"] = _data_brt_str(ab)
        c["_fc10"] = _data_brt_str(c.get("data_fechamento") or "")
        # Para Reclame Aqui: usa data_reclame_aqui se disponível, senão data_abertura
        ra = c.get("data_reclame_aqui") or ab
        c["_ra10"] = _data_brt_str(ra)

    def match_canal(c, cfg):
        if cfg.get("buscar_solicitacao"):
            sol = (c.get("solicitacao") or "").lower()
            return any(v in sol for v in cfg["variacoes"])
        # Normaliza (minúsculas + sem espaços nas pontas) para pegar variantes sujas:
        # 'CSU ', 'Livelo ', 'LL loyalts', 'LL Loyalts ' etc.
        val = (c.get("parceiro") or c.get("canal_vendas") or "").strip().lower()
        return any(v.strip().lower() == val for v in cfg["variacoes"]) if val else False

    # Atribuição EXCLUSIVA de canal: cada atendimento conta em UMA única linha.
    # Usa a primeira correspondência na ordem de CANAIS_CONFIG (Reclame aqui/ZAP têm
    # prioridade sobre o parceiro). Evita dupla contagem na soma das colunas.
    for c in chamados_all:
        c["_canal"] = None
        for cfg in CANAIS_CONFIG:
            if match_canal(c, cfg):
                c["_canal"] = cfg["nome"]
                break

    dias_str_list = [d.strftime("%Y-%m-%d") for d in dias_uteis]
    dias_key_list = [d.strftime("%d/%m") for d in dias_uteis]
    hoje_str = hoje.strftime("%Y-%m-%d")

    por_canal_dia = []
    totais_por_dia = {k: {"ar": 0, "a": 0, "f": 0} for k in dias_key_list}

    for cfg in CANAIS_CONFIG:
        grp = [c for c in chamados_all if c["_canal"] == cfg["nome"]]
        dias_dict: dict = {}
        total_canal = {"ar": 0, "a": 0, "f": 0}
        usar_data_ra = cfg.get("usar_data_ra", False)

        # Saldo rolante por dia:
        #   AR = abertos NAQUELE dia
        #   A  = saldo de abertura do dia (itens abertos em dias ANTERIORES e ainda não fechados)
        #   F  = fechados NAQUELE dia
        # Resultado do dia = A + AR - F  →  é exatamente o A do dia seguinte.
        # Tudo calculado pela data (abertura/fechamento), não pelo status atual — assim a
        # conta fecha como um saldo histórico real.
        for dia_str, dia_key in zip(dias_str_list, dias_key_list):
            ab_field = "_ra10" if usar_data_ra else "_ab10"
            # Abertos no dia
            ar = sum(1 for c in grp if c[ab_field] == dia_str)
            # Fechados no dia (pela data de fechamento)
            f  = sum(1 for c in grp if c["_fc10"] == dia_str)
            # Saldo de abertura: abertos ANTES do dia e que NÃO foram fechados antes do dia
            a = sum(1 for c in grp
                    if c[ab_field] and c[ab_field] < dia_str
                    and (c["_fc10"] == "" or c["_fc10"] >= dia_str))

            dias_dict[dia_key] = {"ar": ar, "a": a, "f": f}
            total_canal["ar"] += ar
            total_canal["f"]  += f
            if dia_key in totais_por_dia:
                totais_por_dia[dia_key]["ar"] += ar
                totais_por_dia[dia_key]["a"]  += a
                totais_por_dia[dia_key]["f"]  += f

        if dias_uteis:
            # Coluna-resumo "A": backlog atual = resultado (saldo de fechamento) do último dia
            ult = dias_dict.get(dias_key_list[-1], {"a": 0, "ar": 0, "f": 0})
            total_canal["a"] = ult["a"] + ult["ar"] - ult["f"]

        por_canal_dia.append({"canal": cfg["nome"], "dias": dias_dict, "total": total_canal})

    dias_semana_pt = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    dias_headers = [{"data": d.strftime("%d/%m"), "dia_semana": dias_semana_pt[d.weekday()], "dia_num": d.strftime("%d")} for d in dias_uteis]

    result = {
        "total": total, "pendentes": pendentes, "resolvidos": resolvidos,
        "tempo_medio": tempo_medio, "dias_mais_antigo": dias_mais_antigo,
        "data_mais_antigo": data_mais_antigo, "id_mais_antigo": id_mais_antigo,
        "total_pedidos": total_pedidos, "taxa_contato": taxa_contato,
        "taxa_pendencia": taxa_pendencia, "taxa_resolucao": taxa_resolucao, "sla_data": sla_data,
        "por_mes": por_mes, "por_dia": por_dia,
        "por_canal": por_canal, "por_canal_dia": por_canal_dia,
        "dias_headers": dias_headers, "totais_por_dia": totais_por_dia
    }
    _visao_geral_cache[cache_key] = (now_ts, result)
    return result


@router.get("/dashboard/v2/volume-canal")
async def get_dashboard_volume_canal(periodo_dias: int = 30, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_match = {"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {}
    pipeline_canal = [{"$match": base_match}, {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    total = sum(c['count'] for c in por_canal)
    # Enriquecer ranking com % vendas (atendimentos / pedidos do canal)
    ranking = []
    for c in por_canal:
        if not c['_id']:
            continue
        canal_name = c['_id']
        n_pedidos_canal = await db.pedidos_erp.count_documents({"canal_vendas": canal_name})
        pct_vendas = round((c['count'] / n_pedidos_canal) * 100, 2) if n_pedidos_canal > 0 else 0
        ranking.append({
            "canal": canal_name,
            "total": c['count'],
            "percentual": round((c['count'] / total) * 100, 1) if total > 0 else 0,
            "n_pedidos": n_pedidos_canal,
            "pct_vendas": pct_vendas
        })
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
    # Filtro de canal normalizado (pega variantes de caixa/espaço/grafia)
    ped_match = {}
    if canal:
        base_match["$expr"] = _canal_match_chamados(canal)["$expr"]
        ped_match["$expr"] = _canal_match_pedidos(canal)["$expr"]
    pipeline_cat = [{"$match": base_match}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    por_categoria = await db.chamados.aggregate(pipeline_cat).to_list(50)
    pipeline_pend_cat = [{"$match": {**base_match, "pendente": True}}, {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    pend_categoria = await db.chamados.aggregate(pipeline_pend_cat).to_list(50)
    pipeline_motivo = [{"$match": {**base_match, "pendente": True}}, {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    pend_motivo = await db.chamados.aggregate(pipeline_motivo).to_list(50)
    pipeline_prod = [
        {"$match": base_match},
        {"$lookup": {"from": "pedidos_erp", "localField": "numero_pedido", "foreignField": "numero_pedido", "as": "pedido_info"}},
        {"$unwind": {"path": "$pedido_info", "preserveNullAndEmptyArrays": False}},
        {"$match": {"pedido_info.produto": {"$nin": [None, "", "nan", "N/A"]}}},
        {"$group": {
            "_id": "$pedido_info.produto",
            "count": {"$sum": 1},
            "sku_bseller": {"$first": "$pedido_info.codigo_item_bseller"},
            "sku_vtex": {"$first": "$pedido_info.codigo_item_vtex"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_produtos = await db.chamados.aggregate(pipeline_prod).to_list(10)
    # Buscar marca/fornecedor via join com pedidos_erp (campo departamento = Marca)
    pipeline_forn = [
        {"$match": base_match},
        {"$lookup": {"from": "pedidos_erp", "localField": "numero_pedido", "foreignField": "numero_pedido", "as": "pedido"}},
        {"$unwind": {"path": "$pedido", "preserveNullAndEmptyArrays": False}},
        {"$match": {"pedido.departamento": {"$nin": [None, "", "nan", "N/A"]}}},
        {"$group": {"_id": "$pedido.departamento", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    por_fornecedor = await db.chamados.aggregate(pipeline_forn).to_list(15)
    # Total de vendas por marca no tabelão (respeita o filtro de canal)
    pipeline_vendas_marca = [
        {"$match": {**ped_match, "departamento": {"$nin": [None, "", "nan", "N/A"]}}},
        {"$group": {"_id": "$departamento", "total_vendas": {"$sum": 1}}},
    ]
    vendas_por_marca_raw = await db.pedidos_erp.aggregate(pipeline_vendas_marca).to_list(500)
    vendas_por_marca = {v['_id']: v['total_vendas'] for v in vendas_por_marca_raw}
    # Denominador: total de pedidos do canal selecionado (ou geral)
    total_pedidos = await db.pedidos_erp.count_documents(ped_match)
    # Calcular total de pendentes para proporcional de pend_categoria
    total_pendentes = sum(c['count'] for c in pend_categoria)
    # Criar mapa categoria -> total para calcular taxa de pendencia por categoria
    cat_total_map = {c['_id']: c['count'] for c in por_categoria if c['_id']}
    return {
        "total_pedidos": total_pedidos,
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count'], "pct_pedidos": round((c['count'] / total_pedidos) * 100, 1) if total_pedidos > 0 else 0} for c in por_categoria],
        "pend_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count'], "pct_pendentes": round((c['count'] / total_pendentes) * 100, 1) if total_pendentes > 0 else 0, "pct_categoria": round((c['count'] / cat_total_map.get(c['_id'], c['count'])) * 100, 1)} for c in pend_categoria],
        "pend_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count'], "pct_pedidos": round((c['count'] / total_pedidos) * 100, 2) if total_pedidos > 0 else 0} for c in pend_motivo],
        "top_produtos": [{"produto": c['_id'], "total": c['count'], "sku_bseller": c.get('sku_bseller'), "sku_vtex": c.get('sku_vtex')} for c in top_produtos if c['_id']],
        "por_fornecedor": [
            {
                "fornecedor": c['_id'],
                "total": c['count'],
                "pct_atendimentos": round((c['count'] / sum(x['count'] for x in por_fornecedor)) * 100, 1) if por_fornecedor else 0,
                "total_vendas": vendas_por_marca.get(c['_id'], 0),
                "pct_vendas": round((vendas_por_marca.get(c['_id'], 0) / total_pedidos) * 100, 1) if total_pedidos > 0 else 0,
            }
            for c in por_fornecedor if c['_id']
        ]
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
        {"$lookup": {"from": "pedidos_erp", "localField": "numero_pedido", "foreignField": "numero_pedido", "as": "pedido"}},
        {"$unwind": {"path": "$pedido", "preserveNullAndEmptyArrays": False}},
        {"$match": {"pedido.departamento": {"$nin": [None, "", "nan", "N/A"]}}},
        {"$project": {"fornecedor": "$pedido.departamento", "tempo": {"$subtract": [{"$dateFromString": {"dateString": "$data_fechamento"}}, {"$dateFromString": {"dateString": "$data_abertura"}}]}}},
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
    total_pedidos = await db.pedidos_erp.count_documents({})
    taxa_pendencia = round((total / total_pedidos) * 100, 1) if total_pedidos > 0 else 0
    return {
        "total": total,
        "total_pedidos": total_pedidos,
        "taxa_pendencia": taxa_pendencia,
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in por_categoria],
        "por_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count'], "pct_pedidos": round((c['count'] / total_pedidos) * 100, 2) if total_pedidos > 0 else 0} for c in por_motivo],
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
    total_pedidos = await db.pedidos_erp.count_documents({})
    taxa_estornos_pedidos = round((total_estornos / total_pedidos) * 100, 2) if total_pedidos > 0 else 0

    # Calcular valor total dos estornos (preco_final + frete dos pedidos correspondentes)
    def parse_brl(v):
        if not v: return 0.0
        try:
            s = str(v).strip()
            # Formato BR: 1.234,56 → tem vírgula como decimal
            if ',' in s:
                return float(s.replace('.', '').replace(',', '.'))
            # Formato decimal padrão: 141.90 → float direto
            return float(s)
        except:
            return 0.0

    # Valor: apenas chamados que foram de fato Estornados (status_cliente = "Estornado")
    estorno_confirmado_match = {**base_match, "status_cliente": "Estornado"}
    estorno_nums = [c['numero_pedido'] async for c in db.chamados.find(estorno_confirmado_match, {"numero_pedido": 1}) if c.get('numero_pedido')]
    pedidos_valores = await db.pedidos_erp.find({"numero_pedido": {"$in": estorno_nums}}, {"preco_final": 1, "frete": 1}).to_list(5000)
    valor_total = sum(parse_brl(p.get('preco_final')) + parse_brl(p.get('frete')) for p in pedidos_valores)

    # Valor por mês
    valor_por_mes = []
    for item in por_mes:
        mes_match = {**base_match}
        # reusar mesma lógica de mês já calculada em por_mes seria ideal, mas simplificamos com o mesmo loop
        valor_por_mes.append({"mes": item["mes"], "valor": 0.0})  # placeholder; substituído abaixo

    valor_por_mes = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_inicio.replace(month=mes_inicio.month % 12 + 1, day=1) if mes_inicio.month < 12 else mes_inicio.replace(year=mes_inicio.year + 1, month=1, day=1)) - timedelta(seconds=1)
        mes_estorno_match = {**base_match, "status_cliente": "Estornado", "data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}}
        mes_nums = [c['numero_pedido'] async for c in db.chamados.find(mes_estorno_match, {"numero_pedido": 1}) if c.get('numero_pedido')]
        mes_pedidos = await db.pedidos_erp.find({"numero_pedido": {"$in": mes_nums}}, {"preco_final": 1, "frete": 1}).to_list(1000)
        mes_valor = sum(parse_brl(p.get('preco_final')) + parse_brl(p.get('frete')) for p in mes_pedidos)
        valor_por_mes.append({"mes": mes_ref.strftime("%b/%y"), "valor": round(mes_valor, 2)})

    return {
        "total": total_estornos, "percentual_geral": percentual_geral,
        "total_pedidos": total_pedidos, "taxa_estornos_pedidos": taxa_estornos_pedidos,
        "valor_total": round(valor_total, 2),
        "por_mes": por_mes, "valor_por_mes": valor_por_mes,
        "por_canal": sorted(canal_data, key=lambda x: x['percentual'], reverse=True)
    }


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


_CANAL_NOME_MAP = {
    'll loyalty': 'LL Loyalty',
    'll loyalt': 'LL Loyalty',
    'll loyalts': 'LL Loyalty',
    'll loyals': 'LL Loyalty',
    'nicequest': 'NiceQuest',
    'sicredi': 'Sicredi',
    'senff': 'SENFF',
}


def _canal_variantes(canal: str) -> list:
    """Todas as formas (minúsculas/sem espaços) que mapeiam para o canal canônico.
    Pega variantes sujas dos dados: 'CSU ', 'LL loyalty', 'LL Loyalts ', etc."""
    base = (canal or "").lower().strip()
    variantes = {base}
    for k, v in _CANAL_NOME_MAP.items():
        if v == canal:
            variantes.add(k)
    return [v for v in variantes if v]


def _canal_match_chamados(canal: str) -> dict:
    """Trecho de $match p/ chamados normalizando parceiro/canal_vendas (case/espaço/variações)."""
    return {"$expr": {"$in": [
        {"$toLower": {"$trim": {"input": {"$ifNull": ["$parceiro", {"$ifNull": ["$canal_vendas", ""]}]}}}},
        _canal_variantes(canal),
    ]}}


def _canal_match_pedidos(canal: str) -> dict:
    """Trecho de $match p/ pedidos_erp (campo canal_vendas)."""
    return {"$expr": {"$in": [
        {"$toLower": {"$trim": {"input": {"$ifNull": ["$canal_vendas", ""]}}}},
        _canal_variantes(canal),
    ]}}


@router.get("/dashboard/v2/filtros")
async def get_dashboard_filtros(current_user: dict = Depends(get_current_user)):
    pipeline_canais = [{"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}}}, {"$sort": {"_id": 1}}]
    canais = await db.chamados.aggregate(pipeline_canais).to_list(100)
    canais_normalizados = {}
    for c in canais:
        if c['_id']:
            key = c['_id'].lower().strip()
            # Dedup pelo NOME FINAL canônico (mapa ou valor sem espaços nas pontas):
            # agrupa 'CSU'/'CSU ', 'Livelo'/'Livelo ' e variações de 'LL Loyalty'.
            nome_canonical = _CANAL_NOME_MAP.get(key) or c['_id'].strip()
            canais_normalizados[nome_canonical] = nome_canonical
    pipeline_forn = [
        {"$match": {"departamento": {"$nin": [None, "", "nan", "N/A"]}}},
        {"$group": {"_id": "$departamento"}},
        {"$sort": {"_id": 1}}
    ]
    fornecedores = await db.pedidos_erp.aggregate(pipeline_forn).to_list(200)
    return {
        "canais": sorted(canais_normalizados.values()),
        "fornecedores": sorted([f['_id'] for f in fornecedores if f['_id']])
    }


# ── Canal Checks (OK por canal/dia) ──

@router.get("/dashboard/canal-checks")
async def get_canal_checks(current_user: dict = Depends(get_current_user)):
    hoje = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    checks = await db.canal_checks.find({"data": hoje}, {"_id": 0}).to_list(200)
    return {"data": hoje, "checks": {c["canal"]: {"marcado_por": c["marcado_por"], "marcado_em": c["marcado_em"]} for c in checks}}

@router.post("/dashboard/canal-checks")
async def toggle_canal_check(payload: dict, current_user: dict = Depends(get_current_user)):
    canal = (payload.get("canal") or "").strip()
    if not canal:
        return {"error": "canal obrigatório"}
    hoje = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    existing = await db.canal_checks.find_one({"canal": canal, "data": hoje})
    if existing:
        await db.canal_checks.delete_one({"canal": canal, "data": hoje})
        return {"canal": canal, "data": hoje, "checked": False}
    await db.canal_checks.insert_one({
        "canal": canal, "data": hoje,
        "marcado_por": current_user.get("name", current_user.get("email", "?")),
        "marcado_em": datetime.now(timezone.utc).isoformat()
    })
    return {"canal": canal, "data": hoje, "checked": True,
            "marcado_por": current_user.get("name", current_user.get("email", "?"))}


# ── Verificação de status (limpeza por MOTIVO de pendência) ──
# Substitui a limpeza por canal. Cronograma fixo no front:
#   Ag. Parceiro -> qua/sex | demais -> ter/sex.
# Ag. Parceiro detalhado por parceiro (sub-linhas). Cada linha guarda
# ultima verificacao, proxima verificacao e obs. O check (✓) marca "feito hoje":
# carimba ultima=hoje e avanca proxima (reversivel).

def _verif_hoje():
    # Data de Brasília (UTC-3). Sem isso o check carimba o dia em UTC, que à noite
    # já virou o dia seguinte (ex.: 25/06 em BRT aparecia como 26/06).
    return (datetime.now(timezone.utc) - timedelta(hours=3)).strftime("%Y-%m-%d")


def _dias_verif(motivo):
    """Dias da semana em que o motivo deve ser verificado (isoweekday: 1=seg..7=dom).
    Mesma escala do Dashboard: Entregue e J&T = diário (seg-sex); Ag. Parceiro =
    quarta; demais = terça e quinta."""
    m = (motivo or "").strip().lower()
    if m == "entregue" or "j&t" in m:
        return {1, 2, 3, 4, 5}
    if m == "ag. parceiro":
        return {3}
    return {2, 4}


def _proxima_verif(motivo, base_str, hoje_str):
    """Próxima data de verificação (sempre > base/hoje) conforme a escala do motivo."""
    dias = _dias_verif(motivo)
    try:
        hoje = datetime.strptime(hoje_str, "%Y-%m-%d")
    except Exception:
        hoje = datetime.now(timezone.utc) - timedelta(hours=3)
    try:
        base = datetime.strptime(base_str, "%Y-%m-%d") if base_str else None
    except Exception:
        base = None
    ini = base if (base and base >= hoje) else hoje
    d = ini
    for _ in range(14):
        d = d + timedelta(days=1)
        if d.isoweekday() in dias:
            return d.strftime("%Y-%m-%d")
    return ""


@router.get("/dashboard/verificacao-status")
async def get_verificacao_status(current_user: dict = Depends(get_current_user)):
    """Backlog ao vivo por motivo + ultima/proxima/obs. Ag. Parceiro detalhado por parceiro."""
    backlog = {}
    async for d in db.chamados.aggregate([
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$motivo_pendencia", "qtd": {"$sum": 1}}},
    ]):
        motivo = (d.get("_id") or "").strip()
        if motivo:
            backlog[motivo] = d.get("qtd", 0)

    # Detalhe do Ag. Parceiro por parceiro — normaliza grafia (trim + maiúsc/minúsc),
    # exibindo a grafia mais comum de cada variante. Vazio -> "(sem parceiro)".
    _sub_tot = {}     # chave canônica -> qtd total
    _sub_graf = {}    # chave canônica -> {grafia: contagem}
    async for d in db.chamados.aggregate([
        {"$match": {"pendente": True, "motivo_pendencia": "Ag. Parceiro"}},
        {"$group": {"_id": "$parceiro", "qtd": {"$sum": 1}}},
    ]):
        raw = (d.get("_id") or "").strip()
        qtd = d.get("qtd", 0)
        if not raw:
            key, graf = "", "(sem parceiro)"
        else:
            key, graf = raw.lower(), raw
        _sub_tot[key] = _sub_tot.get(key, 0) + qtd
        _sub_graf.setdefault(key, {})
        _sub_graf[key][graf] = _sub_graf[key].get(graf, 0) + qtd
    sub_backlog = {}
    for key, total in _sub_tot.items():
        label = max(_sub_graf[key].items(), key=lambda kv: kv[1])[0]
        sub_backlog[label] = total

    docs = await db.dashboard_verificacao.find({}, {"_id": 0}).to_list(500)
    salvos = {(d.get("motivo", ""), d.get("parceiro", "")): d for d in docs}

    # Auto-marcar como FEITO os motivos JÁ rastreados que ZERARAM num dia devido.
    # A limpeza é feita, o motivo some do backlog (pendente=0) e antes ficava como
    # 'atrasada' porque não dava pra clicar o ✓. Agora: se zerou e estava devido,
    # carimba última = hoje e avança a próxima automaticamente. (Só o motivo
    # principal; sub-parceiros do Ag. Parceiro seguem manuais.)
    hoje_str = _verif_hoje()
    for (motivo, parceiro), s in list(salvos.items()):
        if parceiro:
            continue
        if backlog.get(motivo, 0) != 0:
            continue  # ainda há pendência → exige verificação manual
        if s.get("ultima") == hoje_str:
            continue  # já marcado hoje
        prox = s.get("proxima", "")
        if prox and prox > hoje_str:
            continue  # ainda não é dia de verificar esse motivo
        nova_prox = _proxima_verif(motivo, hoje_str, hoje_str)
        await db.dashboard_verificacao.update_one(
            {"motivo": motivo, "parceiro": ""},
            {"$set": {"ultima": hoje_str, "proxima": nova_prox, "atualizado_por": "auto (zerado)"}},
            upsert=True,
        )
        s["ultima"] = hoje_str
        s["proxima"] = nova_prox

    def _campos(motivo, parceiro=""):
        s = salvos.get((motivo, parceiro), {})
        return {"ultima": s.get("ultima", ""), "proxima": s.get("proxima", ""),
                "obs": s.get("obs", ""), "atualizado_por": s.get("atualizado_por", "")}

    rows = []
    for motivo in sorted(backlog.keys(), key=lambda m: -backlog[m]):
        row = {"motivo": motivo, "qtd": backlog[motivo]}
        row.update(_campos(motivo))
        if motivo == "Ag. Parceiro":
            row["sub"] = [
                dict({"parceiro": p, "qtd": sub_backlog[p]}, **_campos(motivo, p))
                for p in sorted(sub_backlog.keys(), key=lambda p: -sub_backlog[p])
            ]
        rows.append(row)
    return {"rows": rows, "hoje": _verif_hoje()}


@router.post("/dashboard/verificacao-status")
async def set_verificacao_status(payload: dict, current_user: dict = Depends(get_current_user)):
    """Edita ultima/proxima/obs de um motivo (ou parceiro). Só os campos enviados mudam."""
    motivo = (payload.get("motivo") or "").strip()
    if not motivo:
        return {"error": "motivo obrigatório"}
    parceiro = (payload.get("parceiro") or "").strip()
    set_fields = {
        "motivo": motivo, "parceiro": parceiro,
        "atualizado_por": current_user.get("name", current_user.get("email", "?")),
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
    }
    for k in ("ultima", "proxima", "obs"):
        if k in payload:
            set_fields[k] = (payload.get(k) or "").strip()
    await db.dashboard_verificacao.update_one(
        {"motivo": motivo, "parceiro": parceiro},
        {"$set": set_fields},
        upsert=True,
    )
    return {"motivo": motivo, "parceiro": parceiro,
            "ultima": set_fields.get("ultima"), "proxima": set_fields.get("proxima"),
            "obs": set_fields.get("obs")}


@router.post("/dashboard/verificacao-check")
async def toggle_verificacao_check(payload: dict, current_user: dict = Depends(get_current_user)):
    """Marca/desmarca 'verificado hoje'. Ao marcar: ultima=hoje e proxima=<payload>.
    Ao desmarcar (já era hoje): restaura ultima/proxima anteriores."""
    motivo = (payload.get("motivo") or "").strip()
    if not motivo:
        return {"error": "motivo obrigatório"}
    parceiro = (payload.get("parceiro") or "").strip()
    proxima_nova = (payload.get("proxima") or "").strip()
    hoje = _verif_hoje()
    quem = current_user.get("name", current_user.get("email", "?"))
    agora = datetime.now(timezone.utc).isoformat()

    doc = await db.dashboard_verificacao.find_one({"motivo": motivo, "parceiro": parceiro}) or {}

    if doc.get("ultima") == hoje:
        # UNDO — restaura os valores anteriores ao check de hoje
        nova_ultima = doc.get("ultima_ant", "")
        nova_proxima = doc.get("proxima_ant", "")
        await db.dashboard_verificacao.update_one(
            {"motivo": motivo, "parceiro": parceiro},
            {"$set": {"motivo": motivo, "parceiro": parceiro,
                      "ultima": nova_ultima, "proxima": nova_proxima,
                      "atualizado_por": quem, "atualizado_em": agora},
             "$unset": {"ultima_ant": "", "proxima_ant": ""}},
            upsert=True,
        )
        return {"checked": False, "ultima": nova_ultima, "proxima": nova_proxima}

    # MARCAR — guarda anteriores p/ permitir desfazer
    await db.dashboard_verificacao.update_one(
        {"motivo": motivo, "parceiro": parceiro},
        {"$set": {"motivo": motivo, "parceiro": parceiro,
                  "ultima_ant": doc.get("ultima", ""), "proxima_ant": doc.get("proxima", ""),
                  "ultima": hoje, "proxima": proxima_nova,
                  "atualizado_por": quem, "atualizado_em": agora}},
        upsert=True,
    )
    return {"checked": True, "ultima": hoje, "proxima": proxima_nova}
