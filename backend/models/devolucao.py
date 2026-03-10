from pydantic import BaseModel
from typing import Optional


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
    atendimento: Optional[str] = 'Aguardando'
    devolvido_por: Optional[str] = None
    status_galpao: Optional[str] = 'AGUARDANDO'
