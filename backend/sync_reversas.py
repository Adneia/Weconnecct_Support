"""
Sincroniza codigo_reversa da planilha Google Sheets para o MongoDB.
Faz lookup por numero_pedido (coluna Entrega) para máxima cobertura.
"""
import asyncio
from google.oauth2.service_account import Credentials
import gspread
import sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient

SPREADSHEET_ID = '1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

async def sync():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']

    creds = Credentials.from_service_account_file('/app/credentials.json', scopes=SCOPES)
    client = gspread.authorize(creds)
    ws = client.open_by_key(SPREADSHEET_ID).sheet1
    all_rows = ws.get_all_records()
    print(f'Planilha: {len(all_rows)} linhas')

    atualizados = 0
    sem_reversa = 0

    for row in all_rows:
        reversa = str(row.get('Reversa', '') or '').strip()
        if not reversa:
            sem_reversa += 1
            continue

        entrega = str(row.get('Entrega', '') or '').strip().replace('.0', '')
        aid = str(row.get('ID_Atendimento', '') or '').strip()

        # Busca por numero_pedido OU id_atendimento
        query = {}
        if entrega and entrega.isdigit():
            query = {'numero_pedido': entrega}
        elif aid:
            query = {'id_atendimento': aid}
        else:
            continue

        chamado = await db.chamados.find_one(query, {'_id': 0, 'id_atendimento': 1, 'codigo_reversa': 1})
        if not chamado:
            continue

        existing = str(chamado.get('codigo_reversa', '') or '').strip()
        if existing == reversa:
            continue

        result = await db.chamados.update_one(query, {'$set': {'codigo_reversa': reversa}})
        if result.modified_count > 0:
            atualizados += 1
            print(f'  {entrega or aid}: {existing or "(vazio)"} → {reversa}')

    print(f'\nConcluído: {atualizados} reversas atualizadas, {sem_reversa} linhas sem reversa')

asyncio.run(sync())
