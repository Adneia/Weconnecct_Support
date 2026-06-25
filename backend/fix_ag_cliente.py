import asyncio, sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']
    result = await db.textos_por_motivo.update_many(
        {'motivo': 'Ag. cliente'},
        {'$set': {'motivo': 'Ag. Cliente'}}
    )
    print(f'Atualizados: {result.modified_count} documentos')
    total = await db.textos_por_motivo.count_documents({'motivo': 'Ag. Cliente'})
    print(f'Total Ag. Cliente agora: {total}')

asyncio.run(fix())
