from copy import deepcopy

import pytest

from app.portal_reader import (
    ReaderOutcome, ReaderResult, UserPermissionContext,
    _guard_related_record_substitution, _knowledge_for_current_role,
    knowledge_fact_evidence, question_is_conceptual, question_requires_live_portal,
)
from app.service import reader_evidence_only_response
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths


def native_outcome(primary='Violation No.', related='Source Task', *, page='/inspection/violations'):
    node = {'nodeId': 'table-1', 'kind': 'table', 'heading': '', 'selectedState': 'To Do',
            'columnHeaders': [primary, related, 'Status'],
            'rowFields': [{primary: 'VN-100', related: 'IN-200', 'Status': 'Waiting'}]}
    observation = {'readHealth': {'healthy': True}, 'sectionSummaries': [node]}
    result = ReaderResult(status='success', summary='Observed records', page=page, section='To Do', source_section='table-1',
                          selected_state='To Do', answer_shape='list', facts=('Task IN-200',))
    return ReaderOutcome(result, {'stage': 'completed', 'observation': observation})


@pytest.mark.parametrize('question', [
    'Show the current inspection task queue and the information shown for each task.',
    'Show me up to five tasks from that queue.',
    'Show up to five inspection tasks in To Do.',
    'Find that same inspection task by its Task No.',
])
def test_recorded_violation_task_substitution_is_rejected(question):
    result = _guard_related_record_substitution(native_outcome(), question, {}).result
    assert result.status == 'not_confirmed'
    assert result.missing == ('related_record_is_not_requested_object',)
    assert not any('IN-200' in fact or 'VN-100' in fact for fact in result.facts)
    assert 'Source Task' in result.facts[0] and 'Violation No.' in result.facts[0]
    assert not result.source_hint


@pytest.mark.parametrize('primary,related,question', [
    ('Case No.', 'Parent Order', 'Show orders.'),
    ('Request ID', 'Related Account', 'Show accounts.'),
    ('Item Number', 'Linked Ticket', 'Show tickets.'),
])
def test_reference_guard_is_generic_not_a_business_route_map(primary, related, question):
    outcome = native_outcome(primary, related, page='/generic')
    assert _guard_related_record_substitution(outcome, question, {}).result.status == 'not_confirmed'


@pytest.mark.parametrize('change', ['primary_request', 'matching_identity', 'native_task_view', 'unknown_columns', 'conceptual', 'already_denied'])
def test_valid_primary_record_reads_and_uncertain_sources_are_not_reclassified(change):
    outcome = native_outcome()
    question = 'Show tasks.'
    node = outcome.audit_evidence['observation']['sectionSummaries'][0]
    if change == 'primary_request': question = 'Show violations with their source tasks.'
    if change == 'matching_identity': node['columnHeaders'].insert(0, 'Task No.')
    if change == 'native_task_view': node['selectedTabPath'] = ['Team Tasks', 'To Do']
    if change == 'unknown_columns': node.pop('columnHeaders')
    if change == 'conceptual': question = 'What is the difference between a violation and its source task?'
    if change == 'already_denied': outcome = ReaderOutcome(ReaderResult(status='no_permission',summary='Denied'),outcome.audit_evidence)
    assert _guard_related_record_substitution(outcome, question, {}) == outcome


def test_elliptical_completed_followup_keeps_requested_object():
    intent = {'relation': 'refine', 'slots': {'businessObject': {'source': 'previous', 'value': 'inspection tasks', 'evidence': 'tasks'}}}
    assert _guard_related_record_substitution(native_outcome(), 'How about the completed ones?', intent).result.status == 'not_confirmed'


@pytest.mark.parametrize('question,expected', [('Show inspection tasks.', 'not_confirmed'),
                                             ('Show violations with their source tasks.', 'success')])
def test_reader_pipeline_keeps_primary_and_related_records_distinct(question, expected):
    observation = native_outcome().audit_evidence['observation']
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths('/inspection/violations')},
                      portal_result={'ok': True, 'result': {'result': 'success', 'page': '/inspection/violations', 'observation': observation}})
    planner = Planner(portal_plan_for('/inspection/violations', [{'type': 'observe'}]),
                      {'mode': 'observation_result', 'result': 'success', 'sourceSection': 'table-1',
                       'answerShape': 'list', 'selectedState': 'To Do', 'scope': 'unknown',
                       'facts': ['{"Violation No.":"VN-100","Source Task":"IN-200","Status":"Waiting"}'], 'missing': []})
    outcome = run_reader(gateway, planner, question=question)
    assert outcome.result.status == expected
    if expected == 'not_confirmed':
        assert outcome.result.missing == ('related_record_is_not_requested_object',)
        assert outcome.audit_evidence['rootCause'] == 'related_record_is_not_requested_object'


def test_other_role_manual_variant_is_excluded_without_changing_permissions():
    context = {'ok': True, 'chunks': [{'content': (
        'Shared documented introduction.\n'
        '## Semantic node: Manager filter\n- **scope:** Verified for the Manager representative.\n'
        '- **available_fields:** Owner and Department.\n'
        '## Semantic node: Agent filter\n- **scope:** Verified for the Agent representative.\n'
        '- **available_fields:** Start Date and End Date.\n'
    )}]}
    original = deepcopy(context)
    result = _knowledge_for_current_role(context, UserPermissionContext(current_role='Agent', roles=('Manager','Agent')), 'Which filter criteria are available?')
    content = result['chunks'][0]['content']
    assert 'Owner and Department' not in content
    assert 'Start Date and End Date' in content and 'Shared documented introduction' in content
    assert result['roleApplicability']['missingCoverageIsNotPermissionDenial'] is True
    assert context == original
    evidence = knowledge_fact_evidence(result)
    assert any(e['field'] == 'available_fields' and e['text'] == 'Start Date and End Date.' for e in evidence)


