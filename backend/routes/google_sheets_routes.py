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
    """Sincroniza TODOS os chamados pendentes com o Google Sheets usando batch operations."""
    try:
        from google_sheets import sheets_client
        import time

        # Garantir inicialização
        if not sheets_client.is_initialized():
            if not sheets_client.initialize():
                return {"success": False, "error": "Falha ao conectar com Google Sheets. Verifique as credenciais."}

        chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)

        # Buscar pedidos ERP em lote
        pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
        pedidos_raw = await db.pedidos_erp.find(
            {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
        ).to_list(len(pedido_numbers)) if pedido_numbers else []
        pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

        # Ler todos os dados do Sheet de uma vez
        worksheet = sheets_client._get_atendimentos_worksheet()
        all_values = worksheet.get_all_values()

        # Mapear entrega -> row number (comparação normalizada)
        entrega_to_row = {}
        for i, row in enumerate(all_values):
            if i == 0 or len(row) < 4:
                continue
            entrega_sheet = str(row[3]).strip().replace('.0', '')  # Coluna D = Entrega
            if entrega_sheet:
                entrega_to_row[entrega_sheet] = i + 1  # 1-indexed

        added = 0
        updated = 0
        errors = 0
        batch_updates = []

        field_to_col = {
            'categoria': 8, 'motivo': 9, 'pendente': 10,
            'motivo_pendencia': 11, 'verificar_adneia': 12,
            'retornar_chamado': 13, 'reversa_codigo': 15, 'anotacoes': 16,
        }

        for chamado in chamados:
            entrega = str(chamado.get('numero_pedido', '')).strip()
            if not entrega:
                continue

            row_num = entrega_to_row.get(entrega)

            if row_num:
                # UPDATE existente via batch
                # Atualizar ID_Atendimento na coluna A se estiver vazio
                existing_row = all_values[row_num - 1] if row_num <= len(all_values) else []
                id_atd = chamado.get('id_atendimento', '')
                if id_atd and (len(existing_row) < 1 or not existing_row[0].strip()):
                    batch_updates.append({
                        'range': f"A{row_num}",
                        'values': [[id_atd]]
                    })

                updates_map = {
                    'categoria': chamado.get('categoria', ''),
                    'motivo': chamado.get('motivo', ''),
                    'pendente': 'SIM' if chamado.get('pendente') else 'NÃO',
                    'motivo_pendencia': chamado.get('motivo_pendencia', ''),
                    'verificar_adneia': 'SIM' if chamado.get('verificar_adneia') else 'NÃO',
                    'retornar_chamado': 'SIM' if chamado.get('retornar_chamado') else 'NÃO',
                    'reversa_codigo': chamado.get('codigo_reversa', '') or '',
                    'anotacoes': chamado.get('anotacoes', ''),
                }
                for field, value in updates_map.items():
                    col = field_to_col[field]
                    batch_updates.append({
                        'range': f"{chr(64 + col)}{row_num}",
                        'values': [[value or '']]
                    })
                updated += 1
            else:
                # ADD novo
                try:
                    pedido = pedidos_dict.get(entrega)
                    sheets_client.add_atendimento(chamado, pedido)
                    added += 1
                    time.sleep(1)  # Rate limit
                except Exception as e:
                    errors += 1
                    logger.error(f"Erro add {entrega}: {e}")

        # Aplicar todas as atualizações em batch (em blocos de 500 para evitar timeout)
        if batch_updates:
            chunk_size = 500
            for i in range(0, len(batch_updates), chunk_size):
                chunk = batch_updates[i:i+chunk_size]
                try:
                    worksheet.batch_update(chunk)
                except Exception as e:
                    errors += 1
                    logger.error(f"Erro batch update chunk {i}: {e}")
                time.sleep(2)  # Rate limit entre chunks

        return {"success": True, "added": added, "updated": updated, "errors": errors, "total": len(chamados)}
    except Exception as e:
        logger.error(f"Erro sync-all: {e}")
        return {"success": False, "error": str(e)}
