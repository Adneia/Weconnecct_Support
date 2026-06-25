import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db
    doc = await db.cancelamentos.find_one({'tipo':'aes','canal_vendas':{'$regex':'loyalty','$options':'i'}})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    # check se pedidos_erp tem pedido_bseller para LL
    print('\n--- pedidos_erp LL sample ---')
    p = await db.pedidos_erp.find_one({'canal_vendas':{'$regex':'loyalty','$options':'i'}})
    if p:
        p['_id'] = str(p['_id'])
        fields = ['numero_pedido','canal_vendas','pedido_bseller','nome_cliente','cpf_cliente','produto']
        print({k:p.get(k) for k in fields})

asyncio.run(main())
