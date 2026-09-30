"""Keep live facts, this read's provenance and cited guidance independently verified."""
import copy
import re
from datetime import datetime
from .reader_requirements import requirements_for
from .reader_text import normalized_text, words


def _guidance_label(value):
    """Recognize explicit explanatory grammar, never a business value by keyword."""
    label = ' '.join(normalized_text(value).split())
    return bool(re.match(
        r'^(?:how to|(?:(?:the|a|an) )?(?:documented )?'
        r'(?:(?:guidance|instructions) on how to|(?:procedure|instructions|steps) (?:to|for)|'
        r'meaning of|definition of)) \S', label))


def validate_declarations(task, question, canonical=''):
    from .generic_reader import PipelineError
    declarations = task.evidenceExplanations
    names = task.requestedAttributes
    if not declarations:
        return
    assigned = [d.attribute for d in declarations]
    def invalid(code, declaration=None):
        return PipelineError(code, 'planning', {'retainedAttributes': names,
            'allowedLiveAnchorAttributes': [name for name in names if name not in assigned],
            'declaration': declaration.model_dump() if declaration else None,
            'correction': 'Preserve every original requested attribute and its meaning. Each explanation must name '
                'one distinct exact requestedAttributes entry; do not annotate the live fact itself as its source/time. '
                'For source or observation_time explicitly set aboutAttribute to the exact retained live fact '
                'whose current read is being explained. A guidance label must explicitly mean a how-to, '
                'procedure, steps, meaning or definition. Keep a literal original/canonical questionQuote. '
                'If a responsibility is uncertain, leave that declaration unassigned without removing its attribute.'})
    if len(set(names)) != len(names) or len(set(assigned)) != len(assigned) or not set(assigned) <= set(names):
        raise invalid('evidence_explanation_assignment_invalid')
    originals = [normalized_text(q) for q in (question, canonical) if q]
    historical = words(canonical or question) & {'historical', 'previous', 'yesterday', 'earlier'}
    for declaration in declarations:
        if not any(normalized_text(declaration.questionQuote) in q for q in originals):
            raise invalid('evidence_explanation_quote_invalid', declaration)
        if declaration.kind == 'knowledge_guidance':
            # Only explicit explanatory grammar; a bare requested field value
            # cannot be delegated to a static manual by a model annotation.
            if not _guidance_label(declaration.attribute):
                raise invalid('evidence_guidance_meaning_unverified', declaration)
            continue  # Cited draft/review must independently establish the guidance.
        if (declaration.aboutAttribute not in names or declaration.aboutAttribute in assigned
                or historical):
            raise invalid('evidence_explanation_anchor_invalid', declaration)
        # Closed runtime metadata grammar is not a business-field synonym list.
        # A model annotation cannot turn funds, lastUpdated, historical data or
        # another record into a receipt from the present read.
        allowed = {'of', 'the', 'this', 'current', 'read', 'reading', 'query', 'answer', 'observation',
                   'data', 'used', 'by', 'your', 'source', 'time', 'when', 'was', 'observed'} | words(declaration.aboutAttribute)
        label = words(declaration.attribute)
        marker = 'source' if declaration.kind == 'source' else 'time'
        if (marker not in label or not label <= allowed
                or not words(declaration.questionQuote) & {'answer', 'observation', 'observed', 'query', 'read', 'reading',
                    'اجابتك', 'جوابك', 'الاجابة', 'الجواب', 'ملاحظة', 'الملاحظة', 'رصد',
                    'قراءة', 'القراءة', 'استعلام', 'الاستعلام'}
                or words(declaration.questionQuote) & {'other', 'another', 'historical', 'previous', 'earlier', 'yesterday',
                    'اخر', 'الاخر', 'اخرى', 'الاخرى', 'سابق', 'السابق', 'سابقة', 'السابقة', 'سابقا',
                    'تاريخي', 'التاريخي', 'تاريخية', 'التاريخية', 'قديم', 'القديم', 'قديمة', 'القديمة', 'امس'}):
            raise invalid('evidence_explanation_meaning_unverified', declaration)


def preserve_refinement_declarations(task, draft):
    """Apply the existing refine_task ownership rule before validating annotations.

    Knowledge adds no user input. The reviewed draft owns evidence responsibilities;
    a new annotation from retrieved content was already discarded by refine_task.
    No requested attribute or permission/evidence check is removed here.
    """
    if task.evidenceExplanations == draft.evidenceExplanations:
        return task, False
    return task.model_copy(deep=True, update={
        'evidenceExplanations': copy.deepcopy(draft.evidenceExplanations)}), True


