"""Compose existing view, object and scope names without discarding constraints."""
from itertools import product
from datetime import datetime
import re
from urllib.parse import urlsplit
from .reader_text import words


def _current_membership_reference(context, population, object_fact):
    """Cover the WHOLE list request using one declared object and membership.

    Unhandled wording keeps the ordinary path. No collection of negative words
    can establish that an extracted positive substring covers the user's intent.
    """
    from pydantic import ValidationError
    from .generic_reader_contracts import TaskSpec
    from .reader_requirements import requirements_for
    from .reader_routing import task_fingerprint
    try:
        task = TaskSpec.model_validate(context.get('task'))
    except ValidationError:
        return None
    question = context.get('question')
    if (not isinstance(question, str) or not task.readOnly or not task.needsLiveData
            or task.outputShape != 'list' or task.requestedMeasures or task.requestedAttributes
            or task.requestedOrdering or task.groupBy or task.recordIdentity
            or task.timeRange not in {'', 'unknown'} or task.timeField or task.filters
            or task.businessFocus != population
            or requirements_for(task) != context.get('requirements')
            or not context.get('observationNotBefore') or not context.get('principalScopeRef')
            or object_fact.get('kind') != 'object' or object_fact.get('conditions')
            or words(task.businessObject) not in _names(object_fact)):
        return None
    match = re.fullmatch(r'currently\s+in\s+(\S(?:[^\r\n]*\S)?)', population, re.I)
    spans = list(re.finditer(r'(?<!\w)' + re.escape(population) + r'(?!\w)', question))
    if not match or len(spans) != 1:
        return None
    # Only request verbs, an article and optional politeness are engine grammar.
    # Every substantive word before the membership must be an EXACT active
    # object name from the same physical mapping; no set/stopword subtraction.
    object_names = [name for name in [object_fact.get('concept', ''), *object_fact.get('aliases', [])]
                    if isinstance(name, str) and name.strip()]
    objects = '|'.join(re.escape(name) for name in sorted(set(object_names), key=len, reverse=True))
    whole = re.fullmatch(
        r'[ \t]*(?:please[ \t]+)?(?:show|list)(?:[ \t]+me)?[ \t]+(?:the[ \t]+)?'
        r'(?P<object>' + objects + r')[ \t]+(?P<population>' + re.escape(population) + r')'
        r'(?:,?[ \t]+please)?[.!?]?[ \t]*', question, re.I)
    if not whole or whole.span('population') != (spans[0].start(), spans[0].end()):
        return None
    return {'quote': population, 'sourceSpan': {'start': spans[0].start(), 'end': spans[0].end()},
            'membership': match.group(1), 'taskFingerprint': task_fingerprint(task),
            'questionCoverage': {'kind': 'whole_list_request', 'quote': question,
                'sourceSpan': {'start': 0, 'end': len(question)},
                'objectQuote': whole.group('object'),
                'objectSourceSpan': {'start': whole.start('object'), 'end': whole.end('object')},
                'objectBindingId': object_fact['knowledgeBindingId']},
            'observationNotBefore': context['observationNotBefore'],
            'principalScopeRef': context['principalScopeRef'],
            'meaning': 'membership_in_this_verified_source_observation'}


def current_observation_matches(alias, requirement, source, catalog, population_fact):
    """Current means this read, not a new status, historic snapshot or old answer."""
    reference = alias['currentObservationReference']
    object_fact = catalog.get(reference.get('questionCoverage', {}).get('objectBindingId'))
    if (not object_fact or object_fact.get('recordId') != population_fact.get('recordId')
            or any(object_fact.get(k) != population_fact.get(k) for k in ('operationRef', 'sourcePath'))
            or set(object_fact.get('fields', [])) != set(population_fact.get('fields', []))
            or (object_fact.get('contextParameters') is not None
                and object_fact['contextParameters'] != population_fact.get('contextParameters'))):
        return False
    # Recheck the original span, task conditions and fingerprint at adoption;
    # generating a lexical alias by itself never establishes live evidence.
    expected = _current_membership_reference(alias.get('currentObservationOrigin', {}), requirement['value'], object_fact)
    if not expected or reference != expected:
        return False
    if (source.get('kind') not in {'api_response', 'projected_collection'}
            or source.get('ready') is False or source.get('collectionFailure')
            or not source.get('observationRef') or not source.get('principalScopeRef')
            or source['principalScopeRef'] != reference.get('principalScopeRef')
            or not source.get('taskFingerprint')
            or source['taskFingerprint'] != reference.get('taskFingerprint')
            or urlsplit(source.get('page', '')).path != (source.get('sourceViewProof') or {}).get('page')
            or not any(d.get('objectBindingId') == object_fact['knowledgeBindingId']
                and d.get('recordId') == object_fact['recordId']
                and d.get('revision') == object_fact['revision']
                and d.get('operationRef') == object_fact['operationRef']
                and d.get('sourcePath') == object_fact['sourcePath']
                and population_fact['knowledgeBindingId'] in d.get('contextBindingIds', [])
                for d in (source.get('sourceViewProof') or {}).get('definitions', []))):
        return False
    try:
        captured = datetime.fromisoformat(source['capturedAt'].replace('Z', '+00:00'))
        lower = datetime.fromisoformat(reference['observationNotBefore'].replace('Z', '+00:00'))
        return captured.tzinfo is not None and lower.tzinfo is not None and captured >= lower
    except (KeyError, TypeError, ValueError, AttributeError):
        return False


