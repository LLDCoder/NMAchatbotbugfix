"""Finite public-clause grammar; source-bound slots, never replacement prose.

Only complete empty-pair or separately proved single-detail display gates may call this module. The original
public display proof remains unchanged. Unknown whole clauses stay literal.
Hashes detect transport changes, not semantic equivalence or authorization;
equivalence is checked by reparsing source clauses and regenerating this plan.
"""
from copy import deepcopy
import re

SCHEMA = 'previous-public-readable-clauses/1'
SOURCE_KEY = 'publicRewriteSource'
_NOUN = r'[a-z]+'
_TITLE = r'[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*){0,3}'
# A small grammatical vocabulary, not a list of business answers. Unsupported
# activity phrases remain verbatim; operators and extra clauses cannot be slots.
_ACTIVITY = r'(?:pending|external|internal) (?:modification|approval|review|verification|inspection|submission|renewal|processing)'


def source_context(result):
    return deepcopy({'sourceRequestId': result.get('requestId'),
                     'context': result.get('context'), 'requirements': result.get('requirements')})


def _bindings(projection, source):
    """Require agreement between original typed context and displayed labels."""
    if source.get('sourceRequestId') != projection['sourceRequestId']:
        return None
    context = source['context']
    flat = {}
    for key in ('scope', 'grain', 'population', 'filterScope', 'time', 'caveats'):
        if key not in context:
            continue
        value = context[key]
        flat[key] = ([v.get('value') if isinstance(v, dict) else v for v in value]
                     if isinstance(value, list) else value.get('value') if isinstance(value, dict) else value)
    if flat != projection['context']:
        return None
    requirements = source['requirements']
    if not isinstance(requirements, list) or len(requirements) != 5:
        return None
    by_kind = {r['kind']: r['value'] for r in requirements}
    if (set(by_kind) != {'object', 'grain', 'scope', 'detail', 'view'}
            or by_kind['scope'] != context['scope'] or context['scope'] != 'personal'
            or by_kind['detail'] != 'list' or by_kind['object'] != by_kind['grain']
            or not re.fullmatch(_NOUN, by_kind['object'])
            or len({r['id'] for r in requirements}) != 5):
        return None
    detail = next(o for o in projection['outputs'] if o['role'] == 'detail')
    observation = next(o for o in projection['outputs'] if o['role'] == 'observation')
    if set(detail['requirementIds']) != {r['id'] for r in requirements}:
        return None
    obj = by_kind['object']
    # Only regular plural labels are supported. The plural is retained from the
    # public label, not invented from a model-provided label or business lexicon.
    match = re.fullmatch(r'Distinct (' + re.escape(obj + 's') + r') in the (' + _TITLE + r') queue', detail['label'])
    if not match:
        return None
    plural, view = match.groups()
    if re.sub(r'\s', '', view).casefold() != by_kind['view'].casefold():
        return None
    q = re.fullmatch(r'(' + _TITLE + r') ' + re.escape(view) + r' queue rows', observation['label'])
    if not q:
        return None
    return {'object': obj, 'plural': plural, 'scope': context['scope'], 'view': view,
            'qualifier': q[1], 'queue': q[1] + ' ' + view + ' queue',
            'fieldLabels': list((detail.get('fieldLabels') or {}).values())}


def _claim(context, block):
    if block['kind'] == 'calculation_time':
        # Already reconstructed from the complete original derivation. It is
        # never rewritten or equated with the observation timestamp.
        return {'value': block['quote'], 'evidence': []}
    if block['kind'] == 'scope':
        return {'value': context['scope'], 'evidence': context.get('scopeEvidence')}
    if block['kind'] == 'caveat':
        return context['caveats'][block['contextIndex']]
    return context[block['kind']]


def _has_evidence(claim):
    refs = claim.get('evidence')
    return (isinstance(refs, list) and bool(refs)
            and all(isinstance(ref, dict) and isinstance(ref.get('sourceId'), str)
                    and bool(ref['sourceId']) for ref in refs))


