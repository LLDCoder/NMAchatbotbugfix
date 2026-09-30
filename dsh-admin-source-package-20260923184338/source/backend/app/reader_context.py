"""Conversation intent and browser hints, deliberately separate from live facts."""
from datetime import datetime, timezone, timedelta
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .generic_reader_contracts import ClarificationRequest, SlotUpdate, TaskSpec


INTENT_FIELDS = ("businessObject", "businessFocus", "disclosurePurpose", "requestedScope", "requestedGrain",
                 "requestedMeasures", "requestedAttributes", "groupBy", "timeRange", "filters", "outputShape",
                 "recordIdentity", "view", "timeField", "requestedOrdering", "groupCompleteness")
EMPTY = {"groupCompleteness": "observed", "requestedScope": "unknown", "requestedGrain": "unknown", "timeRange": "unknown",
         "requestedMeasures": [], "requestedAttributes": [], "requestedOrdering": [], "groupBy": [], "filters": []}
PRIVATE_KEY = re.compile(r"token|password|secret|cookie|authorization|email|phone|passport", re.I)


class ReaderFilterHint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    value: str = Field(max_length=500)


class ReaderPageContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    route: str = Field(min_length=1, max_length=500)
    query: dict[str, str] = Field(default_factory=dict, max_length=30)
    view: str = Field(default="", max_length=300)
    selectedRecordKeys: list[str] = Field(default_factory=list, max_length=20)
    browserTimezone: str = Field(default="UTC", max_length=80)
    filters: list[ReaderFilterHint] = Field(default_factory=list, max_length=20)
    capturedAt: str = Field(default="", max_length=64)

    @field_validator("filters")
    @classmethod
    def public_filter_hints(cls, values):
        return [value for value in values if not PRIVATE_KEY.search(value.name)]

    @field_validator("capturedAt")
    @classmethod
    def aware_capture_time(cls, value):
        if value and datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is None:
            raise ValueError('capture time requires timezone')
        return value

    @field_validator("route")
    @classmethod
    def local_route(cls, value):
        if not value.startswith("/") or value.startswith("//") or any(c in value for c in "?#\\\r\n"):
            raise ValueError("page route must be a local pathname")
        return value

    @field_validator("query")
    @classmethod
    def bounded_query(cls, value):
        if any(len(k) > 100 or len(v) > 500 for k, v in value.items()):
            raise ValueError("page parameter too long")
        return {k: v for k, v in value.items() if not PRIVATE_KEY.search(k)}

    @field_validator("selectedRecordKeys")
    @classmethod
    def bounded_keys(cls, value):
        if any(len(v) > 300 for v in value):
            raise ValueError("record key too long")
        return value

    @field_validator("browserTimezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, KeyError) as exc:
            raise ValueError("unknown browser timezone") from exc
        return value


def project_history(context):
    """Keep semantic state and provenance, never answers, counts or permissions."""
    if not isinstance(context, dict) or not isinstance(context.get("previousIntent"), dict):
        return {}
    previous = context["previousIntent"]
    allowed = {*INTENT_FIELDS, "question", "answerShape", "dateRange", "filter", "unresolvedSlots"}
    result = {k: v for k, v in previous.items() if k in allowed}
    if "requestedScope" not in result and previous.get("scope") in {"personal", "team", "global", "unknown"}:
        result["requestedScope"] = previous["scope"]
    for key in ("intentState",):
        state = previous.get(key)
        if isinstance(state, dict) and state.get("version") == 1:
            try:
                task = TaskSpec.model_validate(state["task"])
            except (ValueError, KeyError, TypeError):
                continue
            result.update({k: getattr(task, k) for k in INTENT_FIELDS})
            result["task"] = task.model_dump()
            result["slotStates"] = [SlotUpdate.model_validate(x).model_dump() for x in state.get("slotStates", [])]
            for name in ("originalQuestion", "principalFingerprint", "catalogVersion", "referenceTime", "knowledgeVersion", "browserContext",
                         "taskRevision", "taskFingerprint", "clarificationRounds", "lastClarification", "requestId",
                         "failedClarification"):
                if name in state:
                    result[name] = state[name]
            pending = state.get("pendingClarification")
            from .reader_guidance_choices import GuidanceChoices, STATE_KEY
            if STATE_KEY in state:
                try:
                    result[STATE_KEY] = GuidanceChoices.model_validate(state[STATE_KEY]).model_dump()
                except (ValueError, TypeError):
                    result['invalidGuidanceChoices'] = True
            if isinstance(pending, dict):
                request = ClarificationRequest.model_validate({k: pending[k] for k in
                    ("question", "missingSlots", "options") if k in pending})
                result["pendingClarification"] = {**request.model_dump(), **{k: pending[k] for k in
                    ("id", "createdAt", "expiresAt", "taskFingerprint", "knowledgeVersion") if k in pending}}
    navigation = {k: previous[k] for k in ("page", "section", "view") if isinstance(previous.get(k), str)}
    if navigation:
        result["lastRead"] = navigation
    recent = previous.get("recentIntents")
    if isinstance(recent, list):
        result["recentIntents"] = [{k: item[k] for k in ("question", "page", "section", "scope", "answerShape")
                                     if k in item} for item in recent[-3:] if isinstance(item, dict)]
    # Legacy clarification labels have no trusted value mapping. Preserve them
    # as context for interpretation, never turn their index into a record ID.
    if isinstance(previous.get("clarificationOptions"), list):
        result["clarificationOptions"] = [x for x in previous["clarificationOptions"][:3] if isinstance(x, str)]
    return {"previousIntent": result}


def quarantine_failed_clarification(state, result):
    """Retain the draft for diagnostics, without an executable choice binding.

    Also handles previously saved failed results without rewriting their task,
    original question, fingerprints or clarification budget.
    """
    from .reader_upstream_failure import knowledge_dependency_failure
    code = knowledge_dependency_failure(result)
    if not code or not isinstance(state, dict) or not isinstance(state.get('pendingClarification'), dict):
        return state
    copied = deepcopy(state)
    copied['failedClarification'] = {
        'schemaVersion': 'failed-knowledge-clarification/1',
        'actionable': False, 'reason': code, 'requestId': state.get('requestId'),
        'pending': copied.pop('pendingClarification'),
    }
    copied['status'] = 'needs_input'
    return copied


def context_from_state(result, question):
    state = result.get("intentState")
    if not isinstance(state, dict) or state.get("version") != 1:
        return None
    return {"previousIntent": {"question": question, "intentState": quarantine_failed_clarification(state, result),
            "page": result.get("page", ""), "section": result.get("section", "")}}


def clock_context(business_timezone):
    now = datetime.now(timezone.utc)
    return {"nowUtc": now.isoformat(), "businessTimezone": business_timezone,
            "businessNow": now.astimezone(ZoneInfo(business_timezone)).isoformat(),
            "businessDate": now.astimezone(ZoneInfo(business_timezone)).date().isoformat(),
            "source": "server_clock_and_config"}


def bind_history(history, fingerprint, catalog_version):
    previous = history.get("previousIntent", {})
    if previous.get("principalFingerprint") not in (None, fingerprint):
        return {}
    if previous.get("catalogVersion") not in (None, "", catalog_version):
        previous = dict(previous)
        previous.pop("pendingClarification", None)
        previous.pop("lastRead", None)
        previous["contextInvalidation"] = "catalog_version_changed"
    pending = previous.get("pendingClarification") or {}
    if pending.get("expiresAt"):
        try:
            expired = datetime.fromisoformat(pending["expiresAt"]) <= datetime.now(timezone.utc)
        except (ValueError, TypeError):
            expired = True
        if expired:
            previous = dict(previous)
            previous.pop("pendingClarification", None)
            previous["contextInvalidation"] = "clarification_expired"
    return {"previousIntent": previous} if previous else {}


def literal_choice_matches(question, history):
    """Collect every whole-reply alias match before deciding its meaning."""
    pending = (history or {}).get("previousIntent", {}).get("pendingClarification") or {}
    answer = question.strip().casefold().rstrip(".!。！")
    matches = []
    for index, option in enumerate(pending.get("options", []), 1):
        aliases = {str(index), option["id"].casefold(), option["label"].casefold(),
                   f"option {index}", f"第{index}个", ("第一个", "第二个", "第三个")[index - 1],
                   ("first", "second", "third")[index - 1]}
        if answer in aliases:
            matches.append({"clarificationId": pending["id"], "choiceId": option["id"],
                            "updates": option["updates"]})
    return matches


def literal_choice(question, history):
    matches = literal_choice_matches(question, history)
    if len(matches) == 1:
        return matches[0]  # Preserve the existing single-match consumer contract.
    mappings = []
    for match in matches:
        try:
            updates = [SlotUpdate.model_validate(update) for update in match['updates']]
        except (TypeError, ValueError):
            return None
        if not updates or len({u.field for u in updates}) != len(updates):
            return None
        # Order of distinct fields is immaterial. Keep every schema field,
        # source and evidence, scalar/list type, and the order inside a list.
        mappings.append(sorted((u.model_dump() for u in updates), key=lambda u: u['field']))
    # Equivalent aliases may share a deterministic representative only when
    # their complete typed mappings agree; a conflicting alias never wins.
    return matches[0] if matches and all(m == mappings[0] for m in mappings) else None


def browser_context_key(current_page):
    """Semantic navigation hints only; timestamps are not a view change."""
    if not current_page or not current_page.get('routeAuthorized'):
        return None
    return {'route': current_page['route'], 'view': current_page.get('view', ''),
            'query': dict(sorted(current_page.get('query', {}).items())),
            'filters': sorted(current_page.get('filters', []), key=lambda item: (item['name'], item['value']))}


def bind_browser_history(history, current_page):
    """Do not consume a clarification created for another selected view.

    Keep conversational meaning to interpret follow-ups; discard only stale
    navigation and clarification provenance. A browser hint grants no access.
    """
    previous = history.get('previousIntent', {})
    before, after = previous.get('browserContext'), browser_context_key(current_page)
    if not before or not after or before == after:
        return history
    previous = dict(previous)
    for name in ('pendingClarification', 'lastClarification', 'lastRead'):
        previous.pop(name, None)
    previous['contextInvalidation'] = 'browser_context_changed'
    previous['browserContextChange'] = {'previous': before, 'current': after,
        'instruction': 'The selected page/view/filters changed. Interpret a request about the current '
            'view using the new hints and fresh authorized reads. Previous page scope, record selection '
            'and clarification choices are not evidence for the new view. Explicit user conditions '
            'still win; retain unrelated output requirements and verify the new view before answering.'}
    return {'previousIntent': previous}


def clarification_question(question, history, choice):
    """Lexical evidence from a current, bound literal clarification only.

    Callers must pass identity/catalog-bound history. An unrelated follow-up
    cannot borrow the original wording merely because a prior task exists.
    """
    from .reader_routing import task_fingerprint
    previous = history.get('previousIntent', {})
    pending = previous.get('pendingClarification') or {}
    if not choice or not previous.get('principalFingerprint') or not pending.get('id'):
        return question
    try:
        expires = datetime.fromisoformat(pending['expiresAt'])
        valid = (expires > datetime.now(timezone.utc)
            and choice == literal_choice(question, history)
            and pending.get('taskFingerprint') == task_fingerprint(TaskSpec.model_validate(previous['task'])))
    except (KeyError, TypeError, ValueError):
        valid = False
    if not valid:
        return question
    original = previous.get('originalQuestion') or previous.get('question')
    return original if isinstance(original, str) and original.strip() else question


def merge_task(task, history, choice=None):
    """Explicit updates/clears win; omitted follow-up conditions are inherited."""
    previous = history.get("previousIntent", {})
    data = task.model_dump()
    updates = {item.field: item for item in task.slotUpdates}
    if choice and isinstance(previous.get("task"), dict):
        # Stored conversations can predate newly added intent slots.
        data = TaskSpec.model_validate(previous["task"]).model_dump()
        updates = {}
    continuing = task.contextRelation in {"continue", "refine", "clarify"} or bool(choice)
    states = {}
    if continuing:
        states = {x["field"]: x for x in previous.get("slotStates", [])}
        for field in INTENT_FIELDS:
            if field in previous and field not in updates:
                data[field] = previous[field]
    for field, update in updates.items():
        if update.source == "previous":
            if not continuing or field not in previous or update.value != previous[field]:
                raise ValueError("previous slot has no matching conversation evidence")
        if update.source == "clear":
            data[field] = EMPTY.get(field, "")
        else:
            data[field] = update.value
        states[field] = update.model_dump()
    if choice:
        for raw in choice["updates"]:
            update = SlotUpdate.model_validate(raw)
            data[update.field] = EMPTY.get(update.field, "") if update.source == "clear" else update.value
            states[update.field] = {**update.model_dump(), "source": "current",
                                    "evidence": "clarification choice " + choice["choiceId"]}
        data["contextRelation"] = "clarify"
        data["clarification"] = None
        resolved = {item["field"] for item in choice["updates"]}
        data["unresolvedSlots"] = [x for x in data["unresolvedSlots"] if x not in resolved]
        terms = " ".join(str(x["value"]) for x in choice["updates"])
        data["searchQuery"] = (terms + " " + data["searchQuery"])[:800]
    for field in INTENT_FIELDS:
        states.setdefault(field, {"field": field, "source": "current", "value": data[field],
                                  "evidence": "parsed current request"})
    data["slotUpdates"] = list(states.values())
    from .reader_record_request import canonical_record_set_task
    return canonical_record_set_task(TaskSpec.model_validate(data), previous, choice)


def normalize_measure_grain(task):
    """Repair only an explicit entity/measure versus grouping contradiction.

    A different measured entity, an unknown object or an ambiguous measure
    cannot use this correction. Business equivalence and field units still
    require page knowledge and final source validation.
    """
    from .reader_requirements import _words
    entity, grain = _words(task.businessObject), _words(task.requestedGrain)
    if (task.businessObject in {'', 'unknown'} or not entity or not task.requestedMeasures
            or grain == entity or not any(grain == _words(g) for g in task.groupBy)):
        return task, None
    if not all(entity <= _words(measure) or _words(measure) in ({'count'}, {'sum'})
               for measure in task.requestedMeasures):
        return task, None
    updates = [s for s in task.slotUpdates if s.field != 'requestedGrain']
    updates.append(SlotUpdate(field='requestedGrain', source='current', value=task.businessObject,
                             evidence='Entity explicitly named by the requested measures; grouping retained.'))
    corrected = task.model_copy(update={'requestedGrain': task.businessObject, 'slotUpdates': updates})
    return corrected, {'code': 'measure_entity_grain_normalized', 'from': task.requestedGrain,
                       'to': task.businessObject, 'groupBy': task.groupBy,
                       'measureEvidence': task.requestedMeasures}


def validate_record_identity(task, question, history, choice=None):
    """Record literals require intent provenance, never a translated subject hint."""
    from .generic_reader import PipelineError
    from .reader_record_request import validate_record_set_filters
    if task.readOnly and task.needsLiveData:
        validate_record_set_filters(task, question, history)
    identity = task.recordIdentity
    if not identity:
        return
    from .reader_record_request import validate_scalar_record_identity
    if task.readOnly and task.needsLiveData:
        validate_scalar_record_identity(identity)
    previous = history.get('previousIntent', {})
    inherited = ((task.contextRelation in {'continue', 'refine', 'clarify'} or bool(choice))
                 and identity == previous.get('recordIdentity'))
    chosen = any(u.get('field') == 'recordIdentity' and u.get('source') != 'clear'
                 and u.get('value') == identity for u in (choice or {}).get('updates', []))
    literal = bool(re.search(r'(?<!\w)' + re.escape(identity) + r'(?!\w)', question, re.I))
    if not (literal or inherited or chosen):
        raise PipelineError('intent_record_identity_ungrounded', 'planning', details={
            'correction': 'recordIdentity must be a literal record identifier/name supplied in the original question, '
                          'an unchanged identifier from bound continuing history, or the selected clarification. '
                          'Current/signed-in user is a subject scope, not a record number. Leave recordIdentity empty '
                          'when none was supplied; preserve personal scope and every requested attribute.'})


def validate_page_view(task, current_page):
    """A browser-derived view must be the supplied selected view, never its page title.

    This rejects a parser claim; it grants no route or view verification and
    does not change explicit user, continuing or knowledge-backed view requests.
    """
    updates = [u for u in task.slotUpdates if u.field == 'view' and u.source == 'page']
    if not task.view or not updates or not current_page.get('routeAuthorized'):
        return
    selected = current_page.get('view')
    if isinstance(selected, str) and task.view.casefold().strip() == selected.casefold().strip():
        return
    from .generic_reader import PipelineError
    raise PipelineError('intent_page_view_ungrounded', 'planning', details={
        'correction': 'source=page for view must refer to currentPage.view, the selected in-page view. '
            'pageCandidates names identify a page, not a selected tab. If currentPage.view is empty, '
            'do not invent a browser-derived view. Preserve the requested page/business object, '
            'attributes, scope and filters. Keep an explicitly requested view with source=current; '
            'it still requires documented routing and fresh selected-view verification.'})


def validate_literal_view(task, question, history, choice=None):
    """A technical route in an intent slot must be supplied, not guessed."""
    if not re.match(r'^(?:/|https?://)',task.view):return
    previous=history.get('previousIntent',{})
    inherited=((task.contextRelation in {'continue','refine','clarify'} or bool(choice))
               and task.view==previous.get('view'))
    chosen=any(u.get('field')=='view' and u.get('source')!='clear' and u.get('value')==task.view
               for u in (choice or {}).get('updates',[]))
    if task.view in question or inherited or chosen:return
    from .generic_reader import PipelineError
    raise PipelineError('intent_view_ungrounded','planning',details={
        'correction':'Do not put a guessed route in TaskSpec.view. Leave view empty unless the user or bound '
        'continuing intent specified a view. Routing occurs after knowledge retrieval. Preserve every requested '
        'property and literal record identifier; a named record does not imply global, team or personal scope.'})


def validate_task_grain(task):
    """Ask the parser to repair a unit/dimension contradiction, never guess a field."""
    from .reader_requirements import _words
    from .generic_reader import PipelineError
    scope = _words(task.requestedScope)
    if task.groupCompleteness == 'complete_domain' and not task.groupBy:
        raise PipelineError('intent_group_domain_without_dimension', 'planning', details={
            'correction': 'Preserve the requested grouping dimension when retaining all domain members, including zero-count groups. Do not turn grouping into a record filter.'})
    if task.groupBy and any(re.search(r'\binclude\b.*\beven (?:if|when|with)\b.*\b(?:zero|0)\b', value, re.I)
                           for value in task.filters):
        raise PipelineError('intent_group_output_filter_conflict', 'planning', details={
            'correction': 'The instruction to include a group even with zero matching rows is an output completeness policy. Set groupCompleteness=complete_domain, retain the original groupBy and every actual population/name/membership filter, and remove only that output-policy phrase from filters. Do not discard an explicit zero-only population filter.'})
    if task.requestedScope != 'unknown' and any(
            _words(f) in (scope, scope | {'my'}) for f in task.filters):
        raise PipelineError('intent_scope_filter_duplicate', 'planning', details={
            'correction': 'The exact scope is already represented by requestedScope. Do not repeat '
                          'that same scope alone (with or without my) as an independent row filter. '
                          'Keep any additional domain, named owner, managed-team, exclusion or other '
                          'qualifier unchanged. This is not permission to broaden the requested scope.'})
    def measure_terms(value):
        return _words(value) - {'count', 'number', 'of', 'total'}
    if task.outputShape == 'count' and any(
            measure_terms(a) and measure_terms(a) == measure_terms(m)
            for a in task.requestedAttributes for m in task.requestedMeasures):
        raise PipelineError('intent_measure_attribute_conflict', 'planning', details={
            'correction': 'The same computed count was requested as both a measure and a stored detail '
                          'attribute. Preserve the measure and its conditions. For count-only output, '
                          'do not duplicate it as a row attribute. If individual record details were '
                          'also explicitly requested, preserve those using list/detail output.'})
    if task.outputShape == 'count' and any(_words(a) == _words(g)
            for a in task.requestedAttributes for g in task.groupBy):
        raise PipelineError('intent_group_attribute_conflict', 'planning', details={
            'correction': 'A count grouped by a dimension already returns that dimension. Re-read the question; '
                          'do not add the same dimension as a separate row-detail attribute. If the user explicitly '
                          'also requests individual record details, preserve that request with a list/detail output '
                          'shape rather than a count-only shape. Do not remove the grouping.'})
    focus = _words(task.businessFocus)
    if focus and any(focus == _words(attribute) for attribute in task.requestedAttributes):
        raise PipelineError('intent_population_attribute_conflict', 'planning', details={
            'correction': 'businessFocus denotes which entities belong to the requested population, not an attribute '
                          'to return. Re-read the question; retain all requestedAttributes and leave businessFocus empty '
                          'unless the user specifies an additional population condition.'})
    # Separate requested measures must not silently become an additional
    # shared conjunction. Reject the contradictory parse; do not delete any
    # user condition or infer a page-specific population.
    if len(task.requestedMeasures) > 1 and 'and' in focus:
        operators = {'count', 'number', 'of', 'total', 'sum', 'and'}
        entity = _words(task.businessObject) | _words(task.requestedGrain)
        terms = focus - operators - entity
        measures = [_words(value) - operators - entity for value in task.requestedMeasures]
        if (terms and all(terms & words for words in measures)
                and terms <= set.union(*measures) and not terms <= set.intersection(*measures)):
            raise PipelineError('intent_population_measure_conflict', 'planning', details={
                'correction': 'businessFocus must be an independently requested shared base population, not the '
                              'conjunction of different requested measure populations. Preserve every requested '
                              'measure and its conditions. Re-read the question and leave businessFocus empty '
                              'when no additional shared base was requested; never merge the measures.'})
    grain = _words(task.requestedGrain)
    if (task.requestedMeasures and grain and grain != _words(task.businessObject)
            and any(grain == _words(dimension) for dimension in task.groupBy)):
        raise PipelineError('intent_grain_dimension_conflict', 'planning', details={
            'correction': 'requestedGrain is the entity being measured, not a groupBy dimension. '
                          'Re-read the original question to distinguish an entity list with related '
                          'attributes from an explicitly requested aggregation. Preserve every user '
                          'constraint, requested attribute and explicit measure/grouping; do not preserve '
                          'a count or groupBy that only the rejected candidate invented. For an entity '
                          'list with related attributes, keep those attributes and a coherent entity '
                          'grain without inventing counts. For an actual aggregation, preserve the '
                          'requested measure and groupBy, using the counted/measured entity as grain '
                          'or unknown when unspecified. Keep unfamiliar requested business attributes '
                          'for later knowledge verification, not as a missing user choice. Do not infer '
                          'permissions, change scope or remove a genuine requested statistic.'})


def constrain_inferred_view(draft, candidate, known_views):
    """Do not promote an unverified model suggestion into a user requirement.

    Explicit/current and inherited views are preserved. Unknown knowledge-only
    suggestions remain unset until page-specific knowledge and live verification
    can establish the view; population/filter requirements are never removed.
    """
    allowed = {str(value).casefold() for view in known_views for value in
               [view.get('id', ''), view.get('label', ''), *view.get('aliases', [])] if value}
    update = next((s for s in candidate.slotUpdates if s.field == 'view'), None)
    if (not draft.view and candidate.view and update and update.source == 'knowledge'
            and candidate.view.casefold() not in allowed):
        candidate.view = ''
        candidate.slotUpdates = [s for s in candidate.slotUpdates if s.field != 'view']
        prior = next((s for s in draft.slotUpdates if s.field == 'view'), None)
        if prior:
            candidate.slotUpdates.append(prior.model_copy(deep=True))
        return True
    return False


def refine_task(draft, candidate):
    # There is no new user input between these passes. Knowledge can resolve
    # unspecified slots, but cannot replace explicit/inherited requirements.
    # Canonical aliases belong in evidence bindings, not in rewritten intent.
    previous = {k: getattr(draft, k) for k in INTENT_FIELDS}
    previous["slotStates"] = [x.model_dump() for x in draft.slotUpdates]
    states = {item.field: item for item in candidate.slotUpdates}
    # Retrieved knowledge cannot invent a user purpose, even while it is unresolved.
    preserved = {"disclosurePurpose": draft.disclosurePurpose}
    purpose_state = next((s for s in draft.slotUpdates if s.field == "disclosurePurpose"), None)
    if purpose_state is not None:
        states["disclosurePurpose"] = purpose_state
    else:
        states.pop("disclosurePurpose", None)
    from .reader_record_request import record_filter_identifiers
    bare_record_set = (draft.outputShape == 'list' and draft.readOnly and draft.needsLiveData
        and not draft.recordIdentity and not draft.view and not draft.businessFocus
        and draft.requestedScope == 'unknown' and draft.timeRange in {'', 'unknown'}
        and not draft.timeField and len(draft.filters) == 1
        and bool(record_filter_identifiers(draft.filters[0]))
        and not any(getattr(draft, field) for field in (
            'requestedAttributes', 'requestedMeasures', 'requestedOrdering', 'groupBy', 'unresolvedSlots')))
    for state in draft.slotUpdates:
        value = getattr(draft, state.field)
        concrete = bool(value) and value != "unknown"
        # Empty requested constraints/outputs mean none were requested, not a
        # blank check for retrieved page text to invent a new requirement.
        # Explicit unresolved slots and navigation/identity hints can still be
        # resolved from knowledge; no new user message arrives in this pass.
        # A bare exact identifier set does not select the page's default tab.
        # Even a documented tab would narrow that user population. Keep its
        # explicit/inherited empty view; other unresolved view inference stays.
        specified_empty = ((state.field in {'businessFocus', 'disclosurePurpose', 'filters', 'groupBy',
                            'requestedMeasures', 'requestedAttributes', 'requestedOrdering', 'timeRange'}
                            or state.field == 'view' and bare_record_set)
                           and value in ('', []) and state.field not in draft.unresolvedSlots)
        if state.source == "clear" or (state.source in {"current", "previous"} and (concrete or specified_empty)):
            preserved[state.field] = value
            states[state.field] = state
    # Restore draft-owned slots BEFORE merge_task checks inherited provenance.
    # Otherwise a knowledge alias mislabeled as source=previous rejects the
    # whole refinement before this existing ownership rule can retain the
    # original value. Ordinary conversation merges remain strict; unresolved
    # slots still have to pass their unchanged provenance validation.
    retained = candidate.model_copy(update={**preserved, "slotUpdates": list(states.values()),
                                           "contextRelation": "refine"})
    refined = merge_task(retained, {"previousIntent": previous})
    states = {item.field: item for item in refined.slotUpdates}
    if purpose_state is None:
        states.pop("disclosurePurpose", None)
    from .reader_record_request import canonical_record_set_task
    return canonical_record_set_task(refined.model_copy(update={**preserved, "slotUpdates": list(states.values()),
                                      "contextRelation": draft.contextRelation,
                                      # References resolve meanings, not the
                                      # user's requested operation or intent.
                                      "needsLiveData": draft.needsLiveData,
                                      "evidenceExplanations": draft.evidenceExplanations,
                                      "readOnly": draft.readOnly, "responseMode": draft.responseMode}))


def save_intent(task, question, history, request_id, fingerprint, catalog_version, reference_time,
                *, knowledge_version="", ttl_seconds=1800, current_page=None):
    from .reader_routing import task_fingerprint
    from .reader_record_request import canonical_record_set_task
    task = canonical_record_set_task(task)
    previous = history.get("previousIntent", {})
    continuing = task.contextRelation in {"continue", "refine", "clarify"}
    original = previous.get("originalQuestion") or previous.get("question") if continuing else question
    now = datetime.now(timezone.utc)
    pending = ({**task.clarification.model_dump(), "id": request_id + ":clarification",
                "createdAt": now.isoformat(), "expiresAt": (now + timedelta(seconds=ttl_seconds)).isoformat(),
                "taskFingerprint": task_fingerprint(task), "knowledgeVersion": knowledge_version}
               if task.clarification else None)
    return {"version": 1, "task": task.model_dump(), "slotStates": [x.model_dump() for x in task.slotUpdates],
            "originalQuestion": original or question, "principalFingerprint": fingerprint,
            "catalogVersion": catalog_version, "referenceTime": reference_time,
            "browserContext": browser_context_key(current_page),
            "knowledgeVersion": knowledge_version, "taskFingerprint": task_fingerprint(task),
            "taskRevision": int(previous.get("taskRevision", 0)) + 1 if continuing else 1,
            "requestId": request_id, "parentRequestId": previous.get("requestId") if continuing else None,
            "clarificationRounds": (int(previous.get("clarificationRounds", 0)) if continuing else 0) + bool(pending),
            "lastClarification": previous.get("pendingClarification") or previous.get("lastClarification") if continuing else None,
            "status": "awaiting_clarification" if pending else "cancelled" if task.contextRelation == "cancel" else "ready",
            "pendingClarification": pending}


def load_catalog(directory, allowed_route):
    """Project the existing catalog; do not create a second route registry."""
    if not directory:
        return [], ""
    content = (Path(directory) / "page-catalog.json").read_bytes()
    pages = []
    for item in json.loads(content):
        routes = [x["path"] for x in item.get("routes", []) if isinstance(x, dict)
                  and isinstance(x.get("path"), str) and allowed_route(x["path"])]
        if not routes:
            continue
        parameters = item.get("queryParameters", [])
        names = [x if isinstance(x, str) else x.get("name", x.get("key", "")) for x in parameters]
        pages.append({"id": item.get("graphId", item.get("name")), "name": item.get("name"),
                      "routes": routes, "module": item.get("module"),
                      "standaloneRoutes": [x['path'] for x in item.get('routes', [])
                          if isinstance(x, dict) and x.get('path') in routes
                          and (not x.get('activeMenuPath') or x['activeMenuPath'] == x['path'])],
                      "businessNavigation": [
                          {"route": x['path'], "label": x['title']}
                          for x in item.get('routes', []) if isinstance(x, dict)
                          and x.get('path') in routes and isinstance(x.get('title'), str)
                          and not item.get('publicRoutes')
                          and (x.get('isMenu') is True or x.get('origin') == 'configured-nested')
                          and (not x.get('activeMenuPath') or x['activeMenuPath'] == x['path'])],
                      "description": str(item.get("businessDescription", ""))[:1200],
                      # Curated navigation purpose only, never a row/field or
                      # export grant. Absent or unknown metadata stays absent.
                      **({'navigationPurpose': 'aggregate_report'}
                         if item.get('navigationPurpose') == 'aggregate_report' else {}),
                      "fields": item.get("fieldNames", [])[:30],
                      "parameters": [x for x in names if x and not PRIVATE_KEY.search(x)],
                      "verified": item.get("runtimeVerified", False)})
    return pages, hashlib.sha256(content).hexdigest()


def page_hint(raw, catalog, allowed_route):
    if not raw:
        return {}
    context = ReaderPageContext.model_validate(raw).model_dump()
    matches = [p for p in catalog if context["route"] in p["routes"]]
    if not matches or not allowed_route(context["route"]):
        return {"status": "unavailable", "reason": "page_not_in_authorized_catalog"}
    parameters = {name for p in matches for name in p["parameters"]}
    context["query"] = {k: v for k, v in context["query"].items() if k in parameters}
    # Resolve the user's page reference using the existing authorized catalog,
    # never a browser-supplied title or inferred permissions/business values.
    page_candidates = [{key: str(page[key])[:1200 if key == "description" else 200]
                        for key in ("id", "name", "module", "description")
                        if isinstance(page.get(key), str)} for page in matches]
    return {**context, "source": "browser_hint", "routeAuthorized": True,
            "pageCandidates": page_candidates,
            "recordVerified": False, "viewVerified": False, "filtersVerified": False,
            "instruction": "Current explicit request wins. For a relative reference to this page, this view or the current workspace, use these exact-route pageCandidates and the selected view to resolve the intended page. Resolving a supplied page reference is not changing the question to fit an available page. Do not ask the user to choose unrelated workspaces merely because the account can access them. Multiple plausible objects within this page may still need clarification. An independently named object, department or record overrides an unrelated browser location. The catalog describes navigation, not personal/team ownership, row populations or live facts; verify those using applicable knowledge and a fresh authorized read. Applied browser filters describe the submitted page context, not live facts. When the question refers to this view, retain its filter requirements and verify their documented meaning and actual source request through an authorized fresh read. Never assume a new browser opens with these filters already applied."}


def page_knowledge(directory, catalog):
    if not directory:
        return []
    routes = {route for p in catalog for route in p["routes"]}
    chunks = []
    for file in sorted((Path(directory) / "KB/pages").glob("*/*/*.json")):
        data = json.loads(file.read_text())
        records = [r for r in data.get("records", []) if r.get("status") == "active"
                   and set(r.get("applicability", {}).get("pageRefs", [])) & routes]
        if records:
            chunks.append({"id": str(file.relative_to(directory)), "source_name": str(file.relative_to(directory)),
                           "source_type": "local_page_knowledge",
                           "content": json.dumps({**data, "records": records}, ensure_ascii=False)})
    return chunks
