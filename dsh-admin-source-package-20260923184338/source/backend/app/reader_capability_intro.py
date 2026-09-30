"""Describe implemented assistant help without inventing a business inventory."""
import re

from .reader_session_scope import _words, session_projection
from .tool_gateway import SYSTEM_DEFAULT_TOOL_NAMES


def _capability_attribute(value):
    """Recognize help and its limits, retaining every attribute's full meaning."""
    text = _words(value)
    # Task extraction can retain the question's account qualifier on an
    # attribute. Only the same-current-account qualifier is removable here.
    role = r' (?:in|for|under|with) (?:my |the )?(?:(?:current|signed in|currently signed in|active) )?(?:role|account)$'
    text = re.sub(role, '', text)
    # A current-user page qualifier limits where help applies; it does not
    # ask for the pages' data, business permissions or another user's access.
    page_context = r' in (?:the )?signed in user s permitted page context$'
    text = re.sub(page_context, '', text)
    modifier = r'(?:(?:assistant|available|supported|permitted|possible|current|read only) )*'
    concept = r'(?:assistance|help|capabilities|capability|functions|function|features|feature|support)'
    help_phrase = modifier + concept + r'(?: (?:available|supported))?'
    boundary = r'(?:limitations|limits|boundaries|scope)'
    # The complete question and TaskSpec must still independently establish a
    # pure assistant introduction. Business permissions, records, data scope,
    # hidden instructions, and write actions do not fit this attribute grammar.
    return bool(re.fullmatch(r'(?:' + help_phrase + r'|'
                             + boundary + r' (?:of|on) ' + help_phrase + r'|'
                             + help_phrase + r' ' + boundary + r')', text))


def assistant_capability_request(task, canonical_question):
    """Only a pure assistant introduction, never the user's business actions."""
    if (task.requestBoundaries or not task.readOnly or task.needsLiveData or task.responseMode != 'answer'
            or task.recordIdentity or task.clarification or task.unresolvedSlots
            or task.contextRelation not in {'new', 'clarify'}
            or task.requestedScope not in {'unknown', 'personal'}
            or task.outputShape not in {'detail', 'overview'}
            or task.requestedMeasures or task.requestedOrdering or task.groupBy
            or task.filters or task.view or task.timeField
            or task.timeRange not in {'', 'unknown'}
            or task.businessFocus not in {'', 'unknown'}):
        return False
    if _words(task.businessObject) not in {
            '', 'unknown', 'assistant', 'assistance', 'help', 'capability', 'capabilities',
            'assistant capability', 'assistant capabilities', 'assistant help'}:
        return False
    if _words(task.requestedGrain) not in {'', 'unknown', 'capability', 'capabilities',
            'assistant capability', 'function', 'supported function'}:
        return False
    if any(not _capability_attribute(value) for value in task.requestedAttributes):
        return False
    # Normalization already supplies English for Arabic. Match the whole request
    # so an extra record, write, status or previous-query clause cannot disappear.
    text = re.sub(r'[?!.,،؟]+$', '', str(canonical_question).strip().casefold())
    text = re.sub(r'^(?:hello|hi|hey)[,.! ]+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    role = r'(?: (?:in|for|under|with) my (?:current |currently signed-in |signed-in |active )?(?:role|account))?'
    patterns = [
        r'what can you (?:help me do|help me with|do for me|do)' + role,
        r'how can you (?:help|assist) me' + role,
        r'what (?:help|assistance) can you (?:offer|provide)(?: me)?' + role,
        r'what are your (?:capabilities|supported functions)' + role,
    ]
    return any(re.fullmatch(pattern, text) for pattern in patterns)


def capability_projection(auth_response, principal_id, allowed_tools, catalog, authorized,
                          language, observed_at):
    """Use this invocation's executable tools and fresh route authorization."""
    enabled = set(allowed_tools) & SYSTEM_DEFAULT_TOOL_NAMES
    session = session_projection(auth_response, principal_id, ['roles', 'pages'],
                                 catalog, authorized, language, observed_at)
    pages = session['permittedPages'] if 'admin.portal.read' in enabled else []
    supported = []
    if 'admin.portal.read' in enabled and pages:
        supported.append('authorized_page_reading')
    if 'knowledge.search' in enabled:
        supported.append('knowledge_guidance')
    return {'schemaVersion': 'assistant-capability-introduction/1',
            'source': 'current_runtime_tools_and_authenticated_navigation',
            'supportedHelp': supported, 'roles': session['roles'],
            'roleListTruncated': session['roleListTruncated'],
            'pageExamples': pages[:6], 'pageExamplesAreExhaustive': False,
            'observedAt': observed_at, 'recordValuesRead': False,
            'rowScopeVerified': False, 'businessActionsExecutable': False,
            'capabilitiesDerivedFromRoleNames': False}


def render_capability_intro(projection, language):
    def literal(value):
        return re.sub(r'([\\`*_{}\[\]()<>!|])', r'\\\1', str(value))
    ar = language == 'ar'
    supported = projection['supportedHelp']
    lines = []
    if supported:
        lines.append('يمكنني مساعدتك ضمن صلاحيات حسابك الحالية في:' if ar else
                     'With your current access, I can help you:')
        if 'authorized_page_reading' in supported:
            lines.append('- قراءة معلومات الصفحات المسموح بها وشرحها، والتحقق من حالات السجلات وتلخيص المعلومات المتاحة.' if ar else
                         '- Read and explain permitted portal pages, check record statuses, and summarize the information available there.')
        if 'knowledge_guidance' in supported:
            lines.append('- العثور على الإرشادات ذات الصلة وشرحها.' if ar else
                         '- Find and explain relevant guidance.')
    else:
        lines.append('لم أتمكن من تأكيد مساعدة متاحة من أدوات هذه الجلسة وصفحاتها المصرح بها.' if ar else
                     'I could not confirm available help from this session’s enabled tools and authorized pages.')
    roles = projection.get('roles') or []
    if roles:
        label = ('من أدوارك المعيّنة: ' if ar else 'Some assigned roles: ') if projection.get('roleListTruncated') else ('أدوارك المعيّنة: ' if ar else 'Your assigned roles: ')
        lines.append(label + ('، ' if ar else ', ').join(literal(x) for x in roles) + '.')
    pages = projection.get('pageExamples') or []
    if pages:
        lines.append(('من الصفحات المتاحة لحسابك: ' if ar else 'Your available pages include: ') +
                     ('، ' if ar else ', ').join(literal(x) for x in pages) + '.')
        lines.append('يمكنك أن تطلب مني شرح إحدى هذه الصفحات أو البحث عن سجل محدد فيها؛ وتعتمد التفاصيل المتاحة على صلاحيات حسابك واستجابة الصفحة.' if ar else
                     'You can ask me to explain one of these pages or look up a specific record there; available details depend on your account permissions and the page response.')
    if supported:
        lines.append('المساعدة هنا للقراءة والشرح؛ وتبقى التغييرات والموافقات ضمن إجراءات البوابة.' if ar else
                     'This help is for reading and explanation; business changes and approvals remain portal actions.')
    return '\n\n'.join(lines)
