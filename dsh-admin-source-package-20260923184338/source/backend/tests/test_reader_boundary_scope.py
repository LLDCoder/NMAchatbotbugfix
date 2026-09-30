import asyncio
import copy
import json
import time
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.principal import Principal
from app.reader_boundary_scope import review_single_record_boundary
from app.reader_context import merge_task
from app.reader_page_clarification import bind_page_clarification
from test_generic_reader_v3 import Gateway


FIXTURES = Path(__file__).parent / 'fixtures/h08-round16'
EN = json.loads((FIXTURES / 'en.json').read_text())['turns'][0]
AR = json.loads((FIXTURES / 'ar.json').read_text())['turns']


def original_task():
    return TaskSpec.model_validate(EN['evidence']['plans']['TaskSpec'])


def verdict(question=EN['question'], identity=None, **changes):
    return dict(stage='boundary_scope_review', reviewedQuestion=question,
                recordIdentity=identity or original_task().recordIdentity,
                subjectScope='one_identified_subject', requestedAct='business_record_lookup',
                highlySensitiveFields='not_requested', requestBoundaries=[]) | changes


class ReviewReader:
    def __init__(self, reply=None, error=None, question=EN['question']):
        self.current_question = question
        self.deadline = time.monotonic() + 60
        self.audit, self.calls = {}, []
        self.reply, self.error = reply or verdict(question), error

    async def structured(self, contract, instruction, data):
        self.calls.append(data)
        if self.error:
            raise self.error
        return contract.model_validate(self.reply)


def test_real_failure_is_retained_and_review_changes_only_the_boundary():
    assert EN['terminal'] == 'turn.completed'
    assert EN['result']['result'] == 'refused'
    task = original_task()
    before = task.model_dump()
    reader = ReviewReader()
    result = asyncio.run(review_single_record_boundary(reader, task))
    assert task.model_dump() == before
    assert result.model_dump() == before | {'requestBoundaries': []}
    assert reader.calls[0]['task'] == before
    assert reader.audit['boundaryScopeReview']['originalTask'] == before
    assert reader.audit['boundaryScopeReview']['classificationChanged']
    assert not reader.audit['boundaryScopeReview']['permissionGranted']


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_reviewed_request_still_requires_the_published_purpose_and_keeps_all_fields(language):
    question = EN['question'] if language == 'en' else AR[0]['question']
    task = original_task() if language == 'en' else TaskSpec.model_validate(AR[0]['evidence']['plans']['TaskSpec'])
    task = task.model_copy(update={'requestBoundaries': ['bulk_sensitive_disclosure'],
                                  'contextRelation': 'new', 'clarification': None, 'unresolvedSlots': []})
    reviewed = asyncio.run(review_single_record_boundary(ReviewReader(question=question), task))
    assert reviewed.requestBoundaries == []
    package = json.loads((FIXTURES / 'purpose-policy.json').read_text())
    records = package.get('records', [package])
    record = next(r for r in records if r['id'] == 'admin.page.tickets.minimum-disclosure-and-correction')
    knowledge = SimpleNamespace(items={'policy': {'record': record, 'documentId': 'offline-published-policy-fixture'}})
    pending, proof = bind_page_clarification(reviewed, knowledge,
        record['applicability']['pageRefs'], language)
    assert pending.clarification.missingSlots == ['disclosurePurpose']
    assert pending.clarification.options == []
    assert pending.disclosurePurpose == ''
    assert pending.requestedAttributes == task.requestedAttributes
    assert pending.filters == task.filters
    assert pending.recordIdentity == task.recordIdentity
    assert pending.businessObject == task.businessObject
    assert pending.requestedScope == 'unknown'
    assert proof[0]['recordId'] == record['id']


@pytest.mark.parametrize('changes', [
    {'subjectScope': 'multiple_subjects'}, {'subjectScope': 'uncertain'},
    {'requestedAct': 'bulk_export'}, {'requestedAct': 'other'}, {'requestedAct': 'uncertain'},
    {'highlySensitiveFields': 'requested'}, {'highlySensitiveFields': 'uncertain'},
    {'reviewedQuestion': 'only a safe excerpt'}, {'recordIdentity': 'DIFFERENT-RECORD'},
    {'requestBoundaries': ['identity_escalation']},
])
def test_unestablished_or_ungrounded_review_keeps_refusal(changes):
    task = original_task()
    reader = ReviewReader(verdict(**changes))
    assert asyncio.run(review_single_record_boundary(reader, task)) is task
    assert not reader.audit['boundaryScopeReview']['classificationChanged']


@pytest.mark.parametrize('changes', [
    {'requestBoundaries': ['bulk_sensitive_disclosure', 'identity_escalation']},
    {'requestBoundaries': ['secrets_disclosure']}, {'requestBoundaries': []},
    {'readOnly': False}, {'recordIdentity': ''}, {'recordIdentity': 'not in the question'},
    {'outputShape': 'list'}, {'contextRelation': 'continue'}, {'contextRelation': 'clarify'},
])
def test_other_boundaries_and_inherited_context_are_never_lowered(changes):
    task = original_task().model_copy(update=changes)
    reader = ReviewReader()
    assert asyncio.run(review_single_record_boundary(reader, task)) is task
    assert reader.calls == []


