from typing import Optional, List

from sqlalchemy import String, Integer, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Grelha(Base):
    __tablename__ = "grelhas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudo_id: Mapped[int] = mapped_column(ForeignKey("estudos.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    versao: Mapped[int] = mapped_column(Integer, default=1)
    # tipo_visita this grid is designed for (presencial/drive_through/telefonica/auditoria/digital/normal)
    tipo_visita: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    secoes: Mapped[List["SecaoGrelha"]] = relationship(
        back_populates="grelha", cascade="all, delete-orphan", lazy="selectin",
        order_by="SecaoGrelha.ordem",
    )


class SecaoGrelha(Base):
    """Section within an evaluation grid — groups criteria into thematic blocks."""
    __tablename__ = "secoes_grelha"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grelha_id: Mapped[int] = mapped_column(ForeignKey("grelhas.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    peso_secao: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

    grelha: Mapped["Grelha"] = relationship(back_populates="secoes")
    criterios: Mapped[List["CriterioGrelha"]] = relationship(
        back_populates="secao", cascade="all, delete-orphan", lazy="selectin",
    )


class CriterioGrelha(Base):
    __tablename__ = "criterios_grelha"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grelha_id: Mapped[int] = mapped_column(ForeignKey("grelhas.id"), nullable=False)
    secao_id: Mapped[Optional[int]] = mapped_column(ForeignKey("secoes_grelha.id"), nullable=True)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    peso: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    tipo: Mapped[str] = mapped_column(String(20), default="boolean")  # boolean/escala/texto
    ordem: Mapped[int] = mapped_column(Integer, default=0)

    secao: Mapped[Optional["SecaoGrelha"]] = relationship(back_populates="criterios")


class RespostaVisita(Base):
    __tablename__ = "respostas_visita"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    criterio_id: Mapped[int] = mapped_column(ForeignKey("criterios_grelha.id"), nullable=False)
    valor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    visita: Mapped["Visita"] = relationship(back_populates="respostas")


from app.models.visit import Visita  # noqa: E402, F401
