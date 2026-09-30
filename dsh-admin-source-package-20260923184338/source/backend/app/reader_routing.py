"""Catalog-only routing; business mappings are active page knowledge, never code."""
import hashlib
import json
import re
from urllib.parse import urlsplit, urlencode, parse_qsl

from .generic_reader_contracts import RouteCheck, RouteVerification
from .reader_requirements import requirements_for, _words


def fail(code, category="knowledge_gap", details=None):
    from .generic_reader import PipelineError
    raise PipelineError(code, category, details=details)


def task_fingerprint(task):
    semantic = task.model_dump(exclude={"stage", "searchQuery", "slotUpdates", "contextRelation", "clarification"})
    return hashlib.sha256(json.dumps(semantic, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _terms(value):
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", str(value)).replace("_", " ")
    return _words(value) - {"the", "a", "of", "by", "and", "my", "me", "show", "please", "unknown", "current"}


def recall_candidates(task, catalog, knowledge, page_hint=None, limit=5, *, include_unmatched=False):
    """Fuse catalog lexical relevance and retrieved page evidence; no second registry."""
    knowledge.prompt()
    weighted = [(task.businessObject, 8), (task.requestedGrain, 3), (task.businessFocus, 2),
                (" ".join(task.groupBy + task.requestedMeasures + task.filters + task.requestedOrdering), 1)]
    found = []
    for page in catalog:
        for route in page["routes"]:
            exact_route = re.compile(re.escape(route) + r'(?![\w/.-])')
            refs = [pid for pid, (key, passage) in knowledge.passages.items()
                    if key in knowledge.items and exact_route.search(passage)]
            records = [v["record"] for v in knowledge.items.values() if v["record"]
                       and route in v["record"].get("applicability", {}).get("pageRefs", [])]
            text = json.dumps({**page, "attached": records}, ensure_ascii=False)
            terms = _terms(text)
            lexical = sum(weight * len(_terms(query) & terms) / max(1, len(_terms(query))) for query, weight in weighted)
            identity_terms = _terms(" ".join([route, str(page.get("name") or ""), str(page.get("module") or "")]))
            lexical += 12 * len(_terms(task.businessObject) & identity_terms) / max(1, len(_terms(task.businessObject)))
            if lexical == 0 and not refs and not include_unmatched:
                continue
            found.append({"candidateId": hashlib.sha256((str(page["id"]) + route).encode()).hexdigest()[:20],
                          "pageId": page["id"], "route": route, "name": page["name"],
                          "description": page["description"], "parameters": page["parameters"],
                          "fields": page["fields"], "sourceIds": refs[:8], "lexicalScore": round(lexical, 4),
                          "retrievedEvidenceCount": len(refs),
                          "browserHint": route == (page_hint or {}).get("route")})
    lexical_order = sorted(found, key=lambda x: (-x["lexicalScore"], x["candidateId"]))
    evidence_order = sorted(found, key=lambda x: (-x["retrievedEvidenceCount"], x["candidateId"]))
    ranks = [{x["candidateId"]: i+1 for i,x in enumerate(order)} for order in [lexical_order,evidence_order]]
    for item in found:
        item["score"] = sum(1/(60 + rank[item["candidateId"]]) for rank in ranks)
    fused = sorted(found, key=lambda x: (-x["score"], -x["lexicalScore"], x["candidateId"]))
    # Preserve lexical recall when remote relevance misses an exact catalog
    # identity; remaining slots retain retrieval diversity.
    shortlist = lexical_order[:min(3, limit)]
    known = {x["candidateId"] for x in shortlist}
    shortlist += [x for x in fused if x["candidateId"] not in known][:limit-len(shortlist)]
    return sorted(shortlist, key=lambda x: (-x["score"], -x["lexicalScore"], x["candidateId"]))


def page_routing(knowledge, route):
    """Return uniquely versioned, active definitions for one catalog entry."""
    # Runtime query values are checked by bind_route/verify_route. They do not
    # change the page path used to retrieve applicable definitions.
    route = urlsplit(route).path
    result = {"parameters": [], "records": [], "views": []}
    for item in knowledge.items.values():
        record = item.get("record") or {}
        if record.get("status") != "active" or route not in record.get("applicability", {}).get("pageRefs", []):
            continue
        routing = record.get("payload", {}).get("routing", {})
        for group in result:
            for definition in routing.get(group, []):
                if isinstance(definition, dict) and isinstance(definition.get("id"), str):
                    result[group].append({**definition, "bindingId": record["id"] + "#" + definition["id"]})
    return result


def lookup_dependencies(candidates, knowledge):
    """Expose exact catalog dependency IDs from page-defined lookup sources."""
    result = []
    for target in candidates:
        for param in page_routing(knowledge, target['route'])['parameters']:
            if param.get('from') != 'previous_record':
                continue
            refs = param.get('lookupPageRefs', [])
            matches = []
            for origin in candidates:
                if origin['candidateId'] == target['candidateId']:
                    continue
                records = page_routing(knowledge, origin['route'])['records']
                if origin['route'] in refs or any(
                        d.get('operationRef') == param.get('operationRef')
                        and d.get('sourcePath') == param.get('sourcePath')
                        and d.get('identityField') == param.get('identityField') for d in records):
                    matches.append(origin['candidateId'])
            result.append({'destinationCandidateId': target['candidateId'], 'parameterBindingId': param['bindingId'],
                'parameterName': param.get('name'), 'lookupOperation': param.get('operationRef'),
                'predecessorCandidateIds': matches, 'predecessorPurpose': 'locate_record', 'destinationPurpose': 'read_final'})
    return result


def bind_citation_schema(schema, documents, knowledge):
    """Per-call handles from the displayed, still-verifiable knowledge only."""
    from copy import deepcopy
    from .generic_reader import PipelineError
    from .generic_reader_contracts import Citation
    result = deepcopy(schema)
    visible = []
    for document in documents:
        for passage in document.get('passages', []):
            source_id = passage.get('sourceId')
            if not isinstance(source_id, str):
                continue
            ref = Citation(sourceId=source_id)
            source = knowledge.source(ref)
            if (source is None or passage.get('text') != knowledge.citation_text(ref)
                    or any(document.get(key) != source.get(key) for key in (
                        'sourceName', 'revision', 'verification', 'recordId',
                        'documentId', 'documentVersion', 'chunkId'))):
                continue
            try:
                knowledge.cite([ref], required=True, at='routing.visible_input')
            except PipelineError:
                continue
            visible.append(source_id)
    if visible:
        result['$defs']['Citation']['properties']['sourceId']['enum'] = sorted(set(visible))
    # Unknown conditions may explicitly carry []; only runtime decides when a
    # condition requires evidence. Never impose minItems=1 on every condition.
    condition = result['$defs']['CandidateCondition']
    condition['required'] = list(dict.fromkeys([*condition.get('required', []), 'evidence']))
    return result


def validate_visible_citations(decision, visible_ids):
    """The provider's dynamic enum is also enforced within this invocation."""
    allowed = set(visible_ids)
    for index, candidate in enumerate(decision.candidates):
        groups = [(candidate.evidence, f'/candidates/{index}/evidence')]
        groups.extend((condition.evidence, f'/candidates/{index}/conditions/{n}/evidence')
                      for n, condition in enumerate(candidate.conditions))
        for evidence, path in groups:
            for n, ref in enumerate(evidence):
                if ref.sourceId not in allowed:
                    fail('knowledge_citation_invalid', details={
                        'field': 'routing.visible_input', 'path': f'{path}/{n}/sourceId',
                        'visibleSourceCount': len(allowed),
                        'correction': 'This citation was not verified in this invocation visible input. '
                            'Re-read the supplied passages and use a complete visible ID only when '
                            'its text supports the same claim. A source from another request or an '
                            'undisplayed stored passage cannot supply this citation. Preserve the '
                            'original requirements, scope and unresolved gaps; do not guess IDs, '
                            'change condition facts or drop candidates to evade this check.'})


def _cite_at(knowledge, evidence, *, required, at, path, candidate_id, condition=None):
    """Add a bounded location to the original citation failure; never repair it."""
    from .generic_reader import PipelineError
    try:
        return knowledge.cite(evidence, required=required, at=at)
    except PipelineError as error:
        if error.code not in {'knowledge_citation_missing', 'knowledge_citation_invalid'}:
            raise
        details = dict(error.details)
        if error.code == 'knowledge_citation_invalid':
            index = next((i for i, ref in enumerate(evidence)
                          if ref.sourceId == details.get('sourceId')), None)
            if index is not None:
                path += f'/{index}/sourceId'
        details.update(path=path, candidateId=candidate_id)
        if condition is not None:
            details.update(requirementId=condition.requirementId, status=condition.status)
        details['correction'] = (
            'Repair this evidence location using complete source IDs from the visible passages. '
            'Each supported/conflict condition needs its own applicable evidence; candidate evidence '
            'does not substitute for it. Unknown conditions may retain an empty evidence list. '
            'Copying a valid ID does not establish semantic support. Preserve the original task, '
            'requirements and unresolved gaps; do not drop candidates, change scope or downgrade '
            'condition facts merely to evade citation validation. Never guess or silently relabel IDs.')
        raise PipelineError(error.code, error.category, details=details) from error


def validate_decision(decision, task, candidates, knowledge, *, current_page=None):
    if decision.taskFingerprint != task_fingerprint(task):
        fail("routing_task_version_mismatch", "runtime", details={
            "expectedTaskFingerprint": task_fingerprint(task), "correction": "Copy the supplied task fingerprint exactly; do not calculate or rewrite it."})
    recalled = {c["candidateId"]: c for c in candidates}
    required = {r["id"] for r in requirements_for(task)}
    evaluated = {}
    for candidate_index, item in enumerate(decision.candidates):
        if item.candidateId not in recalled or item.candidateId in evaluated:
            fail("routing_candidate_not_recalled", "runtime")
        _cite_at(knowledge, item.evidence, required=True, at="routing.candidate",
                 path=f"/candidates/{candidate_index}/evidence", candidate_id=item.candidateId)
        route = recalled[item.candidateId]["route"]
        if not any(route in knowledge.source(ref)["text"] for ref in item.evidence):
            fail("routing_page_evidence_missing")
        conditions = {c.requirementId: c for c in item.conditions}
        if len(conditions) != len(item.conditions) or set(conditions) != required:
            fail("routing_condition_coverage_invalid", "runtime")
        for condition_index, condition in enumerate(item.conditions):
            _cite_at(knowledge, condition.evidence, required=condition.status != "unknown",
                     at="routing.condition", path=f"/candidates/{candidate_index}/conditions/{condition_index}/evidence",
                     candidate_id=item.candidateId, condition=condition)
        evaluated[item.candidateId] = item
    if decision.decision in {"route", "probe"} and set(evaluated) != set(recalled):
        fail("routing_comparison_incomplete", "runtime")
    if (decision.decision == 'knowledge_gap' and evaluated and set(evaluated) == set(recalled)
            and any(any(c.requirementId == 'object' and c.status == 'supported'
                        for c in item.conditions) for item in evaluated.values())
            and all(any(c.requirementId == 'scope' and c.status == 'conflict' and c.evidence
                        for c in item.conditions) for item in evaluated.values())):
        fail('routing_scope_conflict_misclassified', 'planning', details={
            'correction': 'Every evaluated candidate has a cited scope conflict. This is requested scope unavailable, not absent knowledge. Use permission_denied with the existing citations; do not alter supported/conflict facts to evade the check.'})
    if decision.decision == 'permission_denied':
        # A denied scope is not an authentication failure or missing document.
        # Every relevant catalog candidate must have a cited scope conflict;
        # at least one must actually support the requested business object.
        if (set(evaluated) != set(recalled) or not evaluated or decision.routePlan or decision.clarification
                or not any(any(c.requirementId == 'object' and c.status == 'supported'
                               for c in item.conditions) for item in evaluated.values())
                or not all(any(c.requirementId == 'scope' and c.status == 'conflict' and c.evidence
                               for c in item.conditions) for item in evaluated.values())):
            fail('routing_scope_denial_unproven', 'planning', details={
                'correction': 'Use permission_denied only with an explicit cited scope conflict for every relevant candidate. Missing or unknown scope is knowledge_gap, not denial.'})
    if decision.decision == 'knowledge_gap' and task.needsLiveData and set(evaluated) == set(recalled):
        kinds = {r['id']: r['kind'] for r in requirements_for(task)}
        identity_kinds = {'object', 'grain', 'scope', 'population', 'record', 'view'}
        eligible = [cid for cid, item in evaluated.items()
            if any(c.requirementId == 'object' and c.status == 'supported' for c in item.conditions)
            and all(c.status == 'supported' for c in item.conditions if kinds[c.requirementId] in identity_kinds)]
        if eligible:
            fail('routing_available_evidence_not_probed', 'planning', details={
                'candidateIds': eligible,
                'correction': 'A cited candidate already supports the requested entity, identity and scope. '
                    'Missing business rules or output capabilities do not erase this readable evidence. '
                    'Use probe with a valid routePlan and all required identity lookup/parameter bindings. '
                    'Keep unsupported requirements unknown for final validation; do not invent a rule, '
                    'relax scope, execute writes, or claim the task is complete.'})
    if decision.decision in {"route", "probe"}:
        if not decision.routePlan or decision.clarification:
            fail("routing_plan_missing", "runtime")
        seen = set()
        for index, hop in enumerate(decision.routePlan):
            if hop.candidateId not in evaluated or hop.candidateId in seen:
                fail("routing_hop_invalid", "runtime", details={"allowedCandidateIds": sorted(evaluated),
                    "correction": "Use the exact evaluated candidateId; do not alter characters or repeat a candidate in this route."})
            seen.add(hop.candidateId)
            item = evaluated[hop.candidateId]
            intermediate = index < len(decision.routePlan) - 1
            if intermediate and (hop.purpose != "locate_record" or not task.recordIdentity):
                fail("routing_lookup_goal_required", "planning", {
                    "hasRecordIdentity": bool(task.recordIdentity),
                    "correction": ("This task has no supplied record identity. For a collection/list/count, choose the "
                        "documented collection page as the single read_final hop. Remove locate_record and the "
                        "unrequested per-record detail hop; a parameter binding is not a user-supplied identity. "
                        "Do not invent an identifier or silently choose one row." if not task.recordIdentity else
                        "Every intermediate hop must use purpose=locate_record and resolve the supplied record identity.")})
            if not intermediate and hop.purpose != "read_final":
                fail("routing_final_goal_required", "runtime", {"correction": "The last hop, including a single-hop route, must use purpose=read_final. It reads the answer source."})
            if not set(hop.requirementIds) <= required:
                fail("routing_hop_requirement_invalid", "runtime")
            # A lookup provides identity to the next hop, not the final detail.
            # Object/scope conflicts remain disqualifying on EVERY hop.
            relevant = {"object", "scope", "record"} if intermediate else required
            relevant |= set(hop.requirementIds)
            conditions = [c for c in item.conditions if c.requirementId in relevant]
            # Missing requested output capabilities do not authorize changing
            # the task, but may still allow a read-only probe of the right page.
            optional_capabilities = {r["id"] for r in requirements_for(task)
                                     if r["kind"] in {"measure", "attribute", "group", "filter", "time", "unresolved"}}
            conflicts = [c for c in conditions if c.status == "conflict" and c.requirementId not in optional_capabilities]
            if conflicts:
                fail("routing_condition_conflict", "planning", details={
                    "candidateId": hop.candidateId, "purpose": hop.purpose,
                    "requirementIds": [c.requirementId for c in conflicts],
                    "correction": "This proposed route contradicts its cited entity or scope. Do not relabel a conflict "
                        "as supported or reuse another entity's identifier. Choose a documented compatible lookup chain "
                        "with verified parameter bindings. If no such relationship is defined, use knowledge_gap with "
                        "the missing relationship and an empty routePlan. A planning conflict is not a failed service."})
            identity_status = {c.requirementId: c.status for c in item.conditions}
            hint = current_page or {}
            away_from_current = (hint.get("source") == "browser_hint" and hint.get("routeAuthorized") is True
                and hint.get("route") in {c["route"] for c in candidates}
                and hint.get("route") not in {recalled[h.candidateId]["route"] for h in decision.routePlan
                                             if h.candidateId in recalled})
            if (intermediate and away_from_current and identity_status.get("object") == "unknown"
                    and identity_status.get("grain") == "unknown"
                    and identity_status.get("record") != "supported"):
                fail("routing_lookup_entity_unproven", "planning", details={
                    "candidateId": hop.candidateId,
                    "correction": "A lookup chain away from the current recalled page needs a documented relationship to the requested entity or record. "
                        "Shared output fields do not establish that an unknown identifier belongs to another entity. "
                        "Re-read the cited object/grain/identity definitions without changing the task. Preserve "
                        "unknown conditions honestly; choose a documented compatible chain or knowledge_gap. "
                        "Unknown knowledge is not a permission denial. Supported entities may still be probed "
                        "for unknown output fields, and an ordinary single-page probe remains available."})
            if decision.decision == "route" and any(c.status != "supported" for c in conditions):
                fail("routing_requires_probe")
            definitions = page_routing(knowledge, recalled[hop.candidateId]["route"])["parameters"]
            known = {p["bindingId"] for p in definitions}
            if not set(hop.parameterBindingIds) <= known:
                fail("route_parameter_knowledge_missing", "runtime", details={"allowedBindingIds": sorted(known), "correction": "Use only these exact parameter binding IDs. If none are listed, use parameterBindingIds=[]. View/tab/filter definitions are not URL parameter bindings."})
            chosen = [d for d in definitions if d["bindingId"] in hop.parameterBindingIds]
            names = [d.get("name") for d in chosen]
            required_names = {d['name'] for d in definitions if d.get('required') is True and d.get('name')}
            if required_names - set(names):
                fail('route_required_parameter_missing', 'planning', details={
                    'candidateId': hop.candidateId, 'missingParameters': sorted(required_names - set(names)),
                    'allowedBindingIds': sorted(d['bindingId'] for d in definitions if d.get('name') in required_names),
                    'correction': 'Bind every required page entry parameter before route or probe execution. A previous_record binding requires a verified lookup predecessor; never open a parameterless detail page as a probe.'})
            if len(names) != len(set(names)):
                fail("route_parameter_binding_conflict", "runtime", details={
                    "correction": "Choose exactly one binding per URL parameter from the matching lookup operation. Bindings from different views/operations are alternatives, not parameters to execute together.",
                    "alternatives": [{k: d.get(k) for k in ("bindingId", "name", "operationRef")} for d in chosen]})
            current_bindings = [d for d in chosen if d.get("from") == "current_page"]
            if current_bindings:
                if len(decision.routePlan) != 1 or len(chosen) != 1:
                    fail("current_page_navigation_plan_invalid", "planning")
                from .reader_current_page import navigation_value
                navigation_value(task, recalled[hop.candidateId], current_bindings[0], current_page)
            if any(d.get("from") == "previous_record" for d in chosen) and index == 0:
                fail("routing_lookup_predecessor_required", "runtime", {
                    "lookupDependencies": lookup_dependencies(candidates, knowledge),
                    "correction": "Use one listed predecessorCandidateId as the first hop with no destination parameters, then destinationCandidateId with its parameterBindingId. These are different pages. A detail page cannot locate its own unknown ID. Re-evaluate both candidates without changing object/scope conflicts."})
            if intermediate:
                successor = decision.routePlan[index + 1]
                if successor.candidateId not in recalled:
                    fail("routing_hop_invalid", "runtime")
                next_definitions = page_routing(knowledge, recalled[successor.candidateId]["route"])["parameters"]
                next_chosen = [d for d in next_definitions if d["bindingId"] in successor.parameterBindingIds]
                if not any(d.get("from") == "previous_record" for d in next_chosen):
                    fail("routing_lookup_dependency_missing", "runtime", {"correction": "The lookup successor must select an available previous_record parameter binding; do not execute a lookup with no consumer.",
                         "availableBindingIds": [d["bindingId"] for d in next_definitions if d.get("from") == "previous_record"]})
    elif decision.routePlan:
        fail("routing_unexpected_plan", "runtime")
    if decision.decision == "clarify":
        if not decision.clarification:
            fail("routing_clarification_missing", "runtime")
        for field in decision.clarification.missingSlots:
            if getattr(task, field) not in ("", "unknown", []) and field not in task.unresolvedSlots:
                fail("clarification_repeats_known_condition", "runtime", details={
                    "knownSlot": field,
                    "correction": "This slot is already supplied in task and is not unresolved. "
                        "Use the complete task, including prior explicit conditions and purpose, "
                        "rather than only the latest message. Do not re-ask or narrow a known "
                        "condition to compensate for missing knowledge, field bindings, relationship "
                        "proof or authorization. Preserve those unknown requirements; probe only "
                        "an independently authorized compatible route, or return knowledge_gap. "
                        "Clarify only an actually unresolved user-decided condition."})
        for option in decision.clarification.options:
            if any(update.field not in decision.clarification.missingSlots for update in option.updates):
                fail("clarification_changes_unrelated_condition", "runtime")
    elif decision.clarification:
        fail("routing_unexpected_clarification", "runtime")


def _rows(source, path):
    from .generic_reader import pointer, PipelineError
    try:
        value = pointer(source["data"], path)
    except PipelineError:
        return []
    return value if isinstance(value, list) else [value] if isinstance(value, dict) else []


def locate_record(task, definitions, sources):
    from .generic_reader import pointer
    from .reader_record_request import validate_scalar_record_identity
    validate_scalar_record_identity(task.recordIdentity)
    matches = []
    for definition in definitions:
        if not definition.get("identityField") or not definition.get("keyFields"):
            continue
        for sid, source in sources.items():
            if source.get("operationRef") != definition.get("operationRef"):
                continue
            source_path = definition.get("sourcePath", "")
            rows = _rows(source, source_path)
            receipt = source.get("collectionReceipt") or {}
            complete = (receipt.get("completeness") == "complete"
                        and receipt.get("operationRef") == source.get("operationRef")
                        and receipt.get("rowsPath") == source_path
                        and receipt.get("rowCount") == len(rows)
                        and not source.get("truncated"))
            for row in rows:
                if not isinstance(row, dict):
                    continue
                if str(row.get(definition["identityField"], "")) != task.recordIdentity:
                    continue
                if any(key not in row or row[key] is None for key in definition["keyFields"]):
                    continue
                # A bounded page is not a complete list, even when transport did
                # not truncate it. Uniqueness needs knowledge or a checked scan.
                if not complete and definition.get("unique") is not True:
                    continue
                key = tuple(str(row[k]) for k in definition["keyFields"])
                single = (len(rows) == 1 and not source.get("truncated")
                          and (complete or isinstance(pointer(source["data"], source_path), dict)))
                matches.append((sid, key, row, definition, single))
    identities = {key for _, key, *_ in matches}
    if len(identities) != 1:
        return [], "record_ambiguous" if len(identities) > 1 else "record_not_verified"
    return matches, ""


def parameter_lookup_definitions(definitions, binding_ids):
    """Equivalent identifier fields may locate the same proven entity.

    Cross-operation alternatives require an explicit page-knowledge equivalence
    declaration. This applies only to identifier lookup, never aggregate scope.
    Row path, target parameter and key grain must still match. Only previously
    permitted, observed sources participate; conflicting entities fail closed.
    """
    from .reader_context import PRIVATE_KEY
    selected = [d for d in definitions if d['bindingId'] in binding_ids and d.get('from') == 'previous_record']
    def family(d):
        names = tuple(d.get(k) for k in ('name','from','operationRef','sourcePath','field'))
        keys = d.get('keyFields')
        if (not all(isinstance(n, str) and n for n in names) or not isinstance(keys, list)
                or not keys or not all(isinstance(k, str) and k for k in keys)):
            return None
        equivalence = d.get('lookupEquivalence')
        if isinstance(equivalence, str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,120}', equivalence):
            return ('declared_identity', equivalence, names[0], names[1], names[3], names[4], tuple(keys))
        return ('same_operation', *names, tuple(keys))
    families = {f for d in selected if (f := family(d)) is not None}
    return [d for d in definitions if family(d) in families and not any(
        PRIVATE_KEY.search(str(field)) for field in [d.get('identityField',''), d.get('field',''), *d.get('keyFields',[])])]


def bind_route(hop, candidate, task, knowledge, previous_sources=None, *, proof_out=None,
               current_page=None, principal_scope_ref=None, turn_ref=None):
    from .reader_context import PRIVATE_KEY
    definitions = page_routing(knowledge, candidate["route"])["parameters"]
    params = {}
    for bid in hop.parameterBindingIds:
        definition = next((d for d in definitions if d["bindingId"] == bid), None)
        if not definition or definition.get("name") not in candidate["parameters"]:
            fail("route_parameter_not_in_catalog")
        if any(PRIVATE_KEY.search(str(definition.get(key, ""))) for key in ("name", "field", "identityField")):
            fail("route_parameter_field_restricted", "permission")
        if definition.get("from") == "current_page":
            if len(hop.parameterBindingIds) != 1 or proof_out is None:
                fail("current_page_navigation_plan_invalid", "planning")
            from .reader_current_page import navigation_proof
            value, proof = navigation_proof(task, candidate, definition, current_page, principal_scope_ref, turn_ref)
            proof_out.update(proof)
        elif definition.get("from") == "recordIdentity":
            value = task.recordIdentity
        elif definition.get("from") == "previous_record":
            alternatives = parameter_lookup_definitions(definitions, [bid])
            matches, reason = locate_record(task, alternatives, previous_sources or {})
            values = {str(row.get(matched_definition.get("field"), "")) for _, _, row, matched_definition, _ in matches}
            if reason == "record_ambiguous" or len(values) > 1:
                fail("record_ambiguous", "clarification")
            if len(values) != 1:
                fail("route_record_mapping_unverified")
            value = values.pop()
            if proof_out is not None:
                _, key, _, definition, _ = matches[0]
                proof = {"identity": task.recordIdentity, "taskFingerprint": task_fingerprint(task),
                         "keys": dict(zip(definition["keyFields"], key))}
                if proof_out and any(proof_out.get(k) != v for k, v in proof.items()):
                    fail("route_record_mapping_conflict")
                proof_out.update(proof)
                proof_out['bindingIds'] = sorted(set(proof_out.get('bindingIds', [])) |
                    {d['bindingId'] for _, _, _, d, _ in matches})
        else:
            fail("route_parameter_source_invalid")
        if not value or definition["name"] in params:
            fail("route_parameter_value_unverified")
        params[definition["name"]] = value
    if set(candidate["parameters"]) - set(params):
        # Catalog query parameters may be optional; required ones are declared by knowledge.
        if any(d.get("required") and d.get("name") not in params for d in definitions):
            fail("route_required_parameter_missing")
    return candidate["route"] + (("?" + urlencode(params)) if params else "")


def source_view_proof(task, page, source, knowledge):
    """Resolve a data source's own view from active operation/context contracts.

    A visible selected tab proves the DOM view, not every API captured beside
    it. API names, roles, sample values and a model-supplied view label never
    establish this association. Unknown or conflicting definitions grant none.
    """
    from types import SimpleNamespace
    from .generic_reader import pointer, PipelineError
    from .reader_requirements import semantic_bindings, _semantic_match, _context_match
    from .reader_view_population import _active_records
    if (urlsplit(source.get('page', '')).path != page
            or source.get('kind') not in {'api_response', 'projected_collection'}
            or source.get('ready') is False or source.get('collectionFailure')
            or not source.get('principalScopeRef') or not source.get('capturedAt')):
        return None
    records = _active_records(knowledge)
    facts = semantic_bindings(knowledge)
    catalog = {fact['knowledgeBindingId']: fact for fact in facts}
    views = {view['id'] for view in page_routing(knowledge, page)['views']}
    candidates = []
    for record in records.values():
        payload = record.get('payload', {})
        view = payload.get('view')
        if (record.get('kind') != 'field_semantics' or view not in views
                or page not in record.get('applicability', {}).get('pageRefs', [])
                or payload.get('pageRef') != page):
            continue
        mapped = [fact for fact in facts if fact['recordId'] == record['id']
                  and fact['operationRef'] == source.get('operationRef')]
        objects = [fact for fact in mapped if fact['kind'] == 'object'
            and not fact.get('conditions') and _semantic_match(SimpleNamespace(
                knowledgeBindingId=fact['knowledgeBindingId'], fields=fact['fields'],
                sourcePath=fact['sourcePath']), {'kind': 'object', 'value': task.businessObject}, source, catalog)]
        for fact in objects:
            try:
                value = pointer(source.get('data', {}), fact['sourcePath'])
            except (PipelineError, KeyError, TypeError):
                continue
            if not isinstance(value, (list, dict)):
                continue
            contextual = [other for other in mapped if other['sourcePath'] == fact['sourcePath']
                          and 'contextParameters' in other]
            # A context-bearing contract cannot be bypassed by an unqualified
            # object alias in that same view document. Any accepted contextual
            # mapping must exactly match captured request evidence.
            matched = [other for other in contextual if _context_match(other, source)]
            if contextual and not matched:
                continue
            if 'contextParameters' in fact and not _context_match(fact, source):
                continue
            candidates.append({'view': view, 'recordId': record['id'], 'revision': record['revision'],
                'operationRef': fact['operationRef'], 'sourcePath': fact['sourcePath'],
                'objectBindingId': fact['knowledgeBindingId'],
                'contextBindingIds': sorted(other['knowledgeBindingId'] for other in matched)})
    if not candidates or len({candidate['view'] for candidate in candidates}) != 1:
        return None
    return {'authority': 'active_page_operation_context', 'page': page,
            'view': candidates[0]['view'], 'definitions': candidates}


def verify_route(task, requested, actual, observation, sources, knowledge, *, require_record=True, require_view=True,
                 bound_record=None, principal_scope_ref=None, turn_ref=None):
    from .reader_collection import projection_hash
    for source in sources.values():
        source.pop("verifiedRecord", None)
        source.pop("verifiedView", None)
        source.pop("sourceViewProof", None)
    observed_actual = observation.get("pageIdentity", {}).get("path") or actual
    path = urlsplit(requested).path
    same = urlsplit(observed_actual).path.rstrip("/") == path.rstrip("/")
    params = dict(parse_qsl(urlsplit(requested).query))
    actual_params = dict(parse_qsl(urlsplit(actual).query)) if urlsplit(actual).path == urlsplit(observed_actual).path else {}
    hashes = observation.get("pageIdentity", {}).get("parameterHashes", {})
    same = same and all(actual_params.get(k) == v or hashes.get(k) == projection_hash(v) for k,v in params.items())
    checks = [RouteCheck(requirementId="page", status="verified" if same else "mismatch", reason="" if same else "page_identity_mismatch")]
    normalize = lambda s: "".join(re.findall(r"\w+", str(s).casefold()))
    if task.view and require_view:
        aliases = {normalize(task.view)}
        from .reader_view_population import documented_view_identity
        view_identity = documented_view_identity(knowledge, path, task.view, task.businessObject)
        if view_identity:
            aliases.add(normalize(view_identity['id']))
        for view in page_routing(knowledge, path)["views"]:
            if normalize(view["id"]) in aliases:
                aliases.update(normalize(x) for x in [view.get("label", ""), *view.get("aliases", [])])
        controls = observation.get("tabControls", [])
        tabs = [t for t in controls if t.get("selected") is True]
        candidates = [t for t in controls if normalize(t.get("name", "")) in aliases]
        matched = False
        if len(candidates) == 1 and candidates[0].get("selected") is True:
            group = candidates[0].get("groupRef")
            matched = (sum(t.get("groupRef") == group for t in tabs) == 1
                       and all(t.get("groupRef") for t in tabs)) if group else len(tabs) == 1
        verified_sources = []
        if matched and same:
            canonical = view_identity['id'] if view_identity else next((view['id']
                for view in page_routing(knowledge, path)['views'] if normalize(view['id']) in aliases), task.view)
            for sid, source in sources.items():
                if (source.get('kind') in {'page_metrics', 'page_section'}
                        and source.get('operationRef') == 'permitted_page_observation'
                        and urlsplit(source.get('page', '')).path == path and source.get('ready', True)):
                    proof = {'authority': 'observed_selected_ui', 'page': path, 'view': canonical}
                else:
                    proof = source_view_proof(task, path, source, knowledge)
                if proof:
                    source['sourceViewProof'] = proof
                if proof and proof['view'] == canonical:
                    source['verifiedView'] = task.view
                    verified_sources.append(sid)
        checks.append(RouteCheck(requirementId="view", status="verified" if matched else "mismatch" if tabs else "unconfirmed",
                                 sourceIds=verified_sources, reason="" if matched else "requested_view_unverified"))
    if task.recordIdentity and require_record:
        definitions = page_routing(knowledge, path)["records"]
        current_navigation = (bound_record or {}).get("kind") == "current_page_navigation"
        if current_navigation:
            from .reader_current_page import current_page_record_matches
            matches, reason = current_page_record_matches(task, path, observation, sources, definitions,
                page_routing(knowledge, path)["parameters"], bound_record, principal_scope_ref, turn_ref)
            if not same:
                matches, reason = [], "current_page_parameter_unverified"
        else:
            matches, reason = locate_record(task, definitions, sources)
        # A non-unique display number can identify a detail object only through
        # a verified lookup, bound URL and matching returned entity keys.
        if (not current_navigation and not matches and same and bound_record and bound_record.get("identity") == task.recordIdentity
                and bound_record.get("taskFingerprint") == task_fingerprint(task)):
            from .generic_reader import pointer, PipelineError
            for definition in definitions:
                keys = definition.get("keyFields", [])
                if not keys or set(keys) != set(bound_record.get("keys", {})):
                    continue
                for sid, source in sources.items():
                    if source.get("operationRef") != definition.get("operationRef") or source.get("ready") is False:
                        continue
                    try:
                        row = pointer(source["data"], definition["sourcePath"])
                    except PipelineError:
                        continue
                    # Unrelated nested collections may be truncated while the
                    # exact returned record keys remain intact. This proves
                    # only this object; projections still validate every field
                    # and nested lists retain their bounded completeness.
                    if (isinstance(row, dict) and str(row.get(definition["identityField"], "")) == task.recordIdentity
                            and all(k in row and str(row[k]) == bound_record["keys"][k] for k in keys)):
                        matches.append((sid, tuple(str(row[k]) for k in keys), row, definition, True))
        checks.append(RouteCheck(requirementId="record", status="verified" if matches else "unconfirmed",
                                 sourceIds=list(dict.fromkeys(m[0] for m in matches)),
                                 reason="" if matches else reason if definitions else "record_binding_knowledge_missing"))
        for sid, _, _, definition, single in matches:
            sources[sid]["verifiedRecord"] = {"identity": task.recordIdentity, "field": definition["identityField"],
                                               "path": definition["sourcePath"], "single": single, "keyFields": definition.get("keyFields", [])}
    return RouteVerification(taskFingerprint=task_fingerprint(task), requestedRoute=requested, actualRoute=observed_actual,
                             checks=checks, passed=all(c.status == "verified" for c in checks))


def normalize_final_hop_role(decision):
    """The final hop is the answer source by position; semantic checks remain."""
    if decision.decision not in {'route', 'probe'} or not decision.routePlan or decision.routePlan[-1].purpose == 'read_final':
        return decision, False
    corrected = decision.model_copy(deep=True)
    corrected.routePlan[-1].purpose = 'read_final'
    return corrected, True
