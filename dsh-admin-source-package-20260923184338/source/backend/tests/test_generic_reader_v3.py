"""Business-independent regression tests; all user questions are English."""
import asyncio
import copy
import json
import unittest

from app.generic_reader import (GenericKnowledgeReader, KnowledgeStore, PipelineError, bind_read_actions, clean,
    execute_analysis, knowledge_gap, pointer, render_generic_answer, semantic_history, source_inventory, validate_selection)
from app.generic_reader_contracts import AnalysisPlan, Citation, MeasureSelection, SourceSelection
from app.portal_reader import ReaderTimeoutBudget, ReadOnlyPortalPolicy, UserPermissionContext
from app.principal import Principal


DOCUMENT = ('Page /work/crystals shows a personal queue. Unit: task projections, not unique crystals. '
            'Cards are before list filters. Blue and Amber can overlap. Completed is outside the open queue. '
            'Fields: total, blue, amber, done. Each current page metric has its displayed label.')


def store():
    k = KnowledgeStore()
    k.add({'chunks': [{'id': 'chunk-1', 'document_id': 'doc-1', 'source_name': 'Crystals manual', 'content': DOCUMENT}]})
    return k


def reference(k):
    return {'sourceId': k.prompt()[0]['passages'][0]['sourceId']}


def expansion_fixture(data):
    """Protocol fixture only; real bilingual semantics have separate tests."""
    return {'stage': 'query_expansion', 'intentStatus': 'consistent', 'issues': [],
            'terms': [{'requirementId': r['id'], 'sourceText': r['value'], 'english': r['value'],
                       'arabic': r['value'] if r['kind'] == 'record' else 'وصف ' + r['value'],
                       'alternatives': []} for r in data['requirements']]}


def observed():
    return {'metrics': [{'label': 'Open', 'value': '8'}, {'label': 'Blue', 'value': '8'},
                        {'label': 'Amber', 'value': '0'}, {'label': 'Completed', 'value': '3'}],
            'apiDiscovery': {'candidates': [{'operationKey': 'POST /api/crystals/query', 'status': 200,
                'policyState': 'allowed', 'candidateKind': 'business', 'responseEvidenceTruncated': True,
                'responseEvidence': {'data': {'total': 8, 'blue': 8, 'amber': 0, 'done': 3,
                                             'rows': ['[max-depth]']}}}]}}


def analysis(k):
    ref = reference(k)
    claim = lambda s: {'value': s, 'evidence': [ref]}
    return {'stage': 'analysis', 'context': {'scope': 'personal', 'scopeEvidence': [ref],
        'grain': claim('task projections'), 'population': claim('personal queue'),
        'filterScope': claim('before list filters'), 'time': {'value': 'current observation', 'evidence': []},
        'caveats': [claim('Blue and Amber can overlap.')]},
        'steps': [{'id': 'm'+str(i), 'op': 'read_aggregate', 'sourceId': 'page_metrics',
                   'path': '/'+str(i)+'/value', 'label': label, 'evidence': [ref]}
                  for i, label in enumerate(['Open', 'Blue', 'Amber'])],
        'metricCoverage': [{'metricIndex': i, 'disposition': 'included', 'stepId': 'm'+str(i), 'reason': ''}
                           for i in range(3)] + [{'metricIndex': 3, 'disposition': 'outside_task', 'reason': 'Completed is outside the open queue.'}],
        'missing': []}


class Gateway:
    def __init__(self, identity='person-1', fail=None):
        self.events, self.identity, self.fail = [], identity, fail

    async def get_user_info(self, principal):
        self.events.append('identity')
        return {'ok': True, 'result': {'data': {'id': self.identity,
            'rolesInfo': [{'roleName': 'Manager'}], 'listSysPermission': [{'frontendRoute': '/work/crystals'}]}}}

    async def invoke(self, principal, name, arguments, **kwargs):
        self.events.append(name)
        if name == 'knowledge.search':
            return {'ok': True, 'result': {'chunks': [{'id': 'chunk-1', 'document_id': 'doc-1',
                                                     'source_name': 'Crystals manual', 'content': DOCUMENT}]}}
        if self.fail:
            return {'ok': False, 'code': self.fail}
        return {'ok': True, 'result': {'result': 'not_confirmed', 'page': '/work/crystals', 'observation': observed()}}


