import copy
import json
import pytest
from app.generic_reader import KnowledgeStore, execute_analysis, PipelineError
from app.generic_reader_contracts import Step
from app.reader_bindings import bind_analysis_evidence
from app.reader_subject import bind_authenticated_records, bind_record_properties
from app.reader_prerequisites import lookup_attribute_fields, reusable_lookups
from app.reader_routing import task_fingerprint
from test_reader_parent_properties import fixture
from test_projected_collection import gateway


def sibling_fixture():
    task, plan, sources, old = fixture()
    source=sources['profile']; value=source['data']['data']
    source['data']['data']={'record':{'key':value.pop('key')},**value}
    source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    record=copy.deepcopy(next(iter(old.items.values()))['record']); p=record['payload']
    p['sourceBinding']['sourcePath']='/data/record'
    p['recordProperties']=[{'parentPath':'/data/record','propertyPath':'/data/'+name,
        'parentKeyFields':['key'],'relation':'response_owned_property'} for name in ['groups','badges']]
    for f in p['bindings']:
        if f['kind'] in {'object','grain','scope'}:f['sourcePath']='/data/record'
    kb=KnowledgeStore();kb.add({'chunks':[{'id':'viewer','content':json.dumps({'records':[record]})}]})
    old_ref=old.prompt()[0]['passages'][0]['sourceId']; new_ref=kb.prompt()[0]['passages'][0]['sourceId']
    plan=type(plan).model_validate_json(plan.model_dump_json().replace(old_ref,new_ref))
    return task, plan, sources, kb


def run_sibling(f):
    task,plan,sources,kb=f
    bind_authenticated_records(kb,sources,'viewer-a')
    bind_record_properties(kb,sources)
    bind_analysis_evidence(plan,task,kb,sources)
    return execute_analysis(plan,sources,kb,[],task=task)


def test_sibling_properties_require_declared_relation_and_complete_response():
    f=sibling_fixture();f[0].recordIdentity='viewer-a'
    result=run_sibling(f)
    assert result['requirementsSatisfied'] and not result['missing']
    assert all('key' not in r for o in result['outputs'] for r in o['value'])


def test_identical_property_definitions_keep_all_provenance_without_false_conflict():
    task, plan, sources, kb = sibling_fixture()
    task.recordIdentity = 'viewer-a'
    extra = copy.deepcopy(next(iter(kb.items.values()))['record'])
    extra['id'] += '.second-page-description'
    # This document independently describes ownership, without adding field meanings.
    extra['payload']['bindings'] = []
    kb.add({'chunks': [{'id': 'second', 'content': json.dumps({'records': [extra]})}]})
    result = run_sibling((task, plan, sources, kb))
    assert result['requirementsSatisfied'] and not result['missing']
    for proof in sources['profile']['verifiedProperties'].values():
        assert len(proof['recordIds']) == 2
        assert extra['id'] in proof['recordIds']


def test_duplicate_definition_still_requires_complete_untampered_property():
    f = sibling_fixture()
    extra = copy.deepcopy(next(iter(f[3].items.values()))['record'])
    extra['id'] += '.duplicate'
    f[3].add({'chunks': [{'id': 'second', 'content': json.dumps({'records': [extra]})}]})
    f[2]['profile']['fieldEvidence']['/data/groups']['status'] = 'bounded'
    bind_authenticated_records(f[3], f[2], 'viewer-a')
    bind_record_properties(f[3], f[2])
    assert '/data/groups' not in f[2]['profile']['verifiedProperties']


@pytest.mark.parametrize('change',['undeclared','partial','tampered','wrong_operation','wrong_parent_key'])
def test_sibling_relation_cannot_upgrade_unknown_or_mismatched_evidence(change):
    f=sibling_fixture();record=next(iter(f[3].items.values()))['record'];source=f[2]['profile']
    if change=='undeclared':record['payload']['recordProperties']=[]
    if change=='partial':source['fieldEvidence']['/data/groups']['status']='bounded'
    if change=='tampered':source['data']['data']['groups'].append({'name':'Injected'})
    if change=='wrong_operation':record['payload']['sourceBinding']['operationRef']='GET /api/other'
    if change=='wrong_parent_key':record['payload']['recordProperties'][0]['parentKeyFields']=['other']
    if change=='tampered':
        with pytest.raises(PipelineError, match='field_evidence_incomplete'):run_sibling(f)
        return
    assert not run_sibling(f)['requirementsSatisfied']


