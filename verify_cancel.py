import asyncio, os, sys, json
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db

    # Verify counts by status
    for tipo in ['aes', 'etr', 'erro_nota']:
        total = await db.cancelamentos.count_documents({'tipo': tipo})
        aberto = await db.cancelamentos.count_documents({'tipo': tipo, 'status': 'aberto'})
        enc = await db.cancelamentos.count_documents({'tipo': tipo, 'status': 'encerrado'})
        print(f'{tipo}: total={total}, aberto={aberto}, encerrado={enc}')

    # Sample: first AES aberto
    print('\n=== Amostra AES aberto ===')
    doc = await db.cancelamentos.find_one({'tipo': 'aes', 'status': 'aberto'})
    if doc:
        doc['_id'] = str(doc['_id'])
        fields = ['numero_pedido','acao','ticket','instancia','observacao','data_encerramento','status','updated_at']
        print(json.dumps({k: doc.get(k) for k in fields}, ensure_ascii=False, indent=2))

    # Sample: first ETR inserted (novo)
    print('\n=== ETR inserido (novo) ===')
    doc = await db.cancelamentos.find_one({'tipo': 'etr', 'criado_por': 'Importação Planilha'})
    if doc:
        doc['_id'] = str(doc['_id'])
        fields = ['numero_pedido','parceiro_planilha','motivo','acao','ticket','observacao','data_encerramento','status']
        print(json.dumps({k: doc.get(k) for k in fields}, ensure_ascii=False, indent=2))

asyncio.run(main())
