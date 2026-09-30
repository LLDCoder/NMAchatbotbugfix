"""Generic numeric ranking, precedence and retained intent; synthetic data only."""
import json
import unittest
from app.generic_reader import PipelineError, execute_analysis
from app.generic_reader_contracts import AnalysisPlan, Step, TaskSpec
from app.reader_context import merge_task
from app.reader_ordering import sort_rows
from app.reader_requirements import requirements_for
from test_reader_requirement_coverage import fixture


def ranking_fixture(values=(31, 34, 9)):
    task, plan, sources, kb = fixture([{'specimenKey': str(i), 'phase': 'Warm', 'zone': 'East', 'score': v}
                                    for i, v in enumerate(values)])
    task.requestedMeasures = []; task.groupBy = []; task.requestedOrdering = ['score descending']
    task.outputShape = 'list'; task.requestedAttributes = ['score']
    raw = plan.model_dump()
    citation = raw['requirementBindings'][0]['evidence'][0]
    raw['steps'] = [dict(id='rows', op='read_rows', sourceId='queue', path='/data/items', totalPath='/data/total',
        fields=['specimenKey', 'score'], expose=False, label='rows', evidence=[{'sourceId':citation['sourceId']}]),
        dict(id='entities', op='distinct', inputs=['rows'], fields=['specimenKey'], expose=False, label='entities', evidence=[{'sourceId':citation['sourceId']}]),
        dict(id='rank', op='sort', inputs=['entities'], field='score', descending=True, role='detail', label='Ranking', evidence=[{'sourceId':citation['sourceId']}])]
    raw['requirementBindings'] = [b for b in raw['requirementBindings']
        if b['requirementId'] in {'object', 'grain', 'scope', 'population'}]
    record = {'id':'specimen.ranking', 'revision':1, 'status':'active', 'kind':'field_semantics',
        'sources':[{'reference':'/research/specimens'}], 'applicability':{'portal':'admin','environments':['local']},
        'payload':{'bindings':[
            {'id':'order', 'kind':'ordering', 'concept':'score descending', 'direction':'descending', 'valueType':'number',
             'operationRef':'POST /api/specimens/list','sourcePath':'/data/items','fields':['score'],'contextParameters':{}},
            {'id':'score', 'kind':'attribute', 'concept':'score',
             'operationRef':'POST /api/specimens/list','sourcePath':'/data/items','fields':['score'],'contextParameters':{}}]}}
    kb.add({'chunks':[{'content':json.dumps({'records':[record]}), 'id':'ranking-fields'}]})
    ref = next(d['passages'][0]['sourceId'] for d in kb.prompt() if d['recordId']=='specimen.ranking')
    for rid, bid in [('ordering_0','order'), ('attribute_0','score')]:
        raw['requirementBindings'].append({'requirementId':rid, 'sourceId':'queue','sourcePath':'/data/items',
            'fields':['score'],'stepIds':['rank'],'knowledgeBindingId':'specimen.ranking#'+bid,
            'evidence':[{'sourceId':ref,'quote':'"sourcePath": "/data/items"'}]})
    raw['requirementBindings'].append({'requirementId':'detail','sourceId':'queue','sourcePath':'/data/items',
        'fields':['specimenKey'],'stepIds':['rank'],'evidence':[citation]})
    return task, AnalysisPlan.model_validate(raw), sources, kb


def run(f):
    t,p,s,k=f
    return execute_analysis(p,s,k,[],task=t)


