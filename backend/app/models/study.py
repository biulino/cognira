from typing import Optional, List

from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Estudo(TimestampMixin, Base):
    __tablename__ = "estudos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="activo")
    tipo_caracterizacao: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="estudos")
    ondas: Mapped[List["Onda"]] = relationship(back_populates="estudo", lazy="selectin")
    filtros: Mapped[List["FiltroEstudo"]] = relationship(back_populates="estudo", lazy="selectin")


class Onda(Base):
    __tablename__ = "ondas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)  # VARCHAR — suporta "(próxima)"

    estudo: Mapped["Estudo"] = relationship(back_populates="ondas")


class FiltroEstudo(Base):
    __tablename__ = "filtros_estudo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    campo: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    label_lvi: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    label_lvd: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    estudo: Mapped["Estudo"] = relationship(back_populates="filtros")


from app.models.client import Cliente  # noqa: E402, F401
