"""Observe a singleton panel and its field scopes; never waive requested scope.

This optional compiler consumes an already executed analysis and engine-owned
route/principal context. It neither authorizes a read nor mutates a plan, a
missing list, requirements, outputs, or the existing output-withholding guard.
"""
from copy import deepcopy

from .reader_collection import projection_hash
from .reader_dashboard_context import current_output_display_context
from .reader_requirements import semantic_bindings, _context_match, requirements_for
from .reader_snapshots import singleton_grain
from .reader_routing import task_fingerprint


def compile_snapshot_scope(task, plan, sources, knowledge, analysis, *,
                           page_context, principal_scope_ref, authorized_pages):
    """Return observation proof separately from personnel scope proof.

    The caller supplies authorized_pages from verified route authorization and
    principal_scope_ref from the active runtime, never from a generated plan.
    This compiler independently accepts only subject-bound personal scope facts.
    A current-user parameter does not establish team membership or a global
    population; other context-matched facts remain unverified candidates.
    """
    from .generic_reader import pointer, row_scalar, PipelineError

    result = {'version': 'snapshot-scope/1', 'observationStatus': 'unverified',
              'requestedScope': task.requestedScope, 'taskFingerprint': task_fingerprint(task),
              'outputs': [], 'gaps': [],
              'satisfiesRequestedScope': False}
    outputs = analysis.get('outputs', [])
    if (not principal_scope_ref or not outputs or not page_context
            or page_context.get('route') not in authorized_pages
            or current_output_display_context(page_context, outputs) is None):
        result['gaps'].append('snapshot_authority_context_unverified')
        return result
    required = requirements_for(task)
    coverage = analysis.get('requirementCoverage', [])
    checked = {c['id']: c for c in coverage}
    if any(r['id'] not in checked or checked[r['id']].get('status') != 'satisfied' for r in required):
        result['gaps'].append('snapshot_requested_requirements_unverified')
        return result
    records = {item['record']['id']: item['record'] for item in knowledge.items.values()
               if isinstance(item.get('record'), dict) and item['record'].get('id')}
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(knowledge)
             if page_context['route'] in records[f['recordId']].get('applicability', {}).get('pageRefs', [])}
    steps = {s.id: s for s in plan.steps}
    observations = set()

    def has_coverage(binding, output_id):
        c = checked.get(binding.requirementId, {})
        return c.get('status') == 'satisfied' and output_id in c.get('outputIds', [])

    for output in outputs:
        oid = output.get('id')
        row = output.get('value')
        refs = output.get('evidence', [])
        if (oid not in steps or not isinstance(row, list) or len(row) != 1
                or not isinstance(row[0], dict) or not row[0] or len(refs) != 1):
            result['gaps'].append('snapshot_output_shape_unverified')
            continue
        node = steps[oid]
        # Only transparent projections preserve this singleton field lineage.
        seen = set()
        while node.op == 'project' and len(node.inputs) == 1 and node.limit is None:
            if node.id in seen or node.inputs[0] not in steps:
                break
            seen.add(node.id)
            node = steps[node.inputs[0]]
        ref = refs[0]
        source = sources.get(ref.get('sourceId'), {})
        if (node.op != 'read_rows' or node.inputs or node.sourceId != ref.get('sourceId')
                or node.path != ref.get('fieldBinding') or ref.get('observationShape') != 'object'
                or source.get('kind') != 'api_response' or source.get('ready') is False
                or source.get('collectionFailure') or source.get('page') not in authorized_pages
                or source.get('principalScopeRef') != principal_scope_ref
                or source.get('taskFingerprint') != task_fingerprint(task)
                or not source.get('observationRef')
                or any(source.get(k) != ref.get(k) for k in
                       ('page', 'capturedAt', 'observationRef', 'principalScopeRef', 'operationRef'))):
            result['gaps'].append('snapshot_source_lineage_unverified')
            continue
        anchors = []
        for binding in plan.requirementBindings:
            fact = facts.get(binding.knowledgeBindingId, {})
            if (binding.sourceId != ref['sourceId'] or binding.sourcePath != node.path
                    or fact.get('sourcePath') != node.path or fact.get('operationRef') != source.get('operationRef')
                    or set(binding.fields) != set(fact.get('fields', []))
                    or not set(binding.stepIds) & {node.id, oid} or not has_coverage(binding, oid)
                    or ('contextParameters' in fact and not _context_match(fact, source))):
                continue
            anchors.append(fact)
        if (not any(f['kind'] == 'object' for f in anchors)
                or not any(f['kind'] == 'grain' and singleton_grain(task, f, source, [node], output)
                           for f in anchors)
                or not set(row[0]) <= {field for f in anchors if f['kind'] == 'attribute' for field in f['fields']}
                or not set(row[0]) <= set(node.fields)):
            result['gaps'].append('snapshot_semantics_unverified')
            continue
        try:
            native = pointer(source['data'], node.path)
            if any(projection_hash(value) != projection_hash(row_scalar(native, field))
                   or ref.get('fieldStatus', {}).get(field) != 'complete' for field, value in row[0].items()):
                raise ValueError('output does not match its original scalar')
        except (PipelineError, KeyError, TypeError, ValueError):
            result['gaps'].append('snapshot_output_value_unverified')
            continue
        observations.add((source['observationRef'], source['capturedAt'], source['principalScopeRef']))
        fields = []
        for field, value in row[0].items():
            candidates = [f for f in facts.values() if f['kind'] == 'scope'
                          and f['operationRef'] == source['operationRef'] and f['sourcePath'] == node.path
                          and field in f['fields'] and not f.get('conditions') and _context_match(f, source)]
            # Personal ownership is independent only when the typed definition
            # binds its subject to this active principal. That subject binding
            # alone cannot establish team membership or a global population.
            # No role name, default scope, neighbouring field or UI role can
            # supply either missing population proof.
            proven = [f for f in candidates if f.get('contextBindings')
                      and all(v == 'principal.user_id' for v in f['contextBindings'].values())
                      and f['concept'] == 'personal']
            meanings = {f['concept'] for f in proven}
            candidate_meanings = {f['concept'] for f in candidates}
            conflict = len(candidate_meanings) > 1
            status = 'conflicting' if conflict else 'verified' if len(meanings) == 1 else 'unknown'
            fields.append({'field': field, 'fieldPointer': node.path + '/' + '/'.join(field.split('.')),
                'valueHash': projection_hash(value), 'scopeStatus': status,
                'scope': next(iter(meanings)) if status == 'verified' else 'unknown',
                'scopeDefinition': 'server-role-defined' if candidate_meanings == {'server_role_defined'} else '',
                'scopeBindingIds': sorted(f['knowledgeBindingId'] for f in proven),
                'candidateBindingIds': sorted(f['knowledgeBindingId'] for f in candidates),
                'scopeDefinitions': [{'bindingId': f['knowledgeBindingId'], 'recordId': f['recordId'],
                    'revision': records[f['recordId']].get('revision')} for f in candidates],
                'reason': '' if status == 'verified' else 'conflicting_scope_definitions' if conflict
                          else 'independent_personnel_scope_unverified'})
        result['outputs'].append({'outputId': oid, 'sourceId': ref['sourceId'], 'sourcePath': node.path,
            **{k: source[k] for k in ('page', 'operationRef', 'capturedAt', 'observationRef', 'principalScopeRef')},
            'contextRef': source.get('collectionContext', {}).get('contextRef'),
            'observationBindingIds': sorted(f['knowledgeBindingId'] for f in anchors), 'fields': fields})
    if len(observations) != 1 or len(result['outputs']) != len(outputs):
        result['gaps'].append('snapshot_complete_same_observation_unverified')
    result['gaps'] = list(dict.fromkeys(result['gaps']))
    if not result['gaps']:
        result['observationStatus'] = 'verified'
    # This result is informative only. Existing scope coverage and withholding
    # still execute; unknown never supplies a personal/team requirement.
    all_fields = [f for o in result['outputs'] for f in o['fields']]
    result['satisfiesRequestedScope'] = (result['observationStatus'] == 'verified'
        and task.requestedScope in {'personal', 'team', 'global'}
        and bool(all_fields) and all(f['scopeStatus'] == 'verified' and f['scope'] == task.requestedScope
                                    for f in all_fields))
    return result


