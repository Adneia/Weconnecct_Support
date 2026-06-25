import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import certifi

MONGO_URL = 'mongodb+srv://adneiafatima_db_user:20wead25@cluster0.ghl5g2r.mongodb.net/?appName=Cluster0&retryWrites=true&w=majority'
DB_NAME = 'elo-tickets-dev'

texto = 'Olá,\n\nInformo que solicitamos o comprovante de entrega assinado, pedimos a gentileza de aguardar 5 dias úteis.\n\nAtenciosamente,\n[ASSINATURA]'

async def run():
    client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
    db = client[DB_NAME]
    # Remove duplicatas se já existirem
    await db.textos_por_motivo.delete_many({
        'titulo': 'Comprovante Solicitado',
        'motivo': {'$in': ['Ag. Transportadora - Asap', 'Ag. Transportadora - J&T', 'Ag. Transportadora - Total']}
    })
    docs = [
        {'motivo': 'Ag. Transportadora - Asap', 'causa': 'Comprovante de Entrega', 'titulo': 'Comprovante Solicitado', 'texto': texto},
        {'motivo': 'Ag. Transportadora - J&T',  'causa': 'Comprovante de Entrega', 'titulo': 'Comprovante Solicitado', 'texto': texto},
        {'motivo': 'Ag. Transportadora - Total', 'causa': 'Comprovante de Entrega', 'titulo': 'Comprovante Solicitado', 'texto': texto},
    ]
    result = await db.textos_por_motivo.insert_many(docs)
    print(f'OK: {len(result.inserted_ids)} documentos inseridos')
    client.close()

asyncio.run(run())
