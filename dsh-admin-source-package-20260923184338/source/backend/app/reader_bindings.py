"""Compile page facts into applicable choices and program-owned citations."""
from .generic_reader_contracts import ExtractCitation
from .reader_requirements import semantic_bindings, requirements_for, _semantic_match, _context_match, builtin_measure



def verified_scalar_keys(source, path, fields):
    from .generic_reader import pointer, PipelineError, row_scalar
    from .reader_collection import projection_hash
    try:
        row = pointer(source['data'], path)
        return bool(fields) and all(
            source.get('fieldEvidence', {}).get(path + '/' + '/'.join(f.split('.')), {}).get('status') == 'complete'
            and source['fieldEvidence'][path + '/' + '/'.join(f.split('.'))].get('valueHash') == projection_hash(row_scalar(row, f))
            and row_scalar(row, f) is not None for f in fields)
    except (PipelineError, KeyError, TypeError):
        return False


def applicable_bindings(knowledge, sources):
    from .generic_reader import pointer, PipelineError
    result = []
    for fact in semantic_bindings(knowledge):
        matching = []
        for sid, source in sources.items():
            if source.get('operationRef') != fact['operationRef']:
                continue
            try:
                data = pointer(source['data'], fact['sourcePath'])
            except PipelineError:
                continue
            if isinstance(data, (dict, list)):
                matching.append(sid)
        if matching:
            result.append({**fact, 'applicableSourceIds': matching,
                'contextVerifiedSourceIds': [sid for sid in matching if
                    'contextParameters' not in fact or _context_match(fact, sources[sid])]})
    return result


def complete_grouped_count(plan, task, language):
    """The requested count and breakdown share one verified computation input.

    Add an arithmetic step, never an inferred value or a different population.
    All source, grain, condition and output checks still run on the new step.
    """
    from .generic_reader_contracts import Step
    measures = [r for r in requirements_for(task) if r['kind'] == 'measure']
    if (task.outputShape != 'count' or not task.groupBy or len(measures) != 1
            or builtin_measure(task, measures[0]['value']) != 'count'):
        return
    binding = next((b for b in plan.requirementBindings if b.requirementId == measures[0]['id']), None)
    if not binding:
        return
    groups = [s for s in plan.steps if s.op == 'group_count' and s.expose
              and s.role == 'breakdown' and len(s.inputs) == 1 and s.id in binding.stepIds]
    if len(groups) != 1:
        return
    group = groups[0]
    if any(s.op == 'count' and s.expose and s.role == 'total' and s.inputs == group.inputs for s in plan.steps):
        return
    ids = {s.id for s in plan.steps}; sid = 'compiled_total'
    while sid in ids:
        sid += '_n'
    plan.steps.append(Step(id=sid, op='count', inputs=list(group.inputs), role='total', expose=True,
        label='العدد الإجمالي' if language == 'ar' else 'Total count', evidence=list(group.evidence)))
    binding.stepIds.append(sid)


def project_requested_details(plan, task):
    """Keep verification keys in lineage, expose requested bound properties only."""
    from .generic_reader_contracts import Step
    if task.outputShape != 'detail' or not task.requestedAttributes:
        return
    requested = {r['id'] for r in requirements_for(task) if r['kind'] == 'attribute'}
    steps = {s.id: s for s in plan.steps}
    for step in list(plan.steps):
        if not step.expose or step.role != 'detail' or step.op not in {'read_rows', 'project'}:
            continue
        ancestors, pending = set(), [step.id]
        while pending:
            sid = pending.pop()
            if sid in ancestors or sid not in steps: continue
            ancestors.add(sid); pending.extend(steps[sid].inputs)
        fields = {f for b in plan.requirementBindings if b.requirementId in requested
                  and b.knowledgeBindingId and set(b.stepIds) & ancestors for f in b.fields}
        if not fields or not fields <= set(step.fields) or fields == set(step.fields):
            continue
        visible = [f for f in step.fields if f in fields]
        labels = {k: v for k, v in step.fieldLabels.items() if k in fields}
        if step.op == 'project':
            step.fields, step.fieldLabels = visible, labels
            continue
        sid = 'visible_' + step.id
        while sid in steps: sid += '_n'
        step.expose = False
        output = Step(id=sid, op='project', inputs=[step.id], fields=visible, fieldLabels=labels,
                      role='detail', label=step.label, expose=True, evidence=list(step.evidence))
        plan.steps.append(output); steps[sid] = output


