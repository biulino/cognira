"""foto_ia — add AI validation fields to fotos_visita

Revision ID: f6a7b8c9d0e5
Revises: e5f6a7b8c9d4
Create Date: 2026-03-10 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e5"
down_revision: Union[str, None] = "e5f6a7b8c9d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fotos_visita", sa.Column("ia_veredicto", sa.String(30), nullable=True))
    op.add_column("fotos_visita", sa.Column("ia_resultado", sa.Text(), nullable=True))
    op.add_column("fotos_visita", sa.Column("ia_critica_em", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("fotos_visita", "ia_critica_em")
    op.drop_column("fotos_visita", "ia_resultado")
    op.drop_column("fotos_visita", "ia_veredicto")
