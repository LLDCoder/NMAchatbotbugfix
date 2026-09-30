const auditState = {
  session: null,
  language: localStorage.getItem("dsh-audit-language") === "ar" ? "ar" : "en",
  view: "conversations",
  conversations: [],
  conversationPage: 1,
  conversationPageSize: 20,
  conversationTotal: 0,
  selectedConversationId: "",
  detail: null,
  records: [],
  recordPage: 1,
  recordPageSize: 75,
  recordTotal: 0,
  users: [],
  usersLoaded: false,
  diagnostics: { skills: [], tools: [] },
  diagnosticsLoaded: { skills: false, tools: false },
  diagnosticMeta: {
    skills: { page: 1, pageSize: 25, total: 0, search: "" },
    tools: { page: 1, pageSize: 25, total: 0, search: "" },
  },
  diagnosticRequests: { skills: 0, tools: 0 },
  configuration: [],
  configurationLoaded: false,
  configurationSection: "model",
  configurationDraft: {},
  configurationSecretsOpen: new Set(),
  filters: { search: "", dateRange: "", status: "", category: "" },
  expandedSummaries: new Set(),
  openPayloads: new Set(),
  listPaneWidth: Number(localStorage.getItem("dsh-audit-list-width")) || 360,
  accountOutsideHandler: null,
  accountEscapeHandler: null,
  workspaceResizeObserver: null,
  loginMotionCleanup: null,
  listRequest: 0,
  detailRequest: 0,
};

const auditAssetBaseUrl = new URL(".", import.meta.url);
const auditBasePath = window.location.pathname === "/dsh-audit" || window.location.pathname.startsWith("/dsh-audit/")
  ? "/dsh-audit"
  : "";

function auditApiUrl(path) {
  return `${auditBasePath}${path}`;
}

function auditAssetUrl(name) {
  return new URL(name, auditAssetBaseUrl).href;
}

const copy = {
  en: {
    product: "NMA Chatbot Audit",
    portalSubtitle: "Admin Portal",
    authority: "National Media Authority",
    signIn: "Login",
    signInHint: "Sign in with your assigned audit account.",
    username: "Username",
    usernamePlaceholder: "Enter username",
    password: "Password",
    passwordPlaceholder: "Enter password",
    signInAction: "Login",
    signingIn: "Logging in...",
    authorizedOnly: "Authorized personnel only",
    loginAuditNote: "Sign-in activity is recorded for security.",
    invalidLogin: "Unable to sign in. Check your username and password.",
    serviceUnavailable: "The audit service is currently unavailable.",
    conversations: "Conversations",
    accounts: "Accounts",
    skills: "Skills",
    signOut: "Sign out",
    auditor: "Auditor",
    administrator: "Administrator",
    conversationAudit: "Conversation audit",
    accountManagement: "Account management",
    skillsDiagnostics: "Skills diagnostics",
    toolsDiagnostics: "Tools diagnostics",
    diagnosticsHint: "Read-only runtime configuration for audit diagnosis.",
    configuration: "Configuration",
    configurationManagement: "Runtime configuration",
    configurationHint: "Manage DSH runtime settings. Requests use the selected UMC Portal; Database and Redis changes require a restart.",
    saveChanges: "Save changes",
    noChanges: "No configuration changes to save.",
    configSaved: "Configuration saved and applied.",
    configLoadFailed: "Unable to load configuration.",
    configSaveFailed: "Unable to save configuration.",
    configured: "Configured",
    notConfigured: "Not configured",
    readOnly: "Read-only",
    liveUpdate: "Live update",
    restartRequired: "Restart required",
    environmentDefault: "Environment / default",
    databaseOverride: "Database override",
    protectedInfrastructure: "Protected infrastructure",
    portalEnvironment: "Selected portal environment",
    secretConfigured: "Configured; enter a new value to replace it",
    secretNotConfigured: "Enter a value to configure",
    configGroupModel: "Model",
    configGroupDsh: "Routing",
    configGroupInfrastructure: "Infrastructure",
    configGroupExternal: "External tools",
    configGroupCustomer: "Portal environment",
    configGroupEnvironment: "Environment",
    configGroupAudit: "Audit",
    replaceKey: "Replace key",
    setKey: "Set key",
    cancel: "Cancel",
    discardChanges: "Discard",
    unsavedChange: "1 unsaved change",
    unsavedChanges: "{count} unsaved changes",
    search: "Search",
    searchPlaceholder: "Search conversation, request, account or tenant",
    dateRange: "Date range",
    allTime: "All time",
    today: "Today",
    last7Days: "Last 7 days",
    last30Days: "Last 30 days",
    status: "Status",
    allStatuses: "All statuses",
    completed: "Completed",
    inProgress: "In progress",
    failed: "Failed",
    cancelled: "Cancelled",
    category: "Event category",
    allEvents: "All events",
    messages: "Messages",
    tools: "Tools",
    llm: "LLM",
    runtime: "Runtime",
    moreFilters: "More filters",
    fewerFilters: "Fewer filters",
    account: "Account",
    tenant: "Tenant",
    conversationId: "Conversation ID",
    requestId: "Request ID",
    applyFilters: "Apply filters",
    clear: "Clear",
    refresh: "Refresh",
    record: "record",
    records: "records",
    total: "Total",
    perPage: "/ page",
    result: "Result",
    loading: "Loading...",
    noConversations: "No conversations match these filters.",
    selectConversation: "Select a conversation to inspect its execution trail.",
    executionTrail: "Execution trail",
    events: "Events",
    created: "Created",
    lastActivity: "Last activity",
    skillProfile: "Skill profile",
    dshSession: "DSH session",
    request: "Request",
    sessionEvents: "Session events",
    payload: "View audit payload",
    hidePayload: "Hide audit payload",
    copyActivity: "Copy activity",
    copyPayload: "Copy payload",
    copied: "Copied to clipboard.",
    copyFailed: "Unable to copy.",
    showMore: "Show more",
    showLess: "Show less",
    sessionDetails: "Session details",
    noEvents: "No events match the selected filters.",
    loadMore: "Load more events",
    prev: "Previous page",
    next: "Next page",
    page: "Page",
    of: "of",
    addAccount: "Add account",
    active: "Active",
    inactive: "Inactive",
    role: "Role",
    displayName: "Display name",
    createdAt: "Created",
    actions: "Actions",
    resetPassword: "Reset password",
    disable: "Disable",
    enable: "Enable",
    noAccounts: "No audit accounts found.",
    newAccount: "New audit account",
    createAccount: "Create account",
    cancel: "Cancel",
    temporaryPassword: "Temporary password",
    passwordRule: "Use 8+ characters with uppercase, lowercase and a number.",
    resetPasswordFor: "Reset password",
    newPassword: "New password",
    confirmReset: "Reset password",
    close: "Close",
    accountCreated: "Account created.",
    accountUpdated: "Account updated.",
    passwordReset: "Password reset.",
    loadFailed: "Unable to load audit data.",
    retry: "Retry",
    name: "Name",
    version: "Version",
    source: "Source",
    enabled: "Enabled",
    disabled: "Disabled",
    endpoint: "Endpoint",
    effect: "Effect",
    published: "Published",
    draft: "Draft",
    noDiagnostics: "No diagnostic records found.",
    searchSkills: "Search skill name, ID, source, status or domain",
    searchTools: "Search tool name, operation or endpoint",
    rowsPerPage: "Rows per page",
    userId: "User ID",
    resizePanels: "Resize conversation list and detail panels",
    accountMenu: "Account menu",
    auditNavigation: "Audit navigation",
    menuLabel: "Menu",
    showPassword: "Show password",
    auditConsole: "Audit Console",
    untitledConversation: "Untitled conversation",
    unknownStatus: "Unknown",
    userMessage: "User message",
    assistantResponse: "Assistant response",
    responseStream: "Response stream",
    processingStatus: "Processing status",
    skillRouted: "Skill routed",
    toolCall: "Tool call",
    toolResult: "Tool result",
    llmRequest: "LLM request",
    llmResponse: "LLM response",
    llmReasoning: "LLM reasoning",
    llmError: "LLM error",
    runtimeError: "Runtime error",
    requestStarted: "Request started",
    requestCompleted: "Request completed",
    requestCancelled: "Request cancelled",
    messageReceived: "User message received",
    responseDelivered: "Assistant response delivered",
    contentStreamed: "Response content streamed",
    statusUpdated: "Assistant processing status updated",
    selected: "selected",
    called: "called",
    toolFailed: "failed",
    toolCompleted: "completed",
    requestSent: "request sent",
    modelCompleted: "Language model response completed",
    executionFailed: "Execution failed",
    processingStarted: "Request processing started",
    processingCompleted: "Request processing completed",
    processingCancelled: "Request processing cancelled",
    notRecorded: "Not recorded",
  },
  ar: {
    product: "وحدة تدقيق روبوت المحادثة - NMA",
    portalSubtitle: "بوابة الإدارة",
    authority: "الهيئة الوطنية للإعلام",
    signIn: "تسجيل الدخول",
    signInHint: "سجّل الدخول باستخدام حساب التدقيق المخصص لك.",
    username: "اسم المستخدم",
    usernamePlaceholder: "أدخل اسم المستخدم",
    password: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    signInAction: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول...",
    authorizedOnly: "للموظفين المصرح لهم فقط",
    loginAuditNote: "يتم تسجيل نشاط الدخول لأغراض الأمان.",
    invalidLogin: "تعذر تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.",
    serviceUnavailable: "خدمة التدقيق غير متاحة حالياً.",
    conversations: "المحادثات",
    accounts: "الحسابات",
    skills: "المهارات",
    signOut: "تسجيل الخروج",
    auditor: "مدقق",
    administrator: "مسؤول",
    conversationAudit: "تدقيق المحادثات",
    accountManagement: "إدارة الحسابات",
    skillsDiagnostics: "تشخيص المهارات",
    toolsDiagnostics: "تشخيص الأدوات",
    diagnosticsHint: "إعدادات وقت التشغيل للعرض فقط لأغراض التشخيص.",
    configuration: "الإعدادات",
    configurationManagement: "إعدادات وقت التشغيل",
    configurationHint: "إدارة إعدادات تشغيل DSH. تستخدم الطلبات بوابة UMC المحددة؛ وتتطلب تغييرات قاعدة البيانات وRedis إعادة التشغيل.",
    saveChanges: "حفظ التغييرات",
    noChanges: "لا توجد تغييرات لحفظها.",
    configSaved: "تم حفظ الإعدادات وتطبيقها.",
    configLoadFailed: "تعذر تحميل الإعدادات.",
    configSaveFailed: "تعذر حفظ الإعدادات.",
    configured: "تم الإعداد",
    notConfigured: "غير معدّ",
    readOnly: "للقراءة فقط",
    liveUpdate: "تحديث مباشر",
    restartRequired: "يتطلب إعادة التشغيل",
    environmentDefault: "البيئة / القيمة الافتراضية",
    databaseOverride: "تجاوز من قاعدة البيانات",
    protectedInfrastructure: "بنية تحتية محمية",
    portalEnvironment: "بيئة بوابة UMC المحددة",
    secretConfigured: "تم الإعداد؛ أدخل قيمة جديدة لاستبدالها",
    secretNotConfigured: "أدخل قيمة لإعدادها",
    configGroupModel: "النموذج",
    configGroupDsh: "التوجيه",
    configGroupInfrastructure: "البنية التحتية",
    configGroupExternal: "الأدوات الخارجية",
    configGroupCustomer: "بيئة البوابة",
    configGroupEnvironment: "البيئة",
    configGroupAudit: "التدقيق",
    replaceKey: "استبدال المفتاح",
    setKey: "تعيين المفتاح",
    cancel: "إلغاء",
    discardChanges: "تجاهل",
    unsavedChange: "تغيير واحد غير محفوظ",
    unsavedChanges: "{count} تغييرات غير محفوظة",
    search: "بحث",
    searchPlaceholder: "البحث بالمحادثة أو الطلب أو الحساب أو الجهة",
    dateRange: "الفترة الزمنية",
    allTime: "كل الوقت",
    today: "اليوم",
    last7Days: "آخر 7 أيام",
    last30Days: "آخر 30 يوماً",
    status: "الحالة",
    allStatuses: "كل الحالات",
    completed: "مكتملة",
    inProgress: "قيد التنفيذ",
    failed: "فشلت",
    cancelled: "ملغاة",
    category: "فئة الحدث",
    allEvents: "كل الأحداث",
    messages: "الرسائل",
    tools: "الأدوات",
    llm: "النموذج اللغوي",
    runtime: "وقت التشغيل",
    moreFilters: "مرشحات إضافية",
    fewerFilters: "مرشحات أقل",
    account: "الحساب",
    tenant: "الجهة",
    conversationId: "معرف المحادثة",
    requestId: "معرف الطلب",
    applyFilters: "تطبيق المرشحات",
    clear: "مسح",
    refresh: "تحديث",
    record: "سجلاً",
    records: "سجلاً",
    total: "الإجمالي",
    perPage: "/ صفحة",
    result: "النتيجة",
    loading: "جارٍ التحميل...",
    noConversations: "لا توجد محادثات تطابق هذه المرشحات.",
    selectConversation: "اختر محادثة لفحص مسار التنفيذ.",
    executionTrail: "مسار التنفيذ",
    events: "الأحداث",
    created: "تاريخ الإنشاء",
    lastActivity: "آخر نشاط",
    skillProfile: "ملف المهارة",
    dshSession: "جلسة DSH",
    request: "الطلب",
    sessionEvents: "أحداث الجلسة",
    payload: "عرض بيانات التدقيق",
    hidePayload: "إخفاء بيانات التدقيق",
    copyActivity: "نسخ النشاط",
    copyPayload: "نسخ البيانات",
    copied: "تم النسخ إلى الحافظة.",
    copyFailed: "تعذر النسخ.",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",
    sessionDetails: "تفاصيل الجلسة",
    noEvents: "لا توجد أحداث تطابق المرشحات المحددة.",
    loadMore: "تحميل المزيد من الأحداث",
    prev: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: "صفحة",
    of: "من",
    addAccount: "إضافة حساب",
    active: "نشط",
    inactive: "غير نشط",
    role: "الدور",
    displayName: "الاسم المعروض",
    createdAt: "تاريخ الإنشاء",
    actions: "الإجراءات",
    resetPassword: "إعادة تعيين كلمة المرور",
    disable: "تعطيل",
    enable: "تفعيل",
    noAccounts: "لا توجد حسابات تدقيق.",
    newAccount: "حساب تدقيق جديد",
    createAccount: "إنشاء الحساب",
    cancel: "إلغاء",
    temporaryPassword: "كلمة مرور مؤقتة",
    passwordRule: "استخدم 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم.",
    resetPasswordFor: "إعادة تعيين كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    confirmReset: "إعادة تعيين",
    close: "إغلاق",
    accountCreated: "تم إنشاء الحساب.",
    accountUpdated: "تم تحديث الحساب.",
    passwordReset: "تمت إعادة تعيين كلمة المرور.",
    loadFailed: "تعذر تحميل بيانات التدقيق.",
    retry: "إعادة المحاولة",
    name: "الاسم",
    version: "الإصدار",
    source: "المصدر",
    enabled: "مفعل",
    disabled: "معطل",
    endpoint: "نقطة النهاية",
    effect: "التأثير",
    published: "منشور",
    draft: "مسودة",
    noDiagnostics: "لا توجد سجلات تشخيص.",
    searchSkills: "البحث باسم المهارة أو المعرف أو المصدر أو الحالة أو المجال",
    searchTools: "البحث باسم الأداة أو العملية أو نقطة النهاية",
    rowsPerPage: "صفوف في الصفحة",
    userId: "معرف المستخدم",
    resizePanels: "تغيير حجم قائمة المحادثات ولوحة التفاصيل",
    accountMenu: "قائمة الحساب",
    auditNavigation: "التنقل في التدقيق",
    menuLabel: "القائمة",
    showPassword: "إظهار كلمة المرور",
    auditConsole: "وحدة تحكم التدقيق",
    untitledConversation: "محادثة بلا عنوان",
    unknownStatus: "غير معروف",
    userMessage: "رسالة المستخدم",
    assistantResponse: "رد المساعد",
    responseStream: "تدفق الاستجابة",
    processingStatus: "حالة المعالجة",
    skillRouted: "تم توجيه المهارة",
    toolCall: "استدعاء الأداة",
    toolResult: "نتيجة الأداة",
    llmRequest: "طلب النموذج اللغوي",
    llmResponse: "استجابة النموذج اللغوي",
    llmReasoning: "استدلال النموذج اللغوي",
    llmError: "خطأ النموذج اللغوي",
    runtimeError: "خطأ وقت التشغيل",
    requestStarted: "بدأ الطلب",
    requestCompleted: "اكتمل الطلب",
    requestCancelled: "أُلغي الطلب",
    messageReceived: "تم استلام رسالة المستخدم",
    responseDelivered: "تم تسليم رد المساعد",
    contentStreamed: "تم بث محتوى الاستجابة",
    statusUpdated: "تم تحديث حالة معالجة المساعد",
    selected: "تم اختيارها",
    called: "تم استدعاؤها",
    toolFailed: "فشلت",
    toolCompleted: "اكتملت",
    requestSent: "تم إرسال الطلب",
    modelCompleted: "اكتملت استجابة النموذج اللغوي",
    executionFailed: "فشل التنفيذ",
    processingStarted: "بدأت معالجة الطلب",
    processingCompleted: "اكتملت معالجة الطلب",
    processingCancelled: "أُلغيت معالجة الطلب",
    notRecorded: "غير مسجل",
  },
};

