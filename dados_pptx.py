"""Extrai dados atualizados para o PPTX (Jan-Mai 2026 com Maio até 26/05)."""
import asyncio, os, sys, json, psycopg2
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # ── Chamados por mês e categoria ──────────────────────────────────────
    pipeline = [
        {'$match': {'categoria': {'$in': [
            'Falha Produção','Falha Transporte',
            'Falha Compras','Falha de Compras'
        ]}}},
        {'$addFields': {'mes': {'$month': {'$toDate': '$data_abertura'}}}},
        {'$group': {
            '_id': {'mes': '$mes', 'cat': '$categoria'},
            'n': {'$sum': 1}
        }},
        {'$sort': {'_id.mes': 1}}
    ]
    docs = await db.chamados.aggregate(pipeline).to_list(None)

    meses = {1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai'}
    cats_map = {
        'Falha Produção': 'producao',
        'Falha Transporte': 'transporte',
        'Falha Compras': 'compras',
        'Falha de Compras': 'compras',
    }

    chamados = {cat: {m: 0 for m in range(1,6)} for cat in ['producao','transporte','compras']}
    for d in docs:
        mes = d['_id']['mes']
        cat = cats_map.get(d['_id']['cat'])
        if cat and mes in chamados[cat]:
            chamados[cat][mes] += d['n']

    print('=== Chamados por mês ===')
    for cat, vals in chamados.items():
        print(f'{cat}: {[vals[m] for m in range(1,6)]}')

    # ── Vendas (pedidos faturados) por mês ───────────────────────────────
    conn = psycopg2.connect(host='weconnect-postgres', port=5432, dbname='bigdata',
                            user='weconnect', password='WeConn3ct2026Prod')
    cur = conn.cursor()
    cur.execute("""
        SELECT EXTRACT(MONTH FROM data_pedido) AS mes, COUNT(DISTINCT id_entrega) AS pedidos
        FROM pedidos
        WHERE data_pedido >= '2026-01-01'
          AND data_pedido < '2026-06-01'
          AND is_deleted = false
          AND num_nf_saida IS NOT NULL
        GROUP BY 1 ORDER BY 1
    """)
    vendas = {int(r[0]): int(r[1]) for r in cur.fetchall()}
    conn.close()

    print('\n=== Vendas por mês ===')
    for m in range(1,6):
        print(f'  Mês {m}: {vendas.get(m,0)}')

    # ── Taxas proporcionais ───────────────────────────────────────────────
    print('\n=== Taxa % (chamados/vendas) ===')
    taxas = {}
    for cat in ['producao','transporte','compras']:
        taxas[cat] = []
        for m in range(1,6):
            v = vendas.get(m,0)
            c = chamados[cat][m]
            t = round(c/v*100, 2) if v else 0
            taxas[cat].append(t)
        print(f'{cat}: {taxas[cat]}')

    # ── Salva resultado ───────────────────────────────────────────────────
    result = {
        'vendas': [vendas.get(m,0) for m in range(1,6)],
        'chamados': {cat: [chamados[cat][m] for m in range(1,6)] for cat in ['producao','transporte','compras']},
        'taxas': taxas,
        'meses': ['Jan','Fev','Mar','Abr','Mai'],
    }
    with open('/tmp/dados_pptx.json','w') as f:
        json.dump(result, f)
    print('\nSalvo em /tmp/dados_pptx.json')

asyncio.run(main())
