from typing import Optional
from datetime import datetime

from sqlalchemy import String, Boolean, Integer, ForeignKey, Numeric, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TipoVisitaConfig(Base):
    __tablename__ = "tipos_visita_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo_visita: Mapped[str] = mapped_column(String(20), nullable=False)  # normal/extra
    tipo_canal: Mapped[str] = mapped_column(String(10), nullable=False)  # LVI/LVD
    fotos_obrigatorias: Mapped[int] = mapped_column(Integer, default=0)  # Y in X/Y


class FotoVisita(Base):
    __tablename__ = "fotos_visita"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visita_id: Mapped[int] = mapped_column(ForeignKey("visitas.id"), nullable=False)
    url_minio: Mapped[str] = mapped_column(String(500), nullable=False)
    nome_ficheiro: Mapped[str] = mapped_column(String(300), nullable=False)
    tamanho: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude_exif: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude_exif: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    timestamp_exif: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    validada_gps: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    validada: Mapped[bool] = mapped_column(Boolean, default=False)
    # Cognira Module 3 — AI photo validation
    ia_veredicto: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)   # aprovada/rejeitada/inconclusiva
    ia_resultado: Mapped[Optional[str]] = mapped_column(Text, nullable=True)          # JSON with full analysis
    ia_critica_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    visita: Mapped["Visita"] = relationship(back_populates="fotos")


from app.models.visit import Visita  # noqa: E402, F401
