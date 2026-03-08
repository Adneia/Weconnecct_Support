from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

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
    codigo_fornecedor: Optional[str] = None
    pedido_troca: Optional[str] = None
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ultima_atualizacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReversaBase(BaseModel):
    chamado_id: str
    codigo_rastreio: Optional[str] = None
    status_reversa: str = "Aguardando Postagem"
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
    data_atualizacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
