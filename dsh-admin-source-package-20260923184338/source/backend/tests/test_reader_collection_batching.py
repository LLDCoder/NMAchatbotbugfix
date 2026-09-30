"""Bounded large batches preserve full two-pass collection and fail closed."""
import math

import pytest

from test_projected_collection import setup_rows, collect


@pytest.mark.parametrize('count', [0, 1, 100, 500, 501, 673, 5000])
def test_batch_boundaries_keep_full_population_two_passes_and_filters(count):
    rows, capture, spec = setup_rows(count)
    result, calls = collect(rows, capture, spec)
    assert result['completeness'] == 'complete'
    assert result['rowCount'] == count and result['stablePasses'] == 2
    assert len(calls) == 2 * max(1, math.ceil(count / 500))
    assert result['pagesRead'] == len(calls)
    assert [r['specimenKey'] for r in result['rows']] == [str(i) for i in range(count)]
    assert all(call['pageSize'] <= 500 and call['zone'] == 'East'
               and call['sortBy'] == 'specimenKey' for call in calls)
    assert all(set(row) == {'specimenKey', 'phase'} for row in result['rows'])


def test_server_cap_at_old_size_restarts_two_full_scans_without_skipping_rows():
    rows, capture, spec = setup_rows(673)
    def clamp(payload, params, call_number):
        offset = (params['pageIndex'] - 1) * 100
        payload['data']['items'] = rows[offset:offset + 100]
        payload['data']['pageSize'] = 100
        return payload
    result, calls = collect(rows, capture, spec, clamp)
    assert result['completeness'] == 'complete' and result['rowCount'] == 673
    assert result['stablePasses'] == 2 and len(calls) == 15
    assert [p['pageIndex'] for p in calls] == [1, *range(1, 8), *range(1, 8)]
    assert [p['pageSize'] for p in calls] == [500, *([100] * 14)]
    assert [r['specimenKey'] for r in result['rows']] == [str(i) for i in range(673)]
    assert result['pagination']['fallbackFromPageSize'] == 500
    assert result['pagination']['pageSize'] == 100


def test_old_size_still_short_does_not_retry_or_claim_complete():
    rows, capture, spec = setup_rows(673)
    result, calls = collect(rows, capture, spec, lambda payload, params, n:
        {'data': {'items': rows[:50], 'total': len(rows)}})
    assert result['reason'] == 'collection_page_incomplete' and 'rows' not in result
    assert [p['pageSize'] for p in calls] == [500, 100]


def test_total_drift_after_probe_is_not_hidden_by_restart():
    rows, capture, spec = setup_rows(673)
    def drift(payload, params, n):
        payload['data']['items'] = rows[:100]
        if n == 2:
            payload['data']['total'] += 1
        return payload
    result, calls = collect(rows, capture, spec, drift)
    assert result['reason'] == 'collection_total_changed' and len(calls) == 2


@pytest.mark.parametrize('failure', ['response', 'identity', 'row_budget', 'byte_budget'])
def test_invalid_first_probe_does_not_trigger_fallback(failure):
    rows, capture, spec = setup_rows(673)
    def invalid(payload, params, n):
        if failure == 'response':
            payload['isSuccess'] = False
        elif failure == 'identity':
            payload['data']['items'][0]['specimenKey'] = None
        elif failure == 'row_budget':
            payload['data']['total'] = 5001
        else:
            payload['padding'] = 'x' * 5_000_001
        return payload
    result, calls = collect(rows, capture, spec, invalid)
    assert result['completeness'] == 'incomplete' and 'rows' not in result
    assert len(calls) == 1 and 'fallbackFromPageSize' not in result['pagination']


def test_fallback_does_not_reset_byte_budget():
    rows, capture, spec = setup_rows(673)
    def large(payload, params, n):
        payload['data']['items'] = rows[:100]
        payload['padding'] = 'x' * 2_600_000
        return payload
    result, calls = collect(rows, capture, spec, large)
    assert result['reason'] == 'collection_budget_exceeded' and len(calls) == 2
    assert 'rows' not in result


def test_later_short_page_never_restarts_or_infers_offsets():
    rows, capture, spec = setup_rows(673)
    def later_short(payload, params, n):
        if n == 2:
            payload['data']['items'] = payload['data']['items'][:50]
        return payload
    result, calls = collect(rows, capture, spec, later_short)
    assert result['reason'] == 'collection_page_incomplete' and len(calls) == 2
    assert 'fallbackFromPageSize' not in result['pagination']


def test_duplicate_business_identity_keeps_its_original_row_multiplicity():
    rows, capture, spec = setup_rows(673)
    rows[500]['specimenKey'] = rows[0]['specimenKey']
    result, _ = collect(rows, capture, spec)
    assert result['completeness'] == 'complete' and result['rowCount'] == 673
    assert sum(row['specimenKey'] == '0' for row in result['rows']) == 2


def test_duplicate_identity_multiplicity_drift_between_passes_is_rejected():
    rows, capture, spec = setup_rows(673)
    rows[500]['specimenKey'] = rows[0]['specimenKey']
    def change(payload, params, call_number):
        if call_number == 4:
            payload['data']['items'][0] = dict(payload['data']['items'][0], specimenKey='changed')
        return payload
    result, _ = collect(rows, capture, spec, change)
    assert result['reason'] == 'collection_changed_between_passes' and 'rows' not in result


def test_row_budget_is_not_enlarged_by_batch_coalescing():
    rows, capture, spec = setup_rows(5001)
    result, _ = collect(rows, capture, spec)
    assert result['reason'] == 'collection_budget_exceeded' and 'rows' not in result
