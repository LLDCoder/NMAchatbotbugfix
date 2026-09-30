import hashlib
from dataclasses import dataclass
from uuid import uuid4

from fastapi import Header, HTTPException, Request

from .config import get_settings


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    request_id: str
    token_ref: str | None = None
    # The caller's UMC token is kept in memory for the lifetime of one
    # request/turn only. It is never serialized into session events or logs.
    umc_token: str | None = None


def _token_reference(raw_token: str | None) -> str | None:
    token = _bearer_token(raw_token)
    if not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]


def _bearer_token(raw_token: str | None) -> str | None:
    """Extract a Bearer token without persisting the raw credential."""

    if not raw_token:
        return None
    scheme, _, value = raw_token.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        return None
    return value.strip()


async def get_principal(
    request: Request,
    x_user_id: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> Principal:
    # In production, API Gateway should inject these after validating the external token.
    # The MVP accepts headers so the test console can exercise the complete flow.
    # Query fallback exists only for the local test console. In production the
    # trusted gateway must supply the principal header and browsers cannot set
    # their own identity through a URL parameter.
    user_id = x_user_id
    if not user_id and get_settings().environment == "development":
        user_id = request.query_params.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing trusted principal: X-User-Id")
    tenant_id = x_tenant_id or "default"
    request_id = x_request_id or str(uuid4())
    umc_token = _bearer_token(authorization)
    return Principal(
        user_id=user_id,
        tenant_id=tenant_id,
        request_id=request_id,
        token_ref=_token_reference(authorization),
        umc_token=umc_token,
    )
