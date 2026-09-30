"""Read the current authenticated identity without inventing row permissions.

This is a source-specific projection of the already refreshed authentication
response. It does not authorize a business read, derive roles from the question,
or answer the scope of a previous business query.
"""
import re


def _words(value):
    return ' '.join(re.findall(r'[a-z]+', str(value).casefold()))


def session_request(task, canonical_question):
    """Conservatively identify a pure current-session metadata request.

Canonical semantics come from the existing intent parser. A current, explicit
self-reference is also required; conversation history cannot select a user.
Unsupported properties continue through the ordinary verified read pipeline.
"""
    if (getattr(task, 'requestBoundaries', []) or not task.readOnly or task.recordIdentity or task.clarification
            or task.outputShape not in {'detail', 'overview'} or task.contextRelation == 'cancel' or task.requestedScope not in {'personal', 'unknown'}
            or task.unresolvedSlots or task.requestedMeasures or task.groupBy or task.filters or task.requestedOrdering
            or task.timeField or task.timeRange not in {'', 'unknown'} or task.view
            or task.businessFocus not in {'', 'unknown'}):
        return None
    question = _words(canonical_question)
    if not re.search(r'\b(?:my|me|i|signed in|logged in|authenticated)\b', question):
        return None
    if re.search(r'\b(?:query|question|result|answer|earlier|previous|last|pretend|assume|impersonate)\b', question):
        return None
    subject = _words(task.businessObject)
    if not re.fullmatch(r'(?:(?:current|currently|signed in|logged in|authenticated|staff|admin|my) )*'
                        r'(?:user|account|session)(?: profile| identity| context)?', subject):
        return None
    aliases = {
        'role': 'roles', 'roles': 'roles', 'assigned role': 'roles', 'assigned roles': 'roles',
        'current role': 'roles', 'current roles': 'roles',
        'department': 'departments', 'departments': 'departments',
        'current department': 'departments', 'current departments': 'departments',
        'data scope': 'scope', 'access scope': 'scope', 'authorized scope': 'scope',
        'data access scope': 'scope', 'scope': 'scope',
        'permitted pages': 'pages', 'authorized pages': 'pages', 'accessible pages': 'pages',
    }
    requested = [aliases.get(_words(value)) for value in task.requestedAttributes]
    if not requested or any(value is None for value in requested):
        return None
    # Explicitly requesting another person's identity must never reuse ours.
    if re.search(r'\b(?:other|another|all users|colleague|customer|applicant)\b', question):
        return None
    return list(dict.fromkeys(requested))


def _label(value):
    if not isinstance(value, str):
        return ''
    value = ' '.join(value.split()).strip()[:160]
    # Field provenance determines whether a value is a display label. Preserve
    # names and abbreviations, but never surface route/credential text.
    if (not value or value.isdigit() or re.fullmatch(r'[0-9a-f-]{16,}', value, re.I)
            or re.search(r'/api/|https?://|Bearer\s|[\w.+-]+@[\w.-]+\.', value, re.I)):
        return ''
    return value


def _labels(data, collection_names, language):
    values = []
    for key in collection_names:
        rows = data.get(key)
        if isinstance(rows, str):
            rows = [rows]
        elif isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list):
            continue
        for row in rows:
            if isinstance(row, str):
                value = _label(row)
            elif isinstance(row, dict):
                names = ('nameAr', 'departmentNameAr', 'roleNameAr', 'name', 'departmentName', 'roleName', 'nameEn') if language == 'ar' else ('nameEn', 'departmentNameEn', 'roleNameEn', 'name', 'departmentName', 'roleName', 'nameAr')
                value = next((label for name in names if (label := _label(row.get(name)))), '')
            else:
                value = ''
            if value and value not in values:
                values.append(value)
    return values



def _role_labels(data, language):
    # GetUserInfo exposes IListRole.name/nameEn/nameAr and IRoleInfo.roleName.
    # Bare strings and role IDs have no verified display-name semantics.
    localized_names = ('nameAr', 'name', 'nameEn') if language == 'ar' else ('nameEn', 'name', 'nameAr')
    values = []
    seen_role_ids = set()
    for key, names in (('listRoles', localized_names), ('rolesInfo', ('roleName',))):
        rows = data.get(key)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            role_id = row.get('id' if key == 'listRoles' else 'roleID')
            if isinstance(role_id, str) and role_id and role_id in seen_role_ids:
                continue
            value = next((label for name in names if (label := _label(row.get(name)))), '')
            if value:
                if value not in values:
                    values.append(value)
                # IDs join the two authenticated representations internally;
                # they never become labels or permission evidence.
                if isinstance(role_id, str) and role_id:
                    seen_role_ids.add(role_id)
    return values


