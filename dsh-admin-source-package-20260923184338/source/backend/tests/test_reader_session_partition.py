"""Replay the original identity failure without issuing any online request."""
import asyncio
import copy
import json
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_expansion import QueryExpansion
from app.principal import Principal
from app.reader_bindings import selection_context_gaps
from app.reader_collection import projection_hash
from app.reader_context import load_catalog, refine_task
from app.reader_requirements import requirements_for
from app.reader_session_scope import profile_subtask, profile_expansion, session_projection
from app.reader_subject import bind_fresh_authenticated_records
from test_reader_session_scope import identity_task, source
from test_generic_reader_v3 import Gateway, expansion_fixture

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_real_session_trace.json').read_text())


def test_real_original_intent_review_precedes_profile_partition_and_preserves_history(tmp_path):
    original = TaskSpec.model_validate(TRACE['originalTask'])
    reviews = []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'query_expansion':
                reviews.append(copy.deepcopy(data['task']))
                key = ('reviewWithFullRequest' if data['task']['requestedAttributes'] == original.requestedAttributes
                       else 'reviewWhenClauseRemoved')
                return {k: v for k, v in TRACE[key].items() if k in QueryExpansion.model_fields}
            assert stage == 'task'
            return original.model_dump()
    class Auth(Gateway):
        async def get_user_info(self, principal):
            return {'ok': True, 'result': source(listSysPermission=[{'frontendRoute': '/work/crystals'}])}
    class InspectAtRead(GenericKnowledgeReader):
        async def search(self, principal, query, **kwargs):
            assert self.expansion_task.requestedAttributes == ['department', 'role']
            assert [t.sourceText for t in self.expansion.terms if t.requirementId.startswith('attribute_')] == ['department', 'role']
            assert self.intent_state['task']['requestedAttributes'] == ['department', 'role']
            raise PipelineError('offline_stop_before_network', 'runtime')
    (tmp_path / 'page-catalog.json').write_text(json.dumps([{'name': 'Crystals', 'routes': [{'path': '/work/crystals', 'title': 'Crystal work', 'isMenu': True}]}]))
    reader = InspectAtRead(Auth(), Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    result = asyncio.run(reader.run(Principal('self-1', 'tenant', 'r1'), TRACE['originalQuestion'])).result.public_json()
    assert len(reviews) == 1 and reviews[0]['requestedAttributes'] == original.requestedAttributes
    assert reader.audit['sessionIntentPartition']['reviewedOriginalTask']['requestedAttributes'] == original.requestedAttributes
    assert result['intentState']['task']['requestedAttributes'] == original.requestedAttributes
    assert result['intentState']['originalQuestion'] == TRACE['originalQuestion']
    assert result['result'] == 'load_failed' and not result['requirementsSatisfied']
    assert result['missing'] == ['offline_stop_before_network']
    assert result['requirementCoverage'][-1]['rowScopeVerified'] is False


@pytest.mark.parametrize('attributes', [
    ['data scope', 'department', 'role'], ['department', 'data scope', 'role'], ['department', 'role', 'data scope'],
])
def test_removing_explained_attribute_rebinds_expansion_ids_without_dropping_real_attributes(attributes):
    original = identity_task(requestedAttributes=attributes)
    expansion = QueryExpansion.model_validate(expansion_fixture({'requirements': requirements_for(original)}))
    remaining = profile_subtask(original)
    projected = profile_expansion(expansion, original, remaining)
    assert [(t.requirementId, t.sourceText) for t in projected.terms if t.requirementId.startswith('attribute_')] == [('attribute_0', 'department'), ('attribute_1', 'role')]
    assert original.requestedAttributes == attributes


def test_partition_cannot_promote_changed_or_added_unreviewed_requirement():
    original = identity_task()
    expansion = QueryExpansion.model_validate(expansion_fixture({'requirements': requirements_for(original)}))
    changed = profile_subtask(original).model_copy(update={'requestedScope': 'team'})
    with pytest.raises(PipelineError, match='session_subtask_requirement_changed'):
        profile_expansion(expansion, original, changed)


def test_real_refinement_cannot_reintroduce_session_attribute_through_slot_updates():
    original = TaskSpec.model_validate(TRACE['originalTask'])
    remaining = profile_subtask(original)
    class Planner:
        async def generic_reader_json(self, **kwargs):
            return copy.deepcopy(TRACE['refinedTask'])
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = reader.canonical_question = TRACE['originalQuestion']
    reader.response_language = 'en'; reader.deadline = time.monotonic() + 30
    reader.session_supplement = {'requested': ['scope'], 'rowScopeVerified': False}
    reader.audit['sessionProfileSubtask'] = remaining.model_dump()
    candidate = asyncio.run(reader.structured(TaskSpec, 'Refine the unresolved profile read.', {'phase': 'knowledge_refinement', 'draft': remaining.model_dump()}))
    refined = refine_task(remaining, candidate)
    assert refined.requestedAttributes == ['department', 'role']
    assert next(x.value for x in refined.slotUpdates if x.field == 'requestedAttributes') == ['department', 'role']


def real_selection():
    kb = KnowledgeStore()
    kb.add({'chunks': [{'id': 'actual-personal-center', 'content': json.dumps(TRACE['personalCenterKnowledge'])}]})
    source_data = copy.deepcopy(TRACE['sourceBeforeSubjectBinding'])
    sources = {source_data['sourceId']: source_data}
    selection = SimpleNamespace(sourceIds=list(sources), nextActions=[], missing=[])
    task = profile_subtask(TaskSpec.model_validate(TRACE['originalTask']))
    expected = dict(page=source_data['page'], captured_at=source_data['capturedAt'], principal_scope_ref=source_data['principalScopeRef'])
    return kb, sources, selection, task, expected


def test_real_matching_identity_receipts_prove_personal_context_before_source_selection():
    kb, sources, selection, task, expected = real_selection()
    before = selection_context_gaps(task, selection, sources, kb)
    assert [g['requirementId'] for g in before] == ['scope']
    proofs = bind_fresh_authenticated_records(kb, sources, TRACE['currentUserId'], **expected)
    assert proofs and not selection_context_gaps(task, selection, sources, kb)
    assert sources[selection.sourceIds[0]]['verifiedRecord']['boundTo'] == 'authenticated_user'


@pytest.mark.parametrize('changed', ['user', 'request', 'response', 'missing_identity', 'receipt', 'stale', 'principal', 'page', 'operation', 'kind'])
def test_subject_proof_rejects_wrong_subject_stale_capture_or_unproven_response(changed):
    kb, sources, selection, task, expected = real_selection()
    source_data = sources[selection.sourceIds[0]]; user = TRACE['currentUserId']
    if changed == 'user': user = 'another-user'
    if changed == 'request': source_data['collectionContext']['parameterHashes']['userId'] = projection_hash('another-user')
    if changed == 'response': source_data['data']['data']['userId'] = 'another-user'
    if changed == 'missing_identity': source_data['data']['data'].pop('userId')
    if changed == 'receipt': source_data['fieldEvidence']['/data/userId']['status'] = 'bounded'
    if changed == 'stale': source_data['capturedAt'] = '2000-01-01T00:00:00+00:00'
    if changed == 'principal': source_data['principalScopeRef'] = 'another-principal'
    if changed == 'page': source_data['page'] = '/another-page'
    if changed == 'operation': source_data['operationRef'] = 'GET /api/another-profile'
    if changed == 'kind': source_data['kind'] = 'dom_table'
    assert not bind_fresh_authenticated_records(kb, sources, user, **expected)
    assert 'verifiedRecord' not in source_data and 'subjectParameterHashes' not in source_data


def test_business_navigation_requires_configured_menu_metadata_and_actual_authorization(tmp_path):
    pages = [
        {'name': 'InternalComponentCode', 'routes': [{'path': '/work', 'title': 'Work queue', 'isMenu': True, 'origin': 'configured-root'}]},
        {'name': 'NestedComponentCode', 'routes': [{'path': '/work/archive', 'title': 'Archive', 'isMenu': False, 'origin': 'configured-nested'}]},
        {'name': 'ArbitraryAuthPage', 'publicRoutes': ['/auth-reset'], 'routes': [{'path': '/auth-reset', 'title': 'Password reset', 'isMenu': True, 'origin': 'configured-root'}]},
        {'name': 'AutoPage', 'routes': [{'path': '/automatic', 'title': 'Automatic fallback', 'isMenu': False, 'origin': 'auto-fallback'}]},
        {'name': 'DetailPage', 'routes': [{'path': '/work/detail', 'title': 'Selected detail', 'origin': 'configured-nested', 'activeMenuPath': '/work'}]},
        {'name': 'DeniedPage', 'routes': [{'path': '/denied', 'title': 'Denied work', 'isMenu': True, 'origin': 'configured-root'}]},
    ]
    (tmp_path / 'page-catalog.json').write_text(json.dumps(pages))
    catalog, _ = load_catalog(tmp_path, lambda _: True)
    projection = session_projection(source(), 'self-1', ['scope'], catalog, lambda route: route != '/denied', 'en', 'now')
    assert projection['permittedPages'] == ['Work queue', 'Archive']
    assert projection['rowScopeVerified'] is False and projection['actionAuthorityInferred'] is False
    assert not session_projection(source(), 'self-1', ['scope'], [{'name': 'Unproved', 'routes': ['/unproved']}], lambda _: True, 'en', 'now')['permittedPages']
