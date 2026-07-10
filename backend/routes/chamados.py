from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import re
import uuid

from utils.database import db
from utils.auth import get_current_user
from utils.helpers import parse_date_safe, generate_reversa_code, calcular_dias_uteis, BRT_TZ, now_brt
from utils.email_sender import send_email
from models.chamado import Chamado, ChamadoCreate, ChamadoUpdate
from models.historico import Historico
from data.motivo_pendencia_mapping import get_motivo_from_status, MOTIVOS_AUTO_ATUALIZAVEIS

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ============== HELPERS ==============

async def notificar_inicio_atendimentos(user: dict):
    """Envia notificação para Adnéia quando um atendente criar o primeiro chamado do dia."""
    try:
        # "Dia" em BRT — convertido pra UTC pra filtrar Mongo (data_abertura em UTC).
        hoje = now_brt().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        user_email = user.get('email', '')
        # Se for a própria Adnéia, não notificar
        if 'adneia' in user_email.lower():
            return
        # Verificar se já notificou hoje para este atendente
        notif_existente = await db.notifications.find_one({
            "tipo": "inicio_atendimentos",
            "atendente_email": user_email,
            "data_referencia": hoje.isoformat()
        })
        if notif_existente:
            return
        # Verificar se é o primeiro chamado do dia deste atendente
        chamados_hoje = await db.chamados.count_documents({
            "criado_por_id": user.get('id'),
            "data_abertura": {"$gte": hoje.isoformat()}
        })
        if chamados_hoje <= 1:  # É o primeiro (o que acabou de ser criado)
            notificacao = {
                "id": str(uuid.uuid4()),
                "tipo": "inicio_atendimentos",
                "destinatario_email": "adneia@weconnect360.com.br",
                "atendente_email": user_email,
                "titulo": "Atendimentos Iniciados",
                "mensagem": f"{user.get('name', 'Atendente')} iniciou os atendimentos do dia.",
                "lida": False,
                "data_criacao": datetime.now(timezone.utc).isoformat(),
                "data_referencia": hoje.isoformat()
            }
            await db.notifications.insert_one(notificacao)
            logger.info(f"Notificação de início enviada para Adnéia: {user.get('name')} iniciou atendimentos")
    except Exception as e:
        logger.error(f"Erro ao notificar início de atendimentos: {e}")


async def notificar_csu_integracao(chamado_dict: dict):
    """
    Envia alerta para Adnéia APENAS quando houver mais de 5 atendimentos
    CSU + Falha de Integração no mesmo dia.
    E-mail individual por atendimento foi removido.
    """
    try:
        parceiro = (chamado_dict.get("parceiro") or "").upper()
        categoria = (chamado_dict.get("categoria") or "").lower()
        motivo = (chamado_dict.get("motivo") or "").lower()

        is_csu = "CSU" in parceiro
        is_integracao = "integra" in categoria or "integra" in motivo

        if not (is_csu and is_integracao):
            return

        # Conta quantos atendimentos CSU + Falha Integração foram abertos hoje (dia BRT).
        # O contador rolar para "1" às 00:00 BRT (não às 00:00 UTC = 21h BRT do dia anterior).
        _hoje_brt = now_brt()
        hoje_inicio = _hoje_brt.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        hoje_fim    = _hoje_brt.replace(hour=23, minute=59, second=59, microsecond=999999).astimezone(timezone.utc)

        total_hoje = await db.chamados.count_documents({
            "parceiro":  {"$regex": "CSU", "$options": "i"},
            "categoria": {"$regex": "integra", "$options": "i"},
            "data_abertura": {"$gte": hoje_inicio.isoformat(), "$lte": hoje_fim.isoformat()},
        })

        # Só envia quando cruzar o limiar de 5 (dispara exatamente na 6ª ocorrência)
        if total_hoje != 6:
            logger.info(f"CSU Integração hoje: {total_hoje} atendimentos — sem alerta (limiar: >5)")
            return

        id_atd = chamado_dict.get("id_atendimento", "-")

        subject = f"[ELO] ⚠️ Alerta: {total_hoje} atendimentos CSU – Falha de Integração hoje"

        html_body = f"""
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <h2 style="color: #c0392b;">⚠️ Alerta: Volume alto de Falhas de Integração CSU</h2>
          <p>Foram registrados <strong>{total_hoje} atendimentos</strong> de
             <strong>CSU – Falha de Integração</strong> hoje ({datetime.now(timezone.utc).strftime('%d/%m/%Y')}).</p>
          <p>Último atendimento registrado: <strong>{id_atd}</strong></p>
          <p style="margin-top:16px; color:#666; font-size:12px;">
            Mensagem automática do sistema ELO – WeConnect.
          </p>
        </div>
        """

        plain_body = (
            f"Alerta: {total_hoje} atendimentos CSU - Falha de Integracao hoje.\n"
            f"Ultimo atendimento: {id_atd}\n"
        )

        destinatarios = ["adneia.campos@weconnect360.com.br"]
        send_email(destinatarios, subject, html_body, plain_body)
        logger.info(f"Alerta CSU Integração enviado para {destinatarios} — {total_hoje} atendimentos hoje")

    except Exception as e:
        logger.error(f"Erro ao notificar CSU integração: {e}")


async def generate_atendimento_id():
    now = datetime.now(timezone.utc)
    year = now.year
    last_atendimento = await db.chamados.find_one(
        {"id_atendimento": {"$regex": f"^ATD-{year}-"}},
        sort=[("id_atendimento", -1)]
    )
    if last_atendimento:
        try:
            last_num = int(last_atendimento['id_atendimento'].split('-')[-1])
        except (ValueError, IndexError):
            last_num = 0
    else:
        last_num = 0
    return f"ATD-{year}-{str(last_num + 1).zfill(4)}"


