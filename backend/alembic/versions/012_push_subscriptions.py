"""Add push_subscriptions table for Web Push notifications

Revision ID: f6a7b8c9d3e4
Revises: e5f6a7b8c9d2
Create Date: 2026-03-10
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d3e4"
down_revision: Union[str, None] = "e5f6a7b8c9d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("utilizador_id", sa.Uuid(), sa.ForeignKey("utilizadores.id"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(200), nullable=False),
        sa.Column("auth", sa.String(200), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_push_subscriptions_user", "push_subscriptions", ["utilizador_id"])


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_user", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