def _project(task, attributes):
    return task.model_copy(deep=True, update={'requestedAttributes': list(attributes), 'evidenceExplanations': [],
        'slotUpdates': [s.model_copy(update={'value': list(attributes)}) if s.field == 'requestedAttributes'
                        else s.model_copy(deep=True) for s in task.slotUpdates]})


def _mapping(projected, original):
    result = {}
    for requirement in requirements_for(projected):
        meaning = {k: v for k, v in requirement.items() if k != 'id'}
        matches = [r['id'] for r in requirements_for(original)
                   if {k: v for k, v in r.items() if k != 'id'} == meaning]
        if len(matches) != 1:
            return None
        result[requirement['id']] = matches[0]
    return result


def partition(task, question, canonical=''):
    validate_declarations(task, question, canonical)
    if (not task.evidenceExplanations or not task.needsLiveData or not task.readOnly
            or task.outputShape != 'detail' or not task.recordIdentity or task.responseMode != 'answer'):
        return None
    declarations = {d.attribute: d for d in task.evidenceExplanations}
    live = _project(task, [a for a in task.requestedAttributes if a not in declarations])
    if not live.requestedAttributes:
        return None
    knowledge = _project(task, [a for a in task.requestedAttributes
        if a not in declarations or declarations[a].kind == 'knowledge_guidance'])
    live_map, knowledge_map = _mapping(live, task), _mapping(knowledge, task)
    if live_map is None or knowledge_map is None:
        return None
    by_attribute = {r['value']: r['id'] for r in requirements_for(task) if r['kind'] == 'attribute'}
    assigned = [{**d.model_dump(), 'requirementId': by_attribute[d.attribute],
                 'aboutRequirementId': by_attribute.get(d.aboutAttribute)} for d in declarations.values()]
    return {'originalTask': task, 'liveTask': live, 'knowledgeTask': knowledge,
            'liveMap': live_map, 'knowledgeMap': knowledge_map, 'assigned': assigned}


def assignment_receipt(assignment):
    return {'originalTask': assignment['originalTask'].model_dump(),
        'assignedLiveTask': assignment['liveTask'].model_dump(),
        'originalRequirements': requirements_for(assignment['originalTask']),
        'liveRequirementIdMap': assignment['liveMap'], 'delegatedRequirements': assignment['assigned'],
        'delegationEstablishesFacts': False}


def split_knowledge_coverage(assignment, coverage):
    original = [{**c, 'requirementId': assignment['knowledgeMap'][c['requirementId']]} for c in coverage]
    inverse = {v: k for k, v in assignment['liveMap'].items()}
    live = [{**c, 'requirementId': inverse[c['requirementId']]} for c in original if c['requirementId'] in inverse]
    return original, live


def provenance_output(assignment, declaration, analysis, sources, principal_ref, page_catalog, language):
    """Bind metadata to the actual successful field output and current read receipt."""
    original_id = declaration['aboutRequirementId']
    live_ids = [key for key, value in assignment['liveMap'].items() if value == original_id]
    checks = [c for c in analysis.get('requirementCoverage', []) if c['id'] in live_ids and c['status'] == 'satisfied']
    if len(checks) != 1 or not checks[0].get('fields'):
        return None
    check = checks[0]
    outputs = [o for o in analysis.get('outputs', []) if o['id'] in check.get('outputIds', [])]
    if not outputs:
        return None
    contexts = [c for c in analysis.get('requirementCoverage', []) if c['kind'] in
                {'object', 'scope', 'population', 'record', 'filter', 'view'}]
    if any(c['status'] != 'satisfied' or not {o['id'] for o in outputs} <= set(c.get('outputIds', [])) for c in contexts):
        return None
    refs, rows = [], []
    for output in outputs:
        relevant = [ref for ref in output.get('evidence', []) if ref.get('sourceId') == check.get('sourceId')
                    and ref.get('fieldBinding') == check.get('sourcePath')]
        if not relevant or output.get('unknownCount'):
            return None
        for ref in relevant:
            source = sources.get(ref['sourceId'], {})
            record = source.get('verifiedRecord') or {}
            if (not record.get('single') or record.get('identity') != assignment['originalTask'].recordIdentity
                    or record.get('path') != check['sourcePath'] or source.get('ready') is False
                    or ref.get('completeness') != 'complete' or ref.get('principalScopeRef') != principal_ref
                    or any(not ref.get(k) or ref[k] != source.get(k)
                           for k in ('capturedAt', 'observationRef', 'principalScopeRef', 'page', 'operationRef'))
                    or any(ref.get('fieldStatus', {}).get(field) != 'complete' for field in check['fields'])):
                return None
            try:
                observed = datetime.fromisoformat(ref['capturedAt'].replace('Z', '+00:00'))
                if observed.tzinfo is None: return None
            except (ValueError, TypeError):
                return None
            from urllib.parse import urlsplit
            route = urlsplit(source['page']).path
            names = {p['name'] for p in page_catalog if route in p.get('routes', []) and p.get('name')}
            if len(names) != 1:
                return None
            label = ('صفحة المصدر' if language == 'ar' else 'Source page') if declaration['kind'] == 'source' else (
                'وقت الملاحظة' if language == 'ar' else 'Observed at')
            value = next(iter(names)) if declaration['kind'] == 'source' else ref['capturedAt']
            row = {label: value}
            if row not in rows: rows.append(row)
            if ref not in refs: refs.append(copy.deepcopy(ref))
    return {'id': 'evidence_' + declaration['requirementId'], 'label':
        ('دليل القراءة الحالية' if language == 'ar' else 'Evidence from this read'),
        'role': 'observation', 'value': rows, 'fieldLabels': {}, 'unknownCount': 0, 'evidence': refs,
        'runtimeEvidenceExplanation': True, 'anchorOutputIds': [o['id'] for o in outputs]}


