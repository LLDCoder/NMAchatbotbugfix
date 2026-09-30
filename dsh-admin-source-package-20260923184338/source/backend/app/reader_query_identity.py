"""Current query caller labels, independent of the previous query's scope.

The caller must supply the native GetUserInfo response and the program-owned
receipt for this request. Missing profile fields remain pending for the existing
authenticated-profile read pipeline; a role or page cannot fill them in.
"""
from copy import deepcopy
from datetime import datetime

from .reader_session_scope import _label, _labels, _role_labels


def _instant(value):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return stamp if stamp.tzinfo is not None else None
    except (AttributeError, TypeError, ValueError):
        return None


def current_query_identity(auth_response, *, user_id, request_id, permission_receipt,
                           request_started_at, language):
    """Return fresh display facts plus explicit unfilled profile requirements."""
    data = auth_response.get('data') if isinstance(auth_response, dict) else None
    observed = _instant(permission_receipt.get('observedAt'))
    started = _instant(request_started_at)
    if (not isinstance(data, dict) or not user_id or str(data.get('id') or '') != str(user_id)
            or not request_id or permission_receipt.get('requestId') != request_id
            or not permission_receipt.get('fingerprint') or not permission_receipt.get('principalScopeRef')
            or not observed or not started
            or observed < started):
        return {'verified': False, 'reason': 'current_query_identity_unverified',
                'remainingProfileAttributes': ['account', 'department', 'role'],
                'rowScopeVerified': False, 'queryScopeEstablished': False}
    # firstName / lastName are the authenticated Portal header's display source.
    # Do not fall back to the internal user ID or email when labels are absent.
    names = [label for field in ('firstName', 'lastName') if (label := _label(data.get(field)))]
    account = ' '.join(names)
    roles = _role_labels(data, language)
    departments = _labels(data, ('departmentsInfo', 'departments', 'departmentNames', 'departmentName'), language)
    values = {'account': account, 'department': departments, 'role': roles}
    remaining = [key for key, value in values.items() if not value or (isinstance(value, list) and len(value) > 20)]
    return {'schemaVersion': 'fresh-query-caller/1', 'verified': True,
            'accountDisplayName': account, 'departments': departments[:20], 'roles': roles[:20],
            'remainingProfileAttributes': remaining, 'identityComplete': not remaining,
            'sourceRequestId': request_id, 'observedAt': permission_receipt['observedAt'],
            'permissionFingerprint': permission_receipt['fingerprint'],
            'principalScopeRef': permission_receipt['principalScopeRef'],
            'source': 'current_authenticated_GetUserInfo',
            'rowScopeVerified': False, 'queryScopeEstablished': False}


def query_scope_assignment(previous_projection, current_identity):
    """Keep prior read evidence separate; identity can never replace its scope.

    This is an internal deferred-work contract, not an answer or success result.
    In particular, continueProfileRead=true must prevent an early successful answer.
    """
    historical = deepcopy(previous_projection)
    identity = deepcopy(current_identity)
    missing = identity.get('remainingProfileAttributes', [])
    historical_verified = (historical.get('kind') == 'query_scope' and historical.get('verified') is True
                           and bool(identity.get('principalScopeRef'))
                           and historical.get('principalScopeRef') == identity.get('principalScopeRef'))
    identity_verified = identity.get('verified') is True
    return {'schemaVersion': 'query-scope-source-assignment/1',
            'historicalQuery': historical, 'currentIdentity': identity,
            'historicalScopeVerified': historical_verified,
            'continueProfileRead': identity_verified and bool(missing),
            'remainingProfileAttributes': list(missing),
            'complete': historical_verified and identity_verified and identity.get('identityComplete') is True,
            'profileCanReplaceHistoricalQueryReceipt': False,
            'rowScopeVerifiedByIdentity': False}


