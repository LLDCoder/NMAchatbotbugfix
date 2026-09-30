import { nowGst, toApi } from "@/utils/gstTime";
import request from "@/utils/request";

export type ApiResponse<T> = {
  code?: number;
  statusCode?: number;
  isSuccess?: boolean;
  message: string;
  data: T;
};

export type InspectionTaskSourceType =
  | "AUTO"
  | "BATCH"
  | "MANUAL"
  | "FOLLOW_UP";

export type InspectionRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type InspectionTaskStatus =
  | "DRAFT"
  | "PENDING_ASSIGNMENT"
  | "QUEUED"
  | "ASSIGNED"
  | "PENDING_VISIT"
  | "IN_PROGRESS"
  | "ACCESS_FAILED"
  | "SUBMITTED"
  | "CANCELLED"
  | "COMPLETED";

export type InspectionViolationStatus =
  | "OPEN"
  | "PENDING_ROUTING"
  | "UNDER_REVIEW"
  | "PENDING_REVIEW"
  | "PENDING_CONTENT_REPORT"
  | "REPORT_SUBMITTED"
  | "PENDING_COMMITTEE_DECISION"
  | "PENDING_APPROVAL"
  | "WARNING_ISSUED"
  | "PENDING_PAYMENT"
  | "RECTIFICATION_REQUIRED"
  | "RECTIFICATION"
  | "UNDER_APPEAL"
  | "RESOLVED"
  | "CLOSED"
  | "PAID"
  | "CANCELLED";

export type InspectionPriority = {
  priorityId: number;
  priorityCode?: string;
  priorityNameEn: string;
  priorityNameAr?: string;
};

export type InspectionTaskSource = {
  sourceTypeId: number;
  sourceTypeCode: InspectionTaskSourceType;
  sourceTypeNameEn: string;
  sourceTypeNameAr?: string;
};

export type InspectionAddress = {
  emirateId: number;
  emirateNameEn: string;
  emirateNameAr?: string;
  authorityId?: number;
  authorityNameEn?: string;
  authorityNameAr?: string;
  regionId?: number;
  regionNameEn?: string;
  regionNameAr?: string;
  areaId?: number;
  areaNameEn?: string;
  areaNameAr?: string;
  communityId?: number;
  communityNameEn?: string;
  street?: string;
  mapLocationUrl?: string;
  latitude?: number;
  longitude?: number;
};

export type InspectionTarget = {
  targetType: number;
  targetTypeCode?: string;
  targetTypeName: string;
  establishmentId?: number;
  individualId?: number;
  userProfileId?: number;
  profileId?: number;
  hasRegisteredProfile?: boolean;
  establishmentNameEn: string;
  establishmentNameAr?: string;
  establishmentSubTypeId?: number;
  establishmentSubType?: string;
  licenseNumber?: string;
  fullName?: string;
  emiratesId?: string;
  uid?: string;
  uaeNumber?: string;
  passportNumber?: string;
  email?: string;
  mobile?: string;
  mobileCountryCode?: string;
  mobileLocalNumber?: string;
  mediaLicenseNumber?: string;
  socialMediaAccountUsername?: string;
  economicActivityId?: number;
  economicActivityName?: string;
  address?: InspectionAddress;
};

export type InspectionDigitalPresenceWebsite = {
  url?: string;
  sourceType?: string;
  profileId?: number;
  applicationId?: number;
  applicationDetailId?: number;
  mediaLicenseId?: number;
  mediaLicenseEconomicActivityId?: number;
  externalMediaAccountId?: number;
  socialMediaId?: number;
  socialMediaName?: string;
  [key: string]: unknown;
};

export type InspectionDigitalPresenceSocialMedia = {
  sourceType?: string;
  profileId?: number;
  applicationId?: number;
  applicationDetailId?: number;
  mediaLicenseId?: number;
  mediaLicenseEconomicActivityId?: number;
  externalMediaAccountId?: number;
  socialMediaId?: number;
  socialMediaName?: string;
  socialMediaNameAr?: string;
  accountName?: string;
  websiteUrl?: string;
  [key: string]: unknown;
};

export type InspectionDigitalPresenceData = {
  websites: InspectionDigitalPresenceWebsite[];
  socialMedia: InspectionDigitalPresenceSocialMedia[];
};

export type InspectionRiskFactor = {
  id?: number | string;
  factorType: string;
  factorName?: string;
  factorNameEn: string;
  factorNameAr?: string;
  contributionScore?: number;
  score?: number;
  details?: string;
  description?: string;
};

export type InspectionRiskDimension = {
  key?: string;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  score?: number;
  tone?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  description?: string;
};

export type InspectionRiskProfile = {
  riskScore?: number;
  riskLevel?: InspectionRiskLevel;
  riskLevelName?: string;
  riskDescription?: string;
  aiRiskScore?: number;
  aiRiskLevelName?: string;
  aiRiskInsight?: string;
  riskDimensions?: InspectionRiskDimension[];
  riskFactors?: InspectionRiskFactor[];
  primaryRiskFactors?: Array<{
    factorType: string;
    factorName: string;
    description?: string;
  }>;
  lastAssessmentDate?: string;
};

export type InspectionCreatedViolationSummary = {
  violationId?: string | number;
  violationNo?: string;
  violationCode?: string;
  violationName?: string;
  violationType?: "License Violation" | "Content Violation" | string;
  categoryName?: string;
  reason?: string;
  severity?: InspectionRiskLevel | string;
  status?: InspectionViolationStatus | string;
  fineAmount?: number;
};

export type InspectionConfig = {
  inspectionTypeId: number;
  inspectionTypeCode?: string;
  inspectionTypeNameEn: string;
  inspectionTypeNameAr?: string;
  inspectionReasonId?: number | string;
  inspectionReasonCode?: string;
  inspectionReasonNameEn?: string;
  inspectionReasonNameAr?: string;
  isDigitalVisit?: boolean;
  priorityId?: number;
  priorityCode?: string;
  priorityNameEn?: string;
  priorityNameAr?: string;
  dueDate?: string;
  slaMinutes?: number;
};

export type InspectionSlaSummary = {
  isVisible?: boolean;
  statusCode?: string;
  color?: string;
  displayText?: string;
  dueOn?: string;
  completedOn?: string | null;
};

export type InspectionAssignedInspector = {
  inspectorId: string;
  inspectorName?: string;
  role?: string;
};

export type InspectionAssignment = {
  isAssigned: boolean;
  assignedInspector?: string;
  assignedInspectors?: InspectionAssignedInspector[] | string;
  assignmentReasonEn?: string;
  assignmentReasonAr?: string;
  assignedAt?: string;
};

export type InspectionTaskAttachmentPayload = {
  fileName: string;
  fileUrl: string;
  contentType?: string;
  attachmentCategory?: string;
  relatedEntityType?: string;
};

export type InspectionTaskTimelineTone =
  | "active"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type InspectionTaskTimelineItem = {
  id: string | number;
  eventType: string;
  eventCode?: string;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  label?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  fromStatusId?: number;
  toStatusId?: number;
  operatorRoleId?: number;
  operatorName?: string;
  actor?: string;
  actualActorName?: string;
  pendingHandlerName?: string;
  currentOwnerTypeCode?: string;
  currentOwnerSummary?: string;
  displayActorSource?: string;
  createdOn?: string;
  time?: string;
  displayTitle?: string;
  displayActor?: string;
  displayTime?: string;
  displayDetails?: string;
  displayLocation?: string;
  displayStatusCode?: string;
  isCurrentStatusEvent?: boolean;
  attachments?: InspectionTaskAttachmentPayload[];
  result?: string;
  resultCode?: string;
  resultTone?: InspectionTaskTimelineTone;
  durationLabel?: string;
  metadata?: Record<string, unknown>;
};

export type InspectionTaskSummary = {
  taskId: number;
  taskNo: string;
  reinspectionNo?: string;
  taskName?: string;
  status?: InspectionTaskStatus;
  statusId?: number | string;
  statusCode?: string;
  statusName?: string;
  taskStatusId?: number | string;
  taskStatusCode?: string;
  currentStepId?: number | string;
  currentStepCode?: string;
  currentStepKey?: string;
  currentStep?: string;
  executionState?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  taskSource: InspectionTaskSource;
  inspectionTarget: InspectionTarget;
  inspectionReasonId?: number;
  inspectionReasonName?: string;
  accessOutcomeCode?: string;
  accessOutcomeName?: string;
  accessFailedReasonCode?: string;
  accessFailedReasonName?: string;
  accessFailedRemark?: string;
  accessFailedAttachments?: InspectionTaskAttachmentPayload[];
  riskProfile: InspectionRiskProfile;
  inspectionConfig: InspectionConfig;
  assignment: InspectionAssignment;
  createdBy?: string;
  createdByName?: string;
  createdOn?: string;
  assignedOn?: string;
  sla?: InspectionSlaSummary;
  slaDeadlineAt?: string;
  cancelView?: boolean;
  createdAt?: string;
  lastUpdatedOn?: string;
  updatedAt?: string;
};

export type InspectionTaskTargetOverview = {
  violationCount?: number | string | null;
  unpayCount?: number | string | null;
  [key: string]: unknown;
};

export type InspectionTaskDetail = InspectionTaskSummary & {
  description?: string;
  taskSourceRemark?: string;
  tabs?: string[];
  aiRiskInsight?: string;
  draftUpdatedAt?: string;
  smartChecklistSnapshot?: SmartChecklistData;
  report?: Record<string, unknown>;
  reportPreview?: InspectionReportPreview;
  targetOverview?: InspectionTaskTargetOverview;
  attachments?: InspectionTaskAttachmentPayload[];
  timeline?: InspectionTaskTimelineItem[];
  violations?: InspectionCreatedViolationSummary[];
  lastSuccessfulInspection?: Record<string, unknown>;
  lastInspection?: Record<string, unknown>;
  lastCompletedInspection?: Record<string, unknown>;
  previousSuccessfulInspection?: Record<string, unknown>;
  previousInspection?: Record<string, unknown>;
  inspectionHistory?: Array<Record<string, unknown>>;
  reinspectionTask?: Record<string, unknown>;
  linkedReinspectionTask?: Record<string, unknown>;
  relatedReinspectionTask?: Record<string, unknown>;
};

export type InspectionTaskListFilters = {
  statuses?: InspectionTaskStatus[];
  statusIds?: Array<number | string>;
  riskLevels?: InspectionRiskLevel[];
  inspectionReasonId?: number | string;
  inspectionReasonNames?: string[];
  emirates?: Array<number | string>;
  authorityIds?: Array<number | string>;
  authorityNames?: string[];
  areaIds?: Array<number | string>;
  inspectionMethodIds?: Array<number | string>;
  inspectionMethods?: string[];
  createdBy?: string;
  createdByTypes?: InspectionTaskSourceType[];
  taskSourceTypes?: InspectionTaskSourceType[];
  priorityIds?: Array<number | string>;
  inspectorIds?: string[];
  establishmentIds?: number[];
  individualIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  assignedOnly?: boolean;
};

export type InspectionAssignmentRules = {
  preferredInspectorIds?: string[];
};

export type GenerateAndAssignInspectionTasksParams = {
  pageSize: number;
  filters?: InspectionTaskListFilters;
  assignmentRules?: InspectionAssignmentRules;
  campaignConfig?: {
    emirateNameEn?: string;
    authorityNameEn?: string;
    activityNames?: string[];
    priorityNameEn?: string;
    dueDate?: string;
    description?: string;
    attachments?: InspectionTaskAttachmentPayload[];
  };
};

export type GenerateAndAssignInspectionTasksData = {
  totalCount: number;
  generatedCount: number;
  assignedCount: number;
  assignmentSummary?: {
    assignedInspectorCount: number;
    unassignedCount: number;
  };
  taskList: InspectionTaskSummary[];
};

export type InspectionTaskBatchByActivityItem = {
  taskId?: number | string;
  taskNo?: string;
  establishmentId?: number | string;
  establishmentName?: string;
  tradeLicenseNumber?: string;
  emirateId?: number | string;
};

export type InspectionTaskBatchByActivityData = {
  activityId?: number | string;
  activityIds?: Array<number | string>;
  executionMode?: "Sync" | "Async";
  batchId?: string;
  queuedCount?: number;
  matchedEstablishmentCount: number;
  openTaskEstablishmentCount: number;
  createdCount: number;
  matchedEstablishmentIds?: Array<number | string>;
  /** @deprecated Campaign creation no longer skips open tasks. */
  skippedExistingTaskCount?: number;
  skippedEstablishmentIds?: Array<number | string>;
  items: InspectionTaskBatchByActivityItem[];
};

export type InspectionTaskBatchByActivityProgressData = {
  batchId: string;
  status: "Pending" | "Running" | "Completed" | "Failed";
  total: number;
  created: number;
  failed: number;
  matchedEstablishmentCount: number;
  skippedExistingTaskCount?: number;
  lastError?: string | null;
  requestedByUserName?: string | null;
  createdOn?: string;
  startedOn?: string | null;
  finishedOn?: string | null;
};

export type InspectionTaskBatchByActivityPreviewData = {
  activityIds?: Array<number | string>;
  matchedEstablishmentCount: number;
  openTaskEstablishmentCount: number;
  recentInspectionTaskCount: number;
  /** @deprecated Campaign creation no longer skips open tasks. */
  skippedExistingTaskCount?: number;
  willCreateCount: number;
  byEmirate: Array<{
    id: number;
    nameEn: string;
    nameAr?: string;
    count: number;
  }>;
  executionMode: "Sync" | "Async";
  syncThreshold: number;
};

export type InspectionTaskBatchByActivityInspectorPayload = {
  inspectorId: string;
  inspectorName?: string;
  isPrimary?: boolean;
};

export type InspectionTaskBatchByActivityPayload = {
  establishmentTypeId: 2;
  activityIds: Array<number | string>;
  targetTypeId: number;
  sourceTypeId: number;
  inspectionMethodId: number;
  inspectionReasonId: number | string;
  priorityId: number | string;
  emirateIds: Array<number | string>;
  regionIds: Array<number | string>;
  areaIds: Array<number | string>;
  dueDate: string;
  remarks?: string;
  inspectors: InspectionTaskBatchByActivityInspectorPayload[];
  attachments: InspectionTaskAttachmentPayload[];
};

export type GetInspectionTaskListParams = {
  role?: string;
  inspectorId?: string;
  view?: string;
  tab?: string;
  keyword?: string;
  pageIndex?: number;
  pageSize?: number;
  filters?: InspectionTaskListFilters;
  sortBy?: "DueDate" | "CreatedOn" | "AssignedOn" | "LastUpdatedOn" | "Priority" | "SLA";
  sortDirection?: "asc" | "desc";
};

export type InspectionProfileTaskSortField =
  | "TaskNo"
  | "DueDate"
  | "AssignedOn"
  | "CreatedOn";

export type InspectionProfileTaskListParams = {
  userId?: string;
  profileId?: number;
  statusId?: number;
  search?: string;
  inspectionReasonId?: number | string;
  priorityId?: number;
  dueDateFrom?: string;
  dueDateTo?: string;
  assignedTimeFrom?: string;
  assignedTimeTo?: string;
  assignedInspectorId?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: InspectionProfileTaskSortField;
  sortDirection?: "asc" | "desc";
};

export type InspectionProfileTaskSla = {
  isVisible?: boolean | null;
  statusCode?: string | null;
  color?: string | null;
  displayText?: string | null;
  dueOn?: string | null;
  completedOn?: string | null;
};

export type InspectionProfileTaskItem = {
  id?: number | string | null;
  taskNo?: string | null;
  targetTypeId?: number | null;
  targetTypeCode?: string | null;
  targetTypeName?: string | null;
  targetName?: string | null;
  inspectionMethodId?: number | null;
  inspectionMethodCode?: string | null;
  inspectionMethodName?: string | null;
  statusId?: number | null;
  statusCode?: string | null;
  statusName?: string | null;
  activityName?: string | null;
  establishmentName?: string | null;
  fullName?: string | null;
  inspectionReasonName?: string | null;
  emirateName?: string | null;
  authorityName?: string | null;
  priorityName?: string | null;
  dueDate?: string | null;
  assignedOn?: string | null;
  sla?: InspectionProfileTaskSla | null;
  slaDeadlineAt?: string | null;
  createdOn?: string | null;
  lastUpdatedOn?: string | null;
  createdByName?: string | null;
  inspectorName?: string | null;
  assignmentState?: string | null;
  scopeCode?: string | null;
  countsTowardInspectionInterval?: boolean | null;
  cancelView?: boolean | null;
  isMock?: boolean | null;
};

export type InspectionProfileTaskStatusStat = {
  statusId?: number | null;
  statusCode?: string | null;
  statusName?: string | null;
  count?: number | null;
};

export type InspectionProfileTaskListResponse = {
  items?: InspectionProfileTaskItem[] | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
  statuses?: InspectionProfileTaskStatusStat[] | null;
};

export type InspectionTaskListData = {
  items: InspectionTaskSummary[];
  total: number;
  pageIndex: number;
  pageSize: number;
  summary?: {
    draftCount?: number;
    queuedCount?: number;
    pendingAssignmentCount?: number;
    assignedCount?: number;
    pendingVisitCount?: number;
    inProgressCount?: number;
    accessFailedCount?: number;
    submittedCount?: number;
    completedCount?: number;
    cancelledCount?: number;
  };
};

export type GetInspectionTaskDetailParams = {
  taskId?: number | string;
  taskNo?: string;
};

export type InspectionTaskDetailFragmentKey =
  | "targetOverview"
  | "report"
  | "executionResult"
  | "timeline"
  | "review"
  | "lastInspection"
  | "reinspectionTask";

export type GetInspectionTaskDetailOptions = {
  includeFragments?: readonly InspectionTaskDetailFragmentKey[];
};

export type InspectionExecutionStepKey =
  | "targetAccess"
  | "checklist"
  | "seizedMaterials"
  | "review";

export type InspectionExecutionStepCode =
  | "PreVisitChecklist"
  | "TargetAccess"
  | "Checkin"
  | "Checklist"
  | "SeizedMaterials"
  | "ContactPerson"
  | "declarationAcknowledgement"
  | "Reinspection"
  | "ReviewAndSubmit"
  | "CheckOut"
  | "AccessFailed";

export const INSPECTION_EXECUTION_STEP_CODES: Record<InspectionExecutionStepKey, InspectionExecutionStepCode> = {
  targetAccess: "TargetAccess",
  checklist: "Checklist",
  seizedMaterials: "SeizedMaterials",
  review: "ReviewAndSubmit",
};

export const INSPECTION_EXECUTION_STEP_IDS: Record<InspectionExecutionStepCode, number> = {
  PreVisitChecklist: 10,
  TargetAccess: 20,
  Checkin: 30,
  Checklist: 40,
  SeizedMaterials: 50,
  ContactPerson: 60,
  declarationAcknowledgement: 70,
  Reinspection: 80,
  ReviewAndSubmit: 90,
  CheckOut: 100,
  AccessFailed: 110,
};

export type InspectionTaskExecutionStatus = {
  taskId?: number | string;
  taskNo?: string;
  status: InspectionTaskStatus | string;
  currentStep: InspectionExecutionStepKey;
  currentStepRaw?: string;
  currentStepId?: number;
  taskStatusCode?: string;
  accessOutcomeCode?: string | null;
  checkinAt?: string | null;
  checkoutAt?: string | null;
};

export type SmartChecklistViolation = {
  violationId: number;
  violationCode: string;
  violationName: string;
  severity: InspectionRiskLevel | string;
  penaltyBasis?: string;
};

export type SmartChecklistItem = {
  itemId: string;
  itemOrder: number;
  descriptionEn: string;
  descriptionAr?: string;
  result?: "PASS" | "FAIL" | "NA";
  comment?: string;
  relatedViolations: SmartChecklistViolation[];
};

export type SmartChecklistCategory = {
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  isRequired: boolean;
  riskTriggered?: boolean;
  triggerReason?: string;
  samplingRatio?: number;
  checkItems: SmartChecklistItem[];
};

export type SmartChecklistData = {
  riskProfile: InspectionRiskProfile;
  checklistCategories: SmartChecklistCategory[];
  explanation: {
    matchLogic: string;
    keyFactors: string[];
    recommendedFocus: string;
  };
};

export type InspectionExecutionDraftPayload = {
  taskId?: number | string;
  taskNo?: string;
  visitId?: number | null;
  establishmentId?: number;
  checklistCategories: SmartChecklistCategory[];
  summary?: {
    overallComment?: string;
    recommendedAction?: string;
    [key: string]: unknown;
  };
};

export type SaveInspectionExecutionDraftData = {
  taskId: number;
  savedAt: string;
  version: number;
};

export type SubmitInspectionReportPayload = {
  taskId?: number | string;
  taskNo?: string;
  visitId?: number | null;
  checklistCategories: SmartChecklistCategory[];
  reportSummary: {
    overallComment?: string;
    recommendedAction?: string;
    result?: string;
    [key: string]: unknown;
  };
};

export type SubmitInspectionReportData = {
  taskId: number;
  reportId?: string;
  submittedAt?: string;
  status?: "COMPLETED" | "ACCESS_FAILED" | "SUBMITTED";
  submitted?: boolean;
  hasViolation?: boolean;
  createdViolations?: InspectionCreatedViolationSummary[];
};

export type InspectionChecklistResultOption = {
  id: number;
  code: "Compliant" | "Violation" | "NotApplicable" | string;
  name: string;
};

export type InspectionChecklistTemplateViolationItem = {
  id?: number;
  violationItemId?: number;
  code?: string;
  violationItemCode?: string;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  violationTypeId?: number;
  violationTypeCode?: string;
  nameEn?: string;
  nameAr?: string;
  name?: string;
  fineDay1To30?: number;
  fineDay31To90?: number;
  fineMax?: number;
  isActive?: boolean;
  displayOrder?: number;
};

