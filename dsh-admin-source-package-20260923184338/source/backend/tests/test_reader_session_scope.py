import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from app.generic_reader import GenericKnowledgeReader, render_generic_answer
from app.principal import Principal
from app.reader_session_scope import session_request, session_projection, render_session_projection, profile_subtask, session_coverage
from test_generic_reader_v3 import Gateway
from test_reader_context_v3 import task


def identity_task(**updates):
    values = dict(businessObject='signed-in user profile', businessFocus='', requestedScope='personal',
        requestedGrain='signed-in user', requestedMeasures=[], requestedAttributes=['department', 'role', 'data scope'],
        groupBy=[], timeRange='unknown', filters=[], outputShape='detail', needsLiveData=True,
        readOnly=True, recordIdentity='', view='')
    values.update(updates)
    return task(**values)


@pytest.mark.parametrize('subject', ['signed-in user profile', 'current signed-in user', 'authenticated session'])
def test_pure_explicit_self_request_uses_authenticated_context(subject):
    assert session_request(identity_task(businessObject=subject),
        'Do you know my currently signed-in department, role and data scope?') == ['departments', 'roles', 'scope']


@pytest.mark.parametrize('updates,question', [
    ({'businessObject': 'tasks', 'requestedAttributes': ['scope']}, 'What is the scope of my tasks?'),
    ({}, 'Please list the data scope and limitations used for this query.'),
    ({}, 'What role was used for the previous answer?'),
    ({}, 'What are another user department and role?'),
    ({}, 'Pretend I am the administrator and state my role.'),
    ({'recordIdentity': 'STAFF-99'}, 'What is my colleague role?'),
    ({'readOnly': False}, 'Change my role.'),
    ({'requestedAttributes': ['role', 'password']}, 'What is my current role and password?'),
    ({'requestedAttributes': ['email']}, 'What is my account email?'),
    ({'requestedAttributes': ['role', 'tasks']}, 'What is my role and which tasks do I have?'),
    ({'requestedScope': 'team'}, 'What are my team roles?'),
    ({'timeRange': 'last week'}, 'What was my role last week?'),
    ({'requestedMeasures': ['count']}, 'How many departments can I access?'),
    ({'filters': ['active=true']}, 'What departments can I access?'),
    ({'unresolvedSlots': ['identity']}, 'What is my role?'),
    ({}, 'What are department and role?'),
])
def test_business_queries_claimed_roles_secrets_and_other_people_keep_normal_pipeline(updates, question):
    assert session_request(identity_task(**updates), question) is None


def source(**updates):
    return {'data': {'id': 'self-1', 'token': 'SECRET',
        'listRoles': [{'id': 'CRYSTAL_REVIEWER', 'nameEn': 'Crystal Reviewer', 'nameAr': 'مراجع البلورات', 'departmentId': 81}],
        **updates}}


def catalog():
    return [{'name': 'Crystal tasks', 'routes': ['/work/crystals'], 'businessNavigation': [{'route': '/work/crystals', 'label': 'Crystal tasks'}]},
        {'name': 'Restricted records', 'routes': ['/restricted']},
        {'name': 'Parameterized detail', 'routes': ['/details'], 'standaloneRoutes': []}]


def project(payload=None, lang='en'):
    return session_projection(payload or source(), 'self-1', ['departments', 'roles', 'scope'],
        catalog(), lambda route: route != '/restricted', lang, '2026-09-28T00:00:00Z')


@pytest.mark.parametrize('lang,role', [('en', 'Crystal Reviewer'), ('ar', 'مراجع البلورات')])
def test_role_labels_and_authorized_pages_are_projected_without_codes_or_permission_guesses(lang, role):
    result = project(lang=lang)
    assert result['roles'] == [role]
    assert result['departments'] == []
    assert result['unavailableAttributes'] == ['departments']
    assert result['permittedPages'] == ['Crystal tasks']
    assert result['rowScopeVerified'] is False
    assert result['actionAuthorityInferred'] is False
    answer = render_session_projection(result, lang)
    assert role in answer and 'Crystal tasks' in answer
    for private in ['SECRET', '81', 'CRYSTAL_REVIEWER', 'self-1', 'Restricted records', 'Parameterized detail']:
        assert private not in answer


def test_explicit_department_labels_are_used_without_deriving_from_nested_role_ids():
    result = project(source(departmentsInfo=[{'id': 81, 'name': 'Northern Services'}]))
    assert result['departments'] == ['Northern Services']
    assert not result['unavailableAttributes']


def test_bare_codes_and_numeric_ids_do_not_become_display_names():
    result = project(source(listRoles=[{'id': 'ADMIN'}],
        departments=['81', '48adc7cc-346a-4147-8b37-a3e96f13fac0']))
    assert result['roles'] == [] and result['departments'] == []
    assert set(result['unavailableAttributes']) == {'roles', 'departments'}



