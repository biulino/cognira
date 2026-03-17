import io
import secrets

import pyotp
import qrcode
import qrcode.image.pil


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "Cognira") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_qr_png(uri: str) -> bytes:
    img = qrcode.make(uri, image_factory=qrcode.image.pil.PilImage)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_backup_codes(count: int = 10) -> list[str]:
    return [secrets.token_hex(4).upper() for _ in range(count)]