def validate_list_display(plan, task, catalog, sources):
    """Entity lists retain page-defined public row labels, never internal keys."""
    if task.outputShape != 'list' or not task.requestedAttributes or task.requestedMeasures or task.groupBy:
        return
    from .generic_reader import PipelineError
    requirements={r['id']:r for r in requirements_for(task)}
    steps={s.id:s for s in plan.steps}
    for binding in plan.requirementBindings:
        req=requirements.get(binding.requirementId,{})
        fact=catalog.get(binding.knowledgeBindingId,{})
        fields=fact.get('displayFields',[])
        source=sources.get(binding.sourceId,{})
        if (req.get('kind')!='object' or not fields or binding.sourceId not in fact.get('applicableSourceIds',[])
                or not _semantic_match(binding,req,source,catalog)):
            continue
        for output in plan.steps:
            if not output.expose or output.role!='detail' or output.op not in {'read_rows','project'}:continue
            ancestors,pending=set(),[output.id]
            while pending:
                sid=pending.pop()
                if sid in ancestors or sid not in steps:continue
                ancestors.add(sid);pending.extend(steps[sid].inputs)
            if not ancestors.intersection(binding.stepIds):continue
            reads=[steps[sid] for sid in ancestors if steps[sid].op=='read_rows']
            if not reads or any(s.sourceId!=binding.sourceId or s.path!=binding.sourcePath for s in reads):continue
            if set(fields)<=set(output.fields) and all(set(fields)<=set(s.fields) for s in reads):continue
            raise PipelineError('analysis_list_display_missing','planning',details={
                'stepId':output.id,'sourceId':binding.sourceId,'sourcePath':binding.sourcePath,
                'knowledgeBindingId':binding.knowledgeBindingId,'publicDisplayFields':fields,
                'correction':'This is a list of business entities, not an anonymous list of values. '
                    'Read the documented public display fields and preserve them through projections into '
                    'this output alongside the requested properties. Label the columns in responseLanguage. '
                    'Never substitute internal entity keys. Retain all original filters and ordering; '
                    'if the fields are unavailable, report that actual source or knowledge gap.'})


def complete_record_contexts(plan, task, catalog, sources, outputs):
    """Compile missing, uniquely documented contexts for same-record reads.

    Never invent a business mapping or reuse another source's context. Final
    identity, scope, field completeness and per-output checks still execute.
    """
    from .generic_reader_contracts import RequirementBinding
    from .reader_subject import parent_property_context
    if task.outputShape not in {'detail', 'list'} or not task.recordIdentity or task.requestedMeasures or task.groupBy:
        return
    eligible={sid:source for sid,source in sources.items()
              if (source.get('verifiedRecord') or {}).get('identity')==task.recordIdentity}
    principals={s.get('principalScopeRef') for s in eligible.values()}
    if not eligible or len(principals)!=1 or not next(iter(principals)):
        return
    steps={s.id:s for s in plan.steps}
    for requirement in requirements_for(task):
        if requirement['kind'] not in {'object','grain','scope','population'}:continue
        for sid,source in eligible.items():
            roots=[s for s in plan.steps if s.op=='read_rows' and s.sourceId==sid
                   and any(s.id in ancestors for ancestors in outputs.values())]
            for path in dict.fromkeys(s.path for s in roots):
                reads=[s for s in roots if s.path==path]
                matches=[]
                for bid,fact in catalog.items():
                    candidate=RequirementBinding(requirementId=requirement['id'],sourceId=sid,
                        sourcePath=fact['sourcePath'],fields=list(fact['fields']),knowledgeBindingId=bid,
                        stepIds=[s.id for s in reads])
                    if sid not in fact['applicableSourceIds'] or not _semantic_match(candidate,requirement,source,catalog):continue
                    if fact['sourcePath']!=path and not all(any(read.id in ancestors and parent_property_context(
                        task,fact['kind'],fact['sourcePath'],fact['fields'],source,read,
                        {'role':steps[oid].role,'value':[]}) for oid,ancestors in outputs.items()) for read in reads):continue
                    matches.append(candidate)
                if len(matches)!=1:continue
                candidate=matches[0]
                # Existing mappings remain subject to validation, never replaced.
                if any(b.requirementId==requirement['id'] and b.sourceId==sid
                       and (b.sourcePath or catalog.get(b.knowledgeBindingId,{}).get('sourcePath'))==candidate.sourcePath
                       for b in plan.requirementBindings):continue
                plan.requirementBindings.append(candidate)



def expose_requested_projections(plan, task, catalog, sources):
    """Expose a unique, already planned leaf for a requested typed property.

    This only changes visibility of a bounded public-field projection. Exact
    source, predicates, field receipts and per-output coverage are still checked
    by the normal evaluator. Hidden raw reads and unrequested fields stay hidden.
    """
    from types import SimpleNamespace
    from .reader_scalars import scalar_equal
    if task.outputShape != 'detail' or task.requestedMeasures or task.groupBy:
        return []
    requirements = {r['id']: r for r in requirements_for(task)}
    steps = {s.id: s for s in plan.steps}
    consumed = {i for s in plan.steps for i in s.inputs}
    promoted = []
    for binding in plan.requirementBindings:
        requirement = requirements.get(binding.requirementId, {})
        fact = catalog.get(binding.knowledgeBindingId, {})
        if requirement.get('kind') != 'attribute' or fact.get('kind') != 'attribute':
            continue
        source = sources.get(binding.sourceId, {})
        candidate = SimpleNamespace(knowledgeBindingId=binding.knowledgeBindingId,
            sourcePath=fact['sourcePath'], fields=fact['fields'])
        if not _semantic_match(candidate, requirement, source, catalog):
            continue
        conditions = fact.get('conditions', [])
        values = set(fact['fields']) - {c['field'] for c in conditions}
        candidates = []
        for step in plan.steps:
            if (step.expose or step.id in consumed or step.id not in binding.stepIds
                    or step.op != 'project' or step.role != 'detail' or not step.fields
                    or not set(step.fields) <= values):
                continue
            ancestors, pending = set(), list(step.inputs)
            while pending:
                sid = pending.pop()
                if sid in ancestors or sid not in steps:continue
                ancestors.add(sid); pending.extend(steps[sid].inputs)
            reads = [steps[sid] for sid in ancestors if steps[sid].op == 'read_rows']
            if not reads or any(s.sourceId != binding.sourceId or s.path != fact['sourcePath'] for s in reads):
                continue
            if not all(any(steps[sid].op == 'filter' and steps[sid].field == c['field']
                and steps[sid].predicate == c.get('predicate', 'eq')
                and scalar_equal(steps[sid].operand, c.get('value')) for sid in ancestors) for c in conditions):
                continue
            candidates.append(step)
        if len(candidates) == 1:
            candidates[0].expose = True
            promoted.append({'requirementId':binding.requirementId,'stepId':candidates[0].id,
                'reason':'requested_typed_leaf_projection_exposed','knowledgeBindingId':binding.knowledgeBindingId})
    return promoted


