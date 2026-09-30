import { access, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const LOWER_CAMEL_RESOURCE_OWNER = /^[a-z][A-Za-z0-9]*$/;

export const isValidResourceOwnerName = (owner) =>
  typeof owner === "string" && LOWER_CAMEL_RESOURCE_OWNER.test(owner);

export const ARABIC_LATIN_TOKEN_ALLOWLIST = new Set([
  "AED",
  "AI",
  "API",
  "AVI",
  "BD",
  "CSV",
  "CSAT",
  "DBD",
  "DD/MM/YYYY",
  "DOC",
  "DOCX",
  "DVD",
  "Excel",
  "Figma",
  "GIF",
  "Google",
  "HH",
  "HH/MM",
  "HTML",
  "HTTP",
  "IBAN",
  "ID",
  "IP",
  "ISBN",
  "JPEG",
  "JPG",
  "JSON",
  "Kibana",
  "LGBT+",
  "MB",
  "Microsoft",
  "MM",
  "MP3",
  "MP4",
  "MOV",
  "N/A",
  "NMA",
  "OCR",
  "PASS",
  "PDF",
  "PNG",
  "SEO",
  "SLA",
  "SMS",
  "SS",
  "UAE",
  "UID",
  "UI",
  "UMC",
  "URL",
  "UUID",
  "VIP",
  "XXXXXXXX",
  "XXXX-XXXXXXX-X",
  "XLS",
  "XLSX",
  "ZIP",
  "cc",
  "example.com",
  "https",
  "jpeg",
  "jpg",
  "mp4",
  "pdf",
  "png",
  "AND",
  "OR",
  "A",
  "B",
  "C",
  "x",
]);

export const ARABIC_LATIN_KEY_ALLOWLIST = new Set([
  "BookList.templateSheetName",
  "DraftFileOrLink.invalidUrl",
  "FilmTrailerForm.permitOptions.0",
  "FilmTrailerForm.permitOptions.1",
  "FilmTrailerForm.permitOptions.2",
]);

const GENERAL_KEY_PROPERTY_NAMES = new Set([
  "actionLabelKey",
  "adoptionRateLabelKey",
  "alertKey",
  "breadcrumbRootKey",
  "decisionKey",
  "descriptionI18nKey",
  "descriptionKey",
  "fieldKey",
  "i18nKey",
  "labelI18nKey",
  "labelKey",
  "messageKey",
  "moduleLabelKey",
  "pageTitleKey",
  "placeholderKey",
  "reasonKey",
  "recommendationKey",
  "shortLabelKey",
  "statusKey",
  "statusLabelKey",
  "subtitleKey",
  "textKey",
  "translationKey",
  "verificationErrorKey",
  "warningLabelKey",
]);
const ROUTE_KEY_PROPERTY_NAMES = new Set(["i18n", "titleKey"]);
const TRUSTED_I18N_INSTANCES = new Set([
  "i18n",
  "i18next",
  "i18nInstance",
]);

const CONTROLLED_METADATA_REFERENCE_FILES = new Set([
  "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
  "src/components/common/FormilyReviewList/modifyChangeSummaryRules.ts",
  "src/components/designable/src/components/DataForm/DataFormField.tsx",
  "src/components/designable/src/components/FilmRescreeningForm/FilmRescreeningFormField.tsx",
  "src/components/designable/src/components/LicenseTransferForm/LicenseTransferFormField.tsx",
  "src/components/designable/src/components/VideoGamePackageForm/VideoGamePackageFormField.tsx",
  "src/constants/workflowActions.ts",
  "src/layout/Header.tsx",
  "src/layout/Sider.tsx",
  "src/layout/index.tsx",
  "src/pages/AddNewService/components/RuleConfiguration/PricingRuleSection.tsx",
  "src/pages/ContentReportsAnalytics/components/AIRecommendationOverviewCard.tsx",
  "src/pages/ContentReportsAnalytics/components/AITagsBreakdownCard.tsx",
  "src/pages/ContentReportsAnalytics/components/CustomerSatisfactionCard.tsx",
  "src/pages/ContentReportsAnalytics/components/DonutChartCard.tsx",
  "src/pages/ContentReportsAnalytics/components/HeaderTimeFilter.tsx",
  "src/pages/ContentReportsAnalytics/components/HorizontalBarsCard.tsx",
  "src/pages/ContentReportsAnalytics/components/LicenseDistributionTable.tsx",
  "src/pages/ContentReportsAnalytics/components/StatCards.tsx",
  "src/pages/ContentReportsAnalytics/components/TeamPerformanceTrendCard.tsx",
  "src/pages/ContentReportsAnalytics/components/TrendChartCard.tsx",
  "src/pages/CustomerAppeals/components/AppealDepartmentTransferModal.tsx",
  "src/pages/CustomerAppeals/components/AppealStatusModal.tsx",
  "src/pages/CustomerAppeals/index.tsx",
  "src/pages/CustomerAppealsDetails/index.tsx",
  "src/pages/CustomerDetails/components/allProfilesOverviewTabs/AppealTab.tsx",
  "src/pages/Dashboard/components/DashboardControls.tsx",
  "src/pages/Dashboard/components/DashboardWidgets.tsx",
  "src/pages/Dashboard/components/LicenseDashboardWidgets.tsx",
  "src/pages/FinanceReportsAnalytics/components/AnalyticsTableCard.tsx",
  "src/pages/FinanceReportsAnalytics/components/BarBreakdownCard.tsx",
  "src/pages/FinanceReportsAnalytics/components/DonutChartCard.tsx",
  "src/pages/FinanceReportsAnalytics/components/HeaderTimeFilter.tsx",
  "src/pages/FinanceReportsAnalytics/components/LineTrendCard.tsx",
  "src/pages/FinanceReportsAnalytics/components/SummaryCards.tsx",
  "src/pages/InspectionCommon/components/InspectionAttachmentUpload.tsx",
  "src/pages/InspectionStartVisit/components/OcrResultModal.tsx",
  "src/pages/InspectionStartVisit/components/OcrTypeModal.tsx",
  "src/pages/InspectionStartVisit/components/PreVisitChecklistModal.tsx",
  "src/pages/InspectionTaskManagement/taskConfig.ts",
  "src/pages/InspectionViolationDetails/components/ReviewDecideModal.tsx",
  "src/pages/LicenseDatails/components/ServiceFees.tsx",
  "src/pages/LicenseReportsAnalytics/components/DonutChartCard.tsx",
  "src/pages/LicenseReportsAnalytics/components/HeaderTimeFilter.tsx",
  "src/pages/LicenseReportsAnalytics/components/HorizontalBarsCard.tsx",
  "src/pages/LicenseReportsAnalytics/components/LicenseDistributionTable.tsx",
  "src/pages/LicenseReportsAnalytics/components/TeamPerformanceTrendCard.tsx",
  "src/pages/LicenseReportsAnalytics/components/TrendChartCard.tsx",
  "src/pages/LicenseReportsAnalytics/index.tsx",
  "src/pages/LicenseReportsAnalytics/services/mappers.ts",
  "src/pages/Licenses/index.tsx",
  "src/pages/PermitsDetails/components/ServiceFees.tsx",
  "src/pages/ServiceReportsAnalytics/components/DonutChartCard.tsx",
  "src/pages/ServiceReportsAnalytics/components/HeaderTimeFilter.tsx",
  "src/pages/ServiceReportsAnalytics/components/StatCards.tsx",
  "src/pages/ServiceReportsAnalytics/components/TrendChartCard.tsx",
  "src/pages/ServiceReportsAnalytics/index.tsx",
  "src/pages/TeamManagement/components/TeamTasksPanel/index.tsx",
  "src/pages/TeamManagement/index.tsx",
  "src/pages/Tickets/components/FilterModal1/index.tsx",
  "src/services/contentReportsAnalytics.ts",
  "src/services/customerHappinessDashboard.ts",
  "src/services/financeReportsAnalytics.ts",
  "src/services/licenseDashboard.ts",
  "src/services/serviceReportsAnalytics.ts",
]);

const CONTROLLED_DYNAMIC_VALUE_FILES = new Set([
  "src/pages/ContentApplications/components/MyTasks/index.tsx",
  "src/pages/ContentApplicationsDetails/components/AIContentCheck/index.tsx",
  "src/pages/ContentLibrary/index.tsx",
  "src/pages/ContentReportsAnalytics/components/StatCards.tsx",
  "src/pages/CustomerAppeals/roleConfig.ts",
  "src/pages/CustomerManagement/index.tsx",
  "src/pages/CustomerRefunds/index.tsx",
  "src/pages/CustomerRefunds/roleConfig.ts",
  "src/pages/Dashboard/components/DashboardControls.tsx",
  "src/pages/EventManagement/components/RejectPublishModal/index.tsx",
  "src/pages/EventManagement/index.tsx",
  "src/pages/FinanceReportsAnalytics/index.tsx",
  "src/pages/InspectionTaskDetails/index.tsx",
  "src/pages/InspectionTaskManagement/index.tsx",
  "src/pages/JobOpeningsManagement/index.tsx",
  "src/pages/JobOpeningsManagementDetail/index.tsx",
  "src/pages/LicenseReportsAnalytics/components/StatCards.tsx",
  "src/pages/MyDashboard/index.tsx",
  "src/pages/NewsManagement/components/RejectPublishModal/index.tsx",
  "src/pages/NewsManagement/index.tsx",
  "src/pages/PageManagementAbout/Preview/index.tsx",
  "src/pages/PageManagementHome/Preview/index.tsx",
  "src/pages/PageManagementLeadership/Preview/index.tsx",
  "src/pages/Permits/index.tsx",
  "src/pages/Profile/index.tsx",
  "src/pages/TicketsDetails/components/EstablishmentOverview/index.tsx",
  "src/services/serviceReportsAnalytics.ts",
]);

const CONTROLLED_KEY_MAP_REFERENCE_FILES = new Set([
  "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
  "src/components/common/SelfMonitorBadge/index.tsx",
  "src/pages/CustomerAppeals/components/AppealDepartmentTransferModal.tsx",
  "src/pages/CustomerDetails/components/allProfilesOverviewTabs/inspectionProfileUtils.ts",
  "src/pages/InspectionReportsAnalytics/components/AnalyticsCards.tsx",
  "src/pages/InspectionViolationDetails/index.tsx",
  "src/services/inspectionDashboard.ts",
  "src/utils/request.ts",
]);

const CONTROLLED_KEY_RESOLVER_FILES = new Set([
  "src/pages/InspectionStartVisit/components/OcrResultModal.tsx",
  "src/pages/InspectionViolations/index.tsx",
  "src/services/contentDashboard.ts",
  "src/services/contentReportsAnalytics.ts",
  "src/services/customerHappinessDashboard.ts",
  "src/services/financeReportsAnalytics.ts",
  "src/services/licenseDashboard.ts",
  "src/services/serviceReportsAnalytics.ts",
]);

const CONTROLLED_DESIGNABLE_KEY_FILES = new Set([
  "src/components/designable/src/components/GameDistributionForm/GameDistributionFormField.tsx",
  "src/components/designable/src/components/Information/StyleSelector.tsx",
  "src/components/designable/src/components/PressCardSelector/PressCardSelector.tsx",
  "src/components/designable/src/components/SocialMediaAccount/SocialMediaAccountField.tsx",
  "src/components/designable/src/components/VideoGamePackageForm/VideoGamePackageFormField.tsx",
]);

const normalizeDynamicExpression = (expression) =>
  expression.replace(/\s+/g, " ").trim();

const createExpressionSetMatcher = (expressions) => {
  const normalizedExpressions = new Set(expressions.map(normalizeDynamicExpression));
  return {
    test: (expression) =>
      normalizedExpressions.has(normalizeDynamicExpression(expression)),
  };
};

const CONTROLLED_METADATA_REFERENCE_ROOTS = new Set([
  "actionLabelKey",
  "applyFor",
  "breadcrumbRootKey",
  "byValue",
  "card",
  "category",
  "decisionKey",
  "definition",
  "entry",
  "field",
  "headerMetric",
  "infoTextKey",
  "item",
  "labelKey",
  "messageKey",
  "moduleRoute",
  "obj",
  "option",
  "placeholderKey",
  "rawChange",
  "reasonKey",
  "recommendationKey",
  "row",
  "segment",
  "selected",
  "series",
  "status",
  "statusKey",
  "statusLabelKey",
  "titleKey",
  "totalLabelKey",
  "translationKey",
  "type",
  "verificationErrorKey",
  "warningLabelKey",
]);

const CONTROLLED_DYNAMIC_VALUE_EXPRESSIONS = [
  "`Content.contentApplications.aiRecommendations.${aiRecommendation}`",
  "item.label",
  "item as string",
  "`Content.contentLibrary.tabs.${APP_TAB_LABEL[key as TKeyOfAppTabLabel]}`",
  "TEXT[item.key] || item.key",
  "APPEAL_SHARED_BREADCRUMB_ROOT_KEY",
  "`Customer.customerManagement.tabs.${CUSTOMER_TAB_LABEL[key as TKeyOfCustomerTabLabel]}`",
  "`Customer.customerRefunds.summary.${item.key}`",
  "REFUND_SHARED_BREADCRUMB_ROOT_KEY",
  "`adminDashboard.roles.${value}`",
  "`adminDashboard.roles.${roleVariant}`",
  "`CMS.eventManagement.modals.rejectPublish.quickNotes.${noteKey}`",
  "`CMS.eventManagement.counts.${item.key}`",
  "`financeReportsAnalytics.locations.${value}`",
  "`financeReportsAnalytics.userTypes.${value}`",
  "`inspection.tasks.reasons.${key}`",
  "`CMS.jobOpeningsManagement.statuses.${key}`",
  "`CMS.jobOpeningsManagement.counts.${item.key}`",
  "`dashboard.categories.${item.category}`",
  "`dashboard.categories.${params.name}`",
  "`dashboard.services.${text}`",
  "`dashboard.categories.${text}`",
  "`dashboard.categories.${item.name}`",
  "`CMS.newsManagement.modals.rejectPublish.quickNotes.${noteKey}`",
  "`CMS.newsManagement.counts.${item.key}`",
  "`CMS.preview.device.${d}`",
  "`Content.permits.stats.${card.value}`",
  "`Profile.rejectReasons.${key}`",
  "`Customer.ticketsDetails.establishment.${item.fieldKey}`",
  "`serviceReportsAnalytics.options.userTypes.${key}`",
];

const CONTROLLED_KEY_MAP_EXPRESSIONS = [
  "SOCIAL_STATUS_LABEL_KEYS[changeType]",
  "STATUS_I18N_KEY[status]",
  "DEGREE_LABEL_KEYS[value]",
  "STATUS_LABEL_KEYS[statusKey]",
  "STATUS_LABEL_KEYS[filter.statusKey]",
  "SUMMARY_LABEL_KEYS[item.key]",
  "DATA_LABEL_KEYS[item.label]",
  "DATA_LABEL_KEYS[series.name]",
  "DATA_LABEL_KEYS[label]",
  "DATA_LABEL_KEYS[data.primaryLabel]",
  "DATA_LABEL_KEYS[data.secondaryLabel]",
  "DATA_LABEL_KEYS[band]",
  "COMMITTEE_DECISION_LABEL_KEYS.cancelled",
  "COMMITTEE_DECISION_LABEL_KEYS.modified",
  "COMMITTEE_DECISION_LABEL_KEYS.confirmed",
  "COMMITTEE_DECISION_LABEL_KEYS.deleted",
  "COMMITTEE_DECISION_LABEL_KEYS.maintained",
  "COMMITTEE_DECISION_LABEL_KEYS.appealTitle",
  "COMMITTEE_DECISION_LABEL_KEYS.title",
  "COMMITTEE_DECISION_LABEL_KEYS.new",
  "COMMITTEE_DECISION_LABEL_KEYS.action",
  "COMMITTEE_DECISION_LABEL_KEYS.actionBy",
  "COMMITTEE_DECISION_LABEL_KEYS.note",
  "DETAIL_ACTION_LABEL_KEYS[action]",
  "INSPECTION_DASHBOARD_TASK_ACTION_LABEL_KEYS[actionCode]",
  "NETWORK_ERROR_I18N_KEY[networkErrorType]",
];

const CONTROLLED_KEY_RESOLVER_EXPRESSIONS = [
  "getPublicationTypeLabelKey(publicationType)",
  "getActionTitleKey(action)",
  "getActionTitleKey(workflowAction)",
  "getContentTodoTabLabelKey(tabKey)",
  "getAttentionLabelKey(tabKey)",
  "resolveDeviceLabelKey(item.deviceType)",
  "resolveAiTagLabelKey(item.tag)",
  "resolveApplicationStatusLabelKey(item.statusName)",
  "resolveContentTypeLabelKey(item.typeName)",
  "resolveUserTypeLabelKey(item.typeName)",
  "resolveServiceCategoryLabelKey(item.categoryName)",
  "resolveLocationLabelKey(item.emirate)",
  'resolveConfirmationMethodLabelKey("Self Monitored")',
  'resolveConfirmationMethodLabelKey("Auto-Approved")',
  'resolveConfirmationMethodLabelKey("Manually Confirmed")',
  'resolveSatisfactionLabelKey("Satisfied")',
  'resolveSatisfactionLabelKey("Neutral")',
  'resolveSatisfactionLabelKey("Dissatisfied")',
  'resolveLicenseStatusLabelKey("active")',
  'resolveLicenseStatusLabelKey("expiringSoon")',
  'resolveLicenseStatusLabelKey("expired")',
  "resolveUserTypeLabelKey(item.userType)",
  "resolveContentStatusLabelKey(\"approved\")",
  "resolveContentStatusLabelKey(\"rejected\")",
  "resolveContentStatusLabelKey(\"pendingReview\")",
  "resolveContentSourceLabelKey(item.source)",
  "resolveContentTypeLabelKey(item.contentType)",
  "getCategoryLabelKey(tabKey)",
  "paymentTypeLabelKey(item.name)",
  "paymentMethodLabelKey(item.name)",
  "statusLabelKey(item.name)",
  "refundCategoryLabelKey(item.name)",
  "refundTypeLabelKey(item.name)",
  "mapDeviceKey(item.deviceType)",
];

export const DYNAMIC_I18N_REFERENCE_ALLOWLIST = [
  {
    file: { test: (file) => CONTROLLED_METADATA_REFERENCE_FILES.has(file) },
    expression: {
      test: (expression) => {
        if (expression === "data.adoptionRateLabelKey") {
          return true;
        }
        const root = expression.match(/^([A-Za-z_$][\w$]*)/)?.[1];
        return (
          Boolean(root && CONTROLLED_METADATA_REFERENCE_ROOTS.has(root)) &&
          /^(?:[A-Za-z_$][\w$]*\??\.)*(?:actionLabelKey|alertKey|breadcrumbRootKey|decisionKey|descriptionI18nKey|descriptionKey|fieldKey|i18n|i18nKey|infoTextKey|labelI18nKey|labelKey|messageKey|moduleLabelKey|nameKey|pageTitleKey|placeholderKey|reasonKey|recommendationKey|shortLabelKey|statusKey|statusLabelKey|subtitleKey|textKey|titleKey|totalLabelKey|translationKey|verificationErrorKey|warningLabelKey)(?:\s+as\s+.+)?$/.test(
            expression,
          )
        );
      },
    },
    reason:
      "Reviewed metadata consumers receive keys from statically scanned code-owned definitions.",
  },
  {
    file: { test: (file) => CONTROLLED_DYNAMIC_VALUE_FILES.has(file) },
    expression: createExpressionSetMatcher(
      CONTROLLED_DYNAMIC_VALUE_EXPRESSIONS,
    ),
    reason:
      "Reviewed feature mappings constrain these values or provide the original API value as fallback.",
  },
  {
    file:
      /^src\/pages\/(?:Content|Finance|License|Service)ReportsAnalytics\/(?:components\/(?:HeaderTimeFilter|LicenseDistributionTable)|index)\.tsx$/,
    expression: /^TEXT(?:\.[A-Za-z_$][\w$]*)+$/,
    reason:
      "Analytics views read translation keys from their module-local TEXT constant.",
  },
  {
    file: { test: (file) => CONTROLLED_KEY_MAP_REFERENCE_FILES.has(file) },
    expression: createExpressionSetMatcher(CONTROLLED_KEY_MAP_EXPRESSIONS),
    reason:
      "Reviewed feature-local constant maps enumerate their translation keys.",
  },
  {
    file: { test: (file) => CONTROLLED_KEY_RESOLVER_FILES.has(file) },
    expression: createExpressionSetMatcher(
      CONTROLLED_KEY_RESOLVER_EXPRESSIONS,
    ),
    reason:
      "Reviewed feature-local resolver functions return keys from bounded maps.",
  },
  {
    file: { test: (file) => CONTROLLED_DESIGNABLE_KEY_FILES.has(file) },
    expression: /^(?:key|statusKey)$/,
    reason:
      "Reviewed designable fields iterate keys from local translation-key maps.",
  },
  {
    file:
      /^src\/components\/designable\/src\/components\/(?:DataForm\/DataFormField|FilmScreeningForm\/FilmScreeningFormField|FilmTrailerForm\/FilmTrailerFormField)\.tsx$/,
    expression:
      /^`(?:nationality|passportType|permitOptions|value)\.\$\{(?:i18nKey|index|key|value)\}`$/,
    reason: "Designable option values are constrained by their component schemas.",
  },
  {
    file:
      /^src\/components\/common\/FormilyReviewList\/modifyChangeSummaryRules\.ts$/,
    expression:
      /^descriptor\s*\?\s*undefined\s*:\s*getCompositeFieldLabelI18nKey\(fieldPath,\s*descriptors\)$/,
    reason: "The composite-field resolver returns keys from the local descriptor map.",
  },
  {
    file: /^src\/routes\/index\.tsx$/,
    expression:
      /^`menu\.\$\{\s*pageName\.charAt\(0\)\.toLowerCase\(\)\s*\+\s*pageName\.slice\(1\)\s*\}`$/,
    reason: "Runtime routes derive menu keys only from the controlled page-name list.",
  },
  {
    file: /^src\//,
    expression:
      /^`\$\{(?:I18N_BASE|I18N_PREFIX|commercialOverviewBase|po|profileOverviewBase|tabsBase)\}\.[A-Za-z0-9_.]+`$/,
    reason: "Module-local base constants constrain the complete key suffix.",
  },
  {
    file:
      /^src\/components\/(?:BusinessCmps\/PartnerList|designable\/src\/components|common\/ReviewPersonalInformationIcp)|^src\/pages\/ProfileDetails\/components\/PartnerList/,
    expression:
      /^(?:`[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)*\.\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}`|`\$\{(?:defaultTitleNs|ns|p|prefix|translationBase)\}\.[A-Za-z0-9_.]+`)$/,
    reason: "Reusable form components bind a local namespace to fixed key suffixes.",
  },
  {
    file:
      /^src\/components\/common\/(?:FormilyReviewList\/AdminModifyChangeSummary|MobileNumberInput\/utils|ReviewPersonalInformationIcp\/index)\.(?:ts|tsx)$/,
    expression:
      /^`(?:FormilyReviewList|ReviewPersonalInformationIcp|common)\.[A-Za-z0-9_.]*\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}`$/,
    reason: "Shared components constrain dynamic values to their own key namespace.",
  },
  {
    file: /^src\/layout\/index\.tsx$/,
    expression: /^`\$\{pageTitleKey\}`$/,
    reason: "The layout receives pageTitleKey from the controlled route metadata.",
  },
  {
    file:
      /^src\/pages\/(?:Applications\/utils\/workflowActionModalCopy|ContentApplications\/utils\/workflowActionModalCopy|ContentApplicationsDetails\/components\/ApplicationTimeline\/index|CustomerAppeals(?:\/components\/AppealFilterModal|Details\/index|\/index)|CustomerDetails\/components\/allProfilesOverviewTabs\/ticketUtils|CustomerRefunds\/components\/Refund(?:DepartmentProcess|Status)Modal|Dashboard\/components\/DashboardWidgets|InspectionCommon\/helpers|InspectionViolationDetails\/index)\.(?:ts|tsx)$/,
    expression: /^key$/,
    reason: "These translation helpers receive keys from adjacent code-owned maps.",
  },
  {
    file:
      /^src\/pages\/(?:FinancialRefunds(?:Details)?\/index|InspectionStartVisit\/index|InspectionViolations\/index)\.tsx$/,
    expression:
      /^(?:keyMap\[code\]|inspectionSubmitToastMessageKeys\[kind\]|violationWorkTabLabelKeys\[tab\])$/,
    reason: "Feature-local maps enumerate the allowed translation keys.",
  },
  {
    file: /^src\/pages\/CustomerRefundsDetails\/index\.tsx$/,
    expression:
      /^`Customer\.customerRefundsDetails\.sections\.\$\{getRefundReferenceLabel\([\s\S]+\)\}`$/,
    reason: "The refund category resolver returns a bounded section key suffix.",
  },
  {
    file: /^src\/pages\/PageManagement\/components\/RejectModal\/index\.tsx$/,
    expression: /^item$/,
    reason: "The modal iterates its local translation-key note list.",
  },
  {
    file: /^src\/pages\/(?:PerformanceAnalytics|ReportsAnalytics)\/index\.tsx$/,
    expression: /^item\.(?:label|name)$/,
    reason: "Legacy analytics fixtures store translation keys in local label fields.",
  },
  {
    file: /^src\/pages\/ApplicationsDetails\/hooks\/useRecallApproval\.ts$/,
    expression:
      /^`applications\.recallApproval\.errors\.\$\{key\}`$/,
    reason: "The hook maps backend error codes to a bounded error namespace.",
  },
];

export const isI18nSourceExcluded = (fileName) =>
  /(?:^|\/)pages\/AddNewService\/index-base\.tsx$/.test(fileName) ||
  /(?:^|\/)pages\/AddNewService\/components\/FeeConfiguration\.tsx$/.test(
    fileName,
  ) ||
  /(?:^|\/)components\/ProcessTree\/NodeConfig\/(?:Cc|Condition|Root)NodeConfig\.tsx$/.test(
    fileName,
  ) ||
  /(?:^|\/)components\/common\/CountrySelect\/constants\.ts$/.test(fileName) ||
  // Replaced/unreachable sources: ContentDashboard explicitly omits this
  // component, InspectionTaskManagement builds its live columns in index.tsx,
  // and the route registry maps ReportsAnalytics to ContentReportsAnalytics.
  /(?:^|\/)pages\/ContentDashboard\/components\/PermitDistribution\/index\.tsx$/.test(
    fileName,
  ) ||
  /(?:^|\/)pages\/InspectionTaskManagement\/data\.tsx$/.test(fileName) ||
  /(?:^|\/)pages\/ReportsAnalytics\/index\.tsx$/.test(fileName) ||
  /(?:^|\/)pages\/LicenseReports\//.test(fileName) ||
  /(?:^|\/)components\/designable\/playground\//.test(fileName) ||
  /(?:^|\/)examples?\//.test(fileName) ||
  /(?:^|\/)example\.[jt]sx?$/.test(fileName) ||
  /\.(?:example|stories)\.[jt]sx?$/.test(fileName);

const getValueType = (value) => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
};

