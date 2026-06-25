import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']

    # ── Ag. Logística ──────────────────────────────────────────────────────────
    doc = await db.textos_por_motivo.find_one({'motivo': 'Ag. Log\u00edstica', 'titulo': 'J&T Express'})
    if doc and '[CHAVE_ACESSO]' not in doc['texto']:
        novo = doc['texto'].replace('Chave de acesso:', 'Chave de acesso: [CHAVE_ACESSO]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Ag.Log J&T ok')

    doc = await db.textos_por_motivo.find_one({'motivo': 'Ag. Log\u00edstica', 'titulo': 'ASAP Log'})
    if doc and '[NOTA_FISCAL]' not in doc['texto']:
        novo = doc['texto'].replace('Nota Fiscal:', 'Nota Fiscal: [NOTA_FISCAL]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Ag.Log ASAP ok')

    doc = await db.textos_por_motivo.find_one({'motivo': 'Ag. Log\u00edstica', 'titulo': 'Total Express'})
    if doc and '[C\u00d3DIGO_RASTREIO]' not in doc['texto']:
        novo = doc['texto'].replace('Rastreio:', 'Rastreio: [C\u00d3DIGO_RASTREIO]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Ag.Log Total ok')

    # ── Enviado ────────────────────────────────────────────────────────────────
    doc = await db.textos_por_motivo.find_one({'motivo': 'Enviado', 'titulo': 'J&T Express'})
    if doc and '[CHAVE_ACESSO]' not in doc['texto']:
        novo = doc['texto'].replace('Chave de acesso:', 'Chave de acesso: [CHAVE_ACESSO]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Enviado J&T ok')

    doc = await db.textos_por_motivo.find_one({'motivo': 'Enviado', 'titulo': 'ASAP Log'})
    if doc and '[NOTA_FISCAL]' not in doc['texto']:
        novo = doc['texto'].replace('Nota Fiscal:', 'Nota Fiscal: [NOTA_FISCAL]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Enviado ASAP ok')

    doc = await db.textos_por_motivo.find_one({'motivo': 'Enviado', 'titulo': 'Total Express'})
    if doc and '[C\u00d3DIGO_RASTREIO]' not in doc['texto']:
        novo = doc['texto'].replace('Rastreio:', 'Rastreio: [C\u00d3DIGO_RASTREIO]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Enviado Total ok')

    doc = await db.textos_por_motivo.find_one({'motivo': 'Enviado', 'titulo': 'Correios'})
    if doc and '[C\u00d3DIGO_RASTREIO]' not in doc['texto']:
        novo = doc['texto'].replace('Rastreio:', 'Rastreio: [C\u00d3DIGO_RASTREIO]')
        await db.textos_por_motivo.update_one({'_id': doc['_id']}, {'$set': {'texto': novo}})
        print('Enviado Correios ok')

    print('Concluido!')

asyncio.run(fix())
