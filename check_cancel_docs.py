import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Count by tipo
    pipeline = [{'$group': {'_id': '$tipo', 'count': {'$sum': 1}}}]
    tipos = await db.cancelamentos.aggregate(pipeline).to_list(None)
    print('=== Por tipo ===')
    for t in sorted(tipos, key=lambda x: x['_id'] or ''):
        print(f"  tipo={t['_id']!r}: {t['count']} docs")

    # Sample doc of each type
    print('\n=== Exemplo AES ===')
    doc = await db.cancelamentos.find_one({'tipo': 'AES'})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    print('\n=== Exemplo ETR ===')
    doc = await db.cancelamentos.find_one({'tipo': 'ETR'})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    print('\n=== Exemplo Erro Nota ===')
    doc = await db.cancelamentos.find_one({'tipo': {'$in': ['ERRO_NOTA', 'erro_nota', 'Erro Nota', 'ERRO NA NOTA']}})
    if not doc:
        # try any remaining type
        tipos_list = [t['_id'] for t in tipos]
        outros = [t for t in tipos_list if t not in ['AES', 'ETR']]
        print(f'Tipos disponíveis: {tipos_list}')
        if outros:
            doc = await db.cancelamentos.find_one({'tipo': outros[0]})
    if doc:
        doc['_id'] = str(doc['_id'])
        print(json.dumps(doc, default=str, ensure_ascii=False, indent=2))

asyncio.run(main())
