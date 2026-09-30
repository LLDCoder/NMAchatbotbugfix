"""Complete zero-input calculation witnesses, stored below audit depth limits.

These are presentation receipts after the existing history owner/page checks.
They never authorize a query, make an old value current, or certify new data.
"""
from copy import deepcopy
import re

SCHEMA = 'previous-public-derived-empty/1'


def empty_derivation(value):
    """Recognize complete, bounded metadata for an already verified empty input."""
    from .reader_previous_answer import _aware_time
    from .reader_previous_display import _hash
    if (not isinstance(value, dict) or set(value) != {'kind', 'definitions', 'inputFields',
            'referenceUtc', 'fieldDiagnostics', 'snapshotIsolation', 'inputProjectionHash'}
            or value['kind'] != 'fixed_reference_computation'
            or not _aware_time(value['referenceUtc'])
            or type(value['snapshotIsolation']) is not bool
            or value['inputProjectionHash'] != _hash([])):
        return False
    definitions, fields, diagnostics = value['definitions'], value['inputFields'], value['fieldDiagnostics']
    if (not isinstance(definitions, list) or not 1 <= len(definitions) <= 8
            or not isinstance(fields, list) or not 1 <= len(fields) <= 64
            or any(not isinstance(f, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.]{0,99}', f) for f in fields)
            or len(set(fields)) != len(fields) or not isinstance(diagnostics, dict)):
        return False
    names = []
    for definition in definitions:
        if (not isinstance(definition, dict) or set(definition) != {'field', 'recordId', 'revision', 'documentId', 'definitionHash'}
                or any(not isinstance(definition[k], str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,150}', definition[k])
                       for k in ('field', 'recordId', 'documentId'))
                or type(definition['revision']) is not int or definition['revision'] < 1
                or not isinstance(definition['definitionHash'], str)
                or not re.fullmatch(r'[0-9a-f]{64}', definition['definitionHash'])):
            return False
        names.append(definition['field'])
    # A computed field is an output, not necessarily one of its input columns.
    if len(set(names)) != len(names) or set(diagnostics) != set(names):
        return False
    return all(isinstance(row, dict) and set(row) == {'computedRows', 'unverifiedRows', 'documentedNullRows'}
               and all(type(v) is int and v == 0 for v in row.values()) for row in diagnostics.values())


def _flatten(value):
    """Path nodes keep real scalar values; no opaque or truncated JSON strings."""
    nodes = []
    def walk(v, path):
        if path.count('/') > 16: raise ValueError('too_deep')
        if isinstance(v, dict):
            if any(not isinstance(k, str) for k in v): raise ValueError('invalid_key')
            nodes.append([path, 'object', None])
            for k in sorted(v): walk(v[k], path + '/' + k.replace('~', '~0').replace('/', '~1'))
        elif isinstance(v, list):
            nodes.append([path, 'array', None])
            for i, item in enumerate(v): walk(item, path + '/' + str(i))
        elif v is None or type(v) in (str, bool, int):
            nodes.append([path, 'scalar', v])
        else:
            raise ValueError('invalid_scalar')
        if len(nodes) > 1800: raise ValueError('too_many_nodes')
    walk(value, '')
    return [nodes[i:i + 100] for i in range(0, len(nodes), 100)]


def _restore(pages):
    if (not isinstance(pages, list) or not 1 <= len(pages) <= 18
            or any(not isinstance(page, list) or not 1 <= len(page) <= 100 for page in pages)):
        raise ValueError('invalid_pages')
    containers, root = {}, None
    for page in pages:
        for node in page:
            if not isinstance(node, list) or len(node) != 3: raise ValueError('invalid_node')
            path, kind, value = node
            if not isinstance(path, str) or len(path) > 1000 or path in containers: raise ValueError('invalid_path')
            if kind == 'object' and value is None: item = {}
            elif kind == 'array' and value is None: item = []
            elif kind == 'scalar' and (value is None or type(value) in (str, bool, int)): item = value
            else: raise ValueError('invalid_kind')
            if path == '':
                if root is not None or kind != 'object': raise ValueError('invalid_root')
                root = item
            else:
                parent_path, raw_key = path.rsplit('/', 1)
                parent = containers[parent_path]
                key = raw_key.replace('~1', '/').replace('~0', '~')
                if isinstance(parent, list):
                    if raw_key != str(len(parent)): raise ValueError('invalid_index')
                    parent.append(item)
                elif isinstance(parent, dict):
                    if key in parent: raise ValueError('duplicate_key')
                    parent[key] = item
                else: raise ValueError('invalid_parent')
            containers[path] = item
    if _flatten(root) != pages: raise ValueError('noncanonical_nodes')
    return root


def wrap_derived_display(projection, display, source):
    from .generic_reader import clean
    from .reader_previous_display import _hash
    try:
        payload = {'projection': deepcopy(projection), 'display': deepcopy(display), 'source': deepcopy(source)}
        from .service import DSHService
        # Flattening must not bypass field-name credential redaction. Refuse
        # inputs that either original sanitizer would change before encoding.
        if clean(payload, max_items=1000) != payload or DSHService.audit_payload(payload, max_depth=32) != payload:
            return None
        proof = {'schemaVersion': SCHEMA, 'sourceNodes': _flatten(payload), 'contentHash': _hash(payload)}
        # The actual DB audit boundary is stricter than generic clean(). Test
        # the real function, not a parallel sanitizer that could drift.
        carrier = {'previousAnswer': {'publicDisplayProof': proof}}
        if clean(carrier, max_items=200) != carrier or DSHService.audit_payload(carrier) != carrier:
            return None
        return proof
    except (ValueError, TypeError, KeyError, AttributeError):
        return None


def restore_derived_display(projection):
    from .reader_previous_display import _hash, _display_contract
    from .reader_public_rewrite import compile_rewrite, SOURCE_KEY
    from .service import DSHService
    try:
        proof = projection['publicDisplayProof']
        if set(proof) != {'schemaVersion', 'sourceNodes', 'contentHash'} or proof['schemaVersion'] != SCHEMA:
            return None
        payload = _restore(proof['sourceNodes'])
        if set(payload) != {'projection', 'display', 'source'} or _hash(payload) != proof['contentHash']:
            return None
        original = payload['projection']
        current = {k: v for k, v in projection.items() if k != 'publicDisplayProof'}
        if ('publicDisplayProof' in original or SOURCE_KEY in original
                or current not in (original, DSHService.audit_payload({'previousAnswer': original})['previousAnswer'])):
            return None
        display = payload['display']
        if display.get('schemaVersion') != 'previous-public-empty-display/2':
            return None
        if _display_contract(original, '\n'.join(display['sourceAnswerLines']), display['sourceLanguage']) != display:
            return None
        restored = deepcopy(original)
        rewritten = compile_rewrite(original, display, payload['source'], structured=True)
        restored['publicDisplayProof'] = rewritten or display
        if rewritten: restored[SOURCE_KEY] = payload['source']
        return restored
    except (ValueError, TypeError, KeyError, AttributeError):
        return None
