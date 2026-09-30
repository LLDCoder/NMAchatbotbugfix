"""Bounded calendar/interval execution. Field meaning and source timezone are KB facts."""
from datetime import datetime, timedelta, timezone
import re
from zoneinfo import ZoneInfo


def interval_for(expression, reference):
    from .generic_reader import PipelineError
    try:
        zone = ZoneInfo(reference['businessTimezone'])
        now = datetime.fromisoformat(reference['nowUtc'].replace('Z', '+00:00'))
        if now.tzinfo is None:
            raise ValueError()
        now = now.astimezone(zone)
    except (KeyError, TypeError, ValueError) as exc:
        raise PipelineError('time_reference_unverified', 'execution_configuration') from exc
    text = re.sub(r'\s+', ' ', expression.strip().casefold())
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if text in {'today', 'yesterday', 'tomorrow'}:
        start = day + timedelta(days={'today': 0, 'yesterday': -1, 'tomorrow': 1}[text])
        end = start + timedelta(days=1)
    elif text in {'this week', 'current week', 'last week', 'this month', 'current month', 'last month',
                  'this year', 'current year', 'last year'}:
        if text.endswith('week'):
            start = day - timedelta(days=day.weekday()); end = start + timedelta(days=7)
        elif text.endswith('month'):
            start = day.replace(day=1)
            end = start.replace(year=start.year + (start.month == 12), month=start.month % 12 + 1)
        else:
            start = day.replace(month=1, day=1); end = start.replace(year=start.year + 1)
        if text.startswith('last '):
            end = start
            if text.endswith('week'):
                start -= timedelta(days=7)
            elif text.endswith('month'):
                start = start.replace(year=start.year - (start.month == 1), month=(start.month - 2) % 12 + 1)
            else:
                start = start.replace(year=start.year - 1)
    elif match := re.fullmatch(r'(?:within (?:the )?)?(next|last|past|previous) (\d{1,4}) (hours?|days?|weeks?)', text):
        direction, raw, unit = match.groups(); amount = int(raw)
        if not 1 <= amount <= 3660:
            raise PipelineError('time_interval_out_of_bounds', 'engine_capability_gap')
        span = timedelta(**{unit.rstrip('s') + 's': amount})
        start, end = (now, now + span) if direction == 'next' else (now - span, now)
        if unit.startswith('hour'):
            edge = (now.astimezone(timezone.utc) + (span if direction == 'next' else -span)).astimezone(zone)
            start, end = (now, edge) if direction == 'next' else (edge, now)
    elif match := re.fullmatch(r'(\d{4}-\d{2}-\d{2})(?:\s+(?:to|through)\s+|/)(\d{4}-\d{2}-\d{2})', text):
        try:
            start = datetime.fromisoformat(match[1]).replace(tzinfo=zone)
            # Explicit date-to-date ranges include the named last calendar day.
            end = datetime.fromisoformat(match[2]).replace(tzinfo=zone) + timedelta(days=1)
        except ValueError as exc:
            raise PipelineError('time_interval_invalid', 'runtime') from exc
    else:
        raise PipelineError('time_expression_unsupported', 'engine_capability_gap',
                            details={'correction': 'Use a supported calendar expression or explicit YYYY-MM-DD to YYYY-MM-DD range without changing the requested dates.'})
    if end <= start:
        raise PipelineError('time_interval_invalid', 'runtime')
    return {'expression': expression, 'start': start.isoformat(), 'end': end.isoformat(),
            'startInclusive': True, 'endInclusive': False, 'businessTimezone': str(zone),
            'referenceUtc': reference['nowUtc']}


def timestamp(value, definition):
    """Unknown/ambiguous timestamps stay unknown; never use the machine timezone."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            name = definition.get('sourceTimezone')
            if not name:
                return None
            zone = ZoneInfo(name)
            if len(value) == 10 and definition.get('dateOnlyBoundary') == 'end_of_day':
                parsed += timedelta(days=1, microseconds=-1)
            candidate = parsed.replace(tzinfo=zone)
            # Reject ambiguous or nonexistent wall-clock instants around DST.
            if candidate.utcoffset() != parsed.replace(tzinfo=zone, fold=1).utcoffset():
                return None
            if candidate.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != parsed:
                return None
            parsed = candidate
        return parsed
    except (ValueError, TypeError, KeyError):
        return None


def filter_interval(rows, field, definition, interval):
    start, end = (datetime.fromisoformat(interval[k]) for k in ('start', 'end'))
    kept, unknown = [], 0
    for row in rows:
        value = timestamp(row.get(field), definition)
        if value is None:
            unknown += 1
        elif start <= value < end:
            kept.append(row)
    return kept, unknown
