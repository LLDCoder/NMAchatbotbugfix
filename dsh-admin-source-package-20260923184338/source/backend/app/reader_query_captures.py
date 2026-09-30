"""Read-scope captures for the same verified gateway pagination operation."""
from copy import deepcopy
import json
import re

from .reader_collection import checked_collections, projection_hash


def collection_query_capture(source_id, source, observation):
    """Called only after route/context/spec checks and source receipt installation.

    The timestamp is the actual completed collection, not a rewritten earlier
    UI observation. Scope labels are from this collection's gateway observation.
    """
    from .generic_reader import pointer, PipelineError
    from .reader_previous_answer import _aware_time, _public_value
    receipt = source.get('collectionReceipt') or {}
    context = source.get('collectionContext') or {}
    filters = observation.get('appliedFilters')
    health = observation.get('readHealth') or {}
    if (source.get('kind') != 'projected_collection' or source.get('collectionFailure')
            or source.get('truncated') is not False or source.get('completeness') != 'complete'
            or not source_id or not source.get('page') or not source.get('principalScopeRef')
            or not source.get('observationRef') or not _aware_time(source.get('capturedAt'))
            or source['capturedAt'] != receipt.get('finishedAt')
            or source.get('operationRef') != receipt.get('operationRef')
            or context.get('mode') != 'page_number_two_pass'
            or context.get('contextRef') != receipt.get('contextRef')
            or health.get('healthy') is not True
            or any(health.get(key) for key in ('failed', 'blocked', 'pending', 'uncertain'))
            or not isinstance(filters, list) or not _public_value(filters)):
        return None
    try:
        rows = pointer(source['data'], receipt.get('rowsPath', ''))
        total = pointer(source['data'], receipt.get('totalPath', ''))
    except (KeyError, PipelineError):
        return None
    verified = checked_collections([{**receipt, 'rows': rows}])[0]
    if verified.get('completeness') != 'complete' or type(total) is not int or verified.get('total') != total:
        return None
    return {'page': source['page'], 'capturedAt': source['capturedAt'],
            'bindingVerification': 'observed_current_session', 'appliedFilters': deepcopy(filters),
            'sourceId': source_id, 'principalScopeRef': source['principalScopeRef'],
            'observationRef': source['observationRef'], 'operationRef': source['operationRef'],
            'sourcePath': receipt['rowsPath'], 'collectionContextRef': receipt['contextRef'],
            'collectionReceiptHash': projection_hash(verified),
            'source': 'verified_gateway_collection_observation'}


def query_capture_matches(capture, ref):
    if capture.get('page') != ref.get('page') or capture.get('capturedAt') != ref.get('capturedAt'):
        return False
    if capture.get('source') == 'verified_gateway_collection_observation':
        return (all(capture.get(key) == ref.get(key) and bool(ref.get(key)) for key in
                    ('sourceId', 'principalScopeRef', 'observationRef'))
                and bool(capture.get('operationRef')) and bool(capture.get('sourcePath'))
                and all(re.fullmatch(r'[a-f0-9]{64}', str(capture.get(key) or '')) for key in
                        ('collectionContextRef', 'collectionReceiptHash')))
    return 'source' not in capture


def matching_query_captures(refs, audit):
    """Select each actual source's own capture, never all captures of its page."""
    page_captures = [capture for capture in audit.get('captures', [])
                     if capture.get('bindingVerification') == 'observed_current_session']
    source_captures = [capture for capture in audit.get('querySourceCaptures', [])
                       if capture.get('bindingVerification') == 'observed_current_session']
    selected = []
    for ref in refs:
        exact = [capture for capture in source_captures if query_capture_matches(capture, ref)]
        if not exact and any(capture.get('sourceId') == ref.get('sourceId')
                or (capture.get('page') == ref.get('page') and capture.get('capturedAt') == ref.get('capturedAt'))
                for capture in source_captures):
            return None
        choices = exact or [capture for capture in page_captures if query_capture_matches(capture, ref)]
        unique = {json.dumps(capture, sort_keys=True, ensure_ascii=False): capture for capture in choices}
        if len(unique) != 1:
            return None
        capture = deepcopy(next(iter(unique.values())))
        if capture not in selected:
            selected.append(capture)
    return selected
