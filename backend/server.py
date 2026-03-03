from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
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
from google_sheets import sheets_client

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

# Logging setup (moved up for use in sync functions)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== UTILITY FUNCTIONS ==============

def calcular_dias_uteis(data_inicio, data_fim=None):
    """Calcula a quantidade de dias úteis entre duas datas"""
    if data_fim is None:
        data_fim = datetime.now(timezone.utc)
    
    if isinstance(data_inicio, str):
        try:
            data_str = data_inicio.split()[0]
            data_inicio = datetime.strptime(data_str, '%d/%m/%Y')
            data_inicio = data_inicio.replace(tzinfo=timezone.utc)
        except:
            return 0
    
    if data_inicio.tzinfo is None:
        data_inicio = data_inicio.replace(tzinfo=timezone.utc)
    if data_fim.tzinfo is None:
        data_fim = data_fim.replace(tzinfo=timezone.utc)
    
    dias_uteis = 0
    data_atual = data_inicio
    while data_atual < data_fim:
        if data_atual.weekday() < 5:  # Segunda a Sexta
            dias_uteis += 1
        data_atual += timedelta(days=1)
    
    return dias_uteis

def is_status_maiusculo(status):
    """Verifica se o status está todo em maiúsculas (indicando tracking)"""
    if not status:
        return False
    clean_status = status.strip()
    return len(clean_status) >= 4 and clean_status.isupper()

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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

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
    "Acompanhamento",
    "Reclame Aqui",
    "Assistência Técnica",
    "Falha de Integração"
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
    motivo_pendencia: Optional[str] = None  # Motivo da pendência
    codigo_reversa: Optional[str] = None  # Código da reversa
    data_vencimento_reversa: Optional[str] = None  # Data de vencimento da reversa
    retornar_chamado: bool = False  # Sinaliza que precisa retorno/atuação
    verificar_adneia: bool = False  # Sinaliza que Adnéia precisa verificar

class ChamadoCreate(ChamadoBase):
    pass

class ChamadoUpdate(BaseModel):
    numero_pedido: Optional[str] = None
    solicitacao: Optional[str] = None
    parceiro: Optional[str] = None
    categoria: Optional[str] = None
    motivo: Optional[str] = None
    anotacoes: Optional[str] = None
    pendente: Optional[bool] = None
    status_cliente: Optional[str] = None
    reversa_codigo: Optional[str] = None
    atendente: Optional[str] = None
    motivo_pendencia: Optional[str] = None
    codigo_reversa: Optional[str] = None
    data_vencimento_reversa: Optional[str] = None
    retornar_chamado: Optional[bool] = None  # Sinaliza que precisa retorno/atuação
    verificar_adneia: Optional[bool] = None  # Sinaliza que Adnéia precisa verificar

class Chamado(ChamadoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    id_atendimento: str = ""  # ATD-2026-001
    data_abertura: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_fechamento: Optional[datetime] = None
    criado_por_id: Optional[str] = None
    criado_por_nome: Optional[str] = None
    # Dados do pedido (copiados da Base_Emergent)
    nome_cliente: Optional[str] = None
    cpf_cliente: Optional[str] = None
    produto: Optional[str] = None
    transportadora: Optional[str] = None
    status_pedido: Optional[str] = None
    canal_vendas: Optional[str] = None

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
    codigo_fornecedor: Optional[str] = None  # Cód. Fornecedor do SIGEQ230
    pedido_troca: Optional[str] = None
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
    password_hash = user.get('password_hash') or user.get('password', '') if user else ''
    
    if not user or not verify_password(credentials.password, password_hash):
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

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Alterar senha do usuário logado"""
    user = await db.users.find_one({"id": current_user['id']})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Verificar senha atual
    if not bcrypt.checkpw(request.current_password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    # Hash da nova senha
    new_password_hash = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Atualizar no banco
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password": new_password_hash}}
    )
    
    return {"message": "Senha alterada com sucesso"}

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(id=u['id'], email=u['email'], name=u['name'], created_at=u['created_at']) for u in users]

# ============== CHAMADOS/ATENDIMENTOS ROUTES ==============

async def generate_atendimento_id():
    """Gera ID sequencial no formato ATD-2026-XXX"""
    year = datetime.now(timezone.utc).year
    # Buscar o último ID do ano
    last = await db.chamados.find_one(
        {"id_atendimento": {"$regex": f"^ATD-{year}-"}},
        sort=[("id_atendimento", -1)]
    )
    if last and last.get('id_atendimento'):
        try:
            last_num = int(last['id_atendimento'].split('-')[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    return f"ATD-{year}-{str(next_num).zfill(3)}"

def generate_reversa_code(numero_pedido: str):
    """Gera código de reversa no formato REV-XXXXXXXX-XXX"""
    import random
    suffix = str(random.randint(100, 999))
    return f"REV-{numero_pedido[-8:]}-{suffix}"

# Textos padrões por categoria e situação
TEXTOS_PADROES = {
    "Falha Produção": """Selecione o tipo de resposta no campo abaixo.""",
    
    "Falha Produção - Sem Rastreio": """Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Produção - Total Express": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]

https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha Produção - J&T Express": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha Produção - ASAP Log": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
    
    "Falha de Compras": """Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",
    
    "Falha Transporte": """Olá, Boa tarde.

Identificamos um problema na entrega do seu pedido. Pedimos desculpas pelo inconveniente.

Estamos em contato com a transportadora para resolver a situação.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
    
    "Produto com Avaria": """Selecione o tipo de avaria no campo abaixo.""",
    
    "Avaria - Necessário Evidência": """Olá, Boa tarde.

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Transporte até R$250": """Olá, Boa tarde.

Informamos que iniciamos a preparação e o envio de um novo produto para o cliente.

Em caráter de exceção, não será necessário realizar a devolução do item avariado. Pedimos, por gentileza, que oriente o cliente quanto ao descarte adequado do produto.

Assim que possível, compartilharemos o link de rastreamento.

Permanecemos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Reversa": """Olá, Boa tarde.

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente a solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 


*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 

* Sem indícios de uso, sem violação do lacre original do fabricante; 

* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 

* Acompanhado também dos acessórios/peças e manual do item. 

* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
    
    "Divergência de Produto": """Prezado(a) cliente,

Identificamos uma divergência entre o produto solicitado e o recebido.

Para verificação, solicitamos fotos do produto recebido e da etiqueta com código de barras.

Atenciosamente,
[ASSINATURA]""",
    
    "Arrependimento": """Prezado(a) cliente,

Recebemos sua solicitação de devolução por arrependimento.

Conforme o Código de Defesa do Consumidor, você tem até 7 dias para exercer o direito de arrependimento.

Segue abaixo o código de postagem para devolução:
[CÓDIGO_REVERSA]

Atenciosamente,
[ASSINATURA]""",
    
    "Acompanhamento": """Selecione o tipo de acompanhamento no campo abaixo.""",
    
    "Acompanhamento - Entregue Possível Contestação": """Olá, 

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Entregue Contestação Expirada": """Olá, 

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Sem Comprovante Entrega": """Olá,

Solicitamos o comprovante de entrega assinado ou o início do processo de acareação da entrega. Assim que possível, encaminharemos as informações.

Pedimos, por gentileza, que, ao entrar em contato com a cliente, seja solicitado que nos informe caso o pedido seja entregue.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo Total Express": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

https://totalconecta.totalexpress.com.br/rastreamento

Seguimos a disposição. 
Atenciosamente, 
[ASSINATURA]""",

    "Acompanhamento - Em Processo J&T": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo ASAP": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo Correios": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue link para rastreio:
https://rastreamento.correios.com.br/app/index.php
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Cancelamento por Falta": """Olá, 

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente, 
[ASSINATURA]""",

    "Acompanhamento - Falha Integração": """Olá,

Não fomos acionamos pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e ...

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Ag. Compras": """Olá, 

O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente! 
[ASSINATURA]""",

    "Acompanhamento - Problema Emissão NF": """Olá,

Infelizmente na emissão da Nota fiscal do pedido acima [ENTREGA] - [PRODUTO], foi constatado um problema fiscal por parte do CNPJ informado o qual impede a aprovação da NF. Poderiam seguir com o cancelamento e estorno ao cliente.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",
    
    # Textos para Reclame Aqui
    "Reclame Aqui": """Selecione a resposta padrão no campo abaixo.""",
    
    "Reclame Aqui - Resposta Inicial": """Prezado(a) Sr(a). [NOME_CLIENTE],

Primeiramente, lamentamos muito pelo ocorrido.

Informamos que o atendimento para compras realizadas em nossa loja é conduzido diretamente pelos nossos parceiros. Nesse caso, o procedimento correto é acionar o canal de venda por meio do qual a compra foi efetuada, para apoio na tratativa da ocorrência.

No entanto, para agilizar a resolução do caso, entraremos em contato diretamente via WhatsApp, no número informado na nota fiscal, oferecendo o suporte necessário, além de acionarmos o parceiro responsável para dar continuidade às tratativas.

Continuamos à disposição para qualquer dúvida ou necessidade.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Mensagem WhatsApp": """Prezado(a) Sr(a). [NOME_CLIENTE]

Fomos acionados via Reclame Aqui com a informação de que o produto adquirido ainda não foi entregue.

Identificamos que o pedido, 

Nossas sinceras desculpas pelo ocorrido. Estamos à disposição para resolver o caso o mais breve possível.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Solicitar Encerramento": """Agradecemos a confirmação.

Por gentileza, poderia seguir com o encerramento da reclamação no Reclame Aqui?
Aproveitamos para agradecer, caso seja possível, a avaliação do nosso atendimento referente à tratativa da ocorrência.

Permanecemos à disposição.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Após Avaliação": """Prezado(a) Sr(a). [NOME_CLIENTE],

Agradecemos o retorno e a sua sincera avaliação em relação ao nosso atendimento.

Permanecemos à disposição para quaisquer dúvidas ou solicitações.

Atenciosamente,
Equipe de Atendimento Weconnect""",
    
    # Textos para Assistência Técnica
    "Assistência Técnica": """Selecione o fornecedor no campo abaixo.""",

    "Assistência Técnica - Oderço": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – ODERÇO
📞 44 2101-1428

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Ventisol": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - OEX": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX 
reversa@newex.com.br

📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Hoopson": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – Hoopson

📞 0+55 21 3809-2001

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Ventisol + Reversa": """Olá, 

Este fornecedor tem a possibilidade de troca direto com ele, o cliente pode aciona-lo direto através do https://assistencia.ventisol.com.br/

Como estamos dentro do prazo de devolução, o cliente também pode optar pelo troca aqui na loja, para isso, basta realizar a devolução conforme o código de postagem abaixo e assim que for recebido em nosso galpão será enviado outro em substituição.

Segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 

*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 
* Sem indícios de uso, sem violação do lacre original do fabricante; 
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 
* Acompanhado também dos acessórios/peças e manual do item. 
* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente!""",

    "Assistência Técnica - OEX + Reversa": """Olá, 

Este fornecedor tem a possibilidade de troca direto com ele, o cliente pode aciona-lo direto através do Serviço de Atendimento ao Cliente (SAC) – OEX - reversa@newex.com.br - 📞 0800 887 0505 OU 11 973928421 . 

Como estamos dentro do prazo de devolução, o cliente também pode optar pela devolução ou troca aqui na loja, para isso, basta realizar a devolução conforme o código de postagem abaixo e assim que for recebido em nosso galpão seguiremos com a tratativa

Segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 

*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 
* Sem indícios de uso, sem violação do lacre original do fabricante; 
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 
* Acompanhado também dos acessórios/peças e manual do item. 
* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente!

[ASSINATURA]""",

    # Textos específicos para situações
    "Reversa - Primeira Tentativa": """Olá,

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente à solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:
Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor deve se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA

*** Orientações importantes ***:
* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto);
* Sem indícios de uso, sem violação do lacre original do fabricante;
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios;
* Acompanhado também do comprovante de endereço do cliente, que deve estar legível;
* Informe que o produto tem 7 dias para dar entrada em nosso estoque para que possamos prosseguir com a tratativa.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Reversa - Segunda Tentativa": """Olá,

