"""016 multi-grid: SecaoGrelha, grelha.tipo_visita, criterio.secao_id/ordem, visita.grelha_id, tipo_visita wider

Revision ID: 016_multi_grid
Revises: 015fase7
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = "016_multi_grid"
down_revision = "015fase7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add tipo_visita column to grelhas (which grid is for which visit type)
    op.add_column("grelhas", sa.Column("tipo_visita", sa.String(30), nullable=True))

    # 2. Create secoes_grelha table
    op.create_table(
        "secoes_grelha",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("grelha_id", sa.Integer, sa.ForeignKey("grelhas.id"), nullable=False),
        sa.Column("nome", sa.String(300), nullable=False),
        sa.Column("ordem", sa.Integer, nullable=False, server_default="0"),
        sa.Column("peso_secao", sa.Numeric(5, 2), nullable=True),
    )
    op.create_index("ix_secoes_grelha_grelha_id", "secoes_grelha", ["grelha_id"])

    # 3. Add secao_id and ordem to criterios_grelha
    op.add_column("criterios_grelha", sa.Column("secao_id", sa.Integer,
                  sa.ForeignKey("secoes_grelha.id"), nullable=True))
    op.add_column("criterios_grelha", sa.Column("ordem", sa.Integer, nullable=False,
                  server_default="0"))

    # 4. Add grelha_id to visitas (which grid was used for this specific visit)
    op.add_column("visitas", sa.Column("grelha_id", sa.Integer,
                  sa.ForeignKey("grelhas.id"), nullable=True))
    op.create_index("ix_visitas_grelha_id", "visitas", ["grelha_id"])

    # 5. Widen tipo_visita on visitas from VARCHAR(20) to VARCHAR(30)
    op.alter_column("visitas", "tipo_visita",
                    existing_type=sa.String(20),
                    type_=sa.String(30),
                    existing_nullable=False)


def downgrade() -> None:
    op.drop_index("ix_visitas_grelha_id", table_name="visitas")
    op.drop_column("visitas", "grelha_id")
    op.alter_column("visitas", "tipo_visita",
                    existing_type=sa.String(30),
                    type_=sa.String(20),
                    existing_nullable=False)
    op.drop_column("criterios_grelha", "ordem")
    op.drop_column("criterios_grelha", "secao_id")
    op.drop_index("ix_secoes_grelha_grelha_id", table_name="secoes_grelha")
    op.drop_table("secoes_grelha")
    op.drop_column("grelhas", "tipo_visita")
