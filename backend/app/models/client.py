import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    sla_visita_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=3)
    sla_validacao_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=2)

    estudos: Mapped[List["Estudo"]] = relationship(back_populates="cliente", lazy="selectin")
    estabelecimentos: Mapped[List["Estabelecimento"]] = relationship(back_populates="cliente", lazy="selectin")
    portal: Mapped[Optional["PortalCliente"]] = relationship(back_populates="cliente", uselist=False, lazy="selectin")


class PortalCliente(TimestampMixin, Base):
    __tablename__ = "portais_cliente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), unique=True, nullable=False)
    subdominio: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url_minio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cor_primaria: Mapped[str] = mapped_column(String(7), default="#1E40AF")
    cor_secundaria: Mapped[str] = mapped_column(String(7), default="#3B82F6")
    nome_marca: Mapped[str] = mapped_column(String(200), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dominio_custom: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    css_custom: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="portal")


# Avoid circular imports — these are imported by relationship strings
from app.models.study import Estudo  # noqa: E402, F401
from app.models.establishment import Estabelecimento  # noqa: E402, F401
