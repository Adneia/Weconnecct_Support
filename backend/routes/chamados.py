from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe, generate_reversa_code
from models.chamado import Chamado, ChamadoCreate, ChamadoUpdate
from models.historico import Historico

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ============== HELPERS ==============

async def generate_atendimento_id():
    now = datetime.now(timezone.utc)
    year = now.year
    last_atendimento = await db.chamados.find_one(
        {"id_atendimento": {"$regex": f"^ATD-{year}-"}},
        sort=[("id_atendimento", -1)]
    )
    if last_atendimento:
        try:
            last_num = int(last_atendimento['id_atendimento'].split('-')[-1])
        except (ValueError, IndexError):
            last_num = 0
    else:
        last_num = 0
    return f"ATD-{year}-{str(last_num + 1).zfill(4)}"


def sync_to_google_sheets(chamado_dict: dict, pedido: dict = None):
    try:
        from google_sheets import sheets_client
        sheets_client.add_atendimento(chamado_dict, pedido)
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {e}")


def sync_devolucao_to_sheets(chamado_dict: dict, pedido: dict = None):
    try:
        from google_sheets import sheets_client
        sheets_client.add_devolucao(chamado_dict, pedido)
    except Exception as e:
        logger.error(f"Error syncing devolucao to Sheets: {e}")


def sync_update_to_google_sheets(numero_pedido: str, updates: dict, chamado_completo: dict = None, pedido_info: dict = None):
    try:
        from google_sheets import sheets_client
        sheets_client.update_atendimento(numero_pedido, updates)
        motivo_pendencia = updates.get('motivo_pendencia', '')
        if motivo_pendencia in ['Em devolução', 'Devolvido'] and chamado_completo:
            chamado_merged = {**chamado_completo, **updates}
            sync_devolucao_to_sheets(chamado_merged, pedido_info)
    except Exception as e:
        logger.error(f"Error syncing update to Google Sheets: {e}")


# ============== GERAR REVERSA ==============

@router.post("/chamados/gerar-reversa")
async def gerar_reversa(data: dict, current_user: dict = Depends(get_current_user)):
    numero_pedido = data.get('numero_pedido')
    chamado_id = data.get('chamado_id')
    if not numero_pedido:
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    codigo = generate_reversa_code(numero_pedido)
    reversa = {
        "id": str(uuid.uuid4()),
        "chamado_id": chamado_id,
        "numero_pedido": numero_pedido,
        "codigo_reversa": codigo,
        "status": "Criada",
        "data_criacao": datetime.now(timezone.utc).isoformat(),
        "criado_por": current_user['name']
    }
    await db.reversas.insert_one(reversa)
    if chamado_id:
        await db.chamados.update_one(
            {"id": chamado_id},
            {"$set": {"codigo_reversa": codigo, "reversa_codigo": codigo}}
        )
    return {"codigo_reversa": codigo, "numero_pedido": numero_pedido}


# ============== CRUD CHAMADOS ==============

@router.post("/chamados", response_model=dict)
async def create_chamado(
    chamado_data: ChamadoCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if not chamado_data.numero_pedido.strip():
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    id_atendimento = await generate_atendimento_id()
    chamado = Chamado(**chamado_data.model_dump())
    chamado.id_atendimento = id_atendimento
    chamado.criado_por_id = current_user['id']
    chamado.criado_por_nome = current_user['name']
    if not chamado.categoria_inicial:
        chamado.categoria_inicial = chamado.categoria
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
    historico = Historico(
        chamado_id=chamado.id,
        tipo_acao="Atualização de Status",
        descricao=f"Atendimento {id_atendimento} criado - {chamado_data.categoria}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    background_tasks.add_task(sync_to_google_sheets, chamado_dict, pedido)
    return {
        "id": chamado.id,
        "id_atendimento": id_atendimento,
        "message": f"Atendimento {id_atendimento} criado com sucesso",
        "google_sheets_sync": "queued"
    }


@router.get("/chamados", response_model=List[dict])
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
            data_abertura_raw = c.get('data_abertura')
            if isinstance(data_abertura_raw, str):
                data_abertura = datetime.fromisoformat(data_abertura_raw.replace('Z', '+00:00'))
            elif hasattr(data_abertura_raw, 'replace'):
                data_abertura = data_abertura_raw.replace(tzinfo=timezone.utc) if data_abertura_raw.tzinfo is None else data_abertura_raw
            else:
                data_abertura = now
            if data_abertura.tzinfo is None:
                data_abertura = data_abertura.replace(tzinfo=timezone.utc)
            c['dias_aberto'] = (now - data_abertura).days if c.get('pendente', True) else 0
        except Exception:
            c['dias_aberto'] = 0
        if c.get('numero_pedido'):
            pedido = await db.pedidos_erp.find_one({"numero_pedido": c['numero_pedido']}, {"_id": 0, "status_pedido": 1, "data_status": 1})
            if pedido:
                c['status_pedido'] = pedido.get('status_pedido', '')
                c['data_ultimo_status'] = pedido.get('data_status', '')
        if not c.get('codigo_reversa') and c.get('reversa_codigo'):
            c['codigo_reversa'] = c['reversa_codigo']
    return chamados


@router.get("/chamados/pendentes/lista", response_model=List[dict])
async def list_pendentes(atendente: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"pendente": True}
    if atendente:
        query['atendente'] = atendente
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", 1).to_list(5000)
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = parse_date_safe(c.get('data_abertura'))
        c['dias_aberto'] = (now - data_abertura).days
    return chamados


@router.get("/chamados/{chamado_id}", response_model=dict)
async def get_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    chamado = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}, {"_id": 0}
    )
    if not chamado:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")
    now = datetime.now(timezone.utc)
    data_abertura = parse_date_safe(chamado.get('data_abertura'))
    chamado['dias_aberto'] = (now - data_abertura).days if chamado.get('pendente', True) else 0
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado['numero_pedido']}, {"_id": 0})
    if pedido:
        chamado['pedido_erp'] = pedido
    reversa = await db.reversas.find_one({"chamado_id": chamado['id']}, {"_id": 0})
    if reversa:
        chamado['reversa'] = reversa
    return chamado


