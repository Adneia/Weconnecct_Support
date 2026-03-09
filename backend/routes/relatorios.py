"""
Rotas de Relatórios - Ag. Compras e Ag. Logística
"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import calcular_dias_uteis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/relatorios", tags=["relatorios"])


class RelatorioFiltros(BaseModel):
    fornecedor: Optional[str] = None
    canal: Optional[str] = None
    status: Optional[str] = None


@router.get("/ag-compras")
async def get_relatorio_ag_compras(current_user: dict = Depends(get_current_user)):
    """
    Relatório de chamados para Ag. Compras
    Filtros:
    - Status "Aguardando Estoque" há mais de X dias úteis (baseado no fornecedor)
    - OU status "Pedido Aprovado" (sempre entra)
    """
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Compras", "pendente": True},
        {"_id": 0}
    ).to_list(5000)
    
    # Carregar tabela de fornecedores com dias extras
    fornecedores_dict = {}
    fornecedores = await db.fornecedores.find({}, {"_id": 0}).to_list(100)
    for f in fornecedores:
        fornecedores_dict[f.get('nome', '').lower()] = f.get('dias_extras_padrao', 5)
    
    resultado = []
    for chamado in chamados:
        pedido = await db.pedidos_erp.find_one(
            {"numero_pedido": chamado.get('numero_pedido')},
            {"_id": 0}
        )
        
        if not pedido:
            continue
        
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        fornecedor = pedido.get('departamento', '')
        
        incluir = False
        
        # Regra 1: Pedido Aprovado sempre entra
        if 'pedido aprovado' in status_pedido:
            incluir = True
        
        # Regra 2: Aguardando Estoque com dias extras do fornecedor
        elif 'aguardando estoque' in status_pedido:
            dias_extras = fornecedores_dict.get(fornecedor.lower(), 5)
            dias_em_estoque = calcular_dias_uteis(data_status)
            if dias_em_estoque >= dias_extras:
                incluir = True
        
        if not incluir:
            continue
        
        # Determinar status do atendimento
        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"
        
        # Buscar estoque disponível
        codigo_item = pedido.get('codigo_item_bseller', '')
        estoque_disponivel = None
        if codigo_item:
            if str(codigo_item).endswith('.0'):
                codigo_item = str(codigo_item)[:-2]
            estoque = await db.estoque_sigeq.find_one({"id_item": str(codigo_item)}, {"_id": 0})
            if estoque:
                estoque_disponivel = estoque.get('disp_venda', 0)
        
        item = {
            "fornecedor": fornecedor,
            "produto": pedido.get('produto', '') or chamado.get('produto', ''),
            "id_produto": pedido.get('codigo_item_bseller', ''),
            "sku": pedido.get('codigo_item_vtex', ''),
            "quantidade": pedido.get('quantidade', ''),
            "codigo_fornecedor": pedido.get('codigo_fornecedor', ''),
            "entrega": chamado.get('numero_pedido', ''),
            "parceiro_canal": pedido.get('canal_vendas', ''),
            "cidade": pedido.get('cidade', ''),
            "uf": pedido.get('uf', ''),
            "estoque_disponivel": estoque_disponivel,
            "status_atendimento": status_atendimento,
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status
        }
        resultado.append(item)
    
    return resultado


@router.get("/ag-logistica")
async def get_relatorio_ag_logistica(current_user: dict = Depends(get_current_user)):
    """
    Relatório de chamados para Ag. Logística
    Filtros:
    - Status: "Entregue a transportadora", "Nota fiscal emitida", "Nota fiscal aprovada", 
      ou "Separado" há mais de 2 dias úteis
    - OU status "Pedido Aprovado" (sempre entra)
    """
    STATUS_LOGISTICA = [
        'entregue a transportadora',
        'nota fiscal emitida',
        'nota fiscal aprovada',
        'separado'
    ]
    
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Logística", "pendente": True},
        {"_id": 0}
    ).to_list(5000)
    
    resultado = []
    for chamado in chamados:
        pedido = await db.pedidos_erp.find_one(
            {"numero_pedido": chamado.get('numero_pedido')},
            {"_id": 0}
        )
        
        if not pedido:
            continue
        
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        
        incluir = False
        
        # Regra 1: Pedido Aprovado sempre entra
        if 'pedido aprovado' in status_pedido:
            incluir = True
        
        # Regra 2: Status específicos há mais de 2 dias úteis
        else:
            for status_valido in STATUS_LOGISTICA:
                if status_valido in status_pedido:
                    dias_no_status = calcular_dias_uteis(data_status)
                    if dias_no_status >= 2:
                        incluir = True
                        break
        
        if not incluir:
            continue
        
        # Determinar status do atendimento
        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"
        
        # Formatar nota fiscal (remover .0)
        nota = pedido.get('nota_fiscal', '')
        if nota:
            nota = str(nota).replace('.0', '')
        
        item = {
            "entrega": chamado.get('numero_pedido', ''),
            "nota": nota,
            "galpao": pedido.get('filial', ''),
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status,
            "status_atendimento": status_atendimento
        }
        resultado.append(item)
    
    return resultado


@router.post("/ag-logistica")
async def post_relatorio_ag_logistica(
    filtros: RelatorioFiltros = None,
    current_user: dict = Depends(get_current_user)
):
    """POST para relatório de Ag. Logística (compatibilidade)"""
    return await get_relatorio_ag_logistica(current_user)


@router.post("/ag-compras")
async def post_relatorio_ag_compras(
    filtros: RelatorioFiltros = None,
    current_user: dict = Depends(get_current_user)
):
    """POST para relatório de Ag. Compras (compatibilidade)"""
    return await get_relatorio_ag_compras(current_user)
