import base64
import secrets
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

# ── Simple TTL cache for nav config (60s per tenant key) ─────────────────────
_NAV_CACHE_TTL = 60.0
_nav_cache: dict[str, tuple[float, Any]] = {}


def _nav_cache_get(key: str) -> Any:
    entry = _nav_cache.get(key)
    if entry and time.monotonic() - entry[0] < _NAV_CACHE_TTL:
        return entry[1]
    return None


def _nav_cache_set(key: str, val: Any) -> None:
    _nav_cache[key] = (time.monotonic(), val)


def _nav_cache_invalidate(tenant_id: Any) -> None:
    _nav_cache.pop(str(tenant_id), None)
    _nav_cache.pop("global", None)

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import Utilizador
from app.models.token_blacklist import TokenBlacklist
from app.schemas import (
    LoginRequest, TOTPVerifyRequest, TokenResponse,
    RefreshRequest, TOTPSetupResponse,
)
from app.auth import (
    verify_password, hash_password,
    create_access_token, create_refresh_token, decode_token,
    generate_totp_secret, get_totp_uri, verify_totp,
    generate_qr_png, generate_backup_codes,
)
from app.services import pii
from app.services.audit import log_action

router = APIRouter()


async def _revoke_token(db: AsyncSession, payload: dict) -> None:
    """Insert a refresh token's JTI into the blacklist."""
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return
    expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
    entry = TokenBlacklist(jti=jti, expires_at=expires_at)
    db.add(entry)
    await db.commit()


