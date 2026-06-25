import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from utils.database import db
    from datetime import datetime, timezone

    # Corrigir: status 'aberto' deve ser 'pendente'
    result = await db.cancelamentos.update_many(
        {'status': 'aberto'},
        {'$set': {
            'status': 'pendente',
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    print(f'Corrigidos: {result.modified_count} registros (aberto → pendente)')

    # Verificar resultado
    for tipo in ['aes', 'etr', 'erro_nota']:
        total    = await db.cancelamentos.count_documents({'tipo': tipo})
        pendente = await db.cancelamentos.count_documents({'tipo': tipo, 'status': 'pendente'})
        enc      = await db.cancelamentos.count_documents({'tipo': tipo, 'status': 'encerrado'})
        aberto   = await db.cancelamentos.count_documents({'tipo': tipo, 'status': 'aberto'})
        print(f'{tipo}: total={total}, pendente={pendente}, encerrado={enc}, aberto={aberto}')

asyncio.run(main())
