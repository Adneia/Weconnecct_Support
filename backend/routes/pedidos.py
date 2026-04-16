from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import (
    parse_date_safe, get_galpao_from_serie, get_column_mapping,
    extract_pedido_data, should_skip_old_pedido
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ============== BUSCAR PEDIDOS ==============

@router.get("/pedidos-erp/buscar/cpf/{cpf}")
async def buscar_pedido_por_cpf(cpf: str, current_user: dict = Depends(get_current_user)):
    """Search pedidos by CPF (supports both formatted and unformatted)"""
    # Remove formatting from CPF
    cpf_limpo = cpf.replace(".", "").replace("-", "").strip()
    
    pedidos = await db.pedidos_erp.find({
        "$or": [
            {"cpf_cliente": {"$regex": cpf_limpo, "$options": "i"}},
            {"cpf_cliente": {"$regex": cpf, "$options": "i"}}
        ]
    }, {"_id": 0}).sort("data_status", -1).to_list(50)
    
    # Add galpao info to each pedido
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf', ''), p.get('chave_nota', ''))
        p['galpao'] = galpao_info.get('galpao', '')
        p['uf_galpao'] = galpao_info.get('uf_galpao', '')
    
    return pedidos


@router.get("/pedidos-erp/buscar/nome/{nome}")
async def buscar_pedido_por_nome(nome: str, current_user: dict = Depends(get_current_user)):
    """Search pedidos by customer name"""
    pedidos = await db.pedidos_erp.find({
        "nome_cliente": {"$regex": nome, "$options": "i"}
    }, {"_id": 0}).sort("data_status", -1).to_list(50)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf', ''), p.get('chave_nota', ''))
        p['galpao'] = galpao_info.get('galpao', '')
        p['uf_galpao'] = galpao_info.get('uf_galpao', '')
    
    return pedidos


@router.get("/pedidos-erp/buscar/pedido/{pedido}")
async def buscar_pedido_por_numero_pedido(pedido: str, current_user: dict = Depends(get_current_user)):
    """Search pedidos by any pedido-related field (partial match)"""
    pedidos = await db.pedidos_erp.find({
        "$or": [
            {"numero_pedido": {"$regex": pedido, "$options": "i"}},
            {"codigo_pedido": {"$regex": pedido, "$options": "i"}},
            {"pedido_cliente": {"$regex": pedido, "$options": "i"}},
            {"pedido_externo": {"$regex": pedido, "$options": "i"}}
        ]
    }, {"_id": 0}).sort("data_status", -1).to_list(50)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf', ''), p.get('chave_nota', ''))
        p['galpao'] = galpao_info.get('galpao', '')
        p['uf_galpao'] = galpao_info.get('uf_galpao', '')
    
    return pedidos


@router.get("/pedidos-erp/buscar/galpao/{galpao}/nota/{nota}")
async def buscar_pedido_por_galpao_nota(galpao: str, nota: str, current_user: dict = Depends(get_current_user)):
    """Search pedidos by galpao and nota fiscal"""
    query = {}
    nota_str = nota.strip()
    
    # Map galpao to serie_nf
    if galpao.upper() == "SC":
        query["serie_nf"] = "1"
    elif galpao.upper() == "SP":
        query["serie_nf"] = "6"
    elif galpao.upper() == "ES":
        query["serie_nf"] = "2"
    else:
        query["serie_nf"] = galpao
    
    query["$or"] = [
        {"nota_fiscal": nota_str},
        {"nota_fiscal": nota_str + ".0"},
        {"nota_fiscal": {"$regex": f"^{nota_str}", "$options": "i"}}
    ]
    
    pedidos = await db.pedidos_erp.find(query, {"_id": 0}).to_list(50)
    
    # If no results with serie_nf filter, try just nota
    if not pedidos:
        query_nota = {"$or": [
            {"nota_fiscal": nota_str},
            {"nota_fiscal": nota_str + ".0"},
            {"nota_fiscal": {"$regex": f"^{nota_str}", "$options": "i"}}
        ]}
        pedidos = await db.pedidos_erp.find(query_nota, {"_id": 0}).to_list(50)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf', ''), p.get('chave_nota', ''))
        p['galpao'] = galpao_info.get('galpao', '')
        p['uf_galpao'] = galpao_info.get('uf_galpao', '')
    
    return pedidos


@router.get("/pedidos-erp/import-status")
async def get_import_status(current_user: dict = Depends(get_current_user)):
    status = await db.import_status.find({}, {"_id": 0}).sort("started_at", -1).to_list(5)
    return status


@router.get("/pedidos-erp/import-status/{import_id}")
async def get_import_status_by_id(import_id: str, current_user: dict = Depends(get_current_user)):
    status = await db.import_status.find_one({"import_id": import_id}, {"_id": 0})
    if not status:
        return {"import_id": import_id, "status": "processing", "progress": 0, "total_rows": 0, "processed": 0}
    return status


@router.get("/pedidos-erp/{numero_pedido}")
async def get_pedido_by_entrega(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """Get single pedido by numero_pedido, codigo_pedido, pedido_cliente ou pedido_externo"""
    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    
    # Buscar em campos alternativos se não encontrou
    if not pedido:
        pedido = await db.pedidos_erp.find_one({"codigo_pedido": numero_pedido}, {"_id": 0})
    if not pedido:
        pedido = await db.pedidos_erp.find_one({"pedido_cliente": numero_pedido}, {"_id": 0})
    if not pedido:
        pedido = await db.pedidos_erp.find_one({"pedido_externo": numero_pedido}, {"_id": 0})
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # Add galpao info
    galpao_info = get_galpao_from_serie(pedido.get('serie_nf', ''), pedido.get('chave_nota', ''))
    pedido['galpao'] = galpao_info.get('galpao', '')
    pedido['uf_galpao'] = galpao_info.get('uf_galpao', '')
    
    return pedido


@router.get("/pedidos-erp/buscar")
async def buscar_pedido_erp(
    numero_pedido: Optional[str] = None,
    galpao: Optional[str] = None,
    nota: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if galpao and nota:
        query = {}
        nota_str = nota.strip()
        if galpao.upper() == "SC":
            query["serie_nf"] = "1"
        elif galpao.upper() == "SP":
            query["serie_nf"] = "6"
        elif galpao.upper() == "ES":
            query["serie_nf"] = "2"
        else:
            query["serie_nf"] = galpao
        query["$or"] = [
            {"nota_fiscal": nota_str},
            {"nota_fiscal": nota_str + ".0"},
        ]
        pedidos = await db.pedidos_erp.find(query, {"_id": 0}).to_list(10)
        if not pedidos:
            query_nota = {"$or": [
                {"nota_fiscal": nota_str},
                {"nota_fiscal": nota_str + ".0"},
            ]}
            pedidos = await db.pedidos_erp.find(query_nota, {"_id": 0}).to_list(10)
        if pedidos:
            for p in pedidos:
                galpao_info = get_galpao_from_serie(p.get('serie_nf', ''), p.get('chave_nota', ''))
                p['galpao'] = galpao_info.get('galpao', '')
                p['uf_galpao'] = galpao_info.get('uf_galpao', '')
            return pedidos
        return []

    if not numero_pedido:
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")

    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    if not pedido:
        return []

    galpao_info = get_galpao_from_serie(pedido.get('serie_nf', ''), pedido.get('chave_nota', ''))
    pedido['galpao'] = galpao_info.get('galpao', '')
    pedido['uf_galpao'] = galpao_info.get('uf_galpao', '')
    return [pedido]


@router.get("/pedidos-erp")
async def list_pedidos_erp(
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"numero_pedido": search_regex},
            {"cpf_cliente": search_regex},
            {"nome_cliente": search_regex},
            {"produto": search_regex}
        ]
    skip = (page - 1) * page_size
    total = await db.pedidos_erp.count_documents(query)
    pedidos = await db.pedidos_erp.find(query, {"_id": 0}).skip(skip).limit(page_size).to_list(page_size)
    return {"total": total, "page": page, "page_size": page_size, "pedidos": pedidos}


# ============== IMPORTAR PEDIDOS ==============

async def process_import_background(content: bytes, filename: str, user_name: str, user_email: str, import_id: str = None):
    import pandas as pd
    from io import BytesIO
    from routes.admin import atualizar_motivos_pendencia_automatico

    try:
        if not import_id:
            import_id = str(uuid.uuid4())[:8]
        await db.import_status.insert_one({
            "import_id": import_id,
            "status": "processing",
            "progress": 0,
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "started_by": user_name
        })

        if filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            excel_file = pd.ExcelFile(BytesIO(content))
            sheet_names = excel_file.sheet_names
            logger.info(f"Abas encontradas: {sheet_names}")

            # Detectar arquivo "outras" (Fornecedores + Estoque, sem Tabelão)
            is_outras = 'Fornecedores' in sheet_names and 'Tabelão' not in sheet_names
            if is_outras:
                logger.info("Arquivo 'outras' detectado — importando Fornecedores e Estoque")
                # Importar Fornecedores
                if 'Fornecedores' in sheet_names:
                    df_forn = pd.read_excel(excel_file, sheet_name='Fornecedores')
                    df_forn.columns = df_forn.columns.str.strip().str.lower()
                    forn_count = 0
                    for _, row in df_forn.iterrows():
                        fornecedor = None
                        for col in ['fornecedor', 'nome', 'nome_fornecedor']:
                            if col in df_forn.columns:
                                fornecedor = str(row.get(col, '')).strip()
                                break
                        dias_extras = 5
                        for col in ['dias extras padrão (dias úteis)', 'dias extras padrão', 'dias extras', 'dias_extras']:
                            if col in df_forn.columns:
                                val = row.get(col)
                                if pd.notna(val):
                                    try: dias_extras = int(val)
                                    except: pass
                                break
                        if fornecedor and fornecedor.lower() not in ('nan', ''):
                            await db.fornecedores.update_one(
                                {"nome": fornecedor},
                                {"$set": {"nome": fornecedor, "dias_extras_padrao": dias_extras, "ultima_atualizacao": datetime.now(timezone.utc).isoformat()}},
                                upsert=True
                            )
                            forn_count += 1
                    logger.info(f"Fornecedores importados: {forn_count}")

                # Importar Estoque SIGEQ425 e SIGEQ230
                async def import_estoque_sheet(df_est, sheet):
                    df_est.columns = df_est.columns.str.strip()
                    imp = upd = 0
                    for _, row in df_est.iterrows():
                        id_item = str(row.get('ID do item', '')).strip()
                        if not id_item or id_item == 'nan': continue
                        if id_item.endswith('.0'): id_item = id_item[:-2]
                        data = {
                            "id_item": id_item,
                            "fornecedor": str(row.get('Nome do fornecedor', '')).strip(),
                            "descricao": str(row.get('Descrição do item', '')).strip(),
                            "codigo_fornecedor": str(row.get('Código fornecedor', '')).strip(),
                            "qt_reserva": int(row.get('Qt. Res', 0)) if pd.notna(row.get('Qt. Res')) else 0,
                            "disp_venda": int(row.get('Disp. Venda', 0)) if pd.notna(row.get('Disp. Venda')) else 0,
                            "qt_arquivo": int(row.get('Qt. Arquivo', 0)) if pd.notna(row.get('Qt. Arquivo')) else 0,
                            "sheet": sheet,
                            "ultima_atualizacao": datetime.now(timezone.utc).isoformat()
                        }
                        existing = await db.estoque_sigeq.find_one({"id_item": id_item})
                        if existing:
                            await db.estoque_sigeq.update_one({"id_item": id_item}, {"$set": data}); upd += 1
                        else:
                            await db.estoque_sigeq.insert_one(data); imp += 1
                    logger.info(f"Estoque {sheet}: {imp} novos, {upd} atualizados")
                    return imp, upd

                est_inserted = est_updated = 0
                sheets_to_process = [s for s in ['SIGEQ425', 'SIGEQ230'] if s in sheet_names]
                for idx_sheet, sheet in enumerate(sheets_to_process):
                    df_est = pd.read_excel(excel_file, sheet_name=sheet)
                    total_est = len(df_est)
                    await db.import_status.update_one(
                        {"import_id": import_id},
                        {"$set": {"total": total_est, "progress": int((idx_sheet / max(len(sheets_to_process), 1)) * 90)}}
                    )
                    i, u = await import_estoque_sheet(df_est, sheet)
                    est_inserted += i; est_updated += u

                await db.import_status.update_one(
                    {"import_id": import_id},
                    {"$set": {"status": "completed", "progress": 100, "inserted": est_inserted, "updated": est_updated, "skipped": 0, "errors": 0, "total": est_inserted + est_updated, "completed_at": datetime.now(timezone.utc).isoformat()}}
                )
                logger.info(f"Import 'outras' concluído: {forn_count} fornecedores, {est_inserted} estoque novos, {est_updated} atualizados")
                return

            # Arquivo normal — ler aba Tabelão ou primeira aba
            if 'Tabelão' in sheet_names:
                df = pd.read_excel(excel_file, sheet_name='Tabelão')
            else:
                df = pd.read_excel(excel_file, sheet_name=0)

            # Importar Fornecedores se existir junto com Tabelão
            if 'Fornecedores' in sheet_names:
                df_forn = pd.read_excel(excel_file, sheet_name='Fornecedores')
                df_forn.columns = df_forn.columns.str.strip().str.lower()
                for _, row in df_forn.iterrows():
                    fornecedor = None
                    for col in ['fornecedor', 'nome', 'nome_fornecedor']:
                        if col in df_forn.columns:
                            fornecedor = str(row.get(col, '')).strip(); break
                    dias_extras = 5
                    for col in ['dias extras padrão (dias úteis)', 'dias extras padrão', 'dias extras', 'dias_extras']:
                        if col in df_forn.columns:
                            val = row.get(col)
                            if pd.notna(val):
                                try: dias_extras = int(val)
                                except: pass
                            break
                    if fornecedor and fornecedor.lower() not in ('nan', ''):
                        await db.fornecedores.update_one(
                            {"nome": fornecedor},
                            {"$set": {"nome": fornecedor, "dias_extras_padrao": dias_extras, "ultima_atualizacao": datetime.now(timezone.utc).isoformat()}},
                            upsert=True
                        )

        total = len(df)
        await db.import_status.update_one(
            {"import_id": import_id},
            {"$set": {"total": total, "total_rows": total}}
        )

        column_mapping = get_column_mapping()
        original_columns = {col.lower().strip(): col for col in df.columns}
        df.columns = [col.lower().strip() for col in df.columns]

        data_limite = datetime(2025, 1, 1, tzinfo=timezone.utc)
        inserted = updated = skipped = errors = 0

        for idx, row in df.iterrows():
            try:
                pedido_data = extract_pedido_data(row, column_mapping, original_columns)
                numero_pedido = pedido_data.get('numero_pedido', '')
                if not numero_pedido or numero_pedido == 'nan' or numero_pedido == '-':
                    skipped += 1
                    continue
                if should_skip_old_pedido(pedido_data, data_limite):
                    skipped += 1
                    continue
                existing = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido})
                if existing:
                    await db.pedidos_erp.update_one(
                        {"numero_pedido": numero_pedido},
                        {"$set": pedido_data}
                    )
                    updated += 1
                else:
                    pedido_data['id'] = str(uuid.uuid4())
                    pedido_data['imported_at'] = datetime.now(timezone.utc).isoformat()
                    pedido_data['imported_by'] = user_name
                    await db.pedidos_erp.insert_one(pedido_data)
                    inserted += 1

                if (idx + 1) % 100 == 0:
                    progress = int(((idx + 1) / total) * 100)
                    await db.import_status.update_one(
                        {"import_id": import_id},
                        {"$set": {"progress": progress, "processed": idx + 1, "inserted": inserted, "updated": updated, "skipped": skipped, "errors": errors}}
                    )
            except Exception as e:
                errors += 1
                logger.error(f"Error importing row {idx}: {e}")

        try:
            await atualizar_motivos_pendencia_automatico()
        except Exception as e:
            logger.error(f"Erro na atualização automática de motivos: {e}")

        await db.import_status.update_one(
            {"import_id": import_id},
            {"$set": {
                "status": "completed",
                "progress": 100,
                "inserted": inserted,
                "updated": updated,
                "skipped": skipped,
                "errors": errors,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        # Notificar admin
        try:
            admin = await db.users.find_one({"email": "adneia@weconnect360.com.br"}, {"_id": 0})
            if admin:
                notif = {
                    "id": str(uuid.uuid4()),
                    "tipo": "import_concluida",
                    "titulo": "Importação de Pedidos Concluída",
                    "mensagem": f"A importação iniciada por {user_name} foi concluída. {inserted} novos, {updated} atualizados, {skipped} ignorados, {errors} erros.",
                    "destinatario_email": admin['email'],
                    "dados_extras": {"import_id": import_id, "inserted": inserted, "updated": updated, "skipped": skipped, "errors": errors},
                    "data_criacao": datetime.now(timezone.utc).isoformat(),
                    "lida": False,
                    "criado_por_nome": "Sistema"
                }
                await db.notifications.insert_one(notif)
        except Exception as e:
            logger.error(f"Erro ao criar notificação: {e}")

        logger.info(f"Import completed: {inserted} inserted, {updated} updated, {skipped} skipped, {errors} errors")

    except Exception as e:
        logger.error(f"Import error: {e}")
        import traceback
        logger.error(traceback.format_exc())


@router.post("/pedidos-erp/import", response_model=dict)
async def import_pedidos(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Formato de arquivo inválido. Use .xlsx, .xls ou .csv")
    content = await file.read()

    # Pré-calcular total de linhas e gerar import_id
    import_id = str(uuid.uuid4())[:8]
    total_rows = 0
    try:
        from io import BytesIO
        import pandas as pd
        if file.filename.endswith('.csv'):
            # Para CSV, contar linhas rápido sem ler todo o conteúdo
            total_rows = content.count(b'\n')
        else:
            # Para Excel, ler apenas header para estimar (openpyxl read_only)
            try:
                import openpyxl
                wb = openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)
                ws = wb.active
                total_rows = ws.max_row - 1 if ws.max_row else 0  # -1 para header
                wb.close()
            except Exception:
                total_rows = 0  # Se falhar, será calculado na task
    except Exception as e:
        logger.error(f"Erro ao pré-calcular linhas: {e}")
        total_rows = 0

    background_tasks.add_task(process_import_background, content, file.filename, current_user['name'], current_user['email'], import_id)
    return {
        "message": "Importação iniciada em background",
        "status": "processing",
        "import_id": import_id,
        "total_rows": total_rows
    }


# ============== ESTOQUE ==============

@router.get("/estoque")
async def get_estoque(
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"id_item": search_regex},
            {"descricao": search_regex},
            {"nome": search_regex}
        ]
    skip = (page - 1) * page_size
    total = await db.estoque_sigeq.count_documents(query)
    items = await db.estoque_sigeq.find(query, {"_id": 0}).skip(skip).limit(page_size).to_list(page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/estoque/{item_id}")
async def get_estoque_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.estoque_sigeq.find_one({"id_item": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado no estoque")
    return item


# ============== FORNECEDORES ==============

@router.get("/fornecedores")
async def list_fornecedores(current_user: dict = Depends(get_current_user)):
    return await db.fornecedores.find({}, {"_id": 0}).sort("nome", 1).to_list(100)


@router.post("/fornecedores")
async def create_fornecedor(data: dict, current_user: dict = Depends(get_current_user)):
    data['id'] = str(uuid.uuid4())
    data['criado_por'] = current_user['name']
    data['criado_em'] = datetime.now(timezone.utc).isoformat()
    await db.fornecedores.insert_one(data)
    return {"message": "Fornecedor criado com sucesso", "id": data['id']}


@router.put("/fornecedores/{fornecedor_id}")
async def update_fornecedor(fornecedor_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    result = await db.fornecedores.update_one({"id": fornecedor_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return {"message": "Fornecedor atualizado com sucesso"}


# ============== IMPORT ESTOQUE/FORNECEDORES SHEETS ==============

@router.post("/admin/sync-fornecedores")
async def sync_fornecedores(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        dados = sheets_client.get_fornecedores_data()
        if not dados:
            return {"success": False, "message": "Nenhum dado encontrado na planilha"}
        inserted = updated = 0
        for item in dados:
            nome = item.get('nome', '').strip()
            if not nome:
                continue
            existing = await db.fornecedores.find_one({"nome": nome})
            if existing:
                await db.fornecedores.update_one({"nome": nome}, {"$set": item})
                updated += 1
            else:
                item['id'] = str(uuid.uuid4())
                await db.fornecedores.insert_one(item)
                inserted += 1
        return {"success": True, "message": f"Fornecedores sincronizados: {inserted} novos, {updated} atualizados"}
    except Exception as e:
        logger.error(f"Erro ao sincronizar fornecedores: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/sync-transportadoras-devolucoes")
async def sync_transportadoras_devolucoes(current_user: dict = Depends(get_current_user)):
    try:
        from google_sheets import sheets_client
        dados = sheets_client.get_transportadoras_devolucoes_data()
        if not dados:
            return {"success": False, "message": "Nenhum dado encontrado"}
        inserted = 0
        for item in dados:
            existing = await db.transportadoras_devolucoes.find_one({"codigo": item.get('codigo')})
            if not existing:
                item['id'] = str(uuid.uuid4())
                await db.transportadoras_devolucoes.insert_one(item)
                inserted += 1
        return {"success": True, "message": f"{inserted} transportadoras importadas"}
    except Exception as e:
        logger.error(f"Erro: {e}")
        return {"success": False, "message": str(e)}
