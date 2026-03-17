"""callcenter module — 3 new tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-03-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "4e5f1ea5c3ce"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "templates_callcenter",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("cliente_id", sa.Integer(), nullable=True),
        sa.Column(
            "campos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "chamadas_callcenter",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("estudo_id", sa.Integer(), nullable=True),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("nome_ficheiro", sa.String(300), nullable=False),
        sa.Column("url_minio", sa.String(500), nullable=False),
        sa.Column("tamanho", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("duracao_segundos", sa.Integer(), nullable=True),
        sa.Column(
            "estado",
            sa.String(20),
            nullable=False,
            server_default="pendente",
        ),
        sa.Column("erro_mensagem", sa.Text(), nullable=True),
        sa.Column("transcricao", sa.Text(), nullable=True),
        sa.Column(
            "dados_extraidos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("relatorio", sa.Text(), nullable=True),
        sa.Column("score_global", sa.Numeric(5, 2), nullable=True),
        sa.Column("referencia_externa", sa.String(200), nullable=True),
        sa.Column("agente_nome", sa.String(200), nullable=True),
        sa.Column("data_chamada", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "submetido_por_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"]),
        sa.ForeignKeyConstraint(["estudo_id"], ["estudos.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["templates_callcenter.id"]),
        sa.ForeignKeyConstraint(["submetido_por_id"], ["utilizadores.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chamadas_cliente", "chamadas_callcenter", ["cliente_id"])
    op.create_index("ix_chamadas_estudo", "chamadas_callcenter", ["estudo_id"])
    op.create_index("ix_chamadas_estado", "chamadas_callcenter", ["estado"])

    op.create_table(
        "configuracoes_callcenter",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "roles_upload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='["admin","coordenador","validador"]',
        ),
        sa.Column(
            "max_ficheiro_mb",
            sa.Integer(),
            nullable=False,
            server_default="100",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO configuracoes_callcenter (id, roles_upload, max_ficheiro_mb) "
        "VALUES (1, '[\"admin\",\"coordenador\",\"validador\"]', 100) "
        "ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table("configuracoes_callcenter")
    op.drop_index("ix_chamadas_estado", table_name="chamadas_callcenter")
    op.drop_index("ix_chamadas_estudo", table_name="chamadas_callcenter")
    op.drop_index("ix_chamadas_cliente", table_name="chamadas_callcenter")
    op.drop_table("chamadas_callcenter")
    op.drop_table("templates_callcenter")
