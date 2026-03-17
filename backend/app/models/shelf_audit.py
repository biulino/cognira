from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, ForeignKey, Integer, Numeric, String, Text, Date, DateTime, func,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ShelfAuditItem(Base):
    """Individual product line-item in a shelf/retail audit for a visit."""
    __tablename__ = "shelf_audit_items"
    __table_args__ = (
        Index("ix_shelf_audit_visita", "visita_id"),
        Index("ix_shelf_audit_ean", "ean"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id", ondelete="CASCADE"), nullable=False)

    produto_nome: Mapped[str] = mapped_column(String(300), nullable=False)
    ean: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # EAN-13 / UPC-A / Code128

    # Price fields
    preco_esperado: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    preco_real: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)

    # Shelf presence
    quantidade_esperada: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quantidade_real: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    facings: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # number of visible facings

    # Date checks
    validade: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Compliance
    conforme: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
