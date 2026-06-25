import asyncio, os, sys
sys.path.insert(0, '/app')
os.environ['MONGO_URL'] = 'mongodb://elo-mongo-test:27017'
os.environ['DB_NAME'] = 'elo_weconnect'

async def main():
    from datetime import datetime, timezone
    from utils.database import db

    # Endereço correto do sac_entregas_rastreio para 122193299
    result = await db.pedidos_erp.update_one(
        {'numero_pedido': '122193299'},
        {'$set': {
            'endereco_rua': 'RECANTO CONVIVIO DOS PASSAROS',
            'endereco_numero': '601',
            'endereco_complemento': 'PRIMEIRA CASA À ESQUERDA DEPOIS DO PONTO FINAL DA',
            'endereco_bairro': 'PAU D ALHINHO',
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    print(f'Modificados: {result.modified_count}')
    doc = await db.pedidos_erp.find_one({'numero_pedido': '122193299'}, {'endereco_rua':1,'endereco_numero':1,'endereco_bairro':1,'_id':0})
    print('MongoDB agora:', doc)

asyncio.run(main())
