"""Resolve a grouping domain from a complete, authorized current source.

The page knowledge defines the key relationship; the runtime verifies data,
identity, scope and completeness. No member lists or names live in code.
"""
import json
import re
import unicodedata
from .reader_collection import projection_hash, RESTRICTED
from .reader_requirements import _context_match


def normalize_domain_label(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def requested_domain_label(fact, requirement):
    """Parse a page-declared label argument without guessing identity or aliases."""
    spec = fact.get('domainSelection')
    if (fact.get('kind') != 'filter' or requirement.get('kind') != 'filter'
            or not isinstance(spec, dict) or spec.get('mode') != 'exact_label'
            or not isinstance(spec.get('prefixes'), list)):
        return None
    text = requirement.get('value', '')
    if not isinstance(text, str): return None
    prefixes = [p for p in spec['prefixes'] if isinstance(p, str) and p.strip()]
    for prefix in sorted(prefixes, key=len, reverse=True):
        match = re.fullmatch(re.escape(prefix.strip()) + r'(?:\s*[:=]\s*|\s+)(.+)', text.strip(), re.I)
        if not match: continue
        label = match[1].strip()
        if len(label) >= 2 and label[0] == label[-1] and label[0] in {'"', "'"}:
            label = label[1:-1].strip()
        return label if label and len(label) <= 200 else None
    return None


def redundant_domain_reads(binding, fact, sources, steps, outputs):
    """A verified operator reads its page-defined domain independently.

    Drop only duplicate hidden domain projections from requirement lineage.
    The primary operator, its scope and every output still need normal proofs.
    """
    domain = fact.get('membershipDomain') or fact.get('groupDomain')
    source = sources.get(binding.sourceId)
    if not isinstance(domain, dict) or not source:
        return []
    reachable = {sid for ids in outputs.values() for sid in ids}
    operator = 'filter_membership' if fact.get('membershipDomain') else 'group_count'
    actual = [s for s in steps.values() if s.id in reachable and s.id in binding.stepIds
        and s.op == operator and s.knowledgeBindingId == binding.knowledgeBindingId
        and fact.get('fields') == ([s.field] if operator == 'filter_membership' else s.fields or [s.field])
        and (operator != 'group_count' or s.includeZeroGroups)]
    if not actual:
        return []
    allowed = {domain.get('keyField'), domain.get('labelField'),
        *(c.get('field') for c in domain.get('conditions', []))} - {None}
    candidates = [sid for sid in binding.stepIds if sid not in reachable and sid in steps
        and steps[sid].op == 'read_rows' and not steps[sid].expose and not steps[sid].inputs
        and steps[sid].path == domain.get('sourcePath') and steps[sid].fields
        and set(steps[sid].fields) <= allowed
        and sources.get(steps[sid].sourceId, {}).get('operationRef') == domain.get('operationRef')]
    if not candidates:
        return []
    domain_id, _, _, _ = observed_domain(domain, sources, [source])
    return [sid for sid in candidates if steps[sid].sourceId == domain_id]


def domain_dependencies(task, knowledge, selected, available):
    """Retain already authorized auxiliary responses required by matching facts."""
    from .reader_bindings import applicable_bindings
    from .reader_requirements import requirements_for, _semantic_match
    from types import SimpleNamespace
    added = {}
    for fact in applicable_bindings(knowledge, selected):
        domain = fact.get('membershipDomain') or fact.get('groupDomain')
        if not isinstance(domain, dict): continue
        catalog = {fact['knowledgeBindingId']: fact}
        candidate = SimpleNamespace(knowledgeBindingId=fact['knowledgeBindingId'],
            sourcePath=fact['sourcePath'], fields=fact['fields'])
        anchors = [selected[sid] for sid in fact['contextVerifiedSourceIds'] if any(
            _semantic_match(candidate, req, selected[sid], catalog) for req in requirements_for(task))]
        if not anchors: continue
        matches = [(sid, s) for sid, s in available.items()
            if s.get('operationRef') == domain.get('operationRef')
            and s.get('observationRef') and all(s['observationRef'] == a.get('observationRef')
                and s.get('principalScopeRef') == a.get('principalScopeRef') for a in anchors)
            and ('contextParameters' not in domain or _context_match(domain, s))]
        if len(matches) == 1: added[matches[0][0]] = matches[0][1]
    return added


def observed_domain(domain, sources, provenance):
    from .generic_reader import PipelineError, pointer, row_scalar
    fail = lambda code: PipelineError(code, 'source_data')
    if not isinstance(domain, dict) or not all(isinstance(domain.get(k), str) and domain[k]
            for k in ('operationRef', 'sourcePath', 'keyField', 'labelField')):
        raise fail('group_domain_definition_missing')
    if any(RESTRICTED.search(domain[k]) for k in ('keyField', 'labelField')):
        raise PipelineError('output_field_restricted', 'permission')
    from .reader_scalars import scalar_compare
    from .reader_requirements import valid_condition_value
    conditions = domain.get('conditions', [])
    if (not isinstance(conditions, list) or len(conditions) > 10 or any(
            not isinstance(c, dict) or not isinstance(c.get('field'), str)
            or RESTRICTED.search(c['field']) or not valid_condition_value(c.get('predicate', 'eq'), c.get('value'))
            for c in conditions)):
        raise fail('group_domain_definition_missing')
    candidates = [(sid, source) for sid, source in sources.items()
        if source.get('operationRef') == domain['operationRef']
        and provenance and all(source.get('principalScopeRef')
            and ref.get('principalScopeRef') == source['principalScopeRef']
            and (source.get('observationRef') == ref.get('observationRef')
                 if source.get('observationRef') or ref.get('observationRef') else
                 bool(source.get('capturedAt')) and source['capturedAt'] == ref.get('capturedAt'))
            for ref in provenance)
        and ('contextParameters' not in domain or _context_match(domain, source))]
    if len(candidates) != 1:
        raise fail('group_domain_source_unverified')
    sid, source = candidates[0]
    rows = pointer(source['data'], domain['sourcePath'])
    receipt = source.get('fieldEvidence', {}).get(domain['sourcePath'], {})
    collection = source.get('collectionReceipt') or {}
    complete = (receipt.get('status') == 'complete' and receipt.get('valueHash') == projection_hash(rows))
    complete |= (collection.get('completeness') == 'complete' and collection.get('rowsPath') == domain['sourcePath']
                 and collection.get('projectionHash') == projection_hash(rows)
                 and {domain['keyField'], domain['labelField'], *(c['field'] for c in conditions)} <= set(collection.get('fields', [])))
    if not complete or not isinstance(rows, list) or len(rows) > 200:
        raise fail('group_domain_incomplete')
    labels, keys = {}, {}
    for row in rows:
        for condition in conditions:
            value = row_scalar(row, condition['field'])
            if value is None: raise fail('group_domain_condition_unknown')
        try:
            if not all(scalar_compare(row_scalar(row, c['field']), c.get('predicate', 'eq'), c.get('value')) for c in conditions):
                continue
        except (TypeError, ValueError):
            raise fail('group_domain_condition_unknown') from None
        key, label = row_scalar(row, domain['keyField']), row_scalar(row, domain['labelField'])
        if key is None or key == '' or isinstance(key, (dict, list)) or not isinstance(label, str) or not label.strip():
            raise fail('group_domain_identity_missing')
        typed = json.dumps(key, ensure_ascii=False)
        if typed in labels:
            raise fail('group_domain_duplicate_key')
        labels[typed], keys[typed] = label, key
    return sid, rows, labels, keys


def complete_observed_domain(groups, field, definition, sources, provenance, *, allow_unmatched=False):
    from .generic_reader import PipelineError
    domain = definition.get('groupDomain')
    sid, rows, labels, keys = observed_domain(domain, sources, provenance)
    # A requested label filter narrows the zero-filled domain too. Only runtime
    # proofs from this exact source snapshot can establish the selected keys.
    memberships = [p for ref in provenance for p in ref.get('membershipProofs', []) if p.get('field') == field]
    for proof in memberships:
        if (proof.get('sourceId') != sid or proof.get('domainHash') != projection_hash(rows)
                or proof.get('definitionHash') != projection_hash(domain)):
            raise PipelineError('group_domain_membership_mismatch', 'planning')
        if 'selectedKeyHashes' in proof:
            selected = set(proof['selectedKeyHashes'])
            keys = {typed:key for typed,key in keys.items() if projection_hash(key) in selected}
            labels = {typed:label for typed,label in labels.items() if typed in keys}
    # The original task groups are never filtered down to a smaller roster.
    # Unknown assignments are not zero members and must remain a visible gap.
    observed = {json.dumps(row[field], ensure_ascii=False) for row in groups}
    unmatched = observed - set(keys)
    if unmatched and not allow_unmatched:
        raise PipelineError('group_domain_unmatched_key', 'source_data')
    result = [dict(row) for row in groups]
    result += [{field: key, 'count': 0} for typed, key in keys.items() if typed not in observed]
    # Raw keys remain in the auditable values; they are not exposed as names.
    # Keep separate, explicitly unverified groups rather than inventing membership.
    display = [{**row, field: labels[json.dumps(row[field], ensure_ascii=False)]}
               for row in result if json.dumps(row[field], ensure_ascii=False) in labels]
    unmatched_rows = [row for row in result if json.dumps(row[field], ensure_ascii=False) in unmatched]
    for key, label in [('missing_assignment_key', 'Assignment key unavailable'),
                       ('outside_verified_domain', 'Outside verified member list')]:
        count = sum(row['count'] for row in unmatched_rows
                    if (row[field] is None or row[field] == '') == (key == 'missing_assignment_key'))
        if count:
            display.append({field: label, 'count': count})
    proof = {'sourceId': sid, 'operationRef': domain['operationRef'], 'path': domain['sourcePath'],
             'definitionHash': projection_hash(domain),
             'domainHash': projection_hash(rows), 'memberCount': len(keys),
             'zeroGroupsAdded': len(result) - len(groups), 'knowledgeBindingId': definition['knowledgeBindingId'],
             'unmatchedGroupCount': len(unmatched),
             'unmatchedRowCount': sum(row['count'] for row in unmatched_rows),
             'membershipConfirmed': not bool(unmatched)}
    return result, display, proof


def filter_membership(rows, step, definition, sources, provenance, task, knowledge):
    """A requested membership predicate uses a complete live domain, never IDs from the model."""
    from .generic_reader import PipelineError
    from .reader_requirements import requirements_for, _semantic_match
    from types import SimpleNamespace
    if (not task or not definition or definition.get('kind') != 'filter'
            or definition.get('fields') != [step.field] or not provenance
            or any(ref.get('operationRef') != definition['operationRef']
                   or ref.get('fieldBinding') != definition['sourcePath'] for ref in provenance)):
        raise PipelineError('membership_definition_inapplicable', 'planning')
    catalog = {definition['knowledgeBindingId']: definition}
    binding = SimpleNamespace(knowledgeBindingId=definition['knowledgeBindingId'],
        sourcePath=definition['sourcePath'], fields=definition['fields'])
    matched = [r['id'] for r in requirements_for(task) if r['kind'] == 'filter'
               and _semantic_match(binding, r, {'operationRef': definition['operationRef']}, catalog)]
    if not matched:
        raise PipelineError('membership_filter_not_requested', 'planning')
    sid, domain_rows, labels, keys = observed_domain(definition.get('membershipDomain'), sources, provenance)
    selection = {}
    if definition.get('domainSelection'):
        requested = [requested_domain_label(definition, r) for r in requirements_for(task) if r['id'] in matched]
        if not requested or len({normalize_domain_label(v) for v in requested if v}) != 1:
            raise PipelineError('domain_label_ambiguous', 'planning')
        target = normalize_domain_label(requested[0])
        selected = {typed:key for typed,key in keys.items() if normalize_domain_label(labels[typed]) == target}
        if not selected: raise PipelineError('domain_label_not_found', 'source_data')
        if len(selected) != 1: raise PipelineError('domain_label_ambiguous', 'planning')
        selection = {'selectedKeyHashes': [projection_hash(key) for key in selected.values()],
                     'selectionMode': 'exact_label', 'selectedMemberCount': len(selected)}
        keys = selected
    result, unknown, outside = [], 0, 0
    for row in rows:
        key = row.get(step.field)
        if key is None or key == '' or isinstance(key, (dict, list)):
            unknown += 1
        elif json.dumps(key, ensure_ascii=False) in keys:
            result.append(row)
        else:
            outside += 1
    if unknown and step.unknownPolicy != 'report':
        raise PipelineError('membership_key_unavailable', 'source_data')
    proof = {'knowledgeBindingId': definition['knowledgeBindingId'], 'sourceId': sid,
        **selection,
        'definitionHash': projection_hash(definition['membershipDomain']),
        'domainHash': projection_hash(domain_rows), 'memberCount': len(keys), 'field': step.field,
        'inputCount': len(rows), 'includedCount': len(result), 'outsideCount': outside,
        'unknownCount': unknown, 'requirementIds': matched, 'stepId': step.id}
    return result, [{**ref, 'membershipProofs': [*ref.get('membershipProofs', []), proof],
        'unknownRows': ref.get('unknownRows', 0) + unknown,
        'completeness': 'partial' if unknown else ref.get('completeness')} for ref in provenance], unknown