def test_lookup_projects_only_requested_attributes_of_the_exact_observed_mapping():
    task,_,_,kb=fixture()
    task.recordIdentity='viewer-a';task.requestedAttributes=['groups']
    base={'GET /api/viewer':['key']}
    assert lookup_attribute_fields(task,kb,[{'operationRef':'GET /api/viewer','sourcePath':'/data/groups'}],base)=={'GET /api/viewer':['key','name']}
    assert lookup_attribute_fields(task,kb,[{'operationRef':'GET /api/viewer','sourcePath':'/other'}],base)==base


def test_unobserved_optional_lookup_attribute_does_not_block_detail_identity():
    task,_,_,kb=fixture()
    task.recordIdentity='viewer-a';task.requestedAttributes=['groups']
    base={'GET /api/viewer':['key']}
    definitions=[{'operationRef':'GET /api/viewer','sourcePath':'/data/groups'}]
    sources={'list':{'operationRef':'GET /api/viewer','collectionContext':{
        'rowSchemas':[{'path':'/data/groups','fields':['key']} ]}}}
    assert lookup_attribute_fields(task,kb,definitions,base,observed_sources=sources)==base
    sources['list']['collectionContext']['rowSchemas'][0]['fields'].append('name')
    assert lookup_attribute_fields(task,kb,definitions,base,observed_sources=sources)=={'GET /api/viewer':['key','name']}


def lookup_fixture():
    task=fixture()[0];task.recordIdentity='R-1'
    bound={'taskFingerprint':task_fingerprint(task),'identity':'R-1','keys':{'key':'17'}}
    source={'data':{'items':[{'key':17,'code':'R-1','unit':'U'}]},'principalScopeRef':'principal',
        'taskFingerprint':task_fingerprint(task),'operationRef':'GET /lookup', 'page':'/lookup',
        'verifiedRecord':{'path':'/items','field':'code','identity':'R-1','keyFields':['key'],'single':False},
        'collectionReceipt':{'completeness':'complete','operationRef':'GET /lookup','rowsPath':'/items','rowCount':1}}
    return task,{'lookup':source},bound


def test_same_task_lookup_evidence_keeps_original_rows_and_requires_record_filter():
    task,sources,bound=lookup_fixture()
    result=reusable_lookups(task,sources,bound,'principal')
    assert result==sources and result['lookup'] is sources['lookup']
    assert not result['lookup']['verifiedRecord']['single']


@pytest.mark.parametrize('change',['identity','keys','task','principal','truncated','partial','row_count','duplicates'])
def test_lookup_reuse_rejects_wrong_entity_context_or_incomplete_scan(change):
    task,sources,bound=lookup_fixture();s=sources['lookup']
    if change=='identity':bound['identity']='R-2'
    if change=='keys':bound['keys']['key']='99'
    if change=='task':s['taskFingerprint']='stale'
    if change=='principal':s['principalScopeRef']='other'
    if change=='truncated':s['truncated']=True
    if change=='partial':s['collectionReceipt']['completeness']='bounded'
    if change=='row_count':s['collectionReceipt']['rowCount']=2
    if change=='duplicates':s['data']['items']*=2;s['collectionReceipt']['rowCount']=2
    assert not reusable_lookups(task,sources,bound,'principal')


def test_display_projection_keeps_only_requested_fields_with_identity_in_lineage():
    task,plan,sources,kb=fixture()
    plan.steps[0].fields.append('internal')
    for row in sources['profile']['data']['data']['groups']:row['internal']=99
    sources['profile']['fieldEvidence']=gateway._reader_field_evidence(sources['profile']['data'],sources['profile']['data'])
    bind_authenticated_records(kb,sources,'viewer-a')
    bind_analysis_evidence(plan,task,kb,sources)
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied']
    assert all('internal' not in row for out in result['outputs'] for row in out['value'])


def test_knowledge_coverage_accepts_only_declared_executed_evidence_pages():
    from app.reader_knowledge_coverage import KnowledgeCoverage,knowledge_requirements,validate_coverage
    task,_,_,kb=fixture();ref=kb.prompt()[0]['passages'][0]['sourceId']
    review=KnowledgeCoverage(stage='knowledge_coverage',checks=[{'requirementId':r['id'],
        'status':'covered','evidence':[{'sourceId':ref}],'reason':'Synthetic page meaning.'}
        for r in knowledge_requirements(task)])
    with pytest.raises(PipelineError,match='knowledge_coverage_page_mismatch'):
        validate_coverage(review,task,kb,'/other')
    validate_coverage(review,task,kb,['/other','/viewer'])


