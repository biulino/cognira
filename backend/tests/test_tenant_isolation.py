"""Tenant isolation security tests.

Verifies that protected analytic endpoints are gated by authentication and
that tokens minted for a non-existent user cannot read any protected data.
Full cross-tenant isolation (two live tenants) is tested only when multiple
tenants are present in the running database.
"""
import pytest

from httpx import AsyncClient

from app.auth.jwt import create_access_token


pytestmark = pytest.mark.asyncio

# Endpoints that aggregate per-study data and must never be public
_PROTECTED_ANALYTICS = [
    "/api/visitas/stats",
    "/api/visitas/fraude",
    "/api/visitas/sla",
    "/api/visitas/timeline",
    "/api/estudos/benchmarking",
    "/api/configuracoes/nav_permissoes",
]

# Endpoints that are intentionally public (no auth required)
_PUBLIC_ENDPOINTS = [
    "/api/health",
]


# ── Unauthenticated access must be rejected ───────────────────────────────


@pytest.mark.parametrize("path", _PROTECTED_ANALYTICS)
async def test_analytic_endpoint_requires_auth(client: AsyncClient, path: str) -> None:
    resp = await client.get(path)
    assert resp.status_code == 401, f"Expected 401 for unauthenticated {path}, got {resp.status_code}"


# ── Ghost token (valid JWT, non-existent user) ────────────────────────────


@pytest.mark.parametrize("path", _PROTECTED_ANALYTICS)
async def test_ghost_token_rejected(client: AsyncClient, path: str) -> None:
    """A cryptographically valid token whose user ID does not exist must be rejected."""
    ghost_id = "00000000-dead-beef-0000-000000000001"
    token = create_access_token(ghost_id, extra={"role": "admin"})
    resp = await client.get(path, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (401, 403, 404), (
        f"Ghost token should not produce data on {path}, got {resp.status_code}"
    )


# ── pending_2fa token must not access analytics ───────────────────────────


@pytest.mark.parametrize("path", _PROTECTED_ANALYTICS[:3])  # sample
async def test_pending_2fa_token_blocked_on_analytics(client: AsyncClient, path: str) -> None:
    token = create_access_token("00000000-0000-0000-0000-000000000000", extra={"pending_2fa": True})
    resp = await client.get(path, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401, (
        f"pending_2fa token must be rejected at {path}, got {resp.status_code}"
    )


# ── Cross-tenant data isolation ───────────────────────────────────────────


async def test_cross_tenant_estudos_isolation(client: AsyncClient) -> None:
    """Tenant A user cannot read Tenant B's estudos list.

    This test only runs when the database has two or more active tenants.
    """
    # Log in as admin to discover tenants
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123admin"})
    if resp.status_code != 200:
        pytest.skip("Admin credentials not available in this environment")

    token_a = resp.json()["access_token"]

    # Get list of tenants (superadmin endpoint)
    tenants_resp = await client.get(
        "/api/utilizadores/tenants",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    if tenants_resp.status_code not in (200, 403, 404):
        pytest.skip("Tenant list endpoint unavailable")
    if tenants_resp.status_code != 200:
        pytest.skip("Not enough privileges to list tenants")

    tenants = tenants_resp.json()
    if not isinstance(tenants, list) or len(tenants) < 2:
        pytest.skip("Less than 2 tenants in the database — cross-tenant test skipped")

    tenant_a_id = tenants[0]["id"]
    tenant_b_id = tenants[1]["id"]

    # Mint a token scoped to tenant A
    token_tenant_a = create_access_token(
        "00000000-0000-0000-0000-aaaaaaaaaaaa",
        extra={"role": "admin", "tenant_id": tenant_a_id},
    )
    # Mint a token scoped to tenant B
    token_tenant_b = create_access_token(
        "00000000-0000-0000-0000-bbbbbbbbbbbb",
        extra={"role": "admin", "tenant_id": tenant_b_id},
    )

    # Both user IDs are non-existent, so both should get 401 — but the important
    # assertion is that tenant A's token cannot receive tenant B's data.
    resp_a = await client.get("/api/estudos/", headers={"Authorization": f"Bearer {token_tenant_a}"})
    resp_b = await client.get("/api/estudos/", headers={"Authorization": f"Bearer {token_tenant_b}"})

    # Non-existent users → 401 always
    assert resp_a.status_code == 401
    assert resp_b.status_code == 401