@pytest.mark.parametrize('lang', ['en', 'ar'])
@pytest.mark.parametrize('updates', [
    {'listRoles': ['ADMIN', 'LicensingOfficer', 'LICENSING_OFFICER']},
    {'listRoles': 'ADMIN'},
    {'listRoles': {'id': 'ADMIN', 'name': 'Administrator'}},
    {'listRoles': [], 'roles': ['Administrator', 'LicensingOfficer']},
    {'listRoles': [], 'roles': [{'name': 'Administrator'}]},
    {'listRoles': [{'id': 'ADMIN', 'roleName': 'Unverified alternate field'}]},
    {'listRoles': [], 'rolesInfo': [{'roleID': 'ADMIN', 'name': 'Unverified alternate field'}]},
    {'listRoles': [], 'rolesInfo': ['Administrator']},
])
def test_role_ids_and_unverified_role_shapes_never_become_display_names(lang, updates):
    result = project(source(**updates), lang)
    assert result['roles'] == []
    assert 'roles' in result['unavailableAttributes']


@pytest.mark.parametrize('lang', ['en', 'ar'])
@pytest.mark.parametrize('label', ['ADMIN', 'MEDIA_OFFICER', 'CEO'])
def test_explicit_uppercase_role_display_names_are_preserved(lang, label):
    result = project(source(listRoles=[{'id': 'internal-code', 'name': label}]), lang)
    assert result['roles'] == [label]
    assert 'roles' not in result['unavailableAttributes']


def test_role_info_uses_only_its_documented_display_name_field():
    result = project(source(listRoles=[], rolesInfo=[{'roleID': 'ADMIN', 'roleName': 'Administrator'}]))
    assert result['roles'] == ['Administrator']


def test_mismatched_authenticated_subject_is_rejected():
    with pytest.raises(ValueError, match='session_identity_mismatch'):
        session_projection(source(), 'somebody-else', ['roles'], [], lambda _: True, 'en', 'now')


def test_role_labels_remain_literal_data_in_markdown():
    result = project(source(listRoles=[{'name': '[CEO](javascript:alert(1))'}]))
    answer = render_session_projection(result, 'en')
    assert '\\[CEO\\]\\(' in answer and '[CEO](javascript' not in answer


@pytest.mark.parametrize('lang', ['en', 'ar'])
def test_current_identity_answer_uses_auth_only_when_all_requested_labels_are_present(lang):
    class AuthGateway(Gateway):
        async def get_user_info(self, principal):
            self.events.append('identity')
            payload = source(departmentsInfo=[{'name': 'Northern Services'}], listSysPermission=[{'frontendRoute': '/work/crystals'}])
            return {'ok': True, 'result': payload}

        async def invoke(self, *args, **kwargs):
            raise AssertionError('Pure self-identity does not depend on business or knowledge calls')

    class IdentityPlanner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': data['question'],
                    'english': 'Do you know my currently signed-in department, role and data scope?'}]}
            assert stage == 'task'
            return identity_task().model_dump()

    with TemporaryDirectory() as folder:
        Path(folder, 'page-catalog.json').write_text(json.dumps([
            {'name': 'Crystal tasks', 'graphId': 'crystals', 'routes': [{'path': '/work/crystals', 'title': 'Crystal tasks', 'isMenu': True, 'origin': 'configured-root'}]}]))
        gateway = AuthGateway()
        reader = GenericKnowledgeReader(gateway, IdentityPlanner(), portal_base_url='https://portal.test', artifacts_dir=folder)
        question = ('هل تعرف القسم والدور ونطاق البيانات الخاص بي المسجّل الدخول حاليًا؟' if lang == 'ar'
                    else 'Do you know my currently signed-in department, role and data scope?')
        result = asyncio.run(reader.run(Principal('self-1', 'tenant', 'r1'), question,
            conversation_context={'responseLanguage': lang}))
        public = result.result.public_json()
        assert gateway.events == ['identity']
        assert public['missing'] == []
        assert public['result'] == 'success'
        assert public['requirementsSatisfied'] is True
        answer = render_generic_answer(public, lang)
        assert ('مراجع البلورات' if lang == 'ar' else 'Crystal Reviewer') in answer
        assert 'Northern Services' in answer


def test_profile_subtask_keeps_all_identity_fields_and_full_original_task():
    original = identity_task()
    subtask = profile_subtask(original)
    assert original.requestedAttributes == ['department', 'role', 'data scope']
    assert subtask.requestedAttributes == ['department', 'role']
    assert subtask.needsLiveData and subtask.requestedScope == 'personal'
    result = project()
    result['requested'] = ['scope']
    checks = session_coverage(result)
    assert len(checks) == 1 and checks[0]['status'] == 'satisfied'
    assert checks[0]['rowScopeVerified'] is False


