"""Complete bounded raw-tree hashing remains separate from action eligibility."""
from copy import deepcopy
import json

import pytest

from app.reader_role_permissions import permission_projection, _raw_permission_projection
from test_reader_role_permissions import TRACE, USER, START, RECEIPT


def button(code='view-details'):
    return {'permissionCode': code, 'permissionType': 'B', 'frontendRoute': '/allowed',
        'key': '/allowed-' + code, 'status': '1', 'permissionNameEn': 'View Details',
        'permissionNameAr': 'عرض التفاصيل'}


def page(code='page', **updates):
    return {'permissionCode': code, 'permissionType': 'M', 'frontendRoute': '/allowed',
        'status': '1', 'permissionNameEn': 'My Requests', 'permissionNameAr': 'طلباتي',
        'buttonList': [button(code + '-action')], 'children': [], **updates}


def projection(rows, language='en'):
    auth = deepcopy(TRACE['auth']); auth['data']['listSysPermission'] = deepcopy(rows)
    return permission_projection(auth, user_id=USER, request_id=RECEIPT['requestId'],
        principal_scope_ref=RECEIPT['principalScopeRef'], catalog_version=RECEIPT['catalogVersion'],
        permission_receipt=deepcopy(RECEIPT), request_started_at=START,
        catalog=[{'routes': ['/allowed']}], authorized=lambda route: route == '/allowed', language=language)


@pytest.mark.parametrize('parent', [{'status': '0'}, {'permissionType': 'D'}])
@pytest.mark.parametrize('branch', ['buttonList', 'children'])
@pytest.mark.parametrize('field', ['permissionCode', 'frontendRoute', 'status'])
def test_hidden_parent_descendant_changes_hash_but_never_add_actions(parent, branch, field):
    hidden = page('hidden', children=[page('nested')], **parent)
    rows = [page('visible'), hidden]
    before = projection(rows)
    changed = deepcopy(rows); changed[1][branch][0][field] = 'changed'
    after = projection(changed)
    visible = projection(rows[:1])
    assert before['actionExamples'] == after['actionExamples'] == visible['actionExamples']
    assert before['actionExamples'] and not before['missing'] and not after['missing']
    assert before['permissionProjectionHash'] != after['permissionProjectionHash']
    assert before['sourceId'] != after['sourceId']
    assert all(before[key] is False and after[key] is False for key in (
        'examplesExhaustive', 'selectedRoleVerified', 'roleActionMappingVerified',
        'recordActionEligibilityVerified', 'rowScopeVerified', 'actionsExecuted'))


def test_all_nested_allowlisted_branches_are_hashed_even_beneath_buttons():
    hidden = page('hidden', status='0')
    hidden['buttonList'][0]['children'] = [page('nested-button-child')]
    rows = [page('visible'), hidden]
    before = projection(rows)
    rows[1]['buttonList'][0]['children'][0]['buttonList'][0]['permissionCode'] = 'changed'
    after = projection(rows)
    assert before['permissionProjectionHash'] != after['permissionProjectionHash']
    assert before['actionExamples'] == after['actionExamples']


def test_permission_location_is_bound_without_adding_inherited_actions():
    hidden = page('hidden', status='0', buttonList=[], children=[button('hidden-child')])
    rows = [page('visible'), hidden]
    before = projection(rows)
    rows[1]['buttonList'] = rows[1].pop('children')
    after = projection(rows)
    assert before['permissionProjectionHash'] != after['permissionProjectionHash']
    assert before['actionExamples'] == after['actionExamples']


def test_inactive_ancestor_still_hides_fully_active_nested_page_and_button():
    hidden = page('hidden', status='0', children=[page('nested', children=[page('deep')])])
    rows = [page('visible'), hidden]
    assert projection(rows)['actionExamples'] == projection(rows[:1])['actionExamples']
    rows[1]['status'] = '1'
    # Only a genuine parent eligibility change can expose these examples.
    assert len(projection(rows)['actionExamples']) > len(projection(rows[:1])['actionExamples'])


