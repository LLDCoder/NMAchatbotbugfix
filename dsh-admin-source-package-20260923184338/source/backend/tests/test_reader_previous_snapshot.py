"""Historical presentation only: saved D01 output replay plus fault injection."""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

import pytest

from app.generic_reader import render_generic_answer
from app.reader_previous_answer import project_previous_answer, render_previous_answer

FIXTURES = Path(__file__).with_name('fixtures')
TRACE = json.loads((FIXTURES / 'group15_d01_previous_snapshot_trace.json').read_text())
C08 = json.loads((FIXTURES / 'group15_c08_v31_clarity_trace.json').read_text())
CATALOG = [{'routes': ['/dashboard', '/other'], 'businessNavigation': [{'route': '/dashboard', 'label': 'Dashboard'}]}]


def envelope():
    return {'schemaVersion': 'completed-prior-answer/1', 'requestId': TRACE['result']['requestId'],
            'result': deepcopy(TRACE['result']), 'originalAnswer': TRACE['originalAnswer']}


def project(env=None, **updates):
    env = envelope() if env is None else env
    state = TRACE['result']['intentState']
    args = dict(kind='simplify_navigation', fingerprint=state['principalFingerprint'],
                catalog_version=state['catalogVersion'], catalog=CATALOG, authorized=lambda _: True)
    args.update(updates)
    return project_previous_answer(env, **args)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_saved_d01_output_replay_keeps_exact_units_rows_dates_and_historical_filters(language):
    env = envelope(); before = deepcopy(env)
    value = project(env)
    assert value['verified'], value
    assert value['outputs'] == env['result']['outputs']
    assert value['observedPageContext'] == env['result']['observedPageContext']
    assert value['context']['scope'] == 'team'
    assert value['liveDataRead'] is False and value['rowScopeVerified'] is False
    assert value['currentStatusClaimed'] is False
    answer = render_previous_answer(value, language)
    assert '100%' in answer and r'\(min\)' in answer and '5.24' in answer
    assert answer.count('2026-09-22') == 2 and answer.count('2026-09-28.') == 2
    assert 'Asia/Dubai' in answer and '7' in answer
    assert ('Earlier page filters: Licensing; Manager view; Last 7 days' if language == 'en' else
            'مرشحات الصفحة في الإجابة السابقة: التراخيص؛ عرض المدير؛ آخر 7 أيام') in answer
    assert 'Current page filters:' not in answer
    assert '[Dashboard](/dashboard)' in answer
    assert all(t in answer for t in value['observedAt'])
    assert env == before


@pytest.mark.parametrize('fault', ['wrong_page_context_route', 'stale_context_capture', 'mixed_ref_pages',
    'mixed_ref_captures', 'mixed_ref_observations', 'wrong_ref_source', 'mixed_ref_principals', 'naive_ref_time',
    'wrong_principal', 'wrong_catalog', 'route_denied', 'hint_instead_of_receipt',
    'preset_mismatch', 'unknown_department', 'unknown_role', 'bad_zone', 'missing_hash',
    'unshown_date_change', 'missing_original_body', 'malformed_date', 'duplicate_parameter',
    'missing_date_hash', 'date_without_object_ref', 'date_with_multiple_refs'])
def test_wrong_stale_mixed_or_unshown_metadata_cannot_become_historical_facts(fault):
    env = envelope(); result = env['result']; page = result['observedPageContext']
    output = result['outputs'][1]; ref = output['evidence'][0]; dates = output['snapshotResponseDates']
    changes = {}
    if fault == 'wrong_page_context_route': page['route'] = '/other'
    elif fault == 'stale_context_capture': page['capturedAt'] = '2000-01-01T00:00:00Z'
    elif fault == 'mixed_ref_pages': ref['page'] = '/other'
    elif fault == 'mixed_ref_captures': ref['capturedAt'] = '2000-01-01T00:00:00Z'
    elif fault == 'mixed_ref_observations': ref['observationRef'] = 'other-capture'
    elif fault == 'wrong_ref_source': ref['sourceId'] = 'other-source'
    elif fault == 'mixed_ref_principals': ref['principalScopeRef'] = 'other-principal'
    elif fault == 'naive_ref_time': ref['capturedAt'] = '2026-09-28T17:34:39'
    elif fault == 'wrong_principal': changes['fingerprint'] = 'other-principal'
    elif fault == 'wrong_catalog': changes['catalog_version'] = 'other-catalog'
    elif fault == 'route_denied': changes['authorized'] = lambda _: False
    elif fault == 'hint_instead_of_receipt': result['observedPageContext'] = result['intentState']['browserContext']
    elif fault == 'preset_mismatch': page['days'] = 90
    elif fault == 'unknown_department': page['department'] = 'all'
    elif fault == 'unknown_role': page['roleVariant'] = 'admin'
    elif fault == 'bad_zone': page['browserTimezone'] = 'https://unknown.test'
    elif fault == 'missing_hash': page.pop('appliedFiltersHash')
    elif fault == 'unshown_date_change': dates[0]['date'] = '2026-08-01'
    elif fault == 'missing_original_body': env.pop('originalAnswer')
    elif fault == 'malformed_date': dates[0]['date'] = '2026-02-30'
    elif fault == 'duplicate_parameter': dates.append(deepcopy(dates[0]))
    elif fault == 'missing_date_hash': dates[0].pop('valueHash')
    elif fault == 'date_without_object_ref': ref['observationShape'] = 'array'
    elif fault == 'date_with_multiple_refs': output['evidence'].append(deepcopy(ref))
    value = project(env, **changes)
    assert not value['verified'], (fault, value)
    assert 'Earlier page filters' not in render_previous_answer(value, 'en')


