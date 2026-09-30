"""Offline recall corrections never navigate, widen authority, or manufacture entity evidence."""
import asyncio
import copy
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError
from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError
from app.generic_reader_contracts import CatalogRecall, TaskSpec
from app.reader_context import load_catalog, page_knowledge
from app.reader_routing import recall_candidates, bind_route, task_fingerprint
from app.generic_reader_contracts import RouteHop, RoutingDecision
from app.reader_routing import validate_decision
from app.reader_requirements import requirements_for
from test_reader_context_v3 import task
from test_generic_reader_v3 import Gateway

try:
    from app.reader_catalog_dependencies import catalog_lookup_requirements as requirements
    from app.reader_catalog_dependencies import validate_catalog_lookup_recall as validate
except ImportError:
    requirements = validate = None  # Only the integration negative control runs against unchanged v35.


def recall(ids):
    return CatalogRecall(stage='catalog_recall', candidateIds=ids, reason='Full task retained')


def page(cid, route=None, parameters=None):
    return {'candidateId': cid, 'route': route or '/work/'+cid, 'parameters': parameters or []}


def record(operation='GET /records', **changes):
    return {'id': 'rows', 'operationRef': operation, 'sourcePath': '/rows',
            'identityField': 'number', 'keyFields': ['id'], **changes}


def parameter(operation='GET /records', **changes):
    return {**record(operation), 'id': 'entry', 'from': 'previous_record',
            'name': 'key', 'field': 'taskId', 'required': True, **changes}


def document(cid, parameters=None, records=None, **changes):
    return {'id': cid+'.routing', 'revision': 1, 'status': 'active', 'kind': 'field_semantics',
            'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/work/'+cid]},
            'sources': [{'reference': 'offline-contract'}],
            'payload': {'routing': {'parameters': parameters or [], 'records': records or []}}, **changes}


def knowledge(*docs):
    k=KnowledgeStore()
    k.add({'chunks': [{'content': json.dumps({'packageStatus': 'active', 'records': list(docs)})}]})
    return k


@pytest.fixture
def simple():
    return ([page('detail', parameters=['key']), page('list')],
            knowledge(document('detail', [parameter()]), document('list', records=[record()])))


