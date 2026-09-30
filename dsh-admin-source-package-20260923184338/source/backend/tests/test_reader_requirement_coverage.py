"""Acceptance must follow the question's grain and dimensions, not UI cards."""
import copy
import json
import unittest

from app.generic_reader import KnowledgeStore, execute_analysis, PipelineError, render_generic_answer, source_inventory
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_requirements import requirements_for
from app.reader_collection import checked_collections, projection_hash
from app.portal_reader import bounded_portal_read_result

DOCUMENT = ('Page /research/specimens is a personal open specimen queue. '
            'Specimen identity is specimenKey; count specimens by distinct specimenKey. '
            'Phase is the phase field; zone is the zone field. '
            'The /data/items rows are personal open specimens, /data/total is their total. '
            'Page cards are task projections and do not define specimen phase. '
            'pageIndex and pageSize paginate the rows.')


def fixture(rows=None):
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'content': DOCUMENT, 'id': 'specimen-page'}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    citation = {'sourceId': ref, 'quote': DOCUMENT}
    task = TaskSpec(stage='task', businessObject='specimens', businessFocus='open', requestedScope='personal',
        requestedGrain='specimen', requestedMeasures=['count'], groupBy=['phase'], timeRange='current', filters=[],
        outputShape='count', needsLiveData=True, readOnly=True, searchQuery='specimen page phase identity', unresolvedSlots=[])
    rows = rows if rows is not None else [{'specimenKey': 'a', 'phase': 'Warm', 'zone': 'East'},
        {'specimenKey': 'a', 'phase': 'Warm', 'zone': 'East'}, {'specimenKey': 'b', 'phase': 'Cold', 'zone': 'West'},
        {'specimenKey': 'c', 'phase': 'Uncatalogued', 'zone': 'East'}]
    sources = {'queue': {'data': {'data': {'items': rows, 'total': len(rows)}}, 'page': '/research/specimens',
        'capturedAt': '2026-09-24', 'principalScopeRef': 'principal', 'operationRef': 'POST /api/specimens/list',
        'completeness': 'bounded', 'collectionContext': {'parameterHashes': {}}}}
    steps = [dict(id='rows', op='read_rows', sourceId='queue', path='/data/items', totalPath='/data/total',
                  fields=['specimenKey', 'phase', 'zone'], expose=False),
             dict(id='entities', op='distinct', fields=['specimenKey'], inputs=['rows'], expose=False),
             dict(id='total', op='count', inputs=['entities'], role='total'),
             dict(id='phases', op='group_count', inputs=['entities'], fields=['phase'], role='breakdown')]
    claim = lambda value: {'value': value, 'evidence': [{'sourceId': ref}]}
    plan = {'stage': 'analysis', 'context': {'scope': 'personal', 'scopeEvidence': [{'sourceId': ref}],
        'grain': claim('specimen'), 'population': claim('open'), 'filterScope': claim('current queue'),
        'time': claim('current'), 'caveats': []}, 'steps': [dict(s, label=s['id'], evidence=[{'sourceId': ref}]) for s in steps],
        'requirementBindings': [], 'missing': []}
    for requirement in requirements_for(task):
        kind = requirement['kind']
        if kind == 'time':
            continue
        fields = ['phase'] if kind == 'group' else ['specimenKey']
        ids = ['phases'] if kind == 'group' else ['total'] if kind == 'measure' else ['entities']
        plan['requirementBindings'].append(dict(requirementId=requirement['id'], sourceId='queue', sourcePath='/data/items',
            fields=fields, stepIds=ids, evidence=[citation]))
    facts = [{'id': b['requirementId'], 'kind': next(r['kind'] for r in requirements_for(task) if r['id'] == b['requirementId']),
              'concept': next(r['value'] for r in requirements_for(task) if r['id'] == b['requirementId']),
              'aliases': [], 'contextParameters': {}, 'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items', 'fields': b['fields']}
             for b in plan['requirementBindings'] if not b['requirementId'].startswith('measure')]
    facts.append({'id': 'zone', 'kind': 'group', 'concept': 'zone', 'aliases': [],
                  'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items', 'fields': ['zone']})
    record = {'id': 'specimen.fields', 'revision': 1, 'status': 'active', 'kind': 'field_semantics',
              'sources': [{'reference': '/research/specimens'}],
              'applicability': {'portal': 'admin', 'environments': ['local']}, 'payload': {'bindings': facts}}
    knowledge.add({'chunks': [{'content': json.dumps({'records': [record]}), 'id': 'field-definitions'}]})
    semantic_ref = next(doc['passages'][0]['sourceId'] for doc in knowledge.prompt() if doc['recordId'] == record['id'])
    for binding in plan['requirementBindings']:
        if not binding['requirementId'].startswith('measure'):
            binding['knowledgeBindingId'] = record['id'] + '#' + binding['requirementId']
            binding['evidence'].append({'sourceId': semantic_ref, 'quote': '"sourcePath": "/data/items"'})
    return task, AnalysisPlan.model_validate(plan), sources, knowledge


