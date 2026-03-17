"""Add sso_id column to utilizadores for OIDC/SSO login

Revision ID: e5f6a7b8c9d2
Revises: d4e5f6a7b8c1
Create Date: 2026-03-10
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d2"
down_revision: Union[str, None] = "d4e5f6a7b8c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "utilizadores",
        sa.Column("sso_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_utilizadores_sso_id", "utilizadores", ["sso_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_utilizadores_sso_id", table_name="utilizadores")
    op.drop_column("utilizadores", "sso_id")
