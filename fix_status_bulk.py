"""
Corrige em lote os pedidos_erp do MongoDB cujo status_pedido está como
'Entregue ao Cliente' mas a view v_elo_tabelao agora retorna um status diferente
(porque o rastreio da transportadora tem prioridade após a correção da view).
"""
import asyncio, os, sys, psycopg2
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from datetime import datetime, timezone
    from utils.database import db

    print('1. Buscando status corretos na view PostgreSQL...')
    conn = psycopg2.connect(
        host='weconnect-postgres', port=5432, dbname='bigdata',
        user='weconnect', password='WeConn3ct2026Prod'
    )
    cur = conn.cursor()

    # Pega da view todos os pedidos cujo status_da_entrega != 'Entregue ao Cliente'
    # Esses são os candidatos a correção (a view agora diz outra coisa)
    cur.execute("""
        SELECT DISTINCT ON (entrega)
            entrega,
            status_da_entrega,
            dt_ult_ponto_controle
        FROM v_elo_tabelao
        WHERE status_da_entrega IS NOT NULL
          AND status_da_entrega <> 'Entregue ao Cliente'
    """)
    rows = cur.fetchall()
    conn.close()
    print(f'   View retornou {len(rows)} pedidos com status diferente de "Entregue ao Cliente"')

    # Monta dict: entrega → (status_correto, dt_ult_ponto)
    view_status = {str(r[0]): (r[1], r[2]) for r in rows}

    print('2. Buscando pedidos_erp no MongoDB com status "Entregue ao Cliente"...')
    cursor = db.pedidos_erp.find(
        {'status_pedido': 'Entregue ao Cliente'},
        {'numero_pedido': 1, 'status_pedido': 1, '_id': 0}
    )
    mongo_docs = await cursor.to_list(length=None)
    print(f'   MongoDB: {len(mongo_docs)} pedidos com status "Entregue ao Cliente"')

    print('3. Cruzando e corrigindo...')
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    skipped = 0

    for doc in mongo_docs:
        num = doc['numero_pedido']
        if num in view_status:
            novo_status, dt_ult = view_status[num]
            update_fields = {
                'status_pedido': novo_status,
                'synced_at': now,
            }
            if dt_ult:
                update_fields['data_status'] = dt_ult.isoformat() if hasattr(dt_ult, 'isoformat') else str(dt_ult)

            await db.pedidos_erp.update_one(
                {'numero_pedido': num},
                {'$set': update_fields}
            )
            updated += 1
        else:
            skipped += 1  # view confirma "Entregue ao Cliente" — está correto

    print(f'\n✅ CONCLUÍDO')
    print(f'   Corrigidos: {updated}')
    print(f'   Mantidos (view confirma "Entregue ao Cliente"): {skipped}')

    # Distribuição dos novos status
    if updated > 0:
        print('\n   Distribuição dos status corrigidos:')
        pipeline = [
            {'$match': {'synced_at': now, 'status_pedido': {'$ne': 'Entregue ao Cliente'}}},
            {'$group': {'_id': '$status_pedido', 'n': {'$sum': 1}}},
            {'$sort': {'n': -1}},
            {'$limit': 15}
        ]
        grupos = await db.pedidos_erp.aggregate(pipeline).to_list(None)
        for g in grupos:
            print(f"     {g['_id']}: {g['n']}")

asyncio.run(main())