const flattenLeaves = (value, prefix = "", result = new Map()) => {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = Array.isArray(value)
        ? `${prefix}[${key}]`
        : prefix
          ? `${prefix}.${key}`
          : key;
      flattenLeaves(child, childPath, result);
    }
    return result;
  }

  result.set(prefix, value);
  return result;
};

const flattenNodes = (value, prefix = "", result = new Map()) => {
  if (!value || typeof value !== "object") {
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value)
      ? `${prefix}[${key}]`
      : prefix
        ? `${prefix}.${key}`
        : key;
    result.set(childPath, child);
    flattenNodes(child, childPath, result);
  }
  return result;
};

const isEmptyContainer = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  Object.keys(value).length === 0;

const extractPlaceholders = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  const placeholders = [];
  const pattern = /\{\{\s*([^},\s]+)(?:,[^}]*)?\s*\}\}/g;
  let match = pattern.exec(value);
  while (match) {
    placeholders.push(match[1]);
    match = pattern.exec(value);
  }
  return [...new Set(placeholders)].sort();
};

const extractRichTextTagSignature = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  const tags = [];
  const pattern = /<(\/?)([A-Za-z][\w-]*|\d+)(?:\s[^>]*)?(\/?)>/g;
  let match = pattern.exec(value);
  while (match) {
    tags.push(`${match[1]}${match[2]}${match[3]}`);
    match = pattern.exec(value);
  }
  return tags;
};

