"""Replay real rejected refinement candidates without weakening fact requirements."""
import asyncio
import copy
import json
import time
from pathlib import Path

import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_evidence_explanation import preserve_refinement_declarations, validate_declarations, partition
from app.reader_requirements import requirements_for
from test_reader_evidence_explanation import fixture as provenance_fixture

FIXTURES=json.loads((Path(__file__).parent/'fixtures/refinement_explanation_order.json').read_text())
CASES=[(case, raw) for case in FIXTURES for raw in case['rejectedCandidates']]


@pytest.mark.parametrize('case,raw', CASES)
def test_actual_refinement_rejections_preserve_every_fact_and_remove_only_ignored_annotation(case,raw):
    draft=TaskSpec.model_validate(case['draft']);candidate=TaskSpec.model_validate(raw)
    assert draft.evidenceExplanations == [] and candidate.evidenceExplanations
    before=candidate.model_dump();fixed,changed=preserve_refinement_declarations(candidate,draft)
    assert changed and fixed.evidenceExplanations == []
    assert candidate.model_dump()==before
    assert fixed.model_dump()=={**before,'evidenceExplanations':[]}
    assert requirements_for(fixed)==requirements_for(candidate)
    validate_declarations(fixed,case['originalQuestion'])
    assert partition(fixed,case['originalQuestion']) is None  # ordinary source validation still owns ALL fields


@pytest.mark.parametrize('case,raw', CASES)
def test_structured_refinement_validates_the_owned_annotation_before_accepting_the_same_requirements(case,raw):
    class Planner:
        calls=0
        async def generic_reader_json(self,**kwargs):
            self.calls+=1;return copy.deepcopy(raw)
    planner=Planner();reader=GenericKnowledgeReader(None,planner,portal_base_url='https://test.invalid')
    reader.deadline=time.monotonic()+30;reader.response_language=case['language']
    reader.current_question='';reader.canonical_question='';seen=[]
    result=asyncio.run(reader.structured(TaskSpec,'Refine the same original task.',
        {'phase':'knowledge_refinement','draft':case['draft']},lambda task:seen.append(task.model_dump())))
    assert planner.calls==1 and len(seen)==1
    assert result.evidenceExplanations == []
    assert requirements_for(result)==requirements_for(TaskSpec.model_validate(raw))
    normalization=reader.audit['intentNormalizations'][0]
    assert normalization['requirementsRemoved'] is False and normalization['sourceVerificationWaived'] is False


def test_valid_provenance_assignments_are_kept_and_still_validated():
    _, assignment, *_ = provenance_fixture();draft=assignment['originalTask']
    candidate=draft.model_copy(deep=True,update={'evidenceExplanations':[]})
    fixed,changed=preserve_refinement_declarations(candidate,draft)
    assert changed and fixed.evidenceExplanations==draft.evidenceExplanations
    assert requirements_for(fixed)==requirements_for(draft)
    # Ownership does not grant evidence: the existing provenance tests verify receipts independently.


def test_invalid_draft_assignment_is_not_silently_removed():
    case,raw=CASES[0];draft=TaskSpec.model_validate(raw)
    candidate=TaskSpec.model_validate(case['draft'])
    fixed,_=preserve_refinement_declarations(candidate,draft)
    with pytest.raises(PipelineError):validate_declarations(fixed,case['originalQuestion'])


@pytest.mark.parametrize('phase',['initial','intent_repair',''])
def test_other_task_stages_keep_rejecting_invalid_annotations(phase):
    case,raw=CASES[0]
    class Planner:
        async def generic_reader_json(self,**kwargs):return copy.deepcopy(raw)
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://test.invalid')
    reader.deadline=time.monotonic()+30;reader.current_question=case['originalQuestion'];reader.canonical_question=''
    with pytest.raises(PipelineError):
        asyncio.run(reader.structured(TaskSpec,'Interpret the original question.',
            {'phase':phase,'draft':case['draft'],'question':case['originalQuestion']}))


def test_refinement_annotation_repair_does_not_waive_another_validator():
    case,raw=CASES[0]
    class Planner:
        async def generic_reader_json(self,**kwargs):return copy.deepcopy(raw)
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://test.invalid')
    reader.deadline=time.monotonic()+30;reader.current_question='';reader.canonical_question=''
    def reject(task):raise PipelineError('requested_view_unverified','planning')
    with pytest.raises(PipelineError,match='requested_view_unverified'):
        asyncio.run(reader.structured(TaskSpec,'Refine.',{'phase':'knowledge_refinement','draft':case['draft']},reject))