@pytest.mark.skipif(requirements is None, reason='Helper absent on formal-v35 negative control')
class TestDependencies:
    def test_missing_predecessor_is_recalled_but_not_appended(self, simple):
        pool,k=simple; deps=requirements(task(),pool,k); r=recall(['detail']); before=r.model_dump()
        with pytest.raises(PipelineError,match='catalog_lookup_predecessor_required'): validate(r,deps)
        assert r.model_dump()==before
        validate(recall(['detail','list']),deps)

    @pytest.mark.parametrize('change',[{'operationRef':'GET /other'}, {'sourcePath':'/other'},
        {'identityField':'similarNumber'}, {'keyFields':['otherEntityId']}])
    def test_similar_record_contract_is_not_a_dependency(self,change):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter()]),document('list',records=[record(**change)]))
        deps=requirements(task(recordIdentity='CR-123'),pool,k)
        assert deps[0]['status']=='unknown'
        assert deps[0]['alternatives'][0]['predecessorCandidateIds']==[]

    def test_missing_permission_never_adds_catalog_page(self,simple):
        pool,k=simple
        deps=requirements(task(),pool[:1],k)
        assert deps[0]['status']=='unknown'
        assert 'list' not in json.dumps(deps)
        validate(recall(['detail']),deps)  # Later routing must keep missing knowledge/access unknown.

    @pytest.mark.parametrize('status',['draft','retired','inactive'])
    def test_non_active_knowledge_supplies_no_edge(self,status):
        k=knowledge(document('detail',[parameter()]),document('list',records=[record()],status=status))
        deps=requirements(task(),[page('detail',parameters=['key']),page('list')],k)
        assert deps[0]['status']=='unknown'

    def test_conflicting_active_versions_supply_no_edge(self,simple):
        pool,k=simple
        k.add({'chunks':[{'content':json.dumps({'records':[document('list',records=[record(identityField='other')])]})}]})
        assert 'list.routing' in k.conflicted
        assert requirements(task(),pool,k)[0]['status']=='unknown'

    @pytest.mark.parametrize('value',[None,[],{},'id'])
    def test_malformed_key_fields_do_not_supply_edge(self,value):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter(keyFields=value)]),document('list',records=[record()]))
        assert requirements(task(),pool,k)[0]['status']=='unknown'

    def test_explicit_page_ref_cannot_override_wrong_typed_record(self):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter(lookupPageRefs=['/work/list'])]),
                    document('list',records=[record(identityField='differentObject')]))
        assert requirements(task(),pool,k)[0]['status']=='unknown'

    def test_page_ref_restricts_otherwise_matching_page(self):
        pool=[page('detail',parameters=['key']),page('list'),page('other')]
        k=knowledge(document('detail',[parameter(lookupPageRefs=['/work/list'])]),
                    document('list',records=[record()]),document('other',records=[record()]))
        assert requirements(task(),pool,k)[0]['alternatives'][0]['predecessorCandidateIds']==['list']

    def test_alternative_predecessors_are_or_choices(self):
        pool=[page('detail',parameters=['key']),page('todo'),page('done')]
        k=knowledge(document('detail',[parameter('GET /todo',id='todo'),parameter('GET /done',id='done')]),
                    document('todo',records=[record('GET /todo')]),document('done',records=[record('GET /done')]))
        deps=requirements(task(),pool,k)
        validate(recall(['detail','todo']),deps); validate(recall(['detail','done']),deps)
        assert len(deps)==1 and len(deps[0]['alternatives'])==2

    def test_distinct_required_parameter_groups_are_not_or_choices(self):
        pool=[page('detail',parameters=['key','second']),page('one'),page('two')]
        k=knowledge(document('detail',[parameter('GET /one'),parameter('GET /two',id='second',name='second')]),
                    document('one',records=[record('GET /one')]),document('two',records=[record('GET /two')]))
        deps=requirements(task(),pool,k)
        with pytest.raises(PipelineError):validate(recall(['detail','one']),deps)
        validate(recall(['detail','one','two']),deps)  # Recall only, not an executable route proof.

    def test_pure_cycle_and_self_only_dependency_cannot_become_verified(self):
        pool=[page('a',parameters=['key']),page('b',parameters=['key'])]
        k=knowledge(document('a',[parameter('GET /b')],[record('GET /a')]),
                    document('b',[parameter('GET /a')],[record('GET /b')]))
        with pytest.raises(PipelineError):validate(recall(['a','b']),requirements(task(),pool,k))
        own=knowledge(document('a',[parameter('GET /a')],[record('GET /a')]))
        assert requirements(task(),pool[:1],own)[0]['status']=='unknown'

    def test_cycle_with_documented_terminal_alternative_is_allowed_for_recall(self):
        pool=[page('a',parameters=['key']),page('b',parameters=['key']),page('leaf')]
        k=knowledge(document('a',[parameter('GET /b'),parameter('GET /leaf',id='leaf')],[record('GET /a')]),
                    document('b',[parameter('GET /a')],[record('GET /b')]),document('leaf',records=[record('GET /leaf')]))
        validate(recall(['a','b','leaf']),requirements(task(),pool,k))

    @pytest.mark.parametrize('length,ok',[(2,True),(3,True),(4,False),(5,False)])
    def test_existing_three_hop_limit(self,length,ok):
        pool=[page(str(i),parameters=['key'] if i else []) for i in range(length)]
        docs=[document(str(i),[parameter('GET /'+str(i-1))] if i else [],[record('GET /'+str(i))]) for i in range(length)]
        deps=requirements(task(),pool,knowledge(*docs))
        if ok:validate(recall([str(i) for i in range(length)]),deps)
        else:
            with pytest.raises(PipelineError):validate(recall([str(i) for i in range(length)]),deps)

    def test_more_than_five_total_candidates_cannot_silently_expand(self):
        with pytest.raises(ValidationError):recall([str(i) for i in range(6)])
        pool=[page('d'+str(i),parameters=['key']) for i in range(3)]+[page('p'+str(i)) for i in range(3)]
        docs=[document('d'+str(i),[parameter('GET /'+str(i))]) for i in range(3)]
        docs += [document('p'+str(i),records=[record('GET /'+str(i))]) for i in range(3)]
        deps=requirements(task(),pool,knowledge(*docs))
        for missing in range(3):
            ids=['d0','d1','d2']+['p'+str(i) for i in range(3) if i!=missing]
            with pytest.raises(PipelineError):validate(recall(ids),deps)

    @pytest.mark.parametrize('updates',[{'recordIdentity':''},{'needsLiveData':False},{'readOnly':False}])
    def test_unrequested_record_lookup_not_created(self,simple,updates):
        pool,k=simple;assert requirements(task(**updates),pool,k)==[]

    def test_current_page_alternative_requires_fresh_exact_authorized_hint(self):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter(),parameter(id='current',**{'from':'current_page'})]),
                    document('list',records=[record()]))
        hint={'source':'browser_hint','routeAuthorized':True,'route':'/work/detail','query':{'key':'123'},
              'capturedAt':datetime.now(timezone.utc).isoformat()}
        assert requirements(task(),pool,k,hint)==[]
        for updates in [{'route':'/work/other'},{'routeAuthorized':False},{'capturedAt':'2000-01-01T00:00:00Z'},
                        {'source':'history'},{'query':{}}]:
            assert requirements(task(),pool,k,{**hint,**updates})[0]['status']=='available'

    def test_direct_identity_entry_is_not_forced_to_lookup(self):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter(),parameter(id='direct',**{'from':'recordIdentity'})]),
                    document('list',records=[record()]))
        assert requirements(task(),pool,k)==[]

    def test_recall_pass_cannot_supply_runtime_parameter_or_facts(self,simple):
        pool,k=simple; t=task();before=t.model_dump(); fingerprint=task_fingerprint(t)
        validate(recall(['detail','list']),requirements(t,pool,k))
        with pytest.raises(PipelineError,match='route_record_mapping_unverified'):
            bind_route(RouteHop(candidateId='detail',parameterBindingIds=['detail.routing#entry']),pool[0],t,k)
        assert t.model_dump()==before and task_fingerprint(t)==fingerprint

    @pytest.mark.parametrize('conflict',['object','scope'])
    def test_recalled_typed_edge_cannot_waive_entity_or_scope_conflict(self,simple,conflict):
        pool,k=simple;t=task();k.prompt()
        items=[]
        for candidate in pool:
            ref={'sourceId':next(pid for pid,(_,text) in k.passages.items() if candidate['route'] in text)}
            items.append({'candidateId':candidate['candidateId'],'evidence':[ref],'reason':'Declared page',
                'conditions':[{'requirementId':r['id'],'status':'conflict' if candidate['candidateId']=='list' and r['id']==conflict else 'unknown',
                    'evidence':[ref] if candidate['candidateId']=='list' and r['id']==conflict else [],'reason':'Distinct entity/scope remains authoritative'} for r in requirements_for(t)]})
        validate(recall(['detail','list']),requirements(t,pool,k))
        decision=RoutingDecision(stage='routing_decision',taskFingerprint=task_fingerprint(t),decision='probe',
            candidates=items,routePlan=[RouteHop(candidateId='list',purpose='locate_record'),
                RouteHop(candidateId='detail',parameterBindingIds=['detail.routing#entry'])],reason='Observe')
        with pytest.raises(PipelineError,match='routing_condition_conflict'):validate_decision(decision,t,pool,k)

    def test_missing_or_late_definition_does_not_grant_or_mutate_prior_constraint(self):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter()]))
        before=requirements(task(),pool,k);frozen=copy.deepcopy(before)
        assert before[0]['status']=='unknown'
        k.add({'chunks':[{'content':json.dumps({'records':[document('list',records=[record()])]})}]})
        assert before==frozen  # The stage snapshot is not silently amended by later retrieval.
        assert requirements(task(),pool,k)[0]['status']=='available'

    def test_duplicate_binding_definition_is_not_a_verified_edge(self):
        pool=[page('detail',parameters=['key']),page('list')]
        k=knowledge(document('detail',[parameter(),parameter(identityField='other')]),
                    document('list',records=[record()]))
        assert requirements(task(),pool,k)[0]['status']=='unknown'