def bind_analysis_evidence(plan, task, knowledge, sources, *, language='en', corrections=None):
    """Bind existing page facts and already-collected fields; never grant access."""
    from .generic_reader import PipelineError
    from .reader_collection import validate_analysis_sources
    from .reader_plan_dependencies import prune_disconnected_steps, separate_public_fields, assemble_snapshot_binding
    disconnected = prune_disconnected_steps(plan)
    if corrections is not None:
        corrections.extend(disconnected)
    validate_analysis_sources(plan, sources)
    complete_grouped_count(plan, task, language)
    catalog = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    requirements = {r['id']: r for r in requirements_for(task)}
    for binding in plan.requirementBindings:
        assembled = assemble_snapshot_binding(binding, plan, task, catalog, requirements, sources)
        if assembled and corrections is not None:
            corrections.append(assembled)
        separation = separate_public_fields(binding, catalog.get(binding.knowledgeBindingId, {}),
            requirements.get(binding.requirementId, {}))
        if separation and corrections is not None:
            corrections.append(separation)
    from .reader_forms import compile_form_bindings
    compiled_forms, form_corrections = compile_form_bindings(plan, catalog, requirements, sources)
    if corrections is not None:
        corrections.extend(form_corrections)
    for binding in plan.requirementBindings:
        fact = catalog.get(binding.knowledgeBindingId)
        requirement = requirements.get(binding.requirementId)
        if (fact and fact.get('formDefinition') and requirement and requirement['kind'] == 'attribute'
                and not any(s.op == 'assess_form' and s.sourceId == binding.sourceId
                    and s.knowledgeBindingId == binding.knowledgeBindingId
                    for s in plan.steps if s.id in binding.stepIds)):
            raise PipelineError('analysis_form_operator_required', 'planning', details={
                'requirementId': binding.requirementId, 'knowledgeBindingId': binding.knowledgeBindingId,
                'sourceId': binding.sourceId, 'sourcePath': fact['sourcePath'],
                'correction': 'This page attribute is a schema/value assessment, not a raw JSON column. '
                    'Use one exposed assess_form source step with this knowledgeBindingId, sourceId, '
                    'sourcePath as path, inputs=[], role=detail and unknownPolicy=report. '
                    'Bind the requested attribute and its record object/grain to that same step. '
                    'Do not project or display raw formData or add disconnected identity reads. '
                    'The executor independently checks schema version, visibility and required conditions; '
                    'unresolved applicability must remain unknown.'})
    selections = expose_requested_projections(plan, task, catalog, sources)
    if corrections is not None:
        corrections.extend(selections)
    steps = {step.id: step for step in plan.steps}
    outputs = {}
    consumed = {sid for step in plan.steps for sid in step.inputs}
    for step in plan.steps:
        if step.id in consumed and 'expose' not in step.model_fields_set:
            step.expose = False
    # Engine-owned requirements are checked from actual output lineage. A model
    # binding cannot add to or replace those proofs (or make a redundant hidden
    # identity read a dependency of a detail response). Attribute semantics and
    # completeness still have their own mandatory per-output checks.
    plan.requirementBindings = [b for b in plan.requirementBindings
        if requirements.get(b.requirementId, {}).get('kind') not in {'record', 'view'}
        and not (requirements.get(b.requirementId, {}).get('kind') == 'detail'
                 and task.requestedAttributes)]
    for step in plan.steps:
        if not step.expose:
            continue
        ancestors, pending = set(), [step.id]
        while pending:
            sid = pending.pop()
            if sid in ancestors or sid not in steps:
                continue
            ancestors.add(sid)
            pending.extend(steps[sid].inputs)
        outputs[step.id] = sorted(ancestors)
    complete_record_contexts(plan, task, catalog, sources, outputs)
    from .reader_branch_bindings import split_branch_bindings
    branch_changes = split_branch_bindings(plan, requirements, catalog, sources)
    if corrections is not None:
        corrections.extend(branch_changes)
    knowledge.prompt()  # Materialize stable passage addresses from loaded records.
    compiled_domain_reads = set()
    unreachable_bindings = []
    for binding in plan.requirementBindings:
        # A source-level form reader belongs to the already verified single
        # parent record. Bind that identity proof to the form output itself;
        # a redundant hidden key read is not a separate data dependency.
        fact = catalog.get(binding.knowledgeBindingId, {})
        source = sources.get(binding.sourceId, {})
        proof = source.get('verifiedRecord') or {}
        from .reader_related import redundant_related_key_reads, redundant_parent_relation_reads
        redundant = redundant_related_key_reads(binding, fact, sources, steps, outputs)
        parent_relation_reads = redundant_parent_relation_reads(task, binding, fact, sources, steps, outputs)
        if parent_relation_reads:
            binding.stepIds = [sid for sid in binding.stepIds if sid not in parent_relation_reads]
            if corrections is not None:
                corrections.append({'requirementId': binding.requirementId,
                    'removedStepIds': parent_relation_reads, 'sourceId': binding.sourceId,
                    'reason': 'parent_relation_lookup_already_proven_by_runtime'})
        from .reader_group_domain import redundant_domain_reads
        domain_reads = redundant_domain_reads(binding, fact, sources, steps, outputs)
        if domain_reads:
            compiled_domain_reads.update(domain_reads)
            binding.stepIds = [sid for sid in binding.stepIds if sid not in domain_reads]
            if corrections is not None:
                corrections.append({'requirementId': binding.requirementId,
                    'removedStepIds': domain_reads, 'sourceId': binding.sourceId,
                    'reason': 'operator_domain_already_verified_by_runtime'})
        if redundant:
            binding.stepIds = [sid for sid in binding.stepIds if sid not in redundant]
            if corrections is not None:
                corrections.append({'requirementId': binding.requirementId,
                    'removedStepIds': redundant, 'sourceId': binding.sourceId,
                    'reason': 'related_key_lookup_already_proven_by_runtime'})
        unreachable = [sid for sid in binding.stepIds if not any(sid in ids for ids in outputs.values())]
        form_roots = [step.id for step in plan.steps if step.op == 'assess_form'
            and step.sourceId == binding.sourceId and step.path == fact.get('sourcePath')
            and any(step.id in ids for ids in outputs.values())]
        from .reader_subject import parent_property_context
        property_roots = [step.id for step in plan.steps if step.sourceId == binding.sourceId
            and any(step.id in ancestors and parent_property_context(task, fact.get('kind'),
                    fact.get('sourcePath', ''), fact.get('fields', []), source, step,
                    {'role': steps[oid].role, 'value': []}) for oid, ancestors in outputs.items())]
        from .reader_related import related_context_read
        related_roots = [step.id for step in plan.steps if any(step.id in ancestors
            and related_context_read(task, fact.get('kind'), binding.sourceId,
                fact.get('sourcePath', ''), fact.get('fields', []), sources, step,
                {'role': steps[oid].role, 'value': []}) for oid, ancestors in outputs.items())]
        parent_roots = list(dict.fromkeys([*form_roots, *property_roots, *related_roots]))
        if (parent_roots and fact.get('kind') in {'object', 'grain', 'scope', 'population'}
                and proof.get('single') and proof.get('path') == fact.get('sourcePath')
                and fact.get('fields') and set(fact['fields']) == set(proof.get('keyFields', []))
                and all(sid in steps and steps[sid].op == 'read_rows' and not steps[sid].expose
                        and not steps[sid].inputs and steps[sid].sourceId == binding.sourceId
                        and steps[sid].path == proof['path'] for sid in unreachable)):
            # Parent identity also covers its other verified property branches,
            # even when the model already linked one reachable branch. Each
            # property still needs its own semantics and complete field receipts.
            binding.stepIds = list(dict.fromkeys([sid for sid in binding.stepIds if sid not in unreachable] + parent_roots))
        if any(not any(sid in ids for ids in outputs.values()) for sid in binding.stepIds):
            unreachable_bindings.append({
                'requirementId': binding.requirementId,
                'bindingSourceId': binding.sourceId, 'bindingSourcePath': binding.sourcePath,
                'unreachableStepIds': [sid for sid in binding.stepIds
                    if not any(sid in ids for ids in outputs.values())]})
    if unreachable_bindings:
        # Preserve the original first-error fields for existing consumers, but
        # provide every failed binding in this same correction opportunity.
        raise PipelineError('requirement_output_unreachable', 'planning', details={
            **unreachable_bindings[0], 'exposedOutputAncestors': outputs,
            'unreachableBindings': unreachable_bindings,
            'correction': 'Repair ALL listed unreachable bindings together without changing the task or '
                'dropping requirements. Every referenced step must contribute to an exposed output. '
                'A required distinct/filter/grain transformation must be an ancestor of the requested '
                'output; do not merely delete its binding or expose unrelated data to pass validation. '
                'For an attribute, reference its actual value-producing read/project branch. A hidden '
                'parent-key or relationship lookup is provenance only when the runtime independently '
                'proves that relation; it cannot stand in for an attribute output or grain transformation. '
                'An unproven relation remains missing. If comparing values, compute or expose each '
                'requested value through its own verified binding. Do not substitute a current related '
                'value for a requested historical value.'})
    for binding in plan.requirementBindings:
        fact = catalog.get(binding.knowledgeBindingId, {})
        source = sources.get(binding.sourceId, {})
        proof = source.get('verifiedRecord') or {}
        if not binding.knowledgeBindingId:
            requirement = requirements.get(binding.requirementId, {})
            if requirement.get('kind') == 'detail' and binding.fields:
                definitions = [f for f in catalog.values()
                    if binding.sourceId in f.get('contextVerifiedSourceIds', [])
                    and f.get('sourcePath') == binding.sourcePath]
                proven = {field for f in definitions for field in [*f.get('fields', []), *f.get('displayFields', [])]}
                if set(binding.fields) <= proven:
                    records = {f['recordId'] for f in definitions if set(binding.fields) &
                        set([*f.get('fields', []), *f.get('displayFields', [])])}
                    ids = list(dict.fromkeys(c.sourceId for c in binding.evidence))
                    for record in sorted(records):
                        passage = next((pid for pid, (key, _) in knowledge.passages.items()
                            if knowledge.items.get(key, {}).get('recordId') == record), None)
                        if passage and passage not in ids: ids.append(passage)
                    if len(ids) <= 10:
                        binding.evidence = [ExtractCitation(sourceId=pid) for pid in ids]
            if (not binding.evidence and (requirement.get('kind') == 'detail'
                    or requirement.get('kind') == 'measure'
                    and builtin_measure(task, requirement.get('value', '')) == 'count')):
                # Count and list/detail shape are engine semantics. Reuse only
                # citations from the contributing read on this source/path.
                # The evaluator still requires declared field meanings, full
                # collection receipts and per-output identity/grain/scope.
                ancestors, pending = set(), list(binding.stepIds)
                while pending:
                    sid = pending.pop()
                    if sid in ancestors or sid not in steps:
                        continue
                    ancestors.add(sid); pending.extend(steps[sid].inputs)
                refs = dict.fromkeys(c.sourceId for sid in sorted(ancestors)
                    if steps[sid].op == 'read_rows' and steps[sid].sourceId == binding.sourceId
                    and (not binding.sourcePath or steps[sid].path == binding.sourcePath)
                    for c in steps[sid].evidence)
                binding.evidence = [ExtractCitation(sourceId=pid) for pid in list(refs)[:10]]
            continue
        fact = catalog.get(binding.knowledgeBindingId)
        requirement = requirements.get(binding.requirementId)
        source = sources.get(binding.sourceId)
        if requirement and requirement['kind'] == 'detail':
            raise PipelineError('analysis_detail_binding_is_structural', 'planning', details={
                'requirementId': binding.requirementId, 'knowledgeBindingId': '',
                'correction': 'Detail/list is an engine-defined output shape, not an attribute meaning. '
                    'For this detail binding set knowledgeBindingId to the empty string; keep the real live source/path, '
                    'fields and contributing output steps. Cite its actual read evidence. '
                    'Keep separate object, grain, scope, time and attribute bindings unchanged.'})
        # The selected fact fixes physical mapping. Conflicting supplied values
        # are rejected instead of silently changing the plan's data source.
        if not fact or not requirement or not source or any([
                binding.sourcePath and binding.sourcePath != fact['sourcePath'],
                binding.fields and set(binding.fields) != set(fact['fields'])]):
            raise PipelineError('analysis_binding_inapplicable', 'planning', details={
                'requirementId': binding.requirementId, 'allowedBindingIds': sorted(catalog),
                'bindingLocation': {'requirementBindingIndex': plan.requirementBindings.index(binding),
                    'knowledgeBindingId': fact.get('knowledgeBindingId') if fact else None,
                    'sourceId': binding.sourceId if source else None, 'stepIds': list(binding.stepIds)},
                'requestedKind': requirement.get('kind') if requirement else None,
                'actualOperationRef': source.get('operationRef') if source else None,
                'selectedDefinition': ({k: fact.get(k) for k in
                    ['knowledgeBindingId', 'kind', 'concept', 'operationRef', 'sourcePath', 'fields', 'conditions']} if fact else None),
                'providedFields': binding.fields, 'providedPath': binding.sourcePath,
                'correction': 'Repair the located requirement binding against its actual observed source and selected definition. '
                    'For a matching knowledgeBindingId, RequirementBinding.sourcePath="" and fields=[] let the runtime '
                    'compile the exact declared path and dependency fields; any nonempty supplied path/fields must '
                    'match that definition exactly. This applies only to binding metadata: read_rows still needs its '
                    'explicit actual path and all required authorized dependencies. Keep value fields through the '
                    'requested output, apply documented conditions, and project public columns separately from '
                    'identity/condition dependencies. Empty metadata does not waive kind/concept, source, scope, '
                    'period or output validation. Keep the original requirements and independently valid outputs; '
                    'leave unsupported requirements unbound with missing. Do not reuse another interface binding.'})
        binding.sourcePath, binding.fields = fact['sourcePath'], list(fact['fields'])
        if not _semantic_match(binding, requirement, source, catalog):
            from types import SimpleNamespace
            alternatives = [key for key, other in catalog.items()
                if binding.sourceId in other.get('contextVerifiedSourceIds', [])
                and _semantic_match(SimpleNamespace(knowledgeBindingId=key,
                    sourcePath=other['sourcePath'], fields=other['fields']), requirement, source, catalog)]
            raise PipelineError('analysis_binding_inapplicable', 'planning', details={
                'requirementId': binding.requirementId,
                'bindingLocation': {'requirementBindingIndex': plan.requirementBindings.index(binding),
                    'knowledgeBindingId': fact['knowledgeBindingId'],
                    'sourceId': binding.sourceId, 'stepIds': list(binding.stepIds)},
                'requestedKind': requirement['kind'],
                'requestedConcept': requirement.get('fieldConcept') or requirement.get('value'),
                'actualOperationRef': source.get('operationRef'),
                'selectedDefinition': {k: fact.get(k) for k in
                    ['knowledgeBindingId', 'kind', 'concept', 'operationRef', 'sourcePath', 'fields']},
                'matchingBindingIds': sorted(alternatives),
                'correction': 'The located binding does not prove the requested kind/concept on this observed source. '
                    'Use a listed matchingBindingId only for that same requirement and source; otherwise leave '
                    'this requirement unbound with missing, retaining independently valid outputs and all original '
                    'requirements. A related source has its own object/grain; do not copy parent object/grain '
                    'bindings onto it merely because it was selected. A raw value, count or period label does not '
                    'prove a requested comparison: preserve missing comparable period/metric evidence or definitions. '
                    'The source remains observed; an inapplicable mapping does not mean the source is unreadable. '
                    'For a matching knowledgeBindingId, RequirementBinding.sourcePath="" and fields=[] compile '
                    'its exact metadata, or supply both exactly; contributing reads still retain explicit dependencies. '
                    'Do not change the task, rename a concept, invent an alias, broaden scope or substitute another '
                    'operation. Correct all affected mappings within the existing attempt budget.'})
        if 'contextParameters' in fact and not _context_match(fact, source):
            # The response shape may have multiple documented scope/date
            # variants. If an exact applicable variant exists, ask the planner
            # to correct its choice before rendering a misleading observation.
            from types import SimpleNamespace
            alternatives = [key for key, other in catalog.items() if key != binding.knowledgeBindingId
                and binding.sourceId in other.get('contextVerifiedSourceIds', [])
                and 'contextParameters' in other
                and other['sourcePath'] == binding.sourcePath and set(other['fields']) == set(binding.fields)
                and _semantic_match(SimpleNamespace(knowledgeBindingId=key, sourcePath=other['sourcePath'],
                    fields=other['fields']), requirement, source, catalog)]
            if alternatives:
                raise PipelineError('analysis_binding_context_mismatch', 'planning', details={
                    'requirementId': binding.requirementId, 'contextVerifiedBindingIds': sorted(alternatives),
                    'correction': 'Choose the binding whose scope and dates match this actual response, and correct all related bindings and user-facing context. Do not change the task or substitute another response.'})
        # Close internal projection dependencies from the verified collection.
        # This cannot fetch new fields, change a visible projection, or change
        # distinct keys. Source context and per-output meaning remain checked.
        ancestors, pending = set(), list(binding.stepIds)
        while pending:
            sid = pending.pop()
            if sid in ancestors or sid not in steps:
                continue
            ancestors.add(sid); pending.extend(steps[sid].inputs)
        if requirement['kind'] in {'measure', 'ordering'} and fact.get('conditions'):
            from .reader_scalars import scalar_equal
            missing_conditions = [c for c in fact['conditions'] if not any(
                steps[sid].op == 'filter' and steps[sid].field == c['field']
                and steps[sid].predicate == c.get('predicate', 'eq')
                and scalar_equal(steps[sid].operand, c.get('value')) for sid in ancestors)]
            if missing_conditions:
                raise PipelineError('analysis_measure_condition_missing' if requirement['kind'] == 'measure'
                                    else 'analysis_ordering_condition_missing', 'planning', details={
                    'requirementId': binding.requirementId, 'conditions': missing_conditions,
                    'correction': 'Apply all declared conditions on this requirement\'s contributing input '
                        'before aggregation or sorting. Keep condition fields in the private read and retain '
                        'documented exclusions in the answer context. Do not use a different population or '
                        'drop rows with genuinely unknown fields.'})
        collected = (source.get('collectionReceipt') or {}).get('fieldStatus', {})
        for sid in sorted(ancestors):
            read = steps[sid]
            if read.op != 'read_rows' or read.sourceId != binding.sourceId or read.path != binding.sourcePath:
                continue
            record_keys = (task.outputShape == 'detail' and task.requestedAttributes and proof.get('single')
                and proof.get('path') == read.path and fact['kind'] in {'object', 'grain', 'scope', 'population'}
                and set(fact['fields']) == set(proof.get('keyFields', []))
                and verified_scalar_keys(source, read.path, fact['fields'])
                and (proof.get('identity') == task.recordIdentity if task.recordIdentity
                     else proof.get('boundTo') == 'authenticated_user'))
            # A visible detail may omit internal keys while still needing them
            # for proof. Read the already-verified key privately; the final
            # requested-property projection below removes it from the answer.
            has_visible_properties = any(requirements.get(b.requirementId, {}).get('kind') == 'attribute'
                and b.sourceId == read.sourceId and read.id in b.stepIds
                and (b.fields or catalog.get(b.knowledgeBindingId, {}).get('fields'))
                and set(b.fields or catalog[b.knowledgeBindingId]['fields']) <= set(read.fields)
                for b in plan.requirementBindings)
            # A visible requested detail becomes a private read plus a public
            # projection below. Permit already-receipted context dependencies
            # before that split; they never become customer-facing fields.
            record_context = (task.outputShape == 'detail' and task.recordIdentity
                and proof.get('single') and proof.get('path') == read.path
                and proof.get('identity') == task.recordIdentity
                and fact['kind'] in {'object', 'grain', 'scope', 'population'}
                and verified_scalar_keys(source, read.path, fact['fields']))
            if read.expose and not ((record_keys or record_context) and read.role == 'detail' and has_visible_properties):
                continue
            extra = [f for f in binding.fields if f not in read.fields]
            observed_fields = bool(extra and (not read.expose or record_context)
                and verified_scalar_keys(source, read.path, extra))
            if extra and (record_keys or observed_fields or all(f in collected for f in extra)) and len(read.fields) + len(extra) <= 20:
                read.fields = [*read.fields, *extra]
        if not binding.evidence:
            passage = next((pid for pid, (key, _) in knowledge.passages.items()
                            if knowledge.items.get(key, {}).get('recordId') == fact['recordId']), None)
            if not passage:
                raise PipelineError('knowledge_citation_missing')
            binding.evidence = [ExtractCitation(sourceId=passage)]
    # Remove only proven duplicate leaves with no remaining computation or
    # requirement consumer. The operator still resolves the original source.
    retained = {sid for b in plan.requirementBindings for sid in b.stepIds}
    retained.update(sid for step in plan.steps for sid in step.inputs)
    plan.steps = [step for step in plan.steps if step.id not in compiled_domain_reads
        or step.id in retained or step.expose]
    # Operators with an explicit page binding use the same program-owned
    # citation mechanism as requirements. Empty quotes are not missing facts.
    for step in plan.steps:
        if not step.knowledgeBindingId:
            continue
        fact = catalog.get(step.knowledgeBindingId)
        if not fact:
            raise PipelineError('analysis_binding_inapplicable', 'planning', details={'stepId': step.id})
        if not step.evidence:
            passage = next((pid for pid, (key, _) in knowledge.passages.items()
                            if knowledge.items.get(key, {}).get('recordId') == fact['recordId']), None)
            if not passage:
                raise PipelineError('knowledge_citation_missing')
            step.evidence = [ExtractCitation(sourceId=passage)]
        if step.op == 'assess_form':
            if (step.sourceId not in fact['applicableSourceIds'] or step.path != fact['sourcePath']
                    or step.fields and set(step.fields) != set(fact['fields'])):
                raise PipelineError('analysis_binding_inapplicable', 'planning', details={'stepId': step.id})
            step.fields = list(fact['fields'])
    project_requested_details(plan, task)
    from .reader_public_keys import project_public_keys
    public_changes = project_public_keys(plan, task, catalog, sources)
    if corrections is not None:
        corrections.extend(public_changes)
    validate_list_display(plan, task, catalog, sources)
    if task.outputShape == 'detail' and task.recordIdentity and task.requestedScope == 'unknown':
        # A permitted individual record does not establish global/team access.
        plan.context.scope = 'unknown'
        plan.context.scopeEvidence = []
    steps = {step.id: step for step in plan.steps}
    # Units are page-defined metadata. Preserve the observed value unchanged.
    for binding in plan.requirementBindings:
        fact = catalog.get(binding.knowledgeBindingId, {})
        unit = fact.get('displayUnit')
        if fact.get('kind') != 'attribute' or not unit or len(fact['fields']) != 1:
            continue
        field = fact['fields'][0]
        for step in plan.steps:
            if not step.expose or field not in step.fields:
                continue
            ancestors, pending = set(), [step.id]
            while pending:
                sid = pending.pop()
                if sid in ancestors or sid not in steps:
                    continue
                ancestors.add(sid); pending.extend(steps[sid].inputs)
            if not set(binding.stepIds) & ancestors:
                continue
            label = step.fieldLabels.get(field) or fact['concept']
            if unit not in label:
                step.fieldLabels[field] = f'{label} ({unit})'
    # A compiled source-level form adapter already owns these observed inputs.
    # Remove only disconnected hidden reads of its same record/document, after
    # all requirement and output dependencies have been checked.
    used = {sid for step in plan.steps for sid in step.inputs}
    used.update(sid for binding in plan.requirementBindings for sid in binding.stepIds)
    redundant_forms = {step.id for step in plan.steps if step.op == 'read_rows'
        and not step.expose and not step.inputs and step.id not in used
        and any(step.sourceId == source and (step.path in paths or step.fields and all(
            step.path.rstrip('/') + '/' + field.replace('.', '/') in paths for field in step.fields))
            for source, paths in compiled_forms)}
    if redundant_forms:
        plan.steps = [step for step in plan.steps if step.id not in redundant_forms]
        if corrections is not None:
            corrections.append({'reason': 'compiled_form_inputs_already_verified',
                                'removedStepIds': sorted(redundant_forms)})
    return plan


