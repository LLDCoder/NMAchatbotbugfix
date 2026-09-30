"""Prove a documented singleton observation without treating its value as an ID."""
import re
import math
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from .reader_collection import projection_hash


def valid_display_scale(rule):
    return (isinstance(rule, dict) and set(rule) == {'threshold', 'atMostFactor', 'otherwiseFactor', 'decimals'}
        and all(type(rule[k]) in {int, float} and math.isfinite(rule[k]) and abs(rule[k]) <= 1e12
                for k in ['threshold', 'atMostFactor', 'otherwiseFactor'])
        and type(rule['decimals']) is int and 0 <= rule['decimals'] <= 8)


def format_snapshot_values(outputs, plan, knowledge, coverage):
    """A bounded page-defined numeric display; original observed values stay in audit."""
    from .reader_requirements import semantic_bindings
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(knowledge)}
    for output in outputs:
        if not isinstance(output['value'], list):
            continue
        applicable = []
        for binding in plan.requirementBindings:
            fact = facts.get(binding.knowledgeBindingId, {})
            rule = fact.get('displayScale')
            if (fact.get('kind') == 'attribute' and valid_display_scale(rule)
                    and len(fact['fields']) == 1 and any(c['id'] == binding.requirementId
                        and c['status'] == 'satisfied' and output['id'] in c.get('outputIds', []) for c in coverage)):
                applicable.append(fact)
        if not applicable:
            continue
        display = [dict(row) for row in output['value']]
        for fact in applicable:
            key = fact['fields'][0]; rule = fact['displayScale']
            for row in display:
                value = row.get(key)
                if type(value) not in {int, float} or not math.isfinite(value):
                    continue
                factor = rule['atMostFactor'] if value <= rule['threshold'] else rule['otherwiseFactor']
                number = Decimal(str(value)) * Decimal(str(factor))
                rounded = number.quantize(Decimal(1).scaleb(-rule['decimals']), rounding=ROUND_HALF_UP)
                row[key] = format(rounded, 'f').rstrip('0').rstrip('.') if rule['decimals'] else str(rounded)
                if row[key] in {'', '-0'}: row[key] = '0'
                row[key] += fact.get('displayUnit', '')
        output['displayRows'] = display