@router.put("/chamados/{chamado_id}", response_model=dict)
async def update_chamado(
    chamado_id: str,
    chamado_data: ChamadoUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    update_data = {k: v for k, v in chamado_data.model_dump().items() if v is not None}
    if update_data.get('status_atendimento') == 'Fechado' and existing.get('status_atendimento') != 'Fechado':
        update_data['data_resolucao'] = datetime.now(timezone.utc).isoformat()
    if 'pendente' in update_data and not update_data['pendente'] and existing.get('pendente', True):
        update_data['data_fechamento'] = datetime.now(timezone.utc).isoformat()
        motivos_finalizadores = ["Entregue", "Estornado", "Atendido", "Em devolução", "Devolvido", "Encerrado"]
        motivo_atual = update_data.get('motivo_pendencia') or existing.get('motivo_pendencia', '')
        if motivo_atual and motivo_atual not in motivos_finalizadores:
            update_data['motivo_pendencia'] = "Encerrado"
    if update_data:
        await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})
        if 'status_atendimento' in update_data or 'status_chamado' in update_data or 'pendente' in update_data:
            historico = Historico(
                chamado_id=chamado_id,
                tipo_acao="Atualização de Status",
                descricao=f"Status atualizado: {update_data.get('status_atendimento', '')} / Pendente: {'NÃO' if not update_data.get('pendente', True) else 'SIM'}",
                usuario_id=current_user['id'],
                usuario_nome=current_user['name']
            )
            hist_dict = historico.model_dump()
            hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
            await db.historico.insert_one(hist_dict)
        id_atendimento = existing.get('id_atendimento')
        numero_pedido_antigo = existing.get('numero_pedido')
        if id_atendimento and numero_pedido_antigo:
            chamado_completo = None
            pedido_info = None
            motivo_pendencia = update_data.get('motivo_pendencia', '')
            if motivo_pendencia in ['Em devolução', 'Devolvido']:
                chamado_completo = await db.chamados.find_one({"id": chamado_id}, {"_id": 0})
                numero_pedido = existing.get('numero_pedido')
                if numero_pedido:
                    pedido_info = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
            background_tasks.add_task(sync_update_to_google_sheets, numero_pedido_antigo, update_data, chamado_completo, pedido_info)
    return {"message": "Chamado atualizado com sucesso", "google_sheets_sync": "queued"}


@router.put("/chamados/{chamado_id}/reabrir", response_model=dict)
async def reabrir_chamado(
    chamado_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    if existing.get('pendente', True):
        raise HTTPException(status_code=400, detail="Atendimento já está aberto")

    hoje = datetime.now(timezone.utc).strftime('%d/%m/%Y')
    anotacoes_atuais = existing.get('anotacoes', '')
    nova_anotacao = f"[{hoje}] *** ATENDIMENTO REABERTO por {current_user['name']} ***"
    novas_anotacoes = f"{nova_anotacao}\n\n{anotacoes_atuais}" if anotacoes_atuais else nova_anotacao

    update_data = {
        "pendente": True,
        "data_fechamento": None,
        "anotacoes": novas_anotacoes
    }
    await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})

    historico = Historico(
        chamado_id=chamado_id,
        tipo_acao="Reabertura",
        descricao=f"Atendimento reaberto por {current_user['name']}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)

    numero_pedido = existing.get('numero_pedido')
    if numero_pedido:
        background_tasks.add_task(sync_update_to_google_sheets, numero_pedido, update_data)

    return {"message": "Atendimento reaberto com sucesso"}


@router.delete("/chamados/{chamado_id}", response_model=dict)
async def delete_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.chamados.delete_one({"id": chamado_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return {"message": "Chamado excluído com sucesso"}


# ============== HISTORICO ==============

@router.post("/historico", response_model=dict)
async def create_historico(data: dict, current_user: dict = Depends(get_current_user)):
    historico = Historico(
        chamado_id=data['chamado_id'],
        tipo_acao=data.get('tipo_acao', 'Nota'),
        descricao=data.get('descricao', ''),
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    return {"id": historico.id, "message": "Histórico criado com sucesso"}


@router.get("/historico/{chamado_id}", response_model=List[dict])
async def get_historico(chamado_id: str, current_user: dict = Depends(get_current_user)):
    return await db.historico.find({"chamado_id": chamado_id}, {"_id": 0}).sort("data_hora", -1).to_list(100)


# ============== REVERSAS ==============

@router.get("/reversas", response_model=List[dict])
async def list_reversas(current_user: dict = Depends(get_current_user)):
    return await db.reversas.find({}, {"_id": 0}).sort("data_criacao", -1).to_list(500)


@router.get("/reversas/{reversa_id}", response_model=dict)
async def get_reversa(reversa_id: str, current_user: dict = Depends(get_current_user)):
    reversa = await db.reversas.find_one({"id": reversa_id}, {"_id": 0})
    if not reversa:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    return reversa


@router.put("/reversas/{reversa_id}", response_model=dict)
async def update_reversa(reversa_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    result = await db.reversas.update_one({"id": reversa_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    return {"message": "Reversa atualizada com sucesso"}
