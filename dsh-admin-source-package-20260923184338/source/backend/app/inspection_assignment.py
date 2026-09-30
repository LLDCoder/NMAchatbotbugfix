"""Reviewed Inspection assignment semantics; no routing, credentials or writes."""
import json
import re

TASK_NUMBER = re.compile(r'IN-\d{4}-\d+', re.I)


def is_assignment_followup(question):
    return bool(re.fullmatch(
        r'\s*are (?:these|those) tasks assigned to me,? or are they (?:simply |just )?'
        r'in the (?:inspection )?queue[?.]?\s*', question, re.I)
        or re.fullmatch(r'\s*这些(?:检查)?任务(?:是否|是)?(?:分配给我|属于我个人)(?:的)?[？?]?\s*', question))


def assignment_references(result):
    """Retain only previously delivered task numbers, never historical owners."""
    if result.get('result') != 'success' or result.get('page') != '/inspection/tasks':
        return {}
    refs = []
    for fact in (result.get('facts') or [])[:20]:
        try:
            row = json.loads(fact)
        except (TypeError, ValueError):
            continue
        if not isinstance(row, dict):
            continue
        values = [v for k, v in row.items() if re.sub(r'[^a-z]', '', k.casefold()) == 'taskno']
        if len(values) == 1 and isinstance(values[0], str) and TASK_NUMBER.fullmatch(values[0]):
            if values[0] not in refs:
                refs.append(values[0])
    return {'assignmentSource': {'page': '/inspection/tasks',
            'selectedState': str(result.get('selectedState') or ''), 'taskNumbers': refs}} if refs else {}


def classify_assignment(row, user_id):
    """InspectorId is the Admin user ID; display names cannot prove identity.

    The Portal service derives assignmentState from task.Inspectors.Count.
    Missing fields and contradictory detail evidence remain unknown.
    """
    if not isinstance(row, dict) or not user_id:
        return 'unknown'
    state = row.get('assignmentState')
    inspectors = row.get('inspectors')
    if state == 'Unassigned':
        return 'unknown' if row.get('inspectorName') or inspectors else 'unassigned'
    if state != 'Assigned' or not isinstance(inspectors, list) or not inspectors:
        return 'unknown'
    ids = [v.get('inspectorId') if isinstance(v, dict) else None for v in inspectors]
    if any(not isinstance(v, str) or not v.strip() or v == '00000000-0000-0000-0000-000000000000' for v in ids):
        return 'unknown'
    return 'you' if str(user_id).casefold() in {v.casefold() for v in ids} else 'others'


def assignment_answer(result, language):
    if result.get('workflowState') != 'assignment_rechecked':
        return None
    rows = []
    for fact in result.get('facts') or []:
        try:
            row = json.loads(fact)
        except (ValueError, TypeError):
            return None
        if not isinstance(row, dict) or not TASK_NUMBER.fullmatch(str(row.get('Task No') or '')):
            return None
        if row.get('Assignment') not in {'you', 'others', 'unassigned', 'unknown'}:
            return None
        rows.append(row)
    if not rows:
        return None
    labels = {
        'en': {'you':'assigned to you', 'others':'assigned to other inspectors, not to you',
               'unassigned':'currently unassigned; not assigned to you', 'unknown':'assignment could not be verified in the fresh read'},
        'zh': {'you':'已分配给你', 'others':'已分配给其他检查人员，未分配给你',
               'unassigned':'当前未分配，因此未分配给你', 'unknown':'本次继续查询仍未能核实分配归属'},
        'ar': {'you':'مسندة إليك', 'others':'مسندة إلى مفتشين آخرين وليست إليك',
               'unassigned':'غير مسندة حاليًا، وليست مسندة إليك', 'unknown':'تعذر التحقق من الإسناد في القراءة الحالية'},
    }.get(language)
    if labels is None:
        labels = {'you':'assigned to you','others':'assigned to others, not you',
                  'unassigned':'currently unassigned; not assigned to you','unknown':'assignment not verified'}
    lead = {'zh':'我重新查询了上文这些任务的当前分配信息：',
            'ar':'أعدت التحقق من الإسناد الحالي للمهام السابقة:',
            'en':'I rechecked the current assignment of the previously listed tasks:'}.get(language,
            'I rechecked the current assignment of the previously listed tasks:')
    if all(r['Assignment'] == 'unassigned' for r in rows):
        lead = {'zh':'这些任务当前均未分配，因此没有一条分配给你个人。重新查询结果如下：',
                'ar':'جميع هذه المهام غير مسندة حاليًا، لذا لا توجد مهمة مسندة إليك:',
                'en':'These tasks are currently unassigned, so none is assigned to you personally. I rechecked each task:'}.get(language, lead)
    return lead + '\n\n' + '\n'.join(f"- {r['Task No']}: {labels[r['Assignment']]}" for r in rows)
