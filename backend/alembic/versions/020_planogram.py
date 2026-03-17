"""020_planogram.py — Planogram compliance tables (Wave 8.4)"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "020_planogram"
down_revision = "019_shelf_ia_analise"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "planogramas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("estudo_id", sa.Integer, sa.ForeignKey("estudos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("criado_por", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="SET NULL"), nullable=True),
        sa.Column("nome", sa.String(300), nullable=False),
        sa.Column("descricao", sa.Text, nullable=True),
        sa.Column("categoria", sa.String(100), nullable=True),
        sa.Column("imagem_url", sa.String(2048), nullable=True),
        sa.Column("imagem_minio_key", sa.String(1024), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_planogramas_estudo", "planogramas", ["estudo_id"])

    op.create_table(
        "planogram_comparacoes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("planogram_id", sa.Integer, sa.ForeignKey("planogramas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("visita_id", sa.Integer, sa.ForeignKey("visitas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("foto_id", sa.Integer, sa.ForeignKey("fotos_visita.id", ondelete="SET NULL"), nullable=True),
        sa.Column("score_compliance", sa.Numeric(5, 2), nullable=True),
        sa.Column("ia_analise", sa.Text, nullable=True),
        sa.Column("ia_items_corretos", sa.JSON, nullable=True),
        sa.Column("ia_items_errados", sa.JSON, nullable=True),
        sa.Column("ia_items_faltando", sa.JSON, nullable=True),
        sa.Column("ia_recomendacoes", sa.Text, nullable=True),
        sa.Column("analisado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_planogram_comp_visita", "planogram_comparacoes", ["visita_id"])
    op.create_index("ix_planogram_comp_planogram", "planogram_comparacoes", ["planogram_id"])


def downgrade() -> None:
    op.drop_table("planogram_comparacoes")
    op.drop_table("planogramas")
