"""WebSocket hub for real-time notifications and WebRTC call signaling.

Usage:
  from app.ws import manager
  await manager.send_personal(user_id, {"type": "chat_msg", ...})
  await manager.broadcast_to_users(user_ids, {"type": "visita_estado", ...})

WebRTC signaling protocol:
  Clients may send {"type": "signal", "to": "<user_id>", "data": {...}} and
  the hub will relay the payload to the target user, injecting the sender's id.
  Supported data types: call_request, call_accept, call_reject, call_hangup,
                        offer, answer, ice
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import time
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
import jwt as pyjwt

from app.deps import get_current_user
from app.config import get_settings
from app.database import AsyncSession, get_db
from app.models.user import Utilizador as User

logger = logging.getLogger(__name__)

settings = get_settings()

# ── TURN credentials router ──────────────────────────────────────────────────
ws_router = APIRouter(prefix="/ws", tags=["websocket"])


@ws_router.get("/turn-credentials")
async def turn_credentials(
    current_user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
) -> dict:
    """Return short-lived TURN server credentials (TURN REST API §4.2).

    Uses HMAC-SHA1 with a time-limited username so the secret is never
    exposed to the client.  Credentials expire in 1 hour.
    """
    turn_secret = getattr(settings, "turn_secret", "changeme-turn-secret-replace-in-prod")
    ttl = 3600  # seconds
    timestamp = math.floor(time.time()) + ttl
    username = f"{timestamp}:{current_user.id}"
    credential = hmac.new(
        turn_secret.encode(), username.encode(), hashlib.sha1
    ).digest()
    import base64
    credential_b64 = base64.b64encode(credential).decode()

    host = getattr(settings, "turn_host", "")  # set TURN_HOST in .env to the server IP/domain
    return {
        "username": username,
        "credential": credential_b64,
        "ttl": ttl,
        "uris": [
            f"stun:{host or 'localhost'}:3478",
            f"turn:{host or 'localhost'}:3478?transport=udp",
        ],
    }


class ConnectionManager:
    """Thread-safe WebSocket connection pool keyed by user_id (str UUID)."""

    def __init__(self) -> None:
        # user_id → set of websocket connections (a user may have multiple tabs)
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("WS connect user=%s (total=%d)", user_id, self._count())

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self._connections[user_id]
        logger.info("WS disconnect user=%s (total=%d)", user_id, self._count())

    async def send_personal(self, user_id: str, data: dict[str, Any]) -> None:
        """Send a JSON message to all tabs of a specific user."""
        conns = self._connections.get(user_id)
        if not conns:
            return
        payload = json.dumps(data, default=str)
        closed: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                closed.append(ws)
        for ws in closed:
            conns.discard(ws)
        if not conns:
            self._connections.pop(user_id, None)

    async def broadcast_to_users(self, user_ids: list[str], data: dict[str, Any]) -> None:
        """Send a message to multiple users."""
        for uid in user_ids:
            await self.send_personal(uid, data)

    def _count(self) -> int:
        return sum(len(v) for v in self._connections.values())


# Singleton — import and use throughout the app
manager = ConnectionManager()


def _authenticate_ws_token(token: str) -> str | None:
    """Validate a JWT token and return user_id, or None if invalid."""
    try:
        payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str | None = payload.get("sub")
        if not user_id:
            return None
        # Reject partial 2FA and refresh tokens
        if payload.get("pending_2fa") or payload.get("type") == "refresh":
            return None
        return user_id
    except pyjwt.PyJWTError:
        return None


async def websocket_endpoint(websocket: WebSocket) -> None:
    """FastAPI WebSocket endpoint: /api/ws?token=<jwt>

    Handles two modes:
      1. Server → client push (notifications, chat events)
      2. Client → relay: {"type":"signal","to":"<user_id>","data":{...}}
         The hub forwards the message to the target user, adding "from" field.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = _authenticate_ws_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            # Relay WebRTC signaling messages
            try:
                msg = json.loads(raw)
                if msg.get("type") == "signal" and "to" in msg and "data" in msg:
                    to_user: str = str(msg["to"])
                    payload_out = {
                        "type": "signal",
                        "from": user_id,
                        "data": msg["data"],
                    }
                    await manager.send_personal(to_user, payload_out)
            except (json.JSONDecodeError, TypeError):
                pass  # plain pings / non-JSON are silently discarded
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
