"""Recall prerequisites from loaded definitions, without selecting or executing a route."""
from .reader_routing import page_routing, fail


def _identity_contract(definition):
    from .reader_context import PRIVATE_KEY
    keys = definition.get('keyFields')
    fields = [definition.get('identityField'), *(keys if isinstance(keys, list) else [])]
    if (not isinstance(keys, list) or not keys or len(keys) != len(set(map(str, keys)))
            or not all(isinstance(field, str) and field and not PRIVATE_KEY.search(field) for field in fields)
            or not isinstance(definition.get('operationRef'), str) or not definition['operationRef']
            or not isinstance(definition.get('sourcePath'), str) or not definition['sourcePath'].startswith('/')):
        return None
    return (definition['operationRef'], definition['sourcePath'], definition['identityField'], tuple(keys))


def catalog_lookup_requirements(task, pool, knowledge, current_page=None):
    """Only an authorized catalog entry and matching active typed records create an edge.

    Alternatives for the same entry parameter are OR choices. The model still
    selects the candidates and must justify every semantic condition later.
    Missing, conflicted or subsequently changed knowledge supplies no new edge.
    """
    from .reader_current_page import navigation_value
    from .generic_reader import PipelineError
    from .reader_context import PRIVATE_KEY
    if not task.recordIdentity or not task.needsLiveData or not task.readOnly:
        return []
    routing = {c['candidateId']: page_routing(knowledge, c['route']) for c in pool}
    result = []
    for target in pool:
        definitions = routing[target['candidateId']]['parameters']
        names = sorted({p['name'] for p in definitions if p.get('required') is True
                        and isinstance(p.get('name'), str) and p['name'] in target.get('parameters', [])
                        and not PRIVATE_KEY.search(p['name'])})
        for name in names:
            choices = [p for p in definitions if p.get('name') == name]
            direct = False
            for param in choices:
                if param.get('from') == 'recordIdentity':
                    direct = True  # Existing later scalar/parameter/identity guards still apply.
                elif param.get('from') == 'current_page':
                    try:
                        navigation_value(task, target, param, current_page)
                        direct = True
                    except PipelineError:
                        pass
            if direct:
                continue
            alternatives = []
            for param in choices:
                if param.get('from') != 'previous_record':
                    continue
                contract = _identity_contract(param)
                refs = param.get('lookupPageRefs', [])
                valid = (contract is not None and isinstance(param.get('field'), str)
                         and bool(param['field']) and not PRIVATE_KEY.search(param['field'])
                         and isinstance(refs, list) and all(isinstance(ref, str) and ref.startswith('/') for ref in refs))
                # Duplicate binding IDs with disagreeing definitions cannot establish an edge.
                valid = valid and all(other == param for other in definitions
                                      if other.get('bindingId') == param['bindingId'])
                matches = []
                if valid:
                    for origin in pool:
                        if (origin['candidateId'] == target['candidateId']
                                or (refs and origin['route'] not in refs)):
                            continue
                        records = routing[origin['candidateId']]['records']
                        matched = [r for r in records if _identity_contract(r) == contract]
                        if any(all(other == record for other in records
                                   if other.get('bindingId') == record['bindingId']) for record in matched):
                            matches.append(origin['candidateId'])
                alternatives.append({'parameterBindingId': param['bindingId'],
                    'predecessorCandidateIds': sorted(set(matches)),
                    'status': 'available' if matches else 'unknown'})
            if alternatives:
                result.append({'destinationCandidateId': target['candidateId'], 'parameterName': name,
                    'alternatives': alternatives,
                    'status': 'available' if any(a['predecessorCandidateIds'] for a in alternatives) else 'unknown'})
    return result


def validate_catalog_lookup_recall(recall, requirements):
    """Use the existing recall correction budget; never append, drop or execute candidates."""
    selected = set(recall.candidateIds)
    groups = {}
    for item in requirements:
        groups.setdefault(item['destinationCandidateId'], []).append(item)

    def grounded(candidate_id, trail):
        # Match the existing route's maximum three distinct hops. Unknown
        # knowledge is not a proven terminal; it also is not permission denial.
        if candidate_id in trail or len(trail) >= 3:
            return False
        outcomes = []
        for item in groups.get(candidate_id, []):
            if item['status'] != 'available':
                outcomes.append(None)
                continue
            origins = {cid for alternative in item['alternatives']
                       for cid in alternative['predecessorCandidateIds']}
            values = [grounded(cid, (*trail, candidate_id)) for cid in origins & selected]
            outcomes.append(True if True in values else (None if None in values else False))
        return False if False in outcomes else (None if None in outcomes else True)

    missing = [cid for cid in recall.candidateIds if grounded(cid, ()) is False]
    if missing:
        fail('catalog_lookup_predecessor_required', 'planning', {
            'candidateIds': missing,
            'lookupRequirements': requirements,
            'correction': 'Re-select at most five supplied catalog candidateIds for the entire unchanged task. '
                'A selected detail with an available required previous_record dependency needs a selected '
                'predecessor. Alternatives for one parameter are OR choices; retain a non-cyclic chain of '
                'at most three distinct pages. Do not infer a relationship from a number prefix or change '
                'object, scope, record identity or requested outputs to fit the candidates. Unknown '
                'dependencies are missing evidence, not permissions or verified values. These candidates '
                'only guide recall; all routing conditions and fresh source proofs remain required.'})
