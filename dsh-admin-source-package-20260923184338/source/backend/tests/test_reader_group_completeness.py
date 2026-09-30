import pytest
from app.generic_reader import PipelineError
from app.reader_context import validate_task_grain, merge_task
from app.reader_routing import task_fingerprint
from app.generic_reader_contracts import SlotUpdate
from test_reader_membership import membership_fixture, execute


def test_complete_domain_policy_requires_observed_zero_group_proof():
    f=membership_fixture();f[0].groupCompleteness='complete_domain'
    result=execute(f)
    assert result['requirementsSatisfied']
    assert result['outputs'][1]['value'][-1]['count']==0
    f=membership_fixture();f[0].groupCompleteness='complete_domain'
    f[1].steps[-1].includeZeroGroups=False
    result=execute(f)
    assert not result['requirementsSatisfied']
    assert next(x for x in result['requirementCoverage'] if x['id']=='group_0')['status']=='unfulfilled'


def test_output_policy_is_preserved_in_context_and_fingerprint():
    t=membership_fixture()[0];before=task_fingerprint(t)
    t.groupCompleteness='complete_domain'
    assert task_fingerprint(t)!=before
    merged=merge_task(t,{})
    assert next(s for s in merged.slotUpdates if s.field=='groupCompleteness').value=='complete_domain'
    followup=t.model_copy(deep=True);followup.contextRelation='continue';followup.slotUpdates=[]
    followup.groupCompleteness='observed'
    continued=merge_task(followup,{'previousIntent':merged.model_dump()})
    assert continued.groupCompleteness=='complete_domain'


def test_zero_inclusion_is_not_a_record_filter_but_zero_only_filter_is_retained():
    t=membership_fixture()[0];t.filters+=['include member even if pending count is zero']
    with pytest.raises(PipelineError,match='intent_group_output_filter_conflict'):validate_task_grain(t)
    assert t.filters[-1]=='include member even if pending count is zero'
    t.filters[-1]='pending count equals zero'
    validate_task_grain(t)
    assert t.filters[-1]=='pending count equals zero'
    t.groupCompleteness='complete_domain';t.groupBy=[]
    with pytest.raises(PipelineError,match='intent_group_domain_without_dimension'):validate_task_grain(t)
