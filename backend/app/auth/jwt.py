from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

import jwt as pyjwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Enforce safe algorithm — reject any configuration that would allow the 'none' attack
_ALLOWED_ALGORITHMS = {"HS256", "HS384", "HS512", "RS256", "ES256"}
if settings.jwt_algorithm not in _ALLOWED_ALGORITHMS:
    raise RuntimeError(f"Insecure JWT algorithm '{settings.jwt_algorithm}'. Allowed: {_ALLOWED_ALGORITHMS}")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_minutes)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    if extra:
        payload.update(extra)
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_days)
    payload = {"sub": subject, "exp": expire, "type": "refresh", "jti": str(uuid.uuid4())}
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception:
        return None

