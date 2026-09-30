"""Materialize complete JSON-text evidence without executing document content."""
import copy
import json
from .reader_collection import projection_hash


def materialize_documents(source):
    from .generic_reader import pointer, PipelineError, clean
    if source.get('kind') != 'api_response':
        return
    for document in source.get('structuredDocuments', []):
        path = document.get('path', '')
        if (document.get('encoding') != 'json' or document.get('completeness') != 'complete'
                or not isinstance(path, str) or not path.startswith('/')):
            continue
        try:
            raw = pointer(source['data'], path)
            receipt = source.get('fieldEvidence', {}).get(path, {})
            if (not isinstance(raw, str) or len(raw.encode()) > 128000
                    or receipt.get('status') != 'complete' or receipt.get('valueHash') != projection_hash(raw)):
                continue
            decoded = json.loads(raw)
            if (not isinstance(decoded, (dict, list)) or decoded != document.get('data')
                    or projection_hash(decoded) != document.get('contentHash') or clean(decoded) != decoded):
                continue
            parts = [p.replace('~1', '/').replace('~0', '~') for p in path[1:].split('/')]
            node = source['data']
            for part in parts[:-1]:
                node = node[int(part)] if isinstance(node, list) else node[part]
            key = int(parts[-1]) if isinstance(node, list) else parts[-1]
            node[key] = copy.deepcopy(decoded)
        except (PipelineError, ValueError, TypeError, KeyError, IndexError):
            continue
        source.setdefault('decodedDocuments', []).append({'path': path, 'encoding': 'json',
            'encodedValueHash': receipt['valueHash'], 'contentHash': document['contentHash']})
        def attest(value, suffix=''):
            source['fieldEvidence'][path + suffix] = {
                'status': 'null' if value is None else 'complete',
                'kind': 'array' if isinstance(value, list) else 'object' if isinstance(value, dict) else 'scalar',
                'valueHash': projection_hash(value)}
            if isinstance(value, dict):
                for k, v in value.items():attest(v, suffix + '/' + k.replace('~', '~0').replace('/', '~1'))
            elif isinstance(value, list):
                for i, v in enumerate(value):attest(v, suffix + '/' + str(i))
        attest(decoded)
