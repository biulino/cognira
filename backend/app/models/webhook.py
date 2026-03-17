import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, Integer, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    scopes: Mapped[dict] = mapped_column(JSONB, server_default='["read"]')
    rate_limit_rpm: Mapped[int] = mapped_column(Integer, server_default="60")
    activo: Mapped[bool] = mapped_column(Boolean, server_default="true")
    ultimo_uso: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    eventos: Mapped[list] = mapped_column(JSONB, nullable=False)
    secret: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, server_default="true")
    falhas_consecutivas: Mapped[int] = mapped_column(Integer, server_default="0")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deliveries: Mapped[List["WebhookDelivery"]] = relationship(back_populates="subscription", lazy="noload")


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"), nullable=False)
    evento: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resposta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    erro: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tentativa: Mapped[int] = mapped_column(Integer, server_default="1")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subscription: Mapped["WebhookSubscription"] = relationship(back_populates="deliveries")