class RankingTests(unittest.TestCase):
    def test_documented_eligibility_precedes_ranking_without_imputing_nulls(self):
        from app.reader_bindings import bind_analysis_evidence
        t,p,s,k = ranking_fixture((31,None,9))
        rows=s['queue']['data']['data']['items']; rows[1]['phase']='Cold'
        p.steps[0].fields.append('phase')
        record={'id':'eligible.rank','revision':1,'status':'active','kind':'field_semantics',
            'sources':[{'reference':'/research/specimens'}], 'applicability':{'portal':'admin','environments':['local']},
            'payload':{'bindings':[{'id':'order','kind':'ordering','concept':'score descending',
                'operationRef':'POST /api/specimens/list','sourcePath':'/data/items',
                'fields':['score','phase'],'valueField':'score','direction':'descending','valueType':'number',
                'conditions':[{'field':'phase','predicate':'eq','value':'Warm'}]}]}}
        k.add({'chunks':[{'content':json.dumps({'records':[record]}),'id':'eligible-fields'}]})
        ref=next(d['passages'][0]['sourceId'] for d in k.prompt() if d['recordId']=='eligible.rank')
        for b in p.requirementBindings:
            if b.requirementId=='ordering_0':
                b.knowledgeBindingId='eligible.rank#order';b.fields=['score','phase'];b.evidence=[]
        with self.assertRaises(PipelineError) as missing: bind_analysis_evidence(p,t,k,s)
        self.assertEqual(missing.exception.code,'analysis_ordering_condition_missing')
        p.steps.insert(2,Step(id='eligible',op='filter',inputs=['entities'],field='phase',
            predicate='eq',operand='Warm',expose=False,label='Eligible',evidence=[{'sourceId':ref}]))
        p.steps[-1].inputs=['eligible']
        bind_analysis_evidence(p,t,k,s)
        result=execute_analysis(p,s,k,[],task=t)
        self.assertTrue(result['requirementsSatisfied'],result['requirementCoverage'])
        self.assertEqual([row['score'] for row in result['outputs'][0]['value']], [31,9])
        self.assertIsNone(rows[1]['score'])

    def test_numeric_rank_is_verified_over_complete_population(self):
        result=run(ranking_fixture())
        self.assertTrue(result['requirementsSatisfied'], result['requirementCoverage'])
        self.assertEqual([r['score'] for r in result['outputs'][0]['value']], [34,31,9])
        self.assertIn('ordering_0', result['outputs'][0]['requirementIds'])

    def test_wrong_direction_cannot_pass_same_field(self):
        f=ranking_fixture(); f[1].steps[-1].descending=False
        result=run(f)
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('requested_ordering_unverified', result['missing'])

    def test_lexical_numbers_cannot_claim_numeric_order(self):
        result=run(ranking_fixture(('31','34','9')))
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('requested_ordering_unverified',result['missing'])

    def test_sample_cannot_establish_global_ranking(self):
        f=ranking_fixture(); f[1].steps[-1].limit=1
        self.assertFalse(run(f)['requirementsSatisfied'])

    def test_missing_or_mixed_values_are_not_silently_ranked(self):
        for values in [(34,None), (34,'31'), (True,31), (float('inf'),31)]:
            with self.subTest(values=values), self.assertRaises(PipelineError):run(ranking_fixture(values))

    def test_equal_values_retain_order(self):
        result=run(ranking_fixture((34,31,34)))
        self.assertEqual([r['specimenKey'] for r in result['outputs'][0]['value']],['0','2','1'])

    def test_empty_complete_population_is_verified(self):
        self.assertTrue(run(ranking_fixture(()))['requirementsSatisfied'])

    def test_sort_receipt_is_not_reused_after_wrong_last_sort(self):
        f=ranking_fixture(); raw=f[1].steps[-1].model_dump()
        f[1].steps[-1].expose=False
        raw.update(id='wrong',inputs=['rank'],field='specimenKey',descending=False)
        f[1].steps.append(Step.model_validate(raw))
        self.assertFalse(run(f)['requirementsSatisfied'])

    def test_incomplete_population_is_rejected_before_ordering(self):
        f=ranking_fixture(); f[2]['queue']['data']['data']['total']=100
        with self.assertRaisesRegex(PipelineError,'full_collection_required'):run(f)

    def test_old_persisted_choice_receives_new_slot_default(self):
        task=ranking_fixture()[0]; old=task.model_dump();old.pop('requestedOrdering')
        history={'previousIntent':{'task':old}}
        value=merge_task(task, history, {'choiceId':'scope', 'updates':[
            {'field':'requestedScope','source':'current','value':'personal'}]})
        self.assertEqual(value.requestedOrdering,[])

    def test_followup_inherits_then_explicitly_clears_order(self):
        task=ranking_fixture()[0];history={'previousIntent':{'requestedOrdering':task.requestedOrdering}}
        follow=task.model_copy(update={'contextRelation':'continue','requestedOrdering':[]})
        self.assertEqual(merge_task(follow,history).requestedOrdering,['score descending'])
        from app.generic_reader_contracts import SlotUpdate
        follow.slotUpdates=[SlotUpdate(field='requestedOrdering',source='clear',value=[])]
        self.assertEqual(merge_task(follow,history).requestedOrdering,[])

