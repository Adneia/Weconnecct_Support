from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class HistoricoBase(BaseModel):
    chamado_id: str
    tipo_acao: str
    descricao: str


class HistoricoCreate(HistoricoBase):
    pass


class Historico(HistoricoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_hora: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usuario_id: Optional[str] = None
    usuario_nome: Optional[str] = None
