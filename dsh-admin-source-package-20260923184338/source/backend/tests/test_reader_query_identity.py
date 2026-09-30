from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.reader_query_identity import current_query_identity, query_scope_assignment

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_current_query_identity_trace.json').read_text())


def identity(auth=None, **changes):
    auth = deepcopy(TRACE['authResponse']) if auth is None else auth
    args = dict(user_id=TRACE['authResponse']['data']['id'], request_id='current-request',
                permission_receipt={'requestId': 'current-request', 'fingerprint': 'current-permissions', 'principalScopeRef': 'current-subject-and-permissions',
                                    'observedAt': TRACE['sourceAt']},
                request_started_at='2026-09-28T10:54:00Z', language='en')
    args.update(changes)
    return current_query_identity(auth, **args)


def test_real_native_staff_labels_do_not_invent_department_or_skip_profile_read():
    value = identity()
    assert value['verified']
    assert value['accountDisplayName'] == ' '.join(TRACE['authResponse']['data'][k] for k in ('firstName', 'lastName'))
    assert value['roles'] and not value['departments']
    assert value['remainingProfileAttributes'] == ['department']
    result = query_scope_assignment({'kind': 'query_scope', 'verified': True, 'principalScopeRef': 'current-subject-and-permissions', 'context': {'filterScope': 'actual previous receipt'}}, value)
    assert result['continueProfileRead'] and not result['complete']
    assert not value['rowScopeVerified'] and not value['queryScopeEstablished']


@pytest.mark.parametrize('changes', [
    {'user_id': 'another-user'}, {'request_id': 'another-request'},
    {'permission_receipt': {'requestId': 'current-request', 'fingerprint': 'x', 'principalScopeRef': 'current-subject-and-permissions', 'observedAt': '2026-09-27T00:00:00Z'}},
    {'permission_receipt': {'requestId': 'current-request', 'fingerprint': 'x', 'principalScopeRef': 'current-subject-and-permissions', 'observedAt': '2026-09-28T10:54:30'}},
    {'permission_receipt': {'requestId': 'current-request', 'observedAt': TRACE['sourceAt']}},
])
def test_other_identity_old_or_incomplete_receipts_cannot_prove_current_caller(changes):
    assert not identity(**changes)['verified']


def test_department_identifier_and_raw_role_codes_do_not_become_labels():
    auth = deepcopy(TRACE['authResponse'])
    auth['data'].update(departmentId=23, departmentsInfo=[{'id': 'dept-23'}],
                        listRoles=['MANAGER_ROLE_123'], rolesInfo=[], roles=['OFFICER_CODE_456'])
    value = identity(auth)
    assert value['departments'] == [] and value['roles'] == []
    assert value['remainingProfileAttributes'] == ['department', 'role']


@pytest.mark.parametrize('historical', [{}, {'kind': 'simplify', 'verified': True},
    {'kind': 'query_scope', 'verified': False, 'reason': 'previous_query_receipt_unverified'}])
def test_even_complete_current_profile_cannot_repair_missing_historical_scope(historical):
    auth = deepcopy(TRACE['authResponse'])
    auth['data']['departmentsInfo'] = [{'name': 'Explicit authenticated display label'}]
    current = identity(auth)
    assert current['identityComplete']
    assignment = query_scope_assignment(historical, current)
    assert not assignment['complete']
    assert not assignment['profileCanReplaceHistoricalQueryReceipt']
    assert not assignment['rowScopeVerifiedByIdentity']


def test_current_caller_attachment_preserves_exact_previous_query_receipt():
    prior = {'kind': 'query_scope', 'verified': True, 'sourceRequestId': 'prior-read', 'principalScopeRef': 'current-subject-and-permissions',
             'observedAt': ['2026-09-28T10:00:00Z'], 'observedFilters': ['Status: Pending'],
             'context': {'filterScope': 'only the previously read bounded task list'},
             'completeness': 'bounded', 'rowScopeVerified': False}
    expected = deepcopy(prior)
    assignment = query_scope_assignment(prior, identity())
    assert assignment['historicalQuery'] == expected and prior == expected
    assignment['historicalQuery']['observedFilters'].append('changed only in returned copy')
    assert prior == expected


def test_other_subject_history_cannot_be_attached_as_this_accounts_query():
    auth = deepcopy(TRACE['authResponse'])
    auth['data']['departmentsInfo'] = [{'name': 'Verified current label'}]
    prior = {'kind': 'query_scope', 'verified': True, 'principalScopeRef': 'another-subject'}
    result = query_scope_assignment(prior, identity(auth))
    assert not result['historicalScopeVerified'] and not result['complete']
