"""Authenticate browser conversation reads independently of client identity hints."""
from dataclasses import replace

import httpx
from fastapi import HTTPException

from .principal import Principal


def _authorized_tenants(user: dict, user_id: str) -> set[str]:
    tenants = {f"umc:global:{user_id}"}
    profiles = user.get("userProfileInfo")
    if isinstance(profiles, list):
        for item in profiles:
            if isinstance(item, dict):
                profile = item.get("userProfileId") or item.get("id")
                if profile is not None and str(profile).strip():
                    tenants.add(f"umc:profile:{profile}")
    invitation = user.get("userInvitation")
    if isinstance(invitation, dict) and invitation.get("userProfileId"):
        tenants.add(f"umc:profile:{invitation['userProfileId']}")
    establishments = user.get("userEstablishments")
    if isinstance(establishments, list):
        for item in establishments:
            if isinstance(item, dict):
                if item.get("id") is not None:
                    tenants.add(f"umc:establishment:{item['id']}")
                if item.get("userProfileId"):
                    tenants.add(f"umc:profile:{item['userProfileId']}")
    return tenants


async def authenticate_conversation_principal(principal: Principal, platform) -> Principal:
    if not principal.umc_token:
        raise HTTPException(status_code=401, detail="Admin sign-in is required.")
    try:
        payload = await platform.get_user_info(umc_token=principal.umc_token, request_id=principal.request_id)
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status == 401:
            raise HTTPException(status_code=401, detail="Admin sign-in has expired.") from None
        if status == 403:
            raise HTTPException(status_code=403, detail="Admin access is not permitted.") from None
        raise HTTPException(status_code=503, detail="Unable to verify the Admin session. Try again.") from None
    except (httpx.HTTPError, TimeoutError, ValueError, TypeError):
        raise HTTPException(status_code=503, detail="Unable to verify the Admin session. Try again.") from None
    user = payload.get("data") if isinstance(payload, dict) else None
    candidate = user.get("id") if isinstance(user, dict) else None
    if isinstance(candidate, bool) or not isinstance(candidate, (str, int)) or not str(candidate).strip():
        raise HTTPException(status_code=503, detail="Unable to verify the Admin session. Try again.")
    user_id = str(candidate).strip()
    if user_id != principal.user_id:
        raise HTTPException(status_code=403, detail="The conversation identity does not match the signed-in account.")
    if principal.tenant_id not in _authorized_tenants(user, user_id):
        raise HTTPException(status_code=403, detail="The selected workspace is not available to this account.")
    return replace(principal, user_id=user_id)
