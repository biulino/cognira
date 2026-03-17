"""018 — clientes_modulos: per-client module/plano flags."""
from alembic import op
import sqlalchemy as sa

revision = "018_planos_modulos"
down_revision = "017_shelf_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clientes_modulos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("modulo", sa.String(60), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["cliente_id"], ["clientes.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cliente_id", "modulo", name="uq_cliente_modulo"),
    )
    op.create_index(
        "ix_clientes_modulos_cliente_id", "clientes_modulos", ["cliente_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_clientes_modulos_cliente_id", table_name="clientes_modulos")
    op.drop_table("clientes_modulos")
