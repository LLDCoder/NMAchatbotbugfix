"""Compile structural plans without altering requested or semantic evidence."""


def prune_disconnected_steps(plan):
    # Form adapters own typed hidden input dependencies and their exact cleanup.
    # Do not substitute ordinary step reachability for that operator's proof.
    if any(step.op == 'assess_form' for step in plan.steps):
        return []
    steps = {step.id: step for step in plan.steps}
    required = {step.id for step in plan.steps if step.expose}
    required.update(sid for binding in plan.requirementBindings for sid in binding.stepIds)
    required.update(item.stepId for item in plan.metricCoverage if item.disposition == 'included')
    pending = list(required)
    while pending:
        step = steps.get(pending.pop())
        if step is None:
            continue
        for sid in step.inputs:
            if sid not in required:
                required.add(sid); pending.append(sid)
    removed = [step.id for step in plan.steps if step.id not in required and not step.expose]
    plan.steps = [step for step in plan.steps if step.id not in removed]
    return [{'reason': 'unreferenced_hidden_computation', 'removedStepIds': removed}] if removed else []


def separate_public_fields(binding, fact, requirement):
    """Public display columns do not become additional entity identity keys."""
    if (requirement.get('kind') != 'object' or fact.get('kind') != 'object'
            or not fact.get('fields') or not fact.get('displayFields')):
        return None
    required, provided = set(fact['fields']), set(binding.fields)
    extra = provided - required
    if required <= provided and extra and extra <= set(fact['displayFields']):
        binding.fields = list(fact['fields'])
        return {'reason': 'public_columns_separated_from_identity_proof',
            'requirementId': binding.requirementId, 'publicFields': sorted(extra)}
    return None


def assemble_snapshot_binding(binding, plan, task, catalog, requirements, sources):
    """Compile redundant fields only for a uniquely defined, already read snapshot.

    No source, read, value, projection, identity or requested meaning is changed.
    Conflicting paths and undefined/unobserved fields keep the original rejection.
    """
    from types import SimpleNamespace
    from .reader_requirements import _semantic_match
    from .reader_bindings import verified_scalar_keys

    requirement = requirements.get(binding.requirementId, {})
    fact = catalog.get(binding.knowledgeBindingId, {})
    source = sources.get(binding.sourceId, {})
    required, provided = set(fact.get('fields', [])), set(binding.fields)
    if (requirement.get('kind') not in {'object', 'grain'} or not required or not provided
            or required == provided or task.recordIdentity or task.requestedMeasures or task.groupBy
            or task.outputShape not in {'overview', 'detail'} or not source.get('principalScopeRef')
            or source.get('ready') is False or source.get('truncated')
            or binding.sourcePath != fact.get('sourcePath')):
        return None

    def matches(candidate, req):
        return (binding.sourceId in candidate.get('contextVerifiedSourceIds', [])
            and candidate.get('sourcePath') == binding.sourcePath
            and _semantic_match(SimpleNamespace(knowledgeBindingId=candidate['knowledgeBindingId'],
                sourcePath=candidate['sourcePath'], fields=candidate['fields']), req, source, catalog))

    choices = [f for f in catalog.values() if matches(f, requirement)]
    if len(choices) != 1 or choices[0]['knowledgeBindingId'] != binding.knowledgeBindingId:
        return None
    grain_requirement = requirements.get('grain')
    grains = [f for f in catalog.values() if grain_requirement and matches(f, grain_requirement)]
    if (len(grains) != 1 or grains[0].get('observationShape') != 'singleton_object'
            or grains[0].get('recordId') != fact.get('recordId')):
        return None
    declared = {field for f in catalog.values()
        if f.get('recordId') == fact.get('recordId') and f.get('sourcePath') == binding.sourcePath
        and binding.sourceId in f.get('contextVerifiedSourceIds', []) for field in f.get('fields', [])}
    if not provided <= declared:
        return None
    steps = {step.id: step for step in plan.steps}
    ancestors, pending = set(), list(binding.stepIds)
    while pending:
        sid = pending.pop()
        if sid in ancestors:
            continue
        if sid not in steps:
            return None
        ancestors.add(sid)
        pending.extend(steps[sid].inputs)
    reads = [steps[sid] for sid in ancestors if steps[sid].op == 'read_rows']
    if (not reads or any(read.sourceId != binding.sourceId or read.path != binding.sourcePath
            or not (required | provided) <= set(read.fields) for read in reads)
            or not verified_scalar_keys(source, binding.sourcePath, sorted(required | provided))):
        return None
    before = list(binding.fields)
    binding.fields = list(fact['fields'])
    return {'reason': 'unique_observed_snapshot_binding_fields_assembled',
        'requirementId': binding.requirementId, 'knowledgeBindingId': binding.knowledgeBindingId,
        'sourceId': binding.sourceId, 'sourcePath': binding.sourcePath,
        'previousFields': before, 'definitionFields': list(binding.fields),
        'unchangedReadStepIds': sorted(read.id for read in reads)}
