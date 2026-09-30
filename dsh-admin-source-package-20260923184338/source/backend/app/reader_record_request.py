"""Validate record cardinality without deriving business types from identifiers."""
import json
import re


_FILTER_PREFIX = 'record identifiers in '


def separate_literal_identifiers(value):
    """Recognize only an entire explicit list of opaque alphanumeric literals.

    Names, dates, a single compound key and slash-delimited composite keys remain
    unchanged. This helper does not locate records, select routes or grant access.
    """
    parts = re.split(r'\s*(?:[,;،؛]|\b(?:and|or)\b|و)\s*|\s+', value.strip(), flags=re.I)
    if len(parts) < 2 or not all(
            re.fullmatch(r'[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*', part)
            and re.search(r'[A-Za-z]', part) and re.search(r'[0-9]', part)
            for part in parts):
        return []
    return list(dict.fromkeys(parts)) if len(set(parts)) > 1 else []


def record_filter_identifiers(value):
    if not value.startswith(_FILTER_PREFIX):
        return []
    try:
        identifiers = json.loads(value[len(_FILTER_PREFIX):])
    except (ValueError, TypeError):
        return []
    if (not isinstance(identifiers, list) or not 2 <= len(identifiers) <= 50
            or any(not isinstance(v, str) or not re.fullmatch(r'[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*', v)
                   or not re.search('[A-Za-z]', v) or not re.search('[0-9]', v) for v in identifiers)
            or len(set(identifiers)) != len(identifiers)):
        return []
    return identifiers


def _literal(value, text):
    return bool(re.search(r'(?<![\w-])' + re.escape(value) + r'(?![\w-])', text))


def canonical_record_set_task(task, previous=None, choice=None):
    """Keep one structural representation across merges; never prove grounding.

    User-literal/history grounding is still checked by validate_record_identity.
    Only an exactly equivalent concatenation may become the explicit set already
    present in filters. A missing, malformed or different set cannot be repaired.
    """
    if not task.readOnly or not task.needsLiveData:
        return task
    filters = [value for value in task.filters if value.startswith(_FILTER_PREFIX)]
    if not filters:
        validate_scalar_record_identity(task.recordIdentity)
        return task
    identifiers = record_filter_identifiers(filters[0])
    from .generic_reader import PipelineError
    if len(filters) != 1 or not identifiers:
        raise PipelineError('intent_record_set_ungrounded', 'planning')
    scalar = separate_literal_identifiers(task.recordIdentity)
    if task.outputShape != 'list' or (task.recordIdentity and (not scalar or set(scalar) != set(identifiers))):
        raise PipelineError('intent_record_set_targets_lost', 'planning', details={
            'identifiers': identifiers,
            'correction': 'Keep all literal identifiers in the exact set filter, with an empty '
                'recordIdentity and list output. A subset, parent identity or different set is not equivalent.'})
    from .generic_reader_contracts import SlotUpdate
    updates = {s.field: s for s in task.slotUpdates}
    record_state = updates.get('recordIdentity')
    if task.recordIdentity or (record_state and record_state.value):
        if record_state and record_state.value and set(separate_literal_identifiers(str(record_state.value))) != set(identifiers):
            raise PipelineError('intent_record_set_targets_lost', 'planning')
        updates['recordIdentity'] = SlotUpdate(field='recordIdentity', source='clear', value='',
            evidence='Exact literal record set retained in filters; scalar cardinality is one.')
    changed = {'recordIdentity': '', 'slotUpdates': list(updates.values())}
    prior = previous or {}
    old_object = prior.get('businessObject')
    old_grain = prior.get('requestedGrain')
    object_choice = [u for u in (choice or {}).get('updates', []) if u.get('field') == 'businessObject'
                     and u.get('source') != 'clear' and u.get('value') == task.businessObject]
    # A genuine business-type choice resolves the generic record placeholder;
    # an explicit different grain, grouping or measure remains untouched.
    if (object_choice and old_object in {'record', 'records'} and old_grain == old_object
            and task.requestedGrain == old_grain and task.businessObject not in {'', 'unknown', 'record', 'records'}
            and not task.groupBy and not task.requestedMeasures and task.outputShape == 'list'):
        changed['requestedGrain'] = task.businessObject
        updates['requestedGrain'] = SlotUpdate(field='requestedGrain', source='current',
            value=task.businessObject, evidence='The selected business type resolves the prior record placeholder.')
        changed['slotUpdates'] = list(updates.values())
    return task.model_copy(update=changed)


