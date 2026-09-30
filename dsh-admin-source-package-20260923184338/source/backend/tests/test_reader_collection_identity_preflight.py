"""Actual I01/I02 plan/schema evidence; row values and model repairs are controlled, offline."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import time
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError
from app.generic_reader_contracts import CollectionPlan, TaskSpec
import app.reader_collection as collection
from test_projected_collection import gateway

FIXTURE = json.loads((Path(__file__).parent/'fixtures/i01_i02_identity_v37.json').read_text())
PAGE = '/licensing/applications'


def actual(language='ar'):
    case = deepcopy(FIXTURE['cases']['I-02__ar' if language == 'ar' else 'I-01__en'])
    return TaskSpec.model_validate(case['task']), CollectionPlan.model_validate(case['plan']), case['source']


def knowledge():
    k = KnowledgeStore()
    for entry in FIXTURE['knowledgePackages']:
        k.add_local([{'id':entry['path'], 'source_type':'local_page_knowledge',
            'source_name':entry['path'], 'content':json.dumps(entry['package'],ensure_ascii=False)}])
    k.prompt()
    return k


def test_actual_ar_schema_positively_proves_nullable_key_without_raw_row_values():
    task, plan, source = actual()
    assert 'data' not in source
    spec = plan.collections[0];before = plan.model_dump()
    assert spec.identityFields == ['taskId','id','dispositionCaseId']
    schema = next(s for s in source['collectionContext']['rowSchemas'] if s['path'] == spec.rowsPath)
    assert schema['sampledRows'] == 10 and schema['nullableFieldsTruncated'] is False
    assert 'dispositionCaseId' in schema['nullableFields']
    with pytest.raises(PipelineError, match='collection_identity_observed_empty') as failure:
        collection.validate_observed_collection_identity(spec, source, task, knowledge(), PAGE)
    assert failure.value.details['observedEmptyIdentityFields'] == ['dispositionCaseId']
    assert failure.value.details['documentedGrainKeyCandidates'] == []  # Audit excludes raw rows.
    assert plan.model_dump() == before and plan.missing == FIXTURE['cases']['I-02__ar']['plan']['missing']


def test_actual_en_nonempty_key_schema_is_unchanged_without_claiming_uniqueness():
    task, plan, source = actual('en'); before = plan.model_dump()
    collection.validate_observed_collection_identity(plan.collections[0], source, task, knowledge(), PAGE)
    assert plan.model_dump() == before
    receipt = FIXTURE['cases']['I-01__en']['collectionOutcomes'][0]
    assert receipt['identityFields'] == ['taskId'] and receipt['rowCount'] == 71 and receipt['stablePasses'] == 2
    assert 'uniqueIdentityCount' not in receipt


def controlled():
    task, _, _ = actual();task=task.model_copy(update={'businessObject':'specimen','requestedGrain':'specimen',
        'businessFocus':'','requestedScope':'unknown','timeField':'','timeRange':'unknown','requestedAttributes':[],
        'requestedOrdering':[]})
    spec=CollectionPlan.model_validate({'stage':'collection','collections':[{'sourceId':'sample',
        'rowsPath':'/data/items','totalPath':'/data/total','pageField':'pageIndex','sizeField':'pageSize',
        'fields':['key','part','label'],'identityFields':['key','part'],'evidence':[{'sourceId':'controlled-formal'}]}],'missing':[]}).collections[0]
    record={'id':'formal.specimen','kind':'field_semantics','revision':1,'status':'active',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/specimens']},
        'sources':[{'reference':'controlled-test-source'}], 'payload':{'bindings':[
            {'id':'grain','kind':'grain','concept':'specimen','operationRef':'GET /specimens',
             'sourcePath':'/data/items','fields':['key']}]}}
    k=KnowledgeStore();k.add({'chunks':[{'id':'formal','content':json.dumps({'records':[record]})}]});k.prompt()
    rows=[{'key':'controlled-A','part':None,'label':'controlled-public'},{'key':'controlled-B','part':7,'label':'controlled-public'}]
    data={'data':{'items':rows,'total':len(rows)}}
    source={'kind':'api_response','operationRef':'GET /specimens','data':data,
        'collectionContext':{'mode':'page_number_two_pass','rowSchemas':gateway._collection_row_schemas(data)},
        'fieldEvidence':gateway._reader_field_evidence(data,data)}
    return task,spec,source,k


def error(task,spec,source,k):
    before=spec.model_dump()
    with pytest.raises(PipelineError,match='collection_identity_observed_empty') as failure:
        collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')
    assert spec.model_dump()==before
    return failure.value.details


def test_formal_same_grain_key_is_only_a_suggestion_and_rows_are_never_modified():
    task,spec,source,k=controlled();before=deepcopy(source)
    details=error(task,spec,source,k)
    assert details['documentedGrainKeyCandidates']==[{'knowledgeBindingId':'formal.specimen#grain','fields':['key']}]
    assert spec.identityFields==['key','part'] and source==before
    assert 'controlled-A' not in json.dumps(details) and 'controlled-public' not in json.dumps(details)
    spec.identityFields=['key']  # Controlled new model choice, never runtime autofill.
    collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')


@pytest.mark.parametrize('value',[None,''])
def test_complete_scalar_evidence_of_empty_key_is_positive_even_without_nullable_schema(value):
    task,spec,source,k=controlled();source['collectionContext']['rowSchemas'][0]['nullableFields']=[]
    source['fieldEvidence']={'/data/items/0/part':{'status':'complete','kind':'scalar','valueHash':collection.projection_hash(value)}}
    assert error(task,spec,source,k)['observedEmptyIdentityFields']==['part']


def test_documented_nested_key_under_observed_null_parent_is_empty_not_absent():
    task,spec,source,k=controlled();spec.fields=['key','parent.child'];spec.identityFields=['parent.child']
    source['collectionContext']['rowSchemas'][0]['nullableFields']=['parent']
    assert error(task,spec,source,k)['observedEmptyIdentityFields']==['parent.child']


@pytest.mark.parametrize('fault',['missing_schema','null_schema','other_path','zero_sample','unknown_sample','no_positive_null','incomplete_hash','other_index','wrong_hash'])
def test_missing_or_uncertain_schema_does_not_invent_empty_identity(fault):
    task,spec,source,k=controlled();schema=source['collectionContext']['rowSchemas'][0]
    source['fieldEvidence']={}
    if fault=='missing_schema':source['collectionContext'].pop('rowSchemas')
    elif fault=='null_schema':source['collectionContext']['rowSchemas']=None
    elif fault=='other_path':schema['path']='/data/other'
    elif fault=='zero_sample':schema['sampledRows']=0
    elif fault=='unknown_sample':schema.pop('sampledRows')
    else:
        schema['nullableFields']=None
        if fault=='incomplete_hash':source['fieldEvidence']={'/data/items/0/part':{'status':'bounded','kind':'scalar','valueHash':collection.projection_hash(None)}}
        elif fault=='other_index':source['fieldEvidence']={'/data/items/99/part':{'status':'complete','kind':'scalar','valueHash':collection.projection_hash(None)}}
        elif fault=='wrong_hash':source['fieldEvidence']={'/data/items/0/part':{'status':'complete','kind':'scalar','valueHash':collection.projection_hash(7)}}
    collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')


@pytest.mark.parametrize('fault',['truncated_schema','truncated_nulls','partial_sample','other_grain','other_operation','other_path','other_page','inactive','conflict','conditional','unobserved_key','empty_alternative','context_mismatch'])
def test_bad_or_unproven_alternative_is_not_suggested(fault):
    task,spec,source,k=controlled();schema=source['collectionContext']['rowSchemas'][0]
    record=next(i['record'] for i in k.items.values());fact=record['payload']['bindings'][0]
    if fault=='truncated_schema':schema['fieldsTruncated']=True
    elif fault=='truncated_nulls':schema['nullableFieldsTruncated']=True
    elif fault=='partial_sample':source['data']['data']['items']=source['data']['data']['items'][:1]
    elif fault=='other_grain':fact['concept']='other entity'
    elif fault=='other_operation':fact['operationRef']='GET /other'
    elif fault=='other_path':fact['sourcePath']='/data/other'
    elif fault=='other_page':record['applicability']['pageRefs']=['/other']
    elif fault=='inactive':record['status']='retired'
    elif fault=='conflict':k.conflicted.add(record['id'])
    elif fault=='conditional':fact['conditions']=[{'field':'key','predicate':'ne','value':None}]
    elif fault=='unobserved_key':schema['fields'].remove('key')
    elif fault=='empty_alternative':source['data']['data']['items'][0]['key']=''
    else:fact['contextParameters']={'department':'expected'}
    assert error(task,spec,source,k)['documentedGrainKeyCandidates']==[]


def test_valid_composite_key_is_not_collapsed_to_single_field():
    task,spec,source,k=controlled();source['collectionContext']['rowSchemas'][0]['nullableFields']=[]
    source['fieldEvidence']={};source['data']['data']['items'][0]['part']=3
    before=spec.model_dump();collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')
    assert spec.model_dump()==before and spec.identityFields==['key','part']


def test_later_page_null_and_duplicate_multiplicity_are_still_owned_by_existing_collector():
    from test_projected_collection import setup_rows,collect
    rows,capture,spec=setup_rows(4);rows[1]['specimenKey']=rows[0]['specimenKey']
    receipt,calls=collect(rows,capture,spec)
    assert receipt['completeness']=='complete' and len(receipt['rows'])==4 and len(calls)==2
    rows[2]['specimenKey']=None
    receipt,_=collect(rows,capture,spec)
    assert receipt['completeness']=='incomplete' and receipt['reason']=='collection_identity_missing'


class ReachedGateway(Exception): pass


def run_actual_collection(*,correct=False):
    task,plan,source=actual();k=knowledge();calls=[]
    # The recorded audit omits row values. Values below are explicitly controlled;
    # the actual AR CollectionPlan, schema and identity fields remain unchanged.
    schema=next(s for s in source['collectionContext']['rowSchemas'] if s['path']==plan.collections[0].rowsPath)
    rows=[]
    for i in range(schema['sampledRows']):
        row={f:None if f in schema['nullableFields'] else i+1 for f in schema['fields']}
        row.update(taskId='controlled-task-'+str(i),id=i+1,assignee='controlled-owner',statusId=7,taskStatusId=2,
            taskDueTime='2026-09-30T00:00:00Z',taskCreatedTime='2026-09-28T00:00:00Z',taskApprovalAt=None,
            lastUpdatedTime='2026-09-28T00:00:00Z')
        rows.append(row)
    source['data']={'isSuccess':True,'data':{'page':{'items':rows,'total':71}}}
    source['kind']='api_response';source.pop('collectionFailure',None);source.pop('collectionDiagnostics',None)
    source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    class Gateway:
        async def invoke(self,*args,**kwargs):calls.append(args);raise ReachedGateway()
    class Planner:
        def __init__(self):self.calls=[]
        async def generic_reader_json(self,**kwargs):
            self.calls.append(deepcopy(kwargs))
            raw=deepcopy(FIXTURE['cases']['I-02__ar']['plan'])
            # Bind authentic loaded definitions rather than invent remote passage IDs.
            raw['collections'][0]['evidence']=[{'sourceId':p['sourceId']} for entry in k.prompt() for p in entry['passages'][:1]][:5]
            if correct and len(self.calls)==2:raw['collections'][0]['identityFields']=['taskId']
            return raw
    planner=Planner();reader=GenericKnowledgeReader(Gateway(),planner,portal_base_url='https://offline.invalid')
    reader.page=PAGE;reader.knowledge=k;reader.deadline=time.monotonic()+300
    reader.current_question='ما المهام المسندة إليّ اليوم، وأيها أكثر إلحاحًا؟'
    reader.canonical_question='What tasks are assigned to me today, and which one is most urgent?'
    reader.response_language='ar'
    return reader,planner,calls,task,source


def test_actual_ar_collection_plan_is_rejected_before_gateway_under_original_two_attempt_budget():
    reader,planner,calls,task,source=run_actual_collection()
    with pytest.raises(PipelineError,match='collection_identity_observed_empty'):
        asyncio.run(reader.collect_sources(SimpleNamespace(),task,SimpleNamespace(as_payload=lambda:{}),{},
            {source['sourceId']:source}))
    assert len(planner.calls)==2 and calls==[]
    assert all(p['collections'][0]['identityFields']==['taskId','id','dispositionCaseId']
               for p in [r['candidate'] for r in reader.audit['rejectedPlans']])
    assert 'observedEmptyIdentityFields' in planner.calls[1]['correction']
    assert reader.deadline>time.monotonic()


def test_controlled_new_model_response_can_choose_formal_key_without_runtime_autofill():
    reader,planner,calls,task,source=run_actual_collection(correct=True)
    with pytest.raises(ReachedGateway):
        asyncio.run(reader.collect_sources(SimpleNamespace(),task,SimpleNamespace(as_payload=lambda:{}),{},
            {source['sourceId']:source}))
    assert len(planner.calls)==2 and len(calls)==1
    assert calls[0][2]['collections'][0]['identityFields']==['taskId']
    assert task.timeField=='assignment date' and task.timeRange=='today'
    assert task.businessFocus=='assigned to me' and 'urgency' in task.requestedAttributes


@pytest.mark.parametrize('marker',['[max-depth]','[truncated]','[redacted]'])
def test_transport_markers_are_not_nonempty_key_samples(marker):
    task,spec,source,k=controlled();source['data']['data']['items'][0]['key']=marker
    assert error(task,spec,source,k)['documentedGrainKeyCandidates']==[]


@pytest.mark.parametrize('context',[None,[],"unknown"])
def test_malformed_context_is_not_positive_null_evidence(context):
    task,spec,source,k=controlled();source['collectionContext']=context
    collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')


def test_full_documented_composite_alternative_is_retained_and_not_called_unique():
    task,spec,source,k=controlled()
    record=next(i['record'] for i in k.items.values())
    record['payload']['bindings'][0]['fields']=['key','label']
    source['data']['data']['items'][1]['key']='controlled-A'  # Duplicate composite values are intentional.
    details=error(task,spec,source,k)
    assert details['documentedGrainKeyCandidates']==[{'knowledgeBindingId':'formal.specimen#grain','fields':['key','label']}]
    assert 'unique' not in details['correction'].lower()


def test_candidate_limit_does_not_arbitrarily_choose_or_mutate_a_key():
    task,spec,source,k=controlled();record=next(i['record'] for i in k.items.values())
    template=record['payload']['bindings'][0]
    record['payload']['bindings']=[{**deepcopy(template),'id':'grain'+str(i)} for i in range(6)]
    assert error(task,spec,source,k)['documentedGrainKeyCandidates']==[]


def test_missing_raw_key_in_one_sample_prevents_suggestion():
    task,spec,source,k=controlled();source['data']['data']['items'][1].pop('key')
    assert error(task,spec,source,k)['documentedGrainKeyCandidates']==[]


def test_positive_null_survives_truncated_inventory_but_cannot_suggest_key():
    task,spec,source,k=controlled()
    source['collectionContext']['rowSchemas'][0]['nullableFieldsTruncated']=True
    details=error(task,spec,source,k)
    assert details['observedEmptyIdentityFields']==['part'] and details['documentedGrainKeyCandidates']==[]


def test_same_field_at_another_source_path_is_not_null_evidence():
    task,spec,source,k=controlled();source['collectionContext']['rowSchemas'][0]['nullableFields']=[]
    source['fieldEvidence']={'/other/items/0/part':{'status':'complete','kind':'scalar','valueHash':collection.projection_hash(None)}}
    collection.validate_observed_collection_identity(spec,source,task,k,'/specimens')


def test_external_planner_cancellation_propagates_without_collection_or_retry():
    reader,planner,calls,task,source=run_actual_collection()
    async def cancelled(**kwargs):
        planner.calls.append(kwargs);raise asyncio.CancelledError()
    planner.generic_reader_json=cancelled
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(reader.collect_sources(SimpleNamespace(),task,SimpleNamespace(as_payload=lambda:{}),{},
            {source['sourceId']:source}))
    assert len(planner.calls)==1 and calls==[]


def test_controlled_abstention_preserves_missing_and_task_without_gateway():
    reader,planner,calls,task,source=run_actual_collection();original=task.model_dump()
    generate=planner.generic_reader_json
    async def abstain(**kwargs):
        if not planner.calls:return await generate(**kwargs)
        planner.calls.append(deepcopy(kwargs))
        return {'stage':'collection','collections':[],
            'missing':['collection_identity_unconfirmed','assignment_date_unconfirmed','urgency_unconfirmed','cross_domain_scope_unconfirmed']}
    planner.generic_reader_json=abstain
    _,missing=asyncio.run(reader.collect_sources(SimpleNamespace(),task,SimpleNamespace(as_payload=lambda:{}),{},
        {source['sourceId']:source}))
    assert missing==['collection_identity_unconfirmed','assignment_date_unconfirmed','urgency_unconfirmed','cross_domain_scope_unconfirmed']
    assert len(planner.calls)==2 and calls==[] and task.model_dump()==original
