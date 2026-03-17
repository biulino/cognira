"""pytest configuration — async test support with HTTPX + SQLite in-memory DB."""
import pytest
import asyncio
from typing import AsyncGenerator

from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the whole test session (pytest-asyncio)."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTPX client targeting the FastAPI ASGI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
