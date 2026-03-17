"""Standalone call center seed for environments that already have the main dataset."""

import asyncio

from sqlalchemy import select

from app.database import async_session, engine
from app.models import Base, Cliente, Estudo, Utilizador
from app.seed import ensure_callcenter_config, seed_callcenter_only


CLIENT_SLUG_HINTS = {
    "vodafone": "Vodafone",
    "nos": "NOS",
    "mcdonalds": "McDonald's",
    "galp": "Galp",
    "fnac": "FNAC",
}


async def seed_callcenter():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        clientes = (await db.execute(select(Cliente))).scalars().all()
        if not clientes:
            print("✗ No clients found. Run the main seed first: python -m app.seed")
            return

        estudos = (await db.execute(select(Estudo))).scalars().all()
        admin = (await db.execute(select(Utilizador).where(Utilizador.username == "admin"))).scalar_one_or_none()
        if admin is None:
            print("✗ Admin user not found. Run the main seed first: python -m app.seed")
            return

        client_by_slug = {}
        for slug, hint in CLIENT_SLUG_HINTS.items():
            matched = next((client for client in clientes if hint.lower() in client.nome.lower()), None)
            if matched is not None:
                client_by_slug[slug] = matched

        missing = [slug for slug in CLIENT_SLUG_HINTS if slug not in client_by_slug]
        if missing:
            print(f"✗ Missing required clients for call center seed: {', '.join(missing)}")
            return

        study_by_slug = {}
        for slug, client in client_by_slug.items():
            matched_study = next((study for study in estudos if study.cliente_id == client.id), None)
            if matched_study is None:
                print(f"✗ No study found for client {client.nome}. Run the main seed first.")
                return
            study_by_slug[slug] = matched_study

        await ensure_callcenter_config(db)
        template_count, call_count = await seed_callcenter_only(db, client_by_slug, study_by_slug, admin)
        await db.commit()

        print("=" * 58)
        print("  CALL CENTER SEED COMPLETO")
        print("=" * 58)
        print(f"  Templates disponíveis: {template_count}")
        print(f"  Chamadas disponíveis:  {call_count}")
        print("=" * 58)


if __name__ == "__main__":
    asyncio.run(seed_callcenter())
