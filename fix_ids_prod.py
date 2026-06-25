"""
FIX: Adicionar UUID em chamados com id=None no MongoDB de producao
Rodar DENTRO do container Docker do backend:
  docker exec elo-backend python fix_ids_prod.py
"""
import uuid
from pymongo import MongoClient

# Conexao interna ao MongoDB (dentro do Docker)
client = MongoClient("mongodb://localhost:27018/")
db = client["elo-tickets"]

chamados = db.chamados

# Buscar todos sem id
sem_id = list(chamados.find({"id": None}))
print(f"Chamados sem id: {len(sem_id)}")

fixed = 0
for c in sem_id:
    novo_id = str(uuid.uuid4())
    chamados.update_one({"_id": c["_id"]}, {"$set": {"id": novo_id}})
    fixed += 1

print(f"Corrigidos: {fixed}")
client.close()
