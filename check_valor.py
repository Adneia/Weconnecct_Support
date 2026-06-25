import psycopg2

conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata',
                        user='weconnect', password='WeConn3ct2026Prod')
cur = conn.cursor()

cur.execute("""
    SELECT
        EXTRACT(MONTH FROM data_pedido) AS mes,
        COUNT(DISTINCT id_entrega)      AS pedidos,
        ROUND(SUM(valor_total)::numeric, 2)          AS valor_total,
        ROUND(SUM(valor_total_entrega)::numeric, 2)  AS valor_entrega,
        ROUND(AVG(valor_total)::numeric, 2)          AS ticket_medio
    FROM pedidos
    WHERE data_pedido >= '2026-01-01'
      AND data_pedido < '2026-06-01'
      AND is_deleted = false
      AND num_nf_saida IS NOT NULL
    GROUP BY 1
    ORDER BY 1
""")
rows = cur.fetchall()
print('mes | pedidos | valor_total | valor_entrega | ticket_medio')
for r in rows:
    print(r)

# Check what columns exist
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pedidos'
      AND column_name ILIKE '%valor%'
""")
print('\nColunas valor*:', [r[0] for r in cur.fetchall()])
conn.close()
