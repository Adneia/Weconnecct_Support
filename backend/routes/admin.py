from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import calcular_dias_uteis, is_status_maiusculo

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.post("/admin/atualizar-motivos")
async def admin_atualizar_motivos(current_user: dict = Depends(get_current_user)):
    await atualizar_motivos_pendencia_automatico()
    return {"success": True, "message": "Motivos de pendência atualizados"}


@router.post("/admin/padronizar-parceiros")
async def padronizar_parceiros_endpoint(current_user: dict = Depends(get_current_user)):
    try:
        padronizacao = {"nicequest": "NiceQuest"}
        total_atualizado = 0
        for nome_errado, nome_correto in padronizacao.items():
            result1 = await db.chamados.update_many(
                {"parceiro": {"$regex": f"^{nome_errado}$", "$options": "i"}},
                {"$set": {"parceiro": nome_correto}}
            )
            result2 = await db.chamados.update_many(
                {"canal_vendas": {"$regex": f"^{nome_errado}$", "$options": "i"}},
                {"$set": {"canal_vendas": nome_correto}}
            )
            total_atualizado += result1.modified_count + result2.modified_count
        return {"success": True, "message": f"Parceiros padronizados: {total_atualizado} registros atualizados"}
    except Exception as e:
        logger.error(f"Erro ao padronizar parceiros: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/padronizar-transportadoras")
async def padronizar_transportadoras_endpoint(current_user: dict = Depends(get_current_user)):
    try:
        padronizacoes = [
            {"regex": "Ag.*Transportadora.*Asap", "novo": "Ag. Transportadora - Asap"},
            {"regex": "Ag.*transportadora.*asap", "novo": "Ag. Transportadora - Asap"},
            {"regex": "Ag.*Transportadora.*J&T", "novo": "Ag. Transportadora - J&T"},
            {"regex": "Ag.*transportadora.*J&T", "novo": "Ag. Transportadora - J&T"},
            {"regex": "Ag.*transportadora.*j&t", "novo": "Ag. Transportadora - J&T"},
            {"regex": "Aguardando.*Transportadora.*J&T", "novo": "Ag. Transportadora - J&T"},
            {"regex": "Ag.*Transportadora.*Total", "novo": "Ag. Transportadora - Total"},
            {"regex": "Ag.*transportadora.*Total", "novo": "Ag. Transportadora - Total"},
            {"regex": "Ag.*Parceiro.*transportadora.*Total", "novo": "Ag. Transportadora - Total"},
            {"regex": "^Ag\\. Transportadora$", "novo": "Ag. Transportadora - (verificar)"},
        ]
        total_atualizado = 0
        detalhes = []
        for p in padronizacoes:
            result = await db.chamados.update_many(
                {"motivo_pendencia": {"$regex": p["regex"], "$options": "i"}},
                {"$set": {"motivo_pendencia": p["novo"]}}
            )
            if result.modified_count > 0:
                total_atualizado += result.modified_count
                detalhes.append(f"{p['novo']}: {result.modified_count}")
        return {"success": True, "message": f"Transportadoras padronizadas: {total_atualizado} registros", "detalhes": detalhes}
    except Exception as e:
        logger.error(f"Erro ao padronizar transportadoras: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/identificar-transportadoras")
