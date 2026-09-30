"""Resolve only unused projection exclusions after complete requirement proofs."""


def resolve_unused_projection_gaps(plan, analysis, sources, missing, excluded):
    coverage = analysis.get('requirementCoverage') or []
    if (not analysis.get('requirementsSatisfied') or not coverage
            or any(c.get('status') != 'satisfied' for c in coverage)
            or analysis.get('missing') or plan.missing or not analysis.get('outputs')
            or any(s.get('collectionFailure') for s in sources.values())):
        return list(missing), []
    # Every exposed result must already have complete data provenance. An
    # optional field exclusion cannot repair a bounded page or failed request.
    if any(not output.get('evidence') or any(ref.get('completeness') != 'complete'
            for ref in output['evidence']) for output in analysis['outputs']):
        return list(missing), []
    used = {f for step in plan.steps for f in [*step.fields, step.field] if f}
    used.update(f for binding in plan.requirementBindings for f in binding.fields)
    resolved = []
    for code in dict.fromkeys(missing):
        if code not in {'collection_field_semantics_missing', 'source_field_unobserved'}:
            continue
        items = [item for item in excluded if item.get('reason') == code]
        if (not items or any(item.get('sourceId') not in sources or not item.get('fields')
                or set(item['fields']) & used for item in items)):
            continue
        resolved.append({'code': code, 'reason': 'not_used_by_verified_requirements_or_computation',
            'excluded': [{'sourceId': item['sourceId'], 'fields': list(item['fields'])} for item in items]})
    codes = {item['code'] for item in resolved}
    return [code for code in missing if code not in codes], resolved
