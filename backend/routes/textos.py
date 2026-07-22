from fastapi import APIRouter, HTTPException, Depends
from typing import List

from bson import ObjectId
from bson.errors import InvalidId

from utils.database import db
from utils.auth import get_current_user
from data.textos_padroes import TEXTOS_PADROES, CATEGORIAS_EMERGENT, MOTIVOS_PENDENCIA_TEXTOS, get_motivo_for_categoria
from datetime import datetime, timezone

router = APIRouter(prefix="/api")


async def _log_texto(acao: str, categoria: str, current_user: dict, fonte: str = "textos_atendimento"):
    """Registra alteração no mesmo histórico da tela de Textos Padrões."""
    try:
        await db.textos_padroes_log.insert_one({
            "acao": acao, "categoria": categoria,
            "usuario": current_user.get("name", ""), "email_usuario": current_user.get("email", ""),
            "data": datetime.now(timezone.utc).isoformat(), "visualizado": False,
            "fonte": fonte,
        })
    except Exception:
        pass


# ===== Textos do Atendimento (coleção textos_por_motivo — o que o atendente clica) =====

@router.get("/textos-motivo-editor")
async def list_textos_motivo_editor(current_user: dict = Depends(get_current_user)):
    docs = await db.textos_por_motivo.find({}).sort("motivo", 1).to_list(2000)
    docs.sort(key=lambda d: (d.get("motivo") or "", d.get("causa") or "", d.get("titulo") or ""))
    return [{
        "id": str(d["_id"]),
        "motivo": d.get("motivo", ""),
        "causa": d.get("causa", ""),
        "titulo": d.get("titulo", ""),
        "texto": d.get("texto", ""),
        "parceiro": d.get("parceiro", ""),
    } for d in docs]


@router.post("/textos-motivo-editor")
async def create_texto_motivo(data: dict, current_user: dict = Depends(get_current_user)):
    motivo = (data.get("motivo") or "").strip()
    causa = (data.get("causa") or "").strip()
    titulo = (data.get("titulo") or "").strip()
    texto = (data.get("texto") or "").strip()
    parceiro = (data.get("parceiro") or "").strip()
    if not (motivo and titulo and texto):
        raise HTTPException(status_code=400, detail="Motivo, título e texto são obrigatórios")
    doc = {"motivo": motivo, "causa": causa, "titulo": titulo, "texto": texto}
    if parceiro:
        doc["parceiro"] = parceiro
    res = await db.textos_por_motivo.insert_one(doc)
    await _log_texto("criado", f"{motivo} / {causa} / {titulo}", current_user)
    return {"id": str(res.inserted_id), "message": "Texto criado com sucesso"}


