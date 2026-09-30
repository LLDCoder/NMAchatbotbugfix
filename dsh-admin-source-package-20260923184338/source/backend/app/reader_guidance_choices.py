"""User choices survive a blocked action's conversion to read-only guidance.

This is intent state, not record evidence. Knowledge can explain a chosen
workflow; it cannot choose its subject or destination for the user.
"""
from copy import deepcopy
from datetime import datetime, timezone
import re
import unicodedata
from typing import Literal, get_args

from pydantic import Field, model_validator
from .generic_reader_contracts import Contract, TaskSpec, IntentField, SlotUpdate, ClarificationRequest

STATE_KEY = 'readonlyGuidanceChoices'
FIELDS = set(get_args(IntentField))
CONTINUING = {'continue', 'refine', 'clarify'}


class UserReply(Contract):
    question: str = Field(min_length=1)
    canonicalQuestion: str = Field(min_length=1)


class PersistedSelection(Contract):
    clarificationId: str = Field(min_length=1)
    choiceId: str = Field(min_length=1)
    request: ClarificationRequest
    principalFingerprint: str = Field(min_length=1)
    catalogVersion: str
    taskFingerprint: str = Field(min_length=1)
    knowledgeVersion: str
    expiresAt: str = Field(min_length=1)


class ChoiceAnswer(Contract):
    field: IntentField
    value: str | list[str]
    question: str = Field(min_length=1)
    canonicalQuestion: str = Field(min_length=1)
    selection: PersistedSelection | None = None


class GuidanceChoices(Contract):
    schemaVersion: Literal['readonly-guidance-choices/2'] = 'readonly-guidance-choices/2'
    requestedTask: TaskSpec
    originalQuestion: str = Field(min_length=1)
    canonicalQuestion: str = Field(min_length=1)
    fields: list[IntentField] = Field(min_length=1, max_length=10)
    pending: list[IntentField] = Field(max_length=10)
    answers: list[ChoiceAnswer] = Field(default_factory=list, max_length=10)
    replies: list[UserReply] = Field(default_factory=list, max_length=2)

    @model_validator(mode='after')
    def partition(self):
        answered = [a.field for a in self.answers]
        if (self.requestedTask.readOnly or self.requestedTask.requestBoundaries
                or len(self.fields) != len(set(self.fields))
                or len(self.pending) != len(set(self.pending))
                or len(answered) != len(set(answered))
                or set(answered) & set(self.pending)
                or set(answered) | set(self.pending) != set(self.fields)):
            raise ValueError('invalid guidance choice partition')
        if any(not answer_proven(a) for a in self.answers):
            raise ValueError('choice answer lacks affirmative selection evidence')
        if any(not any(r.question == a.question and r.canonicalQuestion == a.canonicalQuestion
                       for r in self.replies) for a in self.answers):
            raise ValueError('choice answer has no retained complete reply')
        return self


# Closed discourse/control tokens are not opaque selection values. This is a
# grammar boundary, not a list of departments, record types or business names.
_NON_VALUES = frozenset(('no not never none neither either nor or and yes yep yeah nope nah '
    'ok okay cancel stop unknown unspecified maybe perhaps if unless otherwise without '
    'نعم لا كلا ليس ليست لست لن لم غير بدون ربما أو او و إذا اذا إن ان إلغاء الغاء '
    'مجهول غيرمعروف').split())


def atom(value):
    if not isinstance(value, str):
        return ''
    value = unicodedata.normalize('NFKC', value.strip()).casefold()
    # No punctuation stripping, quotes, slash alternatives, whitespace or
    # sentences. Hyphen/underscore are limited opaque-reference separators.
    if not re.fullmatch(r'[^\W_]+(?:[-_][^\W_]+)*', value) or len(value) > 256:
        return ''
    return '' if any(part in _NON_VALUES for part in re.split('[-_]', value)) else value


def direct_selection(value, question):
    # Translated text is not authority to select a value absent from the raw
    # answer. In particular a faulty translation cannot erase a raw negation.
    selected = atom(value)
    return bool(selected) and value == question.strip() and bool(atom(question))


