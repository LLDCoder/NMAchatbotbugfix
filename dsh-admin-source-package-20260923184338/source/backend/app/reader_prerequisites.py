"""Keep verified same-task lookup evidence available for multi-page details."""
from .reader_requirements import semantic_bindings, _words


def collection_document_dependencies(knowledge, page, operations, *, purpose='collection'):
    from urllib.parse import urlsplit
    result = []
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if (record.get('status') != 'active' or not item.get('documentId')
                or urlsplit(page).path not in record.get('applicability', {}).get('pageRefs', [])):
            continue
        for dependency in (record.get('payload') or {}).get('knowledgeDependencies', []):
            if (isinstance(dependency, dict) and dependency.get('purpose') == purpose
                    and dependency.get('operationRef') in operations
                    and isinstance(dependency.get('document'), str)
                    and 1 <= len(dependency['document']) <= 240
                    and dependency['document'].endswith('.json')):
                result.append(dependency['document'])
    return list(dict.fromkeys(result))[:2]


def lookup_collection_task(task):
    """A locating hop resolves keys, not downstream answer completeness.

    Preserve identity and access context. Requested properties remain on the
    original task and are checked after the destination read. Explicit lookup
    fields already include any useful, observed same-record properties.
    """
    return task.model_copy(update={'requestedAttributes': [], 'requestedMeasures': [],
        'requestedOrdering': [], 'groupBy': [], 'businessFocus': '',
        'outputShape': 'detail'})


def validate_lookup_collections(plan, sources, lookup_fields):
    from .generic_reader import PipelineError
    required = {sid: sorted(lookup_fields[s['operationRef']]) for sid, s in sources.items()
                if s.get('operationRef') in lookup_fields}
    missing = sorted(set(required) - {s.sourceId for s in plan.collections})
    if missing:
        raise PipelineError('collection_lookup_plan_missing', 'planning', details={
            'requiredLookupFields': {sid: required[sid] for sid in missing},
            'correction': 'This is a prerequisite record lookup, not the final answer collection. '
                'Plan the documented paging scan for these observed sources using the supplied '
                'identity and lookup fields. Missing downstream materials, policy or other answer '
                'properties do not block record location. Keep those requirements for the destination. '
                'Do not invent a paging or identity definition if it is actually absent.'})


def compile_lookup_projection(spec, required_fields):
    """Compile the already derived lookup projection; validate its proofs next.

    The model cannot expand the authorized dependency set. Missing identifiers
    can be restored from that set, but an unrelated row identity still fails.
    """
    from .generic_reader import PipelineError
    required = set(required_fields)
    if not spec.identityFields or not set(spec.identityFields) <= required:
        raise PipelineError('collection_identity_projection_missing', 'planning')
    if set(spec.fields) == required:
        return None
    before = set(spec.fields)
    spec.fields = sorted(required)
    return {'sourceId': spec.sourceId, 'addedFields': sorted(required - before),
            'excludedFields': sorted(before - required), 'reason': 'verified_lookup_dependencies'}


def lookup_attribute_fields(task, knowledge, definitions, fields, observed_sources=None):
    result = {op: set(names) for op, names in fields.items()}
    if task.outputShape != 'detail' or not task.recordIdentity:
        return fields
    mappings = {(d['operationRef'], d['sourcePath']) for d in definitions}
    wanted = {frozenset(_words(value)) for value in task.requestedAttributes if _words(value)}
    for fact in semantic_bindings(knowledge):
        if (fact['kind'] == 'attribute' and (fact['operationRef'], fact['sourcePath']) in mappings
                and any(frozenset(_words(c)) in wanted for c in [fact['concept'], *fact.get('aliases', []),
                    *(a['value'] for a in fact.get('intentAliases', []))])):
            supported = set(fact['fields'])
            if observed_sources is not None:
                from .reader_collection import observed_projection_fields
                observed = set()
                for source in observed_sources.values():
                    if source.get('operationRef') == fact['operationRef']:
                        observed.update(observed_projection_fields(
                            (source.get('collectionContext') or {}).get('rowSchemas', []),
                            fact['sourcePath'], fact['fields'], set(fact['fields'])))
                supported &= observed
            # Optional same-record properties are useful lookup evidence, but
            # absent list columns must not block the route to the detail that
            # owns them. The original identity/key fields remain indispensable.
            result[fact['operationRef']].update(supported)
    return {op: sorted(names) for op, names in result.items()}


def reusable_lookups(task, sources, bound_record, principal_scope):
    """No stale task, different entity, incomplete scan or unbound identity reuse."""
    from .reader_routing import task_fingerprint
    from .generic_reader import pointer, PipelineError
    if task.outputShape != 'detail' or not task.recordIdentity or not bound_record:
        return {}
    if bound_record.get('taskFingerprint') != task_fingerprint(task) or bound_record.get('identity') != task.recordIdentity:
        return {}
    result = {}
    for sid, source in sources.items():
        proof, receipt = source.get('verifiedRecord') or {}, source.get('collectionReceipt') or {}
        if (source.get('principalScopeRef') != principal_scope or source.get('taskFingerprint') != task_fingerprint(task)
                or proof.get('identity') != task.recordIdentity or source.get('truncated')
                or receipt.get('completeness') != 'complete' or receipt.get('operationRef') != source.get('operationRef')
                or receipt.get('rowsPath') != proof.get('path')):
            continue
        try: rows = pointer(source['data'], proof['path'])
        except (PipelineError, KeyError): continue
        if not isinstance(rows, list) or len(rows) != receipt.get('rowCount'):
            continue
        matches = [row for row in rows if str(row.get(proof['field'], '')) == task.recordIdentity]
        if len(matches) != 1 or set(proof.get('keyFields', [])) != set(bound_record.get('keys', {})):
            continue
        if not all(str(matches[0].get(k)) == value for k, value in bound_record['keys'].items()):
            continue
        result[sid] = source
    return result


def recoverable_lookup_failure(verification, retained):
    """A missing detail may not erase independent verified lookup evidence.

    Page/view mismatches, ambiguous identities and missing record definitions
    remain blocking. Callers must supply reusable_lookups-validated sources.
    """
    failures = [c for c in verification.checks if c.status != 'verified']
    return (bool(retained) and not verification.passed and bool(failures)
            and all(c.requirementId == 'record' and c.reason == 'record_not_verified'
                    for c in failures))


def missing_lookup_attributes(task, knowledge, definitions):
    """Report unbound requested properties before a destructive projection."""
    if task.outputShape != 'detail' or not task.recordIdentity:
        return []
    mappings = {(d['operationRef'], d['sourcePath']) for d in definitions}
    names = {frozenset(_words(name)) for fact in semantic_bindings(knowledge)
             if fact['kind'] == 'attribute' and (fact['operationRef'], fact['sourcePath']) in mappings
             for name in [fact['concept'], *fact.get('aliases', []),
                          *(a['value'] for a in fact.get('intentAliases', []))] if _words(name)}
    return [value for value in task.requestedAttributes if frozenset(_words(value)) not in names]