def _parse_data_status(s):
    """Converte data_status ('DD/MM/YYYY [HH:MM:SS]' ou ISO) em datetime (BRT). None se inválido."""
    if not s:
        return None
    s = str(s).strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        try:
            return datetime(y, mo, d, tzinfo=timezone(timedelta(hours=-3)))
        except Exception:
            return None
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception:
        return None


def _dias_uteis_entre(dt0, dt1):
    """Dias úteis entre dt0 (exclusivo) e dt1, ignorando sáb/dom."""
    if not dt0 or not dt1:
        return 0
    cur = dt0.date()
    end = dt1.date()
    dias = 0
    while cur < end:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            dias += 1
    return dias


def _tem_comentario_hoje(anotacoes, data_br):
    """True se as anotações têm alguma linha datada de HOJE (DD/MM/YYYY ou DD/MM).
    Usado para NÃO marcar como crítico itens que o atendente já comentou hoje
    (atendente já está atuando — não faz sentido sinalizar como travado)."""
    if not anotacoes:
        return False
    dmy = data_br          # '25/06/2026'
    dm = data_br[:5]       # '25/06'
    for linha in str(anotacoes).split('\n'):
        l = linha.strip()
        if l.startswith(f'[{dmy}]') or l.startswith(f'[{dm}]') or l.startswith(f'[{dm}/') \
           or l.startswith(f'{dm} -') or l.startswith(f'{dm} –') or l.startswith(f'{dmy} -'):
            return True
    return False


async def _auto_verificar_enviado_travado():
    """
    Marca como 'Verificar' (verificar_adneia=true) e adiciona nota na observação
    os atendimentos pendentes em 'Enviado' com +3 dias úteis sem movimentação no
    transporte (data_status do pedido). Idempotente via flag verificar_travado_auto.
    """
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": "Enviado", "verificar_travado_auto": {"$ne": True}},
        {"_id": 0, "id": 1, "numero_pedido": 1, "anotacoes": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}

    nums = [c["numero_pedido"] for c in chamados if c.get("numero_pedido")]
    peds = {}
    async for p in db.pedidos_erp.find({"numero_pedido": {"$in": nums}}, {"_id": 0, "numero_pedido": 1, "data_status": 1}):
        peds[p["numero_pedido"]] = p.get("data_status", "")

    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        dt = _parse_data_status(peds.get(c.get("numero_pedido")))
        if not dt:
            continue
        du = _dias_uteis_entre(dt, agora)
        if du <= 3:
            continue
        if _tem_comentario_hoje(c.get("anotacoes"), data_br):
            continue  # atendente já comentou hoje — não marca como crítico
        nota = f"[{data_br}] Entrou como crítico — {du} dias úteis sem movimentação no transporte"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, "verificar_travado_auto": True, "anotacoes": nova}}
        )
        marcados += 1
    logger.info(f"[auto-verificar-travado] {marcados} 'Enviado' marcados como crítico (+3 dias úteis)")
    return {"marcados": marcados}


async def _auto_verificar_logistica_travado():
    """
    Marca como 'Verificar' + nota os atendimentos pendentes em 'Ag. Logística'
    com +8 dias úteis sem movimentação no transporte (data_status).
    Idempotente via flag verificar_logistica_auto.
    """
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": "Ag. Logística", "verificar_logistica_auto": {"$ne": True}},
        {"_id": 0, "id": 1, "numero_pedido": 1, "anotacoes": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}

    nums = [c["numero_pedido"] for c in chamados if c.get("numero_pedido")]
    peds = {}
    async for p in db.pedidos_erp.find({"numero_pedido": {"$in": nums}}, {"_id": 0, "numero_pedido": 1, "data_status": 1, "status_pedido": 1}):
        peds[p["numero_pedido"]] = p

    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        p = peds.get(c.get("numero_pedido")) or {}
        # Vale para TODOS os Ag. Logística (inclusive 'Entregue a Transportadora'):
        # se não movimentou em +8 dias úteis, fica crítico mesmo estando no relatório.
        dt = _parse_data_status(p.get("data_status"))
        if not dt:
            continue
        du = _dias_uteis_entre(dt, agora)
        if du <= 8:
            continue
        if _tem_comentario_hoje(c.get("anotacoes"), data_br):
            continue  # atendente já comentou hoje — não marca como crítico
        nota = f"[{data_br}] Entrou como crítico — {du} dias úteis sem movimentação em Ag. Logística (status '{p.get('status_pedido','')}')"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, "verificar_logistica_auto": True, "anotacoes": nova}}
        )
        marcados += 1
    logger.info(f"[auto-verificar-logistica] {marcados} 'Ag. Logística' marcados como crítico (+8 dias úteis)")
    return {"marcados": marcados}


def _parse_anotacao_data(anotacoes):
    """Extrai a data da última anotação (1ª linha): '[DD/MM/YYYY] ...' ou 'DD/MM - ...'. None se não achar."""
    linha = (anotacoes or '').split('\n')[0].strip()
    m = re.match(r'^\[(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\]', linha) or \
        re.match(r'^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s*[-–]', linha)
    if not m:
        return None
    d, mo = int(m.group(1)), int(m.group(2))
    y = int(m.group(3)) if m.group(3) else datetime.now().year
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d, tzinfo=timezone(timedelta(hours=-3)))
    except Exception:
        return None