def snapshot_scope_correction(plan, proof):
    """Feedback only; the caller decides whether to ask for a repaired plan."""
    if proof.get('observationStatus') != 'verified':
        return None
    fields = [(o['outputId'], f) for o in proof['outputs'] for f in o['fields']]
    unproved = [{'outputId': oid, 'field': f['field'], 'scopeStatus': f['scopeStatus'], 'scope': f['scope']}
                for oid, f in fields if f['scopeStatus'] != 'verified' or f['scope'] != plan.context.scope]
    if plan.context.scope != 'unknown' and unproved:
        return {'code': 'analysis_snapshot_global_scope_unverified', 'unprovedFields': unproved,
            'correction': 'A global scope claim does not cover every observed field. Preserve all user scope requirements. '
                          'Use the individually proved field scope or state that its personnel scope is unknown. '
                          'Do not remove any missing item or claim success from this feedback alone.'}
    if plan.context.scope == 'unknown' and plan.missing and proof['requestedScope'] == 'unknown':
        return {'code': 'analysis_snapshot_observation_verified',
            'unknownFields': [{'outputId': oid, 'field': f['field']} for oid, f in fields if f['scopeStatus'] != 'verified'],
            'correction': 'The current authorized singleton values have complete observation evidence. '
                          'Personnel scope may remain unknown because the user did not request a single scope. '
                          'Review which gaps belong to the original request; retain all genuine gaps. '
                          'This feedback neither deletes missing items nor confirms personnel scope.'}
    return None


