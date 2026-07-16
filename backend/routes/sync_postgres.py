"""
v2: adiciona persistencia de last_finished_at no Mongo (collection sync_state).
Preserva info de "ultima atualizacao 100%" mesmo quando outro sync esta rodando.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional
import os, uuid, logging, asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import UpdateOne
from starlette.concurrency import run_in_threadpool

from utils.database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Estados em memoria (running, progresso atual)
_state = {
    "tabelao":      {"running": False, "started_at": None, "finished_at": None, "total": 0, "inserted": 0, "updated": 0, "errors": 0, "error_message": None, "started_by": None},
    "tabelao_inc":  {"running": False, "started_at": None, "finished_at": None, "total": 0, "inserted": 0, "updated": 0, "errors": 0, "error_message": None, "started_by": None, "cutoff": None},
    "fornecedores": {"running": False, "started_at": None, "finished_at": None, "total": 0, "inserted": 0, "updated": 0, "errors": 0, "error_message": None, "started_by": None},
    "sigeq425":     {"running": False, "started_at": None, "finished_at": None, "total": 0, "inserted": 0, "updated": 0, "errors": 0, "error_message": None, "started_by": None},
    "sigeq230":     {"running": False, "started_at": None, "finished_at": None, "total": 0, "inserted": 0, "updated": 0, "errors": 0, "error_message": None, "started_by": None},
}


def _connect_pg():
    return psycopg2.connect(
        host=os.environ.get("PG_HOST", "weconnect-postgres"),
        port=int(os.environ.get("PG_PORT", "5432")),
        database=os.environ.get("PG_DB", "bigdata"),
        user=os.environ.get("PG_USER", "weconnect"),
        password=os.environ.get("PG_PASSWORD") or None,
        connect_timeout=10,
    )


def _pg_fetchall(sql, params=None, dict_cursor=True):
    """Executa query no Postgres com cleanup garantido (try/finally)."""
    conn = _connect_pg()
    try:
        cursor_kwargs = {"cursor_factory": RealDictCursor} if dict_cursor else {}
        cur = conn.cursor(**cursor_kwargs)
        try:
            cur.execute(sql, params)
            return cur.fetchall()
        finally:
            cur.close()
    finally:
        conn.close()


def _pg_fetchone(sql, params=None):
    """Executa query single-row no Postgres com cleanup garantido."""
    conn = _connect_pg()
    try:
        cur = conn.cursor()
        try:
            cur.execute(sql, params)
            return cur.fetchone()
        finally:
            cur.close()
    finally:
        conn.close()


def _safe_str(v) -> str:
    if v is None: return ""
    s = str(v).strip()
    if s.lower() in ("nan", "none", "<na>"): return ""
    return s


def _safe_cpf(v) -> str:
    """Normaliza CPF: extrai apenas dígitos e completa com zeros à esquerda até 11 dígitos."""
    s = _safe_str(v)
    if not s:
        return ""
    digits = "".join(c for c in s if c.isdigit())
    if not digits:
        return ""
    # CPF deve ter exatamente 11 dígitos
    if len(digits) < 11:
        digits = digits.zfill(11)
    return digits


def _safe_int(v, default=0) -> int:
    try:
        if v is None or str(v).strip().lower() in ("nan", "none", "<na>", ""):
            return default
        return int(float(v))
    except Exception:
        return default


def _set_state(key, **kw):
    _state[key].update(kw)

def _tabelao_busy_with():
    """Retorna o nome do sync rodando em pedidos_erp (tabelao ou tabelao_inc), ou None."""
    if _state["tabelao"].get("running"):
        return "tabelao"
    if _state["tabelao_inc"].get("running"):
        return "tabelao_inc"
    return None



# ============== HELPERS de notificacao + retry ==============
async def _notify_adneia(titulo: str, mensagem: str, tipo: str = "sync"):
    """Cria notificacao para Adneia no ELO."""
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "destinatario_email": "adneia@weconnect360.com.br",
            "titulo": titulo,
            "mensagem": mensagem,
            "tipo": tipo,
            "lida": False,
            "data_criacao": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"[notify] {titulo}: {mensagem}")
    except Exception as e:
        logger.error(f"[notify FAIL] {e}")


async def _check_divergence(dataset_key: str, mongo_count: int, postgres_count: int):
    """Avisa se divergencia entre Mongo e Postgres for >5%."""
    if postgres_count == 0:
        return
    diff_pct = abs(mongo_count - postgres_count) / postgres_count * 100
    if diff_pct > 5:
        await _notify_adneia(
            titulo=f"Alerta de divergencia em {dataset_key}",
            mensagem=f"Mongo: {mongo_count:,} / Postgres: {postgres_count:,} (diferenca {diff_pct:.1f}%)",
            tipo="sync_alert"
        )







# ============== VALIDADOR DE SCHEMA da view ==============
EXPECTED_TABELAO_COLS = {
    "entrega", "nome_canal_de_vendas", "ped_cliente", "ped_externo",
    "cpf", "nome", "cep", "cidade", "uf", "fone", "email",
    "status_da_entrega", "dt_ult_ponto_controle", "dt_prometida",
    "transportadora", "nome_5", "item", "nome_do_produto", "cod_terceiro",
    "qtde_pedido", "preco_final", "frete", "cmv", "filial", "serie_nf",
    "nota", "chave_acesso", "codigo_fornecedor",
    "endereco_rua", "endereco_numero", "endereco_complemento", "endereco_bairro",
    "last_changed_at",
}

EXPECTED_FORNECEDORES_COLS = {
    "fornecedor", "cnpj", "razao_social", "apelido",
    "prazo_envio_dias", "prazo_total_dias",
    "lead_time_sp", "lead_time_es", "lead_time_sc",
    "ativo", "dias_extras_padrao",
}


async def _validate_view_schema(rows, expected_cols: set, view_name: str):
    """Falha cedo se a view nao tem as colunas esperadas. Retorna True se OK."""
    if not rows:
        return True  # zero rows e ok (incremental sem mudancas)
    actual = set(rows[0].keys())
    missing = expected_cols - actual
    if missing:
        msg = f"View {view_name} esta sem colunas esperadas: {sorted(missing)}"
        logger.error(f"[schema-check] {msg}")
        await _notify_adneia(
            titulo=f"Schema da view {view_name} mudou",
            mensagem=f"Colunas faltando: {sorted(missing)[:5]}. Sync pausado para evitar dados corrompidos.",
            tipo="sync_error"
        )
        return False
    return True


async def _persist_completion(key, total, inserted, updated, errors, started_by, started_at):
    """Salva no Mongo a info de ultima conclusao 100% bem-sucedida."""
    try:
        await db.sync_state.update_one(
            {"dataset": key},
            {"$set": {
                "dataset": key,
                "last_finished_at": datetime.now(timezone.utc).isoformat(),
                "last_total": total,
                "last_inserted": inserted,
                "last_updated": updated,
                "last_errors": errors,
                "last_started_by": started_by,
                "last_started_at": started_at,
            }},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to persist sync_state for {key}: {e}")


async def _log_sync(
    dataset: str,
    started_at: str,
    finalizado_em: str,
    total: int,
    inserted: int,
    updated: int,
    errors: int,
    started_by: str,
    status: str = "ok",
    error_message: str = None,
    cutoff_usado: str = None,
    rows_postgres: int = None,
    pedidos_afetados: list = None,
):
    """
    Grava um log persistido de cada execução de sync na coleção sync_logs.
    Coleção tem TTL de 30 dias (índice criado em main.py / startup).
    """
    try:
        # Calcula duração em segundos
        duracao_seg = None
        try:
            dt_ini = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            dt_fim = datetime.fromisoformat(finalizado_em.replace("Z", "+00:00"))
            duracao_seg = round((dt_fim - dt_ini).total_seconds(), 2)
        except Exception:
            pass

        doc = {
            "sync_id": str(uuid.uuid4()),
            "dataset": dataset,
            "iniciado_em": started_at,
            "finalizado_em": finalizado_em,
            # Campo para TTL (datetime nativo necessário)
            "criado_em_dt": datetime.now(timezone.utc),
            "duracao_seg": duracao_seg,
            "cutoff_usado": cutoff_usado,
            "rows_postgres": rows_postgres,
            "rows_processadas": total,
            "inseridos": inserted,
            "atualizados": updated,
            "erros": errors,
            "status": status,
            "error_message": error_message,
            "started_by": started_by,
        }
        # Limita pedidos_afetados pra não explodir o tamanho do documento
        if pedidos_afetados:
            lista = list(pedidos_afetados)
            doc["pedidos_afetados_total"] = len(lista)
            doc["pedidos_afetados"] = lista[:1000]  # cap em 1000 por sync
        await db.sync_logs.insert_one(doc)
    except Exception as e:
        logger.warning(f"Failed to write sync_log for {dataset}: {e}")


async def _get_persisted(key):
    """Le do Mongo a info de ultima conclusao."""
    try:
        doc = await db.sync_state.find_one({"dataset": key}, {"_id": 0, "dataset": 0})
        return doc or {}
    except Exception:
        return {}


# ============== TABELAO ==============
async def _run_sync_tabelao(started_by: str):
    key = "tabelao"
    started_at = datetime.now(timezone.utc).isoformat()
    _set_state(key, running=True, started_at=started_at, finished_at=None,
               total=0, inserted=0, updated=0, errors=0, error_message=None, started_by=started_by)
    try:
        rows = await run_in_threadpool(_pg_fetchall, "SELECT * FROM v_elo_tabelao")
        logger.info(f"[sync tabelao] {len(rows)} rows")
        if not await _validate_view_schema(rows, EXPECTED_TABELAO_COLS, "v_elo_tabelao"):
            raise RuntimeError("schema da view v_elo_tabelao incompativel - sync abortado")
        existing = set()
        async for d in db.pedidos_erp.find({}, {"numero_pedido": 1, "_id": 0}):
            if d.get("numero_pedido"): existing.add(str(d["numero_pedido"]))
        ops = []; now_iso = datetime.now(timezone.utc).isoformat()
        BATCH = 2000; inserted = updated = errors = 0
        seen = set()  # deduplica contagem: view retorna multiplas rows por pedido (item-level)
        for r in rows:
            try:
                np = _safe_str(r.get("entrega"))
                if not np: continue
                doc = {
                    "numero_pedido": np,
                    "canal_vendas": _safe_str(r.get("nome_canal_de_vendas")),
                    "pedido_cliente": _safe_str(r.get("ped_cliente")),
                    "pedido_externo": _safe_str(r.get("ped_externo")),
                    "cpf_cliente": _safe_cpf(r.get("cpf")),
                    "nome_cliente": _safe_str(r.get("nome")),
                    "cep": _safe_str(r.get("cep")),
                    "cidade": _safe_str(r.get("cidade")),
                    "uf": _safe_str(r.get("uf")),
                    "fone_cliente": _safe_str(r.get("fone")),
                    "email_cliente": _safe_str(r.get("email")),
                    "status_pedido": _safe_str(r.get("status_da_entrega")),
                    "data_status": _safe_str(r.get("dt_ult_ponto_controle")),
                    "dt_prometida": _safe_str(r.get("dt_prometida")),
                    "transportadora": _safe_str(r.get("transportadora")),
                    "departamento": _safe_str(r.get("nome_5")),
                    "codigo_item_bseller": _safe_str(r.get("item")),
                    "produto": _safe_str(r.get("nome_do_produto")),
                    "codigo_item_vtex": _safe_str(r.get("cod_terceiro")),
                    "quantidade": _safe_str(r.get("qtde_pedido")),
                    "preco_final": _safe_str(r.get("preco_final")),
                    "frete": _safe_str(r.get("frete")),
                    "cmv": _safe_str(r.get("cmv")),
                    "filial": _safe_str(r.get("filial")),
                    "serie_nf": _safe_str(r.get("serie_nf")),
                    "nota_fiscal": _safe_str(r.get("nota")),
                    "chave_nota": _safe_str(r.get("chave_acesso")),
                    "codigo_fornecedor": _safe_str(r.get("codigo_fornecedor")),
                    "endereco_rua": _safe_str(r.get("endereco_rua")),
                    "endereco_numero": _safe_str(r.get("endereco_numero")),
                    "endereco_complemento": _safe_str(r.get("endereco_complemento")),
                    "endereco_bairro": _safe_str(r.get("endereco_bairro")),
                    "sync_source": "postgres",
                    "synced_at": now_iso,
                }
                is_first = np not in seen
                seen.add(np)
                if np in existing:
                    ops.append(UpdateOne({"numero_pedido": np}, {"$set": doc}, upsert=False))
                    if is_first: updated += 1
                else:
                    doc["id"] = str(uuid.uuid4())
                    doc["imported_at"] = now_iso
                    doc["imported_by"] = "sync-from-postgres"
                    ops.append(UpdateOne({"numero_pedido": np}, {"$setOnInsert": doc}, upsert=True))
                    if is_first: inserted += 1
                if len(ops) >= BATCH:
                    await db.pedidos_erp.bulk_write(ops, ordered=False); ops = []
                    _set_state(key, total=inserted + updated, inserted=inserted, updated=updated)
            except Exception as e:
                errors += 1; logger.error(f"[sync tabelao row error] {e}")
        if ops: await db.pedidos_erp.bulk_write(ops, ordered=False)
        finished_at = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at, total=inserted + updated, inserted=inserted, updated=updated, errors=errors)
        await _persist_completion(key, inserted + updated, inserted, updated, errors, started_by, started_at)
        # Log persistido
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at,
            total=inserted + updated, inserted=inserted, updated=updated, errors=errors,
            started_by=started_by, status="ok",
            rows_postgres=len(rows), pedidos_afetados=list(seen),
        )
        # Auto-encerrar cancelamentos AES cujo pedido avançou de status (NF emitida, enviado, entregue, etc.)
        try:
            from routes.cancelamentos import _auto_encerrar_aes_por_status_pedido
            auto_r = await _auto_encerrar_aes_por_status_pedido()
            if auto_r.get("encerrados"):
                logger.info(f"[sync tabelao] auto-encerrados {auto_r['encerrados']} cancelamento(s) AES por mudança de status")
        except Exception as e:
            logger.warning(f"[sync tabelao] auto-encerrar AES falhou: {e}")
        # Atualiza busca de similares (estoque fresco) para AES pendentes ainda não decididos
        try:
            from routes.cancelamentos import _analisar_similares_pendentes
            sim_r = await _analisar_similares_pendentes(limit=300)
            if sim_r.get("analisados"):
                logger.info(f"[sync tabelao] similares reanalisados: {sim_r}")
        except Exception as e:
            logger.warning(f"[sync tabelao] análise de similares falhou: {e}")
        # Marca 'Enviado' travados (+3 dias úteis sem movimentação) como Verificar + nota
        try:
            from routes.chamados import _auto_verificar_enviado_travado, _auto_verificar_transportadora_parado, _auto_verificar_logistica_travado, _auto_verificar_fornecedor_parado, _auto_verificar_compras_parado, _auto_verificar_por_anotacao
            tv = await _auto_verificar_enviado_travado()
            if tv.get("marcados"):
                logger.info(f"[sync tabelao] enviados críticos marcados: {tv}")
            tt = await _auto_verificar_transportadora_parado()
            if tt.get("marcados"):
                logger.info(f"[sync tabelao] ag. transportadora críticos marcados: {tt}")
            tl = await _auto_verificar_logistica_travado()
            if tl.get("marcados"):
                logger.info(f"[sync tabelao] ag. logística críticos marcados: {tl}")
            tf = await _auto_verificar_fornecedor_parado()
            if tf.get("marcados"):
                logger.info(f"[sync tabelao] ag. fornecedor críticos marcados: {tf}")
            tc = await _auto_verificar_compras_parado()
            if tc.get("marcados"):
                logger.info(f"[sync tabelao] ag. compras críticos marcados: {tc}")
            for _mot,_lim,_flag,_cob in [
                ("Ag. Cliente",3,"verificar_cliente_auto","Cobrar o cliente no zap"),
                ("Ag. Bseller",3,"verificar_bseller_auto","Cobrar no ticket Bseller"),
                ("Ag. Barrar",6,"verificar_barrar_auto","Cobrar o galpão (e-mail SC/ES ou portal Grin)"),
            ]:
                _r = await _auto_verificar_por_anotacao(_mot,_lim,_flag,_cob)
                if _r.get("marcados"):
                    logger.info(f"[sync tabelao] {_mot} críticos marcados: {_r}")
        except Exception as e:
            logger.warning(f"[sync tabelao] verificar-travado falhou: {e}")
        # Check divergencia (pedido-level: usa numero_pedido distinto da view)
        try:
            postgres_n = len({_safe_str(r.get("entrega")) for r in rows if _safe_str(r.get("entrega"))})
            mongo_n = await db.pedidos_erp.count_documents({})
            await _check_divergence("tabelao", mongo_n, postgres_n)
        except Exception as e:
            logger.error(f"[divergence check] failed: {e}")
        if errors > 0:
            await _notify_adneia(
                titulo=f"Sync tabelao terminou com {errors} erros",
                mensagem=f"Processados: {inserted + updated:,}. Erros: {errors}. Verifique os logs.",
                tipo="sync_alert"
            )
    except Exception as e:
        logger.exception("[sync tabelao] failed")
        finished_at_err = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at_err, error_message=str(e))
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at_err,
            total=0, inserted=0, updated=0, errors=1, started_by=started_by,
            status="erro", error_message=str(e)[:500],
        )
        await _notify_adneia(
            titulo="Sync tabelao FALHOU",
            mensagem=f"Erro: {str(e)[:200]}",
            tipo="sync_error"
        )


# ============== FORNECEDORES ==============
async def _run_sync_fornecedores(started_by: str):
    key = "fornecedores"
    started_at = datetime.now(timezone.utc).isoformat()
    _set_state(key, running=True, started_at=started_at, finished_at=None, total=0, inserted=0, updated=0, errors=0, error_message=None, started_by=started_by)
    try:
        rows = await run_in_threadpool(_pg_fetchall, "SELECT * FROM v_elo_fornecedores")
        if not await _validate_view_schema(rows, EXPECTED_FORNECEDORES_COLS, "v_elo_fornecedores"):
            raise RuntimeError("schema da view v_elo_fornecedores incompativel - sync abortado")
        existing = set()
        async for d in db.fornecedores.find({}, {"nome": 1, "_id": 0}):
            if d.get("nome"): existing.add(d["nome"].strip().lower())
        ops = []; now_iso = datetime.now(timezone.utc).isoformat()
        inserted = updated = errors = 0
        for r in rows:
            try:
                nome = _safe_str(r.get("fornecedor"))
                if not nome: continue
                key_match = nome.strip().lower()
                doc = {
                    "nome": nome,
                    "dias_extras_padrao": _safe_int(r.get("dias_extras_padrao"), 5),
                    "cnpj": _safe_str(r.get("cnpj")),
                    "razao_social": _safe_str(r.get("razao_social")),
                    "apelido": _safe_str(r.get("apelido")),
                    "prazo_envio_dias": _safe_int(r.get("prazo_envio_dias")),
                    "prazo_total_dias": _safe_int(r.get("prazo_total_dias")),
                    "lead_time_sp": _safe_int(r.get("lead_time_sp")),
                    "lead_time_es": _safe_int(r.get("lead_time_es")),
                    "lead_time_sc": _safe_int(r.get("lead_time_sc")),
                    "ativo": bool(r.get("ativo")) if r.get("ativo") is not None else True,
                    "ultima_atualizacao": now_iso,
                    "sync_source": "postgres",
                }
                if key_match in existing:
                    ops.append(UpdateOne({"nome": nome}, {"$set": doc}, upsert=False)); updated += 1
                else:
                    doc["id"] = str(uuid.uuid4())
                    doc["created_at"] = now_iso
                    ops.append(UpdateOne({"nome": nome}, {"$setOnInsert": doc}, upsert=True)); inserted += 1
            except Exception as e:
                errors += 1; logger.error(f"[sync fornecedores row error] {e}")
        if ops: await db.fornecedores.bulk_write(ops, ordered=False)
        finished_at = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at, total=inserted + updated, inserted=inserted, updated=updated, errors=errors)
        await _persist_completion(key, inserted + updated, inserted, updated, errors, started_by, started_at)
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at,
            total=inserted + updated, inserted=inserted, updated=updated, errors=errors,
            started_by=started_by, status="ok", rows_postgres=len(rows),
        )
    except Exception as e:
        logger.exception("[sync fornecedores] failed")
        finished_at_err = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at_err, error_message=str(e))
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at_err,
            total=0, inserted=0, updated=0, errors=1, started_by=started_by,
            status="erro", error_message=str(e)[:500],
        )


# ============== SIGEQ425 / SIGEQ230 ==============
async def _run_sync_sigeq(source: str, view_name: str, started_by: str, col_map: dict):
    key = source.lower()
    started_at = datetime.now(timezone.utc).isoformat()
    _set_state(key, running=True, started_at=started_at, finished_at=None, total=0, inserted=0, updated=0, errors=0, error_message=None, started_by=started_by)
    try:
        rows = await run_in_threadpool(_pg_fetchall, f"SELECT * FROM {view_name}")
        ops = []; now_iso = datetime.now(timezone.utc).isoformat()
        inserted = updated = errors = 0
        BATCH = 5000
        existing = set()
        async for d in db.estoque_sigeq.find({"source": source}, {"id_item": 1, "_id": 0}):
            if d.get("id_item"): existing.add(str(d["id_item"]))
        for r in rows:
            try:
                id_item = _safe_str(r.get(col_map["id_item"]))
                if not id_item: continue
                doc = {
                    "id_item": id_item,
                    "descricao": _safe_str(r.get(col_map.get("descricao", ""))),
                    "fornecedor": _safe_str(r.get(col_map.get("fornecedor", ""))),
                    "codigo_fornecedor": _safe_str(r.get(col_map.get("codigo_fornecedor", ""))),
                    "source": source,
                    "ultima_atualizacao": now_iso,
                    "sync_source": "postgres",
                }
                if "qt_reserva" in col_map:
                    doc["qt_reserva"] = _safe_int(r.get(col_map["qt_reserva"]))
                    doc["disp_venda"] = _safe_int(r.get(col_map["disp_venda"]))
                    doc["qt_arquivo"] = _safe_int(r.get(col_map["qt_arquivo"]))
                if "ean" in col_map: doc["ean"] = _safe_str(r.get(col_map["ean"]))
                if "cod_terceiro" in col_map: doc["cod_terceiro"] = _safe_str(r.get(col_map["cod_terceiro"]))
                if "marca" in col_map: doc["marca"] = _safe_str(r.get(col_map["marca"]))
                if id_item in existing:
                    ops.append(UpdateOne({"id_item": id_item, "source": source}, {"$set": doc}, upsert=False)); updated += 1
                else:
                    doc["id"] = str(uuid.uuid4())
                    doc["created_at"] = now_iso
                    ops.append(UpdateOne({"id_item": id_item, "source": source}, {"$setOnInsert": doc}, upsert=True)); inserted += 1
                if len(ops) >= BATCH:
                    await db.estoque_sigeq.bulk_write(ops, ordered=False); ops = []
                    _set_state(key, total=inserted + updated, inserted=inserted, updated=updated)
            except Exception as e:
                errors += 1; logger.error(f"[sync {source} row error] {e}")
        if ops: await db.estoque_sigeq.bulk_write(ops, ordered=False)
        finished_at = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at, total=inserted + updated, inserted=inserted, updated=updated, errors=errors)
        await _persist_completion(key, inserted + updated, inserted, updated, errors, started_by, started_at)
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at,
            total=inserted + updated, inserted=inserted, updated=updated, errors=errors,
            started_by=started_by, status="ok", rows_postgres=len(rows),
        )
    except Exception as e:
        logger.exception(f"[sync {source}] failed")
        finished_at_err = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at_err, error_message=str(e))
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at_err,
            total=0, inserted=0, updated=0, errors=1, started_by=started_by,
            status="erro", error_message=str(e)[:500],
        )


SIGEQ425_MAP = {
    "id_item": "id_do_item", "descricao": "descricao_do_item", "fornecedor": "nome_do_fornecedor",
    "codigo_fornecedor": "codigo_fornecedor", "qt_reserva": "qt_res", "disp_venda": "disp_venda",
    "qt_arquivo": "qt_arquivo", "ean": "ean", "cod_terceiro": "codigo_terceiro",
}
SIGEQ230_MAP = {
    "id_item": "item", "descricao": "nome", "fornecedor": "nome_fornecedor",
    "codigo_fornecedor": "cod_fornecedor", "ean": "ean", "cod_terceiro": "cod_terceiro", "marca": "marca",
}


# ============== ENDPOINTS ==============
async def _enrich_status(key):
    """Junta state em memoria + persistido no mongo."""
    s = dict(_state[key])
    persisted = await _get_persisted(key)
    s.update({k: v for k, v in persisted.items()})  # last_* fields
    return s


@router.post("/admin/sync-from-postgres")
async def sync_tabelao(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    busy = _tabelao_busy_with()
    if busy:
        return {"status": "already_running", "blocked_by": busy, "state": await _enrich_status(busy)}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_sync_tabelao, started_by)
    return {"status": "started", "started_by": started_by}


@router.get("/admin/sync-from-postgres/status")
async def status_tabelao(current_user: dict = Depends(get_current_user)):
    return await _enrich_status("tabelao")


@router.post("/admin/sync-fornecedores-from-postgres")
async def sync_fornecedores(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if _state["fornecedores"].get("running"): return {"status": "already_running", "state": await _enrich_status("fornecedores")}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_sync_fornecedores, started_by)
    return {"status": "started", "started_by": started_by}


@router.get("/admin/sync-fornecedores-from-postgres/status")
async def status_fornecedores(current_user: dict = Depends(get_current_user)):
    return await _enrich_status("fornecedores")


@router.post("/admin/sync-sigeq425-from-postgres")
async def sync_sigeq425(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if _state["sigeq425"].get("running"): return {"status": "already_running", "state": await _enrich_status("sigeq425")}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_sync_sigeq, "SIGEQ425", "v_elo_sigeq425", started_by, SIGEQ425_MAP)
    return {"status": "started", "started_by": started_by}


@router.get("/admin/sync-sigeq425-from-postgres/status")
async def status_sigeq425(current_user: dict = Depends(get_current_user)):
    return await _enrich_status("sigeq425")


@router.post("/admin/sync-sigeq230-from-postgres")
async def sync_sigeq230(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if _state["sigeq230"].get("running"): return {"status": "already_running", "state": await _enrich_status("sigeq230")}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_sync_sigeq, "SIGEQ230", "v_elo_sigeq230", started_by, SIGEQ230_MAP)
    return {"status": "started", "started_by": started_by}


@router.get("/admin/sync-sigeq230-from-postgres/status")
async def status_sigeq230(current_user: dict = Depends(get_current_user)):
    return await _enrich_status("sigeq230")



# ============== TABELAO INCREMENTAL (so pedidos mudados) ==============
async def _run_sync_tabelao_incremental(started_by: str, override_cutoff: str = None):
    """Sync incremental: so processa pedidos com last_changed_at > cutoff.
    O cutoff vem do sync_state.last_sync_cutoff (Mongo), fallback: 24h atras.
    Sobreposicao de 1h pra seguranca (margem)."""
    key = "tabelao_inc"
    started_at = datetime.now(timezone.utc).isoformat()
    # Determinar cutoff
    cutoff = override_cutoff
    if not cutoff:
        try:
            doc = await db.sync_state.find_one({"dataset": "tabelao_inc"})
            cutoff = (doc or {}).get("last_sync_cutoff")
        except Exception:
            cutoff = None
    if not cutoff:
        # primeira execucao: 24h atras
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    # Sobreposicao de 1h
    try:
        cutoff_dt = datetime.fromisoformat(cutoff.replace("Z", "+00:00"))
        cutoff_with_margin = (cutoff_dt - timedelta(hours=1)).isoformat()
    except Exception:
        cutoff_with_margin = cutoff
    # Marcar inicio dessa execucao (proxima cutoff sera NOW)
    new_cutoff = datetime.now(timezone.utc).isoformat()
    _set_state(key, running=True, started_at=started_at, finished_at=None,
               total=0, inserted=0, updated=0, errors=0, error_message=None,
               started_by=started_by, cutoff=cutoff_with_margin)
    try:
        rows = await run_in_threadpool(_pg_fetchall, "SELECT * FROM v_elo_tabelao WHERE last_changed_at > %s", (cutoff_with_margin,))
        logger.info(f"[sync tabelao INC] {len(rows)} rows com last_changed_at > {cutoff_with_margin}")
        if not await _validate_view_schema(rows, EXPECTED_TABELAO_COLS, "v_elo_tabelao"):
            raise RuntimeError("schema da view v_elo_tabelao incompativel - sync incremental abortado")
        # OTIMIZADO: sem pre-fetch, upsert direto. Mongo decide insert vs update.
        ops = []; now_iso = datetime.now(timezone.utc).isoformat()
        BATCH = 5000; inserted = updated = errors = 0
        seen = set()  # deduplica contagem: view item-level pode ter multiplas rows por pedido
        for r in rows:
            try:
                np = _safe_str(r.get("entrega"))
                if not np: continue
                doc = {
                    "numero_pedido": np,
                    "canal_vendas": _safe_str(r.get("nome_canal_de_vendas")),
                    "pedido_cliente": _safe_str(r.get("ped_cliente")),
                    "pedido_externo": _safe_str(r.get("ped_externo")),
                    "cpf_cliente": _safe_cpf(r.get("cpf")),
                    "nome_cliente": _safe_str(r.get("nome")),
                    "cep": _safe_str(r.get("cep")),
                    "cidade": _safe_str(r.get("cidade")),
                    "uf": _safe_str(r.get("uf")),
                    "fone_cliente": _safe_str(r.get("fone")),
                    "email_cliente": _safe_str(r.get("email")),
                    "status_pedido": _safe_str(r.get("status_da_entrega")),
                    "data_status": _safe_str(r.get("dt_ult_ponto_controle")),
                    "dt_prometida": _safe_str(r.get("dt_prometida")),
                    "transportadora": _safe_str(r.get("transportadora")),
                    "departamento": _safe_str(r.get("nome_5")),
                    "codigo_item_bseller": _safe_str(r.get("item")),
                    "produto": _safe_str(r.get("nome_do_produto")),
                    "codigo_item_vtex": _safe_str(r.get("cod_terceiro")),
                    "quantidade": _safe_str(r.get("qtde_pedido")),
                    "preco_final": _safe_str(r.get("preco_final")),
                    "frete": _safe_str(r.get("frete")),
                    "cmv": _safe_str(r.get("cmv")),
                    "filial": _safe_str(r.get("filial")),
                    "serie_nf": _safe_str(r.get("serie_nf")),
                    "nota_fiscal": _safe_str(r.get("nota")),
                    "chave_nota": _safe_str(r.get("chave_acesso")),
                    "codigo_fornecedor": _safe_str(r.get("codigo_fornecedor")),
                    "endereco_rua": _safe_str(r.get("endereco_rua")),
                    "endereco_numero": _safe_str(r.get("endereco_numero")),
                    "endereco_complemento": _safe_str(r.get("endereco_complemento")),
                    "endereco_bairro": _safe_str(r.get("endereco_bairro")),
                    "sync_source": "postgres-incremental",
                    "synced_at": now_iso,
                }
                # Upsert: $set para campos atualizados, $setOnInsert para campos so-na-criacao
                ops.append(UpdateOne(
                    {"numero_pedido": np},
                    {
                        "$set": doc,
                        "$setOnInsert": {
                            "id": str(uuid.uuid4()),
                            "imported_at": now_iso,
                            "imported_by": "sync-incremental",
                        }
                    },
                    upsert=True
                ))
                # Contagem dedupada por pedido (view tem multiplas rows item-level)
                if np not in seen:
                    seen.add(np)
                    updated += 1
                if len(ops) >= BATCH:
                    await db.pedidos_erp.bulk_write(ops, ordered=False); ops = []
                    _set_state(key, total=inserted + updated, inserted=inserted, updated=updated)
            except Exception as e:
                errors += 1; logger.error(f"[sync inc row error] {e}")
        if ops: await db.pedidos_erp.bulk_write(ops, ordered=False)
        finished_at = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at, total=inserted + updated,
                   inserted=inserted, updated=updated, errors=errors)
        # Persistir conclusao + novo cutoff
        await _persist_completion(key, inserted + updated, inserted, updated, errors, started_by, started_at)
        await db.sync_state.update_one(
            {"dataset": "tabelao_inc"},
            {"$set": {"last_sync_cutoff": new_cutoff}},
            upsert=True
        )
        # Log persistido do sync incremental
        motivos_atualizados = 0
        # Atualizar motivo_pendencia dos chamados afetados (Status do Pedido → Motivo)
        # Otimização: passa só os numeros_pedido que foram modificados nesta sync
        try:
            if seen:
                from routes.admin import atualizar_motivos_pendencia_automatico
                m_stats = await atualizar_motivos_pendencia_automatico(numeros_pedido=list(seen))
                motivos_atualizados = m_stats.get("atualizados", 0)
                if motivos_atualizados > 0:
                    logger.info(f"[sync inc] motivos atualizados: {m_stats}")
        except Exception as e:
            logger.warning(f"[sync inc] erro ao atualizar motivos: {e}")
        # Grava log persistido (após calcular motivos_atualizados)
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at,
            total=inserted + updated, inserted=inserted, updated=updated, errors=errors,
            started_by=started_by, status="ok",
            cutoff_usado=cutoff_with_margin, rows_postgres=len(rows),
            pedidos_afetados=list(seen),
        )
        # Auto-encerrar cancelamentos AES cujo pedido avançou de status (NF emitida, enviado, entregue, etc.)
        try:
            from routes.cancelamentos import _auto_encerrar_aes_por_status_pedido
            auto_r = await _auto_encerrar_aes_por_status_pedido()
            if auto_r.get("encerrados"):
                logger.info(f"[sync inc] auto-encerrados {auto_r['encerrados']} cancelamento(s) AES por mudança de status")
        except Exception as e:
            logger.warning(f"[sync inc] auto-encerrar AES falhou: {e}")
        # Atualiza busca de similares (estoque fresco) para AES pendentes ainda não decididos
        try:
            from routes.cancelamentos import _analisar_similares_pendentes
            sim_r = await _analisar_similares_pendentes(limit=300)
            if sim_r.get("analisados"):
                logger.info(f"[sync inc] similares reanalisados: {sim_r}")
        except Exception as e:
            logger.warning(f"[sync inc] análise de similares falhou: {e}")
        # Marca 'Enviado' travados (+3 dias úteis sem movimentação) como Verificar + nota
        try:
            from routes.chamados import _auto_verificar_enviado_travado, _auto_verificar_transportadora_parado, _auto_verificar_logistica_travado, _auto_verificar_fornecedor_parado, _auto_verificar_compras_parado, _auto_verificar_por_anotacao
            tv = await _auto_verificar_enviado_travado()
            if tv.get("marcados"):
                logger.info(f"[sync inc] enviados críticos marcados: {tv}")
            tt = await _auto_verificar_transportadora_parado()
            if tt.get("marcados"):
                logger.info(f"[sync inc] ag. transportadora críticos marcados: {tt}")
            tl = await _auto_verificar_logistica_travado()
            if tl.get("marcados"):
                logger.info(f"[sync inc] ag. logística críticos marcados: {tl}")
            tf = await _auto_verificar_fornecedor_parado()
            if tf.get("marcados"):
                logger.info(f"[sync inc] ag. fornecedor críticos marcados: {tf}")
            tc = await _auto_verificar_compras_parado()
            if tc.get("marcados"):
                logger.info(f"[sync inc] ag. compras críticos marcados: {tc}")
            for _mot,_lim,_flag,_cob in [
                ("Ag. Cliente",3,"verificar_cliente_auto","Cobrar o cliente no zap"),
                ("Ag. Bseller",3,"verificar_bseller_auto","Cobrar no ticket Bseller"),
                ("Ag. Barrar",6,"verificar_barrar_auto","Cobrar o galpão (e-mail SC/ES ou portal Grin)"),
            ]:
                _r = await _auto_verificar_por_anotacao(_mot,_lim,_flag,_cob)
                if _r.get("marcados"):
                    logger.info(f"[sync inc] {_mot} críticos marcados: {_r}")
        except Exception as e:
            logger.warning(f"[sync inc] verificar-travado falhou: {e}")
        # Check divergencia (global, nao do batch): conta pedidos totais Postgres vs Mongo
        try:
            row_pg = await run_in_threadpool(_pg_fetchone, "SELECT COUNT(DISTINCT entrega) FROM v_elo_tabelao")
            postgres_n = row_pg[0] if row_pg else 0
            mongo_n = await db.pedidos_erp.count_documents({})
            await _check_divergence("tabelao_inc", mongo_n, postgres_n)
        except Exception as e:
            logger.error(f"[divergence check inc] failed: {e}")
        # Notify se incremental teve erros
        if errors > 0:
            await _notify_adneia(
                titulo=f"Sync incremental terminou com {errors} erros",
                mensagem=f"Processados: {inserted + updated:,}. Erros: {errors}. Verifique os logs.",
                tipo="sync_alert"
            )
    except Exception as e:
        logger.exception("[sync tabelao INC] failed")
        finished_at_err = datetime.now(timezone.utc).isoformat()
        _set_state(key, running=False, finished_at=finished_at_err, error_message=str(e))
        await _log_sync(
            dataset=key, started_at=started_at, finalizado_em=finished_at_err,
            total=0, inserted=0, updated=0, errors=1, started_by=started_by,
            status="erro", error_message=str(e)[:500],
            cutoff_usado=cutoff_with_margin if 'cutoff_with_margin' in locals() else None,
        )
        await _notify_adneia(
            titulo="Sync incremental FALHOU",
            mensagem=f"Erro: {str(e)[:200]}",
            tipo="sync_error"
        )


@router.post("/admin/sync-tabelao-incremental")
async def sync_tabelao_incremental(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    busy = _tabelao_busy_with()
    if busy:
        return {"status": "already_running", "blocked_by": busy, "state": await _enrich_status(busy)}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_sync_tabelao_incremental, started_by, None)
    return {"status": "started", "started_by": started_by, "type": "incremental"}


@router.get("/admin/sync-tabelao-incremental/status")
async def status_tabelao_incremental(current_user: dict = Depends(get_current_user)):
    return await _enrich_status("tabelao_inc")


async def _run_all(started_by: str):
    await _run_sync_tabelao(started_by)
    await _run_sync_fornecedores(started_by)
    await _run_sync_sigeq("SIGEQ425", "v_elo_sigeq425", started_by, SIGEQ425_MAP)
    await _run_sync_sigeq("SIGEQ230", "v_elo_sigeq230", started_by, SIGEQ230_MAP)


@router.post("/admin/sync-all-from-postgres")
async def sync_all(background: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if any(_state[k].get("running") for k in _state):
        return {"status": "already_running", "state": await status_all(current_user)}
    started_by = current_user.get("email") or "unknown"
    background.add_task(_run_all, started_by)
    return {"status": "started", "started_by": started_by}


@router.get("/admin/sync-all-from-postgres/status")
async def status_all(current_user: dict = Depends(get_current_user)):
    return {
        "tabelao": await _enrich_status("tabelao"),
        "tabelao_inc": await _enrich_status("tabelao_inc"),
        "fornecedores": await _enrich_status("fornecedores"),
        "sigeq425": await _enrich_status("sigeq425"),
        "sigeq230": await _enrich_status("sigeq230"),
    }


# ============== LOG PERSISTIDO DE SYNCS ==============
@router.get("/admin/sync-logs")
async def sync_logs_list(
    dataset: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """
    Lista os últimos N syncs (histórico persistido). TTL de 30 dias.
    Filtros: dataset (tabelao_inc, tabelao, sigeq425, sigeq230, fornecedores), status (ok/erro).
    """
    limit = max(1, min(500, limit))
    query = {}
    if dataset:
        query["dataset"] = dataset
    if status:
        query["status"] = status
    # Exclui o campo pedidos_afetados da listagem (muito grande, vem na rota específica)
    logs = await db.sync_logs.find(
        query,
        {"_id": 0, "criado_em_dt": 0, "pedidos_afetados": 0}
    ).sort("iniciado_em", -1).limit(limit).to_list(limit)
    return {"total": len(logs), "logs": logs}


@router.get("/admin/sync-logs/pedido/{numero_pedido}")
async def sync_logs_por_pedido(
    numero_pedido: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Retorna todos os syncs que afetaram um pedido específico (até onde o TTL permite).
    Útil para investigar por que um pedido específico ficou desatualizado.
    """
    logs = await db.sync_logs.find(
        {"pedidos_afetados": numero_pedido},
        {"_id": 0, "criado_em_dt": 0, "pedidos_afetados": 0}
    ).sort("iniciado_em", -1).limit(100).to_list(100)
    return {
        "numero_pedido": numero_pedido,
        "total_syncs": len(logs),
        "logs": logs
    }