def test_arbitrary_metadata_is_never_walked_hashed_or_output():
    rows = [page('visible'), page('hidden', status='0')]
    before = projection(rows)
    secret = 'DO_NOT_LEAK_permission_secret_token'
    rows[1]['metadata'] = {'children': [page('invented')], 'token': secret}
    rows[1]['buttonList'][0]['headers'] = {'Authorization': secret}
    rows[1]['children'] = None
    after = projection(rows)
    assert before == after
    assert secret not in json.dumps(after, ensure_ascii=False)
    assert 'raw_permissions' not in after and 'listSysPermission' not in after


@pytest.mark.parametrize('fault', ['children_object', 'buttons_object', 'non_object_child',
    'nested_scalar', 'oversized_scalar', 'infinite_scalar', 'huge_integer', 'wide_branch', 'deep_branch', 'many_nodes'])
def test_hidden_malformed_or_over_limit_tree_is_unverified_and_withholds_examples(fault):
    hidden = page('hidden', status='0')
    if fault == 'children_object': hidden['children'] = {'not': 'a list'}
    if fault == 'buttons_object': hidden['buttonList'] = {'not': 'a list'}
    if fault == 'non_object_child': hidden['children'] = ['not a node']
    if fault == 'nested_scalar': hidden['permissionCode'] = {'token': 'DO_NOT_LEAK_nested'}
    if fault == 'oversized_scalar': hidden['permissionCode'] = 'DO_NOT_LEAK_' + 'x' * 2001
    if fault == 'infinite_scalar': hidden['status'] = float('inf')
    if fault == 'huge_integer': hidden['status'] = 1 << 129
    if fault == 'wide_branch': hidden['children'] = [page(str(i)) for i in range(201)]
    if fault == 'deep_branch':
        current = hidden
        for i in range(7):
            current['children'] = [page(str(i))]
            current = current['children'][0]
    if fault == 'many_nodes': hidden['children'] = [page(str(i), children=[page('child-' + str(i))]) for i in range(110)]
    out = projection([page('visible'), hidden])
    assert 'permission_tree_unverified' in out['missing']
    assert 'configured_action_examples_unverified' in out['missing']
    assert out['actionExamples'] == [] and not out['examplesExhaustive']
    assert not out['recordActionEligibilityVerified'] and not out['actionsExecuted']
    assert 'DO_NOT_LEAK' not in json.dumps(out, ensure_ascii=False)


def test_raw_hash_projection_has_exact_node_and_depth_limits():
    rows = [{'children': [{}]} for _ in range(200)]
    values, invalid = _raw_permission_projection(rows)
    assert len(values) == 400 and not invalid
    rows[-1]['children'].append({})
    values, invalid = _raw_permission_projection(rows)
    assert len(values) == 400 and invalid
    rows = [{}]; current = rows[0]
    for _ in range(6):
        current['children'] = [{}]; current = current['children'][0]
    values, invalid = _raw_permission_projection(rows)
    assert len(values) == 7 and not invalid
    current['children'] = [{}]
    values, invalid = _raw_permission_projection(rows)
    assert len(values) == 7 and invalid


def test_cyclic_allowed_branch_is_bounded_and_unverified():
    node = {}; node['children'] = [node]
    values, invalid = _raw_permission_projection([node])
    assert invalid and len(values) == 7


def test_complete_raw_identity_is_language_independent():
    rows = [page('visible'), page('hidden', status='0', children=[page('nested')])]
    en, ar = projection(rows), projection(rows, 'ar')
    assert en['permissionProjectionHash'] == ar['permissionProjectionHash']
    assert en['sourceId'] == ar['sourceId']
    assert [a['permissionRef'] for a in en['actionExamples']] == [a['permissionRef'] for a in ar['actionExamples']]
