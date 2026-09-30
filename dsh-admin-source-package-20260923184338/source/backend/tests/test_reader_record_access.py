import asyncio
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.principal import Principal
from app.reader_catalog_access import needs_catalog_access_check
from test_generic_reader_v3 import Gateway
from test_reader_context_v3 import task


@pytest.mark.parametrize('object_name,record,live,expected', [
    ('restricted crystals', 'ZX-42', True, True),
    ('unknown', 'ZX-42', True, False),
    ('', 'ZX-42', True, False),
    ('restricted crystals', 'ZX-42', False, False),
    ('crystals', '', True, True),
])
def test_record_scope_precheck_preserves_unknown_ids_and_general_guidance(object_name, record, live, expected):
    assert needs_catalog_access_check(task(businessObject=object_name, recordIdentity=record,
        needsLiveData=live)) == expected


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('decision', ['permission_denied', 'continue'])
def test_named_record_native_rejection_precedes_retrieval_and_preserves_allowed_alternatives(tmp_path, language, decision):
    class IdentityOnlyGateway(Gateway):
        async def invoke(self, principal, name, arguments, **kwargs):
            assert name == 'admin.portal.read'
            assert arguments == {'startPath': '/restricted/work', 'actions': [{'type': 'observe'}],
                'nativeRecordLookup': 'ZX-42'}
            self.events.append('native-record-read')
            return {'ok': True, 'result': {'status': 'no_permission',
                'diagnostics': {'stage': 'native_record_lookup', 'upstreamStatus': 403,
                    'permissionResponse': {'isSuccess': False, 'statusCode': 403}}}}

    class AccessPlanner:
        def __init__(self):
            self.access_calls = []

        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': data['question'],
                    'english': 'Find restricted crystals record ZX-42.'}]}
            if stage == 'task':
                return task(businessObject='restricted crystals', recordIdentity='ZX-42',
                    requestedMeasures=[], requestedAttributes=['status']).model_dump()
            assert stage == 'catalog_access_check'
            self.access_calls.append(data)
            return {'stage': stage, 'decision': decision,
                'targetPageIds': ['restricted'] if decision == 'permission_denied' else ['crystals'],
                'reason': 'The refreshed route permissions and applicable metadata were compared.'}

    class StopAfterPrecheck(GenericKnowledgeReader):
        async def expand_task(self, *args, **kwargs):
            raise PipelineError('test_reached_ordinary_routing', 'planning')

    Path(tmp_path, 'page-catalog.json').write_text(json.dumps([
        {'name': 'Shared detail', 'graphId': 'crystals', 'module': 'shared',
         'routes': [{'path': '/work/crystals'}], 'fieldNames': ['code']},
        {'name': 'Restricted crystals', 'graphId': 'restricted', 'module': 'restricted',
         'routes': [{'path': '/restricted/work'}], 'fieldNames': ['code']},
    ]))
    gateway, planner = IdentityOnlyGateway(), AccessPlanner()
    reader = StopAfterPrecheck(gateway, planner, portal_base_url='https://portal.test', artifacts_dir=tmp_path)
    question = 'ابحث عن الطلب ZX-42' if language == 'ar' else 'Find restricted crystals record ZX-42.'
    result = asyncio.run(reader.run(Principal('person-1', 'tenant', 'request'), question,
        conversation_context={'responseLanguage': language})).result.public_json()
    assert len(planner.access_calls) == 1
    assert planner.access_calls[0]['task']['recordIdentity'] == 'ZX-42'
    if decision == 'permission_denied':
        assert gateway.events == ['identity', 'native-record-read']
        assert result['missing'] == ['upstream_access_denied']
        assert result['failureCategory'] == 'permission'
    else:
        assert gateway.events == ['identity']
        assert result['missing'] == ['test_reached_ordinary_routing']
