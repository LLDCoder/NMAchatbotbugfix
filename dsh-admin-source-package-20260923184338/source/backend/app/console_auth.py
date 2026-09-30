"""Authentication primitives for the local DSH test console.

The initial console password comes from runtime configuration or is randomly
generated. Existing PostgreSQL configuration takes precedence after startup.
It is never returned by an HTTP endpoint. Successful logins receive a short-lived, signed HttpOnly cookie so
the same guard protects both REST calls and the WebSocket test channel.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from collections.abc import Awaitable, Callable
from typing import Any

from starlette.responses import JSONResponse


CONSOLE_PASSWORD_CONFIG_KEY = "console_password"
DEFAULT_CONSOLE_PASSWORD = os.environ.get("CONSOLE_BOOTSTRAP_PASSWORD") or secrets.token_urlsafe(48)
CONSOLE_SESSION_COOKIE = "dsh_console_session"
CONSOLE_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_session(password: str) -> str:
    """Create a stateless signed session token without embedding the password."""

    issued_at = str(int(time.time())).encode("ascii")
    nonce = secrets.token_bytes(18)
    payload = issued_at + b"." + _b64(nonce).encode("ascii")
    signature = hmac.new(password.encode("utf-8"), payload, hashlib.sha256).digest()
    return f"{_b64(payload)}.{_b64(signature)}"


def verify_session(token: str | None, password: str, max_age: int = CONSOLE_SESSION_MAX_AGE_SECONDS) -> bool:
    if not token or not password:
        return False
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload = _unb64(encoded_payload)
        signature = _unb64(encoded_signature)
        issued_at_raw, nonce_raw = payload.split(b".", 1)
        issued_at = int(issued_at_raw)
        # Validate the nonce encoding as well as the timestamp structure.
        _unb64(nonce_raw.decode("ascii"))
    except (ValueError, TypeError, UnicodeDecodeError, base64.binascii.Error):
        return False
    if issued_at > int(time.time()) + 60 or int(time.time()) - issued_at > max_age:
        return False
    expected = hmac.new(password.encode("utf-8"), payload, hashlib.sha256).digest()
    return hmac.compare_digest(signature, expected)


def cookie_value(headers: list[tuple[bytes, bytes]]) -> str | None:
    cookie_header = next((value.decode("latin-1") for key, value in headers if key.lower() == b"cookie"), "")
    for item in cookie_header.split(";"):
        name, separator, value = item.strip().partition("=")
        if separator and name == CONSOLE_SESSION_COOKIE:
            return value
    return None


def has_bearer_authorization(headers: list[tuple[bytes, bytes]]) -> bool:
    """Return whether the request carries a non-empty Bearer credential.

    The embedded Admin client uses its UMC access token rather than the
    test-console session cookie. This check only decides whether the request
    may reach the route; the route's own Principal/auth-frame validation still
    remains authoritative.
    """

    for key, value in headers:
        if key.lower() != b"authorization":
            continue
        scheme, separator, credential = value.decode("latin-1").partition(" ")
        return scheme.lower() == "bearer" and bool(separator and credential.strip())
    return False


def requires_console_auth(path: str) -> bool:
    """Return whether a path belongs to the Docker test console API."""

    protected_prefixes = (
        "/api/v1/console/audit",
        "/api/v1/conversations",
        "/api/v1/config",
        "/api/v1/skills",
        "/api/v1/test-cases",
        "/api/v1/umc/",
        "/api/v1/ws",
    )
    return path.startswith(protected_prefixes)


def allows_portal_auth(
    scope: dict[str, Any],
    path: str,
    headers: list[tuple[bytes, bytes]],
) -> bool:
    """Allow the authenticated Admin client to use conversation transport.

    REST calls carry the UMC token in ``Authorization``.  Browser WebSockets
    cannot set that header, so the endpoint must be reachable before it can
    validate the token sent in the first application frame.
    """

    if scope.get("type") == "websocket" and path == "/api/v1/ws":
        return True
    return (
        scope.get("type") == "http"
        and path.startswith("/api/v1/conversations")
        and has_bearer_authorization(headers)
    )


class ConsoleAuthMiddleware:
    """ASGI guard for REST and WebSocket test-console routes."""

    def __init__(self, app: Any, get_password: Callable[[], str]) -> None:
        self.app = app
        self.get_password = get_password

    async def __call__(self, scope: dict[str, Any], receive: Callable[..., Awaitable[Any]], send: Callable[..., Awaitable[Any]]) -> None:
        path = str(scope.get("path") or "")
        if scope.get("type") not in {"http", "websocket"} or not requires_console_auth(path):
            await self.app(scope, receive, send)
            return

        # Let browser preflight requests pass; all same-origin console calls
        # still need the signed cookie on the actual request.
        if scope.get("type") == "http" and scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        headers = scope.get("headers") or []
        token = cookie_value(headers)
        if verify_session(token, self.get_password()):
            await self.app(scope, receive, send)
            return

        # The embedded Admin client does not have the operator console cookie.
        # Let its bearer-authenticated conversation requests (and the WS
        # handshake that will authenticate in its first frame) reach the
        # normal route-level Principal checks.
        if allows_portal_auth(scope, path, headers):
            await self.app(scope, receive, send)
            return

        if scope.get("type") == "websocket":
            await send({"type": "websocket.close", "code": 4401, "reason": "console authentication required"})
            return
        response = JSONResponse({"detail": "console authentication required", "code": "console_auth_required"}, status_code=401)
        await response(scope, receive, send)
