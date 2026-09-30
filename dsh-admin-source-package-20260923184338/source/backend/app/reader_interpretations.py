"""Evaluate page-owned conditional descriptions against one verified record.

Definitions contain scalar predicates and localized text, never executable code.
Every physical dependency must be explicitly tested and carry a complete receipt.
"""
from .reader_collection import projection_hash
from .reader_scalars import scalar_compare, valid_condition_value


def observed_interpretation(task, fact, source, fields, path):
    from .generic_reader import pointer, row_scalar, PipelineError
    proof = source.get('verifiedRecord') or {}
    rules = fact.get('interpretationRules', [])
    if (not task or task.outputShape != 'detail' or not task.recordIdentity
            or not proof.get('single') or proof.get('identity') != task.recordIdentity
            or proof.get('path') != path or fact.get('kind') != 'attribute'
            or fact.get('operationRef') != source.get('operationRef')
            or fact.get('sourcePath') != path or not fields
            or not isinstance(rules, list) or not 1 <= len(rules) <= 8):
        return None
    matches = []
    for rule in rules:
        if not isinstance(rule, dict) or set(rule) - {'conditions', 'message', 'hideFields'}:
            return None
        conditions, messages, hidden = rule.get('conditions'), rule.get('message'), rule.get('hideFields', [])
        if (not isinstance(conditions, list) or not 1 <= len(conditions) <= 20
                or not isinstance(messages, dict) or not all(isinstance(messages.get(lang), str)
                    and 1 <= len(messages[lang]) <= 500 for lang in ['en', 'ar'])
                or not isinstance(hidden, list) or any(f not in fields for f in hidden)
                or any(not isinstance(c, dict) or set(c) - {'field', 'predicate', 'value'}
                    or c.get('field') not in fields
                    or not valid_condition_value(c.get('predicate', 'eq'), c.get('value')) for c in conditions)
                or {c['field'] for c in conditions} != set(fields)):
            return None
        try:
            row = pointer(source['data'], path)
            if not isinstance(row, dict): return None
            values = {f: row_scalar(row, f) for f in fields}
            for field, value in values.items():
                receipt = source.get('fieldEvidence', {}).get(path + '/' + '/'.join(field.split('.')), {})
                if (receipt.get('status') not in {'complete', 'null'}
                        or receipt.get('valueHash') != projection_hash(value)):
                    return None
            if all(scalar_compare(values[c['field']], c.get('predicate', 'eq'), c.get('value'))
                   for c in conditions):
                matches.append({'message': {lang: messages[lang] for lang in ['en', 'ar']},
                    'fields': list(fields), 'hideFields': list(hidden),
                    'knowledgeBindingId': fact['knowledgeBindingId'], 'recordId': fact['recordId'],
                    'definitionHash': projection_hash(rule), 'inputHash': projection_hash(values),
                    'reason': 'complete_record_fields_match_documented_interpretation'})
        except (PipelineError, KeyError, TypeError, ValueError):
            return None
    # Overlapping definitions cannot be resolved by retrieval order.
    return matches[0] if len(matches) == 1 else None
