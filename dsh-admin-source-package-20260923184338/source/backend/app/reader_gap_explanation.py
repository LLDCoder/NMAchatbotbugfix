"""Optional cited explanations never satisfy an unresolved live request."""
import asyncio
from copy import deepcopy
import hashlib
import json
import time

from .generic_reader_contracts import Citation
from .reader_requirements import requirements_for
from .reader_routing import task_fingerprint
from .reader_answers import (KnowledgeAnswerDraft, KnowledgeAnswerReview,
    ANSWER_DRAFT_PROMPT, ANSWER_REVIEW_PROMPT, validate_answer_draft,
    validate_answer_review, answer_review_input, verified_answer_blocks)

MAX_QUOTES = 12
MAX_CHARACTERS = 12000
OPTIONAL_SECONDS = 30
MIN_STAGE_SECONDS = 5
POLICY = (
    ' This is a supplemental explanation of an UNRESOLVED live request. The original task, '
    'all quantities, period and other conditions remain unmet; do not replace them with a '
    'different task or claim completion. Explain only documented limitations or distinctions '
    'directly supported by finalQuotes, in responseLanguage. A prior routing reason or gap '
    'code is not evidence. Do not infer universal absence from an undocumented feature. '
    'Preserve the original actor: assistant capability, user authorization, source capability '
    'and particular-record eligibility are separate. No current values, predictions, actions, '
    'access grants or denials were established by this explanation. Static historical or '
    'example numbers must not become current values or predictions. Distinguish any supported '
    'historical statistic from the requested output. Preserve documented conditions and limits. '
    'Do not invent missing prerequisites; explain only those explicitly documented. The '
    'requirement checks remain not_yet_verified even when an explanation block is supported. '
    'Independently reject every unsupported factual clause, actor substitution, false task '
    'completion, invented number or unproved scope claim; do not excuse it as a disclaimer.'
)


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _transport_text(value, secrets, limit):
    """Use the same public sanitizer once, rejecting unstable or oversized text."""
    from .generic_reader import PipelineError, safe_text
    if not isinstance(value, str) or len(value) > limit:
        raise PipelineError('optional_explanation_transport_unstable', 'runtime')
    public = safe_text(value, secrets)
    if len(public) > limit or safe_text(public, secrets) != public:
        raise PipelineError('optional_explanation_transport_unstable', 'runtime')
    return public


def _public_draft(draft, task, quotes, requirements, secrets):
    # Review must inspect exactly what finish() and the renderer will publish.
    # No after-review cleanup or truncation of an accepted block is permitted.
    public = draft.model_dump()
    for block in public['blocks']:
        block['text'] = _transport_text(block['text'], secrets, 1800)
    public = KnowledgeAnswerDraft.model_validate(public)
    validate_answer_draft(public, task, quotes, (), requirements=requirements)
    return public


def _public_review_notes(review, secrets):
    # Notes do not grant support: original validated booleans, IDs, references
    # and coverage statuses remain unchanged. No arbitrary nested fields walk.
    public = review.model_dump()
    for check in public['blockChecks']:
        check['reason'] = _transport_text(check['reason'], secrets, 800)
        check['unsupportedClaims'] = [_transport_text(text, secrets, 1800)
                                      for text in check['unsupportedClaims']]
    for check in public['checks']:
        check['reason'] = _transport_text(check['reason'], secrets, 800)
        for point in check['pointChecks']:
            point['reason'] = _transport_text(point['reason'], secrets, 400)
    return KnowledgeAnswerReview.model_validate(public)


def _eligible(reader, task, routing):
    intent = reader.intent_state or {}
    owner = getattr(reader, 'current_observation_owner', {})
    return bool(task.needsLiveData and task.readOnly and task.responseMode == 'answer'
        and not task.requestBoundaries and routing.decision == 'knowledge_gap'
        and not routing.routePlan and not routing.clarification and routing.missing
        and routing.taskFingerprint == task_fingerprint(task)
        and reader.audit.get('routingDecision') == routing.model_dump()
        and intent.get('taskFingerprint') == routing.taskFingerprint
        and intent.get('requestId') and owner.get('principalScopeRef')
        and intent.get('principalFingerprint') == owner['principalScopeRef'])


def _identity_conditions(candidate):
    """Keep only the validated entity applicability conditions, without prose guesses."""
    return [{'requirementId': condition.requirementId, 'status': condition.status}
            for condition in candidate.conditions
            if condition.requirementId in {'object', 'grain', 'record'}]