async def identificar_transportadoras_endpoint(current_user: dict = Depends(get_current_user)):
    try:
        MAPA_TRANSPORTADORAS = {
            "tex courier": "Ag. Transportadora - Total",
            "total express": "Ag. Transportadora - Total",
            "j&t express": "Ag. Transportadora - J&T",
            "j&t": "Ag. Transportadora - J&T",
            "asap log": "Ag. Transportadora - Asap",
            "asap": "Ag. Transportadora - Asap",
        }
        chamados = await db.chamados.find(
            {"motivo_pendencia": "Ag. Transportadora - (verificar)"},
            {"_id": 0, "numero_pedido": 1, "id": 1}
        ).to_list(500)
        stats = {"total": len(chamados), "atualizados": 0, "nao_encontrados": 0, "sem_transportadora": 0, "detalhes": []}
        for chamado in chamados:
            numero_pedido = chamado.get('numero_pedido')
            if not numero_pedido:
                continue
            pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0, "transportadora": 1})
            if not pedido:
                stats["nao_encontrados"] += 1
                continue
            transportadora = pedido.get('transportadora', '') or ''
            if not transportadora:
                stats["sem_transportadora"] += 1
                continue
            novo_motivo = None
            for chave, motivo in MAPA_TRANSPORTADORAS.items():
                if chave in transportadora.lower():
                    novo_motivo = motivo
                    break
            if novo_motivo:
                await db.chamados.update_one({"numero_pedido": numero_pedido}, {"$set": {"motivo_pendencia": novo_motivo}})
                stats["atualizados"] += 1
        return {"success": True, "message": f"Identificação concluída: {stats['atualizados']} atualizados", "stats": stats}
    except Exception as e:
        logger.error(f"Erro ao identificar transportadoras: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/corrigir-carga-inicial")
