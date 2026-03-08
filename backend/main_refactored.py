"""
ELO - Sistema de Atendimentos WeConnect
Main application entry point (refatorado)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Criar aplicação FastAPI
app = FastAPI(
    title="ELO API",
    description="Sistema de Atendimentos WeConnect",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Importar rotas após criar o app para evitar imports circulares
from routes.auth import router as auth_router, users_router

# Registrar rotas
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")

# Health check
@app.get("/")
async def root():
    return {"status": "ok", "app": "ELO API", "version": "2.0.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