def _names(fact):
    return [words(n) for n in [fact.get('concept', ''), *fact.get('aliases', [])] if words(n)]


def _active_records(knowledge):
    # Conflicting versions are never resolved by traversal order.
    records, conflicts = {}, set()
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if record.get('status') != 'active' or not record.get('id'):
            continue
        key = record['id']
        if key in records and records[key] != record:
            conflicts.add(key)
        records[key] = record
    records = {k: v for k, v in records.items() if k not in conflicts}
    return records


def documented_view_identity(knowledge, page, requested_view, entity, *, _original=True):
    """Resolve a qualified view only from this page's active object/view facts."""
    records = _active_records(knowledge)
    candidates = []
    for record in records.values():
        payload = record.get('payload', {})
        if record.get('kind') != 'page_definition' or (payload.get('pageIdentity') or {}).get('route') != page:
            continue
        views = payload.get('routing', {}).get('views', [])
        for view in views:
            if not isinstance(view, dict) or not view.get('id'):
                continue
            if sum(isinstance(v, dict) and v.get('id') == view['id'] for v in views) != 1:
                continue
            names = [words(n) for n in [view['id'], view.get('label', ''), *view.get('aliases', [])]
                     if isinstance(n, str) and words(n) and not n.isdecimal()]
            for facts_record in records.values():
                facts = facts_record.get('payload', {})
                if (facts_record.get('kind') != 'field_semantics' or facts.get('pageRef') != page
                        or facts.get('view') != view['id']):
                    continue
                for fact in facts.get('bindings', []):
                    if (fact.get('kind') != 'object' or fact.get('conditions') or not fact.get('id')
                            or not all(fact.get(k) for k in ('operationRef', 'sourcePath', 'fields'))
                            or not words(entity) or words(entity) not in _names(fact)):
                        continue
                    modifiers = [set()] + [n - words(entity) for n in _names(fact) if words(entity) < n]
                    if any(words(requested_view) == name | modifier for name, modifier in product(names, modifiers)):
                        candidates.append({'id': view['id'], 'viewEvidence': {'recordId': record['id'],
                            'revision': record['revision'], 'pageRef': page},
                            'objectEvidenceBindingId': facts_record['id'] + '#' + fact['id']})
    meanings = {c['id'] for c in candidates}
    if len(meanings) > 1:
        return None
    direct = candidates[0] if candidates else None
    if _original:
        from .reader_native_view import literal_named_view
        reference = literal_named_view(getattr(knowledge, 'intent_lexical_context', {}), requested_view)
        if reference:
            literal = reference['quote'].casefold()
            exact_ids = {view['id'] for record in records.values()
                if record.get('kind') == 'page_definition'
                and record.get('payload', {}).get('pageIdentity', {}).get('route') == page
                for view in record.get('payload', {}).get('routing', {}).get('views', [])
                if isinstance(view, dict) and view.get('id')
                and any(isinstance(name, str) and name.casefold() == literal
                    for name in [view['id'], view.get('label', ''), *view.get('aliases', [])])}
            if len(exact_ids) != 1:
                return direct
            # Only this page's active view AND object definitions resolve the
            # verbatim original label. Browser selection and QE translations
            # provide no alias authority and cannot select a different view.
            resolved = documented_view_identity(knowledge, page, reference['quote'], entity, _original=False)
            if (resolved and resolved['id'] in exact_ids
                    and (direct is None or direct == resolved)):
                return {**resolved, 'originalViewReference': reference}
    return direct


