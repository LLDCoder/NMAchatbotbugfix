import copy
import json
import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.generic_reader_contracts import Step, RequirementBinding
from app.reader_collection import projection_hash
from app.reader_bindings import bind_analysis_evidence
from test_reader_requirement_coverage import fixture


def membership_fixture():
    t,p,s,k = fixture([{'specimenKey':'one','phase':'a','zone':'East'},
        {'specimenKey':'two','phase':'a','zone':'East'},
        {'specimenKey':'three','phase':'outside','zone':'West'}])
    t.filters = ['assigned to managed members']
    domain = {'operationRef':'GET /roster','sourcePath':'/rows','keyField':'key','labelField':'label'}
    rec = {'id':'specimen.membership','revision':1,'status':'active','kind':'field_semantics',
        'sources':[{'reference':'/research/specimens'}],
        'applicability':{'portal':'admin','environments':['local']}, 'payload':{'bindings':[
            {'id':'managed','kind':'filter','concept':t.filters[0], 'fields':['phase'],
             'operationRef':s['queue']['operationRef'],'sourcePath':'/data/items','membershipDomain':domain},
            {'id':'owners','kind':'group','concept':'phase','fields':['phase'],
             'operationRef':s['queue']['operationRef'],'sourcePath':'/data/items','groupDomain':domain}]}}
    k.add({'chunks':[{'content':json.dumps({'records':[rec]}),'id':'membership-source'}]})
    ref = next(x['passages'][0]['sourceId'] for x in k.prompt() if x['recordId']==rec['id'])
    p.steps.insert(2, Step(id='members',op='filter_membership',inputs=['entities'],field='phase',
        knowledgeBindingId='specimen.membership#managed', expose=False,unknownPolicy='report',label='Managed',evidence=[{'sourceId':ref}]))
    p.steps[-1].inputs=['members'];p.steps[-2].inputs=['members']
    p.steps[-1].unknownPolicy='report';p.steps[-2].unknownPolicy='report'
    p.steps[-1].includeZeroGroups=True;p.steps[-1].knowledgeBindingId='specimen.membership#owners'
    p.requirementBindings.append(RequirementBinding(requirementId='filter_0',sourceId='queue',
        sourcePath='/data/items',fields=['phase'],stepIds=['members'],knowledgeBindingId='specimen.membership#managed'))
    for b in p.requirementBindings:
        if b.requirementId=='group_0': b.knowledgeBindingId='specimen.membership#owners'; b.evidence=[]
    rows=[{'key':'a','label':'Member A'},{'key':'b','label':'Member B'}]
    s['queue']['observationRef']='batch-2'
    s['roster']={'operationRef':'GET /roster','data':{'rows':rows},'principalScopeRef':'principal',
        'capturedAt':'later-than-initial', 'observationRef':'batch-2',
        'fieldEvidence':{'/rows':{'status':'complete','valueHash':projection_hash(rows)}}}
    return t,p,s,k


def execute(f):
    t,p,s,k=f;bind_analysis_evidence(p,t,k,s)
    return execute_analysis(p,s,k,[],task=t)


def test_current_membership_limits_the_requested_population_and_preserves_zero_members():
    result=execute(membership_fixture())
    assert result['requirementsSatisfied'], json.dumps(result['requirementCoverage'])
    assert result['outputs'][0]['value']==2
    assert result['outputs'][1]['value']==[{'phase':'a','count':2},{'phase':'b','count':0}]
    assert result['outputs'][1]['displayRows']==[{'phase':'Member A','count':2},{'phase':'Member B','count':0}]


@pytest.mark.parametrize('fault',['stale','principal','hash','duplicate','requested'])
def test_wrong_domain_or_unrequested_filter_is_rejected(fault):
    f=membership_fixture();t,p,s,k=f
    if fault=='stale':s['roster']['observationRef']='batch-1'
    if fault=='principal':s['roster']['principalScopeRef']='other'
    if fault=='hash':s['roster']['data']['rows'][0]['key']='changed'
    if fault=='duplicate':
        s['roster']['data']['rows'].append(s['roster']['data']['rows'][0].copy())
        s['roster']['fieldEvidence']['/rows']['valueHash']=projection_hash(s['roster']['data']['rows'])
    if fault=='requested':
        t.filters=[];p.requirementBindings=[b for b in p.requirementBindings if b.requirementId!='filter_0']
    with pytest.raises(PipelineError):execute(f)


def test_unknown_assignment_is_not_treated_as_known_outside_member():
    f=membership_fixture(); f[2]['queue']['data']['data']['items'][2]['phase']=None
    result=execute(f)
    assert not result['requirementsSatisfied']
    assert 'membership_key_unavailable' in result['missing']
    assert result['outputs'][0]['value']==2


def test_membership_proof_cannot_satisfy_a_sibling_output_without_filter():
    f=membership_fixture();f[1].steps[-2].inputs=['entities']
    result=execute(f)
    assert not result['requirementsSatisfied']
    assert next(c for c in result['requirementCoverage'] if c['id']=='filter_0')['outputIds']==['phases']


def redundant_fixture():
    t,p,s,k=membership_fixture()
    p.steps.append(Step(id='domain_read',op='read_rows',sourceId='roster',path='/rows',
        fields=['key','label'],label='Domain',expose=False,evidence=list(p.steps[0].evidence)))
    for b in p.requirementBindings:
        if b.requirementId in {'filter_0','group_0'}: b.stepIds.insert(0,'domain_read')
    return t,p,s,k


def test_duplicate_domain_projection_is_runtime_provenance_not_output_lineage():
    t,p,s,k=redundant_fixture();corrections=[]
    bind_analysis_evidence(p,t,k,s,corrections=corrections)
    assert len([c for c in corrections if c['reason']=='operator_domain_already_verified_by_runtime'])==2
    result=execute_analysis(p,s,k,[],task=t)
    assert result['requirementsSatisfied']
    assert result['outputs'][0]['value']==2
    assert all('domain_read' not in b.stepIds for b in p.requirementBindings)


@pytest.mark.parametrize('fault',['stale','principal','hash','extra_field','different_path','wrong_operator'])
def test_compiler_does_not_drop_unverified_or_unrelated_domain_read(fault):
    t,p,s,k=redundant_fixture()
    if fault=='stale':s['roster']['observationRef']='stale'
    if fault=='principal':s['roster']['principalScopeRef']='other'
    if fault=='hash':s['roster']['data']['rows'][0]['label']='mutated'
    if fault=='extra_field':p.steps[-1].fields.append('unrelated')
    if fault=='different_path':p.steps[-1].path='/other'
    if fault=='wrong_operator':p.steps[2].knowledgeBindingId='specimen.membership#owners'
    with pytest.raises(PipelineError):bind_analysis_evidence(p,t,k,s)