FIXTURE=Path(__file__).parent/'fixtures/catalog_lookup_x04_ar.json'
ARTIFACTS=Path(__file__).resolve().parents[2]/'artifacts'


def real_case():
    f=json.loads(FIXTURE.read_text());t=TaskSpec.model_validate(f['task'])
    catalog,_=load_catalog(ARTIFACTS,lambda route:route in f['allowedPages'])
    k=KnowledgeStore();k.add_local(page_knowledge(ARTIFACTS,catalog))
    pool=recall_candidates(t,catalog,k,limit=sum(len(p['routes']) for p in catalog),include_unmatched=True)
    apps=next(p for p in pool if p['route']=='/licensing/applications')
    detail=next(p for p in pool if p['route']=='/licensing/applications/applicationsDetails')
    return f,t,catalog,k,pool,apps,detail


@pytest.mark.skipif(requirements is None,reason='Helper absent on unchanged-v35 negative control')
def test_real_x04_five_detail_recall_requires_application_lookup_without_changing_task():
    f,t,_,k,pool,apps,detail=real_case();before=t.model_dump()
    deps=requirements(t,pool,k,f['currentPage'])
    original=CatalogRecall.model_validate(f['recall'])
    assert len(original.candidateIds)==5 and apps['candidateId'] not in original.candidateIds
    with pytest.raises(PipelineError,match='catalog_lookup_predecessor_required'):validate(original,deps)
    detail_deps=[x for x in deps if x['destinationCandidateId']==detail['candidateId']]
    assert len(detail_deps)==1
    assert all(a['predecessorCandidateIds']==[apps['candidateId']] for a in detail_deps[0]['alternatives'])
    validate(recall([detail['candidateId'],apps['candidateId']]),deps)
    assert t.model_dump()==before