const configFieldLabels = {
  en: {
    llm_base_url: "LLM base URL",
    llm_api_key: "LLM API key",
    llm_model: "Model name",
    llm_timeout_seconds: "LLM timeout (seconds)",
    skill_router_mode: "Skill routing mode",
    skill_router_timeout_seconds: "Skill routing timeout (seconds)",
    skill_router_fallback_skill_id: "Default knowledge fallback skill",
    system_prompt: "Additional system prompt",
    database_url: "Database URL",
    redis_url: "Redis URL",
    knowledge_gateway_url: "Knowledge tool URL",
    knowledge_default_folder_id: "Default knowledge folder ID",
    knowledge_top_k: "Knowledge top K",
    knowledge_timeout_seconds: "Knowledge timeout (seconds)",
    platform_timeout_seconds: "Business tool timeout (seconds)",
    ocr_gateway_url: "OCR tool URL",
    umc_portal: "UMC portal",
    umc_customer_base_url: "Customer Portal base URL",
    umc_admin_base_url: "Admin Portal base URL",
    umc_public_base_url: "Public Portal base URL",
    umc_document_base_url: "UMC document URL",
    external_tools_enabled: "Enable external tools",
    audit_retention_days: "Execution audit retention (days)",
    audit_cleanup_interval_seconds: "Audit cleanup interval (seconds)",
    audit_admin_enabled: "Enable global audit administrator scope",
    audit_admin_user_ids: "Audit administrator UMC user IDs",
  },
  ar: {
    llm_base_url: "عنوان النموذج اللغوي",
    llm_api_key: "مفتاح API للنموذج اللغوي",
    llm_model: "اسم النموذج",
    llm_timeout_seconds: "مهلة النموذج اللغوي (ثانية)",
    skill_router_mode: "وضع توجيه المهارات",
    skill_router_timeout_seconds: "مهلة توجيه المهارات (ثانية)",
    skill_router_fallback_skill_id: "مهارة المعرفة الاحتياطية",
    system_prompt: "تعليمات النظام الإضافية",
    database_url: "عنوان قاعدة البيانات",
    redis_url: "عنوان Redis",
    knowledge_gateway_url: "عنوان أداة المعرفة",
    knowledge_default_folder_id: "معرف مجلد المعرفة الافتراضي",
    knowledge_top_k: "عدد نتائج المعرفة",
    knowledge_timeout_seconds: "مهلة المعرفة (ثانية)",
    platform_timeout_seconds: "مهلة أداة الأعمال (ثانية)",
    ocr_gateway_url: "عنوان أداة OCR",
    umc_portal: "بوابة UMC",
    umc_customer_base_url: "عنوان بوابة العميل",
    umc_admin_base_url: "عنوان بوابة المسؤول",
    umc_public_base_url: "عنوان البوابة العامة",
    umc_document_base_url: "عنوان مستندات UMC",
    external_tools_enabled: "تفعيل الأدوات الخارجية",
    audit_retention_days: "مدة الاحتفاظ بتدقيق التنفيذ (يوم)",
    audit_cleanup_interval_seconds: "فاصل تنظيف التدقيق (ثانية)",
    audit_admin_enabled: "تفعيل نطاق مسؤول التدقيق العام",
    audit_admin_user_ids: "معرفات مستخدمي مسؤولي التدقيق",
  },
};

const configSections = [
  { id: "model", labelKey: "configGroupModel" },
  { id: "routing", labelKey: "configGroupDsh" },
  { id: "tools", labelKey: "configGroupExternal" },
  { id: "environment", labelKey: "configGroupEnvironment" },
  { id: "audit", labelKey: "configGroupAudit" },
];

const booleanConfigKeys = new Set(["external_tools_enabled", "audit_admin_enabled"]);

const t = (key) => copy[auditState.language][key] || copy.en[key] || key;
const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paginationItems(currentPage, totalPages, compact = false) {
  if (compact) {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 3) return [1, 2, 3, "end-ellipsis", totalPages];
    if (currentPage >= totalPages - 2) return [1, "start-ellipsis", totalPages - 2, totalPages - 1, totalPages];
    return [1, "start-ellipsis", currentPage, "end-ellipsis", totalPages];
  }
  const visiblePages = 5;
  if (totalPages <= visiblePages + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= visiblePages - 1) {
    return [...Array.from({ length: visiblePages }, (_, index) => index + 1), "end-ellipsis", totalPages];
  }
  if (currentPage >= totalPages - visiblePages + 2) {
    return [1, "start-ellipsis", ...Array.from({ length: visiblePages }, (_, index) => totalPages - visiblePages + index + 1)];
  }
  return [
    1,
    "start-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end-ellipsis",
    totalPages,
  ];
}

function paginationMarkup(currentPage, totalPages, dataAttribute, compact = false) {
  const pages = paginationItems(currentPage, totalPages, compact);
  const previousIcon = auditState.language === "ar" ? "right" : "left";
  const nextIcon = auditState.language === "ar" ? "left" : "right";
  const pageButtons = pages.map((item) => {
    if (typeof item !== "number") return `<span class="audit-pagination-ellipsis" aria-hidden="true">•••</span>`;
    const active = item === currentPage;
    return `<button class="audit-pagination-button ${active ? "is-active" : ""}" type="button" ${dataAttribute}="${item}" aria-label="${escapeHtml(`${t("page")} ${item}`)}" ${active ? 'aria-current="page"' : ""}>${item}</button>`;
  }).join("");
  return `<button class="audit-pagination-button audit-pagination-arrow" type="button" ${dataAttribute}="${currentPage - 1}" aria-label="${escapeHtml(t("prev"))}" ${currentPage <= 1 ? "disabled" : ""}>${icon(previousIcon)}</button>${pageButtons}<button class="audit-pagination-button audit-pagination-arrow" type="button" ${dataAttribute}="${currentPage + 1}" aria-label="${escapeHtml(t("next"))}" ${currentPage >= totalPages ? "disabled" : ""}>${icon(nextIcon)}</button>`;
}

