import asyncio
import os
import uuid
from typing import Any, Annotated

import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints

UPSTREAM_BASE_URL = os.getenv("KNOWLEDGE_BASE_URL", "http://ai-generation-service:8091").rstrip("/")
PUBLIC_KNOWLEDGE_PATH = os.getenv("KNOWLEDGE_PUBLIC_PATH", "/public/knowledge").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("KNOWLEDGE_TIMEOUT_SECONDS", "30"))
RETRY_ATTEMPTS = max(1, int(os.getenv("KNOWLEDGE_RETRY_ATTEMPTS", "2")))
UPSTREAM_MAX_TOP_K = max(1, int(os.getenv("KNOWLEDGE_UPSTREAM_MAX_TOP_K", "20")))
RETRIEVAL_MODES = tuple(x.strip().lower() for x in os.getenv("KNOWLEDGE_RETRIEVAL_MODES", "bm25,graph,vector").split(",") if x.strip())
SEARCH_CONTRACT = os.getenv("KNOWLEDGE_SEARCH_CONTRACT", "public").strip()
REQUIRED_CHANNELS = tuple(x.strip().lower() for x in os.getenv("KNOWLEDGE_REQUIRED_CHANNELS", "").split(",") if x.strip())
GATEWAY_TOKEN = os.getenv("KNOWLEDGE_GATEWAY_TOKEN", "").strip()
SUBJECT_ID = os.getenv("KNOWLEDGE_SUBJECT_ID", "").strip()
TENANT_ID = os.getenv("KNOWLEDGE_TENANT_ID", "").strip()
SUBJECT_ROLES = os.getenv("KNOWLEDGE_SUBJECT_ROLES", "").strip()
if SEARCH_CONTRACT not in {"public", "mailgraph"}:
    raise ValueError("Unsupported knowledge search contract")
if not RETRIEVAL_MODES or set(RETRIEVAL_MODES) - {"bm25", "graph", "vector"}:
    raise ValueError("Unsupported knowledge retrieval modes")
if set(REQUIRED_CHANNELS) - set(RETRIEVAL_MODES):
    raise ValueError("Required knowledge channels must be requested")
if GATEWAY_TOKEN and not all((SUBJECT_ID, TENANT_ID, SUBJECT_ROLES)):
    raise ValueError("Knowledge service role context is incomplete")
if SEARCH_CONTRACT == "mailgraph" and not GATEWAY_TOKEN:
    raise ValueError("MailGraph service credential is required")

app = FastAPI(title="DSH Knowledge Gateway", version="0.3.0")


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    folder_id: str = Field(min_length=1, max_length=128)
    top_k: int = Field(default=32, ge=1, le=100)
    source_refs: list[Annotated[str, StringConstraints(pattern=r'^kbfile:[A-Za-z0-9_-]{1,128}$')]] = Field(default_factory=list, max_length=32)


def _headers() -> dict[str, str]:
    # Service identity is deployment configuration, never model/KB input.
    headers = {"X-Request-ID": str(uuid.uuid4())}
    if GATEWAY_TOKEN:
        headers.update({"X-FF-Gateway-Auth": GATEWAY_TOKEN,
                        "X-FF-Subject-ID": SUBJECT_ID, "X-FF-Tenant-ID": TENANT_ID,
                        "X-FF-Subject-Roles": SUBJECT_ROLES})
    return headers


def _channel_statuses(value: Any) -> dict[str, dict[str, Any]]:
    """Expose bounded diagnostics without upstream content or credentials."""
    if not isinstance(value, dict):
        return {}
    return {channel: {key: item[key] for key in ("status", "count", "elapsed_ms")
                      if key in item and isinstance(item[key], (str, int, float))}
            for channel, item in value.items()
            if channel in {"bm25", "graph", "vector"} and isinstance(item, dict)}


def _validate_search(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict) or not isinstance(result.get("chunks"), list):
        raise HTTPException(502, detail={"code": "knowledge_invalid_upstream_response"})
    completed = result.get("completed_channels")
    completed = [x for x in completed if x in {"bm25", "graph", "vector"}] if isinstance(completed, list) else []
    channels = _channel_statuses(result.get("channels"))
    missing = [x for x in REQUIRED_CHANNELS
               if x not in completed or channels.get(x, {}).get("status") != "ok"]
    if REQUIRED_CHANNELS and (missing or result.get("degraded")):
        raise HTTPException(424, detail={
            "code": "knowledge_retrieval_channels_incomplete",
            "message": "Required retrieval channels did not complete successfully.",
            "requiredChannels": list(REQUIRED_CHANNELS), "completedChannels": completed,
            "missingChannels": missing, "channels": channels,
        })
    return {**result, "retrievalStatus": "matched" if result["chunks"] else "no_results"}


