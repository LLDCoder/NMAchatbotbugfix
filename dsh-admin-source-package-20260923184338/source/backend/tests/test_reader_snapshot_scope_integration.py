"""Offline integration of recorded scalars with explicitly controlled citations.

Original EN/AR fixtures and plans remain immutable. controlled() supplies an
executable plan with actual local passage IDs; this is not model or QA replay.
"""
import asyncio
from copy import deepcopy
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, execute_analysis, render_generic_answer
from app.generic_reader_contracts import AnalysisPlan, RouteVerification, Citation
from app.reader_bindings import bind_analysis_evidence, verified_source_scopes, validate_observed_scope
from app.reader_collection import projection_hash
from app.reader_previous_answer import project_previous_answer, render_previous_answer
from app.reader_quality import STAGES
from app.reader_routing import task_fingerprint
from app.reader_snapshot_scope import project_snapshot_scope, render_snapshot_personnel_scope
from test_reader_snapshot_scope import load, fields, subject_bound_scope_facts


def controlled(language='en', *, scope='unknown', missing=None):
    doc,task,plan,kb=load(language)
    # Keep the recorded TaskSpec, steps, fields and binding IDs. Replace context
    # text and its unavailable historical passage IDs with a controlled plan.
    kb.prompt()
    for step in plan.steps:
        rid=step.knowledgeBindingId.split('#')[0]
        pid=next(pid for pid,(key,_) in kb.passages.items() if kb.items[key].get('recordId')==rid)
        step.evidence=[Citation(sourceId=pid)]
    for binding in plan.requirementBindings:binding.evidence=[]
    cite=[c.model_dump() for c in plan.steps[0].evidence]
    raw=plan.model_dump()
    raw['context']={'scope':scope,'scopeEvidence':cite if scope!='unknown' else [],
        'grain':{'value':'current captured scalar panels','evidence':cite},
        'population':{'value':'each panel retains its population','evidence':cite},
        'filterScope':{'value':'captured request filters','evidence':cite},
        'time':{'value':'current observation','evidence':cite},'caveats':[]}
    raw['missing']=list(missing if missing is not None else plan.missing)
    plan=AnalysisPlan.model_validate(raw)
    reader=GenericKnowledgeReader(None,None,portal_base_url='https://portal.test')
    reader.knowledge=kb;reader.page='/dashboard';reader.response_language=language
    reader.audit['verifiedPageDisplayContext']=deepcopy(doc['pageContext'])
    reader.route_verification=RouteVerification.model_validate(doc['routeVerificationEvidence'][-1])
    reader.intent_state={'status':'resolved','taskFingerprint':task_fingerprint(task),
        'principalFingerprint':doc['principalScopeRef'],'catalogVersion':'controlled-catalog'}
    reader.audit['captures']=[{'page':'/dashboard','capturedAt':doc['pageContext']['capturedAt'],
        'bindingVerification':'observed_current_session','appliedFilters':[]}]
    for stage in STAGES:
        if stage not in {'output','task_completion'}:reader.quality.record(stage,'passed')
    return doc,task,plan,reader


def analyze(doc,task,plan,reader, *, fingerprint=None, authorized=lambda _:True):
    sources=doc['sources'];bind_analysis_evidence(plan,task,reader.knowledge,sources)
    result=execute_analysis(plan,sources,reader.knowledge,[],task=task)
    reader.validate_snapshot_scope(plan,task,sources,result,
        fingerprint=doc['principalScopeRef'] if fingerprint is None else fingerprint,
        authorized=authorized,observed_scopes=verified_source_scopes(reader.knowledge,sources))
    return result


def finish(reader,task,result):
    return reader.finish(analysis=result,task=task,page_name='Dashboard').result.public_json()


