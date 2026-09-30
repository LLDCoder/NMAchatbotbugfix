"""A sealed explanation must survive finish/JSON/render unchanged after review."""
import asyncio
from copy import deepcopy
import json

import pytest

from app import generic_reader as generic
from app.generic_reader import PipelineError, clean, render_generic_answer, safe_text
from app.reader_answers import KnowledgeAnswerReview
from app.reader_requirements import requirements_for
import app.reader_gap_explanation as gap
from test_reader_gap_explanation import setup, TEXT


KINDS = ['plain', 'multiline_block', 'spaces_block', 'multiline_review_reason',
         'embedded_json_review_reason', 'requirement_reason', 'point_reason', 'tabs_block']


def prepare(language='en', kind='plain'):
    reader, task, routing, recalled, planner = setup(language)
    original = planner.generic_reader_json
    captured = {'rawText': None, 'reviewInput': None}
    async def controlled(*, schema, data, **kwargs):
        raw = await original(schema=schema, data=data, **kwargs)
        if raw['stage'] == 'knowledge_answer_draft':
            if kind == 'multiline_block': raw['blocks'][0]['text'] = raw['blocks'][0]['text'].replace(' ', '\n', 1)
            elif kind == 'spaces_block': raw['blocks'][0]['text'] = raw['blocks'][0]['text'].replace(' ', '  ', 1)
            elif kind == 'tabs_block': raw['blocks'][0]['text'] = raw['blocks'][0]['text'].replace(' ', '\t\t', 1)
            elif kind == 'secret': raw['blocks'][0]['text'] += ' PRIVATE-CREDENTIAL'
            elif kind == 'unstable': raw['blocks'][0]['text'] = 'Limits apply &amp;amp; remain.'
            elif kind == 'empty': raw['blocks'][0]['text'] = '   \n   '
            elif kind == 'oversize_after_redaction': raw['blocks'][0]['text'] = 'x' * 1795 + ' tiny'
            captured['rawText'] = raw['blocks'][0]['text']
        if raw['stage'] == 'knowledge_answer_review':
            captured['reviewInput'] = deepcopy(data)
            if kind == 'multiline_review_reason': raw['blockChecks'][0]['reason'] = 'Supported by cited rules.\nNo live numbers are established.'
            elif kind == 'embedded_json_review_reason': raw['blockChecks'][0]['reason'] = 'Reviewed: {\n  "supported": true,\n  "current_facts": false\n}'
            elif kind == 'requirement_reason':
                raw['checks'][0]['status'] = 'not_yet_verified'
                raw['checks'][0]['reason'] = 'No current facts.\n\nMissing  evidence.'
            elif kind == 'point_reason':
                raw['checks'][0]['pointChecks'] = [{'pointIndex': 0, 'covered': False,
                    'answerBlockIds': [], 'reason': 'Missing\n  current proof.'}]
            elif kind == 'oversize_note': raw['blockChecks'][0]['reason'] = 'x' * 799 + 'z'
        return raw
    planner.generic_reader_json = controlled
    return reader, task, routing, recalled, planner, captured


def finish(reader, task, routing, recalled):
    receipt = asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True))
    reader.supplemental_explanation = receipt
    outcome = reader.finish(task=task, error=PipelineError(routing.missing[0], 'knowledge_gap',
        {'routingMissing': list(routing.missing), 'stage': 'RoutingDecision'}))
    return receipt, json.loads(json.dumps(outcome.result.public_json(), ensure_ascii=False))


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('kind', KINDS)
def test_review_sees_exact_public_text_and_every_receipt_byte_survives_finish(language, kind):
    reader, task, routing, recalled, planner, seen = prepare(language, kind)
    original_task = task.model_dump(); original_deadline = reader.deadline
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt and receipt == payload['supplementalExplanation']
    assert clean(receipt, reader.secrets, max_items=200) == receipt
    assert receipt['contentHash'] == gap._hash({k: v for k, v in receipt.items() if k != 'contentHash'})
    assert seen['reviewInput']['answerBlocks'][0]['text'] == receipt['blocks'][0]['text']
    assert receipt['blocks'][0]['text'] == safe_text(seen['rawText'], reader.secrets)
    assert receipt['blocks'][0]['text'] in render_generic_answer(payload, language)
    assert len(gap.explanation_blocks(payload, language)) == 1
    assert receipt['quotes'] == gap.cited_rule_quotes(reader, routing, recalled, lambda _: True)
    assert payload['missing'] == routing.missing and payload['requirements'] == requirements_for(task)
    assert payload['result'] == 'not_confirmed' and payload['requirementsSatisfied'] is False
    assert all(c['status'] == 'unfulfilled' for c in payload['requirementCoverage'])
    assert all(c['status'] == 'not_yet_verified' for c in receipt['requirementChecks'])
    assert payload['outputs'] == payload['knowledgeAnswer'] == payload['knowledgeQuotes'] == []
    assert task.model_dump() == original_task and reader.deadline == original_deadline
    assert len(planner.calls) == 2 and reader.active_quality_stage == 'page_routing'


