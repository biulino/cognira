"""Per-client module flags: which funcionalidades/suites a client has enabled."""
from __future__ import annotations

from typing import Final

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


# ── Catalog ────────────────────────────────────────────────────────────────────
# Each "suite" groups related modules. Admins can toggle a whole suite at once
# (via the UI) or toggle individual modules within it.

CATALOGO_SUITES: Final[list[dict]] = [
    {
        "id": "mystery_shopping",
        "label": "Mystery Shopping",
        "descricao": "Estudos, visitas presenciais, analistas e validação",
        "cor": "blue",
        "modulos": [
            {"key": "estudos",    "label": "Estudos"},
            {"key": "visitas",    "label": "Visitas"},
            {"key": "analistas",  "label": "Analistas"},
            {"key": "multi_grid", "label": "Multi-Grid de Avaliação"},
            {"key": "mapa",       "label": "Mapa de Estabelecimentos"},
            {"key": "relatorios", "label": "Relatórios"},
        ],
    },
    {
        "id": "callcenter",
        "label": "Call Center",
        "descricao": "Upload de chamadas, transcrição IA e avaliação",
        "cor": "orange",
        "modulos": [
            {"key": "callcenter", "label": "Call Center"},
        ],
    },
    {
        "id": "shelf_audit",
        "label": "Shelf Audit",
        "descricao": "Auditoria de lineares, scan EAN/QR e conformidade",
        "cor": "emerald",
        "modulos": [
            {"key": "shelf_audit", "label": "Shelf Audit"},
            {"key": "barcode",     "label": "Leitor QR/EAN"},
        ],
    },
    {
        "id": "surveys",
        "label": "Sondagens & Questionários",
        "descricao": "Portal de questionários e survey público",
        "cor": "violet",
        "modulos": [
            {"key": "questionarios",  "label": "Questionários"},
            {"key": "survey_portal",  "label": "Survey Portal"},
        ],
    },
    {
        "id": "inteligencia",
        "label": "Cognira Intelligence™",
        "descricao": "Chat IA, alertas, SLA, benchmarking e deteção de fraude",
        "cor": "rose",
        "modulos": [
            {"key": "chat_ia",      "label": "Chat IA"},
            {"key": "alertas",      "label": "Alertas de Score"},
            {"key": "sla",          "label": "SLA Monitor"},
            {"key": "benchmarking", "label": "Benchmarking"},
            {"key": "fraude",       "label": "Deteção de Fraude"},
            {"key": "rag",          "label": "Base de Conhecimento (RAG)"},
        ],
    },
    {
        "id": "formacoes",
        "label": "Formações",
        "descricao": "Módulo de formação e certificação de analistas",
        "cor": "amber",
        "modulos": [
            {"key": "formacoes", "label": "Formações & Certificações"},
        ],
    },
    {
        "id": "pagamentos",
        "label": "Pagamentos",
        "descricao": "Gestão de pagamentos, tabelas de valores e exportações",
        "cor": "teal",
        "modulos": [
            {"key": "pagamentos", "label": "Pagamentos"},
        ],
    },
    {
        "id": "comunicacao",
        "label": "Comunicação",
        "descricao": "Mensagens internas, chat entre utilizadores e notificações push",
        "cor": "sky",
        "modulos": [
            {"key": "mensagens",    "label": "Mensagens de Visita"},
            {"key": "chat_interno", "label": "Chat Interno"},
            {"key": "push",         "label": "Notificações Push"},
        ],
    },
]

CATALOGO_PLANOS = CATALOGO_SUITES  # backwards-compat alias

# Flat set of all valid module keys (for validation)
ALL_MODULE_KEYS: Final[frozenset[str]] = frozenset(
    m["key"]
    for plano in CATALOGO_SUITES
    for m in plano["modulos"]
)


# ── Model ──────────────────────────────────────────────────────────────────────

class ClienteModulo(Base):
    """One row per (client, module) pair.  Missing rows → module enabled by default."""

    __tablename__ = "clientes_modulos"
    __table_args__ = (
        UniqueConstraint("cliente_id", "modulo", name="uq_cliente_modulo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("clientes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    modulo: Mapped[str] = mapped_column(String(60), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
