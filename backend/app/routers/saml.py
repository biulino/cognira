"""SAML 2.0 Service Provider endpoints (python3-saml / OneLogin toolkit).

Endpoints
---------
GET  /api/auth/saml/metadata  — SP metadata XML (public, used by IdP admin)
GET  /api/auth/saml/login     — initiate SP-initiated SSO (redirect binding)
POST /api/auth/saml/acs       — Assertion Consumer Service (IdP POST binding)
GET  /api/auth/saml/acs       — Assertion Consumer Service (IdP Redirect binding)
POST /api/auth/saml/slo       — Single Logout (optional)

Configuration (environment variables / .env)
--------------------------------------------
SAML_ENABLED=true
SAML_IDP_ENTITY_ID=https://idp.example.com/metadata
SAML_IDP_SSO_URL=https://idp.example.com/sso/post
SAML_IDP_CERT=<base64 X.509 DER, no PEM headers>
SAML_SP_ENTITY_ID=https://app.example.com/api/auth/saml/metadata
SAML_SP_ACS_URL=https://app.example.com/api/auth/saml/acs
SAML_SP_CERT=<optional SP cert>
SAML_SP_KEY=<optional SP key for signed auth requests>
SAML_DEFAULT_ROLE=utilizador
"""
from __future__ import annotations

import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.config import get_settings
from app.database import get_db
from app.models.user import Utilizador
from app.services import pii
from app.auth.jwt import hash_password
from app.edition import require_pro

settings = get_settings()
router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _saml_settings() -> dict:
    """Build the python3-saml settings dict from the app config."""
    sp: dict = {
        "entityId": settings.saml_sp_entity_id or settings.saml_sp_acs_url,
        "assertionConsumerService": {
            "url": settings.saml_sp_acs_url,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        },
    }
    if settings.saml_sp_slo_url:
        sp["singleLogoutService"] = {
            "url": settings.saml_sp_slo_url,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        }
    if settings.saml_sp_cert:
        sp["x509cert"] = settings.saml_sp_cert
    if settings.saml_sp_key:
        sp["privateKey"] = settings.saml_sp_key

    idp: dict = {
        "entityId": settings.saml_idp_entity_id,
        "singleSignOnService": {
            "url": settings.saml_idp_sso_url,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        },
        "x509cert": settings.saml_idp_cert,
    }
    if settings.saml_idp_slo_url:
        idp["singleLogoutService"] = {
            "url": settings.saml_idp_slo_url,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        }

    return {
        "strict": True,
        "debug": False,
        "sp": sp,
        "idp": idp,
    }


def _get_auth(request: Request):
    """Return an initialised OneLogin_Saml2_Auth instance for the current request."""
    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth  # type: ignore[import-untyped]
    except ImportError:
        raise HTTPException(status_code=503, detail="python3-saml não instalado")

    req = {
        "https": "on" if request.url.scheme == "https" else "off",
        "http_host": request.headers.get("host", request.url.netloc),
        "script_name": request.url.path,
        "server_port": str(request.url.port or (443 if request.url.scheme == "https" else 80)),
        "get_data": dict(request.query_params),
        "post_data": {},  # populated in ACS handler
        "lowercase_urlencoding": True,
    }
    return OneLogin_Saml2_Auth(req, _saml_settings())


def _require_saml():
    if not settings.saml_enabled:
        raise HTTPException(status_code=404, detail="SAML não activado")


# ── SP Metadata ────────────────────────────────────────────────────────────────

@router.get("/metadata")
async def saml_metadata(request: Request):
    """Return SP metadata XML for IdP configuration."""
    _require_saml()
    auth = _get_auth(request)
    metadata = auth.get_settings().get_sp_metadata()
    errors = auth.get_settings().validate_metadata(metadata)
    if errors:
        raise HTTPException(status_code=500, detail=f"Metadata inválida: {errors}")
    return Response(content=metadata, media_type="text/xml")


# ── SP-initiated login ─────────────────────────────────────────────────────────

@router.get("/login")
async def saml_login(request: Request):
    """Redirect browser to IdP for SP-initiated SSO."""
    require_pro("sso")
    _require_saml()
    auth = _get_auth(request)
    redirect_url = auth.login()
    return RedirectResponse(redirect_url, status_code=302)


# ── Assertion Consumer Service ─────────────────────────────────────────────────