def validate_record_set_filters(task, question, history):
    from .generic_reader import PipelineError
    previous = history.get('previousIntent', {})
    for value in task.filters:
        if not value.startswith(_FILTER_PREFIX):
            continue
        identifiers = record_filter_identifiers(value)
        inherited = (task.contextRelation in {'continue', 'refine', 'clarify'}
                     and value in previous.get('filters', []))
        if not identifiers or not (inherited or all(_literal(v, question) for v in identifiers)):
            raise PipelineError('intent_record_set_ungrounded', 'planning', details={
                'correction': 'Use record identifiers in followed by a JSON array only for all distinct '
                    'literal identifiers supplied by the user or unchanged bound history. Preserve their '
                    'exact spelling, every requested identifier and all other constraints; do not invent values.'})


def validate_scalar_record_identity(identity):
    identifiers = separate_literal_identifiers(identity)
    if not identifiers:
        return
    from .generic_reader import PipelineError
    raise PipelineError('intent_multiple_record_identity', 'planning', details={
        'identifiers': identifiers,
        'correction': 'recordIdentity binds exactly one record, but this value concatenates distinct '
            'literal identifiers. Do not select just one or treat the combined text as a single lookup key. '
            'For a request to find multiple records of one established business type, leave recordIdentity '
            'empty, use list output, and retain EVERY requested identifier in one filter with the exact '
            'syntax record identifiers in followed by a JSON array of the original strings. This is '
            'exact membership, not equal to their concatenation and not a substring match. '
            'Keep the original attributes and all other constraints. Preserve separate entity identities '
            'in the result; a filter is not evidence of a relationship. Never infer the business type or '
            'a cross-module link from an identifier prefix. If the user needs to choose an ambiguous '
            'business type or distinguish different objects, ask that business clarification while '
            'retaining all identifiers and the full original request. Do not invent a type, route, '
            'permission, record absence or successful result.'})


def validate_record_set_repair(task, constraints):
    """A retry cannot make a cardinality error disappear by dropping a target."""
    if not task.readOnly or not task.needsLiveData:
        return
    previous = [c.get('identifiers', []) for c in constraints if isinstance(c, dict)
                and c.get('code') == 'intent_multiple_record_identity']
    if not previous:
        return
    required = set(previous[0])
    filters = [record_filter_identifiers(value) for value in task.filters]
    if task.recordIdentity or task.outputShape != 'list' or not any(set(ids) == required for ids in filters):
        from .generic_reader import PipelineError
        raise PipelineError('intent_record_set_targets_lost', 'planning', details={
            'identifiers': sorted(required),
            'correction': 'Preserve the complete original multi-record request. Do not keep just one ID, '
                'drop another, or put the IDs only in searchQuery. Use list output, empty recordIdentity '
                'and one filter record identifiers in followed by the exact JSON string array. '
                'If a business type needs clarification, retain this same list filter while asking it. '
                'Every requested identifier needs its own verified result before the whole task can succeed.'})