Referente à solicitação, segue os dados para realizar a segunda e última tentativa de retorno do produto em no máximo 7 dias.

Autorização de Postagem em Agência

Dados da Emissão:
Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor deve se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA

*** Orientações importantes ***:
* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto);
* Sem indícios de uso, sem violação do lacre original do fabricante;
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios;
* Acompanhado também do comprovante de endereço do cliente, que deve estar legível;
* Informe que o produto tem 7 dias para dar entrada em nosso estoque para que possamos prosseguir com a tratativa.

⚠️ ATENÇÃO: Esta é a SEGUNDA e ÚLTIMA tentativa!

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Em Devolução": """Olá,

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]""",

    "Em Devolução - Com Rastreio": """Olá,

O pedido segue em processo de devolução, conforme link de rastreamento abaixo:

Rastreio: [CÓDIGO_RASTREIO]
https://rastreamento.correios.com.br/app/index.php

Assim que o item der entrada em nosso galpão, daremos sequência à tratativa.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Insucesso na Entrega": """Bom dia!

Infelizmente, a transportadora direcionou o pedido para devolução, em razão de insucesso na entrega. No momento, o pedido encontra-se em retorno para o nosso galpão.

Lamentamos muito o ocorrido e os transtornos causados. Gostaríamos de saber se podemos prosseguir com um novo envio do produto assim que ele for recebido em nosso galpão.

Seguimos à disposição.
Atenciosamente,
Atendimento Weconnect""",

    "Estorno": """Olá,

Pedido cancelado, por favor seguir com o estorno ao cliente e encerramento do chamado.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Estorno com Descarte": """Olá,

Por favor seguir com o estorno ao cliente e encerramento do chamado.

Por favor orientar o cliente a descartar o item avariado.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Extravio - Reenvio": """Olá,

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente. Assim que possível, disponibilizaremos o link para rastreio.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Extravio - Cancelamento": """Olá, Bom dia.

Informamos que o item [PRODUTO] foi extraviado pela transportadora. Pedimos a gentileza de seguir com o cancelamento e estorno devido à indisponibilidade de reposição.