def execute(f):
    task, plan, sources, knowledge = f
    return execute_analysis(plan, sources, knowledge, [{'label': 'Irrelevant card', 'value': 99}], task=task)


class RequirementCoverageTests(unittest.TestCase):
    def test_complete_distinct_count_and_unseen_groups_with_unrelated_card(self):
        result = execute(fixture())
        self.assertTrue(result['requirementsSatisfied'])
        self.assertEqual(result['outputs'][0]['value'], 3)
        self.assertEqual(result['outputs'][1]['value'], [{'phase': 'Warm', 'count': 1},
            {'phase': 'Cold', 'count': 1}, {'phase': 'Uncatalogued', 'count': 1}])
        self.assertEqual(result['outputs'][1]['role'], 'breakdown')
        self.assertFalse(result['metricCoverage'])

    def test_card_only_cannot_satisfy_requested_grain_or_group(self):
        task, plan, sources, knowledge = fixture()
        raw = plan.model_dump()
        raw['steps'] = [{'id': 'card', 'op': 'read_aggregate', 'sourceId': 'cards', 'path': '/0/value',
                         'role': 'total', 'label': 'Open', 'evidence': raw['steps'][0]['evidence']}]
        raw['requirementBindings'] = []
        sources['cards'] = {**sources['queue'], 'data': [{'value': 3}]}
        result = execute_analysis(AnalysisPlan.model_validate(raw), sources, knowledge, [], task=task)
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('requested_grouping_unfulfilled', result['missing'])
        self.assertIn('requested_grain_unverified', result['missing'])
        self.assertEqual(result['outputs'][0]['role'], 'observation')

    def test_total_alone_does_not_satisfy_grouping(self):
        task, plan, sources, knowledge = fixture()
        plan.steps.pop()
        plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != 'group_0']
        result = execute((task, plan, sources, knowledge))
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('requested_grouping_unfulfilled', result['missing'])

    def test_same_entity_conflicting_phase_rejected(self):
        f = fixture([{'specimenKey': 'a', 'phase': 'Warm', 'zone': 'East'},
                     {'specimenKey': 'a', 'phase': 'Cold', 'zone': 'East'}])
        with self.assertRaisesRegex(PipelineError, 'entity_projection_conflict'):
            execute(f)

    def test_null_identity_is_not_an_entity(self):
        with self.assertRaisesRegex(PipelineError, 'entity_identity_missing'):
            execute(fixture([{'specimenKey': None, 'phase': 'Warm', 'zone': 'East'}]))

    def test_missing_phase_is_not_zero_or_a_silent_group(self):
        with self.assertRaisesRegex(PipelineError, 'grouping_value_unavailable'):
            execute(fixture([{'specimenKey': 'a', 'phase': None, 'zone': 'East'}]))

    def test_incomplete_rows_are_not_counted(self):
        f = fixture()
        f[2]['queue']['data']['data']['total'] = 100
        with self.assertRaisesRegex(PipelineError, 'full_collection_required'):
            execute(f)

    def test_wrong_group_field_does_not_satisfy_requirement(self):
        f = fixture()
        f[1].steps[-1].fields = ['zone']
        result = execute(f)
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('requested_grouping_unfulfilled', result['missing'])

    def test_unrelated_valid_citation_is_not_a_semantic_proof(self):
        f = fixture()
        f[1].requirementBindings[-1].evidence[0].quote = 'Page /research/specimens is a personal open specimen queue.'
        # Remove the independently valid structured-record citation: a binding
        # ID without citing its record must not turn unrelated prose into proof.
        f[1].requirementBindings[-1].evidence = f[1].requirementBindings[-1].evidence[:1]
        result = execute(f)
        self.assertIn('field_semantic_binding_unverified', result['missing'])

    def test_multiple_dimensions_share_same_group_operator(self):
        task, plan, sources, knowledge = fixture()
        task.groupBy.append('zone')
        plan.steps[-1].fields.append('zone')
        binding = plan.requirementBindings[-1].model_copy(deep=True)
        binding.requirementId, binding.fields = 'group_1', ['zone']
        binding.knowledgeBindingId = 'specimen.fields#zone'
        plan.requirementBindings.append(binding)
        result = execute((task, plan, sources, knowledge))
        self.assertTrue(result['requirementsSatisfied'])
        self.assertEqual(result['outputs'][-1]['value'][0], {'phase': 'Warm', 'zone': 'East', 'count': 1})

    def test_different_total_and_group_populations_fail(self):
        f = fixture()
        f[1].steps[-2].inputs = ['rows']
        result = execute(f)
        self.assertFalse(result['requirementsSatisfied'])
        # The count also loses its identity proof because it bypasses distinct.
        self.assertEqual(result['outputs'][0]['role'], 'observation')

    def test_empty_collection_produces_confirmed_zero_and_empty_groups(self):
        result = execute(fixture([]))
        self.assertTrue(result['requirementsSatisfied'])
        self.assertEqual([o['value'] for o in result['outputs']], [0, []])

    def test_negated_or_unrelated_prose_cannot_override_structured_semantics(self):
        f = fixture()
        f[1].requirementBindings[-1].knowledgeBindingId = ''
        result = execute(f)
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('field_semantic_binding_unverified', result['missing'])

    def test_semantic_record_for_different_operation_cannot_prove_same_field(self):
        f = fixture()
        f[2]['queue']['operationRef'] = 'POST /api/different/list'
        self.assertFalse(execute(f)['requirementsSatisfied'])

    def test_unaccounted_filter_cannot_claim_whole_population(self):
        f = fixture()
        f[2]['queue']['collectionContext']['parameterHashes'] = {'zone': projection_hash('East')}
        result = execute(f)
        self.assertFalse(result['requirementsSatisfied'])
        self.assertIn('source_filter_context_unverified', result['missing'])

    def test_forged_requirement_id_rejected(self):
        f = fixture()
        f[1].requirementBindings[-1].requirementId = 'invented'
        with self.assertRaisesRegex(PipelineError, 'requirement_binding_invalid'):
            execute(f)

    def test_complete_receipt_transport_keeps_more_than_sixty_rows(self):
        rows = [{'specimenKey': str(i), 'phase': 'Warm'} for i in range(180)]
        receipt = {'schemaVersion': 'projected-collection/1', 'rows': rows, 'total': 180, 'rowCount': 180,
            'fields': ['specimenKey', 'phase'], 'identityFields': ['specimenKey'], 'stablePasses': 2,
            'snapshotIsolation': False, 'completeness': 'complete', 'projectionHash': projection_hash(rows),
            'operationRef': 'POST /api/specimens/list', 'contextRef': 'a' * 64,
            'rowsPath': '/items', 'totalPath': '/total', 'finishedAt': 'now'}
        actual = bounded_portal_read_result({'observation': {'collections': [receipt]}})
        self.assertEqual(len(actual['observation']['collections'][0]['rows']), 180)
        receipt['rows'] = rows[:60]
        self.assertEqual(checked_collections([receipt])[0]['completeness'], 'incomplete')

    def test_discovery_truncation_never_claims_full_rows(self):
        obs = {'apiDiscovery': {'candidates': [{'operationKey': 'POST /api/specimens/list', 'policyState': 'allowed',
            'status': 200, 'responseEvidence': {'items': [{'id': i} for i in range(100)], 'total': 100}}]}}
        source = next(iter(source_inventory(obs, '/research/specimens', 'now', 'principal').values()))
        self.assertTrue(source['truncated'])

    def test_grouped_answer_is_a_table_not_a_json_blob(self):
        result = execute(fixture())
        result['requirementsSatisfied'] = True
        answer = render_generic_answer(result)
        self.assertIn('| phase | count |', answer)
        self.assertIn('| Uncatalogued | 1 |', answer)
        self.assertNotIn('{"phase"', answer)

