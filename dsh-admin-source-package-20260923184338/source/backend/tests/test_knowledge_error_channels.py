import httpx
from app.knowledge_errors import retrieval_failure


def test_completed_channel_without_evidence_is_distinct_from_timeout_and_stays_a_failure():
    request = httpx.Request('POST', 'https://knowledge.invalid/search')
    response = httpx.Response(424, request=request, json={'detail': {
        'code': 'knowledge_retrieval_channels_incomplete',
        'requiredChannels': ['bm25', 'vector', 'graph'],
        'completedChannels': ['bm25', 'vector'], 'missingChannels': ['vector', 'graph'],
        'channels': {'bm25': {'status': 'ok', 'count': 4},
            'vector': {'status': 'no_evidence', 'count': 0, 'private': 'discard'},
            'graph': {'status': 'timeout', 'count': 0}}}})
    error = httpx.HTTPStatusError('retrieval failed', request=request, response=response)
    result = retrieval_failure(error)
    assert result['code'] == 'knowledge_retrieval_channels_incomplete'
    assert result['channels']['vector'] == {'status': 'no_evidence', 'count': 0}
    assert result['channels']['graph']['status'] == 'timeout'
    assert result['missingChannels'] == ['vector', 'graph']
