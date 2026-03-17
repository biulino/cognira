import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import String, Boolean, Integer, ForeignKey, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Formacao(TimestampMixin, Base):
    __tablename__ = "formacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    titulo: Mapped[str] = mapped_column(String(300), nullable=False)
    conteudo_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    documento_url_minio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    obrigatoria: Mapped[bool] = mapped_column(Boolean, default=True)


class TesteFormacao(Base):
    __tablename__ = "testes_formacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formacao_id: Mapped[int] = mapped_column(ForeignKey("formacoes.id"), nullable=False)
    pergunta: Mapped[str] = mapped_column(Text, nullable=False)
    opcoes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    resposta_correta_idx: Mapped[int] = mapped_column(Integer, nullable=False)
    pontuacao: Mapped[int] = mapped_column(Integer, default=1)


class ResultadoFormacao(Base):
    __tablename__ = "resultados_formacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    formacao_id: Mapped[int] = mapped_column(ForeignKey("formacoes.id"), nullable=False)
    pontuacao_obtida: Mapped[int] = mapped_column(Integer, nullable=False)
    aprovado: Mapped[bool] = mapped_column(Boolean, default=False)
    tentativa: Mapped[int] = mapped_column(Integer, default=1)
    realizado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CertificacaoAnalista(Base):
    __tablename__ = "certificacoes_analista"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    certificado_em: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valido_ate: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="activo")  # activo/expirado/revogado
