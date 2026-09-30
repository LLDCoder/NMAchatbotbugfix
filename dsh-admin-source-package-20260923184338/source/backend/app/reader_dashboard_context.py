"""Carry applied Dashboard hints as constraints, never as observed facts."""
from urllib.parse import urlsplit
import json


def dashboard_read_context(page, current_page, user_id):
    if (urlsplit(page).path != '/dashboard' or not current_page
            or current_page.get('route') != '/dashboard'
            or not current_page.get('routeAuthorized')):
        return None
    filters = current_page.get('filters') or []
    if not filters:
        return None
    if not isinstance(user_id, str) or not user_id.strip():
        from .generic_reader import PipelineError
        raise PipelineError('dashboard_identity_unverified', 'permission')
    # Preserve the exact hint. Strict gateway validation rejects unknown,
    # duplicate, draft/custom and mismatched values instead of dropping them.
    return {'route': current_page['route'], 'view': current_page.get('view', ''),
            'filters': filters, 'userId': user_id,
            'browserTimezone': current_page.get('browserTimezone', 'UTC')}


def verify_dashboard_context(expected, observation, user_id):
    if expected is None:
        return
    from .generic_reader import PipelineError
    from .reader_collection import projection_hash
    receipt = observation.get('dashboardContextReceipt') or {}
    timezone_receipt = receipt.get('browserTimezone') or {}
    if (receipt.get('verified') is not True or receipt.get('route') != expected['route']
            or receipt.get('view') != expected['view']
            or receipt.get('principalHash') != projection_hash(user_id)
            or receipt.get('requestedFiltersHash') != projection_hash(expected['filters'])
            or receipt.get('sameOrigin') is not True
            or timezone_receipt.get('requested') != expected['browserTimezone']
            or not timezone_receipt.get('observed')
            or timezone_receipt.get('observed') != timezone_receipt.get('resolvedRequested')):
        raise PipelineError('dashboard_page_context_unverified', 'planning')


def verified_dashboard_display_context(expected, observation, user_id, captured_at):
    """Project bounded filters only after the gateway proved the actual markers."""
    if expected is None:
        return None
    verify_dashboard_context(expected, observation, user_id)
    from .reader_collection import projection_hash
    receipt = observation['dashboardContextReceipt']
    filters = expected.get('filters', [])
    if len(filters) != 3 or len({f.get('name') for f in filters}) != 3:
        return None
    values = {f.get('name'): f.get('value') for f in filters}
    if receipt.get('appliedFiltersHash') != projection_hash(values):
        return None
    try:
        period = json.loads(values['timeFilter'])
    except (KeyError, TypeError, ValueError):
        return None
    presets = {'last7': 7, 'last30': 30, 'last6Months': 180, 'lastYear': 365}
    if (not isinstance(period, dict) or set(period) != {'preset', 'days'}
            or period.get('preset') not in presets or type(period.get('days')) is not int
            or period['days'] != presets[period['preset']]
            or values.get('department') not in {'license', 'content', 'inspection', 'customer'}
            or values.get('roleVariant') not in {'manager', 'staff'}):
        return None
    return {'route': receipt['route'], 'capturedAt': captured_at,
            'department': values['department'], 'roleVariant': values['roleVariant'],
            'preset': period['preset'], 'days': period['days'],
            'browserTimezone': receipt['browserTimezone']['observed'],
            'appliedFiltersHash': receipt['appliedFiltersHash']}


def current_output_display_context(context, outputs):
    """Never attach a page capture to other-page, stale or withheld outputs."""
    if not context or not outputs:
        return None
    refs = [ref for output in outputs for ref in output.get('evidence', [])]
    if (not refs or any(not output.get('evidence') for output in outputs)
            or any(ref.get('page') != context['route'] or ref.get('capturedAt') != context['capturedAt']
                   for ref in refs)):
        return None
    return dict(context)
