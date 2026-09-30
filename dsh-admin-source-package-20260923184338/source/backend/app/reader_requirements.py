from .reader_scalars import valid_condition_value
"""Question-derived requirements and structural acceptance of computation proofs.

Knowledge defines field meaning; these checks verify its exact extract and the
actual data/operation/output chain. No route, business status or card labels.
"""
import re
from types import SimpleNamespace
from urllib.parse import urlsplit
from .reader_collection import projection_hash
from .reader_scalars import scalar_equal
from .reader_text import words


def requirements_for(task):
    items = []
    def add(key, kind, value):
        items.append({'id': key, 'kind': kind, 'value': value})
    add('object', 'object', task.businessObject)
    add('grain', 'grain', task.requestedGrain if task.requestedGrain not in {'', 'unknown'} else task.businessObject)
    if task.requestedScope != 'unknown':
        add('scope', 'scope', task.requestedScope)
    if task.businessFocus:
        add('population', 'population', task.businessFocus)
    if task.timeRange not in {'', 'unknown'}:
        add('time', 'time', task.timeRange)
        items[-1]['fieldConcept'] = task.timeField
    for kind, values in [('filter', task.filters), ('measure', task.requestedMeasures), ('attribute', task.requestedAttributes), ('ordering', getattr(task, 'requestedOrdering', [])), ('group', task.groupBy)]:
        for index, value in enumerate(values):
            add(f'{kind}_{index}', kind, value)
    if task.outputShape in {'list', 'detail'}:
        add('detail', 'detail', task.outputShape)
    if task.recordIdentity:
        add('record', 'record', task.recordIdentity)
    if task.view:
        add('view', 'view', task.view)
    for index, value in enumerate(task.unresolvedSlots):
        add(f'unresolved_{index}', 'unresolved', value)
    return items


def _words(text):
    # Lexical anchoring is deliberately conservative. Unstated aliases require
    # explicit page definitions, not fuzzy matches or an arbitrary citation.
    return words(text)


def builtin_measure(task, semantic):
    if semantic in {'count', 'sum'}:
        return semantic
    # Factor ONLY words already retained in independently checked requirements.
    # A distinct conditional measure cannot be reduced to the common population.
    if len(task.requestedMeasures) != 1:
        return None
    words = _words(semantic)
    anchors = _words(' '.join([task.businessObject, task.businessFocus,
                              task.requestedGrain if task.requestedGrain != 'unknown' else '']))
    if words & {'count', 'number'} and words <= anchors | {'count', 'number', 'of', 'total'}:
        return 'count'
    return None


