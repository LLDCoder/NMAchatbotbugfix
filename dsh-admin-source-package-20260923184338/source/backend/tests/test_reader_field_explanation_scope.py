import pytest

from app.portal_reader import ReaderResult, knowledge_supports_result
from test_admin_portal_reader import Gateway, Planner, run_reader, user_info_for_paths


MEANING = 'Start Date is the start date shown for a record; End Date is its expiration date.'
LIMIT = 'The precise inclusive date boundaries are not defined here.'


def knowledge():
    return {'ok': True, 'result': {'chunks': [{'chunk': {'content': (
        '## Semantic node: Manager record list\n'
        '- **page:** `/records`\n- **section:** Records\n'
        '- **content:** Reference; Start Date; End Date.\n'
        '- **scope:** Verified for the Manager representative.\n'
        f'- **field_distinctions:** {MEANING}\n'
        f'- **verification_limits:** {LIMIT}'
    )}}]}}


@pytest.mark.parametrize('paths', [('/records',), ('/unrelated',)])
def test_basic_field_explanation_does_not_need_live_access_or_unasked_rules(paths):
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths(*paths)}, knowledge_result=knowledge())
    planner = Planner({'mode': 'knowledge_only', 'result': 'success',
                       'facts': [MEANING, LIMIT], 'missing': []})
    outcome = run_reader(gateway, planner,
                         question='What is the difference between the Start Date and End Date fields?')
    assert outcome.result.status == 'success'
    assert 'Manager record list: ' + MEANING in outcome.result.facts
    assert any('Verified for the Manager representative' in fact for fact in outcome.result.facts)
    assert not outcome.result.page
    assert gateway.events == ['GetUserInfo', 'knowledge.search']
    assert not outcome.result.missing


def test_unknown_boundary_cannot_be_grounded_from_known_field_labels():
    context = {'ok': True, 'chunks': [{'content': MEANING + ' ' + LIMIT}]}
    result = ReaderResult(status='success', summary='', facts=('End Date always includes the entire final day until midnight UTC.',))
    assert not knowledge_supports_result(result, context)


def test_unconfirmed_requested_rule_keeps_the_supported_field_explanation():
    context = {'ok': True, 'chunks': [{'content': MEANING + ' ' + LIMIT}]}
    assert knowledge_supports_result(ReaderResult(status='success',summary='',facts=(MEANING,)), context)
    assert knowledge_supports_result(ReaderResult(status='success',summary='',facts=(LIMIT,)), context)
