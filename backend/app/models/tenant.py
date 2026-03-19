"""Tenant and plan models for multitenant SaaS."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric,
    String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PlanoTenant(Base):
    __tablename__ = "planos_tenant"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    preco_mensal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    max_utilizadores: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_clientes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_visitas_mes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    trial_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    features: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tenants: Mapped[List["Tenant"]] = relationship(back_populates="plano", lazy="noload")


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    nome_marca: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # trial | active | suspended | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="trial")
    plano_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("planos_tenant.id", ondelete="SET NULL"), nullable=True
    )
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Owner / contact
    owner_nome: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_email: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_telefone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pais: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Branding
    cor_primaria: Mapped[str] = mapped_column(String(7), nullable=False, default="#1E40AF")
    cor_secundaria: Mapped[str] = mapped_column(String(7), nullable=False, default="#3B82F6")
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dominio_custom: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    css_custom: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Stripe billing
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, unique=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    stripe_subscription_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    plano: Mapped[Optional[PlanoTenant]] = relationship(back_populates="tenants", lazy="selectin")
    utilizadores: Mapped[List["Utilizador"]] = relationship(back_populates="tenant", lazy="noload")  # noqa: F821
