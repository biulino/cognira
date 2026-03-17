import hashlib
import time
from collections import defaultdict
from typing import AsyncGenerator, Optional
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
import jwt as pyjwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import Utilizador, PermissaoEstudo
from app.models.modulo import ClienteModulo
from app.models.tenant import Tenant  # noqa: F401
from app.models.webhook import ApiKey

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _enforce_tenant_active(user: Utilizador) -> None:
    """Raise 402 if the user's tenant trial has expired or is suspended/cancelled."""
    tenant = getattr(user, "tenant", None)
    if tenant is None or user.is_superadmin:
        return
    if tenant.status == "suspended":
        raise HTTPException(status_code=402, detail="Conta suspensa. Contacte o suporte.")
    if tenant.status == "cancelled":
        raise HTTPException(status_code=402, detail="Conta cancelada.")
    if tenant.status == "trial" and tenant.trial_ends_at:
        now = datetime.now(timezone.utc)
        ends = tenant.trial_ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        if now > ends:
            raise HTTPException(status_code=402, detail="Período de trial expirado. Actualize o seu plano.")


def tenant_filter(user: Utilizador) -> Optional[int]:
    """Return tenant_id to filter by, or None (superadmin sees everything)."""
    if user.is_superadmin:
        return None
    return user.tenant_id


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Utilizador:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        # Reject partial 2FA tokens and refresh tokens
        if payload.get("pending_2fa"):
            raise credentials_exception
        if payload.get("type") == "refresh":
            raise credentials_exception
    except pyjwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(Utilizador).where(Utilizador.id == user_id, Utilizador.activo.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    _enforce_tenant_active(user)
    return user


async def get_superadmin(user: Utilizador = Depends(get_current_user)) -> Utilizador:
    """Dependency: only super-admins (platform-level) may access."""
    if not user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas super-administradores.")
    return user


def require_role(*allowed_roles: str):
    """Dependency factory: require one of the given global roles."""

    async def _check(user: Utilizador = Depends(get_current_user)):
        if user.role_global not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
        return user

    return _check


def require_modulo(modulo_key: str):
    """Dependency factory: require an active module for the user's client.

    - Admins always pass.
    - Users without a client always pass.
    - If the client has no rows yet (not configured), passes (backwards compat).
    """

    async def _check(
        user: Utilizador = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Utilizador:
        if user.role_global == "admin" or user.cliente_id is None:
            return user
        row = (
            await db.execute(
                select(ClienteModulo).where(
                    ClienteModulo.cliente_id == user.cliente_id,
                    ClienteModulo.modulo == modulo_key,
                )
            )
        ).scalar_one_or_none()
        # Row absent → module not yet configured → allow (default on)
        if row is None or row.activo:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Módulo '{modulo_key}' não está activo para este cliente",
        )

    return _check


async def get_estudo_role(
    estudo_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Return the user's role for a specific study (or admin bypass)."""
    if user.role_global == "admin":
        return "admin"
    result = await db.execute(
        select(PermissaoEstudo.role).where(
            PermissaoEstudo.utilizador_id == user.id,
            PermissaoEstudo.estudo_id == estudo_id,
        )
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem acesso a este estudo")
    return role


# ── API Key authentication + per-key rate limiting ───────────────────────────
# In-memory sliding window: {api_key_id: [window_start_monotonic, count]}
_rate_windows: dict[str, list] = defaultdict(lambda: [0.0, 0])


async def get_api_key(
    db: AsyncSession = Depends(get_db),
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
) -> ApiKey:
    """Dependency: authenticate via X-Api-Key header and enforce rate_limit_rpm."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header X-Api-Key obrigatório",
        )
    prefix = x_api_key[:12]
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_prefix == prefix, ApiKey.activo.is_(True))
    )
    record = result.scalar_one_or_none()
    # Constant-time comparison to prevent timing attacks
    expected = record.key_hash if record else "0" * 64
    provided = hashlib.sha256(x_api_key.encode()).hexdigest()
    if record is None or not hashlib.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key inválida")

    # Sliding-window rate limit (per process; sufficient for single-container deploys)
    key_id = str(record.id)
    now = time.monotonic()
    win = _rate_windows[key_id]
    if now - win[0] >= 60.0:  # new window
        win[0] = now
        win[1] = 0
    win[1] += 1
    if win[1] > record.rate_limit_rpm:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit excedido ({record.rate_limit_rpm} req/min)",
            headers={"Retry-After": "60"},
        )

    # Update last-used timestamp (best-effort)
    record.ultimo_uso = datetime.now(timezone.utc)
    await db.commit()
    return record
