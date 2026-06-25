"""Verifica se pedidos Aguardando têm reversa na planilha"""
import sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from google.oauth2.service_account import Credentials
import gspread

SPREADSHEET_ID = '1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

PEDIDOS_AGUARDANDO = ['119991084', '119589529', '118976676', '120083289', '120211035', '120371467', '119462136', '119682620']

creds = Credentials.from_service_account_file('/app/credentials.json', scopes=SCOPES)
client = gspread.authorize(creds)
ws = client.open_by_key(SPREADSHEET_ID).sheet1
all_rows = ws.get_all_records()

print('Verificando pedidos Aguardando na planilha:')
for row in all_rows:
    entrega = str(row.get('Entrega', '') or '').strip().replace('.0', '')
    if entrega in PEDIDOS_AGUARDANDO:
        print(f"  {entrega}: Reversa={repr(row.get('Reversa', ''))}, ID={row.get('ID_Atendimento', '')}, Motivo={row.get('Motivo_Pendencia', '')}")