def semantic_bindings(knowledge):
    """Only active, structured PAGE facts establish field semantics.

    Free-text documents can suggest routes and field candidates. A matching
    word in an arbitrary quote (possibly even a negated claim) is not proof.
    Conflicting IDs are excluded, never resolved using retrieval order.
    """
    found, conflicts = {}, set()
    for item in knowledge.items.values():
        record = item.get('record') or {}
        if record.get('kind') != 'field_semantics' or record.get('status') != 'active':
            continue
        payload = record.get('payload') or {}
        facts = payload.get('bindings', []) if isinstance(payload, dict) else []
        for fact in facts if isinstance(facts, list) else []:
            if not isinstance(fact, dict) or not isinstance(fact.get('id'), str):
                continue
            if (fact.get('kind') not in {'object', 'grain', 'scope', 'population', 'group', 'filter', 'time', 'attribute', 'measure', 'ordering'}
                    or not isinstance(fact.get('concept'), str) or not fact['concept'].strip()
                    or not isinstance(fact.get('operationRef'), str)
                    or not isinstance(fact.get('sourcePath'), str) or not fact['sourcePath'].startswith('/')
                    or not isinstance(fact.get('fields'), list) or len(fact['fields']) > 20
                    or any(not isinstance(f, str) for f in fact['fields'])
                    or not isinstance(fact.get('aliases', []), list)
                    or any(not isinstance(a, str) for a in fact.get('aliases', []))):
                continue
            if fact['kind'] == 'ordering' and ((fact.get('valueField') not in fact['fields']
                    if 'valueField' in fact else len(fact['fields']) != 1)
                    or fact.get('direction') not in {'ascending', 'descending'}
                    or fact.get('valueType') not in {'number', 'string', 'boolean'}):
                continue
            conditions = fact.get('conditions', [])
            from .reader_snapshots import valid_summary_component
            if not valid_summary_component(fact):
                continue
            if fact.get('observationShape') not in {None, 'singleton_object'}:
                continue
            if fact.get('observationShape') and (fact['kind'] != 'grain'
                    or not isinstance(fact.get('contextParameters'), dict)):
                continue
            request_context = fact.get('contextRequestBindings', {})
            if (not isinstance(request_context, dict) or len(request_context) > 10
                    or any(not isinstance(k, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,100}', k)
                           or v != {'format': 'date'} for k, v in request_context.items())
                    or request_context and (fact['kind'] not in {'object', 'grain'}
                        or not isinstance(fact.get('contextParameters'), dict)
                        or set(request_context) & (set(fact['contextParameters'])
                            | set(fact.get('contextBindings', {})) | set(fact.get('contextResponseBindings', {}))))):
                continue
            if 'displayUnit' in fact and (fact['kind'] != 'attribute' or len(fact['fields']) != 1
                    or not isinstance(fact['displayUnit'], str)
                    or not re.fullmatch(r'[\w%°/²³.-]{1,16}', fact['displayUnit'])):
                continue
            if 'displayScale' in fact:
                from .reader_snapshots import valid_display_scale
                if fact['kind'] != 'attribute' or len(fact['fields']) != 1 or not valid_display_scale(fact['displayScale']):
                    continue
            display_fields = fact.get('displayFields', [])
            if (not isinstance(display_fields, list) or len(display_fields) > 20
                    or any(not isinstance(f, str) or not f for f in display_fields)
                    or (display_fields and fact['kind'] != 'object')):
                continue
            alternatives = fact.get('entityContextAlternatives', {})
            if (not isinstance(alternatives, dict) or len(alternatives) > 20
                    or any(not isinstance(k, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,100}', k)
                        or not isinstance(values, list) or not 1 <= len(values) <= 20
                        or any(type(value) not in {str, int, float, bool} for value in values)
                        for k, values in alternatives.items())
                    or (alternatives and (fact['kind'] not in {'object', 'grain'}
                        or not isinstance(fact.get('contextParameters'), dict)
                        or set(alternatives) & (set(fact['contextParameters']) | set(fact.get('contextBindings', {})))))):
                continue
            if fact.get('bindingMode') not in {None, 'request_context'}:
                continue
            if fact.get('bindingMode') == 'request_context' and (
                    fact['kind'] != 'filter' or not isinstance(fact.get('contextParameters'), dict) or conditions):
                continue
            if (not isinstance(conditions, list) or len(conditions) > 10 or any(
                not isinstance(c, dict) or set(c) - {'field', 'predicate', 'value'} or
                c.get('field') not in fact['fields'] or not valid_condition_value(c.get('predicate', 'eq'), c.get('value')) for c in conditions)):
                continue
            if fact['kind'] == 'measure' and (fact.get('operator') not in {'count', 'sum'} or
                    fact.get('operator') == 'sum' and fact.get('valueField') not in fact['fields']):
                continue
            if 'formDefinition' in fact and not isinstance(fact['formDefinition'], dict):
                continue
            if 'domainSelection' in fact:
                spec = fact['domainSelection']
                if (fact['kind'] != 'filter' or not isinstance(fact.get('membershipDomain'), dict)
                        or len(fact['fields']) != 1 or not isinstance(spec, dict)
                        or set(spec) != {'mode', 'prefixes'} or spec.get('mode') != 'exact_label'
                        or not isinstance(spec.get('prefixes'), list) or not 1 <= len(spec['prefixes']) <= 30
                        or any(not isinstance(p, str) or not p.strip() for p in spec['prefixes'])):
                    continue
            if 'domainLabel' in fact and (fact['kind'] != 'attribute'
                    or len(fact['fields']) != 1 or not isinstance(fact['domainLabel'], dict)):
                continue
            key = record['id'] + '#' + fact['id']
            entry = {**fact, 'knowledgeBindingId': key, 'recordId': record['id'],
                     'revision': record['revision'], 'sourceDocumentId': item['documentId']}
            if key in found and found[key] != entry:
                conflicts.add(key)
            found[key] = entry
    entries = [entry for key, entry in found.items() if key not in conflicts]
    # A page may name an entity once in its object fact and specify its count
    # grain separately. Compose only within the same active record and exact
    # mapping; never strip qualifiers or infer business aliases from language.
    for grain in (e for e in entries if e['kind'] == 'grain'):
        anchors = [e for e in entries if e['kind'] == 'object'
                   and e['recordId'] == grain['recordId']
                   and _words(e['concept']) == _words(grain['concept'])
                   and e['operationRef'] == grain['operationRef']
                   and e['sourcePath'] == grain['sourcePath']
                   and set(e['fields']) == set(grain['fields'])
                   and e.get('contextParameters') == grain.get('contextParameters')
                   and e.get('conditions', []) == grain.get('conditions', [])]
        if anchors:
            grain['aliases'] = list(dict.fromkeys([*grain.get('aliases', []),
                *(name for e in anchors for name in [e['concept'], *e.get('aliases', [])])]))
            grain['aliasEvidenceBindingIds'] = [e['knowledgeBindingId'] for e in anchors]
    from .reader_intent_aliases import bind_translation_alternatives, bind_domain_compositions
    bind_translation_alternatives(entries, getattr(knowledge, 'intent_lexical_context', {}))
    bind_domain_compositions(entries, getattr(knowledge, 'intent_lexical_context', {}))
    from .reader_view_population import bind_view_population_compositions
    bind_view_population_compositions(entries, knowledge, getattr(knowledge, 'intent_lexical_context', {}))
    from .reader_record_request import compile_record_set_bindings
    compile_record_set_bindings(knowledge, entries, getattr(knowledge, 'intent_lexical_context', {}))
    return entries


def _semantic_match(binding, requirement, source, catalog):
    fact = catalog.get(binding.knowledgeBindingId)
    if not fact or fact.get('kind') != requirement['kind']:
        return False
    concepts = [fact.get('concept', ''), *fact.get('aliases', [])]
    if fact.get('kind') == 'attribute' and len(fact.get('fields', [])) == 1:
        # An explicit physical field request can use its documented attribute
        # binding; it still needs the exact operation, path and output proof.
        concepts.extend(fact['fields'])
    for alias in fact.get('intentAliases', []):
        if alias['requirementId'] != requirement.get('id'):
            continue
        if alias.get('currentObservationReference'):
            from .reader_view_population import current_observation_matches
            if (not current_observation_matches(alias, requirement, source, catalog, fact)
                    or not _context_match(fact, source)):
                continue
        if alias.get('requiresSourceViewProof'):
            proof = source.get('sourceViewProof') or {}
            definition = alias.get('viewEvidence', {})
            if (proof.get('authority') != 'active_page_operation_context'
                    or proof.get('page') != definition.get('pageRef')
                    or proof.get('view') != definition.get('view')
                    or not any(entry.get('recordId') == fact.get('recordId')
                        and entry.get('revision') == fact.get('revision')
                        and entry.get('operationRef') == fact.get('operationRef')
                        and entry.get('sourcePath') == fact.get('sourcePath')
                        and fact.get('knowledgeBindingId') in entry.get('contextBindingIds', [])
                        for entry in proof.get('definitions', []))):
                continue
        concepts.append(alias['value'])
    requested = requirement.get('fieldConcept') or requirement['value']
    def terms(value):
        words = _words(value)
        # Compose a declared arithmetic operator with an unchanged KB concept.
        # Grammar is engine-owned; business qualifiers are never discarded.
        if fact['kind'] == 'measure':
            if fact.get('operator') == 'count' and words & {'count', 'number'}:
                return words - {'count', 'number', 'of'}
            if fact.get('operator') == 'sum' and 'sum' in words:
                return words - {'sum', 'of'}
        return words
    from .reader_group_domain import requested_domain_label
    matched = (bool(requested_domain_label(fact, requirement)) if fact.get('domainSelection')
        else any(isinstance(c, str) and terms(c) == terms(requested) for c in concepts))
    if not matched:
        return False
    return (fact.get('operationRef') == source.get('operationRef')
            and fact.get('sourcePath') == binding.sourcePath
            and isinstance(fact.get('fields'), list) and set(fact['fields']) == set(binding.fields))