def session_projection(auth_response, principal_id, requested, catalog, authorized, language, observed_at):
    """Only caller-owned, fresh GetUserInfo facts and runtime-authorized pages."""
    data = auth_response.get('data') if isinstance(auth_response, dict) else None
    if not isinstance(data, dict) or str(data.get('id') or '') != str(principal_id):
        raise ValueError('session_identity_mismatch')
    roles = _role_labels(data, language)
    departments = _labels(data, ('departmentsInfo', 'departments', 'departmentNames', 'departmentName'), language)
    pages = []
    for page in catalog:
        for entry in page.get('businessNavigation', []):
            if not isinstance(entry, dict):
                continue
            route, label = entry.get('route'), _label(entry.get('label'))
            if (label and route in page.get('routes', []) and authorized(route)
                    and label not in pages):
                pages.append(label)
    missing = [key for key, values in [('roles', roles), ('departments', departments)]
               if key in requested and (not values or len(values) > 20)]
    if 'pages' in requested and len(pages) > 12:
        missing.append('pages')
    return {'schemaVersion': 'authenticated-session-summary/1',
            'requested': requested, 'roles': roles[:20], 'departments': departments[:20],
            'roleListTruncated': len(roles) > 20, 'departmentListTruncated': len(departments) > 20,
            'permittedPages': pages[:12], 'pageListTruncated': len(pages) > 12,
            'unavailableAttributes': missing, 'observedAt': observed_at,
            'provenance': 'refreshed_authenticated_session',
            'rowScopeVerified': False, 'recordValuesRead': False,
            'actionAuthorityInferred': False}


def render_session_projection(projection, language):
    def literal(value):
        # Display values remain data, including when their text looks like Markdown.
        return re.sub(r'([\\`*_{}\[\]()<>!|])', r'\\\1', str(value))

    ar = language == 'ar'
    requested = projection['requested']
    lines = []
    if 'roles' in requested:
        lines.append(('أدوارك المعيّنة: ' if ar else 'Your assigned roles: ') +
                     ('، ' if ar else ', ').join(literal(value) for value in projection['roles']) + '.'
                     if projection['roles'] else
                     ('لم يُرجع تسجيل الدخول الحالي أسماء الأدوار المعيّنة.' if ar else
                      'The current sign-in response did not provide assigned role names.'))
    if 'departments' in requested:
        lines.append(('أقسامك: ' if ar else 'Your departments: ') +
                     ('، ' if ar else ', ').join(literal(value) for value in projection['departments']) + '.'
                     if projection['departments'] else
                     ('لم يتوفر اسم قسم موثّق في معلومات تسجيل الدخول الحالية.' if ar else
                      'The current sign-in information does not provide a verified department name.'))
    if 'scope' in requested or 'pages' in requested:
        if projection['permittedPages']:
            lines.append(('تشمل الصفحات المتاحة لحسابك: ' if ar else 'Pages available to your account include: ') +
                         ('، ' if ar else ', ').join(literal(value) for value in projection['permittedPages']) + '.')
        else:
            lines.append('لم أتمكن من تحديد صفحات متاحة من الصلاحيات الحالية.' if ar else
                         'I could not identify available pages from the current permissions.')
        lines.append('أستطيع قراءة المعلومات التي يسمح بها حسابك فقط. السجلات المتاحة تحددها صلاحيات كل صفحة ونتيجة طلبها؛ ولا يعني اسم الدور أو ظهور الصفحة صلاحية الوصول إلى جميع سجلات القسم أو المؤسسة.' if ar else
                     'I can read only information your account is allowed to access. Each page and its request determine the available records; a role name or visible page does not establish access to every department or organization record.')
    return '\n\n'.join(lines)


def profile_subtask(task, resolved=('scope', 'pages')):
    """Partition only the session-backed scope explanation from profile reads.

    The caller preserves the original request and attaches an independent
    session receipt to final coverage. Unsupported questions never call this.
    """
    scope_attributes = set()
    if 'scope' in resolved:
        scope_attributes.update({'data scope', 'access scope', 'authorized scope', 'data access scope', 'scope'})
    if 'pages' in resolved:
        scope_attributes.update({'permitted pages', 'authorized pages', 'accessible pages'})
    attributes = [value for value in task.requestedAttributes if _words(value) not in scope_attributes]
    updates = [update.model_copy(update={'value': attributes})
               if update.field == 'requestedAttributes' else update for update in task.slotUpdates]
    return task.model_copy(update={'requestedAttributes': attributes, 'slotUpdates': updates})


