"""Offline regression from the completed C08 turn; no models or live reads."""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.reader_previous_answer import project_previous_answer, render_previous_answer

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_c08_v31_clarity_trace.json').read_text())


def projection():
    return deepcopy(TRACE['projection'])


def test_captured_c08_simplification_removes_new_execution_metadata_not_original_limits():
    value = projection()
    before = deepcopy(value)
    text = render_previous_answer(value, 'en')
    # This is a shorter rephrasing of the previous helper, not a forced length
    # cap which could delete business caveats from an already concise original.
    assert len(text.split()) < .85 * len(TRACE['oldAnswer'].split())
    assert 'no matching rows' in text
    assert 'Scope: personal' in text
    assert 'record unit' not in text and 'requested result details' not in text
    assert 'what each row represents: application' in text
    assert 'whether the requested list could be verified' in text
    assert 'endpoint' not in text and 'runtime' not in text
    assert 'Period: current observation' not in text
    assert value['observedAt'][0] in text
    assert '[Applications](/licensing/applications)' in text
    for caveat in value['context']['caveats']:
        assert caveat in text
    assert value['context']['population'] in text
    assert value == before
    assert value['businessResultComplete'] is False
    assert value['sourceRequirementsSatisfied'] is False
    assert value['liveDataRead'] is False and value['currentStatusClaimed'] is False


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_context_that_changes_interpretation_survives_simplification(language):
    value = projection()
    value['context'].update(population='Only applications submitted in 2024.',
        filterScope='Approved applications only.', time='2024-01-01 through 2024-12-31',
        caveats=['A zero balance does not mean the application is approved.',
                 'The API list excludes archived records.'])
    text = render_previous_answer(value, language)
    for field in ('population', 'filterScope', 'time'):
        assert value['context'][field] in text
    # Even a technical word must not cause a substantive caveat to disappear.
    for caveat in value['context']['caveats']:
        assert caveat in text
    assert value['observedAt'][0] in text
    assert '[Applications](/licensing/applications)' in text
    assert ('not a new query' if language == 'en' else 'ليس استعلاماً جديداً') in text
    assert ('only partly confirmed' if language == 'en' else 'مؤكدة جزئيًا فقط') in text


@pytest.mark.parametrize('kind,value', [('grain','application'),('scope','team'),('time','today'),
    ('filter','approved'),('record','APP-001'),('attribute','date'),('measure','amount'),
    ('population','all queues'),('group','department'),('ordering','earliest first'),
    ('view','completed'),('object','licence'),('detail','custom result'),('custom','unmapped requirement')])
@pytest.mark.parametrize('language', ['en', 'ar'])
def test_no_unknown_requirement_value_is_hidden_or_promoted(kind, value, language):
    item = projection()
    item['unconfirmedRequirements'] = [{'kind':kind,'value':value,'status':'unfulfilled'}]
    text = render_previous_answer(item, language)
    assert value in text
    assert ('Still unconfirmed' if language == 'en' else 'ما زال غير مؤكد') in text
    assert item['businessResultComplete'] is False


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_bounded_empty_output_stays_unknown_not_zero(language):
    value = projection()
    value['completeness'] = 'bounded'
    value['outputs'][0]['dataCompleteness'] = 'bounded'
    text = render_previous_answer(value, language)
    assert ('No rows were displayed; completeness was not verified.' if language == 'en' else
            'لم تُعرض صفوف، ولم يتم التحقق من اكتمال النتيجة.') in text
    assert ('does not establish a complete record population' if language == 'en' else
            'ولا تثبت اكتمال جميع السجلات') in text
    assert 'no matching rows' not in text


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_nonempty_values_and_multiple_times_and_navigation_are_not_shortened_away(language):
    value = projection()
    value['outputs'][0]['value'] = [{'applicationNumber':'APP-012','status':'Pending Review'},
                                  {'applicationNumber':'APP-017','status':None}]
    value['observedAt'].append('2026-09-27T14:02:01Z')
    value['navigation'].append({'route':'/licensing/licenses','label':'Licences'})
    text = render_previous_answer(value, language)
    for raw in ('APP-012','APP-017','Pending Review','2026-09-27T14:02:01Z',
                '[Applications](/licensing/applications)', '[Licences](/licensing/licenses)'):
        assert raw in text


@pytest.mark.parametrize('denied', ['principal','catalog','route'])
def test_real_captured_partial_result_is_still_reauthorized_before_display(denied):
    prior=TRACE['result']; state=prior['intentState']
    env={'schemaVersion':'completed-prior-answer/1', 'requestId':prior['requestId'],
         'result':prior,'originalAnswer':TRACE['originalAnswer']}
    value=project_previous_answer(env,'simplify_navigation',
        'changed' if denied=='principal' else state['principalFingerprint'],
        'changed' if denied=='catalog' else state['catalogVersion'],
        [{'routes':['/licensing/applications'], 'businessNavigation':TRACE['projection']['navigation']}],
        lambda _: denied!='route')
    assert value['verified'] is False
    text=render_previous_answer(value,'en')
    assert 'no matching rows' not in text and '[Applications]' not in text
