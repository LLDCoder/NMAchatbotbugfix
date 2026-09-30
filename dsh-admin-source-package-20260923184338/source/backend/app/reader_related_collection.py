"""Parent-owned collections attested by a reviewed gateway request contract.

Collections never become fake single records. A transport-origin capability and
all parent/request/array receipts are required before carrying object context.
"""
from enum import Enum
from urllib.parse import urlsplit
from .reader_collection import projection_hash


class _Origin(str, Enum):
    GATEWAY = 'gateway_related_collection'


def mark_gateway_collection(source, candidate):
    # Called only by source_inventory on the trusted gateway observation, never
    # on analysis/knowledge/model supplied metadata or upstream response data.
    receipt = candidate.get('relatedReadReceipt') or {}
    if (candidate.get('trigger') == 'verified_related_collection'
            and receipt.get('ownership') == 'request_parameter_collection'
            and receipt.get('verified') is True and receipt.get('contractVerified') is True):
        source['_relatedCollectionOrigin'] = _Origin.GATEWAY


def collection_proof(source, parent, parent_id):
    from .generic_reader import pointer, PipelineError
    proof, receipt = parent.get('verifiedRecord') or {}, source.get('relatedReadReceipt') or {}
    if (source.get('_relatedCollectionOrigin') is not _Origin.GATEWAY
            or receipt.get('ownership') != 'request_parameter_collection'
            or receipt.get('verified') is not True or receipt.get('contractVerified') is not True
            or not receipt.get('relationshipRef') or not receipt.get('contractHash')
            or receipt.get('responseKeyPath') is not None
            or receipt.get('operationKey') != source.get('operationRef')
            or receipt.get('parentOperationKey') != parent.get('operationRef')
            or not proof.get('single') or receipt.get('parentPath') != proof.get('path')
            or receipt.get('parentField') not in proof.get('keyFields', [])
            or not parent.get('principalScopeRef') or not parent.get('capturedAt') or not parent.get('observationRef')
            or any(source.get(k) != parent.get(k) for k in ('principalScopeRef', 'capturedAt', 'observationRef', 'page'))):
        return None
    try:
        parent_row = pointer(parent['data'], receipt['parentPath'])
        key = parent_row[receipt['parentField']]
        key_path = receipt['parentPath'] + '/' + receipt['parentField']
        key_receipt = parent.get('fieldEvidence', {}).get(key_path, {})
        path = receipt['collectionPath']
        rows = pointer(source['data'], path)
        array_receipt = source.get('fieldEvidence', {}).get(path, {})
        expected_path = receipt['operationKey'][4:].replace('{'+receipt['parameter']+'}', str(key))
    except (PipelineError, KeyError, TypeError):
        return None
    if (type(key) not in {int, str} or not isinstance(rows, list)
            or not all(isinstance(row, dict) for row in rows)
            or not receipt['operationKey'].startswith('GET ')
            or '{' in expected_path or urlsplit(expected_path).query
            or receipt.get('requestMethod') != 'GET' or receipt.get('requestPath') != expected_path
            or receipt.get('requestParameterHash') != projection_hash(key)
            or receipt.get('keyHash') != projection_hash(key)
            or receipt.get('parentValueHash') != projection_hash({receipt['parentField']: key})
            or key_receipt.get('status') != 'complete' or key_receipt.get('valueHash') != projection_hash(key)
            or array_receipt.get('status') != 'complete' or array_receipt.get('valueHash') != projection_hash(rows)):
        return None
    projection = [p for p in receipt.get('arrayProjections', []) if p.get('path') == path]
    if (len(projection) != 1 or projection[0].get('rowCount') != len(rows)
            or projection[0].get('projectedArrayHash') != projection_hash(rows)
            or not projection[0].get('sourceArrayHash') or not projection[0].get('fields')):
        return None
    return {'parentSourceId': parent_id, 'identity': proof.get('identity'),
            'path': path, 'relationshipRef': receipt['relationshipRef'],
            'contractHash': receipt['contractHash'], 'rowCount': len(rows)}


def bind_related_collections(sources):
    results = []
    for sid, source in sources.items():
        source.pop('verifiedRelatedCollection', None)
        matches = [p for pid, parent in sources.items()
                   if (p := collection_proof(source, parent, pid))]
        if len(matches) == 1:
            source['verifiedRelatedCollection'] = matches[0]
            results.append({'sourceId': sid, **matches[0]})
    return results


def collection_context_read(task, kind, parent_id, binding_path, binding_fields, sources, read, output):
    parent = sources.get(parent_id, {}); child = sources.get(read.sourceId, {})
    parent_proof = parent.get('verifiedRecord') or {}
    proof = collection_proof(child, parent, parent_id)
    return bool(proof and proof == child.get('verifiedRelatedCollection')
        and task and task.outputShape == 'detail' and task.recordIdentity == proof['identity']
        and task.requestedAttributes and not task.requestedMeasures and not task.groupBy
        and kind in {'object', 'grain'} and read.op == 'read_rows' and read.path == proof['path']
        and output.get('role') == 'detail' and isinstance(output.get('value'), list)
        and parent_proof.get('path') == binding_path and binding_fields
        and set(binding_fields) == set(parent_proof.get('keyFields', [])))


def collection_record_read(task, identity, sources, read, output):
    child = sources.get(read.sourceId, {})
    linked = child.get('verifiedRelatedCollection') or {}
    pid = linked.get('parentSourceId')
    parent = sources.get(pid, {}); proof = parent.get('verifiedRecord') or {}
    return bool(identity == linked.get('identity') and collection_context_read(
        task, 'object', pid, proof.get('path'), proof.get('keyFields'), sources, read, output))
