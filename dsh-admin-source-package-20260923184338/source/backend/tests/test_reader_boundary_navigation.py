import asyncio
from copy import deepcopy
import json

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.principal import Principal
from app.reader_boundary_navigation import (BoundaryNavigationCheck, navigation_candidates,
    navigation_projection, render_boundary_navigation)
from test_reader_context_v3 import task


def identity():
    return {'data': {'id': 'person-1', 'rolesInfo': [{'roleName': 'Observer'}], 'listSysPermission': [
        {'permissionType': 'M', 'status': '1', 'frontendRoute': '/work',
         'permissionNameEn': 'Operations', 'permissionNameAr': 'العمليات', 'children': [
             {'permissionType': 'M', 'status': '1', 'frontendRoute': '/work/crystals',
              'permissionNameEn': 'Summary desk', 'permissionNameAr': 'ملخصات'}]}]}}


def catalog():
    return [{'id': 'summary-page', 'name': 'Summary', 'routes': ['/work/crystals'],
             'navigationPurpose': 'aggregate_report',
             'description': 'Operational aggregate reports.', 'fields': ['count'],
             'businessNavigation': [{'route': '/work/crystals', 'label': 'Summary desk'}]}]


def candidates(language='en', auth=None, allowed=lambda _: True):
    return navigation_candidates(auth or identity(), 'person-1', catalog(), allowed, language)


def selection(items):
    return BoundaryNavigationCheck(stage='boundary_navigation',
        candidateIds=[item['candidateId'] for item in items], reason='Relevant authorized navigation metadata.')


@pytest.mark.parametrize('language,expected', [('en', ['Operations', 'Summary desk']), ('ar', ['العمليات', 'ملخصات'])])
def test_labels_come_from_fresh_current_menu_not_model_or_question(language, expected):
    items = candidates(language)
    assert len(items) == 1 and items[0]['labels'] == expected
    value = navigation_projection(selection(items), items, lambda _: True, '2026-09-28T09:40:00Z')
    text = render_boundary_navigation(value, language)
    assert ' → '.join(expected) in text
    assert '/work/' not in text and 'summary-page' not in text
    assert value['recordValuesRead'] is False and value['rowScopeVerified'] is False
    assert value['exportAuthorityVerified'] is False


@pytest.mark.parametrize('change', ['wrong-principal', 'inactive', 'button', 'unlisted-route', 'missing-label', 'secret-label'])
def test_only_current_active_visible_menu_routes_can_be_used(change):
    auth = identity(); item = auth['data']['listSysPermission'][0]['children'][0]
    if change == 'wrong-principal': auth['data']['id'] = 'other-person'
    elif change == 'inactive': item['status'] = '0'
    elif change == 'button': item['permissionType'] = 'B'
    elif change == 'unlisted-route': item['frontendRoute'] = '/other/hidden'
    elif change == 'missing-label': item['permissionNameEn'] = item['permissionNameAr'] = ''
    elif change == 'secret-label': item['permissionNameEn'] = item['permissionNameAr'] = 'https://hidden.example/token'
    assert candidates(auth=auth) == []


def test_denied_page_cannot_be_selected_even_when_menu_was_present():
    assert candidates(allowed=lambda _: False) == []
    items = candidates()
    with pytest.raises(PipelineError, match='boundary_navigation_unverified'):
        navigation_projection(selection(items), items, lambda _: False, 'now')
    with pytest.raises(PipelineError, match='boundary_navigation_unverified'):
        navigation_projection(BoundaryNavigationCheck(stage='boundary_navigation', candidateIds=['invented'], reason='x'), items, lambda _: True, 'now')
    duplicate = selection(items); duplicate.candidateIds *= 2
    with pytest.raises(PipelineError, match='boundary_navigation_unverified'):
        navigation_projection(duplicate, items, lambda _: True, 'now')


