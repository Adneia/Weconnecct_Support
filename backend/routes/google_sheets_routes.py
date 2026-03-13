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
    """Sincroniza TODOS os chamados pendentes com o Google Sheets (add novos, update existentes)."""
    try:
        from google_sheets import sheets_client
        chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)

        # Buscar pedidos ERP em lote
        pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
        pedidos_raw = await db.pedidos_erp.find(
            {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
        ).to_list(len(pedido_numbers)) if pedido_numbers else []
        pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

        # Verificar quais já existem no Sheet
        try:
            worksheet = sheets_client._get_atendimentos_worksheet()
            all_values = worksheet.get_all_values()
            entregas_no_sheet = set()
            for row in all_values[1:]:
                if len(row) > 2 and row[2]:
                    entregas_no_sheet.add(row[2].strip())
        except Exception:
            entregas_no_sheet = set()

        added = 0
        updated = 0
        errors = 0

        for chamado in chamados:
            entrega = chamado.get('numero_pedido', '')
            pedido = pedidos_dict.get(entrega)
            try:
                if entrega in entregas_no_sheet:
                    # Já existe, atualizar
                    sheets_client.update_atendimento(entrega, {
                        "anotacoes": chamado.get('anotacoes', ''),
                        "motivo_pendencia": chamado.get('motivo_pendencia', ''),
                        "categoria": chamado.get('categoria', ''),
                        "motivo": chamado.get('motivo', ''),
                        "pendente": "SIM" if chamado.get('pendente') else "NÃO",
                        "verificar_adneia": "SIM" if chamado.get('verificar_adneia') else "",
                        "retornar_chamado": "SIM" if chamado.get('retornar_chamado') else "",
                        "reversa_codigo": chamado.get('codigo_reversa', '') or '',
                    })
                    updated += 1
                else:
                    # Não existe, adicionar
                    sheets_client.add_atendimento(chamado, pedido)
                    added += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    logger.error(f"Erro sync {entrega}: {e}")

        return {"success": True, "added": added, "updated": updated, "errors": errors, "total": len(chamados)}
    except Exception as e:
        return {"success": False, "error": str(e)}
