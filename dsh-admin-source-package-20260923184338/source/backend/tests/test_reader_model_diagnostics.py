import asyncio
import json
import time
import httpx
from app.config import Settings
from app.llm import LLMAdapter
from app.generic_reader import GenericKnowledgeReader
from app.generic_reader_contracts import SourceSelection
from app.reader_knowledge_coverage import KnowledgeCoverage
from app.generic_reader import PipelineError
import pytest


def test_invalid_provider_output_is_retried_with_bounded_diagnostics_not_private_text(monkeypatch):
    calls = []
    original = httpx.AsyncClient
    async def respond(request):
        calls.append(json.loads(request.content))
        if len(calls) == 1:
            return httpx.Response(200, json={'choices': [{'finish_reason': 'length',
                'message': {'content': '{"private": "PRIVATE_RESPONSE'}}],
                'usage': {'prompt_tokens': 1200, 'completion_tokens': 6500}})
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
            'stage': 'source_selection', 'sourceIds': [], 'rationale': [], 'missing': ['no_observed_source']})}}]})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    adapter = LLMAdapter(Settings(_env_file=None, llm_base_url='https://model.example.test', llm_api_key='fake-test-key'))
    reader = GenericKnowledgeReader(None, adapter, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 30
    result = asyncio.run(reader.structured(SourceSelection, 'Select only observed sources.', {'sources': {}}))
    assert result.missing == ['no_observed_source'] and len(calls) == 2
    diagnostic = reader.audit['modelResponseErrors'][0]
    assert diagnostic['finishReason'] == 'length' and diagnostic['completionTokens'] == 6500
    assert diagnostic['parseError'] == 'JSONDecodeError'
    assert 'PRIVATE_RESPONSE' not in str(reader.audit)
    assert 'PRIVATE_RESPONSE' not in str(calls[1])
    assert 'model_response_invalid_json' in calls[1]['messages'][0]['content']


def test_coverage_format_error_does_not_consume_the_only_semantic_correction():
    calls=[]
    valid={'stage':'knowledge_coverage','checks':[{'requirementId':'object','status':'covered',
        'reason':'The cited page defines this entity.','evidence':[{'sourceId':'exact:p0'}]}]}
    class Planner:
        async def generic_reader_json(self,**kwargs):
            calls.append(kwargs)
            if len(calls)==1:return {**valid,'checks':[{**valid['checks'][0],'evidence':[{'sourceId':'typo:p0'}]}]}
            if len(calls)==2:return {'invalidStageResponse':True,'responseDiagnostics':{'finishReason':'stop','parseError':'JSONDecodeError'}}
            return valid
    def validate(plan):
        if plan.checks[0].evidence[0].sourceId!='exact:p0':raise PipelineError('knowledge_citation_invalid')
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.deadline=time.monotonic()+30
    result=asyncio.run(reader.structured(KnowledgeCoverage,'Check evidence.',
        {'requirements':[{'id':'object'}],'knowledge':[{'passages':[{'sourceId':'exact:p0'}]}]},validate))
    assert result.checks[0].status=='covered' and len(calls)==3
    assert calls[0]['schema']['$defs']['Citation']['properties']['sourceId']['enum']==['exact:p0']


def test_repeated_invalid_json_still_stops_in_bounded_attempts():
    calls=[]
    class Planner:
        async def generic_reader_json(self,**kwargs):
            calls.append(kwargs)
            return {'invalidStageResponse':True,'responseDiagnostics':{'parseError':'JSONDecodeError'}}
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.deadline=time.monotonic()+30
    with pytest.raises(PipelineError,match='model_response_invalid_json'):
        asyncio.run(reader.structured(KnowledgeCoverage,'Check evidence.',{'requirements':[{'id':'object'}]}))
    assert len(calls)==3


def test_two_transient_format_failures_can_use_final_budgeted_attempt():
    calls=[]
    class Planner:
        async def generic_reader_json(self,**kwargs):
            calls.append(kwargs)
            if len(calls)<3:
                return {'invalidStageResponse':True,'responseDiagnostics':{'parseError':'JSONDecodeError','finishReason':'stop'}}
            return {'stage':'knowledge_coverage','checks':[{'requirementId':'object','status':'not_yet_verified',
                'reason':'No applicable evidence has been verified.','evidence':[]}]}
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.deadline=time.monotonic()+30
    result=asyncio.run(reader.structured(KnowledgeCoverage,'Check evidence.',{'requirements':[{'id':'object'}]}))
    assert len(calls)==3 and result.checks[0].status=='not_yet_verified'
    assert len(reader.audit['modelResponseErrors'])==2
