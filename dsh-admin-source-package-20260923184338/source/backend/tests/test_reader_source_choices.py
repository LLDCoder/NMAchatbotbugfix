import pytest
from types import SimpleNamespace
from app.generic_reader import PipelineError
from app.reader_source_choices import source_choices,validate_read_continuation
from app.reader_collection import projection_hash
from test_reader_multisource_requirements import multi_fixture


def test_summary_exposes_exact_captured_context_for_each_measure():
    task,_,sources,k=multi_fixture();choices=source_choices(task,k,sources)
    measures={x['requirementId']:{c['sourceId'] for c in x['choices']} for x in choices if x['kind']=='measure'}
    assert measures=={'measure_0':{'current'},'measure_1':{'historical'}}
    with pytest.raises(PipelineError,match='observed_requirement_sources_not_selected'):
        validate_read_continuation(task,SimpleNamespace(nextActions=[object()]),choices)
    validate_read_continuation(task,SimpleNamespace(nextActions=[]),choices)


@pytest.mark.parametrize('fault',['wrong_context','not_ready','no_principal','different_principal','attribute','named_record','explicit_view','ordering'])
def test_coverage_summary_does_not_replace_missing_evidence_or_other_page_work(fault):
    task,_,sources,k=multi_fixture()
    if fault=='wrong_context':sources['historical']['collectionContext']['parameterHashes']['view']=projection_hash('unrelated')
    if fault=='not_ready':sources['historical']['ready']=False
    if fault=='no_principal':sources['historical']['principalScopeRef']=''
    if fault=='different_principal':sources['historical']['principalScopeRef']='another-user'
    if fault=='attribute':task.requestedAttributes=['notes']
    if fault=='named_record':task.recordIdentity='specimen-1'
    if fault=='explicit_view':task.view='custom view'
    if fault=='ordering':task.requestedOrdering=['highest count first']
    choices=source_choices(task,k,sources)
    validate_read_continuation(task,SimpleNamespace(nextActions=[object()]),choices)
    if fault in {'wrong_context','not_ready','no_principal'}:
        assert not next(x for x in choices if x['requirementId']=='measure_1')['choices']