def answer_proven(answer):
    if answer.selection is None:
        return direct_selection(answer.value, answer.question)
    from .reader_context import literal_choice
    proof = answer.selection
    chosen = literal_choice(answer.question, {'previousIntent': {'pendingClarification': {
        **proof.request.model_dump(), 'id': proof.clarificationId}}})
    return bool(chosen and chosen['choiceId'] == proof.choiceId and any(
        u['field'] == answer.field and u['value'] == answer.value and u['source'] != 'clear'
        for u in chosen['updates']))


def declared_slots(task):
    slots = list(dict.fromkeys([*task.unresolvedSlots,
        *(task.clarification.missingSlots if task.clarification else [])]))
    if any(s not in FIELDS for s in slots) or len(slots) > 10:
        from .generic_reader import PipelineError
        raise PipelineError('guidance_choice_slot_invalid', 'planning')
    return slots


def new_choices(alternative, slots):
    return GuidanceChoices(requestedTask=TaskSpec.model_validate(alternative['requestedTask']),
        originalQuestion=alternative['originalQuestion'], canonicalQuestion=alternative['canonicalQuestion'],
        fields=list(slots), pending=list(slots))


def pending_choices(reader):
    state = getattr(reader, 'guidance_choices', None)
    return list(state.pending) if state else []


def resume_choices(history, parsed, question, canonical, fingerprint, catalog_version):
    """Only a new literal answer to a still-bound pending request clears slots."""
    previous = (history or {}).get('previousIntent') or {}
    from .generic_reader import PipelineError
    from .reader_context import literal_choice, literal_choice_matches
    matches = literal_choice_matches(question, history)
    chosen = literal_choice(question, history)
    continuing = parsed.contextRelation in CONTINUING or bool(matches)
    if previous.get('invalidGuidanceChoices') and continuing:
        raise PipelineError('guidance_choice_state_invalid', 'clarification')
    raw = previous.get(STATE_KEY)
    if not raw or not continuing:
        return None, []
    from .reader_routing import task_fingerprint
    try:
        state = GuidanceChoices.model_validate(raw)
        if not state.pending:
            return None, []  # A completed clarification is not a new pending request.
        pending = previous['pendingClarification']
        previous_task = TaskSpec.model_validate(previous['task'])
        request = ClarificationRequest.model_validate({k: pending[k]
            for k in ('question', 'missingSlots', 'options')})
        valid = (previous.get('principalFingerprint') == fingerprint
            and previous.get('catalogVersion') == catalog_version
            and not previous.get('contextInvalidation') and not previous.get('browserContextChange')
            and pending['id'] == previous['requestId'] + ':clarification'
            and pending['taskFingerprint'] == task_fingerprint(previous_task)
            and previous_task.clarification == request
            and pending.get('knowledgeVersion', '') == previous.get('knowledgeVersion', '')
            and datetime.fromisoformat(pending['expiresAt']) > datetime.now(timezone.utc))
        if not valid:
            raise ValueError('unbound clarification')
    except (KeyError, TypeError, ValueError):
        raise PipelineError('clarification_context_expired', 'clarification') from None
    if len(state.replies) >= 2:
        raise PipelineError('clarification_budget_exhausted', 'clarification')
    state.replies.append(UserReply(question=question, canonicalQuestion=canonical))
    new_fields = declared_slots(parsed)
    changed = {a.field for a in state.answers if a.field in new_fields or any(
        u.field == a.field and (u.source == 'clear' or
            (u.source == 'current' and u.value != a.value)) for u in parsed.slotUpdates)}
    # Current withdrawal, correction or renewed uncertainty invalidates the old
    # answer before any other slot is accepted. A replacement still needs its
    # own affirmative evidence; retaining the full sentence alone is not enough.
    state.answers = [a for a in state.answers if a.field not in changed]
    state.pending = [f for f in state.fields if f in set(state.pending) | changed]
    selection = None
    if chosen:
        selection = PersistedSelection(clarificationId=pending['id'], choiceId=chosen['choiceId'],
            request=request, principalFingerprint=fingerprint, catalogVersion=catalog_version,
            taskFingerprint=pending['taskFingerprint'], knowledgeVersion=pending.get('knowledgeVersion', ''),
            expiresAt=pending['expiresAt'])
        updates = [SlotUpdate.model_validate(u) for u in chosen['updates']]
        if (any(u.field not in state.pending or u.source == 'clear' for u in updates)
                or len({u.field for u in updates}) != len(updates)):
            raise PipelineError('guidance_choice_mapping_invalid', 'clarification')
    elif matches:
        # A conflicting offered alias is not a new bare value. Keep the full
        # reply and pending slots, even if the parser guesses a current value.
        updates = []
    else:
        updates = [u for u in parsed.slotUpdates if u.field in state.pending and u.source == 'current'
            and u.field not in declared_slots(parsed) and u.value == getattr(parsed, u.field)
            and u.value != getattr(state.requestedTask, u.field) and direct_selection(u.value, question)]
        # One bare value cannot decide which of several fields it answers.
        if len(updates) != 1:
            updates = []
    accepted = []
    for update in updates:
        state.answers.append(ChoiceAnswer(field=update.field, value=deepcopy(update.value),
            question=question, canonicalQuestion=canonical, selection=selection))
        state.pending.remove(update.field)
        accepted.append(update.field)
    if len(set(state.fields) | set(new_fields)) > 10:
        raise PipelineError('guidance_choice_slot_invalid', 'planning')
    for field in new_fields:
        if field not in state.fields:
            state.fields.append(field); state.pending.append(field)
    return GuidanceChoices.model_validate(state.model_dump()), accepted


