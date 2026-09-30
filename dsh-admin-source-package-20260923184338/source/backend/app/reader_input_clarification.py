"""Clarify unidentified input without acquiring unrelated business knowledge.

Examples describe authorized page reads, not role capabilities or live facts.
No vocabulary of business entities, roles, routes or nonsense strings is used.
"""
from .generic_reader_contracts import ClarificationRequest


def _has_subject_or_constraint(value):
    return (value.get('businessObject') not in {None, '', 'unknown'}
            or value.get('businessFocus') not in {None, '', 'unknown'}
            or value.get('timeRange') not in {None, '', 'unknown'}
            or any(value.get(key) for key in (
                'recordIdentity', 'requestedAttributes', 'requestedMeasures',
                'filters', 'groupBy', 'requestedOrdering', 'timeField', 'view')))


def needs_input_clarification(task, history):
    """Retain meaningful bound follow-ups, including bare IDs and constraints."""
    if not task.clarification or not task.readOnly or _has_subject_or_constraint(task.model_dump()):
        return False
    previous = (history or {}).get('previousIntent') or {}
    if not previous:
        return task.contextRelation != 'cancel'
    if task.contextRelation in {'new', 'switch'}:
        return True
    if task.contextRelation not in {'continue', 'refine', 'clarify'}:
        return False
    return not _has_subject_or_constraint(previous.get('task') or previous)


def input_clarification(catalog, current_page, authorized, language):
    """Select at most two current authorized page names without reading data."""
    current_route = (current_page or {}).get('route')
    pages = []
    for page in catalog:
        routes = [route for route in page.get('standaloneRoutes', page.get('routes', []))
                  if route in page.get('routes', []) and authorized(route)]
        name = ' '.join(str(page.get('name') or '').split())[:80]
        if name and routes:
            pages.append({**page, 'name': name, 'routes': routes})
    current = next((page for page in catalog if current_route in page.get('routes', [])
                    and authorized(current_route)), None)
    if current and current.get('module'):
        pages = [page for page in pages if page.get('module') == current['module']]
    pages.sort(key=lambda page: (current_route not in page['routes'], not bool(page.get('fields'))))
    examples = []
    seen = set()
    for page in pages:
        if page['name'] in seen:
            continue
        seen.add(page['name'])
        examples.append({'pageId': page['id'], 'name': page['name'], 'route': page['routes'][0]})
        if len(examples) == 2:
            break
    if language == 'ar':
        lines = ['لم أفهم طلبك. يرجى توضيح ما تريد معرفته.']
        if examples:
            lines.append('يمكنك مثلاً السؤال عن الصفحات المتاحة لحسابك:')
            lines.extend(f'- ما المعلومات المعروضة في صفحة «{page["name"]}»؟' for page in examples)
        else:
            lines.append('افتح صفحة متاحة في قسمك، ثم اسأل: «ما المعلومات المعروضة في هذه الصفحة؟»')
    else:
        lines = ['I could not understand your request. Please describe what you would like to know.']
        if examples:
            lines.append('For example, you can ask about pages available to your account:')
            lines.extend(f'- What information is shown on the {page["name"]} page?' for page in examples)
        else:
            lines.append('Open a page available in your department, then ask: "What information is shown on this page?"')
    return ClarificationRequest(question='\n\n'.join(lines),
        missingSlots=['businessObject', 'requestedAttributes'], options=[]), examples