def planning_bindings(knowledge, sources):
    """Omit only proven-wrong context variants of the same documented field.

    Full facts stay available to validation and audit. A failed match without
    an independently matched equivalent remains visible as unverified.
    """
    facts = applicable_bindings(knowledge, sources)
    def signature(f):
        return (f['operationRef'], f['sourcePath'], f['kind'], f['concept'],
                tuple(sorted(f.get('fields', []))))
    verified = {}
    for fact in facts:
        if 'contextParameters' in fact:
            verified.setdefault(signature(fact), set()).update(fact['contextVerifiedSourceIds'])
    result = []
    for fact in facts:
        keep = [sid for sid in fact['applicableSourceIds']
                if sid in fact['contextVerifiedSourceIds'] or sid not in verified.get(signature(fact), set())]
        if keep:
            result.append({**fact, 'applicableSourceIds': keep})
    return result


def verified_source_scopes(knowledge, sources):
    """Expose only uniquely proven scope meanings, never infer permission."""
    candidates = {}
    for fact in applicable_bindings(knowledge, sources):
        if (fact['kind'] != 'scope' or fact['concept'] not in {'personal', 'team', 'global'}
                or not fact.get('contextParameters')):
            continue
        for sid in fact['contextVerifiedSourceIds']:
            candidates.setdefault(sid, {}).setdefault(fact['concept'], []).append(fact['knowledgeBindingId'])
    return {sid: {'scope': next(iter(meanings)), 'bindingIds': next(iter(meanings.values()))}
            for sid, meanings in candidates.items() if len(meanings) == 1}


