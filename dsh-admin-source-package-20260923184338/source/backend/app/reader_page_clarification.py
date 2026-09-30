"""Apply explicit page-owned ambiguity rules without changing other task clauses."""
import re
from .reader_text import words
from .generic_reader_contracts import ClarificationRequest


def term_matches(value, aliases):
    """Explicit KB phrases only; retain original text offsets and all qualifiers."""
    found = {}
    for alias in aliases:
        pattern = r'(?<!\w)' + re.escape(alias.strip()).replace(r'\ ', r'\s+') + r'(?!\w)'
        for match in re.finditer(pattern, value, re.I):
            found[(match.start(), match.end())] = match
    return list(found.values())


def purpose_request(task, rule, language):
    """A published page may require a purpose before a broad disclosure request.

    This asks for a missing disclosure purpose only. It never grants access, resolves a
    relationship, narrows requested attributes, or offers invented purposes.
    """
    from .generic_reader import PipelineError
    legacy = rule.get('kind') == 'missing_business_focus'
    if rule.get('kind') not in {'missing_disclosure_purpose', 'missing_business_focus'}:
        return None
    if not task.needsLiveData or not task.readOnly:
        return None
    objects = rule.get('objects')
    groups = rule.get('attributeGroups')
    minimum = rule.get('minimumMatchedGroups')
    expected_slot = 'businessFocus' if legacy else 'disclosurePurpose'
    if (rule.get('slot') != expected_slot or rule.get('requiresRecordIdentity') is not True
            or not isinstance(objects, list) or not 1 <= len(objects) <= 20
            or not all(isinstance(x, str) and x.strip() for x in objects)
            or not isinstance(groups, list) or not 2 <= len(groups) <= 6
            or not all(isinstance(g, list) and 1 <= len(g) <= 20
                       and all(isinstance(x, str) and x.strip() for x in g) for g in groups)
            or type(minimum) is not int or not 2 <= minimum <= len(groups)):
        raise PipelineError('page_clarification_definition_invalid', 'knowledge_gap')
    if (task.disclosurePurpose.strip() not in {'', 'unknown'} or not task.recordIdentity.strip()
            or not any(words(task.businessObject) == words(x) for x in objects)):
        return None
    normalized_groups = [{tuple(words(alias)) for alias in group} for group in groups]
    if (any(not alias for group in normalized_groups for alias in group)
            or sum(map(len, normalized_groups)) != len(set().union(*normalized_groups))):
        raise PipelineError('page_clarification_definition_invalid', 'knowledge_gap')
    matched = sum(any(words(value) == words(alias)
                      for value in task.requestedAttributes for alias in group) for group in groups)
    if matched < minimum:
        return None
    if legacy:
        # Do not silently bypass or reinterpret an old published purpose rule.
        # The matching page must publish the dedicated-slot contract first.
        raise PipelineError('page_clarification_purpose_slot_obsolete', 'knowledge_gap')
    try:
        question = rule['question'][language]
        return ClarificationRequest.model_validate({
            'question': question, 'missingSlots': ['disclosurePurpose'], 'options': []})
    except (KeyError, TypeError, ValueError) as exc:
        raise PipelineError('page_clarification_definition_invalid', 'knowledge_gap') from exc


