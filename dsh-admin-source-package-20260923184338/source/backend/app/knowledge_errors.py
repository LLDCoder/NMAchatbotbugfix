"""Safe gateway diagnostics shared by initial and supplemental retrieval."""
import httpx

SAFE_UPSTREAM_ERROR_TYPES = frozenset({
    'TimeoutError', 'ConnectTimeout', 'ReadTimeout', 'WriteTimeout', 'PoolTimeout',
    'ConnectError', 'ReadError', 'WriteError', 'CloseError', 'RemoteProtocolError',
    'LocalProtocolError', 'ProxyError', 'DecodingError', 'UnsupportedProtocol',
    'TooManyRedirects',
})


def retrieval_failure(exc):
    if not isinstance(exc, httpx.HTTPStatusError):
        return None
    try:
        detail = exc.response.json().get('detail', {})
    except (ValueError, AttributeError):
        return None
    if not isinstance(detail, dict) or detail.get('code') not in {
        'knowledge_retrieval_channels_incomplete', 'knowledge_upstream_unavailable',
        'knowledge_access_denied', 'knowledge_scope_unavailable',
        'knowledge_snapshot_changed', 'knowledge_request_invalid',
        'knowledge_invalid_upstream_response',
        'knowledge_source_filter_unsupported',
    }:
        return None
    result = {'code': detail['code'], 'httpStatus': exc.response.status_code}
    error_type = detail.get('errorType')
    if isinstance(error_type, str) and error_type in SAFE_UPSTREAM_ERROR_TYPES:
        result['errorType'] = error_type
    for key in ('requiredChannels', 'completedChannels', 'missingChannels'):
        if isinstance(detail.get(key), list):
            result[key] = [x for x in detail[key] if x in ('bm25', 'graph', 'vector')]
    if isinstance(detail.get('upstreamStatus'), int):
        result['upstreamStatus'] = detail['upstreamStatus']
    result['channels'] = {
        name: {key: value for key, value in state.items()
               if (key == 'status' and value in ('ok', 'no_evidence', 'error', 'timeout', 'queue_full'))
               or (key in ('count', 'elapsed_ms') and isinstance(value, (int, float)))}
        for name, state in (detail.get('channels') or {}).items()
        if name in ('bm25', 'graph', 'vector') and isinstance(state, dict)
    } if isinstance(detail.get('channels'), dict) else {}
    return result
