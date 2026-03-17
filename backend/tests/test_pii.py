"""Unit tests for PII encryption service (no DB required)."""
import pytest
from cryptography.fernet import Fernet

from app.services.pii import encrypt, decrypt


# ── Helpers ────────────────────────────────────────────────────────────────

SAMPLES = [
    "Ana Silva",
    "ana.silva@email.pt",
    "912345001",
    "123456789",
    "PT50000201231234567890154",
    "Rua das Flores 12, 3º Dto, 1200-100 Lisboa",
]


# ── Encrypt / Decrypt round-trip ────────────────────────────────────────────

@pytest.mark.parametrize("plaintext", SAMPLES)
def test_encrypt_decrypt_roundtrip(plaintext: str) -> None:
    """encrypt() then decrypt() returns the original string."""
    ciphertext = encrypt(plaintext)
    assert isinstance(ciphertext, bytes)
    assert ciphertext != plaintext.encode("utf-8"), "Ciphertext must differ from plaintext"
    assert decrypt(ciphertext) == plaintext


def test_encrypt_empty_string() -> None:
    assert encrypt("") == b""


def test_decrypt_empty_bytes() -> None:
    assert decrypt(b"") == ""


# ── Fernet ciphertext is not valid UTF-8 plaintext ──────────────────────────

def test_encrypted_bytes_are_not_plain_utf8() -> None:
    ciphertext = encrypt("NIF: 123456789")
    # Trying to decode Fernet ciphertext as plain UTF-8 would give garbage
    as_utf8 = ciphertext.decode("latin-1")  # won't error (any byte sequence)
    assert "NIF: 123456789" not in as_utf8, "Ciphertext must not expose plaintext"


# ── Legacy fallback (plaintext bytes stored before encryption) ───────────────

def test_decrypt_legacy_plaintext_bytes() -> None:
    """decrypt() falls back gracefully for data stored before encryption."""
    legacy = b"Bruno Costa"
    assert decrypt(legacy) == "Bruno Costa"


def test_decrypt_legacy_bytes_from_seed() -> None:
    """Simulates the seed pattern: text.encode('utf-8') stored before encryption."""
    legacy = "PT50000201231234567890155".encode("utf-8")
    assert decrypt(legacy) == "PT50000201231234567890155"


# ── Different keys produce different ciphertexts (Fernet uses random IV) ─────

def test_same_plaintext_different_ciphertexts() -> None:
    """Fernet uses random IV so same input -> different ciphertext each time."""
    c1 = encrypt("test@example.com")
    c2 = encrypt("test@example.com")
    assert c1 != c2


# ── Wrong key cannot decrypt ─────────────────────────────────────────────────

def test_wrong_key_fails_gracefully() -> None:
    """decrypt() with wrong key falls back to raw bytes decode."""
    wrong_fernet = Fernet(Fernet.generate_key())
    ciphertext = wrong_fernet.encrypt(b"secret data")
    # decrypt() tries the configured key, fails, falls back to raw decode
    result = decrypt(ciphertext)
    # Result won't be "secret data" but also won't raise
    assert isinstance(result, str)


# ── bytearray input ──────────────────────────────────────────────────────────

def test_decrypt_accepts_bytearray() -> None:
    ct = encrypt("João Almeida")
    assert decrypt(bytearray(ct)) == "João Almeida"
