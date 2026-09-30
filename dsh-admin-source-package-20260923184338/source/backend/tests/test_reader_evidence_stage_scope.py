import asyncio
import copy
import json
import time
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError, KnowledgeStore
from app.generic_reader_contracts import TaskSpec
from app.reader_expansion import QueryExpansion
from app.reader_evidence_explanation import partition, stage_responsibilities
from app.reader_knowledge_coverage import knowledge_requirements, KnowledgeCoverage, validate_coverage
from app.reader_requirements import requirements_for


def setup():
    raw = json.loads((Path(__file__).parent/'fixtures/evidence_stage_b11_en.json').read_text())
    task = TaskSpec.model_validate(raw['task'])
    assignment = partition(task, raw['question'], raw['question'])
    return raw, assignment, QueryExpansion.model_validate(raw['expansion'])


def test_actual_rejected_original_ids_still_fail_and_projected_guidance_maps_to_original():
    raw, a, expansion = setup();task=a['knowledgeTask'];before=expansion.model_dump()
    receipt, projected = stage_responsibilities(a,task,knowledge_requirements(task),expansion)
    assert receipt['stageRequirementIdMap']['attribute_1']=='attribute_3'
    assert {r['id'] for r in receipt['deferredOriginalRequirements']} >= {'attribute_1','attribute_2'}
    assert projected.terms[-1].sourceText=='how to refresh or verify the status discrepancy'
    assert projected.terms[-1].requirementId=='attribute_1'
    assert expansion.model_dump()==before
    for rejected in raw['rejectedPlans']:
        with pytest.raises(PipelineError,match='knowledge_requirement_coverage_invalid'):
            validate_coverage(KnowledgeCoverage.model_validate(rejected['candidate']),task,KnowledgeStore())


@pytest.mark.parametrize('change',['unknown_attribute','changed_record','changed_scope','duplicate_stage_id','relabeled_value'])
def test_projection_cannot_hide_or_relabel_changed_requirements(change):
    _,a,expansion=setup();task=a['knowledgeTask'].model_copy(deep=True);req=knowledge_requirements(task)
    if change=='unknown_attribute':task.requestedAttributes.append('payment status')
    if change=='changed_record':task.recordIdentity='DIFFERENT'
    if change=='changed_scope':task.requestedScope='global'
    if change=='duplicate_stage_id':req.append(copy.deepcopy(req[-1]))
    if change=='relabeled_value':req[-1]['value']='source of funds'
    with pytest.raises(PipelineError):stage_responsibilities(a,task,req,expansion)


def test_guidance_and_live_branches_have_separate_namespaces_and_no_assumed_completion():
    _,a,expansion=setup()
    r,p=stage_responsibilities(a,a['liveTask'],None,expansion)
    assert [t.sourceText for t in p.terms if t.requirementId.startswith('attribute_')]==['status']
    assert not r['delegationEstablishesFacts'] and r['finalMergeRequiresEveryOriginalRequirement']
    guidance=[r for r in requirements_for(a['originalTask']) if r['id']=='attribute_3']
    r,p=stage_responsibilities(a,a['originalTask'],guidance,expansion)
    assert r['stageRequirementIdMap']=={'attribute_3':'attribute_3'}
    assert [t.requirementId for t in p.terms]==['attribute_3']


def test_real_structured_coverage_invocation_uses_projected_terms_and_retains_original_question():
    raw,a,expansion=setup(); captured=[];task=a['knowledgeTask'];requirements=knowledge_requirements(task)
    async def model(**kwargs):
        captured.append(kwargs)
        return {'stage':'knowledge_coverage','checks':[{'requirementId':r['id'],'status':'not_yet_verified','reason':'No cited definition provided in this input fixture.'} for r in requirements]}
    reader=GenericKnowledgeReader(None,SimpleNamespace(generic_reader_json=model),portal_base_url='https://portal.example')
    reader.deadline=time.monotonic()+10;reader.current_question=reader.canonical_question=raw['question'];reader.evidence_assignment=a
    from app.reader_session_scope import profile_expansion
    reader.expansion=profile_expansion(expansion,a['originalTask'],a['liveTask']);reader.evidence_original_expansion=expansion
    result=asyncio.run(reader.structured(KnowledgeCoverage,'Check supplied knowledge requirements.',{'task':task.model_dump(),'requirements':requirements},lambda p:validate_coverage(p,task,reader.knowledge)))
    assert len(captured)==1 and all(c.status=='not_yet_verified' for c in result.checks)
    data=captured[0]['data'];assert data['originalQuestion']==raw['question']
    assert data['evidenceExplanationTaskAssignment']['originalTask']==a['originalTask'].model_dump()
    terms=data['retrievalHypotheses']['terms'];assert {t['requirementId'] for t in terms}=={r['id'] for r in requirements}
    assert next(t for t in terms if t['requirementId']=='attribute_1')['sourceText'].startswith('how to ')
    assert 'TaskSpec is an interpretation, not permission to drop' not in captured[0]['instruction']
    assert 'stage-local IDs' in captured[0]['instruction']
