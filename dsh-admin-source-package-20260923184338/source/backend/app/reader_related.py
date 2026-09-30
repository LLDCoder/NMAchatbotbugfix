"""Page-defined related reads: fresh observed keys, trusted GET policy, proven lineage."""
from urllib.parse import urlsplit
from .reader_text import words
from .reader_collection import projection_hash


KEYS = {'operationKey', 'parentOperationKey', 'parentPath', 'parentField', 'parameter', 'responseKeyPath'}


def related_reads(knowledge, page, task):
    requested = [set(words(x, split_identifiers=True)) for x in task.requestedAttributes]
    result = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if record.get('status') != 'active' or urlsplit(page).path not in record.get('applicability', {}).get('pageRefs', []):
            continue
        for rule in record.get('payload', {}).get('relatedReads', []):
            if not isinstance(rule, dict):
                continue
            collection = rule.get('ownership') == 'request_parameter_collection'
            required_keys = (KEYS - {'responseKeyPath'}) | {'ownership', 'relationshipRef', 'collectionPath'} if collection else KEYS
            if not required_keys <= set(rule):
                continue
            concepts = [set(words(x, split_identifiers=True)) for x in rule.get('requiredFor', []) if isinstance(x, str)]
            if not any(a and b and (a <= b or b <= a) for a in requested for b in concepts):
                continue
            spec = {k: rule[k] for k in required_keys}
            if not all(isinstance(v, str) and v for v in spec.values()):
                continue
            if collection:
                spec['responseKeyPath'] = None
            projections = {}
            for fact in record.get('payload', {}).get('bindings', []):
                if not isinstance(fact, dict) or fact.get('kind') != 'attribute':
                    continue
                operation = fact.get('operationRef') or record.get('payload', {}).get('sourceBinding', {}).get('operationRef')
                path, fields = fact.get('sourcePath'), fact.get('fields')
                if (operation == spec['operationKey'] and isinstance(path, str)
                        and isinstance(fields, list) and all(isinstance(f, str) for f in fields)):
                    projections.setdefault(path, set()).update(fields)
            key = projection_hash(spec)
            for previous in result.get(key, {}).get('projections', []):
                projections.setdefault(previous['path'], set()).update(previous['fields'])
            projected = [{'path': path, 'fields': sorted(fields)} for path, fields in projections.items()
                         if fields and len(fields) <= 20]
            if projected:
                spec['projections'] = projected[:3]
            result[key] = spec
    return list(result.values())[:2]


def bind_related_records(sources):
    from .generic_reader import pointer, PipelineError
    from .reader_subject import property_of_record
    proofs = []
    for sid, source in sources.items():
        receipt = source.get('relatedReadReceipt') or {}
        if (receipt.get('ownership', 'echoed_key') != 'echoed_key'
                or receipt.get('verified') is not True or receipt.get('operationKey') != source.get('operationRef')):
            continue
        for parent_id, parent in sources.items():
            proof = parent.get('verifiedRecord') or {}
            path = receipt.get('parentPath', '')
            if (parent.get('operationRef') != receipt.get('parentOperationKey') or not proof.get('single')
                    or parent.get('principalScopeRef') != source.get('principalScopeRef')
                    or parent.get('capturedAt') != source.get('capturedAt')
                    or not (path == proof.get('path') or property_of_record(parent, path))):
                continue
            try:
                value = pointer(parent['data'], path)
                if isinstance(value, list):
                    if len(value) != 1:
                        continue
                    row = value[0]
                else:
                    row = value
                key = row[receipt['parentField']]
                child_key = pointer(source['data'], receipt['responseKeyPath'])
            except (PipelineError, KeyError, TypeError):
                continue
            if projection_hash({receipt['parentField']: key}) != receipt.get('parentValueHash') or projection_hash(key) != receipt.get('keyHash') or projection_hash(child_key) != receipt.get('keyHash'):
                continue
            source['verifiedRecord'] = {**proof, 'path': receipt['responseKeyPath'].rsplit('/', 1)[0],
                'field': receipt['responseKeyPath'].rsplit('/', 1)[1],
                'keyFields': [receipt['responseKeyPath'].rsplit('/', 1)[1]],
                'boundTo': 'verified_related_record', 'parentSourceId': parent_id}
            proofs.append({'sourceId': sid, 'parentSourceId': parent_id, 'operationKey': receipt['operationKey']})
    return proofs


