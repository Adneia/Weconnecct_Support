"""
Rotas de Pedidos ERP - Busca e importação
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
import io
import uuid
import pandas as pd

from models.pedido import PedidoERPBase
from utils.database import db
from utils.auth import get_current_user
from utils.helpers import get_galpao_from_serie, calcular_dias_uteis, is_status_maiusculo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pedidos-erp", tags=["pedidos"])


async def add_estoque_info(pedido: dict) -> dict:
    """Adiciona informações de estoque ao pedido"""
    codigo_item = pedido.get('codigo_item_bseller', '')
    if codigo_item:
        if str(codigo_item).endswith('.0'):
            codigo_item = str(codigo_item)[:-2]
        estoque = await db.estoque_sigeq.find_one({"id_item": str(codigo_item)}, {"_id": 0})
        if estoque:
            pedido['estoque_disponivel'] = estoque.get('disp_venda', 0)
            pedido['estoque_reserva'] = estoque.get('qt_reserva', 0)
        else:
            pedido['estoque_disponivel'] = None
            pedido['estoque_reserva'] = None
    return pedido


@router.get("/buscar/cpf/{cpf}")
async def get_pedidos_by_cpf(cpf: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por CPF"""
    cpf_limpo = cpf.replace('.', '').replace('-', '').replace(' ', '')
    cpf_sem_zeros = cpf_limpo.lstrip('0')
    
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"cpf_cliente": {"$regex": f"^{cpf_limpo}$"}},
            {"cpf_cliente": {"$regex": f"^{cpf_sem_zeros}$"}},
            {"cpf_cliente": {"$regex": cpf_limpo}},
            {"cpf_cliente": {"$regex": cpf_sem_zeros}}
        ]},
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
        await add_estoque_info(p)
    
    return pedidos


@router.get("/buscar/nome/{nome}", response_model=List[dict])
async def get_pedidos_by_nome(nome: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por nome do cliente"""
    pedidos = await db.pedidos_erp.find(
        {"nome_cliente": {"$regex": nome, "$options": "i"}},
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
        await add_estoque_info(p)
    
    return pedidos


@router.get("/buscar/pedido/{pedido}", response_model=List[dict])
async def get_pedidos_by_pedido(pedido: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por número"""
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"numero_pedido": {"$regex": pedido, "$options": "i"}},
            {"pedido_cliente": {"$regex": pedido, "$options": "i"}},
            {"pedido_externo": {"$regex": pedido, "$options": "i"}}
        ]},
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
        await add_estoque_info(p)
    
    return pedidos


@router.get("/buscar/nota/{nota}", response_model=List[dict])
async def get_pedidos_by_nota(nota: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por nota fiscal"""
    nota_limpa = nota.replace('.', '').replace('-', '').replace(' ', '').strip()
    
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"nota_fiscal": {"$regex": nota_limpa, "$options": "i"}},
            {"nota_fiscal": nota_limpa},
            {"nota_fiscal": nota}
        ]},
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
        await add_estoque_info(p)
    
    return pedidos


@router.get("/buscar/galpao/{galpao}/nota/{nota}", response_model=List[dict])
async def get_pedidos_by_galpao_nota(galpao: str, nota: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por galpão e nota fiscal"""
    nota_limpa = nota.replace('.', '').replace('-', '').replace(' ', '').strip()
    galpao_upper = galpao.upper()
    
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"nota_fiscal": {"$regex": nota_limpa, "$options": "i"}},
            {"nota_fiscal": nota_limpa},
            {"nota_fiscal": nota}
        ]},
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    resultado = []
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
        
        uf_galpao = p.get('uf_galpao', '').upper()
        filial = p.get('filial', '').upper()
        
        if uf_galpao == galpao_upper or filial == galpao_upper:
            await add_estoque_info(p)
            resultado.append(p)
    
    return resultado


