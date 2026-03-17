import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, func, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Utilizador(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "utilizadores"

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # pgcrypto
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    totp_secret: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    totp_activo: Mapped[bool] = mapped_column(Boolean, default=False)
    backup_codes: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto JSONB
    role_global: Mapped[str] = mapped_column(String(20), nullable=False, default="utilizador")  # admin / utilizador
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    sso_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)  # OIDC sub claim
    cliente_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)

    # relationships
    permissoes: Mapped[List["PermissaoEstudo"]] = relationship(back_populates="utilizador", lazy="selectin")
    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="utilizadores", lazy="selectin")  # noqa: F821


class PermissaoEstudo(Base):
    __tablename__ = "permissoes_estudo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    utilizador_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id"), nullable=False)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # coordenador/analista/validador/cliente

    utilizador: Mapped["Utilizador"] = relationship(back_populates="permissoes")