_LABELS = {
    'businessObject': ('the type of business record', 'نوع سجل العمل'),
    'recordIdentity': ('the record type and reference', 'نوع السجل ورقمه المرجعي'),
    'businessFocus': ('the intended action, target or condition', 'الإجراء أو الجهة المستهدفة أو الشرط المقصود'),
    'disclosurePurpose': ('the purpose of the requested information', 'الغرض من المعلومات المطلوبة'),
    'requestedScope': ('the intended scope', 'النطاق المقصود'),
    'requestedGrain': ('the unit to describe', 'الوحدة المطلوب وصفها'),
    'requestedMeasures': ('the measurements requested', 'المقاييس المطلوبة'),
    'requestedAttributes': ('the information requested', 'المعلومات المطلوبة'),
    'groupBy': ('the grouping requested', 'التجميع المطلوب'),
    'timeRange': ('the time period', 'الفترة الزمنية'),
    'filters': ('the requested conditions', 'الشروط المطلوبة'),
    'outputShape': ('the form of the answer', 'شكل الإجابة'),
    'view': ('the intended view', 'العرض المقصود'),
    'timeField': ('which date is meant', 'التاريخ المقصود'),
    'requestedOrdering': ('the ordering requested', 'الترتيب المطلوب'),
    'groupCompleteness': ('the groups to include', 'المجموعات المطلوب تضمينها'),
}


def clarification_for(state, language):
    fields = state.pending[:5]
    labels = [_LABELS[f][language == 'ar'] for f in fields]
    question = (('لم يُجرَ أي تعديل. لتحديد الشرح المناسب لطلبك، يرجى توضيح: ' + '؛ '.join(labels) +
                 '. يرجى تقديم قيمة واحدة مباشرة أو اختيار أحد الخيارات المعروضة. ستبقى الشروط التي ذكرتها محفوظة.')
                if language == 'ar' else
                ('No business change was made. To identify the relevant guidance for your request, please specify: '
                 + '; '.join(labels) + '. Please reply with one value directly, or select an offered option. '
                 'Your stated conditions will be retained.'))
    original = state.requestedTask.clarification
    options = [o for o in (original.options if original else [])
        if all(u.field in fields and u.source != 'clear' for u in o.updates)]
    return ClarificationRequest(question=question, missingSlots=fields, options=options)


