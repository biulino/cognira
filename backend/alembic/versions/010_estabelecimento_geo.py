"""010: add geolocation fields to estabelecimentos

Revision ID: 010_estabelecimento_geo
Revises: 009_formacoes
Create Date: 2026-03-10
"""

from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c1"
down_revision = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estabelecimentos", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("estabelecimentos", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("estabelecimentos", sa.Column("morada", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("estabelecimentos", "latitude")
    op.drop_column("estabelecimentos", "longitude")
    op.drop_column("estabelecimentos", "morada")
