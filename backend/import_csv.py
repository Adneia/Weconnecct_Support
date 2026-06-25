"""
Script para importar atendimentos do CSV da planilha Google Sheets para o MongoDB local.
Uso: python import_csv.py <caminho_do_csv>
"""
import csv
import uuid
import sys
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

def normalize_cpf(cpf_raw) -> str:
    """Remove formatação do CPF e completa com zeros à esquerda até 11 dígitos."""
    if not cpf_raw:
        return None
    digits = ''.join(c for c in str(cpf_raw) if c.isdigit())
    return digits.zfill(11) if digits else None

def parse_bool(value: str) -> bool:
    return value.strip().upper() == "SIM"

def parse_date(value: str):
    """Retorna string ISO para compatibilidade com queries do backend."""
    if not value or not value.strip():
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return None

def csv_to_chamado(row: dict) -> dict:
    pendente_str = row.get("Pendente", "NÃO").strip().upper()
    pendente = pendente_str == "SIM"

    data_abertura = parse_date(row.get("Data", ""))
    data_fechamento = parse_date(row.get("DT_Encerramento", ""))

    # Status cliente baseado em Motivo_Pendencia quando não pendente
    motivo_pendencia = row.get("Motivo_Pendencia", "").strip()
    status_pedido = row.get("Status_Pedido", "").strip()

    return {
        "id": str(uuid.uuid4()),
        "id_atendimento": row.get("ID_Atendimento", "").strip(),
        "numero_pedido": row.get("Entrega", "").strip(),
        "solicitacao": row.get("Solicitação", "").strip() or None,
        "parceiro": row.get("Parceiro", "").strip() or None,
        "categoria": row.get("Categoria", "").strip(),
        "categoria_inicial": row.get("Categoria", "").strip(),
        "motivo": row.get("Motivo", "").strip() or None,
        "anotacoes": row.get("Anotações", "").strip() or None,
        "pendente": pendente,
        "motivo_pendencia": motivo_pendencia or None,
        "status_cliente": motivo_pendencia if not pendente else None,
        "verificar_adneia": parse_bool(row.get("Verificar", "NÃO")),
        "retornar_chamado": parse_bool(row.get("Retornar", "NÃO")),
        "codigo_reversa": row.get("Reversa", "").strip() or None,
        "reversa_codigo": row.get("Reversa", "").strip() or None,
        "nome_cliente": row.get("Nome", "").strip() or None,
        "cpf_cliente": normalize_cpf(row.get("CPF", "").strip()),
        "status_pedido": status_pedido or None,
        "nota": row.get("Nota", "").strip() or None,
        "chave_acesso": row.get("Chave_Acesso", "").strip() or None,
        "filial": row.get("Filial", "").strip() or None,
        "tempo": row.get("Tempo", "").strip() or None,
        "atendente": "Adnéia Campos",
        "data_abertura": data_abertura or datetime.now(timezone.utc).isoformat(),
        "data_fechamento": data_fechamento,
        "criado_por_id": None,
        "criado_por_nome": "Importação CSV",
    }

async def main(csv_path: str):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db["chamados"]

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        chamados = []
        for row in reader:
            # Pula linhas sem ID de atendimento
            if not row.get("ID_Atendimento", "").strip():
                continue
            chamados.append(csv_to_chamado(row))

    if not chamados:
        print("Nenhum atendimento encontrado no CSV.")
        return

    print(f"Importando {len(chamados)} atendimentos...")

    # Upsert por id_atendimento (evita duplicatas se rodar novamente)
    inserted = 0
    updated = 0
    for chamado in chamados:
        result = await collection.update_one(
            {"id_atendimento": chamado["id_atendimento"]},
            {"$set": chamado},
            upsert=True
        )
        if result.upserted_id:
            inserted += 1
        else:
            updated += 1

    print(f"OK: {inserted} inseridos, {updated} atualizados.")
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        csv_path = r"C:\Users\DELL\Downloads\Atendimentos 2026_E - Página1.csv"
    else:
        csv_path = sys.argv[1]

    print(f"Lendo: {csv_path}")
    asyncio.run(main(csv_path))