def active_task(state, language, relation='new'):
    from .reader_guidance import guidance_task
    original = state.requestedTask.model_copy(deep=True)
    states = {s.field: s for s in original.slotUpdates}
    for answer in state.answers:
        setattr(original, answer.field, deepcopy(answer.value))
        states[answer.field] = SlotUpdate(field=answer.field, source='current', value=answer.value,
            evidence='Literal user clarification; no record or action authority.')
    original.slotUpdates = list(states.values())
    result = guidance_task(original, state.canonicalQuestion)
    # Never let a selected target replace the original conjuncts or safeguards.
    requirements = guidance_task(state.requestedTask, state.canonicalQuestion).requestedAttributes
    requirements.append('Preserve every action and condition in the original blocked request: ' +
                        state.canonicalQuestion)
    for answer in state.answers:
        requirements.append('User explicitly selected ' + _LABELS[answer.field][0] + ': ' + str(answer.value))
    for reply in state.replies:
        requirements.append('Retain the conditions in this complete user follow-up unless explicitly '
            'revised later; current selected values override superseded selections. This history does '
            'not itself prove any other selection. Original: ' + reply.question + ' Canonical: ' + reply.canonicalQuestion)
    result.requestedAttributes = requirements
    result.slotUpdates = [s for s in result.slotUpdates if s.field != 'requestedAttributes'] + [
        SlotUpdate(field='requestedAttributes', source='current', value=requirements,
                   evidence='Original blocked request and literal user clarifications retained.')]
    result.unresolvedSlots = list(state.pending)
    result.clarification = clarification_for(state, language) if state.pending else None
    result.contextRelation = relation
    return TaskSpec.model_validate(result.model_dump())


def attach_choices(reader, state):
    reader.guidance_choices = state
    reader.readonly_alternative = {'requestedTask': state.requestedTask.model_dump(),
        'originalQuestion': state.originalQuestion, 'canonicalQuestion': state.canonicalQuestion,
        'requestedActionExecuted': False, 'reason': 'assistant_read_only', 'choiceState': state.model_dump()}
    reader.audit['readonlyAlternative'] = deepcopy(reader.readonly_alternative)


def pause_choices(reader, task):
    """Exit without a new model, retrieval or business call, using existing TTL."""
    from .generic_reader import PipelineError
    reader.pending_guidance_task = task
    reader.remember_guidance_task(task)
    reader.audit['guidanceUserChoice'] = {'pendingSlots': pending_choices(reader),
        'source': 'original_user_intent_or_structured_user_choice', 'knowledgeCannotResolve': True}
    if reader.intent_state['clarificationRounds'] > 2:
        reader.intent_state['pendingClarification'] = None
        reader.intent_state['status'] = 'needs_input'
        raise PipelineError('clarification_budget_exhausted', 'clarification')
    for stage in ('query_expansion', 'knowledge_retrieval', 'knowledge_coverage', 'page_routing',
                  'page_observation', 'source_selection', 'data_collection', 'analysis'):
        if not any(c['stage'] == stage for c in reader.quality.checks):
            reader.quality.record(stage, 'not_required', code='waiting_for_user_choice')
    raise PipelineError('intent_ambiguous', 'clarification')


def coverage_choices(reader, plan, task):
    if not getattr(reader, 'readonly_alternative', None):
        return
    checks = [c for c in plan.checks if c.missingEvidenceType == 'user_choice']
    if not checks:
        return
    fields = list(dict.fromkeys(f for c in checks for f in c.clarification.missingSlots))
    from .generic_reader import PipelineError
    state = getattr(reader, 'guidance_choices', None)
    if len(set(fields) | set(state.fields if state else [])) > 10:
        raise PipelineError('guidance_choice_slot_invalid', 'planning')
    if state is None:
        state = new_choices(reader.readonly_alternative, fields)
    else:
        for field in fields:
            if field not in state.fields:
                state.fields.append(field); state.pending.append(field)
            elif field not in state.pending:
                # A source cannot unchoose or reinterpret an explicit answer.
                raise PipelineError('guidance_choice_already_supplied', 'planning')
    state = GuidanceChoices.model_validate(state.model_dump())
    attach_choices(reader, state)
    pause_choices(reader, active_task(state, reader.response_language, task.contextRelation))
