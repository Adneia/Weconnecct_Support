import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Ver categorias disponíveis nos chamados
    print('=== Categorias nos chamados ===')
    pipeline = [
        {'$group': {'_id': '$categoria', 'n': {'$sum': 1}}},
        {'$sort': {'n': -1}}
    ]
    cats = await db.chamados.aggregate(pipeline).to_list(None)
    for c in cats:
        print(f"  {c['_id']!r}: {c['n']}")

    # Ver campos de um chamado com falha de compras
    print('\n=== Exemplo chamado Falha Compras ===')
    doc = await db.chamados.find_one({'categoria': {'$regex': 'compra', '$options': 'i'}})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    # Chamados por categoria com falha*, contar hoje e total
    print('\n=== Chamados Falha* (total e abertos) ===')
    pipeline2 = [
        {'$match': {'categoria': {'$regex': 'falha', '$options': 'i'}}},
        {'$group': {
            '_id': '$categoria',
            'total': {'$sum': 1},
            'abertos': {'$sum': {'$cond': [{'$ne': ['$status', 'encerrado']}, 1, 0]}},
            'encerrados': {'$sum': {'$cond': [{'$eq': ['$status', 'encerrado']}, 1, 0]}},
        }},
        {'$sort': {'total': -1}}
    ]
    res = await db.chamados.aggregate(pipeline2).to_list(None)
    for r in res:
        print(f"  {r['_id']}: total={r['total']}, abertos={r['abertos']}, encerrados={r['encerrados']}")

    # Ver campos disponíveis para relatório
    print('\n=== Campos de um chamado Falha Transporte ===')
    doc = await db.chamados.find_one({'categoria': {'$regex': 'transporte', '$options': 'i'}})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

asyncio.run(main())