def _context_match(fact, source):
    """Prove data-affecting request defaults; never expose their raw values."""
    context = source.get('collectionContext') or {}
    hashes = context.get('parameterHashes')
    expected = fact.get('contextParameters')
    if not isinstance(hashes, dict) or not isinstance(expected, dict):
        return False
    references = fact.get('contextBindings', {})
    if not isinstance(references, dict):
        return False
    subject_hashes = source.get('subjectParameterHashes', {})
    resolved = {}
    for key, reference in references.items():
        proof = subject_hashes.get(key, {})
        if reference != 'principal.user_id' or proof.get('reference') != reference or not proof.get('valueHash'):
            return False
        resolved[key] = proof['valueHash']
    from .reader_snapshots import response_parameter_hashes
    echoed = response_parameter_hashes(fact, source)
    if echoed is None or set(echoed) & (set(expected) | set(resolved)):
        return False
    resolved.update(echoed)
    from .reader_snapshots import request_parameter_hashes
    captured = request_parameter_hashes(fact, source)
    if captured is None or set(captured) & (set(expected) | set(resolved)):
        return False
    resolved.update(captured)
    if set(expected) & set(resolved):
        return False
    # Changing order/pagination cannot expand a proven complete population.
    presentation = re.compile(r'page(?:index|number|size)?|perpage|limit|sort(?:by|field|direction|order)?|order(?:by|direction)?', re.I)
    population_keys = {key for key in hashes if not presentation.fullmatch(key)}
    # Explicit alternatives describe contexts that preserve entity identity.
    # Scope, population, filters and measures retain exact-context matching.
    alternatives = fact.get('entityContextAlternatives', {})
    if (not isinstance(alternatives, dict)
            or (alternatives and fact.get('kind') not in {'object', 'grain'})
            or set(alternatives) & (set(expected) | set(resolved))):
        return False
    is_query = str(source.get('operationRef', '')).startswith('GET ')
    def wire(value):
        return (str(value).lower() if type(value) is bool else
                str(value) if type(value) in {int, float} else value) if is_query else value
    for key, values in alternatives.items():
        if (not isinstance(values, list) or not values or key not in hashes
                or hashes[key] not in [projection_hash(wire(v)) for v in values]):
            return False
    if not population_keys <= set(expected) | set(resolved) | set(alternatives):
        return False
    # Query parameters are observed as wire strings, whereas JSON request
    # bodies preserve scalar types. Compare the declared semantic value using
    # the operation's actual transport; never coerce POST booleans to strings.
    if str(source.get('operationRef', '')).startswith('GET '):
        expected = {key: (str(value).lower() if type(value) is bool else
                         str(value) if type(value) in {int, float} else value)
                    for key, value in expected.items()}
    return (all(key in hashes and hashes[key] == projection_hash(value) for key, value in expected.items())
            and all(hashes.get(key) == value for key, value in resolved.items()))


def collection_dependencies(task, knowledge, page, source, rows_path):
    """Compile required projections from unambiguous, applicable page semantics.

    This establishes only which fields need observing. It never applies a
    business predicate, grants access, or satisfies an answer requirement.
    Schema, permissions and final computation proofs remain separate checks.
    """
    records = {item['record']['id']: item['record'] for item in knowledge.items.values()
               if isinstance(item.get('record'), dict) and item['record'].get('id')}
    catalog = {fact['knowledgeBindingId']: fact for fact in semantic_bindings(knowledge)
               if urlsplit(page).path in records[fact['recordId']].get('applicability', {}).get('pageRefs', [])
               and fact['operationRef'] == source.get('operationRef') and fact['sourcePath'] == rows_path
               and ('contextParameters' not in fact or _context_match(fact, source))}
    dependencies, ambiguous = [], []
    for requirement in requirements_for(task):
        # Unknown language tokens must not match each other as empty sets.
        if not _words(requirement.get('fieldConcept') or requirement['value']):
            continue
        matches = [fact for key, fact in catalog.items() if _semantic_match(
            SimpleNamespace(knowledgeBindingId=key, sourcePath=rows_path, fields=fact['fields']),
            requirement, source, catalog)]
        if len(matches) == 1:
            fields = list(matches[0]['fields'])
            if requirement['kind'] == 'object' and task.outputShape == 'list':
                # Public record labels are page-defined projection dependencies,
                # not internal identity keys or permission to expose new fields.
                fields = list(dict.fromkeys([*fields, *matches[0].get('displayFields', [])]))
            dependencies.append({'requirementId': requirement['id'],
                'knowledgeBindingId': matches[0]['knowledgeBindingId'], 'fields': fields})
        elif len(matches) > 1:
            ambiguous.append({'requirementId': requirement['id'],
                'knowledgeBindingIds': sorted(fact['knowledgeBindingId'] for fact in matches)})
    return dependencies, ambiguous