Pedimos sinceras desculpas pelo ocorrido.

Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - Total Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]
https://totalconecta.totalexpress.com.br/rastreamento

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - J&T Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]
https://www.jtexpress.com.br/

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - ASAP": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionada transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]
https://rastreio.asaplog.com.br/

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - VENTISOL": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - OEX": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX
reversa@newex.com.br
📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Falha de Integração": """Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e [PARCEIRO].

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]"""
}

@api_router.get("/textos-padroes/{categoria}")
async def get_texto_padrao(categoria: str, current_user: dict = Depends(get_current_user)):
    """Retorna texto padrão para a categoria"""
    texto = TEXTOS_PADROES.get(categoria)
    if not texto:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return {"categoria": categoria, "texto": texto}

@api_router.get("/textos-padroes")
async def list_textos_padroes(current_user: dict = Depends(get_current_user)):
    """Lista todas as categorias e textos padrões"""
    # Separar textos por tipo
    categorias_principais = [k for k in TEXTOS_PADROES.keys() if k in CATEGORIAS_EMERGENT]
    situacoes = [k for k in TEXTOS_PADROES.keys() if k not in CATEGORIAS_EMERGENT]
    
    return {
        "categorias": CATEGORIAS_EMERGENT, 
        "textos": TEXTOS_PADROES,
        "situacoes": situacoes
    }

@api_router.get("/textos-situacionais")
async def list_textos_situacionais(current_user: dict = Depends(get_current_user)):
    """Lista textos para situações específicas (reversa, estorno, etc)"""
    situacoes = {k: v for k, v in TEXTOS_PADROES.items() if k not in CATEGORIAS_EMERGENT}
    return {"situacoes": list(situacoes.keys()), "textos": situacoes}

@api_router.get("/textos-situacionais/{situacao}")
async def get_texto_situacional(situacao: str, current_user: dict = Depends(get_current_user)):
    """Retorna texto para uma situação específica"""
    texto = TEXTOS_PADROES.get(situacao)
    if not texto:
        raise HTTPException(status_code=404, detail=f"Texto para situação '{situacao}' não encontrado")
    return {"situacao": situacao, "texto": texto}

@api_router.post("/gerar-reversa/{numero_pedido}")
async def gerar_codigo_reversa(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    """Gera código de reversa para o pedido"""
    codigo = generate_reversa_code(numero_pedido)
    return {"codigo_reversa": codigo, "numero_pedido": numero_pedido}

def sync_to_google_sheets(chamado_dict: dict, pedido_info: dict = None):
    """Background task to sync atendimento to Google Sheets"""
    try:
        sheets_client.add_atendimento(chamado_dict, pedido_info)
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {e}")

@api_router.post("/chamados", response_model=dict)
async def create_chamado(
    chamado_data: ChamadoCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if not chamado_data.numero_pedido.strip():
        raise HTTPException(status_code=400, detail="Número do pedido é obrigatório")
    
    # Gerar ID do atendimento
    id_atendimento = await generate_atendimento_id()
    
    chamado = Chamado(**chamado_data.model_dump())
    chamado.id_atendimento = id_atendimento
    chamado.criado_por_id = current_user['id']
    chamado.criado_por_nome = current_user['name']
    
    # Buscar dados do pedido na Base_Emergent
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado_data.numero_pedido}, {"_id": 0})
    if pedido:
        chamado.nome_cliente = pedido.get('nome_cliente')
        chamado.cpf_cliente = pedido.get('cpf_cliente')
        chamado.produto = pedido.get('produto')
        chamado.transportadora = pedido.get('transportadora')
        chamado.status_pedido = pedido.get('status_pedido')
        chamado.canal_vendas = pedido.get('canal_vendas')
        if not chamado.parceiro:
            chamado.parceiro = pedido.get('canal_vendas')
    
    chamado_dict = chamado.model_dump()
    chamado_dict['data_abertura'] = chamado_dict['data_abertura'].isoformat()
    if chamado_dict.get('data_fechamento'):
        chamado_dict['data_fechamento'] = chamado_dict['data_fechamento'].isoformat()
    
    await db.chamados.insert_one(chamado_dict)
    
    # Create initial history entry
    historico = Historico(
        chamado_id=chamado.id,
        tipo_acao="Atualização de Status",
        descricao=f"Atendimento {id_atendimento} criado - {chamado_data.categoria}",
        usuario_id=current_user['id'],
        usuario_nome=current_user['name']
    )
    hist_dict = historico.model_dump()
    hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
    await db.historico.insert_one(hist_dict)
    
    # Sync to Google Sheets in background
    background_tasks.add_task(sync_to_google_sheets, chamado_dict, pedido)
    
    return {
        "id": chamado.id, 
        "id_atendimento": id_atendimento,
        "message": f"Atendimento {id_atendimento} criado com sucesso",
        "google_sheets_sync": "queued"
    }

@api_router.get("/chamados", response_model=List[dict])
async def list_chamados(
    pendente: Optional[bool] = None,
    categoria: Optional[str] = None,
    atendente: Optional[str] = None,
    parceiro: Optional[str] = None,
    retornar_chamado: Optional[bool] = None,
    verificar_adneia: Optional[bool] = None,
    motivo_pendencia: Optional[str] = None,
    search: Optional[str] = None,
    search_type: Optional[str] = None,  # 'todos', 'solicitacao', 'entrega', 'cpf', 'nome'
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if pendente is not None:
        query['pendente'] = pendente
    if categoria:
        query['categoria'] = categoria
    if atendente:
        query['atendente'] = atendente
    if parceiro:
        query['parceiro'] = parceiro
    if retornar_chamado is not None:
        query['retornar_chamado'] = retornar_chamado
    if verificar_adneia is not None:
        query['verificar_adneia'] = verificar_adneia
    if motivo_pendencia:
        query['motivo_pendencia'] = motivo_pendencia
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        if search_type == 'solicitacao':
            query['solicitacao'] = search_regex
        elif search_type == 'entrega':
            query['numero_pedido'] = search_regex
        elif search_type == 'cpf':
            query['cpf_cliente'] = search_regex
        elif search_type == 'nome':
            query['nome_cliente'] = search_regex
        else:
            # Buscar em todos os campos
            query['$or'] = [
                {"numero_pedido": search_regex},
                {"cpf_cliente": search_regex},
                {"nome_cliente": search_regex},
                {"solicitacao": search_regex},
                {"id_atendimento": search_regex}
            ]
    
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", -1).to_list(1000)
    
    # Calculate days open
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = datetime.fromisoformat(c['data_abertura'].replace('Z', '+00:00')) if isinstance(c['data_abertura'], str) else c['data_abertura']
        if c.get('pendente', True):
            c['dias_aberto'] = (now - data_abertura).days
        else:
            c['dias_aberto'] = 0
    
    return chamados

# Endpoint específico para listar pendentes (atalho)
@api_router.get("/chamados/pendentes/lista", response_model=List[dict])
async def list_pendentes(
    atendente: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"pendente": True}
    if atendente:
        query['atendente'] = atendente
    
    chamados = await db.chamados.find(query, {"_id": 0}).sort("data_abertura", 1).to_list(1000)
    
    now = datetime.now(timezone.utc)
    for c in chamados:
        data_abertura = datetime.fromisoformat(c['data_abertura'].replace('Z', '+00:00')) if isinstance(c['data_abertura'], str) else c['data_abertura']
        c['dias_aberto'] = (now - data_abertura).days
    
    return chamados

# ============== RELATÓRIOS ESPECIAIS ==============

@api_router.get("/relatorios/ag-compras")
async def get_relatorio_ag_compras(current_user: dict = Depends(get_current_user)):
    """
    Relatório de chamados para Ag. Compras
    Filtros:
    - Status "Aguardando Estoque" há mais de X dias úteis (baseado no fornecedor)
    - OU status "Pedido Aprovado" (sempre entra)
    """
    # Buscar chamados com Ag. Compras
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Compras", "pendente": True},
        {"_id": 0}
    ).to_list(5000)
    
    # Carregar tabela de fornecedores com dias extras
    fornecedores_dict = {}
    fornecedores = await db.fornecedores.find({}, {"_id": 0}).to_list(100)
    for f in fornecedores:
        fornecedores_dict[f.get('nome', '').lower()] = f.get('dias_extras_padrao', 5)
    
    resultado = []
    for chamado in chamados:
        # Buscar dados do pedido ERP
        pedido = await db.pedidos_erp.find_one(
            {"numero_pedido": chamado.get('numero_pedido')},
            {"_id": 0}
        )
        
        if not pedido:
            continue
        
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        fornecedor = pedido.get('departamento', '')
        
        # Verificar se deve entrar no relatório
        incluir = False
        
        # Regra 1: Pedido Aprovado sempre entra
        if 'pedido aprovado' in status_pedido:
            incluir = True
        
        # Regra 2: Aguardando Estoque com dias extras do fornecedor
        elif 'aguardando estoque' in status_pedido:
            # Buscar dias extras do fornecedor
            dias_extras = fornecedores_dict.get(fornecedor.lower(), 5)
            
            # Calcular dias úteis desde o último status
            dias_em_estoque = calcular_dias_uteis(data_status)
            
            if dias_em_estoque >= dias_extras:
                incluir = True
        
        if not incluir:
            continue
        
        # Determinar status do atendimento
        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"
        
        item = {
            "fornecedor": fornecedor,
            "produto": pedido.get('produto', '') or chamado.get('produto', ''),
            "id_produto": pedido.get('codigo_item_bseller', ''),
            "quantidade": pedido.get('quantidade', ''),
            "codigo_fornecedor": pedido.get('codigo_fornecedor', ''),
            "entrega": chamado.get('numero_pedido', ''),
            "status_atendimento": status_atendimento,
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status
        }
        resultado.append(item)
    
    return resultado

@api_router.get("/relatorios/ag-logistica")
async def get_relatorio_ag_logistica(current_user: dict = Depends(get_current_user)):
    """
    Relatório de chamados para Ag. Logística
    Filtros:
    - Status: "Entregue a transportadora", "Nota fiscal emitida", "Nota fiscal aprovada", 
      ou "Separado" há mais de 2 dias úteis
    - OU status "Pedido Aprovado" (sempre entra)
    """
    # Status válidos para o relatório de logística
    STATUS_LOGISTICA = [
        'entregue a transportadora',
        'nota fiscal emitida', 
        'nota fiscal aprovada',
        'separado'
    ]
    
    # Buscar chamados com Ag. Logística
    chamados = await db.chamados.find(
        {"motivo_pendencia": "Ag. Logística", "pendente": True},
        {"_id": 0}
    ).to_list(5000)
    
    resultado = []
    for chamado in chamados:
        # Buscar dados do pedido ERP
        pedido = await db.pedidos_erp.find_one(
            {"numero_pedido": chamado.get('numero_pedido')},
            {"_id": 0}
        )
        
        if not pedido:
            continue
        
        status_pedido = pedido.get('status_pedido', '').lower()
        data_status = pedido.get('data_status', '')
        
        # Verificar se deve entrar no relatório
        incluir = False
        
        # Regra 1: Pedido Aprovado sempre entra
        if 'pedido aprovado' in status_pedido:
            incluir = True
        
        # Regra 2: Status específicos há mais de 2 dias úteis
        else:
            for status_valido in STATUS_LOGISTICA:
                if status_valido in status_pedido:
                    dias_no_status = calcular_dias_uteis(data_status)
                    if dias_no_status >= 2:
                        incluir = True
                        break
        
        if not incluir:
            continue
        
        # Determinar status do atendimento
        status_atendimento = ""
        if chamado.get('retornar_chamado'):
            status_atendimento = "Retornar"
        elif chamado.get('verificar_adneia'):
            status_atendimento = "Verificar"
        
        item = {
            "entrega": chamado.get('numero_pedido', ''),
            "nota": pedido.get('nota_fiscal', ''),
            "galpao": pedido.get('filial', ''),
            "status_entrega": pedido.get('status_pedido', ''),
            "data_ultimo_ponto": data_status,
            "status_atendimento": status_atendimento
        }
        resultado.append(item)
    
    return resultado

@api_router.get("/chamados/{chamado_id}", response_model=dict)
async def get_chamado(chamado_id: str, current_user: dict = Depends(get_current_user)):
    # Buscar por ID ou por id_atendimento (ATD-2026-XXX)
    chamado = await db.chamados.find_one(
        {"$or": [{"id": chamado_id}, {"id_atendimento": chamado_id}]}, 
        {"_id": 0}
    )
    if not chamado:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")
    
    # Calculate days open
    now = datetime.now(timezone.utc)
    data_abertura = datetime.fromisoformat(chamado['data_abertura'].replace('Z', '+00:00')) if isinstance(chamado['data_abertura'], str) else chamado['data_abertura']
    if chamado.get('pendente', True):
        chamado['dias_aberto'] = (now - data_abertura).days
    else:
        chamado['dias_aberto'] = 0
    
    # Get pedido ERP info if exists
    pedido = await db.pedidos_erp.find_one({"numero_pedido": chamado['numero_pedido']}, {"_id": 0})
    if pedido:
        chamado['pedido_erp'] = pedido
    
    # Get reversa if exists
    reversa = await db.reversas.find_one({"chamado_id": chamado['id']}, {"_id": 0})
    if reversa:
        chamado['reversa'] = reversa
    
    return chamado

def sync_update_to_google_sheets(id_atendimento: str, updates: dict):
    """Background task to sync atendimento updates to Google Sheets"""
    try:
        sheets_client.update_atendimento(id_atendimento, updates)
    except Exception as e:
        logger.error(f"Error syncing update to Google Sheets: {e}")

@api_router.put("/chamados/{chamado_id}", response_model=dict)
async def update_chamado(
    chamado_id: str, 
    chamado_data: ChamadoUpdate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.chamados.find_one({"id": chamado_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    
    update_data = {k: v for k, v in chamado_data.model_dump().items() if v is not None}
    
    # Check if status changed to Fechado
    if update_data.get('status_atendimento') == 'Fechado' and existing.get('status_atendimento') != 'Fechado':
        update_data['data_resolucao'] = datetime.now(timezone.utc).isoformat()
    
    # Check if pendente changed to False (encerramento)
    if 'pendente' in update_data and not update_data['pendente'] and existing.get('pendente', True):
        update_data['data_fechamento'] = datetime.now(timezone.utc).isoformat()
    
    if update_data:
        await db.chamados.update_one({"id": chamado_id}, {"$set": update_data})
        
        # Create history entry for status change
        if 'status_atendimento' in update_data or 'status_chamado' in update_data or 'pendente' in update_data:
            historico = Historico(
                chamado_id=chamado_id,
                tipo_acao="Atualização de Status",
                descricao=f"Status atualizado: {update_data.get('status_atendimento', '')} / Pendente: {'NÃO' if not update_data.get('pendente', True) else 'SIM'}",
                usuario_id=current_user['id'],
                usuario_nome=current_user['name']
            )
            hist_dict = historico.model_dump()
            hist_dict['data_hora'] = hist_dict['data_hora'].isoformat()
            await db.historico.insert_one(hist_dict)
        
        # Sync to Google Sheets in background
        id_atendimento = existing.get('id_atendimento')
        if id_atendimento:
            background_tasks.add_task(sync_update_to_google_sheets, id_atendimento, update_data)
    
    return {"message": "Chamado atualizado com sucesso", "google_sheets_sync": "queued"}

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

# ============== DEVOLUCOES ROUTES ==============

class DevolucaoCreate(BaseModel):
    numero_pedido: str
    nome_cliente: str
    cpf_cliente: Optional[str] = None
    solicitacao: Optional[str] = None
    canal_vendas: Optional[str] = None
    motivo: Optional[str] = None
    data_devolucao: Optional[str] = None
    codigo_reversa: Optional[str] = None
    chamado_id: Optional[str] = None
    id_atendimento: Optional[str] = None
    produto: Optional[str] = None
    filial: Optional[str] = None

@api_router.post("/devolucoes", response_model=dict)
async def create_devolucao(devolucao_data: DevolucaoCreate, current_user: dict = Depends(get_current_user)):
    """Registrar uma devolução na planilha Google Sheets"""
    try:
        from google_sheets import sheets_client
        
        # Gerar ID único da devolução
        from uuid import uuid4
        id_devolucao = f"DEV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid4())[:6].upper()}"
        
        # Preparar dados para a planilha no formato das colunas
        data_atual = datetime.now(timezone.utc).strftime('%d/%m/%Y')
        
        row_data = {
            'id_devolucao': id_devolucao,
            'id_atendimento': devolucao_data.id_atendimento or '',
            'data_entrada': devolucao_data.data_devolucao or data_atual,
            'numero_pedido': devolucao_data.numero_pedido,
            'cpf_cliente': devolucao_data.cpf_cliente or '',
            'nome_cliente': devolucao_data.nome_cliente,
            'produto': devolucao_data.produto or '',
            'filial': devolucao_data.filial or '',
            'codigo_reversa': devolucao_data.codigo_reversa or '',
            'canal_vendas': devolucao_data.canal_vendas or '',
            'motivo': devolucao_data.motivo or '',
            'solicitacao': devolucao_data.solicitacao or '',
            'status': 'Em devolução',
            'responsavel': current_user.get('name', '')
        }
        
        # Adicionar à planilha de devoluções
        result = sheets_client.add_devolucao_row(row_data)
        
        return {
            "message": "Devolução registrada com sucesso na planilha",
            "sync_status": "success" if result else "failed",
            "id_devolucao": id_devolucao
        }
    except Exception as e:
        logger.error(f"Erro ao registrar devolução: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "message": "Erro ao registrar devolução na planilha",
            "sync_status": "error",
            "error": str(e)
        }

# ============== PEDIDOS ERP ROUTES ==============

def get_galpao_from_serie(serie_nf: str, chave_nota: str = None) -> dict:
    """Retorna informações do galpão baseado na série da NF"""
    # Se série não foi passada, tentar extrair da chave de acesso
    if not serie_nf and chave_nota and len(chave_nota) >= 25:
        # Na chave NFe, a série está na posição 22-25 (índices 22:25)
        # Formato: UUAAMM CNPJ MOD SER NUM CODIGO CIG
        # Posições: 0-1 UF, 2-5 AAMM, 6-19 CNPJ, 20-21 MOD, 22-24 SÉRIE
        try:
            serie_nf = str(int(chave_nota[22:25]))  # Remove zeros à esquerda
        except (ValueError, IndexError):
            pass
    
    if not serie_nf:
        return {"galpao": "Não identificado", "uf_galpao": "-"}
    
    serie_str = str(serie_nf).strip()
    
    if serie_str == "1":
        return {"galpao": "Santa Catarina", "uf_galpao": "SC", "serie_nf": "1"}
    elif serie_str == "6":
        return {"galpao": "São Paulo", "uf_galpao": "SP", "serie_nf": "6"}
    elif serie_str == "2":
        return {"galpao": "Espírito Santo", "uf_galpao": "ES", "serie_nf": "2"}
    else:
        return {"galpao": f"Série {serie_str}", "uf_galpao": "-", "serie_nf": serie_str}

@api_router.get("/pedidos-erp/buscar/cpf/{cpf}")
async def get_pedidos_by_cpf(cpf: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por CPF - retorna todos os pedidos do cliente"""
    # Limpar CPF (remover pontos e traços)
    cpf_limpo = cpf.replace('.', '').replace('-', '').replace(' ', '')
    
    # Remover zeros à esquerda para match com dados do banco
    cpf_sem_zeros = cpf_limpo.lstrip('0')
    
    # Buscar tanto com CPF completo quanto sem zeros à esquerda
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"cpf_cliente": {"$regex": f"^{cpf_limpo}$"}},
            {"cpf_cliente": {"$regex": f"^{cpf_sem_zeros}$"}},
            {"cpf_cliente": {"$regex": cpf_limpo}},
            {"cpf_cliente": {"$regex": cpf_sem_zeros}}
        ]}, 
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    # Adicionar info do galpão
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
    
    return pedidos

