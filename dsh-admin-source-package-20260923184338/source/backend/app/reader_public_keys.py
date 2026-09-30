"""Keep page-declared entity keys in evidence and public references in answers."""


def project_public_keys(plan, task, catalog, sources):
    from .generic_reader_contracts import Step
    from .reader_requirements import _semantic_match, requirements_for
    from .generic_reader import PipelineError
    if task.outputShape not in {'detail', 'list'} or task.requestedMeasures or task.groupBy:
        return []
    requirements = {r['id']: r for r in requirements_for(task)}
    steps = {s.id: s for s in plan.steps}
    changes = []
    for output in list(plan.steps):
        if not output.expose or output.role != 'detail' or output.op not in {'read_rows', 'project'}:
            continue
        ancestors, pending = set(), [output.id]
        while pending:
            sid = pending.pop()
            if sid in ancestors or sid not in steps:
                continue
            ancestors.add(sid); pending.extend(steps[sid].inputs)
        reads = [steps[sid] for sid in ancestors if steps[sid].op == 'read_rows']
        if len(reads) != 1:
            continue
        read = reads[0]; source = sources.get(read.sourceId, {})
        matches = []
        for binding in plan.requirementBindings:
            fact = catalog.get(binding.knowledgeBindingId, {})
            if (requirements.get(binding.requirementId, {}).get('kind') != 'object'
                    or binding.sourceId != read.sourceId or binding.sourcePath != read.path
                    or not fact.get('displayFields') or not set(binding.stepIds) & ancestors
                    or not _semantic_match(binding, requirements[binding.requirementId], source, catalog)):
                continue
            matches.append(fact)
        if len({(tuple(sorted(f['fields'])), tuple(sorted(f['displayFields']))) for f in matches}) != 1:
            continue
        fact = matches[0]
        explicitly_requested = {f for b in plan.requirementBindings
            if requirements.get(b.requirementId, {}).get('kind') == 'attribute'
            and b.sourceId == read.sourceId and b.sourcePath == read.path and set(b.stepIds) & ancestors
            and _semantic_match(b, requirements[b.requirementId], source, catalog)
            for f in b.fields}
        hidden = set(fact['fields']) - set(fact['displayFields']) - explicitly_requested
        hidden &= set(output.fields)
        if not hidden:
            continue
        if not set(fact['displayFields']) <= set(output.fields):
            raise PipelineError('analysis_public_reference_required', 'planning', details={
                'stepId': output.id, 'publicFields': fact['displayFields'],
                'correction': 'Use the page-defined public reference in this entity output. '
                    'Keep internal identity keys in hidden read lineage; never expose them as a substitute.'})
        visible = [f for f in output.fields if f not in hidden]
        labels = {k: v for k, v in output.fieldLabels.items() if k in visible}
        if output.op == 'project':
            output.fields, output.fieldLabels = visible, labels
        else:
            sid = 'public_' + output.id
            while sid in steps: sid += '_n'
            output.expose = False
            projected = Step(id=sid, op='project', inputs=[output.id], fields=visible,
                fieldLabels=labels, role='detail', label=output.label, expose=True, evidence=list(output.evidence))
            steps[sid] = projected; plan.steps.append(projected)
        changes.append({'reason': 'page_public_reference_projection', 'stepId': output.id,
            'hiddenIdentityFields': sorted(hidden), 'publicFields': fact['displayFields']})
    return changes
