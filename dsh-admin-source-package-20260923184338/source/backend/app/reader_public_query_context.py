"""Keep public query explanations separate from verified business results.

This first version does not paraphrase internal claims. It carries complete
blocks allowed by the existing public renderer, or reports a display gap.
A content hash detects transport changes; it is never an authorization grant.
"""
from copy import deepcopy
from hashlib import sha256
import json

FIELDS = ('grain', 'population', 'filterScope')
SCHEMA = 'public-query-context/1'


def _hash(value):
    return sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                             separators=(',', ':')).encode()).hexdigest()


def _claims(context):
    for field in FIELDS:
        value = context.get(field)
        yield field, value.get('value') if isinstance(value, dict) else value
    for index, claim in enumerate(context.get('caveats') or []):
        yield f'caveats/{index}', claim.get('value') if isinstance(claim, dict) else claim


def _public_text(value, secrets=()):
    from .generic_reader import safe_text, _public_context_text
    from .reader_previous_answer import _public_value
    # Entire text or a gap. Do not strip a qualifier, technical word or suffix.
    return (isinstance(value, str) and bool(value) and safe_text(value, secrets) == value
            and _public_context_text(value) and _public_value(value))


def _items(context, authorized, secrets=()):
    return [{'path': path, 'claimHash': _hash(value),
             'status': 'available' if authorized and _public_text(value, secrets) else 'unavailable',
             **({'text': value} if authorized and _public_text(value, secrets) else {})}
            for path, value in _claims(context)]


def _result_binding(result):
    state = result.get('intentState') or {}
    rid = state.get('requestId')
    if (not rid or result.get('requestId', rid) != rid or not state.get('principalFingerprint')
            or not state.get('catalogVersion') or not result.get('taskFingerprint')
            or not result.get('outputs') or not result.get('queryReceipt')):
        return None
    return {'requestId': rid, 'principalScopeRef': state['principalFingerprint'],
            'catalogVersion': state['catalogVersion'], 'taskFingerprint': result['taskFingerprint'],
            'sourceHash': _hash({key: result.get(key) for key in (
                'context', 'outputs', 'queryReceipt', 'requirements', 'requirementCoverage',
                'completeness', 'snapshotScopeProof', 'observedPageContext')})}


def _sealed(value):
    return {**value, 'contentHash': _hash(value)}


def _stable(value, secrets=()):
    from .generic_reader import clean
    # Audit uses 60, finish 200, and previous-answer transport 1000. The
    # smallest real transport budget must preserve every complete claim.
    return clean(value, secrets, max_items=60) == value


def seal_public_context(result, secrets=()):
    """Record the current public policy; never add scope facts or completion."""
    binding = _result_binding(result)
    if not binding:
        return None
    items = _items(result.get('context') or {}, True, secrets)
    proof = _sealed({'schemaVersion': SCHEMA, 'origin': 'existing_public_renderer',
                     'sourceBinding': binding, 'items': items})
    return proof if _stable(proof, secrets) else None


def _projection_binding(projection):
    return _hash({key: projection.get(key) for key in (
        'sourceRequestId', 'principalScopeRef', 'catalogVersion', 'context', 'observedAt',
        'completeness', 'observedFilters', 'navigation', 'snapshotScopeProof',
        'snapshotScopeLabels', 'businessResultComplete', 'sourceMissing', 'unconfirmedRequirements')})


def _published_result_matches(result, original_answer):
    """An old hidden claim cannot gain authority from being in old context."""
    if not isinstance(original_answer, str) or not original_answer:
        return False
    from .generic_reader import render_generic_answer
    # No extraction by substring or keyword. Reconstruct the whole completed
    # public answer; unsupported historical renderings get explicit gaps.
    return any(render_generic_answer(result, language) == original_answer for language in ('en', 'ar'))


