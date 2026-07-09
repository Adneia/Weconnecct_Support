"""
ELO - Sistema de Controle de Chamados WeConnect
Entry point - importa rotas modulares
"""
import logging
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import jwt

from utils.database import client, db, JWT_SECRET, JWT_ALGORITHM

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# App
app = FastAPI(title="ELO - WeConnect", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://elo.wct360.com.br"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compressão gzip das respostas (JSON das listas cai ~8-10x no tráfego)
app.add_middleware(GZipMiddleware, minimum_size=500)

# ---- Perfil "consulta": somente leitura ----
# Bloqueia qualquer escrita (POST/PUT/PATCH/DELETE) para usuários com role 'consulta'.
# Garante, no servidor, que esse acesso só consulta — independente da interface.
_CONSULTA_WRITE_ALLOW = ("/api/auth/login", "/api/auth/change-password", "/api/auth/logout")

@app.middleware("http")
async def restrict_consulta_writes(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if not any(path.startswith(p) for p in _CONSULTA_WRITE_ALLOW):
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                try:
                    payload = jwt.decode(auth.split(" ", 1)[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    uid = payload.get("sub")
                    if uid:
                        u = await db.users.find_one({"id": uid}, {"_id": 0, "role": 1})
                        if u and u.get("role") == "consulta":
                            return JSONResponse(
                                status_code=403,
                                content={"detail": "Acesso somente leitura (perfil consulta)."},
                            )
                except Exception:
                    pass
    return await call_next(request)

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
from routes.retirada import router as retirada_router
from routes.base_total import router as base_total_router
from routes.base_jt import router as base_jt_router
from routes.base_aet import router as base_aet_router
from routes.cancelamentos import router as cancelamentos_router
from routes.pagamento import router as pagamento_router
from routes.sync_postgres import router as sync_postgres_router
from routes.produtos_busca import router as produtos_busca_router
from routes.avisos_compras import router as avisos_compras_router

app.include_router(auth_router)
app.include_router(chamados_router)
app.include_router(textos_router)
app.include_router(relatorios_router)
app.include_router(pedidos_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(sync_postgres_router)
app.include_router(notificacoes_router)
app.include_router(devolucoes_router)
app.include_router(sheets_router)
app.include_router(retirada_router)
app.include_router(base_total_router)
app.include_router(base_jt_router)
app.include_router(base_aet_router)
app.include_router(cancelamentos_router)
app.include_router(pagamento_router)
app.include_router(produtos_busca_router)
app.include_router(avisos_compras_router)


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

    # Índice TTL para sync_logs (30 dias = 2592000 segundos)
    try:
        from utils.database import db
        await db.sync_logs.create_index("criado_em_dt", expireAfterSeconds=2592000)
        # Índices auxiliares para consultas
        await db.sync_logs.create_index([("dataset", 1), ("iniciado_em", -1)])
        await db.sync_logs.create_index("pedidos_afetados")
        logger.info("sync_logs indexes created (TTL 30 days)")
    except Exception as e:
        logger.warning(f"Failed to create sync_logs indexes: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
