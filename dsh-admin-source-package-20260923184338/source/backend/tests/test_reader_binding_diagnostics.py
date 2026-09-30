import pytest
from test_reader_requirement_coverage import fixture, execute
from app.generic_reader import PipelineError


def test_duplicate_proof_repair_preserves_requirements_and_source_validation():
    f=fixture();original=f[1].requirementBindings[-1]
    f[1].requirementBindings.append(original.model_copy(deep=True))
    with pytest.raises(PipelineError) as error: execute(f)
    assert error.value.category=='planning'
    details=error.value.details
    assert details['duplicateBindings'][0]['requirementId']==original.requirementId
    assert len(details['duplicateBindings'][0]['proposals'])==2
    f[1].requirementBindings.pop()
    assert execute(f)['requirementsSatisfied']
    # Repairing cardinality must not make an unrelated data source acceptable.
    f[2]['queue']['operationRef']='POST /api/unrelated/list'
    assert not execute(f)['requirementsSatisfied']


def test_unknown_requirement_has_actionable_diagnostic_without_false_duplicate():
    f=fixture();f[1].requirementBindings[-1].requirementId='not_requested'
    with pytest.raises(PipelineError) as error: execute(f)
    assert error.value.details['unknownRequirementIds']==['not_requested']
    assert error.value.details['duplicateBindings']==[]