def validate_snapshot_analysis(task, plan, sources, knowledge, analysis, *, page_context,
                               principal_scope_ref, authorized_pages, observed_scopes):
    """Select a descriptive guard; requested-scope coverage remains independent."""
    from .generic_reader import PipelineError
    from .reader_bindings import validate_observed_scope
    proof = compile_snapshot_scope(task, plan, sources, knowledge, analysis,
        page_context=page_context, principal_scope_ref=principal_scope_ref,
        authorized_pages=authorized_pages)
    if proof['observationStatus'] != 'verified':
        validate_observed_scope(plan, task, observed_scopes)
        return
    correction = snapshot_scope_correction(plan, proof)
    if correction and correction['code'] == 'analysis_snapshot_global_scope_unverified':
        raise PipelineError(correction['code'], 'planning', details=correction)
    analysis['snapshotScopeProof'] = proof
    if correction:
        # Informative only: never remove gaps or force a plan-repair iteration.
        analysis['snapshotScopeAdvisory'] = correction


def project_snapshot_scope(proof, outputs):
    """Retain proof only for exact surviving fields/values and original sources."""
    if not isinstance(proof, dict) or proof.get('observationStatus') != 'verified' or not outputs:
        return None
    indexed = {item['outputId']: item for item in proof.get('outputs', [])}
    projected = []
    for output in outputs:
        prior = indexed.get(output.get('id'))
        rows = output.get('value'); refs = output.get('evidence', [])
        if (not prior or not isinstance(rows, list) or len(rows) != 1
                or not isinstance(rows[0], dict) or not rows[0] or len(refs) != 1):
            return None
        ref = refs[0]
        if (ref.get('observationShape') != 'object' or ref.get('fieldBinding') != prior['sourcePath']
                or any(ref.get(k) != prior.get(k) for k in ('sourceId', 'page', 'operationRef',
                    'capturedAt', 'observationRef', 'principalScopeRef'))):
            return None
        fields = {f['field']: f for f in prior['fields']}
        if any(field not in fields or fields[field]['valueHash'] != projection_hash(value)
               or ref.get('fieldStatus', {}).get(field) != 'complete'
               for field, value in rows[0].items()):
            return None
        projected.append({**deepcopy(prior), 'fields': [deepcopy(fields[field]) for field in rows[0]]})
    result = {**deepcopy(proof), 'outputs': projected}
    result['satisfiesRequestedScope'] = (proof['requestedScope'] in {'personal', 'team', 'global'}
        and all(f['scopeStatus'] == 'verified' and f['scope'] == proof['requestedScope']
                for output in projected for f in output['fields']))
    return result


def render_snapshot_personnel_scope(output, proof, language, *, visible_fields=None):
    """Explain each surviving field's personnel scope, without changing values."""
    projected = project_snapshot_scope(proof, [output])
    if projected is None:
        return ''
    fields = [f for f in projected['outputs'][0]['fields']
              if visible_fields is None or f['field'] in visible_fields]
    return render_snapshot_scope_fields(fields, output.get('fieldLabels') or {}, language) if fields else ''


def render_snapshot_scope_fields(fields, labels, language):
    from .generic_reader import safe_text
    names = {'personal': ('personal', 'شخصي', '个人'), 'unknown': ('unknown', 'غير معروف', '未知')}
    index = 1 if language == 'ar' else 2 if language == 'zh' else 0
    items = []
    for field in fields:
        scope = field['scope'] if field['scopeStatus'] == 'verified' else 'unknown'
        value = names.get(scope, names['unknown'])[index]
        if field.get('scopeDefinition') == 'server-role-defined':
            value += (' (server role defined; personnel coverage unverified)',
                      ' (يحدده دور الخادم؛ لم يتم التحقق من الأشخاص المشمولين)',
                      '（由服务端角色决定，人员范围未证实）')[index]
        items.append(safe_text(labels.get(field['field'], field['field'])) + ': ' + value)
    return ('Personnel scope by field: ', 'نطاق الأشخاص لكل حقل: ', '逐字段人员范围：')[index] + '; '.join(items) + '.'
