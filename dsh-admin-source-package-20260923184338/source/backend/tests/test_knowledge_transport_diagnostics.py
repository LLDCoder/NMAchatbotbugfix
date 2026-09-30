import httpx
import pytest

from app.knowledge_errors import retrieval_failure


@pytest.mark.parametrize('error_type', [
    'TimeoutError', 'ConnectTimeout', 'ReadTimeout', 'PoolTimeout', 'ConnectError',
    'RemoteProtocolError', 'ReadError',
])
def test_transport_kind_survives_without_changing_retrieval_failure(error_type):
    request = httpx.Request('POST', 'https://knowledge.invalid/search')
    response = httpx.Response(503, request=request, json={'detail': {
        'code': 'knowledge_upstream_unavailable', 'errorType': error_type,
        'error': 'private transport body', 'url': 'https://private.invalid/token',
        'headers': {'Authorization': 'private'},
    }})
    error = httpx.HTTPStatusError('private exception body', request=request, response=response)
    assert retrieval_failure(error) == {
        'code': 'knowledge_upstream_unavailable', 'httpStatus': 503,
        'errorType': error_type, 'channels': {},
    }


@pytest.mark.parametrize('error_type', [
    'ReadTimeout: private connection detail', 'https://private.invalid/token',
    {'token': 'private'}, ['ReadTimeout'], None,
])
def test_untrusted_transport_diagnostic_cannot_become_audit_content(error_type):
    request = httpx.Request('POST', 'https://knowledge.invalid/search')
    response = httpx.Response(503, request=request, json={'detail': {
        'code': 'knowledge_upstream_unavailable', 'errorType': error_type,
    }})
    error = httpx.HTTPStatusError('private exception body', request=request, response=response)
    assert retrieval_failure(error) == {
        'code': 'knowledge_upstream_unavailable', 'httpStatus': 503, 'channels': {},
    }
