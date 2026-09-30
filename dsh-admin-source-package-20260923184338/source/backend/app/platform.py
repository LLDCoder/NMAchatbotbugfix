from typing import Any
import asyncio

import httpx

from .config import Settings
from .reader_limits import effective_platform_timeout


class PlatformGatewayClient:
    """Client for the isolated Admin Portal reader gateway."""

    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.platform_gateway_url.rstrip("/")
        self.timeout = effective_platform_timeout(settings.platform_timeout_seconds)
        self.user_info_url = settings.umc_user_info_endpoint
        self.portal_base_url = settings.umc_base_url

    @staticmethod
    def _headers(
        umc_token: str | None,
        request_id: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, str] | None:
        headers = {"Authorization": f"Bearer {umc_token}"} if umc_token else {}
        if request_id:
            # This is a correlation id, not a user-supplied authentication value.
            headers["X-Request-ID"] = request_id[:128]
        if user_id:
            headers["X-User-ID"] = user_id[:128]
        return headers or None

    async def get_user_info(self, *, umc_token: str | None = None, request_id: str | None = None) -> dict[str, Any]:
        """Read the authoritative role and permission context for this turn."""

        # Retry only this read-only identity lookup. Never cache or substitute
        # another principal, and never retry an authentication/permission denial.
        async with asyncio.timeout(self.timeout):
            async with httpx.AsyncClient(timeout=min(self.timeout, 8), follow_redirects=False) as client:
                for attempt in range(3):
                    try:
                        response = await client.post(self.user_info_url,
                            headers=self._headers(umc_token, request_id))
                        response.raise_for_status()
                        return response.json()
                    except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                        retryable = (isinstance(exc, httpx.TransportError) or
                            exc.response.status_code in {408, 429, 500, 502, 503, 504})
                        if not retryable or attempt == 2:
                            raise
                        await asyncio.sleep(0.2 * (attempt + 1))

    async def admin_portal_read(
        self,
        request: dict[str, Any],
        *,
        umc_token: str | None = None,
        request_id: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute a validated browser-read plan through the isolated gateway."""

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/admin/portal/read",
                json=request,
                headers=self._headers(umc_token, request_id, user_id),
            )
            response.raise_for_status()
            return response.json()