export type InspectionChecklistTemplateItem = {
  id: number;
  checklistCode: string;
  violationDescription?: string;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  checklistName?: string;
  violationItemId?: number;
  violationItemCode?: string;
  violationTypeId?: number;
  violationTypeCode?: string;
  displayOrder?: number;
  isVisibleInChecklist?: boolean;
  isActive?: boolean;
  requiredWhenViolation?: boolean;
  isSystemTriggered?: boolean;
  applicableTemplateTypes?: string[];
  mappedViolationCodes?: string[];
  mappedViolationItems?: InspectionChecklistTemplateViolationItem[];
  resultOptions?: InspectionChecklistResultOption[];
  savedResult?: number | string | null;
  savedNotes?: string | null;
  savedSelectedViolationItemIds?: Array<number | string>;
  attachments?: InspectionTaskAttachmentPayload[];
};

export type InspectionChecklistTemplateData = {
  taskId: number;
  contentType?: string;
  targetTypeId?: number;
  inspectionMethodId?: number;
  templateType?: string;
  templateSource?: string;
  items: InspectionChecklistTemplateItem[];
};

export type SaveInspectionChecklistPayload = {
  taskId: number | string;
  taskNo?: string;
  items: Array<{
    checklistCode: string;
    checklistName?: string;
    resultId: number;
    notes?: string;
    displayOrder?: number;
    attachments?: InspectionTaskAttachmentPayload[];
    selectedViolations?: Array<{
      violationItemId: number;
      violationItemCode: string;
      violationTypeId: number;
      violationDescription?: string;
      violationDescriptionEn?: string | null;
      violationDescriptionAr?: string | null;
    }>;
  }>;
};

export type StartInspectionVisitPayload = {
  taskId: number | string;
  taskNo?: string;
  reviewTaskDetailConfirmed: boolean;
  reviewInspectionTargetDetailsConfirmed: boolean;
  ensureToolsReadyConfirmed: boolean;
};

export type CheckinInspectionTaskPayload = {
  taskId: number | string;
  taskNo?: string;
  checkInAt?: string;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAddress?: string | null;
};

export type AccessFailedInspectionTaskPayload = {
  taskId: number | string;
  taskNo?: string;
  accessOutcomeCode: "UnableToAccess";
  accessFailedReasonCode: string;
  accessFailedRemark?: string;
  attachments?: InspectionTaskAttachmentPayload[];
  submittedAt?: string;
};

export type SaveInspectionSeizedMaterialsPayload = {
  taskId: number | string;
  taskNo?: string;
  items: Array<Record<string, unknown>>;
};

export type SaveInspectionContactPersonPayload = {
  taskId: number | string;
  taskNo?: string;
  personId?: number;
  sourceType?: 1 | 2;
  fullName: string;
  position: string;
  mobile: string;
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  email: string;
  emiratesId?: string;
  collectedChannelCode?: "OnSite" | "Email" | string | null;
  submittedOn?: string;
  eidAttachmentFileName?: string;
  eidAttachmentFileUrl?: string;
  declarationAcknowledged?: boolean;
  hasSignedDeclaration?: boolean;
  declarationDeclinedReason?: string | null;
  signatureImageFileName?: string | null;
  signatureImageFileUrl?: string | null;
  signatureSignedOn?: string | null;
};

export type InspectionContactPersonOption = {
  personId: number;
  name: string | null;
  sourceType: 1 | 2;
  position: string | null;
  mobile: string | null;
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  email: string | null;
  emiratesId: string | null;
  collectedChannelCode: string | null;
  eidAttachmentFileName: string | null;
  eidAttachmentFileUrl: string | null;
};

const INSPECTION_CONTACT_PERSONS_EXPECTED_RESPONSE =
  "ApiResponse<Array<{ personId: number; name: string | null; sourceType: 1 | 2; position: string | null; mobile: string | null; mobileCountryCode?: string | null; mobileLocalNumber?: string | null; email: string | null; emiratesId: string | null; collectedChannelCode: string | null; eidAttachmentFileName: string | null; eidAttachmentFileUrl: string | null }>>";

const INSPECTION_CONTACT_PERSON_OPTION_KEYS = [
  "personId",
  "name",
  "sourceType",
  "position",
  "mobile",
  "email",
  "emiratesId",
  "collectedChannelCode",
  "eidAttachmentFileName",
  "eidAttachmentFileUrl",
] as const;

const isInspectionContactPersonRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

const isOptionalNullableString = (
  value: unknown,
): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

const hasInspectionContactPersonOptionKeys = (
  value: Record<string, unknown>,
) => INSPECTION_CONTACT_PERSON_OPTION_KEYS.every((key) =>
  Object.prototype.hasOwnProperty.call(value, key),
);

const isInspectionContactPersonOption = (
  value: unknown,
): value is InspectionContactPersonOption => {
  if (!isInspectionContactPersonRecord(value)) return false;
  if (!hasInspectionContactPersonOptionKeys(value)) return false;
  return (
    typeof value.personId === "number" &&
    (value.sourceType === 1 || value.sourceType === 2) &&
    isNullableString(value.name) &&
    isNullableString(value.position) &&
    isNullableString(value.mobile) &&
    isOptionalNullableString(value.mobileCountryCode) &&
    isOptionalNullableString(value.mobileLocalNumber) &&
    isNullableString(value.email) &&
    isNullableString(value.emiratesId) &&
    isNullableString(value.collectedChannelCode) &&
    isNullableString(value.eidAttachmentFileName) &&
    isNullableString(value.eidAttachmentFileUrl)
  );
};

const isInspectionContactPersonsResponse = (
  value: unknown,
): value is ApiResponse<InspectionContactPersonOption[]> => {
  if (!isInspectionContactPersonRecord(value)) return false;
  return (
    Array.isArray(value.data) &&
    value.data.every(isInspectionContactPersonOption) &&
    typeof value.isSuccess === "boolean" &&
    typeof value.statusCode === "number" &&
    typeof value.message === "string"
  );
};

const logInspectionContactPersonsApiError = (
  endpoint: string,
  error: unknown,
) => {
  const requestError = error as {
    message?: string;
    response?: {
      status?: number;
      data?: unknown;
    };
  };
  console.error("Inspection contact persons API failed", {
    endpoint,
    expectedResponse: INSPECTION_CONTACT_PERSONS_EXPECTED_RESPONSE,
    status: requestError.response?.status,
    response: requestError.response?.data,
    message: requestError.message,
  });
};

const logInspectionContactPersonsInvalidResponse = (
  endpoint: string,
  response: unknown,
) => {
  console.error("Inspection contact persons API returned invalid response", {
    endpoint,
    expectedResponse: INSPECTION_CONTACT_PERSONS_EXPECTED_RESPONSE,
    response,
  });
};

export type SaveInspectionContactPersonDeclarationPayload = {
  taskId: number | string;
  taskNo?: string;
  declarationAcknowledged?: boolean;
  hasSignedDeclaration?: boolean;
  declarationDeclinedReason?: string | null;
  signatureImageFileName?: string | null;
  signatureImageFileUrl?: string | null;
  declarationDocumentFileName?: string | null;
  declarationDocumentFileUrl?: string | null;
};

export type InspectionDeclarationTemplateData = {
  fileName?: string | null;
  fileUrl?: string | null;
  templateFileName?: string | null;
  templateFileUrl?: string | null;
  declarationDocumentFileName?: string | null;
  declarationDocumentFileUrl?: string | null;
};

export type SaveInspectionReinspectionPayload = {
  taskId: number | string;
  taskNo?: string;
  needsReinspection: boolean;
  reinspectionDueDate?: string | null;
  reinspectionNote?: string | null;
};

export type SubmitInspectionTaskReportPayload = {
  taskId: number | string;
  taskNo?: string;
  hasViolationFound: boolean;
  needsReinspection: boolean;
  reinspectionDueDate?: string | null;
  reinspectionNote?: string | null;
  reviewNote?: string;
  reportFileUrl?: string;
  reportFileName?: string;
  reportSubmittedAt?: string;
  checklistCategories?: SmartChecklistCategory[];
  result?: "COMPLETED" | "ACCESS_FAILED" | string;
  reportSummary?: Record<string, unknown>;
};

export type CheckoutInspectionTaskPayload = {
  taskId: number | string;
  taskNo?: string;
  checkOutAt?: string;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutAddress?: string | null;
};

export type InspectionExecutionStateData = {
  taskId: number;
  currentStepId?: number;
  currentStepCode?: string;
  taskStatusId?: number;
  taskStatusCode?: string;
  accessOutcomeCode?: string | null;
  accessFailedReasonCode?: string | null;
  hasViolationFound?: boolean | null;
  needsReinspection?: boolean | null;
  reportSubmittedAt?: string | null;
  checkinAt?: string | null;
  checkoutAt?: string | null;
  countsTowardInspectionInterval?: boolean;
  [key: string]: unknown;
};

export type GetInspectionReportPreviewParams = {
  taskId?: number | string;
  taskNo?: string;
  reportId?: string;
  reportNo?: string;
};

export type InspectionReportPdfFile = {
  fileName: string;
  fileUrl: string;
};