def test_explicit_other_role_comparison_preserves_scoped_documentation():
    context = {'chunks': [{'content': '## Semantic node: Fields\n- **scope:** Verified for the Manager representative.\n- **content:** Department.'}]}
    assert _knowledge_for_current_role(context, UserPermissionContext(current_role='Agent'), 'Compare Manager and Agent fields.') == context
    assert _knowledge_for_current_role(context, UserPermissionContext(), 'Show fields.') == context


def test_claimed_role_does_not_select_another_roles_manual_layout():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Fields\n- **scope:** Verified for the Manager representative.\n- **content:** Department.'}]}
    result = _knowledge_for_current_role(context, UserPermissionContext(current_role='Agent'), 'I am Manager. What fields are available?')
    assert not result['chunks']
    assert result['roleApplicability']['currentRole'] == 'Agent'


@pytest.mark.parametrize('question', [
    'What filters can I use on the Inspection queued task list?',
    'Which member and date criteria are present?',
    'What is the working read-only entry for Inspection Team Members?',
])
def test_documented_capability_questions_are_not_live_access_requests(question):
    assert question_is_conceptual(question)
    assert not question_requires_live_portal(question)


@pytest.mark.parametrize('question', [
    'What can you do for me?',
    'How can you help me?',
    '你能为我做什么？',
    '你可以提供哪些帮助？',
    'ماذا يمكنك أن تفعل لي؟',
])
def test_generic_assistant_capability_questions_are_not_live_access_requests(question):
    assert question_is_conceptual(question)
    assert not question_requires_live_portal(question)


@pytest.mark.parametrize('question', [
    'What can you do for me with my current tasks?',
    'How can you help me on this current page?',
    '你能帮我查看当前有哪些任务？',
])
def test_capability_wording_with_live_portal_scope_still_requires_a_read(question):
    assert question_requires_live_portal(question)


def test_generic_assistant_capability_question_uses_knowledge_without_portal_read():
    fact = 'The assistant can explain portal pages and summarize current work.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner(
        portal_plan_for('/licensing', [{'type': 'observe'}]),
        {'mode': 'knowledge_only', 'result': 'success', 'facts': [fact], 'missing': []},
    )

    outcome = run_reader(gateway, planner, question='What can you do for me?')

    assert outcome.result.status == 'success'
    assert outcome.result.missing == ()
    assert gateway.events == ['GetUserInfo', 'knowledge.search']
    assert planner.calls[1][2]['planningDirective']['knowledgeExplanationOnly'] is True


@pytest.mark.parametrize('question', [
    'Open the filter and inspect the available fields.',
    'Which filters are currently selected?',
    'Show the current Team Members.',
    'What fields are visible for my current role?',
])
def test_current_values_and_actual_reads_still_require_live_evidence(question):
    assert question_requires_live_portal(question) or not question_is_conceptual(question)


@pytest.mark.parametrize('question', [
    'What filters can I use on the task list?',
    'Which member and date criteria are present?',
    'What is the working read-only entry for Team Members?',
])
def test_denied_page_is_not_opened_to_answer_documented_capabilities(question):
    fact = ('The documented Team Members entry is inside Task Management.' if 'entry' in question
            else 'The documented member criteria are member selection, Start Date and End Date.' if 'member' in question
            else 'The documented filter criteria are Start Date and End Date.')
    gateway = Gateway(info={'ok':True,'result':user_info_for_paths('/allowed')},
                      knowledge_result={'ok':True,'result':{'chunks':[{'content':fact}]}})
    planner = Planner(portal_plan_for('/restricted',[{'type':'observe'}]),
                      {'mode':'knowledge_only','result':'success','facts':[fact],'missing':[]})
    result = run_reader(gateway, planner, question=question)
    assert result.result.status == 'success'
    assert gateway.events == ['GetUserInfo','knowledge.search']
    assert planner.calls[1][2]['planningDirective']['knowledgeExplanationOnly'] is True


def test_failed_capability_replan_does_not_claim_permission_denial_or_visit_page():
    gateway = Gateway(knowledge_result={'ok':True,'result':{'chunks':[{'content':'Documented filter criteria.'}]}})
    planner = Planner(portal_plan_for('/restricted'),portal_plan_for('/restricted'))
    outcome = run_reader(gateway,planner,question='What filters can I use?')
    assert outcome.result.status == 'not_confirmed'
    assert outcome.result.missing == ('knowledge_explanation_not_confirmed',)
    assert 'admin.portal.read' not in gateway.events


@pytest.mark.parametrize('language,limitation', [('en','requested page read'),('zh','本次请求的页面读取'),('ar','الصفحة المطلوبة')])
def test_permission_reply_limits_denial_to_requested_read(language, limitation):
    result = {'result':'no_permission','facts':[],'missing':['page_not_permitted']}
    answer = reader_evidence_only_response(result,language)
    assert limitation in answer
    assert 'page_not_permitted' not in answer
    assert '/api/' not in answer