def merge_results(assignment, analysis, sources, principal_ref, page_catalog, language, guidance):
    result = copy.deepcopy(analysis)
    original = {r['id']: r for r in requirements_for(assignment['originalTask'])}
    mapped = {assignment['liveMap'][c['id']]: {**c, 'id': assignment['liveMap'][c['id']]}
              for c in analysis.get('requirementCoverage', [])}
    for declaration in assignment['assigned']:
        rid = declaration['requirementId']
        check = {**original[rid], 'status': 'unfulfilled', 'outputIds': [], 'stepIds': [],
                 'reason': 'runtime_evidence_unverified' if declaration['kind'] != 'knowledge_guidance' else 'knowledge_guidance_unverified'}
        if declaration['kind'] != 'knowledge_guidance':
            output = provenance_output(assignment, declaration, analysis, sources, principal_ref, page_catalog, language)
            if output:
                result['outputs'].append(output)
                for context in mapped.values():
                    if (context['kind'] in {'object', 'scope', 'population', 'record', 'filter', 'view'}
                            and context['status'] == 'satisfied'
                            and set(output['anchorOutputIds']) <= set(context.get('outputIds', []))):
                        context['outputIds'] = [*context['outputIds'], output['id']]
                check.update(status='satisfied', reason='verified_current_field_output_lineage', outputIds=[output['id']],
                             evidence=output['evidence'])
        else:
            verified = next((c for c in guidance.get('coverage', []) if c['requirementId'] == rid), {})
            blocks = [b for b in guidance.get('blocks', []) if rid in b['requirementIds']]
            if verified.get('status') == 'covered' and blocks:
                check.update(status='satisfied', reason='cited_guidance_answer_independently_reviewed',
                             answerBlockIds=[b['id'] for b in blocks], quoteIndexes=verified['quoteIndexes'])
        mapped[rid] = check
    result['requirements'] = list(original.values())
    result['requirementCoverage'] = [mapped.get(rid, {**r, 'status': 'unfulfilled', 'outputIds': [], 'stepIds': [],
                                                    'reason': 'requirement_not_evaluated'}) for rid, r in original.items()]
    result['evidenceGuidance'] = guidance
    result['requirementsSatisfied'] = all(c['status'] == 'satisfied' for c in result['requirementCoverage'])
    result['missing'].extend(c['id'] for c in result['requirementCoverage'] if c['status'] != 'satisfied' and c['id'] not in result['missing'])
    return result


