"""chat_sessoes — persistent AI chat session history

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-03-10 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_sessoes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("utilizadores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mensagens", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_chat_sessoes_user_id", "chat_sessoes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_sessoes_user_id", "chat_sessoes")
    op.drop_table("chat_sessoes")
