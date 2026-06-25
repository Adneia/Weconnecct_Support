import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db
    from datetime import datetime, timezone

    hoje = datetime.now(timezone.utc)
    categorias = ['Falha Compras', 'Falha de Compras', 'Falha Produção', 'Falha Transporte']

    docs = await db.chamados.find(
        {'categoria': {'$in': categorias}},
        {'_id': 0}
    ).to_list(length=None)

    # Normaliza categoria
    for d in docs:
        if d.get('categoria') in ('Falha Compras', 'Falha de Compras'):
            d['categoria_norm'] = 'Falha Compras'
        elif d.get('categoria') == 'Falha Produção':
            d['categoria_norm'] = 'Falha Produção'
        else:
            d['categoria_norm'] = 'Falha Transporte'

        # Dias em aberto
        try:
            dt = datetime.fromisoformat(d.get('data_abertura','').replace('Z','+00:00'))
            d['dias_aberto'] = (hoje - dt).days
        except:
            d['dias_aberto'] = ''

    # Salva JSON para o script local processar
    with open('/tmp/chamados_relatorio.json', 'w', encoding='utf-8') as f:
        json.dump(docs, f, default=str, ensure_ascii=False)

    # Resumo por categoria e motivo
    from collections import defaultdict, Counter
    resumo = defaultdict(Counter)
    for d in docs:
        cat = d['categoria_norm']
        motivo = d.get('motivo') or 'Sem motivo'
        resumo[cat][motivo] += 1

    print(json.dumps({k: dict(v) for k,v in resumo.items()}, ensure_ascii=False, indent=2))
    print(f'\nTotal docs: {len(docs)}')

asyncio.run(main())