async def compose_guidance(reader, assignment, original_coverage, catalog, permission, *, principal_ref):
    """Reuse the ordinary quoted-answer contracts and independent final review."""
    import json
    from .reader_answers import (KnowledgeAnswerDraft, KnowledgeAnswerReview, ANSWER_DRAFT_PROMPT,
        ANSWER_REVIEW_PROMPT, validate_answer_draft, validate_answer_review, complete_coverage_quotes,
        standalone_answer_routes, answer_review_input, verified_answer_blocks, unanswered_covered_requirements)
    wanted = {d['requirementId'] for d in assignment['assigned'] if d['kind'] == 'knowledge_guidance'}
    requirements = [r for r in requirements_for(assignment['originalTask']) if r['id'] in wanted]
    coverage = [c for c in original_coverage if c['requirementId'] in wanted]
    if not wanted:
        return {'blocks': [], 'quotes': [], 'coverage': []}
    quotes = complete_coverage_quotes([], coverage, reader.knowledge)
    if not quotes:
        return {'blocks': [], 'quotes': [], 'coverage': coverage}
    # Match the ordinary knowledge-answer citation contract: session evidence
    # proves current page visibility only, never business meaning or authority.
    # The no-knowledge return above must precede this program-owned receipt.
    from .generic_reader import clean
    session_evidence = clean({
        'assignedRoles': list(permission.roles),
        'permittedPages': [{'name': p['name'], 'routes': p['routes']} for p in catalog],
        'boundary': 'Assigned roles and page access only; no record values or action authority.'}, reader.secrets)
    quotes.append({'source': 'Authenticated session and authorized page catalog',
        'sourceId': 'session_' + principal_ref,
        'text': json.dumps(session_evidence, ensure_ascii=False)})
    data = {'question': reader.current_question, 'task': assignment['originalTask'].model_dump(),
        'requirements': requirements, 'knowledgeCoverage': coverage,
        'finalQuotes': [{'quoteIndex': i, **q} for i, q in enumerate(quotes)],
        'verifiedSession': {'roles': list(permission.roles),
            'pages': [{'name': p['name'], 'routes': p['routes'], 'module': p['module']} for p in catalog]},
        'allowedRoutes': standalone_answer_routes(catalog, reader.knowledge),
        'evidenceExplanationTaskAssignment': assignment_receipt(assignment)}
    prompt = (' Answer ONLY the supplied guidance requirements. The original mixed question is retained; '
              'its live facts and current-read source/time are handled by independent runtime evidence. '
              'Do not add those delegated requirements to this answer branch or claim unverified record '
              'facts, disputed values, actions or changes. Missing competing user observations remain unknown.')
    previous = reader.knowledge_requirement_coverage
    reader.knowledge_requirement_coverage = coverage
    try:
        for attempt in range(2):
            draft = await reader.structured(KnowledgeAnswerDraft, ANSWER_DRAFT_PROMPT + prompt, data,
                lambda p: validate_answer_draft(p, assignment['originalTask'], quotes, data['allowedRoutes'], requirements=requirements))
            review = await reader.structured(KnowledgeAnswerReview, ANSWER_REVIEW_PROMPT + prompt,
                answer_review_input(data, draft, coverage),
                lambda p: validate_answer_review(p, assignment['originalTask'], quotes, coverage, draft.blocks, requirements=requirements))
            reader.audit.setdefault('evidenceGuidanceReviews', []).append({'attempt': attempt + 1,
                'draft': draft.model_dump(), 'review': review.model_dump()})
            rejected = [c.model_dump() for c in review.blockChecks if not (c.supported and c.languageMatches and c.customerFacing)]
            unanswered = unanswered_covered_requirements(review, coverage)
            if (not rejected and not unanswered) or attempt:
                blocks = [b.model_dump() for b in verified_answer_blocks(draft, review)]
                return {'blocks': blocks, 'quotes': quotes, 'coverage': [c.model_dump() for c in review.checks]}
            data['previousDraft'] = draft.model_dump()
            data['correction'] = {'unsupportedBlocks': rejected, 'unansweredRequirementsWithAvailableKnowledge': unanswered}
    finally:
        reader.knowledge_requirement_coverage = previous


def stage_responsibilities(assignment, task, requirements, expansion=None):
    """Bind stage-local IDs to the original request by exact requirement meaning.

    No delegated clause is marked covered. Its original ID remains in the final
    merge, where current-field provenance and cited guidance are verified.
    """
    from .generic_reader import PipelineError
    mapping = _mapping(task, assignment['originalTask'])
    if mapping is None:
        raise PipelineError('evidence_stage_requirement_changed', 'planning')
    available = {r['id']: r for r in requirements_for(task)}
    active = requirements if requirements is not None else list(available.values())
    if (len({r['id'] for r in active}) != len(active) or
            any(available.get(r['id']) != r for r in active)):
        raise PipelineError('evidence_stage_requirement_changed', 'planning')
    original_ids = {mapping[r['id']] for r in active}
    receipt = {
        'stageRequirements': copy.deepcopy(active),
        'stageRequirementIdMap': {r['id']: mapping[r['id']] for r in active},
        'deferredOriginalRequirements': [r for r in requirements_for(assignment['originalTask'])
                                          if r['id'] not in original_ids],
        'delegationEstablishesFacts': False,
        'finalMergeRequiresEveryOriginalRequirement': True,
    }
    projected = None
    if expansion is not None:
        from .reader_session_scope import profile_expansion
        projected = profile_expansion(expansion, assignment['originalTask'], task)
        projected = projected.model_copy(deep=True, update={
            'terms': [t.model_copy(deep=True) for t in projected.terms if t.requirementId in {r['id'] for r in active}]})
    return receipt, projected
