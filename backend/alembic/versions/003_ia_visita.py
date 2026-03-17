"""ia_veredicto — store Q21 IA validation result on visit

Revision ID: c3d4e5f6a7b2
Revises: b2c3d4e5f6a1
Create Date: 2026-03-09 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6a7b2"
down_revision: Union[str, None] = "b2c3d4e5f6a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("visitas", sa.Column("ia_veredicto", sa.String(20), nullable=True))
    op.add_column("visitas", sa.Column("ia_mensagem", sa.Text(), nullable=True))
    op.add_column("visitas", sa.Column("ia_critica_em", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_visitas_ia_veredicto", "visitas", ["ia_veredicto"])


def downgrade() -> None:
    op.drop_index("ix_visitas_ia_veredicto", table_name="visitas")
    op.drop_column("visitas", "ia_critica_em")
    op.drop_column("visitas", "ia_mensagem")
    op.drop_column("visitas", "ia_veredicto")
