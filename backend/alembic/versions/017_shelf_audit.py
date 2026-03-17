"""017 shelf_audit: shelf_audit_items table for retail audit module

Revision ID: 017_shelf_audit
Revises: 016_multi_grid
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = "017_shelf_audit"
down_revision = "016_multi_grid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shelf_audit_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("visita_id", sa.Integer, sa.ForeignKey("visitas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("produto_nome", sa.String(300), nullable=False),
        sa.Column("ean", sa.String(50), nullable=True),
        sa.Column("preco_esperado", sa.Numeric(8, 2), nullable=True),
        sa.Column("preco_real", sa.Numeric(8, 2), nullable=True),
        sa.Column("quantidade_esperada", sa.Integer, nullable=True),
        sa.Column("quantidade_real", sa.Integer, nullable=True),
        sa.Column("facings", sa.Integer, nullable=True),
        sa.Column("validade", sa.Date, nullable=True),
        sa.Column("conforme", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_shelf_audit_visita", "shelf_audit_items", ["visita_id"])
    op.create_index("ix_shelf_audit_ean", "shelf_audit_items", ["ean"])


def downgrade() -> None:
    op.drop_index("ix_shelf_audit_ean")
    op.drop_index("ix_shelf_audit_visita")
    op.drop_table("shelf_audit_items")
