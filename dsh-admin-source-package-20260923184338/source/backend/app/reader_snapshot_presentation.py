"""Display metadata for already-proved singleton values, never new facts."""
import copy
import json
import math
from datetime import date


def snapshot_presentations(outputs, plan, knowledge, coverage, sources):
    from .generic_reader import pointer, row_scalar, PipelineError
    from .reader_bindings import applicable_bindings, verified_scalar_keys
    from .reader_requirements import _context_match
    from .reader_collection import projection_hash

    facts = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    for output in outputs:
        rows = output.get('value')
        if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
            continue
        refs = output.get('evidence', [])
        if len(refs) != 1 or refs[0].get('observationShape') != 'object':
            continue
        ref = refs[0]
        source = sources.get(ref.get('sourceId'), {})
        if (not source.get('principalScopeRef') or any(source.get(key) != ref.get(key)
                for key in ('principalScopeRef', 'operationRef', 'page', 'capturedAt', 'observationRef'))):
            continue
        anchors = []
        for binding in plan.requirementBindings:
            fact = facts.get(binding.knowledgeBindingId, {})
            if (binding.sourceId != ref.get('sourceId') or binding.sourcePath != ref.get('fieldBinding')
                    or binding.sourceId not in fact.get('contextVerifiedSourceIds', [])
                    or not any(c['id'] == binding.requirementId and c['status'] == 'satisfied'
                               and output['id'] in c.get('outputIds', []) for c in coverage)):
                continue
            anchors.append(fact)
        if not any(f.get('kind') == 'grain' and f.get('observationShape') == 'singleton_object' for f in anchors):
            continue
        try:
            observed = pointer(source['data'], ref['fieldBinding'])
        except (PipelineError, KeyError):
            continue
        attributes = [f for f in anchors if f.get('kind') == 'attribute']
        formats = {}
        for field, value in rows[0].items():
            if (type(value) not in {int, float} or not math.isfinite(value)
                    or ref.get('fieldStatus', {}).get(field) != 'complete'
                    or not verified_scalar_keys(source, ref['fieldBinding'], [field])
                    or projection_hash(value) != projection_hash(row_scalar(observed, field))):
                continue
            candidates = [f for f in facts.values() if f.get('kind') == 'attribute'
                          and f.get('fields') == [field] and not f.get('conditions')
                          and f.get('operationRef') == source.get('operationRef')
                          and f.get('sourcePath') == ref['fieldBinding']
                          and f.get('displayUnit') and ref['sourceId'] in f.get('contextVerifiedSourceIds', [])
                          and _context_match(f, source)
                          and any(a['recordId'] == f['recordId'] and field in a['fields'] for a in attributes)]
            signatures = {json.dumps({k: f.get(k) for k in ('displayUnit', 'displayScale')}, sort_keys=True)
                          for f in candidates}
            if len(signatures) == 1:
                formats[field] = candidates[0]

        # Units without an explicit conversion stay attached to the raw number.
        # A minute value is not rounded to a page's compact hour/day display here.
        for field, fact in formats.items():
            unit = fact['displayUnit']
            label = output.setdefault('fieldLabels', {}).get(field) or fact['concept']
            if unit not in label:
                output['fieldLabels'][field] = f'{label} ({unit})'
        if formats:
            output['snapshotDisplayDefinitions'] = [
                {'field': field, 'knowledgeBindingId': fact['knowledgeBindingId'],
                 'sourceId': ref['sourceId'], 'sourcePath': ref['fieldBinding'],
                 'displayUnit': fact['displayUnit'], **({'displayScale': fact['displayScale']} if fact.get('displayScale') else {})}
                for field, fact in formats.items()]

        # These are dates echoed by the response and matched to request hashes.
        # They do not prove a global interval or the user's requested period.
        dates = {}
        for fact in anchors:
            if not _context_match(fact, source):
                continue
            for parameter, declaration in fact.get('contextResponseBindings', {}).items():
                raw = pointer(source['data'], declaration['path'])
                value = date.fromisoformat(raw[:10]).isoformat()
                dates[(parameter, value)] = {'parameter': parameter, 'date': value,
                    'sourcePath': declaration['path'], 'valueHash': projection_hash(raw)}
        if dates and len({key for key, value in dates}) == len(dates):
            output['snapshotResponseDates'] = list(dates.values())
    return outputs


def apply_snapshot_formats(outputs):
    """Use only definitions compiled from the exact output source above."""
    import math
    from decimal import Decimal, ROUND_HALF_UP
    from .reader_snapshots import valid_display_scale
    for output in outputs:
        definitions = [f for f in output.get('snapshotDisplayDefinitions', [])
                       if valid_display_scale(f.get('displayScale'))]
        if not definitions:
            continue
        display = copy.deepcopy(output['value'])
        for definition in definitions:
            rule = definition['displayScale']
            field = definition['field']
            for row in display:
                value = row.get(field)
                if type(value) not in {int, float} or not math.isfinite(value):
                    continue
                factor = rule['atMostFactor'] if value <= rule['threshold'] else rule['otherwiseFactor']
                rounded = (Decimal(str(value)) * Decimal(str(factor))).quantize(
                    Decimal(1).scaleb(-rule['decimals']), rounding=ROUND_HALF_UP)
                text = format(rounded, 'f').rstrip('0').rstrip('.') if rule['decimals'] else str(rounded)
                row[field] = (text if text not in {'', '-0'} else '0') + definition['displayUnit']
        output['displayRows'] = display