export type InspectionReportPreview = {
  reportId: string;
  taskId: number;
  taskNo: string;
  generatedAt: string;
  reportSummary: {
    overallComment?: string;
    recommendedAction?: string;
    result?: string;
    accessResult?: string;
    accessReason?: string;
    accessRemark?: string;
    accessAttachments?: Array<Record<string, unknown>>;
    contactPerson?: Record<string, unknown>;
    declarationDocument?: Record<string, unknown>;
    declarationDocuments?: Array<Record<string, unknown>>;
    seizedMaterials?: Array<Record<string, unknown>>;
    createdViolations?: InspectionCreatedViolationSummary[];
    reinspectionTask?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  checklistCategories: SmartChecklistCategory[];
};

export type InspectionViolationItem = {
  id?: string | number;
  violationId?: string;
  violationNo?: string;
  violationCode?: string;
  title?: string;
  violationName?: string;
  violationDescription?: string;
  violationDescriptionEn?: string;
  violationDescriptionAr?: string;
  violationType?: string;
  violationTypeId?: number;
  violationTypeCode?: string;
  violationTypeName?: string;
  reason?: string;
  level?: string;
  severity?: string;
  severityNameEn?: string;
  status?: InspectionViolationStatus | string;
  statusCode?: string;
  statusName?: string;
  internalStatusCode?: string;
  internalStatusName?: string;
  businessStatusCode?: string;
  businessStatusName?: string;
  description?: string;
  location?: string;
  inspectionDate?: string;
  issuedTime?: string;
  createdOn?: string;
  createdAt?: string;
  createdAtLabel?: string;
  paidTime?: string;
  lastUpdatedOn?: string;
  updatedAt?: string;
  taskId?: number;
  taskNo?: string;
  sourceTaskId?: number;
  sourceTaskNo?: string;
  sourceTask?: string;
  establishmentId?: number;
  individualId?: number;
  establishmentNameEn?: string;
  violatorName?: string;
  violatorIdentifier?: string;
  categoryName?: string;
  penaltyBasis?: string;
  assignedInspector?: string;
  reportedBy?: string;
  reportedByName?: string;
  workflowOwner?: string;
  fineAmount?: number;
  sla?: InspectionSlaSummary;
  slaLabel?: string;
  slaDeadlineAt?: string;
  isAutoGenerated?: boolean;
  availableActions?: string[];
  violationReportUrl?: string | null;
  inspectionTarget?: InspectionTarget;
};

export type ViolationListParams = {
  role?: string;
  view?: string;
  tab?: string;
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
  sortBy?: "ViolationNo" | "StatusId" | "SlaDeadlineAt" | "CreatedOn" | "LastUpdatedOn";
  sortDirection?: "asc" | "desc";
  filters?: {
    statusList?: string[];
    typeList?: string[];
    severityList?: string[];
    taskIds?: number[];
    establishmentIds?: number[];
    reportBy?: string;
    violationReasonList?: string[];
    issuedTimeFrom?: string;
    issuedTimeTo?: string;
    createdOnFrom?: string;
    createdOnTo?: string;
  };
};

export type ViolationSummaryMap = Partial<Record<InspectionViolationStatus | string, number>>;

export type ViolationListData = {
  items: InspectionViolationItem[];
  total: number;
  pageIndex: number;
  pageSize: number;
  summary?: ViolationSummaryMap;
  filterOptions?: {
    reportedBy?: string[];
    violationReason?: string[];
  };
};

export type ViolationListResponse = ApiResponse<ViolationListData>;

export type ViolationStatsResponse = ApiResponse<ViolationSummaryMap>;

export type InspectionTargetTaskListStatus = {
  statusId?: number;
  statusCode?: string;
  statusName?: string;
  count?: number;
};

export type InspectionTargetTaskListParams = {
  establishmentId?: number | string;
  individualId?: number | string;
  taskId?: number | string;
  scope?: string;
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "DueDate" | "CreatedOn" | "Priority" | "SLA";
  sortDirection?: "asc" | "desc";
};

export type InspectionTargetTaskListData = {
  items: InspectionTaskSummary[];
  statuses?: InspectionTargetTaskListStatus[];
  total: number;
  pageIndex: number;
  pageSize: number;
};

export type ViolationDetailParams = {
  id?: string;
  violationId?: string;
  violationNo?: string;
};

export type InspectionViolationDetailAttachment = {
  key?: string | number;
  name: string;
  url?: string;
  type?: string;
};

export type InspectionViolationRawAttachment = Partial<InspectionViolationDetailAttachment> & {
  id?: string | number;
  attachmentId?: string | number;
  fileName?: string;
  fileUrl?: string;
  attachmentFileName?: string;
  attachmentFileUrl?: string;
  originalName?: string;
  title?: string;
  thumbUrl?: string;
  fileType?: string;
  contentType?: string;
  [key: string]: unknown;
};

export type InspectionViolationReportedItem = {
  key: string;
  title: string;
  status?: string;
  statusLabel?: string;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  attachments?: InspectionViolationDetailAttachment[];
  notes?: string;
  violationItemId?: string | number | null;
  legacyViolationItemId?: string | number | null;
  violationItemCode?: string | null;
  checklistCode?: string | null;
};

export type InspectionViolationChecklistViolation = Partial<Omit<InspectionViolationReportedItem, "attachments">> & {
  id?: string | number;
  checklistViolationId?: string | number | null;
  checklistItemId?: string | number | null;
  sourceChecklistItemId?: string | number | null;
  checklistTemplateItemId?: string | number | null;
  taskChecklistItemId?: string | number | null;
  violationChecklistItemId?: string | number | null;
  checklistItemCode?: string | null;
  violationCode?: string | null;
  code?: string | null;
  displayOrder?: number | string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  checklistName?: string | null;
  checklistNameEn?: string | null;
  checklistNameAr?: string | null;
  checklistItemName?: string | null;
  checklistItemNameEn?: string | null;
  checklistItemNameAr?: string | null;
  violationItemName?: string | null;
  violationItemNameEn?: string | null;
  violationItemNameAr?: string | null;
  reason?: string | null;
  reasonEn?: string | null;
  reasonAr?: string | null;
  reasonName?: string | null;
  reasonNameEn?: string | null;
  reasonNameAr?: string | null;
  violationReason?: string | null;
  violationReasonEn?: string | null;
  violationReasonAr?: string | null;
  notes?: string | null;
  note?: string | null;
  remarks?: string | null;
  remark?: string | null;
  comments?: string | null;
  comment?: string | null;
  finding?: string | null;
  inspectionNotes?: string | null;
  reported?: boolean | null;
  appealResult?: number | null;
  appealResultCode?: string | null;
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  degree?: number | string | null;
  oldDegree?: number | string | null;
  newDegree?: number | string | null;
  committeeReview?: boolean | null;
  attachments?: InspectionViolationRawAttachment[];
  evidences?: InspectionViolationRawAttachment[];
  files?: InspectionViolationRawAttachment[];
  evidenceAttachments?: InspectionViolationRawAttachment[];
  [key: string]: unknown;
};

export type InspectionChecklistTemplateCatalogItem = {
  id?: string | number;
  checklistCode?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  checklistName?: string | null;
  checklistNameAr?: string | null;
  violationItemId?: string | number | null;
  legacyViolationItemId?: string | number | null;
  violationItemCode?: string | null;
  violationTypeId?: string | number | null;
  violationTypeCode?: string | null;
  displayOrder?: number | null;
  isVisibleInChecklist?: boolean | null;
  isActive?: boolean | null;
  isSystemTriggered?: boolean | null;
  requiredWhenViolation?: boolean | null;
  createdOn?: string | null;
  createdBy?: string | null;
  degree1FineAmount?: number | string | null;
  degree2FineAmount?: number | string | null;
  degree3FineAmount?: number | string | null;
  degree4FineAmount?: number | string | null;
  applicableTemplateTypes?: string[];
};

export type GetInspectionChecklistTemplateItemsParams = {
  violationTypeId?: string | number;
  includeInactive?: boolean;
};

export type InspectionViolationLookupItem = {
  id?: string | number | null;
  nameEn?: string | null;
  nameAr?: string | null;
};

export type GetInspectionViolationItemsParams = {
  violationTypeId?: string | number;
};

export type InspectionViolationContentPenaltyStandard = {
  penaltyStandardId?: string | number;
  violationItemId?: string | number | null;
  legacyViolationItemId?: string | number | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  degree1FineAmount?: number | string | null;
  degree2FineAmount?: number | string | null;
  degree3FineAmount?: number | string | null;
  degree4FineAmount?: number | string | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
};

export type InspectionViolationPenaltyStandard = {
  violationId?: string | number;
  violationNo?: string;
  violationTypeId?: string | number | null;
  violationTypeCode?: string | null;
  violationTypeName?: string | null;
  licensingStandards?: Array<Record<string, unknown>>;
  contentStandards?: InspectionViolationContentPenaltyStandard[];
};

export type DecideInspectionViolationItemPayload = {
  violationItemId?: string | number | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  decisionTypeId?: number;
  degree?: number;
  fineAmount: number;
  notes?: string;
  committeeNote?: string | null;
  attachments?: DecideInspectionViolationAttachmentPayload[] | null;
};

export type DecideInspectionViolationAttachmentPayload = Pick<
  InspectionTaskAttachmentPayload,
  "fileName" | "fileUrl" | "contentType"
>;

export type InspectionViolationContentReviewReport = {
  summary?: string;
  attachments?: InspectionViolationDetailAttachment[];
};

export type InspectionViolationCommitteeDecision = {
  decision?: string;
  outcome?: string;
  decisionBy?: string;
  decisionDate?: string;
  fineAmount?: number | string | null;
  notes?: string;
  reason?: string;
};

export type InspectionViolationPaymentDetails = {
  paymentStatus?: string;
  amount?: number | string | null;
  dueDate?: string;
  paidOn?: string;
  receiptNo?: string;
  attachments?: InspectionViolationDetailAttachment[];
};

export type InspectionViolationAppealDetails = {
  appealNo?: string;
  appealStatus?: string;
  submittedBy?: string;
  submittedOn?: string;
  reason?: string;
  oldFineAmount?: number | string | null;
  newFineAmount?: number | string | null;
  attachments?: InspectionViolationDetailAttachment[];
};

export type InspectionViolationFineDetailItem = {
  key?: string | number;
  violation?: string;
  violationName?: string;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  title?: string;
  reason?: string;
  severity?: string;
  severityNameEn?: string;
  degree?: string | number | null;
  offense?: string | number;
  offenseCount?: string | number;
  decision?: string;
  punishment?: string;
  fineAmount?: number | string | null;
  amount?: number | string | null;
  committeeReview?: boolean | null;
};

export type InspectionViolationFineDetails = {
  rows?: InspectionViolationFineDetailItem[];
  totalFineAmount?: number | string | null;
  originalFineAmount?: number | string | null;
  revisedFineAmount?: number | string | null;
  paymentStatus?: string;
  appealStatus?: string;
};

export type InspectionViolationOverviewField = {
  label: string;
  value: string;
  secondary?: string;
};

export type InspectionViolationOverviewPill = {
  key: string;
  label: string;
  count: number;
  icon?: "documents" | "partners";
  tone?: "default" | "warning" | "danger";
};

export type InspectionViolationOverview = {
  profileType?: string;
  statusLabel?: string;
  fields?: InspectionViolationOverviewField[];
  statistics?: InspectionViolationOverviewPill[];
  alerts?: InspectionViolationOverviewPill[];
};

export type InspectionViolationRelatedReinspection = {
  taskId?: number | string;
  taskNo?: string;
  status?: string;
  inspector?: string;
  dueDate?: string;
};

export type InspectionViolationRelatedAppeal = {
  appealId?: string | number | null;
  appealNo?: string;
  status?: string;
  submittedOn?: string;
  slaDueOn?: string;
  reason?: string;
};

export type InspectionViolationTimelineItem = {
  key?: string;
  id?: string | number;
  eventType?: string;
  rawEventType?: string;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  label?: string;
  displayTitle?: string;
  displayActor?: string;
  displayTime?: string;
  displayDetails?: string;
  displayStatusCode?: string;
  displayStatusName?: string;
  internalStatusCode?: string;
  internalStatusName?: string;
  isCurrentStatusEvent?: boolean;
  description?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  actor?: string;
  actorType?: "system" | "user" | "violator";
  operator?: string;
  operatorName?: string;
  operatorRoleId?: number | string | null;
  handlerUserId?: string | number | null;
  handlerUserName?: string;
  departmentId?: string | number | null;
  fromStatusId?: string | number | null;
  fromStatusName?: string;
  fromStatusCode?: string;
  toStatusId?: string | number | null;
  toStatusName?: string;
  toStatusCode?: string;
  result?: string;
  time?: string;
  createdOn?: string;
  actionAt?: string;
  remark?: string;
  remarks?: string;
  note?: string;
  notes?: string;
  fineAmount?: number | string | null;
  paymentStatus?: string;
  appealReason?: string;
  cancellationReason?: string;
  attachments?: InspectionViolationDetailAttachment[];
  metadata?: Record<string, unknown>;
};

export type ViolationDetailData = InspectionViolationItem & {
  taskSource?: InspectionTaskSource;
  inspectionTarget?: InspectionTarget;
  targetOverview?: InspectionTaskTargetOverview;
  riskProfile?: InspectionRiskProfile;
  inspectionConfig?: InspectionConfig;
  assignment?: InspectionAssignment;
  timeline?: InspectionViolationTimelineItem[];
  reportedViolations?: InspectionViolationReportedItem[];
  checklistViolations?: InspectionViolationChecklistViolation[];
  taskChecklistViolations?: InspectionViolationChecklistViolation[];
  reportedItems?: InspectionViolationChecklistViolation[];
  reasons?: InspectionViolationChecklistViolation[];
  contentReviewReportUrl?: string | null;
  contentReviewSummary?: string | null;
  contentReviewNote?: string | null;
  contentReviewReport?: InspectionViolationContentReviewReport | null;
  committeeDecisionTypeId?: number | string | null;
  committeeDecisionTypeCode?: string | null;
  committeeDecisionTypeName?: string | null;
  committeeDecisionTypeNameAr?: string | null;
  committeeDecision?: InspectionViolationCommitteeDecision | null;
  paymentDetails?: InspectionViolationPaymentDetails | null;
  appealDetails?: InspectionViolationAppealDetails | null;
  appealApproval?: boolean | null;
  appealDecisionNote?: string | null;
  appealDecidedByName?: string | null;
  appealDecisionTypeId?: number | string | null;
  appealDecisionTypeName?: string | null;
  appealDecisionTypeNameAr?: string | null;
  appealDecisionTypeCode?: string | null;
  fineDetails?: InspectionViolationFineDetails | InspectionViolationFineDetailItem[] | null;
  reinspectionTasks?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  violatorOverview?: InspectionViolationOverview;
  relatedAppeal?: InspectionViolationRelatedAppeal | null;
  relatedReinspection?: InspectionViolationRelatedReinspection | null;
  violationTimeline?: InspectionViolationTimelineItem[];
};

export type ViolationDetailResponse = ApiResponse<ViolationDetailData | null>;

export type ApproveInspectionViolationResult =
  | ViolationDetailData
  | { approved?: boolean }
  | null;

export type UpdateInspectionViolationStatusPayload = {
  violationId: string;
  status: InspectionViolationStatus;
  remark?: string;
  action?: string;
  committeeDecisionTypeId?: number;
  committeeDecisionNote?: string | null;
  items?: DecideInspectionViolationItemPayload[];
  contentReviewReport?: InspectionViolationContentReviewReport | null;
};

export type InspectionViolationRouteTargetCode = "Content" | "Committee";

export type RouteInspectionViolationPayload = {
  violationId: string;
  routeTargetCode: InspectionViolationRouteTargetCode;
  assignedContentId?: string;
  latestTransferNote?: string;
};

export type InspectionOcrPublicationType =
  | "BOOK"
  | "NEWSPAPER_MAGAZINE"
  | "MOVIE"
  | "GAME"
  | "OTHER";

export type InspectionOcrMaterialType =
  | "BOOK"
  | "ART_PUBLICATION"
  | "DOCUMENT"
  | "CD"
  | "OTHER";

export type InspectionOcrScanSubType =
  | InspectionOcrPublicationType
  | InspectionOcrMaterialType;

/** 1 = Publication, 2 = Material */
export type InspectionOcrScanTypeId = 1 | 2;

/** 1 = Pending, 2 = Success, 3 = Failed */
export type InspectionOcrStatusId = 1 | 2 | 3;

/** 1 = Compliant, 2 = Violation, 3 = NotApplicable */
export type InspectionOcrComplianceStatusId = 1 | 2 | 3;

export type InspectionOcrMatchStatusCode = "matched" | "not_matched" | "pending";


export type InspectionOcrMatchStatus =
  | "Approved"
  | "Rejected"
  | "Pending"
  | "APPROVED"
  | "REJECTED"
  | "PENDING"
  | string;

export type InspectionOcrMatch = {
  id?: string;
  title?: string;
  name?: string;
  author?: string;
  editor?: string;
  publisher?: string;
  director?: string;
  writer?: string;
  isbn?: string;
  barcode?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  status?: InspectionOcrMatchStatus;
  type?: string;
  periodicalType?: string;
  category?: string;
  language?: string;
  source?: string;
  printYear?: string | number;
  subjectCategory?: string;
  subCategory?: string;
  versionNumber?: string | number;
  nationalDepositoryNumber?: string;
  numberOfCopies?: string | number;
  platform?: string;
  copywritingType?: string;
  ageRating?: string;
  applicationNo?: string;
  serviceName?: string;
  lastUpdateTime?: string;
  contentId?: number;
  contentType?: string;
  mediaType?: string;
  publishingHouse?: string;
  chiefEditor?: string;
  notes?: string;
  attachmentsUrl?: string;
  [key: string]: unknown;
};


export type InspectionOcrResult = {
  ocrId: string;
  scanId?: number;
  scanType?: InspectionOcrScanTypeId;
  publicationType: InspectionOcrScanSubType;
  publicationTypeCode?: string;
  title?: string;
  titleAr?: string;
  author?: string;
  editor?: string;
  chiefEditor?: string;
  publisher?: string;
  publishingHouse?: string;
  director?: string;
  writer?: string;
  name?: string;
  isbn?: string;
  barcode?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  language?: string;
  quantity?: string;
  databaseMatch?: string;
  matchStatus?: "MATCHED" | "UNMATCHED";
  matchStatusCode?: InspectionOcrMatchStatusCode;
  ocrStatusId?: InspectionOcrStatusId;
  ocrStatus?: string;
  complianceStatusId?: InspectionOcrComplianceStatusId;
  enterpriseName?: string;
  totalCount?: number;
  autoExpand?: boolean;
  createdOn?: string;
  completedOn?: string;
  publicationTypeId?: number;
  matches?: InspectionOcrMatch[];
};

export type InspectionOcrFlow = "checklist" | "seizedMaterials";

export type InspectionOcrScanPayload = {
  taskId?: number | string;
  taskNo?: string;
  scanType?: InspectionOcrScanTypeId;
  flow?: InspectionOcrFlow;
  publicationType: InspectionOcrScanSubType;
  publicationTypeId?: number | string;
  imageFile?: string;
};

export type InspectionOcrEditPayload = {
  title?: string;
  author?: string;
  isbn?: string;
  language?: string;
  chiefEditor?: string;
  publishingHouse?: string;
  director?: string;
  writer?: string;
};

export type InspectionOcrEditResult = InspectionOcrEditPayload & {
  name?: string;
};


export type InspectionTaskUpsertPayload = {
  taskId?: number;
  taskName?: string;
  taskSource: InspectionTaskSource;
  inspectionTarget: InspectionTarget;
  riskProfile: InspectionRiskProfile;
  inspectionConfig: InspectionConfig;
  assignment?: InspectionAssignment;
  description?: string;
  attachments?: InspectionTaskAttachmentPayload[];
};

export type AssignInspectionTaskPayload = {
  taskId: number;
  inspectorIds: string[];
  reason?: string;
};

export type CancelInspectionTaskPayload = {
  taskId: number;
  reason?: string;
};

export type DuplicateInspectionTaskPayload = {
  taskId: number;
  dueDate?: string;
};

type InspectionApiConfigOptions = {
  skipErrorMessage?: boolean;
};

type InspectionErrorData = {
  statusCode?: number | string;
  code?: number | string;
  message?: string;
  error?: string;
};

const getInspectionErrorData = (data: unknown): InspectionErrorData => {
  if (data && typeof data === "object") {
    return data as InspectionErrorData;
  }
  return {};
};

export const isInspectionDataMissingError = (error: unknown) => {
  const requestError = error as {
    message?: string;
    response?: {
      status?: number;
      data?: unknown;
    };
  };
  const responseData = getInspectionErrorData(requestError.response?.data);
  const responseBody =
    typeof requestError.response?.data === "string"
      ? requestError.response.data
      : "";
  const numericCodes = [
    requestError.response?.status,
    responseData.statusCode,
    responseData.code,
  ]
    .map((value) => Number(value))
    .filter(Number.isFinite);

  if (numericCodes.includes(404)) {
    return true;
  }

  const messageText = [
    responseBody,
    responseData.message,
    responseData.error,
    requestError.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["not found", "no data", "does not exist", "doesn't exist", "not exist"].some(
    (fragment) => messageText.includes(fragment),
  );
};

const isInspectionMockEnabled = () =>
  String(import.meta.env.VITE_USE_INSPECTION_MOCK || "").toLowerCase() === "true";

const getInspectionApiConfig = (options: InspectionApiConfigOptions = {}) => ({
  ...(import.meta.env.DEV && isInspectionMockEnabled() ? { baseURL: "" } : {}),
  ...options,
});

const getSilentInspectionApiConfig = () =>
  getInspectionApiConfig({ skipErrorMessage: true });

type AnyRecord = Record<string, unknown>;

export type InspectionLookupOption = {
  id: number | string;
  code?: string;
  nameEn?: string;
  nameAr?: string;
  name?: string;
  isMock?: boolean;
};

export type InspectionSocialMediaLookupOption = InspectionLookupOption & {
  Id?: number | string;
  Code?: string;
  NameEn?: string;
  NameAr?: string;
  Name?: string;
};

export type InspectionReasonLookupOption = InspectionLookupOption;

export type InspectionPriorityLookupOption = InspectionLookupOption;

export type InspectionAccessFailedReasonLookupOption = InspectionLookupOption;

export type InspectionMaterialTypeLookupOption = InspectionLookupOption;

export type InspectionLanguageLookupOption = {
  id: number;
  nameEn: string;
  nameAr: string;
};

export type InspectionGeoLookupOption = InspectionLookupOption & {
  emirateId?: number;
  regionId?: number;
};

export type InspectionLookupInspectionCode = "digital_inspection" | "field_inspection";

export type InspectionEstablishmentSearchItem = {
  id: number;
  userProfileId?: number;
  hasRegisteredProfile?: boolean;
  nameEn?: string;
  nameAr?: string;
  establishmentName?: string;
  establishmentSubTypeId?: number;
  establishmentSubType?: string;
  emirateId?: number;
  emirateName?: string;
  emirateNameEn?: string;
  tradeLicenseNumber?: string;
  licenseNumber?: string;
  emails?: string;
  email?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
  phoneLocalNumber?: string;
  mobile?: string;
  authorityId?: number;
  authorityName?: string;
  authorityNameEn?: string;
  regionId?: number;
  regionName?: string;
  regionNameEn?: string;
  areaId?: number;
  area?: string;
  areaName?: string;
  street?: string;
  mapLocationUrl?: string;
  latitude?: number;
  longitude?: number;
  activityId?: number;
  activityName?: string;
  activityNameEn?: string;
  inspection?: InspectionLookupInspectionCode | null;
};

export type InspectionIndividualSearchItem = {
  id: number;
  userProfileId?: number | null;
  userId?: string;
  hasRegisteredProfile?: boolean;
  name?: string;
  fullName?: string;
  nameAr?: string;
  emiratesId?: string;
  uid?: string;
  passportNumber?: string;
  email?: string;
  personalEmail?: string;
  mobileNumber?: string;
  personalMobile?: string;
  mobileCountryCode?: string;
  mobileLocalNumber?: string;
  socialMediaAccountUsername?: string;
  mediaLicenseNumber?: string;
  authorityId?: number;
};

export type InspectionTargetSearchOption = {
  value: string;
  title: string;
  subtitle: string;
  targetType: "establishment" | "individual";
  payload: Record<string, unknown>;
  raw: InspectionEstablishmentSearchItem | InspectionIndividualSearchItem;
};

export type InspectionEconomicActivityOption = {
  id: number | string;
  nameEn?: string | null;
  nameAr?: string | null;
  code?: string;
  fee?: number;
  parentId?: number | string;
  childData?: InspectionEconomicActivityOption[] | null;
};

export type InspectionCampaignFilterOption = {
  id: number;
  parentId?: number | null;
  code?: string;
  nameEn: string;
  nameAr?: string;
  emirateId?: number;
  regionId?: number;
  requiresRegion?: boolean;
  establishmentCount?: number;
};

export type InspectionCampaignActivityOption = {
  id: number | string;
  code?: string;
  nameEn: string;
  nameAr?: string;
  nodeType: "Category" | "Activity";
  selectable: boolean;
  establishmentCount: number;
};

export type InspectionCampaignFilterOptionsQuery = {
  establishmentTypeId: 2;
  emirateIds: number[];
  regionIds: number[];
  areaIds: number[];
  activityIds: Array<number | string>;
  includeActivities: boolean;
};

export type InspectionCampaignFilterOptionsData = {
  emirates: InspectionCampaignFilterOption[];
  regions: InspectionCampaignFilterOption[];
  areas: InspectionCampaignFilterOption[];
  activities: InspectionCampaignActivityOption[];
  totalEstablishments: number;
  alreadyHasOpenTaskCount: number;
};

const lookupCache = new Map<string, Promise<InspectionLookupOption[]>>();

const normalizeText = (value?: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeCodeValue = (value?: unknown) =>
  String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase();

const getResponseData = <T,>(response: unknown): T => {
  if (response && typeof response === "object" && "data" in response) {
    return (response as ApiResponse<T>).data;
  }
  return response as T;
};

const wrapResponse = <T,>(source: unknown, data: T): ApiResponse<T> => {
  const body = source && typeof source === "object" ? source as Partial<ApiResponse<T>> : {};
  return {
    code: body.code ?? body.statusCode ?? 200,
    statusCode: body.statusCode ?? body.code ?? 200,
    isSuccess: body.isSuccess ?? true,
    message: body.message || "Request successful",
    data,
  };
};

const getFirstValue = <T = unknown,>(
  source: AnyRecord | null | undefined,
  keys: string[],
): T | undefined => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return undefined;
};

const toNumberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const toPositiveNumberOrUndefined = (value: unknown) => {
  const numberValue = toNumberOrUndefined(value);
  return numberValue && numberValue > 0 ? numberValue : undefined;
};

const toOptionalString = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const toOptionalBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

export const normalizeInspectionExecutionStep = (
  value?: unknown,
  currentStepId?: number,
): InspectionExecutionStepKey => {
  const normalized = normalizeCodeValue(value);
  const stepMap: Record<string, InspectionExecutionStepKey> = {
    PRE_VISIT_CHECKLIST: "targetAccess",
    TARGET_ACCESS: "targetAccess",
    ACCESS: "targetAccess",
    CHECKIN: "checklist",
    CHECK_IN: "checklist",
    PRE_VISIT: "targetAccess",
    CHECKLIST: "checklist",
    SEIZED_MATERIALS: "review",
    SEIZED_MATERIAL: "review",
    CONTACT_PERSON: "review",
    DECLARATION_ACKNOWLEDGEMENT: "review",
    DECLARATION_ACKNOWLEDGMENT: "review",
    REINSPECTION: "review",
    REVIEW: "review",
    REVIEW_CONFIRM: "review",
    REVIEW_AND_CONFIRM: "review",
    REVIEW_AND_SUBMIT: "review",
    SUBMIT_REPORT: "review",
    CHECKOUT: "review",
    CHECK_OUT: "review",
    ACCESS_FAILED: "review",
  };

  if (stepMap[normalized]) {
    return stepMap[normalized];
  }

  const stepIdMap: Record<number, InspectionExecutionStepKey> = {
    1: "targetAccess",
    2: "targetAccess",
    3: "checklist",
    4: "seizedMaterials",
    5: "review",
    6: "review",
    7: "review",
    10: "targetAccess",
    20: "targetAccess",
    30: "checklist",
    40: "checklist",
    50: "review",
    60: "review",
    70: "review",
    80: "review",
    90: "review",
    100: "review",
    110: "review",
  };

  return currentStepId && stepIdMap[currentStepId] ? stepIdMap[currentStepId] : "targetAccess";
};

const resolveInspectionExecutionStep = (
  currentStepRaw?: string,
  currentStepId?: number,
  checkinAt?: string | null,
  checkoutAt?: string | null,
  reportSubmittedAt?: string | null,
): InspectionExecutionStepKey => {
  if (currentStepRaw || currentStepId) {
    return normalizeInspectionExecutionStep(currentStepRaw, currentStepId);
  }
  if (checkoutAt || reportSubmittedAt) return "review";
  if (checkinAt) return "checklist";
  return "targetAccess";
};

const isAnyRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeRiskLevelValue = (value: unknown): InspectionRiskLevel | undefined => {
  const normalized = normalizeCodeValue(value);
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized)) {
    return normalized as InspectionRiskLevel;
  }
  return undefined;
};

const getRiskFieldValue = (
  row: AnyRecord,
  riskProfile: AnyRecord | undefined,
  keys: string[],
) => getFirstValue(riskProfile, keys) ?? getFirstValue(row, keys);

const mapV5RiskProfile = (row: AnyRecord = {}): InspectionRiskProfile => {
  const riskProfileSource = isAnyRecord(row.riskProfile) ? row.riskProfile : undefined;
  const riskProfile: InspectionRiskProfile = {};

  const riskScore = toNumberOrUndefined(getRiskFieldValue(row, riskProfileSource, ["riskScore"]));
  const aiRiskScore = toNumberOrUndefined(getRiskFieldValue(row, riskProfileSource, ["aiRiskScore"]));
  const riskLevel = normalizeRiskLevelValue(
    getRiskFieldValue(row, riskProfileSource, ["riskLevel", "riskLevelCode"]),
  );
  const riskLevelName = toOptionalString(
    getRiskFieldValue(row, riskProfileSource, ["riskLevelName"]),
  );
  const riskDescription = toOptionalString(
    getRiskFieldValue(row, riskProfileSource, ["riskDescription"]),
  );
  const aiRiskLevelName = toOptionalString(
    getRiskFieldValue(row, riskProfileSource, ["aiRiskLevelName"]),
  );
  const aiRiskInsight = toOptionalString(
    getRiskFieldValue(row, riskProfileSource, ["aiRiskInsight"]),
  );
  const lastAssessmentDate = toOptionalString(
    getRiskFieldValue(row, riskProfileSource, ["lastAssessmentDate"]),
  );
  const riskDimensions = getRiskFieldValue(row, riskProfileSource, ["riskDimensions"]);
  const riskFactors = getRiskFieldValue(row, riskProfileSource, ["riskFactors"]);
  const primaryRiskFactors = getRiskFieldValue(row, riskProfileSource, ["primaryRiskFactors"]);

  if (riskScore !== undefined) riskProfile.riskScore = riskScore;
  if (riskLevel) riskProfile.riskLevel = riskLevel;
  if (riskLevelName) riskProfile.riskLevelName = riskLevelName;
  if (riskDescription) riskProfile.riskDescription = riskDescription;
  if (aiRiskScore !== undefined) riskProfile.aiRiskScore = aiRiskScore;
  if (aiRiskLevelName) riskProfile.aiRiskLevelName = aiRiskLevelName;
  if (aiRiskInsight) riskProfile.aiRiskInsight = aiRiskInsight;
  if (Array.isArray(riskDimensions)) {
    riskProfile.riskDimensions = riskDimensions as InspectionRiskDimension[];
  }
  if (Array.isArray(riskFactors)) {
    riskProfile.riskFactors = riskFactors as InspectionRiskFactor[];
  }
  if (Array.isArray(primaryRiskFactors)) {
    riskProfile.primaryRiskFactors = primaryRiskFactors as InspectionRiskProfile["primaryRiskFactors"];
  }
  if (lastAssessmentDate) riskProfile.lastAssessmentDate = lastAssessmentDate;

  return riskProfile;
};

const addDaysIso = (days: number) => {
  // Dubai clock + offset-less contract format (was: browser clock + UTC ISO).
  return toApi(nowGst().add(days, "day"));
};

const mapLookupItems = (response: unknown): InspectionLookupOption[] => {
  const data = getResponseData<unknown>(response);
  if (Array.isArray(data)) return data as InspectionLookupOption[];
  if (data && typeof data === "object" && Array.isArray((data as AnyRecord).items)) {
    return (data as AnyRecord).items as InspectionLookupOption[];
  }
  return [];
};

let inspectionLanguageLookupCache: Promise<InspectionLanguageLookupOption[]> | null = null;

const mapInspectionLanguageItems = (response: unknown): InspectionLanguageLookupOption[] => {
  const data = getResponseData<InspectionLanguageLookupOption[]>(response);
  if (!Array.isArray(data)) return [];

  return data
    .filter((item) =>
      Number.isFinite(item.id) &&
      Boolean(toOptionalString(item.nameEn)) &&
      Boolean(toOptionalString(item.nameAr)))
    .map((item) => ({
      id: item.id,
      nameEn: item.nameEn.trim(),
      nameAr: item.nameAr.trim(),
    }));
};

export const getInspectionLanguages = () => {
  if (!inspectionLanguageLookupCache) {
    inspectionLanguageLookupCache = request
      .get<ApiResponse<InspectionLanguageLookupOption[]>>(
        "/api/ContentLibrary/Languages",
        {},
        { skipErrorMessage: true },
      )
      .then(mapInspectionLanguageItems)
      .catch((error) => {
        inspectionLanguageLookupCache = null;
        throw error;
      });
  }

  return inspectionLanguageLookupCache;
};

