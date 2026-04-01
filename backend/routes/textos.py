from fastapi import APIRouter, HTTPException, Depends
from typing import List

from utils.database import db
from utils.auth import get_current_user
from data.textos_padroes import TEXTOS_PADROES, CATEGORIAS_EMERGENT, MOTIVOS_PENDENCIA_TEXTOS, get_motivo_for_categoria
from datetime import datetime, timezone

router = APIRouter(prefix="/api")


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
