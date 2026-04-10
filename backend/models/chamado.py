from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

# Categorias de atendimento
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
    categoria_inicial: Optional[str] = None  # Categoria original (não altera)
    motivo: Optional[str] = None  # Motivo específico
    anotacoes: Optional[str] = None  # Histórico completo
    pendente: bool = True  # SIM/NÃO
    status_cliente: Optional[str] = None  # Status final ao encerrar
    reversa_codigo: Optional[str] = None  # Código de reversa
    atendente: str = "Letícia Martelo"  # Responsável
    motivo_pendencia: Optional[str] = None  # Motivo da pendência
    codigo_reversa: Optional[str] = None  # Código da reversa
    data_vencimento_reversa: Optional[str] = None  # Data de vencimento da reversa
    reversa_postada: bool = False  # Item já postado pelo cliente
    data_postagem_reversa: Optional[str] = None  # Data em que o cliente postou
    retornar_chamado: bool = False  # Sinaliza que precisa retorno/atuação
    verificar_adneia: bool = False  # Sinaliza que Adnéia precisa verificar
    status_devolucao: Optional[str] = None  # Aguardando, Estornado, Reenviado

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
    reversa_postada: Optional[bool] = None
    data_postagem_reversa: Optional[str] = None
    retornar_chamado: Optional[bool] = None
    verificar_adneia: Optional[bool] = None
    status_devolucao: Optional[str] = None

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