const iconPaths = {
  audit: '<path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  conversations: '<g transform="scale(.0234375)" fill="currentColor" stroke="none"><path d="M171.6 391.272v351.712c0 25.336 25.704 45.872 57.376 45.872h114.768v76.456c0 8.456 11.832 16.88 22.408 16.88.376 0 .512.016.576.048 6.136.712 15.104-2.832 19.728-6.504l108.656-86.888h269.424c31.68 0 57.384-20.536 57.384-45.872V391.272c0-25.336-25.704-45.872-57.384-45.872H228.976c-31.672 0-57.376 20.536-57.376 45.872zm38.256 15.296c0-16.872 17.128-30.576 38.24-30.576h497.312c21.112 0 38.24 13.696 38.24 30.576v321.128c0 16.88-17.128 30.576-38.24 30.576h-265.68c-1.552.68-5.232 3.824-6.544 4.856l-91.176 72.912v-62.48c0-8.448-8.552-15.296-19.136-15.296H248.104c-21.112 0-38.24-13.696-38.24-30.576v-321.12z"/><path d="M872.528 217.048H336.976c-31.672 0-57.376 20.536-57.376 45.872v44.72a67.896 67.896 0 0 1 16.088-1.992h22.168v-27.432c0-16.872 17.128-30.576 38.24-30.576h497.312c21.112 0 38.24 13.696 38.24 30.576v321.128c0 16.816-17 30.456-38 30.56v30.592h18.872c31.68 0 57.384-20.536 57.384-45.872V262.92c.008-25.336-25.696-45.872-57.376-45.872z"/><circle cx="361.208" cy="565.336" r="33.88"/><circle cx="496.768" cy="565.336" r="33.88"/><circle cx="632.296" cy="565.336" r="33.88"/></g>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5L20 15"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
  tool: '<path transform="scale(.0234375)" fill="currentColor" stroke="none" d="M810.666 942.933c-34.133 0-68.266-12.8-93.866-38.4L482.133 669.866c-140.8 51.2-302.933-12.8-371.2-153.6-38.4-81.066-38.4-174.933 0-256 4.266-12.8 17.066-21.333 29.866-25.6s25.6 0 38.4 12.8L315.733 384H384v-68.266L247.466 179.2c-8.533-8.533-12.8-21.333-12.8-38.4 4.266-12.8 12.8-25.6 25.6-29.866 72.533-34.133 153.6-38.4 230.4-12.8s136.533 81.066 170.666 153.6c34.133 72.533 38.4 153.6 12.8 230.4L908.8 716.8c51.2 51.2 51.2 136.533 0 187.733-29.866 25.6-64 38.4-98.133 38.4zM490.666 576c12.8 0 21.333 4.266 29.866 12.8l256 256c17.066 17.066 51.2 17.066 68.266 0 8.533-8.533 12.8-21.333 12.8-34.133s-4.266-25.6-12.8-34.133l-256-256c-12.8-12.8-17.066-34.133-8.533-46.933 29.866-59.733 29.866-123.733 0-183.466-25.6-51.2-68.266-93.866-119.466-110.933-34.133-12.8-68.266-17.066-102.4-8.533l98.133 98.133c8.533 8.533 12.8 17.066 12.8 29.866v128c0 25.6-17.066 42.666-42.666 42.666H298.666c-12.8 0-21.333-4.266-29.866-12.8L170.666 358.4c-4.266 42.666 0 85.333 17.066 123.733 51.2 106.666 179.2 149.333 285.866 102.4 4.266-8.533 12.8-8.533 17.066-8.533z"/>',
  llm: '<path d="m12 3-1.7 4.3L6 9l4.3 1.7L12 15l1.7-4.3L18 9l-4.3-1.7L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Zm14-1-1 2.5-2.5 1L18 17.5l1 2.5 1-2.5 2.5-1-2.5-1L19 13Z"/>',
  runtime: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  settings: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3"/><path d="M14 2v4M8 10v4M16 18v4"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
};

function icon(name, label = "") {
  const aria = label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"';
  return `<svg class="audit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${aria}>${iconPaths[name] || iconPaths.audit}</svg>`;
}

function normalizeRole(value) {
  const role = String(value || "auditor").toLowerCase();
  return role.includes("admin") ? "administrator" : "auditor";
}

function normalizeSession(data) {
  const source = data?.user || data?.account || data || {};
  return {
    authenticated: data?.authenticated !== false && source.disabled !== true,
    id: source.id || source.userId || source.user_id || "",
    username: source.username || source.account || source.email || "",
    displayName: source.displayName || source.display_name || source.name || source.username || source.account || "Audit user",
    role: normalizeRole(source.role || data?.role),
  };
}

