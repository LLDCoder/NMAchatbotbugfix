"""Security primitives for the dedicated Admin audit console."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass


AUDIT_SESSION_COOKIE = "dsh_audit_session"
AUDIT_ROLE_ADMINISTRATOR = "Administrator"
AUDIT_ROLE_AUDITOR = "Auditor"
AUDIT_ROLES = (AUDIT_ROLE_ADMINISTRATOR, AUDIT_ROLE_AUDITOR)

PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 600_000
PASSWORD_SALT_BYTES = 16
PASSWORD_MIN_LENGTH = 8


class LoginRateLimiter:
    """Small process-local sliding-window limiter for expensive login checks."""

    def __init__(self, *, max_keys: int = 10_000) -> None:
        self._attempts: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._max_keys = max(100, max_keys)

    def check(self, key: str, *, limit: int, window_seconds: int, now: float | None = None) -> int | None:
        current = time.monotonic() if now is None else now
        bounded_limit = max(1, limit)
        bounded_window = max(1, window_seconds)
        cutoff = current - bounded_window
        with self._lock:
            attempts = self._attempts.setdefault(key, deque())
            while attempts and attempts[0] <= cutoff:
                attempts.popleft()
            if len(attempts) >= bounded_limit:
                return max(1, int(attempts[0] + bounded_window - current) + 1)
            attempts.append(current)
            if len(self._attempts) > self._max_keys:
                self._purge_stale(cutoff, preserve=key)
            return None

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)

    def _purge_stale(self, cutoff: float, *, preserve: str) -> None:
        for candidate in list(self._attempts):
            if candidate != preserve and (not self._attempts[candidate] or self._attempts[candidate][-1] <= cutoff):
                self._attempts.pop(candidate, None)
        while len(self._attempts) > self._max_keys:
            candidate = next((item for item in self._attempts if item != preserve), None)
            if candidate is None:
                break
            self._attempts.pop(candidate, None)


@dataclass(frozen=True, slots=True)
class AuditPrincipal:
    operator_id: int
    username: str
    display_name: str
    role: str
    session_id: int

    @property
    def is_administrator(self) -> bool:
        return self.role == AUDIT_ROLE_ADMINISTRATOR


def normalize_username(value: str) -> str:
    return value.strip().casefold()


def validate_password_policy(password: str) -> str:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"password must contain at least {PASSWORD_MIN_LENGTH} characters")
    if not any(character.islower() for character in password):
        raise ValueError("password must include a lowercase letter")
    if not any(character.isupper() for character in password):
        raise ValueError("password must include an uppercase letter")
    if not any(character.isdigit() for character in password):
        raise ValueError("password must include a number")
    return password


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str, *, iterations: int = PASSWORD_ITERATIONS, salt: bytes | None = None) -> str:
    if not password:
        raise ValueError("password must not be empty")
    password_salt = salt or secrets.token_bytes(PASSWORD_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt, iterations)
    return f"{PASSWORD_SCHEME}${iterations}${_b64(password_salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations_raw, salt_raw, digest_raw = encoded.split("$", 3)
        if scheme != PASSWORD_SCHEME:
            return False
        iterations = int(iterations_raw)
        if iterations < 1 or iterations > 10_000_000:
            return False
        salt = _unb64(salt_raw)
        expected = _unb64(digest_raw)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    except (ValueError, TypeError, UnicodeError, base64.binascii.Error):
        return False
    return hmac.compare_digest(actual, expected)


def issue_session_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, session_token_digest(token)


def session_token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def valid_role(role: str) -> bool:
    return role in AUDIT_ROLES
