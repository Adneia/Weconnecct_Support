import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    print('=== Exemplo aes ===')
    doc = await db.cancelamentos.find_one({'tipo': 'aes'})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    print('\n=== Exemplo etr ===')
    doc = await db.cancelamentos.find_one({'tipo': 'etr'})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

asyncio.run(main())
