import copy
import pytest
from app.reader_requirements import collection_dependencies, partial_detail_projection, requirements_for
from test_reader_detail_minimal import fixture


def project(f):
    task, source, kb, _ = f
    deps, ambiguous = collection_dependencies(task, kb, '/research/specimens', source, '/data/items')
    return partial_detail_projection(task, kb, '/research/specimens', source, '/data/items', deps, ambiguous)


def test_missing_output_definition_does_not_collect_unrequested_columns_or_drop_requirement():
    f = fixture()
    f[0].requestedAttributes.append('applicable policy')
    before = copy.deepcopy(f[0].model_dump())
    assert set(project(f)) == {'specimenKey', 'color', 'number'}
    assert f[0].model_dump() == before
    assert any(r['value'] == 'applicable policy' for r in requirements_for(f[0]))


@pytest.mark.parametrize('fault', ['unknown_filter', 'unknown_scope', 'ambiguous', 'no_known_attribute',
                                  'missing_identity', 'wrong_record_source', 'ordering', 'measure'])
def test_partial_projection_never_drops_population_or_ambiguous_dependencies(fault):
    f = fixture()
    task, source, kb, record = f
    task.requestedAttributes.append('applicable policy')
    if fault == 'unknown_filter': task.filters.append('unmapped membership')
    if fault == 'unknown_scope': task.requestedScope = 'team'
    if fault == 'ambiguous':
        other = copy.deepcopy(record['payload']['bindings'][-1])
        other.update(id='other_color', fields=['otherColor'])
        record['payload']['bindings'].append(other)
    if fault == 'no_known_attribute': task.requestedAttributes = ['applicable policy']
    if fault == 'missing_identity': task.recordIdentity = ''
    if fault == 'wrong_record_source': record['payload']['routing']['records'][0]['operationRef'] = 'GET /other'
    if fault == 'ordering': task.requestedOrdering = ['newest first']
    if fault == 'measure': task.requestedMeasures = ['count']
    assert project(f) is None