def page_reads(knowledge, page, task):
    """A page may declare a supplemental authorized GET for a requested scope.

    Only explicit structured definitions apply. The gateway still checks its
    server-owned operation registry and upstream identity/page permissions.
    """
    result = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if record.get('status') != 'active' or urlsplit(page).path not in record.get('applicability', {}).get('pageRefs', []):
            continue
        for rule in record.get('payload', {}).get('pageReads', []):
            if not isinstance(rule, dict) or rule.get('requiredScope') != task.requestedScope:
                continue
            activation = rule.get('requiredIntent')
            if activation is not None:
                from .reader_record_request import record_filter_identifiers
                filters = getattr(task, 'filters', None)
                if (activation != 'bare_record_set' or not isinstance(filters, list)
                        or len(filters) != 1 or not record_filter_identifiers(filters[0])
                        or getattr(task, 'outputShape', None) != 'list'
                        or getattr(task, 'readOnly', None) is not True
                        or getattr(task, 'needsLiveData', None) is not True
                        or getattr(task, 'recordIdentity', None) != ''
                        or getattr(task, 'view', None) != ''
                        or getattr(task, 'businessFocus', None) != ''
                        or getattr(task, 'timeRange', None) not in {'', 'unknown'}
                        or getattr(task, 'timeField', None) != ''
                        or any(getattr(task, name, None) != [] for name in (
                            'requestedAttributes', 'requestedMeasures', 'requestedOrdering',
                            'groupBy', 'unresolvedSlots'))):
                    continue
            required = rule.get('requiredFor', [])
            if required:
                requests = [getattr(task, 'businessFocus', ''), *getattr(task, 'requestedAttributes', []),
                            *getattr(task, 'requestedMeasures', []), *getattr(task, 'groupBy', []),
                            *getattr(task, 'filters', [])]
                if (not isinstance(required, list) or not any(
                        set(words(concept)) and (set(words(concept)) <= set(words(request))
                        or set(words(request)) and set(words(request)) <= set(words(concept)))
                        for concept in required if isinstance(concept, str) for request in requests)):
                    continue
            objects = rule.get('requiredObjects', [])
            names = [value for value in objects if isinstance(value, str)]
            # Reuse aliases from this page's object definition. The operation
            # and field meaning remain unchanged by a translation synonym.
            for fact in record.get('payload', {}).get('bindings', []):
                if not isinstance(fact, dict) or fact.get('kind') != 'object':
                    continue
                operation = fact.get('operationRef') or record.get('payload', {}).get('sourceBinding', {}).get('operationRef')
                aliases = [fact.get('concept', ''), *fact.get('aliases', [])]
                aliases = [a for a in aliases if isinstance(a, str) and a]
                if operation == rule.get('operationKey') and any(words(a) == words(n) for a in aliases for n in names):
                    names += aliases
            if not any(words(task.businessObject) == words(value) for value in names):
                continue
            operation, params = rule.get('operationKey'), rule.get('parameters', {})
            if not isinstance(operation,str) or not operation.startswith(('GET ', 'POST ')) or not isinstance(params,dict):
                continue
            spec = {'operationKey':operation, 'parameters':params}
            result[projection_hash(spec)] = spec
    return list(result.values())[:4]