@router.post("/acs")
async def saml_acs(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Process the IdP SAML Response (POST binding)."""
    require_pro("sso")
    _require_saml()

    form = await request.form()
    post_data = dict(form)

    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth  # type: ignore[import-untyped]
    except ImportError:
        raise HTTPException(status_code=503, detail="python3-saml não instalado")

    req = {
        "https": "on" if request.url.scheme == "https" else "off",
        "http_host": request.headers.get("host", request.url.netloc),
        "script_name": request.url.path,
        "server_port": str(request.url.port or (443 if request.url.scheme == "https" else 80)),
        "get_data": dict(request.query_params),
        "post_data": post_data,
        "lowercase_urlencoding": True,
    }
    auth = OneLogin_Saml2_Auth(req, _saml_settings())
    auth.process_response()
    errors = auth.get_errors()

    if errors:
        reason = auth.get_last_error_reason() or str(errors)
        raise HTTPException(status_code=400, detail=f"SAML Response inválida: {reason}")

    if not auth.is_authenticated():
        raise HTTPException(status_code=401, detail="Autenticação SAML falhou")

    saml_name_id: str = auth.get_nameid() or ""
    attrs: dict = auth.get_attributes() or {}

    # Normalise common attribute names from different IdPs
    email_raw = ""
    for attr_name in (
        "email",
        "urn:oid:1.2.840.113549.1.9.1",  # emailAddress OID
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "mail",
    ):
        vals = attrs.get(attr_name)
        if vals:
            email_raw = str(vals[0])
            break
    if not email_raw and "@" in saml_name_id:
        email_raw = saml_name_id

    display_name = ""
    for attr_name in (
        "displayName",
        "http://schemas.microsoft.com/identity/claims/displayname",
        "cn",
        "name",
    ):
        vals = attrs.get(attr_name)
        if vals:
            display_name = str(vals[0])
            break

    preferred_username = (
        display_name
        or (email_raw.split("@")[0] if email_raw else None)
        or saml_name_id[:30]
    )

    # Provision or find the user
    result = await db.execute(select(Utilizador).where(Utilizador.sso_id == saml_name_id))
    user = result.scalar_one_or_none()

    if user is None and email_raw:
        # Try to match existing user by email (encrypted PII)
        encrypted_email = pii.encrypt(email_raw)
        result2 = await db.execute(
            select(Utilizador).where(Utilizador.email == encrypted_email)
        )
        user = result2.scalar_one_or_none()
        if user:
            user.sso_id = saml_name_id

    if user is None:
        # Auto-provision new user
        safe_username = preferred_username[:50].replace(" ", "_")
        base = safe_username
        suffix = 0
        while True:
            check = await db.execute(
                select(Utilizador).where(Utilizador.username == safe_username)
            )
            if check.scalar_one_or_none() is None:
                break
            suffix += 1
            safe_username = f"{base}_{suffix}"

        user = Utilizador(
            username=safe_username,
            email=pii.encrypt(email_raw) if email_raw else pii.encrypt(safe_username),
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role_global=settings.saml_default_role,
            activo=True,
            sso_id=saml_name_id,
        )
        db.add(user)
        await db.flush()

    if not user.activo:
        raise HTTPException(status_code=403, detail="Conta desactivada")

    await db.commit()

    access = create_access_token(str(user.id), extra={"role": user.role_global, "cliente_id": user.cliente_id})
    refresh = create_refresh_token(str(user.id))

    frontend_base = settings.frontend_url.rstrip("/")
    fragment = urlencode({"access_token": access, "refresh_token": refresh})
    return RedirectResponse(f"{frontend_base}/sso-callback#{fragment}", status_code=302)


# ── Single Logout (IdP-initiated) ─────────────────────────────────────────────

@router.post("/slo")
@router.get("/slo")
async def saml_slo(request: Request):
    """Handle IdP-initiated Single Logout Request."""
    require_pro("sso")
    _require_saml()
    auth = _get_auth(request)
    url = auth.process_slo(delete_session_cb=lambda: None)
    errors = auth.get_errors()
    if errors:
        reason = auth.get_last_error_reason() or str(errors)
        raise HTTPException(status_code=400, detail=f"SLO erro: {reason}")
    if url:
        return RedirectResponse(url, status_code=302)
    frontend_base = settings.frontend_url.rstrip("/")
    return RedirectResponse(f"{frontend_base}/login", status_code=302)