def _acao_cobranca_transportadora(motivo):
    """Ação de cobrança por transportadora, baseada no motivo Ag. Transportadora - X."""
    m = (motivo or '').lower()
    if 'j&t' in m or 'jt' in m:
        return 'acionar Merelin (J&T)'
    if 'total' in m:
        return 'enviar e-mail (Total)'
    if 'asap' in m:
        return 'mandar no grupo da CB (ASAP)'
    return 'cobrar a transportadora'


async def _auto_verificar_transportadora_parado():
    """
    Marca como 'Verificar' + nota os atendimentos pendentes em 'Ag. Transportadora - *'
    sem alteração (última anotação) há +5 dias úteis. Idempotente via verificar_transp_auto.
    """
    motivos = ["Ag. Transportadora - Asap", "Ag. Transportadora - J&T", "Ag. Transportadora - Total"]
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": {"$in": motivos}, "verificar_transp_auto": {"$ne": True}},
        {"_id": 0, "id": 1, "numero_pedido": 1, "anotacoes": 1, "motivo_pendencia": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}

    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        dt = _parse_anotacao_data(c.get("anotacoes"))
        if not dt:
            continue
        du = _dias_uteis_entre(dt, agora)
        if du <= 5:
            continue
        acao = _acao_cobranca_transportadora(c.get("motivo_pendencia"))
        nota = f"[{data_br}] Entrou como crítico — {du} dias úteis sem retorno da transportadora. Cobrar: {acao}"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, "verificar_transp_auto": True, "anotacoes": nova}}
        )
        marcados += 1
    logger.info(f"[auto-verificar-transp] {marcados} 'Ag. Transportadora' marcados como crítico (+5 dias úteis)")
    return {"marcados": marcados}


async def _auto_verificar_por_anotacao(motivo, limite_dias, flag, cobranca):
    """
    Genérico: marca 'Verificar' + nota os pendentes em `motivo` sem alteração
    (última anotação) há mais de `limite_dias` dias úteis. Idempotente via `flag`.
    `cobranca` = texto da ação (ex.: 'Cobrar o cliente no zap').
    """
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": motivo, flag: {"$ne": True}},
        {"_id": 0, "id": 1, "anotacoes": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}
    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        dt = _parse_anotacao_data(c.get("anotacoes"))
        if not dt:
            continue
        du = _dias_uteis_entre(dt, agora)
        if du <= limite_dias:
            continue
        nota = f"[{data_br}] Entrou como crítico — {du} dias úteis sem retorno. {cobranca}"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, flag: True, "anotacoes": nova}}
        )
        marcados += 1
    if marcados:
        logger.info(f"[auto-verificar] {marcados} '{motivo}' marcados como crítico (+{limite_dias} dias úteis)")
    return {"marcados": marcados}


async def _auto_verificar_compras_parado():
    """
    Marca como 'Verificar' + nota os atendimentos pendentes em 'Ag. Compras' que estão
    há +3 dias úteis ALÉM do prazo do fornecedor (mesmo prazo do Relatório Ag. Compras:
    dias_extras_padrao por fornecedor, default 5). Só aplica a 'aguardando estoque'.
    Idempotente via flag verificar_compras_auto.
    """
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": "Ag. Compras", "verificar_compras_auto": {"$ne": True}},
        {"_id": 0, "id": 1, "numero_pedido": 1, "anotacoes": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}

    # Prazo por fornecedor (igual ao relatório Ag. Compras)
    forn_prazo = {}
    async for f in db.fornecedores.find({}, {"_id": 0, "nome": 1, "dias_extras_padrao": 1}):
        forn_prazo[(f.get("nome") or "").lower()] = f.get("dias_extras_padrao", 5)

    nums = [c["numero_pedido"] for c in chamados if c.get("numero_pedido")]
    peds = {}
    async for p in db.pedidos_erp.find(
        {"numero_pedido": {"$in": nums}},
        {"_id": 0, "numero_pedido": 1, "status_pedido": 1, "data_status": 1, "departamento": 1}
    ):
        peds[p["numero_pedido"]] = p

    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        p = peds.get(c.get("numero_pedido")) or {}
        status = (p.get("status_pedido") or "").lower()
        if "aguardando estoque" not in status:
            continue  # prazo do fornecedor só se aplica em 'aguardando estoque'
        dias = calcular_dias_uteis(p.get("data_status", ""))
        prazo = forn_prazo.get((p.get("departamento") or "").lower(), 5)
        if dias <= prazo + 3:
            continue
        if _tem_comentario_hoje(c.get("anotacoes"), data_br):
            continue  # atendente já comentou hoje — não marca como crítico
        nota = f"[{data_br}] Entrou como crítico — {dias} dias úteis em estoque (prazo fornecedor {prazo} + 3). Acionar Flávia no grupo AET"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, "verificar_compras_auto": True, "anotacoes": nova}}
        )
        marcados += 1
    logger.info(f"[auto-verificar-compras] {marcados} 'Ag. Compras' marcados como crítico (+3 dias após prazo do fornecedor)")
    return {"marcados": marcados}


