from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from utils.database import db
from utils.auth import get_current_user
from data.motivo_pendencia_mapping import get_motivo_from_status, MOTIVOS_AUTO_ATUALIZAVEIS, STATUS_NAO_ALTERAR

import uuid
import logging
import pandas as pd
import io
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class RegistroManual(BaseModel):
    numero_pedido: str
    solicitacao: str
    categoria: str
    motivo: str
    parceiro: str
    motivo_pendencia: str
    nome_cliente: str
    data_abertura: str  # formato: DD/MM/YYYY
    anotacoes: str = ""


@router.post("/admin/inserir-registros-manuais")
async def inserir_registros_manuais(
    registros: List[RegistroManual],
    current_user: dict = Depends(get_current_user)
):
    """Insere registros manuais de backup com data específica e sync Google Sheets."""
    resultados = []
    for r in registros:
        # Parse data
        try:
            parts = r.data_abertura.split('/')
            data = datetime(int(parts[2]), int(parts[1]), int(parts[0]), 12, 0, 0, tzinfo=timezone.utc)
        except Exception:
            data = datetime.now(timezone.utc)

        # Verificar duplicata
        existente = await db.chamados.find_one(
            {"numero_pedido": r.numero_pedido, "pendente": True}, {"_id": 0, "id_atendimento": 1}
        )
        if existente:
            resultados.append({
                "numero_pedido": r.numero_pedido,
                "status": "DUPLICADO",
                "id_atendimento": existente.get("id_atendimento")
            })
            continue

        # Gerar ID
        last = await db.chamados.find_one(sort=[("id_atendimento", -1)])
        if last and last.get('id_atendimento'):
            try:
                num = int(last['id_atendimento'].split('-')[-1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        id_atendimento = f"ATD-2026-{num:04d}"

        chamado = {
            "id": str(uuid.uuid4()),
            "id_atendimento": id_atendimento,
            "numero_pedido": r.numero_pedido,
            "solicitacao": r.solicitacao,
            "categoria": r.categoria,
            "motivo": r.motivo,
            "parceiro": r.parceiro,
            "motivo_pendencia": r.motivo_pendencia,
            "nome_cliente": r.nome_cliente,
            "anotacoes": r.anotacoes or f"Registro manual - backup instabilidade {r.data_abertura}",
            "data_abertura": data,
            "pendente": True,
            "retornar_chamado": False,
            "verificar_adneia": False,
            "atendente": current_user.get('name', ''),
        }

        # Buscar dados do pedido ERP
        pedido = await db.pedidos_erp.find_one({"numero_pedido": r.numero_pedido}, {"_id": 0})
        if pedido:
            chamado['cpf_cliente'] = pedido.get('cpf_cliente')
            chamado['produto'] = pedido.get('produto')
            chamado['transportadora'] = pedido.get('transportadora')
            chamado['status_pedido'] = pedido.get('status_pedido')
            chamado['canal_vendas'] = pedido.get('canal_vendas')

        await db.chamados.insert_one(chamado)
        del chamado['_id']

        # Sync Google Sheets
        try:
            from routes.google_sheets_routes import sync_chamado_to_sheets
            await sync_chamado_to_sheets(chamado)
            gs_status = "synced"
        except Exception as e:
            gs_status = f"error: {str(e)[:50]}"

        resultados.append({
            "numero_pedido": r.numero_pedido,
            "nome_cliente": r.nome_cliente,
            "id_atendimento": id_atendimento,
            "status": "CRIADO",
            "google_sheets": gs_status
        })

    return {"success": True, "total": len(registros), "resultados": resultados}


@router.post("/admin/atualizar-motivos")
async def admin_atualizar_motivos(current_user: dict = Depends(get_current_user)):
    stats = await atualizar_motivos_pendencia_automatico()
    return {"success": True, "message": "Motivos de pendência atualizados", "stats": stats}


@router.post("/admin/migrar-ajustes-marco2026")
async def migrar_ajustes_marco2026(current_user: dict = Depends(get_current_user)):
    """
    Executa AJUSTE 1 e AJUSTE 2 do Prompt Março 2026:
    - AJUSTE 1: Aplica mapeamento de motivo de pendência nos pendentes
    - AJUSTE 2: Limpa verificar_adneia onde motivo mudou
    """
    # AJUSTE 1
    stats_ajuste1 = await atualizar_motivos_pendencia_automatico()

    # AJUSTE 2 adicional: verificar todos com verificar_adneia=True
    # (já tratado dentro de atualizar_motivos, mas checamos os restantes)
    chamados_verificar = await db.chamados.find(
        {"verificar_adneia": True, "pendente": True},
        {"_id": 0, "id_atendimento": 1, "motivo_pendencia": 1}
    ).to_list(5000)

    # Distribuição final de motivos
    pipeline_dist = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    distribuicao_raw = await db.chamados.aggregate(pipeline_dist).to_list(50)
    distribuicao = {item['_id'] or 'Sem motivo': item['count'] for item in distribuicao_raw}

    # AJUSTE 5 stats: registros com/sem data
    total_com_data = await db.pedidos_erp.count_documents({"data_status": {"$exists": True, "$nin": ["", None]}})
    total_sem_data = await db.pedidos_erp.count_documents({"$or": [{"data_status": {"$exists": False}}, {"data_status": ""}, {"data_status": None}]})

    return {
        "success": True,
        "ajuste1": stats_ajuste1,
        "ajuste2": {
            "registros_revisados": len(chamados_verificar),
            "verificar_limpo": stats_ajuste1.get("verificar_limpo", 0),
        },
        "distribuicao_final": distribuicao,
        "ajuste5": {
            "com_data": total_com_data,
            "sem_data": total_sem_data,
        }
    }


@router.post("/admin/importar-backup")
async def importar_backup(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Importa backup Excel e atualiza registros existentes + cria novos.
    Compara cada linha do backup com a base e aplica diferenças.
    """
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents))

    # Normalizar colunas
    df.columns = [c.strip() for c in df.columns]

    stats = {"atualizados": 0, "criados": 0, "sem_mudanca": 0, "erros": [], "detalhes": []}

    for _, row in df.iterrows():
        entrega = str(row.get('Entrega', '')).replace('.0', '').strip()
        if not entrega or entrega == 'nan' or entrega == '-':
            continue

        try:
            # Buscar chamado existente
            chamado = await db.chamados.find_one({"numero_pedido": entrega})

            # Extrair dados do backup
            anot_backup = str(row.get('Anotações', '')).strip()
            if anot_backup == 'nan': anot_backup = ''
            mp_backup = str(row.get('Motivo_Pendencia', '')).strip()
            if mp_backup == 'nan': mp_backup = ''
            pend_backup = str(row.get('Pendente', '')).strip().upper()
            ver_backup = str(row.get('Verificar', '')).strip().upper()
            ret_backup = str(row.get('Retornar', '')).strip().upper()
            rev_backup = str(row.get('Reversa', '')).strip()
            if rev_backup == 'nan': rev_backup = ''
            cat_backup = str(row.get('Categoria', '')).strip()
            if cat_backup == 'nan': cat_backup = ''
            mot_backup = str(row.get('Motivo', '')).strip()
            if mot_backup == 'nan': mot_backup = ''
            nome_backup = str(row.get('Nome', '')).strip()
            if nome_backup == 'nan': nome_backup = ''
            parceiro_backup = str(row.get('Parceiro', '')).strip()
            if parceiro_backup == 'nan': parceiro_backup = ''
            solic_backup = str(row.get('Solicitação', '')).replace('.0', '').strip()
            if solic_backup == 'nan': solic_backup = ''
            data_str = str(row.get('Data', ''))[:10]

            if chamado:
                # ATUALIZAR existente
                update = {}
                if anot_backup and anot_backup != str(chamado.get('anotacoes', '')).strip():
                    update['anotacoes'] = anot_backup
                if mp_backup and mp_backup != str(chamado.get('motivo_pendencia', '')).strip():
                    update['motivo_pendencia'] = mp_backup
                if pend_backup in ['SIM', 'NÃO', 'NAO']:
                    pend_val = pend_backup == 'SIM'
                    if pend_val != chamado.get('pendente', True):
                        # Validar: só encerrar se motivo for finalizador
                        if not pend_val:
                            motivos_finalizadores = ["Entregue", "Estornado", "Atendido", "Em devolução", "Devolvido", "Encerrado"]
                            motivo_check = mp_backup or str(chamado.get('motivo_pendencia', ''))
                            if motivo_check not in motivos_finalizadores:
                                # Não encerrar - manter pendente
                                pass
                            else:
                                update['pendente'] = pend_val
                        else:
                            update['pendente'] = pend_val
                if ver_backup == 'SIM' and not chamado.get('verificar_adneia', False):
                    update['verificar_adneia'] = True
                if ret_backup == 'SIM' and not chamado.get('retornar_chamado', False):
                    update['retornar_chamado'] = True
                if rev_backup and rev_backup != str(chamado.get('codigo_reversa', '') or '').strip():
                    update['codigo_reversa'] = rev_backup
                if cat_backup and cat_backup != str(chamado.get('categoria', '')).strip():
                    update['categoria'] = cat_backup
                if mot_backup and mot_backup != str(chamado.get('motivo', '')).strip():
                    update['motivo'] = mot_backup

                if update:
                    await db.chamados.update_one({"_id": chamado["_id"]}, {"$set": update})
                    stats["atualizados"] += 1
                    stats["detalhes"].append({"entrega": entrega, "acao": "ATUALIZADO", "campos": list(update.keys())})
                else:
                    stats["sem_mudanca"] += 1
            else:
                # CRIAR novo
                try:
                    parts = data_str.split('-')
                    data = datetime(int(parts[0]), int(parts[1]), int(parts[2]), 12, 0, 0, tzinfo=timezone.utc)
                except Exception:
                    data = datetime.now(timezone.utc)

                last = await db.chamados.find_one(sort=[("id_atendimento", -1)])
                if last and last.get('id_atendimento'):
                    try:
                        num = int(last['id_atendimento'].split('-')[-1]) + 1
                    except Exception:
                        num = 1
                else:
                    num = 1
                id_atendimento = f"ATD-2026-{num:04d}"

                novo = {
                    "id": str(uuid.uuid4()),
                    "id_atendimento": id_atendimento,
                    "numero_pedido": entrega,
                    "solicitacao": solic_backup,
                    "categoria": cat_backup,
                    "motivo": mot_backup,
                    "parceiro": parceiro_backup,
                    "motivo_pendencia": mp_backup,
                    "nome_cliente": nome_backup,
                    "anotacoes": anot_backup,
                    "data_abertura": data,
                    "pendente": pend_backup != 'NÃO' and pend_backup != 'NAO',
                    "retornar_chamado": ret_backup == 'SIM',
                    "verificar_adneia": ver_backup == 'SIM',
                    "codigo_reversa": rev_backup or None,
                    "atendente": current_user.get('name', ''),
                }

                pedido = await db.pedidos_erp.find_one({"numero_pedido": entrega}, {"_id": 0})
                if pedido:
                    novo['cpf_cliente'] = pedido.get('cpf_cliente')
                    novo['produto'] = pedido.get('produto')
                    novo['transportadora'] = pedido.get('transportadora')
                    novo['status_pedido'] = pedido.get('status_pedido')
                    novo['canal_vendas'] = pedido.get('canal_vendas')

                await db.chamados.insert_one(novo)
                stats["criados"] += 1
                stats["detalhes"].append({"entrega": entrega, "acao": "CRIADO", "id": id_atendimento})

        except Exception as e:
            stats["erros"].append({"entrega": entrega, "erro": str(e)[:100]})

    # Limitar detalhes na resposta
    if len(stats["detalhes"]) > 100:
        stats["detalhes"] = stats["detalhes"][:100]
        stats["detalhes"].append({"nota": f"... e mais registros (total: {stats['atualizados'] + stats['criados']})"})

    return {
        "success": True,
        "resumo": {
            "atualizados": stats["atualizados"],
            "criados": stats["criados"],
            "sem_mudanca": stats["sem_mudanca"],
            "erros": len(stats["erros"])
        },
        "detalhes": stats["detalhes"],
        "erros": stats["erros"][:20]
    }


@router.get("/admin/total-na-base")
async def get_total_na_base(current_user: dict = Depends(get_current_user)):
    """AJUSTE 4 — Retorna o total geral de registros, independente de filtros."""
    total_chamados = await db.chamados.count_documents({})
    total_pedidos = await db.pedidos_erp.count_documents({})
    return {
        "total_chamados": total_chamados,
        "total_pedidos": total_pedidos,
    }


@router.post("/admin/corrigir-numero-pedido")
async def corrigir_numero_pedido(current_user: dict = Depends(get_current_user)):
    """
    Corrige numero_pedido com sufixo '.0' causado pela importação de Excel.
    Pandas converte inteiros para float quando a coluna tem NaN, resultando em '117552503.0'.
    """
    # Corrigir pedidos_erp
    pedidos_com_ponto = await db.pedidos_erp.find(
        {"numero_pedido": {"$regex": r"\.\d+$"}},
        {"_id": 1, "numero_pedido": 1}
    ).to_list(200000)

    corrigidos_pedidos = 0
    for p in pedidos_com_ponto:
        num = p["numero_pedido"]
        if num.endswith(".0") and num[:-2].isdigit():
            novo = num[:-2]
            await db.pedidos_erp.update_one(
                {"_id": p["_id"]},
                {"$set": {"numero_pedido": novo}}
            )
            corrigidos_pedidos += 1

    # Corrigir outros campos numéricos que podem ter .0
    campos_numericos = ["cpf_cliente", "cep", "fone_cliente", "nota_fiscal",
                        "pedido_cliente", "pedido_externo", "codigo_item_bseller",
                        "quantidade", "codigo_fornecedor"]
    corrigidos_campos = 0
    for campo in campos_numericos:
        docs = await db.pedidos_erp.find(
            {campo: {"$regex": r"^\d+\.0$"}},
            {"_id": 1, campo: 1}
        ).to_list(200000)
        for d in docs:
            val = d[campo]
            if val.endswith(".0") and val[:-2].isdigit():
                await db.pedidos_erp.update_one(
                    {"_id": d["_id"]},
                    {"$set": {campo: val[:-2]}}
                )
                corrigidos_campos += 1

    return {
        "success": True,
        "pedidos_numero_corrigido": corrigidos_pedidos,
        "campos_corrigidos": corrigidos_campos,
        "total_analisados": len(pedidos_com_ponto)
    }


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
    """
    AJUSTE 1 — Fluxo automático de Motivo de Pendência.
    Usa a tabela de mapeamento Status do Pedido → Motivo de Pendência.
    Só atualiza se o motivo atual for Ag. Compras, Ag. Logística ou Enviado.
    Não altera registros com Status = Entrega cancelada ou CANCELADO.
    Também aplica AJUSTE 2: limpa verificar_adneia quando motivo muda.
    """

    logger.info("Iniciando atualização automática de motivos de pendência (novo mapeamento)...")
    stats = {
        "pendentes_verificados": 0,
        "elegiveis": 0,
        "atualizados": 0,
        "ignorados_outros_motivos": 0,
        "aguardando_acao_manual": 0,
        "verificar_limpo": 0,
    }

    chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)
    stats["pendentes_verificados"] = len(chamados)

    for chamado in chamados:
        numero_pedido = chamado.get('numero_pedido')
        motivo_atual = chamado.get('motivo_pendencia', '')
        if not numero_pedido:
            continue

        pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
        if not pedido:
            continue

        status_pedido = pedido.get('status_pedido', '')

        # Verificar se status é cancelado (não alterar)
        if status_pedido in STATUS_NAO_ALTERAR:
            stats["aguardando_acao_manual"] += 1
            continue

        # Só atualizar automaticamente se motivo atual for auto-atualizável
        if motivo_atual not in MOTIVOS_AUTO_ATUALIZAVEIS:
            stats["ignorados_outros_motivos"] += 1
            continue

        stats["elegiveis"] += 1

        # Buscar novo motivo pelo mapeamento
        novo_motivo = get_motivo_from_status(status_pedido)
        if novo_motivo and novo_motivo != motivo_atual:
            update_fields = {"motivo_pendencia": novo_motivo}
            # AJUSTE 2: limpar verificar quando motivo muda
            if chamado.get('verificar_adneia'):
                update_fields["verificar_adneia"] = False
                stats["verificar_limpo"] += 1

            await db.chamados.update_one(
                {"id_atendimento": chamado.get('id_atendimento')},
                {"$set": update_fields}
            )
            stats["atualizados"] += 1
            logger.info(f"Chamado {chamado.get('id_atendimento')}: {motivo_atual} -> {novo_motivo}")

    logger.info(f"Atualização automática concluída: {stats}")
    return stats
