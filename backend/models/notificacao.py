from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class NotificacaoBase(BaseModel):
    tipo: str
    titulo: str
    mensagem: str
    destinatario_email: str
    dados_extras: Optional[dict] = None


class Notificacao(NotificacaoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_criacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lida: bool = False
    criado_por_nome: Optional[str] = None