class OutputAndLookupTests(unittest.TestCase):
    def test_lookup_goal_does_not_require_destination_properties(self):
        from app.reader_prerequisites import lookup_collection_task, validate_lookup_collections
        from app.generic_reader_contracts import CollectionPlan
        task = ranking_fixture()[0]
        task.recordIdentity = 'public-record-1'
        task.requestedAttributes = ['missing attachments']
        narrowed = lookup_collection_task(task)
        self.assertEqual(narrowed.requestedAttributes, [])
        self.assertEqual(narrowed.recordIdentity, task.recordIdentity)
        self.assertEqual(narrowed.requestedScope, task.requestedScope)
        self.assertEqual(task.requestedAttributes, ['missing attachments'])
        with self.assertRaises(PipelineError) as caught:
            validate_lookup_collections(CollectionPlan(stage='collection', collections=[],
                missing=['missing_attachments']), {'live': {'operationRef': 'GET /specimens'}},
                {'GET /specimens': ['key', 'publicKey']})
        self.assertEqual(caught.exception.code, 'collection_lookup_plan_missing')
        self.assertEqual(caught.exception.details['requiredLookupFields']['live'], ['key', 'publicKey'])

    def test_semantic_correction_names_only_matching_operation_and_context(self):
        import copy
        from app.reader_bindings import bind_analysis_evidence
        t,p,s,k = fixture()
        t.businessObject = 'crystals'
        record = {'id':'crystal.names', 'revision':1, 'status':'active', 'kind':'field_semantics',
            'sources':[{'reference':'/research/specimens'}], 'applicability':{'portal':'admin','environments':['local']},
            'payload':{'bindings':[]}}
        fact = {'id':'correct', 'kind':'object', 'concept':'crystals',
            'operationRef':'POST /api/specimens/list', 'sourcePath':'/data/items',
            'fields':['specimenKey'], 'contextParameters':{}}
        record['payload']['bindings'].append(fact)
        record['payload']['bindings'].append({**fact,'id':'other_operation','operationRef':'GET /other'})
        record['payload']['bindings'].append({**fact,'id':'other_scope','contextParameters':{'team':'other'}})
        k.add({'chunks':[{'content':json.dumps({'records':[record]}),'id':'crystal-names'}]})
        with self.assertRaises(PipelineError) as caught: bind_analysis_evidence(p,t,k,s)
        self.assertEqual(caught.exception.details['matchingBindingIds'], ['crystal.names#correct'])
        self.assertEqual(t.businessObject, 'crystals')
    def test_unverified_population_cannot_escape_as_observation(self):
        from app.reader_output_scope import confirmed_output_contexts
        rows=[{'id':'x','role':'observation','value':[{'name':'unrelated'}]}]
        context=[{'id':'population','kind':'population','status':'unfulfilled','outputIds':[]}]
        accepted,withheld=confirmed_output_contexts(rows,context)
        self.assertEqual(accepted,[]);self.assertEqual(withheld[0]['requirementIds'],['population'])
        self.assertNotIn('unrelated',str(withheld))

    def test_output_proof_is_branch_specific(self):
        from app.reader_output_scope import confirmed_output_contexts
        rows=[{'id':'mine','value':1},{'id':'other','value':50}]
        context=[{'id':'scope','kind':'scope','status':'satisfied','outputIds':['mine']}]
        self.assertEqual(confirmed_output_contexts(rows,context)[0],[rows[0]])

    def test_missing_attribute_does_not_erase_proven_scope(self):
        from app.reader_output_scope import confirmed_output_contexts
        rows=[{'id':'mine','value':[{'expiry':None}]}]
        context=[{'id':'scope','kind':'scope','status':'satisfied','outputIds':['mine']},
                 {'id':'attribute_0','kind':'attribute','status':'unfulfilled','outputIds':[]}]
        self.assertEqual(confirmed_output_contexts(rows,context),(rows,[]))

    def test_lookup_projection_uses_dependencies_not_model_extras(self):
        from app.reader_prerequisites import compile_lookup_projection
        from types import SimpleNamespace
        spec=SimpleNamespace(sourceId='s',fields=['name','secret'],identityFields=['key'])
        correction=compile_lookup_projection(spec,{'key','displayKey','status'})
        self.assertEqual(spec.fields,['displayKey','key','status'])
        self.assertEqual(correction['excludedFields'],['name','secret'])
        self.assertIsNone(compile_lookup_projection(spec,set(spec.fields)))

    def test_lookup_compilation_cannot_repair_a_foreign_identity(self):
        from app.reader_prerequisites import compile_lookup_projection
        from types import SimpleNamespace
        with self.assertRaises(PipelineError):
            compile_lookup_projection(SimpleNamespace(sourceId='s',fields=['key'],identityFields=['another']),{'key'})

    def test_page_dependency_is_exact_and_remote_scoped(self):
        from app.reader_prerequisites import collection_document_dependencies
        from types import SimpleNamespace
        rec={'status':'active','applicability':{'pageRefs':['/crystals']},'payload':{'knowledgeDependencies':[
             {'purpose':'collection','operationRef':'POST /crystals/query','document':'Crystal Fields.json'},
             {'purpose':'collection','operationRef':'POST /other/query','document':'Other Fields.json'}]}}
        kb=SimpleNamespace(items={'d':{'record':rec,'documentId':'verified-remote'}})
        self.assertEqual(collection_document_dependencies(kb,'/crystals?tab=1',['POST /crystals/query']),['Crystal Fields.json'])
        self.assertEqual(collection_document_dependencies(kb,'/another',['POST /crystals/query']),[])
        rec['payload']['knowledgeDependencies'].append({'purpose':'analysis',
            'operationRef':'POST /crystals/query','document':'Crystal Names.json'})
        self.assertEqual(collection_document_dependencies(kb,'/crystals',['POST /crystals/query'],
            purpose='analysis'), ['Crystal Names.json'])
        kb.items['d']['documentId']=''
        self.assertEqual(collection_document_dependencies(kb,'/crystals',['POST /crystals/query']),[])

    def test_exact_ready_filename_hydrates_even_when_search_returns_no_chunk(self):
        import asyncio,hashlib,copy
        from app.reader_retrieval import retrieve_evidence
        text=json.dumps({'records':[]});digest=hashlib.sha256(text.encode()).hexdigest()
        manifest={'id':'package','name':'Crystal Fields.json','status':'done','size':len(text.encode()),'sha256':digest,'updated_at':'1','folder_id':'root'}
        class Client:
            def __init__(self):self.calls=[]
            async def files(self,*a,**k):return {'items':[copy.deepcopy(manifest)]}
            async def _post(self,*a,**k):return {'chunks':[],'completed_channels':['bm25','vector','graph']}
            async def document(self,doc,*a,**k):
                self.calls.append(doc);return {'content':text,'manifest':copy.deepcopy(manifest),'content_hash':digest}
        client=Client();result=asyncio.run(retrieve_evidence(client,manifest['name'],'root',32,{'purpose':'page_fields'}))
        self.assertEqual(client.calls,['package']);self.assertEqual(result['chunks'][0]['document_id'],'package')
        self.assertFalse(result.get('consistencyError'))