async function auditApi(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  const response = await fetch(auditApiUrl(path), { credentials: "same-origin", ...options, headers });
  if (response.status === 401 && !path.endsWith("/login")) {
    auditState.session = null;
    renderLogin();
    throw new Error("AUTH_REQUIRED");
  }
  if (!response.ok) {
    let message = "";
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || payload.error || "";
    } catch {
      message = await response.text();
    }
    const error = new Error(message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return {};
  return response.json();
}

function setDirection() {
  const isArabic = auditState.language === "ar";
  document.documentElement.lang = isArabic ? "ar" : "en";
  document.documentElement.dir = isArabic ? "rtl" : "ltr";
  document.title = "NMA Audit · Admin Portal";
}

function toggleLanguage() {
  auditState.language = auditState.language === "en" ? "ar" : "en";
  localStorage.setItem("dsh-audit-language", auditState.language);
  if (auditState.session) renderApplication();
  else renderLogin();
}

function revealAuditApp() {
  document.documentElement.classList.remove("dsh-audit-boot");
}

function bindLoginStarlightMotion() {
  const stage = byId("auditLoginBrand");
  const canvas = byId("auditStarlightCanvas");
  if (!stage || !(canvas instanceof HTMLCanvasElement)) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, previousX: 0, previousY: 0, active: false };
  const stars = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let previousTime = performance.now();

  function resetStars() {
    const count = Math.max(42, Math.min(86, Math.round((width * height) / 8500)));
    stars.length = 0;
    for (let index = 0; index < count; index += 1) {
      const anchorX = Math.random() * width;
      const anchorY = Math.random() * height;
      stars.push({
        anchorX,
        anchorY,
        x: anchorX,
        y: anchorY,
        previousX: anchorX,
        previousY: anchorY,
        velocityX: 0,
        velocityY: 0,
        radius: 0.65 + Math.random() * 1.45,
        opacity: 0.22 + Math.random() * 0.56,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    pointer.x = width / 2;
    pointer.y = height / 2;
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
    resetStars();
  }

  function draw(time) {
    const elapsed = Math.min(2, (time - previousTime) / 16.67);
    previousTime = time;
    context.clearRect(0, 0, width, height);

    const pointerVelocityX = pointer.x - pointer.previousX;
    const pointerVelocityY = pointer.y - pointer.previousY;
    const influenceRadius = Math.min(190, Math.max(130, width * 0.24));

    for (const star of stars) {
      star.previousX = star.x;
      star.previousY = star.y;

      if (!reduceMotion) {
        const deltaX = pointer.x - star.x;
        const deltaY = pointer.y - star.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (pointer.active && distance < influenceRadius) {
          const pull = Math.pow(1 - distance / influenceRadius, 2);
          star.velocityX += (deltaX * 0.012 + pointerVelocityX * 0.16) * pull * elapsed;
          star.velocityY += (deltaY * 0.012 + pointerVelocityY * 0.16) * pull * elapsed;
        }

        star.velocityX += (star.anchorX - star.x) * 0.005 * elapsed;
        star.velocityY += (star.anchorY - star.y) * 0.005 * elapsed;
        const damping = Math.pow(0.9, elapsed);
        star.velocityX *= damping;
        star.velocityY *= damping;
        star.x += star.velocityX * elapsed;
        star.y += star.velocityY * elapsed;
      }

      const speed = Math.hypot(star.velocityX, star.velocityY);
      const twinkle = 0.72 + Math.sin(time * 0.0018 + star.phase) * 0.28;
      const opacity = Math.min(0.95, star.opacity * twinkle + speed * 0.018);
      const trailScale = Math.min(5.5, 1.8 + speed * 0.35);

      if (speed > 0.4) {
        const trail = context.createLinearGradient(
          star.x - star.velocityX * trailScale,
          star.y - star.velocityY * trailScale,
          star.x,
          star.y,
        );
        trail.addColorStop(0, "rgba(255, 225, 145, 0)");
        trail.addColorStop(1, `rgba(255, 238, 190, ${opacity * 0.72})`);
        context.beginPath();
        context.moveTo(star.x - star.velocityX * trailScale, star.y - star.velocityY * trailScale);
        context.lineTo(star.x, star.y);
        context.strokeStyle = trail;
        context.lineWidth = Math.max(0.7, star.radius * 0.8);
        context.stroke();
      }

      context.beginPath();
      context.arc(star.x, star.y, star.radius + Math.min(1.4, speed * 0.04), 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 241, 202, ${opacity})`;
      context.shadowColor = "rgba(255, 215, 112, 0.9)";
      context.shadowBlur = 7 + Math.min(11, speed * 0.24);
      context.fill();
      context.shadowBlur = 0;
    }

    pointer.previousX += (pointer.x - pointer.previousX) * 0.7;
    pointer.previousY += (pointer.y - pointer.previousY) * 0.7;
    if (!reduceMotion) frame = requestAnimationFrame(draw);
  }

  function movePointer(event) {
    const bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    if (!pointer.active) {
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
    }
    pointer.active = true;
  }

  function leavePointer() {
    pointer.active = false;
  }

  resize();
  stage.addEventListener("pointermove", movePointer);
  stage.addEventListener("pointerleave", leavePointer);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  draw(previousTime);

  auditState.loginMotionCleanup = () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    stage.removeEventListener("pointermove", movePointer);
    stage.removeEventListener("pointerleave", leavePointer);
    auditState.loginMotionCleanup = null;
  };
}

function renderLogin(message = "") {
  auditState.loginMotionCleanup?.();
  if (auditState.accountOutsideHandler) document.removeEventListener("click", auditState.accountOutsideHandler);
  if (auditState.accountEscapeHandler) document.removeEventListener("keydown", auditState.accountEscapeHandler);
  auditState.accountOutsideHandler = null;
  auditState.accountEscapeHandler = null;
  auditState.workspaceResizeObserver?.disconnect();
  auditState.workspaceResizeObserver = null;
  setDirection();
  document.body.className = "audit-app-body audit-login-body";
  document.body.innerHTML = `
    <main class="audit-login-page">
      <section id="auditLoginBrand" class="audit-login-brand" aria-label="${escapeHtml(t("authority"))}">
        <canvas id="auditStarlightCanvas" class="audit-starlight-canvas" aria-hidden="true"></canvas>
        <img class="audit-login-brand-logo" src="${escapeHtml(auditAssetUrl("assets/login-logo.png"))}" alt="${escapeHtml(t("authority"))}">
        <div class="audit-login-brand-copy">
          <h1>${escapeHtml(t("product"))}</h1>
          <p>${escapeHtml(t("portalSubtitle"))}</p>
        </div>
      </section>
      <section class="audit-login-panel">
        <button id="auditLanguageBtn" class="audit-language-button" type="button">${auditState.language === "en" ? "العربية" : "English"}</button>
        <form id="auditLoginForm" class="audit-login-form">
          <div><h2>${escapeHtml(t("signIn"))}</h2><p>${escapeHtml(t("signInHint"))}</p></div>
          <label><span>${escapeHtml(t("username"))}</span><input id="auditUsername" type="text" autocomplete="username" placeholder="${escapeHtml(t("usernamePlaceholder"))}" required autofocus></label>
          <label><span>${escapeHtml(t("password"))}</span><span class="audit-password-field"><input id="auditPassword" type="password" autocomplete="current-password" placeholder="${escapeHtml(t("passwordPlaceholder"))}" required><button id="auditPasswordToggle" type="button" aria-label="${escapeHtml(t("showPassword"))}">${icon("eye")}</button></span></label>
          <p id="auditLoginError" class="audit-form-error" role="alert">${escapeHtml(message)}</p>
          <button id="auditLoginSubmit" class="audit-primary-button" type="submit">${escapeHtml(t("signInAction"))}</button>
        </form>
      </section>
    </main>`;
  byId("auditLoginBrand").style.setProperty(
    "--audit-login-background",
    `url("${auditAssetUrl("assets/login-bg.png")}")`,
  );
  revealAuditApp();
  bindLoginStarlightMotion();
  byId("auditLanguageBtn").addEventListener("click", toggleLanguage);
  byId("auditPasswordToggle").addEventListener("click", () => {
    const input = byId("auditPassword");
    input.type = input.type === "password" ? "text" : "password";
  });
  byId("auditLoginForm").addEventListener("submit", handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const submit = byId("auditLoginSubmit");
  const error = byId("auditLoginError");
  submit.disabled = true;
  submit.textContent = t("signingIn");
  error.textContent = "";
  try {
    const data = await auditApi("/api/v1/audit-auth/login", {
      method: "POST",
      body: JSON.stringify({ username: byId("auditUsername").value.trim(), password: byId("auditPassword").value }),
    });
    auditState.session = normalizeSession(data);
    renderApplication();
    await loadConversations(1);
  } catch (requestError) {
    error.textContent = requestError.status === 401 || requestError.status === 403 ? t("invalidLogin") : t("serviceUnavailable");
    submit.disabled = false;
    submit.textContent = t("signInAction");
    byId("auditPassword")?.select();
  }
}

function initials(name) {
  return String(name || "AU").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function isAdministrator() {
  return auditState.session?.role === "administrator";
}

function currentViewTitle() {
  return {
    conversations: t("conversationAudit"),
    users: t("accountManagement"),
    skills: t("skillsDiagnostics"),
    tools: t("toolsDiagnostics"),
    configuration: t("configurationManagement"),
  }[auditState.view] || t("conversationAudit");
}

function renderApplication() {
  auditState.loginMotionCleanup?.();
  setDirection();
  document.body.className = "audit-app-body";
  const session = auditState.session;
  document.body.innerHTML = `
    <div class="audit-application">
      <aside id="auditSidebar" class="audit-sidebar">
        <div class="audit-sidebar-brand"><img class="audit-sidebar-logo" src="${escapeHtml(auditAssetUrl("assets/logo.svg"))}" alt="${escapeHtml(t("authority"))}"></div>
        <nav aria-label="${escapeHtml(t("auditNavigation"))}">
          <button class="audit-nav-item ${auditState.view === "conversations" ? "is-active" : ""}" data-audit-view="conversations" type="button">${icon("conversations")}<span>${escapeHtml(t("conversations"))}</span></button>
          ${isAdministrator() ? `<button class="audit-nav-item ${auditState.view === "skills" ? "is-active" : ""}" data-audit-view="skills" type="button">${icon("llm")}<span>${escapeHtml(t("skills"))}</span></button>
          <button class="audit-nav-item ${auditState.view === "tools" ? "is-active" : ""}" data-audit-view="tools" type="button">${icon("tool")}<span>${escapeHtml(t("tools"))}</span></button>
          <button class="audit-nav-item ${auditState.view === "configuration" ? "is-active" : ""}" data-audit-view="configuration" type="button">${icon("settings")}<span>${escapeHtml(t("configuration"))}</span></button>
          <button class="audit-nav-item ${auditState.view === "users" ? "is-active" : ""}" data-audit-view="users" type="button">${icon("users")}<span>${escapeHtml(t("users"))}</span></button>` : ""}
        </nav>
      </aside>
      <main class="audit-main">
        <header class="audit-topbar">
          <div class="audit-title-group"><button id="auditMenuBtn" class="audit-icon-button audit-menu-button" type="button" aria-label="${escapeHtml(t("menuLabel"))}">${icon("menu")}</button><div><span>${escapeHtml(t("product"))}</span><h1>${escapeHtml(currentViewTitle())}</h1></div></div>
          <div class="audit-account-area">
            <button id="auditLanguageBtn" class="audit-language-button" type="button">${auditState.language === "en" ? "AR" : "EN"}</button>
            <div class="audit-account-menu">
              <button id="auditAccountMenuBtn" class="audit-account-summary" type="button" aria-controls="auditAccountDropdown" aria-expanded="false" aria-label="${escapeHtml(t("accountMenu"))}"><span class="audit-avatar">${escapeHtml(initials(session.displayName))}</span><span><strong>${escapeHtml(session.displayName)}</strong><small>${escapeHtml(t(session.role))}</small></span>${icon("chevron")}</button>
              <div id="auditAccountDropdown" class="audit-account-dropdown" hidden><button id="auditSignOutBtn" type="button">${icon("logout")}<span>${escapeHtml(t("signOut"))}</span></button></div>
            </div>
          </div>
        </header>
        <section id="auditContent" class="audit-content"></section>
      </main>
      <div id="auditToast" class="audit-toast" role="status" aria-live="polite"></div>
      <div id="auditDialogHost"></div>
    </div>`;
  byId("auditLanguageBtn").addEventListener("click", toggleLanguage);
  byId("auditSignOutBtn").addEventListener("click", handleLogout);
  bindAccountMenu();
  byId("auditMenuBtn").addEventListener("click", () => byId("auditSidebar").classList.toggle("is-open"));
  document.querySelectorAll("[data-audit-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.auditView)));
  renderCurrentView();
  revealAuditApp();
}

function renderCurrentView() {
  if (auditState.view === "users" && isAdministrator()) renderUsersView();
  else if (["skills", "tools"].includes(auditState.view) && isAdministrator()) renderDiagnosticsView(auditState.view);
  else if (auditState.view === "configuration" && isAdministrator()) renderConfigurationView();
  else renderConversationsView();
}

function switchView(view) {
  if (["users", "skills", "tools", "configuration"].includes(view) && !isAdministrator()) return;
  auditState.view = view;
  renderApplication();
  if (view === "users" && !auditState.usersLoaded) void loadUsers();
  if (["skills", "tools"].includes(view) && !auditState.diagnosticsLoaded[view]) void loadDiagnostics(view);
  if (view === "configuration" && !auditState.configurationLoaded) void loadConfiguration();
}

function bindAccountMenu() {
  const trigger = byId("auditAccountMenuBtn");
  const menu = byId("auditAccountDropdown");
  const close = ({ restoreFocus = false } = {}) => {
    const wasOpen = !menu.hidden;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && wasOpen) trigger.focus();
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
  });
  menu.addEventListener("click", (event) => event.stopPropagation());
  if (auditState.accountOutsideHandler) document.removeEventListener("click", auditState.accountOutsideHandler);
  auditState.accountOutsideHandler = () => close();
  document.addEventListener("click", auditState.accountOutsideHandler);
  if (auditState.accountEscapeHandler) document.removeEventListener("keydown", auditState.accountEscapeHandler);
  auditState.accountEscapeHandler = (event) => { if (event.key === "Escape") close({ restoreFocus: true }); };
  document.addEventListener("keydown", auditState.accountEscapeHandler);
}

async function handleLogout() {
  try { await auditApi("/api/v1/audit-auth/logout", { method: "POST" }); } catch { /* The local session is cleared regardless. */ }
  auditState.session = null;
  auditState.conversations = [];
  auditState.detail = null;
  auditState.records = [];
  auditState.users = [];
  auditState.usersLoaded = false;
  auditState.diagnostics = { skills: [], tools: [] };
  auditState.diagnosticsLoaded = { skills: false, tools: false };
  auditState.diagnosticMeta = {
    skills: { page: 1, pageSize: 25, total: 0, search: "" },
    tools: { page: 1, pageSize: 25, total: 0, search: "" },
  };
  auditState.configuration = [];
  auditState.configurationLoaded = false;
  auditState.configurationSection = "model";
  auditState.configurationDraft = {};
  auditState.configurationSecretsOpen.clear();
  auditState.expandedSummaries.clear();
  auditState.openPayloads.clear();
  renderLogin();
}

function renderConversationsView() {
  byId("auditContent").innerHTML = `
    <form id="auditFilters" class="audit-filter-panel">
      <label class="audit-search-field"><span class="audit-visually-hidden">Search</span>${icon("search")}<input id="auditSearch" type="search" placeholder="${escapeHtml(t("searchPlaceholder"))}" autocomplete="off"></label>
      <label><span>${escapeHtml(t("dateRange"))}</span><select id="auditDateRange"><option value="">${escapeHtml(t("allTime"))}</option><option value="today">${escapeHtml(t("today"))}</option><option value="7d">${escapeHtml(t("last7Days"))}</option><option value="30d">${escapeHtml(t("last30Days"))}</option></select></label>
      <label><span>${escapeHtml(t("status"))}</span><select id="auditStatusFilter"><option value="">${escapeHtml(t("allStatuses"))}</option><option value="READY">${escapeHtml(t("completed"))}</option><option value="BUSY">${escapeHtml(t("inProgress"))}</option><option value="DEAD">${escapeHtml(t("failed"))}</option><option value="CANCELLED">${escapeHtml(t("cancelled"))}</option></select></label>
      <label><span>${escapeHtml(t("category"))}</span><select id="auditCategoryFilterApp"><option value="">${escapeHtml(t("allEvents"))}</option><option value="conversation">${escapeHtml(t("messages"))}</option><option value="dsh">${escapeHtml(t("tools"))}</option><option value="llm">${escapeHtml(t("llm"))}</option><option value="runtime">${escapeHtml(t("runtime"))}</option></select></label>
      <button class="audit-primary-button" type="submit">${escapeHtml(t("applyFilters"))}</button>
    </form>
    <div id="auditWorkspace" class="audit-workspace" style="--audit-list-width: ${Math.round(auditState.listPaneWidth)}px">
      <section class="audit-list-panel" aria-label="${escapeHtml(t("conversations"))}">
        <header><div><h2>${escapeHtml(t("conversations"))}</h2><span id="auditConversationCount">${auditState.conversationTotal} ${escapeHtml(t("records"))}</span></div><button id="auditRefreshBtn" class="audit-icon-button" type="button" title="${escapeHtml(t("refresh"))}" aria-label="${escapeHtml(t("refresh"))}">${icon("refresh")}</button></header>
        <div class="audit-list-labels"><span>${escapeHtml(t("conversations"))}</span><span>${escapeHtml(t("result"))}</span></div>
        <div id="auditConversationListApp" class="audit-conversation-list-app"></div>
        <div id="auditConversationPagerApp" class="audit-pagination"></div>
      </section>
      <div id="auditPaneSeparator" class="audit-pane-separator" role="separator" aria-orientation="vertical" aria-label="${escapeHtml(t("resizePanels"))}" aria-valuemin="280" aria-valuemax="800" aria-valuenow="${Math.round(auditState.listPaneWidth)}" tabindex="0"><span></span></div>
      <section id="auditDetailPanel" class="audit-detail-panel"></section>
    </div>`;
  byId("auditSearch").value = auditState.filters.search;
  byId("auditDateRange").value = auditState.filters.dateRange;
  byId("auditStatusFilter").value = auditState.filters.status;
  byId("auditCategoryFilterApp").value = auditState.filters.category;
  byId("auditFilters").addEventListener("submit", (event) => { event.preventDefault(); void loadConversations(1); });
  byId("auditRefreshBtn").addEventListener("click", () => void loadConversations(auditState.conversationPage));
  let searchTimer;
  byId("auditSearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => void loadConversations(1), 300); });
  byId("auditCategoryFilterApp").addEventListener("change", () => {
    readFiltersFromControls();
    if (auditState.selectedConversationId) void loadConversationDetail(auditState.selectedConversationId);
  });
  initWorkspaceResize();
  renderConversationList();
  renderConversationDetail();
}

function initWorkspaceResize() {
  const workspace = byId("auditWorkspace");
  const separator = byId("auditPaneSeparator");
  if (!workspace || !separator) return;
  const limits = () => {
    const width = workspace.getBoundingClientRect().width;
    return { min: 280, max: Math.max(280, Math.min(800, width - 440 - 12)) };
  };
  const setWidth = (nextWidth, persist = false) => {
    const { min, max } = limits();
    auditState.listPaneWidth = Math.min(max, Math.max(min, nextWidth));
    workspace.style.setProperty("--audit-list-width", `${Math.round(auditState.listPaneWidth)}px`);
    separator.setAttribute("aria-valuemax", String(Math.round(max)));
    separator.setAttribute("aria-valuenow", String(Math.round(auditState.listPaneWidth)));
    if (persist) localStorage.setItem("dsh-audit-list-width", String(Math.round(auditState.listPaneWidth)));
  };
  setWidth(auditState.listPaneWidth);
  separator.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || window.matchMedia("(max-width: 1023px)").matches) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = auditState.listPaneWidth;
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    separator.setPointerCapture(event.pointerId);
    separator.classList.add("is-dragging");
    document.body.classList.add("is-audit-resizing");
    const move = (moveEvent) => setWidth(startWidth + ((moveEvent.clientX - startX) * direction));
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      separator.classList.remove("is-dragging");
      document.body.classList.remove("is-audit-resizing");
      separator.removeEventListener("pointermove", move);
      separator.removeEventListener("pointerup", end);
      separator.removeEventListener("pointercancel", end);
      separator.removeEventListener("lostpointercapture", end);
      setWidth(auditState.listPaneWidth, true);
    };
    separator.addEventListener("pointermove", move);
    separator.addEventListener("pointerup", end);
    separator.addEventListener("pointercancel", end);
    separator.addEventListener("lostpointercapture", end);
  });
  separator.addEventListener("keydown", (event) => {
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    let next = auditState.listPaneWidth;
    if (event.key === "ArrowLeft") next -= 24 * direction;
    else if (event.key === "ArrowRight") next += 24 * direction;
    else if (event.key === "Home") next = limits().min;
    else if (event.key === "End") next = limits().max;
    else return;
    event.preventDefault();
    setWidth(next, true);
  });
  auditState.workspaceResizeObserver?.disconnect();
  auditState.workspaceResizeObserver = new ResizeObserver(() => setWidth(auditState.listPaneWidth));
  auditState.workspaceResizeObserver.observe(workspace);
}

function conversationParams(page) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(auditState.conversationPageSize) });
  if (auditState.filters.search) params.set("search", auditState.filters.search);
  if (auditState.filters.status) params.set("status", auditState.filters.status);
  const range = auditState.filters.dateRange;
  if (range) {
    const from = new Date();
    if (range === "today") from.setHours(0, 0, 0, 0);
    else from.setDate(from.getDate() - Number.parseInt(range, 10));
    params.set("dateFrom", from.toISOString());
  }
  return params;
}

function readFiltersFromControls() {
  const fields = {
    search: "auditSearch",
    dateRange: "auditDateRange",
    status: "auditStatusFilter",
    category: "auditCategoryFilterApp",
  };
  Object.entries(fields).forEach(([key, id]) => {
    const control = byId(id);
    if (control) auditState.filters[key] = String(control.value || "").trim();
  });
}

async function loadConversations(page = 1) {
  readFiltersFromControls();
  const request = ++auditState.listRequest;
  const list = byId("auditConversationListApp");
  if (list) list.innerHTML = `<div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div>`;
  try {
    const data = await auditApi(`/api/v1/audit/conversations?${conversationParams(page)}`);
    if (request !== auditState.listRequest) return;
    auditState.conversations = data.conversations || data.items || [];
    auditState.conversationPage = Number(data.page || page);
    auditState.conversationPageSize = Number(data.pageSize || data.page_size || auditState.conversationPageSize);
    auditState.conversationTotal = Number(data.total ?? auditState.conversations.length);
    if (!auditState.conversations.some((item) => conversationKey(item) === auditState.selectedConversationId)) {
      const nextConversationId = conversationKey(auditState.conversations[0]);
      if (nextConversationId !== auditState.selectedConversationId) {
        auditState.expandedSummaries.clear();
        auditState.openPayloads.clear();
      }
      auditState.selectedConversationId = nextConversationId;
    }
    renderConversationList();
    if (auditState.selectedConversationId) await loadConversationDetail(auditState.selectedConversationId);
    else { auditState.detail = null; auditState.records = []; renderConversationDetail(); }
  } catch (error) {
    if (error.message === "AUTH_REQUIRED" || request !== auditState.listRequest) return;
    if (list) list.innerHTML = errorState(() => loadConversations(page));
  }
}

function conversationKey(item) {
  return String(item?.dshSessionId || item?.dsh_session_id || item?.conversationId || item?.conversation_id || item?.id || "");
}

function displayConversationId(item) {
  return String(item?.conversationId || item?.conversation_id || conversationKey(item) || "");
}

function conversationTitle(item) {
  return item?.title || item?.firstMessage || item?.first_message || conversationKey(item) || t("untitledConversation");
}

function compactIdentifier(value) {
  const text = String(value || "");
  return text.length > 22 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function conversationAccount(item) {
  const account = item?.ownerAccount || item?.owner_account || item?.auditIdentity?.account || item?.audit_identity?.account || item?.account;
  if (account) return String(account);
  const userId = item?.ownerUserId || item?.owner_user_id || item?.owner?.userId || item?.owner?.user_id || "";
  return userId ? `${t("userId")}: ${compactIdentifier(userId)}` : t("notRecorded");
}

function statusInfo(value) {
  const normalized = String(value || "").toUpperCase();
  if (["READY", "COMPLETED", "SUCCESS"].includes(normalized)) return { className: "success", label: t("completed") };
  if (["BUSY", "RUNNING", "PENDING"].includes(normalized)) return { className: "busy", label: t("inProgress") };
  if (["CANCELLED", "CANCELED"].includes(normalized)) return { className: "neutral", label: t("cancelled") };
  if (["DEAD", "FAILED", "ERROR"].includes(normalized)) return { className: "danger", label: t("failed") };
  return { className: "neutral", label: value || t("unknownStatus") };
}

function formatDate(value, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(auditState.language === "ar" ? "ar-AE" : "en-GB", {
    day: "2-digit", month: "short", year: includeTime ? undefined : "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}),
  }).format(date);
}

function renderConversationList() {
  const list = byId("auditConversationListApp");
  if (!list) return;
  byId("auditConversationCount").textContent = `${auditState.conversationTotal} ${t("records")}`;
  if (!auditState.conversations.length) {
    list.innerHTML = `<div class="audit-empty-state">${icon("search")}<p>${escapeHtml(t("noConversations"))}</p></div>`;
  } else {
    list.innerHTML = auditState.conversations.map((item) => {
      const id = conversationKey(item);
      const status = statusInfo(item.status);
      const tenant = item.ownerTenantId || item.owner_tenant_id || item.owner?.tenantId || item.tenant || "";
      return `<button class="audit-conversation-row ${id === auditState.selectedConversationId ? "is-selected" : ""}" type="button" data-conversation-id="${escapeHtml(id)}">
        <span><strong dir="auto" title="${escapeHtml(conversationAccount(item))}">${escapeHtml(conversationAccount(item))}</strong><span class="audit-conversation-preview" dir="auto" title="${escapeHtml(conversationTitle(item))}">${escapeHtml(conversationTitle(item))}</span><small dir="auto">${escapeHtml([tenant, formatDate(item.lastActivityAt || item.last_activity_at || item.createdAt)].filter(Boolean).join(" · "))}</small></span>
        <span class="audit-status ${status.className}">${escapeHtml(status.label)}</span>
      </button>`;
    }).join("");
    list.querySelectorAll("[data-conversation-id]").forEach((button) => button.addEventListener("click", () => void loadConversationDetail(button.dataset.conversationId)));
  }
  renderConversationPager();
}

function renderConversationPager() {
  const pager = byId("auditConversationPagerApp");
  if (!pager) return;
  const totalPages = Math.max(1, Math.ceil(auditState.conversationTotal / auditState.conversationPageSize));
  if (totalPages <= 1) { pager.innerHTML = ""; return; }
  pager.innerHTML = paginationMarkup(auditState.conversationPage, totalPages, "data-page", true);
  pager.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => void loadConversations(Number(button.dataset.page))));
}

async function loadConversationDetail(conversationId, { append = false } = {}) {
  if (!conversationId) return;
  if (conversationId !== auditState.selectedConversationId) {
    auditState.expandedSummaries.clear();
    auditState.openPayloads.clear();
  }
  auditState.selectedConversationId = conversationId;
  renderConversationList();
  const panel = byId("auditDetailPanel");
  const previousScrollTop = append ? (byId("auditTimeline")?.scrollTop || 0) : 0;
  if (panel && !append) panel.innerHTML = `<div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div>`;
  const request = ++auditState.detailRequest;
  const page = append ? auditState.recordPage + 1 : 1;
  const params = new URLSearchParams({ page: String(page), pageSize: String(auditState.recordPageSize) });
  const category = auditState.filters.category;
  if (category) params.set("category", category);
  try {
    const data = await auditApi(`/api/v1/audit/conversations/${encodeURIComponent(conversationId)}?${params}`);
    if (request !== auditState.detailRequest) return;
    auditState.detail = data.conversation || data;
    const records = data.items || data.records || data.events || [];
    auditState.records = append ? [...auditState.records, ...records] : records;
    auditState.recordPage = Number(data.page || page);
    auditState.recordTotal = Number(data.total ?? auditState.records.length);
    renderConversationDetail();
    if (append) byId("auditTimeline")?.scrollTo({ top: previousScrollTop });
  } catch (error) {
    if (error.message === "AUTH_REQUIRED" || request !== auditState.detailRequest) return;
    if (append) {
      showToast(error.message || t("loadFailed"), true);
      renderConversationDetail();
    } else if (panel) {
      panel.innerHTML = errorState(() => loadConversationDetail(conversationId));
    }
  }
}

function errorState(retry) {
  requestAnimationFrame(() => {
    const retryButton = document.querySelector("[data-audit-retry]:last-of-type");
    if (retryButton) retryButton.addEventListener("click", retry);
  });
  return `<div class="audit-empty-state audit-error-state"><p>${escapeHtml(t("loadFailed"))}</p><button data-audit-retry class="audit-secondary-button" type="button">${escapeHtml(t("retry"))}</button></div>`;
}

function detailField(detail, ...keys) {
  for (const key of keys) if (detail?.[key] !== undefined && detail?.[key] !== null && detail[key] !== "") return detail[key];
  return "-";
}

function renderConversationDetail() {
  const panel = byId("auditDetailPanel");
  if (!panel) return;
  if (!auditState.detail || !auditState.selectedConversationId) {
    panel.innerHTML = `<div class="audit-empty-state audit-detail-empty">${icon("conversations")}<p>${escapeHtml(t("selectConversation"))}</p></div>`;
    return;
  }
  const detail = auditState.detail;
  const listItem = auditState.conversations.find((item) => conversationKey(item) === auditState.selectedConversationId) || detail;
  const status = statusInfo(detail.status);
  const owner = detail.owner || {};
  const identity = detail.auditIdentity || detail.audit_identity || {};
  const account = detailField(identity, "account") !== "-"
    ? detailField(identity, "account")
    : conversationAccount({ ...listItem, ...detail, owner });
  const recordedRole = detailField(identity, "currentRole", "current_role", "role");
  const currentRole = recordedRole === "-" ? t("notRecorded") : recordedRole;
  const facts = [
    [t("role"), currentRole],
    [t("tenant"), detailField(detail, "ownerTenantId", "owner_tenant_id") !== "-" ? detailField(detail, "ownerTenantId", "owner_tenant_id") : detailField(owner, "tenantId", "tenant_id")],
    [t("runtime"), detailField(detail, "runtimeId", "runtime_id")],
    [t("lastActivity"), formatDate(detailField(detail, "lastActivityAt", "last_activity_at"))],
  ];
  const additionalFacts = [
    [t("userId"), detailField(owner, "userId", "user_id")],
    [t("conversationId"), detailField(detail, "conversationId", "conversation_id")],
    [t("events"), detailField(detail, "lastSeq", "last_seq")],
    [t("created"), formatDate(detailField(detail, "createdAt", "created_at"))],
    [t("dshSession"), detailField(detail, "dshSessionId", "dsh_session_id")],
    [t("skillProfile"), detailField(detail, "skillProfile", "skill_profile")],
  ];
  panel.innerHTML = `
    <header class="audit-detail-head"><div><span class="audit-status ${status.className}">${escapeHtml(status.label)}</span><h2 dir="auto" title="${escapeHtml(account)}">${escapeHtml(account)}</h2><p dir="auto" title="${escapeHtml(conversationTitle(listItem))}">${escapeHtml(conversationTitle(listItem))}</p></div></header>
    <dl class="audit-detail-facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd dir="auto" title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`).join("")}</dl>
    <details class="audit-session-details"><summary><span>${escapeHtml(t("sessionDetails"))}</span>${icon("chevron")}</summary><dl>${additionalFacts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd dir="auto" title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`).join("")}</dl></details>
    ${detail.lastError || detail.last_error ? `<p class="audit-detail-error">${escapeHtml(detail.lastError || detail.last_error)}</p>` : ""}
    <div class="audit-trail-head"><div><h3>${escapeHtml(t("executionTrail"))}</h3><span>${auditState.recordTotal} ${escapeHtml(t("events"))}</span></div></div>
    <div id="auditTimeline" class="audit-timeline">${renderTimeline()}${auditState.records.length < auditState.recordTotal ? `<button id="auditLoadMoreEvents" class="audit-secondary-button audit-load-more" type="button">${escapeHtml(t("loadMore"))}</button>` : ""}</div>`;
  byId("auditLoadMoreEvents")?.addEventListener("click", (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = t("loading");
    void loadConversationDetail(auditState.selectedConversationId, { append: true });
  });
  bindTimelineActions(panel);
}

function eventCategory(item) {
  const explicit = String(item.category || "").toLowerCase();
  if (explicit) return explicit;
  const type = String(item.recordType || item.record_type || item.eventType || item.type || "");
  if (type.startsWith("tool") || type.startsWith("skill")) return "dsh";
  if (type.startsWith("llm")) return "llm";
  if (type.includes("message") || type.startsWith("turn")) return "conversation";
  return "runtime";
}

function eventType(item) {
  return item.recordType || item.record_type || item.eventType || item.event_type || item.type || "runtime.event";
}

function eventSummary(item) {
  const payload = item.payload || item.eventJson || item.event_json || {};
  const content = String(payload.content || payload.message || payload.text || "").replace(/\s+/g, " ").trim();
  const type = eventType(item);
  const toolName = payload.toolName || payload.tool_name || payload.name || "";
  const skill = payload.skillId || payload.skill_id || "";
  if (type === "user.message") return content || t("messageReceived");
  if (type === "assistant.message") return content || t("responseDelivered");
  if (type === "assistant.chunk") return content || t("contentStreamed");
  if (type === "assistant.status") return content || t("statusUpdated");
  if (type === "skill.route") return `${skill || t("skills")} ${t("selected")}${payload.mode ? ` · ${payload.mode}` : ""}`;
  if (type === "tool.call") return `${toolName || t("tools")} ${t("called")}`;
  if (type === "tool.result") return `${toolName || t("tools")} ${t(payload.ok === false ? "toolFailed" : "toolCompleted")}`;
  if (type === "llm.request") return `${payload.model || t("llm")} ${t("requestSent")}`;
  if (type === "llm.response") return content || t("modelCompleted");
  if (type === "llm.error" || type === "runtime.error") return String(payload.error || content || t("executionFailed"));
  if (type === "turn.started") return t("processingStarted");
  if (type === "turn.completed") return t("processingCompleted");
  if (type === "turn.cancelled") return t("processingCancelled");
  return content || type.replaceAll(".", " ");
}

function eventDisplayName(type) {
  const labels = {
    "user.message": "userMessage", "assistant.message": "assistantResponse", "assistant.chunk": "responseStream",
    "assistant.status": "processingStatus", "skill.route": "skillRouted", "tool.call": "toolCall",
    "tool.result": "toolResult", "llm.request": "llmRequest", "llm.response": "llmResponse",
    "llm.thought": "llmReasoning", "llm.error": "llmError", "runtime.error": "runtimeError",
    "turn.started": "requestStarted", "turn.completed": "requestCompleted", "turn.cancelled": "requestCancelled",
  };
  return labels[type] ? t(labels[type]) : type.replaceAll(".", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventKey(item, index) {
  return String(item.id || item.auditId || item.audit_id || [eventType(item), item.createdAt || item.created_at || item.timestamp || "", item.requestId || item.request_id || "", index].join("|"));
}

function renderTimeline() {
  if (!auditState.records.length) return `<div class="audit-empty-state"><p>${escapeHtml(t("noEvents"))}</p></div>`;
  let previousRequest = null;
  return auditState.records.map((item, index) => {
    const type = eventType(item);
    const category = eventCategory(item);
    const requestId = item.requestId || item.request_id || "";
    const timestamp = item.createdAt || item.created_at || item.timestamp;
    const payload = item.payload || item.eventJson || item.event_json || {};
    const summaryText = eventSummary(item);
    const longSummary = summaryText.length > 220 || (["llm.thought", "llm.response", "assistant.message"].includes(type) && summaryText.length > 120);
    const key = eventKey(item, index);
    const summaryExpanded = auditState.expandedSummaries.has(key);
    const payloadOpen = auditState.openPayloads.has(key);
    const group = requestId !== previousRequest
      ? `<div class="audit-request-divider"><span>${requestId ? `${escapeHtml(t("request"))} <bdi dir="ltr">${escapeHtml(requestId)}</bdi>` : escapeHtml(t("sessionEvents"))}</span></div>`
      : "";
    previousRequest = requestId;
    const categoryIcon = category === "conversation" ? "message" : category === "dsh" ? "tool" : category === "llm" ? "llm" : "runtime";
    return `${group}<article class="audit-timeline-event">
      <span class="audit-timeline-icon ${escapeHtml(category)}">${icon(categoryIcon)}</span>
      <div class="audit-timeline-content"><header><strong>${escapeHtml(eventDisplayName(type))}</strong><span class="audit-event-head-actions"><time>${escapeHtml(formatDate(timestamp))}</time><button class="audit-inline-icon-button" data-copy-activity="${index}" type="button" title="${escapeHtml(t("copyActivity"))}" aria-label="${escapeHtml(t("copyActivity"))}">${icon("copy")}</button></span></header>
      <div class="audit-event-summary${longSummary ? " is-collapsible" : ""}${summaryExpanded ? " is-expanded" : ""}" data-event-key="${escapeHtml(key)}"><p>${escapeHtml(summaryText)}</p>${longSummary ? `<button class="audit-link-button" data-toggle-summary type="button" aria-expanded="${summaryExpanded ? "true" : "false"}">${escapeHtml(t(summaryExpanded ? "showLess" : "showMore"))}</button>` : ""}</div>
      ${Object.keys(payload).length ? `<div class="audit-payload-row"><details class="audit-payload" data-payload-key="${escapeHtml(key)}"${payloadOpen ? " open" : ""}><summary><span>${escapeHtml(t(payloadOpen ? "hidePayload" : "payload"))}</span>${icon("chevron")}</summary><pre dir="ltr">${escapeHtml(JSON.stringify(payload, null, 2))}</pre></details><button class="audit-inline-icon-button" data-copy-payload="${index}" type="button" title="${escapeHtml(t("copyPayload"))}" aria-label="${escapeHtml(t("copyPayload"))}">${icon("copy")}</button></div>` : ""}</div>
    </article>`;
  }).join("");
}

function activityCopyText(item) {
  const requestId = item.requestId || item.request_id || "";
  const runtimeId = item.runtimeId || item.runtime_id || "";
  const timestamp = item.createdAt || item.created_at || item.timestamp;
  return [
    eventDisplayName(eventType(item)),
    formatDate(timestamp),
    eventSummary(item),
    requestId && `${t("requestId")}: ${requestId}`,
    runtimeId && `${t("runtime")}: ${runtimeId}`,
  ].filter(Boolean).join("\n");
}

async function copyTextToClipboard(value) {
  let textarea = null;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      if (!document.execCommand("copy")) throw new Error("copy failed");
    }
    showToast(t("copied"));
  } catch {
    showToast(t("copyFailed"), true);
  } finally {
    textarea?.remove();
  }
}

function bindTimelineActions(panel) {
  panel.querySelectorAll("[data-toggle-summary]").forEach((button) => button.addEventListener("click", () => {
    const summary = button.closest(".audit-event-summary");
    const expanded = summary.classList.toggle("is-expanded");
    const key = summary.dataset.eventKey;
    if (expanded) auditState.expandedSummaries.add(key);
    else auditState.expandedSummaries.delete(key);
    button.textContent = t(expanded ? "showLess" : "showMore");
    button.setAttribute("aria-expanded", String(expanded));
  }));
  panel.querySelectorAll(".audit-payload summary").forEach((summary) => summary.addEventListener("click", () => {
    requestAnimationFrame(() => {
      const details = summary.parentElement;
      const key = details.dataset.payloadKey;
      if (details.open) auditState.openPayloads.add(key);
      else auditState.openPayloads.delete(key);
      summary.querySelector("span").textContent = details.open ? t("hidePayload") : t("payload");
    });
  }));
  panel.querySelectorAll("[data-copy-activity]").forEach((button) => button.addEventListener("click", () => {
    const item = auditState.records[Number(button.dataset.copyActivity)];
    if (item) void copyTextToClipboard(activityCopyText(item));
  }));
  panel.querySelectorAll("[data-copy-payload]").forEach((button) => button.addEventListener("click", () => {
    const item = auditState.records[Number(button.dataset.copyPayload)];
    const payload = item?.payload || item?.eventJson || item?.event_json;
    if (payload) void copyTextToClipboard(JSON.stringify(payload, null, 2));
  }));
}

function renderDiagnosticsView(kind) {
  const isSkills = kind === "skills";
  const items = auditState.diagnostics[kind] || [];
  const meta = auditState.diagnosticMeta[kind];
  const headings = isSkills
    ? [t("name"), "ID", t("version"), t("source"), t("status"), t("tools")]
    : [t("name"), t("endpoint"), t("effect"), t("source"), t("status")];
  const content = byId("auditContent");
  content.classList.add("is-diagnostics-view");
  content.innerHTML = `
    <section class="audit-diagnostics-panel">
      <header><div><h2>${escapeHtml(t(isSkills ? "skillsDiagnostics" : "toolsDiagnostics"))}</h2><p>${escapeHtml(t("diagnosticsHint"))}</p></div><button id="auditDiagnosticsRefresh" class="audit-icon-button" type="button" title="${escapeHtml(t("refresh"))}" aria-label="${escapeHtml(t("refresh"))}">${icon("refresh")}</button></header>
      <form id="auditDiagnosticsControls" class="audit-diagnostics-controls">
        <label class="audit-search-field"><span class="audit-visually-hidden">${escapeHtml(t("search"))}</span>${icon("search")}<input id="auditDiagnosticsSearch" type="search" value="${escapeHtml(meta.search)}" placeholder="${escapeHtml(t(isSkills ? "searchSkills" : "searchTools"))}" autocomplete="off"></label>
      </form>
      <div class="audit-diagnostics-table-wrap"><table class="audit-diagnostics-table"><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody id="auditDiagnosticsBody"></tbody></table></div>
      <footer class="audit-diagnostics-footer">
        <div class="audit-diagnostics-footer-controls">
          <span id="auditDiagnosticsCount" class="audit-diagnostics-count">${escapeHtml(t("total"))} ${meta.total}</span>
          <div id="auditDiagnosticsPager" class="audit-pagination"></div>
          <label class="audit-page-size"><span class="audit-visually-hidden">${escapeHtml(t("rowsPerPage"))}</span><select id="auditDiagnosticsPageSize">${[25, 50, 100].map((size) => `<option value="${size}" ${size === meta.pageSize ? "selected" : ""}>${size} ${escapeHtml(t("perPage"))}</option>`).join("")}</select></label>
        </div>
      </footer>
    </section>`;
  byId("auditDiagnosticsRefresh").addEventListener("click", () => void loadDiagnostics(kind, meta.page));
  byId("auditDiagnosticsControls").addEventListener("submit", (event) => {
    event.preventDefault();
    meta.search = byId("auditDiagnosticsSearch").value.trim();
    void loadDiagnostics(kind, 1);
  });
  let searchTimer;
  byId("auditDiagnosticsSearch").addEventListener("input", (event) => {
    meta.search = event.currentTarget.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void loadDiagnostics(kind, 1), 300);
  });
  byId("auditDiagnosticsPageSize").addEventListener("change", (event) => {
    meta.pageSize = Number(event.currentTarget.value) || 25;
    void loadDiagnostics(kind, 1);
  });
  renderDiagnosticsRows(kind, items);
  renderDiagnosticsPager(kind);
}

function renderDiagnosticsRows(kind, items = auditState.diagnostics[kind] || []) {
  const body = byId("auditDiagnosticsBody");
  if (!body) return;
  const columns = kind === "skills" ? 6 : 5;
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="${columns}"><div class="audit-empty-state"><p>${escapeHtml(t("noDiagnostics"))}</p></div></td></tr>`;
    return;
  }
  body.innerHTML = items.map((item) => {
    const enabled = item.enabled !== false && item.disabled !== true;
    const status = String(item.status || (item.published ? t("published") : t("draft")));
    if (kind === "skills") {
      const toolNames = item.allowedTools || item.allowed_tools || item.toolNames || item.tools || [];
      return `<tr><td><strong>${escapeHtml(item.name || item.displayName || item.skillId || "-")}</strong></td><td><code>${escapeHtml(item.skillId || item.skill_id || item.id || "-")}</code></td><td>${escapeHtml(item.version || "-")}</td><td>${escapeHtml([item.source, item.scope].filter(Boolean).join(" / ") || "-")}</td><td><span class="audit-diagnostic-state ${enabled ? "active" : "inactive"}">${escapeHtml(status)} · ${escapeHtml(t(enabled ? "enabled" : "disabled"))}</span></td><td>${escapeHtml(Array.isArray(toolNames) ? toolNames.join(", ") || "-" : toolNames || "-")}</td></tr>`;
    }
    const method = item.httpMethod || item.http_method || "";
    const path = item.httpPath || item.http_path || "";
    const published = item.published !== false;
    return `<tr><td><strong>${escapeHtml(item.displayName || item.display_name || item.toolName || item.tool_name || "-")}</strong><code>${escapeHtml(item.toolName || item.tool_name || "")}</code></td><td><code>${escapeHtml([method, path].filter(Boolean).join(" ") || "-")}</code></td><td>${escapeHtml(item.sideEffect || item.side_effect || "read")}${item.confirmationRequired || item.confirmation_required ? " · confirmation" : ""}</td><td>${escapeHtml(item.toolType || item.tool_type || item.source || "-")}</td><td><span class="audit-diagnostic-state ${enabled && published ? "active" : "inactive"}">${escapeHtml(t(published ? "published" : "draft"))} · ${escapeHtml(t(enabled ? "enabled" : "disabled"))}</span></td></tr>`;
  }).join("");
}

function renderDiagnosticsPager(kind) {
  const meta = auditState.diagnosticMeta[kind];
  const count = byId("auditDiagnosticsCount");
  const pager = byId("auditDiagnosticsPager");
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (count) count.textContent = `${t("total")} ${meta.total}  ${meta.page}/${totalPages}`;
  if (!pager) return;
  pager.innerHTML = paginationMarkup(meta.page, totalPages, "data-diagnostic-page");
  pager.querySelectorAll("[data-diagnostic-page]").forEach((button) => button.addEventListener("click", () => void loadDiagnostics(kind, Number(button.dataset.diagnosticPage))));
}

async function loadDiagnostics(kind, page = auditState.diagnosticMeta[kind].page) {
  const body = byId("auditDiagnosticsBody");
  const columns = kind === "skills" ? 6 : 5;
  const meta = auditState.diagnosticMeta[kind];
  const request = ++auditState.diagnosticRequests[kind];
  if (body) body.innerHTML = `<tr><td colspan="${columns}"><div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div></td></tr>`;
  try {
    const params = new URLSearchParams({ page: String(page), pageSize: String(meta.pageSize) });
    if (meta.search) params.set("search", meta.search);
    const data = await auditApi(`/api/v1/audit/${kind}?${params}`);
    if (request !== auditState.diagnosticRequests[kind]) return;
    auditState.diagnostics[kind] = data.items || data[kind] || (Array.isArray(data) ? data : []);
    meta.page = Number(data.page || page);
    meta.pageSize = Number(data.pageSize || data.page_size || meta.pageSize);
    meta.total = Number(data.total ?? auditState.diagnostics[kind].length);
    auditState.diagnosticsLoaded[kind] = true;
    if (auditState.view === kind) {
      renderDiagnosticsRows(kind);
      renderDiagnosticsPager(kind);
    }
  } catch (error) {
    if (error.message === "AUTH_REQUIRED" || request !== auditState.diagnosticRequests[kind]) return;
    if (body) body.innerHTML = `<tr><td colspan="${columns}"><div class="audit-empty-state audit-error-state"><p>${escapeHtml(t("loadFailed"))}</p><button id="auditDiagnosticsRetry" class="audit-secondary-button" type="button">${escapeHtml(t("retry"))}</button></div></td></tr>`;
    byId("auditDiagnosticsRetry")?.addEventListener("click", () => void loadDiagnostics(kind, page));
  }
}

function configurationLabel(item) {
  return configFieldLabels[auditState.language]?.[item.key]
    || configFieldLabels.en[item.key]
    || item.env
    || item.key;
}

function configurationValue(item) {
  if (item.secret) return "";
  if (item.value === null || item.value === undefined) return "";
  return String(item.value);
}

function configurationSectionForItem(item) {
  if (["基础设施", "UMC Portal"].includes(item.group) || item.key === "umc_document_base_url") return "environment";
  if (item.group === "模型") return "model";
  if (item.group === "外部 Tool") return "tools";
  if (item.group === "链路审计") return "audit";
  return "routing";
}

function configurationDraftValue(item) {
  return Object.prototype.hasOwnProperty.call(auditState.configurationDraft, item.key)
    ? auditState.configurationDraft[item.key]
    : configurationValue(item);
}

function configurationIsModified(item) {
  return Object.prototype.hasOwnProperty.call(auditState.configurationDraft, item.key);
}

function configurationFieldId(item) {
  return `audit-config-${String(item.key).replace(/[^a-z0-9_-]/gi, "-")}`;
}

function configurationControl(item) {
  const value = configurationDraftValue(item);
  const fieldId = configurationFieldId(item);
  if (item.readOnly) {
    const displayValue = item.secret ? t(item.configured ? "configured" : "notConfigured") : value || t("notConfigured");
    return `<div id="${escapeHtml(fieldId)}" class="audit-config-readonly-value">${icon("lock")}<span>${escapeHtml(displayValue)}</span></div>`;
  }
  const attributes = `id="${escapeHtml(fieldId)}" data-config-key="${escapeHtml(item.key)}"`;
  if (booleanConfigKeys.has(item.key)) {
    return `<span class="audit-config-switch"><input type="checkbox" ${String(value) === "true" ? "checked" : ""} ${attributes}><span aria-hidden="true"></span></span>`;
  }
  if (item.multiline) {
    return `<textarea rows="6" ${attributes}>${escapeHtml(value)}</textarea>`;
  }
  const options = Array.isArray(item.options) ? item.options : [];
  if (options.length) {
    return `<select ${attributes}>${options.map((option) => {
      const optionValue = typeof option === "object" ? option.value : option;
      const optionLabel = typeof option === "object" ? option.label : option;
      return `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
    }).join("")}</select>`;
  }
  const numeric = /(?:timeout|seconds|days|top_k)$/.test(item.key);
  const minimum = item.key === "audit_cleanup_interval_seconds" ? "60" : item.key === "audit_retention_days" || item.key === "knowledge_top_k" ? "1" : "0";
  if (item.secret && !auditState.configurationSecretsOpen.has(item.key)) {
    return `<div id="${escapeHtml(fieldId)}" class="audit-config-secret-state"><span>${escapeHtml(t(item.configured ? "configured" : "notConfigured"))}</span><button class="audit-secondary-button" type="button" data-config-secret-open="${escapeHtml(item.key)}">${escapeHtml(t(item.configured ? "replaceKey" : "setKey"))}</button></div>`;
  }
  if (item.secret) {
    return `<div class="audit-config-secret-editor"><input type="password" value="${escapeHtml(value)}" placeholder="${escapeHtml(t(item.configured ? "secretConfigured" : "secretNotConfigured"))}" autocomplete="new-password" ${attributes}><button class="audit-secondary-button" type="button" data-config-secret-cancel="${escapeHtml(item.key)}">${escapeHtml(t("cancel"))}</button></div>`;
  }
  return `<input type="${numeric ? "number" : "text"}" value="${escapeHtml(value)}" ${numeric ? `min="${minimum}" step="1" required` : ""} ${attributes}>`;
}

function renderConfigurationView() {
  const sectionCounts = Object.fromEntries(configSections.map((section) => [section.id, 0]));
  auditState.configuration.forEach((item) => { sectionCounts[configurationSectionForItem(item)] += 1; });
  if (!configSections.some((section) => section.id === auditState.configurationSection)) auditState.configurationSection = "model";
  const items = auditState.configuration.filter((item) => configurationSectionForItem(item) === auditState.configurationSection);
  const tabs = configSections.map((section) => `<button id="audit-config-tab-${section.id}" class="audit-config-tab" role="tab" type="button" data-config-section="${section.id}" aria-selected="${section.id === auditState.configurationSection}" aria-controls="auditConfigForm">${escapeHtml(t(section.labelKey))}<span>${sectionCounts[section.id]}</span></button>`).join("");
  const rows = items.map((item) => {
    const source = item.source === "database" ? t("databaseOverride") : t("environmentDefault");
    const mode = item.readOnly ? t("readOnly") : t(item.restartRequired ? "restartRequired" : "liveUpdate");
    const reason = item.readOnly
      ? t(item.readOnlyReason === "protected_infrastructure" ? "protectedInfrastructure" : "portalEnvironment")
      : mode;
    return `<div class="audit-config-row ${configurationIsModified(item) ? "is-modified" : ""} ${item.multiline ? "is-multiline" : ""}" data-config-row="${escapeHtml(item.key)}">
      <div class="audit-config-identity"><label for="${escapeHtml(configurationFieldId(item))}">${escapeHtml(configurationLabel(item))}</label><code>${escapeHtml(item.env || item.key)}</code></div>
      <div class="audit-config-control">${configurationControl(item)}</div>
      <div class="audit-config-badges"><span>${escapeHtml(item.configured ? t("configured") : t("notConfigured"))}</span><span>${escapeHtml(source)}</span><span title="${escapeHtml(reason)}">${escapeHtml(mode)}</span></div>
    </div>`;
  }).join("");

  byId("auditContent").innerHTML = `
    <section class="audit-config-panel">
      <header><div><h2>${escapeHtml(t("configurationManagement"))}</h2><p>${escapeHtml(t("configurationHint"))}</p></div><button id="auditConfigRefresh" class="audit-icon-button" type="button" title="${escapeHtml(t("refresh"))}" aria-label="${escapeHtml(t("refresh"))}">${icon("refresh")}</button></header>
      <div class="audit-config-tabs" role="tablist" aria-label="${escapeHtml(t("configuration"))}">${tabs}</div>
      <p id="auditConfigStatus" class="audit-config-status" role="status" aria-live="polite"></p>
      <form id="auditConfigForm" role="tabpanel" aria-labelledby="audit-config-tab-${escapeHtml(auditState.configurationSection)}">${rows || `<div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div>`}</form>
      <div id="auditConfigSavebar" class="audit-config-savebar" hidden><strong id="auditConfigChangeCount"></strong><div><button id="auditConfigDiscard" class="audit-secondary-button" type="button">${escapeHtml(t("discardChanges"))}</button><button id="auditConfigSave" class="audit-primary-button" type="button">${icon("save")}<span>${escapeHtml(t("saveChanges"))}</span></button></div></div>
    </section>`;
  byId("auditConfigRefresh").addEventListener("click", () => void loadConfiguration());
  byId("auditConfigSave").addEventListener("click", () => void saveConfiguration());
  byId("auditConfigDiscard").addEventListener("click", () => {
    auditState.configurationDraft = {};
    auditState.configurationSecretsOpen.clear();
    renderConfigurationView();
  });
  document.querySelectorAll("[data-config-section]").forEach((tab) => tab.addEventListener("click", () => {
    auditState.configurationSection = tab.dataset.configSection;
    renderConfigurationView();
  }));
  document.querySelectorAll("[data-config-secret-open]").forEach((button) => button.addEventListener("click", () => {
    auditState.configurationSecretsOpen.add(button.dataset.configSecretOpen);
    renderConfigurationView();
    byId(configurationFieldId({ key: button.dataset.configSecretOpen }))?.focus();
  }));
  document.querySelectorAll("[data-config-secret-cancel]").forEach((button) => button.addEventListener("click", () => {
    delete auditState.configurationDraft[button.dataset.configSecretCancel];
    auditState.configurationSecretsOpen.delete(button.dataset.configSecretCancel);
    renderConfigurationView();
  }));
  byId("auditConfigForm").addEventListener("submit", (event) => { event.preventDefault(); void saveConfiguration(); });
  byId("auditConfigForm").querySelectorAll("[data-config-key]").forEach((control) => {
    control.addEventListener("input", updateConfigurationDraft);
    control.addEventListener("change", updateConfigurationDraft);
  });
  updateConfigurationSaveState();
}

function updateConfigurationDraft(event) {
  const control = event.currentTarget;
  const item = auditState.configuration.find((candidate) => candidate.key === control.dataset.configKey);
  if (!item) return;
  const value = control.type === "checkbox" ? control.checked : control.value;
  if (String(value) === configurationValue(item)) delete auditState.configurationDraft[item.key];
  else auditState.configurationDraft[item.key] = value;
  document.querySelector(`[data-config-row="${CSS.escape(item.key)}"]`)?.classList.toggle("is-modified", configurationIsModified(item));
  updateConfigurationSaveState();
}

function updateConfigurationSaveState() {
  const save = byId("auditConfigSave");
  const savebar = byId("auditConfigSavebar");
  const countLabel = byId("auditConfigChangeCount");
  if (!save || !savebar || !countLabel) return;
  const count = Object.keys(auditState.configurationDraft).length;
  savebar.hidden = count === 0;
  save.disabled = count === 0;
  countLabel.textContent = count === 1 ? t("unsavedChange") : t("unsavedChanges").replace("{count}", String(count));
}

async function loadConfiguration() {
  const form = byId("auditConfigForm");
  if (form) form.innerHTML = `<div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div>`;
  try {
    const data = await auditApi("/api/v1/audit/config");
    auditState.configuration = data.items || [];
    auditState.configurationLoaded = true;
    auditState.configurationDraft = {};
    auditState.configurationSecretsOpen.clear();
    if (auditState.view === "configuration") renderConfigurationView();
  } catch (error) {
    if (error.message === "AUTH_REQUIRED") return;
    if (auditState.view === "configuration") {
      renderConfigurationView();
      const status = byId("auditConfigStatus");
      if (status) status.textContent = t("configLoadFailed");
    }
  }
}

async function saveConfiguration() {
  const patch = {};
  for (const [key, value] of Object.entries(auditState.configurationDraft)) {
    const item = auditState.configuration.find((candidate) => candidate.key === key);
    if (!item || item.readOnly || (item.secret && !value)) continue;
    const numeric = /(?:timeout|seconds|days|top_k)$/.test(item.key);
    if (numeric) {
      const minimum = item.key === "audit_cleanup_interval_seconds" ? 60 : item.key === "audit_retention_days" || item.key === "knowledge_top_k" ? 1 : 0;
      if (value === "" || !Number.isFinite(Number(value)) || Number(value) < minimum) {
        auditState.configurationSection = configurationSectionForItem(item);
        renderConfigurationView();
        byId(configurationFieldId(item))?.reportValidity();
        return;
      }
    }
    patch[key] = booleanConfigKeys.has(key) ? String(value) === "true" : numeric ? Number(value) : value;
  }
  const status = byId("auditConfigStatus");
  if (!Object.keys(patch).length) {
    if (status) status.textContent = t("noChanges");
    updateConfigurationSaveState();
    return;
  }
  const save = byId("auditConfigSave");
  save.disabled = true;
  try {
    const data = await auditApi("/api/v1/audit/config", {
      method: "PATCH",
      body: JSON.stringify({ scope: "system", patch }),
    });
    auditState.configuration = data.items || [];
    auditState.configurationLoaded = true;
    auditState.configurationDraft = {};
    auditState.configurationSecretsOpen.clear();
    renderConfigurationView();
    byId("auditConfigStatus").textContent = t("configSaved");
  } catch (error) {
    if (error.message === "AUTH_REQUIRED") return;
    save.disabled = false;
    if (status) status.textContent = t("configSaveFailed");
  }
}

function renderUsersView() {
  const userCountLabel = `${auditState.users.length} ${t(auditState.users.length === 1 ? "record" : "records")}`;
  byId("auditContent").innerHTML = `
    <section class="audit-users-panel">
      <header><div><h2>${escapeHtml(t("accounts"))}</h2><p id="auditUsersCount">${escapeHtml(userCountLabel)}</p></div><div><button id="auditUsersRefresh" class="audit-icon-button" type="button" aria-label="${escapeHtml(t("refresh"))}" title="${escapeHtml(t("refresh"))}">${icon("refresh")}</button><button id="auditAddUser" class="audit-primary-button" type="button">${icon("plus")}<span>${escapeHtml(t("addAccount"))}</span></button></div></header>
      <div class="audit-users-table-wrap"><table class="audit-users-table"><thead><tr><th>${escapeHtml(t("username"))}</th><th>${escapeHtml(t("displayName"))}</th><th>${escapeHtml(t("role"))}</th><th>${escapeHtml(t("status"))}</th><th>${escapeHtml(t("createdAt"))}</th><th><span class="audit-visually-hidden">${escapeHtml(t("actions"))}</span></th></tr></thead><tbody id="auditUsersBody"></tbody></table></div>
    </section>`;
  byId("auditUsersRefresh").addEventListener("click", () => void loadUsers());
  byId("auditAddUser").addEventListener("click", openCreateUserDialog);
  renderUsersTable();
}

function normalizeUser(item) {
  return {
    id: item.id || item.userId || item.user_id || item.username,
    username: item.username || item.account || item.email || "-",
    displayName: item.displayName || item.display_name || item.name || "-",
    role: normalizeRole(item.role),
    active: item.disabled !== undefined ? !item.disabled : (item.active ?? item.isActive ?? item.is_active ?? item.status !== "DISABLED"),
    createdAt: item.createdAt || item.created_at,
  };
}

async function loadUsers() {
  const body = byId("auditUsersBody");
  if (body) body.innerHTML = `<tr><td colspan="6"><div class="audit-empty-state audit-loading-state"><span class="audit-spinner"></span>${escapeHtml(t("loading"))}</div></td></tr>`;
  try {
    const data = await auditApi("/api/v1/audit/users");
    auditState.users = (data.users || data.items || (Array.isArray(data) ? data : [])).map(normalizeUser);
    auditState.usersLoaded = true;
    renderUsersTable();
  } catch (error) {
    if (error.message === "AUTH_REQUIRED") return;
    if (body) body.innerHTML = `<tr><td colspan="6"><div class="audit-empty-state audit-error-state"><p>${escapeHtml(t("loadFailed"))}</p></div></td></tr>`;
  }
}

function renderUsersTable() {
  const body = byId("auditUsersBody");
  if (!body) return;
  const count = byId("auditUsersCount");
  if (count) count.textContent = `${auditState.users.length} ${t(auditState.users.length === 1 ? "record" : "records")}`;
  if (!auditState.users.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="audit-empty-state"><p>${escapeHtml(t("noAccounts"))}</p></div></td></tr>`;
    return;
  }
  body.innerHTML = auditState.users.map((user) => `<tr><td><strong>${escapeHtml(user.username)}</strong></td><td>${escapeHtml(user.displayName)}</td><td><span class="audit-role-badge">${escapeHtml(t(user.role))}</span></td><td><span class="audit-account-state ${user.active ? "active" : "inactive"}">${escapeHtml(t(user.active ? "active" : "inactive"))}</span></td><td>${escapeHtml(formatDate(user.createdAt, false))}</td><td><div class="audit-row-actions"><button class="audit-link-button" data-reset-user="${escapeHtml(user.id)}" type="button">${escapeHtml(t("resetPassword"))}</button><button class="audit-link-button ${user.active ? "danger" : ""}" data-toggle-user="${escapeHtml(user.id)}" data-active="${user.active ? "true" : "false"}" type="button">${escapeHtml(t(user.active ? "disable" : "enable"))}</button></div></td></tr>`).join("");
  body.querySelectorAll("[data-reset-user]").forEach((button) => button.addEventListener("click", () => openResetPasswordDialog(button.dataset.resetUser)));
  body.querySelectorAll("[data-toggle-user]").forEach((button) => button.addEventListener("click", () => void toggleUser(button.dataset.toggleUser, button.dataset.active !== "true")));
}

function openDialog(contents) {
  const host = byId("auditDialogHost");
  host.innerHTML = `<div class="audit-dialog-backdrop"><section class="audit-dialog" role="dialog" aria-modal="true">${contents}</section></div>`;
  host.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  host.querySelector("input")?.focus();
}

function closeDialog() {
  const host = byId("auditDialogHost");
  if (host) host.innerHTML = "";
}

function openCreateUserDialog() {
  openDialog(`<header><h2>${escapeHtml(t("newAccount"))}</h2><button class="audit-icon-button" data-dialog-close type="button" aria-label="${escapeHtml(t("close"))}">${icon("close")}</button></header><form id="auditCreateUserForm">
    <label><span>${escapeHtml(t("username"))}</span><input id="newAuditUsername" autocomplete="off" required></label>
    <label><span>${escapeHtml(t("displayName"))}</span><input id="newAuditDisplayName" autocomplete="off" required></label>
    <label><span>${escapeHtml(t("role"))}</span><select id="newAuditRole"><option value="Auditor">${escapeHtml(t("auditor"))}</option><option value="Administrator">${escapeHtml(t("administrator"))}</option></select></label>
    <label><span>${escapeHtml(t("temporaryPassword"))}</span><input id="newAuditPassword" type="password" autocomplete="new-password" minlength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" title="${escapeHtml(t("passwordRule"))}" required><small>${escapeHtml(t("passwordRule"))}</small></label>
    <p id="auditDialogError" class="audit-form-error" role="alert"></p>
    <footer><button class="audit-secondary-button" data-dialog-close type="button">${escapeHtml(t("cancel"))}</button><button class="audit-primary-button" type="submit">${escapeHtml(t("createAccount"))}</button></footer>
  </form>`);
  byId("auditCreateUserForm").addEventListener("submit", createUser);
}

async function createUser(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await auditApi("/api/v1/audit/users", { method: "POST", body: JSON.stringify({
      username: byId("newAuditUsername").value.trim(), displayName: byId("newAuditDisplayName").value.trim(),
      role: byId("newAuditRole").value, password: byId("newAuditPassword").value,
    }) });
    closeDialog();
    showToast(t("accountCreated"));
    await loadUsers();
  } catch (error) {
    byId("auditDialogError").textContent = error.message;
    submit.disabled = false;
  }
}

async function toggleUser(userId, active) {
  try {
    await auditApi(`/api/v1/audit/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ disabled: !active }) });
    showToast(t("accountUpdated"));
    await loadUsers();
  } catch (error) { showToast(error.message, true); }
}

function openResetPasswordDialog(userId) {
  const user = auditState.users.find((item) => String(item.id) === String(userId));
  openDialog(`<header><div><h2>${escapeHtml(t("resetPasswordFor"))}</h2><p>${escapeHtml(user?.username || userId)}</p></div><button class="audit-icon-button" data-dialog-close type="button" aria-label="${escapeHtml(t("close"))}">${icon("close")}</button></header><form id="auditResetPasswordForm">
    <label><span>${escapeHtml(t("newPassword"))}</span><input id="resetAuditPassword" type="password" autocomplete="new-password" minlength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" title="${escapeHtml(t("passwordRule"))}" required><small>${escapeHtml(t("passwordRule"))}</small></label>
    <p id="auditDialogError" class="audit-form-error" role="alert"></p>
    <footer><button class="audit-secondary-button" data-dialog-close type="button">${escapeHtml(t("cancel"))}</button><button class="audit-primary-button" type="submit">${escapeHtml(t("confirmReset"))}</button></footer>
  </form>`);
  byId("auditResetPasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    try {
      await auditApi(`/api/v1/audit/users/${encodeURIComponent(userId)}/password`, { method: "POST", body: JSON.stringify({ password: byId("resetAuditPassword").value }) });
      closeDialog();
      showToast(t("passwordReset"));
    } catch (error) { byId("auditDialogError").textContent = error.message; submit.disabled = false; }
  });
}

function showToast(message, isError = false) {
  const toast = byId("auditToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

async function bootstrapAudit() {
  setDirection();
  if (!document.documentElement.classList.contains("dsh-audit-boot")) renderLogin();
  try {
    const data = await auditApi("/api/v1/audit-auth/session");
    const session = normalizeSession(data);
    if (!session.authenticated) {
      renderLogin();
      return;
    }
    auditState.session = session;
    renderApplication();
    await loadConversations(1);
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") renderLogin();
  }
}

void bootstrapAudit();