class Planner:
    def __init__(self, wrong_selection=False, knowledge_only=False):
        self.wrong_selection = wrong_selection
        self.knowledge_only = knowledge_only
        self.calls = []

    async def generic_reader_json(self, *, schema, data, **kwargs):
        kind = schema['properties']['stage']['const']
        self.calls.append(kind)
        if kind == 'query_expansion':
            return expansion_fixture(data)
        k = store()
        if kind == 'task':
            return {'stage': kind, 'businessObject': 'crystals', 'requestedScope': 'personal',
                    'requestedGrain': 'unknown', 'requestedMeasures': ['count'], 'groupBy': ['status'],
                    'timeRange': 'unknown', 'filters': [], 'outputShape': 'overview',
                    'needsLiveData': not self.knowledge_only, 'readOnly': True,
                    'searchQuery': 'My open crystals by status', 'unresolvedSlots': []}
        if kind == 'knowledge_resolution':
            return {'stage': kind, 'route': '' if self.knowledge_only else '/work/crystals', 'pageName': 'Crystals',
                    'routeEvidence': [reference(k)],
                    'answerEvidence': [{**reference(k), 'quote': DOCUMENT}] if self.knowledge_only else [],
                    'missing': [c['requirementId'] for c in data.get('requirementCoverage', [])
                                if c['status'] != 'covered'] if self.knowledge_only else []}
        if kind == 'knowledge_coverage':
            return {'stage': kind, 'checks': [{'requirementId': r['id'], 'status': 'partial',
                'evidence': [reference(k)], 'reason': 'Synthetic manual describes scope; field mapping needs verification.'}
                for r in data['requirements']]}
        if kind == 'knowledge_answer_draft':
            return {'stage': kind, 'blocks': [{'id': 'meaning', 'text': 'The crystal handbook describes the personal queue.',
                'requirementIds': ['object'], 'quoteIndexes': [0]}]}
        if kind == 'knowledge_answer_review':
            return {'stage': kind, 'checks': [{'requirementId': r['id'], 'status': 'partial',
                'quoteIndexes': [0], 'reason': 'The excerpts do not establish complete business meanings.'}
                for r in data['requirements']], 'blockChecks': [{'blockId': b['id'], 'supported': True,
                    'languageMatches': True, 'customerFacing': True, 'reason': 'This explains the cited scope.'}
                    for b in data.get('answerBlocks', [])]}
        if kind == 'source_selection':
            if self.wrong_selection and self.calls.count(kind) == 1:
                return {'stage': 'analysis', 'answer': '8'}
            return {'stage': kind, 'sourceIds': ['page_metrics'], 'rationale': [reference(k)], 'missing': []}
        if kind == 'measure_selection':
            return {'stage': kind, 'population': {'value': 'personal open queue', 'evidence': [reference(k)]},
                    'choices': [{'metricIndex': i, 'role': 'total' if i == 0 else 'breakdown' if i < 3 else 'exclude',
                                 'reason': 'Requested population' if i < 3 else 'Different population'} for i in range(4)],
                    'evidence': [reference(k)]}
        return analysis(k)


