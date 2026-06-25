import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Todos os canais/parceiros disponíveis nos chamados
    print('=== Parceiros distintos nos chamados ===')
    vals = await db.chamados.distinct('parceiro')
    for v in sorted(set(str(x) for x in vals if x)):
        print(f'  {v}')

    print('\n=== Canais distintos nos pedidos_erp ===')
    vals2 = await db.pedidos_erp.distinct('canal_vendas')
    for v in sorted(set(str(x) for x in vals2 if x)):
        print(f'  {v}')

asyncio.run(main())
