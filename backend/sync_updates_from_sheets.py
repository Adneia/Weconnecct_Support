"""
Script: Sincronizar atualizações do Google Sheets para produção
Lê a planilha Atendimentos 2026_E e atualiza campos que mudaram nos atendimentos existentes.
Campos sincronizados: Anotações, Pendente, Motivo_Pendencia, Verificar, Retornar,
                      DT_Encerramento, Reversa, Status_Pedido
"""
import gspread
from google.oauth2.service_account import Credentials
import requests
from datetime import datetime, timezone

PROD_URL = "http://204.168.189.55:5010"
PROD_EMAIL = "adneia@weconnect360.com.br"
PROD_SENHA = "20wead"
SPREADSHEET_ID = "1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs"
CREDENTIALS_FILE = "credentials.json"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

def parse_bool(value):
    return str(value).strip().upper() == "SIM"

def parse_date(value):
    if not value or not str(value).strip():
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(str(value).strip(), fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return None

def s(val):
    return str(val).strip() if val is not None else ""

# 1. Login
print("Fazendo login na producao...")
resp = requests.post(f"{PROD_URL}/api/auth/login",
    json={"email": PROD_EMAIL, "password": PROD_SENHA}, timeout=10)
resp.raise_for_status()
token = resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print("  Login OK")

# 2. Ler planilha
print("\nLendo planilha Atendimentos 2026_E...")
creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
client = gspread.authorize(creds)
sh = client.open_by_key(SPREADSHEET_ID)
ws = sh.sheet1
all_rows = ws.get_all_records()
print(f"  {len(all_rows)} linhas encontradas")

# 3. Buscar todos os chamados existentes na producao (indexados por id_atendimento)
print("\nBuscando chamados existentes na producao...")
resp = requests.get(f"{PROD_URL}/api/chamados?limit=5000", headers=headers, timeout=30)
chamados_prod = {}
if resp.status_code == 200:
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", data.get("chamados", []))
    for c in items:
        aid = c.get("id_atendimento", "")
        if aid:
            chamados_prod[aid] = c
print(f"  {len(chamados_prod)} chamados carregados")

# 4. Comparar e atualizar
print("\nComparando e atualizando...")
atualizados = 0
sem_diff = 0
erros = 0

for row in all_rows:
    aid = s(row.get("ID_Atendimento", ""))
    if not aid:
        continue

    prod = chamados_prod.get(aid)
    if not prod:
        continue  # nao existe na producao (seria importado pelo outro script)

    # Montar payload de atualização apenas com campos diferentes
    updates = {}

    anotacoes_sheet = s(row.get("Anotacoes", "") or row.get("Anotações", ""))
    anotacoes_prod  = s(prod.get("anotacoes", ""))
    if anotacoes_sheet and anotacoes_sheet != anotacoes_prod:
        updates["anotacoes"] = anotacoes_sheet

    pendente_sheet = parse_bool(row.get("Pendente", "NAO"))
    pendente_prod  = bool(prod.get("pendente", True))
    if pendente_sheet != pendente_prod:
        updates["pendente"] = pendente_sheet

    motivo_sheet = s(row.get("Motivo_Pendencia", ""))
    motivo_prod  = s(prod.get("motivo_pendencia", ""))
    if motivo_sheet != motivo_prod:
        updates["motivo_pendencia"] = motivo_sheet or None

    verificar_sheet = parse_bool(row.get("Verificar", "NAO"))
    verificar_prod  = bool(prod.get("verificar_adneia", False))
    if verificar_sheet != verificar_prod:
        updates["verificar_adneia"] = verificar_sheet

    retornar_sheet = parse_bool(row.get("Retornar", "NAO"))
    retornar_prod  = bool(prod.get("retornar_chamado", False))
    if retornar_sheet != retornar_prod:
        updates["retornar_chamado"] = retornar_sheet

    reversa_sheet = s(row.get("Reversa", ""))
    reversa_prod  = s(prod.get("codigo_reversa", "") or prod.get("reversa_codigo", ""))
    if reversa_sheet and reversa_sheet != reversa_prod:
        updates["codigo_reversa"] = reversa_sheet

    dt_enc_sheet = parse_date(row.get("DT_Encerramento", ""))
    dt_enc_prod  = s(prod.get("data_fechamento", ""))
    if dt_enc_sheet and not dt_enc_prod:
        updates["data_fechamento"] = dt_enc_sheet

    if not updates:
        sem_diff += 1
        continue

    # Enviar PATCH/PUT para a API usando o campo "id" (UUID) do chamado
    chamado_uuid = s(prod.get("id", ""))
    if not chamado_uuid:
        erros += 1
        continue

    try:
        r = requests.put(
            f"{PROD_URL}/api/chamados/{chamado_uuid}",
            json=updates,
            headers=headers,
            timeout=15
        )
        if r.status_code in (200, 201, 204):
            atualizados += 1
            campos = ", ".join(updates.keys())
            print(f"  [{aid}] atualizado: {campos}")
        else:
            erros += 1
            if erros <= 5:
                print(f"  [{aid}] ERRO {r.status_code}: {r.text[:120]}")
    except Exception as e:
        erros += 1
        if erros <= 5:
            print(f"  [{aid}] EXCECAO: {e}")

print(f"\n{'='*50}")
print(f"Atualizados:  {atualizados}")
print(f"Sem diff:     {sem_diff}")
print(f"Erros:        {erros}")
print(f"{'='*50}")
