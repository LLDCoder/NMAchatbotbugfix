"""Attest a service-reference name match without exposing arbitrary source strings."""
from urllib.parse import urlsplit


def verified_service_reference_matches(task, knowledge, sources, *, verified_source_ids,
                                       principal_ref, captured_at):
    from .generic_reader import pointer, row_scalar, PipelineError
    from .reader_bindings import applicable_bindings, verified_scalar_keys
    from .reader_routing import task_fingerprint
    if not task.recordIdentity or not principal_ref or not captured_at:
        return []
    facts = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    matches = []
    for item in knowledge.items.values():
        record = item.get('record') or {}
        payload = record.get('payload')
        guidance = payload.get('serviceReferenceGuidance') if isinstance(payload, dict) else None
        if not isinstance(guidance, dict):
            continue
        binding_id = guidance.get('matchBindingId')
        if not isinstance(binding_id, str):
            continue
        fact = facts.get(binding_id)
        if (not fact or fact['recordId'] != record.get('id') or fact['kind'] != 'attribute'
                or len(fact['fields']) != 1):
            continue
        field = fact['fields'][0]
        for sid in fact['contextVerifiedSourceIds']:
            source = sources[sid]
            proof = source.get('verifiedRecord') or {}
            if (sid not in verified_source_ids or source.get('kind') != 'api_response'
                    or source.get('principalScopeRef') != principal_ref
                    or source.get('capturedAt') != captured_at or not source.get('observationRef')
                    or source.get('taskFingerprint') != task_fingerprint(task)
                    or not proof.get('single') or proof.get('identity') != task.recordIdentity
                    or proof.get('path') != fact['sourcePath'] or not proof.get('field')
                    or not proof.get('keyFields')
                    or urlsplit(source.get('page', '')).path not in
                        record.get('applicability', {}).get('pageRefs', [])):
                continue
            required_fields = [field, proof['field'], *proof['keyFields']]
            if not verified_scalar_keys(source, fact['sourcePath'], required_fields):
                continue
            try:
                row = pointer(source['data'], fact['sourcePath'])
                if row_scalar(row, proof['field']) != task.recordIdentity:
                    continue
                value = row_scalar(row, field)
            except (PipelineError, KeyError, TypeError):
                continue
            if not isinstance(value, str) or not value or len(value) > 300:
                continue
            references = guidance.get('references', [])
            if not isinstance(references, list):
                continue
            found = [(i, r) for i, r in enumerate(references) if isinstance(r, dict)
                     and isinstance(r.get('serviceNames'), list) and value in r['serviceNames']]
            if len(found) != 1:
                continue
            index, _ = found[0]
            matches.append({'recordId': record['id'], 'recordRevision': record['revision'],
                'referenceIndex': index, 'knowledgeBindingId': binding_id,
                'matchedServiceName': value, 'sourceId': sid, 'sourcePath': fact['sourcePath'],
                'field': field, 'observationRef': source['observationRef'],
                'capturedAt': captured_at, 'taskFingerprint': source['taskFingerprint'],
                'historicalApplicabilityVerified': False, 'satisfiesRequestedRule': False})
    # A display identity/name is not a unique entity proof. Even within one
    # observation, two validated sources may attest different internal keys.
    # Do not choose by arrival order or deduplicate on the reference name.
    return matches if len(matches) == 1 else []