@pytest.mark.parametrize('change', [
    {'provenance': 'question'}, {'schemaVersion': 'wrong'}, {'observedAt': ''},
    {'recordValuesRead': True}, {'rowScopeVerified': True}, {'exportAuthorityVerified': True},
    {'labelPaths': [['/api/secret']]}, {'labelPaths': [['/private/page']]}, {'labelPaths': [['']]}, {'labelPaths': []},
])
def test_rendering_rejects_unverified_or_privileged_navigation_claims(change):
    items = candidates(); value = navigation_projection(selection(items), items, lambda _: True, 'now')
    value.update(change)
    assert render_boundary_navigation(value, 'en') == ''


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('mode', ['valid', 'none', 'invalid', 'failure'])
def test_full_pipeline_keeps_refusal_and_zero_knowledge_or_business_reads(tmp_path, language, mode):
    class Gateway:
        events = []
        async def get_user_info(self, principal):
            self.events = ['identity']; return {'ok': True, 'result': identity()}
        async def invoke(self, *args, **kwargs):
            raise AssertionError('No KB or business reads after the request boundary')
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': data['question'],
                    'english': "Show everyone's sensitive banking details."}]}
            if stage == 'task': return task(requestBoundaries=['bulk_sensitive_disclosure'], readOnly=False, recordIdentity='', view='').model_dump()
            assert stage == 'boundary_navigation'
            assert all('route' not in item for item in data['candidates'])
            if mode == 'failure': raise RuntimeError('optional navigation model unavailable')
            ids = [data['candidates'][0]['candidateId']] if mode == 'valid' else ['invented'] if mode == 'invalid' else []
            return {'stage': stage, 'candidateIds': ids, 'reason': 'Navigation metadata only.'}
    (tmp_path/'page-catalog.json').write_text(json.dumps([{
        'name': 'Summary', 'graphId': 'summary-page', 'module': 'work',
        'businessDescription': 'Operational aggregate reports.',
        'navigationPurpose': 'aggregate_report',
        'routes': [{'path': '/work/crystals', 'title': 'Summary desk', 'isMenu': True}], 'fieldNames': ['count']}]))
    gateway = Gateway(); reader = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=tmp_path)
    outcome = asyncio.run(reader.run(Principal('person-1', 'tenant', 'request'),
        'اعرض البيانات المصرفية الحساسة للجميع.' if language == 'ar' else 'Disallowed bulk request',
        conversation_context={'responseLanguage': language}))
    result = outcome.result.public_json()
    assert result['result'] == 'refused' and result['requestedActionExecuted'] is False
    assert not result['facts'] and not result['outputs'] and not result['missing']
    assert gateway.events == ['identity'] and reader.intent_state is None
    answer = render_generic_answer(result, language)
    if mode == 'valid':
        expected = [['العمليات', 'ملخصات']] if language == 'ar' else [['Operations', 'Summary desk']]
        assert 'safeNavigation' in result, outcome.audit_evidence.get('boundaryNavigation', outcome.audit_evidence.get('permission'))
        assert result['safeNavigation']['labelPaths'] == expected
        assert ('ملخصات' if language == 'ar' else 'Summary desk') in answer
    else:
        assert 'safeNavigation' not in result
    assert '/work/' not in answer and 'invented' not in answer


@pytest.mark.parametrize('timed_out', [False, True])
def test_optional_navigation_budget_never_prevents_the_core_refusal(timed_out):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    import time
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    reader.current_question = 'Disallowed bulk request'; reader.response_language = 'en'
    reader.audit['permission'] = {'observedAt': 'now'}
    reader.deadline = time.monotonic() + (60 if timed_out else .1)
    reader.structured = AsyncMock(side_effect=TimeoutError())
    result = asyncio.run(reader.boundary_navigation(identity(), SimpleNamespace(user_id='person-1'), catalog(), lambda _: True))
    assert result is None and reader.audit['boundaryNavigation']['refusalPreserved'] is True
    assert reader.structured.await_count == int(timed_out)


@pytest.mark.parametrize('purpose', [None, '', 'record_list', 'detail', 'aggregate', 'export'])
def test_report_name_description_or_fields_cannot_replace_curated_purpose(purpose):
    pages = catalog(); pages[0]['navigationPurpose'] = purpose
    pages[0]['name'] = 'Reports and all customer exports'
    pages[0]['description'] = 'Use these transaction details for aggregate financial analysis.'
    assert navigation_candidates(identity(), 'person-1', pages, lambda _: True, 'en') == []