def _parse(block, claim, b):
    """Full-string recognition; no tail or subordinate condition is discarded."""
    if not _has_evidence(claim) or not isinstance(claim.get('value'), str):
        return None
    text = claim['value']
    esc = re.escape
    if block['kind'] == 'grain':
        prefix = (r'One row (?:per|for each) ' + esc(b['object']) + ' in the '
                  + esc(b['scope'] + ' ' + b['queue']) + ', identified by the '
                  + esc(b['object']) + r' (entity|system) key; the displayed ')
        for field in b['fieldLabels']:
            if isinstance(field, str) and re.fullmatch(prefix + esc(field) + r' is the public row reference\.?', text):
                return {'rule': 'row_grain', 'parameters': {k: b[k] for k in ('object', 'scope', 'queue')} | {'field': field},
                        'atoms': ['one_entity_per_row', 'personal_named_queue', 'entity_key_identifies_entity', 'display_field_is_public_reference']}
    elif block['kind'] == 'population':
        prefix = ('Complete ' + esc(b['view']) + " pending-work queue of the authenticated user's "
                  + esc(b['qualifier'] + ' ' + b['object']) + ' tasks, including ')
        match = re.fullmatch(prefix + '(' + _ACTIVITY + ') and (' + _ACTIVITY + ') as well as (' + _ACTIVITY + r')\.?', text)
        if match:
            return {'rule': 'scoped_population', 'parameters': {k: b[k] for k in ('scope', 'queue', 'object', 'qualifier')},
                    'members': {'rule': 'inclusive_members', 'parameters': list(match.groups())},
                    'atoms': ['complete_named_pending_work_queue', 'authenticated_user_owner', 'qualified_object_tasks',
                              'open_inclusion_member_1', 'open_inclusion_member_2', 'open_inclusion_member_3']}
    elif block['kind'] == 'caveat':
        if re.fullmatch('The ' + esc(b['view']) + r' summary counters are a separate count source and do not prove list completeness\.?', text):
            return {'rule': 'separate_counter_not_completeness', 'parameters': {'view': b['view']},
                    'atoms': ['summary_separate_count_source', 'summary_cannot_prove_list_completeness']}
        match = re.fullmatch(r'A (' + _TITLE + ') role does not turn this ' + esc(b['scope']) + r' queue into a (team|global) queue\.?', text)
        if match:
            return {'rule': 'role_does_not_expand_scope', 'parameters': {'role': match[1], 'scope': b['scope'], 'targetScope': match[2]},
                    'atoms': ['conditional_role', 'personal_queue_scope_unchanged', 'not_target_scope_queue']}
    return None


def _structured_bindings(projection, source):
    """Bind typed owner/entity requirements, without interpreting display labels."""
    if source.get('sourceRequestId') != projection['sourceRequestId']:
        return None
    context, requirements = source['context'], source['requirements']
    flat = {k: ([v.get('value') if isinstance(v, dict) else v for v in value]
                if isinstance(value, list) else value.get('value') if isinstance(value, dict) else value)
            for k, value in context.items() if k in {'scope', 'grain', 'population', 'filterScope', 'time', 'caveats'}}
    if flat != projection['context'] or not isinstance(requirements, list) or len(requirements) != 5:
        return None
    kinds = {r['kind']: r['value'] for r in requirements}
    detail = next(o for o in projection['outputs'] if o['role'] == 'detail')
    if (set(kinds) != {'object', 'grain', 'scope', 'detail', 'view'} or kinds['scope'] != 'personal'
            or context['scope'] != 'personal' or kinds['detail'] != 'list'
            or kinds['object'] != kinds['grain'] or not re.fullmatch(_NOUN, kinds['object'])
            or len({r['id'] for r in requirements}) != 5
            or set(detail['requirementIds']) != {r['id'] for r in requirements}
            or not isinstance(kinds['view'], str) or not re.fullmatch(r'[A-Za-z ]{1,50}', kinds['view'])
            or not _has_evidence({'evidence': context.get('scopeEvidence')})):
        return None
    return {'object': kinds['object'], 'scope': 'personal', 'viewKey': re.sub(r'\s', '', kinds['view']).casefold(),
            'fieldLabels': list((detail.get('fieldLabels') or {}).values())}