def response_parameter_hashes(fact, source):
    """Bind query dates to attested response dates, never to a guessed current week."""
    from .generic_reader import pointer, PipelineError
    declarations = fact.get('contextResponseBindings', {})
    if not isinstance(declarations, dict) or len(declarations) > 10:
        return None
    result = {}
    for parameter, declaration in declarations.items():
        if (not isinstance(parameter, str) or not isinstance(declaration, dict)
                or set(declaration) != {'path', 'format'} or declaration['format'] != 'date'
                or not isinstance(declaration['path'], str) or not declaration['path'].startswith('/')):
            return None
        try:
            value = pointer(source['data'], declaration['path'])
            receipt = source.get('fieldEvidence', {}).get(declaration['path'], {})
            if (receipt.get('status') != 'complete' or receipt.get('valueHash') != projection_hash(value)
                    or not isinstance(value, str)
                    or not re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?', value)):
                return None
            day = date.fromisoformat(value[:10]).isoformat()
        except (KeyError, ValueError, PipelineError):
            return None
        result[parameter] = projection_hash(day)
    return result


def request_parameter_hashes(fact, source):
    """Attested request dates describe a snapshot, never a requested period.

    Some summaries do not echo their reporting dates. The trusted browser
    gateway can attest that the captured parameter was an ISO calendar date
    without exporting its raw value. This cannot establish scope, population,
    explicit time requirements, filters, measures or entity identity.
    """
    declarations = fact.get('contextRequestBindings', {})
    if not declarations:
        return {}
    if (fact.get('kind') not in {'object', 'grain'} or not isinstance(declarations, dict)
            or len(declarations) > 10 or not source.get('principalScopeRef')
            or source.get('kind') != 'api_response' or not str(source.get('operationRef', '')).startswith('GET ')):
        return None
    context = source.get('collectionContext') or {}
    proofs = context.get('parameterShapeEvidence') or {}
    hashes = context.get('parameterHashes') or {}
    if not context.get('contextRef') or not isinstance(proofs, dict) or not isinstance(hashes, dict):
        return None
    result = {}
    for key, declaration in declarations.items():
        proof = proofs.get(key, {})
        if (not isinstance(key, str) or declaration != {'format': 'date'} or not isinstance(proof, dict)
                or proof.get('format') != 'date' or proof.get('status') != 'complete'
                or not re.fullmatch(r'[a-f0-9]{64}', str(proof.get('valueHash', '')))
                or proof.get('valueHash') != hashes.get(key)):
            return None
        result[key] = proof['valueHash']
    return result


def valid_summary_component(fact):
    declaration = fact.get('summaryComponent')
    if declaration is None:
        return True
    return (fact.get('kind') == 'attribute' and isinstance(declaration, dict)
        and set(declaration) == {'group', 'component', 'requiredComponents'}
        and isinstance(declaration['group'], str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,120}', declaration['group'])
        and isinstance(declaration['requiredComponents'], list) and 2 <= len(declaration['requiredComponents']) <= 6
        and all(isinstance(v, str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', v) for v in declaration['requiredComponents'])
        and len(set(declaration['requiredComponents'])) == len(declaration['requiredComponents'])
        and declaration['component'] in declaration['requiredComponents'])


def overview_component_requirements(task, requirements, bindings, catalog, sources):
    """A named multi-panel attribute is complete only with every declared part."""
    from .generic_reader import PipelineError
    result = set()
    for rid, items in bindings.items():
        parts = [catalog.get(b.knowledgeBindingId, {}).get('summaryComponent') for b in items]
        if not any(parts):
            continue
        # Detail may present a declared multi-component snapshot. Output format
        # does not remove components or turn a snapshot into an entity record.
        snapshot_detail = (task.outputShape == 'detail' and not task.recordIdentity
                           and not task.requestedMeasures and not task.groupBy)
        valid = ((task.outputShape == 'overview' or snapshot_detail)
                 and requirements.get(rid, {}).get('kind') == 'attribute'
                 and all(isinstance(part, dict) for part in parts)
                 and len({sources.get(b.sourceId, {}).get('observationRef') for b in items}) == 1
                 and all(sources.get(b.sourceId, {}).get('observationRef') for b in items))
        if valid:
            expected = set(parts[0]['requiredComponents'])
            valid = (len(parts) == len(expected) and {part['component'] for part in parts} == expected
                     and all(part['group'] == parts[0]['group'] and set(part['requiredComponents']) == expected for part in parts))
        if not valid:
            raise PipelineError('overview_components_incomplete', 'planning', details={
                'requirementId': rid,
                'correction': 'This documented summary attribute has separate required components. '
                    'Bind each declared component to its own observed source/path and scalar output. '
                    'Do not replace missing panels with another panel, duplicate one component, or infer values. '
                    'If a component is unavailable, preserve the missing requirement.'})
        result.add(rid)
    return result


def singleton_grain(task, fact, source, reads, output):
    """One response object is not proof of a named entity or of a row population."""
    from .generic_reader import pointer, PipelineError
    if (fact.get('observationShape') != 'singleton_object'
            or task.outputShape not in {'detail', 'overview'} or task.recordIdentity or task.requestedMeasures or task.groupBy
            or output.get('role') != 'detail' or source.get('kind') != 'api_response'
            or not source.get('principalScopeRef') or not isinstance(fact.get('contextParameters'), dict)
            or not reads or any(r.op != 'read_rows' or r.path != fact['sourcePath'] for r in reads)):
        return False
    try:
        value = pointer(source['data'], fact['sourcePath'])
    except (KeyError, PipelineError):
        return False
    if not isinstance(value, dict):
        return False
    for read in reads:
        if not read.fields:
            return False
        for field in read.fields:
            path = read.path + '/' + '/'.join(field.split('.'))
            try:
                scalar = pointer(source['data'], path)
            except PipelineError:
                return False
            receipt = source.get('fieldEvidence', {}).get(path, {})
            if (isinstance(scalar, (dict, list)) or receipt.get('status') != 'complete'
                    or receipt.get('valueHash') != projection_hash(scalar)):
                return False
    return True


def singleton_overview_output(task, step, plan, sources, knowledge, value):
    """Permit scalar snapshot panels, never a row list disguised as overview."""
    from .reader_requirements import semantic_bindings, _semantic_match, _context_match, requirements_for
    if (task.outputShape != 'overview' or step.op not in {'read_rows', 'project'}
            or not isinstance(value, list) or len(value) != 1 or step.role != 'detail'):
        return False
    steps = {s.id:s for s in plan.steps}
    ancestors, pending = set(), [step.id]
    while pending:
        sid = pending.pop()
        if sid in ancestors or sid not in steps:
            continue
        ancestors.add(sid); pending.extend(steps[sid].inputs)
    reads = [steps[sid] for sid in ancestors if steps[sid].op == 'read_rows']
    if not reads or any(steps[sid].op not in {'read_rows', 'project'} for sid in ancestors):
        return False
    facts = {f['knowledgeBindingId']:f for f in semantic_bindings(knowledge)}
    requirement = next(r for r in requirements_for(task) if r['kind'] == 'grain')
    for binding in plan.requirementBindings:
        if binding.requirementId != requirement['id'] or not set(binding.stepIds) & ancestors:
            continue
        fact = facts.get(binding.knowledgeBindingId, {})
        source = sources.get(binding.sourceId, {})
        if (any(read.sourceId != binding.sourceId for read in reads)
                or not _semantic_match(binding, requirement, source, facts) or not _context_match(fact, source)):
            continue
        if singleton_grain(task, fact, source, reads, {'role':step.role}):
            return True
    return False