def multisource_fixture():
    task,plan,sources,kb=fixture();task.recordIdentity='viewer-a'
    extra=copy.deepcopy(sources['profile']);extra['page']='/viewer-extra'
    extra['operationRef']='GET /api/viewer-extra';sources['extra']=extra
    record=copy.deepcopy(next(iter(kb.items.values()))['record'])
    record['id']='viewer.extra';record['applicability']['pageRefs']=['/viewer-extra']
    record['sources']=[{'reference':'/viewer-extra'}]
    record['payload']['sourceBinding']['operationRef']=extra['operationRef']
    for binding in record['payload']['bindings']:binding['operationRef']=extra['operationRef']
    kb.add({'chunks':[{'id':'extra','content':json.dumps({'records':[record]})}]})
    ref=next(p['passages'][0]['sourceId'] for p in kb.prompt() if p['recordId']=='viewer.extra')
    plan.steps[1].sourceId='extra';plan.steps[1].evidence=[type(plan.steps[0].evidence[0])(sourceId=ref)]
    for binding in list(plan.requirementBindings[:3]):
        binding.stepIds=['groups']
        other=binding.model_copy(deep=True);other.sourceId='extra';other.stepIds=['badges']
        other.knowledgeBindingId=other.knowledgeBindingId.replace('viewer.profile#','viewer.extra#')
        plan.requirementBindings.append(other)
    badge=next(b for b in plan.requirementBindings if b.requirementId=='attribute_1')
    badge.sourceId='extra';badge.knowledgeBindingId='viewer.extra#badges'
    return task,plan,sources,kb


def run_multisource(f):
    task,plan,sources,kb=f
    bind_authenticated_records(kb,sources,'viewer-a')
    bind_analysis_evidence(plan,task,kb,sources)
    return execute_analysis(plan,sources,kb,[],task=task)


def test_same_record_properties_from_two_operations_each_require_own_context():
    result=run_multisource(multisource_fixture())
    assert result['requirementsSatisfied'] and not result['missing']
    contexts=[c for c in result['requirementCoverage'] if c['kind'] in {'object','grain','scope'}]
    assert all(set(c['outputIds'])=={'groups','badges'} and len(c['bindingResults'])==2 for c in contexts)


@pytest.mark.parametrize('change',['wrong_identity','wrong_scope','missing_definition'])
def test_context_of_one_source_cannot_cover_another_sources_property(change):
    from app.reader_collection import projection_hash
    f=multisource_fixture()
    if change=='wrong_identity':f[2]['extra']['data']['data']['key']='other'
    if change=='wrong_scope':f[2]['extra']['collectionContext']['parameterHashes']['extraFilter']=projection_hash('restricted')
    if change=='missing_definition':
        f[1].requirementBindings=[b for b in f[1].requirementBindings if not (b.sourceId=='extra' and b.requirementId=='scope')]
        record=next(i['record'] for i in f[3].items.values() if i.get('recordId')=='viewer.extra')
        record['payload']['bindings']=[b for b in record['payload']['bindings'] if b['kind']!='scope']
    result=run_multisource(f)
    assert not result['requirementsSatisfied']
    assert next(c for c in result['requirementCoverage'] if c['id']=='attribute_1')['status']=='unfulfilled'


def test_duplicate_context_from_same_source_is_not_multisource_proof():
    f=multisource_fixture()
    f[1].requirementBindings.append(f[1].requirementBindings[0].model_copy(deep=True))
    with pytest.raises(PipelineError,match='requirement_binding_invalid'):run_multisource(f)


def test_unique_page_context_is_compiled_for_a_second_same_record_property_source():
    f=multisource_fixture()
    f[1].requirementBindings=[b for b in f[1].requirementBindings
        if not (b.sourceId=='extra' and b.requirementId in {'object','grain'})]
    result=run_multisource(f)
    assert result['requirementsSatisfied']
    assert all(any(b.sourceId=='extra' and b.requirementId==kind for b in f[1].requirementBindings)
        for kind in ['object','grain'])


def test_ambiguous_page_context_is_not_selected_just_to_complete_an_answer():
    f=multisource_fixture()
    f[1].requirementBindings=[b for b in f[1].requirementBindings
        if not (b.sourceId=='extra' and b.requirementId=='object')]
    record=copy.deepcopy(next(i['record'] for i in f[3].items.values() if i.get('recordId')=='viewer.extra'))
    record['id']='viewer.conflict'
    f[3].add({'chunks':[{'id':'conflict','content':json.dumps({'records':[record]})}]})
    result=run_multisource(f)
    assert not result['requirementsSatisfied']
    assert not any(b.sourceId=='extra' and b.requirementId=='object' for b in f[1].requirementBindings)


