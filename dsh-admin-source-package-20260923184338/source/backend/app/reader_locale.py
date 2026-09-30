"""Presentation vocabulary only; no business terms, statuses or computed data."""
AR = {
    'This assistant supports read-only queries. No business change was made.':
        'يدعم هذا المساعد الاستعلامات للقراءة فقط. لم يُجرَ أي تعديل على بيانات العمل.',
    'Draft for human review; not sent.': 'مسودة للمراجعة البشرية؛ لم يتم إرسالها.',
    'Your current authorized pages do not provide access to records in the requested scope. I cannot retrieve those records; I can only query data available to your signed-in account.': 'الصفحات المصرح بها حالياً لحسابك لا تتيح الوصول إلى السجلات ضمن النطاق المطلوب. لا يمكنني استرجاع تلك السجلات؛ يمكنني الاستعلام فقط عن البيانات المتاحة لحسابك المسجّل حالياً.',
    'count': 'العدد',
    'Current page results:': 'نتائج قراءة الصفحة الحالية:',
    'These observations do not yet satisfy all requested requirements.': 'هذه النتائج المرصودة لا تستوفي جميع متطلبات السؤال بعد.',
    '| Measure | Value |': '| المقياس | القيمة |',
    ' (observation)': ' (ملاحظة مرصودة)',
    'Unknown': 'غير مؤكد',
    'Some requested fields could not be confirmed.': 'تعذر تأكيد بعض الحقول المطلوبة.',
    'Some requested information remains unconfirmed.': 'لا تزال بعض المعلومات المطلوبة غير مؤكدة.',
    'Scope: ': 'النطاق: ',
    'personal': 'شخصي', 'team': 'الفريق', 'global': 'عام', 'unknown': 'غير مؤكد',
    'Unit': 'وحدة العد', 'Population': 'مجموعة البيانات', 'Filter scope': 'نطاق التصفية',
    '{label}: {count} records have unconfirmed filter/group values; these are not treated as zero or false.':
        '{label}: توجد {count} سجلات بقيم تصفية أو تجميع غير مؤكدة؛ لا تُعامل هذه القيم على أنها صفر أو خطأ.',
    '{label}: unavailable fields: {fields}.': '{label}: الحقول غير المتاحة: {fields}.',
    'Time interval: [{start}, {end}) — {zone}.': 'الفترة الزمنية: [{start}, {end}) — {zone}.',
    'The declared source population was fully observed; this is not a transactional database snapshot.':
        'تمت قراءة مجموعة البيانات المحددة في المصدر كاملة؛ وهذه القراءة ليست لقطة ذرية لقاعدة البيانات.',
    'These are bounded observations; they do not establish a complete population.':
        'هذه نتائج قراءة محدودة؛ ولا تثبت اكتمال مجموعة البيانات.',
    'All rows of the declared source population were read, but some filter values are unknown; the matching set remains incomplete.':
        'تمت قراءة جميع صفوف مجموعة البيانات المحددة، لكن بعض قيم التصفية غير معروفة؛ لذا تبقى مجموعة النتائج المطابقة غير مكتملة.',
    'Source: ': 'المصدر: ',
    'The current identity or read permission could not be verified.': 'تعذر التحقق من الهوية الحالية أو صلاحية القراءة.',
    'The local reader policy blocked a required operation. The upstream account permission has not been established by this request.':
        'منعت سياسة القراءة المحلية عملية مطلوبة. لم يتحقق هذا الطلب من صلاحية الحساب لدى النظام المصدر.',
    'This assistant supports read-only queries. No business change was made. Use the authorized portal workflow and its required review, reasons and confirmation.':
        'يدعم هذا المساعد الاستعلامات للقراءة فقط. لم يُجرَ أي تعديل على بيانات العمل. استخدم إجراءات البوابة المصرح بها مع المراجعة والأسباب والتأكيد المطلوب.',
    'The previous clarification cannot be continued. Please restate the missing condition in a new request.':
        'تعذر استكمال التوضيح السابق. يرجى ذكر الشرط الناقص في طلب جديد.',
    'A required service failed. No numeric result has been inferred.': 'تعطلت خدمة مطلوبة. لم تُستنتج أي نتيجة رقمية.',
    'The analysis plan could not be validated against the selected source definitions.':
        'تعذر التحقق من خطة التحليل وفق تعريفات المصادر المختارة.',
    'The required source fields were unavailable or incomplete.': 'حقول المصدر المطلوبة غير متاحة أو غير مكتملة.',
    'This analysis needs an operator that the generic engine does not yet support.':
        'يتطلب هذا التحليل عملية لا يدعمها محرك التنفيذ العام بعد.',
    'More than one authorized record matches this identifier. Please provide another identifying detail from the page.':
        'يطابق هذا المعرّف أكثر من سجل مصرح به. يرجى تقديم معلومة تعريفية إضافية من الصفحة.',
    'The available knowledge and observed evidence do not yet support a confirmed answer.':
        'المعرفة المتاحة والأدلة المرصودة لا تدعم إجابة مؤكدة بعد.',
    'Unconfirmed requirements: ': 'متطلبات لم يتم تأكيدها: ',
    'Maintenance findings distinguish page knowledge from execution, planning and source-data gaps.':
        'تميز نتائج التشخيص بين نقص معرفة الصفحة ومشكلات التنفيذ والتخطيط وبيانات المصدر.',
    'Page knowledge requires verification; this maintenance record is not executable page knowledge.':
        'تحتاج معرفة الصفحة إلى التحقق؛ سجل التشخيص هذا ليس تعريف معرفة قابلاً للتنفيذ.',
    'Execution checks still unresolved: ': 'فحوص التنفيذ التي لم تُحسم بعد: ',
    'identity_context': 'الهوية والسياق', 'intent': 'فهم الطلب', 'query_expansion': 'توسيع مصطلحات البحث',
    'knowledge_retrieval': 'استرجاع المعرفة', 'knowledge_coverage': 'اكتمال المعرفة',
    'page_routing': 'اختيار الصفحة', 'page_observation': 'قراءة الصفحة', 'source_selection': 'اختيار المصادر',
    'data_collection': 'جمع البيانات', 'analysis': 'التحليل', 'task_completion': 'اكتمال المهمة', 'output': 'الإخراج',
}


def text(template, language='en', **values):
    return (AR.get(template, template) if language == 'ar' else template).format(**values)
