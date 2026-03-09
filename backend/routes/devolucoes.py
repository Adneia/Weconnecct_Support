"""
Rotas de Devoluções - Registro e sincronização com Google Sheets
"""
from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

from utils.database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devolucoes", tags=["devolucoes"])


class DevolucaoCreate(BaseModel):
    id_atendimento: str
    entrega: str
    cpf: Optional[str] = None
    nome: Optional[str] = None
    produto: Optional[str] = None
    filial: Optional[str] = None
    codigo_reversa: Optional[str] = None
    canal_vendas: Optional[str] = None
    motivo: Optional[str] = None
    solicitacao: Optional[str] = None
    # Novos campos para colunas J, K, L
    atendimento: Optional[str] = "Aguardando"  # Status: Aguardando, Estornado, Reenviado
    devolvido_por: Optional[str] = None  # Correios ou nome da Transportadora
    status_galpao: Optional[str] = "AGUARDANDO"


@router.post("")
async def create_devolucao(
    devolucao_data: DevolucaoCreate,
    current_user: dict = Depends(get_current_user)
):
    """Registra nova devolução na planilha Google Sheets"""
    try:
        from google_sheets import sheets_client
        
        if not sheets_client.is_initialized():
            sheets_client.initialize()
        
        # Gerar ID da devolução
        id_devolucao = f"DEV-{devolucao_data.id_atendimento.replace('ATD-', '')}"
        
        row_data = {
            'id_devolucao': id_devolucao,
            'id_atendimento': devolucao_data.id_atendimento,
            'entrega': devolucao_data.entrega,
            'cpf': devolucao_data.cpf or '',
            'nome': devolucao_data.nome or '',
            'produto': devolucao_data.produto or '',
            'filial': devolucao_data.filial or '',
            'codigo_reversa': devolucao_data.codigo_reversa or '',
            'canal_vendas': devolucao_data.canal_vendas or '',
            'motivo': devolucao_data.motivo or '',
            'solicitacao': devolucao_data.solicitacao or '',
            'status': 'Em devolução',
            'responsavel': current_user.get('name', ''),
            # Novos campos para colunas J, K, L
            'atendimento': devolucao_data.atendimento or 'Aguardando',
            'devolvido_por': devolucao_data.devolvido_por or '',
            'status_galpao': devolucao_data.status_galpao or 'AGUARDANDO'
        }
        
        # Adicionar à planilha de devoluções
        result = sheets_client.add_devolucao_row(row_data)
        
        return {
            "message": "Devolução registrada com sucesso na planilha",
            "sync_status": "success" if result else "failed",
            "id_devolucao": id_devolucao
        }
    except Exception as e:
        logger.error(f"Erro ao registrar devolução: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "message": "Erro ao registrar devolução na planilha",
            "sync_status": "error",
            "error": str(e)
        }


@router.get("")
async def list_devolucoes(current_user: dict = Depends(get_current_user)):
    """Lista devoluções registradas"""
    try:
        from google_sheets import sheets_client
        
        if not sheets_client.is_initialized():
            sheets_client.initialize()
        
        # Buscar devoluções da planilha
        devolucoes = sheets_client.get_all_devolucoes()
        return devolucoes
    except Exception as e:
        logger.error(f"Erro ao listar devoluções: {e}")
        return []
