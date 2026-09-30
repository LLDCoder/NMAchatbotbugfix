import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError, validate_selection
from app.generic_reader_contracts import SourceSelection
from test_reader_requirement_coverage import fixture


def test_source_selection_repairs_distinct_namespace_errors_without_accepting_unknown_ids():
    knowledge=fixture()[3]
    prompt=knowledge.prompt();citation=prompt[0]['passages'][0]['sourceId']
    def response(ids,ref):return {'stage':'source_selection','sourceIds':ids,'rationale':[{'sourceId':ref}],'nextActions':[],'missing':[]}
    planner=SimpleNamespace(generic_reader_json=AsyncMock(side_effect=[response(['live'],'invalid-citation'),
        response([citation],citation),response(['live'],citation)]))
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://portal.test');reader.knowledge=knowledge
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    result=asyncio.run(reader.structured(SourceSelection,'Select sources.',
        {'sources':[{'sourceId':'live'}],'knowledge':prompt},
        lambda value:validate_selection(value,{'live':{}},knowledge)))
    assert result.sourceIds==['live'] and planner.generic_reader_json.call_count==3
    assert len(reader.audit['rejectedPlans'])==2
    payload=planner.generic_reader_json.call_args.kwargs
    assert payload['schema']['properties']['sourceIds']['items']['enum']==['live']
    assert citation in payload['schema']['$defs']['Citation']['properties']['sourceId']['enum']
    assert payload['data']['identifierNamespaces']['sourceIds']['allowed']==['live']


def test_repeated_bad_selection_remains_planning_error_not_page_or_permission_failure():
    k=fixture()[3];citation=k.prompt()[0]['passages'][0]['sourceId']
    planner=SimpleNamespace(generic_reader_json=AsyncMock(return_value={'stage':'source_selection',
        'sourceIds':['unobserved'],'rationale':[{'sourceId':citation}],'nextActions':[],'missing':[]}))
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://portal.test')
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    with pytest.raises(PipelineError) as exc:asyncio.run(reader.structured(SourceSelection,'Select sources.',
        {'sources':[{'sourceId':'live'}],'knowledge':k.prompt()},lambda value:validate_selection(value,{'live':{}},k)))
    assert exc.value.category=='planning' and planner.generic_reader_json.call_count==2
    assert exc.value.details['allowedSourceIds']==['live']


def test_distinct_repairs_retain_previous_validation_constraints():
    k=fixture()[3];ref=k.prompt()[0]['passages'][0]['sourceId']
    def response(ids):return {'stage':'source_selection','sourceIds':ids,'rationale':[{'sourceId':ref}],
        'nextActions':[],'missing':[]}
    planner=SimpleNamespace(generic_reader_json=AsyncMock(side_effect=[response(['narrow']),response(['typo']),response(['correct'])]))
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://portal.test')
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    def validate(value):
        validate_selection(value,{'narrow':{},'correct':{}},k)
        if value.sourceIds==['narrow']:
            raise PipelineError('selection_source_context_unverified','planning',details={'correction':'Keep the complete requested population.'})
    result=asyncio.run(reader.structured(SourceSelection,'Select.',{'sources':[{'sourceId':'narrow'},{'sourceId':'correct'}],
        'knowledge':k.prompt()},validate))
    assert result.sourceIds==['correct']
    constraints=planner.generic_reader_json.call_args.kwargs['data']['priorValidationConstraints']
    assert [x['code'] for x in constraints]==['selection_source_context_unverified','source_not_observed_or_not_permitted']
