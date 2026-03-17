#!/usr/bin/env python3
"""
promote_superadmin.py — Promote an existing user to super-admin.

Usage (inside docker):
  docker exec estudos-mercado-backend-1 python /app/promote_superadmin.py admin

Or directly:
  python promote_superadmin.py <username>
"""
import asyncio
import sys
from sqlalchemy import select, update
from app.database import engine
from app.models.user import Utilizador
import app.models.tenant  # noqa: F401 — registers Tenant in mapper so Utilizador.tenant relationship resolves


async def promote(username: str) -> None:
    async with engine.begin() as conn:
        result = await conn.execute(
            select(Utilizador.id, Utilizador.username, Utilizador.is_superadmin)
            .where(Utilizador.username == username)
        )
        row = result.one_or_none()
        if not row:
            print(f"❌ Utilizador '{username}' não encontrado.")
            return
        if row.is_superadmin:
            print(f"ℹ️  '{username}' já é super-admin.")
            return
        await conn.execute(
            update(Utilizador)
            .where(Utilizador.username == username)
            .values(is_superadmin=True)
        )
    print(f"✅ '{username}' é agora super-admin. Faça login e aceda a /super-admin")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python promote_superadmin.py <username>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))
