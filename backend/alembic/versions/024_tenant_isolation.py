"""024_tenant_isolation — tenant_id on clientes and analistas."""
from alembic import op
import sqlalchemy as sa

revision = "024_tenant_isolation"
down_revision = "023_multitenancy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── clientes ──────────────────────────────────────────────────────────────
    op.add_column(
        "clientes",
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_clientes_tenant_id", "clientes", ["tenant_id"])
    op.execute(sa.text("UPDATE clientes SET tenant_id = 1 WHERE tenant_id IS NULL"))

    # ── analistas ─────────────────────────────────────────────────────────────
    op.add_column(
        "analistas",
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_analistas_tenant_id", "analistas", ["tenant_id"])
    op.execute(sa.text("UPDATE analistas SET tenant_id = 1 WHERE tenant_id IS NULL"))


def downgrade() -> None:
    op.drop_index("ix_analistas_tenant_id", table_name="analistas")
    op.drop_column("analistas", "tenant_id")
    op.drop_index("ix_clientes_tenant_id", table_name="clientes")
    op.drop_column("clientes", "tenant_id")
