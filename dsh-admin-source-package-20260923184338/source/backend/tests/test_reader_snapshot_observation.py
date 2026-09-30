import copy
import json
import unittest
from app.generic_reader import KnowledgeStore, execute_analysis, render_generic_answer, PipelineError
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_collection import projection_hash
from app.reader_requirements import requirements_for, _context_match
from app.reader_bindings import bind_analysis_evidence


def fixture(scale=False):
    task=TaskSpec(stage='task',businessObject='snapshot',businessFocus='',requestedScope='unknown',
        requestedGrain='snapshot',requestedMeasures=[],requestedAttributes=['completion rate'],groupBy=[],
        timeRange='unknown',filters=[],outputShape='detail',needsLiveData=True,readOnly=True,
        searchQuery='snapshot completion rate',unresolvedSlots=[])
    op='GET /api/research/window';path='/data/summary'
    common=dict(operationRef=op,sourcePath=path,fields=['completionRate'],contextParameters={'scope':'unit'},
        contextResponseBindings={'from':{'path':'/data/start','format':'date'},'to':{'path':'/data/end','format':'date'}})
    facts=[dict(common,id='object',kind='object',concept='snapshot'),
           dict(common,id='grain',kind='grain',concept='snapshot',observationShape='singleton_object'),
           dict(common,id='rate',kind='attribute',concept='completion rate',displayUnit='%')]
    if scale:
        facts[-1]['displayScale']={'threshold':1,'atMostFactor':100,'otherwiseFactor':1,'decimals':1}
    record={'id':'research.window','revision':1,'status':'active','kind':'field_semantics',
        'sources':[{'reference':'/research/window'}],'applicability':{'pageRefs':['/research/window'],'portal':'admin','environments':['local']},
        'payload':{'bindings':facts}}
    knowledge=KnowledgeStore();knowledge.add({'chunks':[{'id':'window','content':json.dumps({'records':[record]})}]})
    ref=knowledge.prompt()[0]['passages'][0]['sourceId'];cite={'sourceId':ref}
    data={'data':{'start':'2026-03-01T00:00:00','end':'2026-03-07T23:59:59','summary':{'completionRate':0}}}
    receipts={p:{'status':'complete','valueHash':projection_hash(v)} for p,v in [('/data/start',data['data']['start']),('/data/end',data['data']['end']),('/data/summary/completionRate',0)]}
    sources={'s':{'data':data,'kind':'api_response','page':'/research/window','operationRef':op,'ready':True,
        'capturedAt':'2026-03-07T12:00:00Z','principalScopeRef':'verified-subject','completeness':'bounded',
        'fieldEvidence':receipts,'collectionContext':{'parameterHashes':{k:projection_hash(v) for k,v in {'scope':'unit','from':'2026-03-01','to':'2026-03-07'}.items()}}}}
    claim=lambda v:dict(value=v,evidence=[cite])
    raw={'stage':'analysis','context':{'scope':'unknown','scopeEvidence':[],'grain':claim('current snapshot'),
        'population':claim('current visible unit and period'),'filterScope':claim('current window'),'time':claim('current'),'caveats':[]},
        'steps':[dict(id='value',op='read_rows',sourceId='s',path=path,fields=['completionRate'],label='Current rate',
            fieldLabels={'completionRate':'Completion rate'},role='detail',evidence=[cite])],
        'requirementBindings':[],'missing':[]}
    for r in requirements_for(task):
        if r['kind']=='detail':continue
        raw['requirementBindings'].append(dict(requirementId=r['id'],sourceId='s',sourcePath=path,fields=['completionRate'],
            stepIds=['value'],knowledgeBindingId='research.window#'+('rate' if r['kind']=='attribute' else r['kind'])))
    return task,AnalysisPlan.model_validate(raw),sources,knowledge,facts


def execute(f):
    task,plan,sources,knowledge,_=f
    bind_analysis_evidence(plan,task,knowledge,sources)
    return execute_analysis(plan,sources,knowledge,[],task=task)


class SnapshotTests(unittest.TestCase):
    def test_conditional_display_scale_keeps_observed_numbers(self):
        for value,text in [(0,'0%'),(0.5,'50%'),(1,'100%'),(100,'100%'),(75.25,'75.3%')]:
            with self.subTest(value=value):
                f=fixture(scale=True);s=f[2]['s'];s['data']['data']['summary']['completionRate']=value
                s['fieldEvidence']['/data/summary/completionRate']['valueHash']=projection_hash(value)
                r=execute(f);self.assertTrue(r['requirementsSatisfied'])
                self.assertEqual(r['outputs'][0]['value'][0]['completionRate'],value)
                self.assertEqual(r['outputs'][0]['displayRows'][0]['completionRate'],text)
    def test_zero_is_observed_with_unit_not_an_entity_key(self):
        r=execute(fixture());self.assertTrue(r['requirementsSatisfied'],r['missing'])
        self.assertEqual(r['outputs'][0]['value'],[{'completionRate':0}])
        self.assertEqual(r['outputs'][0]['fieldLabels']['completionRate'],'Completion rate (%)')
    def test_conflicting_or_absent_echo_cannot_prove_request_context(self):
        for mutation in ['wrong_query','extra_query','missing_receipt','changed_value','missing_scope']:
            with self.subTest(mutation=mutation):
                f=fixture();s=f[2]['s'];h=s['collectionContext']['parameterHashes']
                if mutation=='wrong_query':h['from']=projection_hash('2026-02-01')
                if mutation=='extra_query':h['owner']=projection_hash('other')
                if mutation=='missing_receipt':del s['fieldEvidence']['/data/start']
                if mutation=='changed_value':s['data']['data']['start']='2026-02-01T00:00:00'
                if mutation=='missing_scope':del h['scope']
                self.assertFalse(_context_match(f[4][1],s))
                self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_does_not_prove_a_user_supplied_entity_identity(self):
        f=fixture();f[0].recordIdentity='R-17'
        self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_snapshot_cannot_be_used_as_population_count(self):
        f=fixture();f[0].requestedMeasures=['count']
        self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_missing_metric_is_not_zero(self):
        f=fixture();f[2]['s']['data']['data']['summary']['completionRate']=None
        f[2]['s']['fieldEvidence']['/data/summary/completionRate']['valueHash']=projection_hash(None)
        self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_array_is_not_singleton_object(self):
        f=fixture();f[2]['s']['data']['data']['summary']=[{'completionRate':0}]
        f[2]['s']['fieldEvidence']['/data/summary/0/completionRate']={'status':'complete','valueHash':projection_hash(0)}
        self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_principal_required(self):
        f=fixture();f[2]['s']['principalScopeRef']=''
        self.assertFalse(execute(f)['requirementsSatisfied'])
    def test_invalid_date_or_format_rejected(self):
        f=fixture();fact=f[4][1];s=f[2]['s']
        fact['contextResponseBindings']['from']['format']='arbitrary_code'
        self.assertFalse(_context_match(fact,s))
    def test_echo_cannot_override_fixed_scope(self):
        f=fixture();fact=f[4][1]
        fact['contextResponseBindings']['scope']={'path':'/data/start','format':'date'}
        self.assertFalse(_context_match(fact,f[2]['s']))
