import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, String, Integer, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class MensagemVisita(TimestampMixin, Base):
    __tablename__ = "mensagens_visita"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    remetente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id"), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    lida_por: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # array of user_ids

    visita: Mapped["Visita"] = relationship(back_populates="mensagens")


from app.models.visit import Visita  # noqa: E402, F401


class MensagemSistema(Base):
    """Direct messages between platform users (replaces SMS/phone)."""

    __tablename__ = "mensagens_sistema"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    remetente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False
    )
    destinatario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False
    )
    assunto: Mapped[str] = mapped_column(String(200), nullable=False)
    corpo: Mapped[str] = mapped_column(Text, nullable=False)
    lida: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    criada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