def profile_read_plan(knowledge, missing, catalog, authorized):
    """Only one active, authorized, subject-bound display-property mapping."""
    display_fields = {'name', 'nameEn', 'nameAr', 'departmentName', 'departmentNameEn',
                      'departmentNameAr', 'roleName', 'roleNameEn', 'roleNameAr'}
    routes = {route for page in catalog for route in page['routes']}
    choices = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}
        payload = record.get('payload') or {}
        if not isinstance(payload, dict):
            continue
        source = payload.get('sourceBinding') or {}
        subject = payload.get('authenticatedRecord') or {}
        if (not isinstance(source, dict) or not isinstance(subject, dict)
                or record.get('status') != 'active' or record.get('kind') != 'field_semantics'
                or subject.get('subject') != 'user' or not subject.get('identityField')
                or not isinstance(subject.get('identityField'), str)
                or not isinstance(subject.get('requestField'), str) or not subject['requestField']
                or not isinstance(source.get('operationRef'), str) or not source['operationRef']
                or not str(source.get('sourcePath', '')).startswith('/')):
            continue
        bindings = payload.get('bindings')
        if not isinstance(bindings, list):
            continue
        for binding in bindings:
            if not isinstance(binding, dict):
                continue
            attribute = binding.get('concept')
            fields = binding.get('fields')
            if (binding.get('kind') != 'attribute' or not isinstance(attribute, str) or attribute not in missing
                    or attribute not in {'department', 'role'}
                    or binding.get('operationRef') != source['operationRef']
                    or not str(binding.get('sourcePath', '')).startswith('/')
                    or not isinstance(fields, list) or not fields or not all(isinstance(f, str) for f in fields)
                    or not set(fields) <= display_fields):
                continue
            for route in record.get('applicability', {}).get('pageRefs', []):
                if not isinstance(route, str) or route not in routes or not authorized(route):
                    continue
                key = (route, source['operationRef'], source['sourcePath'],
                       subject['identityField'], subject['requestField'])
                choices.setdefault(key, {}).setdefault(attribute, []).append({
                    'attribute': attribute, 'path': binding['sourcePath'], 'fields': fields,
                    'recordId': record['id'], 'revision': record['revision'],
                    'bindingId': binding.get('id'), 'sourceDocumentId': item['documentId']})
    if len(choices) != 1:
        return None
    key, properties = next(iter(choices.items()))
    if any(len({(p['path'], tuple(p['fields'])) for p in values}) != 1 for values in properties.values()):
        return None
    return {'page': key[0], 'operationRef': key[1],
            'properties': [values[0] for values in properties.values()]}


def observed_profile_labels(knowledge, plan, sources, user_id, principal_ref, captured_at):
    """Existing subject proof plus complete property hashes; no row inference."""
    from .generic_reader import pointer, PipelineError
    from .reader_collection import projection_hash
    from .reader_subject import bind_fresh_authenticated_records, bind_record_properties, property_of_record
    proofs = bind_fresh_authenticated_records(knowledge, sources, user_id, page=plan['page'],
        captured_at=captured_at, principal_scope_ref=principal_ref)
    bind_record_properties(knowledge, sources)
    verified = {proof['sourceId'] for proof in proofs}
    labels, evidence = {}, []
    for prop in plan['properties']:
        matches = []
        for sid, source in sources.items():
            if (sid not in verified or source.get('operationRef') != plan['operationRef']
                    or not property_of_record(source, prop['path'])):
                continue
            try:
                rows = pointer(source['data'], prop['path'])
            except PipelineError:
                continue
            receipt = source.get('fieldEvidence', {}).get(prop['path'], {})
            if (not isinstance(rows, list) or len(rows) > 20 or receipt.get('status') != 'complete'
                    or receipt.get('valueHash') != projection_hash(rows)):
                continue
            values = []
            for row in rows:
                label = next((_label(row.get(field)) for field in prop['fields'] if _label(row.get(field))), '') if isinstance(row, dict) else ''
                if not label:
                    break
                if label not in values:
                    values.append(label)
            else:
                matches.append((sid, values))
        # Two separately observed sources do not become one identity snapshot.
        if len(matches) != 1:
            continue
        sid, values = matches[0]
        labels[prop['attribute']] = values
        source = sources[sid]
        evidence.append({**prop, **{key: source[key] for key in
            ('page', 'capturedAt', 'observationRef', 'principalScopeRef')},
            'sourceId': sid, 'subjectBound': True, 'propertyComplete': True})
    return labels, evidence