def filtered_record_fixture():
    f=multisource_fixture();task,plan,sources,kb=f
    task.requestedScope='unknown'
    plan.requirementBindings=[b for b in plan.requirementBindings if b.requirementId!='scope']
    extra=sources['extra'];extra['data']={'data':[{'key':'viewer-a','name':'Member'},{'key':'viewer-b','name':'Other'}]}
    extra['fieldEvidence']=gateway._reader_field_evidence(extra['data'],extra['data'])
    extra['verifiedRecord']={'identity':'viewer-a','field':'key','path':'/data','keyFields':['key'],'single':False}
    record=next(i['record'] for i in kb.items.values() if i.get('recordId')=='viewer.extra')
    record['payload'].pop('authenticatedRecord')
    for b in record['payload']['bindings']:
        if b['id']=='badges':b['sourcePath']='/data'
    read=plan.steps[1];read.path='/data';read.fields=['key','name'];read.expose=False
    plan.steps.extend([Step(id='pick',op='filter',inputs=['badges'],field='key',predicate='eq',operand='viewer-a',expose=False,
        role='observation',label='Selected record',evidence=read.evidence),
        Step(id='show',op='project',inputs=['pick'],fields=['name'],role='detail',expose=True,label='Badge',evidence=read.evidence)])
    return f


def test_complete_identity_filter_with_exactly_one_observed_row_proves_grain_without_dedup():
    result=run_multisource(filtered_record_fixture())
    assert result['requirementsSatisfied']
    assert next(o['value'] for o in result['outputs'] if o['id']=='show')==[{'name':'Member'}]


@pytest.mark.parametrize('change',['duplicate','wrong_filter','unfiltered','wrong_key'])
def test_unique_filtered_grain_still_requires_exact_identity_and_keys(change):
    f=filtered_record_fixture();source=f[2]['extra']
    if change=='duplicate':
        source['data']['data'].append(copy.deepcopy(source['data']['data'][0]))
        source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    if change=='wrong_filter':next(s for s in f[1].steps if s.id=='pick').operand='viewer-b'
    if change=='unfiltered':next(s for s in f[1].steps if s.id=='show').inputs=['badges']
    if change=='wrong_key':source['verifiedRecord']['keyFields']=['other']
    assert not run_multisource(f)['requirementsSatisfied']


@pytest.mark.parametrize('empty', [False, True])
def test_list_of_verified_record_properties_retains_parent_context(empty):
    f = sibling_fixture()
    task, plan, sources, kb = f
    task.recordIdentity = 'viewer-a'
    task.outputShape = 'list'
    if empty:
        sources['profile']['data']['data']['groups'] = []
        sources['profile']['fieldEvidence'] = gateway._reader_field_evidence(
            sources['profile']['data'], sources['profile']['data'])
    result = run_sibling(f)
    assert result['requirementsSatisfied'] and not result['missing']
    assert all('key' not in row for out in result['outputs'] for row in out['value'])


@pytest.mark.parametrize('change', ['undeclared', 'partial', 'wrong_parent_key'])
def test_list_shape_does_not_create_property_ownership(change):
    f = sibling_fixture()
    f[0].recordIdentity = 'viewer-a'
    f[0].outputShape = 'list'
    record = next(iter(f[3].items.values()))['record']
    if change == 'undeclared':
        record['payload']['recordProperties'] = []
    if change == 'partial':
        f[2]['profile']['fieldEvidence']['/data/groups']['status'] = 'bounded'
    if change == 'wrong_parent_key':
        record['payload']['recordProperties'][0]['parentKeyFields'] = ['other']
    assert not run_sibling(f)['requirementsSatisfied']


def test_property_list_cannot_count_parent_records():
    from app.reader_subject import parent_property_context
    task, plan, sources, kb = sibling_fixture()
    task.outputShape = 'list'
    task.requestedMeasures = ['count']
    bind_authenticated_records(kb, sources, 'viewer-a')
    bind_record_properties(kb, sources)
    assert not parent_property_context(task, 'object', '/data/record', ['key'],
        sources['profile'], plan.steps[0], {'role': 'detail', 'value': []})
