"""015 — Fase 7: API keys, webhooks, tenant improvements

Revision ID: 015fase7
Revises: 013ragembeddings
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

revision = "015fase7"
down_revision = "014submetidoem"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── API Keys (per client) ──
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("scopes", JSONB, server_default='["read"]'),
        sa.Column("rate_limit_rpm", sa.Integer(), server_default="60"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("ultimo_uso", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])
    op.create_index("ix_api_keys_cliente_id", "api_keys", ["cliente_id"])

    # ── Webhook subscriptions ──
    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("eventos", JSONB, nullable=False),  # ["visita.criada", "estado.mudou", ...]
        sa.Column("secret", sa.String(255), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("falhas_consecutivas", sa.Integer(), server_default="0"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_webhook_subscriptions_cliente_id", "webhook_subscriptions", ["cliente_id"])

    # ── Webhook delivery log ──
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("subscription_id", UUID(as_uuid=True), sa.ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evento", sa.String(100), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("resposta", sa.Text(), nullable=True),
        sa.Column("erro", sa.Text(), nullable=True),
        sa.Column("tentativa", sa.Integer(), server_default="1"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── PortalCliente enhancements ──
    op.add_column("portais_cliente", sa.Column("favicon_url", sa.String(500), nullable=True))
    op.add_column("portais_cliente", sa.Column("dominio_custom", sa.String(255), nullable=True))
    op.add_column("portais_cliente", sa.Column("css_custom", sa.Text(), nullable=True))

    # ── Multi-tenant: user ↔ client link ──
    op.add_column("utilizadores", sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_utilizadores_cliente_id", "utilizadores", ["cliente_id"])


def downgrade() -> None:
    op.drop_index("ix_utilizadores_cliente_id", table_name="utilizadores")
    op.drop_column("utilizadores", "cliente_id")
    op.drop_column("portais_cliente", "css_custom")
    op.drop_column("portais_cliente", "dominio_custom")
    op.drop_column("portais_cliente", "favicon_url")
    op.drop_table("webhook_deliveries")
    op.drop_table("webhook_subscriptions")
    op.drop_table("api_keys")
