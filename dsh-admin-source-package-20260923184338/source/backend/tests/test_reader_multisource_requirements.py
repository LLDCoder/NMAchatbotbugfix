import copy
import json
import pytest
from app.generic_reader import KnowledgeStore,execute_analysis,PipelineError
from app.generic_reader_contracts import AnalysisPlan
from app.reader_collection import projection_hash
from app.reader_requirements import requirements_for
from test_reader_requirement_coverage import fixture


def multi_fixture():
    task,base,original,k=fixture()
    task=task.model_copy(update={'businessFocus':'','timeRange':'unknown',
        'requestedMeasures':['current specimen count','historical specimen count']})
    record=copy.deepcopy(next(i['record'] for i in k.items.values() if i.get('record')))
    basefacts={f['kind']:f for f in record['payload']['bindings'] if f['id']!='zone'}
    record['payload']['bindings']=[]
    plan=base.model_dump();plan['steps']=[];plan['requirementBindings']=[]
    sources={}
    for index,view in enumerate(['current','historical']):
        sid=view;source=copy.deepcopy(original['queue'])
        source['collectionContext']['parameterHashes']={'view':projection_hash(view)}
        sources[sid]=source
        for step in base.model_dump()['steps']:
            if step['id']=='total':continue
            step['id']=view+'_'+step['id'];step['inputs']=[view+'_'+s for s in step['inputs']]
            if step['sourceId']:step['sourceId']=sid
            plan['steps'].append(step)
        for req in requirements_for(task):
            if req['kind']=='measure' and req['id']!='measure_'+str(index):continue
            fact=copy.deepcopy(basefacts.get(req['kind'],basefacts['object']))
            fact.update(id=view+'_'+req['id'],kind=req['kind'],concept=req['value'],contextParameters={'view':view})
            if req['kind']=='measure':fact.update(operator='count',conditions=[])
            record['payload']['bindings'].append(fact)
            step=view+('_phases' if req['kind'] in ['group','measure'] else '_entities')
            plan['requirementBindings'].append({'requirementId':req['id'],'sourceId':sid,'sourcePath':'/data/items',
                'fields':fact['fields'],'stepIds':[step],'knowledgeBindingId':record['id']+'#'+fact['id'],'evidence':[]})
    knowledge=KnowledgeStore();knowledge.add({'chunks':[{'id':'definition','content':json.dumps({'records':[record]})}]})
    ref=knowledge.prompt()[0]['passages'][0]['sourceId']
    for b in plan['requirementBindings']:b['evidence']=[{'sourceId':ref}]
    for s in plan['steps']:s['evidence']=[{'sourceId':ref}]
    plan['context']['scopeEvidence']=[{'sourceId':ref}]
    for key in ['grain','population','filterScope','time']:plan['context'][key]={'value':'documented '+key,'evidence':[{'sourceId':ref}]}
    plan['context']['caveats']=[]
    return task,AnalysisPlan.model_validate(plan),sources,knowledge


def run(f):
    t,p,s,k=f
    return execute_analysis(p,s,k,[],task=t)


def test_separate_query_contexts_prove_each_grouped_measure():
    result=run(multi_fixture())
    assert result['requirementsSatisfied'],result['requirementCoverage']
    for req in result['requirementCoverage']:
        assert req['status']=='satisfied'
    assert {o['id'] for o in result['outputs']}=={'current_phases','historical_phases'}

@pytest.mark.parametrize('fault',['wrong_context','missing_scope','borrowed_lineage'])
def test_one_valid_branch_cannot_certify_other_context(fault):
    t,p,s,k=multi_fixture()
    if fault=='wrong_context':s['historical']['collectionContext']['parameterHashes']['view']=projection_hash('other')
    if fault=='missing_scope':p.requirementBindings=[b for b in p.requirementBindings if not(b.requirementId=='scope' and b.sourceId=='historical')]
    if fault=='borrowed_lineage':
        for b in p.requirementBindings:
            if b.requirementId=='scope' and b.sourceId=='historical':b.stepIds=['current_entities']
    result=run((t,p,s,k))
    assert not result['requirementsSatisfied']
    measure=next(x for x in result['requirementCoverage'] if x['id']=='measure_1')
    assert measure['status']=='unfulfilled'

@pytest.mark.parametrize('fault',['different_principal','duplicate_source','duplicate_measure'])
def test_duplicate_bindings_do_not_merge_different_users_or_double_claim_a_measure(fault):
    t,p,s,k=multi_fixture()
    if fault=='different_principal':s['historical']['principalScopeRef']='different-user'
    if fault=='duplicate_source':
        b=next(b for b in p.requirementBindings if b.requirementId=='scope')
        p.requirementBindings.append(b.model_copy(deep=True))
    if fault=='duplicate_measure':
        b=next(b for b in p.requirementBindings if b.requirementId=='measure_0')
        p.requirementBindings.append(b.model_copy(update={'sourceId':'historical'}))
    with pytest.raises(PipelineError,match='requirement_binding_invalid'):run((t,p,s,k))