const mapExternalSocialMediaLookupItems = (response: unknown): InspectionSocialMediaLookupOption[] => {
  const data = getResponseData<unknown>(response);
  const items: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as AnyRecord).items)
      ? (data as AnyRecord).items as unknown[]
      : [];

  return items.map((item) => {
    const record = isAnyRecord(item) ? item : { name: item };
    const id = getFirstValue<number | string>(record, ["id", "Id", "value", "Value"])
      ?? getFirstValue<number | string>(record, ["code", "Code", "nameEn", "NameEn", "name", "Name"])
      ?? "";
    return {
      ...record,
      id,
      code: toOptionalString(getFirstValue(record, ["code", "Code"])),
      nameEn: toOptionalString(getFirstValue(record, ["nameEn", "NameEn", "name", "Name"])),
      nameAr: toOptionalString(getFirstValue(record, ["nameAr", "NameAr"])),
      name: toOptionalString(getFirstValue(record, ["name", "Name", "nameEn", "NameEn"])),
    } as InspectionSocialMediaLookupOption;
  });
};

const mapInspectionTaskDigitalPresence = (response: unknown): InspectionDigitalPresenceData => {
  const data = getResponseData<AnyRecord | null>(response) || {};
  return {
    websites: Array.isArray(data.websites) ? data.websites as InspectionDigitalPresenceWebsite[] : [],
    socialMedia: Array.isArray(data.socialMedia) ? data.socialMedia as InspectionDigitalPresenceSocialMedia[] : [],
  };
};

export const getInspectionLookupOptions = async (
  lookupName: string,
  params: Record<string, unknown> = {},
  options: { forceRefresh?: boolean } = {},
) => {
  const cacheKey = `${lookupName}:${JSON.stringify(params)}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && !options.forceRefresh) return cached;

  const promise = request
    .get<ApiResponse<InspectionLookupOption[]>>(
      `/api/admin/inspection/lookup/${lookupName}`,
      params,
      getSilentInspectionApiConfig(),
    )
    .then(mapLookupItems)
    .catch((error) => {
      lookupCache.delete(cacheKey);
      throw error;
    });

  lookupCache.set(cacheKey, promise);
  return promise;
};

export const getInspectionInspectors = () =>
  getInspectionLookupOptions("inspectors");

export const getInspectionContentUsers = () =>
  getInspectionLookupOptions("content-users");

export const getInspectionTaskStatuses = () =>
  getInspectionLookupOptions("task-statuses");

export const getInspectionMethods = () =>
  getInspectionLookupOptions("inspection-methods");

export const getInspectionReasons = () =>
  getInspectionLookupOptions("reasons", { scope: "InspectionReason" }) as Promise<InspectionReasonLookupOption[]>;

export const getInspectionReasonsFresh = () =>
  getInspectionLookupOptions("reasons", { scope: "InspectionReason" }, { forceRefresh: true }) as Promise<InspectionReasonLookupOption[]>;

export const getInspectionPriorities = () =>
  getInspectionLookupOptions("priorities", { scope: "InspectionPriority" }) as Promise<InspectionPriorityLookupOption[]>;

export const getInspectionPrioritiesFresh = () =>
  getInspectionLookupOptions("priorities", { scope: "InspectionPriority" }, { forceRefresh: true }) as Promise<InspectionPriorityLookupOption[]>;

export const getInspectionEconomicActivities = async () => {
  const response = await request.get<ApiResponse<InspectionEconomicActivityOption[]>>(
    "/api/ServiceInfo/GetEconomicActivitys",
    { type: "inspection" },
    getInspectionApiConfig(),
  );
  const data = getResponseData<InspectionEconomicActivityOption[]>(response);
  return Array.isArray(data) ? data : [];
};

export const getInspectionCampaignFilterOptions = async (
  data: InspectionCampaignFilterOptionsQuery,
) => {
  const response = await request.post<ApiResponse<InspectionCampaignFilterOptionsData>>(
    "/api/admin/inspection/lookup/campaign-scope",
    data,
    getInspectionApiConfig(),
  );
  const responseData = getResponseData<InspectionCampaignFilterOptionsData>(response);
  const areas = Array.isArray(responseData?.areas) ? responseData.areas : [];
  return {
    emirates: Array.isArray(responseData?.emirates) ? responseData.emirates : [],
    regions: Array.isArray(responseData?.regions) ? responseData.regions : [],
    areas: areas.map((area) => ({
      ...area,
      regionId: area.regionId ?? area.parentId ?? undefined,
    })),
    activities: Array.isArray(responseData?.activities) ? responseData.activities : [],
    totalEstablishments: Number(responseData?.totalEstablishments || 0),
    alreadyHasOpenTaskCount: Number(responseData?.alreadyHasOpenTaskCount || 0),
  };
};

export const getInspectionFieldAccessFailedReasons = () =>
  getInspectionLookupOptions("reasons", { scope: "InspectionFieldAccessFailedReason" }) as Promise<InspectionAccessFailedReasonLookupOption[]>;

export const getInspectionDigitalAccessFailedReasons = () =>
  getInspectionLookupOptions("reasons", { scope: "InspectionDigitalAccessFailedReason" }) as Promise<InspectionAccessFailedReasonLookupOption[]>;

export const getInspectionMaterialTypes = () =>
  getInspectionLookupOptions("reasons", { scope: "InspectionMaterialType" }) as Promise<InspectionMaterialTypeLookupOption[]>;

export const getInspectionSocialMediaLookupOptions = async () => {
  const cacheKey = "Lookup:GetLookupData:SocialMedias";
  const cached = lookupCache.get(cacheKey) as Promise<InspectionSocialMediaLookupOption[]> | undefined;
  if (cached) return cached;

  const promise = request
    .get<ApiResponse<unknown>>(
      "/api/Lookup/GetLookupData",
      { tableName: "SocialMedias" },
      getSilentInspectionApiConfig(),
    )
    .then(mapExternalSocialMediaLookupItems);

  lookupCache.set(cacheKey, promise);
  return promise;
};

const mapLookupArray = <T,>(response: unknown): T[] => {
  const data = getResponseData<unknown>(response);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as AnyRecord).items)) {
    return (data as AnyRecord).items as T[];
  }
  return [];
};

const mapLookupObject = <T,>(response: unknown): T | null => {
  const data = getResponseData<unknown>(response);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as T;
  }
  return null;
};

export const getInspectionEstablishmentSubTypes = () =>
  getInspectionLookupOptions("establishment-sub-types") as Promise<InspectionGeoLookupOption[]>;

export const getInspectionEstablishmentSubTypesFresh = () =>
  getInspectionLookupOptions("establishment-sub-types", {}, { forceRefresh: true }) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionEmirates = () =>
  getInspectionLookupOptions("emirates") as Promise<InspectionGeoLookupOption[]>;

export const getInspectionEmiratesFresh = () =>
  getInspectionLookupOptions("emirates", {}, { forceRefresh: true }) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionAuthoritiesByEmirate = (emirateId: number | string) =>
  getInspectionLookupOptions(`emirates/${encodeURIComponent(String(emirateId))}/authorities`) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionAuthoritiesByEmirateFresh = (emirateId: number | string) =>
  getInspectionLookupOptions(
    `emirates/${encodeURIComponent(String(emirateId))}/authorities`,
    {},
    { forceRefresh: true },
  ) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionRegionsByEmirate = (emirateId: number | string) =>
  getInspectionLookupOptions(`emirates/${encodeURIComponent(String(emirateId))}/regions`) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionRegionsByEmirateFresh = (emirateId: number | string) =>
  getInspectionLookupOptions(
    `emirates/${encodeURIComponent(String(emirateId))}/regions`,
    {},
    { forceRefresh: true },
  ) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionCommunitiesByRegion = (regionId: number | string) =>
  getInspectionLookupOptions(`regions/${encodeURIComponent(String(regionId))}/communities`) as Promise<InspectionGeoLookupOption[]>;

export const getInspectionCommunitiesByRegionFresh = (regionId: number | string) =>
  getInspectionLookupOptions(
    `regions/${encodeURIComponent(String(regionId))}/communities`,
    {},
    { forceRefresh: true },
  ) as Promise<InspectionGeoLookupOption[]>;

export const searchInspectionEstablishments = async (
  params: {
    keyword?: string;
    emirateId?: number;
    pageIndex?: number;
    pageSize?: number;
  } = {},
) => {
  const response = await request.get<ApiResponse<InspectionEstablishmentSearchItem[]>>(
    "/api/admin/inspection/lookup/establishments",
    {
      pageIndex: 1,
      pageSize: 20,
      ...params,
    },
    getSilentInspectionApiConfig(),
  );
  return mapLookupArray<InspectionEstablishmentSearchItem>(response);
};

export const getInspectionEstablishmentByTradeLicense = async (
  params: {
    tradeLicenseNumber: string;
    emirateId?: number;
  },
) => {
  const response = await request.get<ApiResponse<InspectionEstablishmentSearchItem | null>>(
    "/api/admin/inspection/lookup/establishments/by-trade-license",
    params,
    getSilentInspectionApiConfig(),
  );
  return mapLookupObject<InspectionEstablishmentSearchItem>(response);
};

export const searchInspectionIndividuals = async (
  params: {
    keyword?: string;
    pageIndex?: number;
    pageSize?: number;
  } = {},
) => {
  const response = await request.get<ApiResponse<InspectionIndividualSearchItem[]>>(
    "/api/admin/inspection/lookup/individuals",
    {
      pageIndex: 1,
      pageSize: 20,
      ...params,
    },
    getSilentInspectionApiConfig(),
  );
  return mapLookupArray<InspectionIndividualSearchItem>(response);
};

const findLookupId = async (
  lookupName: string,
  value?: unknown,
  params: Record<string, unknown> = {},
) => {
  if (value === undefined || value === null || value === "") return undefined;
  const numericId = toPositiveNumberOrUndefined(value);
  if (numericId !== undefined) return numericId;

  const normalizedValue = normalizeText(value);
  const items = await getInspectionLookupOptions(lookupName, params).catch(() => []);
  const match = items.find((item) =>
    [item.id, item.code, item.nameEn, item.nameAr, item.name].some(
      (candidate) => normalizeText(candidate) === normalizedValue,
    ),
  );
  return toPositiveNumberOrUndefined(match?.id);
};

const findLookupCode = async (
  lookupName: string,
  value?: unknown,
  params: Record<string, unknown> = {},
) => {
  if (value === undefined || value === null || value === "") return undefined;

  const normalizedValue = normalizeText(value);
  const items = await getInspectionLookupOptions(lookupName, params).catch(() => []);
  const match = items.find((item) =>
    [item.code, item.nameEn, item.nameAr, item.name, item.id].some(
      (candidate) => normalizeText(candidate) === normalizedValue,
    ),
  );
  return toOptionalString(match?.code) || toOptionalString(value);
};

const findLookupCodeNumber = async (
  lookupName: string,
  value?: unknown,
  params: Record<string, unknown> = {},
) => {
  if (value === undefined || value === null || value === "") return undefined;

  const normalizedValue = normalizeText(value);
  const numericValue = toPositiveNumberOrUndefined(value);
  const items = await getInspectionLookupOptions(lookupName, params).catch(() => []);
  const match = items.find((item) =>
    [item.code, item.nameEn, item.nameAr, item.name, item.id].some(
      (candidate) => normalizeText(candidate) === normalizedValue,
    ),
  );
  if (!match) return numericValue;

  return toPositiveNumberOrUndefined(match.code) || numericValue;
};

const getDefaultInspectionMethodId = (methodName?: unknown) => {
  const normalized = normalizeText(methodName);
  if (normalized.includes("digital")) return 2;
  return 1;
};

const getDefaultTargetTypeId = (target?: AnyRecord) => {
  const targetType = toNumberOrUndefined(target?.targetType);
  if (targetType) return targetType;
  const targetTypeName = normalizeText(target?.targetTypeName || target?.targetTypeNameEn);
  if (targetTypeName.includes("individual")) return 2;
  if (targetTypeName.includes("activity")) return 3;
  return 1;
};

const getDefaultSourceTypeId = (source?: AnyRecord) => {
  const sourceTypeId = toNumberOrUndefined(source?.sourceTypeId);
  if (sourceTypeId) return sourceTypeId;
  const sourceName = normalizeText(source?.sourceTypeNameEn || source?.sourceTypeCode);
  if (sourceName.includes("activity")) return 2;
  return 1;
};

const createNameLookupMap = (items: InspectionLookupOption[]) => {
  const map = new Map<string, InspectionLookupOption>();
  items.forEach((item) => {
    [item.nameEn, item.nameAr, item.name, item.code, item.id].forEach((value) => {
      const normalized = normalizeText(value);
      if (normalized) map.set(normalized, item);
    });
  });
  return map;
};

const mapV5TaskStatus = (status?: unknown) => {
  const value = normalizeCodeValue(status);
  if (value === "PENDING_ASSIGNMENT") return "QUEUED";
  if (value === "ASSIGNED") return "PENDING_VISIT";
  if (value === "SUBMITTED") return "COMPLETED";
  return value || undefined;
};

const buildV5TaskExecutionState = (detail: AnyRecord = {}): AnyRecord => {
  const executionResult = isAnyRecord(detail.executionResult) ? detail.executionResult : {};
  const executionState = isAnyRecord(detail.executionState) ? detail.executionState : {};
  const currentStepId = detail.currentStepId ?? executionState.currentStepId;
  const taskStatusId = detail.statusId ?? executionState.statusId;
  const taskStatusCode = toOptionalString(detail.statusCode ?? executionState.statusCode);

  return {
    ...executionResult,
    ...executionState,
    ...(currentStepId !== undefined ? { currentStepId } : {}),
    ...(taskStatusId !== undefined ? { taskStatusId } : {}),
    ...(taskStatusCode ? { taskStatusCode } : {}),
  };
};

const mapV5TaskRow = (row: AnyRecord = {}): InspectionTaskSummary => {
  const rawTarget = isAnyRecord(row.inspectionTarget) ? row.inspectionTarget : {};
  const taskId = Number(row.id || 0);
  const executionState = buildV5TaskExecutionState(row);
  const targetTypeId = Number(row.targetTypeId || 0);
  const methodName = String(row.inspectionMethodName || "");
  const methodCode = toOptionalString(row.inspectionMethodCode);
  const methodId = Number(row.inspectionMethodId || 0);
  const assignedInspectorsSource = Array.isArray(row.inspectors) ? row.inspectors : [];
  const assignedInspectors = (assignedInspectorsSource as AnyRecord[]).map((item: AnyRecord) => ({
    inspectorId: String(item.inspectorId || ""),
    inspectorName: String(item.inspectorName || ""),
    role: toOptionalString(item.role),
  })).filter((item) => Boolean(item.inspectorId));
  const inspectionReasonId = toNumberOrUndefined(row.inspectionReasonId);
  const inspectionReasonName = toOptionalString(row.inspectionReasonName);
  const accessOutcomeCode = toOptionalString(row.accessOutcomeCode);
  const accessOutcomeName = toOptionalString(row.accessOutcomeName);
  const accessFailedReasonCode = toOptionalString(row.accessFailedReasonCode);
  const accessFailedReasonName = toOptionalString(row.accessFailedReasonName);
  const accessFailedRemark = toOptionalString(row.accessFailedRemark);
  const priorityName = String(row.priorityName || "");
  const priorityCode = toOptionalString(row.priorityCode);
  const status = mapV5TaskStatus(row.statusCode || row.statusName);
  const isIndividualTarget = targetTypeId === 2;
  const establishmentId = isIndividualTarget
    ? undefined
    : toPositiveNumberOrUndefined(row.establishmentId);
  const individualId = isIndividualTarget
    ? toPositiveNumberOrUndefined(row.individualId)
    : undefined;
  const userProfileId =
    toPositiveNumberOrUndefined(row.userProfileId) ||
    toPositiveNumberOrUndefined(row.profileId);
  const targetName = isIndividualTarget
    ? toOptionalString(row.fullName)
    : toOptionalString(row.establishmentName) || toOptionalString(row.targetName);
  const inspectorName = toOptionalString(row.inspectorName) || assignedInspectors[0]?.inspectorName || "";

  return {
    taskId,
    taskNo: String(row.taskNo || ""),
    reinspectionNo: toOptionalString(row.reinspectionNo),
    taskName: toOptionalString(row.taskName),
    status: status as InspectionTaskStatus | undefined,
    statusId: row.statusId as number | string | undefined,
    statusCode: toOptionalString(row.statusCode),
    statusName: toOptionalString(row.statusName),
    taskStatusId: row.statusId as number | string | undefined,
    taskStatusCode: toOptionalString(row.statusCode),
    currentStepId: executionState.currentStepId as number | string | undefined,
    executionState,
    executionResult: isAnyRecord(row.executionResult) ? row.executionResult : undefined,
    taskSource: {
      sourceTypeId: Number(row.sourceTypeId || 0),
      sourceTypeCode: String(row.sourceTypeCode || "").toUpperCase() as InspectionTaskSourceType,
      sourceTypeNameEn: String(row.sourceTypeName || ""),
    },
    inspectionTarget: {
      targetType: targetTypeId,
      targetTypeCode: toOptionalString(row.targetTypeCode),
      targetTypeName: String(row.targetTypeName || ""),
      establishmentId,
      individualId,
      userProfileId,
      profileId: userProfileId,
      hasRegisteredProfile: Boolean(row.hasRegisteredProfile),
      establishmentNameEn: String(targetName || ""),
      establishmentNameAr: row.establishmentNameAr as string | undefined,
      establishmentSubTypeId: toPositiveNumberOrUndefined(row.establishmentTypeId),
      establishmentSubType: row.establishmentTypeName as string | undefined,
      licenseNumber: String(row.tradeLicenseNumber || ""),
      fullName: row.fullName as string | undefined,
      emiratesId: (row.emiratesId || rawTarget.emiratesId) as string | undefined,
      uid: (row.uid || rawTarget.uid) as string | undefined,
      uaeNumber: (row.uaeNumber || rawTarget.uaeNumber) as string | undefined,
      passportNumber: (row.passportNumber || rawTarget.passportNumber) as string | undefined,
      email: row.email as string | undefined,
      mobile: (row.mobile ?? rawTarget.mobile) as string | undefined,
      mobileCountryCode: (row.mobileCountryCode ?? rawTarget.mobileCountryCode) as string | undefined,
      mobileLocalNumber: (row.mobileLocalNumber ?? rawTarget.mobileLocalNumber) as string | undefined,
      mediaLicenseNumber: row.mediaLicenseNumber as string | undefined,
      socialMediaAccountUsername: row.socialMediaAccountUsername as string | undefined,
      economicActivityId: toNumberOrUndefined(row.activityId),
      economicActivityName: row.activityName as string | undefined,
      address: {
        emirateId: Number(row.emirateId || 0),
        emirateNameEn: String(row.emirateName || ""),
        emirateNameAr: row.emirateNameAr as string | undefined,
        authorityId: toPositiveNumberOrUndefined(row.authorityId),
        authorityNameEn: row.authorityName as string | undefined,
        regionId: toPositiveNumberOrUndefined(row.regionId),
        regionNameEn: row.regionName as string | undefined,
        areaId: toPositiveNumberOrUndefined(row.areaId),
        areaNameEn: row.areaName as string | undefined,
        communityId: toPositiveNumberOrUndefined(row.communityId),
        communityNameEn: row.communityName as string | undefined,
        street: String(row.areaStreet || ""),
        mapLocationUrl: row.mapLocationUrl as string | undefined,
        latitude: toNumberOrUndefined(row.latitude),
        longitude: toNumberOrUndefined(row.longitude),
      },
    },
    riskProfile: mapV5RiskProfile(row),
    inspectionReasonId,
    inspectionReasonName,
    accessOutcomeCode,
    accessOutcomeName,
    accessFailedReasonCode,
    accessFailedReasonName,
    accessFailedRemark,
    accessFailedAttachments: Array.isArray(row.accessFailedAttachments) ? row.accessFailedAttachments : [],
    inspectionConfig: {
      inspectionTypeId: methodId,
      inspectionTypeCode: methodCode,
      inspectionTypeNameEn: methodName,
      inspectionReasonId,
      inspectionReasonCode: toOptionalString(row.inspectionReasonCode),
      inspectionReasonNameEn: inspectionReasonName || "",
      isDigitalVisit: methodId === 2,
      priorityId: toNumberOrUndefined(row.priorityId),
      priorityCode,
      priorityNameEn: priorityName,
      dueDate: row.dueDate as string | undefined,
      slaMinutes: toNumberOrUndefined(row.slaMinutes),
    },
    assignment: {
      isAssigned: assignedInspectors.length > 0 || Boolean(inspectorName || row.assignmentState === "Assigned"),
      assignedInspector: inspectorName,
      assignedInspectors,
      assignedAt: row.assignedOn as string | undefined,
    },
    createdBy: toOptionalString(row.createdBy),
    createdByName: toOptionalString(row.createdByName),
    createdOn: row.createdOn as string | undefined,
    assignedOn: row.assignedOn as string | undefined,
    sla: (isAnyRecord(row.sla) ? row.sla : undefined) as InspectionSlaSummary | undefined,
    slaDeadlineAt: row.slaDeadlineAt as string | undefined,
    cancelView: toOptionalBoolean(row.cancelView),
    createdAt: row.createdOn as string | undefined,
    lastUpdatedOn: row.lastUpdatedOn as string | undefined,
    updatedAt: row.lastUpdatedOn as string | undefined,
  };
};

const buildV5TaskReportPreview = (detail: AnyRecord = {}) => {
  const report = isAnyRecord(detail.report) ? detail.report : {};
  const reportSummary = isAnyRecord(report.reportSummary) ? report.reportSummary : report;

  return {
    ...report,
    reportSummary,
  };
};

const mapV5TaskDetail = (detail: AnyRecord = {}): InspectionTaskDetail => {
  const summary = mapV5TaskRow(detail);
  const executionState = buildV5TaskExecutionState(detail);
  const reportPreview = buildV5TaskReportPreview(detail);
  const attachments = Array.isArray(detail.attachments) ? detail.attachments : [];
  const accessFailedAttachments = Array.isArray(detail.accessFailedAttachments) ? detail.accessFailedAttachments : [];
  return {
    ...summary,
    description: toOptionalString(detail.description || detail.remarks),
    taskSourceRemark: toOptionalString(detail.remarks || detail.taskSourceRemark),
    aiRiskInsight: summary.riskProfile.aiRiskInsight || toOptionalString(detail.aiRiskInsight),
    attachments: [...attachments, ...accessFailedAttachments] as InspectionTaskAttachmentPayload[],
    timeline: (detail.timeline || []) as InspectionTaskTimelineItem[],
    smartChecklistSnapshot: detail.smartChecklistSnapshot as SmartChecklistData,
    report: isAnyRecord(detail.report) ? detail.report : undefined,
    reportPreview: reportPreview as InspectionReportPreview,
    review: detail.review as Record<string, unknown>,
    targetOverview: detail.targetOverview as InspectionTaskTargetOverview,
    violations: (detail.violations || []) as InspectionCreatedViolationSummary[],
    lastSuccessfulInspection: detail.lastSuccessfulInspection as Record<string, unknown>,
    lastInspection: detail.lastInspection as Record<string, unknown>,
    lastCompletedInspection: detail.lastCompletedInspection as Record<string, unknown>,
    previousSuccessfulInspection: detail.previousSuccessfulInspection as Record<string, unknown>,
    previousInspection: detail.previousInspection as Record<string, unknown>,
    inspectionHistory: detail.inspectionHistory as Array<Record<string, unknown>>,
    reinspectionTask: detail.reinspectionTask as Record<string, unknown>,
    linkedReinspectionTask: detail.linkedReinspectionTask as Record<string, unknown>,
    relatedReinspectionTask: detail.relatedReinspectionTask as Record<string, unknown>,
    executionResult: detail.executionResult as Record<string, unknown>,
    executionState,
    currentStepId: executionState.currentStepId,
  } as unknown as InspectionTaskDetail;
};

const mapTaskListResponse = (response: unknown): InspectionTaskListData => {
  const data = getResponseData<AnyRecord>(response) || {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
  return {
    items: items.map(mapV5TaskRow),
    total: Number(data.totalCount ?? data.total ?? items.length),
    pageIndex: Number(data.pageIndex || 1),
    pageSize: Number(data.pageSize || items.length || 10),
  };
};

const mapTaskStats = (response: unknown) => {
  const data = getResponseData<AnyRecord>(response) || {};
  return {
    queuedCount: Number(data.queuedCount ?? data.pendingAssignmentCount ?? 0),
    pendingVisitCount: Number(data.pendingVisitCount ?? data.todoCount ?? data.assignedCount ?? 0),
    inProgressCount: Number(data.inProgressCount ?? 0),
    accessFailedCount: Number(data.accessFailedCount ?? 0),
    completedCount: Number(data.completedCount ?? 0),
    cancelledCount: Number(data.cancelledCount ?? 0),
  };
};

const TASK_STATUS_ID_MAP: Record<string, number> = {
  QUEUED: 0,
  PENDING_ASSIGNMENT: 0,
  PENDING_VISIT: 1,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  ACCESS_FAILED: 3,
  COMPLETED: 4,
  SUBMITTED: 4,
  CANCELLED: 5,
};

const getSingleMappedStatusId = (statuses?: unknown[]) => {
  if (!Array.isArray(statuses) || statuses.length !== 1) return undefined;
  const status = normalizeCodeValue(statuses[0]);
  return status ? TASK_STATUS_ID_MAP[status] : undefined;
};

const mapTaskScope = (params: GetInspectionTaskListParams) => {
  const tab = String(params.tab || "").toLowerCase();
  const view = String(params.view || "").toLowerCase();
  if (tab === "overview" || view === "targetoverview") return "All";
  if (tab === "queued") return "Queued";
  if (tab === "completed") return "Completed";
  if (tab === "todo" || tab === "teamtasks") return "Todo";
  if (params.role === "inspector") return "Todo";
  return "Queued";
};

const mapTaskListParams = (params: GetInspectionTaskListParams) => {
  const filters = params.filters || {};
  const inspectionMethodName = filters.inspectionMethods?.[0];
  const inspectionMethodId = filters.inspectionMethodIds?.[0]
    || (inspectionMethodName ? getDefaultInspectionMethodId(inspectionMethodName) : undefined);
  return {
    scope: mapTaskScope(params),
    search: params.keyword,
    pageIndex: params.pageIndex || 1,
    pageSize: params.pageSize || 10,
    statusId: filters.statusIds?.[0] || getSingleMappedStatusId(filters.statuses),
    inspectionReasonId: filters.inspectionReasonId,
    priorityId: filters.priorityIds?.[0],
    inspectionMethodId,
    emiratesId: filters.emirates?.[0],
    areaId: filters.areaIds?.[0],
    establishmentId: filters.establishmentIds?.[0],
    individualId: filters.individualIds?.[0],
    assignedInspectorId: filters.inspectorIds?.[0] || params.inspectorId,
    createBy: filters.createdBy || filters.createdByTypes?.[0],
    createAtFrom: filters.dateFrom,
    createAtTo: filters.dateTo,
    dueDateFrom: filters.dueDateFrom,
    dueDateTo: filters.dueDateTo,
    sortBy: params.sortBy,
    sortDirection: params.sortDirection,
  };
};

export const getInspectionCreatedByUsers = async (
  params: GetInspectionTaskListParams = {},
) => {
  const query = {
    ...mapTaskListParams(params),
    createBy: undefined,
  };
  const response = await request.get<ApiResponse<InspectionLookupOption[]>>(
    "/api/admin/inspection/tasks/created-by-users",
    query,
    getSilentInspectionApiConfig(),
  );
  return mapLookupItems(response);
};

const mapAttachmentsForV5 = (
  attachments?: InspectionTaskAttachmentPayload[],
  relatedEntityType = "InspectionTask",
) => (attachments || []).map((attachment) => ({
  relatedEntityType: attachment.relatedEntityType || relatedEntityType,
  attachmentCategory: attachment.attachmentCategory || "TaskSource",
  fileName: attachment.fileName,
  fileUrl: attachment.fileUrl,
  contentType: attachment.contentType,
}));

export type InspectionTaskValidationData = {
  warnings?: Array<Record<string, unknown>>;
  blockingErrors?: Array<Record<string, unknown>>;
  recentTasks?: Array<Record<string, unknown>>;
};

type CreateInspectionTaskOptions = {
  skipValidation?: boolean;
};

const buildAreaStreet = (address: InspectionAddress) => {
  const areaName = toOptionalString(
    (address as AnyRecord).areaNameEn || address.communityNameEn,
  );
  const street = toOptionalString(address.street);
  if (areaName && street && normalizeText(street).includes(normalizeText(areaName))) {
    return street;
  }
  return [areaName, street].filter(Boolean).join(", ") || street;
};

// Coordinates travel with areaStreet: both come from the same target address, so a
// task is navigable by pin rather than by text search. They only carry meaning as a
// pair — a lone axis makes the backend null both and log a warning — so emit neither
// unless both parse to finite numbers.
const buildAddressCoordinates = (address: InspectionAddress) => {
  const latitude = toNumberOrUndefined(address.latitude);
  const longitude = toNumberOrUndefined(address.longitude);
  if (latitude === undefined || longitude === undefined) return {};
  return { latitude, longitude };
};

export const mapTaskUpsertPayload = async (data: InspectionTaskUpsertPayload) => {
  const config = data.inspectionConfig || {} as InspectionConfig;
  const target = data.inspectionTarget || {} as InspectionTarget;
  const address = target.address || {} as InspectionAddress;
  const methodName = config.inspectionTypeNameEn || (config.isDigitalVisit ? "Digital Inspection" : "Field Inspection");
  const inspectorIds = Array.isArray(data.assignment?.assignedInspectors)
    ? data.assignment?.assignedInspectors.map((item) => item.inspectorId).filter(Boolean)
    : undefined;
  const reasonLookupValue = config.inspectionReasonCode
    || config.inspectionReasonId
    || config.inspectionReasonNameEn
    || config.inspectionReasonNameAr;
  const priorityLookupValue = config.priorityCode || config.priorityId || config.priorityNameEn || config.priorityNameAr;
  const [reasonCode, priorityId, emirateId, methodId] = await Promise.all([
    findLookupCode("reasons", reasonLookupValue, { scope: "InspectionReason" }),
    findLookupCodeNumber("priorities", priorityLookupValue, { scope: "InspectionPriority" }),
    findLookupId("emirates", address.emirateNameEn || address.emirateId),
    findLookupId("inspection-methods", methodName || config.inspectionTypeId),
  ]);
  const inspectors = inspectorIds?.length ? await mapInspectorAssignments(inspectorIds) : undefined;
  const targetTypeId = getDefaultTargetTypeId(target);
  const isEstablishmentTarget = targetTypeId === 1;
  const isIndividualTarget = targetTypeId === 2;
  const authorityId = toPositiveNumberOrUndefined((address as AnyRecord).authorityId)
    || (emirateId ? await findLookupId(`emirates/${emirateId}/authorities`, (address as AnyRecord).authorityNameEn) : undefined);
  const regionId = toPositiveNumberOrUndefined((address as AnyRecord).regionId)
    || (emirateId ? await findLookupId(`emirates/${emirateId}/regions`, (address as AnyRecord).regionNameEn) : undefined);
  const communityId = toPositiveNumberOrUndefined(address.communityId || (address as AnyRecord).areaId)
    || (regionId ? await findLookupId(`regions/${regionId}/communities`, (address as AnyRecord).areaNameEn || address.communityNameEn) : undefined);
  const establishmentId = isEstablishmentTarget ? toPositiveNumberOrUndefined(target.establishmentId) : undefined;
  const individualId = isIndividualTarget
    ? toPositiveNumberOrUndefined(target.individualId) || toPositiveNumberOrUndefined(target.userProfileId)
    : undefined;

  return {
    targetTypeId,
    sourceTypeId: getDefaultSourceTypeId(data.taskSource),
    inspectionMethodId: methodId || getDefaultInspectionMethodId(methodName),
    establishmentId,
    individualId,
    establishmentName: isEstablishmentTarget ? target.establishmentNameEn : undefined,
    tradeLicenseNumber: isEstablishmentTarget ? target.licenseNumber : undefined,
    activityId: target.economicActivityId,
    fullName: target.fullName || (!isEstablishmentTarget ? target.establishmentNameEn : undefined),
    emiratesId: isIndividualTarget ? target.emiratesId : undefined,
    email: target.email || (target as AnyRecord).emails,
    mobile: target.mobile || (target as AnyRecord).mobileNumber,
    mobileCountryCode: target.mobileCountryCode,
    mobileLocalNumber: target.mobileLocalNumber,
    inspectionReasonId: reasonCode,
    priorityId,
    emirateId,
    authorityId,
    regionId,
    communityId,
    areaStreet: buildAreaStreet(address),
    ...buildAddressCoordinates(address),
    dueDate: config.dueDate,
    remarks: data.description || (data as AnyRecord).taskSourceRemark,
    attachments: mapAttachmentsForV5(data.attachments),
    inspectors,
  };
};

const throwBlockingValidationErrors = (validationData: AnyRecord) => {
  const blockingErrors = Array.isArray(validationData.blockingErrors)
    ? validationData.blockingErrors
    : [];
  if (!blockingErrors.length) return;

  const message = blockingErrors.map((item: AnyRecord) => item.message || item.code).filter(Boolean).join("; ");
  throw new Error(message || "Inspection task validation failed.");
};

export const validateInspectionTask = async (
  data: InspectionTaskUpsertPayload,
) => {
  const payload = await mapTaskUpsertPayload(data);
  const validation = await request.post<ApiResponse<InspectionTaskValidationData>>(
    "/api/admin/inspection/tasks/validate",
    payload,
    getInspectionApiConfig(),
  );
  const validationData = getResponseData<InspectionTaskValidationData>(validation) || {};
  throwBlockingValidationErrors(validationData as AnyRecord);
  return wrapResponse(validation, validationData);
};

const mapInspectorAssignments = async (inspectorIds: string[]) => {
  const inspectors = await getInspectionInspectors().catch(() => []);
  const inspectorMap = createNameLookupMap(inspectors);
  return inspectorIds.map((inspectorId, index) => {
    const option = inspectorMap.get(normalizeText(inspectorId));
    return {
      inspectorId,
      inspectorName: option?.nameEn || option?.name || inspectorId,
      isPrimary: index === 0,
    };
  });
};

const getAdminInspectionTaskId = (
  params: { taskId?: number | string; taskNo?: string },
) => encodeURIComponent(String(params.taskId || params.taskNo || ""));

type AdminInspectionTaskEndpointParams = {
  taskId?: number | string;
  taskNo?: string;
};

const INSPECTION_TASK_ADMIN_ENDPOINTS = {
  detail: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}`,
  digitalPresence: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/digital-presence`,
  targetOverview: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/target-overview`,
  report: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/report`,
  executionResult: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/execution-result`,
  timeline: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/timeline`,
  review: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/review`,
  lastInspection: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/last-inspection`,
  edit: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/edit`,
  assign: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/assign`,
  cancel: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/cancel`,
  duplicate: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/duplicate`,
  checklistTemplate: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/checklist-template`,
  checklistItems: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/checklist-items`,
  startVisit: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/start-visit`,
  checkin: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/checkin`,
  accessFailed: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/access-failed`,
  checklist: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/checklist`,
  seizedMaterials: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/seized-materials`,
  contactPerson: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/contact-person`,
  contactPersons: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/persons`,
  contactPersonDeclaration: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/contact-person/declaration`,
  reinspection: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/reinspection`,
  reinspectionTask: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/reinspection-task`,
  submitReport: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/submit-report`,
  checkout: (params: AdminInspectionTaskEndpointParams) =>
    `/api/admin/inspection/tasks/${getAdminInspectionTaskId(params)}/checkout`,
} as const;