def bind_view_population_compositions(entries, knowledge, context):
    """Add lexical evidence only; ordinary view/context/collection guards still apply.

    A page may define a population as ``queued`` and call its view both ``Queued``
    and ``Queued list``. Such documented wrappers can accompany another alias of
    that SAME view. No general stopword rule removes ``list``, ownership or a
    business qualifier. Object modifiers must complete an existing object alias.
    """
    requirements = context.get('requirements', [])
    scope = next((r['value'] for r in requirements if r['kind'] == 'scope'), None)
    entity = next((r['value'] for r in requirements if r['kind'] == 'object'), None)
    view = next((r['value'] for r in requirements if r['kind'] == 'view'), None)
    if not scope or not entity or not view:
        return
    records = _active_records(knowledge)
    candidates = []
    for population in entries:
        if population['kind'] != 'population' or population.get('conditions'):
            continue
        payload = records.get(population['recordId'], {}).get('payload', {})
        page = payload.get('pageRef')
        identity = documented_view_identity(knowledge, page, view, entity) if page else None
        canonical_view = identity['id'] if identity else view
        if not page or payload.get('view') != canonical_view or not isinstance(population.get('contextParameters'), dict):
            continue
        def same_mapping(fact):
            return (fact['recordId'] == population['recordId']
                and fact['operationRef'] == population['operationRef']
                and fact['sourcePath'] == population['sourcePath']
                and set(fact['fields']) == set(population['fields']) and not fact.get('conditions'))
        scopes = [f for f in entries if f['kind'] == 'scope' and same_mapping(f)
            and words(scope) in _names(f)
            and f.get('contextParameters') == population['contextParameters']
            and f.get('contextBindings', {}) == population.get('contextBindings', {})]
        objects = [f for f in entries if f['kind'] == 'object' and same_mapping(f)
            and words(entity) in _names(f)
            and (f.get('contextParameters') is None
                 or f.get('contextParameters') == population['contextParameters'])]
        for record in records.values():
            route = record.get('payload', {})
            if record.get('kind') != 'page_definition' or (route.get('pageIdentity') or {}).get('route') != page:
                continue
            definitions = [d for d in route.get('routing', {}).get('views', [])
                           if isinstance(d, dict) and d.get('id') == canonical_view]
            if len(definitions) != 1:
                continue
            definition = definitions[0]
            view_names = [words(n) for n in [canonical_view, definition.get('label', ''), *definition.get('aliases', [])]
                          if isinstance(n, str) and words(n) and not n.isdecimal()]
            population_names = _names(population)
            # The view has to explicitly name this population, not just share a route.
            bases = [n for n in view_names if n in population_names]
            if not bases:
                continue
            wrappers = [set()] + [n - p for n in view_names for p in population_names if p < n]
            for own, obj in product(scopes, objects):
                modifiers = [set()] + [n - words(entity) for n in _names(obj) if words(entity) < n]
                for requirement in requirements:
                    if requirement['kind'] != 'population':
                        continue
                    reference = (identity or {}).get('originalViewReference')
                    if reference:
                        from .reader_native_view import allows_population_reference
                        if (allows_population_reference(context, reference, view, requirement['value'])
                                and words(reference['quote']) in population_names):
                            candidates.append((population, requirement, {
                                'requirementId': requirement['id'], 'value': requirement['value'],
                                'resolvedAlias': population['concept'],
                                'evidenceBindingIds': [population['knowledgeBindingId'], own['knowledgeBindingId'], obj['knowledgeBindingId']],
                                'viewEvidence': {'recordId': record['id'], 'revision': record['revision'], 'view': canonical_view, 'pageRef': page},
                                'originalViewReference': reference,
                                'requiresSourceViewProof': True,
                                'reason': 'original_named_view_and_same_page_population_definition'}))
                    requested = words(requirement['value']) - {'in', 'the', 'from'}
                    for base, wrapper, owner, modifier in product(bases, wrappers, [set(), *_names(own)], modifiers):
                        if requested != base | wrapper | owner | modifier:
                            continue
                        candidates.append((population, requirement, {
                            'requirementId': requirement['id'], 'value': requirement['value'],
                            'resolvedAlias': population['concept'],
                            'evidenceBindingIds': [population['knowledgeBindingId'], own['knowledgeBindingId'], obj['knowledgeBindingId']],
                            'viewEvidence': {'recordId': record['id'], 'revision': record['revision'], 'view': canonical_view, 'pageRef': page},
                            'reason': 'same_page_view_population_object_and_retained_scope_composition'}))
                        break
                    current = _current_membership_reference(context, requirement['value'], obj)
                    if current:
                        # The original requirement remains unchanged. Only the
                        # literal prefix is grammar; every membership word still
                        # needs the SAME existing active page/object/scope facts.
                        requested_current = words(current['membership']) - {'in', 'the', 'from'}
                        if any(requested_current == base | wrapper | owner | modifier
                               for base, wrapper, owner, modifier in product(
                                   bases, wrappers, [set(), *_names(own)], modifiers)):
                            candidates.append((population, requirement, {
                                'requirementId': requirement['id'], 'value': requirement['value'],
                                'resolvedAlias': population['concept'],
                                'evidenceBindingIds': [population['knowledgeBindingId'], own['knowledgeBindingId'], obj['knowledgeBindingId']],
                                'viewEvidence': {'recordId': record['id'], 'revision': record['revision'], 'view': canonical_view, 'pageRef': page},
                                'currentObservationReference': current,
                                'currentObservationOrigin': {key: context[key] for key in
                                    ('question', 'task', 'requirements', 'principalScopeRef', 'observationNotBefore')},
                                'requiresSourceViewProof': True,
                                'reason': 'literal_current_observation_of_same_page_membership'}))
    for population, requirement, proof in candidates:
        meanings = {frozenset(words(p['concept'])) for p, r, _ in candidates if r['id'] == requirement['id']}
        if len(meanings) == 1:
            population.setdefault('intentAliases', []).append(proof)
