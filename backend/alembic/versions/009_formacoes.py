"""formacoes — training modules and analyst certifications

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-03-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "c3d4e5f6a7b9"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "formacoes",
        sa.Column("id",                  sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("estudo_id",           sa.Integer(),     sa.ForeignKey("estudos.id"), nullable=False),
        sa.Column("titulo",              sa.String(300),   nullable=False),
        sa.Column("conteudo_html",       sa.Text(),        nullable=True),
        sa.Column("documento_url_minio", sa.String(500),   nullable=True),
        sa.Column("obrigatoria",         sa.Boolean(),     server_default=sa.text("true"), nullable=False),
        sa.Column("created_at",          sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",          sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_formacoes_estudo_id", "formacoes", ["estudo_id"])

    op.create_table(
        "testes_formacao",
        sa.Column("id",                   sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("formacao_id",          sa.Integer(), sa.ForeignKey("formacoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pergunta",             sa.Text(),    nullable=False),
        sa.Column("opcoes",               JSONB(),      nullable=True),
        sa.Column("resposta_correta_idx", sa.Integer(), nullable=False),
        sa.Column("pontuacao",            sa.Integer(), server_default=sa.text("1"), nullable=False),
    )
    op.create_index("ix_testes_formacao_formacao_id", "testes_formacao", ["formacao_id"])

    op.create_table(
        "resultados_formacao",
        sa.Column("id",               sa.Integer(),  primary_key=True, autoincrement=True),
        sa.Column("analista_id",      sa.Integer(),  sa.ForeignKey("analistas.id"), nullable=False),
        sa.Column("formacao_id",      sa.Integer(),  sa.ForeignKey("formacoes.id"), nullable=False),
        sa.Column("pontuacao_obtida", sa.Integer(),  nullable=False),
        sa.Column("aprovado",         sa.Boolean(),  server_default=sa.text("false"), nullable=False),
        sa.Column("tentativa",        sa.Integer(),  server_default=sa.text("1"), nullable=False),
        sa.Column("realizado_em",     sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_resultados_formacao_analista_id", "resultados_formacao", ["analista_id"])
    op.create_index("ix_resultados_formacao_formacao_id", "resultados_formacao", ["formacao_id"])

    op.create_table(
        "certificacoes_analista",
        sa.Column("id",             sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("analista_id",    sa.Integer(),   sa.ForeignKey("analistas.id"), nullable=False),
        sa.Column("estudo_id",      sa.Integer(),   sa.ForeignKey("estudos.id"),   nullable=False),
        sa.Column("certificado_em", sa.Date(),      nullable=True),
        sa.Column("valido_ate",     sa.Date(),      nullable=True),
        sa.Column("estado",         sa.String(20),  server_default=sa.text("'activo'"), nullable=False),
    )
    op.create_index("ix_certificacoes_analista_id", "certificacoes_analista", ["analista_id"])
    op.create_index("ix_certificacoes_estudo_id",   "certificacoes_analista", ["estudo_id"])


def downgrade() -> None:
    op.drop_table("certificacoes_analista")
    op.drop_table("resultados_formacao")
    op.drop_table("testes_formacao")
    op.drop_table("formacoes")
