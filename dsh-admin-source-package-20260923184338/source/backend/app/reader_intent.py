"""Bounded conversational intent metadata, never a source of permissions or facts."""

from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata
from typing import Any
from .reader_limits import requested_record_limit


SLOT_NAMES = (
    "businessObject", "businessFocus", "recordIdentity", "view", "dateRange", "filter",
    "requestedScope", "answerShape",
)
_RELATIONS = {"continue", "refine", "switch", "broaden", "clarify"}
_ENUMS = {
    "requestedScope": {"personal", "team", "global", "unknown"},
    "answerShape": {"overview", "count", "list", "attention", "due", "detail", "unspecified"},
}
_CREDENTIAL = re.compile(
    r"(?i)(?:\b(?:password|passwd|authorization|cookie|api[_ -]?key|access[_ -]?token|"
    r"refresh[_ -]?token|secret)\b\s*[:=]\s*\S+|\bbearer\s+\S+|"
    r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b)"
)


def _normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def _literal_identity_in(identity: str, text: str) -> bool:
    return re.search(r"(?<![\w-])" + re.escape(identity) + r"(?![\w-])", text) is not None


def _text(value: Any, limit: int, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError("intent text must be a bounded string")
    if value != value.strip() or (not value and not allow_empty):
        raise ValueError("intent text must be nonempty and trimmed")
    if any(unicodedata.category(char) in {"Cc", "Cf"} for char in value):
        raise ValueError("intent text contains control characters")
    if _CREDENTIAL.search(value):
        raise ValueError("intent text contains credential-like content")
    return value


def _human_section(value: Any) -> str:
    try:
        safe = _text(value, 240)
    except ValueError:
        return ""
    if safe.startswith("/") or re.match(r"(?i)^(?:observation|snapshot|section|table)[-_]\d|^observation[-_]", safe):
        return ""
    return safe


def semantic_source_hint(context: Any) -> dict[str, str]:
    """An optional navigation clue, never a route constraint or authorization."""
    previous = context.get("previousIntent") if isinstance(context, dict) else None
    if not isinstance(previous, dict):
        return {}
    source = previous.get("sourceHint")
    if not isinstance(source, dict):
        source = previous
    hint = {}
    try:
        page = _text(source.get("page"), 240)
        if page.startswith("/") and not page.startswith("//") and not any(char in page for char in "?#\\"):
            hint["page"] = page
    except ValueError:
        pass
    section = _human_section(source.get("section")) or _human_section(source.get("sourceSection"))
    if section:
        hint["section"] = section
    return hint


def _previous_slots(context: Any) -> dict[str, str]:
    previous = context.get("previousIntent") if isinstance(context, dict) else None
    if not isinstance(previous, dict):
        return {}
    values = {}
    for name in SLOT_NAMES:
        try:
            value = _text(previous.get(name), 240)
        except ValueError:
            continue
        if name not in _ENUMS or value in _ENUMS[name]:
            values[name] = value
    focus = (
        _human_section(previous.get("section"))
        or _human_section(previous.get("sourceSection"))
        or semantic_source_hint(context).get("section", "")
    )
    if focus:
        values.setdefault("businessFocus", focus)
    selected_view = _human_section(previous.get("selectedState"))
    if selected_view:
        values.setdefault("view", selected_view)
    prior_intent = previous.get("intentContext")
    slots = prior_intent.get("slots") if isinstance(prior_intent, dict) else None
    if isinstance(slots, dict):
        for name in SLOT_NAMES:
            slot = slots.get(name)
            if not isinstance(slot, dict):
                continue
            if slot.get("source") == "clear" and slot.get("evidence"):
                values.pop(name, None)
                continue
            if slot.get("source") not in {"current", "previous"}:
                continue
            try:
                value = _text(slot.get("value"), 240)
            except ValueError:
                continue
            if name not in _ENUMS or value in _ENUMS[name]:
                values[name] = value
    return values


def _previous_sources(context: Any) -> tuple[list[str], set[str]]:
    previous = context.get("previousIntent") if isinstance(context, dict) else None
    if not isinstance(previous, dict):
        return [], set()
    sources: list[str] = []
    identities: set[str] = set()

    def add(value: Any, limit: int, *, identity: bool = False) -> None:
        if not isinstance(value, str) or not value.strip():
            return
        # Ignore untrusted or legacy oversized metadata, never silently truncate identities.
        try:
            safe = _text(value, limit)
        except ValueError:
            return
        sources.append(_normalized(safe))
        if identity:
            identities.add(_normalized(safe))

    add(previous.get("question"), 500)
    for name, value in _previous_slots(context).items():
        add(value, 240, identity=name == "recordIdentity")
    for name in ("section", "sourceSection"):
        add(_human_section(previous.get(name)), 240)
    intent_context = previous.get("intentContext")
    if isinstance(intent_context, dict):
        slots = intent_context.get("slots")
        if isinstance(slots, dict):
            for name in SLOT_NAMES:
                slot = slots.get(name)
                if not isinstance(slot, dict) or slot.get("source") not in {"current", "previous"}:
                    continue
                add(slot.get("value"), 240, identity=name == "recordIdentity")
                add(slot.get("evidence"), 500)
        options = intent_context.get("clarificationOptions")
        if isinstance(options, list) and len(options) == 2:
            for option in options:
                add(option, 120)
    return sources, identities


@dataclass(frozen=True)
class IntentSlot:
    source: str
    value: str
    evidence: str

    def public_json(self) -> dict[str, str]:
        return {"source": self.source, "value": self.value, "evidence": self.evidence}


@dataclass(frozen=True)
class IntentResolution:
    relation: str
    slots: tuple[tuple[str, IntentSlot], ...]
    clarification_options: tuple[str, ...] = ()

    def public_json(self) -> dict[str, Any]:
        return {
            "relation": self.relation,
            "slots": {name: slot.public_json() for name, slot in self.slots},
            "clarificationOptions": list(self.clarification_options),
        }

    def planner_context(self, previous_context: Any = None) -> dict[str, Any]:
        context = {"resolvedIntent": self.public_json()}
        slots = dict(self.slots)
        focus = slots.get("businessFocus")
        prior_focus = _previous_slots(previous_context).get("businessFocus")
        compatible_focus = focus is not None and not (focus.source == "clear" and focus.evidence)
        if focus and focus.source == "current" and prior_focus:
            compatible_focus = _normalized(focus.value) == _normalized(prior_focus)
        if self.relation in {"continue", "refine"} and compatible_focus:
            hint = semantic_source_hint(previous_context)
            # A previously cleared focus must not return indirectly as a source label.
            if hint and (prior_focus or not hint.get("section") or (focus and focus.value)):
                context["sourceHint"] = hint
        previous = previous_context.get("previousIntent", {}) if isinstance(previous_context, dict) else {}
        pending = previous.get("intentContext", {}) if isinstance(previous, dict) else {}
        if isinstance(pending, dict) and pending.get("relation") == "clarify" and self.relation != "clarify":
            try:
                context["resolvedChoiceOptions"] = list(_clarification_labels(pending.get("clarificationOptions")))
            except ValueError:
                pass
        return context


def resolve_literal_filter_followup(question: str, conversation_context: Any) -> IntentResolution | None:
    """A reference to the same filter retains its source, not its prior UI state."""
    match = re.fullmatch(
        r'\s*(?:please\s+)?(?P<command>open|cancel|close|dismiss)\s+(?:the|that)\s+'
        r'(?:(?:ticket|task)\s+)?filter(?:\s+surface)?'
        r'(?:\s+and\s+(?:list|inspect)\s+(?:its|the available)\s+fields(?:\s+without applying(?: changes| it)?)?'
        r'|\s+and\s+return\s+to\s+the\s+(?:(?:task|tickets?)\s+)?list)?[.!]?\s*', question, re.I)
    hint = semantic_source_hint(conversation_context)
    if not match or not hint.get('page'):
        return None
    prior = _previous_slots(conversation_context)
    slots = {name: ({'source': 'previous', 'value': prior[name], 'evidence': prior[name]}
                   if name in prior else {'source': 'unspecified', 'value': '', 'evidence': ''}) for name in SLOT_NAMES}
    returns_to_list = bool(re.search(r'\breturn\s+to\b', question, re.I))
    slots['answerShape'] = {'source': 'current', 'value': 'list' if returns_to_list else 'detail',
                            'evidence': re.search(r'return\s+to', question, re.I)[0] if returns_to_list else match['command']}
    return parse_intent_resolution({'relation': 'continue', 'slots': slots, 'clarificationOptions': []}, question, conversation_context)


def resolve_literal_same_record_reference(question: str, conversation_context: Any) -> IntentResolution | None:
    """Resolve one literal same-record command from an already selected identity."""
    match = re.fullmatch(
        r"\s*(?:please\s+)?(?P<command>find|locate)\s+(?:that|the)\s+same\s+"
        r"(?P<object>[a-z]+(?:\s+[a-z]+)?)(?:\s+by\s+its\s+(?P<field>[a-z ]+(?:no\.?|number|id)))?\.?\s*",
        question, re.I,
    )
    if not match:
        return None
    prior = _previous_slots(conversation_context)
    previous = conversation_context.get("previousIntent", {}) if isinstance(conversation_context, dict) else {}
    antecedent = str(previous.get("question") or "")
    anchors = (antecedent, prior.get('businessObject', ''), prior.get('businessFocus', ''))
    object_matches = any(re.search(r"\b" + re.escape(match['object']) + r"s?\b", text, re.I) for text in anchors)
    words = match['object'].casefold().split()
    if not object_matches and len(words) == 2:
        # A route can disambiguate an object qualifier, but is never slot evidence
        # or a permission grant. The noun and identity must still come from history.
        route_words = semantic_source_hint(conversation_context).get('page', '').casefold().split('/')
        object_matches = words[0] in route_words and any(
            re.search(r'\b' + re.escape(words[1]) + r's?\b', text, re.I) for text in anchors)
    if (not prior.get("recordIdentity")
            or not object_matches
            or (match['field'] and _normalized(match['field']).rstrip('.') not in _normalized(antecedent))):
        return None
    slots = {
        name: ({"source": "previous", "value": prior[name], "evidence": prior[name]}
               if name in prior else {"source": "unspecified", "value": "", "evidence": ""})
        for name in SLOT_NAMES
    }
    slots["answerShape"] = {"source": "current", "value": "list" if match['field'] else "detail", "evidence": match["command"]}
    return parse_intent_resolution({"relation": "continue", "slots": slots, "clarificationOptions": []},
                                   question, conversation_context)


def resolve_literal_view_followup(question: str, conversation_context: Any) -> IntentResolution | None:
    """Resolve a simple named queue change while retaining only known prior slots."""
    match = re.fullmatch(r"\s*(?:how|what)\s+about\s+(?:the\s+)?(?P<view>completed|to do|queued)\s+"
                         r"(?P<object>(?:applications?|records?|items?)(?:\s+tasks?)?|tasks?)\s*[?.]?\s*", question, re.I)
    same_team = re.fullmatch(
        r"\s*(?:now\s+)?show\s+(?P<view>completed|to do|queued)\s+for\s+(?:that|the)\s+same\s+team[.!?]?\s*",
        question, re.I,
    )
    if same_team:
        prior = _previous_slots(conversation_context)
        previous = conversation_context.get('previousIntent', {}) if isinstance(conversation_context, dict) else {}
        if (not semantic_source_hint(conversation_context).get('page') or prior.get('recordIdentity')
                or not re.search(r'\bteam\b', str(previous.get('question') or ''), re.I)):
            return None
        slots = {name: ({'source': 'previous', 'value': prior[name], 'evidence': prior[name]}
                       if name in prior else {'source': 'unspecified', 'value': '', 'evidence': ''}) for name in SLOT_NAMES}
        slots['view'] = {'source': 'current', 'value': same_team['view'], 'evidence': same_team['view']}
        slots['requestedScope'] = {'source': 'current', 'value': 'team', 'evidence': 'team'}
        slots['answerShape'] = {'source': 'current', 'value': 'list', 'evidence': 'show'}
        return parse_intent_resolution({'relation': 'refine', 'slots': slots, 'clarificationOptions': []}, question, conversation_context)
    if not match:
        return None
    prior = _previous_slots(conversation_context)
    previous = conversation_context.get('previousIntent', {}) if isinstance(conversation_context, dict) else {}
    anchors = [str(previous.get('question') or ''), prior.get('businessObject', ''), prior.get('businessFocus', '')]
    noun = match['object'].casefold().rstrip('s')
    if (not prior or prior.get('recordIdentity') or not any(
            re.search(r'\b' + re.escape(noun) + r's?\b', anchor, re.I) for anchor in anchors)):
        return None
    slots = {name: ({'source': 'previous', 'value': prior[name], 'evidence': prior[name]}
                   if name in prior else {'source': 'unspecified', 'value': '', 'evidence': ''}) for name in SLOT_NAMES}
    slots['view'] = {'source': 'current', 'value': match['view'], 'evidence': match['view']}
    return parse_intent_resolution({'relation': 'refine', 'slots': slots, 'clarificationOptions': []}, question, conversation_context)


def resolve_literal_record_field_followup(question: str, conversation_context: Any) -> IntentResolution | None:
    """Keep a verified record target for an unambiguous field-only follow-up."""
    prior = _previous_slots(conversation_context)
    if not prior.get("recordIdentity"):
        return None
    normalized = re.sub(r"\s+", " ", question).strip()
    if (not re.fullmatch(r"(?:what|which)\s+(?:are|is)\s+(?:the\s+)?[a-z][a-z ,/&-]{2,180}[?.]?", normalized, re.I)
            or not re.search(r"\b(?:date|time|status|type|category|name|number|no\.?|days?|remaining|effective|expiry|expiration|issuance|issued|submission|sla)\b", normalized, re.I)
            or re.search(r"\b(?:another|other|different|all|every|list|records?|applications?|licenses?|tasks?)\b", normalized, re.I)):
        return None
    slots = {name: ({'source': 'previous', 'value': prior[name], 'evidence': prior[name]}
                   if name in prior else {'source': 'unspecified', 'value': '', 'evidence': ''}) for name in SLOT_NAMES}
    slots['answerShape'] = {'source': 'current', 'value': 'detail', 'evidence': normalized}
    return parse_intent_resolution({'relation': 'continue', 'slots': slots, 'clarificationOptions': []}, question, conversation_context)


def bind_literal_intent_quotes(payload: Any, question: str, context: Any) -> Any:
    """Repair only a quote's provenance when its unchanged value is literal.

    No slots, semantic values, identities, or ownership scopes are inferred.
    The closed parser remains authoritative after this mechanical repair.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("slots"), dict):
        return payload
    previous, _ = _previous_sources(context)
    slots = dict(payload["slots"])
    module = semantic_source_hint(context).get('page', '').strip('/').split('/')[0]
    condition = slots.get('filter')
    if (module and isinstance(condition, dict) and condition.get('source') == 'current'
            and _normalized(str(condition.get('value') or '')) == _normalized(module)
            and _normalized(str(condition.get('evidence') or '')) == _normalized(module)
            and requested_record_limit(question) is not None
            and len(re.findall(r'\b' + re.escape(module) + r'\b', question, re.I)) == 1
            and not re.search(r'\b(?:filter|search|reason|equals?|matching|named|called)\b', question, re.I)
            and 'filter' not in _previous_slots(context)):
        # A repeated module name in a bounded-list follow-up names its source;
        # it does not introduce a new predicate on an unrelated filter control.
        slots['filter'] = {'source': 'unspecified', 'value': '', 'evidence': ''}
    ownership = slots.get('requestedScope')
    prior_result = context.get('previousIntent', {}) if isinstance(context, dict) else {}
    if (isinstance(ownership, dict) and set(ownership) == {'source', 'value', 'evidence'}
            and ownership.get('source') == 'previous'
            and ownership.get('value') in _ENUMS['requestedScope']
            and ownership.get('value') == prior_result.get('scope')
            and 'requestedScope' not in _previous_slots(context)
            and isinstance(ownership.get('evidence'), str)
            and not any(_normalized(ownership['evidence']) in text for text in previous)):
        # Observed result coverage is not a user-requested ownership condition.
        # Drop only this unsupported inheritance; keep every other slot and all
        # real prior requested scopes for the closed parser to validate.
        slots['requestedScope'] = {'source': 'unspecified', 'value': '', 'evidence': ''}
    for name in ("businessObject", "businessFocus", "view", "filter", "dateRange"):
        slot = slots.get(name)
        if not isinstance(slot, dict) or set(slot) != {"source", "value", "evidence"}:
            continue
        source, value, quote = slot.get("source"), slot.get("value"), slot.get("evidence")
        if source not in {"current", "previous"} or not isinstance(value, str) or not isinstance(quote, str):
            continue
        sources = [_normalized(question)] if source == "current" else previous
        if quote and any(_normalized(quote) in text for text in sources):
            continue
        # Require every literal value token in one source; never combine
        # different prior turns or synthesize an evidence sentence.
        tokens = set(re.findall(r"\w+", _normalized(value)))
        if not tokens or any(char.isdigit() for char in value) or "/" in value:
            continue
        matching = [text for text in sources if tokens <= set(re.findall(r"\w+", text)) and len(text) <= 500]
        if matching:
            slots[name] = {**slot, "evidence": min(matching, key=len)}
    return {**payload, "slots": slots}


def parse_intent_resolution(
    payload: Any, question: str, conversation_context: Any,
) -> IntentResolution:
    """Validate shape and textual provenance, not semantic truth or authorization."""
    if not isinstance(payload, dict) or set(payload) != {"relation", "slots", "clarificationOptions"}:
        raise ValueError("intent resolution has unexpected or missing keys")
    relation = payload["relation"]
    if not isinstance(relation, str) or relation not in _RELATIONS:
        raise ValueError("invalid intent relation")
    slots = payload["slots"]
    if not isinstance(slots, dict) or set(slots) not in (set(SLOT_NAMES), set(SLOT_NAMES) - {"businessFocus"}):
        raise ValueError("intent resolution requires exactly the semantic slots")
    slots = dict(slots)
    slots.setdefault("businessFocus", {"source": "unspecified", "value": "", "evidence": ""})
    if not isinstance(question, str) or _CREDENTIAL.search(question):
        raise ValueError("invalid question for intent resolution")
    current_source = _normalized(question)
    previous_sources, previous_identities = _previous_sources(conversation_context)
    prior_slots = _previous_slots(conversation_context)
    resolved_slots = []
    for name in SLOT_NAMES:
        slot = slots[name]
        if not isinstance(slot, dict) or set(slot) != {"source", "value", "evidence"}:
            raise ValueError("intent slot has unexpected or missing keys")
        source = slot["source"]
        if not isinstance(source, str) or source not in {"current", "previous", "clear", "unspecified"}:
            raise ValueError("invalid intent slot source")
        value = _text(slot["value"], 240, allow_empty=source in {"clear", "unspecified"})
        evidence = _text(slot["evidence"], 500, allow_empty=source in {"clear", "unspecified"})
        if source in {"clear", "unspecified"}:
            if value or (source == "unspecified" and evidence):
                raise ValueError("omitted intent slot must have empty value and unspecified evidence")
            if source == "clear" and evidence and _normalized(evidence) not in current_source:
                raise ValueError("cleared intent slot requires evidence from the current question")
        else:
            if name in _ENUMS and value not in _ENUMS[name]:
                raise ValueError(f"invalid intent slot enum (slot={name}; allowed={','.join(sorted(_ENUMS[name]))})")
            evidence_sources = [current_source] if source == "current" else previous_sources
            if not any(_normalized(evidence) in candidate for candidate in evidence_sources):
                raise ValueError(f"intent slot evidence is absent from its declared source (slot={name}, source={source})")
            if name == "recordIdentity":
                identity = _normalized(value)
                if re.fullmatch(r'(?:this|that|these|those|my|our|current|the current)\s+(?:account|user|record|item|one|view|list|queue)s?', identity):
                    raise ValueError('recordIdentity requires a concrete record identifier; a contextual account/user/view reference is not an identifier')
                if source == "current" and not _literal_identity_in(identity, current_source):
                    raise ValueError("current record identity is absent from the question")
                if source == "previous" and identity not in previous_identities:
                    raise ValueError("inherited record identity is not the previous known identity")
        # An omitted condition is not a user-requested reset. Apply the semantic
        # delta only within a continuing topic, never across a switch or expansion.
        omitted = source == "unspecified" or (source == "clear" and not evidence)
        if omitted and relation in {"continue", "refine"} and name in prior_slots:
            source, value, evidence = "previous", prior_slots[name], prior_slots[name]
        elif name == "businessFocus" and relation in {"switch", "broaden"} and source == "previous":
            source, value, evidence = "unspecified", "", ""
        resolved_slots.append((name, IntentSlot(source, value, evidence)))
    options = payload["clarificationOptions"]
    if not isinstance(options, list) or len(options) != (2 if relation == "clarify" else 0):
        raise ValueError("clarification requires exactly two options and other relations none")
    safe_options = _clarification_labels(options) if options else ()
    if safe_options and _splits_requested_conjunction(question, safe_options):
        raise ValueError("clarification splits explicitly requested conjuncts; preserve both requested criteria")
    return IntentResolution(relation, tuple(resolved_slots), tuple(safe_options))


def _splits_requested_conjunction(question: str, options: tuple[str, str]) -> bool:
    """Reject a literal X-and-Y request being restated as an X-or-Y choice."""
    words = [set(re.findall(r"\w+", _normalized(option))) for option in options]
    distinct = [words[0] - words[1], words[1] - words[0]]
    if not all(distinct):
        return False
    for conjunction in re.finditer(r"\band\b", _normalized(question)):
        before = set(re.findall(r"\w+", _normalized(question)[:conjunction.start()]))
        after = set(re.findall(r"\w+", _normalized(question)[conjunction.end():]))
        if any(left <= before and right <= after for left, right in (distinct, distinct[::-1])):
            return True
    return False


def _clarification_labels(options: Any) -> tuple[str, str]:
    if not isinstance(options, (list, tuple)) or len(options) != 2:
        raise ValueError("clarification requires exactly two options")
    labels = []
    for option in options:
        label = _text(option, 120)
        if re.search(r"[a-z][a-z0-9+.-]*:(?://|\S)|www\.|[<>]|```|\]\(", label, re.I):
            raise ValueError("clarification options must be plain labels")
        labels.append(label)
    if _normalized(labels[0]) == _normalized(labels[1]):
        raise ValueError("clarification options must differ")
    return labels[0], labels[1]


def format_clarification_options(options: tuple[str, ...] | list[str], language: str) -> str:
    first, second = _clarification_labels(options)
    if language == "zh":
        return f"你指的是“{first}”，还是“{second}”？"
    if language == "ar":
        return f"هل تقصد «{first}» أم «{second}»؟"
    return f'Do you mean "{first}" or "{second}"?'


def clarification_question(resolution: IntentResolution, language: str) -> str:
    if resolution.relation != "clarify":
        raise ValueError("intent resolution does not request clarification")
    return format_clarification_options(resolution.clarification_options, language)
