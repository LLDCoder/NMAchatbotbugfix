"""D01 round9 original EN/AR plans and receipts; no QA or model replay."""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import KnowledgeStore
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_collection import projection_hash
from app.reader_requirements import semantic_bindings
from app.reader_routing import task_fingerprint
from app.reader_snapshot_scope import compile_snapshot_scope, snapshot_scope_correction

FIXTURES=Path(__file__).with_name('fixtures')/'d01-snapshot-scope-round9'
KB=Path(__file__).resolve().parents[2]/'artifacts/KB/pages/admin/dashboard'


def load(language='en'):
    doc=json.loads((FIXTURES/f'{language}.json').read_text())
    knowledge=KnowledgeStore()
    for filename in ['Admin Dashboard-多面板指标与历史比较.json','Admin Dashboard-许可绩效指标字段与范围.json']:
        p=KB/filename
        knowledge.add({'chunks':[{'id':filename,'content':p.read_text()}]})
    return doc,TaskSpec.model_validate(doc['task']),AnalysisPlan.model_validate(doc['plan']),knowledge


def compile(doc,task,plan,knowledge):
    return compile_snapshot_scope(task,plan,doc['sources'],knowledge,doc['analysis'],
        page_context=doc['pageContext'],principal_scope_ref=doc['principalScopeRef'],authorized_pages=doc['authorizedPages'])


def fields(proof):
    return [f for o in proof['outputs'] for f in o['fields']]


@pytest.mark.parametrize('language',['en','ar'])
def test_recorded_complete_fields_are_valid_despite_bounded_envelope_and_unknown_personnel_scope(language):
    doc,task,plan,kb=load(language);before=deepcopy(doc);original_plan=plan.model_dump()
    proof=compile(doc,task,plan,kb)
    assert proof['observationStatus']=='verified',proof
    assert len(proof['outputs'])==3 and len(fields(proof))==29
    assert all(s['completeness']=='bounded' for s in doc['sources'].values())
    assert all(f['scopeStatus']=='unknown' for f in fields(proof))
    assert not proof['satisfiesRequestedScope']
    # The existing scope=1 SLA fact is a candidate, not independent role proof.
    sla=next(f for f in fields(proof) if f['field']=='slaComplianceRate')
    assert sla['candidateBindingIds']==['admin.dashboard.license-performance.department#scope']
    assert doc==before and plan.model_dump()==original_plan


def test_recorded_english_global_team_overgeneralization_is_reported_per_field():
    doc,task,plan,kb=load();proof=compile(doc,task,plan,kb)
    correction=snapshot_scope_correction(plan,proof)
    assert correction['code']=='analysis_snapshot_global_scope_unverified'
    assert len(correction['unprovedFields'])==29
    assert plan.context.scope=='team' and plan.missing==[]


def test_recorded_arabic_unknown_and_missing_are_not_deleted_or_promoted():
    doc,task,plan,kb=load('ar');before=deepcopy(doc['analysis'])
    proof=compile(doc,task,plan,kb);correction=snapshot_scope_correction(plan,proof)
    assert correction['code']=='analysis_snapshot_observation_verified'
    assert len(correction['unknownFields'])==29
    assert plan.missing==['dashboard_scope_unconfirmed']
    assert doc['analysis']==before and 'dashboard_scope_unconfirmed' in doc['analysis']['missing']


@pytest.mark.parametrize('fault',['missing_field_hash','wrong_field_hash','wrong_principal','ref_wrong_principal',
    'cross_capture','cross_observation','different_page','route_not_authorized','missing_field_receipt',
    'changed_output','no_grain','no_attribute','unsatisfied_attribute','extra_filter','request_date_hash',
    'response_date_hash','wrong_kb_page','stale_page_context','source_not_ready','collection_failure','array_as_snapshot',
    'derived_count','unbound_extra_field','wrong_operation','wrong_task_fingerprint'])