async def corrigir_carga_inicial(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    import pandas as pd
    from io import BytesIO
    try:
        content = await file.read()
        df = pd.read_excel(BytesIO(content))
        STATUS_INCORRETOS = [
            "Entregue", "ENtregue", "Estornado", "Enviado", "Ag. Logística", "Ag. logística",
            "Encerrado", "Ag. Parceiro", "Atendido", "Em devolução", "Aguardando",
            "Ag. Compras", "Ag. Barrar", "Ag. Transportadora Asap", "Ag. Transportadora J&T",
            "Ag. transportadora Total", "Ag. Transportadora Total", "Ag. Bseller",
            "Ag. Cliente", "Ag. encerramento", "Ag. acareação", "Reenviado", "Devolvido"
        ]
        stats = {"cliente_corrigido": 0, "motivo_atualizado": 0, "dt_encerramento": 0,
                 "nota_fiscal": 0, "chave_acesso": 0, "filial": 0, "tempo_dias": 0,
                 "nao_encontrados": 0, "ignorados_interacao_manual": 0, "erros": []}
        for _, row in df.iterrows():
            try:
                numero_pedido = str(row.get('Entrega', '')).strip()
                if not numero_pedido or numero_pedido == 'nan' or numero_pedido == '-':
                    continue
                chamado = await db.chamados.find_one({"numero_pedido": numero_pedido})
                if not chamado:
                    stats["nao_encontrados"] += 1
                    continue
                tem_anotacoes = bool(chamado.get('anotacoes', '').strip())
                update_data = {}
                nome_correto = str(row.get('Nome', '')).strip() if pd.notna(row.get('Nome')) else ''
                cliente_atual = chamado.get('nome_cliente', '')
                cliente_eh_status = any(status.lower() in str(cliente_atual).lower() for status in STATUS_INCORRETOS)
                if cliente_eh_status and not tem_anotacoes and nome_correto and nome_correto != 'nan':
                    update_data['nome_cliente'] = nome_correto
                    stats["cliente_corrigido"] += 1
                    motivo_atual = chamado.get('motivo_pendencia', '')
                    if not motivo_atual and cliente_atual:
                        update_data['motivo_pendencia'] = cliente_atual.split('\n')[0].strip()
                        stats["motivo_atualizado"] += 1
                elif cliente_eh_status and tem_anotacoes:
                    stats["ignorados_interacao_manual"] += 1
                if not chamado.get('data_encerramento') and pd.notna(row.get('DT Encerramento')):
                    dt_enc = row.get('DT Encerramento')
                    update_data['data_encerramento'] = dt_enc.strftime('%Y-%m-%d') if hasattr(dt_enc, 'strftime') else str(dt_enc)
                    stats["dt_encerramento"] += 1
                if not chamado.get('nota_fiscal') and pd.notna(row.get('Nota')):
                    try:
                        update_data['nota_fiscal'] = str(int(row.get('Nota')))
                        stats["nota_fiscal"] += 1
                    except Exception:
                        pass
                if not chamado.get('chave_acesso') and pd.notna(row.get('chave de acesso')):
                    update_data['chave_acesso'] = str(row.get('chave de acesso'))
                    stats["chave_acesso"] += 1
                if not chamado.get('filial') and pd.notna(row.get('Filial')):
                    update_data['filial'] = str(row.get('Filial'))
                    stats["filial"] += 1
                if not chamado.get('tempo_dias') and pd.notna(row.get('Tempo médio')):
                    try:
                        update_data['tempo_dias'] = int(row.get('Tempo médio'))
                        stats["tempo_dias"] += 1
                    except Exception:
                        pass
                if update_data:
                    await db.chamados.update_one({"numero_pedido": numero_pedido}, {"$set": update_data})
            except Exception as row_error:
                stats["erros"].append(f"Erro no pedido {numero_pedido}: {str(row_error)}")
        return {"success": True, "message": "Correção de carga concluída", "stats": stats}
    except Exception as e:
        logger.error(f"Erro na correção de carga: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/sincronizar-correcoes-sheets")
async def sincronizar_correcoes_sheets(batch_size: int = 50, current_user: dict = Depends(get_current_user)):
    import asyncio
    try:
        from google_sheets import sheets_client, ATENDIMENTO_COLUMNS
        try:
            worksheet = sheets_client._get_atendimentos_worksheet()
            if worksheet:
                sheets_client._ensure_headers(worksheet, ATENDIMENTO_COLUMNS)
        except Exception as header_error:
            logger.warning(f"Não foi possível atualizar headers: {header_error}")
        chamados = await db.chamados.find({
            "$or": [
                {"data_encerramento": {"$exists": True, "$ne": ""}},
                {"chave_acesso": {"$exists": True, "$ne": ""}},
                {"tempo_dias": {"$exists": True, "$ne": None}},
                {"nota_fiscal": {"$exists": True, "$ne": ""}},
                {"filial": {"$exists": True, "$ne": ""}}
            ]
        }, {"_id": 0}).to_list(5000)
        atualizados = erros = nao_encontrados = processados = 0
        chamados_batch = chamados[:batch_size]
        for chamado in chamados_batch:
            try:
                numero_pedido = chamado.get('numero_pedido')
                if not numero_pedido:
                    continue
                updates = {}
                for key in ['data_encerramento', 'chave_acesso', 'tempo_dias', 'nota_fiscal', 'filial']:
                    if chamado.get(key):
                        updates[key] = chamado[key]
                if updates:
                    resultado = sheets_client.update_atendimento(numero_pedido, updates)
                    if resultado:
                        atualizados += 1
                    else:
                        nao_encontrados += 1
                    processados += 1
                    await asyncio.sleep(1.2)
            except Exception as e:
                erros += 1
                logger.error(f"Erro ao sincronizar {chamado.get('numero_pedido')}: {e}")
        restantes = max(len(chamados) - batch_size, 0)
        return {
            "success": True,
            "message": f"Sincronização concluída: {atualizados} atualizados, {nao_encontrados} não encontrados, {erros} erros. Restantes: {restantes}",
            "stats": {"atualizados": atualizados, "nao_encontrados": nao_encontrados, "erros": erros, "processados": processados, "total": len(chamados), "restantes": restantes}
        }
    except Exception as e:
        logger.error(f"Erro na sincronização: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/corrigir-motivo-resolvidos")
async def corrigir_motivo_resolvidos(current_user: dict = Depends(get_current_user)):
    try:
        resultado = await db.chamados.update_many(
            {"pendente": False, "motivo_pendencia": {"$regex": "Transportadora", "$options": "i"}},
            {"$set": {"motivo_pendencia": "Entregue"}}
        )
        return {"success": True, "message": f"Corrigidos {resultado.modified_count} atendimentos resolvidos"}
    except Exception as e:
        logger.error(f"Erro ao corrigir motivos: {e}")
        return {"success": False, "message": str(e)}


@router.post("/admin/padronizar-motivos-inconsistentes")
async def padronizar_motivos_inconsistentes(current_user: dict = Depends(get_current_user)):
    try:
        padronizacoes = [
            {"de": "Ag. logística", "para": "Ag. Logística"},
            {"de": "ENtregue", "para": "Entregue"},
        ]
        total = 0
        for p in padronizacoes:
            result = await db.chamados.update_many(
                {"motivo_pendencia": p["de"]}, {"$set": {"motivo_pendencia": p["para"]}}
            )
            total += result.modified_count
        return {"success": True, "message": f"Padronizados {total} registros"}
    except Exception as e:
        logger.error(f"Erro: {e}")
        return {"success": False, "message": str(e)}


async def atualizar_motivos_pendencia_automatico():
    logger.info("Iniciando atualização automática de motivos de pendência...")
    atualizacoes = {"compras_para_logistica": 0, "logistica_para_enviado": 0,
                    "enviado_para_entregue": 0, "enviado_para_ag_transportadora": 0}
    MOTIVOS_FINALIZADORES = ["Em devolução", "Devolvido", "Estornado", "Reenviado", "Aguardando Devolução", "Encerrado"]
    chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)
    for chamado in chamados:
        numero_pedido = chamado.get('numero_pedido')
        motivo_atual = chamado.get('motivo_pendencia', '')
        if not numero_pedido:
            continue
        if motivo_atual in MOTIVOS_FINALIZADORES:
            continue
        pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
        if not pedido:
            continue
        status_pedido = pedido.get('status_pedido', '')
        data_status = pedido.get('data_status', '')
        novo_motivo = None
        if motivo_atual == 'Ag. Compras':
            status_lower = status_pedido.lower() if status_pedido else ''
            if status_pedido and (status_lower != 'aguardando estoque' or
                                  'entregue' in status_lower and 'transportadora' in status_lower):
                novo_motivo = 'Ag. Logística'
                atualizacoes['compras_para_logistica'] += 1
        elif motivo_atual == 'Ag. Logística':
            status_lower = status_pedido.lower() if status_pedido else ''
            is_entregue_transportadora = 'entregue' in status_lower and 'transportadora' in status_lower
            if is_status_maiusculo(status_pedido) or (status_pedido and not is_entregue_transportadora and status_lower not in ['aguardando estoque', 'nf emitida', 'nf aprovada']):
                novo_motivo = 'Enviado'
                atualizacoes['logistica_para_enviado'] += 1
        elif motivo_atual == 'Enviado':
            status_lower = status_pedido.lower() if status_pedido else ''
            if status_pedido and 'entregue' in status_lower and not is_status_maiusculo(status_pedido):
                novo_motivo = 'Entregue'
                atualizacoes['enviado_para_entregue'] += 1
            elif is_status_maiusculo(status_pedido) and data_status:
                dias_sem_mudanca = calcular_dias_uteis(data_status)
                if dias_sem_mudanca >= 3:
                    novo_motivo = 'Ag. Transportadora'
                    atualizacoes['enviado_para_ag_transportadora'] += 1
        elif motivo_atual in ['Entregue', 'Ag. Transportadora', 'Ag. Parceiro']:
            status_lower = status_pedido.lower() if status_pedido else ''
            if is_status_maiusculo(status_pedido) and 'entregue' not in status_lower:
                novo_motivo = 'Enviado'
                atualizacoes['correcao_para_enviado'] = atualizacoes.get('correcao_para_enviado', 0) + 1
        if novo_motivo:
            await db.chamados.update_one(
                {"id_atendimento": chamado.get('id_atendimento')},
                {"$set": {"motivo_pendencia": novo_motivo}}
            )
            logger.info(f"Chamado {chamado.get('id_atendimento')}: {motivo_atual} -> {novo_motivo}")
    logger.info(f"Atualização automática concluída: {atualizacoes}")