async def _is_token_revoked(db: AsyncSession, jti: str) -> bool:
    result = await db.execute(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
    return result.scalar_one_or_none() is not None
settings = get_settings()

# ── SSO state store (in-process, TTL 10 min) ─────────────────────────────────
# For multi-instance deployments replace with Redis.
_sso_states: dict[str, float] = {}  # state → unix timestamp


def _new_sso_state() -> str:
    s = secrets.token_urlsafe(32)
    # Purge expired states
    now = time.time()
    for k in list(_sso_states):
        if now - _sso_states[k] > 600:
            del _sso_states[k]
    _sso_states[s] = now
    return s


def _consume_sso_state(state: str) -> bool:
    ts = _sso_states.pop(state, None)
    return ts is not None and (time.time() - ts) < 600


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Utilizador).where(Utilizador.username == body.username, Utilizador.activo.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    if user.totp_activo:
        # Return partial token that requires 2FA verification
        partial_token = create_access_token(str(user.id), extra={"pending_2fa": True})
        return TokenResponse(
            access_token=partial_token,
            refresh_token="",
            requires_2fa=True,
        )

    access = create_access_token(str(user.id), extra={"role": user.role_global, "cliente_id": user.cliente_id})
    refresh = create_refresh_token(str(user.id))
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(user.id),
        acao="login",
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/2fa/verify", response_model=TokenResponse)
async def verify_2fa(body: TOTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Utilizador).where(Utilizador.username == body.username, Utilizador.activo.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user or not user.totp_activo or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="2FA não configurado")

    # Decrypt Fernet-encrypted TOTP secret
    if isinstance(user.totp_secret, (bytes, bytearray)):
        secret = pii.decrypt(user.totp_secret)
    else:
        secret = user.totp_secret
    if not verify_totp(secret, body.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código 2FA inválido")

    access = create_access_token(str(user.id), extra={"role": user.role_global, "cliente_id": user.cliente_id})
    refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/2fa/setup", response_model=TOTPSetupResponse)
async def setup_2fa(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user.username)
    qr_bytes = generate_qr_png(uri)
    backup = generate_backup_codes()

    user.totp_secret = pii.encrypt(secret)
    user.totp_activo = True
    user.backup_codes = pii.encrypt(",".join(backup))
    db.add(user)

    return TOTPSetupResponse(
        qr_png_base64=base64.b64encode(qr_bytes).decode(),
        backup_codes=backup,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    jti = payload.get("jti")
    if jti and await _is_token_revoked(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revogado")

    user_id = payload.get("sub")
    result = await db.execute(select(Utilizador).where(Utilizador.id == user_id, Utilizador.activo.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizador não encontrado")

    # Rotate: revoke the consumed token, issue a fresh one
    await _revoke_token(db, payload)
    access = create_access_token(str(user.id), extra={"role": user.role_global, "cliente_id": user.cliente_id})
    refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/logout")
async def logout(body: RefreshRequest | None = None, db: AsyncSession = Depends(get_db)):
    """Revoke the supplied refresh token so it cannot be reused."""
    if body and body.refresh_token:
        payload = decode_token(body.refresh_token)
        if payload and payload.get("type") == "refresh":
            await _revoke_token(db, payload)
    return {"detail": "Sessão terminada"}


@router.post("/change-password")
async def change_password(
    body: dict,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    old_pw = body.get("password_atual", "")
    new_pw = body.get("password_nova", "")
    if not old_pw or not new_pw:
        raise HTTPException(status_code=400, detail="password_atual e password_nova são obrigatórios")
    if not verify_password(old_pw, user.password_hash):
        raise HTTPException(status_code=400, detail="Password actual incorrecta")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="Password nova deve ter pelo menos 8 caracteres")
    user.password_hash = hash_password(new_pw)
    db.add(user)
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(user.id),
        acao="change_password",
    )
    return {"detail": "Password alterada com sucesso"}


@router.get("/me")
async def me(user: Utilizador = Depends(get_current_user)):
    email = user.email
    if isinstance(email, (bytes, bytearray)):
        email = pii.decrypt(bytes(email))
    elif isinstance(email, str):
        # Stored as a Fernet-encoded string (some migration paths)
        try:
            email = pii.decrypt(email.encode("utf-8"))
        except Exception:
            pass  # already plain text
    perms = [{"estudo_id": p.estudo_id, "role": p.role} for p in (user.permissoes or [])]
    return {
        "id": str(user.id),
        "username": user.username,
        "email": email,
        "role_global": user.role_global,
        "totp_activo": user.totp_activo,
        "activo": user.activo,
        "cliente_id": user.cliente_id,
        "tenant_id": user.tenant_id,
        "is_superadmin": user.is_superadmin,
        "permissoes": perms,
    }


@router.get("/me/context")
async def me_context(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Combined context endpoint: user profile + nav config + unread badge.

    Replaces 3 separate API calls (GET /auth/me, GET /config/nav_permissoes,
    GET /chat-interno/nao-lidas) that every page previously made on navigation.
    """
    import json
    from sqlalchemy import func, case, and_
    from sqlalchemy.orm import aliased
    from app.models.settings import ConfiguracaoSistema
    from app.models.chat import ConversaMembro, ChatMensagem
    from app.deps import tenant_filter

    # ── 1. User data (same as /me) ────────────────────────────────────────────
    email = user.email
    if isinstance(email, (bytes, bytearray)):
        email = pii.decrypt(bytes(email))
    elif isinstance(email, str):
        try:
            email = pii.decrypt(email.encode("utf-8"))
        except Exception:
            pass
    perms = [{"estudo_id": p.estudo_id, "role": p.role} for p in (user.permissoes or [])]
    user_data = {
        "id": str(user.id),
        "username": user.username,
        "email": email,
        "role_global": user.role_global,
        "totp_activo": user.totp_activo,
        "activo": user.activo,
        "cliente_id": user.cliente_id,
        "tenant_id": user.tenant_id,
        "is_superadmin": user.is_superadmin,
        "permissoes": perms,
    }

    # ── 2. Nav config (tenant-scoped, same logic as GET /config/nav_permissoes) ─
    from app.nav_defaults import NAV_DEFAULTS
    _nav_cache_key = str(user.tenant_id) if user.tenant_id else "global"
    nav_valor = _nav_cache_get(_nav_cache_key)
    if nav_valor is None:
        nav_valor = NAV_DEFAULTS
        if user.tenant_id and not user.is_superadmin:
            tenant_chave = f"nav_permissoes_{user.tenant_id}"
            tenant_row = (await db.execute(
                select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == tenant_chave)
            )).scalar_one_or_none()
            if tenant_row:
                try:
                    nav_valor = json.loads(tenant_row.valor)
                except Exception:
                    nav_valor = tenant_row.valor
            else:
                global_row = (await db.execute(
                    select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == "nav_permissoes")
                )).scalar_one_or_none()
                if global_row:
                    try:
                        nav_valor = json.loads(global_row.valor)
                    except Exception:
                        nav_valor = global_row.valor
        else:
            global_row = (await db.execute(
                select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == "nav_permissoes")
            )).scalar_one_or_none()
            if global_row:
                try:
                    nav_valor = json.loads(global_row.valor)
                except Exception:
                    nav_valor = global_row.valor
        _nav_cache_set(_nav_cache_key, nav_valor)

    # ── 3. Unread chat badge (same logic as GET /chat-interno/nao-lidas) ──────
    from sqlalchemy import literal_column
    cm = aliased(ConversaMembro)
    msg = aliased(ChatMensagem)
    unread_q = (
        select(func.coalesce(func.sum(literal_column("1")), 0))
        .select_from(cm)
        .join(msg, and_(
            msg.conversa_id == cm.conversa_id,
            msg.remetente_id != user.id,
        ))
        .where(
            cm.utilizador_id == user.id,
            case(
                (cm.ultimo_lido_em.is_not(None), msg.criada_em > cm.ultimo_lido_em),
                else_=True,
            ),
        )
    )
    unread_total = int((await db.execute(unread_q)).scalar_one())

    return {
        "user": user_data,
        "nav": nav_valor,
        "unread": unread_total,
    }


# ── Self-service onboarding ───────────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    empresa: str
    username: str
    email: str
    password: str

@router.post("/onboarding", status_code=201)
async def onboarding(body: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    """Self-service SaaS onboarding: creates a client + admin user in one step."""
    from app.models.client import Cliente

    # Check username uniqueness
    existing = (await db.execute(
        select(Utilizador).where(Utilizador.username == body.username)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Username já existe")

    # Create client
    cliente = Cliente(nome=body.empresa, activo=True)
    db.add(cliente)
    await db.flush()

    # Create admin user linked to the client
    user = Utilizador(
        username=body.username,
        email=pii.encrypt(body.email),
        password_hash=hash_password(body.password),
        role_global="admin",
        cliente_id=cliente.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    access = create_access_token(str(user.id), extra={"role": "admin", "cliente_id": cliente.id})
    refresh = create_refresh_token(str(user.id))

    await log_action(db, utilizador_id=user.id, entidade="Cliente", entidade_id=str(cliente.id), acao="onboarding")

    return {
        "access_token": access,
        "refresh_token": refresh,
        "cliente_id": cliente.id,
        "detail": "Conta criada com sucesso",
    }


# ── SSO / OIDC ────────────────────────────────────────────────────────────────

@router.get("/sso/config")
async def sso_config():
    """Public endpoint — returns SSO configuration for the login page."""
    return {
        "enabled": settings.sso_enabled,
        "provider_name": settings.sso_provider_name or "SSO",
    }


@router.get("/sso/login")
async def sso_login():
    """Redirect browser to the OIDC provider authorization endpoint."""
    if not settings.sso_enabled:
        raise HTTPException(status_code=404, detail="SSO não activado")
    state = _new_sso_state()
    params = urlencode({
        "client_id": settings.sso_client_id,
        "redirect_uri": settings.sso_redirect_uri,
        "response_type": "code",
        "scope": settings.sso_scopes,
        "state": state,
    })
    return RedirectResponse(f"{settings.sso_auth_url}?{params}", status_code=302)


@router.get("/sso/callback")
async def sso_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """Handle OIDC authorization code callback from the identity provider."""
    if not settings.sso_enabled:
        raise HTTPException(status_code=404, detail="SSO não activado")

    if not _consume_sso_state(state):
        raise HTTPException(status_code=400, detail="Estado SSO inválido ou expirado")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_res = await client.post(
                settings.sso_token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.sso_redirect_uri,
                    "client_id": settings.sso_client_id,
                    "client_secret": settings.sso_client_secret,
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            oidc_tokens = token_res.json()

            userinfo_res = await client.get(
                settings.sso_userinfo_url,
                headers={"Authorization": f"Bearer {oidc_tokens['access_token']}"},
            )
            userinfo_res.raise_for_status()
            userinfo = userinfo_res.json()
    except httpx.HTTPError as exc:
        import logging
        logging.getLogger(__name__).error("SSO IdP error: %s", exc)
        raise HTTPException(status_code=502, detail="Erro ao contactar o provedor de autenticação. Tente novamente mais tarde.")

    sso_sub: str = str(userinfo.get("sub", ""))
    email_raw: str = userinfo.get("email", "")
    preferred_username: str = (
        userinfo.get("preferred_username")
        or userinfo.get("name")
        or email_raw.split("@")[0]
        or sso_sub[:20]
    )

    if not sso_sub:
        raise HTTPException(status_code=502, detail="IdP não devolveu 'sub'")

    result = await db.execute(select(Utilizador).where(Utilizador.sso_id == sso_sub))
    user = result.scalar_one_or_none()

    if user is None:
        result2 = await db.execute(
            select(Utilizador).where(Utilizador.username == preferred_username)
        )
        user = result2.scalar_one_or_none()
        if user:
            user.sso_id = sso_sub
        else:
            safe_username = preferred_username[:50].replace(" ", "_")
            base = safe_username
            suffix = 0
            while True:
                check = await db.execute(select(Utilizador).where(Utilizador.username == safe_username))
                if check.scalar_one_or_none() is None:
                    break
                suffix += 1
                safe_username = f"{base}_{suffix}"

            user = Utilizador(
                username=safe_username,
                email=pii.encrypt(email_raw) if email_raw else pii.encrypt(safe_username),
                password_hash=hash_password(secrets.token_urlsafe(32)),
                role_global=settings.sso_default_role,
                activo=True,
                sso_id=sso_sub,
            )
            db.add(user)
            await db.flush()

    if not user.activo:
        raise HTTPException(status_code=403, detail="Conta desactivada")

    access = create_access_token(str(user.id), extra={"role": user.role_global, "cliente_id": user.cliente_id})
    refresh = create_refresh_token(str(user.id))
    await log_action(db, utilizador_id=user.id, entidade="Utilizador", entidade_id=str(user.id), acao="sso_login")

    frontend_base = settings.frontend_url.rstrip("/")
    fragment = urlencode({"access_token": access, "refresh_token": refresh})
    return RedirectResponse(f"{frontend_base}/sso-callback#{fragment}", status_code=302)