def page_clarification(task, knowledge, routes, language):
    from .generic_reader import PipelineError
    language = 'ar' if str(language).lower().startswith('ar') else 'en'
    matches = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if (record.get('status') != 'active' or not set(routes).intersection(
                record.get('applicability', {}).get('pageRefs', []))):
            continue
        for rule in (record.get('payload') or {}).get('clarificationRules', []):
            if isinstance(rule, dict) and rule.get('kind') in {'missing_disclosure_purpose', 'missing_business_focus'}:
                if not item.get('documentId') or rule.get('autoClarify') is not True:
                    continue
                request = purpose_request(task, rule, language)
                if request is not None:
                    key = request.model_dump_json()
                    matches.setdefault(key, (request, []))[1].append({
                        'recordId': record['id'], 'revision': record.get('revision'),
                        'documentId': item['documentId'], 'ruleId': rule.get('id')})
                continue
            if not isinstance(rule, dict) or rule.get('slot') not in {'requestedMeasures', 'requestedAttributes', 'requestedOrdering'}:
                continue
            objects, aliases, choices = rule.get('objects'), rule.get('aliases'), rule.get('choices')
            if (not isinstance(objects, list) or not objects or not all(isinstance(x, str) for x in objects)
                    or not any(words(task.businessObject) == words(x) for x in objects)
                    or not isinstance(aliases, list) or not aliases or not all(isinstance(x, str) for x in aliases)
                    or not isinstance(choices, list) or not 2 <= len(choices) <= 3):
                continue
            values = getattr(task, rule['slot'])
            term_mode = rule.get('replacementMode') == 'term'
            positions = [i for i, value in enumerate(values) if (
                bool(term_matches(value, aliases)) if term_mode else
                words(value) and any(words(value) == words(a) for a in aliases))]
            if not positions:
                continue
            if len(positions) != 1:
                raise PipelineError('page_clarification_ambiguous', 'knowledge_gap')
            options = []
            try:
                question = rule['question'][language]
                for choice in choices:
                    replacement = choice['value']
                    if not isinstance(replacement, str) or not replacement.strip() or len(replacement) > 200:
                        raise ValueError('invalid choice')
                    # A resolved choice must not match the ambiguity aliases again.
                    if (bool(term_matches(replacement, aliases)) if term_mode else
                            any(words(replacement) == words(a) for a in aliases)):
                        raise ValueError('recursive choice')
                    updated = list(values)
                    if term_mode:
                        occurrences = term_matches(values[positions[0]], aliases)
                        if len(occurrences) != 1:
                            raise ValueError('ambiguous term occurrence')
                        match = occurrences[0]; old = values[positions[0]]
                        updated[positions[0]] = old[:match.start()] + replacement + old[match.end():]
                    else:
                        updated[positions[0]] = replacement
                    updates = [{'field': rule['slot'], 'value': updated, 'source': 'current',
                        'evidence': 'User selection from page knowledge ' + record['id']}]
                    # Only an explicitly declared duplicate of this same term
                    # is consumed. Independent qualifiers/populations stay.
                    if (rule['slot'] == 'requestedOrdering' and rule.get('consumesDuplicateFocus') is True
                            and words(task.businessFocus) and any(words(task.businessFocus) == words(a) for a in aliases)):
                        updates.append({'field': 'businessFocus', 'value': '', 'source': 'current',
                            'evidence': 'User selection from page knowledge ' + record['id']})
                    # A page can declare that the same ambiguous term also
                    # appears as a requested display attribute. Resolve that
                    # duplicate with the chosen meaning; preserve unrelated
                    # attributes and qualifiers.
                    if rule.get('resolvesDuplicateAttributes') is True:
                        attribute = choice.get('attributeValue')
                        if (rule['slot'] != 'requestedOrdering' or not isinstance(attribute, str)
                                or not 1 <= len(attribute.strip()) <= 200
                                or any(words(attribute) == words(a) for a in aliases)):
                            raise ValueError('invalid duplicate attribute resolution')
                        attributes = [attribute if any(words(value) == words(a) for a in aliases)
                            else value for value in task.requestedAttributes]
                        if attributes != task.requestedAttributes:
                            updates.append({'field': 'requestedAttributes', 'value': attributes,
                                'source': 'current', 'evidence': 'User selection from page knowledge ' + record['id']})
                    options.append({'id': choice['id'], 'label': choice['label'][language], 'updates': updates})
                if len({c['id'] for c in options}) != len(options):
                    raise ValueError('duplicate choice')
                request = ClarificationRequest.model_validate({'question': question,
                    'missingSlots': [rule['slot']], 'options': options})
            except (KeyError, TypeError, ValueError) as exc:
                raise PipelineError('page_clarification_definition_invalid', 'knowledge_gap') from exc
            key = request.model_dump_json()
            matches.setdefault(key, (request, []) )[1].append({'recordId': record['id'],
                'revision': record.get('revision'), 'documentId': item.get('documentId'), 'ruleId': rule.get('id')})
    if len(matches) > 1:
        raise PipelineError('page_clarification_conflict', 'knowledge_gap')
    return next(iter(matches.values()), (None, []))


def bind_page_clarification(task, knowledge, routes, language):
    """Persist exactly the active page's options before any early clarification return."""
    request, rules = page_clarification(task, knowledge, routes, language)
    if request is None:
        return task, []
    return task.model_copy(update={'clarification': request, 'contextRelation': 'clarify',
        'unresolvedSlots': list(dict.fromkeys([*task.unresolvedSlots, *request.missingSlots]))}), rules


