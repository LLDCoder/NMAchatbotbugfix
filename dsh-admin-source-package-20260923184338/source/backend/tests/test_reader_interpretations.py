import json
import pytest
from test_reader_absence import fixture as absence_fixture
from app.generic_reader import execute_analysis, render_generic_answer, KnowledgeStore
from app.reader_bindings import bind_analysis_evidence
from app.reader_requirements import semantic_bindings
from app.reader_interpretations import observed_interpretation


def fixture():
    task, plan, sources, kb = absence_fixture()
    for item in kb.items.values():
        record = item.get('record') or {}
        for fact in record.get('payload', {}).get('bindings', []):
            if fact.get('kind') == 'attribute':
                fact.pop('absenceRule', None)
                fact['interpretationRules'] = [{'conditions': [
                    {'field': 'phase', 'value': 'Awaiting review'}, {'field': 'color', 'value': None}],
                    'hideFields': ['phase', 'color'], 'message': {
                        'en': 'An authorized reviewer can review this record next.',
                        'ar': 'يمكن للمراجع المخوّل مراجعة هذا السجل كخطوة تالية.'}}]
    return task, plan, sources, kb


def test_verified_conditional_description_answers_in_both_languages():
    t,p,s,k=fixture();bind_analysis_evidence(p,t,k,s);result=execute_analysis(p,s,k,[],task=t)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert result['outputs'][0]['verifiedInterpretations'][0]['inputHash']
    assert result['outputs'][0]['verifiedInterpretations'][0]['definitionHash']
    for lang, text in [('en', 'An authorized reviewer'), ('ar', 'يمكن للمراجع')]:
        answer = render_generic_answer(result, lang)
        assert text in answer and '| color |' not in answer and 'Unknown' not in answer


@pytest.mark.parametrize('fault', ['missing_receipt', 'truncated', 'wrong_hash', 'wrong_state',
    'wrong_record', 'other_path', 'other_operation', 'not_single', 'untested_field',
    'overlapping_rule', 'unknown_hide_field', 'missing_translation', 'collection_task'])
def test_interpretation_requires_exact_record_complete_inputs_and_unique_rule(fault):
    t,p,s,k=fixture();source=s['detail'];fact=next(x for x in semantic_bindings(k) if x['kind']=='attribute')
    rule=fact['interpretationRules'][0]
    if fault=='missing_receipt': source['fieldEvidence'].pop('/data/color')
    elif fault=='truncated': source['fieldEvidence']['/data/color']['status']='bounded'
    elif fault=='wrong_hash': source['fieldEvidence']['/data/color']['valueHash']='other'
    elif fault=='wrong_state': source['data']['data']['phase']='Complete'
    elif fault=='wrong_record': source['verifiedRecord']['identity']='OTHER'
    elif fault=='other_path': fact['sourcePath']='/other'
    elif fault=='other_operation': fact['operationRef']='GET /other'
    elif fault=='not_single': source['verifiedRecord']['single']=False
    elif fault=='untested_field': rule['conditions'].pop()
    elif fault=='overlapping_rule': fact['interpretationRules'].append(json.loads(json.dumps(rule)))
    elif fault=='unknown_hide_field': rule['hideFields'].append('unrelated')
    elif fault=='missing_translation': rule['message'].pop('ar')
    elif fault=='collection_task': t.outputShape='list'
    assert observed_interpretation(t,fact,source,fact['fields'],'/data') is None
