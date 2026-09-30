"""Synthetic record projections and scope denials, independent of business pages."""
import copy
import pytest
from app.generic_reader import PipelineError, record_source_failure, render_generic_answer
from app.reader_requirements import collection_dependencies, minimal_detail_projection, requirements_for
from app.reader_routing import validate_decision
from test_reader_browser_analysis_repairs import dependency_fixture
from test_reader_routing_v03 import RoutingTests


def fixture():
    task, source, kb, record = dependency_fixture()
    task.outputShape='detail';task.recordIdentity='SPEC-42';task.requestedAttributes=['color']
    task.requestedMeasures=[];task.groupBy=[];task.timeRange='unknown'
    record['payload']['bindings'].append({'id':'color','kind':'attribute','concept':'color','fields':['color'],
        'operationRef':source['operationRef'],'sourcePath':'/data/items'})
    record['payload']['routing']={'records':[{'id':'record','operationRef':source['operationRef'],
        'sourcePath':'/data/items','identityField':'number','keyFields':['specimenKey'],'unique':False}]}
    return task,source,kb,record


def projection(f):
    task,source,kb,record=f
    deps,ambiguous=collection_dependencies(task,kb,'/research/specimens',source,'/data/items')
    return minimal_detail_projection(task,kb,'/research/specimens',source,'/data/items',deps,ambiguous)


def test_detail_projection_omits_unrequested_volatile_property_and_keeps_record_number():
    f=fixture();out=projection(f)
    assert set(out)=={'specimenKey','color','number'}
    assert 'clockMinutes' not in out


@pytest.mark.parametrize('change',['unknown_attribute','unknown_filter','ambiguous','missing_record','wrong_operation','count','no_identity'])
def test_projection_cannot_drop_unresolved_or_conditional_dependencies(change):
    f=fixture();task,source,kb,record=f
    if change=='unknown_attribute':task.requestedAttributes.append('unknown')
    if change=='unknown_filter':task.filters.append('unmapped constraint')
    if change=='ambiguous':
        fact=copy.deepcopy(record['payload']['bindings'][-1]);fact['id']='other';fact['fields']=['otherColor'];record['payload']['bindings'].append(fact)
    if change=='missing_record':record['payload'].pop('routing')
    if change=='wrong_operation':record['payload']['routing']['records'][0]['operationRef']='GET /other'
    if change=='count':task.outputShape='count';task.requestedMeasures=['count']
    if change=='no_identity':task.recordIdentity=''
    assert projection(f) is None


def test_collection_instability_is_not_mislabeled_as_missing_record_knowledge():
    s={'api':{'operationRef':'GET /specimens','collectionFailure':'collection_changed_between_passes',
              'collectionDiagnostics':{'comparison':{'changedFields':['clockMinutes']}}}}
    error=record_source_failure([{'operationRef':'GET /specimens'}],s,s,{})
    assert (error.code,error.category)==('collection_changed_between_passes','runtime')
    assert error.details['comparison']['changedFields']==['clockMinutes']


def denial():
    helper=RoutingTests();helper.setUp()
    d=helper.decision(decision='permission_denied',routePlan=[])
    for c in d.candidates[0].conditions:
        if c.requirementId=='object':c.status='supported';c.evidence=d.candidates[0].evidence
        if c.requirementId=='scope':c.status='conflict';c.evidence=d.candidates[0].evidence
    return helper,d


def test_cited_scope_denial_is_distinct_from_authentication_failure():
    h,d=denial();validate_decision(d,h.task,h.candidates,h.k)
    for lang in ['en','ar']:
        answer=render_generic_answer({'failureCategory':'permission','missing':['requested_scope_not_available']},lang)
        assert 'could not be verified' not in answer and 'تعذر التحقق من الهوية' not in answer
        assert ('cannot retrieve' if lang=='en' else 'لا يمكنني استرجاع') in answer


@pytest.mark.parametrize('change',['unknown','missing_citation','missing_candidate','unsupported_object','route'])
def test_missing_knowledge_cannot_become_a_scope_denial(change):
    h,d=denial()
    if change=='unknown':next(c for c in d.candidates[0].conditions if c.requirementId=='scope').status='unknown'
    if change=='missing_citation':next(c for c in d.candidates[0].conditions if c.requirementId=='scope').evidence=[]
    if change=='missing_candidate':d.candidates=[]
    if change=='unsupported_object':next(c for c in d.candidates[0].conditions if c.requirementId=='object').status='unknown'
    if change=='route':d.routePlan=h.decision().routePlan
    with pytest.raises(PipelineError):validate_decision(d,h.task,h.candidates,h.k)