async def _auto_verificar_fornecedor_parado():
    """
    Marca como 'Verificar' + nota os atendimentos pendentes em 'Ag. Fornecedor'
    sem alteração (última anotação) há +3 dias úteis. Idempotente via verificar_fornecedor_auto.
    """
    chamados = await db.chamados.find(
        {"pendente": True, "motivo_pendencia": "Ag. Fornecedor", "verificar_fornecedor_auto": {"$ne": True}},
        {"_id": 0, "id": 1, "anotacoes": 1}
    ).to_list(5000)
    if not chamados:
        return {"marcados": 0}

    agora = datetime.now(timezone(timedelta(hours=-3)))
    data_br = agora.strftime("%d/%m/%Y")
    marcados = 0
    for c in chamados:
        dt = _parse_anotacao_data(c.get("anotacoes"))
        if not dt:
            continue
        du = _dias_uteis_entre(dt, agora)
        if du <= 3:
            continue
        nota = f"[{data_br}] Entrou como crítico — {du} dias úteis sem retorno do fornecedor. Cobrar no grupo AET"
        obs = c.get("anotacoes") or ""
        nova = (nota + ("\n" + obs if obs else "")).strip()
        await db.chamados.update_one(
            {"id": c["id"]},
            {"$set": {"verificar_adneia": True, "verificar_fornecedor_auto": True, "anotacoes": nova}}
        )
        marcados += 1
    logger.info(f"[auto-verificar-fornecedor] {marcados} 'Ag. Fornecedor' marcados como crítico (+3 dias úteis)")
    return {"marcados": marcados}


def _classificar_em_devolucao(motivo, codigo_reversa=None, reversa_postada=None):
    """
    Normaliza o motivo genérico 'Em devolução' pela regra da reversa:
      - tem reversa + postada pelo cliente → 'Em devolução - Correios'
      - tem reversa + ainda não postada    → 'Aguardando'
      - sem reversa                         → 'Em devolução - Transp.'
    Demais motivos passam inalterados. Garante que 'Em devolução' nunca persista genérico.
    """
    if motivo != 'Em devolução':
        return motivo
    if codigo_reversa:
        return 'Em devolução - Correios' if reversa_postada else 'Aguardando'
    return 'Em devolução - Transp.'


def sync_to_google_sheets(chamado_dict: dict, pedido: dict = None):
    try:
        from google_sheets import sheets_client
        sheets_client.add_atendimento(chamado_dict, pedido)
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {e}")


def sync_devolucao_to_sheets(chamado_dict: dict, pedido: dict = None):
    """
    Sincroniza a devolução na planilha de gestão (mesma usada pelo dialog).
    Usa add_devolucao_row (idempotente por numero_pedido — não duplica linha).
    devolvido_por: Correios quando tem reversa; senão a transportadora.
    """
    try:
        from google_sheets import sheets_client
        pedido = pedido or {}
        cr = chamado_dict.get('codigo_reversa') or chamado_dict.get('reversa_codigo') or ''
        transp = (pedido.get('transportadora') or chamado_dict.get('transportadora') or '').strip()
        if cr:
            devolvido_por = 'Correios'
        elif transp:
            t = transp.lower()
            if 'total' in t or 'tex' in t:
                devolvido_por = 'Total Express'
            elif 'j&t' in t or 'jt express' in t:
                devolvido_por = 'J&T'
            elif 'asap' in t:
                devolvido_por = 'ASAP Log'
            else:
                devolvido_por = transp
        else:
            devolvido_por = 'Transportadora'

        row_data = {
            'id_devolucao': f"DEV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
            'id_atendimento': chamado_dict.get('id_atendimento', ''),
            'data_entrada': datetime.now(timezone.utc).strftime('%d/%m/%Y'),
            'numero_pedido': chamado_dict.get('numero_pedido', ''),
            'cpf_cliente': chamado_dict.get('cpf_cliente') or pedido.get('cpf_cliente', ''),
            'nome_cliente': chamado_dict.get('nome_cliente') or pedido.get('nome_cliente', ''),
            'produto': chamado_dict.get('produto') or pedido.get('produto', ''),
            'filial': pedido.get('uf_galpao') or chamado_dict.get('filial', ''),
            'codigo_reversa': cr,
            'canal_vendas': chamado_dict.get('parceiro') or chamado_dict.get('canal_vendas') or pedido.get('canal_vendas', ''),
            'motivo': chamado_dict.get('motivo', ''),
            'solicitacao': chamado_dict.get('solicitacao', ''),
            'status': 'Em devolução',
            'responsavel': chamado_dict.get('atendente', ''),
            'atendimento': 'Ag. Estorno',
            'devolvido_por': devolvido_por,
            'status_galpao': 'AGUARDANDO',
        }
        sheets_client.add_devolucao_row(row_data)
        logger.info(f"[devolucao-sync] {row_data['numero_pedido']} sincronizado na planilha (auto)")
    except Exception as e:
        logger.error(f"Error syncing devolucao to Sheets: {e}")


def sync_update_to_google_sheets(numero_pedido: str, updates: dict, chamado_completo: dict = None, pedido_info: dict = None):
    try:
        from google_sheets import sheets_client
        sheets_client.update_atendimento(numero_pedido, updates)
        motivo_pendencia = updates.get('motivo_pendencia', '')
        if motivo_pendencia in ['Em devolução', 'Em devolução - Correios', 'Em devolução - Transp.', 'Devolvido'] and chamado_completo:
            chamado_merged = {**chamado_completo, **updates}
            sync_devolucao_to_sheets(chamado_merged, pedido_info)
    except Exception as e:
        logger.error(f"Error syncing update to Google Sheets: {e}")


# ============== GERAR REVERSA ==============

