"""Cancellation succeeds only when the requested list is freshly verified."""
import asyncio
import json

import pytest

from app.portal_reader import ReaderOutcome, ReaderResult, _native_filter_outcome
from app.reader_intent import resolve_literal_filter_followup
from app.service import reader_evidence_only_response, DSHService

QUESTION = 'Cancel that filter and return to the task list.'
PAGE = '/inspection/tasks'
CONTEXT = {'previousIntent': {'page': PAGE, 'selectedState': 'Queued Tasks',
                            'question': 'Open the Filter surface and list its fields without applying changes.'}}
EXECUTIONS = [{'status': 'passed', 'input': {'startPath': PAGE,
              'actionTypes': ['show_filter', 'dismiss_overlay']}}]


def observation():
    return {'readHealth': {'healthy': True}, 'dialogs': [],
            'sectionSummaries': [{'nodeId': 'tasks', 'kind': 'table',
                'columnHeaders': ['Task No.', 'Status'], 'selectedState': 'Queued Tasks',
                'selectedTabPath': ['Queued Tasks'],
                'rowFields': [{'Task No.': 'IN-2026-0141753', 'Status': 'Queued'}]}]}


def cancel(obs, executions=None, context=None, status='success'):
    old = ReaderResult(status=status, summary='Control result', page=PAGE, facts=('stale explanation without records',))
    return _native_filter_outcome(ReaderOutcome(old, {'observation': obs}), QUESTION,
                                  EXECUTIONS if executions is None else executions,
                                  CONTEXT if context is None else context).result


def test_cancel_return_preserves_fresh_list_records_and_view():
    result = cancel(observation())
    assert result.status == 'success' and result.answer_shape == 'list'
    assert json.loads(result.facts[0]) == {'Task No.': 'IN-2026-0141753', 'Status': 'Queued'}
    assert result.selected_state == 'Queued Tasks' and result.source_section == 'tasks'
    assert result.workflow_state == 'filter_return_verified'
    assert 'stale explanation' not in str(result.facts)


def test_empty_requires_native_empty_table_not_absence_of_rows():
    obs = observation(); obs['sectionSummaries'][0]['rowFields'] = []
    assert cancel(obs).status == 'not_confirmed'
    obs['sectionSummaries'][0]['emptyState'] = 'No data'
    result = cancel(obs)
    assert result.status == 'no_data' and result.facts == ()
    assert result.selected_state == 'Queued Tasks'


@pytest.mark.parametrize('kind', ['missing', 'dashboard', 'multiple', 'other_view', 'other_page'])
def test_cancel_does_not_substitute_another_list_or_global_empty_state(kind):
    obs = observation(); context = CONTEXT
    if kind == 'missing': obs['sectionSummaries'] = []
    if kind == 'dashboard':
        obs['sectionSummaries'][0].update(kind='cards', rowFields=[], emptyState='No data')
    if kind == 'multiple':
        obs['sectionSummaries'].append({**obs['sectionSummaries'][0], 'nodeId': 'other'})
    if kind == 'other_view': obs['sectionSummaries'][0]['selectedState'] = 'Completed'
    if kind == 'other_page': context = {'previousIntent': {'page': '/inspection/violations'}}
    result = cancel(obs, context=context)
    assert result.status == 'not_confirmed' and not result.facts
    assert result.workflow_state == 'filter_return_unverified'


@pytest.mark.parametrize('status', ['load_failed', 'no_permission'])
def test_list_recovery_never_overrides_access_or_loading_failure(status):
    assert cancel(observation(), status=status).status == status


def test_unhealthy_observation_is_not_success_or_no_data():
    obs = observation(); obs['readHealth']['healthy'] = False
    assert cancel(obs).status == 'load_failed'


@pytest.mark.parametrize('actions', [['observe'], ['show_filter', 'apply_filter']])
def test_unverified_cancel_is_not_marked_restored(actions):
    result = cancel(observation(), executions=[{'status': 'passed', 'input': {'actionTypes': actions}}],
                    status='success')
    assert result.status == 'not_confirmed' and result.workflow_state != 'filter_return_verified'


def test_open_dialog_does_not_prove_cancellation_even_if_rows_are_visible():
    obs = observation(); obs['dialogs'] = ['Filter']
    assert cancel(obs).missing == ('filter_cancellation_unverified',)


def test_open_filter_keeps_view_for_followup():
    obs = observation(); obs.update(dialogs=['Filter'], filterDialogFields=['Priority'])
    result = _native_filter_outcome(ReaderOutcome(ReaderResult(status='not_confirmed', summary='', page=PAGE),
        {'observation': obs}), 'Open the Filter surface and list its fields without applying changes.',
        [{'status': 'passed', 'input': {'actionTypes': ['show_filter']}}]).result
    assert result.status == 'success' and result.selected_state == 'Queued Tasks'


def test_return_list_intent_is_not_a_control_only_detail_request():
    result = resolve_literal_filter_followup(QUESTION, CONTEXT)
    assert result.public_json()['slots']['answerShape']['value'] == 'list'
    assert resolve_literal_filter_followup('Cancel that filter.', CONTEXT).public_json()['slots']['answerShape']['value'] == 'detail'


def test_restored_list_answer_includes_records_without_requesting_another_question():
    result = cancel(observation()).public_json()
    answer = reader_evidence_only_response(result, 'en', question=QUESTION)
    assert 'IN-2026-0141753' in answer and 'same task list' in answer
    assert 'read-only view' in answer and 'bounded sample' in answer
    assert 'ask again' not in answer.lower() and 'no task records' not in answer.lower()
    assert '只读视图' in reader_evidence_only_response(result, 'zh', question=QUESTION)
    # A model cannot turn the restored list back into a control-only disclaimer.
    output = asyncio.run(DSHService._natural_reader_response(object(), QUESTION, result, 'en'))
    assert output == (answer, False, 'deterministic_filter_return')


def test_empty_and_unverified_answers_are_distinct():
    obs = observation(); obs['sectionSummaries'][0]['rowFields'] = []
    unknown = reader_evidence_only_response(cancel(obs).public_json(), 'en', question=QUESTION)
    obs['sectionSummaries'][0]['emptyState'] = 'No data'
    empty = reader_evidence_only_response(cancel(obs).public_json(), 'en', question=QUESTION)
    assert 'does not mean there are no tasks' in unknown
    assert 'currently shows no matching records' in empty