def test_collector_sends_only_verified_detail_dependencies_to_live_gateway():
    import asyncio,time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task,source,kb,record=fixture()
    op=source['operationRef'];fields=['specimenKey','number','color','clockMinutes']
    record['payload'].update(sourceBinding={'operationRef':op,'sourcePath':'/data/items'},
        fields={f:'Documented scalar' for f in fields},
        pagination={'pageIndex':'page','pageSize':'size','rowsPath':'/data/items','totalPath':'/data/total'})
    source['collectionContext'].update(contextRef='b'*64,requestFields=['pageIndex','pageSize'],
        rowSchemas=[{'path':'/data/items','fields':fields}])
    class ReachedGateway(Exception):pass
    class Gateway:
        async def invoke(self,principal,name,payload,**kwargs):
            assert set(payload['collections'][0]['fields'])=={'specimenKey','color','number'}
            raise ReachedGateway()
    reader=GenericKnowledgeReader(Gateway(),None,portal_base_url='https://portal.test')
    reader.page='/research/specimens';reader.knowledge=kb;reader.deadline=time.monotonic()+60
    ref=kb.prompt()[0]['passages'][0]['sourceId']
    async def planned(contract,instruction,data,validator):
        p=CollectionPlan(stage='collection',collections=[{'sourceId':'queue','rowsPath':'/data/items',
            'totalPath':'/data/total','fields':fields,'identityFields':['specimenKey'],
            'pageField':'pageIndex','sizeField':'pageSize','evidence':[{'sourceId':ref}]}])
        validator(p);return p
    reader.structured=planned
    with pytest.raises(ReachedGateway):
        asyncio.run(reader.collect_sources(None,task,PortalReadRequest(reader.page,({'type':'observe'},)),{}, {'queue':source}))
    assert reader.audit['excludedProjectionFields'][0]['fields']==['clockMinutes']


def test_verified_single_record_key_is_read_privately_for_detail_proofs():
    from test_reader_generic_completion import detail_fixture
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader import execute_analysis
    task,plan,sources,kb=detail_fixture()
    read=next(s for s in plan.steps if s.op=='read_rows')
    keys=sources['detail']['verifiedRecord']['keyFields']
    read.fields=[f for f in read.fields if f not in keys]
    plan.context.scope='global';task.requestedScope='unknown'
    bind_analysis_evidence(plan,task,kb,sources)
    out=execute_analysis(plan,sources,kb,[],task=task)
    assert out['requirementsSatisfied'],out['missing']
    assert out['context']['scope']=='unknown'
    assert all(not set(keys)&set(row) for o in out['outputs'] for row in o['value'])


@pytest.mark.parametrize('change',['absent_proof','wrong_identity','incomplete_key'])
def test_private_identity_read_cannot_upgrade_an_unverified_record(change):
    from test_reader_generic_completion import detail_fixture
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader import execute_analysis
    task,plan,sources,kb=detail_fixture();read=plan.steps[0];read.fields=['color']
    source=sources['detail']
    if change=='absent_proof':source.pop('verifiedRecord')
    if change=='wrong_identity':source['verifiedRecord']['identity']='OTHER'
    if change=='incomplete_key':source['fieldEvidence']['/data/key']['status']='transformed'
    try:
        bind_analysis_evidence(plan,task,kb,sources)
        out=execute_analysis(plan,sources,kb,[],task=task)
        assert not out['requirementsSatisfied']
    except PipelineError as exc:
        assert exc.code=='field_evidence_incomplete'


def test_wrong_snapshot_scope_requests_replanning_with_actual_context_variant():
    import json
    from test_reader_snapshot_observation import fixture
    from app.reader_bindings import bind_analysis_evidence
    f=fixture();task,plan,sources,kb,_=f
    correct=copy.deepcopy(next(iter(kb.items.values()))['record']);wrong=next(iter(kb.items.values()))['record']
    for fact in wrong['payload']['bindings']:fact['contextParameters']['scope']='other-unit'
    correct['id']='research.window.actual'
    kb.add({'chunks':[{'id':'actual','content':json.dumps({'records':[correct]})}]})
    with pytest.raises(PipelineError,match='analysis_binding_context_mismatch') as error:
        bind_analysis_evidence(plan,task,kb,sources)
    assert error.value.details['contextVerifiedBindingIds']==['research.window.actual#object']


