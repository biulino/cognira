"""One-off script: add multi-grid (SecaoGrelha + CriterioGrelha) to existing seeded data.

Run with:
    cd /app && PYTHONPATH=/app python -m app.patch_grids
"""
import asyncio
from sqlalchemy import select, update
from app.database import async_session, engine
from app.models.evaluation import Grelha, SecaoGrelha, CriterioGrelha
from app.models.study import Estudo
from app.models.visit import Visita
from app.seed import MULTI_GRID_CONFIG, STUDY_VISIT_TYPES

# Map study name fragment → seed slug
STUDY_NAME_MAP = {
    "Vodafone": "vodafone",
    "NOS": "nos",
    "McDonald": "mcdonalds",
    "Galp": "galp",
    "FNAC": "fnac",
}


def slug_for_study(nome: str) -> str | None:
    for fragment, slug in STUDY_NAME_MAP.items():
        if fragment in nome:
            return slug
    return None


async def patch():
    async with async_session() as db:
        # ── 1. Load existing studies ─────────────────────────────────────────
        result = await db.execute(select(Estudo))
        estudos = result.scalars().all()

        grids_by_slug: dict[str, dict[str, Grelha]] = {}

        for estudo in estudos:
            slug = slug_for_study(estudo.nome)
            if slug is None:
                print(f"  ⚠ Study '{estudo.nome}' has no slug mapping, skipping")
                continue

            # ── 2. Load or create grids for this study ───────────────────────
            existing = (await db.execute(
                select(Grelha).where(Grelha.estudo_id == estudo.id)
            )).scalars().all()

            # If grids already have sections skip (already patched)
            secoes_exist = False
            for g in existing:
                secs = (await db.execute(
                    select(SecaoGrelha).where(SecaoGrelha.grelha_id == g.id)
                )).scalars().all()
                if secs:
                    secoes_exist = True
                    break

            if secoes_exist:
                print(f"  ✓ Study '{estudo.nome}' already has grid sections, skipping")
                # Still populate grids_by_slug for visit patching
                for g in existing:
                    grids_by_slug.setdefault(slug, {})[g.tipo_visita or "presencial"] = g
                continue

            multi_cfg = MULTI_GRID_CONFIG.get(slug)
            if not multi_cfg:
                print(f"  ⚠ No MULTI_GRID_CONFIG for slug '{slug}', skipping")
                continue

            print(f"  🔧 Patching study '{estudo.nome}' (slug={slug})")
            grids_by_slug[slug] = {}

            # Match existing grids to config by index, create new ones as needed
            for idx, cfg in enumerate(multi_cfg):
                tipo = cfg["tipo_visita"]
                nome = cfg["nome"]

                if idx < len(existing):
                    # Update the existing grid
                    grid = existing[idx]
                    grid.nome = nome
                    grid.tipo_visita = tipo
                    db.add(grid)
                    print(f"    Updated grelha id={grid.id} → nome='{nome}', tipo='{tipo}'")
                else:
                    # Create a new grid
                    grid = Grelha(estudo_id=estudo.id, nome=nome, versao=1, tipo_visita=tipo)
                    db.add(grid)
                    await db.flush()
                    print(f"    Created new grelha id={grid.id} → nome='{nome}', tipo='{tipo}'")

                grids_by_slug[slug][tipo] = grid

                # ── Create sections and criteria ──────────────────────────────
                for sec_order, sec_cfg in enumerate(cfg["secoes"], start=1):
                    secao = SecaoGrelha(
                        grelha_id=grid.id,
                        nome=sec_cfg["nome"],
                        ordem=sec_order,
                        peso_secao=sec_cfg["peso"] / 100.0,
                    )
                    db.add(secao)
                    await db.flush()

                    for crit_order, (label, peso) in enumerate(sec_cfg["criterios"], start=1):
                        crit = CriterioGrelha(
                            grelha_id=grid.id,
                            secao_id=secao.id,
                            label=label,
                            peso=peso / 100.0,
                            tipo="boolean",
                            ordem=crit_order,
                        )
                        db.add(crit)

                await db.flush()
                print(f"      Added {len(cfg['secoes'])} sections")

        await db.commit()
        print("  ✓ Grids commit done")

        # ── 3. Patch visitas: update tipo_visita + assign grelha_id ─────────
        print("\n🔧 Patching visitas tipo_visita and grelha_id …")

        for estudo in estudos:
            slug = slug_for_study(estudo.nome)
            if not slug or slug not in grids_by_slug:
                continue

            visit_types = STUDY_VISIT_TYPES.get(slug, ["presencial"])
            slug_grids = grids_by_slug[slug]

            visits = (await db.execute(
                select(Visita).where(Visita.estudo_id == estudo.id)
            )).scalars().all()

            updated = 0
            for i, visita in enumerate(visits):
                new_tipo = visit_types[i % len(visit_types)]
                grid = slug_grids.get(new_tipo) or slug_grids.get("presencial") or next(iter(slug_grids.values()))
                visita.tipo_visita = new_tipo
                visita.grelha_id = grid.id
                updated += 1

            await db.flush()
            print(f"  Study '{estudo.nome}': patched {updated} visits")

        await db.commit()
        print("\n✅ patch_grids complete!")


if __name__ == "__main__":
    asyncio.run(patch())