def test_incomplete_changed_unrelated_or_unauthorized_evidence_cannot_form_observation_proof(fault):
    doc,task,plan,kb=load();source=doc['sources'][plan.steps[1].sourceId]
    output=doc['analysis']['outputs'][1];ref=output['evidence'][0]
    path='/data/summary/overdueTasks'
    if fault=='missing_field_hash':source['fieldEvidence'][path].pop('valueHash')
    elif fault=='wrong_field_hash':source['fieldEvidence'][path]['valueHash']='0'*64
    elif fault=='wrong_principal':source['principalScopeRef']='other'
    elif fault=='ref_wrong_principal':ref['principalScopeRef']='other'
    elif fault=='cross_capture':source['capturedAt']=ref['capturedAt']='2020-01-01T00:00:00Z'
    elif fault=='cross_observation':source['observationRef']=ref['observationRef']='other'
    elif fault=='different_page':source['page']=ref['page']='/other'
    elif fault=='route_not_authorized':doc['authorizedPages']=[]
    elif fault=='missing_field_receipt':source['fieldEvidence'].pop(path)
    elif fault=='changed_output':output['value'][0]['overdueTasks']=12345
    elif fault=='no_grain':plan.requirementBindings=[b for b in plan.requirementBindings if b.requirementId!='grain']
    elif fault=='no_attribute':plan.requirementBindings=[b for b in plan.requirementBindings if b.requirementId!='attribute_0']
    elif fault=='unsatisfied_attribute':doc['analysis']['requirementCoverage'][-1]['status']='unfulfilled'
    elif fault=='extra_filter':source['collectionContext']['parameterHashes']['customer']=projection_hash('other')
    elif fault=='request_date_hash':source['collectionContext']['parameterHashes']['startDate']='0'*64
    elif fault=='response_date_hash':source['fieldEvidence']['/data/startDate']['valueHash']='0'*64
    elif fault=='wrong_kb_page':
        for item in kb.items.values():
            if item.get('record'):item['record']['applicability']['pageRefs']=['/other']
    elif fault=='stale_page_context':doc['pageContext']['capturedAt']='2020-01-01T00:00:00Z'
    elif fault=='source_not_ready':source['ready']=False
    elif fault=='collection_failure':source['collectionFailure']='unverified'
    elif fault=='array_as_snapshot':source['data']['data']['summary']=[source['data']['data']['summary']]
    elif fault=='derived_count':plan.steps[1].op='count'
    elif fault=='unbound_extra_field':output['value'][0]['other']=0
    elif fault=='wrong_task_fingerprint':source['taskFingerprint']='other-task'
    elif fault=='wrong_operation':source['operationRef']=ref['operationRef']='GET /other'
    proof=compile(doc,task,plan,kb)
    assert proof['observationStatus']=='unverified',fault
    assert snapshot_scope_correction(plan,proof) is None


@pytest.mark.parametrize('scope',['personal','team','global'])
@pytest.mark.parametrize('language',['en','ar'])
def test_explicit_scope_is_a_hard_requirement_and_unknown_does_not_replace_it(scope,language):
    doc,task,plan,kb=load(language);task.requestedScope=scope
    # Scope must fail for missing coverage even with a current task fingerprint.
    for source in doc['sources'].values():
        source['taskFingerprint']=task_fingerprint(task)
    before=deepcopy(doc['analysis']);proof=compile(doc,task,plan,kb)
    assert proof['observationStatus']=='unverified'
    assert 'snapshot_requested_requirements_unverified' in proof['gaps']
    assert not proof['satisfiesRequestedScope']
    assert doc['analysis']==before and task.requestedScope==scope


def subject_bound_scope_facts(doc,kb):
    """Controlled typed positive fixture, never claimed as recorded D01 KB.

    Existing sources remain observed scalars. For this variation, the source
    is explicitly requested for the current subject; object/grain/attribute
    context declarations must bind the same parameter before scope can apply.
    """
    source=doc['sources']['api_8080c0de4e6a7b165633']
    subject=projection_hash('controlled-current-user')
    source['collectionContext']['parameterHashes']['ownerId']=subject
    source['subjectParameterHashes']={'ownerId':{'reference':'principal.user_id','valueHash':subject}}
    for item in kb.items.values():
        record=item.get('record') or {}
        if record.get('id')!='admin.dashboard.license-performance.department':continue
        bindings=record['payload']['bindings']
        for fact in bindings:fact['contextBindings']={'ownerId':'principal.user_id'}
        template=deepcopy(next(f for f in bindings if f['kind']=='scope'))
        # Same response: personal has a subject proof; team remains a candidate.
        bindings[:]=[f for f in bindings if f['kind']!='scope']
        for concept,field in [('personal','slaComplianceRate'),('team','overdueTasks')]:
            fact=deepcopy(template);fact.update(id='controlled_'+concept,concept=concept,fields=[field])
            bindings.append(fact)
    return source


