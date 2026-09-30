import pytest

from app.generic_reader import PipelineError
from app.reader_source_paths import read_source_path


def test_missing_related_path_preserves_failure_and_does_not_substitute_other_record():
    sources = {'detail': {'operationRef': 'GET /records/{id}', 'data': {'data': {'id': 4}}},
               'related': {'operationRef': 'GET /records/{id}/items', 'data': {'data': {'items': [{'name': 'item'}]}}},
               'failed': {'ready': False, 'data': {'data': {'items': []}}}}
    with pytest.raises(PipelineError) as caught:
        read_source_path('detail', '/data/items', sources)
    error = caught.value
    assert error.code == 'field_missing'
    assert error.details['sourceId'] == 'detail'
    assert error.details['observedSourcesContainingPath'] == [{'sourceId': 'related', 'operationRef': 'GET /records/{id}/items'}]
    assert sources['detail']['data'] == {'data': {'id': 4}}


def test_observed_empty_array_is_a_valid_value_and_not_a_missing_path():
    assert read_source_path('s', '/data/items', {'s': {'data': {'data': {'items': []}}}}) == []


def test_no_candidate_path_remains_unavailable_without_synthetic_rows():
    with pytest.raises(PipelineError) as caught:
        read_source_path('s', '/data/items', {'s': {'data': {'data': None}}})
    assert caught.value.details['observedSourcesContainingPath'] == []


def test_invalid_pointer_contract_remains_rejected():
    with pytest.raises(PipelineError):
        read_source_path('s', 'data.items', {'s': {'data': {'data': {'items': []}}}})
