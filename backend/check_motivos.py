import asyncio, sys, os
sys.path.insert(0, '/app')
os.chdir('/app')
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    db = AsyncIOMotorClient('mongodb://elo-mongo:27017')['elo_weconnect']

    for motivo in ['Ag. cliente', 'Ag. Cliente', 'Ag. Parceiro']:
        docs = await db.textos_por_motivo.find({'motivo': motivo}, {'_id': 0, 'causa': 1, 'titulo': 1}).to_list(50)
        print(f'\n{motivo} ({len(docs)} textos):')
        for d in docs:
            print(f'  causa={d.get("causa")} | titulo={d.get("titulo")}')

asyncio.run(check())