@pytest.mark.parametrize('technical',['Selected response (scope=1) with its response-echoed date window.',
    'Numeric metric values are not entity identifiers.', 'القيم الرقمية ليست معرّفات الكيانات.'])
def test_customer_context_omits_execution_proofs_without_changing_values(technical):
    evidence={'requirementsSatisfied':True,'completeness':'complete','outputs':[{'id':'value','label':'Rate',
        'role':'detail','value':[{'rate':100}],'fieldLabels':{'rate':'Rate (%)'}}],
        'context':{'scope':'team','grain':{'value':technical},'caveats':[{'value':technical}]}}
    answer=render_generic_answer(evidence,'en')
    assert '100' in answer and 'team' in answer and technical not in answer
    assert technical in render_generic_answer(evidence,'en',include_diagnostics=True)


def test_page_alias_property_focus_is_not_an_extra_population():
    from test_reader_snapshot_observation import fixture
    from app.reader_intent_dedup import collapse_property_focus
    task,_,_,kb,_=fixture();r=next(iter(kb.items.values()))['record'];f=r['payload']['bindings'][-1]
    f['aliases']=['research completion ratio'];task.businessFocus='research completion ratio'
    revised,proof=collapse_property_focus(task,kb)
    assert not revised.businessFocus and revised.requestedAttributes==task.requestedAttributes
    assert task.businessFocus and proof==['research.window#rate']


@pytest.mark.parametrize('change',['qualifier','negation','population','conflict','no_alias','list'])
def test_property_deduplication_preserves_actual_constraints(change):
    from test_reader_snapshot_observation import fixture
    from app.reader_intent_dedup import collapse_property_focus
    task,_,_,kb,_=fixture();r=next(iter(kb.items.values()))['record'];f=r['payload']['bindings'][-1]
    f['aliases']=['research completion ratio'];task.businessFocus='research completion ratio'
    if change=='qualifier':task.businessFocus='high research completion ratio'
    if change=='negation':task.businessFocus='not research completion ratio'
    if change=='population':r['payload']['bindings'].append({**{k:v for k,v in f.items() if k!='displayUnit'},'id':'population','kind':'population','concept':task.businessFocus})
    if change=='conflict':r['payload']['bindings'].append({**f,'id':'other','concept':'different metric'})
    if change=='no_alias':f['aliases']=[]
    if change=='list':task.outputShape='list'
    revised,proof=collapse_property_focus(task,kb)
    assert revised.businessFocus==task.businessFocus and not proof


def test_multihop_knowledge_prompt_retains_only_authorized_prerequisite_pages():
    from test_reader_prerequisites import multisource_fixture
    kb=multisource_fixture()[3]
    assert {d['recordId'] for d in kb.prompt(page='/viewer-extra')}=={'viewer.extra'}
    assert {d['recordId'] for d in kb.prompt(page='/viewer-extra',evidence_pages=['/viewer?tab=current'])}=={'viewer.profile','viewer.extra'}
    assert {d['recordId'] for d in kb.prompt(page='/viewer-extra',evidence_pages=['/unrelated'])}=={'viewer.extra'}


def test_missing_detail_retains_independently_verified_lookup_record():
    from test_reader_prerequisites import lookup_fixture
    from app.reader_prerequisites import reusable_lookups,recoverable_lookup_failure
    from app.generic_reader_contracts import RouteVerification
    from app.reader_routing import task_fingerprint
    task,sources,bound=lookup_fixture()
    v=RouteVerification(taskFingerprint=task_fingerprint(task),requestedRoute='/detail',actualRoute='/detail',
        passed=False,checks=[{'requirementId':'page','status':'verified'},
        {'requirementId':'record','status':'unconfirmed','reason':'record_not_verified'}])
    retained=reusable_lookups(task,sources,bound,'principal')
    assert recoverable_lookup_failure(v,retained)
    assert sources['lookup']['verifiedRecord']['identity']==task.recordIdentity
    assert not recoverable_lookup_failure(v,reusable_lookups(task,sources,bound,'different-principal'))


