"""ClamAV antivirus scanning via clamd network socket."""
import logging
from io import BytesIO

import clamd

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

_clam: clamd.ClamdNetworkSocket | None = None


def _get_clam() -> clamd.ClamdNetworkSocket:
    global _clam
    if _clam is None:
        _clam = clamd.ClamdNetworkSocket(
            host=settings.clamav_host,
            port=settings.clamav_port,
            timeout=30,
        )
    return _clam


def scan_bytes(data: bytes) -> tuple[bool, str | None]:
    """Scan raw bytes with ClamAV.

    Returns (is_clean, threat_name).
    - (True, None)        — file is clean
    - (False, "Eicar-...")  — malware detected
    - (True, None)        — ClamAV unreachable (fail-open with warning)
    """
    try:
        result = _get_clam().instream(BytesIO(data))
        # result: {'stream': ('OK', None)} or {'stream': ('FOUND', 'Eicar-...')}
        status, name = result.get("stream", ("ERROR", None))
        if status == "OK":
            return True, None
        if status == "FOUND":
            log.warning("ClamAV detected threat: %s", name)
            return False, name
        log.warning("ClamAV unexpected status: %s %s", status, name)
        return True, None
    except Exception:
        log.warning("ClamAV unreachable — skipping scan (fail-open)")
        # Reset client so next call retries connection
        global _clam
        _clam = None
        return True, None
