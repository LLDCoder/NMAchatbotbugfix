"""Keep missing live observations distinct from absent knowledge definitions."""
from app.generic_reader import unavailable_source_error, record_source_failure


def test_known_operation_not_observed_is_an_execution_gap():
    observation={'apiDiscovery':{'candidates':[{
        'operationKey':'GET /api/other','policyState':'allowed','status':200}]}}
    error=unavailable_source_error(observation,['GET /api/items'])
    assert error.code=='expected_source_not_observed'
    assert error.category=='runtime'
    assert error.details['expectedOperations']==['GET /api/items']
    assert error.details['observedOperations']==['GET /api/other']


def test_no_expected_binding_keeps_the_knowledge_gap():
    error=unavailable_source_error({'apiDiscovery':{'candidates':[]}})
    assert error.code=='source_binding_missing'
    assert error.category=='knowledge_gap'


def test_policy_and_permission_errors_keep_their_precise_categories():
    for candidate,code,category in [
        ({'policyState':'blocked','status':None},'reader_policy_blocked','execution_configuration'),
        ({'policyState':'allowed','status':403},'upstream_access_denied','permission'),
        ({'policyState':'allowed','status':503},'source_response_unavailable','runtime'),
    ]:
        observation={'apiDiscovery':{'candidates':[{'operationKey':'GET /api/items',**candidate}]}}
        error=unavailable_source_error(observation,['GET /api/items'])
        assert (error.code,error.category)==(code,category)


def test_detail_identity_failure_is_runtime_when_its_known_source_was_not_observed():
    definitions=[{'operationRef':'GET /api/crystals/{id}'}]
    sources={'user':{'operationRef':'GET /api/current-user'}}
    error=record_source_failure(definitions,sources,sources,{'apiDiscovery':{'candidates':[]}})
    assert (error.code,error.category)==('expected_source_not_observed','runtime')


def test_detail_identity_failure_is_planning_when_known_observed_source_was_omitted():
    definitions=[{'operationRef':'GET /api/crystals/{id}'}]
    sources={'detail':{'operationRef':'GET /api/crystals/{id}'},'user':{'operationRef':'GET /api/current-user'}}
    error=record_source_failure(definitions,sources,{'user':sources['user']},{})
    assert (error.code,error.category)==('record_source_not_selected','planning')


def test_diagnostic_does_not_override_record_validation_with_selected_source_or_no_definition():
    sources={'detail':{'operationRef':'GET /api/crystals/{id}'}}
    assert record_source_failure([],sources,sources,{}) is None
    assert record_source_failure([{'operationRef':'GET /api/crystals/{id}'}],sources,sources,{}) is None


def test_bound_query_parameter_keeps_page_definitions_for_runtime_diagnosis():
    from types import SimpleNamespace
    from app.reader_routing import page_routing
    definition={'id':'entity','operationRef':'GET /api/crystals/{id}'}
    knowledge=SimpleNamespace(items={'known':{'record':{'id':'page','status':'active',
        'applicability':{'pageRefs':['/work/crystals/detail']},'payload':{'routing':{'records':[definition]}}}}})
    bindings=page_routing(knowledge,'/work/crystals/detail?id=42')['records']
    assert len(bindings)==1
    failure=record_source_failure(bindings,{}, {}, {'apiDiscovery':{'candidates':[]}})
    assert (failure.code,failure.category)==('expected_source_not_observed','runtime')
    assert page_routing(knowledge,'/work/unrelated?id=42')['records']==[]
