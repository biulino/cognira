"""candidatura_pii — encrypt PII columns in candidaturas_recrutamento

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e5
Create Date: 2026-03-10 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f6a7b8c9d0e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "candidaturas_recrutamento", "nome",
        existing_type=sa.String(200),
        type_=sa.LargeBinary(),
        existing_nullable=False,
        postgresql_using="nome::bytea",
    )
    op.alter_column(
        "candidaturas_recrutamento", "email",
        existing_type=sa.String(200),
        type_=sa.LargeBinary(),
        existing_nullable=False,
        postgresql_using="email::bytea",
    )
    op.alter_column(
        "candidaturas_recrutamento", "telefone",
        existing_type=sa.String(30),
        type_=sa.LargeBinary(),
        existing_nullable=True,
        postgresql_using="telefone::bytea",
    )
    op.alter_column(
        "candidaturas_recrutamento", "morada",
        existing_type=sa.String(500),
        type_=sa.LargeBinary(),
        existing_nullable=True,
        postgresql_using="morada::bytea",
    )


def downgrade() -> None:
    op.alter_column(
        "candidaturas_recrutamento", "morada",
        existing_type=sa.LargeBinary(),
        type_=sa.String(500),
        existing_nullable=True,
    )
    op.alter_column(
        "candidaturas_recrutamento", "telefone",
        existing_type=sa.LargeBinary(),
        type_=sa.String(30),
        existing_nullable=True,
    )
    op.alter_column(
        "candidaturas_recrutamento", "email",
        existing_type=sa.LargeBinary(),
        type_=sa.String(200),
        existing_nullable=False,
    )
    op.alter_column(
        "candidaturas_recrutamento", "nome",
        existing_type=sa.LargeBinary(),
        type_=sa.String(200),
        existing_nullable=False,
    )