def compile_page_read_selection(task, page, selection, sources, knowledge):
    """Retain unambiguous required page reads already executed by the gateway.

    No new operation runs here, and selecting provenance does not satisfy an
    answer requirement. The ordinary evaluator still checks scope and lineage.
    """
    from .reader_requirements import _context_match
    if selection.nextActions or selection.missing:
        return []
    corrections = []
    for spec in page_reads(knowledge, page, task):
        matches = [sid for sid, source in sources.items()
            if source.get('operationRef') == spec['operationKey']
            and urlsplit(source.get('page', '')).path == urlsplit(page).path
            and source.get('principalScopeRef') and source.get('observationRef')
            and source.get('ready', True) and not source.get('collectionFailure')
            and _context_match({'contextParameters': spec['parameters']}, source)]
        if len(matches) == 1 and matches[0] not in selection.sourceIds:
            selection.sourceIds.append(matches[0])
            corrections.append({'sourceId': matches[0], 'operationRef': spec['operationKey'],
                                'reason': 'required_observed_page_read'})
    return corrections


def validate_page_read_selection(task, page, selection, sources, knowledge):
    """Keep a documented supplemental scope source in the selected evidence."""
    from .generic_reader import PipelineError
    if selection.nextActions or selection.missing:
        return
    for spec in page_reads(knowledge, page, task):
        operation = spec['operationKey']
        def matches(source):
            if source.get('operationRef') != operation:
                return False
            params = spec['parameters']
            if not params:
                return True
            if operation.startswith('GET '):
                params = {k: str(v).lower() if type(v) is bool else str(v) for k, v in params.items()}
            hashes = (source.get('collectionContext') or {}).get('parameterHashes', {})
            return all(hashes.get(k) == projection_hash(v) for k, v in params.items())
        if any(matches(sources.get(sid, {})) for sid in selection.sourceIds):
            continue
        available = [sid for sid, source in sources.items() if matches(source)]
        raise PipelineError('documented_scope_source_not_selected' if available else 'expected_source_not_observed',
            'planning' if available else 'runtime', details={
                'expectedOperation': operation, 'availableSourceIds': available,
                'correction': 'This page defines a supplemental source for the requested object and scope. '
                    'Select that observed source; another queue cannot establish its population. '
                    'If it is unavailable, report the missing read rather than substitute a different scope.'})


def related_context_read(task, kind, parent_id, binding_path, binding_fields, sources, read, output):
    """A proven related GET can carry a single parent's object/grain context.

    This never certifies child counts as parent counts or inherits filters,
    scope, time, field meanings or completeness across operations.
    """
    from .reader_related_collection import collection_context_read
    if (sources.get(read.sourceId, {}).get('relatedReadReceipt') or {}).get('ownership') == 'request_parameter_collection':
        return collection_context_read(task, kind, parent_id, binding_path, binding_fields, sources, read, output)
    from .reader_subject import property_of_record
    parent = sources.get(parent_id, {}); child = sources.get(read.sourceId, {})
    proof = parent.get('verifiedRecord') or {}; linked = child.get('verifiedRecord') or {}
    receipt = child.get('relatedReadReceipt') or {}
    return bool(task and task.outputShape == 'detail' and task.recordIdentity
        and task.requestedAttributes and not task.requestedMeasures and not task.groupBy
        and kind in {'object', 'grain'} and read.op == 'read_rows'
        and output.get('role') == 'detail' and isinstance(output.get('value'), list)
        and proof.get('single') and proof.get('identity') == task.recordIdentity
        and proof.get('path') == binding_path and binding_fields
        and set(binding_fields) == set(proof.get('keyFields', []))
        and linked.get('single') and linked.get('boundTo') == 'verified_related_record'
        and linked.get('identity') == proof.get('identity') and linked.get('parentSourceId') == parent_id
        and receipt.get('verified') is True and receipt.get('parentOperationKey') == parent.get('operationRef')
        and receipt.get('operationKey') == child.get('operationRef')
        and child.get('principalScopeRef') == parent.get('principalScopeRef')
        and child.get('capturedAt') == parent.get('capturedAt')
        and (read.path == linked.get('path') or property_of_record(child, read.path)))


