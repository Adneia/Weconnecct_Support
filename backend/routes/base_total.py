"""
Módulo: Base Total
Importação e consulta do rastreio AWB da Total Express.
CSV com separador ';', coluna C (idx 2) = AWB, coluna AJ (idx 35) = NOTAFISCAL.

Lógica de importação:
- AWB igual ao anterior → só atualiza status/data
- AWB diferente do anterior → guarda awb_anterior, usa novo AWB como rastreio
- Nota não presente no arquivo → marca descricao_status = "AWB EXCLUÍDO"
"""
import csv
import io
import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File
from datetime import datetime, timezone
from utils.auth import get_current_user
from utils.database import db
from pymongo import UpdateOne

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/api/base-total/importar")
async def importar_base_total(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Importa o CSV da Base Total (detecta separador ';' ou ',' automaticamente).
    - AWB novo → atualiza, guarda anterior em awb_anterior
    - Nota ausente no arquivo → marca como AWB EXCLUÍDO (apenas dentro da faixa de NFs do arquivo)
    """
    content = await file.read()
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    # Detecta separador automaticamente analisando a primeira linha
    primeira_linha = text.split("\n", 1)[0] if text else ""
    n_semis = primeira_linha.count(";")
    n_virgulas = primeira_linha.count(",")
    delimitador = ";" if n_semis > n_virgulas else ","
    logger.info(f"[base_total] separador detectado: '{delimitador}' (semis={n_semis}, virgulas={n_virgulas})")

    reader = csv.reader(io.StringIO(text), delimiter=delimitador)
    try:
        next(reader)  # pula cabeçalho
    except StopIteration:
        return {"ok": False, "message": "Arquivo vazio"}

    # 1. Carregar estado atual da base (para comparar AWBs)
    existentes = await db.base_total.find(
        {}, {"nota_fiscal": 1, "awb": 1, "_id": 0}
    ).to_list(None)
    awb_atual = {d["nota_fiscal"]: d["awb"] for d in existentes}

    # 2. Processar CSV
    ops = []
    notas_no_arquivo = set()
    count = 0
    novos = 0
    atualizados = 0
    atualizados_awb = 0  # AWB mudou
    erros = 0

    agora = datetime.now(timezone.utc).isoformat()

    for row in reader:
        if len(row) < 36:
            erros += 1
            continue
        try:
            nota_fiscal = str(row[35]).strip().split(".")[0]
            awb = str(row[2]).strip()
            if not nota_fiscal or not awb or nota_fiscal == "0":
                erros += 1
                continue

            notas_no_arquivo.add(nota_fiscal)

            doc = {
                "nota_fiscal": nota_fiscal,
                "awb": awb,
                "descricao_status": str(row[15]).strip() if len(row) > 15 else "",
                "data_status": str(row[14]).strip() if len(row) > 14 else "",
                "destinatario": str(row[18]).strip() if len(row) > 18 else "",
                "previsao_entrega": str(row[17]).strip() if len(row) > 17 else "",
                "updated_at": agora,
            }

            # Conta novos vs atualizados
            ja_existia = nota_fiscal in awb_atual
            if ja_existia:
                atualizados += 1
                # Se AWB mudou, guardar o anterior
                awb_antigo = awb_atual.get(nota_fiscal)
                if awb_antigo and awb_antigo != awb:
                    doc["awb_anterior"] = awb_antigo
                    atualizados_awb += 1
            else:
                novos += 1

            ops.append(UpdateOne(
                {"nota_fiscal": nota_fiscal},
                {
                    "$set": doc,
                    "$setOnInsert": {"criado_em": agora},
                },
                upsert=True,
            ))
            count += 1

            # Flush em lotes de 500
            if len(ops) >= 500:
                await db.base_total.bulk_write(ops, ordered=False)
                ops = []

        except Exception as e:
            logger.warning(f"Erro na linha: {e}")
            erros += 1
            continue

    if ops:
        await db.base_total.bulk_write(ops, ordered=False)

    # 3. NÃO marca mais NFs como "AWB EXCLUÍDO" automaticamente.
    #    Motivo: os arquivos da Total Express têm conteúdo variável
    #    (alguns são "completos" do mês, outros são "em andamento" filtrado por status).
    #    Marcar automaticamente como EXCLUÍDO causaria perda de dados válidos.
    #    O upload agora é apenas upsert (insert ou update).
    excluidos = 0

    # 4. Garantir índice único
    try:
        await db.base_total.create_index("nota_fiscal", unique=True)
    except Exception:
        pass

    # 5. Notificar todos os usuários
    try:
        user_name = current_user.get("name") or current_user.get("email", "Sistema")
        partes = [f"{count} registros processados"]
        if novos:
            partes.append(f"{novos} novos")
        if atualizados:
            partes.append(f"{atualizados} atualizados")
        if atualizados_awb:
            partes.append(f"{atualizados_awb} AWB reemitido")
        if excluidos:
            partes.append(f"{excluidos} marcados como AWB Excluído")
        if erros:
            partes.append(f"{erros} ignorados")
        mensagem = f"Base Total Express importada por {user_name}. {', '.join(partes)}."

        usuarios = await db.users.find({}, {"email": 1, "_id": 0}).to_list(50)
        for usuario in usuarios:
            notif = {
                "id": str(uuid.uuid4()),
                "tipo": "import_concluida",
                "titulo": "Base Total Atualizada",
                "mensagem": mensagem,
                "destinatario_email": usuario["email"],
                "dados_extras": {
                    "importados": count,
                    "novos": novos,
                    "atualizados": atualizados,
                    "atualizados_awb": atualizados_awb,
                    "excluidos": excluidos,
                    "erros": erros,
                },
                "data_criacao": datetime.now(timezone.utc).isoformat(),
                "lida": False,
                "criado_por_nome": "Sistema",
            }
            await db.notifications.insert_one(notif)
    except Exception as e:
        logger.warning(f"Erro ao criar notificação Base Total: {e}")

    # Monta mensagem detalhada de retorno
    msg_partes = [f"{count} registros processados"]
    msg_partes.append(f"{novos} novos")
    msg_partes.append(f"{atualizados} atualizados")
    msg_partes.append(f"{atualizados_awb} AWB reemitido")
    if excluidos:
        msg_partes.append(f"{excluidos} excluídos")
    msg_partes.append(f"{erros} ignorados")

    return {
        "ok": True,
        "importados": count,
        "novos": novos,
        "atualizados": atualizados,
        "atualizados_awb": atualizados_awb,
        "excluidos": excluidos,
        "erros": erros,
        "message": f"{msg_partes[0]} ({', '.join(msg_partes[1:])}).",
    }


@router.get("/api/base-total/{nota_fiscal}")
async def get_awb_by_nota(
    nota_fiscal: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Retorna AWB e status da Total Express para uma nota fiscal.
    """
    nota = str(nota_fiscal).strip().split(".")[0]
    doc = await db.base_total.find_one({"nota_fiscal": nota}, {"_id": 0})
    if not doc:
        return {"nota_fiscal": nota, "awb": None, "descricao_status": None}
    return doc


@router.get("/api/bases-manuais/status")
async def status_bases_manuais(current_user: dict = Depends(get_current_user)):
    """
    Retorna status das bases manuais (Total Express + J&T):
    total de registros e última atualização.
    """
    total_count = await db.base_total.count_documents({})
    bt_last = await db.base_total.find_one({}, {"updated_at": 1, "_id": 0}, sort=[("updated_at", -1)])

    jt_count = await db.base_jt.count_documents({})
    jt_last = await db.base_jt.find_one({}, {"updated_at": 1, "_id": 0}, sort=[("updated_at", -1)])

    return {
        "base_total": {
            "total": total_count,
            "ultima_atualizacao": bt_last.get("updated_at") if bt_last else None,
        },
        "base_jt": {
            "total": jt_count,
            "ultima_atualizacao": jt_last.get("updated_at") if jt_last else None,
        },
    }