def cited_clarification_routes(task, knowledge, authorized_routes):
    """Early normalization uses only pages cited by the proposed clarification."""
    if not task.clarification:
        return []
    references = [u.evidence for option in task.clarification.options for u in option.updates
                  if u.source == 'knowledge' and u.evidence]
    routes = set()
    for passage, (key, _) in knowledge.passages.items():
        if not any(passage in reference.split() for reference in references):
            continue
        record = knowledge.items.get(key, {}).get('record') or {}
        if record.get('status') == 'active':
            routes.update(record.get('applicability', {}).get('pageRefs', []))
    return sorted(routes.intersection(authorized_routes))


def automatic_clarification_routes(task, knowledge, authorized_routes):
    """Only explicit remote page rules can request early term clarification."""
    routes = set()
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if not item.get('documentId') or record.get('status') != 'active':
            continue
        for rule in (record.get('payload') or {}).get('clarificationRules', []):
            if not isinstance(rule, dict) or rule.get('autoClarify') is not True:
                continue
            if rule.get('kind') in {'missing_disclosure_purpose', 'missing_business_focus'}:
                if not set(record.get('applicability', {}).get('pageRefs', [])).intersection(authorized_routes):
                    continue
                if purpose_request(task, rule, 'en') is not None:
                    routes.update(record.get('applicability', {}).get('pageRefs', []))
                continue
            objects, aliases = rule.get('objects'), rule.get('aliases')
            slot = rule.get('slot')
            if (slot not in {'requestedAttributes', 'requestedMeasures', 'requestedOrdering'} or
                    not isinstance(objects, list) or not all(isinstance(x, str) for x in objects) or
                    not any(words(task.businessObject) == words(x) for x in objects) or
                    not isinstance(aliases, list) or not aliases or
                    not all(isinstance(x, str) and x.strip() for x in aliases)):
                continue
            values = getattr(task, slot)
            matched = any(term_matches(value, aliases) for value in values) if rule.get('replacementMode') == 'term' else any(
                words(value) == words(alias) for value in values for alias in aliases)
            if matched:
                routes.update(record.get('applicability', {}).get('pageRefs', []))
    return sorted(routes.intersection(authorized_routes))


def clarification_record_ids(pending):
    """Only program-authored page-rule references can narrow invalidation."""
    import re
    ids = set()
    for option in (pending or {}).get('options', []):
        for update in option.get('updates', []):
            match = re.fullmatch(r'User selection from page knowledge ([A-Za-z0-9_.-]{1,200})',
                                 str(update.get('evidence', '')))
            if not match:
                return []
            ids.add(match.group(1))
    return sorted(ids) if 1 <= len(ids) <= 3 else []


def unchanged_page_clarification(previous, knowledge, authorized_routes, language):
    """An unrelated directory update cannot invalidate identical current choices.

    Legacy/free-form choices retain the full version guard. Revalidation uses
    active remote definitions, authorized pages and all saved option semantics.
    """
    from types import SimpleNamespace
    from .generic_reader_contracts import TaskSpec
    from .generic_reader import PipelineError
    pending = previous.get('pendingClarification') or {}
    ids = clarification_record_ids(pending)
    if not ids:
        return []
    items = {key: item for key, item in knowledge.items.items()
        if (item.get('record') or {}).get('id') in ids
        and (item.get('record') or {}).get('status') == 'active' and item.get('documentId')}
    if {item['record']['id'] for item in items.values()} != set(ids):
        return []
    try:
        task = TaskSpec.model_validate(previous['task'])
        current, proof = page_clarification(task, SimpleNamespace(items=items), authorized_routes, language)
        saved = ClarificationRequest.model_validate({key: pending[key] for key in ['question', 'missingSlots', 'options']})
        def meaning(request):
            if request is None: return None
            return {'question': request.question, 'missingSlots': request.missingSlots,
                'options': [{'id': o.id, 'label': o.label,
                    'updates': [{'field': u.field, 'value': u.value} for u in o.updates]} for o in request.options]}
        return proof if meaning(current) == meaning(saved) else []
    except (PipelineError, KeyError, TypeError, ValueError):
        return []
