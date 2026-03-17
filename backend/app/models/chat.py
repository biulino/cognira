"""
Models for the internal real-time chat system.

Conversa      — a conversation (tipo: 'direto' | 'grupo')
ConversaMembro — who is in the conversation + last-read timestamp
ChatMensagem  — a message posted in a conversation
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Conversa(Base):
    __tablename__ = "conversas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)   # null for 1:1
    tipo: Mapped[str] = mapped_column(String(10), nullable=False, default="direto")  # direto | grupo
    criado_por: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilizadores.id", ondelete="CASCADE"),
        nullable=False,
    )
    criada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ConversaMembro(Base):
    __tablename__ = "conversa_membros"
    __table_args__ = (UniqueConstraint("conversa_id", "utilizador_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversas.id", ondelete="CASCADE"), nullable=False
    )
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilizadores.id", ondelete="CASCADE"),
        nullable=False,
    )
    ultimo_lido_em: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    adicionado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ChatMensagem(Base):
    __tablename__ = "chat_mensagens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversas.id", ondelete="CASCADE"), nullable=False
    )
    remetente_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilizadores.id", ondelete="CASCADE"),
        nullable=False,
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
