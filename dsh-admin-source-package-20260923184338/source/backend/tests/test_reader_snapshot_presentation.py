import copy
import json

import pytest

from app.generic_reader import execute_analysis, render_generic_answer, PipelineError
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_dashboard_context import (
    dashboard_read_context, verified_dashboard_display_context, current_output_display_context,
)
from app.reader_snapshot_presentation import snapshot_presentations, apply_snapshot_formats
from test_reader_snapshot_request_context import baseline_fixture
from test_reader_dashboard_context import hint, receipt


def run_fixture():
    task, plan, sources, knowledge, _ = baseline_fixture()
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    return result, plan, sources, knowledge


def performance(result):
    return next(o for o in result['outputs'] if o['id'] == 'performance')


def raw_output(result):
    output = copy.deepcopy(performance(result))
    for key in ('displayRows', 'snapshotDisplayDefinitions', 'snapshotResponseDates'):
        output.pop(key, None)
    output['fieldLabels'] = {}
    return output


def test_summary_inherits_same_source_field_units_without_changing_any_numeric_value():
    result, plan, sources, knowledge = run_fixture()
    assert result['requirementsSatisfied']
    item = performance(result)
    assert item['value'][0]['averageHandlingTimeMinutes'] == 5.24
    assert item['fieldLabels']['averageHandlingTimeMinutes'].endswith('(min)')
    assert item['displayRows'][0]['slaComplianceRate'] == '100%'
    assert item['displayRows'][0]['approvalRateOfApplication'] == '0%'
    assert item['displayRows'][0]['averageHandlingTimeMinutes'] == 5.24
    assert sum(len(o['value'][0]) for o in result['outputs']) == 29
    dates = {d['parameter']: d['date'] for d in item['snapshotResponseDates']}
    assert dates == {'startDate': '2026-09-22', 'endDate': '2026-09-28'}
    assert all('timeInterval' not in ref for o in result['outputs'] for ref in o['evidence'])


@pytest.mark.parametrize('value,expected', [(0, '0%'), (0.13, '13%'), (1, '100%'), (93.25, '93.3%')])
def test_summary_formatting_depends_on_actual_scalar_not_fixture_numbers(value, expected):
    result, plan, sources, knowledge = run_fixture()
    output = raw_output(result)
    output['value'][0]['slaComplianceRate'] = value
    source = sources['performance']
    source['data']['data']['summary']['slaComplianceRate'] = value
    source['fieldEvidence']['/data/summary/slaComplianceRate']['valueHash'] = projection_hash(value)
    snapshot_presentations([output], plan, knowledge, result['requirementCoverage'], sources)
    apply_snapshot_formats([output])
    assert output['value'][0]['slaComplianceRate'] == value
    assert output['displayRows'][0]['slaComplianceRate'] == expected


@pytest.mark.parametrize('fault', ['missing_principal', 'other_principal', 'other_operation', 'wrong_path',
                                  'no_grain', 'no_attribute', 'coverage_missing', 'many_rows'])
def test_unproved_or_unrelated_snapshot_gets_no_inherited_metadata(fault):
    result, plan, sources, knowledge = run_fixture()
    output = raw_output(result)
    source = sources['performance']
    coverage = copy.deepcopy(result['requirementCoverage'])
    if fault == 'missing_principal': source.pop('principalScopeRef')
    if fault == 'other_principal': source['principalScopeRef'] = 'other'
    if fault == 'other_operation': source['operationRef'] = 'GET /unrelated'
    if fault == 'wrong_path': output['evidence'][0]['fieldBinding'] = '/unrelated'
    if fault in {'no_grain', 'no_attribute'}:
        rid = 'grain' if fault == 'no_grain' else 'attribute_0'
        plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != rid]
    if fault == 'coverage_missing': coverage = []
    if fault == 'many_rows': output['value'] *= 2
    snapshot_presentations([output], plan, knowledge, coverage, sources)
    assert not output.get('snapshotDisplayDefinitions')


@pytest.mark.parametrize('fault', ['wrong_hash', 'null', 'boolean', 'missing_receipt', 'changed_output', 'ambiguous_unit'])
def test_individual_unproved_field_does_not_receive_a_format(fault):
    result, plan, sources, knowledge = run_fixture()
    output = raw_output(result)
    source = sources['performance']; field = 'slaComplianceRate'; path = '/data/summary/' + field
    if fault == 'wrong_hash': source['fieldEvidence'][path]['valueHash'] = 'bad'
    if fault == 'missing_receipt': source['fieldEvidence'].pop(path)
    if fault == 'changed_output': output['value'][0][field] = 12345
    if fault in {'null', 'boolean'}:
        value = None if fault == 'null' else True
        output['value'][0][field] = source['data']['data']['summary'][field] = value
        source['fieldEvidence'][path]['valueHash'] = projection_hash(value)
    if fault == 'ambiguous_unit':
        for item in knowledge.items.values():
            record = item.get('record') or {}
            if record.get('id') != 'admin.dashboard.license-performance.department': continue
            facts = record['payload']['bindings']
            other = copy.deepcopy(next(f for f in facts if f['id'] == 'sla_compliance'))
            other.update(id='different_unit', displayUnit='kg')
            facts.append(other)
    snapshot_presentations([output], plan, knowledge, result['requirementCoverage'], sources)
    apply_snapshot_formats([output])
    assert output.get('displayRows', output['value'])[0][field] == output['value'][0][field]


