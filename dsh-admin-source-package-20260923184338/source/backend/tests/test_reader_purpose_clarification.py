import copy
from types import SimpleNamespace

import pytest

from app.generic_reader import PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_page_clarification import (
    automatic_clarification_routes, bind_page_clarification, page_clarification,
)


PAGE = '/case/participants'


def fixture():
    task = TaskSpec(stage='task', businessObject='participant', requestedScope='unknown',
        requestedGrain='participant', requestedMeasures=[], requestedAttributes=['contacts', 'history'],
        groupBy=[], timeRange='unknown', filters=['linked to current case'], outputShape='detail',
        needsLiveData=True, readOnly=True, searchQuery='participant contacts and history',
        recordIdentity='CASE-7', unresolvedSlots=[])
    rule = {'id': 'need_purpose', 'kind': 'missing_disclosure_purpose', 'slot': 'disclosurePurpose',
        'autoClarify': True, 'requiresRecordIdentity': True, 'objects': ['participant'],
        'attributeGroups': [['contacts'], ['history']], 'minimumMatchedGroups': 2,
        'question': {'en': 'Which information is necessary for this case? Broad disclosure is unavailable.',
                     'ar': 'ما المعلومات اللازمة لهذه القضية؟ لا يتاح الإفصاح الشامل.'}}
    record = {'id': 'page.disclosure', 'revision': 2, 'status': 'active',
        'applicability': {'pageRefs': [PAGE]}, 'payload': {'clarificationRules': [rule]}}
    return task, SimpleNamespace(items={'source': {'record': record, 'documentId': 'published'}}), rule


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_published_missing_purpose_preserves_every_requested_clause(language):
    task, knowledge, rule = fixture()
    before = task.model_dump()
    routes = automatic_clarification_routes(task, knowledge, [PAGE])
    result, proof = bind_page_clarification(task, knowledge, routes, language)
    assert result.clarification.question == rule['question'][language]
    assert result.clarification.missingSlots == ['disclosurePurpose']
    assert result.clarification.options == []
    assert proof == [{'recordId': 'page.disclosure', 'revision': 2,
                      'documentId': 'published', 'ruleId': 'need_purpose'}]
    for field, value in before.items():
        if field not in {'clarification', 'contextRelation', 'unresolvedSlots'}:
            assert result.model_dump()[field] == value
    assert task.model_dump() == before


@pytest.mark.parametrize('change', [
    {'disclosurePurpose': 'Use contact details to handle the current case'},
    {'recordIdentity': ''}, {'businessObject': 'unrelated object'},
    {'needsLiveData': False}, {'readOnly': False},
    {'requestedAttributes': ['contacts']}, {'requestedAttributes': ['contact count', 'history']},
])
def test_no_redundant_or_overbroad_purpose_question(change):
    task, knowledge, _ = fixture()
    task = task.model_copy(update=change)
    assert automatic_clarification_routes(task, knowledge, [PAGE]) == []
    assert page_clarification(task, knowledge, [PAGE], 'en') == (None, [])


@pytest.mark.parametrize('change', ['local_only', 'draft', 'not_opted_in', 'unauthorized_page'])
def test_unpublished_or_unavailable_definition_cannot_trigger(change):
    task, knowledge, rule = fixture()
    routes = [PAGE]
    if change == 'local_only':
        knowledge.items['source']['documentId'] = ''
    elif change == 'draft':
        knowledge.items['source']['record']['status'] = 'draft'
    elif change == 'not_opted_in':
        rule['autoClarify'] = False
    else:
        routes = ['/unrelated']
    assert automatic_clarification_routes(task, knowledge, routes) == []
    assert page_clarification(task, knowledge, routes, 'en') == (None, [])


def test_conflicting_active_purpose_questions_do_not_choose_a_policy():
    task, knowledge, _ = fixture()
    other = copy.deepcopy(knowledge.items['source'])
    other['record']['id'] = 'page.other'
    other['documentId'] = 'different-published'
    other['record']['payload']['clarificationRules'][0]['question']['en'] = 'Different requirements?'
    knowledge.items['other'] = other
    with pytest.raises(PipelineError, match='page_clarification_conflict'):
        page_clarification(task, knowledge, [PAGE], 'en')


@pytest.mark.parametrize('bad', [True, 0, 3, '2'])
def test_invalid_match_threshold_fails_before_reading(bad):
    task, knowledge, rule = fixture()
    rule['minimumMatchedGroups'] = bad
    with pytest.raises(PipelineError, match='page_clarification_definition_invalid'):
        automatic_clarification_routes(task, knowledge, [PAGE])


def test_no_business_data_or_permissions_are_synthesized_by_a_reply_focus():
    task, knowledge, _ = fixture()
    pending, _ = bind_page_clarification(task, knowledge, [PAGE], 'en')
    reply = pending.model_copy(update={'disclosurePurpose': 'Contact for case handling',
                                      'clarification': None, 'unresolvedSlots': []})
    result, proof = bind_page_clarification(reply, knowledge, [PAGE], 'en')
    assert result is reply and proof == []
    assert result.requestedAttributes == task.requestedAttributes
    assert result.recordIdentity == task.recordIdentity
    assert result.requestedScope == 'unknown' and result.needsLiveData is True


def test_one_attribute_cannot_count_as_multiple_disclosure_groups():
    task, knowledge, rule = fixture()
    rule['attributeGroups'] = [['contacts'], ['contacts', 'history']]
    with pytest.raises(PipelineError, match='page_clarification_definition_invalid'):
        automatic_clarification_routes(task, knowledge, [PAGE])


def test_invalid_rule_on_unauthorized_page_does_not_control_this_request():
    task, knowledge, rule = fixture()
    rule['minimumMatchedGroups'] = 'invalid'
    assert automatic_clarification_routes(task, knowledge, ['/other']) == []


def test_unknown_focus_still_requires_a_purpose():
    task, knowledge, _ = fixture()
    task = task.model_copy(update={'disclosurePurpose': 'unknown'})
    result, proof = bind_page_clarification(task, knowledge, [PAGE], 'en')
    assert result.clarification and proof