const INSPECTION_TASK_DETAIL_FRAGMENT_ENDPOINTS: ReadonlyArray<{
  key: InspectionTaskDetailFragmentKey;
  getPath: (params: AdminInspectionTaskEndpointParams) => string;
}> = [
  {
    key: "targetOverview",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.targetOverview,
  },
  {
    key: "report",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.report,
  },
  {
    key: "executionResult",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.executionResult,
  },
  {
    key: "timeline",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.timeline,
  },
  {
    key: "review",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.review,
  },
  {
    key: "lastInspection",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.lastInspection,
  },
  {
    key: "reinspectionTask",
    getPath: INSPECTION_TASK_ADMIN_ENDPOINTS.reinspectionTask,
  },
];

const DEFAULT_INSPECTION_TASK_DETAIL_FRAGMENT_KEYS: readonly InspectionTaskDetailFragmentKey[] = [
  "targetOverview",
  "executionResult",
  "timeline",
  "lastInspection",
  "reinspectionTask",
];

const getInspectionTaskDetailFragmentEndpoints = (
  options: GetInspectionTaskDetailOptions = {},
) => {
  const includedKeys = new Set(options.includeFragments || DEFAULT_INSPECTION_TASK_DETAIL_FRAGMENT_KEYS);
  return INSPECTION_TASK_DETAIL_FRAGMENT_ENDPOINTS.filter(({ key }) => includedKeys.has(key));
};

const fetchAdminInspectionTaskDetail = async (params: GetInspectionTaskDetailParams) => {
  const response = await request.get<
    ApiResponse<AnyRecord | null>,
    ApiResponse<AnyRecord | null>
  >(
    INSPECTION_TASK_ADMIN_ENDPOINTS.detail(params),
    params,
    getSilentInspectionApiConfig(),
  );
  return {
    response,
    detail: getResponseData<AnyRecord | null>(response),
  };
};

export const getInspectionTaskDigitalPresence = async (
  params: GetInspectionTaskDetailParams,
): Promise<InspectionDigitalPresenceData> => {
  const response = await request.get<ApiResponse<InspectionDigitalPresenceData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.digitalPresence(params),
    undefined,
    getSilentInspectionApiConfig(),
  );
  return mapInspectionTaskDigitalPresence(response);
};

const getAdminInspectionViolationPath = (violationId: string, suffix = "") =>
  `/api/admin/inspection/violations/${encodeURIComponent(violationId)}${suffix}`;

const resolveInspectionTaskDetailParamsByTaskNo = async (
  taskNo?: string,
): Promise<GetInspectionTaskDetailParams | null> => {
  const normalizedTaskNo = normalizeText(taskNo);
  if (!normalizedTaskNo) return null;

  try {
    const response = await request.get<ApiResponse<AnyRecord>, ApiResponse<AnyRecord>>(
      "/api/admin/inspection/tasks",
      {
        scope: "All",
        search: taskNo,
        pageIndex: 1,
        pageSize: 10,
      },
      getSilentInspectionApiConfig(),
    );
    const listData = mapTaskListResponse(response);
    const matchedTask = listData.items.find(
      (item) => normalizeText(item.taskNo) === normalizedTaskNo,
    );
    if (!matchedTask?.taskId) return null;

    return {
      taskId: matchedTask.taskId,
      taskNo: matchedTask.taskNo || taskNo,
    };
  } catch {
    return null;
  }
};