@pytest.mark.parametrize('repair',[True,False])
def test_real_route_task_uses_original_two_recall_attempts_and_no_extra_io(repair):
    f,t,catalog,k,pool,apps,detail=real_case();seen=[];searches=[];before=t.model_dump()
    class StopAfterRecall(Exception):pass
    class Planner:
        async def generic_reader_json(self,**kwargs):
            seen.append(copy.deepcopy(kwargs))
            assert kwargs['schema']['properties']['stage']['const']=='catalog_recall'
            return f['recall'] if len(seen)==1 or not repair else recall([detail['candidateId'],apps['candidateId']]).model_dump()
    gateway=Gateway();reader=GenericKnowledgeReader(gateway,Planner(),portal_base_url='https://portal.test')
    reader.knowledge=k
    reader.deadline=time.monotonic()+30
    async def search(*args,**kwargs):searches.append((args,kwargs));raise StopAfterRecall
    reader.search=search
    async def run():await reader.route_task(None,t,'Original AR question',catalog,{})
    if repair:
        with pytest.raises(StopAfterRecall):asyncio.run(run())
        assert len(searches)==1  # Same original post-recall search; stopped before any actual call.
    else:
        with pytest.raises(PipelineError,match='catalog_lookup_predecessor_required'):asyncio.run(run())
        assert searches==[]
    assert len(seen)==2
    assert seen[0]['data']['lookupRequirements']
    assert 'catalog_lookup_predecessor_required' in seen[1]['correction']
    assert seen[0]['schema']['properties']['candidateIds']['maxItems']==5
    assert gateway.events==[] and t.model_dump()==before
