from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import io
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'weconnect-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Create the main app
app = FastAPI(title="WeConnect Support API")
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(UserBase):
    id: str
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# Chamado/Atendimento Models (Emergent)
# Categorias: Falha Produção, Falha de Compras, Falha Transporte, Produto com Avaria, 
#             Divergência de Produto, Arrependimento, Dúvida, Reclamação, Assistência Técnica
CATEGORIAS_EMERGENT = [
    "Falha Produção",
    "Falha de Compras", 
    "Falha Transporte",
    "Produto com Avaria",
    "Divergência de Produto",
    "Arrependimento",
    "Dúvida",
    "Reclamação",
    "Assistência Técnica"
]

STATUS_CLIENTE = [
    "Entregue", "Estornado", "Reenviado", "Aguardando Devolução", 
    "Em Devolução", "Cancelado", "Resolvido", "Não Resolvido"
]

ATENDENTES = ["Letícia Martelo", "Adnéia Campos"]

class ChamadoBase(BaseModel):
    numero_pedido: str  # Entrega
    solicitacao: Optional[str] = None  # Número da solicitação do parceiro
    parceiro: Optional[str] = None  # Canal (CSU, Livelo, LL Loyalty, etc)
    categoria: str  # Uma das 9 categorias
    motivo: Optional[str] = None  # Motivo específico
    anotacoes: Optional[str] = None  # Histórico completo
    pendente: bool = True  # SIM/NÃO
    status_cliente: Optional[str] = None  # Status final ao encerrar
    reversa_codigo: Optional[str] = None  # Código de reversa
    atendente: str = "Letícia Martelo"  # Responsável

class ChamadoCreate(ChamadoBase):
    pass

class ChamadoUpdate(BaseModel):
    numero_pedido: Optional[str] = None
    canal_origem: Optional[str] = None
    categoria: Optional[str] = None
    sintese_problema: Optional[str] = None
    status_atendimento: Optional[str] = None
    status_chamado: Optional[str] = None
    responsavel_id: Optional[str] = None
    responsavel_nome: Optional[str] = None
    prioridade: Optional[str] = None
    precisa_reversa: Optional[bool] = None
    reversa_codigo: Optional[str] = None
    reversa_validade: Optional[str] = None
    id_externo: Optional[str] = None