@api_router.get("/pedidos-erp/buscar/nome/{nome}", response_model=List[dict])
async def get_pedidos_by_nome(nome: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por Nome do cliente - retorna todos os pedidos"""
    pedidos = await db.pedidos_erp.find(
        {"nome_cliente": {"$regex": nome, "$options": "i"}}, 
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    # Adicionar info do galpão
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
    
    return pedidos

@api_router.get("/pedidos-erp/buscar/pedido/{pedido}", response_model=List[dict])
async def get_pedidos_by_pedido(pedido: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por número de pedido (numero_pedido, pedido_cliente ou pedido_externo)"""
    pedidos = await db.pedidos_erp.find(
        {"$or": [
            {"numero_pedido": {"$regex": pedido, "$options": "i"}},
            {"pedido_cliente": {"$regex": pedido, "$options": "i"}},
            {"pedido_externo": {"$regex": pedido, "$options": "i"}}
        ]}, 
        {"_id": 0}
    ).sort("data_status", -1).to_list(100)
    
    # Adicionar info do galpão
    for p in pedidos:
        galpao_info = get_galpao_from_serie(p.get('serie_nf'), p.get('chave_nota'))
        p.update(galpao_info)
    
    return pedidos

@api_router.get("/pedidos-erp/{numero_pedido}", response_model=dict)
async def get_pedido_erp(numero_pedido: str, current_user: dict = Depends(get_current_user)):
    pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # Adicionar info do galpão
    galpao_info = get_galpao_from_serie(pedido.get('serie_nf'), pedido.get('chave_nota'))
    pedido.update(galpao_info)
    
    return pedido

@api_router.post("/pedidos-erp/import", response_model=dict)
async def import_pedidos(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo não fornecido")
    
    filename = file.filename.lower()
    
    try:
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        logger.info(f"Arquivo recebido: {filename}, tamanho: {file_size_mb:.2f} MB")
    except Exception as e:
        logger.error(f"Erro ao ler arquivo: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
            df_fornecedores = None
        elif filename.endswith(('.xlsx', '.xls')):
            # Tentar ler a aba principal (Tabelão ou primeira aba)
            excel_file = pd.ExcelFile(io.BytesIO(content))
            sheet_names = excel_file.sheet_names
            logger.info(f"Abas encontradas: {sheet_names}")
            
            # Ler aba principal (Tabelão ou primeira)
            if 'Tabelão' in sheet_names:
                df = pd.read_excel(excel_file, sheet_name='Tabelão')
            else:
                df = pd.read_excel(excel_file, sheet_name=0)
            
            # Tentar ler aba Fornecedores se existir
            df_fornecedores = None
            if 'Fornecedores' in sheet_names:
                df_fornecedores = pd.read_excel(excel_file, sheet_name='Fornecedores')
                logger.info(f"Aba Fornecedores encontrada: {len(df_fornecedores)} registros")
                # Importar fornecedores para o banco
                await import_fornecedores(df_fornecedores)
        else:
            raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use CSV ou Excel.")
        
        total_rows = len(df)
        logger.info(f"Arquivo parseado com sucesso: {total_rows} linhas")
        
        # Para arquivos grandes (>5000 linhas), processar em background
        if total_rows > 5000:
            import_id = str(uuid.uuid4())
            
            # Criar registro de importação
            await db.import_jobs.insert_one({
                "import_id": import_id,
                "filename": filename,
                "total_rows": total_rows,
                "status": "processing",
                "imported": 0,
                "updated": 0,
                "skipped_old": 0,
                "errors": 0,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": None
            })
            
            # Iniciar processamento em background
            background_tasks.add_task(process_import_background, import_id, df)
            
            return {
                "message": f"Importação iniciada em background. {total_rows} linhas serão processadas.",
                "import_id": import_id,
                "status": "processing",
                "total_rows": total_rows
            }
        
        # Para arquivos pequenos, processar imediatamente
        result = await process_import_sync(df)
        return result
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

# Função para importar tabela de fornecedores com dias extras
async def import_fornecedores(df):
    """Importa tabela de fornecedores com dias extras padrão"""
    try:
        df.columns = df.columns.str.strip().str.lower()
        
        for idx, row in df.iterrows():
            fornecedor = None
            dias_extras = 5  # Default
            
            # Tentar encontrar coluna de fornecedor
            for col in ['fornecedor', 'nome', 'nome_fornecedor']:
                if col in df.columns:
                    fornecedor = str(row.get(col, '')).strip()
                    break
            
            # Tentar encontrar coluna de dias extras
            for col in ['dias extras padrão (dias úteis)', 'dias extras padrão', 'dias extras', 'dias_extras']:
                if col in df.columns:
                    val = row.get(col)
                    if pd.notna(val):
                        dias_extras = int(val)
                    break
            
            if fornecedor and fornecedor.lower() != 'nan':
                await db.fornecedores.update_one(
                    {"nome": fornecedor},
                    {"$set": {
                        "nome": fornecedor,
                        "dias_extras_padrao": dias_extras,
                        "ultima_atualizacao": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
        
        logger.info("Fornecedores importados com sucesso")
    except Exception as e:
        logger.error(f"Erro ao importar fornecedores: {e}")

@api_router.get("/fornecedores")
async def list_fornecedores(current_user: dict = Depends(get_current_user)):
    """Lista todos os fornecedores com seus dias extras padrão"""
    fornecedores = await db.fornecedores.find({}, {"_id": 0}).sort("nome", 1).to_list(100)
    return fornecedores

# Função auxiliar para processamento síncrono
async def process_import_sync(df):
    """Processa importação de forma síncrona para arquivos pequenos"""
    column_mapping = get_column_mapping()
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()
    original_columns = list(df.columns)
    
    # Calcular data limite (6 meses atrás)
    data_limite = datetime.now(timezone.utc) - timedelta(days=180)
    
    imported = 0
    updated = 0
    errors = 0
    skipped_old = 0
    
    for idx, row in df.iterrows():
        try:
            pedido_data = extract_pedido_data(row, column_mapping, original_columns)
            
            if not pedido_data.get('numero_pedido'):
                continue
            
            # Filtrar por data
            if should_skip_old_pedido(pedido_data, data_limite):
                skipped_old += 1
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
                pedido = PedidoERPBase(**pedido_data)
                pedido_dict = pedido.model_dump()
                pedido_dict['ultima_atualizacao'] = pedido_dict['ultima_atualizacao'].isoformat()
                await db.pedidos_erp.insert_one(pedido_dict)
                imported += 1
        except Exception as e:
            logger.error(f"Erro na linha {idx}: {str(e)}")
            errors += 1
            continue
    
    # Executar atualização automática de motivos de pendência
    await atualizar_motivos_pendencia_automatico()
    
    return {
        "message": f"Importação concluída: {imported} novos, {updated} atualizados, {skipped_old} ignorados (>6 meses), {errors} erros",
        "imported": imported,
        "updated": updated,
        "skipped_old": skipped_old,
        "errors": errors
    }

# Função para processamento em background (para arquivos grandes)
async def process_import_background(import_id: str, df):
    """Processa importação em background para arquivos grandes"""
    column_mapping = get_column_mapping()
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()
    original_columns = list(df.columns)
    
    # Calcular data limite (6 meses atrás)
    data_limite = datetime.now(timezone.utc) - timedelta(days=180)
    logger.info(f"[{import_id}] Iniciando processamento em background: {len(df)} linhas")
    
    imported = 0
    updated = 0
    errors = 0
    skipped_old = 0
    
    for idx, row in df.iterrows():
        try:
            pedido_data = extract_pedido_data(row, column_mapping, original_columns)
            
            if not pedido_data.get('numero_pedido'):
                continue
            
            # Filtrar por data
            if should_skip_old_pedido(pedido_data, data_limite):
                skipped_old += 1
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
                pedido = PedidoERPBase(**pedido_data)
                pedido_dict = pedido.model_dump()
                pedido_dict['ultima_atualizacao'] = pedido_dict['ultima_atualizacao'].isoformat()
                await db.pedidos_erp.insert_one(pedido_dict)
                imported += 1
            
            # Atualizar progresso a cada 1000 registros
            if (idx + 1) % 1000 == 0:
                await db.import_jobs.update_one(
                    {"import_id": import_id},
                    {"$set": {
                        "imported": imported,
                        "updated": updated,
                        "skipped_old": skipped_old,
                        "errors": errors
                    }}
                )
                logger.info(f"[{import_id}] Progresso: {idx + 1} linhas processadas")
                
        except Exception as e:
            logger.error(f"[{import_id}] Erro na linha {idx}: {str(e)}")
            errors += 1
            continue
    
    # Atualizar status final
    await db.import_jobs.update_one(
        {"import_id": import_id},
        {"$set": {
            "status": "completed",
            "imported": imported,
            "updated": updated,
            "skipped_old": skipped_old,
            "errors": errors,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    logger.info(f"[{import_id}] Importação concluída: {imported} novos, {updated} atualizados, {skipped_old} ignorados, {errors} erros")
    
    # Executar atualização automática de motivos de pendência
    await atualizar_motivos_pendencia_automatico()

async def atualizar_motivos_pendencia_automatico():
    """
    Atualiza automaticamente os motivos de pendência dos chamados
    baseado nas mudanças de status dos pedidos ERP
    """
    logger.info("Iniciando atualização automática de motivos de pendência...")
    atualizacoes = {"compras_para_logistica": 0, "logistica_para_enviado": 0, 
                   "enviado_para_entregue": 0, "enviado_para_ag_transportadora": 0}
    
    # Buscar todos os chamados pendentes
    chamados = await db.chamados.find({"pendente": True}, {"_id": 0}).to_list(5000)
    
    for chamado in chamados:
        numero_pedido = chamado.get('numero_pedido')
        motivo_atual = chamado.get('motivo_pendencia', '')
        
        if not numero_pedido:
            continue
        
        # Buscar pedido ERP atualizado
        pedido = await db.pedidos_erp.find_one({"numero_pedido": numero_pedido}, {"_id": 0})
        if not pedido:
            continue
        
        status_pedido = pedido.get('status_pedido', '')
        data_status = pedido.get('data_status', '')
        novo_motivo = None
        
        # Regra 1: Ag. Compras → Ag. Logística
        # Quando sair de "Aguardando estoque" para qualquer outro status
        if motivo_atual == 'Ag. Compras':
            if status_pedido and status_pedido.lower() != 'aguardando estoque':
                novo_motivo = 'Ag. Logística'
                atualizacoes['compras_para_logistica'] += 1
        
        # Regra 2: Ag. Logística → Enviado
        # Quando status mudar para MAIÚSCULAS (ex: SAIDA DA FILIAL)
        elif motivo_atual == 'Ag. Logística':
            if is_status_maiusculo(status_pedido):
                novo_motivo = 'Enviado'
                atualizacoes['logistica_para_enviado'] += 1
        
        # Regra 3 e 4: Para status "Enviado"
        elif motivo_atual == 'Enviado':
            # Regra 3: Enviado → Entregue (quando status = "Entregue ao cliente")
            if status_pedido and 'entregue' in status_pedido.lower():
                novo_motivo = 'Entregue'
                atualizacoes['enviado_para_entregue'] += 1
            
            # Regra 4: Enviado → Ag. Transportadora (status maiúsculo sem mudança por 3+ dias úteis)
            elif is_status_maiusculo(status_pedido) and data_status:
                dias_sem_mudanca = calcular_dias_uteis(data_status)
                if dias_sem_mudanca >= 3:
                    novo_motivo = 'Ag. Transportadora'
                    atualizacoes['enviado_para_ag_transportadora'] += 1
        
        # Aplicar atualização se necessário
        if novo_motivo:
            await db.chamados.update_one(
                {"id_atendimento": chamado.get('id_atendimento')},
                {"$set": {"motivo_pendencia": novo_motivo}}
            )
            logger.info(f"Chamado {chamado.get('id_atendimento')}: {motivo_atual} → {novo_motivo}")
    
    logger.info(f"Atualização automática concluída: {atualizacoes}")

def get_column_mapping():
    """Retorna o mapeamento de colunas para importação"""
    return {
        'numero_pedido': ['entrega'],
        'canal_vendas': ['nome canal de vendas'],
        'pedido_cliente': ['ped. cliente'],
        'pedido_externo': ['ped. externo'],
        'cpf_cliente': ['cpf'],
        'nome_cliente': ['nome'],
        'cep': ['cep'],
        'cidade': ['cidade'],
        'uf': ['uf'],
        'fone_cliente': ['fone'],
        'email_cliente': ['e-mail'],
        'status_pedido': ['status da entrega', 'status'],
        'data_status': ['dt.ult.ponto de controle'],
        'transportadora': ['transportadora'],
        'departamento': ['nome_5'],
        'codigo_item_bseller': ['item'],
        'produto': ['nome do produto'],
        'codigo_item_vtex': ['c?d. terceiro', 'cód. terceiro'],
        'quantidade': ['qtde pedido'],
        'preco_final': ['pre?o final', 'preço final'],
        'frete': ['frete'],
        'filial': ['uf.1'],
        'nota_fiscal': ['nota'],
        'serie_nf': ['série', 'serie'],
        'chave_nota': ['chave acesso'],
        'pedido_troca': ['pedido troca'],
        'codigo_fornecedor': ['cód. fornecedor', 'cód. fornecedor do sigeq230', 'codigo_fornecedor', 'cod. fornecedor', 'cod fornecedor', 'codfornecedor'],
    }

def extract_pedido_data(row, column_mapping, original_columns):
    """Extrai dados do pedido de uma linha do DataFrame"""
    pedido_data = {}
    for field, possible_names in column_mapping.items():
        for name in possible_names:
            name_lower = name.lower()
            if name_lower in original_columns:
                value = row.get(name_lower)
                if pd.notna(value):
                    pedido_data[field] = str(value).strip()
                break
    return pedido_data

def should_skip_old_pedido(pedido_data, data_limite):
    """Verifica se o pedido deve ser ignorado por ser muito antigo"""
    if 'data_status' in pedido_data and pedido_data['data_status']:
        try:
            data_str = pedido_data['data_status'].split()[0]
            data_pedido = datetime.strptime(data_str, '%d/%m/%Y')
            data_pedido = data_pedido.replace(tzinfo=timezone.utc)
            return data_pedido < data_limite
        except (ValueError, IndexError):
            pass
    return False

# Endpoint para verificar status de importação
@api_router.get("/pedidos-erp/import-status/{import_id}")
async def get_import_status(import_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.import_jobs.find_one({"import_id": import_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return job

@api_router.get("/pedidos-erp", response_model=List[dict])
async def list_pedidos_erp(current_user: dict = Depends(get_current_user)):
    pedidos = await db.pedidos_erp.find({}, {"_id": 0}).to_list(1000)
    return pedidos

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=dict)
async def get_dashboard_stats(
    periodo_dias: int = 30,
    categoria: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    # Filtro base por período
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    base_query = {}
    
    if periodo_dias < 365:  # Se não for "todos"
        base_query["data_abertura"] = {"$gte": periodo_inicio}
    
    if categoria:
        base_query["categoria"] = categoria
    
    # Total geral de atendimentos no período
    total_geral = await db.chamados.count_documents(base_query)
    
    # Total atendimentos pendentes vs resolvidos
    pendentes_query = {**base_query, "pendente": True}
    resolvidos_query = {**base_query, "pendente": False}
    
    total_pendentes = await db.chamados.count_documents(pendentes_query)
    total_resolvidos = await db.chamados.count_documents(resolvidos_query)
    
    # Atendimento mais antigo em aberto
    atendimento_mais_antigo = await db.chamados.find_one(
        {"pendente": True},
        {"_id": 0, "data_abertura": 1, "id_atendimento": 1}
    )
    dias_mais_antigo = 0
    id_mais_antigo = None
    if atendimento_mais_antigo:
        data_abertura = datetime.fromisoformat(
            atendimento_mais_antigo['data_abertura'].replace('Z', '+00:00')
        ) if isinstance(atendimento_mais_antigo['data_abertura'], str) else atendimento_mais_antigo['data_abertura']
        dias_mais_antigo = (now - data_abertura).days
        id_mais_antigo = atendimento_mais_antigo.get('id_atendimento')
    
    # Atendimentos por categoria com contagem
    pipeline_categoria = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}  # Ordenar da maior para menor
    ]
    por_categoria = await db.chamados.aggregate(pipeline_categoria).to_list(100)
    
    # Atendimentos por atendente
    pipeline_atendente = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$atendente", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_atendente = await db.chamados.aggregate(pipeline_atendente).to_list(100)
    
    # Atendimentos por parceiro/canal
    pipeline_parceiro = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$parceiro", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_parceiro = await db.chamados.aggregate(pipeline_parceiro).to_list(100)
    
    # Atendimentos que precisam de atenção (pendentes há mais de 3 dias)
    tres_dias_atras = (now - timedelta(days=3)).isoformat()
    
    chamados_atencao = await db.chamados.find({
        "pendente": True,
        "data_abertura": {"$lt": tres_dias_atras}
    }, {"_id": 0}).sort("data_abertura", 1).to_list(10)
    
    # Calculate days open
    for c in chamados_atencao:
        data_abertura = datetime.fromisoformat(c['data_abertura'].replace('Z', '+00:00')) if isinstance(c['data_abertura'], str) else c['data_abertura']
        c['dias_aberto'] = (now - data_abertura).days
    
    # Últimos N dias - abertos vs resolvidos (dinâmico)
    dias_grafico = min(periodo_dias, 30)  # Max 30 dias no gráfico
    ultimos_dias = []
    for i in range(dias_grafico - 1, -1, -1):
        dia = now - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        abertos_dia = await db.chamados.count_documents({
            "data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}
        })
        
        resolvidos_dia = await db.chamados.count_documents({
            "data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}
        })
        
        ultimos_dias.append({
            "data": dia.strftime("%d/%m"),
            "abertos": abertos_dia,
            "resolvidos": resolvidos_dia
        })
    
    # Total de atendimentos por mês (últimos 6 meses)
    atendimentos_por_mes = []
    for i in range(5, -1, -1):
        mes = now - timedelta(days=i*30)
        mes_inicio = mes.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if mes.month == 12:
            mes_fim = mes.replace(year=mes.year + 1, month=1, day=1) - timedelta(seconds=1)
        else:
            mes_fim = mes.replace(month=mes.month + 1, day=1) - timedelta(seconds=1)
        
        count = await db.chamados.count_documents({
            "data_abertura": {
                "$gte": mes_inicio.isoformat(),
                "$lte": mes_fim.isoformat()
            }
        })
        
        atendimentos_por_mes.append({
            "mes": mes.strftime("%b/%y"),
            "total": count
        })
    
    # Média de tempo de resolução (apenas finalizados)
    pipeline_tempo = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}}},
        {"$project": {
            "tempo": {"$subtract": [
                {"$dateFromString": {"dateString": "$data_fechamento"}},
                {"$dateFromString": {"dateString": "$data_abertura"}}
            ]}
        }},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    tempo_result = await db.chamados.aggregate(pipeline_tempo).to_list(1)
    media_tempo_ms = tempo_result[0]['media'] if tempo_result else 0
    media_tempo_dias = round(media_tempo_ms / (1000 * 60 * 60 * 24), 2) if media_tempo_ms else 0
    
    # Total de pedidos na base
    total_pedidos = await db.pedidos_erp.count_documents({})
    
    return {
        "total_geral": total_geral,
        "total_pendentes": total_pendentes,
        "total_resolvidos": total_resolvidos,
        "total_pedidos_base": total_pedidos,
        "dias_mais_antigo": dias_mais_antigo,
        "id_mais_antigo": id_mais_antigo,
        "por_categoria": [{"categoria": item['_id'], "count": item['count']} for item in por_categoria if item['_id']],
        "por_atendente": {item['_id']: item['count'] for item in por_atendente if item['_id']},
        "por_parceiro": {item['_id']: item['count'] for item in por_parceiro if item['_id']},
        "chamados_atencao": chamados_atencao,
        "ultimos_dias": ultimos_dias,
        "atendimentos_por_mes": atendimentos_por_mes,
        "media_tempo_resolucao_dias": media_tempo_dias,
        "periodo_dias": periodo_dias
    }

# ============== DASHBOARD V2 - MULTI-TAB ==============

@api_router.get("/dashboard/v2/visao-geral")
async def get_dashboard_visao_geral(
    periodo_dias: int = 30,
    canal: Optional[str] = None,
    fornecedor: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Aba 1 - Visão Geral"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_query = {}
    if periodo_dias < 365:
        base_query["data_abertura"] = {"$gte": periodo_inicio}
    if canal:
        base_query["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    if fornecedor:
        base_query["codigo_fornecedor"] = fornecedor
    
    # Totais
    total = await db.chamados.count_documents(base_query)
    pendentes = await db.chamados.count_documents({**base_query, "pendente": True})
    resolvidos = await db.chamados.count_documents({**base_query, "pendente": False})
    
    # Atendimento mais antigo
    mais_antigo = await db.chamados.find_one(
        {"pendente": True}, 
        {"_id": 0, "data_abertura": 1, "id_atendimento": 1},
        sort=[("data_abertura", 1)]
    )
    dias_mais_antigo = 0
    data_mais_antigo = None
    id_mais_antigo = None
    if mais_antigo:
        data_abertura = datetime.fromisoformat(mais_antigo['data_abertura'].replace('Z', '+00:00'))
        dias_mais_antigo = (now - data_abertura).days
        data_mais_antigo = mais_antigo['data_abertura']
        id_mais_antigo = mais_antigo.get('id_atendimento')
    
    # Tempo médio
    pipeline_tempo = [
        {"$match": {"pendente": False, "data_fechamento": {"$ne": None}}},
        {"$project": {
            "tempo": {"$subtract": [
                {"$dateFromString": {"dateString": "$data_fechamento"}},
                {"$dateFromString": {"dateString": "$data_abertura"}}
            ]}
        }},
        {"$group": {"_id": None, "media": {"$avg": "$tempo"}}}
    ]
    tempo_result = await db.chamados.aggregate(pipeline_tempo).to_list(1)
    tempo_medio = round((tempo_result[0]['media'] / (1000 * 60 * 60 * 24)), 2) if tempo_result and tempo_result[0]['media'] else 0
    
    # Por mês (últimos 6)
    por_mes = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if mes_ref.month == 12:
            mes_fim = mes_ref.replace(year=mes_ref.year + 1, month=1, day=1) - timedelta(seconds=1)
        else:
            mes_fim = mes_ref.replace(month=mes_ref.month + 1, day=1) - timedelta(seconds=1)
        
        count = await db.chamados.count_documents({
            "data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}
        })
        por_mes.append({"mes": mes_ref.strftime("%b/%y"), "total": count})
    
    # Por dia (últimos N dias)
    dias_grafico = min(periodo_dias, 30)
    por_dia = []
    for i in range(dias_grafico - 1, -1, -1):
        dia = now - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        abertos = await db.chamados.count_documents({"data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}})
        resolvidos_dia = await db.chamados.count_documents({"data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}})
        
        por_dia.append({"data": dia.strftime("%d/%m"), "abertos": abertos, "resolvidos": resolvidos_dia})
    
    # Base Emergent
    total_pedidos = await db.pedidos_erp.count_documents({})
    
    # Últimos 10 dias úteis (Segunda a Sexta)
    dias_uteis = []
    dia_atual = now
    while len(dias_uteis) < 10:
        # Pegar apenas dias úteis (0=Seg, 4=Sex)
        if dia_atual.weekday() < 5:  # Segunda a Sexta
            dias_uteis.insert(0, dia_atual)  # Inserir no início para ordem crescente
        dia_atual -= timedelta(days=1)
    
    # Buscar todos os canais
    canais_unicos = await db.chamados.distinct("parceiro")
    canais_unicos = [c for c in canais_unicos if c]  # Remover None/vazio
    
    # Para cada canal, contar AR/A/F por dia
    por_canal_dia = []
    totais_por_dia = {}
    
    for dia in dias_uteis:
        dia_key = dia.strftime("%d/%m")
        totais_por_dia[dia_key] = {"ar": 0, "a": 0, "f": 0}
    
    for canal in canais_unicos:
        canal_data = {"canal": canal, "dias": {}}
        total_canal = {"ar": 0, "a": 0, "f": 0}
        
        for dia in dias_uteis:
            dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            dia_fim = dia.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
            
            # AR = Abertos naquele dia
            ar = await db.chamados.count_documents({
                "$or": [{"parceiro": canal}, {"canal_vendas": canal}],
                "data_abertura": {"$gte": dia_inicio, "$lte": dia_fim}
            })
            
            # A = Em andamento (pendentes) - contagem acumulada até aquele dia
            a = await db.chamados.count_documents({
                "$or": [{"parceiro": canal}, {"canal_vendas": canal}],
                "pendente": True,
                "data_abertura": {"$lte": dia_fim}
            })
            
            # F = Fechados naquele dia
            f = await db.chamados.count_documents({
                "$or": [{"parceiro": canal}, {"canal_vendas": canal}],
                "data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}
            })
            
            dia_key = dia.strftime("%d/%m")
            canal_data["dias"][dia_key] = {"ar": ar, "a": a, "f": f}
            
            total_canal["ar"] += ar
            total_canal["f"] += f
            totais_por_dia[dia_key]["ar"] += ar
            totais_por_dia[dia_key]["a"] += a
            totais_por_dia[dia_key]["f"] += f
        
        # Pegar o "A" do último dia como total em andamento
        ultimo_dia_key = dias_uteis[-1].strftime("%d/%m")
        total_canal["a"] = canal_data["dias"][ultimo_dia_key]["a"]
        
        # Só adicionar se tiver algum atendimento
        if total_canal["ar"] > 0 or total_canal["a"] > 0 or total_canal["f"] > 0:
            canal_data["total"] = total_canal
            por_canal_dia.append(canal_data)
    
    # Ordenar por total de abertos (decrescente)
    por_canal_dia.sort(key=lambda x: x["total"]["ar"] + x["total"]["a"], reverse=True)
    
    # Formatar cabeçalhos dos dias (com dia da semana)
    dias_headers = []
    dias_semana_pt = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    for dia in dias_uteis:
        dias_headers.append({
            "data": dia.strftime("%d/%m"),
            "dia_semana": dias_semana_pt[dia.weekday()],
            "dia_num": dia.strftime("%d")
        })
    
    # Atendimentos por Canal (totais - manter para compatibilidade)
    pipeline_por_canal = [
        {"$group": {
            "_id": {"$ifNull": ["$parceiro", "$canal_vendas"]},
            "total": {"$sum": 1},
            "pendentes": {"$sum": {"$cond": [{"$eq": ["$pendente", True]}, 1, 0]}},
            "fechados": {"$sum": {"$cond": [{"$eq": ["$pendente", False]}, 1, 0]}}
        }},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"total": -1}}
    ]
    por_canal_raw = await db.chamados.aggregate(pipeline_por_canal).to_list(50)
    
    por_canal = []
    for item in por_canal_raw:
        canal_nome = item['_id'] or 'Sem Canal'
        por_canal.append({
            "canal": canal_nome,
            "ar": item['total'],
            "a": item['pendentes'],
            "f": item['fechados']
        })
    
    return {
        "total": total, "pendentes": pendentes, "resolvidos": resolvidos,
        "tempo_medio": tempo_medio, "dias_mais_antigo": dias_mais_antigo,
        "data_mais_antigo": data_mais_antigo, "id_mais_antigo": id_mais_antigo,
        "total_pedidos": total_pedidos, "por_mes": por_mes, "por_dia": por_dia,
        "por_canal": por_canal, 
        "por_canal_dia": por_canal_dia,
        "dias_headers": dias_headers,
        "totais_por_dia": totais_por_dia
    }

@api_router.get("/dashboard/v2/volume-canal")
async def get_dashboard_volume_canal(
    periodo_dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Aba 2 - Volume por Canal"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_match = {"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {}
    
    # Por canal (ranking)
    pipeline_canal = [
        {"$match": base_match},
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    total = sum(c['count'] for c in por_canal)
    
    ranking = [{"canal": c['_id'] or 'Não informado', "total": c['count'], 
                "percentual": round((c['count']/total)*100, 1) if total > 0 else 0} for c in por_canal if c['_id']]
    
    # Por mês e canal (empilhado)
    por_mes_canal = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_inicio.replace(month=mes_inicio.month % 12 + 1, day=1) if mes_inicio.month < 12 
                   else mes_inicio.replace(year=mes_inicio.year + 1, month=1, day=1)) - timedelta(seconds=1)
        
        pipeline = [
            {"$match": {"data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}}},
            {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}}
        ]
        result = await db.chamados.aggregate(pipeline).to_list(50)
        mes_data = {"mes": mes_ref.strftime("%b/%y")}
        for r in result:
            if r['_id']:
                mes_data[r['_id']] = r['count']
        por_mes_canal.append(mes_data)
    
    return {"ranking": ranking, "por_mes_canal": por_mes_canal, "total": total}

@api_router.get("/dashboard/v2/classificacao")
async def get_dashboard_classificacao(
    periodo_dias: int = 30,
    canal: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Aba 3 - Classificação"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_match = {}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    if canal:
        base_match["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    
    # Por categoria
    pipeline_cat = [
        {"$match": base_match},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_categoria = await db.chamados.aggregate(pipeline_cat).to_list(50)
    
    # Pendentes por categoria
    pipeline_pend_cat = [
        {"$match": {**base_match, "pendente": True}},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    pend_categoria = await db.chamados.aggregate(pipeline_pend_cat).to_list(50)
    
    # Pendentes por motivo
    pipeline_motivo = [
        {"$match": {**base_match, "pendente": True}},
        {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    pend_motivo = await db.chamados.aggregate(pipeline_motivo).to_list(50)
    
    # Top 10 produtos
    pipeline_prod = [
        {"$match": base_match},
        {"$group": {"_id": "$produto", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_produtos = await db.chamados.aggregate(pipeline_prod).to_list(10)
    
    # Por fornecedor
    pipeline_forn = [
        {"$match": base_match},
        {"$group": {"_id": "$codigo_fornecedor", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_fornecedor = await db.chamados.aggregate(pipeline_forn).to_list(50)
    
    return {
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in por_categoria],
        "pend_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in pend_categoria],
        "pend_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count']} for c in pend_motivo],
        "top_produtos": [{"produto": c['_id'] or 'N/A', "total": c['count']} for c in top_produtos],
        "por_fornecedor": [{"fornecedor": c['_id'] or 'N/A', "total": c['count']} for c in por_fornecedor]
    }

@api_router.get("/dashboard/v2/performance")
async def get_dashboard_performance(
    periodo_dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Aba 4 - Performance"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_match = {"pendente": False, "data_fechamento": {"$ne": None}}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    
    # Tempo médio por canal
    pipeline_canal = [
        {"$match": base_match},
        {"$project": {
            "canal": {"$ifNull": ["$parceiro", "$canal_vendas"]},
            "tempo": {"$subtract": [
                {"$dateFromString": {"dateString": "$data_fechamento"}},
                {"$dateFromString": {"dateString": "$data_abertura"}}
            ]}
        }},
        {"$group": {"_id": "$canal", "media": {"$avg": "$tempo"}, "count": {"$sum": 1}}},
        {"$sort": {"media": -1}}
    ]
    tempo_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    
    # Tempo médio por fornecedor
    pipeline_forn = [
        {"$match": base_match},
        {"$project": {
            "fornecedor": "$codigo_fornecedor",
            "tempo": {"$subtract": [
                {"$dateFromString": {"dateString": "$data_fechamento"}},
                {"$dateFromString": {"dateString": "$data_abertura"}}
            ]}
        }},
        {"$group": {"_id": "$fornecedor", "media": {"$avg": "$tempo"}, "count": {"$sum": 1}}},
        {"$sort": {"media": -1}}
    ]
    tempo_fornecedor = await db.chamados.aggregate(pipeline_forn).to_list(50)
    
    ms_to_days = 1000 * 60 * 60 * 24
    
    return {
        "tempo_por_canal": [{"canal": t['_id'] or 'N/A', "dias": round(t['media']/ms_to_days, 2), "atendimentos": t['count']} for t in tempo_canal if t['_id']],
        "tempo_por_fornecedor": [{"fornecedor": t['_id'] or 'N/A', "dias": round(t['media']/ms_to_days, 2), "atendimentos": t['count']} for t in tempo_fornecedor if t['_id']]
    }

@api_router.get("/dashboard/v2/pendencias")
async def get_dashboard_pendencias(
    periodo_dias: int = 30,
    canal: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Aba 5 - Pendências"""
    now = datetime.now(timezone.utc)
    
    base_match = {"pendente": True}
    if canal:
        base_match["$or"] = [{"parceiro": canal}, {"canal_vendas": canal}]
    
    total = await db.chamados.count_documents(base_match)
    
    # Por categoria
    pipeline_cat = [
        {"$match": base_match},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_categoria = await db.chamados.aggregate(pipeline_cat).to_list(50)
    
    # Por motivo
    pipeline_motivo = [
        {"$match": base_match},
        {"$group": {"_id": "$motivo_pendencia", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_motivo = await db.chamados.aggregate(pipeline_motivo).to_list(50)
    
    # Por canal
    pipeline_canal = [
        {"$match": base_match},
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    
    # Tabela detalhada
    pendentes = await db.chamados.find(base_match, {"_id": 0}).sort("data_abertura", 1).to_list(100)
    for p in pendentes:
        data_abertura = datetime.fromisoformat(p['data_abertura'].replace('Z', '+00:00'))
        p['dias_aberto'] = (now - data_abertura).days
    
    return {
        "total": total,
        "por_categoria": [{"categoria": c['_id'] or 'N/A', "total": c['count']} for c in por_categoria],
        "por_motivo": [{"motivo": c['_id'] or 'N/A', "total": c['count']} for c in por_motivo],
        "por_canal": [{"canal": c['_id'] or 'N/A', "total": c['count']} for c in por_canal if c['_id']],
        "detalhes": pendentes[:50]
    }

@api_router.get("/dashboard/v2/estornos")
async def get_dashboard_estornos(
    periodo_dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Aba 6 - Estornos"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_match = {"categoria": {"$in": ["Arrependimento", "Estorno", "Cancelamento"]}}
    if periodo_dias < 365:
        base_match["data_abertura"] = {"$gte": periodo_inicio}
    
    total_estornos = await db.chamados.count_documents(base_match)
    total_geral = await db.chamados.count_documents({"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {})
    percentual_geral = round((total_estornos/total_geral)*100, 2) if total_geral > 0 else 0
    
    # Por mês
    por_mes = []
    for i in range(5, -1, -1):
        mes_ref = now - timedelta(days=i*30)
        mes_inicio = mes_ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mes_fim = (mes_inicio.replace(month=mes_inicio.month % 12 + 1, day=1) if mes_inicio.month < 12 
                   else mes_inicio.replace(year=mes_inicio.year + 1, month=1, day=1)) - timedelta(seconds=1)
        
        estornos_mes = await db.chamados.count_documents({
            **base_match, "data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}
        })
        total_mes = await db.chamados.count_documents({
            "data_abertura": {"$gte": mes_inicio.isoformat(), "$lte": mes_fim.isoformat()}
        })
        
        por_mes.append({
            "mes": mes_ref.strftime("%b/%y"),
            "estornos": estornos_mes,
            "total": total_mes,
            "percentual": round((estornos_mes/total_mes)*100, 2) if total_mes > 0 else 0
        })
    
    # Por canal
    pipeline_canal = [
        {"$match": base_match},
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    
    # Calcular % por canal
    canal_data = []
    for c in por_canal:
        if c['_id']:
            total_canal = await db.chamados.count_documents(
                {"$or": [{"parceiro": c['_id']}, {"canal_vendas": c['_id']}], 
                 "data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else 
                {"$or": [{"parceiro": c['_id']}, {"canal_vendas": c['_id']}]}
            )
            canal_data.append({
                "canal": c['_id'],
                "estornos": c['count'],
                "percentual": round((c['count']/total_canal)*100, 2) if total_canal > 0 else 0
            })
    
    return {
        "total": total_estornos,
        "percentual_geral": percentual_geral,
        "por_mes": por_mes,
        "por_canal": sorted(canal_data, key=lambda x: x['percentual'], reverse=True)
    }

@api_router.get("/dashboard/v2/reincidencia")
async def get_dashboard_reincidencia(
    periodo_dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Aba 7 - Reincidência"""
    now = datetime.now(timezone.utc)
    periodo_inicio = (now - timedelta(days=periodo_dias)).isoformat()
    
    base_match = {"data_abertura": {"$gte": periodo_inicio}} if periodo_dias < 365 else {}
    
    # Clientes com múltiplos atendimentos
    pipeline_reincidencia = [
        {"$match": base_match},
        {"$group": {"_id": "$cpf_cliente", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    reincidentes = await db.chamados.aggregate(pipeline_reincidencia).to_list(1000)
    
    total_atendimentos = await db.chamados.count_documents(base_match)
    total_reincidentes = sum(r['count'] for r in reincidentes) - len(reincidentes)  # Excluir primeira ocorrência
    taxa_geral = round((total_reincidentes/total_atendimentos)*100, 2) if total_atendimentos > 0 else 0
    
    # Por canal
    pipeline_canal = [
        {"$match": base_match},
        {"$group": {
            "_id": {"canal": {"$ifNull": ["$parceiro", "$canal_vendas"]}, "cpf": "$cpf_cliente"},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$group": {"_id": "$_id.canal", "reincidentes": {"$sum": 1}}}
    ]
    por_canal = await db.chamados.aggregate(pipeline_canal).to_list(50)
    
    # Por produto
    pipeline_produto = [
        {"$match": base_match},
        {"$group": {
            "_id": {"produto": "$produto", "cpf": "$cpf_cliente"},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$group": {"_id": "$_id.produto", "reincidentes": {"$sum": 1}}},
        {"$sort": {"reincidentes": -1}},
        {"$limit": 10}
    ]
    por_produto = await db.chamados.aggregate(pipeline_produto).to_list(10)
    
    return {
        "taxa_geral": taxa_geral,
        "total_reincidentes": len(reincidentes),
        "por_canal": [{"canal": c['_id'] or 'N/A', "reincidentes": c['reincidentes']} for c in por_canal if c['_id']],
        "por_produto": [{"produto": p['_id'] or 'N/A', "reincidentes": p['reincidentes']} for p in por_produto if p['_id']]
    }

@api_router.get("/dashboard/v2/filtros")
async def get_dashboard_filtros(current_user: dict = Depends(get_current_user)):
    """Obter opções de filtros"""
    # Canais únicos
    pipeline_canais = [
        {"$group": {"_id": {"$ifNull": ["$parceiro", "$canal_vendas"]}}},
        {"$sort": {"_id": 1}}
    ]
    canais = await db.chamados.aggregate(pipeline_canais).to_list(100)
    
    # Fornecedores únicos
    pipeline_forn = [
        {"$group": {"_id": "$codigo_fornecedor"}},
        {"$sort": {"_id": 1}}
    ]
    fornecedores = await db.chamados.aggregate(pipeline_forn).to_list(100)
    
    return {
        "canais": [c['_id'] for c in canais if c['_id']],
        "fornecedores": [f['_id'] for f in fornecedores if f['_id']]
    }

# ============== GOOGLE SHEETS ROUTES ==============

@api_router.get("/google-sheets/status")
async def get_google_sheets_status(current_user: dict = Depends(get_current_user)):
    """Get the status of Google Sheets connection"""
    status = sheets_client.get_connection_status()
    return status

@api_router.post("/google-sheets/initialize")
async def initialize_google_sheets(current_user: dict = Depends(get_current_user)):
    """Initialize connection to Google Sheets"""
    success = sheets_client.initialize()
    if success:
        return {
            "success": True,
            "message": "Conexão com Google Sheets estabelecida com sucesso",
            "status": sheets_client.get_connection_status()
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail="Falha ao conectar com Google Sheets. Verifique se as planilhas foram compartilhadas com a conta de serviço: atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com"
        )

@api_router.post("/google-sheets/sync-all")
async def sync_all_to_google_sheets(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Sync all existing atendimentos to Google Sheets"""
    if not sheets_client.is_initialized():
        success = sheets_client.initialize()
        if not success:
            raise HTTPException(status_code=500, detail="Falha ao conectar com Google Sheets")
    
    # Get all atendimentos from MongoDB
    chamados = await db.chamados.find({}, {"_id": 0}).to_list(10000)
    
    synced = 0
    errors = 0
    
    for chamado in chamados:
        try:
            # Get pedido info if available
            pedido = await db.pedidos_erp.find_one(
                {"numero_pedido": chamado.get('numero_pedido')}, 
                {"_id": 0}
            )
            
            # Check if already exists in sheet
            existing = sheets_client.find_atendimento_by_id(chamado.get('id_atendimento', ''))
            
            if not existing:
                if sheets_client.add_atendimento(chamado, pedido):
                    synced += 1
                else:
                    errors += 1
        except Exception as e:
            errors += 1
            logger.error(f"Error syncing chamado {chamado.get('id_atendimento')}: {e}")
    
    return {
        "message": f"Sincronização concluída: {synced} atendimentos sincronizados, {errors} erros",
        "synced": synced,
        "errors": errors,
        "total": len(chamados)
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

# Initialize Google Sheets on startup
@app.on_event("startup")
async def startup_event():
    """Initialize Google Sheets client on startup"""
    try:
        success = sheets_client.initialize()
        if success:
            logger.info("Google Sheets client initialized successfully")
        else:
            logger.warning("Google Sheets client initialization failed - features will be limited")
    except Exception as e:
        logger.error(f"Error initializing Google Sheets client: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
