"""Verify subject-bound records and parent/property lineage without page rules."""
from urllib.parse import urlsplit
from .reader_collection import projection_hash


def bind_authenticated_records(knowledge, sources, user_id):
    """Knowledge names the mapping; trusted request/response receipts prove it.

    This is evidence narrowing only. It neither executes an operation nor grants
    permission. An object response by itself is not proof of the current subject.
    """
    from .generic_reader import PipelineError, pointer
    verified = []
    for sid, source in sources.items():
        if source.get('kind') != 'api_response' or not user_id:
            continue
        candidates = []
        for item in knowledge.items.values():
            record = item.get('record') or {}
            payload = record.get('payload') or {}
            binding, declaration = payload.get('sourceBinding') or {}, payload.get('authenticatedRecord') or {}
            if (record.get('status') != 'active' or record.get('kind') != 'field_semantics'
                    or urlsplit(source.get('page', '')).path not in record.get('applicability', {}).get('pageRefs', [])
                    or binding.get('operationRef') != source.get('operationRef') or declaration.get('subject') != 'user'):
                continue
            root, field, parameter = binding.get('sourcePath'), declaration.get('identityField'), declaration.get('requestField')
            if (not isinstance(root, str) or not root.startswith('/') or not isinstance(field, str)
                    or not field or '/' in field or '.' in field or not isinstance(parameter, str) or not parameter):
                continue
            try:
                parent = pointer(source['data'], root)
            except PipelineError:
                continue
            if not isinstance(parent, dict) or parent.get(field) != user_id:
                continue
            digest = projection_hash(user_id)
            receipt = source.get('fieldEvidence', {}).get(root.rstrip('/') + '/' + field, {})
            hashes = source.get('collectionContext', {}).get('parameterHashes', {})
            if receipt.get('status') != 'complete' or receipt.get('valueHash') != digest or hashes.get(parameter) != digest:
                continue
            candidates.append((root, field, parameter, record['id']))
        # Different parent mappings are not reconciled by retrieval order.
        if len({c[:3] for c in candidates}) != 1:
            continue
        root, field, parameter, rid = candidates[0]
        proof = {'single': True, 'path': root, 'field': field, 'identity': user_id,
                 'keyFields': [field], 'boundTo': 'authenticated_user', 'recordId': rid}
        prior = source.get('verifiedRecord')
        if prior and (prior.get('path') != root or prior.get('identity') != user_id):
            continue
        source['verifiedRecord'] = proof
        source['subjectParameterHashes'] = {parameter: {'reference': 'principal.user_id', 'valueHash': projection_hash(user_id)}}
        verified.append({'sourceId': sid, 'recordId': rid, 'sourcePath': root,
                         'requestField': parameter, 'identityField': field, 'boundTo': 'authenticated_user'})
    return verified


def bind_record_properties(knowledge, sources):
    """Compile declared sibling properties of an independently verified record.

    Only the same observed response can own the property. Whole-array receipts
    remain mandatory; the declaration cannot upgrade partial data or grant reads.
    """
    from .generic_reader import pointer, PipelineError
    verified = []
    for sid, source in sources.items():
        source.pop('verifiedProperties', None)
        parent = source.get('verifiedRecord') or {}
        if not parent.get('single'):
            continue
        candidates = {}
        conflicts = set()
        for item in knowledge.items.values():
            record = item.get('record') or {}; payload = record.get('payload') or {}
            if (record.get('status') != 'active' or record.get('kind') != 'field_semantics'
                    or urlsplit(source.get('page', '')).path not in record.get('applicability', {}).get('pageRefs', [])
                    or payload.get('sourceBinding', {}).get('operationRef') != source.get('operationRef')):
                continue
            for relation in payload.get('recordProperties', []):
                if not isinstance(relation, dict): continue
                path = relation.get('propertyPath', '')
                if (relation.get('relation') != 'response_owned_property' or relation.get('parentPath') != parent.get('path')
                        or set(relation.get('parentKeyFields', [])) != set(parent.get('keyFields', []))
                        or not isinstance(path, str) or not path.startswith('/') or path == parent.get('path')):
                    continue
                try: value = pointer(source['data'], path)
                except PipelineError: continue
                receipt = source.get('fieldEvidence', {}).get(path, {})
                if (not isinstance(value, list) or receipt.get('status') != 'complete'
                        or receipt.get('valueHash') != projection_hash(value)):
                    continue
                proof = {'parentPath': parent['path'], 'keyFields': parent['keyFields'],
                         'recordId': record['id'], 'recordIds': [record['id']]}
                previous = candidates.get(path)
                if previous:
                    # Several page documents can describe the same ownership.
                    # Provenance differences are not conflicting relationships.
                    if (previous['parentPath'] != proof['parentPath']
                            or set(previous['keyFields']) != set(proof['keyFields'])):
                        conflicts.add(path)
                    elif record['id'] not in previous['recordIds']:
                        previous['recordIds'].append(record['id'])
                else:
                    candidates[path] = proof
        proofs = {p: v for p, v in candidates.items() if p not in conflicts}
        if proofs:
            source['verifiedProperties'] = proofs
            verified.extend({'sourceId': sid, 'propertyPath': p, **v} for p, v in proofs.items())
    return verified


def property_of_record(source, path):
    parent = source.get('verifiedRecord') or {}
    root = parent.get('path', '')
    declared = source.get('verifiedProperties', {}).get(path, {})
    return bool(parent.get('single') and root and (
        path.startswith(root.rstrip('/') + '/') or (
            declared.get('parentPath') == root and declared.get('keyFields') == parent.get('keyFields'))))


def parent_property_context(task, requirement_kind, binding_path, binding_fields, source, read, output):
    """A complete property belongs to its independently verified single parent.

    This exception cannot turn child row counts into a parent entity count.
    Parent keys are internal evidence, never a required display column.
    """
    proof = source.get('verifiedRecord') or {}
    return bool(task and task.outputShape in {'detail', 'list'} and task.requestedAttributes
        and not task.requestedMeasures and not task.groupBy
        and requirement_kind in {'object', 'grain', 'scope', 'population'}
        and proof.get('single') and proof.get('path') == binding_path
        and binding_fields and set(binding_fields) == set(proof.get('keyFields', []))
        and read.op == 'read_rows' and property_of_record(source, read.path)
        and output.get('role') == 'detail' and isinstance(output.get('value'), list))


def bind_fresh_authenticated_records(knowledge, sources, user_id, *, page, captured_at, principal_scope_ref):
    """Bind only this read's current-page, same-principal response receipts.

    The caller provides the freshly generated capture marker from source_inventory;
    older or retained sources cannot acquire a new subject proof by replay.
    """
    if not captured_at or not principal_scope_ref or not page:
        return []
    fresh = {sid: source for sid, source in sources.items()
             if source.get('capturedAt') == captured_at
             and source.get('principalScopeRef') == principal_scope_ref
             and source.get('page') == page}
    return bind_authenticated_records(knowledge, fresh, user_id)