@pytest.mark.parametrize('reason',['page_identity_mismatch','requested_view_unverified','record_ambiguous','record_binding_knowledge_missing'])
def test_lookup_recovery_does_not_hide_other_route_failures(reason):
    from app.reader_prerequisites import recoverable_lookup_failure
    from app.generic_reader_contracts import RouteVerification
    v=RouteVerification(taskFingerprint='task',requestedRoute='/detail',actualRoute='/detail',passed=False,
        checks=[{'requirementId':'record','status':'unconfirmed','reason':reason}])
    assert not recoverable_lookup_failure(v,{'lookup':{}})
    if reason=='page_identity_mismatch':
        v.checks.append(type(v.checks[0])(requirementId='record',status='unconfirmed',reason='record_not_verified'))
        assert not recoverable_lookup_failure(v,{'lookup':{}})


def test_explicit_scope_exclusions_cannot_be_reported_as_missing_knowledge():
    h,d=denial();d.decision='knowledge_gap'
    with pytest.raises(PipelineError,match='routing_scope_conflict_misclassified'):
        validate_decision(d,h.task,h.candidates,h.k)
    next(c for c in d.candidates[0].conditions if c.requirementId=='scope').status='unknown'
    validate_decision(d,h.task,h.candidates,h.k)


@pytest.mark.parametrize('focus',['research completion ratio indicator','value of research completion ratio','research completion ratio field'])
def test_property_wrapper_deduplication_keeps_documented_attribute(focus):
    from test_reader_snapshot_observation import fixture
    from app.reader_intent_dedup import collapse_property_focus
    task,_,_,kb,_=fixture();f=next(iter(kb.items.values()))['record']['payload']['bindings'][-1]
    f['aliases']=['research completion ratio'];task.businessFocus=focus
    revised,proof=collapse_property_focus(task,kb)
    assert revised.businessFocus=='' and proof
    assert revised.requestedAttributes==task.requestedAttributes


@pytest.mark.parametrize('focus',['high research completion ratio indicator','not research completion ratio metric','research completion ratio above 50 value'])
def test_display_wrapper_never_removes_real_population_qualifier(focus):
    from test_reader_snapshot_observation import fixture
    from app.reader_intent_dedup import collapse_property_focus
    task,_,_,kb,_=fixture();f=next(iter(kb.items.values()))['record']['payload']['bindings'][-1]
    f['aliases']=['research completion ratio'];task.businessFocus=focus
    revised,proof=collapse_property_focus(task,kb)
    assert revised.businessFocus==focus and not proof


def test_planning_omits_only_proven_wrong_variants_and_keeps_validation_diagnostics():
    import json
    from test_reader_snapshot_observation import fixture
    from app.reader_bindings import planning_bindings,applicable_bindings
    task,plan,sources,kb,record=fixture()
    other=copy.deepcopy(next(iter(kb.items.values()))['record']);other['id']='research.other'
    for fact in other['payload']['bindings']:
        fact['contextParameters']['scope']='different'
    kb.add({'chunks':[{'id':'other','content':json.dumps({'records':[other]})}]})
    allfacts=applicable_bindings(kb,sources);choices=planning_bindings(kb,sources)
    assert any(f['recordId']=='research.other' for f in allfacts)
    assert all(f['recordId']!='research.other' for f in choices)
    assert choices


@pytest.mark.parametrize('change',['unproven_date','different_meaning','different_fields'])
def test_planning_keeps_unresolved_or_non_equivalent_definitions(change):
    import json
    from test_reader_snapshot_observation import fixture
    from app.reader_bindings import planning_bindings
    task,plan,sources,kb,_=fixture()
    other=copy.deepcopy(next(iter(kb.items.values()))['record']);other['id']='research.other'
    for fact in other['payload']['bindings']:
        fact['contextParameters']['scope']='different'
        if change=='different_meaning':fact['concept']='other meaning'
        if change=='different_fields':fact['fields']=['otherField']
    if change=='unproven_date':sources['s']['fieldEvidence'].pop('/data/start')
    kb.add({'chunks':[{'id':'other','content':json.dumps({'records':[other]})}]})
    assert any(f['recordId']=='research.other' for f in planning_bindings(kb,sources))


