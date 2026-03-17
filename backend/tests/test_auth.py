"""Integration tests for auth endpoints (login, token refresh, 2FA).

These tests use the ASGI test client and expect the real database to be
accessible (running inside docker or with DATABASE_URL set). They are skipped
automatically when the DB is not reachable.
"""
import pytest
import pytest_asyncio

from httpx import AsyncClient

from app.auth.jwt import create_access_token, create_refresh_token


pytestmark = pytest.mark.asyncio


# ── Helpers ────────────────────────────────────────────────────────────────

async def _login(client: AsyncClient, username: str, password: str) -> dict:
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    return resp


# ── Login ──────────────────────────────────────────────────────────────────

async def test_login_invalid_credentials(client: AsyncClient) -> None:
    resp = await _login(client, "nobody", "wrong_password")
    assert resp.status_code == 401


async def test_login_missing_fields(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/login", json={"username": "admin"})
    assert resp.status_code == 422  # validation error


async def test_login_empty_password(client: AsyncClient) -> None:
    resp = await _login(client, "admin", "")
    assert resp.status_code in (401, 422)


# ── Admin login & protected endpoint ───────────────────────────────────────

async def test_admin_login_and_me(client: AsyncClient) -> None:
    """admin:admin123admin should login and reach /api/utilizadores/me."""
    resp = await _login(client, "admin", "admin123admin")
    if resp.status_code != 200:
        pytest.skip("Admin credentials not available in this environment")

    data = resp.json()
    assert "access_token" in data
    token = data["access_token"]

    me = await client.get("/api/utilizadores/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


async def test_protected_endpoint_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/analistas/")
    assert resp.status_code == 401


async def test_protected_endpoint_invalid_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/analistas/",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


# ── Refresh token ──────────────────────────────────────────────────────────

async def test_refresh_with_invalid_token(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/refresh", json={"refresh_token": "not.a.real.token"})
    assert resp.status_code in (401, 422)


# ── Security: 2FA bypass prevention ───────────────────────────────────────

async def test_pending_2fa_token_rejected(client: AsyncClient) -> None:
    """A token with pending_2fa=True must NOT grant access to protected endpoints."""
    # Use a fake user ID — even if the user existed, the pending_2fa flag should block
    token = create_access_token("00000000-0000-0000-0000-000000000000", extra={"pending_2fa": True})
    resp = await client.get("/api/utilizadores/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ── Security: refresh token as access token ────────────────────────────────

async def test_refresh_token_cannot_access_protected_endpoints(client: AsyncClient) -> None:
    """A refresh token must NOT be accepted as an access token on protected endpoints."""
    token = create_refresh_token("00000000-0000-0000-0000-000000000000")
    resp = await client.get("/api/utilizadores/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ── Security: valid access token for non-existent user ─────────────────────

async def test_valid_token_nonexistent_user(client: AsyncClient) -> None:
    """A valid JWT for a non-existent user must return 401."""
    token = create_access_token("00000000-0000-0000-0000-000000000099", extra={"role": "admin"})
    resp = await client.get("/api/utilizadores/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ── /auth/me/context ───────────────────────────────────────────────────────

async def test_me_context_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/me/context")
    assert resp.status_code == 401


async def test_me_context_invalid_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/auth/me/context",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


async def test_me_context_pending_2fa_blocked(client: AsyncClient) -> None:
    """A pending-2FA token must NOT grant access to /me/context."""
    token = create_access_token("00000000-0000-0000-0000-000000000000", extra={"pending_2fa": True})
    resp = await client.get("/api/auth/me/context", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_me_context_returns_expected_shape(client: AsyncClient) -> None:
    """With valid credentials, /me/context returns user + nav + unread keys."""
    resp = await _login(client, "admin", "admin123admin")
    if resp.status_code != 200:
        pytest.skip("Admin credentials not available in this environment")

    token = resp.json()["access_token"]
    ctx = await client.get("/api/auth/me/context", headers={"Authorization": f"Bearer {token}"})
    assert ctx.status_code == 200
    data = ctx.json()
    assert "user" in data
    assert "nav" in data
    assert "unread" in data
    # user sub-object must contain these keys
    user_obj = data["user"]
    for key in ("id", "username", "role_global", "activo"):
        assert key in user_obj, f"Missing key: {key}"
    # nav must be a dict keyed by role
    assert isinstance(data["nav"], dict)