def compile_record_set_bindings(knowledge, entries, context):
    """Combine caller literals with one active page-defined identity mapping.

    This produces an executable filter, never a new business fact or permission.
    Values stay in the request; no case identifiers are written into knowledge.
    """
    requested = [(r, record_filter_identifiers(r.get('value', '')))
                 for r in context.get('requirements', []) if r.get('kind') == 'filter']
    requested = [(r, ids) for r, ids in requested if ids
                 and all(_literal(value, context.get('question', '')) for value in ids)]
    if not requested:
        return
    definitions = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if record.get('status') != 'active' or not record.get('applicability', {}).get('pageRefs'):
            continue
        payload = record.get('payload', {})
        for definition in [*payload.get('routing', {}).get('records', []),
                           *[dict(d, _recordSetLookup=True) for d in payload.get('recordSetLookups', []) if isinstance(d, dict)]]:
            if not isinstance(definition, dict):
                continue
            field = definition.get('identityField', '')
            lookup = definition.get('_recordSetLookup') is True
            identity_fields = definition.get('identifierFields') if lookup else [field]
            if (not isinstance(identity_fields, list) or not 1 <= len(identity_fields) <= 4
                    or any(not isinstance(f, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', f)
                           or re.search(r'token|secret|password|email|phone|passport', f, re.I) for f in identity_fields)
                    or len(set(identity_fields)) != len(identity_fields)):
                continue
            if lookup: field = identity_fields[0]
            definition = {**definition, 'identityField': field, 'identifierFields': identity_fields}
            key_fields = definition.get('keyFields')
            if (not isinstance(field, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', field)
                    or not isinstance(key_fields, list) or not 1 <= len(key_fields) <= 10
                    or any(not isinstance(key, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key) for key in key_fields)
                    or not isinstance(definition.get('id'), str) or not definition['id']
                    or not str(definition.get('sourcePath', '')).startswith('/')
                    or not definition.get('operationRef')):
                continue
            key = (definition['operationRef'], definition['sourcePath'])
            definitions.setdefault(key, []).append((item, record, definition))
    for (operation, path), choices in definitions.items():
        # Different identifier fields or entity keys are a business ambiguity.
        opt_in = [entry for entry in choices if entry[2].get('_recordSetLookup')]
        if opt_in:
            # An alternate lookup field is never made the primary entity key.
            # All known mappings for this operation must agree on the entity key.
            if len({tuple(d['keyFields']) for _, _, d in choices}) != 1:
                continue
            choices = opt_in
        signatures = {(tuple(d['identifierFields']), tuple(d['keyFields'])) for _, _, d in choices}
        if len(signatures) != 1:
            continue
        item, record, definition = choices[0]
        field = definition['identityField']
        identity_fields = definition['identifierFields']
        operator = 'filter_identifiers' if definition.get('_recordSetLookup') else 'filter'
        for requirement, identifiers in requested:
            runtime_id = 'runtime_record_set_' + definition['id'] + '_' + requirement['id']
            entries.append({'id': runtime_id, 'kind': 'filter',
                'concept': requirement['value'], 'fields': identity_fields, 'sourcePath': path,
                'operationRef': operation,
                'conditions': [] if operator == 'filter_identifiers' else [{'field': field, 'predicate': 'in', 'value': identifiers}],
                'compiledRecordSet': {'identifiers': identifiers, 'identifierFields': identity_fields, 'operator': operator,
                    'identityBindingId': record['id'] + '#' + definition['id'],
                    'pageRefs': list(record['applicability']['pageRefs']),
                    'keyFields': list(definition['keyFields'])},
                'knowledgeBindingId': record['id'] + '#' + runtime_id,
                'recordId': record['id'], 'revision': record['revision'],
                'sourceDocumentId': item['documentId']})


def validate_record_set_outputs(coverage, catalog, bindings, sources, outputs):
    """A matching subset or an anonymous list cannot certify all requested IDs."""
    exposed = {output['id']: output for output in outputs}
    for item in coverage:
        facts = [(binding, catalog.get(binding.knowledgeBindingId, {}))
                 for binding in bindings.get(item['id'], [])]
        facts = [(b, f) for b, f in facts if f.get('compiledRecordSet')]
        if not facts or item['status'] != 'satisfied':
            continue
        observed, matched_outputs = set(), set()
        expected = set(facts[0][1]['compiledRecordSet']['identifiers'])
        invalid = False
        source_contexts = set()
        for binding, fact in facts:
            spec = fact['compiledRecordSet']
            source = sources.get(binding.sourceId, {})
            if set(spec['identifiers']) != expected or source.get('page', '').split('?')[0] not in spec['pageRefs']:
                invalid = True
                continue
            fields = spec.get('identifierFields', fact['fields'])
            context = tuple(source.get(k) for k in ('principalScopeRef', 'capturedAt', 'observationRef'))
            if not all(context[:2]): invalid = True
            source_contexts.add(context)
            # One visible number may name several entities on a list page.
            # Preserve that ambiguity rather than selecting the first match.
            from .reader_routing import _rows
            target_keys = {identifier: set() for identifier in expected}
            for row in _rows(source, fact['sourcePath']):
                if not isinstance(row, dict):
                    continue
                matched = {row.get(field) for field in fields if isinstance(row.get(field), str)} & expected
                if not matched:
                    continue
                if any(row.get(key) is None or isinstance(row.get(key), (dict, list)) for key in spec['keyFields']):
                    invalid = True
                    continue
                for identifier in matched:
                    target_keys[identifier].add(tuple((type(row[key]).__name__, str(row[key])) for key in spec['keyFields']))
            if any(len(keys) != 1 for keys in target_keys.values()):
                invalid = True
            for oid in item.get('outputIds', []):
                output = exposed.get(oid, {})
                evidence = output.get('evidence', [])
                if not any(ref.get('sourceId') == binding.sourceId for ref in evidence):
                    continue
                rows = output.get('value')
                if not isinstance(rows, list) or any(not isinstance(row, dict)
                        or not any(isinstance(row.get(field), str) and row[field] in expected for field in fields) for row in rows):
                    invalid = True
                    continue
                observed.update(row[field] for row in rows for field in fields
                                if isinstance(row.get(field), str) and row[field] in expected)
                matched_outputs.add(oid)
        item['recordSetProof'] = {'requestedIdentifiers': sorted(expected),
            'observedIdentifiers': sorted(observed), 'unobservedIdentifiers': sorted(expected - observed),
            'globalAbsence': False}
        if len(source_contexts) != 1 or invalid or observed != expected or matched_outputs != set(item.get('outputIds', [])):
            item.update(status='unfulfilled', reason='record_set_targets_not_verified')


def record_set_step_matches(step, fact):
    spec = (fact or {}).get('compiledRecordSet') or {}
    ids, fields = spec.get('identifiers', []), spec.get('identifierFields', [])
    return bool(spec.get('operator') == 'filter_identifiers' and step.op == 'filter_identifiers'
        and step.knowledgeBindingId == fact.get('knowledgeBindingId') and not step.field
        and step.predicate == 'in' and isinstance(step.operand, list)
        and all(isinstance(value, str) for value in step.operand)
        and len(step.operand) == len(ids) and set(step.operand) == set(ids)
        and len(step.fields) == len(fields) and set(step.fields) == set(fields))


def filter_record_identifiers(rows, step, fact, provenance):
    """Exact OR over reviewed identifier fields; no substring/prefix/coercion."""
    from .generic_reader import PipelineError
    if (not record_set_step_matches(step, fact) or not provenance
            or any(ref.get('operationRef') != fact['operationRef']
                   or ref.get('fieldBinding') != fact['sourcePath'] for ref in provenance)):
        raise PipelineError('record_set_lookup_definition_required', 'planning')
    fields, ids = fact['fields'], set(fact['compiledRecordSet']['identifiers'])
    if any(any(field not in row or row[field] is not None and not isinstance(row[field], str)
               for field in fields) for row in rows):
        raise PipelineError('record_set_identifier_field_unavailable', 'source_data')
    result = [row for row in rows if any(row[field] in ids for field in fields)]
    proof = {'knowledgeBindingId': fact['knowledgeBindingId'], 'stepId': step.id,
             'identifierFields': fields, 'identifiers': sorted(ids)}
    return result, [{**ref, 'recordSetLookupProofs': [*ref.get('recordSetLookupProofs', []), proof]}
                    for ref in provenance]


def minimal_record_set_projection(task, knowledge, page, source, rows_path):
    """A bare identifier-set lookup needs only documented entity/lookup keys.

    This does not settle conflicting business semantics or attest returned rows.
    Other requested properties, populations, scopes and times keep their normal
    projection path. Two-pass comparison remains strict over the exact projection.
    """
    from urllib.parse import urlsplit
    from .reader_requirements import semantic_bindings, requirements_for, _semantic_match, _context_match
    from types import SimpleNamespace
    if (task.outputShape != 'list' or task.recordIdentity or task.requestedAttributes
            or task.requestedMeasures or task.requestedOrdering or task.groupBy
            or task.businessFocus or task.requestedScope != 'unknown'
            or task.timeRange not in {'', 'unknown'} or task.unresolvedSlots
            or len(task.filters) != 1 or not record_filter_identifiers(task.filters[0])):
        return None
    facts = [f for f in semantic_bindings(knowledge)
             if f['operationRef'] == source.get('operationRef') and f['sourcePath'] == rows_path]
    targets = [f for f in facts if f.get('compiledRecordSet')
               and urlsplit(page).path in f['compiledRecordSet']['pageRefs']
               and f['concept'] == task.filters[0]]
    signatures = {(tuple(f['compiledRecordSet']['identifierFields']),
                   tuple(f['compiledRecordSet']['keyFields'])) for f in targets}
    if len(signatures) != 1:
        return None
    identifiers, keys = next(iter(signatures))
    catalog = {f['knowledgeBindingId']: f for f in facts}
    for requirement in requirements_for(task):
        if requirement['kind'] not in {'object', 'grain'}:
            continue
        matches = [f for f in facts if _semantic_match(SimpleNamespace(
            knowledgeBindingId=f['knowledgeBindingId'], fields=f['fields'], sourcePath=rows_path),
            requirement, source, catalog)]
        # Only equivalent physical keys can be minimal. Do not choose one
        # semantic definition over another, discard subtype predicates, or
        # hide a mismatched captured request context.
        if (not matches or any(set(f['fields']) != set(keys) or f.get('conditions')
                or ('contextParameters' in f and not _context_match(f, source)) for f in matches)):
            return None
    return list(dict.fromkeys([*keys, *identifiers]))


def compile_record_set_read_selection(task, plan, sources, knowledge, page, performed_actions):
    """Turn a destructive one-ID search into a full-collection set lookup.

    Only caller-literal set searches are affected. A single text filter cannot
    represent OR across that set, and replacing it successively discards earlier
    populations. The real authorized collection is collected and exact-filtered
    later; no row, permission, completeness or identifier presence is invented.
    """
    from urllib.parse import urlsplit
    from .generic_reader import PipelineError
    from .reader_requirements import semantic_bindings
    identifiers = [ids for value in task.filters if (ids := record_filter_identifiers(value))]
    if task.outputShape != 'list' or task.recordIdentity or len(identifiers) != 1 or not plan.nextActions:
        return None
    identifiers = identifiers[0]
    def includes_identifier(value):
        return isinstance(value, str) and any(_literal(identifier, value) for identifier in identifiers)
    if (any(action.type != 'filter' or not includes_identifier(action.value) for action in plan.nextActions)
            or len(plan.nextActions) != 1):
        return None
    action = plan.nextActions[0]
    facts = [f for f in semantic_bindings(knowledge) if f.get('compiledRecordSet')
             and set(f['compiledRecordSet']['identifiers']) == set(identifiers)
             and urlsplit(page).path in f['compiledRecordSet']['pageRefs']]
    if not facts:
        raise PipelineError('record_set_lookup_definition_required', 'planning')
    prior = [a for a in performed_actions if a.get('type') == 'filter'
             and a.get('selector') == action.selector]
    if prior and includes_identifier(prior[-1].get('value')):
        # Clear only this same observed single-identifier criterion. Other UI
        # filters and user clauses remain unchanged; fresh observation follows.
        plan.sourceIds = []
        plan.nextActions = [action.model_copy(update={'value': ''})]
        return {'reason': 'record_set_clear_previous_single_identifier_filter',
                'identifiers': identifiers, 'selector': action.selector}
    choices = []
    for sid, source in sources.items():
        schema = source.get('collectionContext') or {}
        matching = [f for f in facts if f['operationRef'] == source.get('operationRef')
                    and any(r.get('path') == f['sourcePath'] for r in schema.get('rowSchemas', []))]
        if matching and source.get('page') == urlsplit(page).path:
            choices.append(sid)
    if len(choices) != 1:
        raise PipelineError('record_set_collection_source_required', 'planning', details={
            'candidateSourceIds': choices, 'identifiers': identifiers,
            'correction': 'Keep the full identifier set. Select the observed authorized collection '
                'with its page-defined exact identity filter; do not overwrite a single search box '
                'with one identifier at a time or claim a final filtered population covers all targets.'})
    plan.sourceIds = choices
    if not plan.rationale:
        plan.rationale = list(action.evidence)
    plan.nextActions = []
    return {'reason': 'record_set_use_collection_exact_filter', 'sourceId': choices[0],
            'identifiers': identifiers, 'presenceVerified': False}
