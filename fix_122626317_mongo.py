import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from datetime import datetime, timezone
    from utils.database import db

    result = await db.pedidos_erp.update_one(
        {'numero_pedido': '122626317'},
        {'$set': {
            'status_pedido': 'Entregue a Transportadora',
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    print(f'Modificados: {result.modified_count}')

    doc = await db.pedidos_erp.find_one(
        {'numero_pedido': '122626317'},
        {'status_pedido': 1, 'numero_pedido': 1, '_id': 0}
    )
    print('MongoDB agora:', doc)

asyncio.run(main())