@router.post("/chamados/gerar-reversa")
async def gerar_reversa(data: dict, current_user: dict = Depends(get_current_user)):
    numero_pedido = data.get('numero_pedido')
    chamado_id = data.get('chamado_id')
    if not numero_pedido:
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    codigo = generate_reversa_code(numero_pedido)
    reversa = {
        "id": str(uuid.uuid4()),
        "chamado_id": chamado_id,
        "numero_pedido": numero_pedido,
        "codigo_reversa": codigo,
        "status": "Criada",
        "data_criacao": datetime.now(timezone.utc).isoformat(),
        "criado_por": current_user['name']
    }
    await db.reversas.insert_one(reversa)
    if chamado_id:
        await db.chamados.update_one(
            {"id": chamado_id},
            {"$set": {"codigo_reversa": codigo, "reversa_codigo": codigo}}
        )
    return {"codigo_reversa": codigo, "numero_pedido": numero_pedido}


# ============== CRUD CHAMADOS ==============

@router.post("/chamados", response_model=dict)
async def create_chamado(
    chamado_data: ChamadoCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if not chamado_data.numero_pedido.strip():
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    
    # Prevenir duplicatas: verificar se já existe chamado PENDENTE para este pedido
    chamado_existente = await db.chamados.find_one(
        {"numero_pedido": chamado_data.numero_pedido.strip(), "pendente": True},
        {"_id": 0, "id_atendimento": 1}
    )
    if chamado_existente:
        raise HTTPException(
            status_code=409,
            detail=f"Já existe um atendimento pendente ({chamado_existente.get('id_atendimento')}) para este pedido. Edite o existente ou encerre-o antes de criar um novo."
        )
    
    id_atendimento = await generate_atendimento_id()
    chamado = Chamado(**chamado_data.model_dump())
    chamado.id_atendimento = id_atendimento
    chamado.criado_por_id = current_user['id']
    chamado.criado_por_nome = current_user['name']
    # Normaliza espaços — "CSU " ≠ "CSU" quebra os filtros por igualdade exata
    if chamado.parceiro:
        chamado.parceiro = chamado.parceiro.strip()
    if chamado.categoria:
        chamado.categoria = chamado.categoria.strip()
    if not chamado.categoria_inicial:
        chamado.categoria_inicial = chamado.categoria
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado_data.numero_pedido}, {"_id": 0})
    if pedido:
        chamado.nome_cliente = pedido.get('nome_cliente')
        chamado.cpf_cliente = pedido.get('cpf_cliente')
        chamado.produto = pedido.get('produto')
        chamado.transportadora = pedido.get('transportadora')
        chamado.status_pedido = pedido.get('status_pedido')
        chamado.canal_vendas = pedido.get('canal_vendas')
        if not chamado.parceiro:
            chamado.parceiro = pedido.get('canal_vendas')
        # AJUSTE 1 - Regra permanente: preencher/atualizar motivo pelo status ERP ao criar
        novo_motivo = get_motivo_from_status(pedido.get('status_pedido', ''))
        if novo_motivo:
            # Se motivo está vazio OU se o motivo atual ainda é um motivo automático (não finalizado),
            # atualiza para refletir o status ERP mais atual
            motivos_auto = ["Ag. Compras", "Ag. Logística", "Enviado", "Entregue", ""]
            if not chamado.motivo_pendencia or chamado.motivo_pendencia in motivos_auto:
                chamado.motivo_pendencia = novo_motivo
    # Normaliza 'Em devolução' genérico → Correios/Transp./Aguardando pela reversa
    chamado.motivo_pendencia = _classificar_em_devolucao(
        chamado.motivo_pendencia,
        codigo_reversa=getattr(chamado, 'codigo_reversa', None),
        reversa_postada=getattr(chamado, 'reversa_postada', None),
    )
    chamado_dict = chamado.model_dump()
    chamado_dict['data_abertura'] = chamado_dict['data_abertura'].isoformat()
    if chamado_dict.get('data_fechamento'):
        chamado_dict['data_fechamento'] = chamado_dict['data_fechamento'].isoformat()
    await db.chamados.insert_one(chamado_dict)
    historico = Historico(
        chamado_id=chamado.id,
        tipo_acao="Atualização de Status",
        descricao=f"Atendimento {id_atendimento} criado - {chamado_data.categoria}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    background_tasks.add_task(sync_to_google_sheets, chamado_dict, pedido)

    # Notificar Adnéia quando um atendente iniciar os atendimentos do dia
    background_tasks.add_task(notificar_inicio_atendimentos, current_user)

    # Notificar Karina + Leticia em atendimentos CSU + Falha Integração
    background_tasks.add_task(notificar_csu_integracao, chamado_dict)
    
    return {
        "id": chamado.id,
        "id_atendimento": id_atendimento,
        "message": f"Atendimento {id_atendimento} criado com sucesso",
        "google_sheets_sync": "queued"
    }


@router.get("/chamados", response_model=List[dict])
async def list_chamados(
    pendente: Optional[bool] = None,
    categoria: Optional[str] = None,
    atendente: Optional[str] = None,
    parceiro: Optional[str] = None,
    retornar_chamado: Optional[bool] = None,
    verificar_adneia: Optional[bool] = None,
    motivo_pendencia: Optional[str] = None,
    search: Optional[str] = None,
    search_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if pendente is not None:
        query['pendente'] = pendente
    if categoria:
        query['categoria'] = categoria
    if atendente:
        query['atendente'] = atendente
    if parceiro:
        # AJUSTE 3: múltiplos parceiros (vírgula) + match case-insensitive
        # (tolera grafia SENFF/Senff, NiceQuest/Nicequest sem quebrar o filtro)
        import re as _re
        parceiros_list = [p.strip() for p in parceiro.split(',') if p.strip()]
        if parceiros_list:
            query['parceiro'] = {"$in": [_re.compile(f"^{_re.escape(p)}$", _re.IGNORECASE) for p in parceiros_list]}
    if retornar_chamado is not None:
        query['retornar_chamado'] = retornar_chamado
    if verificar_adneia is not None:
        query['verificar_adneia'] = verificar_adneia
    if motivo_pendencia:
        motivos_list = [m.strip() for m in motivo_pendencia.split(',') if m.strip()]
        if len(motivos_list) > 1:
            query['motivo_pendencia'] = {"$in": motivos_list}
        else:
            query['motivo_pendencia'] = motivos_list[0]
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        if search_type == 'solicitacao':
            query['solicitacao'] = search_regex
        elif search_type == 'entrega':
            query['numero_pedido'] = search_regex
        elif search_type == 'cpf':
            query['cpf_cliente'] = search_regex
        elif search_type == 'nome':
            query['nome_cliente'] = search_regex
        else:
            query['$or'] = [
                {"numero_pedido": search_regex},
                {"cpf_cliente": search_regex},
                {"nome_cliente": search_regex},
                {"solicitacao": search_regex},
                {"id_atendimento": search_regex}
            ]
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", -1).to_list(5000)
    now = datetime.now(timezone.utc)
    for c in chamados:
        try:
            data_abertura_raw = c.get('data_abertura')
            if isinstance(data_abertura_raw, str):
                data_abertura = datetime.fromisoformat(data_abertura_raw.replace('Z', '+00:00'))
            elif hasattr(data_abertura_raw, 'replace'):
                data_abertura = data_abertura_raw.replace(tzinfo=timezone.utc) if data_abertura_raw.tzinfo is None else data_abertura_raw
            else:
                data_abertura = now
            if data_abertura.tzinfo is None:
                data_abertura = data_abertura.replace(tzinfo=timezone.utc)
            c['dias_aberto'] = (now - data_abertura).days if c.get('pendente', True) else 0
        except Exception:
            c['dias_aberto'] = 0
        if not c.get('codigo_reversa') and c.get('reversa_codigo'):
            c['codigo_reversa'] = c['reversa_codigo']

    # Bulk query para pedidos_erp (evita N+1)
    pedido_numbers = [c.get('numero_pedido') for c in chamados if c.get('numero_pedido')]
    if pedido_numbers:
        pedidos = await db.pedidos_erp.find(
            {"numero_pedido": {"$in": pedido_numbers}},
            {"_id": 0, "numero_pedido": 1, "status_pedido": 1, "data_status": 1, "nome_cliente": 1, "cpf_cliente": 1, "pedido_externo": 1}
        ).to_list(len(pedido_numbers))
        pedidos_dict = {p['numero_pedido']: p for p in pedidos}
        for c in chamados:
            pedido = pedidos_dict.get(c.get('numero_pedido'))
            if pedido:
                c['status_pedido'] = pedido.get('status_pedido', '')
                c['data_ultimo_status'] = pedido.get('data_status', '')
                c['pedido_externo'] = pedido.get('pedido_externo', '')
                # Sempre buscar nome/CPF do ERP para garantir consistência entre duplicatas
                if pedido.get('nome_cliente'):
                    c['nome_cliente'] = pedido.get('nome_cliente')
                if pedido.get('cpf_cliente'):
                    c['cpf_cliente'] = pedido.get('cpf_cliente')

    return chamados


@router.get("/chamados/pendentes/lista", response_model=List[dict])
async def list_pendentes(atendente: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"pendente": True}
    if atendente:
        query['atendente'] = atendente
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", 1).to_list(5000)
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = parse_date_safe(c.get('data_abertura'))
        c['dias_aberto'] = (now - data_abertura).days
    return chamados


@router.get("/chamados/{chamado_id}", response_model=dict)
async def get_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    chamado = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}, {"_id": 0}
    )
    if not chamado:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")
    now = datetime.now(timezone.utc)
    data_abertura = parse_date_safe(chamado.get('data_abertura'))
    chamado['dias_aberto'] = (now - data_abertura).days if chamado.get('pendente', True) else 0
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado['numero_pedido']}, {"_id": 0})
    if pedido:
        chamado['pedido_erp'] = pedido
    reversa = await db.reversas.find_one({"chamado_id": chamado['id']}, {"_id": 0})
    if reversa:
        chamado['reversa'] = reversa
    return chamado


