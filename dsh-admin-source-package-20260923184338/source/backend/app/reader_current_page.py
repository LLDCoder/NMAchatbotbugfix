"""Current browser parameters are navigation hints until a fresh entity read."""
from datetime import datetime, timezone
import json
from urllib.parse import urlsplit


def _time(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result if result.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def navigation_value(task, candidate, definition, current_page, *, now=None):
    """Accept only the current exact authorized page's declared scalar hint."""
    from .reader_context import PRIVATE_KEY
    from .reader_record_request import validate_scalar_record_identity
    from .reader_routing import fail
    now = now or datetime.now(timezone.utc)
    hint = current_page or {}
    captured = _time(hint.get('capturedAt'))
    name = definition.get('name')
    fields = [name, definition.get('field'), definition.get('identityField'),
              *definition.get('keyFields', [])]
    if (not task.recordIdentity or definition.get('from') != 'current_page'
            or not all(isinstance(field, str) and field and not PRIVATE_KEY.search(field) for field in fields)
            or not definition.get('keyFields') or not definition.get('operationRef')
            or not definition.get('sourcePath') or name not in candidate.get('parameters', [])):
        fail('current_page_binding_knowledge_missing', 'planning')
    validate_scalar_record_identity(task.recordIdentity)
    value = (hint.get('query') or {}).get(name)
    if (hint.get('source') != 'browser_hint' or hint.get('routeAuthorized') is not True
            or hint.get('route') != candidate['route'] or not captured
            or not -30 <= (now - captured).total_seconds() <= 900
            or len(hint.get('selectedRecordKeys') or []) > 1
            or not isinstance(value, str) or not value.strip() or len(value) > 500
            or any(ord(char) < 32 for char in value)):
        fail('current_page_navigation_hint_unavailable', 'planning', {
            'correction': 'This current-page parameter hint is absent, stale, ambiguous or for another authorized page. '
                'Use a documented lookup predecessor instead. Never copy a pasted URL or old conversation value '
                'into currentPage, or treat a browser hint as verified record data.'})
    return value


def navigation_proof(task, candidate, definition, current_page, principal_scope_ref, turn_ref):
    from .reader_routing import fail, task_fingerprint
    now = datetime.now(timezone.utc)
    value = navigation_value(task, candidate, definition, current_page, now=now)
    if not principal_scope_ref or not turn_ref:
        fail('current_page_principal_context_missing', 'permission')
    return value, {'kind': 'current_page_navigation', 'identity': task.recordIdentity,
        'taskFingerprint': task_fingerprint(task), 'page': candidate['route'],
        'principalScopeRef': principal_scope_ref, 'turnRef': turn_ref,
        'boundAt': now.isoformat(), 'bindingIds': [definition['bindingId']],
        'parameter': {'name': definition['name'], 'value': value}}


def prefer_current_navigation(decision, task, candidates, knowledge, current_page):
    """Reuse one declared entry for the already-selected entity, without proving it."""
    from .generic_reader import PipelineError
    from .reader_requirements import requirements_for
    from .reader_routing import page_routing, validate_decision
    if (decision.decision not in {'route', 'probe'} or len(decision.routePlan) != 2
            or not task.needsLiveData or not task.readOnly or not task.recordIdentity
            or task.outputShape != 'detail' or task.filters or task.groupBy
            or task.requestedMeasures or task.view or task.timeField
            or task.timeRange not in ('', 'unknown')):
        return decision, None
    try:
        if isinstance(json.loads(task.recordIdentity), (list, dict)):
            return decision, None
    except (TypeError, ValueError):
        pass
    lookup, final = decision.routePlan
    if (lookup.purpose != 'locate_record' or final.purpose != 'read_final'
            or not set(lookup.requirementIds) <= {'object', 'grain', 'record'}
            or lookup.parameterBindingIds or len(final.parameterBindingIds) != 1):
        return decision, None
    recalled = {c['candidateId']: c for c in candidates}
    candidate = recalled.get(final.candidateId)
    evaluated = {c.candidateId: c for c in decision.candidates}
    if not candidate or final.candidateId not in evaluated or lookup.candidateId not in evaluated:
        return decision, None
    conditions = {c.requirementId: c.status for c in evaluated[final.candidateId].conditions}
    required = {r['id'] for r in requirements_for(task)}
    lookup_conditions = {c.requirementId: c.status for c in evaluated[lookup.candidateId].conditions}
    if (set(conditions) != required or conditions.get('record') not in {'unknown', 'supported'}
            or any(status != 'supported' for key, status in conditions.items() if key != 'record')
            or any(lookup_conditions.get(key) != 'supported' for key in ('object', 'grain'))):
        return decision, None
    definitions = page_routing(knowledge, candidate['route'])
    selected = [p for p in definitions['parameters'] if p['bindingId'] in final.parameterBindingIds]
    alternatives = [p for p in definitions['parameters'] if p.get('from') == 'current_page']
    if (len(selected) != 1 or selected[0].get('from') != 'previous_record'
            or len(alternatives) != 1):
        return decision, None
    previous, alternative = selected[0], alternatives[0]
    # A relationship lookup cannot be replaced with a different entity/key contract.
    if any(previous.get(key) != alternative.get(key)
           for key in ('name', 'identityField', 'keyFields', 'field')):
        return decision, None
    if not any(all(record.get(key) == alternative.get(key)
                   for key in ('operationRef', 'sourcePath', 'identityField', 'keyFields'))
               for record in definitions['records']):
        return decision, None
    # Extra query values may select a different subview/population. Never silently
    # drop or transfer those constraints into this single-parameter navigation.
    if set((current_page or {}).get('query') or {}) != {alternative.get('name')}:
        return decision, None
    try:
        validate_decision(decision, task, candidates, knowledge, current_page=current_page)
        navigation_value(task, candidate, alternative, current_page)
        replacement = decision.model_copy(deep=True)
        replacement.decision = 'probe'
        replacement.routePlan = [final.model_copy(update={'parameterBindingIds': [alternative['bindingId']]})]
        validate_decision(replacement, task, candidates, knowledge, current_page=current_page)
    except PipelineError:
        return decision, None
    # Do not upgrade record conditions, requirement coverage, or any returned facts.
    return replacement, {'reason': 'same_destination_current_navigation',
        'before': [hop.model_dump() for hop in decision.routePlan],
        'after': [hop.model_dump() for hop in replacement.routePlan],
        'recordConditionUnchanged': conditions['record'], 'requiresFreshRecordVerification': True}


def current_page_record_matches(task, path, observation, sources, definitions, parameters,
                                proof, principal_scope_ref, turn_ref):
    """Prove one returned detail entity, not global business-number uniqueness."""
    from .generic_reader import pointer, PipelineError
    from .reader_bindings import verified_scalar_keys
    from .reader_collection import projection_hash
    from .reader_routing import task_fingerprint
    bound = _time(proof.get('boundAt'))
    now = datetime.now(timezone.utc)
    if (proof.get('identity') != task.recordIdentity or proof.get('taskFingerprint') != task_fingerprint(task)
            or proof.get('page') != path or not principal_scope_ref or not turn_ref
            or proof.get('principalScopeRef') != principal_scope_ref or proof.get('turnRef') != turn_ref
            or not bound or not 0 <= (now - bound).total_seconds() <= 900):
        return [], 'current_page_read_context_unverified'
    selected = [p for p in parameters if p.get('bindingId') in proof.get('bindingIds', [])]
    if len(selected) != 1 or selected[0].get('from') != 'current_page':
        return [], 'current_page_binding_knowledge_missing'
    parameter = selected[0]
    entry = proof.get('parameter') or {}
    if (entry.get('name') != parameter.get('name') or not entry.get('value')
            or observation.get('pageIdentity', {}).get('parameterHashes', {}).get(entry['name'])
               != projection_hash(entry['value'])):
        return [], 'current_page_parameter_unverified'
    compatible = [d for d in definitions if all(d.get(k) == parameter.get(k)
                  for k in ('operationRef', 'sourcePath', 'identityField', 'keyFields'))]
    if not compatible:
        return [], 'current_page_record_contract_missing'
    matches = []
    for sid, source in sources.items():
        if source.get('operationRef') != parameter['operationRef']:
            continue
        captured = _time(source.get('capturedAt'))
        if (source.get('kind') != 'api_response' or source.get('ready') is False
                or source.get('principalScopeRef') != principal_scope_ref
                or source.get('taskFingerprint') != task_fingerprint(task)
                or urlsplit(source.get('page', '')).path != path
                or not source.get('observationRef') or not captured or not bound <= captured <= now):
            return [], 'current_page_source_context_unverified'
        try:
            row = pointer(source.get('data', {}), parameter['sourcePath'])
        except PipelineError:
            return [], 'current_page_record_not_verified'
        keys = parameter['keyFields']
        if not verified_scalar_keys(source, parameter['sourcePath'],
                                    [parameter['identityField'], parameter['field'], *keys]):
            return [], 'current_page_record_fields_unverified'
        if (not isinstance(row, dict)
                or str(row.get(parameter['identityField'], '')) != task.recordIdentity
                or str(row.get(parameter['field'], '')) != entry['value']
                or any(type(row.get(key)) not in (str, int) or not str(row[key]).strip()
                       or str(row[key]) == '[truncated]' for key in keys)):
            return [], 'current_page_record_not_verified'
        matches.append((sid, tuple(str(row[key]) for key in keys), row, compatible[0], True))
    if len({match[1] for match in matches}) > 1:
        return [], 'record_ambiguous'
    return (matches, '') if matches else ([], 'current_page_record_not_verified')