@router.put("/textos-motivo-editor/{texto_id}")
async def update_texto_motivo(texto_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(texto_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="ID inválido")
    campos = {}
    for k in ("motivo", "causa", "titulo", "texto", "parceiro"):
        if k in data and isinstance(data[k], str):
            campos[k] = data[k].strip()
    if "texto" in campos and not campos["texto"]:
        raise HTTPException(status_code=400, detail="O texto não pode ficar vazio")
    if not campos:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    res = await db.textos_por_motivo.update_one({"_id": oid}, {"$set": campos})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Texto não encontrado")
    d = await db.textos_por_motivo.find_one({"_id": oid}, {"_id": 0, "motivo": 1, "causa": 1, "titulo": 1})
    await _log_texto("atualizado", f"{d.get('motivo')} / {d.get('causa')} / {d.get('titulo')}", current_user)
    return {"message": "Texto atualizado com sucesso"}


@router.delete("/textos-motivo-editor/{texto_id}")
async def delete_texto_motivo(texto_id: str, current_user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(texto_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="ID inválido")
    d = await db.textos_por_motivo.find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Texto não encontrado")
    await db.textos_por_motivo.delete_one({"_id": oid})
    await _log_texto("excluido", f"{d.get('motivo')} / {d.get('causa')} / {d.get('titulo')}", current_user)
    return {"message": "Texto excluído com sucesso"}


@router.get("/textos-padroes/{categoria}")
async def get_texto_padrao(categoria: str, current_user: dict = Depends(get_current_user)):
    texto = TEXTOS_PADROES.get(categoria)
    if texto:
        return {"categoria": categoria, "texto": texto}
    custom = await db.textos_padroes.find_one({"categoria": categoria}, {"_id": 0})
    if custom:
        return {"categoria": categoria, "texto": custom['texto']}
    raise HTTPException(status_code=404, detail="Categoria não encontrada")


@router.get("/textos-padroes")
async def list_textos_padroes(current_user: dict = Depends(get_current_user)):
    situacoes = [k for k in TEXTOS_PADROES.keys() if k not in CATEGORIAS_EMERGENT]
    return {"categorias": CATEGORIAS_EMERGENT, "textos": TEXTOS_PADROES, "situacoes": situacoes}


@router.get("/textos-situacionais")
async def list_textos_situacionais(current_user: dict = Depends(get_current_user)):
    situacoes = {k: v for k, v in TEXTOS_PADROES.items() if k not in CATEGORIAS_EMERGENT}
    return {"situacoes": list(situacoes.keys()), "textos": situacoes}


@router.get("/textos-situacionais/{situacao}")
async def get_texto_situacional(situacao: str, current_user: dict = Depends(get_current_user)):
    texto = TEXTOS_PADROES.get(situacao)
    if not texto:
        raise HTTPException(status_code=404, detail=f"Texto para situação '{situacao}' não encontrado")
    return {"situacao": situacao, "texto": texto}


@router.get("/textos-padroes-lista")
async def list_all_textos(current_user: dict = Depends(get_current_user)):
    textos_fixos = [
        {"categoria": k, "texto": v, "tipo": "sistema", "motivo_pendencia": get_motivo_for_categoria(k)}
        for k, v in TEXTOS_PADROES.items()
    ]
    textos_custom = await db.textos_padroes.find({}, {"_id": 0}).sort("categoria", 1).to_list(200)
    for t in textos_custom:
        t["tipo"] = "customizado"
        if "motivo_pendencia" not in t:
            t["motivo_pendencia"] = ""
    return textos_fixos + textos_custom


@router.get("/textos-por-motivo/{motivo}")
async def get_textos_por_motivo(motivo: str, current_user: dict = Depends(get_current_user)):
    textos = [
        {"categoria": k, "texto": v, "motivo_pendencia": motivo}
        for k, v in TEXTOS_PADROES.items()
        if get_motivo_for_categoria(k) == motivo
    ]
    textos_custom = await db.textos_padroes.find({"motivo_pendencia": motivo}, {"_id": 0}).to_list(100)
    for t in textos_custom:
        t["tipo"] = "customizado"
    return textos + textos_custom


@router.get("/motivos-pendencia-textos")
async def list_motivos_pendencia(current_user: dict = Depends(get_current_user)):
    return {"motivos": MOTIVOS_PENDENCIA_TEXTOS}


@router.post("/textos-padroes")
async def create_texto_padrao(data: dict, current_user: dict = Depends(get_current_user)):
    categoria = data.get('categoria', '').strip()
    texto = data.get('texto', '').strip()
    if not categoria or not texto:
        raise HTTPException(status_code=400, detail="Categoria e texto são obrigatórios")
    if categoria in TEXTOS_PADROES:
        raise HTTPException(status_code=400, detail="Esta categoria é um texto padrão do sistema e não pode ser sobrescrita")
    existing = await db.textos_padroes.find_one({"categoria": categoria})
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um texto padrão com esta categoria")
    await db.textos_padroes.insert_one({
        "categoria": categoria, "texto": texto,
        "criado_por": current_user['name'],
        "criado_em": datetime.now(timezone.utc).isoformat()
    })
    await db.textos_padroes_log.insert_one({
        "acao": "criado", "categoria": categoria,
        "usuario": current_user['name'], "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(), "visualizado": False
    })
    return {"message": "Texto padrão criado com sucesso"}


@router.put("/textos-padroes/{categoria}")
async def update_texto_padrao(categoria: str, data: dict, current_user: dict = Depends(get_current_user)):
    texto = data.get('texto', '').strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Texto é obrigatório")
    if categoria in TEXTOS_PADROES:
        raise HTTPException(status_code=400, detail="Textos do sistema não podem ser alterados")
    result = await db.textos_padroes.update_one(
        {"categoria": categoria},
        {"$set": {"texto": texto, "atualizado_por": current_user['name'],
                  "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    await db.textos_padroes_log.insert_one({
        "acao": "atualizado", "categoria": categoria,
        "usuario": current_user['name'], "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(), "visualizado": False
    })
    return {"message": "Texto padrão atualizado com sucesso"}


@router.delete("/textos-padroes/{categoria}")
async def delete_texto_padrao(categoria: str, current_user: dict = Depends(get_current_user)):
    if categoria in TEXTOS_PADROES:
        raise HTTPException(status_code=400, detail="Textos do sistema não podem ser excluídos")
    result = await db.textos_padroes.delete_one({"categoria": categoria})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    await db.textos_padroes_log.insert_one({
        "acao": "excluido", "categoria": categoria,
        "usuario": current_user['name'], "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(), "visualizado": False
    })
    return {"message": "Texto padrão excluído com sucesso"}


@router.get("/textos-padroes-log")
async def get_textos_padroes_log(current_user: dict = Depends(get_current_user)):
    if current_user['email'] != 'adneia@weconnect360.com.br':
        return []
    return await db.textos_padroes_log.find({}, {"_id": 0}).sort("data", -1).to_list(100)


@router.get("/motivo-textos/{motivo}")
async def get_textos_por_motivo_excel(motivo: str, current_user: dict = Depends(get_current_user)):
    """Retorna textos agrupados por causa para um motivo de pendencia (fonte: Excel importado)"""
    from urllib.parse import unquote
    motivo_decoded = unquote(motivo)
    cursor = db.textos_por_motivo.find({'motivo': motivo_decoded}, {'_id': 0})
    textos = await cursor.to_list(200)
    grupos = {}
    for t in textos:
        causa = t.get('causa', '')
        if causa not in grupos:
            grupos[causa] = []
        # 'parceiro' preenchido = variante específica daquele parceiro (ex.: Livelo);
        # o frontend usa a variante quando o parceiro do chamado bate, senão a padrão.
        grupos[causa].append({'titulo': t.get('titulo', ''), 'texto': t.get('texto', ''),
                              'parceiro': t.get('parceiro', '')})
    return {'motivo': motivo_decoded, 'grupos': [{'causa': c, 'textos': ts} for c, ts in grupos.items()]}


@router.get("/textos-padroes-log/nao-visualizados")
async def get_textos_padroes_log_count(current_user: dict = Depends(get_current_user)):
    if current_user['email'] != 'adneia@weconnect360.com.br':
        return {"count": 0}
    count = await db.textos_padroes_log.count_documents({"visualizado": False})
    return {"count": count}


@router.post("/textos-padroes-log/marcar-visualizados")
async def marcar_logs_visualizados(current_user: dict = Depends(get_current_user)):
    if current_user['email'] != 'adneia@weconnect360.com.br':
        raise HTTPException(status_code=403, detail="Acesso negado")
    await db.textos_padroes_log.update_many({"visualizado": False}, {"$set": {"visualizado": True}})
    return {"message": "Logs marcados como visualizados"}
