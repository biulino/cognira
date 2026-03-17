"""Unit tests for MIME detection logic in fotos router."""
import pytest

from app.routers.fotos import _detect_mime


# ── Known magic bytes ─────────────────────────────────────────────────────────

def _jpeg() -> bytes:
    return b"\xff\xd8\xff" + b"\x00" * 20


def _png() -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 20


def _webp() -> bytes:
    return b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 20


def _wav() -> bytes:
    return b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 20


def _heic() -> bytes:
    # HEIF / ftyp box
    return b"\x00\x00\x00\x18" + b"ftyp" + b"heic" + b"\x00" * 20


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_detect_jpeg() -> None:
    assert _detect_mime(_jpeg()) == "image/jpeg"


def test_detect_png() -> None:
    assert _detect_mime(_png()) == "image/png"


def test_detect_webp() -> None:
    assert _detect_mime(_webp()) == "image/webp"


def test_wav_not_detected_as_webp() -> None:
    """RIFF header with WAVE marker must NOT be accepted as WebP (previous bug)."""
    assert _detect_mime(_wav()) is None


def test_detect_heic() -> None:
    assert _detect_mime(_heic()) == "image/heic"


def test_unknown_returns_none() -> None:
    assert _detect_mime(b"garbage data here 123456") is None


def test_too_short_returns_none() -> None:
    # Less than 3 bytes — can't match any magic
    assert _detect_mime(b"\xff\xd8") is None
    assert _detect_mime(b"") is None