def _structured_parse(block, claim, bindings):
    """Whole bounded propositions; capture every owner, operator and complement."""
    if not _has_evidence(claim) or not isinstance(claim.get('value'), str):
        return None
    value, obj = claim['value'], bindings['object']
    esc = re.escape
    if block['kind'] == 'grain':
        prefix = (r'One row (?:per|for each) ' + esc(obj) + r' in the (personal|authenticated user\'s) '
                  + '(' + _TITLE + r' queue), identified by the ' + esc(obj) + r' (entity|system) key; ')
        for field in bindings['fieldLabels']:
            if not isinstance(field, str): continue
            reference = r'(?:the displayed ' + esc(field) + r' is the public row reference|the public row reference is (?:the )?' + esc(field) + r')\.?'
            match = re.fullmatch(prefix + reference, value)
            if not match: continue
            queue = match[2]
            words = queue.removesuffix(' queue').split()
            if not any(''.join(words[i:]).casefold() == bindings['viewKey'] for i in range(len(words))):
                return None
            return {'rule': 'structured_row_grain',
                    'parameters': {'object': obj, 'queue': queue, 'keyKind': match[3], 'field': field},
                    'atoms': ['one_entity_per_row', 'authenticated_owner_queue', 'entity_key_identity', 'public_reference_field']}
    elif block['kind'] == 'population':
        match = re.fullmatch(r'Complete (' + _TITLE + r') pending-work queue from the personal ('
                             + _TITLE + r') operation, including (' + _ACTIVITY + r') and ('
                             + _ACTIVITY + r') as well as (' + _ACTIVITY + r')\.?', value)
        if match and re.sub(r'\s', '', match[1]).casefold() == bindings['viewKey']:
            return {'rule': 'named_operation_population',
                    'parameters': {'view': match[1], 'sourceName': match[2], 'sourceKind': 'operation'},
                    'members': {'rule': 'inclusive_members', 'parameters': list(match.groups()[2:])},
                    'atoms': ['complete_named_pending_work_queue', 'personal_source_operation', 'named_source_preserved',
                              'open_inclusion_member_1', 'open_inclusion_member_2', 'open_inclusion_member_3']}
    elif block['kind'] == 'caveat':
        match = re.fullmatch(r'The (' + _TITLE + r') summary counters are a separate count source and '
                             r'(?:do not prove list completeness|are not proof of the list\'s completeness)\.?', value)
        if match and re.sub(r'\s', '', match[1]).casefold() == bindings['viewKey']:
            return {'rule': 'separate_counter_not_completeness', 'parameters': {'view': match[1]},
                    'atoms': ['summary_separate_count_source', 'summary_cannot_prove_list_completeness']}
        match = re.fullmatch(r'The (' + _TITLE + r') summary card is a separate count source and '
                             r'does not prove list completeness\.?', value)
        if match and re.sub(r'\s', '', match[1]).casefold() == bindings['viewKey']:
            return {'rule': 'summary_card_not_completeness', 'parameters': {'view': match[1]},
                    'atoms': ['summary_card_separate_count_source', 'summary_card_cannot_prove_list_completeness']}
        match = re.fullmatch(r'This queue shows (work|tasks|records) routed to (?:your account|the authenticated account), '
                             r'not all \1 in the (' + _TITLE + r') department; a (' + _TITLE
                             + r') role does not turn it into a (team|global) queue\.?', value)
        if match:
            return {'rule': 'authenticated_queue_department_role_limit',
                    'parameters': {'records': match[1], 'department': match[2], 'role': match[3], 'targetScope': match[4]},
                    'atoms': ['routed_to_authenticated_account', 'not_all_department_records', 'conditional_role', 'not_target_scope']}
        # Two independent conjoined propositions. No partial match/sentence
        # splitting: an unknown condition or appended restriction stays literal.
        match = re.fullmatch(r'This queue shows (work|tasks|records) routed to your account, not all ('
                             + _TITLE + r') \1 in the department; a (' + _TITLE
                             + r') role does not turn it into a (team|global) queue\.?', value)
        if match:
            return {'rule': 'account_queue_and_role_limit',
                    'parameters': {'records': match[1], 'qualifier': match[2], 'role': match[3], 'targetScope': match[4]},
                    'atoms': ['routed_to_authenticated_account', 'not_all_department_records', 'conditional_role', 'not_target_scope']}
    return None