def validate_observed_scope(plan, task, scopes):
    """A planner's uncertainty cannot contradict a verified response receipt."""
    from .generic_reader import PipelineError
    if task.recordIdentity or not plan.missing or plan.context.scope != 'unknown':
        return
    used = {s.sourceId for s in plan.steps if s.sourceId}
    if used and used <= set(scopes) and len({scopes[sid]['scope'] for sid in used}) == 1:
        raise PipelineError('analysis_observed_scope_is_verified', 'planning', details={
            'verifiedSourceScopes': {sid: scopes[sid] for sid in sorted(used)},
            'correction': 'Use the verified observed scope in context and revise unsupported scope uncertainty. Do not change requested scope, reuse an old value, or remove genuinely missing requirements.'})


def validate_detail_output_role(plan, task):
    """A plan claiming complete bound details must expose a detail output.

    Ask the planner to repair contradictory metadata; never promote an
    observation or waive actual property/grain/context evidence checks.
    """
    from .generic_reader import PipelineError
    if task.outputShape not in {'detail', 'list'} or not task.requestedAttributes or plan.missing:
        return
    required = {r['id'] for r in requirements_for(task) if r['kind'] not in {'record', 'view', 'detail'}}
    bound = {b.requirementId for b in plan.requirementBindings if b.knowledgeBindingId}
    exposed = [s for s in plan.steps if s.expose]
    if (required <= bound and exposed and all(s.role == 'observation' for s in exposed)):
        raise PipelineError('analysis_detail_output_role_required', 'planning', details={
            'stepIds': [s.id for s in exposed],
            'correction': 'You bound every detail requirement and declared no missing requirements, but exposed only observations. Set role=detail on the intended answer output, or preserve the genuinely missing requirements. All field, identity, grain and context checks still apply.'})


