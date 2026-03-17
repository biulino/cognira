"""PII Key Rotation Script
==========================
Run this ONCE after rotating PII_KEY in .env to re-encrypt all PII fields
that were encrypted with the old (dev default) key.

Usage:
    OLD_PII_KEY=sq_0y0PwkiN4128WdCBp-fhcEt6yixa94SFcNaCKK8s= \
    python3 backend/scripts/reencrypt_pii.py

The script reads OLD_PII_KEY from the environment and new key from .env / PII_KEY.
It re-encrypts fields in:
  - utilizadores: email, totp_secret, backup_codes
  - analistas: nome, email, telefone, nif, iban, morada, data_nascimento
  - candidaturas_recrutamento: nome, email, telefone, nif, iban, morada, data_nascimento
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
import app.models  # noqa: F401 — registers all SQLAlchemy models
from app.models.user import Utilizador
from app.models.analyst import Analista, CandidaturaRecrutamento  # noqa: F401

OLD_KEY_STR = os.environ.get("OLD_PII_KEY", "sq_0y0PwkiN4128WdCBp-fhcEt6yixa94SFcNaCKK8s=")


def _old_fernet() -> Fernet:
    return Fernet(OLD_KEY_STR.encode())


def _new_fernet() -> Fernet:
    settings = get_settings()
    return Fernet(settings.pii_key.encode())


def _reencrypt_field(data: bytes | None, old_f: Fernet, new_f: Fernet) -> bytes | None:
    """Decrypt with old key, re-encrypt with new key. Handles None and plain-text legacy values."""
    if not data:
        return data
    raw = bytes(data)
    try:
        plaintext = old_f.decrypt(raw)
    except (InvalidToken, Exception):
        # Not encrypted by old key — might be plain text or already new-key encrypted
        try:
            new_f.decrypt(raw)
            return data  # already encrypted with new key
        except Exception:
            # treat as plain UTF-8 legacy value
            plaintext = raw
    return new_f.encrypt(plaintext)


async def main():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    old_f = _old_fernet()
    new_f = _new_fernet()

    if old_f._signing_key == new_f._signing_key:
        print("OLD_PII_KEY and new PII_KEY are the same — nothing to do.")
        return

    async with async_session() as session:
        # ── Utilizadores ────────────────────────────────────────────────────────
        result = await session.execute(select(Utilizador))
        users = result.scalars().all()
        updated_users = 0
        for user in users:
            changed = False
            for field in ("email", "totp_secret", "backup_codes"):
                val = getattr(user, field, None)
                if val:
                    new_val = _reencrypt_field(val, old_f, new_f)
                    if new_val != val:
                        setattr(user, field, new_val)
                        changed = True
            if changed:
                updated_users += 1
        await session.commit()
        print(f"Utilizadores: re-encrypted {updated_users}/{len(users)}")

        # ── Analistas ────────────────────────────────────────────────────────────
        result = await session.execute(select(Analista))
        analistas = result.scalars().all()
        updated_analistas = 0
        pii_fields = ("nome", "email", "telefone", "nif", "iban", "morada", "data_nascimento")
        for analista in analistas:
            changed = False
            for field in pii_fields:
                val = getattr(analista, field, None)
                if val:
                    new_val = _reencrypt_field(val, old_f, new_f)
                    if new_val != val:
                        setattr(analista, field, new_val)
                        changed = True
            if changed:
                updated_analistas += 1
        await session.commit()
        print(f"Analistas: re-encrypted {updated_analistas}/{len(analistas)}")

        # ── Candidaturas ─────────────────────────────────────────────────────────
        try:
            result = await session.execute(select(CandidaturaRecrutamento))
            candidaturas = result.scalars().all()
            updated_cands = 0
            cand_fields = ("nome", "email", "telefone", "nif", "iban", "morada", "data_nascimento")
            for cand in candidaturas:
                changed = False
                for field in cand_fields:
                    val = getattr(cand, field, None)
                    if val:
                        new_val = _reencrypt_field(val, old_f, new_f)
                        if new_val != val:
                            setattr(cand, field, new_val)
                            changed = True
                if changed:
                    updated_cands += 1
            await session.commit()
            print(f"Candidaturas: re-encrypted {updated_cands}/{len(candidaturas)}")
        except Exception as e:
            print(f"Candidaturas: skipped ({e})")

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