async def complete_query_identity(reader, projection, auth_response, principal, catalog, authorized,
                                  permission, fingerprint, started_at):
    """Bounded use of the existing policy/gateway/subject-proof read chain."""
    from datetime import timezone
    from urllib.parse import urlsplit
    from .generic_reader import (KnowledgeStore, PipelineError, observation_request,
        portal_result_failure, source_inventory, unavailable_source_error)
    from .reader_context import page_knowledge
    from .reader_upstream_failure import upstream_failure
    current = current_query_identity(auth_response, user_id=principal.user_id,
        request_id=principal.request_id, permission_receipt={**reader.audit['permission'],
            'requestId': principal.request_id, 'principalScopeRef': fingerprint},
        request_started_at=started_at, language=reader.response_language)
    result = deepcopy(projection)
    try:
        if current.get('verified') and current['remainingProfileAttributes']:
            knowledge = KnowledgeStore()
            try:
                knowledge.add({'chunks': page_knowledge(reader.artifacts_dir, catalog)})
            except (OSError, ValueError):
                raise PipelineError('current_profile_definition_unavailable', 'runtime')
            plan = profile_read_plan(knowledge, current['remainingProfileAttributes'], catalog, authorized)
            if not plan:
                raise PipelineError('current_profile_binding_unavailable')
            request = observation_request(plan['page'], [])
            failure = reader.policy.validate(request, permission)
            if failure:
                raise PipelineError(failure, 'permission')
            if 'admin.portal.read' not in reader.allowed_tools:
                raise PipelineError('current_profile_tool_unavailable', 'unsupported_operation')
            current['profileReadAttempted'] = True
            portal = await reader.call('query_identity_profile', reader.gateway.invoke(principal,
                'admin.portal.read', request.as_payload(), allowed_tools=reader.allowed_tools),
                reader.budget.portal_read_seconds)
            if not portal.get('ok'):
                raise upstream_failure(portal.get('status')) or PipelineError('current_profile_read_failed', 'runtime')
            response = portal.get('result') or {}
            failure = portal_result_failure(response)
            if failure:
                raise failure
            observation = response.get('observation') or {}
            actual = observation.get('pageIdentity', {}).get('path') or response.get('page') or ''
            if urlsplit(actual).path.rstrip('/') != plan['page'].rstrip('/'):
                raise PipelineError('current_profile_page_mismatch')
            captured = datetime.now(timezone.utc).isoformat()
            sources = source_inventory(observation, plan['page'], captured, fingerprint)
            if not any(s.get('operationRef') == plan['operationRef'] for s in sources.values()):
                raise unavailable_source_error(observation, [plan['operationRef']])
            labels, evidence = observed_profile_labels(knowledge, plan, sources, principal.user_id, fingerprint, captured)
            current['profileEvidence'] = evidence
            current['verifiedEmptyAttributes'] = [key for key, values in labels.items() if not values]
            for attribute, values in labels.items():
                current['departments' if attribute == 'department' else 'roles'] = values
                current['remainingProfileAttributes'].remove(attribute)
            current['identityComplete'] = not current['remainingProfileAttributes']
            reader.audit['queryIdentityProfile'] = {'page': plan['page'], 'capturedAt': captured,
                'source': 'fresh_authorized_observation', 'properties': evidence,
                'missingAttributes': current['remainingProfileAttributes'],
                'historicalQueryReceiptReplaced': False}
    except PipelineError as error:
        current['profileFailure'] = {'code': error.code, 'category': error.category,
            **({'upstreamStatus': error.details['upstreamStatus']} if type(error.details.get('upstreamStatus')) is int else {})}
    assignment = query_scope_assignment(result, current)
    result['currentIdentity'] = current
    result['queryIdentityComplete'] = assignment['complete']
    result['supplementMissing'] = ([] if current.get('identityComplete') else
        [current.get('profileFailure', {}).get('code') or 'current_query_identity_incomplete'])
    if result.get('verified') and not assignment['historicalScopeVerified']:
        result['supplementMissing'].append('previous_query_identity_binding_unverified')
    result['supplementFailureCategory'] = current.get('profileFailure', {}).get('category', '')
    reader.audit['queryScopeSourceAssignment'] = {key: value for key, value in assignment.items()
        if key not in {'historicalQuery', 'currentIdentity'}}
    reader.audit['currentQueryIdentity'] = current
    return result


def render_query_identity(identity, language):
    import re
    from .generic_reader import safe_text
    ar = language == 'ar'
    literal = lambda value: re.sub(r'([\\`*_{}\[\]()<>!|])', r'\\\1', safe_text(value))
    lines = ['هوية الحساب الحالية:' if ar else 'Current signed-in identity:']
    for key, title in [('accountDisplayName', ('الحساب', 'Account')),
                       ('departments', ('الأقسام', 'Departments')), ('roles', ('الأدوار', 'Roles'))]:
        values = identity.get(key)
        if values:
            text = '، '.join(literal(v) for v in values) if isinstance(values, list) else literal(values)
            lines.append(title[0 if ar else 1] + ': ' + text)
    empty = identity.get('verifiedEmptyAttributes', [])
    if empty:
        labels = {'department': 'قسم' if ar else 'department', 'role': 'دور' if ar else 'role'}
        lines.append(('لم تُرجع معلومات الحساب تعيينًا لـ: ' if ar else 'The current profile returned no assignment for: ') +
                     ', '.join(labels[key] for key in empty))
    if not identity.get('identityComplete'):
        category = identity.get('profileFailure', {}).get('category')
        status = identity.get('profileFailure', {}).get('upstreamStatus')
        if status == 401:
            lines.append('انتهت صلاحية جلسة الخدمة عند قراءة الملف الشخصي.' if ar else
                         'The service session expired while reading the profile.')
        elif status == 403:
            lines.append('رفضت الخدمة قراءة معلومات الملف الشخصي المطلوبة.' if ar else
                         'The service denied the requested profile read.')
        elif category == 'permission':
            lines.append('لم يتم التحقق من مسار مصرح لقراءة الملف الشخصي.' if ar else
                         'An authorized profile read could not be verified.')
        elif category == 'runtime':
            lines.append('تعذرت قراءة بقية معلومات الملف الشخصي بسبب فشل الخدمة.' if ar else
                         'A service failure prevented the remaining profile information from being read.')
        else:
            lines.append('لم يتم التحقق من جميع معلومات هوية الحساب المطلوبة.' if ar else
                         'Some required account identity information remains unverified.')
    lines.append('هذه معلومات الحساب الحالية؛ أما نطاق الاستعلام السابق فتحدده أدلة القراءة أدناه، وليس اسم الدور أو القسم.' if ar else
                 'These are current account details. The previous query scope comes from its read evidence below, not from a role or department name.')
    return '\n\n'.join(lines)