@pytest.mark.parametrize('language',['en','ar'])
def test_controlled_executable_plan_keeps_29_recorded_values_dates_units_and_unknown_scope(language):
    doc,task,plan,reader=controlled(language,missing=[])
    original=deepcopy(doc)
    result=analyze(doc,task,plan,reader)
    assert result['requirementsSatisfied'] and len(fields(result['snapshotScopeProof']))==29
    assert all(f['scope']=='unknown' for f in fields(result['snapshotScopeProof']))
    payload=finish(reader,task,result)
    assert payload['result']=='success' and payload['snapshotScopeProof']['observationStatus']=='verified'
    assert [o['value'] for o in payload['outputs']]==[o['value'] for o in doc['analysis']['outputs']]
    assert payload['queryReceipt']['snapshotScopeProofHash']==projection_hash(payload['snapshotScopeProof'])
    answer=render_generic_answer(payload,language)
    assert '100%' in answer and '(min)' in answer
    assert '2026-09-22' in answer and '2026-09-28' in answer and 'Asia/Dubai' in answer
    assert ('Personnel scope by field:' if language=='en' else 'نطاق الأشخاص لكل حقل:') in answer
    assert 'Scope: team' not in answer
    assert doc==original


@pytest.mark.parametrize('missing',[['dashboard_scope_unconfirmed'],['independent_business_rule_unconfirmed']])
def test_unknown_with_missing_is_advisory_and_remains_not_confirmed(missing):
    doc,task,plan,reader=controlled('ar',missing=missing)
    result=analyze(doc,task,plan,reader)
    assert result['snapshotScopeAdvisory']['code']=='analysis_snapshot_observation_verified'
    assert result['missing']==missing and plan.missing==missing
    payload=finish(reader,task,result)
    assert payload['result']=='not_confirmed' and payload['analysisStatus']=='partial'
    assert payload['missing']==missing and len(payload['outputs'])==3


def test_known_uniform_team_claim_uses_existing_planning_error_without_attaching_proof():
    doc,task,plan,reader=controlled(scope='team',missing=[])
    with pytest.raises(PipelineError) as exc:analyze(doc,task,plan,reader)
    assert exc.value.code=='analysis_snapshot_global_scope_unverified'
    assert exc.value.category=='planning' and len(exc.value.details['unprovedFields'])==29
    assert 'snapshotScopeProof' not in reader.audit


def test_field_limited_scope_fact_cannot_expand_to_source_but_non_snapshot_keeps_old_guard():
    doc,task,plan,reader=controlled('ar',missing=['independent_business_rule_unconfirmed'])
    # Controlled single-panel plan: the scope fact covers SLA only, not its source.
    task.requestedAttributes=['performance metrics'];task.requestedGrain='Dashboard'
    plan.steps=[plan.steps[1]];step=plan.steps[0]
    plan.requirementBindings=[b for b in plan.requirementBindings if b.sourceId==step.sourceId]
    binding=next(b for b in plan.requirementBindings if b.requirementId=='attribute_0')
    binding.knowledgeBindingId='admin.dashboard.license-performance.department#performance_metrics';binding.fields=list(step.fields)
    for source in doc['sources'].values():source['taskFingerprint']=task_fingerprint(task)
    reader.route_verification.taskFingerprint=task_fingerprint(task)
    scopes=verified_source_scopes(reader.knowledge,doc['sources'])
    with pytest.raises(PipelineError,match='analysis_observed_scope_is_verified'):
        validate_observed_scope(plan,task,scopes)
    result=analyze(doc,task,plan,reader)
    assert result['snapshotScopeProof']['observationStatus']=='verified'
    assert fields(result['snapshotScopeProof'])[0]['scope']=='unknown'
    assert result['missing']==['independent_business_rule_unconfirmed']
    # A non-singleton output retains the exact old guard, too.
    row_collection=deepcopy(result);row_collection['outputs'][0]['value']*=2
    row_collection.pop('snapshotScopeProof');row_collection.pop('snapshotScopeAdvisory')
    with pytest.raises(PipelineError,match='analysis_observed_scope_is_verified'):
        reader.validate_snapshot_scope(plan,task,doc['sources'],row_collection,
            fingerprint=doc['principalScopeRef'],authorized=lambda _:True,observed_scopes=scopes)
    # An incomplete singleton proof cannot bypass the old guard.
    reader.audit.pop('verifiedPageDisplayContext')
    with pytest.raises(PipelineError,match='analysis_observed_scope_is_verified'):
        analyze(doc,task,plan,reader)


