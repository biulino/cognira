"""mensagens_sistema — direct messaging between users

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-03-09 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a1"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mensagens_sistema",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "remetente_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("utilizadores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "destinatario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("utilizadores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("assunto", sa.String(200), nullable=False),
        sa.Column("corpo", sa.Text(), nullable=False),
        sa.Column("lida", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "criada_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_mensagens_dest", "mensagens_sistema", ["destinatario_id"])
    op.create_index("ix_mensagens_rem", "mensagens_sistema", ["remetente_id"])


def downgrade() -> None:
    op.drop_index("ix_mensagens_dest", table_name="mensagens_sistema")
    op.drop_index("ix_mensagens_rem", table_name="mensagens_sistema")
    op.drop_table("mensagens_sistema")
