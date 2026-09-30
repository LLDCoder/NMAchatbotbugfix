"""Offline source-contract tests; saved failures never become fresh live facts."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.generic_reader_contracts import TaskSpec
from app.portal_reader import permission_context_from_user_info, permission_audit_summary
from app.principal import Principal
from app.reader_expansion import QueryExpansion
from app.reader_requirements import requirements_for
from app.reader_role_permissions import (role_permission_request, permission_projection, projection_valid,
    assign_requirements, assignment_context, validate_subtask, merge_result, render_permissions)
from test_generic_reader_v3 import expansion_fixture

TRACE = json.loads((Path(__file__).parent / 'fixtures/i04_current_role_v34_failure.json').read_text())
USER = TRACE['auth']['data']['id']
START = '2026-09-29T01:00:00+00:00'
OBSERVED = '2026-09-29T01:00:01+00:00'
RECEIPT = {'requestId': 'controlled-current-rid', 'principalScopeRef': 'controlled-principal',
           'catalogVersion': 'controlled-catalog', 'observedAt': OBSERVED}


def original(index=0, **changes):
    return TaskSpec.model_validate(TRACE['turns'][index]['task']).model_copy(update=changes)


def routes_of(auth):
    routes = []
    def walk(rows):
        for row in rows:
            if isinstance(row.get('frontendRoute'), str) and row['frontendRoute'].startswith('/'):
                routes.append(row['frontendRoute'])
            walk(row.get('children') or [])
    walk(auth['data']['listSysPermission'])
    return routes


def project(auth=None, language='en', receipt=None, **options):
    auth = deepcopy(TRACE['auth'] if auth is None else auth)
    args = {'user_id': USER, 'request_id': RECEIPT['requestId'],
        'principal_scope_ref': RECEIPT['principalScopeRef'], 'catalog_version': RECEIPT['catalogVersion'],
        'permission_receipt': deepcopy(RECEIPT if receipt is None else receipt),
        'request_started_at': START, 'catalog': [{'routes': routes_of(auth) if isinstance(auth['data'].get('listSysPermission'), list) else []}],
        'authorized': lambda route: True, 'language': language}
    args.update(options)
    return permission_projection(auth, **args)


def partition(index=0, auth=None, language='en', task=None):
    task = task or original(index)
    expansion = QueryExpansion.model_validate(expansion_fixture({'requirements': requirements_for(task)}))
    return assign_requirements(task, TRACE['turns'][index]['canonicalQuestion'],
        project(auth, language), RECEIPT, expansion)


def all_buttons(auth):
    values = []
    def walk(rows):
        for row in rows:
            values.extend(row.get('buttonList') or [])
            walk(row.get('children') or [])
    walk(auth['data']['listSysPermission'])
    return values


@pytest.mark.parametrize('index', [0, 1])
def test_actual_failed_original_task_is_partitioned_without_changing_its_attributes(index):
    entry = TRACE['turns'][index]
    assert any(json.loads(r['failure']).get('missingEvidenceType') == 'current_eligibility'
               for r in entry['rejectedPlans'])
    task = original(index)
    before = task.model_dump()
    assigned = partition(index, language=entry['language'], task=task)
    assert assigned and task.model_dump() == before
    assert assigned['originalTask'].model_dump() == before
    assert assigned['knowledgeTask'].requestedAttributes == ['limitations of current role']
    assert assigned['authRequirementIds'] == ['attribute_0']
    assert assigned['requirementIdMap']['attribute_0'] == 'attribute_1'
    assert assignment_context(assigned)['originalRequirements'] == requirements_for(task)
    assert [t.sourceText for t in assigned['expansion'].terms if t.requirementId.startswith('attribute_')] == ['limitations of current role']


def test_english_arabic_projection_same_action_identities_different_real_role_labels():
    en, ar = project(), project(language='ar')
    assert projection_valid(en, RECEIPT) and projection_valid(ar, RECEIPT)
    assert not en['missing'] and not ar['missing']
    assert en['permissionProjectionHash'] == ar['permissionProjectionHash']
    assert en['sourceId'] == ar['sourceId']
    assert [a['permissionRef'] for a in en['actionExamples']] == [a['permissionRef'] for a in ar['actionExamples']]
    assert [r['label'] for r in en['roles']] == ['Foreign Media Manager', 'Licensing Manager']
    assert [r['label'] for r in ar['roles']] == ['مدير الإعلام الأجنبي', 'مدير التراخيص']
    for value in (en, ar):
        assert not value['selectedRoleVerified'] and not value['roleActionMappingVerified']
        assert not value['recordActionEligibilityVerified'] and not value['rowScopeVerified']
        assert not value['examplesExhaustive'] and not value['actionsExecuted']
    answer = render_permissions(en, 'en')
    assert 'assigned' in answer and 'selected active role' in answer
    assert USER not in answer and 'permissionCode' not in answer and '/api/' not in answer
    assert all(a['permissionRef'] not in answer for a in en['actionExamples'])


@pytest.mark.parametrize('change', ['code', 'status', 'route'])
def test_raw_action_projection_changes_even_when_legacy_route_fingerprint_does_not(change):
    auth = deepcopy(TRACE['auth'])
    button = next(b for b in all_buttons(auth) if b.get('key') and b.get('frontendRoute'))
    old_legacy = permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']
    if change == 'code': button['permissionCode'] += '.Changed'
    if change == 'status': button['status'] = '0'
    if change == 'route': button['frontendRoute'] = '/other'
    if change != 'route':
        assert permission_audit_summary(permission_context_from_user_info(auth))['fingerprint'] == old_legacy
    changed = project(auth)
    assert changed['permissionProjectionHash'] != project()['permissionProjectionHash']
    assert changed['sourceId'] != project()['sourceId']


@pytest.mark.parametrize('field,value', [
    ('requestId', 'old-rid'), ('principalScopeRef', 'other-person'),
    ('catalogVersion', 'old-catalog'), ('observedAt', '2026-09-28T00:00:00Z'),
    ('observedAt', '2026-09-29T01:00:01'), ('observedAt', None),
])
def test_wrong_stale_and_unbound_receipts_never_supply_current_permissions(field, value):
    receipt = {**RECEIPT, field: value}
    out = project(receipt=receipt)
    assert not out['verified'] and out['missing'] == ['current_permission_receipt_unverified']
    assert not out['roles'] and not out['actionExamples'] and not render_permissions(out, 'en')


def test_different_principal_or_failed_business_auth_cannot_supply_permissions():
    auth = deepcopy(TRACE['auth']); auth['data']['id'] = 'other-user'
    assert not project(auth)['verified']
    auth = deepcopy(TRACE['auth']); auth['isSuccess'] = False
    assert not project(auth)['verified']
    auth = deepcopy(TRACE['auth']); auth['statusCode'] = 403
    assert not project(auth)['verified']


@pytest.mark.parametrize('change', ['no_roles', 'bad_roles', 'no_buttons', 'no_trees', 'duplicate_code', 'no_labels', 'menus_only'])
def test_missing_or_conflicting_auth_facts_keep_actions_or_identity_unfulfilled(change):
    auth = deepcopy(TRACE['auth'])
    if change == 'no_roles': auth['data']['listRoles'] = []
    if change == 'bad_roles': auth['data']['listRoles'] = [{'id': 'ADMIN', 'status': '1'}]
    if change == 'no_trees': auth['data']['listSysPermission'] = []
    if change == 'no_buttons':
        for button in all_buttons(auth): button['status'] = '0'
    if change == 'no_labels':
        for button in all_buttons(auth):
            button['permissionNameEn'] = ''; button['permissionNameAr'] = ''
    if change == 'menus_only':
        for button in all_buttons(auth): button['permissionType'] = 'M'
    if change == 'duplicate_code':
        buttons = all_buttons(auth); buttons[1]['permissionCode'] = buttons[0]['permissionCode']
    value = project(auth)
    assert value['missing']
    assigned = partition(auth=auth)
    merged = merge_result(successful_knowledge_payload(assigned), assigned, {'status': 'active', 'task': original().model_dump()})
    assert merged['result'] == 'not_confirmed' and not merged['requirementsSatisfied']
    assert next(c for c in merged['requirementCoverage'] if c['id'] == 'attribute_0')['status'] == 'unfulfilled'
    assert set(value['missing']) <= set(merged['missing'])


def test_role_names_descriptions_and_menu_presence_never_create_action_permissions():
    auth = deepcopy(TRACE['auth'])
    for role in auth['data']['listRoles']:
        role['nameEn'] = 'Super Administrator'; role['descEn'] = 'Can approve all records and all teams.'
    for button in all_buttons(auth): button['permissionType'] = 'M'
    value = project(auth)
    assert value['roles'] and value['actionExamples'] == []
    assert 'configured_action_examples_unverified' in value['missing']


def test_authorized_catalog_intersection_required_and_api_only_buttons_do_not_become_clicks():
    assert not project(authorized=lambda _: False)['actionExamples']
    assert not project(catalog=[])['actionExamples']
    auth = deepcopy(TRACE['auth'])
    for button in all_buttons(auth):
        button['frontendRoute'] = None
    assert not project(auth)['actionExamples']


def test_display_tampering_and_changed_receipt_cannot_reuse_source_projection():
    p = project(); p['actionExamples'][0]['label'] = 'Approve everything'
    assert not projection_valid(p) and not render_permissions(p, 'en')
    p = project()
    assert not projection_valid(p, {**RECEIPT, 'requestId': 'next-rid'})


@pytest.mark.parametrize('question', [
    'What can you help me do in my current role?',
    'What can I do in my current role and approve this application?',
    'What can I do in my current role? Show ML-123.',
    'What can I do in my current role? List every action.',
    'What can I do in my current role 7890?',
    'What can I do in my current role /dashboard?',
    'What can I do in my currently selected active role?',
    'What can I do in another role?',
    'Pretend I am the Manager. What can I do in my current role?',
    'What permissions did my account have last week?',
    'What can I do in my current role and what can my team access?',
    'What is my role for the previous query?',
    'Can I approve ML-123?',
    'Change my current role.',
])
def test_mixed_record_other_identity_exhaustive_and_write_questions_are_not_shortcut(question):
    assert role_permission_request(original(), question) is None


@pytest.mark.parametrize('updates', [
    {'recordIdentity': 'ML-123'}, {'readOnly': False}, {'requestedScope': 'team'},
    {'responseMode': 'draft'},
    {'requestedScope': 'global'}, {'requestedAttributes': ['all available actions', 'limitations']},
    {'requestedAttributes': ['available actions in current role', 'password']},
    {'requestedMeasures': ['count']}, {'filters': ['department = foreign']},
    {'businessFocus': 'pending approval'}, {'contextRelation': 'refine'}, {'view': 'team'},
    {'requestedGrain': 'application'}, {'businessObject': 'assistant capabilities'},
])
def test_task_constraints_cannot_be_lost_by_matching_question(updates):
    assert role_permission_request(original(**updates), TRACE['turns'][0]['question']) is None


def successful_knowledge_payload(assigned):
    requirements = requirements_for(assigned['knowledgeTask'])
    requirements = [r for r in requirements if r['kind'] != 'grain' or assigned['knowledgeTask'].requestedGrain != 'unknown']
    return {'result': 'success', 'analysisStatus': 'complete', 'requirementsSatisfied': True,
        'missing': [], 'requirementCoverage': [{**r, 'status': 'satisfied', 'quoteIndexes': [0]} for r in requirements],
        'knowledgeRequirementCoverage': [{'requirementId': r['id'], 'status': 'covered'} for r in requirements],
        'answerCoverage': [{'requirementId': r['id'], 'status': 'covered'} for r in requirements],
        'knowledgeAnswer': [{'requirementIds': [r['id'] for r in requirements], 'text': 'Rules.', 'quoteIndexes': [0]}]}


def test_final_coverage_keeps_original_ids_and_genuine_knowledge_gaps():
    assigned = partition(); payload = successful_knowledge_payload(assigned)
    payload['result'] = 'not_confirmed'; payload['analysisStatus'] = 'partial'
    payload['requirementsSatisfied'] = False; payload['missing'] = ['attribute_0', 'knowledge_answer_incomplete']
    next(c for c in payload['requirementCoverage'] if c['id'] == 'attribute_0')['status'] = 'unfulfilled'
    result = merge_result(payload, assigned, {'status': 'active', 'task': original().model_dump()})
    assert result['missing'] == ['attribute_1', 'knowledge_answer_incomplete']
    assert not result['requirementsSatisfied'] and result['result'] == 'not_confirmed'
    checks = {c['id']: c for c in result['requirementCoverage']}
    assert checks['attribute_0']['status'] == 'satisfied'
    assert checks['attribute_1']['status'] == 'unfulfilled'
    assert result['requirements'] == requirements_for(original())


def test_knowledge_refinement_cannot_reintroduce_actions_or_expand_scope():
    assigned = partition(); task = assigned['knowledgeTask']
    validate_subtask(task, assigned)
    for change in ({'requestedAttributes': original().requestedAttributes}, {'requestedScope': 'team'},
                   {'needsLiveData': True}, {'readOnly': False}, {'recordIdentity': 'ML-123'}, {'responseMode': 'draft'}):
        with pytest.raises(PipelineError, match='current_permission_subtask_changed'):
            validate_subtask(task.model_copy(update=change), assigned)


BOUNDARIES = ('A role is an assigned account property. Personal scope here means the signed-in account, '
              'not a population of business records. Page access, configured action permission and record '
              'scope are separate. A role title or visible page does not prove authority on a particular '
              'record or all team records. A workflow can further restrict an action.')


class OfflineGateway:
    def __init__(self, auth):
        self.auth = deepcopy(auth); self.events = []
    async def get_user_info(self, principal):
        self.events.append('identity')
        return {'ok': True, 'result': deepcopy(self.auth)}
    async def invoke(self, principal, name, arguments, **kwargs):
        self.events.append(name)
        assert name == 'knowledge.search', 'No record read or business operation is authorized by this overview'
        return {'ok': True, 'result': {'chunks': [{'id': 'boundary-source', 'document_id': 'offline-boundary-manual',
            'source_name': 'Controlled account-permission boundary excerpt', 'content': BOUNDARIES}]}}


class OfflinePlanner:
    def __init__(self, index=0, gap=False):
        self.index = index; self.gap = gap; self.calls = []
    async def generic_reader_json(self, *, schema, data, **kwargs):
        stage = schema['properties']['stage']['const']; self.calls.append(stage)
        if stage == 'input_normalization':
            return {'stage': stage, 'clauses': [{'sourceQuote': data['question'], 'english': TRACE['turns'][self.index]['canonicalQuestion']}]}
        if stage == 'task':
            return deepcopy(data['draft'] if data.get('phase') == 'knowledge_refinement' else TRACE['turns'][self.index]['task'])
        if stage == 'query_expansion': return expansion_fixture(data)
        context = data.get('currentAccountPermissionAssignment')
        assert context and context['originalTask']['requestedAttributes'] == original(self.index).requestedAttributes
        assert all(r['value'] != original(self.index).requestedAttributes[0] for r in data.get('requirements', []))
        if stage == 'knowledge_coverage':
            ref = data['knowledge'][0]['passages'][0]['sourceId']
            return {'stage': stage, 'checks': [{'requirementId': r['id'],
                'status': 'partial' if self.gap and r['kind'] == 'attribute' else 'covered',
                'missingEvidenceType': 'applicability_rule' if self.gap and r['kind'] == 'attribute' else 'none',
                'evidence': [{'sourceId': ref}], 'reason': 'This controlled excerpt states the general boundary.'}
                for r in data['requirements']]}
        if stage == 'knowledge_resolution':
            ref = data['knowledge'][0]['passages'][0]['sourceId']
            return {'stage': stage, 'route': '', 'pageName': '', 'routeEvidence': [],
                'answerEvidence': [{'sourceId': ref}],
                'missing': [c['requirementId'] for c in data['requirementCoverage'] if c['status'] != 'covered']}
        if stage == 'knowledge_answer_draft':
            text = ('صلاحيات الصفحة والإجراء ونطاق السجلات مفاهيم منفصلة. لا يثبت اسم الدور صلاحية على سجل معيّن أو جميع سجلات الفريق.'
                    if data['responseLanguage'] == 'ar' else BOUNDARIES)
            return {'stage': stage, 'blocks': [{'id': 'boundary', 'text': text,
                'requirementIds': [r['id'] for r in data['requirements']], 'quoteIndexes': [0]}]}
        if stage == 'knowledge_answer_review':
            return {'stage': stage, 'checks': [{'requirementId': r['id'],
                'status': 'partial' if self.gap and r['kind'] == 'attribute' else 'covered',
                'quoteIndexes': [0], 'reason': 'The stated boundary is in this controlled answer.'}
                for r in data['requirements']],
                'blockChecks': [{'blockId': 'boundary', 'supported': True, 'languageMatches': True,
                    'customerFacing': True, 'reason': 'Controlled cited permission boundary.'}]}
        raise AssertionError(stage)


def run_offline(tmp_path, index=0, auth=None, gap=False, tools=None, principal_id=USER):
    auth = deepcopy(TRACE['auth'] if auth is None else auth)
    (tmp_path / 'page-catalog.json').write_text(json.dumps([{'name': 'Authorized workspace',
        'routes': [{'path': route, 'title': route.rsplit('/', 1)[-1], 'isMenu': True, 'origin': 'configured-root'}
                   for route in routes_of(auth)]}]))
    gateway, planner = OfflineGateway(auth), OfflinePlanner(index, gap)
    reader = GenericKnowledgeReader(gateway, planner, portal_base_url='https://offline.invalid', artifacts_dir=str(tmp_path),
        **({'allowed_tools': tools} if tools is not None else {}))
    outcome = asyncio.run(reader.run(Principal(principal_id, 'offline-tenant', 'offline-current-request'),
        TRACE['turns'][index]['question'], conversation_context={'responseLanguage': TRACE['turns'][index]['language']}))
    return outcome.result.public_json(), outcome.audit_evidence, gateway, planner


@pytest.mark.parametrize('index', [0, 1])
def test_original_en_ar_full_offline_pipeline_preserves_intent_and_combines_actual_sources(tmp_path, index):
    payload, audit, gateway, planner = run_offline(tmp_path, index)
    assert payload['result'] == 'success', (payload['missing'], audit.get('rejectedPlans'))
    assert payload['requirementsSatisfied'] and payload['missing'] == []
    assert payload['intentState']['task']['requestedAttributes'] == original(index).requestedAttributes
    assert payload['intentState']['originalQuestion'] == TRACE['turns'][index]['question']
    assert payload['requirements'] == requirements_for(original(index))
    assert audit['requirementCoverage'] == payload['requirementCoverage']
    assert not payload.get('capabilityIntroduction')
    assert set(gateway.events) == {'identity', 'knowledge.search'}
    assert 'source_selection' not in planner.calls
    answer = render_generic_answer(payload, TRACE['turns'][index]['language'])
    assert ('Foreign Media Manager' if index == 0 else 'مدير الإعلام الأجنبي') in answer
    assert '/api/' not in answer and 'permissionRef' not in answer


@pytest.mark.parametrize('index', [0, 1])
def test_original_pipeline_keeps_real_boundary_gap_even_with_valid_current_actions(tmp_path, index):
    payload, audit, _, _ = run_offline(tmp_path, index, gap=True)
    assert payload['result'] == 'not_confirmed' and not payload['requirementsSatisfied']
    assert payload['currentPermissionCoverageComplete']
    assert next(c for c in payload['requirementCoverage'] if c['id'] == 'attribute_1')['status'] != 'satisfied'
    assert next(c for c in payload['knowledgeRequirementCoverage'] if c['requirementId'] == 'attribute_1')['status'] == 'partial'
    assert audit['missing'] == payload['missing'] and payload['missing']


def test_missing_auth_actions_do_not_turn_knowledge_success_into_current_permission_success(tmp_path):
    auth = deepcopy(TRACE['auth'])
    for button in all_buttons(auth): button['status'] = '0'
    payload, audit, _, _ = run_offline(tmp_path, auth=auth)
    assert payload['result'] == 'not_confirmed' and not payload['requirementsSatisfied']
    assert 'configured_action_examples_unverified' in payload['missing']
    assert audit['requirementsSatisfied'] is False
    assert 'could not confirm' in render_generic_answer(payload).lower()


def test_account_switch_stops_before_any_planning_or_knowledge(tmp_path):
    payload, _, gateway, planner = run_offline(tmp_path, principal_id='new-account')
    assert payload['result'] == 'permission_denied'
    assert payload['missing'] == ['identity_mismatch']
    assert gateway.events == ['identity'] and planner.calls == []
    assert 'currentAccountPermissions' not in payload


def test_assistant_tool_list_cannot_rewrite_user_permission_examples(tmp_path):
    a, _, _, _ = run_offline(tmp_path, tools=['knowledge.search'])
    b, _, _, _ = run_offline(tmp_path, tools=['knowledge.search', 'admin.portal.read', 'fake.approve'])
    pa, pb = a['currentAccountPermissions'], b['currentAccountPermissions']
    assert pa['permissionProjectionHash'] == pb['permissionProjectionHash']
    assert pa['actionExamples'] == pb['actionExamples']


def test_known_role_info_label_can_fill_localized_label_absence_but_code_cannot():
    auth = deepcopy(TRACE['auth'])
    for row in auth['data']['listRoles']:
        row.pop('nameEn', None); row.pop('nameAr', None)
    value = project(auth)
    assert [r['label'] for r in value['roles']] == ['Foreign Media Manager', 'Licensing Manager']
    auth['data']['rolesInfo'] = []
    value = project(auth)
    assert value['roles'] == [] and 'assigned_role_labels_unverified' in value['missing']


def test_examples_are_readable_not_internal_names_or_ambiguous_confirmation_labels():
    en, ar = project(), project(language='ar')
    assert [a['permissionRef'] for a in en['actionExamples']] == [a['permissionRef'] for a in ar['actionExamples']]
    for example in en['actionExamples']:
        assert example['label'].casefold() not in {'confirm', 'save', 'ok', 'submit', 'cancel', 'close'}
        assert 'Table' not in example['label'] and 'Datails' not in example['pageLabel']


def test_sensitive_labels_are_not_hashed_as_display_facts_then_changed_by_final_redaction():
    auth = deepcopy(TRACE['auth'])
    for row in auth['data']['listRoles']:
        row['nameEn'] = row['nameAr'] = 'runtime-secret'
    for info in auth['data']['rolesInfo']: info['roleName'] = 'runtime-secret'
    value = project(auth, secrets=('runtime-secret',))
    assert not value['roles'] and 'assigned_role_labels_unverified' in value['missing']
    assert projection_valid(value, RECEIPT)
    assert 'runtime-secret' not in render_permissions(value, 'en')


@pytest.mark.parametrize('mode', ['tree_missing', 'bad_button_list', 'oversize', 'duplicate_code'])
def test_malformed_tree_cannot_be_reported_as_complete_auth_evidence(mode):
    auth = deepcopy(TRACE['auth'])
    if mode == 'tree_missing': auth['data']['listSysPermission'] = None
    if mode == 'bad_button_list': auth['data']['listSysPermission'][0]['buttonList'] = {'permissionCode': 'approve'}
    if mode == 'oversize': auth['data']['listSysPermission'] *= 201
    if mode == 'duplicate_code':
        buttons = all_buttons(auth); buttons[1]['permissionCode'] = buttons[0]['permissionCode']
    value = project(auth, catalog=[{'routes': routes_of(TRACE['auth'])}])
    assert 'permission_tree_unverified' in value['missing'] and not value['actionExamples']


@pytest.mark.parametrize('index', [0, 1])
def test_original_current_eligibility_failure_cannot_be_silenced_in_general_knowledge_guard(index):
    from app.generic_reader import KnowledgeStore
    from app.reader_knowledge_coverage import KnowledgeCoverage, knowledge_requirements, validate_coverage
    kb = KnowledgeStore(); kb.add({'chunks': [{'id': 'definition', 'document_id': 'definition', 'content': BOUNDARIES}]})
    ref = kb.prompt()[0]['passages'][0]['sourceId']
    task = original(index)
    checks = [{'requirementId': r['id'], 'status': 'partial' if r['id'] == 'attribute_0' else 'covered',
        'missingEvidenceType': 'current_eligibility' if r['id'] == 'attribute_0' else 'none',
        'reason': 'A static manual cannot establish the current account action set.', 'evidence': [{'sourceId': ref}]}
        for r in knowledge_requirements(task)]
    with pytest.raises(PipelineError, match='knowledge_gap_outside_task_scope'):
        validate_coverage(KnowledgeCoverage(stage='knowledge_coverage', checks=checks), task, kb)


def test_actual_record_request_enters_original_read_pipeline_without_role_summary(tmp_path):
    requested = original(businessObject='application', requestedGrain='application', needsLiveData=True,
        requestedAttributes=['approval eligibility'], recordIdentity='ML-123', slotUpdates=[])
    class Planner(OfflinePlanner):
        async def generic_reader_json(self, *, schema, data, **kwargs):
            if schema['properties']['stage']['const'] == 'task': return requested.model_dump()
            return await super().generic_reader_json(schema=schema, data=data, **kwargs)
    class StopAtOrdinaryRead(GenericKnowledgeReader):
        async def search(self, *args, **kwargs):
            assert not getattr(self, 'role_permission_assignment', None)
            raise PipelineError('offline_stop_at_ordinary_business_read', 'runtime')
    (tmp_path / 'page-catalog.json').write_text('[]')
    reader = StopAtOrdinaryRead(OfflineGateway(TRACE['auth']), Planner(), portal_base_url='https://offline.invalid', artifacts_dir=str(tmp_path))
    payload = asyncio.run(reader.run(Principal(USER, 'tenant', 'rid'), 'Can I approve ML-123 in my current role?')).result.public_json()
    assert 'currentAccountPermissions' not in payload
    assert payload['intentState']['task']['recordIdentity'] == 'ML-123'
    assert payload['missing'] == ['offline_stop_at_ordinary_business_read']


def test_captured_permission_tree_has_examples_in_the_real_v34_authorized_catalog():
    from app.reader_context import load_catalog
    from app.portal_reader import PortalReadRequest, ReadOnlyPortalPolicy
    auth = deepcopy(TRACE['auth'])
    permission = permission_context_from_user_info(auth)
    policy = ReadOnlyPortalPolicy('https://portal.test')
    authorized = lambda route: not policy.validate(PortalReadRequest(route, ({'type': 'observe'},)), permission)
    catalog, version = load_catalog(Path(__file__).resolve().parents[2] / 'artifacts', authorized)
    receipt = {**RECEIPT, 'catalogVersion': version}
    value = project(auth, catalog=catalog, authorized=authorized, catalog_version=version, receipt=receipt)
    assert projection_valid(value, receipt) and value['actionExamples'] and not value['missing']
    assert all(authorized(row['route']) and any(row['route'] in page['routes'] for page in catalog)
               for row in value['actionExamples'])


def test_fresh_auth_can_satisfy_live_dependency_without_rewriting_original_flag():
    task = original(needsLiveData=True)
    assigned = partition(task=task)
    assert assigned['originalTask'].needsLiveData is True and task.needsLiveData is True
    assert assigned['knowledgeTask'].needsLiveData is False
    assert projection_valid(assigned['projection'], RECEIPT)
    result = merge_result(successful_knowledge_payload(assigned), assigned,
                          {'status': 'active', 'task': task.model_dump()})
    assert result['requirementsSatisfied'] and result['intentState']['task']['needsLiveData'] is True