def cited_rule_quotes(reader, routing, recalled, authorized):
    """Only current validated references to active applicable records are rules."""
    from .generic_reader import safe_text
    knowledge = reader.knowledge
    result, seen = [], set()
    for candidate in routing.candidates:
        page = recalled.get(candidate.candidateId, {}).get('route')
        if not page or not authorized(page):
            return []
        identity_conditions = _identity_conditions(candidate)
        if any(condition['status'] == 'conflict' for condition in identity_conditions):
            continue  # An unrelated entity cannot supply a positive explanation of this task.
        refs = [*candidate.evidence, *(ref for cond in candidate.conditions for ref in cond.evidence)]
        for ref in refs:
            knowledge.cite([ref], required=True, at='supplemental_explanation')
            item = knowledge.source(ref)
            record = item.get('record') or {}
            applicability = record.get('applicability') or {}
            if (not record or record.get('status') != 'active'
                    or record.get('kind') == 'knowledge_gap'
                    or record.get('id') in knowledge.conflicted
                    or type(record.get('revision')) is not int or record['revision'] < 1
                    or not record.get('sources') or applicability.get('portal') != 'admin'
                    or 'local' not in applicability.get('environments', [])
                    or applicability.get('runtimeVerification') == 'failed'
                    or applicability.get('deployedBuildMatch') == 'mismatched'
                    or page not in applicability.get('pageRefs', [])):
                continue  # Catalogs and free prose are not business-rule proof.
            if ref.sourceId in seen:
                continue
            text = knowledge.citation_text(ref)
            quote = {'sourceId': ref.sourceId, 'text': safe_text(text, reader.secrets),
                'source': item['sourceName'], 'recordId': record['id'],
                'revision': record['revision'], 'recordHash': _hash(record), 'documentId': item['documentId'],
                'documentVersion': item['documentVersion'],
                'definitionOrigin': item['definitionOrigin'], 'pageRef': page,
                'sourceTextSHA256': hashlib.sha256(text.encode()).hexdigest(),
                'candidateContext': {'candidateId': candidate.candidateId, 'pageRef': page,
                                     'identityConditions': identity_conditions}}
            result.append(quote); seen.add(ref.sourceId)
    if len(result) > MAX_QUOTES or sum(len(q['text']) for q in result) > MAX_CHARACTERS:
        return []  # Never truncate a condition to fit the optional answer.
    return result


async def explain_gap(reader, task, routing, recalled, authorized):
    """At most one draft and one review within the existing total deadline."""
    reader._supplemental_rule_context = None
    if not _eligible(reader, task, routing):
        return None
    diagnostic = {'status': 'unavailable', 'modelCalls': 0}
    reader.audit['supplementalExplanationAttempt'] = diagnostic
    original_stage = reader.active_quality_stage
    try:
        optional_deadline = min(time.monotonic() + OPTIONAL_SECONDS, reader.deadline - 2)
        remaining = optional_deadline - time.monotonic()
        if remaining < 2 * MIN_STAGE_SECONDS:
            diagnostic['reason'] = 'optional_budget_unavailable'
            return None
        quotes = cited_rule_quotes(reader, routing, recalled, authorized)
        if not quotes:
            diagnostic['reason'] = 'applicable_cited_rules_unavailable'
            return None
        # Leave an equal budget for the independent review before beginning.
        stage_cap = min(reader.budget.planner_seconds, (optional_deadline - time.monotonic()) / 2)
        if stage_cap < MIN_STAGE_SECONDS:
            diagnostic['reason'] = 'optional_budget_unavailable'
            return None
        requirements = requirements_for(task)
        prior = [{'requirementId': r['id'], 'status': 'not_yet_verified',
            'reason': 'The original live request remains unconfirmed; explanation is not execution.'}
            for r in requirements]
        data = {'phase': 'supplemental_gap_explanation', 'question': reader.current_question,
            'task': task.model_dump(), 'requirements': requirements, 'knowledgeCoverage': prior,
            'originalMissing': list(routing.missing), 'allowedRoutes': [],
            'finalQuotes': [{'quoteIndex': i, **q} for i, q in enumerate(quotes)]}
        diagnostic['modelCalls'] += 1
        draft = await reader.structured(KnowledgeAnswerDraft, ANSWER_DRAFT_PROMPT + POLICY,
            data, lambda p: validate_answer_draft(p, task, quotes, (), requirements=requirements),
            attempt_cap=1, time_cap=stage_cap)
        draft = _public_draft(draft, task, quotes, requirements, reader.secrets)
        review_cap = min(stage_cap, optional_deadline - time.monotonic(),
                         reader.deadline - time.monotonic() - 2)
        if review_cap < MIN_STAGE_SECONDS:
            diagnostic['reason'] = 'optional_review_budget_unavailable'
            return None
        diagnostic['modelCalls'] += 1
        review = await reader.structured(KnowledgeAnswerReview, ANSWER_REVIEW_PROMPT + POLICY,
            answer_review_input(data, draft, prior),
            lambda p: validate_answer_review(p, task, quotes, prior, draft.blocks,
                                             requirements=requirements),
            attempt_cap=1, time_cap=review_cap)
        review = _public_review_notes(review, reader.secrets)
        kept = verified_answer_blocks(draft, review)
        diagnostic.update(status='reviewed', acceptedBlockIds=[b.id for b in kept],
                          omittedBlockIds=[b.id for b in draft.blocks if b not in kept])
        if not kept:
            return None
        intent = reader.intent_state
        receipt = {'schemaVersion': 'supplemental-gap-explanation/1',
            'requestId': intent['requestId'], 'principalScopeRef': intent['principalFingerprint'],
            'taskFingerprint': task_fingerprint(task), 'requirements': requirements,
            'routingFingerprint': _hash(routing.model_dump()), 'originalMissing': list(routing.missing),
            'responseLanguage': reader.response_language, 'originalRequestSatisfied': False,
            'blocks': [b.model_dump() for b in kept], 'quotes': quotes,
            'blockChecks': [c.model_dump() for c in review.blockChecks],
            'requirementChecks': [c.model_dump() for c in review.checks]}
        from .generic_reader import clean
        if clean(receipt, reader.secrets, max_items=200) != receipt:
            diagnostic['reason'] = 'optional_explanation_transport_unstable'
            return None  # Do not sign a changed or truncated public receipt.
        receipt['contentHash'] = _hash(receipt)
        # Keep the actual validated routing inputs and authorizer for publication.
        # Recollection must reproduce these exact reviewed quotes, not new evidence.
        reader._supplemental_rule_context = (routing, recalled, authorized)
        return receipt
    except asyncio.CancelledError:
        raise  # User cancellation must not be converted into a completed answer.
    except Exception as error:
        from .generic_reader import PipelineError
        diagnostic['reason'] = error.code if isinstance(error, PipelineError) else 'optional_explanation_unavailable'
        return None  # Preserve the original failure, not the optional stage's failure.
    finally:
        reader.active_quality_stage = original_stage


