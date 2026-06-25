import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Pendentes AES sem canal_vendas E sem parceiro_planilha
    sem_parceiro = await db.cancelamentos.count_documents({
        'tipo': 'aes',
        'status': {'$ne': 'encerrado'},
        '$or': [
            {'canal_vendas': {'$in': [None, '']}},
            {'canal_vendas': {'$exists': False}}
        ],
        '$and': [
            {'$or': [
                {'parceiro_planilha': {'$in': [None, '']}},
                {'parceiro_planilha': {'$exists': False}}
            ]}
        ]
    })
    total_pend = await db.cancelamentos.count_documents({'tipo': 'aes', 'status': {'$ne': 'encerrado'}})
    print(f'AES pendentes total: {total_pend}')
    print(f'AES pendentes SEM canal_vendas E SEM parceiro_planilha: {sem_parceiro}')

    # Distribuição por canal_vendas dos pendentes
    pipeline = [
        {'$match': {'tipo': 'aes', 'status': {'$ne': 'encerrado'}}},
        {'$group': {'_id': {'canal': '$canal_vendas', 'parceiro': '$parceiro_planilha'}, 'n': {'$sum': 1}}},
        {'$sort': {'n': -1}},
        {'$limit': 20}
    ]
    grupos = await db.cancelamentos.aggregate(pipeline).to_list(None)
    print('\nDistribuição canal_vendas / parceiro_planilha (pendentes AES):')
    for g in grupos:
        print(f"  canal={g['_id']['canal']!r}, parceiro={g['_id']['parceiro']!r}: {g['n']}")

asyncio.run(main())