@router.get("/{numero_pedido}", response_model=dict)
async def get_pedido_erp(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """Obter detalhes de um pedido específico"""
    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    galpao_info = get_galpao_from_serie(pedido.get('serie_nf'), pedido.get('chave_nota'))
    pedido.update(galpao_info)
    await add_estoque_info(pedido)
    
    return pedido


@router.get("", response_model=List[dict])
async def list_pedidos_erp(current_user: dict = Depends(get_current_user)):
    """Listar todos os pedidos (limitado a 1000)"""
    pedidos = await db.pedidos_erp.find({}, {"_id": 0}).to_list(1000)
    return pedidos


@router.get("/import-status/{import_id}")
async def get_import_status(import_id: str, current_user: dict = Depends(get_current_user)):
    """Verificar status de uma importação em andamento"""
    job = await db.import_jobs.find_one({"import_id": import_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return job


def get_column_mapping():
    """Mapeamento de colunas para importação"""
    return {
        'numero_pedido': ['entrega'],
        'canal_vendas': ['nome canal de vendas'],
        'pedido_cliente': ['ped. cliente'],
        'pedido_externo': ['ped. externo'],
        'cpf_cliente': ['cpf'],
        'nome_cliente': ['nome'],
        'cep': ['cep'],
        'cidade': ['cidade'],
        'uf': ['uf'],
        'fone_cliente': ['fone'],
        'email_cliente': ['e-mail'],
        'status_pedido': ['status da entrega', 'status'],
        'data_status': ['dt.ult.ponto de controle'],
        'transportadora': ['transportadora'],
        'departamento': ['nome_5'],
        'codigo_item_bseller': ['item'],
        'produto': ['nome do produto'],
        'codigo_item_vtex': ['c?d. terceiro', 'cód. terceiro'],
        'quantidade': ['qtde pedido'],
        'preco_final': ['pre?o final', 'preço final'],
        'frete': ['frete'],
        'filial': ['uf.1'],
        'nota_fiscal': ['nota'],
        'serie_nf': ['série', 'serie'],
        'chave_nota': ['chave acesso'],
        'pedido_troca': ['pedido troca'],
        'codigo_fornecedor': ['cód. fornecedor', 'cód. fornecedor do sigeq230', 'codigo_fornecedor'],
    }


def extract_pedido_data(row, column_mapping, original_columns):
    """Extrai dados do pedido de uma linha do DataFrame"""
    pedido_data = {}
    for field, possible_names in column_mapping.items():
        for name in possible_names:
            name_lower = name.lower()
            if name_lower in original_columns:
                value = row.get(name_lower)
                if pd.notna(value):
                    pedido_data[field] = str(value).strip()
                break
    return pedido_data


def should_skip_old_pedido(pedido_data, data_limite):
    """Verifica se o pedido deve ser ignorado por ser muito antigo"""
    if 'data_status' in pedido_data and pedido_data['data_status']:
        try:
            data_str = pedido_data['data_status'].split()[0]
            data_pedido = datetime.strptime(data_str, '%d/%m/%Y')
            data_pedido = data_pedido.replace(tzinfo=timezone.utc)
            return data_pedido < data_limite
        except (ValueError, IndexError):
            pass
    return False


async def import_fornecedores(df):
    """Importa tabela de fornecedores com dias extras padrão"""
    try:
        df.columns = df.columns.str.strip().str.lower()
        
        for idx, row in df.iterrows():
            fornecedor = None
            dias_extras = 5
            
            for col in ['fornecedor', 'nome', 'nome_fornecedor']:
                if col in df.columns:
                    fornecedor = str(row.get(col, '')).strip()
                    break
            
            for col in ['dias extras padrão (dias úteis)', 'dias extras padrão', 'dias extras', 'dias_extras']:
                if col in df.columns:
                    val = row.get(col)
                    if pd.notna(val):
                        dias_extras = int(val)
                    break
            
            if fornecedor and fornecedor.lower() != 'nan':
                await db.fornecedores.update_one(
                    {"nome": fornecedor},
                    {"$set": {
                        "nome": fornecedor,
                        "dias_extras_padrao": dias_extras,
                        "ultima_atualizacao": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
        
        logger.info("Fornecedores importados com sucesso")
    except Exception as e:
        logger.error(f"Erro ao importar fornecedores: {e}")


async def import_estoque_sigeq(df):
    """Importa dados de estoque da aba SIGEQ425"""
    try:
        df.columns = df.columns.str.strip()
        imported = 0
        updated = 0
        
        for idx, row in df.iterrows():
            try:
                id_item = str(row.get('ID do item', '')).strip()
                if not id_item or id_item == 'nan':
                    continue
                
                if id_item.endswith('.0'):
                    id_item = id_item[:-2]
                
                estoque_data = {
                    "id_item": id_item,
                    "fornecedor": str(row.get('Nome do fornecedor', '')).strip(),
                    "descricao": str(row.get('Descrição do item', '')).strip(),
                    "codigo_fornecedor": str(row.get('Código fornecedor', '')).strip(),
                    "qt_reserva": int(row.get('Qt. Res', 0)) if pd.notna(row.get('Qt. Res')) else 0,
                    "disp_venda": int(row.get('Disp. Venda', 0)) if pd.notna(row.get('Disp. Venda')) else 0,
                    "qt_arquivo": int(row.get('Qt. Arquivo', 0)) if pd.notna(row.get('Qt. Arquivo')) else 0,
                    "ultima_atualizacao": datetime.now(timezone.utc).isoformat()
                }
                
                existing = await db.estoque_sigeq.find_one({"id_item": id_item})
                if existing:
                    await db.estoque_sigeq.update_one({"id_item": id_item}, {"$set": estoque_data})
                    updated += 1
                else:
                    await db.estoque_sigeq.insert_one(estoque_data)
                    imported += 1
                    
            except Exception as e:
                logger.error(f"Erro ao processar estoque linha {idx}: {e}")
                continue
        
        logger.info(f"Estoque SIGEQ importado: {imported} novos, {updated} atualizados")
    except Exception as e:
        logger.error(f"Erro ao importar estoque SIGEQ: {e}")


async def process_import_sync(df):
    """Processa importação de forma síncrona para arquivos pequenos"""
    column_mapping = get_column_mapping()
    df.columns = df.columns.str.strip().str.lower()
    original_columns = list(df.columns)
    data_limite = datetime.now(timezone.utc) - timedelta(days=180)
    
    imported = 0
    updated = 0
    errors = 0
    skipped_old = 0
    
    for idx, row in df.iterrows():
        try:
            pedido_data = extract_pedido_data(row, column_mapping, original_columns)
            
            if not pedido_data.get('numero_pedido'):
                continue
            
            if should_skip_old_pedido(pedido_data, data_limite):
                skipped_old += 1
                continue
            
            existing = await db.pedidos_erp.find_one({"numero_pedido": pedido_data['numero_pedido']})
            
            if existing:
                pedido_data['ultima_atualizacao'] = datetime.now(timezone.utc).isoformat()
                await db.pedidos_erp.update_one(
                    {"numero_pedido": pedido_data['numero_pedido']},
                    {"$set": pedido_data}
                )
                updated += 1
            else:
                pedido = PedidoERPBase(**pedido_data)
                pedido_dict = pedido.model_dump()
                pedido_dict['ultima_atualizacao'] = pedido_dict['ultima_atualizacao'].isoformat()
                await db.pedidos_erp.insert_one(pedido_dict)
                imported += 1
        except Exception as e:
            logger.error(f"Erro na linha {idx}: {str(e)}")
            errors += 1
            continue
    
    return {
        "message": f"Importação concluída: {imported} novos, {updated} atualizados, {skipped_old} ignorados (>6 meses), {errors} erros",
        "imported": imported,
        "updated": updated,
        "skipped_old": skipped_old,
        "errors": errors
    }


@router.post("/import", response_model=dict)
async def import_pedidos(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Importar pedidos de arquivo Excel ou CSV"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo não fornecido")
    
    filename = file.filename.lower()
    
    try:
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        logger.info(f"Arquivo recebido: {filename}, tamanho: {file_size_mb:.2f} MB")
    except Exception as e:
        logger.error(f"Erro ao ler arquivo: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            excel_file = pd.ExcelFile(io.BytesIO(content))
            sheet_names = excel_file.sheet_names
            logger.info(f"Abas encontradas: {sheet_names}")
            
            if 'Tabelão' in sheet_names:
                df = pd.read_excel(excel_file, sheet_name='Tabelão')
            else:
                df = pd.read_excel(excel_file, sheet_name=0)
            
            if 'Fornecedores' in sheet_names:
                df_fornecedores = pd.read_excel(excel_file, sheet_name='Fornecedores')
                logger.info(f"Aba Fornecedores encontrada: {len(df_fornecedores)} registros")
                await import_fornecedores(df_fornecedores)
            
            if 'SIGEQ425' in sheet_names:
                df_sigeq = pd.read_excel(excel_file, sheet_name='SIGEQ425')
                logger.info(f"Aba SIGEQ425 encontrada: {len(df_sigeq)} registros de estoque")
                await import_estoque_sigeq(df_sigeq)
        else:
            raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use CSV ou Excel.")
        
        total_rows = len(df)
        logger.info(f"Arquivo parseado com sucesso: {total_rows} linhas")
        
        # Para arquivos pequenos, processar imediatamente
        result = await process_import_sync(df)
        return result
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")
