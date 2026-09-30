import asyncio
import json
from tempfile import TemporaryDirectory
from pathlib import Path
import pytest

from app.generic_reader import GenericKnowledgeReader, render_generic_answer
from app.reader_context import context_from_state
from app.reader_input_clarification import input_clarification, needs_input_clarification
from app.principal import Principal
from test_generic_reader_v3 import Gateway
from test_reader_context_v3 import task


def unclear(**updates):
    return task(businessObject='unknown', businessFocus='', requestedScope='unknown',
        recordIdentity='', requestedMeasures=[], requestedAttributes=[], groupBy=[],
        timeRange='unknown', filters=[], view='', needsLiveData=False,
        clarification={'question': 'What do you mean?', 'missingSlots': ['businessObject']},
        **updates)


@pytest.mark.parametrize('relation', ['new', 'switch', 'continue', 'refine', 'clarify'])
def test_unidentified_followup_does_not_require_knowledge(relation):
    assert needs_input_clarification(unclear(contextRelation=relation),
        {'previousIntent': {'task': unclear().model_dump()}})


@pytest.mark.parametrize('changes', [
    {'recordIdentity': 'ZX-42'}, {'businessObject': 'crystals'},
    {'requestedAttributes': ['status']}, {'filters': ['color=blue']},
    {'timeRange': 'today'}, {'requestedOrdering': ['oldest']}])
def test_partial_meaningful_requests_and_bound_history_are_not_discarded(changes):
    candidate = unclear().model_copy(update=changes)
    assert not needs_input_clarification(candidate, {})
    assert not needs_input_clarification(unclear(contextRelation='clarify'),
        {'previousIntent': {'task': candidate.model_dump()}})


@pytest.mark.parametrize('changes', [{'readOnly': False}, {'contextRelation': 'cancel'}, {'clarification': None}])
def test_write_cancel_and_answer_paths_do_not_become_input_guidance(changes):
    assert not needs_input_clarification(unclear().model_copy(update=changes), {})


def catalog():
    return [
        {'id': 'a', 'name': 'Crystal work', 'module': 'first', 'routes': ['/work/crystals'],
         'standaloneRoutes': ['/work/crystals'], 'fields': ['code']},
        {'id': 'b', 'name': 'Other work', 'module': 'second', 'routes': ['/other/work'], 'fields': ['code']},
        {'id': 'c', 'name': 'Restricted work', 'module': 'first', 'routes': ['/restricted/work'], 'fields': ['code']},
        {'id': 'd', 'name': 'Detail edit', 'module': 'first', 'routes': ['/work/crystals/edit'], 'standaloneRoutes': []},
    ]


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_examples_stay_on_authorized_current_module_and_are_not_selectable_options(language):
    request, examples = input_clarification(catalog(), {'route': '/work/crystals'},
        lambda route: route != '/restricted/work', language)
    assert [page['name'] for page in examples] == ['Crystal work']
    assert request.options == []
    assert 'Crystal work' in request.question
    assert 'Other work' not in request.question and 'Restricted work' not in request.question
    assert 'Detail edit' not in request.question


def test_empty_authorization_does_not_invent_a_department_or_link():
    request, examples = input_clarification(catalog(), {}, lambda route: False, 'en')
    assert not examples and '/work/' not in request.question
    assert 'Crystal' not in request.question and 'Open a page available' in request.question


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_two_consecutive_unidentified_turns_only_verify_identity(language):
    class NoBusinessGateway(Gateway):
        async def invoke(self, *args, **kwargs):
            raise AssertionError('An unidentified request must not search knowledge or read business data')

    class UnclearPlanner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': data['question'],
                    'english': 'Uninterpretable fragment: ' + data['question']}]}
            assert stage == 'task'
            return unclear(contextRelation='clarify' if data.get('history') else 'new').model_dump()

    with TemporaryDirectory() as folder:
        Path(folder, 'page-catalog.json').write_text(json.dumps([
            {'name': 'Crystal work', 'graphId': 'crystals', 'module': 'first',
             'routes': [{'path': '/work/crystals'}], 'fieldNames': ['code']},
            {'name': 'Restricted work', 'graphId': 'restricted',
             'routes': [{'path': '/restricted/work'}], 'fieldNames': ['code']},
        ]))
        previous = {}
        for index, message in enumerate(['🤔 ❓', 'س ص ع ف' if language == 'ar' else 'qzxv 987xz']):
            gateway = NoBusinessGateway()
            reader = GenericKnowledgeReader(gateway, UnclearPlanner(),
                portal_base_url='https://portal.test', artifacts_dir=folder)
            result = asyncio.run(reader.run(Principal('person-1', 'tenant', f'r{index}'),
                message, conversation_context={**previous, 'responseLanguage': language}))
            public = result.result.public_json()
            assert public['missing'] == ['intent_ambiguous']
            assert gateway.events == ['identity']
            answer = render_generic_answer(public, language)
            assert 'Crystal work' in answer and 'Restricted work' not in answer
            assert ('لم أفهم' if language == 'ar' else 'I could not understand') in answer
            previous = context_from_state(public, message)
