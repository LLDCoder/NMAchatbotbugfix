"""Surface a proven record subtype conflict without changing the user's task."""
import re
from urllib.parse import urlsplit
from .reader_requirements import semantic_bindings, _context_match
from .reader_collection import projection_hash
from .reader_scalars import scalar_equal
from .reader_text import words


def record_type_conflict(task, sources, knowledge):
    from .generic_reader import pointer, row_scalar, PipelineError
    if not task.recordIdentity or task.outputShape != 'detail':
        return None
    facts = [f for f in semantic_bindings(knowledge) if f['kind'] == 'object']
    records = {i['record']['id']:i['record'] for i in knowledge.items.values()
        if isinstance(i.get('record'),dict)}
    findings=[]
    for sid,source in sources.items():
        proof=source.get('verifiedRecord') or {}
        if (not source.get('principalScopeRef') or not proof.get('single')
                or proof.get('identity') != task.recordIdentity):
            continue
        available=[f for f in facts if f['operationRef']==source.get('operationRef')
            and f['sourcePath']==proof.get('path')
            and urlsplit(source.get('page', '')).path in records.get(f['recordId'],{}).get('applicability',{}).get('pageRefs',[])
            and ('contextParameters' not in f or _context_match(f,source))]
        requested=[f for f in available if words(task.businessObject) in
            [words(f['concept']),*(words(a) for a in f.get('aliases',[]))]]
        for expected in requested:
            condition=expected.get('conditions',[])
            # Only disjoint equality types on the same discriminator establish
            # a conflict; range predicates and missing fields are not guesses.
            if len(condition)!=1 or condition[0].get('predicate','eq')!='eq':continue
            field=condition[0]['field'];path=expected['sourcePath']
            try:
                row=pointer(source['data'],path)
                if not isinstance(row,dict):continue
                value=row_scalar(row,field)
            except (PipelineError,KeyError,TypeError):continue
            receipt=source.get('fieldEvidence',{}).get(path+'/'+field.replace('.','/'),{})
            if (value is None or receipt.get('status')!='complete'
                    or receipt.get('valueHash')!=projection_hash(value)
                    or scalar_equal(value,condition[0].get('value'))):continue
            alternatives=[f for f in available if f['recordId']==expected['recordId']
                and len(f.get('conditions',[]))==1
                and f['conditions'][0].get('predicate','eq')=='eq'
                and f['conditions'][0]['field']==field
                and scalar_equal(value,f['conditions'][0].get('value'))]
            if len(alternatives)!=1:continue
            actual=alternatives[0]
            def label(f,lang):
                aliases=f.get('aliases',[])
                choices=[a for a in aliases if re.search(r'[\u0600-\u06ff]',a)] if lang=='ar' else []
                return (choices[0] if choices else f['concept'])[:100]
            findings.append({'recordIdentity':task.recordIdentity,
                'expected':{lang:label(expected,lang) for lang in ['en','ar']},
                'actual':{lang:label(actual,lang) for lang in ['en','ar']},
                'sourceId':sid,'expectedBindingId':expected['knowledgeBindingId'],
                'actualBindingId':actual['knowledgeBindingId'],'fieldHash':receipt['valueHash']})
    if not findings:return None
    meanings={(f['expected']['en'],f['actual']['en']) for f in findings}
    return findings[0] if len(meanings)==1 else None


def public_type_conflict(conflict,language):
    from .generic_reader import safe_text
    lang='ar' if language=='ar' else 'en'
    record=safe_text(conflict['recordIdentity']);actual=safe_text(conflict['actual'][lang]);expected=safe_text(conflict['expected'][lang])
    if lang=='ar':
        return f'السجل {record} مصنّف في الصفحة الحالية بأنه «{actual}»، بينما وصفه طلبك بأنه «{expected}». هل تريد المتابعة مع النوع المسجّل، أم تقصد سجلاً آخر؟ لم تُنفّذ أي تغييرات.'
    return f'The current page classifies record {record} as “{actual}”; your request calls it “{expected}”. Should I continue with the recorded type, or did you mean another record? No changes were made.'


def type_conflict_clarification(task, conflict, language):
    from .generic_reader_contracts import ClarificationRequest
    actual=conflict['actual']['en'];lang='ar' if language=='ar' else 'en'
    updates=[{'field':'businessObject','value':actual,'source':'current','evidence':'User confirmation of the verified record type'}]
    if words(task.requestedGrain)==words(task.businessObject):
        updates.append({'field':'requestedGrain','value':actual,'source':'current','evidence':'User confirmation of the same record type'})
    request=ClarificationRequest.model_validate({'question':public_type_conflict(conflict,language),
        'missingSlots':['businessObject'], 'options':[
            {'id':'recorded_type','label':('المتابعة مع النوع المسجّل' if lang=='ar' else 'Continue with the recorded type'),'updates':updates},
            {'id':'another_record','label':('تحديد سجل آخر' if lang=='ar' else 'Specify another record'),
             'updates':[{'field':'recordIdentity','value':'','source':'clear','evidence':'User selected another record'}]}]})
    return task.model_copy(update={'clarification':request,'contextRelation':'clarify',
        'unresolvedSlots':list(dict.fromkeys([*task.unresolvedSlots,'businessObject']))})
