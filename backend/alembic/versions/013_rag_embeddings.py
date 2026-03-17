"""013 — RAG embeddings store (pgvector)

Revision ID: 013
Revises: 012
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = "013ragembeddings"
down_revision = "f6a7b8c9d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "briefing_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("estudo_id", sa.Integer(), sa.ForeignKey("estudos.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("titulo", sa.String(500), nullable=False),
        sa.Column("conteudo", sa.Text(), nullable=False),
        # vector(1536) = text-embedding-3-small dimensions
        sa.Column("embedding", sa.Text(), nullable=True),   # stored as comma-sep floats; pgvector cast applied via raw SQL
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Add pgvector column properly (sa.Text above is a placeholder, now alter to vector type)
    op.execute("ALTER TABLE briefing_embeddings ADD COLUMN IF NOT EXISTS vec vector(1536)")
    op.execute("ALTER TABLE briefing_embeddings DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE briefing_embeddings RENAME COLUMN vec TO embedding")
    op.execute(
        "CREATE INDEX IF NOT EXISTS briefing_embeddings_ivfflat_idx "
        "ON briefing_embeddings USING ivfflat (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS briefing_embeddings")
