"""
GET /api/status  — Deep health check for all platform subsystems.
Accessible to: admins (tenant OR superadmin). Never public.
Returns a structured JSON with per-service checks including latency.
"""
import time
import os
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import Utilizador
from app.config import get_settings

router = APIRouter()
settings = get_settings()


def _ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


async def _check_database(db: AsyncSession) -> dict[str, Any]:
    t = time.perf_counter()
    try:
        result = await db.execute(text("SELECT version()"))
        version = result.scalar() or "unknown"
        return {"ok": True, "latency_ms": _ms(t), "detail": version.split(" ")[0] + " " + version.split(" ")[1] if " " in version else version}
    except Exception as exc:
        return {"ok": False, "latency_ms": _ms(t), "detail": str(exc)}


async def _check_minio() -> dict[str, Any]:
    t = time.perf_counter()
    try:
        from app.services.storage import get_minio
        client = get_minio()
        buckets = client.list_buckets()
        return {"ok": True, "latency_ms": _ms(t), "detail": f"{len(buckets)} bucket(s)"}
    except Exception as exc:
        return {"ok": False, "latency_ms": _ms(t), "detail": str(exc)}


async def _check_clamav() -> dict[str, Any]:
    t = time.perf_counter()
    try:
        import clamd
        cd = clamd.ClamdUnixSocket()
        ping = cd.ping()
        return {"ok": ping == "PONG", "latency_ms": _ms(t), "detail": ping}
    except Exception:
        # Try TCP fallback
        try:
            import clamd
            cd = clamd.ClamdNetworkSocket(host="clamav", port=3310, timeout=5)
            ping = cd.ping()
            return {"ok": ping == "PONG", "latency_ms": _ms(t), "detail": ping}
        except Exception as exc:
            return {"ok": False, "latency_ms": _ms(t), "detail": str(exc)}


async def _check_ai_providers(db: AsyncSession) -> dict[str, Any]:
    t = time.perf_counter()
    try:
        from sqlalchemy import select as _select
        from app.models.modulo import AIProvider  # type: ignore[attr-defined]
        rows = (await db.execute(
            _select(AIProvider).where(AIProvider.enabled.is_(True))  # type: ignore[attr-defined]
        )).scalars().all()
        count = len(rows)
        return {"ok": count > 0, "latency_ms": _ms(t), "detail": f"{count} provider(s) activo(s)"}
    except Exception:
        # Model may not exist yet — treat as unknown
        return {"ok": None, "latency_ms": _ms(t), "detail": "Não configurado"}


async def _check_pgvector(db: AsyncSession) -> dict[str, Any]:
    t = time.perf_counter()
    try:
        result = await db.execute(text("SELECT extversion FROM pg_extension WHERE extname='vector'"))
        row = result.scalar_one_or_none()
        if row:
            return {"ok": True, "latency_ms": _ms(t), "detail": f"pgvector {row}"}
        return {"ok": False, "latency_ms": _ms(t), "detail": "Extensão não encontrada"}
    except Exception as exc:
        return {"ok": False, "latency_ms": _ms(t), "detail": str(exc)}


@router.get("/status")
async def platform_status(
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
):
    """
    Full system health check. Returns one entry per subsystem with:
    - ok: True | False | None (None = not configured / irrelevant)
    - latency_ms: round-trip time in milliseconds
    - detail: human-readable detail string
    """
    db_check, minio_check, clamav_check, pgvector_check, ai_check = (
        await _check_database(db),
        await _check_minio(),
        await _check_clamav(),
        await _check_pgvector(db),
        await _check_ai_providers(db),
    )

    checks = [
        {"id": "database",   "label": "Base de Dados",    "icon": "🗄️",  **db_check},
        {"id": "pgvector",   "label": "pgvector (RAG)",   "icon": "🧠",  **pgvector_check},
        {"id": "storage",    "label": "Object Storage",   "icon": "🪣",  **minio_check},
        {"id": "antivirus",  "label": "ClamAV",           "icon": "🛡️",  **clamav_check},
        {"id": "ai",         "label": "AI Providers",     "icon": "🤖",  **ai_check},
    ]

    all_ok = all(c["ok"] is not False for c in checks)

    return {
        "status": "healthy" if all_ok else "degraded",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("ENVIRONMENT", "production"),
        "checks": checks,
    }