const getTaskDetailBestEffort = async (
  params: GetInspectionTaskDetailParams,
  options: GetInspectionTaskDetailOptions = {},
) => {
  let effectiveParams = params;
  let detailResponse: ApiResponse<AnyRecord | null> | undefined;
  let detail: AnyRecord | null = null;

  try {
    const result = await fetchAdminInspectionTaskDetail(effectiveParams);
    detailResponse = result.response;
    detail = result.detail;
  } catch (error) {
    if (!isInspectionDataMissingError(error)) {
      throw error;
    }
  }

  if (!detail && params.taskId && params.taskNo) {
    effectiveParams = { taskNo: params.taskNo };
    try {
      const result = await fetchAdminInspectionTaskDetail(effectiveParams);
      detailResponse = result.response;
      detail = result.detail;
    } catch (error) {
      if (!isInspectionDataMissingError(error)) {
        throw error;
      }
    }
  }

  if (!detail && params.taskNo) {
    const resolvedParams = await resolveInspectionTaskDetailParamsByTaskNo(params.taskNo);
    if (resolvedParams?.taskId) {
      effectiveParams = resolvedParams;
      try {
        const result = await fetchAdminInspectionTaskDetail(effectiveParams);
        detailResponse = result.response;
        detail = result.detail;
      } catch (error) {
        if (!isInspectionDataMissingError(error)) {
          throw error;
        }
      }
    }
  }

  if (!detail) return wrapResponse(detailResponse, null);

  const fragmentEndpoints = getInspectionTaskDetailFragmentEndpoints(options);
  const fragments = await Promise.all(
    fragmentEndpoints.map(async ({ key, getPath }) => {
      try {
        const response = await request.get<ApiResponse<unknown>>(
          getPath(effectiveParams),
          effectiveParams,
          getSilentInspectionApiConfig(),
        );
        return [key, getResponseData(response)] as const;
      } catch (error) {
        if (!isInspectionDataMissingError(error)) {
          throw error;
        }
        return [key, undefined] as const;
      }
    }),
  );
  const merged = fragments.reduce<AnyRecord>((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, { ...detail });
  const timeline = merged.timeline;
  if (timeline && !Array.isArray(timeline) && Array.isArray((timeline as AnyRecord).items)) {
    merged.timeline = (timeline as AnyRecord).items;
  }
  return wrapResponse(detailResponse, mapV5TaskDetail(merged));
};

export const generateAndAssignInspectionTasks = (
  data: GenerateAndAssignInspectionTasksParams,
) => {
  return request.post<ApiResponse<GenerateAndAssignInspectionTasksData>>(
    "/api/inspection/tasks/generate-and-assign",
    data,
    getInspectionApiConfig(),
  );
};

export const getInspectionTaskList = async (
  params: GetInspectionTaskListParams,
) => {
  const query = mapTaskListParams(params);
  const [listResponse, statsResponse] = await Promise.all([
    request.get<ApiResponse<AnyRecord>>(
      "/api/admin/inspection/tasks",
      query,
      getSilentInspectionApiConfig(),
    ),
    request.get<ApiResponse<AnyRecord>>(
      "/api/admin/inspection/tasks/stats",
      undefined,
      getSilentInspectionApiConfig(),
    ).catch(() => null),
  ]);
  const listData = mapTaskListResponse(listResponse);
  return wrapResponse(listResponse, {
    ...listData,
    summary: statsResponse ? mapTaskStats(statsResponse) : undefined,
  });
};

export const getInspectionTasksByUserProfile = (
  params: InspectionProfileTaskListParams,
) => {
  return request.get<InspectionProfileTaskListResponse>(
    "/api/admin/inspection/profile/task/by-user-profile",
    params,
    getSilentInspectionApiConfig(),
  );
};

export const getInspectionProfileTaskStats = (
  params: Pick<InspectionProfileTaskListParams, "userId" | "profileId">,
) =>
  getInspectionTasksByUserProfile({
    ...params,
    pageIndex: 1,
    pageSize: 1,
  });

export const getInspectionTaskStats = async () => {
  const response = await request.get<ApiResponse<AnyRecord>>(
    "/api/admin/inspection/tasks/stats",
    undefined,
    getSilentInspectionApiConfig(),
  );

  return wrapResponse(response, mapTaskStats(response));
};

export const getInspectionTargetTasks = async (
  params: InspectionTargetTaskListParams,
) => {
  const response = await request.get<ApiResponse<AnyRecord[] | AnyRecord>>(
    "/api/admin/inspection/tasks/by-target",
    {
      establishmentId: params.establishmentId,
      individualId: params.individualId,
      taskId: params.taskId,
      scope: params.scope,
      pageIndex: params.pageIndex || 1,
      pageSize: params.pageSize || 10,
      search: params.search || undefined,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    },
    getSilentInspectionApiConfig(),
  );
  const data = getResponseData<AnyRecord[] | AnyRecord>(response);
  const dataRecord =
    data && !Array.isArray(data) && typeof data === "object"
      ? data as AnyRecord
      : {};
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(dataRecord.items)
      ? dataRecord.items
      : Array.isArray(dataRecord.data)
        ? dataRecord.data
        : [];
  const items = rawItems.map(mapV5TaskRow);
  return wrapResponse(response, {
    items,
    statuses: Array.isArray(dataRecord.statuses) ? dataRecord.statuses : undefined,
    total: Number(dataRecord.totalCount ?? dataRecord.total ?? items.length),
    pageIndex: Number(dataRecord.pageIndex || params.pageIndex || 1),
    pageSize: Number(dataRecord.pageSize || params.pageSize || 10),
  } as InspectionTargetTaskListData);
};

export const exportInspectionTasks = async (
  params: GetInspectionTaskListParams,
) => {
  return request.get<Blob>(
    "/api/admin/inspection/tasks/export",
    mapTaskListParams(params),
    { ...getSilentInspectionApiConfig(), responseType: "blob" },
  );
};

export const getInspectionTaskDetail = getTaskDetailBestEffort;

export const getAdminInspectionTaskDetail = getTaskDetailBestEffort;

export const getInspectionTaskExecutionStatus = async (
  params: GetInspectionTaskDetailParams,
): Promise<InspectionTaskExecutionStatus> => {
  const response = await getTaskDetailBestEffort(params);
  const detail = getResponseData<AnyRecord | null>(response) || {};
  const executionState = isAnyRecord(detail.executionState) ? detail.executionState : {};
  const executionResult = isAnyRecord(detail.executionResult) ? detail.executionResult : {};
  const report = isAnyRecord(detail.report) ? detail.report : {};
  const reportSummary = isAnyRecord(report.reportSummary)
      ? report.reportSummary
      : {};
  const currentStepRaw = undefined;
  const currentStepId = toNumberOrUndefined(executionState.currentStepId || detail.currentStepId);
  const status = mapV5TaskStatus(detail.statusCode || detail.statusName);
  const checkinAt = toOptionalString(reportSummary.checkinAt) ||
    toOptionalString(executionResult.checkinAt) ||
    null;
  const checkoutAt = toOptionalString(reportSummary.checkoutAt) ||
    toOptionalString(executionResult.checkoutAt) ||
    null;
  const reportSubmittedAt = toOptionalString(reportSummary.submittedOn) ||
    toOptionalString(report.submittedOn) ||
    null;
  const accessOutcomeCode = toOptionalString(detail.accessOutcomeCode) ||
    toOptionalString(executionResult.outcomeCode) ||
    toOptionalString(reportSummary.outcomeCode) ||
    null;

  return {
    taskId: toOptionalString(detail.taskId) || params.taskId,
    taskNo: toOptionalString(detail.taskNo) || params.taskNo,
    status: status || "",
    currentStep: resolveInspectionExecutionStep(currentStepRaw, currentStepId, checkinAt, checkoutAt, reportSubmittedAt),
    currentStepRaw,
    currentStepId,
    taskStatusCode: toOptionalString(detail.statusCode || executionState.taskStatusCode),
    accessOutcomeCode,
    checkinAt,
    checkoutAt,
  };
};

export const createInspectionTask = async (
  data: InspectionTaskUpsertPayload,
  options: CreateInspectionTaskOptions = {},
) => {
  const payload = await mapTaskUpsertPayload(data);
  let validationData: InspectionTaskValidationData = {};

  if (!options.skipValidation) {
    const validation = await request.post<ApiResponse<InspectionTaskValidationData>>(
      "/api/admin/inspection/tasks/validate",
      payload,
      getInspectionApiConfig(),
    );
    validationData = getResponseData<InspectionTaskValidationData>(validation) || {};
    throwBlockingValidationErrors(validationData as AnyRecord);
  }

  const response = await request.post<ApiResponse<number | AnyRecord>>(
    "/api/admin/inspection/tasks",
    payload,
    getInspectionApiConfig(),
  );
  const responseData = getResponseData<number | AnyRecord>(response);
  const taskId = typeof responseData === "object" ? responseData?.taskId || responseData?.id : responseData;
  return wrapResponse(response, {
    ...mapV5TaskDetail({
      ...payload,
      id: taskId,
      taskId,
      statusCode: "Queued",
      statusName: "Queued",
    }),
    validation: validationData,
  } as InspectionTaskDetail);
};

const mapInspectionTaskBatchByActivityPayload = (
  data: InspectionTaskBatchByActivityPayload,
) => ({
    ...data,
    inspectors: data.inspectors || [],
    attachments: mapAttachmentsForV5(data.attachments || []),
  });

export const previewInspectionTasksBatchByActivity = async (
  data: InspectionTaskBatchByActivityPayload,
) => {
  const response = await request.post<ApiResponse<InspectionTaskBatchByActivityPreviewData>>(
    "/api/admin/inspection/tasks/batch-by-activity/preview",
    mapInspectionTaskBatchByActivityPayload(data),
    getInspectionApiConfig(),
  );
  return getResponseData<InspectionTaskBatchByActivityPreviewData>(response);
};

export const createInspectionTasksBatchByActivity = async (
  data: InspectionTaskBatchByActivityPayload,
) => {
  const batchPayload = mapInspectionTaskBatchByActivityPayload(data);
  const response = await request.post<ApiResponse<InspectionTaskBatchByActivityData>>(
    "/api/admin/inspection/tasks/batch-by-activity",
    batchPayload,
    getInspectionApiConfig(),
  );
  const responseData = getResponseData<InspectionTaskBatchByActivityData | null>(response);
  if (!responseData) throw new Error("Empty inspection campaign create response");
  return wrapResponse(response, responseData);
};

export const getInspectionTaskBatchByActivityProgress = async (
  batchId: string,
) => {
  const response = await request.get<ApiResponse<InspectionTaskBatchByActivityProgressData>>(
    `/api/admin/inspection/tasks/batch-by-activity/${encodeURIComponent(batchId)}`,
    {},
    getInspectionApiConfig(),
  );
  return getResponseData<InspectionTaskBatchByActivityProgressData>(response);
};

export const updateInspectionTask = async (
  data: InspectionTaskUpsertPayload,
) => {
  const payload = await mapTaskUpsertPayload(data);
  const response = await request.post<ApiResponse<InspectionTaskDetail | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.edit(data),
    payload,
    getInspectionApiConfig(),
  );
  return wrapResponse(response, getResponseData<InspectionTaskDetail | null>(response) || null);
};

export const assignInspectionTask = async (
  data: AssignInspectionTaskPayload,
) => {
  const inspectors = await mapInspectorAssignments(data.inspectorIds || []);
  const response = await request.post<ApiResponse<InspectionTaskDetail | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.assign(data),
    { inspectors },
    getInspectionApiConfig(),
  );
  return wrapResponse(response, getResponseData<InspectionTaskDetail | null>(response) || null);
};

export const batchAssignInspectionTasks = async (
  taskIds: Array<number | string>,
  inspectorIds: string[],
) => {
  const inspectors = await mapInspectorAssignments(inspectorIds);
  const response = await request.post<ApiResponse<null>>(
    "/api/admin/inspection/tasks/batch-assign",
    { taskIds, inspectors },
    getInspectionApiConfig(),
  );
  return wrapResponse(response, null);
};

export const cancelInspectionTask = async (
  data: CancelInspectionTaskPayload,
) => {
  const response = await request.post<ApiResponse<InspectionTaskDetail | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.cancel(data),
    { cancelReason: data.reason || "Cancelled from task management." },
    getInspectionApiConfig(),
  );
  return wrapResponse(response, getResponseData<InspectionTaskDetail | null>(response) || null);
};

export const duplicateInspectionTask = (
  data: DuplicateInspectionTaskPayload,
) => {
  return request.post<ApiResponse<InspectionTaskDetail | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.duplicate(data),
    { dueDate: data.dueDate || addDaysIso(14) },
    getInspectionApiConfig(),
  );
};

export const getInspectionChecklistTemplate = (
  params: GetInspectionTaskDetailParams,
) => {
  return request.get<ApiResponse<InspectionChecklistTemplateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.checklistTemplate(params),
    params,
    getSilentInspectionApiConfig(),
  );
};

export const getInspectionTaskChecklistItems = (
  params: GetInspectionTaskDetailParams,
) => {
  return request.get<ApiResponse<InspectionChecklistTemplateCatalogItem[]>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.checklistItems(params),
    params,
    getSilentInspectionApiConfig(),
  );
};

export const getInspectionDeclarationTemplate = () => {
  return request.get<ApiResponse<InspectionDeclarationTemplateData>>(
    "/api/admin/inspection/declaration-template",
    {},
    getSilentInspectionApiConfig(),
  );
};

export const getInspectionContactPersonOptions = async (
  params: { taskId: number | string },
): Promise<InspectionContactPersonOption[]> => {
  const endpoint = INSPECTION_TASK_ADMIN_ENDPOINTS.contactPersons(params);
  let response: unknown;
  try {
    response = await request.get<unknown, unknown>(
      endpoint,
      {},
      getSilentInspectionApiConfig(),
    );
  } catch (error) {
    logInspectionContactPersonsApiError(endpoint, error);
    throw error;
  }
  if (!isInspectionContactPersonsResponse(response)) {
    logInspectionContactPersonsInvalidResponse(endpoint, response);
    throw new Error(`Expected ${INSPECTION_CONTACT_PERSONS_EXPECTED_RESPONSE} from ${endpoint}.`);
  }
  return response.data;
};

