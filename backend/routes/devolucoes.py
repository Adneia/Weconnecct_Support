from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from utils.database import db
from utils.auth import get_current_user
from models.devolucao import DevolucaoCreate

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.post("/devolucoes", response_model=dict)
async def create_devolucao(devolucao_data: DevolucaoCreate, current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        from uuid import uuid4

        id_devolucao = f"DEV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid4())[:6].upper()}"
        data_atual = datetime.now(timezone.utc).strftime('%d/%m/%Y')

        row_data = {
            'id_devolucao': id_devolucao,
            'id_atendimento': devolucao_data.id_atendimento or '',
            'data_entrada': devolucao_data.data_devolucao or data_atual,
            'numero_pedido': devolucao_data.numero_pedido,
            'cpf_cliente': devolucao_data.cpf_cliente or '',
            'nome_cliente': devolucao_data.nome_cliente,
            'produto': devolucao_data.produto or '',
            'filial': devolucao_data.filial or '',
            'codigo_reversa': devolucao_data.codigo_reversa or '',
            'canal_vendas': devolucao_data.canal_vendas or '',
            'motivo': devolucao_data.motivo or '',
            'solicitacao': devolucao_data.solicitacao or '',
            'status': 'Em devolução',
            'responsavel': current_user.get('name', ''),
            'atendimento': devolucao_data.atendimento or 'Ag. Estorno',
            'devolvido_por': devolucao_data.devolvido_por or '',
            'status_galpao': devolucao_data.status_galpao or 'AGUARDANDO'
        }

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
        return {"message": "Erro ao registrar devolução na planilha", "sync_status": "error", "error": str(e)}
