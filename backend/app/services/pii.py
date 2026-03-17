"""Application-layer PII encryption using Fernet (AES-128-CBC + HMAC-SHA256).

Usage:
  from app.services import pii
  encrypted = pii.encrypt("123456789")      # -> bytes
  plain     = pii.decrypt(encrypted)         # -> "123456789"
  plain     = pii.decrypt(b"legacy plain")   # fallback -> "legacy plain"

Key management:
  Generate a key: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  Set PII_KEY in .env (or env var) before deploying to production.
  The default key is for development only — NEVER use in production.
"""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken


# Dev-only key — override with PII_KEY environment variable in production.
_DEV_KEY = "sq_0y0PwkiN4128WdCBp-fhcEt6yixa94SFcNaCKK8s="
_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        from app.config import get_settings
        key = get_settings().pii_key or _DEV_KEY
        _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet_instance


def reset() -> None:
    """Reset the cached Fernet instance (e.g. after key rotation)."""
    global _fernet_instance
    _fernet_instance = None


def encrypt(plaintext: str) -> bytes:
    """Encrypt a plaintext string to Fernet ciphertext bytes."""
    if not plaintext:
        return b""
    return _get_fernet().encrypt(plaintext.encode("utf-8"))


def decrypt(data: bytes | bytearray) -> str:
    """Decrypt Fernet ciphertext bytes to string.
    Falls back to plain UTF-8 decode for legacy records stored before encryption."""
    if not data:
        return ""
    raw = bytes(data)
    try:
        return _get_fernet().decrypt(raw).decode("utf-8")
    except (InvalidToken, Exception):
        # Legacy: data stored as plain UTF-8 before encryption was enabled
        return raw.decode("utf-8", errors="replace")


_PII_PATTERNS = [
    (r'\b\d{9}\b', '[NIF]'),                               # NIF português
    (r'\bPT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b', '[IBAN]'),  # IBAN PT
    (r'\b(?:\+351)?[29]\d{8}\b', '[TELEF]'),              # telefónes PT
    (r'\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b', '[EMAIL]'),       # email
]
_COMPILED = None


def redact(text: str) -> str:
    """Replace common Portuguese PII patterns in free-text with placeholders."""
    global _COMPILED
    import re
    if _COMPILED is None:
        _COMPILED = [(re.compile(p, re.IGNORECASE), repl) for p, repl in _PII_PATTERNS]
    for pattern, repl in _COMPILED:
        text = pattern.sub(repl, text)
    return text
