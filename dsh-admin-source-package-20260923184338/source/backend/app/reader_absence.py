"""Distinguish a page-defined recorded absence from missing or truncated data."""
from .reader_collection import projection_hash
from .reader_scalars import scalar_compare, valid_condition_value


def observed_absence(task, fact, source, fields, path):
    from .generic_reader import pointer, row_scalar, PipelineError
    rule = fact.get('absenceRule')
    proof = source.get('verifiedRecord') or {}
    if (not isinstance(rule, dict) or not task or task.outputShape != 'detail'
            or not task.recordIdentity or not proof.get('single')
            or proof.get('identity') != task.recordIdentity or proof.get('path') != path
            or fact.get('kind') != 'attribute' or fact.get('operationRef') != source.get('operationRef')
            or fact.get('sourcePath') != path):
        return None
    conditions, nulls, messages = rule.get('conditions'), rule.get('nullFields'), rule.get('message')
    if (not isinstance(conditions, list) or not 1 <= len(conditions) <= 5
            or not isinstance(nulls, list) or not 1 <= len(nulls) <= 10
            or not all(isinstance(f, str) and f in fields for f in nulls)
            or not isinstance(messages, dict) or not all(isinstance(messages.get(lang),str)
                and 1 <= len(messages[lang]) <= 500 for lang in ['en','ar'])
            or any(not isinstance(c,dict) or c.get('field') not in fields
                or not valid_condition_value(c.get('predicate','eq'),c.get('value')) for c in conditions)):
        return None
    try:
        row=pointer(source['data'],path)
        if not isinstance(row,dict):return None
        values={f:row_scalar(row,f) for f in {*nulls,*(c['field'] for c in conditions)}}
        for f,value in values.items():
            receipt=source.get('fieldEvidence',{}).get(path+'/'+'/'.join(f.split('.')), {})
            if receipt.get('status') not in {'complete','null'} or receipt.get('valueHash')!=projection_hash(value):return None
        if any(values[f] is not None for f in nulls):return None
        if not all(scalar_compare(values[c['field']],c.get('predicate','eq'),c.get('value')) for c in conditions):return None
    except (PipelineError,KeyError,TypeError,ValueError):return None
    return {'message':{lang:messages[lang] for lang in ['en','ar']},'fields':list(fields),
        'knowledgeBindingId':fact['knowledgeBindingId'],'recordId':fact['recordId'],
        'reason':'complete_record_fields_establish_documented_absence'}