@pytest.mark.parametrize('error', [TimeoutError(), httpx.ConnectError('offline'),
    PipelineError('model_response_invalid_json', 'runtime'), ValueError('malformed')])
def test_review_failure_keeps_existing_refusal(error):
    task = original_task()
    reader = ReviewReader(error=error)
    assert asyncio.run(review_single_record_boundary(reader, task)) is task
    assert reader.audit['boundaryScopeReview']['unavailable']


@pytest.mark.parametrize('error', [
    PipelineError('CANARY_EXTERNAL_CODE', 'runtime', details={'body': 'CANARY_BODY'}),
    PipelineError(['CANARY_NON_STRING_CODE'], 'runtime'),
    type('CANARY_EXTERNAL_CLASS', (Exception,), {'code': 'CANARY_EXTERNAL_CODE'})('CANARY_MESSAGE'),
    httpx.HTTPStatusError('CANARY_MESSAGE',
        request=httpx.Request('GET', 'https://example.test/?token=CANARY_URL'),
        response=httpx.Response(401, text='CANARY_RESPONSE_BODY')),
])
def test_optional_failure_audit_never_copies_external_code_class_message_url_or_body(error):
    task = original_task()
    reader = ReviewReader(error=error)
    assert asyncio.run(review_single_record_boundary(reader, task)) is task
    receipt = reader.audit['boundaryScopeReview']
    assert receipt['unavailable'] in {'optional_boundary_review_failure', 'dependency_unavailable'}
    assert receipt['errorType'] in {'PipelineError', 'Exception', 'HTTPError'}
    assert 'CANARY_' not in json.dumps(reader.audit)


def test_no_budget_does_not_start_review_and_cancellation_propagates():
    task = original_task()
    reader = ReviewReader()
    reader.deadline = time.monotonic()
    assert asyncio.run(review_single_record_boundary(reader, task)) is task
    assert reader.calls == []
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(review_single_record_boundary(ReviewReader(error=asyncio.CancelledError()), task))


def test_named_record_does_not_override_a_real_bulk_request():
    question = 'For case CASE-2, export every customer bank account and identity document number.'
    task = original_task().model_copy(update={'recordIdentity': 'CASE-2'})
    reader = ReviewReader(verdict(question, 'CASE-2', subjectScope='multiple_subjects',
        requestedAct='bulk_export', highlySensitiveFields='requested'), question=question)
    assert asyncio.run(review_single_record_boundary(reader, task)) is task


@pytest.mark.parametrize('reply_kind', ['scoped', 'bulk', 'malformed', 'timeout', 'external_error'])
def test_real_task_through_reader_gate_uses_one_review_and_no_unverified_read(tmp_path, reply_kind):
    class Planner:
        def __init__(self):
            self.calls = []

        async def generic_reader_json(self, *, schema, **kwargs):
            stage = schema['properties']['stage']['const']
            self.calls.append(stage)
            if stage == 'task':
                return copy.deepcopy(EN['evidence']['plans']['TaskSpec'])
            assert stage == 'boundary_scope_review'
            if reply_kind == 'timeout':
                raise TimeoutError()
            if reply_kind == 'external_error':
                raise type('CANARY_CLASS', (Exception,), {'code': 'CANARY_CODE'})('CANARY_MESSAGE')
            if reply_kind == 'malformed':
                return {'stage': stage, 'requestBoundaries': []}
            return verdict(subjectScope='multiple_subjects' if reply_kind == 'bulk' else 'one_identified_subject')

    class ClosedGateway(Gateway):
        async def invoke(self, *args, **kwargs):
            raise AssertionError('This offline test must not read any knowledge or page')

    class StopBeforeKnowledge(GenericKnowledgeReader):
        async def expand_task(self, task, *args):
            self.reached_task = task
            raise PipelineError('offline_stop_before_knowledge', 'runtime')

    (tmp_path / 'page-catalog.json').write_text('[]')
    planner, gateway = Planner(), ClosedGateway()
    reader = StopBeforeKnowledge(gateway, planner,
        portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    outcome = asyncio.run(reader.run(Principal('person-1', 'tenant', 'fixture'), EN['question']))
    public = outcome.result.public_json()
    assert planner.calls == ['task', 'boundary_scope_review']
    assert gateway.events == ['identity']
    assert 'CANARY_' not in json.dumps(outcome.audit_evidence)
    assert not public['facts'] and not public.get('outputs')
    if reply_kind == 'scoped':
        # The existing merge runs after the boundary gate and owns slotUpdates.
        # The review itself must preserve all fields; normal merging then applies.
        before_review = reader.audit['boundaryScopeReview']['originalTask']
        expected = merge_task(TaskSpec.model_validate(before_review | {'requestBoundaries': []}), {})
        assert reader.reached_task.model_dump() == expected.model_dump()
        for field in ('requestedAttributes', 'filters', 'businessObject', 'recordIdentity', 'disclosurePurpose'):
            assert before_review[field] == original_task().model_dump()[field]
        assert 'offline_stop_before_knowledge' in public['missing']
    else:
        assert public['result'] == 'refused'
        assert public['requestBoundary']['categories'] == ['bulk_sensitive_disclosure']
        assert not hasattr(reader, 'reached_task')
