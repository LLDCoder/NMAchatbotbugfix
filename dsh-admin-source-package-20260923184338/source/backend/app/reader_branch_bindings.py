"""Split explicit multi-source context proposals by their actual read lineage."""


def split_branch_bindings(plan, requirements, catalog, sources):
    from .generic_reader import PipelineError
    from .reader_requirements import _semantic_match

    # Independent aggregate branches only. Record properties and domain lookups
    # have their own typed provenance compiler and must not be relabelled here.
    if (sum(r['kind'] == 'measure' for r in requirements.values()) < 2
            or any(r['kind'] in {'record', 'attribute', 'detail'} for r in requirements.values())):
        return []

    steps = {s.id: s for s in plan.steps}

    def roots(step_id):
        found, pending, reads = set(), [step_id], set()
        while pending:
            sid = pending.pop()
            if sid in found or sid not in steps:
                continue
            found.add(sid)
            step = steps[sid]
            if step.op == 'read_rows':
                reads.add((step.sourceId, step.path))
            pending.extend(step.inputs)
        return reads

    changes, result = [], []
    for binding in plan.requirementBindings:
        requirement = requirements.get(binding.requirementId, {})
        if requirement.get('kind') not in {'object', 'grain', 'scope', 'population', 'filter', 'time', 'group'}:
            result.append(binding)
            continue
        groups, unresolved = {}, []
        for step_id in binding.stepIds:
            read = roots(step_id)
            if len(read) != 1:
                unresolved.append(step_id)
                continue
            groups.setdefault(next(iter(read)), []).append(step_id)
        original = (binding.sourceId, binding.sourcePath)
        if len(groups) <= 1 or set(groups) <= {original}:
            result.append(binding)
            continue
        fact = catalog.get(binding.knowledgeBindingId, {})
        principal = sources.get(binding.sourceId, {}).get('principalScopeRef')
        valid = bool(principal and original in groups and not unresolved and fact)
        for source_id, path in groups:
            candidate = binding.model_copy(update={'sourceId': source_id, 'sourcePath': path})
            source = sources.get(source_id, {})
            valid = valid and (source.get('principalScopeRef') == principal
                and source.get('ready', True) and source_id in fact.get('contextVerifiedSourceIds', [])
                and path == fact.get('sourcePath')
                and _semantic_match(candidate, requirement, source, catalog))
        if not valid:
            raise PipelineError('analysis_binding_cross_source_steps', 'planning', details={
                'requirementId': binding.requirementId, 'sourceId': binding.sourceId,
                'stepSources': [{'sourceId': sid, 'sourcePath': path, 'stepIds': ids}
                    for (sid, path), ids in groups.items()],
                'correction': 'Bind each context requirement to its own observed source/path and '
                    'applicable page definition. A step on another response cannot inherit this '
                    'source context. Preserve all requested branches; leave unsupported meanings unconfirmed.'})
        for (source_id, path), ids in groups.items():
            result.append(binding.model_copy(deep=True, update={
                'sourceId': source_id, 'sourcePath': path, 'stepIds': ids}))
        changes.append({'reason': 'explicit_context_steps_bound_to_actual_sources',
            'requirementId': binding.requirementId, 'knowledgeBindingId': binding.knowledgeBindingId,
            'sourceIds': [sid for sid, _ in groups]})
    # Do not merge independent proposals or choose between conflicting facts.
    # The existing duplicate and per-output evidence checks still run.
    plan.requirementBindings = result
    return changes
