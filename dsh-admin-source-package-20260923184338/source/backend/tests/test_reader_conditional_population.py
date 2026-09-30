import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.generic_reader_contracts import Step
from app.reader_context import validate_task_grain
from test_reader_requirement_coverage import fixture


def setup(kind='population'):
    task,plan,sources,knowledge=fixture()
    task.timeRange='unknown'
    record=next(v['record'] for v in knowledge.items.values() if (v.get('record') or {}).get('id')=='specimen.fields')
    fact=next(f for f in record['payload']['bindings'] if f['kind']=='population')
    binding=next(b for b in plan.requirementBindings if b.requirementId=='population')
    if kind=='filter':
        task.businessFocus='';task.filters=['open'];fact['kind']='filter';binding.requirementId='filter_0'
    fact['fields']=['specimenKey','phase'];binding.fields=fact['fields']
    fact['conditions']=[{'field':'phase','predicate':'eq','value':'Warm'}]
    return task,plan,sources,knowledge


def run(f):
    task,plan,sources,knowledge=f
    return execute_analysis(plan,sources,knowledge,[],task=task)


@pytest.mark.parametrize('kind',['population','filter'])
def test_conditional_definition_does_not_certify_unfiltered_queue(kind):
    result=run(setup(kind))
    assert not result['requirementsSatisfied']


@pytest.mark.parametrize('kind',['population','filter'])
def test_exact_condition_applies_to_total_and_breakdown(kind):
    f=setup(kind);plan=f[1]
    plan.steps.insert(2,Step(id='selected',op='filter',inputs=['entities'],field='phase',operand='Warm',label='Selected',expose=False,evidence=plan.steps[0].evidence))
    for s in plan.steps:
        if s.id in {'total','phases'}:s.inputs=['selected']
    result=run(f)
    assert result['requirementsSatisfied']
    assert result['outputs'][0]['value']==1


def test_a_filtered_total_cannot_certify_unfiltered_breakdown():
    f=setup();plan=f[1]
    plan.steps.insert(2,Step(id='selected',op='filter',inputs=['entities'],field='phase',operand='Warm',label='Selected',expose=False,evidence=plan.steps[0].evidence))
    next(s for s in plan.steps if s.id=='total').inputs=['selected']
    assert not run(f)['requirementsSatisfied']


@pytest.mark.parametrize('predicate,operand',[('ne','Warm'),('eq','Cold'),('eq',True)])
def test_wrong_predicate_or_typed_value_cannot_prove_population(predicate,operand):
    f=setup();plan=f[1]
    plan.steps.insert(2,Step(id='selected',op='filter',inputs=['entities'],field='phase',predicate=predicate,operand=operand,label='Selected',expose=False,evidence=plan.steps[0].evidence))
    for s in plan.steps:
        if s.id in {'total','phases'}:s.inputs=['selected']
    assert not run(f)['requirementsSatisfied']


def test_count_parser_must_not_require_its_computed_measure_as_a_stored_attribute():
    task=fixture()[0].model_copy(update={'requestedMeasures':['count of warm specimens'],'requestedAttributes':['warm specimens count']})
    with pytest.raises(PipelineError,match='intent_measure_attribute_conflict'):validate_task_grain(task)
    task.outputShape='list'
    validate_task_grain(task)


def request_context_setup():
    f=setup('filter');task,plan,sources,knowledge=f
    record=next(v['record'] for v in knowledge.items.values() if (v.get('record') or {}).get('id')=='specimen.fields')
    fact=next(x for x in record['payload']['bindings'] if x['kind']=='filter')
    fact['conditions']=[];fact['bindingMode']='request_context';fact['contextParameters']={'view':'open'}
    from app.reader_collection import projection_hash
    sources['queue']['collectionContext']['parameterHashes']={'view':projection_hash('open')}
    # All other context definitions must prove the same unchanged request.
    for x in record['payload']['bindings']:
        if 'contextParameters' in x:x['contextParameters']={'view':'open'}
    return f


def test_explicit_request_context_filter_needs_no_synthetic_row_predicate():
    assert run(request_context_setup())['requirementsSatisfied']


@pytest.mark.parametrize('change',['different_value','additional_filter','missing_parameter','wrong_operation','no_mode'])
def test_request_context_cannot_hide_different_scope_or_undocumented_filter(change):
    f=request_context_setup();source=f[2]['queue']
    from app.reader_collection import projection_hash
    if change=='different_value':source['collectionContext']['parameterHashes']['view']=projection_hash('closed')
    if change=='additional_filter':source['collectionContext']['parameterHashes']['owner']=projection_hash('another')
    if change=='missing_parameter':source['collectionContext']['parameterHashes']={}
    if change=='wrong_operation':source['operationRef']='POST /api/other/list'
    if change=='no_mode':
        for v in f[3].items.values():
            for x in (v.get('record') or {}).get('payload',{}).get('bindings',[]):x.pop('bindingMode',None)
    assert not run(f)['requirementsSatisfied']


@pytest.mark.parametrize('shape,expected',[('list',True),('count',False),('detail',False)])
def test_list_collection_retains_page_defined_public_identity(shape,expected):
    from app.reader_requirements import collection_dependencies
    f=fixture();task,plan,sources,knowledge=f;task.outputShape=shape
    record=next(v['record'] for v in knowledge.items.values() if (v.get('record') or {}).get('id')=='specimen.fields')
    record['applicability']['pageRefs']=['/research/specimens']
    next(x for x in record['payload']['bindings'] if x['kind']=='object')['displayFields']=['label']
    deps,_=collection_dependencies(task,knowledge,'/research/specimens',sources['queue'],'/data/items')
    obj=next(x for x in deps if x['requirementId']=='object')
    assert ('label' in obj['fields']) is expected
    assert obj['fields'][0]=='specimenKey'


def test_public_identity_metadata_cannot_rebind_a_different_operation():
    from app.reader_requirements import collection_dependencies
    f=fixture();task,_,sources,knowledge=f;task.outputShape='list'
    record=next(v['record'] for v in knowledge.items.values() if (v.get('record') or {}).get('id')=='specimen.fields')
    record['applicability']['pageRefs']=['/research/specimens']
    obj=next(x for x in record['payload']['bindings'] if x['kind']=='object');obj['displayFields']=['label'];obj['operationRef']='GET /other'
    deps,_=collection_dependencies(task,knowledge,'/research/specimens',sources['queue'],'/data/items')
    assert not any('label' in x['fields'] for x in deps)


@pytest.mark.parametrize('constraint',['team','my team'])
def test_plain_scope_is_not_duplicated_as_a_row_filter(constraint):
    task=fixture()[0].model_copy(update={'requestedScope':'team','filters':[constraint]})
    with pytest.raises(PipelineError,match='intent_scope_filter_duplicate'):validate_task_grain(task)


@pytest.mark.parametrize('constraint',['team I manage','my managed team','Laboratory team','my team excluding trainees'])
def test_independent_scope_qualifiers_remain_required(constraint):
    task=fixture()[0].model_copy(update={'requestedScope':'team','filters':[constraint]})
    validate_task_grain(task)
    assert task.filters==[constraint]