def compile_rewrite(projection, original_proof, source, *, structured=False):
    """Return a canonical typed plan. Nothing accepts a target text argument."""
    from .generic_reader import clean
    from .reader_previous_display import _hash
    try:
        if (not isinstance(source, dict) or set(source) != {'sourceRequestId', 'context', 'requirements'}
                or clean(source, max_items=1000) != source):
            return None
        b = _structured_bindings(projection, source) if structured else _bindings(projection, source)
        if not b:
            return None
        entries = []
        for index, block in enumerate(original_proof['publicBlocks']):
            claim = _claim(source['context'], block)
            parsed = _structured_parse(block, claim, b) if structured else _parse(block, claim, b)
            entry = {'blockIndex': index, 'sourceSpan': deepcopy(block['sourceSpan']),
                     'sourceClaim': deepcopy(claim), 'action': 'rewrite' if parsed else 'literal'}
            if parsed:
                entry.update(parsed)
            else:
                entry['reason'] = 'whole_clause_outside_supported_grammar'
                entry['atoms'] = ['entire_original_public_clause']
            entries.append(entry)
        rules = {entry.get('rule') for entry in entries}
        if not rules - {None}:
            return None
        headline = None
        if {'row_grain', 'scoped_population'} <= rules:
            headline = {k: b[k] for k in ('scope', 'queue', 'plural')}
            for entry in entries:
                if original_proof['publicBlocks'][entry['blockIndex']]['kind'] == 'scope':
                    entry.update(action='covered', coveredBy='headline', atoms=['personal_scope'])
                    entry.pop('reason', None)
            # The same queue/owner/object are proved in both original clauses.
            # Only those duplicate clauses may refer to the shared headline.
            for entry in entries:
                if entry.get('rule') in {'row_grain', 'scoped_population'}:
                    entry['scopeCoveredBy'] = 'headline'
        return {'schemaVersion': SCHEMA, 'originalDisplayProof': deepcopy(original_proof),
                'sourceBindingHash': _hash(source), 'rewritePlan': {'entries': entries, 'headline': headline,
                    'emptyOutputIds': deepcopy(original_proof['combinedEmptyOutputIds'])},
                'claim': 'finite_templates_reparsed_from_original_public_clauses'}
    except (KeyError, TypeError, ValueError, AttributeError, StopIteration):
        return None


