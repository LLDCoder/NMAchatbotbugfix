import json
import pytest
from app.generic_reader import PipelineError, execute_analysis
from app.generic_reader_contracts import RequirementBinding
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_group_domain import requested_domain_label
from test_reader_membership import membership_fixture


def named_fixture(label='Member B'):
    t,p,s,k=membership_fixture()
    domain={'operationRef':'GET /roster','sourcePath':'/rows','keyField':'key','labelField':'label'}
    rec={'id':'specimen.named','revision':1,'status':'active','kind':'field_semantics',
        'sources':[{'reference':'/research/specimens'}],
        'applicability':{'portal':'admin','environments':['local']},'payload':{'bindings':[
            {'id':'named','kind':'filter','concept':'named member','fields':['phase'],
             'operationRef':s['queue']['operationRef'],'sourcePath':'/data/items','membershipDomain':domain,
             'domainSelection':{'mode':'exact_label','prefixes':['member name','assignee is','اسم الموظف']}},
            {'id':'name','kind':'attribute','concept':'member name','fields':['phase'],
             'operationRef':s['queue']['operationRef'],'sourcePath':'/data/items','domainLabel':domain}]}}
    k.add({'chunks':[{'content':json.dumps({'records':[rec]}),'id':'named-source'}]})
    t.filters=['member name '+label]; t.requestedAttributes=['member name']
    p.steps[2].knowledgeBindingId='specimen.named#named'
    next(b for b in p.requirementBindings if b.requirementId=='filter_0').knowledgeBindingId='specimen.named#named'
    p.requirementBindings.append(RequirementBinding(requirementId='attribute_0',sourceId='queue',
        sourcePath='/data/items',fields=['phase'],stepIds=['phases'],knowledgeBindingId='specimen.named#name'))
    return t,p,s,k


def run(f):
    t,p,s,k=f;bind_analysis_evidence(p,t,k,s)
    return execute_analysis(p,s,k,[],task=t)


@pytest.mark.parametrize('prefix',['member name ','assignee is ','اسم الموظف: '])
def test_named_member_with_zero_work_remains_one_verified_group(prefix):
    f=named_fixture();f[0].filters=[prefix+'Member B']
    r=run(f)
    assert r['requirementsSatisfied'],r['requirementCoverage']
    assert r['outputs'][0]['value']==0
    assert r['outputs'][1]['displayRows']==[{'phase':'Member B','count':0}]
    assert r['outputs'][1]['groupDomainProof']['memberCount']==1


def test_selection_uses_live_identity_and_does_not_compare_name_with_key():
    r=run(named_fixture('member a'))
    assert r['requirementsSatisfied']
    assert r['outputs'][0]['value']==2
    assert r['outputs'][1]['displayRows']==[{'phase':'Member A','count':2}]


@pytest.mark.parametrize('label',['Member','Member A and Member B','missing person'])
def test_unknown_or_partial_label_is_not_zero_or_fuzzy_match(label):
    with pytest.raises(PipelineError,match='domain_label_not_found'):run(named_fixture(label))


def test_duplicate_public_names_need_resolution_even_with_different_keys():
    f=named_fixture();s=f[2]['roster'];s['data']['rows'].append({'key':'c','label':'Member B'})
    s['fieldEvidence']['/rows']['valueHash']=projection_hash(s['data']['rows'])
    with pytest.raises(PipelineError,match='domain_label_ambiguous'):run(f)


def test_grouping_domain_cannot_substitute_another_roster_after_membership_filter():
    f=named_fixture();s=f[2];s['other']={**s['roster'],'operationRef':'GET /other'}
    for item in f[3].items.values():
        rec=item.get('record') or {}
        for fact in rec.get('payload',{}).get('bindings',[]):
            if fact.get('id')=='owners':fact['groupDomain']['operationRef']='GET /other'
    with pytest.raises(PipelineError,match='group_domain_membership_mismatch'):run(f)


def test_name_parser_requires_declared_prefix_and_preserves_name_boundary():
    fact={'kind':'filter','domainSelection':{'mode':'exact_label','prefixes':['member','member name']}}
    assert requested_domain_label(fact,{'kind':'filter','value':'member name "Still Have"'})=='Still Have'
    assert requested_domain_label(fact,{'kind':'filter','value':'remember name Member B'}) is None
    assert requested_domain_label(fact,{'kind':'attribute','value':'member name Member B'}) is None