@router.put("/chamados/{chamado_id}", response_model=dict)
async def update_chamado(
    chamado_id: str,
    chamado_data: ChamadoUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    update_data = {k: v for k, v in chamado_data.model_dump().items() if v is not None}

    # Normaliza espaços — "CSU " ≠ "CSU" quebra os filtros por igualdade exata
    for _campo in ("parceiro", "categoria"):
        if isinstance(update_data.get(_campo), str):
            update_data[_campo] = update_data[_campo].strip()

    # Normaliza 'Em devolução' genérico → Correios/Transp./Aguardando pela reversa
    if update_data.get('motivo_pendencia') == 'Em devolução':
        _cr = update_data.get('codigo_reversa', existing.get('codigo_reversa'))
        _rp = update_data.get('reversa_postada', existing.get('reversa_postada'))
        update_data['motivo_pendencia'] = _classificar_em_devolucao('Em devolução', codigo_reversa=_cr, reversa_postada=_rp)

    # Reclame Aqui — registra data em que foi vinculado pela primeira vez
    sol_novo = (update_data.get('solicitacao') or '').lower()
    sol_antigo = (existing.get('solicitacao') or '').lower()
    if 'reclame aqui' in sol_novo and 'reclame aqui' not in sol_antigo and not existing.get('data_reclame_aqui'):
        update_data['data_reclame_aqui'] = datetime.now(timezone.utc).isoformat()

    # AJUSTE 2 — Limpar "Verificar" ao mudar Motivo de Pendência
    motivo_antigo = existing.get('motivo_pendencia', '')
    motivo_novo = update_data.get('motivo_pendencia', motivo_antigo)
    if motivo_novo != motivo_antigo and 'motivo_pendencia' in update_data:
        update_data['verificar_adneia'] = False
    if update_data.get('status_atendimento') == 'Fechado' and existing.get('status_atendimento') != 'Fechado':
        update_data['data_resolucao'] = datetime.now(timezone.utc).isoformat()
    if 'pendente' in update_data and not update_data['pendente'] and existing.get('pendente', True):
        update_data['data_fechamento'] = datetime.now(timezone.utc).isoformat()
        motivos_finalizadores = ["Entregue", "Estornado", "Atendido", "Em devolução", "Em devolução - Correios", "Em devolução - Transp.", "Devolvido", "Encerrado"]
        motivo_no_payload = update_data.get('motivo_pendencia') or None  # normaliza string vazia
        # Se um motivo finalizador foi explicitamente enviado no payload, preserva ele
        if motivo_no_payload and motivo_no_payload in motivos_finalizadores:
            motivo_final = motivo_no_payload  # preserva o motivo enviado
        else:
            # Sem motivo finalizador no payload — verifica o motivo atual do chamado
            motivo_referencia = motivo_no_payload or existing.get('motivo_pendencia', '')
            if not motivo_referencia or motivo_referencia not in motivos_finalizadores:
                update_data['motivo_pendencia'] = "Encerrado"
            motivo_final = update_data.get('motivo_pendencia', motivo_referencia)
        # Garantir que status_cliente reflete o motivo final ao encerrar
        if not update_data.get('status_cliente') and motivo_final:
            update_data['status_cliente'] = motivo_final
    if update_data:
        await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})
        if 'status_atendimento' in update_data or 'status_chamado' in update_data or 'pendente' in update_data:
            historico = Historico(
                chamado_id=chamado_id,
                tipo_acao="Atualização de Status",
                descricao=f"Status atualizado: {update_data.get('status_atendimento', '')} / Pendente: {'NÃO' if not update_data.get('pendente', True) else 'SIM'}",
                usuario_id=current_user['id'],
                usuario_nome=current_user['name']
            )
            hist_dict = historico.model_dump()
            hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
            await db.historico.insert_one(hist_dict)
        id_atendimento = existing.get('id_atendimento')
        numero_pedido_antigo = existing.get('numero_pedido')
        if id_atendimento and numero_pedido_antigo:
            chamado_completo = None
            pedido_info = None
            motivo_pendencia = update_data.get('motivo_pendencia', '')
            if motivo_pendencia in ['Em devolução', 'Em devolução - Correios', 'Em devolução - Transp.', 'Devolvido']:
                chamado_completo = await db.chamados.find_one({"id": chamado_id}, {"_id": 0})
                numero_pedido = existing.get('numero_pedido')
                if numero_pedido:
                    pedido_info = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
            background_tasks.add_task(sync_update_to_google_sheets, numero_pedido_antigo, update_data, chamado_completo, pedido_info)
    return {"message": "Chamado atualizado com sucesso", "google_sheets_sync": "queued"}


