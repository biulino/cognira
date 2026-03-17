from typing import Optional

from sqlalchemy import String, Boolean, Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Estabelecimento(Base):
    __tablename__ = "estabelecimentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    id_loja_externo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    tipo_canal: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # LVI / LVD
    regiao: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    responsavel: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    morada: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="estabelecimentos")


from app.models.client import Cliente  # noqa: E402, F401
