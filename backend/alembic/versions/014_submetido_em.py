"""014 — Convert submissoes_questionario.submetido_em from String to DateTime

Revision ID: 014submetidoem
Revises: 013ragembeddings
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = "014submetidoem"
down_revision = "013ragembeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add a temporary DateTime column
    op.add_column(
        "submissoes_questionario",
        sa.Column("submetido_em_ts", sa.DateTime(timezone=True), nullable=True),
    )
    # 2. Convert existing ISO-8601 strings to timestamps
    op.execute(
        """
        UPDATE submissoes_questionario
        SET submetido_em_ts = submetido_em::timestamptz
        WHERE submetido_em IS NOT NULL
          AND submetido_em != ''
        """
    )
    # 3. Drop the old String column
    op.drop_column("submissoes_questionario", "submetido_em")
    # 4. Rename the new column
    op.alter_column(
        "submissoes_questionario",
        "submetido_em_ts",
        new_column_name="submetido_em",
    )


def downgrade() -> None:
    # Reverse: DateTime → String
    op.add_column(
        "submissoes_questionario",
        sa.Column("submetido_em_str", sa.String(50), nullable=True),
    )
    op.execute(
        """
        UPDATE submissoes_questionario
        SET submetido_em_str = submetido_em::text
        WHERE submetido_em IS NOT NULL
        """
    )
    op.drop_column("submissoes_questionario", "submetido_em")
    op.alter_column(
        "submissoes_questionario",
        "submetido_em_str",
        new_column_name="submetido_em",
    )
