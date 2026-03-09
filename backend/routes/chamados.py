"""
Rotas de Chamados/Atendimentos - CRUD completo
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging

from models.chamado import ChamadoCreate, ChamadoUpdate, Chamado, CATEGORIAS_EMERGENT
from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chamados", tags=["chamados"])


async def generate_atendimento_id():
    """Gera ID sequencial no formato ATD-2026-XXX"""
    year = datetime.now(timezone.utc).year
    last = await db.chamados.find_one(
        {"id_atendimento": {"$regex": f"^ATD-{year}-"}},
        sort=[("id_atendimento", -1)]
    )
    if last and last.get('id_atendimento'):
        try:
            last_num = int(last['id_atendimento'].split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"ATD-{year}-{str(next_num).zfill(3)}"


def generate_reversa_code(numero_pedido: str):
    """Gera código de reversa no formato REV-XXXXXXXX-XXX"""
    import random
    suffix = str(random.randint(100, 999))
    return f"REV-{numero_pedido[-8:]}-{suffix}"


@router.post("", response_model=dict)
async def create_chamado(
    chamado_data: ChamadoCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Criar novo chamado/atendimento"""
    if not chamado_data.numero_pedido.strip():
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    
    id_atendimento = await generate_atendimento_id()
    
    chamado = Chamado(**chamado_data.model_dump())
    chamado.id_atendimento = id_atendimento
    chamado.criado_por_id = current_user['id']
    chamado.criado_por_nome = current_user['name']
    
    if not chamado.categoria_inicial:
        chamado.categoria_inicial = chamado.categoria
    
    # Buscar dados do pedido na Base_Emergent
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado_data.numero_pedido}, {"_id": 0})
    if pedido:
        chamado.nome_cliente = pedido.get('nome_cliente')
        chamado.cpf_cliente = pedido.get('cpf_cliente')
        chamado.produto = pedido.get('produto')
        chamado.transportadora = pedido.get('transportadora')
        chamado.status_pedido = pedido.get('status_pedido')
        chamado.canal_vendas = pedido.get('canal_vendas')
        if not chamado.parceiro:
            chamado.parceiro = pedido.get('canal_vendas')
    
    chamado_dict = chamado.model_dump()
    chamado_dict['data_abertura'] = chamado_dict['data_abertura'].isoformat()
    if chamado_dict.get('data_fechamento'):
        chamado_dict['data_fechamento'] = chamado_dict['data_fechamento'].isoformat()
    
    await db.chamados.insert_one(chamado_dict)
    
    # Sync to Google Sheets in background (import lazy to avoid circular)
    try:
        from google_sheets import sheets_client
        background_tasks.add_task(sheets_client.add_atendimento, chamado_dict, pedido)
    except Exception as e:
        logger.error(f"Erro ao sincronizar com Google Sheets: {e}")
    
    return {
        "id": chamado.id,
        "id_atendimento": id_atendimento,
        "message": f"Atendimento {id_atendimento} criado com sucesso",
        "google_sheets_sync": "queued"
    }


