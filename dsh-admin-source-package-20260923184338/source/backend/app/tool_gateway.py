import logging
from typing import Any

import httpx

from .knowledge import KnowledgeGatewayClient
from .platform import PlatformGatewayClient
from .principal import Principal
from .portal_reader import (
    PortalReadRequest,
    ReadOnlyPortalPolicy,
    UserPermissionContext,
    bounded_portal_read_result,
)

SYSTEM_DEFAULT_TOOL_NAMES = frozenset({"knowledge.search", "admin.portal.read"})

logger = logging.getLogger("uvicorn.error")


class ToolGateway:
    """Runtime boundary for the two fixed read-only system capabilities."""

    def __init__(self, knowledge: KnowledgeGatewayClient, platform: PlatformGatewayClient) -> None:
        self.knowledge = knowledge
        self.platform = platform

    async def get_user_info(self, principal: Principal) -> dict[str, Any]:
        """Fetch trusted Admin permissions before any reader page operation."""

        if not principal.umc_token:
            return {"ok": False, "code": "permission_denied", "toolName": "GetUserInfo"}
        try:
            result = await self.platform.get_user_info(
                umc_token=principal.umc_token,
                request_id=principal.request_id,
            )
            return {"ok": True, "code": "ok", "toolName": "GetUserInfo", "result": result}
        except httpx.HTTPStatusError as exc:
            code = "permission_denied" if exc.response.status_code in {401, 403} else "tool_error"
            return {"ok": False, "code": code, "toolName": "GetUserInfo", "status": exc.response.status_code}
        except (httpx.HTTPError, ValueError) as exc:
            return {"ok": False, "code": "tool_unavailable", "toolName": "GetUserInfo", "error": type(exc).__name__}


    async def invoke(
        self,
        principal: Principal,
        tool_name: str,
        arguments: dict[str, Any],
        *,
        allowed_tools: list[str] | None = None,
    ) -> dict[str, Any]:
        logger.info(
            "tool_invocation request_id=%s token_ref=%s tool=%s",
            principal.request_id,
            principal.token_ref,
            tool_name,
        )
        if allowed_tools is not None and tool_name not in allowed_tools:
            return {"ok": False, "code": "tool_not_allowed_for_skill", "toolName": tool_name}
        # Runtime execution is intentionally limited to the generic system
        # capabilities. Registry business Tools are not executable by the
        # current runtime.
        if tool_name not in SYSTEM_DEFAULT_TOOL_NAMES:
            return {"ok": False, "code": "tool_not_allowed_for_runtime", "toolName": tool_name}
        if tool_name == "admin.portal.read":
            actions = arguments.get("actions")
            request = PortalReadRequest(
                start_path=str(arguments.get("startPath") or ""),
                actions=tuple(dict(action) for action in actions if isinstance(action, dict)) if isinstance(actions, list) else (),
                expected_fields=tuple(str(value)[:120] for value in arguments.get("expectedFields", [])[:30])
                if isinstance(arguments.get("expectedFields"), list)
                else (),
                completion_period=arguments.get('completionPeriod'),
            )
            policy = ReadOnlyPortalPolicy(self.platform.portal_base_url)
            policy_error = policy.validate(request, UserPermissionContext(), require_permission_context=False)
            if policy_error:
                return {"ok": False, "code": policy_error, "toolName": tool_name}
            try:
                payload = request.as_payload()
                if 'expectedOperations' in arguments:
                    # Waiting hints are validated again by the gateway and do
                    # not authorize or initiate any native request.
                    payload['expectedOperations'] = arguments['expectedOperations']
                if 'dashboardContext' in arguments:
                    payload['dashboardContext'] = arguments['dashboardContext']
                if "nativeRecordLookup" in arguments:
                    payload["nativeRecordLookup"] = arguments["nativeRecordLookup"]
                if "pageReads" in arguments:
                    payload["pageReads"] = arguments["pageReads"]
                if "relatedReads" in arguments:
                    payload["relatedReads"] = arguments["relatedReads"]
                if "collections" in arguments:
                    # The gateway revalidates its strict schema and binds these
                    # projections to observed, allowlisted requests in-session.
                    payload["collections"] = arguments["collections"]
                result = await self.platform.admin_portal_read(
                    payload,
                    umc_token=principal.umc_token,
                    request_id=principal.request_id,
                    user_id=principal.user_id,
                )
                return {
                    "ok": True,
                    "code": "ok",
                    "toolName": tool_name,
                    "result": bounded_portal_read_result(result),
                }
            except httpx.HTTPStatusError as exc:
                code = "permission_denied" if exc.response.status_code in {401, 403} else "tool_error"
                return {"ok": False, "code": code, "toolName": tool_name, "status": exc.response.status_code}
            except (httpx.HTTPError, ValueError) as exc:
                return {"ok": False, "code": "tool_unavailable", "toolName": tool_name, "error": type(exc).__name__}
        query = arguments.get("query")
        folder_id = arguments.get("folder_id") or arguments.get("folderId")
        if not isinstance(query, str) or not query or not isinstance(folder_id, str) or not folder_id:
            return {"ok": False, "code": "invalid_arguments", "toolName": tool_name, "required": ["query", "folder_id"]}
        try:
            raw_top_k = arguments.get("top_k", arguments.get("topK", 32))
            try:
                top_k = int(raw_top_k)
            except (TypeError, ValueError):
                return {"ok": False, "code": "invalid_arguments", "toolName": tool_name, "message": "top_k must be an integer"}
            if top_k < 1 or top_k > 100:
                return {"ok": False, "code": "invalid_arguments", "toolName": tool_name, "message": "top_k must be between 1 and 100"}
            retrieval = arguments.get('retrieval')
            if retrieval is not None and (not isinstance(retrieval, dict)
                    or set(retrieval) - {'purpose', 'documentReferences', 'queryVariants'}
                    or retrieval.get('purpose') not in {'business', 'page_fields', 'coverage_supplement'}
                    or not isinstance(retrieval.get('documentReferences', []), list)
                    or len(retrieval.get('documentReferences', [])) > 20
                    or any(not isinstance(x, str) or len(x) > 500 for x in retrieval.get('documentReferences', []))
                    or not isinstance(retrieval.get('queryVariants', []), list)
                    or len(retrieval.get('queryVariants', [])) > 2
                    or any(not isinstance(x, str) or not x.strip() or len(x) > 2000
                           for x in retrieval.get('queryVariants', []))):
                return {'ok': False, 'code': 'invalid_arguments', 'toolName': tool_name}
            options = {'retrieval': retrieval} if retrieval is not None else {}
            result = await self.knowledge.search(query, folder_id, top_k, umc_token=principal.umc_token, **options)
            return {"ok": True, "code": "ok", "toolName": tool_name, "result": result}
        except httpx.HTTPStatusError as exc:
            code = "permission_denied" if exc.response.status_code == 403 else "tool_error"
            return {"ok": False, "code": code, "toolName": tool_name, "status": exc.response.status_code}
        except httpx.HTTPError as exc:
            return {"ok": False, "code": "tool_unavailable", "toolName": tool_name, "error": str(exc)[:500]}
