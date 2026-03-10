"""
ELO - Sistema de Controle de Chamados WeConnect
Entry point - importa rotas modulares
"""
import logging
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils.database import client

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# App
app = FastAPI(title="ELO - WeConnect", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register all route modules
from routes.auth import router as auth_router
from routes.chamados import router as chamados_router
from routes.textos import router as textos_router
from routes.relatorios import router as relatorios_router
from routes.pedidos import router as pedidos_router
from routes.dashboard import router as dashboard_router
from routes.admin import router as admin_router
from routes.notificacoes import router as notificacoes_router
from routes.devolucoes import router as devolucoes_router
from routes.google_sheets_routes import router as sheets_router

app.include_router(auth_router)
app.include_router(chamados_router)
app.include_router(textos_router)
app.include_router(relatorios_router)
app.include_router(pedidos_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(notificacoes_router)
app.include_router(devolucoes_router)
app.include_router(sheets_router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


# Google Sheets initialization
try:
    from google_sheets import sheets_client
    logger.info("Google Sheets client imported successfully")
except Exception as e:
    logger.warning(f"Google Sheets not available: {e}")


@app.on_event("startup")
async def startup_db_client():
    try:
        await client.admin.command('ping')
        logger.info("MongoDB connection initialized successfully")
    except Exception as e:
        logger.error(f"MongoDB connection error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
