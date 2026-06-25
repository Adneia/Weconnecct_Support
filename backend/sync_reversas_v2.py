"""
Sincroniza codigo_reversa da planilha para MongoDB.
Busca por id_atendimento E numero_pedido.
"""
import asyncio, sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient
from google.oauth2.service_account import Credentials
import gspread

SPREADSHEET_ID = '1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

async def sync():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']

    creds = Credentials.from_service_account_file('/app/credentials.json', scopes=SCOPES)
    client = gspread.authorize(creds)
    ws = client.open_by_key(SPREADSHEET_ID).sheet1
    all_rows = ws.get_all_records()
    print(f'Planilha: {len(all_rows)} linhas')

    # Index rows by entrega e por id_atendimento
    by_entrega = {}
    by_aid = {}
    for row in all_rows:
        reversa = str(row.get('Reversa', '') or '').strip()
        entrega = str(row.get('Entrega', '') or '').strip().replace('.0', '')
        aid = str(row.get('ID_Atendimento', '') or '').strip()
        if reversa:
            if entrega:
                by_entrega[entrega] = reversa
            if aid:
                by_aid[aid] = reversa

    print(f'Registros com reversa na planilha: entrega={len(by_entrega)}, aid={len(by_aid)}')

    # Buscar todos os chamados sem reversa (None ou '')
    all_docs = await db.chamados.find(
        {},
        {'id': 1, 'id_atendimento': 1, 'numero_pedido': 1, 'codigo_reversa': 1, '_id': 0}
    ).to_list(10000)

    atualizados = 0
    for doc in all_docs:
        existing = str(doc.get('codigo_reversa') or '').strip()
        entrega = str(doc.get('numero_pedido') or '').strip()
        aid = str(doc.get('id_atendimento') or '').strip()

        # Buscar reversa na planilha
        reversa = by_entrega.get(entrega) or by_aid.get(aid)
        if not reversa:
            continue
        if existing == reversa:
            continue

        await db.chamados.update_one(
            {'id_atendimento': aid},
            {'$set': {'codigo_reversa': reversa}}
        )
        atualizados += 1
        print(f'  {entrega} ({aid}): {repr(existing) or "(vazio)"} -> {reversa}')

    print(f'\nConcluído: {atualizados} reversas atualizadas')

asyncio.run(sync())
