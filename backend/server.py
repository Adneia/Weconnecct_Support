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
    solicitacao: Optional[str] = None
    parceiro: Optional[str] = None
    categoria: Optional[str] = None
    motivo: Optional[str] = None
    anotacoes: Optional[str] = None
    pendente: Optional[bool] = None
    status_cliente: Optional[str] = None
    reversa_codigo: Optional[str] = None
    atendente: Optional[str] = None

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

Atenciosamente,
[ASSINATURA]""",
    
    "Produto com Avaria": """Selecione o tipo de avaria no campo abaixo.""",
    
    "Avaria - Necessário Evidência": """Olá,

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Transporte até R$250": """Olá

Informamos que iniciamos a preparação e o envio de um novo produto para o cliente.

Em caráter de exceção, não será necessário realizar a devolução do item avariado. Pedimos, por gentileza, que oriente o cliente quanto ao descarte adequado do produto.

Assim que possível, compartilharemos o link de rastreamento.

Permanecemos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Reversa": """Olá, boa tarde

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
    
    "Dúvida": """Prezado(a) cliente,

Agradecemos seu contato.

Estamos verificando sua dúvida e retornaremos em breve com mais informações.

Atenciosamente,
[ASSINATURA]""",
    
    "Reclamação": """Prezado(a) Sr(a) [NOME]

Primeiramente, lamentamos muito pelo ocorrido.

Informamos que o atendimento para compras realizadas em nossa loja é conduzido diretamente pelos nossos parceiros. Neste caso, o procedimento correto é acionar o canal de venda, por meio do qual a compra foi efetuada, para apoio na tratativa da ocorrência.

No entanto, para agilizar a resolução do caso, entraremos em contato contigo diretamente via WhatsApp, oferecendo o suporte necessário, além de acionarmos o parceiro responsável para dar continuidade às tratativas.

Continuamos à disposição para qualquer dúvida ou necessidade.
Atenciosamente,
Equipe de Atendimento Weconnect""",
    
    "Assistência Técnica": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC):
[DADOS_FABRICANTE]

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
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
    search: Optional[str] = None,
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
    if search:
        # Buscar por número do pedido, CPF ou nome
        query['$or'] = [
            {"numero_pedido": {"$regex": search, "$options": "i"}},
            {"cpf_cliente": {"$regex": search, "$options": "i"}},
            {"nome_cliente": {"$regex": search, "$options": "i"}},
            {"id_atendimento": {"$regex": search, "$options": "i"}}
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

@api_router.get("/pedidos-erp/buscar/cpf/{cpf}", response_model=List[dict])
async def get_pedidos_by_cpf(cpf: str, current_user: dict = Depends(get_current_user)):
    """Buscar pedidos por CPF - retorna todos os pedidos do cliente"""
    # Limpar CPF (remover pontos e traços)
    cpf_limpo = cpf.replace('.', '').replace('-', '').replace(' ', '')
    
    pedidos = await db.pedidos_erp.find(
        {"cpf_cliente": {"$regex": cpf_limpo}}, 
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
    """Buscar pedidos por número de pedido externo (pedido_cliente ou pedido_externo)"""
    pedidos = await db.pedidos_erp.find(
        {"$or": [
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
            'serie_nf': ['série', 'serie'],  # Série da NF (1=SC, 6=SP, 2=ES)
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
    # Total atendimentos pendentes vs resolvidos
    total_pendentes = await db.chamados.count_documents({"pendente": True})
    total_resolvidos = await db.chamados.count_documents({"pendente": False})
    
    # Atendimentos por categoria
    pipeline_categoria = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}
    ]
    por_categoria = await db.chamados.aggregate(pipeline_categoria).to_list(100)
    
    # Atendimentos por atendente
    pipeline_atendente = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$atendente", "count": {"$sum": 1}}}
    ]
    por_atendente = await db.chamados.aggregate(pipeline_atendente).to_list(100)
    
    # Atendimentos por parceiro/canal
    pipeline_parceiro = [
        {"$match": {"pendente": True}},
        {"$group": {"_id": "$parceiro", "count": {"$sum": 1}}}
    ]
    por_parceiro = await db.chamados.aggregate(pipeline_parceiro).to_list(100)
    
    # Atendimentos que precisam de atenção (pendentes há mais de 3 dias)
    now = datetime.now(timezone.utc)
    tres_dias_atras = (now - timedelta(days=3)).isoformat()
    
    chamados_atencao = await db.chamados.find({
        "pendente": True,
        "data_abertura": {"$lt": tres_dias_atras}
    }, {"_id": 0}).sort("data_abertura", 1).to_list(10)
    
    # Calculate days open
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
            "data_fechamento": {"$gte": dia_inicio, "$lte": dia_fim}
        })
        
        ultimos_7_dias.append({
            "data": dia.strftime("%d/%m"),
            "abertos": abertos_dia,
            "resolvidos": resolvidos_dia
        })
    
    # Média de tempo de resolução
    pipeline_tempo = [
        {"$match": {"data_fechamento": {"$ne": None}}},
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
    media_tempo_dias = round(media_tempo_ms / (1000 * 60 * 60 * 24), 1) if media_tempo_ms else 0
    
    # Total de pedidos na base
    total_pedidos = await db.pedidos_erp.count_documents({})
    
    return {
        "total_pendentes": total_pendentes,
        "total_resolvidos": total_resolvidos,
        "total_pedidos_base": total_pedidos,
        "por_categoria": {item['_id']: item['count'] for item in por_categoria if item['_id']},
        "por_atendente": {item['_id']: item['count'] for item in por_atendente if item['_id']},
        "por_parceiro": {item['_id']: item['count'] for item in por_parceiro if item['_id']},
        "chamados_atencao": chamados_atencao,
        "ultimos_7_dias": ultimos_7_dias,
        "media_tempo_resolucao_dias": media_tempo_dias
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
