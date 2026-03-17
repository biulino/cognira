"""025_token_blacklist — revoked refresh tokens."""
from alembic import op
import sqlalchemy as sa

revision = "025_token_blacklist"
down_revision = "024_tenant_isolation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "token_blacklist",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("jti", sa.String(length=64), nullable=False, unique=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_token_blacklist_jti", "token_blacklist", ["jti"], unique=True)
    op.create_index("ix_token_blacklist_expires_at", "token_blacklist", ["expires_at"])


def downgrade() -> None:
    op.drop_table("token_blacklist")
