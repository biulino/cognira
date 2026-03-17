"""configuracoes_sistema — admin-configurable platform settings

Revision ID: d4e5f6a7b8c3
Revises: c3d4e5f6a7b2
Create Date: 2026-03-09 14:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c3"
down_revision: Union[str, None] = "c3d4e5f6a7b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default nav permissions per role (JSON stored as text)
_DEFAULT_NAV = """{
  "admin":       ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","utilizadores","chat","ingest","callcenter"],
  "coordenador": ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","chat","ingest","callcenter"],
  "validador":   ["dashboard","estudos","visitas","chat","callcenter"],
  "analista":    ["dashboard","visitas"],
  "cliente":     ["dashboard","estudos"]
}"""


def upgrade() -> None:
    op.create_table(
        "configuracoes_sistema",
        sa.Column("chave", sa.String(100), primary_key=True),
        sa.Column("valor", sa.Text(), nullable=False),
        sa.Column("descricao", sa.String(300), nullable=True),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    # Seed the default nav permissions
    op.execute(
        sa.text(
            "INSERT INTO configuracoes_sistema (chave, valor, descricao) VALUES "
            "(:chave, :valor, :descricao)"
        ).bindparams(
            chave="nav_permissoes",
            valor=_DEFAULT_NAV,
            descricao="Itens de navegação visíveis por role (JSON)",
        )
    )


def downgrade() -> None:
    op.drop_table("configuracoes_sistema")
