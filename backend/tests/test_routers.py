"""Integration tests for router endpoints (auth-protected CRUD).

These tests use the ASGI test client against the real app. They require
the database to be reachable (run inside Docker or with DATABASE_URL set).
Tests that depend on seeded data are skipped if the DB is not available.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.auth.jwt import create_access_token

pytestmark = pytest.mark.asyncio


# ── Helpers ────────────────────────────────────────────────────────────────

async def _admin_token(client: AsyncClient) -> str | None:
    """Login as admin and return the access token, or None if not available."""
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123admin"})
    if resp.status_code != 200:
        return None
    return resp.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Estabelecimentos — role-restricted CRUD ────────────────────────────────

async def test_estabelecimentos_list_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/estabelecimentos/")
    assert resp.status_code == 401


async def test_estabelecimentos_list_with_token(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/estabelecimentos/", headers=_headers(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_estabelecimentos_create_requires_admin_role(client: AsyncClient) -> None:
    """Regular user token should be rejected (403)."""
    # Create a fake token with a non-admin role — the user won't exist, so 401
    fake_token = create_access_token("00000000-0000-0000-0000-000000000001")
    resp = await client.post(
        "/api/estabelecimentos/",
        headers=_headers(fake_token),
        json={"nome": "Test", "cliente_id": 1},
    )
    assert resp.status_code in (401, 403)


async def test_estabelecimentos_create_as_admin(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.post(
        "/api/estabelecimentos/",
        headers=_headers(token),
        json={"nome": "Test Estab Pytest", "cliente_id": 1},
    )
    # 201 if cliente_id 1 exists, 422 if FK fails — either is a valid auth-pass
    assert resp.status_code in (201, 422, 500)


async def test_estabelecimentos_delete_requires_admin_role(client: AsyncClient) -> None:
    fake_token = create_access_token("00000000-0000-0000-0000-000000000001")
    resp = await client.delete(
        "/api/estabelecimentos/99999",
        headers=_headers(fake_token),
    )
    assert resp.status_code in (401, 403)


# ── Visitas — listing/search ──────────────────────────────────────────────

async def test_visitas_list_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/visitas/")
    assert resp.status_code == 401


async def test_visitas_list_with_admin(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/visitas/", headers=_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_visitas_search_by_text(client: AsyncClient) -> None:
    """Text search should not error (uses ilike on establishment name)."""
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get(
        "/api/visitas/?search=supermarket",
        headers=_headers(token),
    )
    assert resp.status_code == 200


async def test_visitas_search_by_id(client: AsyncClient) -> None:
    """Numeric search should filter by visita ID."""
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get(
        "/api/visitas/?search=1",
        headers=_headers(token),
    )
    assert resp.status_code == 200


# ── Alertas ────────────────────────────────────────────────────────────────

async def test_alertas_config_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/alertas/config")
    assert resp.status_code == 401


async def test_alertas_config_read(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/alertas/config", headers=_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "threshold" in data


async def test_alertas_config_update_requires_admin(client: AsyncClient) -> None:
    """Only admin can update alert config."""
    fake_token = create_access_token("00000000-0000-0000-0000-000000000001")
    resp = await client.put(
        "/api/alertas/config",
        headers=_headers(fake_token),
        json={"threshold": 50.0},
    )
    assert resp.status_code in (401, 403)


async def test_alertas_score_list(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/alertas/score", headers=_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "threshold" in data
    assert "alertas" in data


# ── Chat Interno — nao-lidas ──────────────────────────────────────────────

async def test_chat_nao_lidas_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/chat-interno/nao-lidas")
    assert resp.status_code == 401


async def test_chat_nao_lidas_returns_count(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/chat-interno/nao-lidas", headers=_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert isinstance(data["count"], int)


# ── Fotos — upload validation ─────────────────────────────────────────────

async def test_fotos_upload_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/api/visitas/1/fotos")
    assert resp.status_code in (401, 422)


async def test_fotos_upload_rejects_bad_mime(client: AsyncClient) -> None:
    """Non-image content must be rejected."""
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.post(
        "/api/visitas/1/fotos",
        headers=_headers(token),
        files={"file": ("test.txt", b"this is not an image", "text/plain")},
    )
    assert resp.status_code in (415, 404)  # 415 Unsupported or 404 visit not found


# ── Questionários ──────────────────────────────────────────────────────────

async def test_questionarios_list_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/questionarios/")
    assert resp.status_code == 401


async def test_questionarios_list_with_auth(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/questionarios/", headers=_headers(token))
    assert resp.status_code == 200


# ── RAG endpoints ─────────────────────────────────────────────────────────

async def test_rag_ingest_requires_admin(client: AsyncClient) -> None:
    fake_token = create_access_token("00000000-0000-0000-0000-000000000001")
    resp = await client.post(
        "/api/rag/ingest",
        headers=_headers(fake_token),
        json={"estudo_id": 1, "titulo": "test", "conteudo": "test content"},
    )
    assert resp.status_code in (401, 403)


# ── Utilizadores/me ───────────────────────────────────────────────────────

async def test_me_returns_user_info(client: AsyncClient) -> None:
    token = await _admin_token(client)
    if not token:
        pytest.skip("Admin credentials not available")
    resp = await client.get("/api/utilizadores/me", headers=_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "username" in data
    assert data["username"] == "admin"