def minimal_detail_projection(task, knowledge, page, source, rows_path, dependencies, ambiguous):
    """Close a fully documented detail projection; never remove unresolved dependencies.

    Request properties and page-defined record keys are sufficient. Unasked
    volatile columns cannot invalidate two otherwise equal record observations.
    Unknown, conflicting or conditional mappings retain the planner projection.
    """
    if (task.outputShape != 'detail' or not task.recordIdentity or not task.requestedAttributes
            or task.requestedMeasures or task.groupBy or ambiguous):
        return None
    required = {x['id'] for x in requirements_for(task) if x['kind'] not in {'detail', 'record', 'view'}}
    if not required <= {x['requirementId'] for x in dependencies}:
        return None
    from .reader_routing import page_routing
    definitions = [d for d in page_routing(knowledge, page)['records']
        if d.get('operationRef') == source.get('operationRef') and d.get('sourcePath') == rows_path
        and d.get('identityField') and d.get('keyFields')]
    if not definitions:
        return None
    fields = [f for d in dependencies for f in d['fields']]
    for definition in definitions:
        fields.extend([definition['identityField'], *definition['keyFields']])
    return list(dict.fromkeys(fields))


def minimal_list_projection(task, knowledge, dependencies, ambiguous):
    """Compile a list projection only when every requested clause is mapped.

    Public display keys are explicit page knowledge; entity/filter/order keys
    remain collected even if they are not displayed. Unknown requirements and
    multiple source/domain analyses keep the planner projection for diagnosis.
    """
    if task.outputShape != 'list' or task.groupBy or task.recordIdentity or ambiguous:
        return None
    required = {r['id'] for r in requirements_for(task) if r['kind'] not in {'detail', 'view'}}
    if not required <= {d['requirementId'] for d in dependencies}:
        return None
    catalog = {f['knowledgeBindingId']: f for f in semantic_bindings(knowledge)}
    objects = [catalog.get(d['knowledgeBindingId'], {}) for d in dependencies if d['requirementId'] == 'object']
    if len(objects) != 1 or not objects[0].get('displayFields'):
        return None
    return list(dict.fromkeys(f for d in dependencies for f in d['fields']))


def partial_detail_projection(task, knowledge, page, source, rows_path, dependencies, ambiguous):
    """Read the proven properties of one record without guessing unknown fields.

    Unknown output attributes remain unmet requirements. They cannot justify
    collecting unrelated columns, especially volatile or personal fields.
    Every population constraint must already have an unambiguous mapping.
    """
    if (task.outputShape != 'detail' or not task.recordIdentity or not task.requestedAttributes
            or task.requestedMeasures or task.requestedOrdering or task.groupBy or ambiguous):
        return None
    requirements = requirements_for(task)
    mapped = {d['requirementId'] for d in dependencies}
    unresolved = [r for r in requirements if r['kind'] not in {'detail', 'record', 'view'}
                  and r['id'] not in mapped]
    if not unresolved or any(r['kind'] != 'attribute' for r in unresolved):
        return None
    # Reuse the exact source/record-key guard; do not substitute another entity.
    known_attributes = [r['value'] for r in requirements if r['kind'] == 'attribute' and r['id'] in mapped]
    if not known_attributes:
        return None
    from .reader_routing import page_routing
    definitions = [d for d in page_routing(knowledge, page)['records']
        if d.get('operationRef') == source.get('operationRef') and d.get('sourcePath') == rows_path
        and d.get('identityField') and d.get('keyFields')]
    if not definitions:
        return None
    fields = [field for d in dependencies for field in d['fields']]
    for definition in definitions:
        fields.extend([definition['identityField'], *definition['keyFields']])
    return list(dict.fromkeys(fields))


