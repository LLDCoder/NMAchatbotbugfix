import pytest
from test_reader_generic_completion import form_analysis_fixture, bind_analysis_evidence, execute
from app.generic_reader_contracts import Step


def wrapper_fixture():
    task,plan,sources,knowledge=form_analysis_fixture()
    sources['detail']['structuredDocuments'][0]['path']='/formData'
    for item in knowledge.items.values():
        for fact in (item.get('record') or {}).get('payload',{}).get('bindings',[]):
            if fact.get('formDefinition'):fact['formDefinition']['documentPath']='/formData'
    return task,plan,sources,knowledge


def test_unused_wrapper_projection_of_declared_form_document_is_pruned():
    task,plan,sources,knowledge=wrapper_fixture()
    plan.steps.insert(0,Step(id='unused_wrapper',op='read_rows',sourceId='detail',path='/',fields=['formData'],expose=False,label='Form wrapper',evidence=[]))
    bind_analysis_evidence(plan,task,knowledge,sources)
    assert 'unused_wrapper' not in {s.id for s in plan.steps}
    assert execute((task,plan,sources,knowledge))['requirementsSatisfied']


@pytest.mark.parametrize('field,expose',[('other',False),('formData',True)])
def test_unrelated_or_visible_wrapper_is_not_silently_removed(field,expose):
    task,plan,sources,knowledge=wrapper_fixture()
    plan.steps.insert(0,Step(id='keep',op='read_rows',sourceId='detail',path='/',fields=[field],expose=expose,label='Requested field',evidence=[]))
    bind_analysis_evidence(plan,task,knowledge,sources)
    assert any(s.id=='keep' for s in plan.steps)
