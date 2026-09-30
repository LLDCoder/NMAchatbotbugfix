import asyncio
from typing import Any

import httpx

from .config import Settings
from .reader_knowledge import hydrate_packages, timed_knowledge, KnowledgeBudgetExpired
from .knowledge_errors import retrieval_failure


class KnowledgeGatewayClient:
    """Client for the configured internal knowledge gateway."""

    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.knowledge_gateway_url.rstrip("/")
        self.timeout = settings.knowledge_timeout_seconds
        self.retry_attempts = max(1, settings.knowledge_retry_attempts)

    @staticmethod
    def _headers(umc_token: str | None) -> dict[str, str] | None:
        return {"Authorization": f"Bearer {umc_token}"} if umc_token else None

    async def _get(self, path: str, params: dict[str, Any] | None = None, *, umc_token: str | None = None) -> dict[str, Any]:
        headers = self._headers(umc_token)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}{path}", params=params or {}, headers=headers)
            response.raise_for_status()
            return response.json()

    async def _post(self, path: str, body: dict[str, Any], *, umc_token: str | None = None) -> dict[str, Any]:
        last_error: httpx.HTTPError | None = None
        headers = self._headers(umc_token)
        for attempt in range(self.retry_attempts):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(f"{self.base_url}{path}", json=body, headers=headers)
                if response.status_code in {429, 502, 503, 504} and attempt < self.retry_attempts - 1:
                    await asyncio.sleep(min(2**attempt, 4))
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as exc:
                last_error = exc
                if isinstance(exc, httpx.HTTPStatusError) and 400 <= exc.response.status_code < 500 and exc.response.status_code != 429:
                    raise
                if attempt >= self.retry_attempts - 1:
                    raise
                await asyncio.sleep(min(2**attempt, 4))
        raise last_error or RuntimeError("knowledge gateway request failed")

    async def search(self, query: str, folder_id: str, top_k: int = 32, *, umc_token: str | None = None,
                     retrieval: dict | None = None) -> dict[str, Any]:
        # Requested upstream modes are not proof of completed channels.
        # Keep top_k explicit at the DSH boundary so model/tool callers cannot
        # silently fall back to the upstream's smaller default.
        result = {}
        if retrieval is None:
            # Preserve the legacy caller's transport/HTTP failure contract.
            result = await timed_knowledge("search", self._post("/search", {
                "query": query, "folder_id": folder_id, "top_k": top_k}, umc_token=umc_token))
        try:
            if retrieval is not None:
                from .reader_retrieval import retrieve_evidence
                return await retrieve_evidence(self, query, folder_id, top_k, retrieval, umc_token)
            return await hydrate_packages(self, result, folder_id, top_k, umc_token, query=query)
        except (httpx.HTTPError, ValueError, TypeError, KeyError, ExceptionGroup, KnowledgeBudgetExpired) as exc:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in {401, 403}:
                raise
            failure = retrieval_failure(exc)
            if isinstance(exc, KnowledgeBudgetExpired):
                failure = {'code': 'knowledge_verification_timeout' if str(exc) == 'directory_after'
                           else 'knowledge_retrieval_timeout', 'stage': str(exc)}
            if failure:
                return {**result, "chunks": [], "consistencyError": failure['code'],
                        "retrievalError": failure, "hydrationGaps": [failure]}
            return {**result, "chunks": [], "consistencyError": "knowledge_document_fetch_failed",
                    "hydrationGaps": [{"code": "knowledge_document_fetch_failed", "errorType": type(exc).__name__}]}

    async def folders_tree(self, *, umc_token: str | None = None) -> dict[str, Any]:
        return await self._get("/folders/tree", umc_token=umc_token)

    async def files(self, folder_id: str | None = None, recursive: bool = False, *, umc_token: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"recursive": str(recursive).lower()}
        if folder_id:
            params["folder_id"] = folder_id
        return await self._get("/files", params, umc_token=umc_token)

    async def files_page(self, folder_id: str | None = None, recursive: bool = False, page: int = 1, page_size: int = 20, *, umc_token: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"recursive": str(recursive).lower(), "page": page, "page_size": page_size}
        if folder_id:
            params["folder_id"] = folder_id
        return await self._get("/files/page", params, umc_token=umc_token)

    async def manifest(self, folder_id: str, recursive: bool = True, *, umc_token: str | None = None) -> dict[str, Any]:
        return await self._get("/files/manifest", {"folder_id": folder_id}, umc_token=umc_token)

    async def document(self, file_id: str, folder_id: str, *, umc_token: str | None = None) -> dict[str, Any]:
        if not file_id.isalnum() or len(file_id) > 128:
            raise ValueError("invalid_document_id")
        return await self._get(f"/files/{file_id}/content", {"folder_id": folder_id}, umc_token=umc_token)