class Chamado(ChamadoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_abertura: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_resolucao: Optional[datetime] = None
    criado_por_id: Optional[str] = None
    criado_por_nome: Optional[str] = None

# Pedido ERP Models
class PedidoERPBase(BaseModel):
    numero_pedido: str  # Entrega (número principal)
    pedido_cliente: Optional[str] = None  # Ped. Cliente (secundário)
    pedido_externo: Optional[str] = None
    data_emissao: Optional[str] = None
    nome_cliente: Optional[str] = None
    cpf_cliente: Optional[str] = None
    cep: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    email_cliente: Optional[str] = None
    fone_cliente: Optional[str] = None
    status_pedido: Optional[str] = None
    data_status: Optional[str] = None
    transportadora: Optional[str] = None
    codigo_transportadora: Optional[str] = None
    produto: Optional[str] = None
    codigo_produto: Optional[str] = None
    departamento: Optional[str] = None
    setor: Optional[str] = None
    familia: Optional[str] = None
    subfamilia: Optional[str] = None
    codigo_item_vtex: Optional[str] = None
    codigo_item_bseller: Optional[str] = None
    situacao: Optional[str] = None
    quantidade: Optional[str] = None
    preco_final: Optional[str] = None
    frete: Optional[str] = None
    nota_fiscal: Optional[str] = None
    serie_nf: Optional[str] = None
    chave_nota: Optional[str] = None
    data_emissao_nf: Optional[str] = None
    canal_vendas: Optional[str] = None
    id_canal_vendas: Optional[str] = None
    filial: Optional[str] = None
    codigo_rastreio: Optional[str] = None

class PedidoERP(PedidoERPBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ultima_atualizacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Reversa Models
class ReversaBase(BaseModel):
    chamado_id: str
    codigo_rastreio: Optional[str] = None
    status_reversa: str = "Aguardando Postagem"  # Aguardando Postagem, Em Trânsito, Entregue
    observacoes: Optional[str] = None

class ReversaCreate(ReversaBase):
    pass

class ReversaUpdate(BaseModel):
    codigo_rastreio: Optional[str] = None
    status_reversa: Optional[str] = None
    observacoes: Optional[str] = None

class Reversa(ReversaBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_criacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ultima_atualizacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Historico Models
class HistoricoBase(BaseModel):
    chamado_id: str
    tipo_acao: str  # Atualização de Status, Contato com Cliente, Nota Interna, Escalação
    descricao: str

class HistoricoCreate(HistoricoBase):
    pass

class Historico(HistoricoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_hora: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usuario_id: Optional[str] = None
    usuario_nome: Optional[str] = None

# ============== HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def serialize_doc(doc):
    for key, value in doc.items():
        doc[key] = serialize_datetime(value)
    return doc

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user.id, user.email)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, created_at=user_dict['created_at'])
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    token = create_token(user['id'], user['email'])
    return TokenResponse(
        token=token,
        user=UserResponse(id=user['id'], email=user['email'], name=user['name'], created_at=user['created_at'])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        created_at=current_user['created_at']
    )

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(id=u['id'], email=u['email'], name=u['name'], created_at=u['created_at']) for u in users]

# ============== CHAMADOS ROUTES ==============

@api_router.post("/chamados", response_model=dict)
async def create_chamado(chamado_data: ChamadoCreate, current_user: dict = Depends(get_current_user)):
    if not chamado_data.numero_pedido.strip():
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    
    chamado = Chamado(**chamado_data.model_dump())
    chamado.criado_por_id = current_user['id']
    chamado.criado_por_nome = current_user['name']
    
    chamado_dict = chamado.model_dump()
    chamado_dict['data_abertura'] = chamado_dict['data_abertura'].isoformat()
    if chamado_dict.get('data_resolucao'):
        chamado_dict['data_resolucao'] = chamado_dict['data_resolucao'].isoformat()
    
    await db.chamados.insert_one(chamado_dict)
    
    # Create initial history entry
    historico = Historico(
        chamado_id=chamado.id,
        tipo_acao="Atualização de Status",
        descricao="Chamado criado",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    
    return {"id": chamado.id, "message": "Chamado criado com sucesso"}

@api_router.get("/chamados", response_model=List[dict])
async def list_chamados(
    status_atendimento: Optional[str] = None,
    categoria: Optional[str] = None,
    canal: Optional[str] = None,
    responsavel_id: Optional[str] = None,
    prioridade: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status_atendimento:
        query['status_atendimento'] = status_atendimento
    if categoria:
        query['categoria'] = categoria
    if canal:
        query['canal_origem'] = canal
    if responsavel_id:
        query['responsavel_id'] = responsavel_id
    if prioridade:
        query['prioridade'] = prioridade
    if search:
        query['numero_pedido'] = {"$regex": search, "$options": "i"}
    
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", -1).to_list(1000)
    
    # Calculate days open
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = datetime.fromisoformat(c['data_abertura'].replace('Z', '+00:00')) if isinstance(c['data_abertura'], str) else c['data_abertura']
        if c['status_atendimento'] != 'Fechado':
            c['dias_aberto'] = (now - data_abertura).days
        else:
            c['dias_aberto'] = 0
    
    return chamados

@api_router.get("/chamados/{chamado_id}", response_model=dict)
async def get_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    chamado = await db.chamados.find_one({"id": chamado_id}, {"_id": 0})
    if not chamado:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    # Calculate days open
    now = datetime.now(timezone.utc)
    data_abertura = datetime.fromisoformat(chamado['data_abertura'].replace('Z', '+00:00')) if isinstance(chamado['data_abertura'], str) else chamado['data_abertura']
    if chamado['status_atendimento'] != 'Fechado':
        chamado['dias_aberto'] = (now - data_abertura).days
    else:
        chamado['dias_aberto'] = 0
    
    # Get pedido ERP info if exists
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado['numero_pedido']}, {"_id": 0})
    if pedido:
        chamado['pedido_erp'] = pedido
    
    # Get reversa if exists
    reversa = await db.reversas.find_one({"chamado_id": chamado_id}, {"_id": 0})
    if reversa:
        chamado['reversa'] = reversa
    
    return chamado

@api_router.put("/chamados/{chamado_id}", response_model=dict)
async def update_chamado(chamado_id: str, chamado_data: ChamadoUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    update_data = {k: v for k, v in chamado_data.model_dump().items() if v is not None}
    
    # Check if status changed to Fechado
    if update_data.get('status_atendimento') == 'Fechado' and existing.get('status_atendimento') != 'Fechado':
        update_data['data_resolucao'] = datetime.now(timezone.utc).isoformat()
    
    if update_data:
        await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})
        
        # Create history entry for status change
        if 'status_atendimento' in update_data or 'status_chamado' in update_data:
            historico = Historico(
                chamado_id=chamado_id,
                tipo_acao="Atualização de Status",
                descricao=f"Status atualizado: {update_data.get('status_atendimento', '')} / {update_data.get('status_chamado', '')}",
                usuario_id=current_user['id'],
                usuario_nome=current_user['name']
            )
            hist_dict = historico.model_dump()
            hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
            await db.historico.insert_one(hist_dict)
    
    return {"message": "Chamado atualizado com sucesso"}

