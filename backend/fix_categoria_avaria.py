import asyncio, sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']
    result = await db.chamados.update_many(
        {'categoria': 'Produto com Avaria'},
        {'$set': {'categoria': 'Falha Transporte'}}
    )
    print(f'Atualizados: {result.modified_count} chamados')

asyncio.run(fix())
