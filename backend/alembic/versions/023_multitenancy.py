"""023_multitenancy — Tenants, plans, tenant_id on users, is_superadmin."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
import json as _json

revision = "023_multitenancy"
down_revision = "022_cliente_sla"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Plans (sellable packages) ─────────────────────────────────────────
    op.create_table(
        "planos_tenant",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(100), nullable=False),
        sa.Column("codigo", sa.String(50), unique=True, nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("preco_mensal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("max_utilizadores", sa.Integer(), nullable=True),   # NULL = unlimited
        sa.Column("max_clientes", sa.Integer(), nullable=True),
        sa.Column("max_visitas_mes", sa.Integer(), nullable=True),
        sa.Column("trial_dias", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("features", JSONB, nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_planos_tenant_codigo", "planos_tenant", ["codigo"])

    # ── 2. Tenants ────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),  # subdomain
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("nome_marca", sa.String(200), nullable=True),          # branded display name
        sa.Column("status", sa.String(20), nullable=False, server_default="'trial'"),
        # status: trial | active | suspended | cancelled
        sa.Column("plano_id", sa.Integer(), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        # Owner / contact
        sa.Column("owner_nome", sa.String(200), nullable=False),
        sa.Column("owner_email", sa.String(255), nullable=False),
        sa.Column("owner_telefone", sa.String(50), nullable=True),
        sa.Column("pais", sa.String(100), nullable=True),
        # Branding
        sa.Column("cor_primaria", sa.String(7), nullable=False, server_default="'#1E40AF'"),
        sa.Column("cor_secundaria", sa.String(7), nullable=False, server_default="'#3B82F6'"),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("favicon_url", sa.String(500), nullable=True),
        sa.Column("dominio_custom", sa.String(255), nullable=True),
        sa.Column("css_custom", sa.Text(), nullable=True),
        # Admin notes
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["plano_id"], ["planos_tenant.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"])
    op.create_index("ix_tenants_status", "tenants", ["status"])

    # ── 3. Add tenant_id + is_superadmin to utilizadores ─────────────────────
    op.add_column("utilizadores", sa.Column("tenant_id", sa.Integer(), nullable=True))
    op.add_column("utilizadores", sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default="false"))
    op.create_foreign_key(
        "fk_utilizadores_tenant_id",
        "utilizadores", "tenants",
        ["tenant_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_utilizadores_tenant_id", "utilizadores", ["tenant_id"])

    # ── 4. Seed plans ─────────────────────────────────────────────────────────
    # JSON is passed as bind parameters to avoid SQLAlchemy treating
    # ':true'/':false'/':null' inside JSON strings as named bind params.
    _f_demo = _json.dumps({
        "white_label": True, "api_access": True,
        "all_modules": True, "priority_support": False,
    })
    _f_starter = _json.dumps({
        "white_label": False, "api_access": False,
        "all_modules": False, "priority_support": False,
        "modules": ["mystery_shopping", "callcenter"],
    })
    _f_professional = _json.dumps({
        "white_label": False, "api_access": True,
        "all_modules": True, "priority_support": False,
    })
    _f_enterprise = _json.dumps({
        "white_label": True, "api_access": True,
        "all_modules": True, "priority_support": True, "sla_support": "4h",
    })

    op.execute(sa.text("""
        INSERT INTO planos_tenant
            (nome, codigo, descricao, preco_mensal, max_utilizadores, max_clientes,
             max_visitas_mes, trial_dias, features, is_public, is_active, ordem)
        VALUES
        ('Demo', 'demo',
         'Conta de demonstracao interna. Acesso completo sem limite.',
         0, NULL, NULL, NULL, 0, CAST(:f_demo AS jsonb), false, true, 0),
        ('Starter', 'starter',
         'Perfeito para equipas em crescimento. Ate 5 utilizadores e 200 visitas/mes.',
         99.00, 5, 10, 200, 14, CAST(:f_starter AS jsonb), true, true, 1),
        ('Professional', 'professional',
         'Para agencias estabelecidas com multiplos clientes e analistas.',
         299.00, 25, 50, 1000, 14, CAST(:f_professional AS jsonb), true, true, 2),
        ('Enterprise', 'enterprise',
         'Plataforma ilimitada com white-label completo e suporte prioritario.',
         799.00, NULL, NULL, NULL, 30, CAST(:f_enterprise AS jsonb), true, true, 3)
    """).bindparams(
        f_demo=_f_demo,
        f_starter=_f_starter,
        f_professional=_f_professional,
        f_enterprise=_f_enterprise,
    ))

    # ── 5. Seed demo tenant (id=1) ────────────────────────────────────────────
    op.execute(sa.text("""
        INSERT INTO tenants
            (slug, nome, nome_marca, status, plano_id,
             owner_nome, owner_email,
             cor_primaria, cor_secundaria)
        VALUES (
            'demo',
            'MarketView Demo',
            'MarketView',
            'active',
            (SELECT id FROM planos_tenant WHERE codigo='demo'),
            'Super Admin',
            'admin@marketview.io',
            '#FF3300',
            '#1E40AF'
        )
    """))

    # ── 6. Assign existing users to demo tenant ───────────────────────────────
    op.execute(sa.text("""
        UPDATE utilizadores
        SET tenant_id = (SELECT id FROM tenants WHERE slug='demo')
        WHERE tenant_id IS NULL
    """))


def downgrade() -> None:
    op.drop_index("ix_utilizadores_tenant_id", table_name="utilizadores")
    op.drop_constraint("fk_utilizadores_tenant_id", "utilizadores", type_="foreignkey")
    op.drop_column("utilizadores", "is_superadmin")
    op.drop_column("utilizadores", "tenant_id")
    op.drop_index("ix_tenants_status", table_name="tenants")
    op.drop_index("ix_tenants_slug", table_name="tenants")
    op.drop_table("tenants")
    op.drop_index("ix_planos_tenant_codigo", table_name="planos_tenant")
    op.drop_table("planos_tenant")
