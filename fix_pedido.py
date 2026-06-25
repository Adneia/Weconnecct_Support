import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    import psycopg2
    from datetime import datetime, timezone
    from utils.database import db

    conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata', user='weconnect', password='WeConn3ct2026Prod')
    cur = conn.cursor()
    cur.execute("SELECT status_da_entrega, dt_ult_ponto_controle FROM v_elo_tabelao WHERE entrega = '122589939'")
    row = cur.fetchone()
    conn.close()

    novo_status = row[0]
    nova_data = row[1]

    result = await db.pedidos_erp.update_one(
        {'numero_pedido': '122589939'},
        {'$set': {
            'status_pedido': novo_status,
            'data_status': nova_data,
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    print(f'Atualizado: {result.modified_count} doc')
    print(f'Novo status: {novo_status}')
    print(f'Nova data: {nova_data}')

asyncio.run(main())