def project_public_context(previous, original_answer, projection):
    """Called only after the existing owner/page/query-receipt checks passed."""
    recorded = previous.get('publicQueryContext')
    expected = seal_public_context(previous)
    published = _published_result_matches(previous, original_answer)
    valid = (recorded == expected if recorded is not None else published)
    origin = ('recorded_public_context' if recorded is not None and valid else
              'completed_public_answer' if recorded is None and valid else 'public_context_unavailable')
    # Even a stored display proof must match the actual completed body. It
    # describes what the renderer permitted, not a license to invent a body.
    valid = valid and published
    if not valid:
        origin = 'public_context_unavailable'
    items = _items(projection.get('context') or {}, valid)
    missing = [item['path'] for item in items if item['status'] != 'available']
    value = _sealed({'schemaVersion': SCHEMA, 'origin': origin,
                     'projectionBindingHash': _projection_binding(projection),
                     'sourceBinding': _result_binding(previous),
                     'originalAnswerHash': _hash(original_answer),
                     'items': items, 'status': 'partial' if missing else 'complete',
                     'missing': missing,
                     'businessResultChanged': False, 'newScopeMeaningClaimed': False})
    if _stable(value):
        return value
    # Preserve an explicit gap without truncating source clauses to fit.
    return {'schemaVersion': SCHEMA, 'status': 'unavailable',
            'reason': 'public_context_transport_unavailable',
            'businessResultChanged': False, 'newScopeMeaningClaimed': False}


def checked_scope_context(projection):
    """Renderer rechecks whole values; no raw-context fallback on proof error."""
    context = projection.get('context') or {}
    public = {key: deepcopy(value) for key, value in context.items() if key not in (*FIELDS, 'caveats')}
    claims = dict(_claims(context))
    proof = projection.get('publicQueryContext') or {}
    if not isinstance(proof, dict):
        proof = {}
    body = {key: value for key, value in proof.items() if key != 'contentHash'}
    items = proof.get('items')
    binding = proof.get('sourceBinding') or {}
    if not isinstance(binding, dict):
        binding = {}
    valid = (proof.get('schemaVersion') == SCHEMA
             and proof.get('origin') in {'recorded_public_context', 'completed_public_answer', 'public_context_unavailable'}
             and proof.get('contentHash') == _hash(body)
             and binding.get('requestId') == projection.get('sourceRequestId')
             and binding.get('principalScopeRef') == projection.get('principalScopeRef')
             and binding.get('catalogVersion') == projection.get('catalogVersion')
             and proof.get('projectionBindingHash') == _projection_binding(projection)
             and proof.get('businessResultChanged') is False
             and proof.get('newScopeMeaningClaimed') is False
             and _stable(proof) and isinstance(items, list)
             and all(isinstance(item, dict) for item in items)
             and [item.get('path') for item in items] == list(claims))
    if valid:
        available = proof['origin'] != 'public_context_unavailable'
        expected = _items(context, available)
        missing = [item['path'] for item in expected if item['status'] != 'available']
        valid = (items == expected and proof.get('missing') == missing
                 and proof.get('status') == ('partial' if missing else 'complete'))
    if not valid:
        return public, list(claims)
    for item in items:
        if item['status'] != 'available':
            continue
        path = item['path']
        if path.startswith('caveats/'):
            public.setdefault('caveats', []).append(item['text'])
        else:
            public[path] = item['text']
    return public, list(proof['missing'])


def render_scope_gaps(paths, language):
    if not paths:
        return []
    ar = language == 'ar'
    names = {'grain': ('ما يمثله كل سجل', 'what each record represents'),
             'population': ('شروط السجلات المشمولة', 'which record-selection conditions applied'),
             'filterScope': ('شروط التصفية الكاملة', 'the full filtering conditions'),
             'caveats': ('بعض القيود الإضافية', 'some additional limitations')}
    keys = list(dict.fromkeys(path.split('/')[0] for path in paths))
    labels = [names[key][0 if ar else 1] for key in keys]
    return [('لم أتمكن من تقديم شرح كامل لـ: ' if ar else 'I could not provide a complete explanation of: ')
            + ('؛ ' if ar else '; ').join(labels) + '. '
            + ('تظل نتيجة الاستعلام السابقة والقيود المبينة أعلاه كما هي؛ ولا يؤكد هذا الشرح أي معلومات جديدة.' if ar else
               'The earlier query result and the limitations shown above are unchanged; this explanation confirms no new information.')]
