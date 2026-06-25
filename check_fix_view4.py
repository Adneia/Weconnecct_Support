import psycopg2

conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata',
                        user='weconnect', password='WeConn3ct2026Prod')
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
    SELECT entrega, status_da_entrega, dt_ult_ponto_controle
    FROM v_elo_tabelao
    WHERE entrega = '122626317'
    LIMIT 1
""")
r = cur.fetchone()
print(f'122626317 → status={r[1]!r}, ult_ponto={r[2]!r}')
print('Esperado: "Entregue a Transportadora"')

conn.close()
