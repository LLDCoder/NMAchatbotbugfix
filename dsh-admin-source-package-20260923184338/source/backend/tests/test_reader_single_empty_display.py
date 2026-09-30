"""Actual saved v39 EN; deterministic AR/controlled cases are offline, not QA."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericResult, clean, render_generic_answer
from app.reader_previous_answer import completed_previous_result, project_previous_answer, render_previous_answer
from app.reader_previous_display import SINGLE_SCHEMA, SINGLE_TRANSPORT, _hash, _restore_single_display
from app.reader_empty_display_proof import _flatten, _restore
from app.reader_public_rewrite import _structured_parse, SOURCE_KEY
from app.service import DSHService

RAW = json.loads(Path(__file__).with_name('fixtures').joinpath('c08_single_detail_v39.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'routes': [PAGE], 'businessNavigation': RAW['followResult']['previousAnswer']['navigation']}]


def envelope(prior=None, answer=None, bad_owner=False):
    prior = deepcopy(RAW['priorResult']) if prior is None else prior
    def event(kind, data, owner='controlled-owner'):
        return SimpleNamespace(event_type=kind, event_json=data, conversation_id=RAW['conversationId'],
                               tenant_id='controlled-tenant', user_id=owner)
    rid = prior['requestId']
    latest = event('user.message', {'requestId': RAW['followResult']['requestId']}, 'other' if bad_owner else 'controlled-owner')
    events = [event('user.message', {'requestId': rid}), event('reader.result', prior),
              event('assistant.message', {'requestId': rid, 'content': RAW['priorAnswer'] if answer is None else answer}),
              event('turn.completed', {'requestId': rid}), latest]
    return completed_previous_result(events, latest)


def project(prior=None, answer=None, kind='simplify_navigation', **changes):
    env = envelope(prior, answer)
    state = (prior if prior is not None else RAW['priorResult'])['intentState']
    args = {'fingerprint': state['principalFingerprint'], 'catalog_version': state['catalogVersion'],
            'catalog': deepcopy(CATALOG), 'authorized': lambda route: True}
    args.update(changes)
    return project_previous_answer(env, kind, **args)


def test_actual_old_body_is_reproduced_and_fixture_remains_failed_simplification():
    assert render_generic_answer(RAW['priorResult'], 'en') == RAW['priorAnswer']
    assert render_previous_answer(RAW['followResult']['previousAnswer'], 'en') == RAW['followAnswer']
    assert 'queue.; The To Do' in RAW['followAnswer']
    assert len(RAW['priorResult']['outputs']) == 1
    assert 'derivation' not in RAW['priorResult']['outputs'][0]['evidence'][0]


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_single_public_blocks_labels_and_only_real_time_survive_transport(language):
    before = deepcopy(RAW)
    value = project()
    assert value['publicDisplayProof']['schemaVersion'] == SINGLE_TRANSPORT
    payload = _restore(value['publicDisplayProof']['sourceNodes'])
    assert payload['display']['schemaVersion'] == SINGLE_SCHEMA
    assert payload['source']['requirements'] == RAW['priorResult']['requirements']
    assert value['outputs'] == payload['projection']['outputs'] == RAW['priorResult']['outputs']
    original = '\n'.join(payload['display']['sourceAnswerLines'])
    assert original == RAW['priorAnswer']
    for block in payload['display']['publicBlocks'] + payload['display']['outputBlocks']:
        quote = block.get('quote', '\n'.join(block.get('quoteLines', [])))
        span = block['sourceSpan']; assert original[span['start']:span['end']] == quote
    text = render_previous_answer(value, language)
    assert text.count('no matching rows.' if language == 'en' else 'لم توجد صفوف مطابقة.') == 1
    assert text.count(value['outputs'][0]['label']) == 1
    assert text.count(value['observedAt'][0]) == 1
    assert '[Applications](/licensing/applications)' in text
    assert 'Calculation reference time' not in text and 'الوقت المرجعي للحساب' not in text
    assert 'observation' not in text and 'queue.;' not in text
    assert 'Unit:' not in text and 'Filter scope:' not in text
    assert 'Scope: personal.' in text
    if language == 'en':
        assert 'The personal My Application Tasks operation supplies the complete To Do queue of pending work.' in text
        assert 'It includes pending modification, external approval and pending review.' in text
        assert 'This queue shows work routed to your account. It does not cover all work in the Licensing department.' in text
        assert 'A Manager role does not make it a team queue.' in text
        assert 'The To Do summary card is a separate count source. It does not prove that the list is complete.' in text
    for _ in range(3):
        value = json.loads(json.dumps(DSHService.audit_payload(GenericResult(clean({'previousAnswer': value}, max_items=200)).public_json())))['previousAnswer']
        assert render_generic_answer({'previousAnswer': value}, language) == text
    assert RAW == before


@pytest.mark.parametrize('mutation', ['principal', 'catalog', 'route', 'history_owner', 'source_principal', 'source_time'])
def test_existing_authority_guards_still_precede_display(mutation):
    if mutation == 'history_owner':
        assert envelope(bad_owner=True) == {}; return
    prior = deepcopy(RAW['priorResult'])
    changes = {}
    if mutation == 'principal': changes['fingerprint'] = 'other'
    elif mutation == 'catalog': changes['catalog_version'] = 'other'
    elif mutation == 'route': changes['authorized'] = lambda route: False
    elif mutation == 'source_principal': prior['outputs'][0]['evidence'][0]['principalScopeRef'] = 'other'
    elif mutation == 'source_time': prior['outputs'][0]['evidence'][0]['capturedAt'] = 'not a time'
    value = project(prior, **changes)
    assert value['verified'] is False and 'publicDisplayProof' not in value


@pytest.mark.parametrize('fault', [
    'observation_role', 'no_id', 'no_label', 'nonempty', 'scalar', 'display_rows', 'bounded', 'unknown',
    'unavailable', 'absences', 'interpretations', 'snapshot_dates', 'snapshot_scope', 'group_domain',
    'no_requirements', 'two_evidence', 'no_evidence', 'derivation_empty', 'derivation_full', 'bounded_ref',
    'population_unknown', 'unknown_rows', 'unavailable_reason', 'time_interval', 'no_proof', 'wrong_covers',
    'two_sources', 'total_nonzero', 'total_bool', 'total_string', 'stable_one', 'stable_bool', 'stable_string',
    'source_mismatch', 'operation_mismatch', 'observation_mismatch', 'path_mismatch', 'no_context', 'bad_receipt',
    'extra_output', 'partial_result', 'explicit_time',
])
def test_single_empty_values_without_full_plain_witness_use_unchanged_fallback(fault):
    prior = deepcopy(RAW['priorResult']); output = prior['outputs'][0]
    ref = output['evidence'][0]; source = output['emptyListProof']['sources'][0]
    if fault == 'observation_role': output['role'] = 'observation'
    elif fault == 'no_id': output['id'] = ''
    elif fault == 'no_label': output['label'] = ''
    elif fault == 'nonempty': output['value'] = [{'id': 'A1'}]
    elif fault == 'scalar': output['value'] = 0
    elif fault == 'display_rows': output['displayRows'] = [{'id': 'A1'}]
    elif fault == 'bounded': output['dataCompleteness'] = 'bounded'
    elif fault == 'unknown': output['unknownCount'] = 1
    elif fault == 'unavailable': output['unavailableFields'] = ['status']
    elif fault == 'absences': output['verifiedAbsences'] = ['other']
    elif fault == 'interpretations': output['verifiedInterpretations'] = [{'message':'qualified'}]
    elif fault == 'snapshot_dates': output['snapshotResponseDates'] = [{'date':'2026-01-01'}]
    elif fault == 'snapshot_scope': output['snapshotScopeProof'] = {'scope':'personal'}
    elif fault == 'group_domain': output['groupDomainProof'] = {'all':True}
    elif fault == 'no_requirements': output['requirementIds'] = []
    elif fault == 'two_evidence': output['evidence'].append(deepcopy(ref))
    elif fault == 'no_evidence': output['evidence'] = []
    elif fault == 'derivation_empty': ref['derivation'] = {}
    elif fault == 'derivation_full': ref['derivation'] = {'kind':'fixed_reference_computation','referenceUtc':'2026-01-01T00:00:00Z'}
    elif fault == 'bounded_ref': ref['completeness'] = 'bounded'
    elif fault == 'population_unknown': ref['populationComplete'] = False
    elif fault == 'unknown_rows': ref['unknownRows'] = 1
    elif fault == 'unavailable_reason': ref['unavailableReason'] = 'unknown'
    elif fault == 'time_interval': ref['timeInterval'] = {'start':'2026-01-01', 'end':'2026-02-01', 'businessTimezone':'UTC'}
    elif fault == 'no_proof': output.pop('emptyListProof')
    elif fault == 'wrong_covers': output['emptyListProof']['covers'] = 'any'
    elif fault == 'two_sources': output['emptyListProof']['sources'].append(deepcopy(source))
    elif fault.startswith('total_'): source['total'] = {'total_nonzero':1,'total_bool':False,'total_string':'0'}[fault]
    elif fault.startswith('stable_'): source['stablePasses'] = {'stable_one':1,'stable_bool':True,'stable_string':'2'}[fault]
    elif fault == 'source_mismatch': source['sourceId'] = 'other'
    elif fault == 'operation_mismatch': source['operationRef'] = 'GET /Other'
    elif fault == 'observation_mismatch': source['observationRef'] = 'other'
    elif fault == 'path_mismatch': source['sourcePath'] = '/other'
    elif fault == 'no_context': source.pop('contextRef')
    elif fault == 'bad_receipt': source['receiptHash'] = 'unknown'
    elif fault == 'extra_output': prior['outputs'].append(deepcopy(output))
    elif fault == 'partial_result': prior['completeness'] = 'partial'; prior['analysisStatus'] = 'partial'
    elif fault == 'explicit_time': prior['context']['time']['value'] = '2026-01-01 through 2026-01-31'
    value = project(prior, render_generic_answer(prior, 'en'))
    assert 'publicDisplayProof' not in value


def test_unsupported_internal_context_does_not_become_new_public_content():
    # This untyped key is not emitted by the context contract or original
    # renderer. The consumer must not turn it into a new public assertion.
    prior = deepcopy(RAW['priorResult'])
    prior['context']['uninterpreted'] = {'value': 'only today'}
    original = render_generic_answer(prior, 'en')
    assert original == RAW['priorAnswer']
    value = project(prior, original)
    assert 'uninterpreted' not in value['context']
    assert 'only today' not in render_previous_answer(value, 'en')


@pytest.mark.parametrize('alteration', ['drop_caveat', 'add_caveat', 'change_scope', 'change_zero', 'different_header', 'no_body'])
def test_whole_original_body_is_required(alteration):
    original = RAW['priorAnswer']
    if alteration == 'drop_caveat': original = original[:original.index('The To Do summary card')]
    elif alteration == 'add_caveat': original += '\nNo limitations apply.'
    elif alteration == 'change_scope': original = original.replace('personal', 'global')
    elif alteration == 'change_zero': original = original.replace('No matching rows.', 'Ten matching rows.')
    elif alteration == 'different_header': original = 'Updated results:\n' + original
    elif alteration == 'no_body': original = ''
    assert 'publicDisplayProof' not in project(answer=original)


@pytest.mark.parametrize('field', ['owner','request','capture','navigation','context','label','receipt','hash','node','duplicate_node','wrong_schema'])
def test_public_transport_cannot_be_consumed_after_current_projection_or_proof_changes(field):
    value = project()
    if field == 'owner': value['principalScopeRef'] = 'other'
    elif field == 'request': value['sourceRequestId'] = 'other'
    elif field == 'capture': value['observedAt'] = ['2020-01-01T00:00:00Z']
    elif field == 'navigation': value['navigation'][0]['route'] = '/other'
    elif field == 'context': value['context']['scope'] = 'global'
    elif field == 'label': value['outputs'][0]['label'] = 'All records'
    elif field == 'receipt': value['outputs'][0]['emptyListProof']['sources'][0]['receiptHash'] = 'a' * 64
    elif field == 'hash': value['publicDisplayProof']['contentHash'] = 'a' * 64
    elif field == 'node': value['publicDisplayProof']['sourceNodes'][0][0][0] = '/wrong'
    elif field == 'duplicate_node': value['publicDisplayProof']['sourceNodes'][0].append(deepcopy(value['publicDisplayProof']['sourceNodes'][0][0]))
    elif field == 'wrong_schema': value['publicDisplayProof']['schemaVersion'] = 'previous-public-derived-empty/1'
    assert 'cannot verify' in render_previous_answer(value, 'en')


@pytest.mark.parametrize('field', ['block','span','body','schema','empty_ids','claim'])
def test_resigning_transport_hash_cannot_approve_arbitrary_public_text(field):
    value = project(); proof = value['publicDisplayProof']; packet = _restore(proof['sourceNodes'])
    display = packet['display']
    if field == 'block': display['publicBlocks'][-1]['quote'] = 'No limitations apply.'
    elif field == 'span': display['publicBlocks'][-1]['sourceSpan']['end'] += 1
    elif field == 'body': display['sourceAnswerLines'][-1] = 'No limitations apply.'
    elif field == 'schema': display['schemaVersion'] = 'previous-public-empty-display/2'
    elif field == 'empty_ids': display['combinedEmptyOutputIds'].append('fabricated_observation')
    elif field == 'claim': display['claim'] = 'proved current data'
    proof['sourceNodes'] = _flatten(packet); proof['contentHash'] = _hash(packet)
    assert 'cannot verify' in render_previous_answer(value, 'en')


@pytest.mark.parametrize('field', ['rule', 'parameters', 'atoms', 'members', 'sourceClaim', 'sourceSpan'])
def test_rewrite_plan_is_reparsed_not_trusted_even_if_source_hash_is_resigned(field):
    value = _restore_single_display(project()); proof = value['publicDisplayProof']
    entry = next(x for x in proof['rewritePlan']['entries'] if x.get('rule') == 'named_operation_population')
    if field == 'rule': entry['rule'] = 'role_does_not_expand_scope'
    elif field == 'parameters': entry['parameters']['sourceKind'] = 'view'
    elif field == 'atoms': entry['atoms'].pop()
    elif field == 'members': entry['members']['parameters'].append('pending renewal')
    elif field == 'sourceClaim': entry['sourceClaim']['value'] = 'All records'
    elif field == 'sourceSpan': entry['sourceSpan']['start'] += 1
    proof['sourceBindingHash'] = _hash(value[SOURCE_KEY])
    assert 'cannot verify' in render_previous_answer(value, 'en')


def _claim(prior, key):
    return prior['context']['population'] if key == 'population' else prior['context']['caveats'][int(key)]


@pytest.mark.parametrize('key', ['population','0','1'])
@pytest.mark.parametrize('tail', [' Only today.', ' Except external approvals.', ' If the role is active.',
                                 ' This includes other departments.', ' After 2026-01-01.', ' unless excluded.'])
def test_unknown_tail_is_preserved_as_whole_original_clause(key, tail):
    prior = deepcopy(RAW['priorResult']); claim = _claim(prior,key); claim['value'] += tail
    value = project(prior, render_generic_answer(prior,'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SINGLE_TRANSPORT
    assert claim['value'] in render_previous_answer(value,'en')


@pytest.mark.parametrize('mutation', ['negative_population','only_members','fourth_member','team_source','different_view',
    'different_subject','wrong_noun','positive_role','missing_role','different_card_view','positive_completeness'])
def test_unknown_operators_subjects_and_coverage_remain_literal(mutation):
    prior = deepcopy(RAW['priorResult'])
    key = 'population' if mutation in {'negative_population','only_members','fourth_member','team_source','different_view'} else '1' if mutation in {'different_card_view','positive_completeness'} else '0'
    claim = _claim(prior,key); text = claim['value']
    if mutation == 'negative_population': text = text.replace('Complete','Incomplete')
    elif mutation == 'only_members': text = text.replace('including','including only')
    elif mutation == 'fourth_member': text = text.rstrip('.') + ' and pending renewal.'
    elif mutation == 'team_source': text = text.replace('personal','team')
    elif mutation == 'different_view': text = text.replace('To Do','Other View')
    elif mutation == 'different_subject': text = text.replace('authenticated account', 'another account')
    elif mutation == 'wrong_noun': text = text.replace('not all work', 'not all records')
    elif mutation == 'positive_role': text = text.replace('does not turn','does turn')
    elif mutation == 'missing_role': text = text.split(';')[0] + '.'
    elif mutation == 'different_card_view': text = text.replace('To Do','Other View')
    elif mutation == 'positive_completeness': text = text.replace('does not prove','does prove')
    claim['value'] = text
    value = project(prior, render_generic_answer(prior,'en'))
    assert text in render_previous_answer(value,'en')


@pytest.mark.parametrize('view,source,department,role,records,target', [
    ('Review List','My Case Tasks','Compliance','Supervisor','records','global'),
    ('Open Tasks','Assigned Work','Registration','Auditor','tasks','team')])
def test_whole_grammar_is_not_fixed_to_original_business_names(view,source,department,role,records,target):
    prior = deepcopy(RAW['priorResult'])
    for r in prior['requirements']:
        if r['kind'] == 'view': r['value'] = view
        if r['kind'] in {'object','grain'}: r['value'] = 'case'
    prior['outputs'][0]['label'] = 'Visible cases'
    prior['context']['population']['value'] = f'Complete {view} pending-work queue from the personal {source} operation, including pending verification and internal review as well as external inspection.'
    prior['context']['caveats'][0]['value'] = f'This queue shows {records} routed to your account, not all {records} in the {department} department; a {role} role does not turn it into a {target} queue.'
    prior['context']['caveats'][1]['value'] = f'The {view} summary card is a separate count source and does not prove list completeness.'
    value = project(prior,render_generic_answer(prior,'en'));text = render_previous_answer(value,'en')
    assert f'The personal {source} operation supplies the complete {view} queue of pending work.' in text
    assert f'It does not cover all {records} in the {department} department.' in text
    assert f'A {role} role does not make it a {target} queue.' in text
    assert 'pending verification, internal review and external inspection' in text
    assert 'Visible cases' in text and 'Licensing' not in text and 'Manager' not in text


@pytest.mark.parametrize('fault', ['no_scope_evidence','no_claim_evidence','source_request','source_context','extra_requirement','wrong_scope','wrong_object'])
def test_incomplete_typed_source_keeps_original_public_words_without_new_semantics(fault):
    value = project(); packet = _restore(value['publicDisplayProof']['sourceNodes']); source = packet['source']
    if fault == 'no_scope_evidence': source['context']['scopeEvidence'] = []
    elif fault == 'no_claim_evidence': source['context']['population']['evidence'] = []
    elif fault == 'source_request': source['sourceRequestId'] = 'other'
    elif fault == 'source_context': source['context']['scope'] = 'team'
    elif fault == 'extra_requirement': source['requirements'].append({'id':'filter0','kind':'filter','value':'only today'})
    elif fault == 'wrong_scope': next(r for r in source['requirements'] if r['kind']=='scope')['value'] = 'team'
    elif fault == 'wrong_object': next(r for r in source['requirements'] if r['kind']=='object')['value'] = 'other'
    value['publicDisplayProof']['sourceNodes'] = _flatten(packet); value['publicDisplayProof']['contentHash'] = _hash(packet)
    text = render_previous_answer(value,'en')
    assert RAW['priorResult']['context']['population']['value'] in text
    assert 'operation supplies' not in text


@pytest.mark.parametrize('fault', ['secret_key','secret_value','too_many_nodes','too_deep','whitespace'])
def test_flat_transport_does_not_bypass_redaction_or_truncation(fault):
    prior = deepcopy(RAW['priorResult'])
    if fault == 'secret_key': prior['outputs'][0]['evidence'][0]['apiKey'] = 'CONTROLLED-SECRET'
    elif fault == 'secret_value': prior['context']['caveats'][0]['value'] += ' password=CONTROLLED-SECRET'
    elif fault == 'too_many_nodes': prior['context']['caveats'] += [{'value':f'Limit {i} remains.', 'evidence':[]} for i in range(1000)]
    elif fault == 'too_deep':
        nested = {}
        for _ in range(20): nested = {'nested':nested}
        prior['outputs'][0]['evidence'][0]['extra'] = nested
    elif fault == 'whitespace': prior['context']['caveats'][0]['value'] += '  trailing  words'
    value = project(prior,render_generic_answer(prior,'en'))
    assert 'publicDisplayProof' not in value


@pytest.mark.parametrize('kind', ['query_scope','navigation'])
def test_other_presentation_kinds_do_not_enter_single_display(kind):
    value = project(kind=kind)
    assert 'publicDisplayProof' not in value


@pytest.mark.parametrize('language', ['en','ar'])
def test_controlled_full_pipeline_keeps_task_and_read_budget(tmp_path,language):
    import asyncio
    from app.generic_reader import GenericKnowledgeReader,digest
    from app.principal import Principal
    from app.portal_reader import permission_audit_summary,permission_context_from_user_info
    from test_generic_reader_v3 import Gateway
    from test_reader_previous_answer import presentation_task,SIMPLE
    from test_reader_session_scope import source
    data = json.dumps([{'name':'Applications','routes':[{'path':PAGE,'title':'Applications','isMenu':True}]}]).encode()
    (tmp_path/'page-catalog.json').write_bytes(data)
    auth = source(listSysPermission=[{'frontendRoute':PAGE}])
    fingerprint = digest(['self-1','tenant',permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']])
    prior = deepcopy(RAW['priorResult']);prior['intentState']['principalFingerprint']=fingerprint
    prior['intentState']['catalogVersion']=hashlib.sha256(data).hexdigest()
    prior['outputs'][0]['evidence'][0]['principalScopeRef']=fingerprint
    env={'schemaVersion':'completed-prior-answer/1','requestId':prior['requestId'],'result':prior,'originalAnswer':RAW['priorAnswer']}
    question=SIMPLE if language=='en' else 'يرجى شرح تلك الإجابة بكلمات أبسط وإعطائي مسار التنقل إلى الصفحة.'
    calls=[]
    class Planner:
        async def generic_reader_json(self, *,schema,data,**kwargs):
            stage=schema['properties']['stage']['const'];calls.append(stage)
            if stage=='input_normalization':return {'stage':stage,'clauses':[{'sourceQuote':question,'english':SIMPLE}]}
            assert stage=='task';return presentation_task().model_dump()
    class Auth(Gateway):
        auth_calls=0
        async def get_user_info(self,principal):self.auth_calls+=1;return {'ok':True,'result':auth}
        async def admin_portal_read(self,*args,**kwargs):raise AssertionError('No fresh business data')
    class Reader(GenericKnowledgeReader):
        async def search(self,*args,**kwargs):raise AssertionError('No knowledge lookup')
    gateway=Auth();reader=Reader(gateway,Planner(),portal_base_url='https://portal.test',artifacts_dir=str(tmp_path))
    result=asyncio.run(reader.run(Principal('self-1','tenant','new-request'),question,
        conversation_context={'completedPreviousAnswer':env,'responseLanguage':language})).result.public_json()
    assert result['result']=='success',result.get('missing')
    assert result['previousAnswer']['publicDisplayProof']['schemaVersion']==SINGLE_TRANSPORT
    assert result['previousAnswer']['outputs']==prior['outputs']
    assert calls==(['task'] if language=='en' else ['input_normalization','task'])
    assert gateway.auth_calls==1
    text=render_generic_answer(json.loads(json.dumps(DSHService.audit_payload(result))),language)
    assert ('It does not cover all work' if language=='en' else 'وهي لا تشمل كل work') in text