class FullPipelineCollectionTests(unittest.TestCase):
    def test_retrieval_selection_collection_and_requirement_acceptance(self):
        import asyncio
        from app.generic_reader import GenericKnowledgeReader
        from app.principal import Principal
        task, plan, sources, knowledge = fixture()
        rows = sources['queue']['data']['data']['items']
        operation = sources['queue']['operationRef']
        context = {'contextRef': 'a' * 64, 'parameterHashes': {}, 'requestFields': ['pageIndex', 'pageSize'],
                   'rowSchemas': [{'path': '/data/items', 'fields': ['specimenKey', 'phase', 'zone']}]}
        observation = {'apiDiscovery': {'candidates': [{'operationKey': operation, 'status': 200,
            'policyState': 'allowed', 'collectionContext': context, 'responseEvidenceTruncated': True,
            'responseEvidence': {'data': {'items': rows[:2], 'total': len(rows)}}}]}}
        sid = next(iter(source_inventory(observation, '/research/specimens', 'now', 'principal')))
        for step in plan.steps:
            if step.sourceId:
                step.sourceId = sid
        for binding in plan.requirementBindings:
            binding.sourceId = sid
        reference = next(doc['passages'][0]['sourceId'] for doc in knowledge.prompt() if not doc['recordId'])
        class Gateway:
            calls = []
            async def get_user_info(self, principal):
                return {'ok': True, 'result': {'data': {'id': 'person', 'rolesInfo': [{'roleName': 'Reviewer'}], 'listSysPermission': [
                    {'frontendRoute': '/research/specimens'}]}}}
            async def invoke(self, principal, name, arguments, **kwargs):
                self.calls.append((name, arguments))
                if name == 'knowledge.search':
                    return {'ok': True, 'result': {'chunks': []}}
                if 'collections' not in arguments:
                    return {'ok': True, 'result': {'page': '/research/specimens', 'observation': observation}}
                requested = arguments['collections'][0]
                assert requested['fields'] == ['specimenKey', 'phase', 'zone']
                assert requested['operationKey'] == operation
                receipt = {'schemaVersion': 'projected-collection/1', 'operationRef': operation,
                    'contextRef': context['contextRef'], 'rowsPath': '/data/items', 'totalPath': '/data/total',
                    'fields': requested['fields'], 'identityFields': ['specimenKey'], 'rows': rows,
                    'total': len(rows), 'rowCount': len(rows), 'stablePasses': 2, 'snapshotIsolation': False,
                    'completeness': 'complete', 'projectionHash': projection_hash(rows), 'finishedAt': 'now'}
                return {'ok': True, 'result': {'page': '/research/specimens', 'observation': {'collections': [receipt]}}}
        class Planner:
            async def generic_reader_json(self, *, schema, data, **kwargs):
                stage = schema['properties']['stage']['const']
                if stage == 'query_expansion':
                    from test_generic_reader_v3 import expansion_fixture
                    return expansion_fixture(data)
                if stage == 'task':
                    return task.model_dump()
                if stage == 'knowledge_coverage':
                    return {'stage': stage, 'checks': [{'requirementId': r['id'], 'status': 'covered',
                        'reason': 'Fixture provides explicit specimen field semantics and scope.',
                        'evidence': [{'sourceId': reference}]} for r in data['requirements']]}
                if stage == 'knowledge_resolution':
                    return dict(stage=stage, route='/research/specimens', pageName='Specimens',
                                routeEvidence=[{'sourceId': reference}], answerEvidence=[], missing=[])
                if stage == 'source_selection':
                    return dict(stage=stage, sourceIds=[sid], rationale=[{'sourceId': reference}], missing=[])
                if stage == 'collection':
                    return dict(stage=stage, collections=[dict(sourceId=sid, rowsPath='/data/items', totalPath='/data/total',
                        fields=['specimenKey', 'phase', 'zone'], identityFields=['specimenKey'], pageField='pageIndex',
                        sizeField='pageSize', evidence=[{'sourceId': reference, 'quote': DOCUMENT}])], missing=[])
                assert 'semanticBindings' in data
                # Full computation rows must never be sent to the model.
                assert 'data' not in data['sources'][sid]
                return plan.model_dump()
        gateway = Gateway()
        reader = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test')
        reader.knowledge = knowledge
        result = asyncio.run(reader.run(Principal('person', 'tenant', 'request', umc_token='private'),
                                       'How many open specimens do I have? Group by phase.'))
        public = result.result.public_json()
        self.assertTrue(public['requirementsSatisfied'], public['missing'])
        self.assertEqual(public['outputs'][0]['value'], 3)
        self.assertEqual(public['analysisStatus'], 'complete')
        self.assertEqual(public['completeness'], 'complete')
        self.assertEqual(sum(name == 'admin.portal.read' for name, _ in gateway.calls), 2)
        self.assertNotIn('rows', result.audit_evidence['collections'][0])


if __name__ == '__main__':
    unittest.main()