@api_router.delete("/chamados/{chamado_id}", response_model=dict)
async def delete_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.chamados.delete_one({"id": chamado_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    # Delete related history
    await db.historico.delete_many({"chamado_id": chamado_id})
    # Delete related reversa
    await db.reversas.delete_many({"chamado_id": chamado_id})
    
    return {"message": "Chamado excluído com sucesso"}

# ============== HISTORICO ROUTES ==============

@api_router.post("/historico", response_model=dict)
async def create_historico(historico_data: HistoricoCreate, current_user: dict = Depends(get_current_user)):
    chamado = await db.chamados.find_one({"id": historico_data.chamado_id})
    if not chamado:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    historico = Historico(**historico_data.model_dump())
    historico.usuario_id = current_user['id']
    historico.usuario_nome = current_user['name']
    
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    
    await db.historico.insert_one(hist_dict)
    
    return {"id": historico.id, "message": "Histórico criado com sucesso"}

@api_router.get("/historico/{chamado_id}", response_model=List[dict])
async def get_historico(chamado_id: str, current_user: dict = Depends(get_current_user)):
    historicos = await db.historico.find({"chamado_id": chamado_id}, {"_id": 0}).sort("data_hora", -1).to_list(100)
    return historicos

# ============== REVERSAS ROUTES ==============

@api_router.post("/reversas", response_model=dict)
async def create_reversa(reversa_data: ReversaCreate, current_user: dict = Depends(get_current_user)):
    chamado = await db.chamados.find_one({"id": reversa_data.chamado_id})
    if not chamado:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    existing_reversa = await db.reversas.find_one({"chamado_id": reversa_data.chamado_id})
    if existing_reversa:
        raise HTTPException(status_code=400, detail="Já existe uma reversa para este chamado")
    
    reversa = Reversa(**reversa_data.model_dump())
    reversa_dict = reversa.model_dump()
    reversa_dict['data_criacao'] = reversa_dict['data_criacao'].isoformat()
    reversa_dict['ultima_atualizacao'] = reversa_dict['ultima_atualizacao'].isoformat()
    
    await db.reversas.insert_one(reversa_dict)
    
    # Update chamado to mark precisa_reversa
    await db.chamados.update_one({"id": reversa_data.chamado_id}, {"$set": {"precisa_reversa": True}})
    
    # Create history entry
    historico = Historico(
        chamado_id=reversa_data.chamado_id,
        tipo_acao="Atualização de Status",
        descricao="Reversa criada",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    
    return {"id": reversa.id, "message": "Reversa criada com sucesso"}

@api_router.get("/reversas", response_model=List[dict])
async def list_reversas(current_user: dict = Depends(get_current_user)):
    reversas = await db.reversas.find({}, {"_id": 0}).sort("data_criacao", -1).to_list(1000)
    
    # Calculate days since creation and enrich with chamado info
    now = datetime.now(timezone.utc)
    for r in reversas:
        data_criacao = datetime.fromisoformat(r['data_criacao'].replace('Z', '+00:00')) if isinstance(r['data_criacao'], str) else r['data_criacao']
        r['dias_desde_criacao'] = (now - data_criacao).days
        
        ultima_atualizacao = datetime.fromisoformat(r['ultima_atualizacao'].replace('Z', '+00:00')) if isinstance(r['ultima_atualizacao'], str) else r['ultima_atualizacao']
        r['dias_sem_atualizacao'] = (now - ultima_atualizacao).days
        
        # Get chamado info
        chamado = await db.chamados.find_one({"id": r['chamado_id']}, {"_id": 0, "numero_pedido": 1})
        if chamado:
            r['numero_pedido'] = chamado.get('numero_pedido')
    
    return reversas

@api_router.get("/reversas/{reversa_id}", response_model=dict)
async def get_reversa(reversa_id: str, current_user: dict = Depends(get_current_user)):
    reversa = await db.reversas.find_one({"id": reversa_id}, {"_id": 0})
    if not reversa:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    return reversa

@api_router.put("/reversas/{reversa_id}", response_model=dict)
async def update_reversa(reversa_id: str, reversa_data: ReversaUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.reversas.find_one({"id": reversa_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Reversa não encontrada")
    
    update_data = {k: v for k, v in reversa_data.model_dump().items() if v is not None}
    update_data['ultima_atualizacao'] = datetime.now(timezone.utc).isoformat()
    
    await db.reversas.update_one({"id": reversa_id}, {"$set": update_data})
    
    # Create history entry
    historico = Historico(
        chamado_id=existing['chamado_id'],
        tipo_acao="Atualização de Status",
        descricao=f"Reversa atualizada: {update_data.get('status_reversa', '')}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    
    return {"message": "Reversa atualizada com sucesso"}

# ============== PEDIDOS ERP ROUTES ==============

@api_router.get("/pedidos-erp/{numero_pedido}", response_model=dict)
async def get_pedido_erp(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return pedido

@api_router.post("/pedidos-erp/import", response_model=dict)
async def import_pedidos(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo não fornecido")
    
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use CSV ou Excel.")
        
        # Mapping for Base_Emergent format (Power Query export)
        # A=Entrega, B=Canal, C=Ped.Cliente, D=Ped.Externo, E=CPF, F=Nome, G=CEP, H=Cidade, I=UF
        # J=Fone, K=Email, L=Status, M=Dt.Ult.Ponto, N=Transportadora, O=Fornecedor, P=Item
        # Q=Produto, R=Cód.Terceiro, S=Qtde, T=Preço, U=Frete, V=UF, W=Nota, X=Chave, Y=Troca, Z=CodFornecedor
        column_mapping = {
            'numero_pedido': ['entrega'],  # Coluna A - Número do pedido
            'canal_vendas': ['nome canal de vendas'],  # Coluna B
            'pedido_cliente': ['ped. cliente'],  # Coluna C
            'pedido_externo': ['ped. externo'],  # Coluna D
            'cpf_cliente': ['cpf'],  # Coluna E
            'nome_cliente': ['nome'],  # Coluna F
            'cep': ['cep'],  # Coluna G
            'cidade': ['cidade'],  # Coluna H
            'uf': ['uf'],  # Coluna I
            'fone_cliente': ['fone'],  # Coluna J
            'email_cliente': ['e-mail'],  # Coluna K
            'status_pedido': ['status da entrega'],  # Coluna L - Status do pedido
            'data_status': ['dt.ult.ponto de controle'],  # Coluna M
            'transportadora': ['transportadora'],  # Coluna N
            'departamento': ['nome_5'],  # Coluna O - Fornecedor/Marca
            'codigo_item_bseller': ['item'],  # Coluna P - Código do item
            'produto': ['nome do produto'],  # Coluna Q - Nome do produto
            'codigo_item_vtex': ['c?d. terceiro', 'cód. terceiro'],  # Coluna R
            'quantidade': ['qtde pedido'],  # Coluna S
            'preco_final': ['pre?o final', 'preço final'],  # Coluna T
            'frete': ['frete'],  # Coluna U
            'filial': ['uf.1'],  # Coluna V
            'nota_fiscal': ['nota'],  # Coluna W
            'chave_nota': ['chave acesso'],  # Coluna X
            'pedido_troca': ['pedido troca'],  # Coluna Y
            'codigo_fornecedor': ['cód. fornecedor'],  # Coluna Z
        }
        
        # Normalize column names (strip whitespace and lowercase)
        df.columns = df.columns.str.strip().str.lower()
        original_columns = list(df.columns)
        
        imported = 0
        updated = 0
        errors = 0
        
        for idx, row in df.iterrows():
            try:
                pedido_data = {}
                
                for field, possible_names in column_mapping.items():
                    for name in possible_names:
                        name_lower = name.lower()
                        if name_lower in original_columns:
                            value = row.get(name_lower)
                            if pd.notna(value):
                                pedido_data[field] = str(value).strip()
                            break
                
                # Skip if no numero_pedido
                if 'numero_pedido' not in pedido_data or not pedido_data['numero_pedido']:
                    continue
                
                existing = await db.pedidos_erp.find_one({"numero_pedido": pedido_data['numero_pedido']})
                
                if existing:
                    pedido_data['ultima_atualizacao'] = datetime.now(timezone.utc).isoformat()
                    await db.pedidos_erp.update_one(
                        {"numero_pedido": pedido_data['numero_pedido']},
                        {"$set": pedido_data}
                    )
                    updated += 1
                else:
                    pedido = PedidoERP(**pedido_data)
                    pedido_dict = pedido.model_dump()
                    pedido_dict['ultima_atualizacao'] = pedido_dict['ultima_atualizacao'].isoformat()
                    await db.pedidos_erp.insert_one(pedido_dict)
                    imported += 1
            except Exception as e:
                errors += 1
                continue
        
        return {
            "message": f"Importação concluída: {imported} novos, {updated} atualizados, {errors} erros",
            "imported": imported,
            "updated": updated,
            "errors": errors
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

@api_router.get("/pedidos-erp", response_model=List[dict])
async def list_pedidos_erp(current_user: dict = Depends(get_current_user)):
    pedidos = await db.pedidos_erp.find({}, {"_id": 0}).to_list(1000)
    return pedidos

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=dict)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Total chamados abertos
    total_abertos = await db.chamados.count_documents({"status_atendimento": "Aberto"})
    total_fechados = await db.chamados.count_documents({"status_atendimento": "Fechado"})
    
    # Chamados por categoria
    pipeline_categoria = [
        {"$match": {"status_atendimento": "Aberto"}},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}
    ]
    por_categoria = await db.chamados.aggregate(pipeline_categoria).to_list(100)
    
    # Chamados por canal
    pipeline_canal = [
        {"$match": {"status_atendimento": "Aberto"}},
        {"$group": {"_id": "$canal_origem", "count": {"$sum": 1}}}
    ]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(100)
    
    # Chamados por prioridade
    pipeline_prioridade = [
        {"$match": {"status_atendimento": "Aberto"}},
        {"$group": {"_id": "$prioridade", "count": {"$sum": 1}}}
    ]
    por_prioridade = await db.chamados.aggregate(pipeline_prioridade).to_list(100)
    
    # Chamados que precisam de atenção (abertos há mais de 3 dias ou urgentes)
    now = datetime.now(timezone.utc)
    tres_dias_atras = (now - timedelta(days=3)).isoformat()
    
    chamados_atencao = await db.chamados.find({
        "status_atendimento": "Aberto",
        "$or": [
            {"data_abertura": {"$lt": tres_dias_atras}},
            {"prioridade": {"$in": ["Alta", "Urgente"]}}
        ]
    }, {"_id": 0}).sort("data_abertura", 1).to_list(10)
    
    # Calculate days open for attention items
    for c in chamados_atencao:
        data_abertura = datetime.fromisoformat(c['data_abertura'].replace('Z', '+00:00')) if isinstance(c['data_abertura'], str) else c['data_abertura']
        c['dias_aberto'] = (now - data_abertura).days
    
    # Últimos 7 dias - abertos vs resolvidos
    ultimos_7_dias = []
    for i in range(6, -1, -1):
        dia = now - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        abertos_dia = await db.chamados.count_documents({
            "data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}
        })
        
        resolvidos_dia = await db.chamados.count_documents({
            "data_resolucao": {"$gte": dia_inicio, "$lte": dia_fim}
        })
        
        ultimos_7_dias.append({
            "data": dia.strftime("%d/%m"),
            "abertos": abertos_dia,
            "resolvidos": resolvidos_dia
        })
    
    # Média de tempo de resolução
    pipeline_tempo = [
        {"$match": {"data_resolucao": {"$ne": None}}},
        {"$project": {
            "tempo": {"$subtract": [
                {"$dateFromString": {"dateString": "$data_resolucao"}},
                {"$dateFromString": {"dateString": "$data_abertura"}}
            ]}
        }},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    tempo_result = await db.chamados.aggregate(pipeline_tempo).to_list(1)
    media_tempo_ms = tempo_result[0]['media'] if tempo_result else 0
    media_tempo_dias = round(media_tempo_ms / (1000 * 60 * 60 * 24), 1) if media_tempo_ms else 0
    
    return {
        "total_abertos": total_abertos,
        "total_fechados": total_fechados,
        "por_categoria": {item['_id']: item['count'] for item in por_categoria if item['_id']},
        "por_canal": {item['_id']: item['count'] for item in por_canal if item['_id']},
        "por_prioridade": {item['_id']: item['count'] for item in por_prioridade if item['_id']},
        "chamados_atencao": chamados_atencao,
        "ultimos_7_dias": ultimos_7_dias,
        "media_tempo_resolucao_dias": media_tempo_dias
    }

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "WeConnect Support API"}

# Include router and setup
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
