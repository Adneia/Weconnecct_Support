import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # List all collections
    cols = await db.list_collection_names()
    cancel_cols = [c for c in cols if 'cancel' in c.lower() or 'aes' in c.lower() or 'etr' in c.lower() or 'erro' in c.lower()]
    print('=== Coleções relacionadas ===')
    for c in cancel_cols:
        count = await db[c].count_documents({})
        print(f'  {c}: {count} docs')

    print('\n=== Todas as coleções ===')
    for c in sorted(cols):
        print(f'  {c}')

asyncio.run(main())
