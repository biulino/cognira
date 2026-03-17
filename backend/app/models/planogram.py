import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    ForeignKey, Integer, Numeric, String, Text, DateTime, func, Index, JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Planogram(Base):
    """Reference planogram image for a study — the 'ideal shelf layout'."""
    __tablename__ = "planogramas"
    __table_args__ = (
        Index("ix_planogramas_estudo", "estudo_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id", ondelete="CASCADE"), nullable=False)
    criado_por: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("utilizadores.id", ondelete="SET NULL"), nullable=True)

    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # loja / callcenter / etc.
    imagem_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)  # MinIO presigned or path
    imagem_minio_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    comparacoes: Mapped[list["PlanogramComparacao"]] = relationship(back_populates="planogram", lazy="select")


class PlanogramComparacao(Base):
    """AI comparison result between a reference planogram and a visit photo."""
    __tablename__ = "planogram_comparacoes"
    __table_args__ = (
        Index("ix_planogram_comp_visita", "visita_id"),
        Index("ix_planogram_comp_planogram", "planogram_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    planogram_id: Mapped[int] = mapped_column(ForeignKey("planogramas.id", ondelete="CASCADE"), nullable=False)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id", ondelete="CASCADE"), nullable=False)
    foto_id: Mapped[Optional[int]] = mapped_column(ForeignKey("fotos_visita.id", ondelete="SET NULL"), nullable=True)

    score_compliance: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)  # 0-100
    ia_analise: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ia_items_corretos: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ia_items_errados: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ia_items_faltando: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ia_recomendacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    analisado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    planogram: Mapped["Planogram"] = relationship(back_populates="comparacoes")
