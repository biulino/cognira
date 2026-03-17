"""chat_interno — real-time group/direct chat conversations

Revision ID: e5f6a7b8c9d4
Revises: d4e5f6a7b8c3
Create Date: 2026-03-09 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c9d4"
down_revision: Union[str, None] = "d4e5f6a7b8c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(100), nullable=True),
        sa.Column("tipo", sa.String(10), nullable=False, server_default="direto"),
        sa.Column("criado_por", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "criada_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["criado_por"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "conversa_membros",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("conversa_id", sa.Integer(), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ultimo_lido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "adicionado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["conversa_id"], ["conversas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("conversa_id", "utilizador_id", name="uq_conversa_membro"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "chat_mensagens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("conversa_id", sa.Integer(), nullable=False),
        sa.Column("remetente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column(
            "criada_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["conversa_id"], ["conversas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["remetente_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_chat_mensagens_conversa_criada",
        "chat_mensagens",
        ["conversa_id", "criada_em"],
    )
    op.create_index(
        "ix_conversa_membros_utilizador",
        "conversa_membros",
        ["utilizador_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_conversa_membros_utilizador", table_name="conversa_membros")
    op.drop_index("ix_chat_mensagens_conversa_criada", table_name="chat_mensagens")
    op.drop_table("chat_mensagens")
    op.drop_table("conversa_membros")
    op.drop_table("conversas")