def session_coverage(projection):
    """Scope is an explanation of observed access limits, not a row population."""
    return [{'id': 'session_' + attribute, 'kind': 'authenticated_session_metadata',
             'value': 'current authorized page availability and record-access boundary',
             'status': 'satisfied', 'outputIds': [], 'stepIds': [],
             'source': projection['provenance'], 'observedAt': projection['observedAt'],
             'rowScopeVerified': False,
             'reason': 'Authorized page availability is verified; row membership remains decided by each actual request.'}
            for attribute in projection['requested'] if attribute in {'scope', 'pages'}]


def profile_expansion(expansion, original_task, profile_task):
    """Project the already reviewed whole request onto its remaining subtask.

    Only identical requirements retain their reviewed bilingual terms. IDs are
    rebound by exact requirement content, because removed attributes shift IDs.
    """
    from .reader_requirements import requirements_for
    from .reader_expansion import validate_expansion
    from .generic_reader import PipelineError
    original = requirements_for(original_task)
    terms = {term.requirementId: term for term in expansion.terms}
    available = list(original)
    retained = []
    for requirement in requirements_for(profile_task):
        meaning = {k: v for k, v in requirement.items() if k != 'id'}
        match = next((item for item in available if
            {k: v for k, v in item.items() if k != 'id'} == meaning), None)
        if not match or match['id'] not in terms:
            raise PipelineError('session_subtask_requirement_changed', 'planning')
        available.remove(match)
        retained.append(terms[match['id']].model_copy(update={'requirementId': requirement['id']}))
    result = expansion.model_copy(update={'terms': retained})
    validate_expansion(result, profile_task, '')
    return result


def analysis_task_assignment(task, partition, projection, permission, canonical_question):
    """Expose the verified division of a reviewed request to a planning stage.

    This is stage responsibility metadata, not an acceptance override. It
    neither changes an AnalysisPlan nor removes its missing evidence. The
    original requirements and their distinct sources remain inspectable.
    """
    from .generic_reader_contracts import TaskSpec
    from .reader_requirements import requirements_for
    if (not isinstance(partition, dict) or not isinstance(projection, dict)
            or not isinstance(partition.get('reviewedOriginalTask'), dict)):
        return None
    if (projection.get('schemaVersion') != 'authenticated-session-summary/1'
            or projection.get('mode') != 'supplement'
            or projection.get('provenance') != 'refreshed_authenticated_session'
            or not permission.get('fingerprint') or not permission.get('observedAt')
            or projection.get('observedAt') != permission['observedAt']
            or projection.get('unavailableAttributes')
            or projection.get('rowScopeVerified') is not False
            or projection.get('recordValuesRead') is not False
            or projection.get('actionAuthorityInferred') is not False):
        return None
    receipt = {key: permission[key] for key in ('fingerprint', 'observedAt')}
    if partition.get('permissionReceipt') != receipt:
        return None
    original = TaskSpec.model_validate(partition['reviewedOriginalTask'])
    requested = session_request(original, canonical_question)
    resolved = projection.get('requested', [])
    if (not requested or not resolved or set(resolved) - {'scope', 'pages'}
            or not set(resolved).issubset(requested)
            or resolved != partition.get('sessionRequirements')):
        return None
    assigned = requirements_for(task)
    expected = requirements_for(profile_subtask(original, resolved))
    if assigned != expected or assigned != partition.get('remainingRequirements'):
        return None
    original_requirements = requirements_for(original)
    retained = list(assigned)
    delegated = []
    checks = {check['id']: check for check in session_coverage(projection)}
    for requirement in original_requirements:
        meaning = {k: v for k, v in requirement.items() if k != 'id'}
        matching = next((item for item in retained
                         if {k: v for k, v in item.items() if k != 'id'} == meaning), None)
        if matching:
            retained.remove(matching)
            continue
        # Only an attribute removed by this proven profile partition can be
        # delegated. Personal scope/object/grain still belong to live analysis.
        one_attribute = original.model_copy(update={'requestedAttributes': [requirement['value']]})
        attributes = session_request(one_attribute, canonical_question)
        if (requirement['kind'] != 'attribute' or not attributes or len(attributes) != 1
                or attributes[0] not in resolved):
            return None
        check = checks.get('session_' + attributes[0])
        if not check or check['status'] != 'satisfied':
            return None
        delegated.append({'originalRequirement': requirement, 'coverage': check,
                          'sourceReceipt': {'kind': 'authenticated_permission_context',
                                            'fingerprint': permission['fingerprint'],
                                            'observedAt': permission['observedAt']}})
    if retained or not delegated:
        return None
    return {'schemaVersion': 'verified-task-assignment/1', 'assignedStage': 'AnalysisPlan',
            'originalRequirements': original_requirements,
            'assignedRequirements': assigned, 'delegatedRequirements': delegated,
            'completionPolicy': 'combine_independently_verified_sources',
            'rowScopeVerifiedByDelegation': False}
