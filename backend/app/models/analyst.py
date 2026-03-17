import uuid
from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, Integer, ForeignKey, Date, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Analista(Base):
    __tablename__ = "analistas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    nome: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # pgcrypto
    codigo_externo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, unique=True)
    email: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # pgcrypto
    telefone: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    nif: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    iban: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    morada: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    data_nascimento: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)  # pgcrypto
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    data_recrutamento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    chilling_periods: Mapped[List["ChillingPeriod"]] = relationship(back_populates="analista", lazy="selectin")
    blacklists: Mapped[List["BlacklistEstabelecimento"]] = relationship(back_populates="analista", lazy="selectin")


class CandidaturaRecrutamento(TimestampMixin, Base):
    __tablename__ = "candidaturas_recrutamento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=False)
    email: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=False)
    telefone: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    morada: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    disponibilidade: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    veiculo: Mapped[bool] = mapped_column(Boolean, default=False)
    smartphone: Mapped[bool] = mapped_column(Boolean, default=True)
    cv_url_minio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="nova")  # nova/em_analise/aprovada/rejeitada
    notas: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)


class ChillingPeriod(Base):
    __tablename__ = "chilling_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimentos.id"), nullable=False)
    meses: Mapped[int] = mapped_column(Integer, nullable=False)
    inicio_em: Mapped[date] = mapped_column(Date, nullable=False)
    fim_em: Mapped[date] = mapped_column(Date, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    analista: Mapped["Analista"] = relationship(back_populates="chilling_periods")


class BlacklistEstabelecimento(TimestampMixin, Base):
    __tablename__ = "blacklist_estabelecimento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimentos.id"), nullable=False)
    motivo: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    permanente: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("utilizadores.id"), nullable=True)

    analista: Mapped["Analista"] = relationship(back_populates="blacklists")
