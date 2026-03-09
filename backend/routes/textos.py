"""
Rotas de Textos Padrão - CRUD e gerenciamento
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import logging

from utils.database import db
from utils.auth import get_current_user
from models.chamado import CATEGORIAS_EMERGENT

logger = logging.getLogger(__name__)

router = APIRouter(tags=["textos"])

# Textos padrões por categoria - mantido inline para facilitar manutenção
TEXTOS_PADROES = {
    "Falha Produção": """Selecione o tipo de resposta no campo abaixo.""",
    
    "Falha Produção - Sem Rastreio": """Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Produção - Total Express": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]

https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha de Compras": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Transporte": """Olá, Boa tarde.

Identificamos um problema na entrega do seu pedido. Pedimos desculpas pelo inconveniente.

Estamos em contato com a transportadora para resolver a situação.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Produto com Avaria": """Selecione o tipo de avaria no campo abaixo.""",

    "Acompanhamento": """Selecione o tipo de acompanhamento no campo abaixo.""",

    "Reclame Aqui": """Selecione a resposta padrão no campo abaixo.""",

    "Assistência Técnica": """Selecione o fornecedor no campo abaixo.""",

    "Estorno": """Olá,

Pedido cancelado, por favor seguir com o estorno ao cliente e encerramento do chamado.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha de Integração": """Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e [PARCEIRO].

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
}


@router.get("/textos-padroes/{categoria}")
async def get_texto_padrao(categoria: str, current_user: dict = Depends(get_current_user)):
    """Retorna texto padrão para a categoria (fixo ou customizado)"""
    # Primeiro busca nos textos fixos
    texto = TEXTOS_PADROES.get(categoria)
    if texto:
        return {"categoria": categoria, "texto": texto}
    
    # Se não encontrou, busca nos customizados
    custom = await db.textos_padroes.find_one({"categoria": categoria}, {"_id": 0})
    if custom:
        return {"categoria": categoria, "texto": custom['texto']}
    
    raise HTTPException(status_code=404, detail="Categoria não encontrada")


@router.get("/textos-padroes")
async def list_textos_padroes(current_user: dict = Depends(get_current_user)):
    """Lista todas as categorias e textos padrões"""
    situacoes = [k for k in TEXTOS_PADROES.keys() if k not in CATEGORIAS_EMERGENT]
    
    return {
        "categorias": CATEGORIAS_EMERGENT,
        "textos": TEXTOS_PADROES,
        "situacoes": situacoes
    }


@router.get("/textos-situacionais")
async def list_textos_situacionais(current_user: dict = Depends(get_current_user)):
    """Lista textos para situações específicas (reversa, estorno, etc)"""
    situacoes = {k: v for k, v in TEXTOS_PADROES.items() if k not in CATEGORIAS_EMERGENT}
    return {"situacoes": list(situacoes.keys()), "textos": situacoes}


@router.get("/textos-situacionais/{situacao}")
async def get_texto_situacional(situacao: str, current_user: dict = Depends(get_current_user)):
    """Retorna texto para uma situação específica"""
    texto = TEXTOS_PADROES.get(situacao)
    if not texto:
        raise HTTPException(status_code=404, detail=f"Texto para situação '{situacao}' não encontrado")
    return {"situacao": situacao, "texto": texto}


@router.get("/textos-padroes-lista")
async def list_all_textos(current_user: dict = Depends(get_current_user)):
    """Lista todos os textos padrões (fixos + customizados) para a página de gerenciamento"""
    textos_fixos = [{"categoria": k, "texto": v, "tipo": "sistema"} for k, v in TEXTOS_PADROES.items()]
    
    textos_custom = await db.textos_padroes.find({}, {"_id": 0}).sort("categoria", 1).to_list(200)
    for t in textos_custom:
        t["tipo"] = "customizado"
    
    return textos_fixos + textos_custom


@router.post("/textos-padroes")
async def create_texto_padrao(data: dict, current_user: dict = Depends(get_current_user)):
    """Cria novo texto padrão customizado"""
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
        "categoria": categoria,
        "texto": texto,
        "criado_por": current_user['name'],
        "criado_em": datetime.now(timezone.utc).isoformat()
    })
    
    # Registrar log de alteração
    await db.textos_padroes_log.insert_one({
        "acao": "criado",
        "categoria": categoria,
        "usuario": current_user['name'],
        "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(),
        "visualizado": False
    })
    
    return {"message": "Texto padrão criado com sucesso"}


@router.put("/textos-padroes/{categoria}")
async def update_texto_padrao(categoria: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Atualiza texto padrão customizado"""
    texto = data.get('texto', '').strip()
    
    if not texto:
        raise HTTPException(status_code=400, detail="Texto é obrigatório")
    
    if categoria in TEXTOS_PADROES:
        raise HTTPException(status_code=400, detail="Textos do sistema não podem ser alterados")
    
    result = await db.textos_padroes.update_one(
        {"categoria": categoria},
        {"$set": {
            "texto": texto,
            "atualizado_por": current_user['name'],
            "atualizado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    
    await db.textos_padroes_log.insert_one({
        "acao": "atualizado",
        "categoria": categoria,
        "usuario": current_user['name'],
        "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(),
        "visualizado": False
    })
    
    return {"message": "Texto padrão atualizado com sucesso"}


@router.delete("/textos-padroes/{categoria}")
async def delete_texto_padrao(categoria: str, current_user: dict = Depends(get_current_user)):
    """Exclui texto padrão customizado"""
    if categoria in TEXTOS_PADROES:
        raise HTTPException(status_code=400, detail="Textos do sistema não podem ser excluídos")
    
    result = await db.textos_padroes.delete_one({"categoria": categoria})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    
    await db.textos_padroes_log.insert_one({
        "acao": "excluido",
        "categoria": categoria,
        "usuario": current_user['name'],
        "email_usuario": current_user['email'],
        "data": datetime.now(timezone.utc).isoformat(),
        "visualizado": False
    })
    
    return {"message": "Texto padrão excluído com sucesso"}


@router.get("/textos-padroes-log")
async def get_textos_padroes_log(current_user: dict = Depends(get_current_user)):
    """Retorna o log de alterações dos textos padrão (apenas para admin)"""
    if current_user['email'] != 'adneia@weconnect360.com.br':
        return []
    
    logs = await db.textos_padroes_log.find({}, {"_id": 0}).sort("data", -1).to_list(100)
    return logs


@router.get("/textos-padroes-log/nao-visualizados")
async def get_textos_padroes_log_count(current_user: dict = Depends(get_current_user)):
    """Retorna a contagem de alterações não visualizadas (apenas para admin)"""
    if current_user['email'] != 'adneia@weconnect360.com.br':
        return {"count": 0}
    
    count = await db.textos_padroes_log.count_documents({"visualizado": False})
    return {"count": count}


@router.post("/textos-padroes-log/marcar-visualizados")
async def marcar_logs_visualizados(current_user: dict = Depends(get_current_user)):
    """Marca todos os logs como visualizados (apenas para admin)"""
    if current_user['email'] != 'adneia@weconnect360.com.br':
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    await db.textos_padroes_log.update_many(
        {"visualizado": False},
        {"$set": {"visualizado": True}}
    )
    
    return {"message": "Logs marcados como visualizados"}