def test_same_source_only_subject_bound_personal_scope_is_verified_other_populations_remain_unknown():
    doc,task,plan,kb=load();subject_bound_scope_facts(doc,kb)
    proof=compile(doc,task,plan,kb)
    assert proof['observationStatus']=='verified',proof
    values={f['field']:f for f in proof['outputs'][1]['fields']}
    assert values['slaComplianceRate']['scope']=='personal'
    assert values['slaComplianceRate']['scopeStatus']=='verified'
    assert values['overdueTasks']['scope']=='unknown'
    assert values['overdueTasks']['scopeStatus']=='unknown'
    assert values['overdueTasks']['scopeBindingIds']==[]
    assert values['overdueTasks']['candidateBindingIds']==[
        'admin.dashboard.license-performance.department#controlled_team']
    assert values['averageHandlingTimeMinutes']['scopeStatus']=='unknown'
    assert all(f['scopeStatus']=='unknown' for f in proof['outputs'][0]['fields'])
    assert not proof['satisfiesRequestedScope']


@pytest.mark.parametrize('claimed_scope',['team','global'])
def test_subject_parameter_alone_does_not_establish_team_or_global_population(claimed_scope):
    # Reproduce independent-review B1: no membership or global boundary receipt.
    doc,task,plan,kb=load();subject_bound_scope_facts(doc,kb)
    for item in kb.items.values():
        record=item.get('record') or {}
        if record.get('id')=='admin.dashboard.license-performance.department':
            for binding in record['payload']['bindings']:
                if binding['id']=='controlled_team':binding['concept']=claimed_scope
    proof=compile(doc,task,plan,kb)
    field=next(f for f in fields(proof) if f['field']=='overdueTasks')
    assert proof['observationStatus']=='verified'
    assert field['scopeStatus']=='unknown' and field['scope']=='unknown'
    assert field['scopeBindingIds']==[]
    assert field['candidateBindingIds']==['admin.dashboard.license-performance.department#controlled_team']
    assert not proof['satisfiesRequestedScope']


@pytest.mark.parametrize('fault',['missing_subject_hash','wrong_subject_hash','wrong_reference','conflict','wrong_path','inactive'])
def test_scope_fact_never_borrows_subject_other_path_or_conflicting_definition(fault):
    doc,task,plan,kb=load();source=subject_bound_scope_facts(doc,kb)
    if fault=='missing_subject_hash':source.pop('subjectParameterHashes')
    elif fault=='wrong_subject_hash':source['subjectParameterHashes']['ownerId']['valueHash']='0'*64
    elif fault=='wrong_reference':source['subjectParameterHashes']['ownerId']['reference']='other.user_id'
    else:
        for item in kb.items.values():
            record=item.get('record') or {}
            if record.get('id')!='admin.dashboard.license-performance.department':continue
            binding=next(f for f in record['payload']['bindings'] if f['id']=='controlled_personal')
            if fault=='wrong_path':binding['sourcePath']='/data'
            elif fault=='inactive':record['status']='inactive'
            else:
                other=deepcopy(binding);other.update(id='controlled_conflict',concept='team')
                record['payload']['bindings'].append(other)
    proof=compile(doc,task,plan,kb)
    if fault in ['missing_subject_hash','wrong_subject_hash','wrong_reference','inactive']:
        assert proof['observationStatus']=='unverified'
    else:
        f=next(f for f in fields(proof) if f['field']=='slaComplianceRate')
        assert f['scopeStatus']==('conflicting' if fault=='conflict' else 'unknown')
        assert f['scope']=='unknown'


def test_typed_role_definition_is_description_only_and_does_not_become_team():
    doc,task,plan,kb=load()
    for item in kb.items.values():
        record=item.get('record') or {}
        if record.get('id')=='admin.dashboard.license-performance.department':
            fact=next(f for f in record['payload']['bindings'] if f['kind']=='scope')
            fact['concept']='server_role_defined'
    proof=compile(doc,task,plan,kb)
    field=next(f for f in fields(proof) if f['field']=='slaComplianceRate')
    assert field['scopeDefinition']=='server-role-defined'
    assert field['scopeStatus']=='unknown' and field['scope']=='unknown'
    assert not proof['satisfiesRequestedScope']


def test_unproved_conflicting_definition_is_not_silently_overruled_by_subject_bound_fact():
    doc,task,plan,kb=load();subject_bound_scope_facts(doc,kb)
    for item in kb.items.values():
        record=item.get('record') or {}
        if record.get('id')=='admin.dashboard.license-performance.department':
            binding=next(f for f in record['payload']['bindings'] if f['id']=='controlled_personal')
            other=deepcopy(binding);other.update(id='controlled_conflict',concept='team')
            # Equivalent exact captured context, but without a subject reference.
            other.pop('contextBindings')
            other['contextParameters']['ownerId']='controlled-current-user'
            record['payload']['bindings'].append(other)
    proof=compile(doc,task,plan,kb)
    field=next(f for f in fields(proof) if f['field']=='slaComplianceRate')
    assert field['scopeStatus']=='conflicting' and field['scope']=='unknown'