export const parseJsonResource = (source, file) => {
  try {
    const resource = JSON.parse(source);
    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
      return {
        resource: null,
        issues: [
          {
            category: "json-root-type-error",
            file,
            message: "Locale JSON root must be an object.",
          },
        ],
      };
    }

    const sourceFile = ts.parseJsonText(file, source);
    const issues = [];

    const visitJsonNode = (node, parentPath = "") => {
      if (ts.isObjectLiteralExpression(node)) {
        const seenNames = new Set();
        for (const property of node.properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue;
          }

          const propertyName = getPropertyName(property.name);
          if (propertyName === null) {
            continue;
          }

          const propertyPath = parentPath
            ? `${parentPath}.${propertyName}`
            : propertyName;
          if (seenNames.has(propertyName)) {
            issues.push({
              category: "duplicate-json-property",
              file,
              key: propertyPath,
            });
          } else {
            seenNames.add(propertyName);
          }
          visitJsonNode(property.initializer, propertyPath);
        }
        return;
      }

      if (ts.isArrayLiteralExpression(node)) {
        node.elements.forEach((element, index) => {
          visitJsonNode(element, `${parentPath}[${index}]`);
        });
      }
    };

    sourceFile.statements.forEach((statement) => {
      if (ts.isExpressionStatement(statement)) {
        visitJsonNode(statement.expression);
      }
    });

    return { resource, issues };
  } catch (error) {
    return {
      resource: null,
      issues: [
        {
          category: "json-parse-error",
          file,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
};

export const compareLocaleResources = (
  enResource,
  arResource,
  { enOwner = "en", arOwner = "ar" } = {},
) => {
  const enLeaves = flattenLeaves(enResource);
  const arLeaves = flattenLeaves(arResource);
  const enNodes = flattenNodes(enResource);
  const arNodes = flattenNodes(arResource);
  const issues = [];
  const typeMismatchKeys = new Set();

  for (const key of enLeaves.keys()) {
    if (!arLeaves.has(key)) {
      issues.push({
        category: "missing-in-ar",
        key,
        enOwner,
        arOwner,
      });
    }
  }

  for (const key of arLeaves.keys()) {
    if (!enLeaves.has(key)) {
      issues.push({
        category: "missing-in-en",
        key,
        enOwner,
        arOwner,
      });
    }
  }

  for (const [key, enValue] of enNodes) {
    if (isEmptyContainer(enValue) && !arNodes.has(key)) {
      issues.push({
        category: "missing-in-ar",
        key,
        enOwner,
        arOwner,
      });
    }
  }

  for (const [key, arValue] of arNodes) {
    if (isEmptyContainer(arValue) && !enNodes.has(key)) {
      issues.push({
        category: "missing-in-en",
        key,
        enOwner,
        arOwner,
      });
    }
  }

  for (const [key, enValue] of enNodes) {
    if (!arNodes.has(key)) {
      continue;
    }
    const enType = getValueType(enValue);
    const arType = getValueType(arNodes.get(key));
    if (enType !== arType) {
      typeMismatchKeys.add(key);
      issues.push({
        category: "type-mismatch",
        key,
        enOwner,
        arOwner,
        enType,
        arType,
      });
    }
  }

  for (const [key, enValue] of enLeaves) {
    if (!arLeaves.has(key)) {
      continue;
    }

    const arValue = arLeaves.get(key);
    const enType = getValueType(enValue);
    const arType = getValueType(arValue);
    if (enType !== arType && !typeMismatchKeys.has(key)) {
      issues.push({
        category: "type-mismatch",
        key,
        enOwner,
        arOwner,
        enType,
        arType,
      });
      typeMismatchKeys.add(key);
      continue;
    }

    const enPlaceholders = extractPlaceholders(enValue);
    const arPlaceholders = extractPlaceholders(arValue);
    if (enPlaceholders.join("\0") !== arPlaceholders.join("\0")) {
      issues.push({
        category: "placeholder-mismatch",
        key,
        enOwner,
        arOwner,
        enPlaceholders,
        arPlaceholders,
      });
    }

    const enTags = extractRichTextTagSignature(enValue);
    const arTags = extractRichTextTagSignature(arValue);
    if (enTags.join("\0") !== arTags.join("\0")) {
      issues.push({
        category: "rich-text-tag-mismatch",
        key,
        enOwner,
        arOwner,
        enTags,
        arTags,
      });
    }
  }

  const categoryOrder = new Map([
    ["missing-in-ar", 0],
    ["missing-in-en", 1],
    ["placeholder-mismatch", 2],
    ["rich-text-tag-mismatch", 3],
    ["type-mismatch", 4],
  ]);

  return issues.sort((left, right) => {
    const leftOrder = categoryOrder.get(left.category) ?? 99;
    const rightOrder = categoryOrder.get(right.category) ?? 99;
    return leftOrder - rightOrder;
  });
};

export const findDuplicateTopLevelOwners = (language, entries) => {
  const ownersByKey = new Map();

  for (const { owner, resource } of entries) {
    for (const key of Object.keys(resource)) {
      const owners = ownersByKey.get(key) ?? [];
      owners.push(owner);
      ownersByKey.set(key, owners);
    }
  }

  return [...ownersByKey.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([key, owners]) => ({
      category: "duplicate-top-level-owner",
      language,
      key,
      owners,
    }));
};

const pathExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const discoverLocalePairs = async (i18nRoot) => {
  const entries = await readdir(i18nRoot, { withFileTypes: true });
  const owners = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const pairs = [];

  for (const owner of owners) {
    const enCandidate = path.join(i18nRoot, owner, "en.json");
    const arCandidate = path.join(i18nRoot, owner, "ar.json");
    const [hasEn, hasAr] = await Promise.all([
      pathExists(enCandidate),
      pathExists(arCandidate),
    ]);
    if (hasEn || hasAr) {
      pairs.push({
        owner,
        enPath: hasEn ? enCandidate : null,
        arPath: hasAr ? arCandidate : null,
      });
    }
  }

  return pairs;
};

const unwrapExpression = (node) => {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
};

export const extractTranslationResourceRegistry = (
  source,
  fileName = "src/localization/resources.ts",
) => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = new Map();
  const issues = [];
  let hasResourceBuilderImport = false;

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (statement.importClause?.name) {
        imports.set(
          statement.importClause.name.text,
          statement.moduleSpecifier.text,
        );
      }
      const namedBindings = statement.importClause?.namedBindings;
      if (
        statement.moduleSpecifier.text === "./resourceBuilder" &&
        namedBindings &&
        ts.isNamedImports(namedBindings)
      ) {
        hasResourceBuilderImport = namedBindings.elements.some(
          (element) =>
            (element.propertyName ?? element.name).text ===
              "buildTranslationResources" &&
            element.name.text === "buildTranslationResources",
        );
      }
    }
  }

  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) &&
        candidate.name.text === "translationResourceRegistry",
    );
  const initializer = declaration?.initializer
    ? unwrapExpression(declaration.initializer)
    : null;
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    return {
      entries: [],
      issues: [
        {
          category: "registry-declaration-invalid",
          file: fileName,
        },
      ],
    };
  }

  const entries = [];
  initializer.elements.forEach((element, index) => {
    const entry = unwrapExpression(element);
    if (!entry || !ts.isObjectLiteralExpression(entry)) {
      issues.push({
        category: "registry-entry-invalid",
        file: fileName,
        index,
      });
      return;
    }

    const properties = new Map();
    entry.properties.forEach((property) => {
      if (ts.isPropertyAssignment(property)) {
        const name = getPropertyName(property.name);
        if (name) {
          properties.set(name, unwrapExpression(property.initializer));
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        properties.set(property.name.text, property.name);
      }
    });
    const ownerNode = properties.get("owner");
    const owner =
      ownerNode && ts.isStringLiteral(ownerNode) ? ownerNode.text : null;
    const enNode = properties.get("en");
    const arNode = properties.get("ar");
    const enImport =
      enNode && ts.isIdentifier(enNode) ? imports.get(enNode.text) : null;
    const arImport =
      arNode && ts.isIdentifier(arNode) ? imports.get(arNode.text) : null;

    if (!owner || !enImport || !arImport) {
      issues.push({
        category: "registry-entry-invalid",
        file: fileName,
        index,
      });
      return;
    }

    const registryEntry = { owner, enImport, arImport };
    entries.push(registryEntry);
    for (const [language, importPath] of [
      ["en", enImport],
      ["ar", arImport],
    ]) {
      const expectedPath = `./${owner}/${language}.json`;
      if (importPath !== expectedPath) {
        issues.push({
          category: "registry-owner-import-mismatch",
          file: fileName,
          owner,
          language,
          importPath,
          expectedPath,
        });
      }
    }
  });

  const resourcesDeclaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) && candidate.name.text === "resources",
    );
  const resourcesInitializer = resourcesDeclaration?.initializer
    ? unwrapExpression(resourcesDeclaration.initializer)
    : null;
  const resourcesCallee =
    resourcesInitializer && ts.isCallExpression(resourcesInitializer)
      ? unwrapExpression(resourcesInitializer.expression)
      : null;
  const resourcesArgument =
    resourcesInitializer && ts.isCallExpression(resourcesInitializer)
      ? unwrapExpression(resourcesInitializer.arguments[0])
      : null;
  if (
    !resourcesInitializer ||
    !ts.isCallExpression(resourcesInitializer) ||
    !resourcesCallee ||
    !ts.isIdentifier(resourcesCallee) ||
    resourcesCallee.text !== "buildTranslationResources" ||
    !hasResourceBuilderImport ||
    resourcesInitializer.arguments.length !== 1 ||
    !resourcesArgument ||
    !ts.isIdentifier(resourcesArgument) ||
    resourcesArgument.text !== "translationResourceRegistry"
  ) {
    issues.push({
      category: "runtime-resource-binding-invalid",
      file: fileName,
    });
  }

  return { entries, issues };
};

