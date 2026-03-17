import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, Integer, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Questionario(TimestampMixin, Base):
    __tablename__ = "questionarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    versao: Mapped[int] = mapped_column(Integer, default=1)
    json_estrutura: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    translations_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    criado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)


class SubmissaoQuestionario(Base):
    __tablename__ = "submissoes_questionario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    questionario_id: Mapped[int] = mapped_column(ForeignKey("questionarios.id"), nullable=False)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    json_respostas: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    submetido_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