# ============== HEALTH-CHECK do sistema de sync ==============
@router.get("/admin/sync-health")
async def sync_health(current_user: dict = Depends(get_current_user)):
    """Auditoria completa do sistema de sync."""
    try:
        mongo_count = await db.pedidos_erp.count_documents({})
    except Exception:
        mongo_count = -1
    postgres_count = -1
    try:
        row = await run_in_threadpool(_pg_fetchone, "SELECT COUNT(DISTINCT entrega) FROM v_elo_tabelao")
        postgres_count = row[0] if row else -1
    except Exception as e:
        logger.error(f"[health] postgres count fail: {e}")
    # Postgres inacessivel?
    pg_down = postgres_count < 0
    # Calcular divergencia
    divergence_pct = 0
    if postgres_count > 0:
        divergence_pct = round(abs(mongo_count - postgres_count) / postgres_count * 100, 2)
    # Idade da ultima sync (incremental)
    last_inc = await _get_persisted("tabelao_inc")
    last_finished_at = last_inc.get("last_finished_at")
    age_minutes = None
    if last_finished_at:
        try:
            dt = datetime.fromisoformat(last_finished_at.replace("Z", "+00:00"))
            age_minutes = round((datetime.now(timezone.utc) - dt).total_seconds() / 60, 1)
        except Exception:
            pass
    # Cron rodando? (= teve sync nos ultimos 30 min)
    cron_alive = age_minutes is not None and age_minutes < 30
    # Status geral
    status = "healthy"
    issues = []
    if pg_down:
        status = "failing"
        issues.append("postgres inacessivel")
    if divergence_pct > 5:
        status = "degraded"
        issues.append(f"divergencia {divergence_pct}% (>5%)")
    if age_minutes and age_minutes > 60:
        status = "degraded" if status == "healthy" else "failing"
        issues.append(f"ultima sync ha {age_minutes:.0f} min")
    if not cron_alive:
        status = "degraded" if status == "healthy" else "failing"
        issues.append("cron parece parado")
    # Erros recentes (ultimas 24h via notifications)
    errors_24h = 0
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        errors_24h = await db.notifications.count_documents({"tipo": {"$in": ["sync_error", "sync_alert"]}, "data_criacao": {"$gte": since}})
    except Exception:
        pass
    return {
        "status": status,
        "issues": issues,
        "mongo_total": mongo_count,
        "postgres_total": postgres_count,
        "divergence_pct": divergence_pct,
        "divergence_alert": divergence_pct > 5,
        "last_sync_at": last_finished_at,
        "last_sync_age_minutes": age_minutes,
        "cron_alive": cron_alive,
        "errors_last_24h": errors_24h,
        "datasets": {
            "tabelao": await _enrich_status("tabelao"),
            "tabelao_inc": await _enrich_status("tabelao_inc"),
            "fornecedores": await _enrich_status("fornecedores"),
            "sigeq425": await _enrich_status("sigeq425"),
            "sigeq230": await _enrich_status("sigeq230"),
        }
    }
