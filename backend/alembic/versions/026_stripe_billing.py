"""026 — Stripe billing fields on tenants and plans.

Revision ID: 026_stripe_billing
Revises: 025_token_blacklist
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "026_stripe_billing"
down_revision = "025_token_blacklist"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tenants: Stripe integration fields ───────────────────────────────────
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(100), nullable=True))
    op.add_column("tenants", sa.Column("stripe_subscription_id", sa.String(100), nullable=True))
    op.add_column("tenants", sa.Column("stripe_subscription_status", sa.String(50), nullable=True))

    op.create_index("ix_tenants_stripe_customer_id",  "tenants", ["stripe_customer_id"], unique=True)
    op.create_index("ix_tenants_stripe_subscription_id", "tenants", ["stripe_subscription_id"], unique=False)

    # ── planos_tenant: map to a Stripe Price ID ───────────────────────────────
    op.add_column("planos_tenant", sa.Column("stripe_price_id", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_tenants_stripe_customer_id", table_name="tenants")
    op.drop_index("ix_tenants_stripe_subscription_id", table_name="tenants")
    op.drop_column("tenants", "stripe_customer_id")
    op.drop_column("tenants", "stripe_subscription_id")
    op.drop_column("tenants", "stripe_subscription_status")
    op.drop_column("planos_tenant", "stripe_price_id")