@router.post("/chamados/{chamado_id}/marcar-postado")
async def marcar_postado(
    chamado_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Checkpoint do 'Aguardando': cliente postou o item.
    Marca reversa como postada, muda o motivo para Em devolução (→ Correios pela reversa)
    e sincroniza na planilha de gestão de devolução (como se fosse manual).
    """
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    cr = existing.get('codigo_reversa') or existing.get('reversa_codigo') or ''
    agora = datetime.now(timezone(timedelta(hours=-3)))
    novo_motivo = _classificar_em_devolucao('Em devolução', codigo_reversa=cr, reversa_postada=True)
    nota = f"[{agora.strftime('%d/%m/%Y')}] Item postado pelo cliente — movido para {novo_motivo}"
    obs = existing.get('anotacoes') or ''
    nova_obs = (nota + ("\n" + obs if obs else "")).strip()

    update = {
        "reversa_postada": True,
        "data_postagem_reversa": agora.strftime('%Y-%m-%d'),
        "motivo_pendencia": novo_motivo,
        "anotacoes": nova_obs,
    }
    await db.chamados.update_one({"id": chamado_id}, {"$set": update})

    # Sincroniza atendimentos + planilha de devolução (o sync_update dispara a devolução)
    numero_pedido = existing.get('numero_pedido')
    chamado_completo = await db.chamados.find_one({"id": chamado_id}, {"_id": 0})
    pedido_info = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0}) if numero_pedido else None
    background_tasks.add_task(sync_update_to_google_sheets, numero_pedido, update, chamado_completo, pedido_info)

    return {"success": True, "motivo_pendencia": novo_motivo}


@router.put("/chamados/{chamado_id}/reabrir", response_model=dict)
async def reabrir_chamado(
    chamado_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    if existing.get('pendente', True):
        raise HTTPException(status_code=400, detail="Atendimento já está aberto")

    hoje = datetime.now(timezone.utc).strftime('%d/%m/%Y')
    anotacoes_atuais = existing.get('anotacoes', '')
    nova_anotacao = f"[{hoje}] *** ATENDIMENTO REABERTO por {current_user['name']} ***"
    novas_anotacoes = f"{nova_anotacao}\n\n{anotacoes_atuais}" if anotacoes_atuais else nova_anotacao

    update_data = {
        "pendente": True,
        "data_fechamento": None,
        "anotacoes": novas_anotacoes
    }
    await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})

    historico = Historico(
        chamado_id=chamado_id,
        tipo_acao="Reabertura",
        descricao=f"Atendimento reaberto por {current_user['name']}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)

    numero_pedido = existing.get('numero_pedido')
    if numero_pedido:
        background_tasks.add_task(sync_update_to_google_sheets, numero_pedido, update_data)

    return {"message": "Atendimento reaberto com sucesso"}


@router.delete("/chamados/{chamado_id}", response_model=dict)
async def delete_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    """Exclui um atendimento e notifica a Adnéia."""
    existing = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")

    id_atendimento = existing.get('id_atendimento', chamado_id)
    numero_pedido = existing.get('numero_pedido', '')
    nome_cliente = existing.get('nome_cliente', '')

    # Remover chamado
    await db.chamados.delete_one({"_id": existing["_id"]})

    # Remover histórico associado
    await db.historico.delete_many({"chamado_id": existing.get("id")})

    # Registrar notificação para Adnéia
    notificacao = {
        "id": str(uuid.uuid4()),
        "tipo": "exclusao_atendimento",
        "titulo": "Atendimento Excluído",
        "mensagem": f"Atendimento {id_atendimento} (Pedido: {numero_pedido} - {nome_cliente}) foi excluído por {current_user['name']}",
        "destinatario_email": "adneia@weconnect360.com.br",
        "excluido_por_nome": current_user['name'],
        "id_atendimento": id_atendimento,
        "numero_pedido": numero_pedido,
        "data_criacao": datetime.now(timezone.utc).isoformat(),
        "lida": False
    }
    await db.notifications.insert_one(notificacao)

    logger.info(f"Atendimento {id_atendimento} excluído por {current_user['name']}")
    return {"success": True, "message": f"Atendimento {id_atendimento} excluído com sucesso"}


# ============== MESCLAR ==============

@router.post("/chamados/{id_principal}/mesclar", response_model=dict)
async def mesclar_chamados(
    id_principal: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    id_secundario = data.get('id_secundario')
    if not id_secundario:
        raise HTTPException(status_code=400, detail="id_secundario é obrigatório")

    principal = await db.chamados.find_one({"id_atendimento": id_principal}, {"_id": 0})
    secundario = await db.chamados.find_one({"id_atendimento": id_secundario}, {"_id": 0})

    if not principal:
        raise HTTPException(status_code=404, detail=f"Chamado {id_principal} não encontrado")
    if not secundario:
        raise HTTPException(status_code=404, detail=f"Chamado {id_secundario} não encontrado")

    now = datetime.now(timezone.utc)
    data_str = now.strftime("%d/%m/%Y %H:%M")

    sol_sec = (secundario.get('solicitacao') or '').strip()
    anot_sec = (secundario.get('anotacoes') or '').strip()

    merge_note = (
        f"\n[{data_str}] *** ATENDIMENTO {id_secundario} FOI MESCLADO *** "
        f"Cliente acionou via a seguinte solicitação: {sol_sec} "
        f"E consta as seguintes anotações: {anot_sec}"
    )

    anotacoes_atual = principal.get('anotacoes') or ''
    updates = {"anotacoes": anotacoes_atual + merge_note}

    # Se secundário tem reversa e principal não, transfere
    if secundario.get('codigo_reversa') and not principal.get('codigo_reversa'):
        updates['codigo_reversa'] = secundario.get('codigo_reversa')
        updates['data_vencimento_reversa'] = secundario.get('data_vencimento_reversa', '')

    await db.chamados.update_one({"id_atendimento": id_principal}, {"$set": updates})
    await db.chamados.delete_one({"id_atendimento": id_secundario})

    logger.info(f"Atendimento {id_secundario} mesclado em {id_principal} por {current_user['name']}")
    return {"success": True, "message": f"Atendimento {id_secundario} mesclado em {id_principal}"}


# ============== HISTORICO ==============

@router.post("/historico", response_model=dict)
async def create_historico(data: dict, current_user: dict = Depends(get_current_user)):
    historico = Historico(
        chamado_id=data['chamado_id'],
        tipo_acao=data.get('tipo_acao', 'Nota'),
        descricao=data.get('descricao', ''),
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    return {"id": historico.id, "message": "Histórico criado com sucesso"}


@router.get("/historico/{chamado_id}", response_model=List[dict])
async def get_historico(chamado_id: str, current_user: dict = Depends(get_current_user)):
    return await db.historico.find({"chamado_id": chamado_id}, {"_id": 0}).sort("data_hora", -1).to_list(100)


# ============== REVERSAS ==============

@router.get("/reversas", response_model=List[dict])
async def list_reversas(current_user: dict = Depends(get_current_user)):
    return await db.reversas.find({}, {"_id": 0}).sort("data_criacao", -1).to_list(500)


@router.get("/reversas/{reversa_id}", response_model=dict)
async def get_reversa(reversa_id: str, current_user: dict = Depends(get_current_user)):
    reversa = await db.reversas.find_one({"id": reversa_id}, {"_id": 0})
    if not reversa:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    return reversa


@router.put("/reversas/{reversa_id}", response_model=dict)
async def update_reversa(reversa_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    result = await db.reversas.update_one({"id": reversa_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    return {"message": "Reversa atualizada com sucesso"}
