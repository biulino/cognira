import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean, Text, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class NotificacaoVisita(Base):
    __tablename__ = "notificacoes_visita"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # email/push
    destinatario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id"), nullable=False)
    enviada_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="pendente")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    utilizador_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)
    entidade: Mapped[str] = mapped_column(String(100), nullable=False)
    entidade_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    acao: Mapped[str] = mapped_column(String(50), nullable=False)
    dados_anteriores: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    dados_novos: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class ConsentimentoRgpd(Base):
    __tablename__ = "consentimentos_rgpd"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    utilizador_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    aceite: Mapped[bool] = mapped_column(Boolean, default=False)
    data: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    versao_politica: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)


class RetencaoDados(Base):
    __tablename__ = "retencao_dados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    anos_retencao: Mapped[int] = mapped_column(Integer, default=5)
    data_eliminacao_programada: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
