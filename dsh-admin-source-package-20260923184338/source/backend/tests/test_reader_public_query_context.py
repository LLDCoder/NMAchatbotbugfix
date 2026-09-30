"""Saved real C05 evidence and offline controls; no new model/portal calls."""
import ast
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import clean, render_generic_answer, GenericResult
from app.reader_previous_answer import project_previous_answer, render_previous_answer
from app.reader_public_query_context import (seal_public_context, project_public_context,
    checked_scope_context, _hash, _published_result_matches)

F = json.loads(Path(__file__).with_name('fixtures').joinpath('c05_public_query_scope_v38.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'routes': [PAGE], 'businessNavigation': [{'route': PAGE, 'label': 'Applications'}]}]


def envelope():
    prior = F['en']['prerequisite']
    result = deepcopy(prior['result'])
    return {'schemaVersion': 'completed-prior-answer/1', 'requestId': result['requestId'],
            'result': result, 'originalAnswer': prior['answer']}


def project(env=None, **changes):
    env = env or envelope()
    state = env['result']['intentState']
    kwargs = dict(fingerprint=state['principalFingerprint'], catalog_version=state['catalogVersion'],
                  catalog=CATALOG, authorized=lambda _: True)
    kwargs.update(changes)
    return project_previous_answer(env, 'query_scope', **kwargs)


def rewritten_envelope(**updates):
    env = envelope()
    for key, text in updates.items():
        if key == 'caveats':
            env['result']['context'][key] = [{'value': t, 'evidence': [{'sourceId': 'fixture:whole'}]} for t in text]
        else:
            env['result']['context'][key]['value'] = text
    env['originalAnswer'] = render_generic_answer(env['result'], 'en')
    return env


def resign(proof):
    proof['contentHash'] = _hash({k: v for k, v in proof.items() if k != 'contentHash'})


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_en_has_no_hidden_physical_keys_but_keeps_all_public_limits_scope_and_time(language):
    env = envelope(); before = deepcopy(env)
    p = project(env)
    assert p['verified'] and p['publicQueryContext']['status'] == 'partial'
    assert p['publicQueryContext']['missing'] == ['grain', 'population', 'filterScope']
    text = render_previous_answer(p, language)
    assert not any(raw in text for raw in ('dispositionCaseId', 'taskId', 'key id', 'runtime approval department', 'request context'))
    assert 'personal' in text
    for claim in env['result']['context']['caveats']:
        assert claim['value'] in text
    for time in p['observedAt']:
        assert time in text
    assert '[Applications](/licensing/applications)' in text
    assert ('I could not provide a complete explanation of:' if language == 'en' else
            'لم أتمكن من تقديم شرح كامل') in text
    assert 'what each record represents' in text if language == 'en' else 'ما يمثله كل سجل' in text
    assert env == before
    assert env['result']['result'] == 'success' and env['result']['missing'] == []
    assert p['liveDataRead'] is False and p['rowScopeVerified'] is False


def test_saved_current_identity_stays_distinct_from_historical_scope():
    p = project()
    p['currentIdentity'] = deepcopy(F['en']['followup']['previousAnswer']['currentIdentity'])
    text = render_previous_answer(p, 'en')
    for label in ('License Staff ff', 'Media Licensing Department', 'Licensing Officer'):
        assert label in text
    assert 'personal' in text and p['rowScopeVerified'] is False
    assert p['publicQueryContext']['status'] == 'partial'


def test_whole_original_answer_required_no_substring_authorization():
    env = envelope()
    assert _published_result_matches(env['result'], env['originalAnswer'])
    for answer in [None, '', 'prefix ' + env['originalAnswer'], env['originalAnswer'] + '\nAdditional exclusion.',
                   env['result']['context']['caveats'][0]['value']]:
        altered = deepcopy(env); altered['originalAnswer'] = answer
        p = project(altered)
        assert p['verified']  # Existing historical proof is not erased by a display gap.
        assert all(x['status'] == 'unavailable' for x in p['publicQueryContext']['items'])
        assert p['publicQueryContext']['status'] == 'partial'


@pytest.mark.parametrize('text', [
    'Applications pending review or modification, excluding cancelled applications.',
    'Only personal applications, including external approval work.',
    'Applications received from 2026-09-01 through 2026-09-29, not later records.',
    'Applications assigned to this account; department-wide work is not included.',
    'Requests with an application number and a received date; no claim is made about missing dates.',
    'الطلبات المخصصة لهذا الحساب فقط، باستثناء الطلبات الملغاة.',
    'طلبات المراجعة أو التعديل، بما في ذلك الموافقة الخارجية؛ وليست المراجعة فقط.',
])
def test_original_public_conditions_are_carried_whole_without_parsing_or_relabeling(text):
    env = rewritten_envelope(population=text, filterScope=text, grain='application')
    p = project(env)
    context, gaps = checked_scope_context(p)
    assert not gaps
    assert context['population'] == text and context['filterScope'] == text
    assert text in render_previous_answer(p, 'en')
    assert p['publicQueryContext']['newScopeMeaningClaimed'] is False


@pytest.mark.parametrize('text', [
    'Applications, keyed by id; only Pending Review.',
    'Application records (key dispositionCaseId), excluding archived records.',
    'Pending applications; statusCode equals one and only applications from 2024.',
    'Personal applications; the API also applies a department restriction.',
    'طلبات الحساب؛ يستخدم سياق الطلب قيد القسم، ولا يشمل الأقسام الأخرى.',
])
def test_hidden_technical_whole_clause_is_gap_never_parenthesis_or_keyword_rewrite(text):
    env = rewritten_envelope(population=text)
    p = project(env)
    context, gaps = checked_scope_context(p)
    assert 'population' in gaps and 'population' not in context
    rendered = render_previous_answer(p, 'en')
    assert text not in rendered and 'which record-selection conditions applied' in rendered
    assert p['publicQueryContext']['newScopeMeaningClaimed'] is False


def test_technical_business_id_label_does_not_become_new_required_permission_or_business_failure():
    env = rewritten_envelope(grain='Application ID')
    p = project(env)
    assert p['verified'] and 'grain' in p['publicQueryContext']['missing']
    assert env['result']['missing'] == [] and env['result']['requirementsSatisfied'] is True
    assert 'email' not in render_previous_answer(p, 'en').lower()


@pytest.mark.parametrize('mutation', ['text_tail', 'drop_tail', 'swap_object', 'drop_caveat', 'available_hidden',
                                       'principal', 'rid', 'catalog', 'transport_hash'])
def test_wrong_or_resigned_public_proof_never_authorizes_changed_semantics(mutation):
    env = rewritten_envelope(population='Personal applications only, excluding cancelled applications.')
    p = project(env); proof = p['publicQueryContext']
    if mutation == 'text_tail': proof['items'][1]['text'] += ' Including the entire department.'
    elif mutation == 'drop_tail': proof['items'][1]['text'] = 'Personal applications only.'
    elif mutation == 'swap_object': proof['items'][1]['text'] = 'Personal licenses only, excluding cancelled licenses.'
    elif mutation == 'drop_caveat': proof['items'].pop()
    elif mutation == 'available_hidden':
        proof['items'][0]['status'] = 'available'; proof['items'][0]['text'] = p['context']['grain']
    elif mutation == 'principal': proof['sourceBinding']['principalScopeRef'] = 'other'
    elif mutation == 'rid': proof['sourceBinding']['requestId'] = 'other'
    elif mutation == 'catalog': proof['sourceBinding']['catalogVersion'] = 'other'
    else: proof['contentHash'] = '0' * 64
    if mutation != 'transport_hash': resign(proof)
    context, gaps = checked_scope_context(p)
    assert 'population' in gaps and 'population' not in context


@pytest.mark.parametrize('key,value', [('sourceRequestId','wrong'),('principalScopeRef','wrong'),
                                     ('catalogVersion','wrong'),('observedAt',['2026-01-01T00:00:00Z']),
                                     ('observedFilters',['only approved']),('completeness','bounded')])
def test_post_projection_binding_changes_fail_closed_without_raw_context_fallback(key,value):
    p = project();p[key] = value
    context,gaps = checked_scope_context(p)
    assert 'grain' in gaps and 'grain' not in context
    assert 'taskId' not in render_previous_answer(p, 'en')


@pytest.mark.parametrize('mutation', ['owner', 'catalog', 'route', 'capture_time', 'capture_source', 'no_receipt', 'incomplete'])
def test_existing_source_owner_and_receipt_guards_are_not_relaxed(mutation):
    env = envelope();kwargs = {}
    if mutation == 'owner': kwargs['fingerprint'] = 'different'
    elif mutation == 'catalog': kwargs['catalog_version'] = 'different'
    elif mutation == 'route': kwargs['authorized'] = lambda _: False
    elif mutation == 'capture_time': env['result']['queryReceipt']['captures'][0]['capturedAt'] = '2000-01-01T00:00:00Z'
    elif mutation == 'capture_source': env['result']['queryReceipt']['captures'][0]['sourceId'] = 'different'
    elif mutation == 'no_receipt': env['result'].pop('queryReceipt')
    else: env['result']['requirementsSatisfied'] = False
    assert not project(env, **kwargs)['verified']


def test_actual_ar_failed_prerequisite_is_not_made_into_history_or_success():
    ar = F['ar']; result = deepcopy(ar['result'])
    assert ar['status'] == 'stopped_before_original_followup'
    assert ar['prerequisiteGate']['passed'] is False
    env = {'schemaVersion':'completed-prior-answer/1','requestId':result['requestId'],
           'result':result,'originalAnswer':ar['answer']}
    assert not project(env)['verified']
    assert seal_public_context(result) is None


@pytest.mark.parametrize('language', ['en','ar'])
def test_new_recorded_policy_is_clean_and_json_stable_and_does_not_change_first_answer(language):
    env = envelope();result=env['result']
    before=render_generic_answer(result,language)
    proof=seal_public_context(result)
    assert proof and proof['origin']=='existing_public_renderer'
    result['publicQueryContext']=proof
    after=render_generic_answer(result,language)
    assert before==after
    env['originalAnswer']=after
    for budget in (60,200,1000):
        assert clean(proof,max_items=budget)==proof
        transported=json.loads(json.dumps(GenericResult(clean(result,max_items=200)).public_json(),ensure_ascii=False))
        moved=deepcopy(env);moved['result']=transported
        p=project(moved)
        assert p['publicQueryContext']['origin']=='recorded_public_context'
        assert checked_scope_context(p)[1]==['grain','population','filterScope']
        assert clean(p['publicQueryContext'],max_items=budget)==p['publicQueryContext']


@pytest.mark.parametrize('mutation', ['context','receipt','output','revision','hash'])
def test_stored_policy_changes_are_gaps_not_a_legacy_fallback(mutation):
    env=envelope();env['result']['publicQueryContext']=seal_public_context(env['result'])
    if mutation=='context':env['result']['context']['caveats'][0]['value']+=' New limitation.'
    elif mutation=='receipt':env['result']['queryReceipt']['captures'][0]['appliedFilters'].append('Changed')
    elif mutation=='output':env['result']['outputs'][0]['label']+=' changed'
    elif mutation=='revision':env['result']['publicQueryContext']['sourceBinding']['taskFingerprint']='different'
    else:env['result']['publicQueryContext']['contentHash']='bad'
    env['originalAnswer']=render_generic_answer(env['result'],'en')
    p=project(env)
    assert p['verified']
    assert p['publicQueryContext']['origin']=='public_context_unavailable'
    assert 'caveats/0' in checked_scope_context(p)[1]


@pytest.mark.parametrize('text', ['One line.\nAnother condition.', '  Leading space and condition.  ',
                                 'Private [redacted] condition.', 'Remaining condition [truncated].',
                                 'Secret condition abc-private-token'])
def test_normalization_or_secret_redaction_cannot_shorten_a_condition_into_authority(text):
    env=rewritten_envelope(population=text)
    proof=seal_public_context(env['result'],secrets=['abc-private-token'])
    assert proof
    entry=next(i for i in proof['items'] if i['path']=='population')
    assert entry['status']=='unavailable' and 'text' not in entry


def test_multiple_snapshot_times_and_contexts_are_bound_without_merging():
    p=project();p['observedAt'].append('2026-09-28T04:00:00Z')
    p['snapshotScopeLabels']={'panel1':{'label':'first'},'panel2':{'label':'second'}}
    context,gaps=checked_scope_context(p)
    assert gaps and 'grain' not in context
    # The helper does not infer a shared date range or re-seal altered snapshots.
    assert p['observedAt'][0] != p['observedAt'][1]


def test_many_caveats_report_transport_gap_without_truncating_conditions():
    env=rewritten_envelope(caveats=[f'Condition number {i} remains required.' for i in range(61)])
    p=project(env)
    assert p['publicQueryContext']['status']=='unavailable'
    context,gaps=checked_scope_context(p)
    assert len([x for x in gaps if x.startswith('caveats/')])==61
    assert not context.get('caveats')


def test_helper_has_no_model_gateway_or_paraphrase_path():
    import app.reader_public_query_context as module
    text=Path(module.__file__).read_text();tree=ast.parse(text)
    assert not any(isinstance(node,ast.AsyncFunctionDef) for node in ast.walk(tree))
    assert not any(isinstance(node,ast.Attribute) and node.attr in
                   {'generic_reader_json','admin_portal_read','get_user_info','search'} for node in ast.walk(tree))
    assert not any(isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute)
                   and node.func.attr=='sub' for node in ast.walk(tree))


def test_actual_finish_clean_public_json_json_renderer_pipeline_keeps_business_result():
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import TaskSpec
    from app.reader_quality import STAGES
    old=envelope()['result'];task=TaskSpec.model_validate(old['intentState']['task'])
    class NoIO:
        def __getattr__(self,name):
            raise AssertionError('No external call allowed: '+name)
    reader=GenericKnowledgeReader(NoIO(),NoIO(),portal_base_url='https://portal.test')
    reader.intent_state=deepcopy(old['intentState']);reader.page=old['page']
    for stage in STAGES:reader.quality.record(stage,'passed',code='saved_fixture_prevalidated')
    reader.audit['captures']=[{**deepcopy(x),'bindingVerification':'observed_current_session'}
                              for x in old['queryReceipt']['captures']]
    analysis={key:deepcopy(old[key]) for key in ('context','outputs','requirements','requirementCoverage','missing')}
    outcome=reader.finish(analysis=analysis,task=task,page_name=old['section'])
    result=json.loads(json.dumps(outcome.result.public_json(),ensure_ascii=False))
    assert result['result']=='success' and result['analysisStatus']=='complete'
    assert result['missing']==[] and result['requirementsSatisfied'] is True
    assert result['outputs']==old['outputs'] and result['context']==old['context']
    assert result['queryReceipt']==old['queryReceipt']
    assert result['publicQueryContext']==seal_public_context(result)
    env={'schemaVersion':'completed-prior-answer/1','requestId':old['requestId'],
         'result':result,'originalAnswer':render_generic_answer(result,'en')}
    p=project(env)
    assert p['verified'] and p['publicQueryContext']['status']=='partial'
    assert 'dispositionCaseId' not in render_previous_answer(p,'en')
    assert result['context']['grain']['value']==old['context']['grain']['value']


@pytest.mark.parametrize('mode', ['simplify','simplify_navigation'])
def test_original_simplify_projections_and_rendering_are_unaffected_by_added_result_metadata(mode):
    env=envelope();state=env['result']['intentState']
    args=(mode,state['principalFingerprint'],state['catalogVersion'],CATALOG,lambda _:True)
    before=project_previous_answer(env,*args)
    env['result']['publicQueryContext']=seal_public_context(env['result'])
    after=project_previous_answer(env,*args)
    assert before==after
    for language in ('en','ar'):
        assert render_previous_answer(before,language)==render_previous_answer(after,language)


@pytest.mark.parametrize('items',[None, {}, ['bad'], [None], [3], []])
def test_malformed_items_return_explanation_gap_without_exception(items):
    p=project();p['publicQueryContext']['items']=items;resign(p['publicQueryContext'])
    context,gaps=checked_scope_context(p)
    assert 'population' in gaps and 'population' not in context


@pytest.mark.parametrize('bad',[True, 1, 'bad', ['bad']])
def test_malformed_optional_proof_or_binding_is_only_display_gap(bad):
    p=project();p['publicQueryContext']=bad
    assert checked_scope_context(p)[1]
    p=project();p['publicQueryContext']['sourceBinding']=bad;resign(p['publicQueryContext'])
    assert checked_scope_context(p)[1]


@pytest.mark.parametrize('mode',['bounded','nonempty'])
def test_public_projection_never_promotes_completeness_or_changes_rows(mode):
    env=envelope();result=env['result']
    if mode=='bounded':
        result['completeness']='bounded'
        for output in result['outputs']:
            output['dataCompleteness']='bounded'
    else:
        for output in result['outputs']:
            output['value']=[{'applicationNumber':'EXAMPLE-A','status':'Pending Review'}]
            output.pop('emptyListProof',None)
    before=deepcopy(result)
    env['originalAnswer']=render_generic_answer(result,'en')
    p=project(env);text=render_previous_answer(p,'en')
    assert result==before and p['completeness']==result['completeness']
    assert p['publicQueryContext']['newScopeMeaningClaimed'] is False
    if mode=='bounded':assert 'does not establish a complete record population' in text