@pytest.mark.parametrize('fault',['wrong_principal','wrong_capture','route_denied','failed_route','wrong_route_task','no_page_context'])
def test_untrusted_or_mixed_context_never_attaches_snapshot_proof(fault):
    doc,task,plan,reader=controlled(missing=[])
    args={}
    if fault=='wrong_principal':args['fingerprint']='another-user'
    elif fault=='wrong_capture':reader.audit['verifiedPageDisplayContext']['capturedAt']='2020-01-01T00:00:00Z'
    elif fault=='route_denied':args['authorized']=lambda _:False
    elif fault=='failed_route':reader.route_verification.passed=False
    elif fault=='wrong_route_task':reader.route_verification.taskFingerprint='stale-task'
    elif fault=='no_page_context':reader.audit.pop('verifiedPageDisplayContext')
    result=analyze(doc,task,plan,reader,**args)
    assert 'snapshotScopeProof' not in result
    assert 'snapshotScopeAdvisory' not in result


@pytest.mark.parametrize('scope',['personal','team','global'])
def test_explicit_user_scope_still_fails_original_requirements_and_withholds_outputs(scope):
    doc,task,plan,reader=controlled(missing=[]);task.requestedScope=scope
    for source in doc['sources'].values():source['taskFingerprint']=task_fingerprint(task)
    reader.route_verification.taskFingerprint=task_fingerprint(task)
    result=analyze(doc,task,plan,reader)
    assert not result['requirementsSatisfied'] and 'snapshotScopeProof' not in result
    payload=finish(reader,task,result)
    assert payload['outputs']==[] and payload['withheldOutputCount']==3
    assert 'snapshotScopeProof' not in payload and payload['result']!='success'


def test_finish_projects_only_surviving_outputs_and_fields_and_rejects_changed_values():
    doc,task,plan,reader=controlled(missing=[]);result=analyze(doc,task,plan,reader)
    # Existing per-output context withholding, not a new scope exception.
    coverage=next(c for c in result['requirementCoverage'] if c['kind']=='object')
    coverage['outputIds']=coverage['outputIds'][1:]
    payload=finish(reader,task,result)
    assert len(payload['outputs'])==2 and len(payload['snapshotScopeProof']['outputs'])==2
    assert {p['outputId'] for p in payload['snapshotScopeProof']['outputs']}=={o['id'] for o in payload['outputs']}
    output=deepcopy(payload['outputs'][0]);field=next(iter(output['value'][0]))
    output['value']=[{field:output['value'][0][field]}]
    proof=project_snapshot_scope(payload['snapshotScopeProof'],[output])
    assert len(fields(proof))==1
    output['value'][0][field]=1234567
    assert project_snapshot_scope(payload['snapshotScopeProof'],[output]) is None


@pytest.mark.parametrize('language',['en','ar'])
def test_subject_bound_personal_and_neighbor_unknown_display_keeps_definition_revision(language):
    doc,task,plan,reader=controlled(language,missing=[])
    subject_bound_scope_facts(doc,reader.knowledge)
    result=analyze(doc,task,plan,reader)
    proof=result['snapshotScopeProof'];values={f['field']:f for f in proof['outputs'][1]['fields']}
    assert values['slaComplianceRate']['scope']=='personal'
    assert values['overdueTasks']['scopeStatus']=='unknown'
    assert values['slaComplianceRate']['scopeDefinitions']==[{
        'bindingId':'admin.dashboard.license-performance.department#controlled_personal',
        'recordId':'admin.dashboard.license-performance.department','revision':5}]
    output=result['outputs'][1]
    answer=render_snapshot_personnel_scope(output,proof,language)
    assert ('personal' if language=='en' else 'شخصي') in answer
    assert ('unknown' if language=='en' else 'غير معروف') in answer
    visible=render_snapshot_personnel_scope(output,proof,language,visible_fields=['overdueTasks'])
    assert output['fieldLabels']['slaComplianceRate'] not in visible