export const validateTranslationResourceRegistry = (entries, pairs) => {
  const issues = [];
  const pairByOwner = new Map(pairs.map((pair) => [pair.owner, pair]));
  const registryOwners = new Set();

  for (const entry of entries) {
    if (registryOwners.has(entry.owner)) {
      issues.push({
        category: "duplicate-registry-owner",
        owner: entry.owner,
      });
      continue;
    }
    registryOwners.add(entry.owner);

    const pair = pairByOwner.get(entry.owner);
    if (!pair) {
      issues.push({
        category: "registry-owner-missing-locale-pair",
        owner: entry.owner,
      });
      continue;
    }
    for (const language of ["en", "ar"]) {
      if (!pair[`${language}Path`]) {
        issues.push({
          category: "registry-owner-missing-locale-file",
          owner: entry.owner,
          language,
        });
      }
    }
  }

  for (const pair of pairs) {
    if (!registryOwners.has(pair.owner)) {
      issues.push({
        category: "unregistered-locale-pair",
        owner: pair.owner,
      });
    }
  }

  return issues;
};

const extractLiteralValues = (node) => {
  const expression = unwrapExpression(node);
  if (!expression) {
    return [];
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return [expression.text];
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...extractLiteralValues(expression.whenTrue),
      ...extractLiteralValues(expression.whenFalse),
    ];
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap(extractLiteralValues);
  }
  return [];
};