async def _request(method: str, path: str, *, params: dict[str, Any] | None = None, json: dict[str, Any] | None = None) -> Any:
    last_error: Exception | None = None
    deadline = asyncio.get_running_loop().time() + TIMEOUT_SECONDS
    for attempt in range(RETRY_ATTEMPTS):
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            raise HTTPException(status_code=503, detail={"code": "knowledge_upstream_unavailable", "errorType": "TimeoutError"})
        try:
            async with httpx.AsyncClient(timeout=remaining) as client:
                response = await client.request(method, f"{UPSTREAM_BASE_URL}{path}", params=params, json=json, headers=_headers())
            retryable = response.status_code in {429, 502, 503, 504} or (
                SEARCH_CONTRACT == "mailgraph" and response.status_code == 409)
            delay = min(2 ** attempt, 2)
            if not retryable or attempt == RETRY_ATTEMPTS - 1 or deadline - asyncio.get_running_loop().time() <= delay:
                break
            # A retry performs a fresh scoped request; it never reuses evidence
            # from the rejected snapshot or bypasses the upstream ACL check.
            await asyncio.sleep(delay)
        except httpx.HTTPError as exc:
            last_error = exc
            delay = min(2 ** attempt, 2)
            if attempt == RETRY_ATTEMPTS - 1 or deadline - asyncio.get_running_loop().time() <= delay:
                raise HTTPException(status_code=503, detail={"code": "knowledge_upstream_unavailable", "errorType": type(exc).__name__}) from exc
            await asyncio.sleep(delay)
    if response.is_error:
        try:
            body = response.json()
        except ValueError:
            body = response.text[:2000]
        if SEARCH_CONTRACT == "mailgraph":
            detail = body.get("detail", {}) if isinstance(body, dict) else {}
            channels = _channel_statuses(detail.get("channels")) if isinstance(detail, dict) else {}
            code = {401: "knowledge_access_denied", 403: "knowledge_access_denied",
                    404: "knowledge_scope_unavailable", 409: "knowledge_snapshot_changed",
                    422: "knowledge_request_invalid"}.get(response.status_code, "knowledge_upstream_unavailable")
            raise HTTPException(424, detail={"code": code, "upstreamStatus": response.status_code,
                                            "channels": channels})
        raise HTTPException(status_code=502, detail={"code": "knowledge_upstream_error", "upstreamStatus": response.status_code, "body": body})
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail={"code": "knowledge_invalid_upstream_response"}) from exc


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "status": "ok",
        "provider": "dsh-knowledge-proxy",
        "upstream": UPSTREAM_BASE_URL,
        "upstreamPath": PUBLIC_KNOWLEDGE_PATH,
        "authMode": "service-role" if GATEWAY_TOKEN else "anonymous-public",
        "searchContract": SEARCH_CONTRACT,
        "requiredChannels": list(REQUIRED_CHANNELS),
        "retrievalModes": list(RETRIEVAL_MODES),
        "upstreamMaxTopK": UPSTREAM_MAX_TOP_K,
    }


@app.post("/search")
async def search(request: SearchRequest) -> Any:
    top_k = min(request.top_k, UPSTREAM_MAX_TOP_K)
    body = {
        "query": request.query,
        "folder_id": request.folder_id,
        "top_k": top_k,
    }
    if SEARCH_CONTRACT == "mailgraph":
        body["retrieval_mode"] = "parallel" if len(RETRIEVAL_MODES) > 1 else RETRIEVAL_MODES[0]
        # Narrow only within the configured tenant/folder ACL. The upstream
        # remains responsible for authorization; a source ID grants no access.
        if request.source_refs:
            body["source_refs"] = list(dict.fromkeys(request.source_refs))
        body.update(semantic_cache=False, adaptive_top_k=False)
    else:
        if request.source_refs:
            raise HTTPException(424, detail={"code": "knowledge_source_filter_unsupported"})
        body.update({"retrieval_modes": list(RETRIEVAL_MODES),
                     "candidate_k": min(max(request.top_k, 10), 200),
                     "rerank": {"enabled": False, "top_n": top_k}})
    return _validate_search(await _request("POST", f"{PUBLIC_KNOWLEDGE_PATH}/search", json=body))


@app.get("/folders/tree")
async def folders_tree() -> Any:
    return await _request("GET", f"{PUBLIC_KNOWLEDGE_PATH}/folders/tree")


@app.get("/files")
async def files(folder_id: str | None = Query(default=None), recursive: bool = Query(default=False)) -> Any:
    params: dict[str, Any] = {"recursive": str(recursive).lower()}
    if folder_id:
        params["folder_id"] = folder_id
    return await _request("GET", f"{PUBLIC_KNOWLEDGE_PATH}/files", params=params)


@app.get("/files/page")
async def files_page(folder_id: str | None = Query(default=None), recursive: bool = Query(default=False), page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=10, le=100)) -> Any:
    params: dict[str, Any] = {
        "recursive": str(recursive).lower(),
        "page": page,
        "page_size": page_size,
    }
    if folder_id:
        params["folder_id"] = folder_id
    return await _request("GET", f"{PUBLIC_KNOWLEDGE_PATH}/files/page", params=params)


@app.get("/files/manifest")
async def file_manifest(folder_id: str = Query(min_length=1)) -> Any:
    return await _request("GET", f"{PUBLIC_KNOWLEDGE_PATH}/files/manifest", params={"folder_id": folder_id})


@app.get("/files/{file_id}/content")
async def file_content(file_id: str, folder_id: str = Query(min_length=1)) -> Any:
    # Exact-file reads narrow the same service-authorized directory scope.
    if not file_id.isalnum() or len(file_id) > 128:
        raise HTTPException(status_code=422, detail="invalid_document_id")
    return await _request("GET", f"{PUBLIC_KNOWLEDGE_PATH}/files/{file_id}/content", params={"folder_id": folder_id})
