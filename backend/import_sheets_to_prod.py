"""
Script: Importar atendimentos do Google Sheets para o servidor de produção
Lê a planilha Atendimentos 2026_E e envia via API para http://204.168.189.55:5010
"""
import gspread
from google.oauth2.service_account import Credentials
import requests
import uuid
from datetime import datetime, timezone

# ── Configurações ──────────────────────────────────────────────────────────────
PROD_URL = "http://204.168.189.55:5010"
PROD_EMAIL = "adneia@weconnect360.com.br"
PROD_SENHA = "20wead"
SPREADSHEET_ID = "1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs"
CREDENTIALS_FILE = "credentials.json"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# ── Helpers ────────────────────────────────────────────────────────────────────
def parse_bool(value: str) -> bool:
    return str(value).strip().upper() == "SIM"

def parse_date(value: str):
    if not value or not value.strip():
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return None

def s(val) -> str:
    """Converte qualquer valor para string segura."""
    return str(val).strip() if val is not None else ""

def row_to_chamado(row: dict) -> dict:
    pendente = parse_bool(row.get("Pendente", "NÃO"))
    motivo_pendencia = s(row.get("Motivo_Pendencia", ""))
    return {
        "id": str(uuid.uuid4()),
        "id_atendimento": s(row.get("ID_Atendimento", "")),
        "numero_pedido": s(row.get("Entrega", "")),
        "solicitacao": s(row.get("Solicitação", "")) or None,
        "parceiro": s(row.get("Parceiro", "")) or None,
        "categoria": s(row.get("Categoria", "")),
        "categoria_inicial": s(row.get("Categoria", "")),
        "motivo": s(row.get("Motivo", "")) or None,
        "anotacoes": s(row.get("Anotações", "")) or None,
        "pendente": pendente,
        "motivo_pendencia": motivo_pendencia or None,
        "status_cliente": motivo_pendencia if not pendente else None,
        "verificar_adneia": parse_bool(row.get("Verificar", "NÃO")),
        "retornar_chamado": parse_bool(row.get("Retornar", "NÃO")),
        "codigo_reversa": s(row.get("Reversa", "")) or None,
        "reversa_codigo": s(row.get("Reversa", "")) or None,
        "nome_cliente": s(row.get("Nome", "")) or None,
        "cpf_cliente": s(row.get("CPF", "")) or None,
        "status_pedido": s(row.get("Status_Pedido", "")) or None,
        "nota": s(row.get("Nota", "")) or None,
        "chave_acesso": s(row.get("Chave_Acesso", "")) or None,
        "filial": s(row.get("Filial", "")) or None,
        "atendente": "Importação Emergent",
        "data_abertura": parse_date(row.get("Data", "")) or datetime.now(timezone.utc).isoformat(),
        "data_fechamento": parse_date(row.get("DT_Encerramento", "")),
        "criado_por_nome": "Importação Google Sheets",
    }

# ── 1. Login na produção ───────────────────────────────────────────────────────
print("🔐 Fazendo login na produção...")
resp = requests.post(f"{PROD_URL}/api/auth/login",
    json={"email": PROD_EMAIL, "password": PROD_SENHA}, timeout=10)
resp.raise_for_status()
token = resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"   ✅ Token obtido")

# ── 2. Ler Google Sheets ───────────────────────────────────────────────────────
print("\n📊 Lendo planilha Atendimentos 2026_E...")
creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
client = gspread.authorize(creds)
sh = client.open_by_key(SPREADSHEET_ID)
ws = sh.sheet1
all_rows = ws.get_all_records()
print(f"   ✅ {len(all_rows)} linhas encontradas")

# ── 3. Verificar existentes na produção ───────────────────────────────────────
print("\n🔍 Verificando chamados já existentes na produção...")
resp = requests.get(f"{PROD_URL}/api/chamados?limit=5000", headers=headers, timeout=30)
existentes = set()
if resp.status_code == 200:
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", data.get("chamados", []))
    existentes = {c.get("id_atendimento", "") for c in items if c.get("id_atendimento")}
print(f"   ✅ {len(existentes)} já existem — serão ignorados")

# ── 4. Importar ───────────────────────────────────────────────────────────────
print(f"\n🚀 Importando atendimentos...")
ok = 0
skip = 0
erro = 0

for i, row in enumerate(all_rows):
    if not row.get("ID_Atendimento", "").strip():
        skip += 1
        continue

    if row.get("ID_Atendimento", "").strip() in existentes:
        skip += 1
        continue

    chamado = row_to_chamado(row)

    try:
        r = requests.post(f"{PROD_URL}/api/chamados/import",
            json=chamado, headers=headers, timeout=15)
        if r.status_code in (200, 201):
            ok += 1
        else:
            # Tenta endpoint padrão se /import não existir
            r2 = requests.post(f"{PROD_URL}/api/chamados",
                json=chamado, headers=headers, timeout=15)
            if r2.status_code in (200, 201):
                ok += 1
            else:
                erro += 1
                if erro <= 3:
                    print(f"   ⚠️  Erro linha {i+2}: {r2.status_code} - {r2.text[:100]}")
    except Exception as e:
        erro += 1
        if erro <= 3:
            print(f"   ❌ Exceção linha {i+2}: {e}")

    if (ok + skip + erro) % 100 == 0:
        print(f"   ... {ok} importados | {skip} ignorados | {erro} erros")

# ── 5. Resultado ───────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"✅ Importados:  {ok}")
print(f"⏭️  Ignorados:   {skip} (sem ID ou já existiam)")
print(f"❌ Erros:       {erro}")
print(f"{'='*50}")