def selection_context_gaps(task, selection, sources, knowledge):
    """Detect a declared population binding contradicted by captured filters.

    This only returns evidence for planner correction. It does not infer a
    filter value, execute an action, or grant data access.
    """
    from types import SimpleNamespace
    if selection.nextActions or selection.missing:
        return []
    facts = applicable_bindings(knowledge, sources)
    catalog = {f['knowledgeBindingId']: f for f in facts}
    gaps = []
    for requirement in requirements_for(task):
        # Different requested measures may use different contexts of the same
        # operation (for example current and historical queues). A measure
        # needs one matching selected source; final lineage still proves that
        # its output actually consumes that source and all required predicates.
        if requirement['kind'] == 'measure' and any(
                sid in f['applicableSourceIds'] and 'contextParameters' in f
                and _semantic_match(SimpleNamespace(knowledgeBindingId=f['knowledgeBindingId'],
                    sourcePath=f['sourcePath'], fields=f['fields']), requirement, sources.get(sid, {}), catalog)
                and _context_match(f, sources.get(sid, {}))
                for sid in selection.sourceIds for f in facts):
            continue
        # Object, grain and measure meanings can also depend on a page's
        # selected category or view. Validate every context-bound requirement
        # before collecting the wrong population, not just explicit filters.
        for sid in selection.sourceIds:
            source = sources.get(sid, {})
            matches = [f for f in facts if sid in f['applicableSourceIds']
                and 'contextParameters' in f and _semantic_match(SimpleNamespace(
                    knowledgeBindingId=f['knowledgeBindingId'], sourcePath=f['sourcePath'], fields=f['fields']),
                    requirement, source, catalog)]
            if matches and not any(_context_match(f, source) for f in matches):
                gaps.append({'requirementId': requirement['id'], 'sourceId': sid,
                    'bindingIds': [f['knowledgeBindingId'] for f in matches],
                    'reason': 'captured_filters_do_not_prove_requested_context'})
    return gaps


def prepare_read_continuation(selection):
    """An explicit next read invalidates pre-action source choices.

    Execute only the first proposed action against the current observation.
    The ordinary action binder must still verify permission, control and value;
    remaining actions are replanned from the fresh page rather than replayed.
    """
    if not selection.nextActions:
        return None
    discarded = list(selection.sourceIds)
    deferred = max(0, len(selection.nextActions) - 1)
    selection.sourceIds = []
    selection.nextActions = selection.nextActions[:1]
    if discarded or deferred:
        return {'reason':'read_action_requires_fresh_source_selection',
                'discardedSourceIds':discarded,'deferredActionCount':deferred}
    return None
