import asyncio, sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']
    docs = await db.chamados.find({'motivo_pendencia': 'Aguardando'}, {'numero_pedido': 1, 'codigo_reversa': 1, '_id': 0}).to_list(20)
    print('Aguardando chamados:')
    for d in docs:
        np = d.get('numero_pedido')
        rev = d.get('codigo_reversa')
        print(f'  {np} -> reversa: {repr(rev)}')

asyncio.run(check())
