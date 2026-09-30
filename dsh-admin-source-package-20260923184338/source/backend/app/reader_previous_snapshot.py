"""Carry already displayed snapshot context through a historical rephrasing.

The producer proves response dates and page markers. This consumer only checks
that the saved display still belongs to the reauthorized output references; it
never derives dates from a preset or treats browser hints as observed filters.
"""
from copy import deepcopy
from datetime import date
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def snapshot_history_display(previous, original_answer):
    """Return (valid, additions); invalid metadata blocks an unchanged rewrite."""
    outputs = previous.get('outputs') or []
    page_context = previous.get('observedPageContext')
    has_dates = any(output.get('snapshotResponseDates') for output in outputs)
    scope = previous.get('snapshotScopeProof')
    if page_context is None and not has_dates and scope is None:
        return True, {}
    # The server-owned completed turn must actually have displayed these facts.
    # A new UI hint, silently appended metadata, or changed panel/date pairing
    # cannot become part of an allegedly unchanged answer.
    from .generic_reader import render_generic_answer
    try:
        # When the completed result saved a read receipt, its independently
        # retained references must still match every output (including IDs).
        receipt = previous.get('queryReceipt')
        if receipt is not None:
            keys = ('page', 'capturedAt', 'observationRef', 'sourceId', 'principalScopeRef', 'completeness')
            expected_refs = [{k: ref[k] for k in keys if k in ref}
                             for output in outputs for ref in output.get('evidence', [])]
            if (not isinstance(receipt, dict) or receipt.get('schemaVersion') != 'observed-query-receipt/1'
                    or receipt.get('sourceRefs') != expected_refs):
                return False, {}
        if scope is not None:
            from .reader_snapshot_scope import project_snapshot_scope
            from .reader_collection import projection_hash
            state = previous.get('intentState') or {}
            if (not receipt or receipt.get('snapshotScopeProofHash') != projection_hash(scope)
                    or not scope.get('taskFingerprint')
                    or scope['taskFingerprint'] != previous.get('taskFingerprint')
                    or scope['taskFingerprint'] != state.get('taskFingerprint')
                    or project_snapshot_scope(scope, outputs) != scope):
                return False, {}
        for output in outputs:
            dates = output.get('snapshotResponseDates', [])
            if not isinstance(dates, list):
                return False, {}
            if not dates:
                continue
            refs = output.get('evidence') or []
            if (len(refs) != 1 or refs[0].get('observationShape') != 'object'
                    or not refs[0].get('fieldBinding')):
                return False, {}
            if len({d['parameter'] for d in dates}) != len(dates):
                return False, {}
            for item in dates:
                if (not isinstance(item['parameter'], str) or not item['parameter']
                        or not isinstance(item['date'], str)
                        or date.fromisoformat(item['date']).isoformat() != item['date']
                        or not isinstance(item['sourcePath'], str) or not item['sourcePath'].startswith('/')
                        or not re.fullmatch(r'[0-9a-f]{64}', item['valueHash'])):
                    return False, {}
        if page_context is not None:
            required = {'route', 'capturedAt', 'department', 'roleVariant', 'preset', 'days',
                        'browserTimezone', 'appliedFiltersHash'}
            if (not isinstance(page_context, dict) or set(page_context) != required
                    or page_context['route'] != '/dashboard'
                    or page_context['department'] not in {'license', 'content', 'inspection', 'customer'}
                    or page_context['roleVariant'] not in {'manager', 'staff'}
                    or type(page_context['days']) is not int
                    or {'last7': 7, 'last30': 30, 'last6Months': 180, 'lastYear': 365}.get(page_context['preset']) != page_context['days']
                    or not re.fullmatch(r'[0-9a-f]{64}', page_context['appliedFiltersHash'])):
                return False, {}
            ZoneInfo(page_context['browserTimezone'])
            from .reader_dashboard_context import current_output_display_context
            if not current_output_display_context(page_context, outputs):
                return False, {}
            # A single page-marker receipt cannot describe mixed observations.
            refs = [ref for output in outputs for ref in output.get('evidence', [])]
            if len({ref.get('observationRef') for ref in refs}) != 1:
                return False, {}
        if (not isinstance(original_answer, str) or not any(
                original_answer.strip() == render_generic_answer(previous, language).strip()
                for language in ('en', 'ar'))):
            return False, {}
    except (KeyError, TypeError, ValueError, ZoneInfoNotFoundError):
        return False, {}
    additions = {'observedPageContext': deepcopy(page_context)} if page_context is not None else {}
    if scope is not None:
        additions['snapshotScopeProof'] = deepcopy(scope)
        additions['snapshotScopeLabels'] = {o['id']: {'label': o['label'],
            'fieldLabels': deepcopy(o.get('fieldLabels') or {})} for o in outputs}
    return True, additions


def render_snapshot_response_dates(dates, ar, literal):
    """Called under each output, never combined into a whole-query interval."""
    labels = {'startDate': ('Start date', 'تاريخ البداية'), 'endDate': ('End date', 'تاريخ النهاية'),
              'from': ('From', 'من'), 'to': ('To', 'إلى')}
    prefix = 'تواريخ الاستجابة السابقة لهذه اللوحة: ' if ar else 'Earlier response dates for this panel: '
    return prefix + '; '.join(labels.get(item['parameter'], ('Response date', 'تاريخ الاستجابة'))[int(ar)]
                             + ' ' + literal(item['date']) for item in dates) + '.'


def render_historical_page_context(context, ar, literal):
    departments = {'license': ('Licensing', 'التراخيص'), 'content': ('Content', 'المحتوى'),
                   'inspection': ('Inspection', 'التفتيش'), 'customer': ('Customer happiness', 'سعادة المتعاملين')}
    roles = {'manager': ('Manager', 'المدير'), 'staff': ('Staff', 'الموظف')}
    department = departments[context['department']][int(ar)]
    role = roles[context['roleVariant']][int(ar)]
    days, zone = context['days'], literal(context['browserTimezone'])
    return (f'مرشحات الصفحة في الإجابة السابقة: {department}؛ عرض {role}؛ آخر {days} أيام؛ المنطقة الزمنية للمتصفح: {zone}.' if ar else
            f'Earlier page filters: {department}; {role} view; Last {days} days; browser timezone: {zone}.')
