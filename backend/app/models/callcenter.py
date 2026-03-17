import uuid as _uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Boolean, Integer, ForeignKey,
    DateTime, Numeric, Text, BigInteger, Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TemplateCallCenter(TimestampMixin, Base):
    """Evaluation template — defines which fields to extract from a call transcript."""
    __tablename__ = "templates_callcenter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # None = global template available to all clients
    cliente_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    # List of field definitions: [{nome, tipo, descricao, obrigatorio}]
    campos: Mapped[list] = mapped_column(JSONB, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    chamadas: Mapped[List["ChamadaCallCenter"]] = relationship(
        back_populates="template", lazy="selectin"
    )


class ChamadaCallCenter(TimestampMixin, Base):
    """A single call-center recording submission and its processing results."""
    __tablename__ = "chamadas_callcenter"
    __table_args__ = (
        Index("ix_chamadas_cliente", "cliente_id"),
        Index("ix_chamadas_estudo", "estudo_id"),
        Index("ix_chamadas_estado", "estado"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    # Optional: link to a mystery-shopping study
    estudo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("estudos.id"), nullable=True)
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("templates_callcenter.id"), nullable=True
    )

    # ── Audio file ───────────────────────────────────────────────────────────
    nome_ficheiro: Mapped[str] = mapped_column(String(300), nullable=False)
    url_minio: Mapped[str] = mapped_column(String(500), nullable=False)
    tamanho: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    duracao_segundos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Pipeline state ───────────────────────────────────────────────────────
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pendente"
    )  # pendente | transcrevendo | a_analisar | concluido | erro
    erro_mensagem: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Results ──────────────────────────────────────────────────────────────
    transcricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dados_extraidos: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    relatorio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score_global: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

    # ── Call metadata (can be filled manually) ───────────────────────────────
    referencia_externa: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    agente_nome: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    data_chamada: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    submetido_por_id: Mapped[Optional[_uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilizadores.id"), nullable=True
    )

    template: Mapped[Optional["TemplateCallCenter"]] = relationship(
        back_populates="chamadas", lazy="selectin"
    )


class ConfiguracaoCallCenter(Base):
    """Singleton config row (id=1). Controls who can upload and max file size."""
    __tablename__ = "configuracoes_callcenter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    roles_upload: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: ["admin", "coordenador", "validador"],
    )
    max_ficheiro_mb: Mapped[int] = mapped_column(Integer, default=100)
