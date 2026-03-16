from fastapi import APIRouter, Depends, BackgroundTasks
from utils.database import db
from utils.auth import get_current_user
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Estado global da sincronização
sync_status = {
    "running": False,
    "progress": "",
    "result": None,
    "error": None,
}


@router.get("/google-sheets/status")
async def get_sheets_status(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        status = sheets_client.get_status()
        return {"connected": True, "status": status}
    except Exception as e:
        return {"connected": False, "error": str(e)}


@router.get("/google-sheets/sync-status")
async def get_sync_status(current_user: dict = Depends(get_current_user)):
    """Retorna o status da sincronização em andamento."""
    return sync_status


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
async def sync_all_to_sheets(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Sincroniza TODOS os chamados pendentes com o Google Sheets em background."""
    global sync_status

    if sync_status["running"]:
        return {"success": False, "error": "Sincronização já em andamento. Aguarde."}

    sync_status = {"running": True, "progress": "Iniciando...", "result": None, "error": None}
    background_tasks.add_task(run_sync_all)
    return {"success": True, "message": "Sincronização iniciada em background. Use /api/google-sheets/sync-status para acompanhar."}


async def run_sync_all():
    """Executa a sincronização completa em background."""
    global sync_status
    try:
        from google_sheets import sheets_client, ATENDIMENTO_COLUMNS
        import time

        # Inicializar
        sync_status["progress"] = "Conectando ao Google Sheets..."
        if not sheets_client.is_initialized():
            if not sheets_client.initialize():
                sync_status.update({"running": False, "error": "Falha ao conectar com Google Sheets."})
                return

        # Buscar chamados do banco
        sync_status["progress"] = "Buscando chamados do banco..."
        chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(10000)
        total = len(chamados)
        sync_status["progress"] = f"Encontrados {total} chamados pendentes. Buscando pedidos..."

        # Buscar pedidos ERP em lote
        pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
        pedidos_raw = await db.pedidos_erp.find(
            {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
        ).to_list(len(pedido_numbers)) if pedido_numbers else []
        pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

        # Obter worksheet
        worksheet = sheets_client._get_atendimentos_worksheet()

        # Ler dados existentes para mapear entrega -> row (detectando formato antigo e novo)
        sync_status["progress"] = "Lendo planilha existente..."
        all_values = worksheet.get_all_values()

        # Detectar formato: verificar se os dados estão no formato antigo ou novo
        # Formato antigo: A=Data, B=Parceiro, C=Entrega, D=Solicitação
        # Formato novo: A=Data, B=ID_Atendimento, C=Parceiro, D=Entrega
        # Detecção: se B começa com "ATD" ou está vazio → formato novo; senão → formato antigo
        entrega_to_row = {}
        old_format_rows = {}

        for i, row in enumerate(all_values):
            if i == 0 or len(row) < 3:
                continue

            col_b = str(row[1]).strip() if len(row) > 1 else ''

            # Formato novo: coluna B é vazia ou começa com "ATD"
            is_new_format = (col_b == '' or col_b.startswith('ATD'))

            if is_new_format and len(row) > 3:
                entrega_val = str(row[3]).strip().replace('.0', '')  # D = Entrega
            else:
                entrega_val = str(row[2]).strip().replace('.0', '')  # C = Entrega (formato antigo)
                old_format_rows[i + 1] = True

            if entrega_val and entrega_val.replace('.', '').isdigit():
                entrega_to_row[entrega_val] = i + 1

        sync_status["progress"] = f"Planilha: {len(entrega_to_row)} registros encontrados. Sincronizando..."

        added = 0
        updated = 0
        errors = 0
        batch_updates = []

        # Mapeamento de colunas para formato NOVO (A=Data, B=ID, C=Parceiro, D=Entrega...)
        field_to_col_new = {
            'id_atendimento': 2, 'parceiro': 3, 'categoria': 8, 'motivo': 9,
            'pendente': 10, 'motivo_pendencia': 11, 'verificar_adneia': 12,
            'retornar_chamado': 13, 'reversa_codigo': 15, 'anotacoes': 16,
            'status_pedido': 17,
        }

        # Mapeamento para formato ANTIGO (A=Data, B=Parceiro, C=Entrega... sem coluna ID)
        field_to_col_old = {
            'parceiro': 2, 'categoria': 7, 'motivo': 8,
            'pendente': 9, 'motivo_pendencia': 10, 'verificar_adneia': 11,
            'retornar_chamado': 12, 'reversa_codigo': 14, 'anotacoes': 15,
            'status_pedido': 16,
        }

        for idx, chamado in enumerate(chamados):
            entrega = str(chamado.get('numero_pedido', '')).strip()
            if not entrega:
                continue

            if idx % 50 == 0:
                sync_status["progress"] = f"Processando {idx}/{total}... ({added} novos, {updated} atualizados)"
                await asyncio.sleep(0)  # Yield para não bloquear o event loop

            row_num = entrega_to_row.get(entrega)

            if row_num:
                # UPDATE existente
                is_old = row_num in old_format_rows
                field_to_col = field_to_col_old if is_old else field_to_col_new

                # Para formato antigo, inserir ID na coluna B requer reescrever a linha inteira
                # Para formato novo, apenas atualizar a coluna B
                if not is_old:
                    id_atd = chamado.get('id_atendimento', '')
                    existing_row = all_values[row_num - 1] if row_num <= len(all_values) else []
                    if id_atd and (len(existing_row) < 2 or not existing_row[1].strip()):
                        batch_updates.append({'range': f"B{row_num}", 'values': [[id_atd]]})

                updates_map = {
                    'categoria': chamado.get('categoria', ''),
                    'motivo': chamado.get('motivo', ''),
                    'pendente': 'SIM' if chamado.get('pendente') else 'NÃO',
                    'motivo_pendencia': chamado.get('motivo_pendencia', ''),
                    'verificar_adneia': 'SIM' if chamado.get('verificar_adneia') else 'NÃO',
                    'retornar_chamado': 'SIM' if chamado.get('retornar_chamado') else 'NÃO',
                    'reversa_codigo': chamado.get('codigo_reversa', '') or chamado.get('reversa_codigo', '') or '',
                    'anotacoes': str(chamado.get('anotacoes', '') or ''),
                }

                # Atualizar status do pedido
                pedido = pedidos_dict.get(entrega, {})
                if pedido:
                    updates_map['status_pedido'] = pedido.get('status_pedido', '')

                for field, value in updates_map.items():
                    col = field_to_col.get(field)
                    if col:
                        col_letter = chr(64 + col) if col <= 26 else chr(64 + (col - 1) // 26) + chr(64 + (col - 1) % 26 + 1)
                        batch_updates.append({'range': f"{col_letter}{row_num}", 'values': [[str(value or '')]]})

                updated += 1
            else:
                # ADD novo (com formato novo completo)
                try:
                    pedido = pedidos_dict.get(entrega)
                    sheets_client.add_atendimento(chamado, pedido)
                    added += 1
                    time.sleep(1)  # Rate limit para adds individuais
                except Exception as e:
                    errors += 1
                    logger.error(f"Erro add {entrega}: {e}")

        # Aplicar batch updates em chunks
        if batch_updates:
            chunk_size = 300
            total_chunks = (len(batch_updates) + chunk_size - 1) // chunk_size
            for i in range(0, len(batch_updates), chunk_size):
                chunk_num = i // chunk_size + 1
                sync_status["progress"] = f"Salvando alterações... (bloco {chunk_num}/{total_chunks})"
                chunk = batch_updates[i:i+chunk_size]
                try:
                    worksheet.batch_update(chunk)
                except Exception as e:
                    errors += 1
                    logger.error(f"Erro batch update chunk {i}: {e}")
                time.sleep(2)  # Rate limit entre chunks
                await asyncio.sleep(0)

        result = {"success": True, "added": added, "updated": updated, "errors": errors, "total": total}
        sync_status.update({"running": False, "progress": "Concluído!", "result": result})
        logger.info(f"Sync-all concluído: {result}")

    except Exception as e:
        logger.error(f"Erro sync-all: {e}")
        sync_status.update({"running": False, "error": str(e), "progress": "Erro!"})


@router.post("/google-sheets/rebuild")
async def rebuild_sheets(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Reconstrói a planilha do zero: limpa dados e reescreve tudo no formato correto."""
    global sync_status

    if sync_status["running"]:
        return {"success": False, "error": "Já existe uma sincronização em andamento. Aguarde."}

    sync_status = {"running": True, "progress": "Iniciando reconstrução...", "result": None, "error": None}
    background_tasks.add_task(run_rebuild)
    return {"success": True, "message": "Reconstrução iniciada em background."}


async def run_rebuild():
    """Reconstrói a planilha inteira do zero."""
    global sync_status
    try:
        from google_sheets import sheets_client, ATENDIMENTO_COLUMNS
        import time

        sync_status["progress"] = "Conectando ao Google Sheets..."
        if not sheets_client.is_initialized():
            if not sheets_client.initialize():
                sync_status.update({"running": False, "error": "Falha ao conectar."})
                return

        # Buscar TODOS os chamados (pendentes e resolvidos para ter o histórico completo)
        sync_status["progress"] = "Buscando todos os chamados..."
        chamados = await db.chamados.find({}, {"_id": 0}).to_list(20000)
        total = len(chamados)

        # Buscar pedidos ERP
        pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
        pedidos_raw = await db.pedidos_erp.find(
            {"numero_pedido": {"$in": pedido_numbers}}, {"_id": 0}
        ).to_list(len(pedido_numbers)) if pedido_numbers else []
        pedidos_dict = {p['numero_pedido']: p for p in pedidos_raw}

        worksheet = sheets_client._get_atendimentos_worksheet()

        # Limpar planilha (manter header)
        sync_status["progress"] = "Limpando planilha..."
        try:
            row_count = worksheet.row_count
            if row_count > 1:
                worksheet.delete_rows(2, row_count)
        except Exception as e:
            logger.warning(f"Erro ao limpar: {e}")

        # Reescrever header
        sync_status["progress"] = "Escrevendo cabeçalho..."
        try:
            worksheet.update('A1', [ATENDIMENTO_COLUMNS])
        except Exception as e:
            logger.warning(f"Erro ao escrever header: {e}")
        time.sleep(2)

        # Preparar todas as linhas
        sync_status["progress"] = f"Preparando {total} registros..."
        all_rows = []
        for idx, chamado in enumerate(chamados):
            if idx % 100 == 0:
                sync_status["progress"] = f"Preparando registros... {idx}/{total}"
                await asyncio.sleep(0)

            pedido = pedidos_dict.get(chamado.get('numero_pedido', ''), {})

            # Formatar data
            data_raw = chamado.get('data_abertura', '')
            data_fmt = data_raw
            if data_raw and 'T' in str(data_raw):
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(str(data_raw).replace('Z', '+00:00'))
                    data_fmt = dt.strftime('%d/%m/%Y')
                except:
                    data_fmt = str(data_raw)[:10]

            # Formatar data de encerramento
            dt_enc = ''
            if not chamado.get('pendente', True) and chamado.get('data_fechamento'):
                try:
                    dt_obj = datetime.fromisoformat(str(chamado['data_fechamento']).replace('Z', '+00:00'))
                    dt_enc = dt_obj.strftime('%d/%m/%Y')
                except:
                    dt_enc = str(chamado['data_fechamento'])[:10]

            nota = str(pedido.get('nota_fiscal', '') or '')
            if nota.endswith('.0'):
                nota = nota[:-2]

            # Calcular tempo (dias aberto)
            tempo = ''
            if chamado.get('dias_aberto') is not None:
                tempo = str(chamado['dias_aberto'])

            row = [
                str(data_fmt),                                              # A - Data
                str(chamado.get('id_atendimento', '')),                     # B - ID_Atendimento
                str(chamado.get('parceiro', '') or chamado.get('canal_vendas', '')),  # C - Parceiro
                str(chamado.get('numero_pedido', '')),                      # D - Entrega
                str(chamado.get('solicitacao', '')),                        # E - Solicitação
                str(chamado.get('nome_cliente', '')),                       # F - Nome
                str(chamado.get('cpf_cliente', '')),                        # G - CPF
                str(chamado.get('categoria', '')),                          # H - Categoria
                str(chamado.get('motivo', '')),                             # I - Motivo
                'SIM' if chamado.get('pendente', True) else 'NÃO',         # J - Pendente
                str(chamado.get('motivo_pendencia', '')),                   # K - Motivo_Pendencia
                'SIM' if chamado.get('verificar_adneia') else 'NÃO',       # L - Verificar
                'SIM' if chamado.get('retornar_chamado') else 'NÃO',       # M - Retornar
                dt_enc,                                                      # N - DT_Encerramento
                str(chamado.get('reversa_codigo', '') or chamado.get('codigo_reversa', '') or ''),  # O - Reversa
                str(chamado.get('anotacoes', '') or ''),                    # P - Anotações
                str(pedido.get('status_pedido', '')),                       # Q - Status_Pedido
                nota,                                                        # R - Nota
                str(pedido.get('chave_nota', '') or ''),                    # S - Chave_Acesso
                str(pedido.get('filial', '') or pedido.get('uf', '') or ''), # T - Filial
                tempo,                                                       # U - Tempo
            ]
            all_rows.append(row)

        # Escrever em blocos de 500 linhas para evitar timeout
        chunk_size = 500
        total_chunks = (len(all_rows) + chunk_size - 1) // chunk_size
        added = 0

        for i in range(0, len(all_rows), chunk_size):
            chunk_num = i // chunk_size + 1
            sync_status["progress"] = f"Escrevendo na planilha... bloco {chunk_num}/{total_chunks}"
            chunk = all_rows[i:i+chunk_size]
            start_row = i + 2  # +2 porque row 1 é header

            try:
                cell_range = f"A{start_row}"
                worksheet.update(cell_range, chunk, value_input_option='RAW')
                added += len(chunk)
            except Exception as e:
                logger.error(f"Erro ao escrever bloco {chunk_num}: {e}")

            time.sleep(3)  # Rate limit
            await asyncio.sleep(0)

        result = {"success": True, "added": added, "updated": 0, "errors": 0, "total": total}
        sync_status.update({"running": False, "progress": "Reconstrução concluída!", "result": result})
        logger.info(f"Rebuild concluído: {result}")

    except Exception as e:
        logger.error(f"Erro rebuild: {e}")
        sync_status.update({"running": False, "error": str(e), "progress": "Erro!"})