def redundant_parent_relation_reads(task, binding, fact, sources, steps, outputs):
    """A verified relation key is provenance for a parent's object/grain.

    Only a hidden lookup already owned by an exposed, same-session related
    read is redundant. This does not prove attributes, filters or counts.
    """
    if fact.get('kind') not in {'object', 'grain'}:
        return []
    parent = sources.get(binding.sourceId, {})
    if not parent.get('principalScopeRef') or not parent.get('capturedAt'):
        return []
    reachable = set().union(*(set(ids) for ids in outputs.values())) if outputs else set()
    receipts = []
    for read in steps.values():
        if any(read.id in ancestors and related_context_read(task, fact['kind'],
                binding.sourceId, fact.get('sourcePath', ''), fact.get('fields', []),
                sources, read, {'role': steps[oid].role, 'value': []})
                for oid, ancestors in outputs.items()):
            receipts.append(sources[read.sourceId]['relatedReadReceipt'])
    return [sid for sid in binding.stepIds if sid not in reachable and sid in steps
        and steps[sid].op == 'read_rows' and not steps[sid].expose and not steps[sid].inputs
        and steps[sid].sourceId == binding.sourceId
        and any(steps[sid].path == receipt.get('parentPath')
            and receipt.get('parentField') in steps[sid].fields for receipt in receipts)]


def redundant_related_key_reads(binding, fact, sources, steps, outputs):
    """Only remove redundant key lookups from an already-proved child attribute.

    This does not certify the attribute or compare values. Its own source,
    fields, meaning, output ancestry and historical limitations still apply.
    """
    source = sources.get(binding.sourceId, {})
    proof, receipt = source.get('verifiedRecord') or {}, source.get('relatedReadReceipt') or {}
    parent_id = proof.get('parentSourceId'); parent = sources.get(parent_id, {})
    if (fact.get('kind') != 'attribute' or proof.get('boundTo') != 'verified_related_record'
            or not proof.get('single') or receipt.get('verified') is not True
            or receipt.get('operationKey') != source.get('operationRef')
            or receipt.get('parentOperationKey') != parent.get('operationRef')
            or not source.get('principalScopeRef') or not source.get('capturedAt')
            or any(source.get(k) != parent.get(k) for k in ('principalScopeRef', 'capturedAt'))):
        return []
    reachable = set().union(*(set(ids) for ids in outputs.values())) if outputs else set()
    actual = [s for s in steps.values() if s.id in reachable and s.sourceId == binding.sourceId
              and s.op == 'read_rows' and s.path == binding.sourcePath
              and set(binding.fields) <= set(s.fields)]
    if not actual:
        return []
    return [sid for sid in binding.stepIds if sid not in reachable and sid in steps
            and steps[sid].op == 'read_rows' and not steps[sid].expose and not steps[sid].inputs
            and steps[sid].sourceId == parent_id and steps[sid].path == receipt.get('parentPath')
            and receipt.get('parentField') in steps[sid].fields]


def page_read_failure(task, page, knowledge, observation):
    """A failed required transport is not missing business knowledge."""
    from .generic_reader import PipelineError
    expected={spec['operationKey'] for spec in page_reads(knowledge,page,task)}
    for outcome in observation.get('pageReadOutcomes',[]):
        if (not isinstance(outcome,dict) or outcome.get('verified') is not False
                or outcome.get('operationKey') not in expected):continue
        reason=outcome.get('reason','page_read_dependency_unavailable')
        category=('permission' if reason=='page_read_access_denied' else
            'execution_configuration' if reason in {'page_read_not_registered','page_read_not_allowed','page_read_not_readonly'}
            else 'runtime')
        code=reason if category!='runtime' else 'page_read_dependency_unavailable'
        return PipelineError(code,category,details={'stage':'SupplementalPageRead',
            'operationKey':outcome['operationKey'],'errorType':outcome.get('errorType'),
            'dependency':outcome.get('dependency',{})})
    return None
