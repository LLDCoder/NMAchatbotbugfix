"""Question-owned ranking requirements; page knowledge owns fields and meanings."""


def ordering_proven(task, requirement, fact, nodes, final, complete, evidence):
    """Stable sort composition must retain the requested precedence on this output.

    Each definition also passes ordinary source, field and citation validation.
    A prefix sample cannot establish a global ordering, even if it is sorted.
    """
    value_field = fact.get('valueField') or (fact['fields'][0] if len(fact.get('fields', [])) == 1 else '')
    if not complete or final.role != 'detail' or not value_field:
        return False
    try:
        index = int(requirement['id'].split('_')[-1])
    except (ValueError, KeyError):
        return False
    by_id = {s.id: s for s in nodes}
    current = final
    sorts = []
    seen = set()
    while current.id not in seen:
        seen.add(current.id)
        if current.op == 'sort':
            if current.limit is not None:
                return False  # Bounded selection requires a separate top-N proof.
            sorts.append(current)
        elif current.op not in {'read_rows', 'project', 'filter', 'filter_time', 'filter_membership', 'distinct'}:
            return False
        if not current.inputs:
            break
        if len(current.inputs) != 1 or current.inputs[0] not in by_id:
            return False
        current = by_id[current.inputs[0]]
    if len(sorts) != len(task.requestedOrdering) or index >= len(sorts):
        return False
    sort = sorts[index]
    receipts = [r for ref in evidence for r in ref.get('ordering', []) if r.get('stepId') == sort.id]
    return (sort.field == value_field
            and sort.descending is (fact['direction'] == 'descending') and bool(receipts)
            and all(r.get('field') == sort.field and r.get('descending') is sort.descending
                    and r.get('valueType') in {fact['valueType'], 'empty'}
                    and r.get('fullInput') is True and r.get('limit') is None for r in receipts))


def sort_rows(rows, step, evidence):
    """Keep a runtime-owned type and population receipt for the actual sort."""
    import math
    from .generic_reader import PipelineError
    try:
        values = [row[step.field] for row in rows]
        if not values:
            kind = 'empty'
        elif all(type(v) in {int, float} and math.isfinite(v) for v in values):
            kind = 'number'
        elif all(type(v) is str for v in values):
            kind = 'string'
        elif all(type(v) is bool for v in values):
            kind = 'boolean'
        else:
            raise ValueError('Null, mixed or non-finite ranking values.')
        result = sorted(rows, key=lambda row: row[step.field], reverse=step.descending)[:step.limit]
    except (KeyError, TypeError, ValueError):
        raise PipelineError('sort_field_invalid', 'source_data') from None
    proof = {'stepId': step.id, 'field': step.field, 'descending': step.descending,
             'valueType': kind, 'inputRows': len(rows), 'outputRows': len(result), 'limit': step.limit,
             'fullInput': bool(evidence) and all(ref.get('completeness') == 'complete' for ref in evidence)}
    return result, [{**ref, 'ordering': [*ref.get('ordering', []), proof],
        'completeness': 'bounded' if len(result) < len(rows) else ref.get('completeness')}
        for ref in evidence]