def test_same_sanitizer_secrets_and_unlimited_call_parameter_before_review(monkeypatch):
    reader, task, routing, recalled, planner, seen = prepare(kind='secret')
    reader.secrets = ('PRIVATE-CREDENTIAL',)
    original_safe, original_sanitize = generic.safe_text, generic._sanitize_untrusted_text
    safe_calls, limits = [], []
    def spy_safe(value, secrets=()):
        safe_calls.append((value, secrets))
        return original_safe(value, secrets)
    def spy_sanitize(value, *, max_length):
        limits.append(max_length)
        return original_sanitize(value, max_length=max_length)
    monkeypatch.setattr(generic, 'safe_text', spy_safe)
    monkeypatch.setattr(generic, '_sanitize_untrusted_text', spy_sanitize)
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt and seen['reviewInput']['answerBlocks'][0]['text'] == receipt['blocks'][0]['text']
    assert (seen['rawText'], reader.secrets) in safe_calls
    assert limits and all(limit is None for limit in limits)
    assert 'PRIVATE-CREDENTIAL' not in json.dumps(payload)
    assert safe_text(receipt['blocks'][0]['text'], reader.secrets) == receipt['blocks'][0]['text']
    assert receipt['blocks'][0]['text'] in render_generic_answer(payload)
    assert len(planner.calls) == 2


@pytest.mark.parametrize('kind', ['unstable', 'empty', 'oversize_after_redaction'])
def test_unstable_empty_or_oversized_display_falls_back_before_review(kind):
    reader, task, routing, recalled, planner, seen = prepare(kind=kind)
    if kind == 'oversize_after_redaction': reader.secrets = ('tiny',)
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt is None and 'supplementalExplanation' not in payload
    assert len(planner.calls) == 1 and seen['reviewInput'] is None
    assert payload['missing'] == routing.missing and payload['result'] == 'not_confirmed'


def test_review_note_stabilization_cannot_change_judgment_ids_or_evidence():
    review = KnowledgeAnswerReview.model_validate({'stage': 'knowledge_answer_review',
        'checks': [{'requirementId': 'one', 'status': 'not_yet_verified', 'quoteIndexes': [0],
            'reason': 'Not\n confirmed.', 'pointChecks': [{'pointIndex': 0, 'covered': False,
                'answerBlockIds': ['one'], 'reason': 'No  current\nproof.'}]}],
        'blockChecks': [{'blockId': 'one', 'supported': False, 'languageMatches': True,
            'customerFacing': True, 'containsUnverifiedRecordFacts': True,
            'reason': 'Review\n notes.', 'unsupportedClaims': ['Current  status\nclaim.']}]})
    result = gap._public_review_notes(review, ())
    before, after = review.model_dump(), result.model_dump()
    assert result.blockChecks[0].supported is False
    assert result.blockChecks[0].containsUnverifiedRecordFacts is True
    assert result.blockChecks[0].unsupportedClaims == ['Current status claim.']
    for b, a in zip(before['blockChecks'], after['blockChecks']):
        for key in b.keys() - {'reason', 'unsupportedClaims'}: assert b[key] == a[key]
    for b, a in zip(before['checks'], after['checks']):
        for key in b.keys() - {'reason', 'pointChecks'}: assert b[key] == a[key]
        for pb, pa in zip(b['pointChecks'], a['pointChecks']):
            for key in pb.keys() - {'reason'}: assert pb[key] == pa[key]


@pytest.mark.parametrize('kind', ['long_claim', 'unstable_note'])
def test_review_note_failure_is_optional_and_does_not_publish_unreviewed_draft(kind):
    reader, task, routing, recalled, planner, seen = prepare()
    original = planner.generic_reader_json
    async def bad_note(**kwargs):
        raw = await original(**kwargs)
        if raw['stage'] == 'knowledge_answer_review':
            if kind == 'long_claim': raw['blockChecks'][0]['unsupportedClaims'] = ['x' * 1801]
            else: raw['blockChecks'][0]['reason'] = 'Reason &amp;amp; other.'
        return raw
    planner.generic_reader_json = bad_note
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt is None and 'supplementalExplanation' not in payload
    assert len(planner.calls) == 2 and payload['missing'] == routing.missing
    assert payload['requirementsSatisfied'] is False


@pytest.mark.parametrize('field', ['source', 'documentVersion', 'definitionOrigin'])
def test_unstable_evidence_metadata_is_not_rewritten_and_resigned(field, monkeypatch):
    reader, task, routing, recalled, planner, seen = prepare()
    original = gap.cited_rule_quotes
    quotes = original(reader, routing, recalled, lambda _: True)
    quotes[0][field] += '\n  altered'
    monkeypatch.setattr(gap, 'cited_rule_quotes', lambda *args: deepcopy(quotes))
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt is None and 'supplementalExplanation' not in payload
    assert len(planner.calls) == 2 and payload['missing'] == routing.missing


@pytest.mark.parametrize('field', ['text', 'sourceTextSHA256', 'recordHash'])
def test_quote_byte_and_record_guards_remain_strict_after_stable_review(field):
    reader, task, routing, recalled, planner, seen = prepare()
    receipt = asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True))
    assert receipt
    receipt['quotes'][0][field] = 'changed'
    # Even a recomputed public hash cannot replace actual citation proof.
    receipt['contentHash'] = gap._hash({k: v for k, v in receipt.items() if k != 'contentHash'})
    reader.supplemental_explanation = receipt
    payload = reader.finish(task=task, error=PipelineError(routing.missing[0], 'knowledge_gap',
        {'routingMissing': list(routing.missing)})).result.payload
    assert 'supplementalExplanation' not in payload
    assert payload['missing'] == routing.missing


def test_renderer_still_refuses_post_seal_text_change():
    reader, task, routing, recalled, planner, seen = prepare(kind='multiline_block')
    receipt, payload = finish(reader, task, routing, recalled)
    assert receipt and gap.explanation_blocks(payload, 'en')
    payload['supplementalExplanation']['blocks'][0]['text'] += ' New unsupported promise.'
    assert gap.explanation_blocks(payload, 'en') == []
