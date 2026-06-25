import psycopg2, json

conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata',
                        user='weconnect', password='WeConn3ct2026Prod')
conn.autocommit = True
cur = conn.cursor()

entrega = '122626317'

print('=== pedidos ===')
cur.execute("""
    SELECT id_entrega, status, ponto, data_pedido, updated_at
    FROM pedidos
    WHERE id_entrega = %s
    ORDER BY updated_at DESC LIMIT 3
""", (entrega,))
for r in cur.fetchall():
    print(r)

print('\n=== tracking_eventos (últimos 5) ===')
cur.execute("""
    SELECT pedido_bseller, descricao, data_ocorrencia
    FROM tracking_eventos
    WHERE pedido_bseller = %s
    ORDER BY data_ocorrencia DESC LIMIT 5
""", (entrega,))
for r in cur.fetchall():
    print(r)

print('\n=== v_elo_tabelao ===')
cur.execute("""
    SELECT entrega, status_da_entrega, dt_ult_ponto_controle, nota, cidade, uf
    FROM v_elo_tabelao
    WHERE entrega = %s
    LIMIT 3
""", (entrega,))
for r in cur.fetchall():
    print(r)

conn.close()
