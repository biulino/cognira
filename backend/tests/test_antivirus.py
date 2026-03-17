"""Unit tests for the ClamAV antivirus scanning service."""
import pytest
from unittest.mock import patch, MagicMock

from app.services.antivirus import scan_bytes


def test_scan_clean_file() -> None:
    """A clean file returns (True, None)."""
    mock_clam = MagicMock()
    mock_clam.instream.return_value = {"stream": ("OK", None)}

    with patch("app.services.antivirus._get_clam", return_value=mock_clam):
        is_clean, threat = scan_bytes(b"clean file content")
    assert is_clean is True
    assert threat is None


def test_scan_infected_file() -> None:
    """An infected file returns (False, threat_name)."""
    mock_clam = MagicMock()
    mock_clam.instream.return_value = {"stream": ("FOUND", "Eicar-Signature")}

    with patch("app.services.antivirus._get_clam", return_value=mock_clam):
        is_clean, threat = scan_bytes(b"fake malware content")
    assert is_clean is False
    assert threat == "Eicar-Signature"


def test_scan_clamd_unreachable() -> None:
    """When ClamAV is down, scan_bytes fails open (True, None) with warning."""
    with patch("app.services.antivirus._get_clam", side_effect=ConnectionRefusedError):
        is_clean, threat = scan_bytes(b"some content")
    assert is_clean is True
    assert threat is None


def test_scan_empty_bytes() -> None:
    """Empty input should still be scanned without error."""
    mock_clam = MagicMock()
    mock_clam.instream.return_value = {"stream": ("OK", None)}

    with patch("app.services.antivirus._get_clam", return_value=mock_clam):
        is_clean, threat = scan_bytes(b"")
    assert is_clean is True
