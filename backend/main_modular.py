"""
ELO - Sistema de Atendimentos API
Arquivo principal refatorado com rotas modulares
"""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import logging
import os

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="ELO - Sistema de Atendimentos")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create main API router
api_router = APIRouter(prefix="/api")

# Import and include route modules
from routes.auth import router as auth_router, users_router
from routes.chamados import router as chamados_router
from routes.pedidos import router as pedidos_router
from routes.relatorios import router as relatorios_router
from routes.textos import router as textos_router
from routes.dashboard import router as dashboard_router
from routes.devolucoes import router as devolucoes_router

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(chamados_router)
api_router.include_router(pedidos_router)
api_router.include_router(relatorios_router)
api_router.include_router(textos_router)
api_router.include_router(dashboard_router)
api_router.include_router(devolucoes_router)

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "ELO - Sistema de Atendimentos API"}

# Include API router in app
app.include_router(api_router)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
