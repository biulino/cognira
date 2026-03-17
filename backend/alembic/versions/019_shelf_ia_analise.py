"""019 — shelf_ia_analise + gps_checkin: AI compliance analysis and GPS proof-of-presence on visitas."""
from alembic import op
import sqlalchemy as sa

revision = "019_shelf_ia_analise"
down_revision = "018_planos_modulos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Shelf Audit AI columns
    op.add_column("visitas", sa.Column("shelf_ia_analise", sa.Text(), nullable=True))
    op.add_column(
        "visitas",
        sa.Column("shelf_ia_em", sa.DateTime(timezone=True), nullable=True),
    )
    # GPS proof-of-presence on check-in
    op.add_column("visitas", sa.Column("gps_checkin_lat", sa.Numeric(10, 7), nullable=True))
    op.add_column("visitas", sa.Column("gps_checkin_lon", sa.Numeric(10, 7), nullable=True))
    op.add_column(
        "visitas",
        sa.Column("gps_checkin_em", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("visitas", "gps_checkin_em")
    op.drop_column("visitas", "gps_checkin_lon")
    op.drop_column("visitas", "gps_checkin_lat")
    op.drop_column("visitas", "shelf_ia_em")
    op.drop_column("visitas", "shelf_ia_analise")