@pytest.mark.parametrize('fault',['field_status','shape','operation','path'])
def test_projection_cannot_attach_scope_after_output_provenance_changes(fault):
    doc,task,plan,reader=controlled(missing=[]);result=analyze(doc,task,plan,reader)
    output=deepcopy(result['outputs'][0]);ref=output['evidence'][0]
    if fault=='field_status':ref['fieldStatus'][next(iter(output['value'][0]))]='unconfirmed'
    elif fault=='shape':ref['observationShape']='array'
    elif fault=='operation':ref['operationRef']='GET /different'
    elif fault=='path':ref['fieldBinding']='/another'
    assert project_snapshot_scope(result['snapshotScopeProof'],[output]) is None


class Planned:
    def __init__(self,plans):self.plans=plans;self.calls=[]
    async def generic_reader_json(self,**kwargs):
        self.calls.append(deepcopy(kwargs));return deepcopy(self.plans[min(len(self.calls)-1,len(self.plans)-1)])


@pytest.mark.parametrize('repair',[True,False])
def test_structured_correction_uses_existing_budget_and_repeated_failure_stop(repair):
    doc,task,plan,reader=controlled(scope='team',missing=[])
    corrected=plan.model_copy(deep=True);corrected.context.scope='unknown';corrected.context.scopeEvidence=[]
    reader.planner=Planned([plan.model_dump(),corrected.model_dump()] if repair else [plan.model_dump()])
    reader.deadline=time.monotonic()+30
    accepted={}
    def validate(candidate):accepted['result']=analyze(doc,task,candidate,reader)
    call=reader.structured(AnalysisPlan,'Controlled offline validation.',
        {'task':task.model_dump(),'sources':doc['sources']},validate)
    if repair:
        asyncio.run(call)
        assert accepted['result']['snapshotScopeProof']['observationStatus']=='verified'
    else:
        with pytest.raises(PipelineError):asyncio.run(call)
        assert 'result' not in accepted
    assert len(reader.planner.calls)==2  # unchanged repeated-failure early stop
    assert 'analysis_snapshot_global_scope_unverified' in reader.planner.calls[1]['correction']


def historical(language='en'):
    doc,task,plan,reader=controlled(language,missing=[])
    payload=finish(reader,task,analyze(doc,task,plan,reader))
    env={'schemaVersion':'completed-prior-answer/1','requestId':'controlled-old-request',
        'result':payload,'originalAnswer':render_generic_answer(payload,language)}
    return env,doc['principalScopeRef']


def project(env,fingerprint,kind='simplify_navigation'):
    return project_previous_answer(env,kind,fingerprint,'controlled-catalog',
        [{'routes':['/dashboard'],'businessNavigation':[{'route':'/dashboard','label':'Dashboard'}]}],lambda _:True)


@pytest.mark.parametrize('language',['en','ar'])
@pytest.mark.parametrize('kind',['simplify_navigation','query_scope'])
def test_historical_projection_keeps_field_scope_and_original_observation(language,kind):
    env,fingerprint=historical(language);before=deepcopy(env)
    result=project(env,fingerprint,kind)
    assert result['verified'],result
    assert result['snapshotScopeProof']==env['result']['snapshotScopeProof']
    assert result['liveDataRead'] is False
    answer=render_previous_answer(result,language)
    assert ('Personnel scope by field:' if language=='en' else 'نطاق الأشخاص لكل حقل:') in answer
    assert env==before


@pytest.mark.parametrize('fault',['principal','task','source_id','capture','proof_field','receipt_hash','missing_receipt','original_answer'])
def test_history_cannot_rebind_personnel_scope_to_other_identity_source_capture_or_undisplayed_facts(fault):
    env,fingerprint=historical();p=env['result']
    if fault=='principal':fingerprint='another-user'
    elif fault=='task':p['snapshotScopeProof']['taskFingerprint']='other-task'
    elif fault=='source_id':p['outputs'][0]['evidence'][0]['sourceId']='other-source'
    elif fault=='capture':p['snapshotScopeProof']['outputs'][0]['capturedAt']='2020-01-01T00:00:00Z'
    elif fault=='proof_field':p['snapshotScopeProof']['outputs'][0]['fields'][0]['scope']='personal'
    elif fault=='receipt_hash':p['queryReceipt']['snapshotScopeProofHash']='bad'
    elif fault=='missing_receipt':p.pop('queryReceipt')
    elif fault=='original_answer':env['originalAnswer']='Previously different facts.'
    assert not project(env,fingerprint)['verified']