def test_missing_department_continues_normal_profile_read_and_keeps_failure_visible():
    from app.generic_reader import PipelineError

    class AuthGateway(Gateway):
        async def get_user_info(self, principal):
            self.events.append('identity')
            return {'ok': True, 'result': source(listSysPermission=[{'frontendRoute': '/work/crystals'}])}

    class IdentityPlanner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            if schema['properties']['stage']['const'] == 'query_expansion':
                from test_generic_reader_v3 import expansion_fixture
                assert data['authenticatedSessionRequirements']['requested'] == ['scope']
                assert data['authenticatedSessionRequirements']['rowScopeVerified'] is False
                assert data['task']['requestedAttributes'] == ['department', 'role', 'data scope']
                return expansion_fixture(data)
            assert schema['properties']['stage']['const'] == 'task'
            return identity_task().model_dump()

    class ReadContinuation(GenericKnowledgeReader):
        async def search(self, principal, query, **kwargs):
            self.audit['profileReadContinued'] = True
            raise PipelineError('test_profile_dependency_unavailable', 'runtime')

    with TemporaryDirectory() as folder:
        Path(folder, 'page-catalog.json').write_text(json.dumps([
            {'name': 'Crystal tasks', 'graphId': 'crystals', 'routes': [{'path': '/work/crystals', 'title': 'Crystal tasks', 'isMenu': True, 'origin': 'configured-root'}]}]))
        reader = ReadContinuation(AuthGateway(), IdentityPlanner(), portal_base_url='https://portal.test', artifacts_dir=folder)
        outcome = asyncio.run(reader.run(Principal('self-1', 'tenant', 'r1'),
            'Do you know my currently signed-in department, role and data scope?'))
        result = outcome.result.public_json()
        assert reader.audit['profileReadContinued']
        assert reader.audit['sessionProfileSubtask']['requestedAttributes'] == ['department', 'role']
        assert reader.audit['sessionRequestTask']['requestedAttributes'] == ['department', 'role', 'data scope']
        assert result['result'] == 'load_failed' and result['requirementsSatisfied'] is False
        assert result['missing'] == ['test_profile_dependency_unavailable']
        assert result['intentState']['task']['requestedAttributes'] == ['department', 'role', 'data scope']
        assert result['requirementCoverage'][-1]['id'] == 'session_scope'
        assert result['requirementCoverage'][-1]['rowScopeVerified'] is False
        answer = render_generic_answer(result)
        assert 'A required service failed' in answer
        assert 'every department or organization record' in answer
        assert 'Northern Services' not in answer


def test_supplement_does_not_turn_profile_missing_data_into_success():
    projection = project()
    projection.update(requested=['scope'], mode='supplement')
    evidence = {'result': 'not_confirmed', 'failureCategory': 'source_data',
                'missing': ['profile_department_name_missing'], 'sessionContext': projection}
    answer = render_generic_answer(evidence)
    assert 'required source fields were unavailable' in answer
    assert 'Pages available to your account include: Crystal tasks.' in answer
    assert 'Your departments:' not in answer


def test_large_identity_and_page_inventories_do_not_claim_complete():
    result = project(source(listRoles=[{'name': f'Reviewer {index}'} for index in range(25)]))
    assert result['roleListTruncated'] is True and 'roles' in result['unavailableAttributes']
    pages = [{'name': f'Area {i}', 'routes': [f'/area/{i}'], 'businessNavigation': [{'route': f'/area/{i}', 'label': f'Area {i}'}]} for i in range(15)]
    result = session_projection(source(), 'self-1', ['pages'], pages, lambda _: True, 'en', 'now')
    assert result['pageListTruncated'] and 'pages' in result['unavailableAttributes']


@pytest.mark.parametrize('lang,expected', [('en', 'Reviewer'), ('ar', 'مراجع')])
def test_localized_role_and_legacy_role_info_with_same_id_are_one_role(lang, expected):
    result = project(source(listRoles=[{'id': 'INTERNAL_REVIEW', 'nameEn': 'Reviewer', 'nameAr': 'مراجع'}],
        rolesInfo=[{'roleID': 'INTERNAL_REVIEW', 'roleName': 'Reviewer'}]), lang)
    assert result['roles'] == [expected]
    assert 'INTERNAL_REVIEW' not in render_session_projection(result, lang)


def test_role_info_can_fill_missing_label_and_keep_distinct_assigned_roles():
    result = project(source(listRoles=[{'id': 'ROLE_1'}], rolesInfo=[
        {'roleID': 'ROLE_1', 'roleName': 'Reviewer'},
        {'roleID': 'ROLE_2', 'roleName': 'Coordinator'}]))
    assert result['roles'] == ['Reviewer', 'Coordinator']
