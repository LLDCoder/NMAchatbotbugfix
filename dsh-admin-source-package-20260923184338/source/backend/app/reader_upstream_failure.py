"""Preserve trusted HTTP failure kinds without exposing upstream bodies."""


KNOWLEDGE_DEPENDENCY_FAILURES = frozenset({
    'knowledge_dependency_unavailable', 'knowledge_upstream_unavailable',
    'knowledge_retrieval_channels_incomplete', 'knowledge_verification_timeout',
    'knowledge_retrieval_timeout', 'knowledge_snapshot_changed',
    'knowledge_invalid_upstream_response', 'knowledge_access_denied',
    'knowledge_scope_unavailable', 'knowledge_request_invalid',
    'knowledge_source_filter_unsupported',
})


def knowledge_dependency_failure(evidence):
    """Recognize failed runtime prerequisites, never business coverage gaps."""
    if evidence.get('result') != 'load_failed' or evidence.get('failureCategory') != 'runtime':
        return None
    for code in evidence.get('missing', []):
        if not isinstance(code, str):
            continue
        if code in KNOWLEDGE_DEPENDENCY_FAILURES:
            return code
        if (code in {'stage_timeout', 'dependency_unavailable', 'reader_timeout'}
                and evidence.get('failureStage') == 'knowledge_retrieval'):
            return code
    return None


def upstream_failure(status, *, details=None):
    from .generic_reader import PipelineError
    if type(status) is not int:
        return None
    definitions = {
        401: ('upstream_session_expired', 'permission'),
        403: ('upstream_access_denied', 'permission'),
        404: ('upstream_source_not_found', 'runtime'),
    }
    code = definitions.get(status)
    if code is None and (status in {408, 429} or 500 <= status <= 599):
        code = ('source_response_unavailable', 'runtime')
    return PipelineError(*code, details={**(details or {}), 'upstreamStatus': status}) if code else None


def public_upstream_failure(evidence, language):
    if evidence.get('outputs') or evidence.get('knowledgeAnswer'):
        return None
    messages = {
        'upstream_session_expired': {
            'en': 'Your Admin Portal session has expired. Sign in again, then retry this query. The requested data could not be verified.',
            'ar': 'انتهت صلاحية جلسة بوابة الإدارة. سجّل الدخول مجدداً ثم أعد هذا الاستعلام. لم يتم التحقق من البيانات المطلوبة.',
        },
        'upstream_access_denied': {
            'en': 'Your signed-in account cannot access the requested information. Open a page available to your account or contact your administrator. This is an access failure, not an empty result.',
            'ar': 'لا يستطيع حسابك المسجّل دخوله الوصول إلى المعلومات المطلوبة. افتح صفحة متاحة لحسابك أو تواصل مع مسؤول النظام. هذا رفض للوصول وليس نتيجة فارغة.',
        },
        'upstream_source_not_found': {
            'en': 'The requested page or data source was not found (404). Refresh the page or reopen the record from an authorized list. This does not prove that the business record is absent.',
            'ar': 'لم يتم العثور على الصفحة أو مصدر البيانات المطلوب (404). حدّث الصفحة أو أعد فتح السجل من قائمة مصرح بها. هذا لا يثبت عدم وجود سجل الأعمال.',
        },
        'source_response_unavailable': {
            'en': 'The Admin Portal service is temporarily unavailable. Retry after the service recovers. The requested data could not be verified.',
            'ar': 'خدمة بوابة الإدارة غير متاحة مؤقتاً. أعد المحاولة بعد عودة الخدمة. لم يتم التحقق من البيانات المطلوبة.',
        },
    }
    # Native identity/access failures win independently of missing-list order.
    # A knowledge transport failure grants or denies no business permission.
    for code in messages:
        if code in evidence.get('missing', []):
            return messages[code].get(language, messages[code]['en'])
    return None


def public_knowledge_failure(evidence, language):
    """Describe the failed part without replacing independently verified facts."""
    if not knowledge_dependency_failure(evidence):
        return None
    messages = {
        'en': 'Knowledge retrieval failed, so I could not verify all the information needed to complete this query. Please retry the unresolved part after the service recovers.',
        'ar': 'تعذّر استرجاع المعرفة، لذلك لم أتمكن من التحقق من جميع المعلومات اللازمة لإكمال هذا الاستعلام. يُرجى إعادة محاولة الجزء غير المحسوم بعد عودة الخدمة.',
        'zh': '知识检索失败，未能核实完成本次查询所需的全部信息。请在服务恢复后重试尚未确认的部分。',
    }
    return messages.get(language, messages['en'])