@pytest.mark.parametrize('fault', ['request_mismatch', 'echo_changed', 'missing_date_proof'])
def test_response_dates_are_not_inferred_from_a_preset_or_other_source(fault):
    result, plan, sources, knowledge = run_fixture(); output = raw_output(result)
    source = sources['performance']
    if fault == 'request_mismatch': source['collectionContext']['parameterHashes']['startDate'] = projection_hash('2020-01-01')
    if fault == 'echo_changed': source['data']['data']['startDate'] = '2020-01-01T00:00:00'
    if fault == 'missing_date_proof': source['fieldEvidence'].pop('/data/startDate')
    snapshot_presentations([output], plan, knowledge, result['requirementCoverage'], sources)
    assert not output.get('snapshotResponseDates')


def page_fixture():
    current = hint(); current['browserTimezone'] = 'Asia/Dubai'
    expected = dashboard_read_context('/dashboard', current, 'u')
    proof = receipt(expected)
    proof['appliedFiltersHash'] = projection_hash({f['name']: f['value'] for f in expected['filters']})
    return expected, {'dashboardContextReceipt': proof}


def test_actual_filter_receipt_is_projected_with_its_own_capture_only():
    expected, observation = page_fixture()
    context = verified_dashboard_display_context(expected, observation, 'u', 'capture-now')
    assert context['days'] == 30 and context['browserTimezone'] == 'Asia/Dubai'
    assert 'userId' not in context and 'principalHash' not in context
    outputs = [{'evidence': [{'page': '/dashboard', 'capturedAt': 'capture-now'}]}]
    assert current_output_display_context(context, outputs) == context
    assert current_output_display_context(context, []) is None
    outputs[0]['evidence'][0]['capturedAt'] = 'old-capture'
    assert current_output_display_context(context, outputs) is None
    outputs[0]['evidence'][0].update(capturedAt='capture-now', page='/another')
    assert current_output_display_context(context, outputs) is None


@pytest.mark.parametrize('fault', ['no_actual_hash', 'different_actual_hash', 'duplicate_filter', 'custom_period'])
def test_requested_hints_without_actual_marker_proof_are_not_public_facts(fault):
    expected, observation = page_fixture(); proof = observation['dashboardContextReceipt']
    if fault == 'no_actual_hash': proof.pop('appliedFiltersHash')
    if fault == 'different_actual_hash': proof['appliedFiltersHash'] = projection_hash({})
    if fault == 'duplicate_filter': expected['filters'][2] = copy.deepcopy(expected['filters'][1])
    if fault == 'custom_period': expected['filters'][0]['value'] = json.dumps({'preset': 'custom', 'days': 30})
    proof['requestedFiltersHash'] = projection_hash(expected['filters'])
    if fault in {'duplicate_filter', 'custom_period'}:
        proof['appliedFiltersHash'] = projection_hash({f['name']: f['value'] for f in expected['filters']})
    assert verified_dashboard_display_context(expected, observation, 'u', 'now') is None


@pytest.mark.parametrize('language', ['en', 'ar', 'zh'])
def test_rendered_snapshot_contains_units_dates_and_verified_filters(language):
    result, _, _, _ = run_fixture(); expected, observation = page_fixture()
    result['observedPageContext'] = verified_dashboard_display_context(expected, observation, 'u', 'now')
    before = copy.deepcopy(result)
    answer = render_generic_answer(result, language)
    assert '100%' in answer and '5.24' in answer and '(min)' in answer
    assert '2026-09-22' in answer and '2026-09-28' in answer and 'Asia/Dubai' in answer
    assert '30' in answer
    assert result == before


# Enum values and day counts are anchored in the frozen Portal Dashboard type
# and PRESET_DAYS mapping, rather than inferred from other module names.
@pytest.mark.parametrize('department', ['license', 'content', 'inspection', 'customer'])
@pytest.mark.parametrize('preset,days', [('last7', 7), ('last30', 30), ('last6Months', 180), ('lastYear', 365)])
def test_actual_portal_department_and_preset_definitions_are_preserved(department, preset, days):
    expected, observation = page_fixture()
    for item in expected['filters']:
        if item['name'] == 'department': item['value'] = department
        if item['name'] == 'timeFilter': item['value'] = json.dumps({'preset': preset, 'days': days})
    proof = observation['dashboardContextReceipt']
    proof['requestedFiltersHash'] = projection_hash(expected['filters'])
    proof['appliedFiltersHash'] = projection_hash({item['name']: item['value'] for item in expected['filters']})
    actual = verified_dashboard_display_context(expected, observation, 'u', 'now')
    assert actual['department'] == department and actual['preset'] == preset and actual['days'] == days
    if department == 'customer':
        result, _, _, _ = run_fixture(); result['observedPageContext'] = actual
        assert 'Customer happiness' in render_generic_answer(result, 'en')


@pytest.mark.parametrize('department,preset,days', [('happiness', 'last7', 7), ('finance', 'last7', 7),
                                                  ('license', 'last90', 90), ('license', 'last6Months', 183),
                                                  ('license', 'lastYear', 366)])
def test_nonexistent_or_inconsistent_portal_declarations_are_not_projected(department, preset, days):
    expected, observation = page_fixture()
    for item in expected['filters']:
        if item['name'] == 'department': item['value'] = department
        if item['name'] == 'timeFilter': item['value'] = json.dumps({'preset': preset, 'days': days})
    proof = observation['dashboardContextReceipt']
    proof['requestedFiltersHash'] = projection_hash(expected['filters'])
    proof['appliedFiltersHash'] = projection_hash({item['name']: item['value'] for item in expected['filters']})
    assert verified_dashboard_display_context(expected, observation, 'u', 'now') is None
