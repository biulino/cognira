import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, Numeric, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ThresholdAcao(Base):
    __tablename__ = "thresholds_acao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    threshold_pontuacao: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    tipo_acao: Mapped[str] = mapped_column(String(20), default="automatico")  # ad_hoc/automatico
    activo: Mapped[bool] = mapped_column(default=True)


class PlanoAcao(TimestampMixin, Base):
    __tablename__ = "planos_acao"
    __table_args__ = (
        Index("ix_planos_acao_visita", "visita_id"),
        Index("ix_planos_acao_atribuido_estado", "atribuido_a", "estado"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # appeal/ad_hoc/automatico
    estado: Mapped[str] = mapped_column(String(20), default="aberto")  # aberto/em_progresso/concluido/rejeitado
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    atribuido_a: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)
    prazo: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolucao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)
    resolvido_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    visita: Mapped["Visita"] = relationship(back_populates="planos_acao")


from app.models.visit import Visita  # noqa: E402, F401