@router.get("", response_model=List[dict])
async def list_chamados(
    pendente: Optional[bool] = None,
    categoria: Optional[str] = None,
    atendente: Optional[str] = None,
    parceiro: Optional[str] = None,
    retornar_chamado: Optional[bool] = None,
    verificar_adneia: Optional[bool] = None,
    motivo_pendencia: Optional[str] = None,
    search: Optional[str] = None,
    search_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar chamados com filtros"""
    query = {}
    if pendente is not None:
        query['pendente'] = pendente
    if categoria:
        query['categoria'] = categoria
    if atendente:
        query['atendente'] = atendente
    if parceiro:
        query['parceiro'] = parceiro
    if retornar_chamado is not None:
        query['retornar_chamado'] = retornar_chamado
    if verificar_adneia is not None:
        query['verificar_adneia'] = verificar_adneia
    if motivo_pendencia:
        query['motivo_pendencia'] = motivo_pendencia
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        if search_type == 'solicitacao':
            query['solicitacao'] = search_regex
        elif search_type == 'entrega':
            query['numero_pedido'] = search_regex
        elif search_type == 'cpf':
            query['cpf_cliente'] = search_regex
        elif search_type == 'nome':
            query['nome_cliente'] = search_regex
        else:
            query['$or'] = [
                {"numero_pedido": search_regex},
                {"cpf_cliente": search_regex},
                {"nome_cliente": search_regex},
                {"solicitacao": search_regex},
                {"id_atendimento": search_regex}
            ]
    
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", -1).to_list(5000)
    
    now = datetime.now(timezone.utc)
    for c in chamados:
        try:
            data_abertura = parse_date_safe(c.get('data_abertura'))
            if c.get('pendente', True):
                c['dias_aberto'] = (now - data_abertura).days
            else:
                c['dias_aberto'] = 0
        except (ValueError, TypeError):
            c['dias_aberto'] = 0
        
        if c.get('numero_pedido'):
            pedido = await db.pedidos_erp.find_one(
                {"numero_pedido": c['numero_pedido']},
                {"_id": 0, "status_pedido": 1, "data_status": 1}
            )
            if pedido:
                c['status_pedido'] = pedido.get('status_pedido', '')
                c['data_ultimo_status'] = pedido.get('data_status', '')
    
    return chamados


@router.get("/pendentes/lista", response_model=List[dict])
async def list_pendentes(
    atendente: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar apenas chamados pendentes"""
    query = {"pendente": True}
    if atendente:
        query['atendente'] = atendente
    
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", 1).to_list(5000)
    
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = parse_date_safe(c.get('data_abertura'))
        c['dias_aberto'] = (now - data_abertura).days
    
    return chamados


@router.get("/{chamado_id}", response_model=dict)
async def get_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de um chamado específico"""
    chamado = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]},
        {"_id": 0}
    )
    if not chamado:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    # Buscar dados atualizados do pedido
    if chamado.get('numero_pedido'):
        pedido = await db.pedidos_erp.find_one(
            {"numero_pedido": chamado['numero_pedido']},
            {"_id": 0}
        )
        if pedido:
            chamado['pedido_info'] = pedido
    
    # Buscar histórico
    historico = await db.historico.find(
        {"chamado_id": chamado.get('id')},
        {"_id": 0}
    ).sort("data_hora", -1).to_list(100)
    chamado['historico'] = historico
    
    return chamado


@router.put("/{chamado_id}", response_model=dict)
async def update_chamado(
    chamado_id: str,
    chamado_data: ChamadoUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar chamado existente"""
    existing = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    update_data = {k: v for k, v in chamado_data.model_dump().items() if v is not None}
    
    # Se está finalizando, adicionar data de fechamento
    if update_data.get('pendente') is False and existing.get('pendente') is True:
        update_data['data_fechamento'] = datetime.now(timezone.utc).isoformat()
    
    await db.chamados.update_one(
        {"id": existing['id']},
        {"$set": update_data}
    )
    
    # Sync to Google Sheets
    try:
        from google_sheets import sheets_client
        updated_doc = await db.chamados.find_one({"id": existing['id']}, {"_id": 0})
        if updated_doc:
            background_tasks.add_task(sheets_client.update_atendimento, updated_doc)
    except Exception as e:
        logger.error(f"Erro ao sincronizar com Google Sheets: {e}")
    
    return {"message": "Chamado atualizado com sucesso", "id": existing['id']}


@router.delete("/{chamado_id}")
async def delete_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    """Excluir chamado"""
    result = await db.chamados.delete_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return {"message": "Chamado excluído com sucesso"}


@router.post("/encerrar/{chamado_id}")
async def encerrar_chamado(
    chamado_id: str,
    status_cliente: str = "Resolvido",
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Encerrar chamado com status final"""
    existing = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    update_data = {
        "pendente": False,
        "status_cliente": status_cliente,
        "data_fechamento": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chamados.update_one({"id": existing['id']}, {"$set": update_data})
    
    # Sync to Google Sheets
    try:
        from google_sheets import sheets_client
        updated_doc = await db.chamados.find_one({"id": existing['id']}, {"_id": 0})
        if updated_doc and background_tasks:
            background_tasks.add_task(sheets_client.update_atendimento, updated_doc)
    except Exception as e:
        logger.error(f"Erro ao sincronizar com Google Sheets: {e}")
    
    return {"message": "Chamado encerrado com sucesso", "status_cliente": status_cliente}


@router.post("/gerar-reversa/{numero_pedido}")
async def gerar_codigo_reversa(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """Gera código de reversa para o pedido"""
    codigo = generate_reversa_code(numero_pedido)
    return {"codigo_reversa": codigo, "numero_pedido": numero_pedido}
