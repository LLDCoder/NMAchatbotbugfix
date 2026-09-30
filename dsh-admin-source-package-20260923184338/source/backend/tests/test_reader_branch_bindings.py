import json
import pytest
from app.generic_reader_contracts import AnalysisPlan
from app.generic_reader import KnowledgeStore, PipelineError, execute_analysis
from app.reader_bindings import bind_analysis_evidence, applicable_bindings
from app.reader_branch_bindings import split_branch_bindings
from app.reader_requirements import requirements_for
from test_reader_multisource_requirements import multi_fixture


def shared_fixture():
    task, plan, sources, knowledge = multi_fixture()
    record = next(i['record'] for i in knowledge.items.values() if i.get('record'))
    for kind in ['object', 'grain', 'group']:
        current = next(b for b in plan.requirementBindings if b.requirementId.startswith(kind) and b.sourceId == 'current')
        historical = next(b for b in plan.requirementBindings if b.requirementId == current.requirementId and b.sourceId == 'historical')
        fact = next(f for f in record['payload']['bindings'] if f['id'] == current.knowledgeBindingId.split('#')[-1])
        fact.pop('contextParameters')
        current.stepIds.extend(historical.stepIds)
        plan.requirementBindings.remove(historical)
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'definition', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    def recite(value):
        if isinstance(value, dict):
            return {key: ref if key == 'sourceId' and isinstance(item, str) and item.startswith('k_')
                    else recite(item) for key, item in value.items()}
        return [recite(item) for item in value] if isinstance(value, list) else value
    plan = AnalysisPlan.model_validate(recite(plan.model_dump()))
    return task, plan, sources, knowledge


def test_explicit_cross_source_steps_compile_same_documented_fact_per_branch():
    task, plan, sources, knowledge = shared_fixture()
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=corrections)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert {o['id'] for o in result['outputs']} == {'current_phases', 'historical_phases'}
    assert len(corrections) == 3
    for kind in ['object', 'grain', 'group_0']:
        assert {b.sourceId for b in plan.requirementBindings if b.requirementId == kind} == {'current', 'historical'}
    again = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=again)
    assert again == []


@pytest.mark.parametrize('fault', ['principal', 'missing_principal', 'operation', 'context', 'not_ready', 'path'])
def test_cross_source_split_never_grants_new_context(fault):
    task, plan, sources, knowledge = shared_fixture()
    if fault == 'principal': sources['historical']['principalScopeRef'] = 'other'
    if fault == 'missing_principal': sources['historical'].pop('principalScopeRef')
    if fault == 'operation': sources['historical']['operationRef'] = 'GET /other'
    if fault == 'not_ready': sources['historical']['ready'] = False
    if fault == 'path':
        next(s for s in plan.steps if s.id == 'historical_rows').path = '/other'
    catalog = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    if fault == 'context':
        for fact in catalog.values():
            if fact['kind'] == 'object': fact['contextVerifiedSourceIds'] = ['current']
    with pytest.raises(PipelineError, match='analysis_binding_cross_source_steps'):
        split_branch_bindings(plan, {r['id']: r for r in requirements_for(task)}, catalog, sources)


def test_single_source_proposal_does_not_synthesize_unasked_branch():
    task, plan, sources, knowledge = multi_fixture()
    plan.requirementBindings = [b for b in plan.requirementBindings if not (b.requirementId == 'object' and b.sourceId == 'historical')]
    catalog = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    assert split_branch_bindings(plan, {r['id']: r for r in requirements_for(task)}, catalog, sources) == []
    assert not execute_analysis(plan, sources, knowledge, [], task=task)['requirementsSatisfied']