class GenericReaderTests(unittest.TestCase):
    def setUp(self):
        self.k = store()
        self.obs = observed()
        self.sources = source_inventory(self.obs, '/work/crystals', 'now', 'person-ref')

    def execute(self, plan=None):
        return execute_analysis(AnalysisPlan.model_validate(plan or analysis(self.k)), self.sources, self.k, self.obs['metrics'])

    def run_reader(self, gateway=None, planner=None):
        g, p = gateway or Gateway(), planner or Planner()
        outcome = asyncio.run(GenericKnowledgeReader(g, p, portal_base_url='https://portal.test',
            knowledge_folder_id='folder').run(Principal('person-1', 'tenant', 'req', umc_token='private-session-secret'),
                                            'How many open crystals do I have? Summarize by status.'))
        return outcome, g, p

    def test_card_scope_is_preserved_but_unverified_population_is_withheld(self):
        outcome, gateway, _ = self.run_reader()
        result = outcome.result.public_json()
        self.assertEqual(result['outputs'], [])
        self.assertEqual(result['withheldOutputCount'], 3)
        self.assertEqual(result['scope'], 'personal')  # Manager cannot overwrite scope.
        self.assertEqual(result['analysisStatus'], 'unconfirmed')  # No proven output population.
        self.assertEqual(gateway.events, ['identity', 'knowledge.search', 'knowledge.search', 'admin.portal.read'])
        self.assertNotIn('deployment_semantics_unverified', result['missing'])
        self.assertIn('requirements_incomplete', result['missing'])

    def test_wrong_stage_retries_in_same_phase(self):
        result, _, planner = self.run_reader(planner=Planner(wrong_selection=True))
        self.assertEqual(planner.calls.count('source_selection'), 2)
        self.assertTrue(result.result.public_json()['recoveryUsed'])

    def test_identity_failure_never_retrieves_or_reads(self):
        result, gateway, _ = self.run_reader(gateway=Gateway(identity='another-user'))
        self.assertEqual(gateway.events, ['identity'])
        self.assertEqual(result.result.public_json()['failureCategory'], 'permission')
        self.assertIsNone(result.result.public_json()['knowledgeGap'])

    def test_knowledge_only_does_not_read_page(self):
        outcome, gateway, _ = self.run_reader(planner=Planner(knowledge_only=True))
        self.assertNotIn('admin.portal.read', gateway.events)
        self.assertEqual(outcome.result.public_json()['analysisStatus'], 'partial')
        self.assertIn('knowledge_answer_incomplete', outcome.result.public_json()['missing'])
        self.assertTrue(outcome.result.public_json()['answerCoverage'])

    def test_permission_and_runtime_errors_are_not_business_knowledge(self):
        for error, category in [('permission_denied', 'permission'), ('tool_unavailable', 'runtime')]:
            outcome, _, _ = self.run_reader(gateway=Gateway(fail=error))
            self.assertEqual(outcome.result.public_json()['failureCategory'], category)
            self.assertIsNone(outcome.result.public_json()['knowledgeGap'])

    def test_missing_field_is_not_zero(self):
        with self.assertRaisesRegex(PipelineError, 'field_missing'):
            pointer({'zero': 0}, '/absent')
        self.assertEqual(pointer({'zero': 0}, '/zero'), 0)

    def test_failed_or_unapproved_responses_are_not_sources(self):
        for key, value in [('policyState', 'blocked'), ('policyState', 'bypassed'), ('status', 403)]:
            data = observed()
            data['apiDiscovery']['candidates'][0][key] = value
            sources = source_inventory(data, '/work/crystals', 'now', 'person')
            self.assertEqual(list(sources), ['page_metrics'])

    def test_source_selection_cannot_invent_api(self):
        selection = SourceSelection(stage='source_selection', sourceIds=['invented'], rationale=[], missing=[])
        with self.assertRaisesRegex(PipelineError, 'source_not_observed'):
            validate_selection(selection, self.sources, self.k)

    def test_truncated_rows_do_not_remove_intact_aggregate(self):
        api = next(v for k, v in self.sources.items() if k.startswith('api_'))
        self.assertTrue(api['truncated'])
        self.assertEqual(pointer(api['data'], '/data/total'), 8)
        with self.assertRaisesRegex(PipelineError, 'field_unavailable'):
            pointer(api['data'], '/data/rows/0')

    def test_unreferenced_card_does_not_require_coverage(self):
        plan = analysis(self.k)
        plan['metricCoverage'].pop(1)
        self.assertEqual(len(self.execute(plan)['outputs']), 3)

    def test_forged_citation_fails(self):
        plan = analysis(self.k)
        plan['steps'][0]['evidence'][0]['sourceId'] = 'invented-passage'
        with self.assertRaisesRegex(PipelineError, 'knowledge_citation_invalid'):
            self.execute(plan)

    def test_unsupported_operator_is_engine_gap(self):
        plan = analysis(self.k)
        plan['steps'][0]['op'] = 'execute_python'
        with self.assertRaises(PipelineError) as context:
            self.execute(plan)
        self.assertEqual(context.exception.category, 'engine_capability_gap')

    def test_arithmetic_cannot_sum_card_categories(self):
        plan = analysis(self.k)
        plan['steps'].append({'id': 'bad', 'op': 'sum', 'inputs': ['m0', 'm1'],
                              'label': 'Invented total', 'evidence': [reference(self.k)]})
        with self.assertRaisesRegex(PipelineError, 'row_input_required'):
            self.execute(plan)

    def test_no_pii_or_credentials_in_gap_and_output(self):
        result, _, _ = self.run_reader()
        text = json.dumps(result.result.public_json()['knowledgeGap'])
        for value in ['private-session-secret', 'person-1', 'Manager', '"value": 8']:
            self.assertNotIn(value, text)
        self.assertEqual(clean({'email': 'a@b.com', 'password': 'secret'}),
                         {'email': '[redacted]', 'password': '[redacted]'})

    def test_draft_packages_are_not_executable_knowledge(self):
        k = KnowledgeStore()
        k.add({'chunks': [{'content': json.dumps({'records': [{'id': 'draft', 'status': 'draft', 'kind': 'read_operation'}]})}]})
        self.assertEqual(k.items, {})
        self.assertEqual(k.rejected, ['draft'])

    def test_unrelated_fragments_are_not_joined(self):
        k = KnowledgeStore()
        k.add({'chunks': [{'id': '1', 'content': '{"route":'}, {'id': '2', 'content': '"/guessed"}'}]})
        self.assertEqual(len(k.items), 2)
        self.assertTrue(all(item['record'] is None for item in k.items.values()))

    def test_result_formatting_explains_withheld_context_without_replaying_cards(self):
        result, _, _ = self.run_reader()
        for language in ['en', 'ar']:
            answer = render_generic_answer(result.result.public_json(), language)
            self.assertNotIn('Amber', answer)
            self.assertNotIn('| 8 |', answer)
            self.assertNotIn('```json', answer)
            self.assertTrue(answer.strip())
        self.assertIn('scope is not verified', render_generic_answer(result.result.public_json()))

    def test_new_status_name_needs_no_keyword_code_change(self):
        self.obs['metrics'][2]['label'] = 'Awaiting spectral calibration'
        self.sources = source_inventory(self.obs, '/work/crystals', 'now', 'person-ref')
        plan = analysis(self.k)
        plan['steps'][2]['label'] = 'Awaiting spectral calibration'
        self.assertEqual(self.execute(plan)['outputs'][2]['label'], 'Awaiting spectral calibration')

    def test_partial_collection_cannot_be_counted_as_total(self):
        plan = analysis(self.k)
        self.sources['rows'] = {'data': {'page': {'items': [{'kind': 'A'}], 'total': 17}},
            'completeness': 'bounded', 'capturedAt': 'now', 'principalScopeRef': 'person-ref', 'operationRef': 'read'}
        plan['steps'] += [{'id': 'rows', 'op': 'read_rows', 'sourceId': 'rows', 'path': '/page/items',
                          'fields': ['kind'], 'totalPath': '/page/total', 'label': 'Rows', 'expose': False,
                          'evidence': [reference(self.k)]},
                         {'id': 'count', 'op': 'count', 'inputs': ['rows'], 'label': 'Count', 'evidence': [reference(self.k)]}]
        with self.assertRaisesRegex(PipelineError, 'full_collection_required'):
            self.execute(plan)

    def test_complete_rows_support_generic_dedupe_group_and_count(self):
        plan = analysis(self.k)
        self.sources['rows'] = {'data': {'page': {'items': [{'id': 1, 'kind': 'A'}, {'id': 1, 'kind': 'A'},
            {'id': 2, 'kind': 'B'}], 'total': 3}}, 'completeness': 'bounded', 'capturedAt': 'now',
            'principalScopeRef': 'person-ref', 'operationRef': 'read'}
        steps = [dict(id='rows', op='read_rows', sourceId='rows', path='/page/items',
                      fields=['id', 'kind'], totalPath='/page/total', expose=False),
                 dict(id='unique', op='distinct', inputs=['rows'], fields=['id'], expose=False),
                 dict(id='count', op='count', inputs=['unique']),
                 dict(id='groups', op='group_count', inputs=['unique'], field='kind')]
        plan['steps'] += [{**s, 'label': s['id'], 'evidence': [reference(self.k)]} for s in steps]
        result = self.execute(plan)
        self.assertEqual(result['outputs'][-2]['value'], 2)
        self.assertEqual(result['outputs'][-1]['value'], [{'kind': 'A', 'count': 1}, {'kind': 'B', 'count': 1}])

    def test_same_number_does_not_prove_full_collection_if_response_truncated(self):
        plan = analysis(self.k)
        self.sources['rows'] = {'data': {'items': [{'a': 1}], 'total': 1}, 'truncated': True}
        plan['steps'].append({'id': 'rows', 'op': 'read_rows', 'sourceId': 'rows', 'path': '/items',
            'fields': ['a'], 'totalPath': '/total', 'label': 'Rows', 'evidence': [reference(self.k)]})
        with self.assertRaisesRegex(PipelineError, 'full_collection_required'):
            self.execute(plan)

    def test_readonly_actions_bind_to_actual_unique_controls(self):
        permission = UserPermissionContext(roles=('Manager',), pages=('/work/crystals',))
        selection = SourceSelection.model_validate({'stage': 'source_selection', 'sourceIds': [],
            'rationale': [], 'missing': [], 'nextActions': [{'type': 'switch_tab', 'name': 'Archived',
                                                          'role': 'tab', 'evidence': [reference(self.k)]}]})
        obs = {'tabControls': [{'name': 'Archived', 'selected': False}]}
        actions = bind_read_actions(selection, obs, self.k, ReadOnlyPortalPolicy('https://portal.test'), permission, '/work/crystals')
        self.assertEqual(actions[0], {'type': 'switch_tab', 'name': 'Archived', 'role': 'tab'})
        with self.assertRaises(PipelineError):
            bind_read_actions(selection, {}, self.k, ReadOnlyPortalPolicy('https://portal.test'), permission, '/work/crystals')

    def test_source_selection_does_not_mix_read_action_and_data_source(self):
        selection = SourceSelection.model_validate({'stage': 'source_selection', 'sourceIds': ['page_metrics'],
            'rationale': [], 'missing': [], 'nextActions': [{'type': 'switch_tab', 'name': 'Archived',
                                                          'evidence': [reference(self.k)]}]})
        with self.assertRaisesRegex(PipelineError, 'select_sources_or_read_next'):
            validate_selection(selection, self.sources, self.k)

    def test_dependency_timeout_preserves_failure_category(self):
        class SlowGateway(Gateway):
            async def get_user_info(self, principal):
                await asyncio.sleep(0.05)
        outcome = asyncio.run(GenericKnowledgeReader(SlowGateway(), Planner(), portal_base_url='https://portal.test',
            timeout_budget=ReaderTimeoutBudget(total_seconds=1.01, get_user_info_seconds=0.001)).run(
                Principal('person-1', 'tenant', 'req'), 'Show my open crystals.'))
        self.assertEqual(outcome.result.public_json()['failureCategory'], 'runtime')
        self.assertIsNone(outcome.result.public_json()['knowledgeGap'])

    def test_citations_can_select_exact_passage_without_copying_text(self):
        passage = self.k.prompt()[0]['passages'][0]
        ref = Citation(sourceId=passage['sourceId'])
        self.assertEqual(self.k.citation_text(ref), DOCUMENT)
        self.assertEqual(len(self.k.cite([ref], required=True)), 1)

    def test_old_answers_are_not_reused_as_current_facts(self):
        result = semantic_history({'previousIntent': {'question': 'Show open crystals.',
            'businessObject': 'crystals', 'priorAnswerFacts': ['91 old items']},
            'priorAnswer': {'facts': ['91 old items']}})
        self.assertEqual(result, {'previousIntent': {'question': 'Show open crystals.', 'businessObject': 'crystals'}})

    def test_conflicting_active_knowledge_is_not_silently_merged(self):
        k = KnowledgeStore()
        record = {'id': 'field.crystals', 'revision': 1, 'status': 'active', 'kind': 'field_semantics',
                  'sources': [{'reference': 'manual'}], 'payload': {},
                  'applicability': {'portal': 'admin', 'environments': ['local']}}
        k.add({'chunks': [{'content': json.dumps({'records': [record]})}]})
        self.assertEqual(len(k.items), 1)
        conflicting = {**record, 'payload': {'grain': 'incompatible'}}
        k.add({'chunks': [{'content': json.dumps({'records': [conflicting]})}]})
        self.assertFalse(k.items)
        self.assertIn('field.crystals', k.conflicted)

    def test_other_environment_and_known_build_mismatch_are_rejected(self):
        for app in [{'portal': 'customer', 'environments': ['local']},
                    {'portal': 'admin', 'environments': ['remote']},
                    {'portal': 'admin', 'environments': ['local'], 'deployedBuildMatch': 'mismatched'}]:
            k = KnowledgeStore()
            record = {'id': 'test', 'revision': 1, 'status': 'active', 'kind': 'read_operation',
                      'sources': [{'reference': 'manual'}], 'applicability': app}
            k.add({'chunks': [{'content': json.dumps({'records': [record]})}]})
            self.assertFalse(k.items)

    def test_uncited_grain_stays_unknown_without_erasing_observed_values(self):
        plan = analysis(self.k)
        plan['context']['grain'] = {'value': 'invented unique crystals', 'evidence': []}
        result = self.execute(plan)
        self.assertEqual(result['context']['grain']['value'], 'unknown')
        self.assertEqual([o['value'] for o in result['outputs']], [8, 8, 0])
        self.assertIn('field_semantics_missing', result['missing'])

    def test_legacy_measure_selection_no_longer_whitelists_outputs(self):
        measures = MeasureSelection.model_validate({'stage': 'measure_selection',
            'population': {'value': 'open crystals', 'evidence': [reference(self.k)]},
            'evidence': [reference(self.k)], 'choices': [
                {'metricIndex': i, 'role': 'requested' if i < 3 else 'exclude', 'reason': 'Task population'} for i in range(4)]})
        plan = analysis(self.k)
        plan['steps'].append({'id': 'unrequested', 'op': 'read_aggregate', 'sourceId': 'page_metrics',
                             'path': '/3/value', 'label': 'Completed', 'evidence': [reference(self.k)]})
        result = execute_analysis(AnalysisPlan.model_validate(plan), self.sources, self.k, self.obs['metrics'], measures)
        self.assertEqual(result['outputs'][-1]['value'], 3)

    def test_optional_uncited_caveat_is_suppressed_and_audited(self):
        plan = analysis(self.k)
        plan['context']['caveats'].append({'value': 'Unsupported aside', 'evidence': []})
        result = self.execute(plan)
        self.assertNotIn('Unsupported aside', str(result['context']))
        self.assertEqual(result['suppressedClaims'], [{'kind': 'optional_caveat', 'reason': 'citation_missing'}])

    def test_limited_sort_does_not_keep_full_collection_receipt(self):
        plan = analysis(self.k)
        self.sources['rows'] = {'data': {'items': [{'rank': 2}, {'rank': 1}], 'total': 2},
            'completeness': 'bounded', 'capturedAt': 'now', 'principalScopeRef': 'person-ref', 'operationRef': 'read'}
        steps = [dict(id='rows', op='read_rows', sourceId='rows', path='/items', fields=['rank'], totalPath='/total', expose=False),
                 dict(id='first', op='sort', inputs=['rows'], field='rank', limit=1, expose=False),
                 dict(id='badcount', op='count', inputs=['first'])]
        plan['steps'] += [{**s, 'label': s['id'], 'evidence': [reference(self.k)]} for s in steps]
        with self.assertRaisesRegex(PipelineError, 'full_collection_required'):
            self.execute(plan)

    def test_blocked_page_dependency_cannot_publish_initial_zero_metrics(self):
        self.obs['readHealth'] = {'blocked': ['/api/crystals/query'], 'failed': [], 'pending': []}
        self.obs['metrics'] = [{'label': m['label'], 'value': '0'} for m in self.obs['metrics']]
        self.sources = source_inventory(self.obs, '/work/crystals', 'now', 'person-ref')
        with self.assertRaises(PipelineError) as failure:
            self.execute()
        self.assertEqual(failure.exception.code, 'reader_policy_blocked')
        self.assertEqual(failure.exception.category, 'execution_configuration')

    def test_uncertain_dependency_blocks_dom_but_keeps_independent_api(self):
        self.obs['readHealth'] = {'blocked': [], 'failed': [], 'pending': [], 'uncertain': ['/api/optional/options']}
        self.sources = source_inventory(self.obs, '/work/crystals', 'now', 'person-ref')
        with self.assertRaisesRegex(PipelineError, 'page_data_not_ready'):
            self.execute()
        self.assertTrue(any(source['kind'] == 'api_response' and source.get('ready') is not False for source in self.sources.values()))

    def test_json_pointer_rejects_negative_array_index(self):
        with self.assertRaisesRegex(PipelineError, 'field_missing'):
            pointer([{'value': 5}], '/-1/value')


if __name__ == '__main__':
    unittest.main()
