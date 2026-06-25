import psycopg2, sys

conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata', user='weconnect', password='WeConn3ct2026Prod')
conn.autocommit = True
cur = conn.cursor()

with open('/tmp/fix_view3.sql') as f:
    sql = f.read()

try:
    cur.execute(sql)
    print('VIEW CRIADA')
except Exception as e:
    print('ERRO view:', e)
    sys.exit(1)

cur.execute("SELECT cidade, cep, endereco_rua, endereco_numero, endereco_bairro FROM v_elo_tabelao WHERE entrega = '122193299'")
print('122193299 (Antonio - Piracicaba):', cur.fetchone())

cur.execute("SELECT cidade, cep, endereco_rua, endereco_numero, endereco_bairro FROM v_elo_tabelao WHERE entrega = '120392061'")
print('120392061 (Vanessa - Esmeraldas):', cur.fetchone())

conn.close()
