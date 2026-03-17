import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, Numeric, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TabelaValores(Base):
    __tablename__ = "tabela_valores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    tipo_visita: Mapped[str] = mapped_column(String(20), nullable=False)  # normal/extra
    valor_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valor_despesas_max: Mapped[float] = mapped_column(Numeric(10, 2), default=0)


class PagamentoVisita(Base):
    __tablename__ = "pagamentos_visita"
    __table_args__ = (
        Index("ix_pagamentos_analista_estado", "analista_id", "estado"),
        Index("ix_pagamentos_visita", "visita_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    valor_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valor_despesas: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    valor_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="pendente")  # pendente/aprovado/pago/rejeitado
    aprovado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)
    pago_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    referencia_externa: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)


class ExportacaoFinanceira(TimestampMixin, Base):
    __tablename__ = "exportacoes_financeiras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    periodo_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    periodo_fim: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ficheiro_url_minio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    criado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)


class OrcamentoEstudo(Base):
    __tablename__ = "orcamento_estudo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), unique=True, nullable=False)
    valor_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    valor_comprometido: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    valor_pago: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    moeda: Mapped[str] = mapped_column(String(3), default="EUR")
    notas: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    actualizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
