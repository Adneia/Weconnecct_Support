from fastapi import APIRouter, Depends

from utils.database import db
from utils.auth import get_current_user

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/google-sheets/status")
async def get_sheets_status(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        status = sheets_client.get_status()
        return {"connected": True, "status": status}
    except Exception as e:
        return {"connected": False, "error": str(e)}


@router.post("/google-sheets/initialize")
async def initialize_sheets(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        result = sheets_client.initialize()
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Erro ao inicializar Google Sheets: {e}")
        return {"success": False, "error": str(e)}


@router.post("/google-sheets/sync-all")
async def sync_all_to_sheets(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)
        synced = 0
        for chamado in chamados[:10]:
            try:
                sheets_client.add_atendimento(chamado)
                synced += 1
            except Exception as e:
                logger.error(f"Erro sync: {e}")
        return {"success": True, "synced": synced, "total": len(chamados)}
    except Exception as e:
        return {"success": False, "error": str(e)}