def render_clauses(proof, language, literal):
    """Consume only a freshly checked canonical plan, never a stored draft."""
    ar = language == 'ar'
    plan = proof['rewritePlan']
    headline = plan['headline']
    result = None
    if headline:
        q, plural = literal(headline['queue']), literal(headline['plural'])
        result = (f'لم توجد سجلات مطابقة من {plural} في قائمتك الشخصية {q}.' if ar else
                  f'Your personal {q} had no matching {plural}.')
    paragraphs = []
    for entry in plan['entries']:
        if entry['action'] == 'covered':
            continue
        if entry['action'] == 'literal':
            paragraphs.append(literal(proof['originalDisplayProof']['publicBlocks'][entry['blockIndex']]['quote']))
            continue
        p = {k: literal(v) for k, v in entry['parameters'].items()}
        rule = entry['rule']
        if rule == 'named_operation_population':
            members = [literal(x) for x in entry['members']['parameters']]
            joined = ' و'.join(members) if ar else ', '.join(members[:-1]) + ' and ' + members[-1]
            value = (f'تأتي قائمة {p["view"]} الكاملة للأعمال المعلقة من عملية {p["sourceName"]} الشخصية. '
                     f'وهي تشمل {joined}.' if ar else
                     f'The personal {p["sourceName"]} operation supplies the complete {p["view"]} queue of pending work. '
                     f'It includes {joined}.')
        elif rule == 'authenticated_queue_department_role_limit':
            value = (f'تعرض هذه القائمة {p["records"]} الموجهة إلى حسابك. وهي لا تشمل كل {p["records"]} في قسم {p["department"]}. '
                     f'وجود دور {p["role"]} لا يحوّلها إلى قائمة بنطاق {p["targetScope"]}.' if ar else
                     f'This queue shows {p["records"]} routed to your account. It does not cover all {p["records"]} in the {p["department"]} department. '
                     f'A {p["role"]} role does not make it a {p["targetScope"]} queue.')
        elif rule == 'summary_card_not_completeness':
            value = (f'بطاقة ملخص {p["view"]} مصدر منفصل للعدد. وهي لا تثبت اكتمال القائمة.' if ar else
                     f'The {p["view"]} summary card is a separate count source. It does not prove that the list is complete.')
        elif rule == 'structured_row_grain':
            value = (f'يوجد صف واحد لكل {p["object"]} في قائمتك {p["queue"]}. '
                     f'يحدد مفتاح {p["keyKind"]} الـ {p["object"]}؛ أما {p["field"]} فهو المرجع المعروض.' if ar else
                     f'Each {p["object"]} has one row in your {p["queue"]}. '
                     f'The {p["keyKind"]} key identifies the {p["object"]}; {p["field"]} is the reference shown.')
        elif rule == 'account_queue_and_role_limit':
            value = (f'تُظهر هذه القائمة {p["records"]} الموجهة إلى حسابك، وليس كل {p["qualifier"]} {p["records"]} في القسم. '
                     f'وجود دور {p["role"]} لا يحوّلها إلى قائمة بنطاق {p["targetScope"]}.' if ar else
                     f'This queue shows {p["records"]} routed to your account. It does not cover all {p["qualifier"]} {p["records"]} in the department. '
                     f'A {p["role"]} role does not make it a {p["targetScope"]} queue.')
        elif rule == 'row_grain':
            scope = '' if headline else (f' في قائمتك الشخصية {p["queue"]}' if ar else f' in your personal {p["queue"]}')
            value = (f'تستخدم هذه القائمة صفًا واحدًا لكل {p["object"]}{scope}. يحدد مفتاح النظام الـ {p["object"]}؛ أما {p["field"]} فهو المرجع المعروض.' if ar else
                     f'This list uses one row per {p["object"]}{scope}. The system key identifies the {p["object"]}; {p["field"]} is the reference shown.')
        elif rule == 'scoped_population':
            members = [literal(x) for x in entry['members']['parameters']]
            joined = ' و'.join(members) if ar else ', '.join(members[:-1]) + ' and ' + members[-1]
            value = (('تم فحص جميع سجلات تلك القائمة. ' if headline else f'تم فحص جميع سجلات مهام {p["qualifier"]} {p["object"]} المعلقة في قائمتك الشخصية {p["queue"]}. ')
                     + f'وتشمل قائمة المهام المعلقة هذه {joined}.' if ar else
                     ('All records in that queue were checked. ' if headline else f'All pending {p["qualifier"]} {p["object"]} tasks in your personal {p["queue"]} were checked. ')
                     + f'This queue of pending tasks includes {joined}.')
        elif rule == 'separate_counter_not_completeness':
            value = (f'تأتي أعداد ملخص {p["view"]} من مصدر منفصل؛ ولا تثبت اكتمال القائمة.' if ar else
                     f'The {p["view"]} summary counts come from a separate source; they do not prove the list is complete.')
        else:
            value = (f'وجود دور {p["role"]} لا يحوّل هذه القائمة الشخصية إلى قائمة بنطاق {p["targetScope"]}.' if ar else
                     f'A {p["role"]} role does not make this personal queue a {p["targetScope"]} queue.')
        paragraphs.append(value)
    return result, paragraphs
