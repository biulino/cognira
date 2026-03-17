"""022_cliente_sla.py — Per-client contractual SLA thresholds (Wave 8.8)"""
from alembic import op
import sqlalchemy as sa

revision = "022_cliente_sla"
down_revision = "021_questionnaire_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "clientes",
        sa.Column("sla_visita_dias", sa.Integer(), nullable=True, server_default="3"),
    )
    op.add_column(
        "clientes",
        sa.Column("sla_validacao_dias", sa.Integer(), nullable=True, server_default="2"),
    )


def downgrade():
    op.drop_column("clientes", "sla_visita_dias")
    op.drop_column("clientes", "sla_validacao_dias")