def test_lookup_field_knowledge_is_checked_before_projection():
    from app.reader_prerequisites import missing_lookup_attributes
    task,source,kb,record=fixture();task.requestedAttributes=['color','weight']
    defs=[{'operationRef':source['operationRef'],'sourcePath':'/data/items'}]
    assert missing_lookup_attributes(task,kb,defs)==['weight']
    assert missing_lookup_attributes(task,kb,[{**defs[0],'sourcePath':'/different'}])==['color','weight']
    task.recordIdentity=''
    assert missing_lookup_attributes(task,kb,defs)==[]


def test_final_hop_tag_is_positional_but_does_not_alter_candidate_or_parameters():
    from app.reader_routing import normalize_final_hop_role
    h,d=denial();d=h.decision();d.routePlan[-1].purpose='locate_record'
    original=d.model_dump();fixed,changed=normalize_final_hop_role(d)
    assert changed and d.model_dump()==original
    assert fixed.routePlan[-1].purpose=='read_final'
    for field in ['candidateId','parameterBindingIds','requirementIds']:
        assert getattr(fixed.routePlan[-1],field)==getattr(d.routePlan[-1],field)
    assert normalize_final_hop_role(fixed)==(fixed,False)


def scope_fixture():
    from test_reader_snapshot_observation import fixture
    task,plan,sources,kb,_=fixture();record=next(iter(kb.items.values()))['record']
    fact=copy.deepcopy(record['payload']['bindings'][0]);fact.update(id='scope',kind='scope',concept='team')
    record['payload']['bindings'].append(fact)
    return task,plan,sources,kb,fact


def test_verified_scope_corrects_false_planner_uncertainty_without_waiving_other_gaps():
    from app.reader_bindings import verified_source_scopes,validate_observed_scope
    task,plan,sources,kb,_=scope_fixture();scopes=verified_source_scopes(kb,sources)
    assert scopes['s']['scope']=='team';plan.missing=['unconfirmed_context']
    with pytest.raises(PipelineError,match='analysis_observed_scope_is_verified'):validate_observed_scope(plan,task,scopes)
    assert plan.missing==['unconfirmed_context']
    plan.context.scope='team';validate_observed_scope(plan,task,scopes)
    assert plan.missing==['unconfirmed_context']


@pytest.mark.parametrize('change',['mismatched','ambiguous','undeclared','named_record'])
def test_scope_hint_cannot_infer_unproven_or_global_record_access(change):
    from app.reader_bindings import verified_source_scopes,validate_observed_scope
    task,plan,sources,kb,fact=scope_fixture();plan.missing=['uncertain']
    if change=='mismatched':fact['contextParameters']['scope']='other'
    if change=='ambiguous':
        other=copy.deepcopy(fact);other.update(id='other-scope',concept='personal');next(iter(kb.items.values()))['record']['payload']['bindings'].append(other)
    if change=='undeclared':fact['contextParameters']={}
    if change=='named_record':task.recordIdentity='R-17'
    scopes=verified_source_scopes(kb,sources)
    if change!='named_record':assert not scopes
    validate_observed_scope(plan,task,scopes)
    assert plan.context.scope=='unknown' and plan.missing==['uncertain']


@pytest.mark.parametrize('shape',['detail','list'])
def test_complete_detail_plan_with_only_observations_requires_explicit_repair(shape):
    from test_reader_snapshot_observation import fixture
    from app.reader_bindings import validate_detail_output_role
    task,plan,_,_,_=fixture();plan.steps[0].role='observation';task.outputShape=shape
    with pytest.raises(PipelineError,match='analysis_detail_output_role_required'):validate_detail_output_role(plan,task)
    assert plan.steps[0].role=='observation'
    plan.steps[0].role='detail';validate_detail_output_role(plan,task)


@pytest.mark.parametrize('change',['missing','unbound','not_detail'])
def test_partial_observations_are_not_promoted_or_rejected_as_complete_details(change):
    from test_reader_snapshot_observation import fixture
    from app.reader_bindings import validate_detail_output_role
    task,plan,_,_,_=fixture();plan.steps[0].role='observation'
    if change=='missing':plan.missing=['requested_property_not_verified']
    if change=='unbound':plan.requirementBindings.pop()
    if change=='not_detail':task.outputShape='overview'
    validate_detail_output_role(plan,task)
    assert plan.steps[0].role=='observation'