def validate_requirements(task, plan, sources, knowledge, outputs, lineage):
    from .generic_reader import PipelineError
    requirements = requirements_for(task)
    required = {r['id']: r for r in requirements}
    bindings = {}
    for binding in plan.requirementBindings:
        bindings.setdefault(binding.requirementId, []).append(binding)
    multiple_contexts = {'object', 'grain', 'scope', 'population', 'filter', 'time', 'group'}
    catalog = {fact['knowledgeBindingId']: fact for fact in semantic_bindings(knowledge)}
    from .reader_snapshots import overview_component_requirements
    component_requirements = overview_component_requirements(task, required, bindings, catalog, sources)
    unknown = sorted(set(bindings) - set(required))
    duplicates = {rid: items for rid, items in bindings.items() if rid in required
        and len(items) > 1 and (required[rid]['kind'] not in multiple_contexts and rid not in component_requirements
            or len({sources.get(b.sourceId, {}).get('principalScopeRef') for b in items}) != 1
            or not all(sources.get(b.sourceId, {}).get('principalScopeRef') for b in items)
            or len({(b.sourceId, b.sourcePath) for b in items}) != len(items))}
    if unknown or duplicates:
        raise PipelineError('requirement_binding_invalid', 'planning', details={
            'unknownRequirementIds': unknown,
            'duplicateBindings': [{'requirementId': rid, 'kind': required[rid]['kind'],
                'proposals': [{'knowledgeBindingId': b.knowledgeBindingId, 'sourceId': b.sourceId,
                    'sourcePath': b.sourcePath, 'fields': b.fields, 'stepIds': b.stepIds} for b in items]}
                for rid, items in duplicates.items()],
            'correction': 'Use only supplied requirement IDs. Give each attribute, measure, ordering, '
                'or detail requirement one proof binding. When one attribute has numeric and '
                'display representations, choose one applicable definition that proves the requested '
                'value in the actual output; do not duplicate its requirement ID. Other documented '
                'display columns may remain in the same output. Preserve all requested attributes and '
                'the original task. Multiple context or group bindings require distinct source/path '
                'pairs with one verified principal; each output still needs its own complete evidence.'})
    steps = {step.id: step for step in plan.steps}
    exposed = {o['id']: o for o in outputs}
    catalog = {fact['knowledgeBindingId']: fact for fact in semantic_bindings(knowledge)}

    def chain(step_id):
        found, pending = {}, [step_id]
        while pending:
            sid = pending.pop()
            if sid not in found:
                found[sid] = steps[sid]
                pending.extend(steps[sid].inputs)
        return list(found.values())

    coverage = []
    for requirement, binding in ((r, b) for r in requirements for b in bindings.get(r['id'], [None])):
        rid, kind, semantic = requirement['id'], requirement['kind'], requirement['value']
        entry = {**requirement, 'status': 'unfulfilled', 'outputIds': [], 'stepIds': [],
                 'reason': f'requested_{kind}_unverified'}
        if kind in {'record', 'view'}:
            matched = []
            for oid in exposed:
                nodes = chain(oid)
                reads = [s for s in nodes if s.op in {'read_rows', 'read_aggregate', 'assess_form'}]
                valid = bool(reads)
                for read in reads:
                    source = sources.get(read.sourceId, {})
                    if kind == 'view':
                        valid = valid and source.get('verifiedView') == semantic
                    else:
                        from .reader_related_collection import collection_record_read
                        if collection_record_read(task, semantic, sources, read, exposed[oid]):
                            continue
                        proof = source.get('verifiedRecord') or {}
                        def guarded(step_id, filtered=False):
                            node = steps[step_id]
                            filtered = filtered or (node.op == 'filter' and node.field == proof.get('field')
                                and node.predicate == 'eq' and str(node.operand) == semantic)
                            if step_id == read.id:
                                return filtered
                            return all(guarded(child, filtered) for child in node.inputs
                                       if read.id in {s.id for s in chain(child)})
                        root = proof.get('path', '')
                        from .reader_subject import property_of_record
                        within = read.path == root or property_of_record(source, read.path)
                        valid = valid and proof.get('identity') == semantic and within and (proof.get('single') or guarded(oid))
                if valid:
                    matched.append(oid)
            if matched:
                entry.update(status='satisfied', reason='', outputIds=matched, stepIds=list(matched))
            coverage.append(entry)
            continue
        if kind == 'detail' and task.requestedAttributes:
            matched = [oid for oid, output in exposed.items() if output['role'] == 'detail'
                       and isinstance(output['value'], list) and lineage[oid]
                       and all(ref.get('completeness') == 'complete' for ref in lineage[oid])]
            if matched:
                entry.update(status='satisfied', reason='', outputIds=matched, stepIds=matched)
            coverage.append(entry)
            continue
        if kind == 'detail' and task.outputShape == 'list' and not task.requestedAttributes:
            from .reader_empty_display import empty_list_shape_proof
            matched = []
            for oid, output in exposed.items():
                proof = empty_list_shape_proof(task, output, chain(oid), sources, lineage[oid])
                if proof:
                    output['emptyListProof'] = proof
                    matched.append(oid)
            if matched:
                entry.update(status='satisfied', reason='', outputIds=matched, stepIds=matched)
                coverage.append(entry)
                continue
        if kind == 'time' and semantic in {'current', 'current observation', 'now'}:
            if outputs and all(o['evidence'] and all(ref.get('capturedAt') for ref in o['evidence']) for o in outputs):
                entry.update(status='satisfied', reason='', outputIds=list(exposed))
            coverage.append(entry)
            continue
        if not binding or not binding.sourceId or not binding.stepIds or not binding.evidence:
            coverage.append(entry)
            continue
        if any(s not in steps for s in binding.stepIds) or binding.sourceId not in sources:
            raise PipelineError('requirement_source_or_step_missing', 'runtime', details={
                'requirementId': rid, 'allowedSourceIds': sorted(sources), 'allowedStepIds': sorted(steps),
                'correction': 'Use a live data source ID in sourceId and existing computation IDs in stepIds. Knowledge passage IDs belong only in evidence.sourceId; keep the original user requirement.'})
        source = sources[binding.sourceId]
        knowledge.cite(binding.evidence, required=True, at='requirement.' + rid)
        quotes = ' '.join(knowledge.citation_text(ref) for ref in binding.evidence)
        # The page/operation must occur in cited source documents. Exact quotes
        # accompany a structured page fact; lexical coincidence is insufficient.
        documents = ' '.join(knowledge.source(ref)['text'] for ref in binding.evidence)
        operation = str(source.get('operationRef') or '').partition(' ')[2]
        page = str(source.get('page') or '')
        anchored = bool(page and page in documents or operation and operation in documents)
        field_anchor = all(field in quotes for field in binding.fields)
        # count/sum are built-in operator meanings. Business concepts must be
        # established by a page fact with exact operation, row path and fields.
        aggregate = builtin_measure(task, semantic) if kind == 'measure' else None
        builtin = kind == 'detail' or bool(aggregate)
        if kind == 'detail' and not field_anchor:
            cited_records = {knowledge.source(ref)['recordId'] for ref in binding.evidence}
            declared = {field for fact in catalog.values()
                if fact.get('recordId') in cited_records and fact.get('operationRef') == source.get('operationRef')
                and fact.get('sourcePath') == binding.sourcePath for field in [*fact.get('fields', []), *fact.get('displayFields', [])]}
            field_anchor = bool(binding.fields) and set(binding.fields) <= declared
        if aggregate == 'count':
            # Counting contributes no additional business field semantics.
            # Its entity and population must pass the per-output context checks.
            field_anchor = True
        concept = builtin or _semantic_match(binding, requirement, source, catalog)
        if not builtin and concept:
            # The semantic record itself must be cited, not just a different
            # document that happens to mention the same field names.
            record_id = catalog[binding.knowledgeBindingId]['recordId']
            concept = any(knowledge.source(ref)['recordId'] == record_id for ref in binding.evidence)
            # An exact active field binding supplies the physical field names.
            # Do not require the model to repeat those names in a short quote
            # from the same validated record. Plain-text citations retain the
            # lexical guard; source/context/lineage checks remain independent.
            if concept:
                field_anchor = True
            if (kind in {'scope', 'population'} or 'contextParameters' in catalog[binding.knowledgeBindingId]) and not _context_match(catalog[binding.knowledgeBindingId], source):
                entry['reason'] = 'source_filter_context_unverified'
                coverage.append(entry)
                continue
        if not anchored or not concept or not field_anchor:
            entry['reason'] = 'field_semantic_binding_unverified'
            coverage.append(entry)
            continue
        candidates = []
        for oid, output in exposed.items():
            nodes = chain(oid)
            if not set(binding.stepIds) & {s.id for s in nodes}:
                continue
            reads = [s for s in nodes if s.op in {'read_rows', 'read_aggregate', 'assess_form'}]
            from .reader_related import related_context_read
            related = lambda read: related_context_read(task, kind, binding.sourceId, binding.sourcePath,
                binding.fields, sources, read, output)
            if not reads or any(s.sourceId != binding.sourceId and not related(s) for s in reads):
                continue
            from .reader_subject import parent_property_context
            parent_property = lambda read: parent_property_context(task, kind, binding.sourcePath,
                binding.fields, source, read, output)
            if binding.sourcePath and any(s.path != binding.sourcePath and not parent_property(s) and not related(s) for s in reads):
                continue
            def fields_proven(read):
                proof = source.get('verifiedRecord') or {}
                parent_key = (read.op == 'assess_form' and kind in {'object', 'grain'}
                    and proof.get('single') and proof.get('path') == read.path == binding.sourcePath
                    and binding.fields and set(binding.fields) == set(proof.get('keyFields', [])))
                return related(read) or read.op in {'read_rows', 'assess_form'} and (parent_key or parent_property(read) or set(binding.fields) <= set(read.fields))
            if binding.fields and any(not fields_proven(read) for read in reads):
                continue
            candidates.append((oid, output, nodes))
        matched = []
        for oid, output, nodes in candidates:
            final = steps[oid]
            row_reads = [s for s in nodes if s.op in {'read_rows', 'assess_form'}]
            complete = bool(lineage[oid]) and all(ref.get('completeness') == 'complete' for ref in lineage[oid])
            fact = catalog.get(binding.knowledgeBindingId, {})
            conditions = fact.get('conditions', [])
            conditions_applied = all(any(s.op == 'filter' and s.field == c['field']
                and s.predicate == c.get('predicate', 'eq') and scalar_equal(s.operand, c.get('value'))
                for s in nodes) for c in conditions)
            # A documented conditional population is not the whole returned
            # queue. Prove its predicates on EVERY output lineage, not only
            # when the binding happens to be labelled a measure.
            if not conditions_applied:
                continue
            if kind in {'object', 'scope', 'population'}:
                valid = bool(row_reads and binding.sourcePath)
                if kind == 'scope':
                    valid = valid and plan.context.scope == semantic
            elif kind == 'grain':
                from .reader_snapshots import singleton_grain
                observed_singleton = singleton_grain(task, fact, source, row_reads, output)
                single = source.get('verifiedRecord') or {}
                parent_form = bool(single.get('single') and all(s.op == 'assess_form' for s in row_reads)
                                   and set(single.get('keyFields', [])) == set(binding.fields))
                # A complete list filtered to exactly one observed identity
                # already has the requested entity grain; a distinct operator
                # would be redundant. Record coverage below still requires the
                # exact identity filter on every exposed output's read lineage.
                unique_record = False
                if (task.outputShape == 'detail' and task.recordIdentity and complete
                        and single.get('identity') == task.recordIdentity
                        and set(single.get('keyFields', [])) == set(binding.fields)
                        and all(s.path == single.get('path') for s in row_reads)):
                    from .generic_reader import pointer
                    rows = pointer(source['data'], single['path'])
                    if isinstance(rows, list):
                        matches = [row for row in rows if isinstance(row, dict)
                                   and str(row.get(single.get('field'), '')) == task.recordIdentity]
                        unique_record = len(matches) == 1 and all(matches[0].get(k) is not None for k in binding.fields)
                valid = bool(binding.fields and row_reads and (complete or parent_form) and (any(
                    s.op == 'distinct' and set(s.fields) == set(binding.fields) for s in nodes) or
                    single.get('single') and set(single.get('keyFields', [])) == set(binding.fields) or unique_record or observed_singleton))
            elif kind == 'group':
                dimensions = final.fields or ([final.field] if final.field else [])
                valid = (final.op == 'group_count' and final.role == 'breakdown' and complete
                         and bool(binding.fields) and set(binding.fields) <= set(dimensions))
                if getattr(task, 'groupCompleteness', 'observed') == 'complete_domain':
                    proof = output.get('groupDomainProof') or {}
                    valid = bool(valid and final.includeZeroGroups and fact.get('groupDomain')
                        and proof.get('definitionHash') == projection_hash(fact['groupDomain'])
                        and proof.get('membershipConfirmed'))
            elif kind == 'attribute':
                form = final.op == 'assess_form' and final.knowledgeBindingId == binding.knowledgeBindingId
                conditions = catalog.get(binding.knowledgeBindingId, {}).get('conditions', [])
                # Predicate fields prove which rows own an attribute; they do
                # not all need to become user-facing columns after filtering.
                value_fields = set(binding.fields) - {c['field'] for c in conditions}
                value_fields = value_fields or set(binding.fields)
                condition_proof = all(any(s.op == 'filter' and s.field == c['field']
                    and s.predicate == c.get('predicate', 'eq') and scalar_equal(s.operand, c.get('value'))
                    for s in nodes) for c in conditions)
                valid = (final.role == 'detail' and isinstance(output['value'], list) and complete
                         and (form or bool(value_fields) and all(value_fields <= set(row) for row in output['value']))
                         and condition_proof
                         and not set(binding.fields) & set(output.get('unavailableFields', [])))
                if fact.get('domainLabel'):
                    proof = output.get('groupDomainProof') or {}
                    valid = bool(final.op == 'group_count' and final.role == 'breakdown' and complete
                        and binding.fields == (final.fields or [final.field])
                        and proof.get('definitionHash') == projection_hash(fact['domainLabel'])
                        and proof.get('membershipConfirmed') and isinstance(output.get('displayRows'), list)
                        and len(output['displayRows']) == len(output['value']))
                from .reader_absence import observed_absence
                absence = observed_absence(task, fact, source, binding.fields, binding.sourcePath)
                if (absence and final.role == 'detail' and isinstance(output['value'], list)
                        and complete and condition_proof):
                    valid = True
                    output.setdefault('verifiedAbsences', []).append({**absence, 'requirementId': rid})
                from .reader_interpretations import observed_interpretation
                interpretation = observed_interpretation(task, fact, source, binding.fields, binding.sourcePath)
                if (interpretation and final.role == 'detail' and isinstance(output['value'], list)
                        and len(output['value']) == 1 and complete and condition_proof):
                    valid = True
                    output.setdefault('verifiedInterpretations', []).append({**interpretation, 'requirementId': rid})
            elif kind == 'time':
                valid = complete and any(s.op == 'filter_time' and s.knowledgeBindingId == binding.knowledgeBindingId
                    and s.field in binding.fields for s in nodes)
            elif kind == 'measure':
                fact = catalog.get(binding.knowledgeBindingId, {})
                operator = aggregate if builtin else fact.get('operator')
                conditions = fact.get('conditions', [])
                filters = [s for s in nodes if s.op in {'filter', 'filter_membership'}]
                def justified(step):
                    if step.op == 'filter_membership':
                        return any(r['kind'] == 'filter' and b.sourceId == binding.sourceId
                            and b.knowledgeBindingId == step.knowledgeBindingId
                            and _semantic_match(b, r, source, catalog)
                            and any(proof.get('knowledgeBindingId') == b.knowledgeBindingId
                                and proof.get('stepId') == step.id and not proof.get('unknownCount')
                                for ref in lineage[oid] for proof in ref.get('membershipProofs', []))
                            for r in requirements for b in bindings.get(r['id'], []))
                    if any(step.field == c.get('field') and step.predicate == c.get('predicate', 'eq') and scalar_equal(step.operand, c.get('value')) for c in conditions):
                        return True
                    if task.recordIdentity and step.predicate == 'eq' and str(step.operand) == task.recordIdentity and step.field == (source.get('verifiedRecord') or {}).get('field'):
                        return True
                    for req in requirements:
                        if req['kind'] not in {'object', 'population', 'scope', 'filter'}:
                            continue
                        for context_binding in bindings.get(req['id'], []):
                            if (context_binding.sourceId != binding.sourceId
                                    or context_binding.sourcePath != binding.sourcePath
                                    or not _semantic_match(context_binding, req, source, catalog)):
                                continue
                            context_fact = catalog[context_binding.knowledgeBindingId]
                            if ('contextParameters' in context_fact and not _context_match(context_fact, source)):
                                continue
                            if any(step.field == c['field'] and step.predicate == c.get('predicate', 'eq')
                                   and scalar_equal(step.operand, c.get('value'))
                                   for c in context_fact.get('conditions', [])):
                                return True
                    return any(r['kind'] == 'filter' and b.sourceId == binding.sourceId and step.field in b.fields
                        and str(step.operand).casefold() in r['value'].casefold()
                        for r in requirements for b in bindings.get(r['id'], []))
                valid = (operator in {'count', 'sum'} and all(justified(s) for s in filters)
                         and (operator != 'sum' or builtin or final.field == fact.get('valueField')) and complete and
                         ((final.op == operator and final.role == 'total') or
                          (operator == 'count' and final.op == 'group_count' and final.role == 'breakdown'))
                         and all(any(s.op == 'filter' and s.field == condition.get('field')
                            and s.predicate == condition.get('predicate', 'eq')
                            and scalar_equal(s.operand, condition.get('value')) for s in nodes)
                            for condition in conditions))
            elif kind == 'ordering':
                from .reader_ordering import ordering_proven
                valid = ordering_proven(task, requirement, fact, nodes, final, complete, lineage[oid])
            elif kind == 'detail':
                valid = final.role == 'detail' and isinstance(output['value'], list) and complete and not output.get('unavailableFields')
            elif kind == 'filter':
                source_context = (fact.get('bindingMode') == 'request_context'
                    and isinstance(fact.get('contextParameters'), dict) and not conditions
                    and _context_match(fact, source))
                valid = bool(binding.fields and (source_context or bool(conditions) or any(
                    s.op == 'filter' and s.field in binding.fields
                    and str(s.operand).casefold() in semantic.casefold() for s in nodes)))
                if (fact.get('compiledRecordSet') or {}).get('operator') == 'filter_identifiers':
                    from .reader_record_request import record_set_step_matches
                    valid = complete and any(record_set_step_matches(s, fact) for s in nodes) and any(
                        proof.get('knowledgeBindingId') == binding.knowledgeBindingId
                        and proof.get('stepId') in {s.id for s in nodes}
                        for ref in lineage[oid] for proof in ref.get('recordSetLookupProofs', []))
                if fact.get('membershipDomain'):
                    valid = complete and any(proof.get('knowledgeBindingId') == binding.knowledgeBindingId
                        and proof.get('field') in binding.fields and not proof.get('unknownCount')
                        and proof.get('stepId') in {s.id for s in nodes if s.op == 'filter_membership'}
                        for ref in lineage[oid] for proof in ref.get('membershipProofs', []))
            else:
                valid = False
            if valid:
                matched.append(oid)
        if matched:
            entry.update(status='satisfied', reason='', outputIds=matched, stepIds=binding.stepIds,
                         sourceId=binding.sourceId, sourcePath=binding.sourcePath, fields=binding.fields,
                         evidence=[ref.model_dump() for ref in binding.evidence])
        coverage.append(entry)

    # A same-record detail can use different page operations. Preserve each
    # independently verified mapping, then union only context coverage by output.
    # Requested attributes/measures remain single bindings, and every exposed
    # branch still needs all of its own context proofs below.
    merged = []
    for requirement in requirements:
        entries = [c for c in coverage if c['id'] == requirement['id']]
        if len(entries) == 1:
            merged.append(entries[0]); continue
        satisfied = [c for c in entries if c['status'] == 'satisfied']
        entry = {**entries[0], 'bindingResults': entries,
                 'outputIds': list(dict.fromkeys(oid for c in satisfied for oid in c['outputIds'])),
                 'stepIds': list(dict.fromkeys(sid for c in satisfied for sid in c['stepIds']))}
        if satisfied and (requirement['id'] not in component_requirements or len(satisfied) == len(entries)):
            entry.update(status='satisfied', reason='')
        elif requirement['id'] in component_requirements:
            entry.update(status='unfulfilled', reason='overview_component_unverified')
        merged.append(entry)
    coverage = merged
    from .reader_record_request import validate_record_set_outputs
    validate_record_set_outputs(coverage, catalog, bindings, sources, outputs)
    # Validate context per output, not merely that some other output in the plan
    # satisfied scope/grain/filter. Different populations cannot be mixed.
    contexts = [c for c in coverage if c['kind'] in {'object', 'grain', 'scope', 'population', 'filter', 'time', 'record', 'view', 'ordering'}]
    def ordered_population(output_id):
        node = steps[output_id]
        # Selecting public columns preserves rows and their already verified order.
        # Filters, distinct, grouping and limits are not transparent projections.
        while node.op == 'project' and len(node.inputs) == 1 and node.limit is None:
            node = steps[node.inputs[0]]
        return node

    def context_covers_output(context, output_id):
        if context['status'] != 'satisfied':
            return False
        if output_id in context['outputIds']:
            return True
        # A scalar count has no row order. Its companion sorted list can prove
        # ordering only when both consume the exact same computation node.
        # Do not extend this to grouped outputs, other populations or top-N lists.
        node = steps[output_id]
        return (context['kind'] == 'ordering' and node.op == 'count'
                and type(exposed[output_id]['value']) is int
                and any(ordered_population(ordered_id).op == 'sort'
                        and ordered_population(ordered_id).inputs == node.inputs
                        and ordered_population(ordered_id).limit is None
                        and isinstance(exposed[ordered_id]['value'], list)
                        for ordered_id in context['outputIds'] if ordered_id in exposed))

    for item in coverage:
        if item['kind'] in {'measure', 'attribute', 'group', 'detail'} and item['status'] == 'satisfied':
            item['outputIds'] = [oid for oid in item['outputIds'] if all(
                context_covers_output(c, oid) for c in contexts)]
            if not item['outputIds']:
                item.update(status='unfulfilled', reason='requested_context_unverified')
            if item['id'] in component_requirements and any(
                    not set(part['outputIds']) & set(item['outputIds']) for part in item.get('bindingResults', [])):
                item.update(status='unfulfilled', reason='overview_component_context_unverified')
    groups = [c for c in coverage if c['kind'] == 'group']
    if groups and all(c['status'] == 'satisfied' for c in groups):
        common = set.intersection(*(set(c['outputIds']) for c in groups))
        if not common:
            for c in groups:
                c.update(status='unfulfilled', reason='requested_grouping_combination_unfulfilled')
        # Every measure needs the requested dimensions over its OWN filtered
        # population, including conditional measures. An unrelated breakdown
        # cannot cover it merely because it appears elsewhere in the answer.
        for c in coverage:
            if c['kind'] == 'measure' and c['status'] == 'satisfied':
                if not any(oid == gid or (steps[oid].op == 'count' and steps[oid].inputs == steps[gid].inputs)
                           for oid in c['outputIds'] for gid in common):
                    c.update(status='unfulfilled', reason='requested_total_group_context_mismatch')
    for item in coverage:
        item['outputStepIds'] = {oid: sorted(set(item.get('stepIds', [])) & {s.id for s in chain(oid)})
                                 for oid in item['outputIds']}
    verified = {oid for c in coverage if c['status'] == 'satisfied' and c['kind'] in {'measure', 'attribute', 'group', 'detail'}
                for oid in c['outputIds']}
    for output in outputs:
        output['requirementIds'] = [c['id'] for c in coverage if c['status'] == 'satisfied' and output['id'] in c['outputIds']]
        output['verifiedAbsences'] = [a for a in output.get('verifiedAbsences', [])
            if a['requirementId'] in output['requirementIds']]
        output['verifiedInterpretations'] = [a for a in output.get('verifiedInterpretations', [])
            if a['requirementId'] in output['requirementIds']]
        interpreted_ids = {a['requirementId'] for a in output['verifiedInterpretations']}
        other_fields = {f for c in coverage if c['status'] == 'satisfied'
            and c['kind'] == 'attribute' and c['id'] not in interpreted_ids
            and output['id'] in c['outputIds'] for f in c.get('fields', [])}
        for interpretation in output['verifiedInterpretations']:
            interpretation['hideFields'] = [f for f in interpretation['hideFields'] if f not in other_fields]
        absent_fields = {f for a in [*output['verifiedAbsences'], *output['verifiedInterpretations']] for f in a['fields']}
        output['unavailableFields'] = [f for f in output.get('unavailableFields', []) if f not in absent_fields]
        if output['id'] not in verified:
            output['role'] = 'observation'
    missing = [c['reason'] for c in coverage if c['status'] != 'satisfied']
    if any(c['kind'] == 'group' and c['status'] != 'satisfied' for c in coverage):
        missing.append('requested_grouping_unfulfilled')
    return requirements, coverage, list(dict.fromkeys(missing))