export const startInspectionVisit = (
  data: StartInspectionVisitPayload,
) => {
  const {
    taskId,
    taskNo,
    ...payload
  } = data;
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.startVisit({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const checkinInspectionTask = (
  data: CheckinInspectionTaskPayload,
) => {
  const {
    taskId,
    taskNo,
    ...payload
  } = data;
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.checkin({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const submitAccessFailedInspectionTask = (
  data: AccessFailedInspectionTaskPayload,
) => {
  const {
    taskId,
    taskNo,
    submittedAt,
    attachments,
    ...payload
  } = data;
  void submittedAt;
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.accessFailed({ taskId, taskNo }),
    {
      ...payload,
      attachments: mapAttachmentsForV5(attachments, "AccessFailed"),
    },
    getInspectionApiConfig(),
  );
};

export const saveInspectionChecklist = (
  data: SaveInspectionChecklistPayload,
) => {
  const items = data.items.map(({ attachments, ...item }) => ({
    ...item,
    attachments: mapAttachmentsForV5(attachments, "ChecklistItem"),
  }));
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.checklist(data),
    { items },
    getInspectionApiConfig(),
  );
};

const getSeizedMaterialTypeCode = (item: AnyRecord) =>
  toOptionalString(item.materialTypeCode) ||
  toOptionalString(item.materialType) ||
  toOptionalString(item.publicationType) ||
  toOptionalString(item.materialTypeName);

const getLanguageId = (item: AnyRecord) =>
  toNumberOrUndefined(item.languageId);

export const saveInspectionSeizedMaterials = (
  data: SaveInspectionSeizedMaterialsPayload,
) => {
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.seizedMaterials(data),
    {
      items: data.items.map((item: AnyRecord) => ({
        materialTypeCode: getSeizedMaterialTypeCode(item),
        isbn: item.isbn,
        title: item.title,
        author: item.author,
        languageId: getLanguageId(item),
        numberOfCopy: item.numberOfCopy || item.numberOfCopies || item.quantity || 1,
        notes: item.notes,
        attachments: mapAttachmentsForV5(item.attachments as InspectionTaskAttachmentPayload[] | undefined, "SeizedMaterial"),
      })),
    },
    getInspectionApiConfig(),
  );
};

export const saveInspectionContactPerson = (
  data: SaveInspectionContactPersonPayload,
) => {
  const {
    taskId,
    taskNo,
    submittedOn,
    declarationAcknowledged,
    hasSignedDeclaration,
    declarationDeclinedReason,
    signatureImageFileName,
    signatureImageFileUrl,
    signatureSignedOn,
    ...payload
  } = data;
  void submittedOn;
  void declarationAcknowledged;
  void hasSignedDeclaration;
  void declarationDeclinedReason;
  void signatureImageFileName;
  void signatureImageFileUrl;
  void signatureSignedOn;
  return request.post<ApiResponse<Record<string, unknown>>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.contactPerson({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const saveInspectionContactPersonDeclaration = (
  data: SaveInspectionContactPersonDeclarationPayload,
) => {
  const {
    taskId,
    taskNo,
    ...payload
  } = data;
  return request.post<ApiResponse<Record<string, unknown>>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.contactPersonDeclaration({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const saveInspectionReinspection = (
  data: SaveInspectionReinspectionPayload,
) => {
  const {
    taskId,
    taskNo,
    ...payload
  } = data;
  return request.post<ApiResponse<Record<string, unknown>>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.reinspection({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const saveInspectionExecutionDraft = (
  data: InspectionExecutionDraftPayload,
) => {
  return request.post<ApiResponse<SaveInspectionExecutionDraftData>>(
    "/api/inspection/execution/draft/save",
    data,
    getInspectionApiConfig(),
  );
};

export const submitInspectionReport = (
  data: SubmitInspectionReportPayload,
) => {
  return request.post<ApiResponse<SubmitInspectionReportData>>(
    "/api/inspection/reports/submit",
    data,
    getInspectionApiConfig(),
  );
};

export const submitInspectionTaskReport = (
  data: SubmitInspectionTaskReportPayload,
) => {
  const {
    taskId,
    taskNo,
    reportFileName,
    reportFileUrl,
    reportSubmittedAt,
    checklistCategories,
    result,
    reportSummary,
    ...payload
  } = data;
  void reportFileName;
  void reportFileUrl;
  void reportSubmittedAt;
  void checklistCategories;
  void result;
  void reportSummary;
  return request.post<ApiResponse<SubmitInspectionReportData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.submitReport({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const checkoutInspectionTask = (
  data: CheckoutInspectionTaskPayload,
) => {
  const {
    taskId,
    taskNo,
    ...payload
  } = data;
  return request.post<ApiResponse<InspectionExecutionStateData>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.checkout({ taskId, taskNo }),
    payload,
    getInspectionApiConfig(),
  );
};

export const getInspectionReportPreview = (
  params: GetInspectionReportPreviewParams,
) => {
  return request.get<ApiResponse<InspectionReportPreview | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.report(params),
    params,
    getSilentInspectionApiConfig(),
  );
};

export const getAdminInspectionTaskReport = (
  params: GetInspectionReportPreviewParams,
) => {
  return request.get<ApiResponse<Record<string, unknown> | null>>(
    INSPECTION_TASK_ADMIN_ENDPOINTS.report(params),
    params,
    getSilentInspectionApiConfig(),
  );
};

const getReportFileCandidate = (record?: AnyRecord | null): InspectionReportPdfFile | null => {
  if (!record) return null;

  const fileName = toOptionalString(record.pdfFileName);
  const fileUrl = toOptionalString(record.pdfFileUrl);

  if (!fileName || !fileUrl) return null;

  return { fileName, fileUrl };
};

const getInspectionReportPdfFileFromPayload = (payload?: AnyRecord | null): InspectionReportPdfFile | null => {
  if (!payload) return null;

  return getReportFileCandidate(payload);
};

export const getInspectionTaskReportPdfFile = async (
  params: GetInspectionReportPreviewParams,
) => {
  const response = await getAdminInspectionTaskReport(params);
  const payload = getResponseData<Record<string, unknown> | null>(response);
  return wrapResponse(response, getInspectionReportPdfFileFromPayload(payload as AnyRecord | null));
};

const PUBLICATION_SUB_TYPE_IDS: Record<string, number> = {
  book: 1,
  newspapermagazine: 2,
  newspaper: 2,
  magazine: 2,
  movie: 3,
  cinema: 3,
  game: 4,
};

const MATERIAL_SUB_TYPE_IDS: Record<string, number> = {
  book: 1,
  books: 1,
  artpublication: 2,
  artisticworks: 2,
  document: 3,
  files: 3,
  file: 3,
  cd: 4,
  other: 5,
};

const PUBLICATION_SUB_TYPE_BY_ID: Record<number, InspectionOcrPublicationType> = {
  1: "BOOK",
  2: "NEWSPAPER_MAGAZINE",
  3: "MOVIE",
  4: "GAME",
};

const MATERIAL_SUB_TYPE_BY_ID: Record<number, InspectionOcrMaterialType> = {
  1: "BOOK",
  2: "ART_PUBLICATION",
  3: "DOCUMENT",
  4: "CD",
  5: "OTHER",
};

const MATERIAL_SUB_TYPE_BY_CODE: Record<string, InspectionOcrMaterialType> = {
  book: "BOOK",
  books: "BOOK",
  artpublication: "ART_PUBLICATION",
  artisticworks: "ART_PUBLICATION",
  document: "DOCUMENT",
  files: "DOCUMENT",
  file: "DOCUMENT",
  cd: "CD",
  other: "OTHER",
};

const PUBLICATION_SUB_TYPE_BY_CODE: Record<string, InspectionOcrPublicationType> = {
  book: "BOOK",
  newspapermagazine: "NEWSPAPER_MAGAZINE",
  newspaper: "NEWSPAPER_MAGAZINE",
  magazine: "NEWSPAPER_MAGAZINE",
  movie: "MOVIE",
  cinema: "MOVIE",
  game: "GAME",
};

export const getInspectionOcrScanTypeId = (
  scanType?: unknown,
): InspectionOcrScanTypeId => (toNumberOrUndefined(scanType) === 2 ? 2 : 1);

const getSubTypeId = (
  scanTypeId: InspectionOcrScanTypeId,
  publicationType?: unknown,
  publicationTypeId?: unknown,
) => {
  const explicitId = toNumberOrUndefined(publicationTypeId);
  const table = scanTypeId === 2 ? MATERIAL_SUB_TYPE_IDS : PUBLICATION_SUB_TYPE_IDS;
  const maxId = scanTypeId === 2 ? 5 : 4;

  if (explicitId && explicitId >= 1 && explicitId <= maxId) return explicitId;
  return table[normalizeText(publicationType)] || 1;
};

const getScanSubTypeFromScanData = (
  scanData: AnyRecord = {},
  scanTypeId: InspectionOcrScanTypeId,
  fallback: InspectionOcrScanSubType = "BOOK",
): InspectionOcrScanSubType => {
  const codeTable = scanTypeId === 2 ? MATERIAL_SUB_TYPE_BY_CODE : PUBLICATION_SUB_TYPE_BY_CODE;
  const rawCode = getFirstValue(scanData, [
    "publicationTypeCode",
    "publicationType",
    "publicationTypeId",
    "type",
  ]);
  const matchedByCode = codeTable[normalizeText(rawCode)];
  if (matchedByCode) return matchedByCode;

  const idTable = scanTypeId === 2 ? MATERIAL_SUB_TYPE_BY_ID : PUBLICATION_SUB_TYPE_BY_ID;
  const subTypeId = toNumberOrUndefined(
    getFirstValue(scanData, ["publicationTypeId", "typeId"]),
  );
  if (subTypeId && idTable[subTypeId]) return idTable[subTypeId];

  return fallback;
};

const getOcrMatchStatusCode = (
  value?: unknown,
): InspectionOcrMatchStatusCode | undefined => {
  const normalized = normalizeText(value);
  if (normalized === "matched") return "matched";
  if (normalized === "notmatched") return "not_matched";
  if (normalized === "pending") return "pending";
  return undefined;
};

const mapOcrMatchItem = (item: AnyRecord = {}): InspectionOcrMatch => ({
  ...item,
  id: toOptionalString(item.contentId ?? item.id ?? item.applicationNo),
  contentId: toNumberOrUndefined(item.contentId),
  contentType: toOptionalString(item.contentType),
  status: toOptionalString(item.status),
  title: toOptionalString(item.title),
  isbn: toOptionalString(item.isbn),
  author: toOptionalString(item.author),
  language: toOptionalString(item.language),
  source: toOptionalString(item.source),
  mediaType: toOptionalString(item.mediaType),
  periodicalType: toOptionalString(item.periodicalType),
  director: toOptionalString(item.director),
  writer: toOptionalString(item.writer),
  category: toOptionalString(item.category),
  chiefEditor: toOptionalString(item.chiefEditor),
  publishingHouse: toOptionalString(item.publishingHouse),
  publisher: toOptionalString(item.publisher ?? item.publishingHouse),
  notes: toOptionalString(item.notes),
  attachmentsUrl: toOptionalString(item.attachmentsUrl),
  type: toOptionalString(item.type ?? item.mediaType),
});

const getOcrMatchItems = (payload?: AnyRecord | AnyRecord[] | null): AnyRecord[] => {
  if (Array.isArray(payload)) return payload.filter(isAnyRecord);
  const items = (payload as AnyRecord)?.items;
  return Array.isArray(items) ? items.filter(isAnyRecord) : [];
};

const mapOcrResult = (
  scanData: AnyRecord = {},
  matchPayload: AnyRecord | null = null,
  fallbackSubType: InspectionOcrScanSubType = "BOOK",
  fallbackScanTypeId: InspectionOcrScanTypeId = 1,
): InspectionOcrResult => {
  const merged: AnyRecord = { ...scanData, ...(matchPayload || {}) };
  const scanTypeId = getInspectionOcrScanTypeId(
    merged.scanType ?? scanData.scanType ?? fallbackScanTypeId,
  );
  const matches = getOcrMatchItems(matchPayload).map(mapOcrMatchItem);
  const matchStatusCode = getOcrMatchStatusCode(merged.matchStatusCode);
  const totalCount = toNumberOrUndefined(merged.totalCount);
  const hasMatch = matchStatusCode
    ? matchStatusCode === "matched"
    : matches.length > 0;

  return {
    ocrId: String(merged.scanId || merged.ocrId || merged.id || ""),
    scanId: toNumberOrUndefined(merged.scanId),
    scanType: scanTypeId,
    publicationType: getScanSubTypeFromScanData(merged, scanTypeId, fallbackSubType),
    publicationTypeCode: toOptionalString(merged.publicationTypeCode),
    publicationTypeId: toNumberOrUndefined(merged.publicationTypeId ?? merged.typeId),
    title: toOptionalString(
      merged.extractedTitle ?? merged.title ?? merged.detectedTitle,
    ),
    author: toOptionalString(merged.extractedAuthor ?? merged.author),
    isbn: toOptionalString(merged.extractedIsbn ?? merged.isbn),
    chiefEditor: toOptionalString(merged.extractedChiefEditor ?? merged.chiefEditor),
    publishingHouse: toOptionalString(
      merged.extractedPublishingHouse ?? merged.publishingHouse,
    ),
    director: toOptionalString(merged.extractedDirector ?? merged.director),
    writer: toOptionalString(merged.extractedWriter ?? merged.writer),
    name: toOptionalString(merged.name),
    barcode: toOptionalString(merged.barcode),
    imageUrl: toOptionalString(merged.imageUrl),
    language: toOptionalString(merged.language),
    quantity: toOptionalString(merged.quantity),
    ocrStatusId: toNumberOrUndefined(merged.ocrStatusId) as InspectionOcrResult["ocrStatusId"],
    ocrStatus: toOptionalString(merged.ocrStatus),
    complianceStatusId: toNumberOrUndefined(
      merged.complianceStatusId,
    ) as InspectionOcrResult["complianceStatusId"],
    enterpriseName: toOptionalString(merged.enterpriseName),
    matchStatusCode,
    totalCount: totalCount ?? matches.length,
    autoExpand: Boolean(merged.autoExpand) || (totalCount ?? matches.length) === 1,
    createdOn: toOptionalString(merged.createdOn),
    completedOn: toOptionalString(merged.completedOn),
    databaseMatch: hasMatch ? "Matched" : "No matched records",
    matchStatus: hasMatch ? "MATCHED" : "UNMATCHED",
    matches,
  };
};

export const scanInspectionOcr = async (
  data: InspectionOcrScanPayload,
) => {
  const scanTypeId = getInspectionOcrScanTypeId(data.scanType);
  const subTypeId = getSubTypeId(scanTypeId, data.publicationType, data.publicationTypeId);
  // Seized materials flow only supports book (1) and cd (4), other sub types omit
  // publicationTypeId. Every other flow always sends it.
  const shouldSendPublicationTypeId = data.flow === "seizedMaterials"
    ? subTypeId === 1 || subTypeId === 4
    : true;
  const response = await request.post<ApiResponse<AnyRecord>>(
    "/api/admin/inspection/ocr/scan",
    {
      taskId: data.taskId,
      taskNo: data.taskNo,
      scanType: scanTypeId,
      ...(shouldSendPublicationTypeId ? { publicationTypeId: subTypeId } : {}),
      imageFile: data.imageFile,
    },
    {
      ...getInspectionApiConfig({ skipErrorMessage: true }),
      timeout: 300 * 1000,
    },
  );
  const scanData = getResponseData<AnyRecord>(response) || {};
  // The checklist flow (scanType 1) shows the matching panel, so the match list
  // has to be loaded right after the scan. The seized materials flow (scanType 2)
  // does not need the match list and reads everything from the scan response, so
  // skip that request.
  const scanId = scanData.scanId ?? scanData.ocrId ?? scanData.id;
  const matchResponse = scanTypeId === 1 && scanId !== undefined && scanId !== null
    ? await request.get<ApiResponse<AnyRecord>>(
      `/api/admin/inspection/ocr/${encodeURIComponent(String(scanId))}/matches2`,
      {},
      getSilentInspectionApiConfig(),
    ).catch(() => null)
    : null;
  const matchPayload = matchResponse ? getResponseData<AnyRecord>(matchResponse) : null;
  return wrapResponse(
    response,
    mapOcrResult(scanData, matchPayload, data.publicationType, scanTypeId),
  );
};

const OCR_EDIT_FIELDS_BY_SUB_TYPE_ID: Record<
  InspectionOcrScanTypeId,
  Record<number, (keyof InspectionOcrEditPayload)[]>
> = {
  1: {
    1: ["title", "author", "isbn"],
    2: ["title", "chiefEditor", "publishingHouse"],
    3: ["title", "director", "writer"],
    4: ["title"],
  },
  2: {
    1: ["title", "author", "isbn", "language"],
  },
};

const buildInspectionOcrEditPayload = (
  scanTypeId: InspectionOcrScanTypeId,
  subTypeId: number,
  data: InspectionOcrEditPayload,
): InspectionOcrEditPayload => {
  const fields = OCR_EDIT_FIELDS_BY_SUB_TYPE_ID[scanTypeId][subTypeId] || ["title"];

  return fields.reduce<InspectionOcrEditPayload>((payload, field) => {
    payload[field] = data[field] ?? undefined;
    return payload;
  }, {});
};

export const updateInspectionOcrScan = async (
  scanId: number | string,
  data: InspectionOcrEditPayload,
  context: {
    scanType?: InspectionOcrScanTypeId;
    publicationType?: InspectionOcrScanSubType;
    publicationTypeId?: number | string;
  } = {},
) => {
  const scanTypeId = getInspectionOcrScanTypeId(context.scanType);
  const subTypeId = getSubTypeId(scanTypeId, context.publicationType, context.publicationTypeId);
  const response = await request.post<ApiResponse<AnyRecord>>(
    `/api/admin/inspection/ocr/${encodeURIComponent(String(scanId))}/edit`,
    buildInspectionOcrEditPayload(scanTypeId, subTypeId, data),
    getInspectionApiConfig({ skipErrorMessage: true }),
  );
  const scanData = getResponseData<AnyRecord>(response) || {};
  // The edited fields change the matching input, so the match list has to be
  // reloaded to keep the matching panel in sync with the saved values. Only the
  // checklist flow (scanType 1) shows the matching panel; the seized materials
  // flow (scanType 2) does not need the match list, so skip that request.
  const matchResponse = scanTypeId === 1
    ? await request.get<ApiResponse<AnyRecord>>(
      `/api/admin/inspection/ocr/${encodeURIComponent(String(scanId))}/matches2`,
      {},
      getSilentInspectionApiConfig(),
    ).catch(() => null)
    : null;
  const matchPayload = matchResponse ? getResponseData<AnyRecord>(matchResponse) : null;
  return wrapResponse(
    response,
    mapOcrResult(
      scanData,
      matchPayload,
      context.publicationType || "BOOK",
      scanTypeId,
    ),
  );
};

export const getInspectionOcrTaskResults = (
  taskId: number | string,
) => request.get<ApiResponse<InspectionOcrResult[]>>(
  `/api/admin/inspection/ocr/tasks/${encodeURIComponent(String(taskId))}/results`,
  {},
  getSilentInspectionApiConfig(),
);

export const saveInspectionOcrResult = (
  data: InspectionOcrResult,
) => {
  return request.post<ApiResponse<InspectionOcrResult>>(
    "/api/inspection/ocr/result/save",
    data,
    getInspectionApiConfig(),
  );
};

const mapViolationStatus = (status?: unknown) => {
  const value = normalizeCodeValue(status);
  if (value === "UNDER_REVIEW") return "PENDING_REVIEW";
  if (value === "RECTIFICATION_REQUIRED") return "RECTIFICATION";
  if (value === "CLOSED") return "PAID";
  return value || "OPEN";
};

const getViolationTypeNameFromValue = (value: unknown) => {
  const normalized = normalizeCodeValue(value);
  if (!normalized) return "";
  if (normalized === "1" || normalized.includes("LICENS")) return "License Violation";
  if (normalized === "2" || normalized.includes("CONTENT")) return "Content Violation";
  return "";
};

const getViolationTypeName = (row: AnyRecord) => {
  const direct = toOptionalString(row.violationTypeName);
  if (direct) return direct;
  return getViolationTypeNameFromValue(row.violationTypeCode || row.violationTypeId);
};

const getNestedViolationRows = (row: AnyRecord): AnyRecord[] => [
  row,
  ...[
    row.reportedItems,
    row.checklistViolations,
  ].flatMap((value) => (Array.isArray(value) ? value.filter(isAnyRecord) : [])),
];

const getFirstViolationClauseValue = (
  row: AnyRecord,
  key: string,
) => {
  for (const source of getNestedViolationRows(row)) {
    const value = toOptionalString(source[key]);
    if (value) return value;
  }
  return undefined;
};

const getViolationClauseFields = (row: AnyRecord) => {
  return {
    violationDescription: getFirstViolationClauseValue(row, "violationDescription"),
    violationDescriptionEn: getFirstViolationClauseValue(row, "violationDescriptionEn"),
    violationDescriptionAr: getFirstViolationClauseValue(row, "violationDescriptionAr"),
  };
};

const getPascalCodeValue = (value?: unknown) =>
  normalizeCodeValue(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const VIOLATION_TYPE_ID_MAP: Record<string, number> = {
  LICENSING: 1,
  LICENSING_VIOLATION: 1,
  LICENSE: 1,
  LICENSE_VIOLATION: 1,
  CONTENT: 2,
  CONTENT_VIOLATION: 2,
};

const VIOLATION_STATUS_ID_MAP: Record<string, InspectionViolationStatus> = {
  "1": "WARNING_ISSUED",
  "2": "PENDING_ROUTING",
  "3": "PENDING_CONTENT_REPORT",
  "4": "PENDING_REVIEW",
  "5": "PENDING_COMMITTEE_DECISION",
  "6": "PENDING_APPROVAL",
  "7": "PENDING_PAYMENT",
  "8": "UNDER_APPEAL",
  "9": "PAID",
  "10": "CANCELLED",
};

export const getInspectionViolationStatusFromId = (
  statusId?: number | string | null,
): InspectionViolationStatus | undefined => {
  const statusIdValue = toOptionalString(statusId);
  if (!statusIdValue) return undefined;

  const statusIdKey = Number.isFinite(Number(statusIdValue))
    ? String(Number(statusIdValue))
    : statusIdValue;

  return VIOLATION_STATUS_ID_MAP[statusIdKey];
};

const getSingleViolationStatusCode = (statuses?: unknown[]) => {
  if (!Array.isArray(statuses) || statuses.length !== 1) return undefined;
  return getPascalCodeValue(statuses[0]) || undefined;
};

const getSingleViolationTypeId = (types?: unknown[]) => {
  if (!Array.isArray(types) || types.length !== 1) return undefined;
  const normalized = normalizeCodeValue(types[0]);
  return VIOLATION_TYPE_ID_MAP[normalized];
};

const mapViolationScope = (params: ViolationListParams) => {
  const tab = String(params.tab || "").toLowerCase();
  if (tab === "todo") return "Todo";
  if (tab === "completed") return "Completed";
  return undefined;
};

const mapViolationAvailableActions = (actions: unknown) => {
  if (!Array.isArray(actions)) return undefined;
  return actions
    .filter((action): action is string => typeof action === "string" && Boolean(action.trim()));
};

const mapV5ViolationItem = (row: AnyRecord = {}): InspectionViolationItem => {
  const violationId = toOptionalString(row.violationId) || toOptionalString(row.id);
  const statusValue = row.businessStatusCode ||
    row.internalStatusCode ||
    row.statusCode ||
    row.businessStatusName ||
    row.internalStatusName ||
    row.statusName;
  const statusIdValue = toOptionalString(row.statusId);
  const statusIdKey = statusIdValue && Number.isFinite(Number(statusIdValue))
    ? String(Number(statusIdValue))
    : statusIdValue;
  const status = (
    (statusValue !== undefined && statusValue !== null && statusValue !== ""
      ? mapViolationStatus(statusValue)
      : undefined) ||
    getInspectionViolationStatusFromId(statusIdKey) ||
    mapViolationStatus(statusIdValue)
  ) as InspectionViolationStatus;
  const violationTypeName = getViolationTypeName(row);
  const sourceTaskNo = toOptionalString(row.sourceTaskNo) || toOptionalString(row.taskNo);
  const sourceTask = sourceTaskNo;
  const reportedByName = toOptionalString(row.reportedByName);
  const violatorName = toOptionalString(row.violatorName);
  const createdOn = row.createdOn as string | undefined;
  const lastUpdatedOn = row.lastUpdatedOn as string | undefined;
  const sla = (isAnyRecord(row.sla) ? row.sla : undefined) as InspectionSlaSummary | undefined;
  const clauseFields = getViolationClauseFields(row);
  const clauseTitle = clauseFields.violationDescriptionEn ||
    clauseFields.violationDescription ||
    String(row.violationTypeName || row.violationTypeCode || "");

  return {
    id: violationId || "",
    violationId: violationId || "",
    violationNo: String(row.violationNo || ""),
    violationCode: String(row.violationTypeCode || ""),
    title: clauseTitle,
    violationName: clauseTitle,
    violationDescription: clauseFields.violationDescription,
    violationDescriptionEn: clauseFields.violationDescriptionEn,
    violationDescriptionAr: clauseFields.violationDescriptionAr,
    violationType: violationTypeName,
    violationTypeId: toNumberOrUndefined(row.violationTypeId),
    violationTypeCode: toOptionalString(row.violationTypeCode),
    violationTypeName,
    reason: String(row.inspectionReasonName || ""),
    level: String(row.degree || ""),
    severity: String(row.degree || ""),
    severityNameEn: String(row.degree || ""),
    status,
    statusCode: toOptionalString(row.statusCode),
    statusName: toOptionalString(row.statusName),
    internalStatusCode: toOptionalString(row.internalStatusCode),
    internalStatusName: toOptionalString(row.internalStatusName),
    businessStatusCode: toOptionalString(row.businessStatusCode),
    businessStatusName: toOptionalString(row.businessStatusName),
    description: toOptionalString(row.description),
    location: toOptionalString(row.location),
    inspectionDate: createdOn,
    issuedTime: createdOn,
    createdOn,
    createdAt: createdOn,
    lastUpdatedOn,
    updatedAt: lastUpdatedOn,
    taskId: toNumberOrUndefined(row.taskId),
    taskNo: sourceTaskNo || "",
    sourceTaskId: toNumberOrUndefined(row.sourceTaskId),
    sourceTaskNo,
    sourceTask,
    establishmentId: toNumberOrUndefined(row.establishmentId),
    individualId: toNumberOrUndefined(row.individualId),
    establishmentNameEn: violatorName || "",
    violatorName,
    violatorIdentifier: toOptionalString(row.violatorIdentifier),
    categoryName: toOptionalString(row.violationTypeName),
    penaltyBasis: toOptionalString(row.penaltyBasis),
    assignedInspector: reportedByName,
    reportedBy: reportedByName,
    reportedByName,
    workflowOwner: toOptionalString(row.handlerUserName),
    fineAmount: toNumberOrUndefined(row.fineAmount),
    sla,
    slaLabel: toOptionalString(row.slaLabel) || toOptionalString(sla?.displayText),
    slaDeadlineAt: (row.slaDeadlineAt as string | undefined) || sla?.dueOn,
    isAutoGenerated: Boolean(row.isAutoGenerated),
    availableActions: mapViolationAvailableActions(row.availableActions),
    violationReportUrl: toOptionalString(row.violationReportUrl),
    inspectionTarget: {
      targetType: 0,
      targetTypeCode: toOptionalString(row.targetTypeCode),
      targetTypeName: "",
      establishmentNameEn: violatorName || "",
      licenseNumber: String(row.violatorIdentifier || ""),
    },
  };
};

const mapViolationListParams = (params: ViolationListParams) => {
  const filters = params.filters || {};
  return {
    pageIndex: params.pageIndex || 1,
    pageSize: params.pageSize || 10,
    role: params.role,
    tab: params.tab,
    scope: mapViolationScope(params),
    search: params.keyword,
    statusId: getSingleViolationStatusCode(filters.statusList),
    violationTypeId: getSingleViolationTypeId(filters.typeList),
    reportBy: filters.reportBy,
    createdOnFrom: filters.createdOnFrom || filters.issuedTimeFrom,
    createdOnTo: filters.createdOnTo || filters.issuedTimeTo,
    sortBy: params.sortBy,
    sortDirection: params.sortDirection,
  };
};

const mapViolationExportParams = (params: ViolationListParams) => {
  const query: Partial<ReturnType<typeof mapViolationListParams>> = {
    ...mapViolationListParams(params),
  };
  delete query.pageIndex;
  delete query.pageSize;
  return query;
};

const addViolationSummaryCount = (
  summary: ViolationSummaryMap,
  status: unknown,
  count: unknown,
) => {
  if (status === undefined || status === null || status === "") return;
  const normalizedStatus = mapViolationStatus(status);
  const numericCount = Number(count ?? 0);
  if (!normalizedStatus || !Number.isFinite(numericCount)) return;
  summary[normalizedStatus] = (summary[normalizedStatus] || 0) + numericCount;
};

const getViolationStatsEntryStatus = (entry: AnyRecord) => {
  const statusValue = getFirstValue(entry, [
    "statusCode",
    "statusName",
    "status",
    "businessStatusCode",
    "businessStatusName",
    "internalStatusCode",
    "internalStatusName",
  ]);
  if (statusValue !== undefined) return mapViolationStatus(statusValue);

  const statusId = toOptionalString(getFirstValue(entry, ["statusId", "id"]));
  return getInspectionViolationStatusFromId(statusId);
};

const mapViolationStats = (response: unknown): ViolationSummaryMap => {
  const data = getResponseData<AnyRecord>(response) || {};
  const summary: ViolationSummaryMap = {};

  if (isAnyRecord(data.summary)) {
    Object.entries(data.summary).forEach(([status, count]) => {
      addViolationSummaryCount(summary, status, count);
    });
  }

  const statuses = Array.isArray(data.statuses)
    ? data.statuses
    : Array.isArray(data.statusCounts)
      ? data.statusCounts
      : Array.isArray(data.items)
        ? data.items
        : [];

  statuses.forEach((entry) => {
    if (!isAnyRecord(entry)) return;
    addViolationSummaryCount(
      summary,
      getViolationStatsEntryStatus(entry),
      getFirstValue(entry, ["count", "totalCount", "total", "value"]),
    );
  });

  const statusCounts = data.statusCounts;
  if (isAnyRecord(statusCounts)) {
    Object.entries(statusCounts).forEach(([status, count]) => {
      addViolationSummaryCount(summary, status, count);
    });
  }

  const countFields: Array<[string, InspectionViolationStatus]> = [
    ["warningIssuedCount", "WARNING_ISSUED"],
    ["pendingRoutingCount", "PENDING_ROUTING"],
    ["pendingContentReportCount", "PENDING_CONTENT_REPORT"],
    ["pendingReviewCount", "PENDING_REVIEW"],
    ["reportSubmittedCount", "REPORT_SUBMITTED"],
    ["pendingCommitteeDecisionCount", "PENDING_COMMITTEE_DECISION"],
    ["pendingApprovalCount", "PENDING_APPROVAL"],
    ["pendingPaymentCount", "PENDING_PAYMENT"],
    ["underAppealCount", "UNDER_APPEAL"],
    ["paidCount", "PAID"],
    ["resolvedCount", "RESOLVED"],
    ["cancelledCount", "CANCELLED"],
  ];

  countFields.forEach(([field, status]) => {
    if (data[field] !== undefined) addViolationSummaryCount(summary, status, data[field]);
  });

  return summary;
};

export const getInspectionViolations = async (
  params: ViolationListParams,
) => {
  const response = await request.get<ViolationListResponse>(
    "/api/admin/inspection/violations",
    mapViolationListParams(params),
    getSilentInspectionApiConfig(),
  );
  const data = getResponseData<AnyRecord>(response) || {};
  const rawItems = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
  const items = rawItems.map((row) => ({
    ...mapV5ViolationItem(row),
    availableActions: mapViolationAvailableActions((row as AnyRecord).availableActions),
  }));
  return wrapResponse(response, {
    items,
    total: Number(data.totalCount ?? data.total ?? items.length),
    pageIndex: Number(data.pageIndex || params.pageIndex || 1),
    pageSize: Number(data.pageSize || params.pageSize || 10),
    summary: data.summary,
    filterOptions: data.filterOptions,
  });
};

export const exportInspectionViolations = (
  params: ViolationListParams,
) => request.getRaw<Blob>(
  "/api/admin/inspection/violations/export",
  mapViolationExportParams(params),
  { ...getSilentInspectionApiConfig(), responseType: "blob" },
);

export type InspectionTargetViolationListParams = {
  establishmentId?: number | string;
  individualId?: number | string;
  taskId?: number | string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  violationTypeId?: number | string;
  statusId?: number | string;
};

export const getInspectionTargetViolations = async (
  params: InspectionTargetViolationListParams,
) => {
  const response = await request.get<ApiResponse<AnyRecord[] | AnyRecord>>(
    "/api/admin/inspection/violations/by-target",
    params,
    getSilentInspectionApiConfig(),
  );
  const data = getResponseData<AnyRecord[] | AnyRecord>(response);
  const dataRecord =
    data && !Array.isArray(data) && typeof data === "object"
      ? data as AnyRecord
      : {};
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(dataRecord.items)
      ? dataRecord.items
      : Array.isArray(dataRecord.data)
        ? dataRecord.data
        : [];
  const statuses = Array.isArray(dataRecord.statuses) ? dataRecord.statuses : [];
  const items = rawItems.map(mapV5ViolationItem);
  return wrapResponse(response, {
    items,
    total: Number(dataRecord.totalCount ?? dataRecord.total ?? items.length),
    pageIndex: Number(dataRecord.pageIndex || 1),
    pageSize: Number(dataRecord.pageSize || items.length || 10),
    statuses,
  });
};

export const getInspectionViolationStats = async () => {
  const response = await request.get<ViolationStatsResponse>(
    "/api/admin/inspection/violations/stats",
    undefined,
    getSilentInspectionApiConfig(),
  );
  return wrapResponse(response, mapViolationStats(response));
};

const resolveViolationId = async (params: ViolationDetailParams) => {
  if (params.id || params.violationId) return String(params.id || params.violationId);
  if (!params.violationNo) return "";
  const listResponse = await getInspectionViolations({
    keyword: params.violationNo,
    pageIndex: 1,
    pageSize: 1,
  });
  const item = listResponse.data.items[0];
  return String(item?.id || item?.violationId || "");
};

export const getInspectionViolationTargetOverview = async (
  params: ViolationDetailParams,
) => {
  const violationId = await resolveViolationId(params);
  if (!violationId) return wrapResponse(null, undefined as InspectionTaskTargetOverview | undefined);

  const response = await request.get<ApiResponse<InspectionTaskTargetOverview | null>>(
    getAdminInspectionViolationPath(violationId, "/target-overview"),
    {},
    getSilentInspectionApiConfig(),
  );
  const targetOverview = getResponseData<InspectionTaskTargetOverview | null>(response);

  return wrapResponse(
    response,
    isAnyRecord(targetOverview) ? targetOverview as InspectionTaskTargetOverview : undefined,
  );
};

const getViolationTimelineItems = (value: unknown): AnyRecord[] => {
  if (Array.isArray(value)) return value as AnyRecord[];
  if (!value || typeof value !== "object") return [];
  const record = value as AnyRecord;
  if (Array.isArray(record.items)) return record.items as AnyRecord[];
  if (Array.isArray(record.timeline)) return record.timeline as AnyRecord[];
  return [];
};

const getViolationTimelineTime = (item: InspectionViolationTimelineItem) => (
  item.displayTime || item.createdOn || ""
);

const inferViolationTimelineActorType = (
  eventType?: string,
  actor?: string,
): InspectionViolationTimelineItem["actorType"] => {
  const normalizedActor = normalizeCodeValue(actor);
  if (
    normalizedActor.includes("SYSTEM") ||
    normalizedActor.includes("AUTOMATED") ||
    normalizedActor.includes("AI_GENERATED")
  ) {
    return "system";
  }
  if (normalizedActor.includes("CUSTOMER") || normalizedActor.includes("VIOLATOR")) {
    return "violator";
  }

  const normalizedEvent = normalizeCodeValue(eventType);
  if (
    normalizedEvent.includes("CREATED") ||
    normalizedEvent.includes("WARNING") ||
    normalizedEvent.includes("FINE_GENERATED") ||
    normalizedEvent.includes("PAYMENT")
  ) {
    return "system";
  }

  return "user";
};

const mapViolationTimelineItem = (
  item: AnyRecord,
  index: number,
): InspectionViolationTimelineItem => {
  const eventType = String(item.eventType || "");
  const title = String(
    item.displayTitle ||
      item.label ||
      eventType ||
      "-",
  );
  const createdOn = toOptionalString(item.createdOn || item.displayTime);
  const operatorName = toOptionalString(item.displayActor || item.actualActorUserName || item.operatorName);
  const handlerUserName = toOptionalString(item.handlerUserName || item.pendingHandlerUserName);
  const actor = operatorName || handlerUserName;
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {};

  return {
    ...item,
    key: String(getFirstValue(item, ["id", "key"]) || `${eventType || title}-${createdOn || index}`),
    id: item.id as string | number | undefined,
    eventType,
    rawEventType: toOptionalString(item.rawEventType),
    title,
    label: toOptionalString(item.label) || title,
    displayTitle: toOptionalString(item.displayTitle),
    displayActor: toOptionalString(item.displayActor),
    displayTime: toOptionalString(item.displayTime),
    displayDetails: toOptionalString(item.displayDetails),
    displayStatusCode: toOptionalString(item.displayStatusCode),
    displayStatusName: toOptionalString(item.displayStatusName),
    internalStatusCode: toOptionalString(item.internalStatusCode),
    internalStatusName: toOptionalString(item.internalStatusName),
    isCurrentStatusEvent: Boolean(item.isCurrentStatusEvent),
    description: toOptionalString(item.displayDetails),
    actor,
    actorType: item.actorType as InspectionViolationTimelineItem["actorType"] ||
      inferViolationTimelineActorType(eventType, actor || handlerUserName),
    operator: toOptionalString(item.operator),
    operatorName,
    operatorRoleId: item.operatorRoleId as string | number | null | undefined,
    handlerUserId: item.handlerUserId as string | number | null | undefined,
    handlerUserName,
    departmentId: item.departmentId as string | number | null | undefined,
    fromStatusId: item.fromStatusId as string | number | null | undefined,
    fromStatusName: toOptionalString(item.fromStatusName),
    fromStatusCode: toOptionalString(item.fromStatusCode),
    toStatusId: item.toStatusId as string | number | null | undefined,
    toStatusName: toOptionalString(item.toStatusName),
    toStatusCode: toOptionalString(item.toStatusCode),
    result: toOptionalString(item.result),
    time: createdOn,
    createdOn,
    fineAmount: item.fineAmount as number | string | null | undefined,
    attachments: Array.isArray(item.attachments)
      ? item.attachments as InspectionViolationDetailAttachment[]
      : undefined,
    metadata,
  };
};

const normalizeViolationTimelineItems = (items: AnyRecord[]) => (
  items
    .map(mapViolationTimelineItem)
    .sort((currentItem, nextItem) => {
      const currentTime = Date.parse(getViolationTimelineTime(currentItem));
      const nextTime = Date.parse(getViolationTimelineTime(nextItem));
      return (Number.isNaN(nextTime) ? 0 : nextTime) - (Number.isNaN(currentTime) ? 0 : currentTime);
    })
);

const getFileNameFromPath = (path?: string) => {
  const fileName = toOptionalString(path?.split(/[?#]/)[0].split("/").filter(Boolean).pop());
  if (!fileName) return undefined;

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
};

const normalizeViolationContentReviewReport = (
  detail: AnyRecord,
): InspectionViolationContentReviewReport | null | undefined => {
  const existingReport = isAnyRecord(detail.contentReviewReport)
    ? detail.contentReviewReport as InspectionViolationContentReviewReport
    : undefined;
  const summary = existingReport?.summary || toOptionalString(detail.contentReviewSummary);
  const existingAttachments = Array.isArray(existingReport?.attachments)
    ? existingReport.attachments
    : [];
  const reportUrl = toOptionalString(detail.contentReviewReportUrl);
  const attachments = existingAttachments.length || !reportUrl
    ? existingAttachments
    : [{
      key: reportUrl,
      name: getFileNameFromPath(reportUrl) || "Content Review Report",
      url: reportUrl,
      type: getFileNameFromPath(reportUrl)?.split(".").pop(),
    }];

  if (existingReport || summary || attachments.length) {
    return {
      ...(existingReport || {}),
      ...(summary ? { summary } : {}),
      ...(attachments.length ? { attachments } : {}),
    };
  }

  return detail.contentReviewReport === null ? null : undefined;
};

const normalizeViolationDetailAttachment = (
  attachment: AnyRecord,
  index: number,
): InspectionViolationDetailAttachment => ({
  key: toOptionalString(attachment.id) || index,
  name: toOptionalString(attachment.fileName) ||
    getFileNameFromPath(toOptionalString(attachment.fileUrl)) ||
    `Attachment ${index + 1}`,
  url: toOptionalString(attachment.fileUrl),
  type: toOptionalString(attachment.contentType),
});

const normalizeViolationDetailAttachments = (value: unknown): InspectionViolationDetailAttachment[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeViolationDetailAttachment(item as AnyRecord, index));
  }
  if (isAnyRecord(value)) {
    return [normalizeViolationDetailAttachment(value, 0)];
  }
  return [];
};

const buildAppealAttachments = (appeal: AnyRecord) => [
  appeal.attachmentUrl1,
  appeal.attachmentUrl2,
  appeal.attachmentUrl3,
]
  .map(toOptionalString)
  .filter(Boolean)
  .map((url, index) => ({
    key: `appeal-${index + 1}`,
    name: getFileNameFromPath(url) || `Appeal Attachment ${index + 1}`,
    url,
  }));

const buildPaymentReceiptAttachments = (payment: AnyRecord): InspectionViolationDetailAttachment[] => {
  const receiptFileUrl = toOptionalString(payment.receiptFileUrl);
  if (!receiptFileUrl) return [];

  return [
    {
      key: "payment-receipt",
      name: toOptionalString(payment.receiptFileName) ||
        getFileNameFromPath(receiptFileUrl) ||
        "Payment Receipt",
      url: receiptFileUrl,
    },
  ];
};

const normalizeViolationPaymentDetails = (
  detail: AnyRecord,
): InspectionViolationPaymentDetails | null => {
  if (!isAnyRecord(detail.payment)) return null;

  const payment = detail.payment;
  const paymentStatus = toOptionalString(payment.paymentStatusName);
  const amount = payment.amountDue as number | string | null | undefined;
  const dueDate = toOptionalString(payment.dueDate);
  const paidOn = toOptionalString(payment.paidOn);
  const receiptNo = toOptionalString(payment.paymentReferenceNo) ||
    toOptionalString(payment.receiptNo);
  const attachments = [
    ...normalizeViolationDetailAttachments(payment.attachments),
    ...buildPaymentReceiptAttachments(payment),
  ];

  if (!paymentStatus && amount === undefined && !dueDate && !paidOn && !receiptNo && !attachments.length) {
    return null;
  }

  return {
    paymentStatus,
    amount,
    dueDate,
    paidOn,
    receiptNo,
    attachments,
  };
};

const normalizeViolationAppealDetails = (
  detail: AnyRecord,
): InspectionViolationAppealDetails | null => {
  const appeal = isAnyRecord(detail.relatedAppeal) ? detail.relatedAppeal : null;

  if (!appeal) return null;

  const reasonRemark = toOptionalString(appeal?.appealReasonRemark);
  const reasonName = toOptionalString(appeal?.appealReason);
  const attachments = [
    ...normalizeViolationDetailAttachments(appeal?.attachments),
    ...(appeal ? buildAppealAttachments(appeal) : []),
  ];

  return {
    appealNo: toOptionalString(appeal?.appealNo),
    appealStatus: toOptionalString(appeal?.statusName),
    submittedBy: toOptionalString(appeal?.createdByName),
    submittedOn: toOptionalString(appeal?.createdOn),
    reason: reasonRemark || reasonName,
    oldFineAmount: appeal?.oldFineAmount as number | string | null | undefined,
    newFineAmount: appeal?.newFineAmount as number | string | null | undefined,
    attachments,
  };
};

const normalizeViolationCommitteeDecision = (
  detail: AnyRecord,
): InspectionViolationCommitteeDecision | null => {
  if (isAnyRecord(detail.committeeDecision)) {
    return detail.committeeDecision as InspectionViolationCommitteeDecision;
  }

  const decision = toOptionalString(detail.committeeDecisionTypeName);
  const outcome = toOptionalString(detail.committeeDecisionStatusName);
  const decisionBy = toOptionalString(detail.committeeDecidedByName);
  const decisionDate = toOptionalString(detail.committeeDecidedOn);
  const notes = toOptionalString(detail.committeeDecisionNote);
  const reason = toOptionalString(detail.committeeDecisionReason);
  const fineAmount = detail.committeeFineAmount as number | string | null | undefined;

  if (!decision && !outcome && !decisionBy && !decisionDate && !notes && !reason && fineAmount === undefined) {
    return null;
  }

  return {
    decision,
    outcome,
    decisionBy,
    decisionDate,
    fineAmount,
    notes,
    reason,
  };
};

const normalizeViolationRelatedReinspectionSource = (
  source: AnyRecord,
): InspectionViolationRelatedReinspection | null => {
  const taskId = toOptionalString(source.taskId);
  const taskNo = toOptionalString(source.taskNo);
  const status = toOptionalString(source.statusName);
  const inspector = toOptionalString(source.inspector);
  const dueDate = toOptionalString(source.dueDate);

  if (!taskId && !taskNo && !status && !inspector && !dueDate) return null;

  return {
    taskId,
    taskNo,
    status,
    inspector,
    dueDate,
  };
};

const normalizeViolationRelatedReinspection = (
  detail: AnyRecord,
): InspectionViolationRelatedReinspection | null => {
  const reinspectionTasks = detail.reinspectionTasks;
  const reinspectionTask = Array.isArray(reinspectionTasks)
    ? reinspectionTasks[0]
    : reinspectionTasks;

  return isAnyRecord(reinspectionTask)
    ? normalizeViolationRelatedReinspectionSource(reinspectionTask)
    : null;
};

const normalizeViolationRelatedAppeal = (
  detail: AnyRecord,
): InspectionViolationRelatedAppeal | null => {
  const appeal = isAnyRecord(detail.relatedAppeal) ? detail.relatedAppeal : null;

  if (!appeal) return null;

  const appealId = (appeal?.id ?? appeal?.appealId) as string | number | null | undefined;
  const appealNo = toOptionalString(appeal?.appealNo);
  const status = toOptionalString(appeal?.statusName);
  const submittedOn = toOptionalString(appeal?.createdOn);
  const slaDueOn = toOptionalString(appeal?.slaDueOn);
  const reason = toOptionalString(appeal?.appealReasonRemark) ||
    toOptionalString(appeal?.appealReason);

  if (!appealId && !appealNo && !status && !submittedOn && !slaDueOn && !reason) return null;

  return {
    appealId,
    appealNo,
    status,
    submittedOn,
    slaDueOn,
    reason,
  };
};

const normalizeViolationOverview = (
  detail: AnyRecord,
  inspectionTarget?: InspectionTarget,
): InspectionViolationOverview | undefined => {
  const target = inspectionTarget as AnyRecord | undefined;
  const targetName = toOptionalString(target?.establishmentNameEn) ||
    toOptionalString(detail.violatorName);
  const licenseNumber =
    toOptionalString(target?.licenseNumber) ||
    toOptionalString(detail.violatorIdentifier);
  const fields: InspectionViolationOverviewField[] = [
    targetName ? { label: "Establishment Name", value: targetName } : null,
    licenseNumber ? { label: "Commercial License Number", value: licenseNumber } : null,
  ].filter(Boolean) as InspectionViolationOverviewField[];
  const profileType = toOptionalString(target?.targetTypeName);

  if (!fields.length && !profileType) {
    return undefined;
  }

  return {
    profileType,
    fields,
  };
};

export const getInspectionViolationDetail = async (
  params: ViolationDetailParams,
) => {
  const violationId = await resolveViolationId(params);
  if (!violationId) return wrapResponse(null, null);
  const detailResponse = await request.get<ViolationDetailResponse>(
    getAdminInspectionViolationPath(violationId),
    {},
    getSilentInspectionApiConfig(),
  );
  const detail = getResponseData<AnyRecord | null>(detailResponse);
  if (!detail) return wrapResponse(detailResponse, null);
  const detailTimeline = normalizeViolationTimelineItems(getViolationTimelineItems(detail.timeline));
  const contentReviewReport = normalizeViolationContentReviewReport(detail);
  const detailTarget = isAnyRecord(detail.inspectionTarget) ? detail.inspectionTarget : undefined;
  const inspectionTarget = detailTarget as InspectionTarget | undefined;
  const paymentDetails = normalizeViolationPaymentDetails(detail);
  const appealDetails = normalizeViolationAppealDetails(detail);
  const committeeDecision = normalizeViolationCommitteeDecision(detail);
  const relatedAppeal = normalizeViolationRelatedAppeal(detail);
  const relatedReinspection = normalizeViolationRelatedReinspection(detail);
  const violatorOverview = normalizeViolationOverview(detail, inspectionTarget);

  return wrapResponse(detailResponse, {
    ...mapV5ViolationItem(detail),
    ...detail,
    inspectionTarget,
    contentReviewReport,
    committeeDecision,
    paymentDetails,
    appealDetails,
    relatedAppeal,
    relatedReinspection,
    violatorOverview,
    violationTimeline: detailTimeline,
    availableActions: mapViolationAvailableActions(detail.availableActions),
  } as ViolationDetailData);
};

export const getInspectionViolationDetailOptionalData = async (
  params: ViolationDetailParams,
  fallbackTimeline: InspectionViolationTimelineItem[] = [],
) => {
  const violationId = await resolveViolationId(params);
  if (!violationId) {
    return wrapResponse(null, {
      violationTimeline: fallbackTimeline,
    } as Partial<ViolationDetailData>);
  }

  const [timelineResponse, targetOverviewResponse] = await Promise.all([
    request.get<ApiResponse<AnyRecord[]>>(
      getAdminInspectionViolationPath(violationId, "/timeline"),
      {},
      getSilentInspectionApiConfig(),
    ).catch(() => null),
    getInspectionViolationTargetOverview({ id: violationId }).catch(() => null),
  ]);
  const timeline = timelineResponse
    ? getResponseData<AnyRecord[] | AnyRecord>(timelineResponse)
    : [];
  const apiTimeline = normalizeViolationTimelineItems(
    getViolationTimelineItems(timeline),
  );
  const targetOverview = targetOverviewResponse
    ? getResponseData<InspectionTaskTargetOverview | undefined>(
      targetOverviewResponse,
    )
    : undefined;

  return wrapResponse(timelineResponse || targetOverviewResponse, {
    ...(targetOverview ? { targetOverview } : {}),
    violationTimeline: apiTimeline.length ? apiTimeline : fallbackTimeline,
  } as Partial<ViolationDetailData>);
};

export const getInspectionViolationBasicDetail = async (
  params: ViolationDetailParams,
) => {
  const violationId = await resolveViolationId(params);
  if (!violationId) return wrapResponse(null, null);

  const detailResponse = await request.get<ViolationDetailResponse>(
    getAdminInspectionViolationPath(violationId),
    {},
    getSilentInspectionApiConfig(),
  );

  return wrapResponse(
    detailResponse,
    getResponseData<AnyRecord | null>(detailResponse),
  );
};

export const getInspectionViolationReasonSummary = async (
  params: ViolationDetailParams,
) => {
  const violationId = await resolveViolationId(params);
  if (!violationId) return wrapResponse(null, null);
  const detailResponse = await request.get<ViolationDetailResponse>(
    getAdminInspectionViolationPath(violationId),
    {},
    getSilentInspectionApiConfig(),
  );
  const detail = getResponseData<AnyRecord | null>(detailResponse);
  return wrapResponse(detailResponse, detail ? mapV5ViolationItem(detail) : null);
};

export const getInspectionChecklistTemplateItems = (
  params: GetInspectionChecklistTemplateItemsParams = {},
) => request.get<ApiResponse<InspectionChecklistTemplateCatalogItem[]>>(
  "/api/admin/inspection/lookup/checklist-template-items",
  params,
  getSilentInspectionApiConfig(),
);

export const getInspectionViolationItems = (
  params: GetInspectionViolationItemsParams = {},
) => request.get<ApiResponse<InspectionViolationLookupItem[]>>(
  "/api/admin/inspection/lookup/violation-items",
  params,
  getSilentInspectionApiConfig(),
);

export const getInspectionViolationPenaltyStandard = (
  violationId: string | number,
) => request.get<ApiResponse<InspectionViolationPenaltyStandard | null>>(
  getAdminInspectionViolationPath(String(violationId), "/penalty-standard"),
  {},
  getSilentInspectionApiConfig(),
);

export const approveInspectionViolation = async (
  violationId: string | number,
) => {
  const response = await request.post<ApiResponse<ApproveInspectionViolationResult>>(
    getAdminInspectionViolationPath(String(violationId), "/approval"),
    {},
    getInspectionApiConfig(),
  );
  return wrapResponse(response, getResponseData<ApproveInspectionViolationResult>(response) || null);
};

export const updateInspectionViolationStatus = async (
  data: UpdateInspectionViolationStatusPayload,
) => {
  const violationId = data.violationId;
  const action = data.action || "";
  if (action === "submit_report") {
    const attachment = data.contentReviewReport?.attachments?.[0];
    const response = await request.post<ApiResponse<ViolationDetailData | null>>(
      getAdminInspectionViolationPath(violationId, "/content-report"),
      {
        contentReviewReportUrl: attachment?.url || "",
        contentReviewSummary: data.contentReviewReport?.summary || data.remark || "",
        contentReviewNote: data.remark || "",
      },
      getInspectionApiConfig(),
    );
    return wrapResponse(response, getResponseData<ViolationDetailData | null>(response) || null);
  }

  if (action === "approve") {
    return approveInspectionViolation(violationId);
  }

  if (["review_decide", "cancel", "modify"].includes(action)) {
    const decisionMap: Record<string, number> = {
      review_decide: 2,
      modify: 2,
      cancel: 3,
    };
    const response = await request.post<ApiResponse<ViolationDetailData | { decided?: boolean } | null>>(
      getAdminInspectionViolationPath(violationId, "/decide"),
      {
        committeeDecisionTypeId: data.committeeDecisionTypeId || decisionMap[action] || 2,
        committeeDecisionNote: data.committeeDecisionNote ?? data.remark ?? "",
        items: data.items || [],
      },
      getInspectionApiConfig(),
    );
    return wrapResponse(response, getResponseData<ViolationDetailData | null>(response) || null);
  }

  return routeInspectionViolation({
    violationId,
    routeTargetCode: action === "transfer_content" ? "Content" : "Committee",
    latestTransferNote: data.remark,
  });
};

export const routeInspectionViolation = async ({
  violationId,
  routeTargetCode,
  assignedContentId,
  latestTransferNote,
}: RouteInspectionViolationPayload) => {
  const contentId = routeTargetCode === "Content" && !assignedContentId
    ? (await getInspectionContentUsers().catch(() => []))[0]?.id
    : assignedContentId;
  const response = await request.post<ApiResponse<ViolationDetailData | null>>(
    getAdminInspectionViolationPath(violationId, "/route"),
    {
      routeTargetCode,
      assignedContentId: contentId,
      latestTransferNote,
    },
    getInspectionApiConfig(),
  );
  return wrapResponse(response, getResponseData<ViolationDetailData | null>(response) || null);
};
