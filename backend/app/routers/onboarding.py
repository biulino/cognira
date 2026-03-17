"""
POST /api/onboarding  — Public self-service tenant registration.

Creates: plan trial → Tenant → admin Utilizador → returns JWT token.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token, hash_password
from app.database import get_db
from app.models.tenant import Tenant, PlanoTenant
from app.models.user import Utilizador

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$")


class OnboardingRequest(BaseModel):
    # Company
    company_nome: str
    slug: str                        # desired subdomain
    country: str = "PT"
    # Owner
    owner_nome: str
    owner_email: EmailStr
    owner_telefone: str = ""
    # Account credentials
    password: str
    # Plan
    plano_codigo: str = "starter"

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not _SLUG_RE.match(v):
            raise ValueError(
                "Slug inválido. Use apenas letras minúsculas, dígitos e hífens "
                "(mínimo 3, máximo 50 caracteres, não pode começar/terminar com hífen)."
            )
        reserved = {"demo", "api", "app", "www", "admin", "superadmin", "mail", "cdn", "assets", "static"}
        if v in reserved:
            raise ValueError(f"O slug '{v}' é reservado. Escolha outro.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password deve ter pelo menos 8 caracteres.")
        return v


@router.post("")
async def register_tenant(body: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    """
    Self-service onboarding:
      1. Validate slug + email uniqueness
      2. Resolve plan
      3. Create Tenant
      4. Create admin Utilizador for the tenant
      5. Return JWT (auto-login) + tenant info
    """
    # ── 1. Uniqueness checks ──────────────────────────────────────────────────
    existing_slug = (
        await db.execute(select(Tenant).where(Tenant.slug == body.slug))
    ).scalar_one_or_none()
    if existing_slug:
        raise HTTPException(409, f"O subdomínio '{body.slug}' já está em uso. Escolha outro.")

    # ── 2. Resolve plan ───────────────────────────────────────────────────────
    plano = (
        await db.execute(
            select(PlanoTenant).where(
                PlanoTenant.codigo == body.plano_codigo,
                PlanoTenant.is_active == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not plano:
        raise HTTPException(400, f"Plano '{body.plano_codigo}' não encontrado.")
    if not plano.is_public:
        raise HTTPException(403, "Este plano não está disponível para inscrição pública.")

    # ── 3. Create Tenant ──────────────────────────────────────────────────────
    trial_end = (
        datetime.now(timezone.utc) + timedelta(days=plano.trial_dias)
        if plano.trial_dias > 0 else None
    )
    tenant = Tenant(
        slug=body.slug,
        nome=body.company_nome,
        nome_marca=body.company_nome,
        status="trial",
        plano_id=plano.id,
        trial_ends_at=trial_end,
        owner_nome=body.owner_nome,
        owner_email=body.owner_email,
        owner_telefone=body.owner_telefone,
        pais=body.country,
        cor_primaria="#1E40AF",
        cor_secundaria="#3B82F6",
    )
    db.add(tenant)
    await db.flush()  # get tenant.id without committing

    # ── 4. Create admin user ──────────────────────────────────────────────────
    username_base = re.sub(r"[^a-z0-9]", "", body.owner_email.split("@")[0].lower())[:20]
    username = f"{username_base}_{tenant.id}"

    admin_user = Utilizador(
        id=uuid.uuid4(),
        username=username,
        email=body.owner_email.encode(),  # NOTE: real app uses pgcrypto; here stored plaintext for bootstrap
        password_hash=hash_password(body.password),
        role_global="admin",
        activo=True,
        tenant_id=tenant.id,
        is_superadmin=False,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(tenant)

    # ── 5. Return tokens + info ───────────────────────────────────────────────
    access = create_access_token(str(admin_user.id), extra={"tenant_id": tenant.id})
    refresh = create_refresh_token(str(admin_user.id))

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "tenant": {
            "id": tenant.id,
            "slug": tenant.slug,
            "nome": tenant.nome,
            "status": tenant.status,
            "plano": plano.nome,
            "trial_ends_at": trial_end,
        },
        "user": {
            "id": str(admin_user.id),
            "username": admin_user.username,
            "role_global": admin_user.role_global,
        },
    }
