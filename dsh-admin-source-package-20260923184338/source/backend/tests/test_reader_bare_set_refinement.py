"""Captured EN/AR model stages, with isolated counterfactual refinements."""
import json,copy
from pathlib import Path
import pytest
from app.generic_reader_contracts import TaskSpec,SlotUpdate
from app.reader_context import refine_task,constrain_inferred_view
from app.reader_expansion import QueryExpansion,validate_expansion
from app.reader_related import page_reads
from test_reader_source_specific_view import supplemental_contract
SAVED=json.loads((Path(__file__).parent/'fixtures/group17-original-set-model-stages.json').read_text())
PAGE='/licensing/applications'
QUESTION='Find ML-2-804-9226243 and ML-2-804-0460740. Keep the two records separate.'

def proposed(task,**changes):
    result=task.model_copy(deep=True)
    for field,value in changes.items():
        setattr(result,field,value)
        result.slotUpdates=[s for s in result.slotUpdates if s.field!=field]
        result.slotUpdates.append(SlotUpdate(field=field,value=value,source='knowledge',evidence='Isolated documented page suggestion'))
    return result

@pytest.mark.parametrize('language',['en','ar'])
def test_captured_initial_refinement_and_qe_preserve_reachable_bare_set(language):
    _,kb=supplemental_contract()
    for entry in SAVED[language]['intentStages']:
        task=TaskSpec.model_validate(entry['task'])
        assert task.view=='' and len(page_reads(kb,PAGE,task))==2
    task=TaskSpec.model_validate(SAVED[language]['TaskSpec'])
    qe=QueryExpansion.model_validate(SAVED[language]['QueryExpansion'])
    validate_expansion(qe,task,QUESTION)
    assert len(page_reads(kb,PAGE,task))==2

@pytest.mark.parametrize('language',['en','ar'])
@pytest.mark.parametrize('view',['todo','completed'])
def test_known_page_view_cannot_narrow_original_exact_set_during_refinement(language,view):
    _,kb=supplemental_contract();draft=TaskSpec.model_validate(SAVED[language]['intentStages'][0]['task'])
    candidate=proposed(draft,view=view);constrain_inferred_view(draft,candidate,[{'id':view}])
    refined=refine_task(draft,candidate)
    assert refined.view=='' and refined.filters==draft.filters
    assert len(page_reads(kb,PAGE,refined))==2
    assert next(x for x in refined.slotUpdates if x.field=='view').source in {'current','previous'}

@pytest.mark.parametrize('view',['todo','completed'])
def test_explicit_user_view_stays_explicit_and_does_not_activate_cross_view_reads(view):
    _,kb=supplemental_contract();draft=TaskSpec.model_validate(SAVED['en']['intentStages'][0]['task'])
    draft.view=view
    for s in draft.slotUpdates:
        if s.field=='view':s.value=view;s.source='current';s.evidence='Explicit isolated user view'
    refined=refine_task(draft,proposed(draft,view='completed' if view=='todo' else 'todo'))
    assert refined.view==view and page_reads(kb,PAGE,refined)==[]

@pytest.mark.parametrize('language',['en','ar'])
def test_knowledge_predicate_cannot_be_added_to_original_exact_set(language):
    _,kb=supplemental_contract();draft=TaskSpec.model_validate(SAVED[language]['intentStages'][0]['task'])
    refined=refine_task(draft,proposed(draft,filters=[*draft.filters,'status is Pending']))
    assert refined.filters==draft.filters and len(page_reads(kb,PAGE,refined))==2

@pytest.mark.parametrize('change',[
    {'filters':['pending']},{'unresolvedSlots':['view']},{'requestedAttributes':['SLA']},
    {'requestedScope':'personal'},{'timeRange':'today'},{'recordIdentity':'EXAMPLE-1','filters':[]}])
def test_narrow_guard_does_not_disable_other_view_resolution_or_enable_supplements(change):
    _,kb=supplemental_contract();draft=TaskSpec.model_validate(SAVED['en']['intentStages'][0]['task'])
    for field,value in change.items():
        setattr(draft,field,value)
        for s in draft.slotUpdates:
            if s.field==field:s.value=value
    refined=refine_task(draft,proposed(draft,view='todo'))
    assert refined.view=='todo'
    assert page_reads(kb,PAGE,refined)==[]
