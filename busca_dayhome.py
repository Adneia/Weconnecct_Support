import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Busca em chamados e cancelamentos por dayhome
    query = {'$or': [
        {'parceiro':    {'$regex': 'dayhome', '$options': 'i'}},
        {'canal_vendas':{'$regex': 'dayhome', '$options': 'i'}},
        {'nome_cliente':{'$regex': 'dayhome', '$options': 'i'}},
    ]}

    print('=== CHAMADOS ===')
    docs = await db.chamados.find(query, {'_id': 0}).sort('data_abertura', -1).to_list(None)
    print(f'Total: {len(docs)}')
    for d in docs:
        print(json.dumps(d, default=str, ensure_ascii=False))

    print('\n=== CANCELAMENTOS ===')
    docs2 = await db.cancelamentos.find(query, {'_id': 0}).sort('data', -1).to_list(None)
    print(f'Total: {len(docs2)}')
    for d in docs2:
        print(json.dumps(d, default=str, ensure_ascii=False))

asyncio.run(main())