def test_old_matching_capture_remains_historical_not_rejected_as_a_live_stale_query():
    env = envelope(); time = '2020-01-01T00:00:00Z'
    env['result']['observedPageContext']['capturedAt'] = time
    for output in env['result']['outputs']:
        for ref in output['evidence']: ref['capturedAt'] = time
    for ref in env['result']['queryReceipt']['sourceRefs']: ref['capturedAt'] = time
    # CapturedAt is not displayed by the original generic answer. The exact
    # matching older capture is valid historical provenance, never fresh data.
    value = project(env)
    assert value['verified'] and value['observedAt'] == [time]
    assert time in render_previous_answer(value, 'en')
    assert value['currentStatusClaimed'] is False


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_distinct_panel_dates_stay_attached_to_their_own_panel(language):
    env = envelope(); result = env['result']
    # Controlled variation, not a claim that recorded D01 had these dates.
    item = result['outputs'][2]
    item['snapshotResponseDates'][0]['date'] = '2026-08-01'
    item['snapshotResponseDates'][1]['date'] = '2026-08-31'
    env['originalAnswer'] = render_generic_answer(result, language)
    value = project(env)
    assert value['verified']
    text = render_previous_answer(value, language)
    performance = text.split('My/Team Performance panel values:', 1)[1].split('License Distribution panel values:', 1)[0]
    distribution = text.split('License Distribution panel values:', 1)[1]
    assert '2026-09-22' in performance and '2026-08-01' not in performance
    assert '2026-08-01' in distribution and '2026-08-31' in distribution
    assert '2026-09-22' not in distribution
    assert value['outputs'] == result['outputs']
    assert not any('timeInterval' in ref for o in value['outputs'] for ref in o['evidence'])


def test_browser_hints_are_not_used_when_no_verified_observed_context_was_displayed():
    env = envelope(); result = env['result']; result.pop('observedPageContext')
    for output in result['outputs']: output.pop('snapshotResponseDates', None)
    result['intentState']['browserContext'] = deepcopy(TRACE['result']['observedPageContext'])
    result['intentState']['browserContext']['days'] = 90
    env['originalAnswer'] = render_generic_answer(result, 'en')
    value = project(env)
    assert value['verified'] and 'observedPageContext' not in value
    assert 'Earlier page filters' not in render_previous_answer(value, 'en')


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_no_metadata_c08_stays_byte_identical_and_query_scope_reports_public_gaps(language):
    # Digests captured from the unmodified private v32 renderer, not computed
    # from the candidate implementation under test.
    c08_digests = {'en': 'a674f640306ccf7c7eb1d0dfbab8e94d6122c25386e421534781d7573950e587', 'ar': 'd668bdf053abfa0b7242849d5db77f2336c756fe1235c0edd8c0ca949a82283f'}
    assert sha256(render_previous_answer(C08['projection'], language).encode()).hexdigest() == c08_digests[language]
    value = project(kind='query_scope')
    assert value['verified']
    assert 'observedPageContext' not in value
    # C05 now reports unavailable public explanations rather than exposing
    # internal context. C08's original hashes above remain unchanged.
    from app.reader_public_query_context import checked_scope_context
    public, gaps = checked_scope_context(value)
    rendered = render_previous_answer(value, language)
    assert gaps and value['publicQueryContext']['status'] == 'partial'
    assert ('I could not provide a complete explanation of:' if language == 'en' else
            'لم أتمكن من تقديم شرح كامل') in rendered
    for timestamp in value['observedAt']:
        assert timestamp in rendered
    assert public['scope'] == value['context']['scope']


# Anchors: frozen Portal Dashboard/type.ts, index.tsx PRESET_DAYS, and
# DashboardControls.tsx; see G14 d01-presentation-candidate-v2/receipt.json.
@pytest.mark.parametrize('department', ['license', 'content', 'inspection', 'customer'])
@pytest.mark.parametrize('preset,days', [('last7', 7), ('last30', 30), ('last6Months', 180), ('lastYear', 365)])
@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_dashboard_definitions_survive_completed_historical_projection(department, preset, days, language):
    env = envelope(); result = env['result']; context = result['observedPageContext']
    context.update(department=department, preset=preset, days=days)
    env['originalAnswer'] = render_generic_answer(result, language)
    before = deepcopy(env)
    value = project(env)
    assert value['verified'], value
    assert value['observedPageContext'] == context
    assert value['outputs'] == result['outputs']
    assert value['currentStatusClaimed'] is False and value['liveDataRead'] is False
    answer = render_previous_answer(value, language)
    assert str(days) in answer and 'Asia/Dubai' in answer
    if department == 'customer':
        assert ('Customer happiness' if language == 'en' else 'سعادة المتعاملين') in answer
    assert ('Earlier page filters' if language == 'en' else 'مرشحات الصفحة في الإجابة السابقة') in answer
    assert env == before


@pytest.mark.parametrize('department,preset,days', [
    ('happiness', 'last7', 7), ('finance', 'last7', 7), ('license', 'last90', 90),
    ('license', 'last6Months', 183), ('license', 'lastYear', 366),
    ('license', 'custom', 7), ('license', 'last7', True),
])
def test_removed_unknown_or_inconsistent_dashboard_definitions_cannot_be_replayed(department, preset, days):
    env = envelope()
    env['result']['observedPageContext'].update(department=department, preset=preset, days=days)
    if department == 'license':
        env['originalAnswer'] = render_generic_answer(env['result'], 'en')
    value = project(env)
    assert not value['verified']
    assert value['reason'] == 'previous_answer_snapshot_context_unverified'
    assert 'Earlier page filters' not in render_previous_answer(value, 'en')