const getPropertyName = (name) => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return null;
};

export const extractStaticI18nReferences = (source, fileName = "source.ts") => {
  const scriptKind = fileName.endsWith("x")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".js") || fileName.endsWith(".mjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const keys = new Set();
  const references = new Map();
  const dynamicReferences = [];
  const literalCollections = new Map();
  const literalKeyProperties = new Map();
  const isRouteFile = /(?:^|[/\\])routes(?:[/\\]|$)/i.test(fileName);
  const ordinaryTScopes = [];
  const translatorScopes = [];
  const translatorWrappers = [];

  const locationOf = (node) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    return { file: fileName, line: line + 1, column: character + 1 };
  };

  const addKey = (key, node) => {
    keys.add(key);
    const locations = references.get(key) ?? [];
    locations.push(locationOf(node));
    references.set(key, locations);
  };

  const collectLiteralCollections = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      let values = [];
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        values = initializer.properties.flatMap((property) =>
          ts.isPropertyAssignment(property)
            ? extractLiteralValues(property.initializer)
            : [],
        );
      } else if (initializer && ts.isArrayLiteralExpression(initializer)) {
        values = initializer.elements.flatMap(extractLiteralValues);
      }

      if (values.length > 0) {
        literalCollections.set(node.name.text, [...new Set(values)]);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyName(node.name);
      const isGeneralKeyProperty =
        Boolean(propertyName) && GENERAL_KEY_PROPERTY_NAMES.has(propertyName);
      const isRouteKeyProperty =
        Boolean(propertyName) &&
        isRouteFile &&
        ROUTE_KEY_PROPERTY_NAMES.has(propertyName);
      if (propertyName && (isGeneralKeyProperty || isRouteKeyProperty)) {
        const values = extractLiteralValues(node.initializer).filter((value) =>
          value.includes("."),
        );
        if (values.length > 0) {
          const existing = literalKeyProperties.get(propertyName) ?? [];
          literalKeyProperties.set(propertyName, [
            ...new Set([...existing, ...values]),
          ]);
        }
      }
    }
    ts.forEachChild(node, collectLiteralCollections);
  };

  collectLiteralCollections(sourceFile);

  const extractControlledTemplateValues = (node) => {
    const expression = unwrapExpression(node);
    if (!expression || !ts.isTemplateExpression(expression)) {
      return [];
    }

    let results = [expression.head.text];
    for (const span of expression.templateSpans) {
      const spanExpression = unwrapExpression(span.expression);
      let substitutions = [];
      if (spanExpression && ts.isIdentifier(spanExpression)) {
        substitutions = literalCollections.get(spanExpression.text) ?? [];
      } else if (
        spanExpression &&
        ts.isElementAccessExpression(spanExpression) &&
        ts.isIdentifier(unwrapExpression(spanExpression.expression))
      ) {
        substitutions =
          literalCollections.get(
            unwrapExpression(spanExpression.expression).text,
          ) ?? [];
      }

      if (substitutions.length === 0) {
        return [];
      }

      results = results.flatMap((prefix) =>
        substitutions.map(
          (substitution) => `${prefix}${substitution}${span.literal.text}`,
        ),
      );
    }
    return results;
  };

  const addLiteralValues = (node, { prefix = "", suffix = "" } = {}) => {
    let values = [
      ...extractLiteralValues(node),
      ...extractControlledTemplateValues(node),
    ];
    const expression = unwrapExpression(node);
    if (
      values.length === 0 &&
      expression &&
      ts.isPropertyAccessExpression(expression)
    ) {
      values = literalKeyProperties.get(expression.name.text) ?? [];
    }
    for (const value of values) {
      addKey(`${prefix}${value}${suffix}`, node);
    }
    return values.length > 0;
  };
  const isEmptyKeyValue = (node) => {
    const value = unwrapExpression(node);
    return (
      value?.kind === ts.SyntaxKind.NullKeyword ||
      (value && ts.isIdentifier(value) && value.text === "undefined")
    );
  };

  const findLexicalScope = (node) => {
    let current = node.parent;
    while (
      current &&
      !ts.isBlock(current) &&
      !ts.isSourceFile(current)
    ) {
      current = current.parent;
    }
    return current;
  };

  const addOrdinaryTranslatorScope = (name, scope) => {
    if (scope) {
      ordinaryTScopes.push({ name, start: scope.pos, end: scope.end });
    }
  };

  const isInsideOrdinaryTranslatorScope = (name, node) =>
    ordinaryTScopes.some(
      ({ name: ordinaryName, start, end }) =>
        ordinaryName === name && node.pos >= start && node.end <= end,
    );

  const addTranslatorScope = (name, node) => {
    const scope = findLexicalScope(node);
    if (scope) {
      translatorScopes.push({
        name,
        start: scope.pos,
        end: scope.end,
      });
    }
  };

  const getReactHookName = (node) => {
    const expression = unwrapExpression(node);
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "React"
    ) {
      return expression.name.text;
    }
    return null;
  };

  const isDirectFixedTranslatorFactory = (node) => {
    const expression = unwrapExpression(node);
    if (!expression || !ts.isCallExpression(expression)) {
      return false;
    }
    const callee = unwrapExpression(expression.expression);
    return (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "getFixedT"
    );
  };

  const getFunctionReturnExpression = (node) => {
    const expression = unwrapExpression(node);
    if (
      !expression ||
      (!ts.isArrowFunction(expression) &&
        !ts.isFunctionExpression(expression))
    ) {
      return null;
    }
    if (!ts.isBlock(expression.body)) {
      return unwrapExpression(expression.body);
    }
    const returns = expression.body.statements.filter(ts.isReturnStatement);
    return returns.length === 1 && returns[0].expression
      ? unwrapExpression(returns[0].expression)
      : null;
  };

  const isFixedTranslatorInitializer = (node) => {
    const expression = unwrapExpression(node);
    if (isDirectFixedTranslatorFactory(expression)) {
      return true;
    }
    if (
      !expression ||
      !ts.isCallExpression(expression) ||
      getReactHookName(expression.expression) !== "useMemo"
    ) {
      return false;
    }
    const returnedExpression = getFunctionReturnExpression(
      expression.arguments[0],
    );
    return (
      returnedExpression !== null &&
      isDirectFixedTranslatorFactory(returnedExpression)
    );
  };

  const getTranslatorWrapper = (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      !node.initializer
    ) {
      return null;
    }

    let initializer = unwrapExpression(node.initializer);
    if (
      initializer &&
      ts.isCallExpression(initializer) &&
      ["useCallback", "useMemo"].includes(
        getReactHookName(initializer.expression),
      )
    ) {
      initializer = unwrapExpression(initializer.arguments[0]);
    }
    if (
      !initializer ||
      (!ts.isArrowFunction(initializer) &&
        !ts.isFunctionExpression(initializer)) ||
      initializer.parameters.length === 0 ||
      !ts.isIdentifier(initializer.parameters[0].name)
    ) {
      return null;
    }

    const parameterName = initializer.parameters[0].name.text;
    const matchingCalls = [];
    const collectMatchingCalls = (candidate) => {
      if (ts.isCallExpression(candidate)) {
        const callee = unwrapExpression(candidate.expression);
        const isTranslatorCallee =
          (ts.isIdentifier(callee) &&
            !isInsideOrdinaryTranslatorScope(callee.text, candidate) &&
            (callee.text === "t" ||
              translatorScopes.some(
                ({ name, start, end }) =>
                  name === callee.text &&
                  candidate.pos >= start &&
                  candidate.end <= end,
              ))) ||
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === "t" &&
            ts.isIdentifier(callee.expression) &&
            TRUSTED_I18N_INSTANCES.has(callee.expression.text));
        const keyArgument = unwrapExpression(candidate.arguments[0]);
        if (
          isTranslatorCallee &&
          keyArgument &&
          ((ts.isIdentifier(keyArgument) &&
            keyArgument.text === parameterName) ||
            (ts.isTemplateExpression(keyArgument) &&
              keyArgument.templateSpans.length === 1))
        ) {
          if (ts.isIdentifier(keyArgument)) {
            matchingCalls.push({
              call: candidate,
              prefix: "",
              suffix: "",
            });
          } else {
            const [span] = keyArgument.templateSpans;
            if (
              ts.isIdentifier(span.expression) &&
              span.expression.text === parameterName
            ) {
              matchingCalls.push({
                call: candidate,
                prefix: keyArgument.head.text,
                suffix: span.literal.text,
              });
            }
          }
        }
      }
      ts.forEachChild(candidate, collectMatchingCalls);
    };
    collectMatchingCalls(initializer.body);
    if (
      matchingCalls.length === 0 ||
      matchingCalls.some(
        ({ prefix, suffix }) =>
          prefix !== matchingCalls[0].prefix ||
          suffix !== matchingCalls[0].suffix,
      )
    ) {
      return null;
    }

    const scope = findLexicalScope(node);
    const [{ prefix, suffix }] = matchingCalls;
    return scope
      ? {
          start: scope.pos,
          end: scope.end,
          name: node.name.text,
          prefix,
          suffix,
          bodyCalls: matchingCalls.map(({ call }) => ({
            start: call.pos,
            end: call.end,
          })),
        }
      : null;
  };

  const inspectTDeclarations = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      const isUseTranslation =
        initializer &&
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(unwrapExpression(initializer.expression)) &&
        unwrapExpression(initializer.expression).text === "useTranslation";
      if (isUseTranslation) {
        node.name.elements.forEach((element) => {
          const sourceName = element.propertyName ?? element.name;
          if (
            getPropertyName(sourceName) === "t" &&
            ts.isIdentifier(element.name)
          ) {
            addTranslatorScope(element.name.text, node);
          }
        });
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text !== "t" &&
      node.initializer &&
      isFixedTranslatorInitializer(node.initializer)
    ) {
      addTranslatorScope(node.name.text, node);
    }

    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      (node.name.text === "t" ||
        translatorScopes.some(
          ({ name, start, end }) =>
            name === node.name?.text &&
            node.pos >= start &&
            node.end <= end,
        ))
    ) {
      addOrdinaryTranslatorScope(node.name.text, findLexicalScope(node));
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const wrapper = getTranslatorWrapper(node);
      const isFixedTranslator = Boolean(
        node.initializer && isFixedTranslatorInitializer(node.initializer),
      );
      if (wrapper) {
        translatorWrappers.push(wrapper);
        if (node.name.text !== "t") {
          addTranslatorScope(node.name.text, node);
        }
      }
      const shadowsScopedTranslator = translatorScopes.some(
        ({ name, start, end }) =>
          name === node.name.text && node.pos >= start && node.end <= end,
      );
      if (node.name.text === "t" || shadowsScopedTranslator) {
        const initializerText = node.initializer?.getText(sourceFile) ?? "";
        const isKnownTranslator =
          Boolean(wrapper) ||
          isFixedTranslator ||
          /\b(?:i18n|i18next|i18nInstance)\b/.test(initializerText) ||
          /\b(?:defaultT|getFixedT|tProp)\b/.test(initializerText);
        if (!isKnownTranslator) {
          addOrdinaryTranslatorScope(
            node.name.text,
            findLexicalScope(node),
          );
        }
      }
    }

    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === "t" ||
        translatorScopes.some(
          ({ name, start, end }) =>
            name === node.name.text && node.pos >= start && node.end <= end,
        ))
    ) {
      const typeText = node.type?.getText(sourceFile) ?? "";
      const isTranslatorType =
        /(?:TFunction|Translate|Translation|Translator)/.test(typeText) ||
        (/\(\s*(?:key|translationKey)\s*:\s*string/.test(typeText) &&
          /=>\s*string/.test(typeText));
      if (!isTranslatorType) {
        const functionLike = node.parent;
        const scope =
          ts.isFunctionLike(functionLike) && functionLike.body
            ? functionLike.body
            : findLexicalScope(node);
        addOrdinaryTranslatorScope(node.name.text, scope);
      }
    }

    ts.forEachChild(node, inspectTDeclarations);
  };

  inspectTDeclarations(sourceFile);

  const isScopedTranslator = (name, node) =>
    translatorScopes.some(
      ({ name: translatorName, start, end }) =>
        translatorName === name && node.pos >= start && node.end <= end,
    );

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = unwrapExpression(node.expression);
      const isWrapperBodyCall = translatorWrappers.some(
        ({ bodyCalls }) =>
          bodyCalls.some(
            ({ start, end }) => node.pos === start && node.end === end,
          ),
      );
      const isTranslationCall =
        !isWrapperBodyCall &&
        ((ts.isIdentifier(callee) &&
          !isInsideOrdinaryTranslatorScope(callee.text, node) &&
          (callee.text === "t" || isScopedTranslator(callee.text, node))) ||
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === "t" &&
            ts.isIdentifier(callee.expression) &&
            TRUSTED_I18N_INSTANCES.has(callee.expression.text)));
      if (isTranslationCall && node.arguments[0]) {
        const wrapper =
          ts.isIdentifier(callee)
            ? translatorWrappers.find(
                ({ name, start, end }) =>
                  name === callee.text && node.pos >= start && node.end <= end,
              )
            : null;
        if (
          !addLiteralValues(
            node.arguments[0],
            wrapper
              ? { prefix: wrapper.prefix, suffix: wrapper.suffix }
              : undefined,
          )
        ) {
          dynamicReferences.push({
            ...locationOf(node.arguments[0]),
            expression: node.arguments[0].getText(sourceFile),
          });
        }
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyName(node.name);
      const isGeneralKeyProperty =
        Boolean(propertyName) && GENERAL_KEY_PROPERTY_NAMES.has(propertyName);
      const isRouteKeyProperty =
        Boolean(propertyName) &&
        isRouteFile &&
        ROUTE_KEY_PROPERTY_NAMES.has(propertyName);
      if (isGeneralKeyProperty) {
        const values = extractLiteralValues(node.initializer);
        values
          .filter((value) => value.includes("."))
          .forEach((value) => addKey(value, node.initializer));
        if (values.length === 0 && !isEmptyKeyValue(node.initializer)) {
          dynamicReferences.push({
            ...locationOf(node.initializer),
            expression: node.initializer.getText(sourceFile),
          });
        }
      } else if (isRouteKeyProperty) {
        if (
          !addLiteralValues(node.initializer) &&
          !isEmptyKeyValue(node.initializer)
        ) {
          dynamicReferences.push({
            ...locationOf(node.initializer),
            expression: node.initializer.getText(sourceFile),
          });
        }
      }
    }

    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(sourceFile) === "Trans"
    ) {
      const i18nKeyAttribute = node.attributes.properties.find(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(sourceFile) === "i18nKey",
      );
      if (i18nKeyAttribute && ts.isJsxAttribute(i18nKeyAttribute)) {
        const initializer = i18nKeyAttribute.initializer;
        if (initializer && ts.isStringLiteral(initializer)) {
          addKey(initializer.text, initializer);
        } else if (
          initializer &&
          ts.isJsxExpression(initializer) &&
          initializer.expression &&
          !addLiteralValues(initializer.expression)
        ) {
          dynamicReferences.push({
            ...locationOf(initializer.expression),
            expression: initializer.expression.getText(sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { keys, references, dynamicReferences };
};

export const findMissingStaticReferences = (
  references,
  enKeys,
  arKeys,
) => {
  const issues = [];

  for (const [key, locations] of references) {
    if (!enKeys.has(key)) {
      issues.push({
        category: "static-key-missing-in-en",
        key,
        locations,
      });
    }
    if (!arKeys.has(key)) {
      issues.push({
        category: "static-key-missing-in-ar",
        key,
        locations,
      });
    }
  }

  return issues;
};

export const findUncontrolledDynamicReferences = (
  references,
  controlledRules,
) =>
  references
    .filter(
      ({ file, expression }) =>
        !controlledRules.some(
          (rule) =>
            rule.file.test(file) && rule.expression.test(expression),
        ),
    )
    .map((reference) => ({
      category: "uncontrolled-dynamic-i18n-reference",
      ...reference,
    }));

const createSourceFile = (source, fileName) => {
  const scriptKind = fileName.endsWith("x")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".js") || fileName.endsWith(".mjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
};

const createLocationResolver = (sourceFile, fileName) => (node) => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return { file: fileName, line: line + 1, column: character + 1 };
};

const isI18nextLanguageAccess = (node) =>
  ts.isPropertyAccessExpression(node) &&
  node.name.text === "language" &&
  ts.isIdentifier(node.expression) &&
  TRUSTED_I18N_INSTANCES.has(node.expression.text);

const isPortalLocaleLiteral = (node) =>
  (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
  ["ar", "en"].includes(node.text.toLowerCase());

export const extractExactI18nextLocaleComparisons = (
  source,
  fileName = "source.tsx",
) => {
  const sourceFile = createSourceFile(source, fileName);
  const locationOf = createLocationResolver(sourceFile, fileName);
  const candidates = [];
  const comparisonOperators = new Set([
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ]);

  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      comparisonOperators.has(node.operatorToken.kind) &&
      ((isI18nextLanguageAccess(node.left) &&
        isPortalLocaleLiteral(node.right)) ||
        (isPortalLocaleLiteral(node.left) &&
          isI18nextLanguageAccess(node.right)))
    ) {
      candidates.push({
        category: "exact-i18next-locale-comparison",
        expression: node.getText(sourceFile),
        ...locationOf(node),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
};

const RAW_MESSAGE_SINK_OWNERS = new Set([
  "CustomMessage",
  "message",
  "notification",
]);
const RAW_MESSAGE_SINK_METHODS = new Set([
  "error",
  "info",
  "open",
  "success",
  "warn",
  "warning",
]);
const RAW_MESSAGE_HELPERS = new Set([
  "getApiErrorMessage",
  "getErrorMessage",
  "getRequestErrorMessage",
]);
const RAW_MESSAGE_PROPERTY_NAMES = new Set([
  "customMessage",
  "errorMessage",
  "failureReason",
  "message",
]);
const RAW_STATE_VISIBLE_JSX_ATTRIBUTES = new Set([
  "description",
  "help",
  "message",
  "subTitle",
  "text",
  "title",
]);
const RAW_MESSAGE_CONTAINER_NAMES = new Set([
  "data",
  "err",
  "error",
  "exception",
  "payload",
  "res",
  "response",
  "result",
]);
const isRawAliasScope = (node) =>
  ts.isBlock(node) ||
  ts.isSourceFile(node) ||
  ts.isModuleBlock(node) ||
  ts.isCaseBlock(node) ||
  ts.isForStatement(node) ||
  ts.isForInStatement(node) ||
  ts.isForOfStatement(node) ||
  ts.isFunctionLike(node);

const isRawVariableAlias = (
  node,
  rawVariableNamesByScope,
  declaredVariableNamesByScope,
) => {
  if (!ts.isIdentifier(node) || !rawVariableNamesByScope) {
    return false;
  }

  let current = node.parent;
  while (current) {
    if (isRawAliasScope(current)) {
      const declaredNames = declaredVariableNamesByScope?.get(current);
      if (declaredNames?.has(node.text)) {
        return rawVariableNamesByScope.get(current)?.has(node.text) ?? false;
      }
    }
    current = current.parent;
  }
  return false;
};

const containsRawMessageReference = (
  node,
  rawVariableNamesByScope = undefined,
  declaredVariableNamesByScope = undefined,
) => {
  let found = false;
  const visit = (current) => {
    if (
      isRawVariableAlias(
        current,
        rawVariableNamesByScope,
        declaredVariableNamesByScope,
      )
    ) {
      found = true;
      return;
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      RAW_MESSAGE_PROPERTY_NAMES.has(current.name.text) &&
      /\b(?:data|err|error|exception|payload|res|response|result)\b/iu.test(
        current.expression.getText(),
      )
    ) {
      found = true;
      return;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      RAW_MESSAGE_HELPERS.has(current.expression.text)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

export const extractRawUserMessageCandidates = (
  source,
  fileName = "source.tsx",
) => {
  const sourceFile = createSourceFile(source, fileName);
  const locationOf = createLocationResolver(sourceFile, fileName);
  const candidates = [];
  const stateBySetter = new Map();
  const rawStateNames = new Set();
  const rawVariableNamesByScope = new Map();
  const declaredVariableNamesByScope = new Map();

  const getDeclarationScope = (node) => {
    const declarationList = ts.isVariableDeclaration(node)
      ? node.parent
      : undefined;
    const isBlockScoped =
      declarationList &&
      ts.isVariableDeclarationList(declarationList) &&
      (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
    let current = node.parent;
    while (current) {
      if (
        !isBlockScoped &&
        (ts.isFunctionLike(current) || ts.isSourceFile(current))
      ) {
        return current;
      }
      if (isBlockScoped && isRawAliasScope(current)) {
        return current;
      }
      current = current.parent;
    }
    return sourceFile;
  };

  const collectDeclaredVariableNames = () => {
    const register = (scope, name) => {
      const names = declaredVariableNamesByScope.get(scope) ?? new Set();
      names.add(name);
      declaredVariableNamesByScope.set(scope, names);
    };
    const registerBindingName = (scope, name) => {
      if (ts.isIdentifier(name)) {
        register(scope, name.text);
        return;
      }
      name.elements.forEach((element) => {
        if (ts.isBindingElement(element)) {
          registerBindingName(scope, element.name);
        }
      });
    };
    const visit = (node) => {
      if (ts.isVariableDeclaration(node)) {
        registerBindingName(getDeclarationScope(node), node.name);
      }
      if (
        ts.isParameter(node) &&
        ts.isFunctionLike(node.parent)
      ) {
        registerBindingName(node.parent, node.name);
      }
      if (
        ts.isCatchClause(node) &&
        node.variableDeclaration
      ) {
        registerBindingName(node.block, node.variableDeclaration.name);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  };

  const collectRawVariableNames = () => {
    let changed = false;
    const isDirectTranslationCall = (node) =>
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "t") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "t"));
    const containsBackendContainerReference = (node) => {
      if (ts.isCallExpression(node)) {
        return false;
      }
      let found = false;
      const inspect = (current) => {
        if (
          ts.isIdentifier(current) &&
          RAW_MESSAGE_CONTAINER_NAMES.has(current.text)
        ) {
          found = true;
          return;
        }
        ts.forEachChild(current, inspect);
      };
      inspect(node);
      return found;
    };
    const collectRawBindingNames = (name, initializer, result) => {
      if (!ts.isObjectBindingPattern(name)) {
        return;
      }
      if (!containsBackendContainerReference(initializer)) {
        return;
      }
      name.elements.forEach((element) => {
        if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
          return;
        }
        const propertyName = element.propertyName ?? element.name;
        if (
          ((ts.isIdentifier(propertyName) ||
            ts.isStringLiteral(propertyName)) &&
            RAW_MESSAGE_PROPERTY_NAMES.has(propertyName.text))
        ) {
          result.add(element.name.text);
        }
      });
    };
    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        !isDirectTranslationCall(node.initializer)
      ) {
        const scope = getDeclarationScope(node);
        const names = rawVariableNamesByScope.get(scope) ?? new Set();
        const nextNames = new Set();
        if (
          ts.isIdentifier(node.name) &&
          containsRawMessageReference(
            node.initializer,
            rawVariableNamesByScope,
            declaredVariableNamesByScope,
          )
        ) {
          nextNames.add(node.name.text);
        }
        collectRawBindingNames(node.name, node.initializer, nextNames);
        nextNames.forEach((name) => {
          if (!names.has(name)) {
            names.add(name);
            changed = true;
          }
        });
        if (nextNames.size > 0) {
          rawVariableNamesByScope.set(scope, names);
        }
      }
      ts.forEachChild(node, visit);
    };

    do {
      changed = false;
      visit(sourceFile);
    } while (changed);
  };

  const collectStateDeclarations = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.name.elements.length >= 2 &&
      ts.isBindingElement(node.name.elements[0]) &&
      ts.isIdentifier(node.name.elements[0].name) &&
      ts.isBindingElement(node.name.elements[1]) &&
      ts.isIdentifier(node.name.elements[1].name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callee = node.initializer.expression;
      const isUseState =
        (ts.isIdentifier(callee) && callee.text === "useState") ||
        (ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "useState");
      if (isUseState) {
        stateBySetter.set(
          node.name.elements[1].name.text,
          node.name.elements[0].name.text,
        );
      }
    }
    ts.forEachChild(node, collectStateDeclarations);
  };

  const collectRawStateNames = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      stateBySetter.has(node.expression.text) &&
      node.arguments.some((argument) =>
        containsRawMessageReference(
          argument,
          rawVariableNamesByScope,
          declaredVariableNamesByScope,
        ),
      )
    ) {
      rawStateNames.add(stateBySetter.get(node.expression.text));
    }
    ts.forEachChild(node, collectRawStateNames);
  };

  const containsRawStateIdentifier = (node) => {
    let found = false;
    const inspect = (current) => {
      if (ts.isIdentifier(current) && rawStateNames.has(current.text)) {
        found = true;
        return;
      }
      ts.forEachChild(current, inspect);
    };
    inspect(node);
    return found;
  };
  const rendersRawStateIdentifier = (node) => {
    if (ts.isConditionalExpression(node)) {
      return (
        containsRawStateIdentifier(node.whenTrue) ||
        containsRawStateIdentifier(node.whenFalse)
      );
    }
    return containsRawStateIdentifier(node);
  };

  collectDeclaredVariableNames();
  collectRawVariableNames();
  collectStateDeclarations(sourceFile);
  collectRawStateNames(sourceFile);

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      RAW_MESSAGE_SINK_OWNERS.has(node.expression.expression.text) &&
      RAW_MESSAGE_SINK_METHODS.has(node.expression.name.text) &&
      node.arguments.some((argument) =>
        containsRawMessageReference(
          argument,
          rawVariableNamesByScope,
          declaredVariableNamesByScope,
        ),
      )
    ) {
      candidates.push({
        category: "raw-user-message",
        sink: node.expression.getText(sourceFile),
        expression: node.getText(sourceFile),
        ...locationOf(node),
      });
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      RAW_STATE_VISIBLE_JSX_ATTRIBUTES.has(node.name.text) &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      containsRawStateIdentifier(node.initializer.expression)
    ) {
      candidates.push({
        category: "raw-user-message",
        sink: `JSX.${node.name.text}`,
        expression: node.getText(sourceFile),
        ...locationOf(node),
      });
    }
    if (
      ts.isJsxExpression(node) &&
      !ts.isJsxAttribute(node.parent) &&
      node.expression &&
      rendersRawStateIdentifier(node.expression)
    ) {
      candidates.push({
        category: "raw-user-message",
        sink: "JSX.expression",
        expression: node.getText(sourceFile),
        ...locationOf(node),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
};

export const extractI18nDefaultValueCandidates = (
  source,
  fileName = "source.tsx",
) => {
  const sourceFile = createSourceFile(source, fileName);
  const locationOf = createLocationResolver(sourceFile, fileName);
  const candidates = [];
  const declaredNamesByScope = new Map();
  const optionExpressionsByScope = new Map();
  const isTranslatorCall = (expression) =>
    (ts.isIdentifier(expression) && expression.text === "t") ||
    (ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "t");
  const normalize = (value) => value.getText(sourceFile).replace(/\s+/g, " ");
  const unwrapExpression = (expression) => {
    let current = expression;
    while (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  const isOptionsScope = (node) =>
    ts.isBlock(node) ||
    ts.isSourceFile(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isFunctionLike(node) ||
    ts.isCatchClause(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node);
  const getDeclarationScope = (node) => {
    const declarationList = ts.isVariableDeclaration(node)
      ? node.parent
      : undefined;
    const isBlockScoped =
      declarationList &&
      ts.isVariableDeclarationList(declarationList) &&
      (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
    let current = node.parent;
    while (current) {
      if (
        !isBlockScoped &&
        (ts.isFunctionLike(current) || ts.isSourceFile(current))
      ) {
        return current;
      }
      if (isBlockScoped && isOptionsScope(current)) {
        return current;
      }
      current = current.parent;
    }
    return sourceFile;
  };
  const registerBindingName = (scope, name) => {
    if (ts.isIdentifier(name)) {
      const names = declaredNamesByScope.get(scope) ?? new Set();
      names.add(name.text);
      declaredNamesByScope.set(scope, names);
      return;
    }
    name.elements.forEach((element) => {
      if (ts.isBindingElement(element)) {
        registerBindingName(scope, element.name);
      }
    });
  };
  const collectOptionDeclarations = (node) => {
    if (ts.isVariableDeclaration(node)) {
      const scope = getDeclarationScope(node);
      registerBindingName(scope, node.name);
      if (ts.isIdentifier(node.name) && node.initializer) {
        const expressions = optionExpressionsByScope.get(scope) ?? new Map();
        expressions.set(node.name.text, unwrapExpression(node.initializer));
        optionExpressionsByScope.set(scope, expressions);
      }
    }
    if (ts.isParameter(node) && ts.isFunctionLike(node.parent)) {
      registerBindingName(node.parent, node.name);
    }
    if (ts.isCatchClause(node) && node.variableDeclaration) {
      registerBindingName(node, node.variableDeclaration.name);
    }
    ts.forEachChild(node, collectOptionDeclarations);
  };
  collectOptionDeclarations(sourceFile);

  const resolveIdentifierExpression = (identifier) => {
    let current = identifier.parent;
    while (current) {
      if (
        isOptionsScope(current) &&
        declaredNamesByScope.get(current)?.has(identifier.text)
      ) {
        return optionExpressionsByScope.get(current)?.get(identifier.text);
      }
      current = current.parent;
    }
    return undefined;
  };
  const getStaticPropertyName = (name) => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name)
    ) {
      return name.text;
    }
    if (ts.isComputedPropertyName(name)) {
      const expression = unwrapExpression(name.expression);
      if (
        ts.isStringLiteral(expression) ||
        ts.isNoSubstitutionTemplateLiteral(expression)
      ) {
        return expression.text;
      }
    }
    return undefined;
  };
  const inspectOptionsExpression = (expression, seen = new Set()) => {
    const current = unwrapExpression(expression);
    if (seen.has(current)) {
      return { kind: "unresolved", expression: normalize(current) };
    }
    seen.add(current);

    if (ts.isIdentifier(current)) {
      const resolved = resolveIdentifierExpression(current);
      return resolved
        ? inspectOptionsExpression(resolved, seen)
        : { kind: "safe" };
    }
    if (!ts.isObjectLiteralExpression(current)) {
      return { kind: "default", expression: normalize(current) };
    }

    for (const property of current.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spreadExpression = unwrapExpression(property.expression);
        const resolvedSpread = ts.isIdentifier(spreadExpression)
          ? resolveIdentifierExpression(spreadExpression)
          : spreadExpression;
        if (
          resolvedSpread &&
          (ts.isIdentifier(resolvedSpread) ||
            ts.isObjectLiteralExpression(resolvedSpread))
        ) {
          const spreadResult = inspectOptionsExpression(resolvedSpread, seen);
          if (spreadResult.kind !== "safe") {
            return spreadResult;
          }
        }
        continue;
      }
      const propertyName = getStaticPropertyName(property.name);
      if (propertyName === undefined) {
        return { kind: "unresolved", expression: normalize(current) };
      }
      if (propertyName !== "defaultValue") {
        continue;
      }
      if (ts.isPropertyAssignment(property)) {
        return { kind: "default", expression: normalize(property.initializer) };
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        return { kind: "default", expression: normalize(property.name) };
      }
      return { kind: "unresolved", expression: normalize(property) };
    }
    return { kind: "safe" };
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      isTranslatorCall(node.expression) &&
      node.arguments[1]
    ) {
      const result = inspectOptionsExpression(node.arguments[1]);
      if (result.kind !== "safe") {
        const keyExpression = normalize(node.arguments[0]);
        const defaultValueExpression =
          result.kind === "unresolved"
            ? `<unresolved-options:${result.expression}>`
            : result.expression;
        candidates.push({
          category: "i18n-default-value",
          expression: node.getText(sourceFile),
          keyExpression,
          defaultValueExpression,
          signature: `${fileName}|${keyExpression}|${defaultValueExpression}`,
          ...locationOf(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
};

export const findNewI18nDefaultValueCandidates = (
  candidates,
  baselineSignatures,
) => {
  const remainingBaseline = new Map();
  baselineSignatures.forEach((signature) => {
    remainingBaseline.set(
      signature,
      (remainingBaseline.get(signature) ?? 0) + 1,
    );
  });
  return candidates.filter((candidate) => {
    const remaining = remainingBaseline.get(candidate.signature) ?? 0;
    if (remaining <= 0) {
      return true;
    }
    remainingBaseline.set(candidate.signature, remaining - 1);
    return false;
  });
};

export const findStaleI18nDefaultValueBaseline = (
  candidates,
  baselineSignatures,
) => {
  const remainingCandidates = new Map();
  candidates.forEach(({ signature }) => {
    remainingCandidates.set(
      signature,
      (remainingCandidates.get(signature) ?? 0) + 1,
    );
  });
  return baselineSignatures.filter((signature) => {
    const remaining = remainingCandidates.get(signature) ?? 0;
    if (remaining <= 0) {
      return true;
    }
    remainingCandidates.set(signature, remaining - 1);
    return false;
  });
};

const VISIBLE_JSX_ATTRIBUTES = new Set([
  "alt",
  "aria-label",
  "cancelText",
  "description",
  "emptyText",
  "label",
  "okText",
  "placeholder",
  "text",
  "title",
  "tooltip",
]);

const normalizeVisibleText = (value) => value.replace(/\s+/g, " ").trim();
const TECHNICAL_UI_TEXT_ALLOWLIST = new Set([
  "DD/MM/YYYY HH:MM",
  "https://",
]);

const isEnglishUiText = (value) =>
  !/^\{\{[^}]+\}\}$/.test(value) &&
  !ARABIC_LATIN_TOKEN_ALLOWLIST.has(value) &&
  !TECHNICAL_UI_TEXT_ALLOWLIST.has(value) &&
  /[A-Za-z]{2,}/.test(value.replace(/&[A-Za-z]+;/g, ""));

export const extractHardcodedUiCandidates = (
  source,
  fileName = "source.tsx",
) => {
  const sourceFile = createSourceFile(source, fileName);
  const candidates = [];

  const locationOf = createLocationResolver(sourceFile, fileName);
  const isDesignableLocaleModule = fileName
    .split(path.sep)
    .join("/")
    .includes("/components/designable/src/locales/");

  const isInsideEnglishLocaleDefinition = (node) => {
    if (!isDesignableLocaleModule) {
      return false;
    }

    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isPropertyAssignment(current) &&
        getPropertyName(current.name) === "en-US"
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  };

  const isInsideArabicLocaleDefinition = (node) => {
    if (!isDesignableLocaleModule) {
      return false;
    }

    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isPropertyAssignment(current) &&
        getPropertyName(current.name) === "ar-AE"
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  };

  const addCandidate = (kind, rawValue, node) => {
    const value = normalizeVisibleText(rawValue);
    if (
      !value ||
      !isEnglishUiText(value) ||
      isInsideEnglishLocaleDefinition(node)
    ) {
      return;
    }
    const location = locationOf(node);
    if (
      candidates.some(
        (candidate) =>
          candidate.file === location.file &&
          candidate.line === location.line &&
          candidate.column === location.column,
      )
    ) {
      return;
    }
    candidates.push({ kind, value, ...location });
  };

  const isUiConfigurationProperty = (node) => {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isJsxAttribute(current) &&
        ["columns", "locale"].includes(current.name.getText(sourceFile))
      ) {
        return true;
      }
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name)
      ) {
        return /^(?:.*Columns?|.*Locale|.*MenuItems?|.*Tabs?|.*Actions?|.*(?:Select|Filter|Status|Type)Options)$/i.test(
          current.name.text,
        );
      }
      current = current.parent;
    }
    return false;
  };

  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)) &&
      isInsideArabicLocaleDefinition(node) &&
      isUiConfigurationProperty(node)
    ) {
      const parent = node.parent;
      const isVisiblePropertyValue =
        ts.isPropertyAssignment(parent) &&
        parent.initializer === node &&
        getPropertyName(parent.name) !== "value";
      const isVisibleArrayValue = ts.isArrayLiteralExpression(parent);
      if (isVisiblePropertyValue || isVisibleArrayValue) {
        addCandidate("designable-arabic-locale", node.text, node);
      }
    }

    if (
      ts.isJsxAttribute(node) &&
      VISIBLE_JSX_ATTRIBUTES.has(node.name.getText(sourceFile))
    ) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer)) {
        addCandidate("jsx-attribute", initializer.text, initializer);
      } else if (
        initializer &&
        ts.isJsxExpression(initializer) &&
        initializer.expression &&
        (ts.isStringLiteral(initializer.expression) ||
          ts.isNoSubstitutionTemplateLiteral(initializer.expression))
      ) {
        addCandidate(
          "jsx-attribute",
          initializer.expression.text,
          initializer.expression,
        );
      }
    }

    if (ts.isJsxText(node)) {
      addCandidate("jsx-text", node.text, node);
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyName(node.name);
      const initializer = unwrapExpression(node.initializer);
      if (
        propertyName &&
        VISIBLE_JSX_ATTRIBUTES.has(propertyName) &&
        isUiConfigurationProperty(node) &&
        initializer &&
        (ts.isStringLiteral(initializer) ||
          ts.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        addCandidate("visible-property", initializer.text, initializer);
      }
    }

    if (ts.isCallExpression(node) && node.arguments[0]) {
      const callee = unwrapExpression(node.expression);
      if (
        ts.isPropertyAccessExpression(callee) &&
        ["error", "info", "success", "warning"].includes(callee.name.text) &&
        (ts.isIdentifier(callee.expression) ||
          ts.isPropertyAccessExpression(callee.expression))
      ) {
        const owner = callee.expression.getText(sourceFile);
        if (
          /(?:^|\.)(?:CustomMessage|message|notification)$/.test(owner) &&
          (ts.isStringLiteral(node.arguments[0]) ||
            ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
        ) {
          addCandidate("message-call", node.arguments[0].text, node.arguments[0]);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
};

export const extractArabicLatinCandidates = (
  resource,
  allowlist = ARABIC_LATIN_TOKEN_ALLOWLIST,
  keyAllowlist = ARABIC_LATIN_KEY_ALLOWLIST,
) => {
  const candidates = [];
  for (const [key, value] of flattenLeaves(resource)) {
    if (typeof value !== "string" || keyAllowlist.has(key)) {
      continue;
    }

    const searchableValue = value
      .replace(/\{\{[^}]+\}\}/g, " ")
      .replace(/<[^>]+>/g, " ");
    const tokens = searchableValue.match(/[A-Za-z][A-Za-z0-9+._/-]*/g) ?? [];
    const normalizedTokens = tokens.map((token) =>
      token.replace(/^[.,;:!?()[\]{}]+|[.,;:!?()[\]{}]+$/g, ""),
    );
    const unexpectedTokens = [...new Set(normalizedTokens)].filter(
      (token) => token && !allowlist.has(token),
    );
    if (unexpectedTokens.length > 0) {
      candidates.push({ key, tokens: unexpectedTokens, value });
    }
  }
  return candidates;
};