def project_explanation(reader, payload, task):
    """Recheck original ownership, failure and citation bytes before publication."""
    receipt = getattr(reader, 'supplemental_explanation', None)
    if not receipt or task is None:
        return None
    owner = getattr(reader, 'current_observation_owner', {})
    intent = payload.get('intentState') or {}
    if (payload.get('result') != 'not_confirmed' or payload.get('failureCategory') != 'knowledge_gap'
            or payload.get('requirementsSatisfied') or payload.get('outputs') or payload.get('knowledgeAnswer')
            or payload.get('knowledgeQuotes') or not receipt.get('requestId')
            or receipt['requestId'] != intent.get('requestId')
            or receipt['principalScopeRef'] != owner.get('principalScopeRef')
            or receipt['principalScopeRef'] != intent.get('principalFingerprint')
            or receipt['taskFingerprint'] != task_fingerprint(task)
            or receipt['taskFingerprint'] != payload.get('taskFingerprint')
            or receipt['requirements'] != payload.get('requirements')
            or receipt['originalMissing'] != payload.get('missing')
            or receipt['routingFingerprint'] != _hash(reader.audit.get('routingDecision'))
            or receipt['responseLanguage'] != getattr(reader, 'response_language', 'en')
            or receipt.get('contentHash') != _hash({k: v for k, v in receipt.items() if k != 'contentHash'})):
        return None
    from .generic_reader import PipelineError, safe_text
    try:
        context = getattr(reader, '_supplemental_rule_context', None)
        if not context:
            return None
        routing, recalled, authorized = context
        if (routing.model_dump() != reader.audit.get('routingDecision')
                or cited_rule_quotes(reader, routing, recalled, authorized) != receipt['quotes']):
            return None
        for q in receipt['quotes']:
            ref = Citation(sourceId=q['sourceId'])
            reader.knowledge.cite([ref], required=True)
            if (safe_text(reader.knowledge.citation_text(ref), reader.secrets) != q['text']
                    or hashlib.sha256(reader.knowledge.citation_text(ref).encode()).hexdigest() != q['sourceTextSHA256']
                    or reader.knowledge.source(ref)['recordId'] in reader.knowledge.conflicted
                    or _hash(reader.knowledge.source(ref).get('record')) != q['recordHash']
                    or any(reader.knowledge.source(ref).get(key) != q[key]
                           for key in ('recordId', 'documentId', 'documentVersion', 'definitionOrigin'))):
                return None
    except (KeyError, ValueError, TypeError, PipelineError):
        return None
    from .generic_reader import clean
    if clean(receipt, reader.secrets, max_items=200) != receipt:
        return None
    return deepcopy(receipt)


def explanation_blocks(payload, language):
    """Render only the sealed supplemental receipt bound to this failed request."""
    receipt = payload.get('supplementalExplanation') or {}
    intent = payload.get('intentState') or {}
    if (receipt.get('schemaVersion') != 'supplemental-gap-explanation/1'
            or payload.get('result') != 'not_confirmed' or payload.get('failureCategory') != 'knowledge_gap'
            or payload.get('requirementsSatisfied') or payload.get('outputs') or payload.get('knowledgeAnswer')
            or payload.get('knowledgeQuotes') or receipt.get('originalRequestSatisfied') is not False
            or receipt.get('responseLanguage') != language
            or receipt.get('requestId') != intent.get('requestId')
            or receipt.get('principalScopeRef') != intent.get('principalFingerprint')
            or receipt.get('taskFingerprint') != payload.get('taskFingerprint')
            or receipt.get('requirements') != payload.get('requirements')
            or receipt.get('originalMissing') != payload.get('missing')
            or receipt.get('contentHash') != _hash({k: v for k, v in receipt.items() if k != 'contentHash'})):
        return []
    return receipt.get('blocks', [])
