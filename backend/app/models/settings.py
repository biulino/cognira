from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ConfiguracaoSistema(Base):
    __tablename__ = "configuracoes_sistema"

    chave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str] = mapped_column(Text, nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
