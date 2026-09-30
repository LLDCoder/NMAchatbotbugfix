/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { DEFAULT_COUNTRY_DIAL_CODE } from "../components/common/CountrySelect/constants";
import type { MockMethod } from "vite-plugin-mock";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};


type InspectionTaskSourceType = "AUTO" | "BATCH" | "MANUAL" | "FOLLOW_UP";
type InspectionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type InspectionTaskStatus =
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
type InspectionViolationStatus =
  | "OPEN"
  | "PENDING_ROUTING"
  | "UNDER_REVIEW"
  | "PENDING_REVIEW"
  | "PENDING_CONTENT_REPORT"
  | "PENDING_COMMITTEE_DECISION"
  | "PENDING_APPROVAL"
  | "WARNING_ISSUED"
  | "RECTIFICATION_REQUIRED"
  | "RECTIFICATION"
  | "UNDER_APPEAL"
  | "PENDING_PAYMENT"
  | "RESOLVED"
  | "CLOSED"
  | "PAID"
  | "CANCELLED";

type InspectionTaskSource = {
  sourceTypeId: number;
  sourceTypeCode: InspectionTaskSourceType;
  sourceTypeNameEn: string;
  sourceTypeNameAr?: string;
};

type InspectionAddress = {
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

type InspectionTarget = {
  targetType: number;
  targetTypeName: string;
  establishmentId?: number;
  userProfileId?: number;
  hasRegisteredProfile?: boolean;
  establishmentNameEn: string;
  establishmentNameAr?: string;
  establishmentSubTypeId?: number;
  establishmentSubType?: string;
  licenseNumber?: string;
  fullName?: string;
  emiratesId?: string;
  email?: string;
  mobile?: string;
  mediaLicenseNumber?: string;
  socialMediaAccountUsername?: string;
  economicActivityId?: number;
  economicActivityName?: string;
  address?: InspectionAddress;
};

type InspectionRiskFactor = {
  factorType: string;
  factorNameEn: string;
  factorNameAr?: string;
  contributionScore?: number;
  details?: string;
};

type InspectionRiskDimension = {
  key?: string;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  score?: number;
  tone?: InspectionRiskLevel | string;
  description?: string;
};

type InspectionRiskProfile = {
  riskScore: number;
  riskLevel: InspectionRiskLevel;
  riskLevelName?: string;
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

type InspectionConfig = {
  inspectionTypeId: number;
  inspectionTypeNameEn: string;
  inspectionTypeNameAr?: string;
  inspectionReasonId?: number;
  inspectionReasonNameEn?: string;
  inspectionReasonNameAr?: string;
  isDigitalVisit?: boolean;
  priorityId?: number;
  priorityNameEn?: string;
  priorityNameAr?: string;
  dueDate?: string;
  slaMinutes?: number;
};

type InspectionAssignedInspector = {
  inspectorId: string;
  inspectorName?: string;
  role?: string;
};

type InspectionAssignment = {
  isAssigned: boolean;
  assignedInspector?: string;
  assignedInspectors?: InspectionAssignedInspector[] | string;
  assignmentReasonEn?: string;
  assignmentReasonAr?: string;
  assignedAt?: string;
};

type InspectionTaskAttachmentPayload = {
  fileName: string;
  fileUrl: string;
  contentType?: string;
  attachmentCategory?: string;
};

type InspectionTaskTimelineTone =
  | "active"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

type InspectionTaskTimelineItem = {
  id: string | number;
  eventType: string;
  titleEn: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  operatorRoleId?: number;
  operatorName?: string;
  createdOn: string;
  metadata: Record<string, unknown>;
  result?: string;
  resultTone?: InspectionTaskTimelineTone;
  durationLabel?: string;
};

type SmartChecklistViolation = {
  [key: string]: any;
  violationId: number;
  violationCode: string;
  violationName: string;
  severity: string;
  penaltyBasis?: string;
};

type SmartChecklistItem = {
  [key: string]: any;
  itemId: string;
  itemOrder: number;
  descriptionEn: string;
  descriptionAr?: string;
  result?: "PASS" | "FAIL" | "NA";
  comment?: string;
  relatedViolations: SmartChecklistViolation[];
};

type SmartChecklistCategory = {
  [key: string]: any;
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  isRequired: boolean;
  riskTriggered?: boolean;
  triggerReason?: string;
  samplingRatio?: number;
  checkItems: SmartChecklistItem[];
};

type SmartChecklistData = {
  riskProfile: InspectionRiskProfile;
  checklistCategories: SmartChecklistCategory[];
  explanation: {
    matchLogic: string;
    keyFactors: string[];
    recommendedFocus: string;
  };
};

type ChecklistSeed = {
  type: "Licensing" | "Content";
  code: string;
  violationDescription: string;
  checklistName: string;
  displayOrder: number;
  severity: InspectionRiskLevel;
  isVisibleInChecklist?: boolean;
  isSystemTriggered?: boolean;
  applicableTemplateTypes?: string[];
};

type InspectionCreatedViolationSummary = {
  violationId?: string | number;
  violationNo?: string;
  violationCode?: string;
  violationName?: string;
  violationDescription?: string;
  violationType?: "License Violation" | "Content Violation" | string;
  categoryName?: string;
  reason?: string;
  severity?: InspectionRiskLevel | string;
  status?: InspectionViolationStatus | string;
  fineAmount?: number;
};

type InspectionTaskSummary = {
  taskId: number;
  taskNo: string;
  taskName?: string;
  status: InspectionTaskStatus;
  taskSource: InspectionTaskSource;
  inspectionTarget: InspectionTarget;
  riskProfile: InspectionRiskProfile;
  inspectionConfig: InspectionConfig;
  assignment: InspectionAssignment;
  createdAt: string;
  updatedAt: string;
};

type InspectionReportPreview = {
  reportId: string;
  taskId: number;
  taskNo: string;
  previewUrl?: string;
  generatedAt: string;
  reportSummary: {
    overallComment?: string;
    recommendedAction?: string;
    result?: string;
    createdViolations?: InspectionCreatedViolationSummary[];
    [key: string]: any;
  };
  checklistCategories: SmartChecklistCategory[];
};

type InspectionTaskDetail = InspectionTaskSummary & {
  description?: string;
  taskSourceRemark?: string;
  tabs?: string[];
  draftUpdatedAt?: string;
  smartChecklistSnapshot?: SmartChecklistData;
  reportPreview?: InspectionReportPreview;
  targetOverview?: Record<string, any>;
  inspectionReport?: Record<string, any>;
  executionResult?: Record<string, any>;
  executionDraft?: Record<string, any>;
  contactPersons?: Array<Record<string, any>>;
  checklistTemplate?: Record<string, any>;
  executionState?: Record<string, any>;
  cancelReason?: string;
  countsTowardInspectionInterval?: boolean;
  lastSuccessfulInspection?: Record<string, any>;
  lastCompletedInspection?: Record<string, any>;
  previousSuccessfulInspection?: Record<string, any>;
  previousInspection?: Record<string, any>;
  inspectionHistory?: Array<Record<string, any>>;
  reinspectionTask?: Record<string, any>;
  linkedReinspectionTask?: Record<string, any>;
  relatedReinspectionTask?: Record<string, any>;
  attachments?: InspectionTaskAttachmentPayload[];
  timeline?: InspectionTaskTimelineItem[];
  violations?: InspectionCreatedViolationSummary[];
};

type InspectionViolationItem = {
  [key: string]: any;
  id: string;
  violationId: string;
  violationNo: string;
  violationCode: string;
  title: string;
  violationName: string;
  violationDescription?: string;
  level: string;
  severity: string;
  status: InspectionViolationStatus;
  description: string;
  location: string;
  inspectionDate: string;
  taskId: number;
  taskNo: string;
  establishmentId: number;
  establishmentNameEn: string;
  categoryName: string;
  penaltyBasis?: string;
  assignedInspector?: string;
  taskSource?: InspectionTaskSource;
  inspectionTarget?: InspectionTarget;
  riskProfile?: InspectionRiskProfile;
  inspectionConfig?: InspectionConfig;
  assignment?: InspectionAssignment;
  timeline?: Array<{
    action: string;
    operator: string;
    actionAt: string;
    remark?: string;
  }>;
};

type TaskDraftRecord = {
  version: number;
  savedAt: string;
  visitId?: number | null;
  establishmentId?: number;
  checklistCategories: SmartChecklistCategory[];
  summary?: {
    overallComment?: string;
    recommendedAction?: string;
    [key: string]: any;
  };
};

const inspectors: InspectionAssignedInspector[] = [
  { inspectorId: "inspector-001", inspectorName: "Ava Khan", role: "LEAD" },
  { inspectorId: "inspector-002", inspectorName: "Ethan Noor", role: "FIELD" },
  { inspectorId: "inspector-003", inspectorName: "Mia Rahman", role: "FIELD" },
  { inspectorId: "inspector-004", inspectorName: "Omar Saeed", role: "SPECIALIST" },
];

const taskSources: Record<InspectionTaskSourceType, InspectionTaskSource> = {
  AUTO: {
    sourceTypeId: 1,
    sourceTypeCode: "AUTO",
    sourceTypeNameEn: "Auto Generated",
    sourceTypeNameAr: "تلقائي",
  },
  BATCH: {
    sourceTypeId: 2,
    sourceTypeCode: "BATCH",
    sourceTypeNameEn: "Batch Generated",
    sourceTypeNameAr: "دفعة",
  },
  MANUAL: {
    sourceTypeId: 3,
    sourceTypeCode: "MANUAL",
    sourceTypeNameEn: "Manual",
    sourceTypeNameAr: "يدوي",
  },
  FOLLOW_UP: {
    sourceTypeId: 4,
    sourceTypeCode: "FOLLOW_UP",
    sourceTypeNameEn: "Follow-up",
    sourceTypeNameAr: "متابعة",
  },
};

type InspectionLookupOption = {
  id: number;
  code?: string;
  name?: string;
  nameEn: string;
  nameAr?: string;
  emirateId?: number;
  regionId?: number;
  isMock?: boolean;
};

const mockEmirates: InspectionLookupOption[] = [
  { id: 1, nameEn: "Abu Dhabi", nameAr: "أبوظبي", isMock: true },
  { id: 2, nameEn: "Dubai", nameAr: "دبي", isMock: true },
  { id: 3, nameEn: "Sharjah", nameAr: "الشارقة", isMock: true },
  { id: 4, nameEn: "Ras Al Khaimah", nameAr: "رأس الخيمة", isMock: true },
  { id: 5, nameEn: "Ajman", nameAr: "عجمان", isMock: true },
  { id: 6, nameEn: "Fujairah", nameAr: "الفجيرة", isMock: true },
  { id: 7, nameEn: "Umm Al Quwain", nameAr: "أم القيوين", isMock: true },
];

const mockAuthorities: InspectionLookupOption[] = [
  { id: 7, emirateId: 1, code: "ADMCC", nameEn: "Abu Dhabi Media and Content Center", isMock: true },
  { id: 8, emirateId: 1, code: "ADDED", nameEn: "Abu Dhabi Department of Economic Development", isMock: true },
  { id: 17, emirateId: 2, code: "DMC", nameEn: "Dubai Media Council", isMock: true },
  { id: 18, emirateId: 2, code: "DET", nameEn: "Dubai Department of Economy and Tourism", isMock: true },
  { id: 27, emirateId: 3, code: "SMB", nameEn: "Sharjah Media Bureau", isMock: true },
  { id: 37, emirateId: 4, code: "RAKDED", nameEn: "Ras Al Khaimah Department of Economic Development", isMock: true },
  { id: 47, emirateId: 5, code: "AJDED", nameEn: "Ajman Department of Economic Development", isMock: true },
  { id: 57, emirateId: 6, code: "FUJDED", nameEn: "Fujairah Department of Industry and Economy", isMock: true },
  { id: 67, emirateId: 7, code: "UAQDED", nameEn: "Umm Al Quwain Department of Economic Development", isMock: true },
];

const mockRegions: InspectionLookupOption[] = [
  { id: 20, emirateId: 1, code: "AUH-CENTRAL", nameEn: "Abu Dhabi Central", isMock: true },
  { id: 21, emirateId: 1, code: "AUH-MAINLAND", nameEn: "Abu Dhabi Mainland", isMock: true },
  { id: 22, emirateId: 1, code: "AL-AIN", nameEn: "Al Ain", isMock: true },
  { id: 30, emirateId: 2, code: "DUBAI-CENTRAL", nameEn: "Dubai Central", isMock: true },
];

const mockCommunities: InspectionLookupOption[] = [
  { id: 101, regionId: 21, code: "AL-FALAH", nameEn: "Al Falah", isMock: true },
  { id: 102, regionId: 20, code: "KHALIFA-CITY", nameEn: "Khalifa City", isMock: true },
  { id: 103, regionId: 20, code: "AL-BATEEN", nameEn: "Al Bateen", isMock: true },
  { id: 205, regionId: 30, code: "AL-QUOZ", nameEn: "Al Quoz", isMock: true },
  { id: 206, regionId: 30, code: "BUSINESS-BAY", nameEn: "Business Bay", isMock: true },
  { id: 300, regionId: 20, code: "CORNICHE", nameEn: "Corniche Area", isMock: true },
];

const mockEstablishmentSubTypes: InspectionLookupOption[] = [
  { id: 1, code: "COMMERCIAL", nameEn: "Commercial", isMock: true },
  { id: 2, code: "FREE_ZONE", nameEn: "Free Zone", isMock: true },
  { id: 3, code: "TALENT_AGENCY", nameEn: "Talent Agency", isMock: true },
  { id: 4, code: "GOVERNMENT", nameEn: "Government", isMock: true },
  { id: 5, code: "EMBASSY", nameEn: "Embassy", isMock: true },
  { id: 6, code: "CONSULATE", nameEn: "Consulate", isMock: true },
  { id: 7, code: "CULTURAL_CLUBS", nameEn: "Cultural Clubs", isMock: true },
];

const checklistTemplateTypes = [
  "Bookstore",
  "Cinema Theater",
  "Game Retail",
  "Publisher",
  "Newspaper-Magazine",
  "Printing Press",
  "Advertising Agency",
  "Film-Video Distributor",
  "Production Company",
  "Broadcasting Station",
  "Digital Media Platform",
  "Podcast Video Blog Platform",
  "Social Media Influencer",
  "Foreign Media Office",
];

const checklistResultOptions = [
  { id: 1, code: "Compliant", name: "Compliant" },
  { id: 2, code: "Violation", name: "Violation" },
  { id: 3, code: "NotApplicable", name: "Not Applicable" },
];

const checklistSeeds: ChecklistSeed[] = [
  { type: "Licensing", code: "L1", violationDescription: "Practicing media activity without a license or permit", checklistName: "Display of a valid media activity license", displayOrder: 1, severity: "CRITICAL" },
  { type: "Licensing", code: "L2", violationDescription: "Practicing additional media activity without a license", checklistName: "License scope matches actual business activities", displayOrder: 2, severity: "HIGH" },
  { type: "Licensing", code: "L3", violationDescription: "Lapse of 30 days from license expiry without renewal", checklistName: "System-triggered license expiry rule", displayOrder: 3, severity: "HIGH", isVisibleInChecklist: false, isSystemTriggered: true, applicableTemplateTypes: [] },
  { type: "Licensing", code: "L4", violationDescription: "Assigning / leasing license or modifying license data without approval", checklistName: "No unauthorized transfer, leasing, or modification of license data", displayOrder: 4, severity: "HIGH" },
  { type: "Licensing", code: "L5", violationDescription: "Providing inaccurate, false, or misleading information during licensing", checklistName: "Accurate and truthful information provided in the media license or permit application", displayOrder: 5, severity: "MEDIUM" },
  { type: "Licensing", code: "L6", violationDescription: "Organizing a book fair without a permit", checklistName: "Book fair or media event permit is available and valid", displayOrder: 6, severity: "MEDIUM", applicableTemplateTypes: ["Bookstore", "Publisher"] },
  { type: "Licensing", code: "L7", violationDescription: "Printing, circulating, or publishing media content without a permit", checklistName: "All media content distributed, published, or exhibited has valid permits and approvals", displayOrder: 7, severity: "HIGH" },
  { type: "Licensing", code: "L8", violationDescription: "Making modifications to approved content without approval", checklistName: "Distributed, published, or exhibited content matches the approved version", displayOrder: 8, severity: "MEDIUM" },
  { type: "Licensing", code: "L9", violationDescription: "Working as a foreign correspondent without a permit", checklistName: "Foreign correspondent permit is valid and displayed", displayOrder: 9, severity: "MEDIUM", applicableTemplateTypes: ["Foreign Media Office"] },
  { type: "Licensing", code: "L10", violationDescription: "Failure to update establishment data or changes", checklistName: "Establishment data is updated in the authority system", displayOrder: 10, severity: "HIGH" },
  { type: "Licensing", code: "L11", violationDescription: "Providing advertising/media content via social media without permit", checklistName: "Display of social media advertising permit", displayOrder: 11, severity: "HIGH", applicableTemplateTypes: ["Digital Media Platform", "Social Media Influencer"] },
  { type: "Licensing", code: "L12", violationDescription: "Continuing advertising after permit expiry", checklistName: "Social media advertising permit is not expired", displayOrder: 12, severity: "MEDIUM", applicableTemplateTypes: ["Digital Media Platform", "Social Media Influencer"] },
  { type: "Licensing", code: "L13", violationDescription: "Non-compliance with conditions for individual advertising licenses", checklistName: "Individual advertising activities comply with license conditions", displayOrder: 13, severity: "MEDIUM", applicableTemplateTypes: ["Social Media Influencer"] },
  { type: "Licensing", code: "L14", violationDescription: "Publishing or displaying advertisement without permit", checklistName: "Advertisement publishing or displaying permit is available", displayOrder: 14, severity: "HIGH", applicableTemplateTypes: ["Advertising Agency", "Digital Media Platform", "Social Media Influencer"] },
  { type: "Licensing", code: "L15", violationDescription: "Violating advertising regulations (Cabinet Resolution No. 68)", checklistName: "Advertising content complies with applicable regulations", displayOrder: 15, severity: "MEDIUM", applicableTemplateTypes: ["Advertising Agency", "Digital Media Platform", "Social Media Influencer"] },
  { type: "Licensing", code: "L16", violationDescription: "Obstructing inspection officer or refusing cooperation", checklistName: "Cooperate with the inspection officer", displayOrder: 16, severity: "HIGH" },
  { type: "Content", code: "C1", violationDescription: "Disrespecting divine beings or religions", checklistName: "Content does not insult religions or beliefs", displayOrder: 101, severity: "CRITICAL" },
  { type: "Content", code: "C2", violationDescription: "Disrespecting governance system or state symbols", checklistName: "Content does not insult the State or its institutions", displayOrder: 102, severity: "CRITICAL" },
  { type: "Content", code: "C3", violationDescription: "Disrespecting state policies internally or internationally", checklistName: "Content does not undermine State policies", displayOrder: 103, severity: "HIGH" },
  { type: "Content", code: "C4", violationDescription: "Harming the State's foreign relations", checklistName: "Content does not harm foreign relations", displayOrder: 104, severity: "HIGH" },
  { type: "Content", code: "C5", violationDescription: "Harming national unity or social cohesion", checklistName: "Content does not harm national unity", displayOrder: 105, severity: "HIGH" },
  { type: "Content", code: "C6", violationDescription: "Inciting violence, hatred, terrorism, or discord", checklistName: "Content does not incite violence or hatred", displayOrder: 106, severity: "CRITICAL" },
  { type: "Content", code: "C7", violationDescription: "Insulting legal, economic, or security systems", checklistName: "Content does not insult State systems or judiciary", displayOrder: 107, severity: "HIGH" },
  { type: "Content", code: "C8", violationDescription: "Glorifying extremist or destructive groups", checklistName: "Content does not glorify extremist groups", displayOrder: 108, severity: "CRITICAL" },
  { type: "Content", code: "C9", violationDescription: "Disrespecting cultural heritage or national identity", checklistName: "Content respects national identity and heritage", displayOrder: 109, severity: "MEDIUM" },
  { type: "Content", code: "C10", violationDescription: "Insulting prevailing societal values", checklistName: "Content respects prevailing societal values", displayOrder: 110, severity: "MEDIUM" },
  { type: "Content", code: "C11", violationDescription: "Violating privacy of individuals", checklistName: "Content does not violate personal privacy", displayOrder: 111, severity: "HIGH" },
  { type: "Content", code: "C12", violationDescription: "Inciting crimes, drugs, murder, or rape", checklistName: "Content does not promote criminal behavior", displayOrder: 112, severity: "CRITICAL" },
  { type: "Content", code: "C13", violationDescription: "Harming national currency or economic stability", checklistName: "Content does not harm economic stability", displayOrder: 113, severity: "HIGH" },
  { type: "Content", code: "C14", violationDescription: "Violating public morals or promoting destructive ideas", checklistName: "Content complies with public morals standards", displayOrder: 114, severity: "HIGH" },
  { type: "Content", code: "C15", violationDescription: "Publishing false or forged news or information", checklistName: "Content information is accurate and verifiable", displayOrder: 115, severity: "CRITICAL", applicableTemplateTypes: ["Newspaper-Magazine", "Broadcasting Station", "Digital Media Platform", "Podcast Video Blog Platform", "Social Media Influencer", "Foreign Media Office"] },
  { type: "Content", code: "C16", violationDescription: "Publishing rumors or misleading news", checklistName: "Content does not spread rumors or misinformation", displayOrder: 116, severity: "HIGH", applicableTemplateTypes: ["Newspaper-Magazine", "Broadcasting Station", "Digital Media Platform", "Podcast Video Blog Platform", "Social Media Influencer", "Foreign Media Office"] },
  { type: "Content", code: "C17", violationDescription: "Hosting inappropriate individuals in media", checklistName: "Guests or hosts are appropriate for the media content", displayOrder: 117, severity: "MEDIUM", applicableTemplateTypes: ["Broadcasting Station", "Podcast Video Blog Platform"] },
  { type: "Content", code: "C18", violationDescription: "Disrespecting culture and values in advertising", checklistName: "Advertising content respects State culture and values", displayOrder: 118, severity: "MEDIUM", applicableTemplateTypes: ["Digital Media Platform", "Social Media Influencer"] },
  { type: "Content", code: "C19", violationDescription: "Failure to observe approved age classification", checklistName: "Content age classification is correctly applied", displayOrder: 119, severity: "MEDIUM", applicableTemplateTypes: ["Bookstore", "Cinema Theater", "Game Retail", "Publisher"] },
  { type: "Content", code: "C20", violationDescription: "Violating children's rights", checklistName: "Content respects children's rights and protections", displayOrder: 120, severity: "HIGH" },
];

const getChecklistResultForSeed = (
  seed: ChecklistSeed,
  establishmentId: number,
  riskProfile: InspectionRiskProfile,
): "PASS" | "FAIL" | "NA" => {
  if (seed.isSystemTriggered) return "NA";
  const automaticReinspectionCodes = new Set(["L1", "L2", "L4", "L10"]);
  if (establishmentId % 11 === 0 && automaticReinspectionCodes.has(seed.code)) return "FAIL";
  if (establishmentId % 13 === 0 && ["C15", "C16"].includes(seed.code)) return "FAIL";
  if (riskProfile.riskLevel === "CRITICAL" && ["L1", "C6"].includes(seed.code)) return "FAIL";
  if (riskProfile.riskLevel === "HIGH" && ["L2", "L10", "C16"].includes(seed.code)) return "FAIL";
  if (["L6", "L9", "C17", "C18", "C19"].includes(seed.code) && establishmentId % 2 === 0) return "NA";
  return "PASS";
};

const createSmartChecklistItem = (
  seed: ChecklistSeed,
  establishmentId: number,
  riskProfile: InspectionRiskProfile,
): SmartChecklistItem => {
  const result = getChecklistResultForSeed(seed, establishmentId, riskProfile);
  const violationItemId = 7000 + seed.displayOrder;
  const relatedViolation = {
    violationId: violationItemId,
    violationCode: seed.code,
    violationName: seed.violationDescription,
    severity: seed.severity,
    penaltyBasis: `Article ${seed.displayOrder}.1`,
    violationItemId,
    violationItemCode: seed.code,
    violationTypeCode: seed.type === "Licensing" ? "LicensingViolation" : "ContentViolation",
  };

  return {
    itemId: `ITEM-${seed.code}`,
    itemOrder: seed.displayOrder,
    descriptionEn: seed.checklistName,
    result,
    comment: result === "FAIL" ? `${seed.code} evidence captured for mock execution.` : "",
    remarks: result === "FAIL" ? `${seed.code} evidence captured for mock execution.` : "",
    evidenceAttachments: result === "FAIL"
      ? [
        {
          fileName: `evidence-${seed.code.toLowerCase()}-${establishmentId}.jpg`,
          fileUrl: `/api/admin/inspection/mock-files/evidence/evidence-${seed.code.toLowerCase()}-${establishmentId}.jpg`,
          contentType: "image/jpeg",
        },
      ]
      : [],
    selectedViolations: result === "FAIL" ? [relatedViolation] : [],
    checklistCode: seed.code,
    violationDescription: seed.violationDescription,
    violationTypeCode: seed.type,
    relatedViolations: [relatedViolation],
  };
};

const createChecklist = (
  establishmentId: number,
  riskProfile: InspectionRiskProfile,
): SmartChecklistData => {
  const establishmentFocus =
    establishmentId === 5002
      ? "printing equipment calibration, warehouse logs, and permit display"
      : establishmentId === 5003
        ? "content control process, shelf labeling, and invoice traceability"
        : "inventory source legality, distribution chain integrity, and license validity";

  return {
    riskProfile: {
      riskScore: riskProfile.riskScore,
      riskLevel: riskProfile.riskLevel,
      riskLevelName:
        riskProfile.riskLevel === "CRITICAL"
          ? "Critical Risk"
          : riskProfile.riskLevel === "HIGH"
            ? "High Risk"
            : riskProfile.riskLevel === "MEDIUM"
              ? "Medium Risk"
              : "Low Risk",
      primaryRiskFactors: [
        {
          factorType: "VIOLATION_PATTERN",
          factorName: "Multiple Violation Pattern",
          description: "3 or more violations within 24 months",
        },
        {
          factorType: "LICENSE_INCONSISTENCY",
          factorName: "License Inconsistency",
          description:
            "Structural non-compliance caused by misaligned operation scope",
        },
      ],
      lastAssessmentDate: riskProfile.lastAssessmentDate,
    },
    checklistCategories: [
      {
        categoryId: "CAT-LICENSING",
        categoryName: "License Violation",
        categoryOrder: 1,
        isRequired: true,
        riskTriggered: true,
        triggerReason: "Full licensing checklist returned for mock integration.",
        samplingRatio: 1,
        checkItems: checklistSeeds
          .filter((seed) => seed.type === "Licensing" && seed.isVisibleInChecklist !== false)
          .map((seed) => createSmartChecklistItem(seed, establishmentId, riskProfile)),
      },
      {
        categoryId: "CAT-CONTENT",
        categoryName: "Content Violation",
        categoryOrder: 2,
        isRequired: true,
        riskTriggered: true,
        triggerReason: "Full content checklist returned for mock integration.",
        samplingRatio: 1,
        checkItems: checklistSeeds
          .filter((seed) => seed.type === "Content" && seed.isVisibleInChecklist !== false)
          .map((seed) => createSmartChecklistItem(seed, establishmentId, riskProfile)),
      },
    ],
    explanation: {
      matchLogic:
        "Task group matching based on establishment type and current risk profile",
      keyFactors: [
        "Economic activity and operating scope",
        `Risk score ${riskProfile.riskScore} mapped to ${riskProfile.riskLevel}`,
        "Historical violations inside the rolling 24 month window",
        "License inconsistency and control-process indicators",
      ],
      recommendedFocus: `Priority verification: ${establishmentFocus}`,
    },
  };
};

const inspectionTasks: InspectionTaskDetail[] = [
  {
    taskId: 10001,
    taskNo: "IN-2026-5453455",
    taskName: "Risk-based publishing inspection",
    status: "IN_PROGRESS",
    taskSource: taskSources.AUTO,
    inspectionTarget: {
      targetType: 1,
      targetTypeName: "Establishment",
      establishmentId: 5001,
      establishmentNameEn: "Emirates Media Corp",
      establishmentNameAr: "دار النشر أ ب ت",
      licenseNumber: "LIC-2026-5001",
      economicActivityId: 101,
      economicActivityName: "Book Publishing",
      address: {
        emirateId: 1,
        emirateNameEn: "Abu Dhabi",
        emirateNameAr: "أبوظبي",
        communityId: 101,
        communityNameEn: "Al Falah",
        street: "Al Falah Street",
        latitude: 24.4539,
        longitude: 54.3773,
      },
    },
    riskProfile: {
      riskScore: 85,
      riskLevel: "HIGH",
      riskLevelName: "High Risk",
      riskFactors: [
        {
          factorType: "VIOLATION_PATTERN",
          factorNameEn: "Multiple Violations in 24 Months",
          factorNameAr: "مخالفات متعددة في 24 شهرًا",
          contributionScore: 25,
          details: "3 violations detected",
        },
        {
          factorType: "LICENSE_INCONSISTENCY",
          factorNameEn: "Structural Non-compliance",
          factorNameAr: "عدم امتثال هيكلي",
          contributionScore: 30,
          details: "Operating without valid distribution license",
        },
      ],
      lastAssessmentDate: "2026-03-15T10:30:00Z",
    },
    inspectionConfig: {
      inspectionTypeId: 3,
      inspectionTypeNameEn: "Risk-based",
      inspectionTypeNameAr: "مبني على المخاطر",
      inspectionReasonId: 7,
      inspectionReasonNameEn: "Compliance Check",
      inspectionReasonNameAr: "ملف مخاطر عالي",
      isDigitalVisit: false,
      priorityId: 1,
      priorityNameEn: "Critical",
      priorityNameAr: "حرج",
      dueDate: "2025-09-28T12:00:00+04:00",
      slaMinutes: 2880,
    },
    assignment: {
      isAssigned: true,
      assignedInspector: "inspector-001",
      assignedInspectors: [inspectors[0], inspectors[1]],
      assignmentReasonEn:
        "Workload balanced assignment with expertise matching",
      assignmentReasonAr: "تعيين متوازن للحمل مع مطابقة الخبرة",
      assignedAt: "2026-04-12T08:30:00Z",
    },
    createdAt: "2026-04-10T09:00:00Z",
    updatedAt: "2026-04-12T08:30:00Z",
    description: "Generated from risk engine for high-risk establishment review.",
    taskSourceRemark: "Generated in daily risk batch",
    tabs: ["all", "assigned", "today"],
  },
  {
    taskId: 10002,
    taskNo: "IN-2026-5453456",
    taskName: "Warehouse distribution compliance",
    status: "PENDING_VISIT",
    taskSource: taskSources.BATCH,
    inspectionTarget: {
      targetType: 1,
      targetTypeName: "Establishment",
      establishmentId: 5002,
      establishmentNameEn: "Abu Dhabi Media",
      licenseNumber: "LIC-2026-5002",
      economicActivityId: 102,
      economicActivityName: "Printing Services",
      address: {
        emirateId: 2,
        emirateNameEn: "Dubai",
        emirateNameAr: "دبي",
        communityId: 205,
        communityNameEn: "Al Quoz",
        street: "Warehouse District 7",
        latitude: 25.1382,
        longitude: 55.2361,
      },
    },
    riskProfile: {
      riskScore: 72,
      riskLevel: "HIGH",
      riskLevelName: "High Risk",
      riskFactors: [
        {
          factorType: "COMPLAINT_CLUSTER",
          factorNameEn: "Recent Complaint Cluster",
          contributionScore: 20,
          details: "5 complaints in last 60 days",
        },
      ],
      lastAssessmentDate: "2026-04-04T12:00:00Z",
    },
    inspectionConfig: {
      inspectionTypeId: 2,
      inspectionTypeNameEn: "Follow-up",
      inspectionReasonId: 5,
      inspectionReasonNameEn: "Compliance Check",
      isDigitalVisit: false,
      priorityId: 4,
      priorityNameEn: "Low",
      dueDate: "2025-09-28T12:00:00+04:00",
      slaMinutes: 2880,
    },
    assignment: {
      isAssigned: true,
      assignedInspector: "inspector-002",
      assignedInspectors: [inspectors[1]],
      assignmentReasonEn: "Inspector with prior establishment context",
      assignedAt: "2026-04-14T09:10:00Z",
    },
    createdAt: "2026-04-11T08:00:00Z",
    updatedAt: "2026-04-21T14:20:00Z",
    description: "Batch-generated follow-up review for complaint cluster.",
    tabs: ["all", "myTasks", "inProgress"],
  },
  {
    taskId: 10003,
    taskNo: "IN-2026-5453457",
    taskName: "Manual market shelf verification",
    status: "PENDING_ASSIGNMENT",
    taskSource: taskSources.MANUAL,
    inspectionTarget: {
      targetType: 1,
      targetTypeName: "Establishment",
      establishmentId: 5003,
      establishmentNameEn: "Corner Pages Trading",
      licenseNumber: "LIC-2026-5003",
      economicActivityId: 103,
      economicActivityName: "Retail Bookshop",
      address: {
        emirateId: 1,
        emirateNameEn: "Abu Dhabi",
        communityId: 305,
        communityNameEn: "Corniche",
        street: "Corniche Market Street",
      },
    },
    riskProfile: {
      riskScore: 54,
      riskLevel: "MEDIUM",
      riskLevelName: "Medium Risk",
      riskFactors: [
        {
          factorType: "RANDOM_SAMPLING",
          factorNameEn: "Routine selection",
          contributionScore: 10,
          details: "Included in periodic market sampling",
        },
      ],
      lastAssessmentDate: "2026-04-01T10:00:00Z",
    },
    inspectionConfig: {
      inspectionTypeId: 1,
      inspectionTypeNameEn: "Routine",
      inspectionReasonId: 2,
      inspectionReasonNameEn: "Manual request",
      isDigitalVisit: true,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-05-03T23:59:59Z",
      slaMinutes: 10080,
    },
    assignment: {
      isAssigned: false,
      assignedInspectors: [],
      assignmentReasonEn: "Awaiting manual assignment",
    },
    createdAt: "2026-04-18T11:30:00Z",
    updatedAt: "2026-04-18T11:30:00Z",
    description: "Manual task created by supervisor for shelf and labeling checks.",
    tabs: ["all", "unassigned"],
  },
];


inspectionTasks.push(
  ...[
    {
      ...JSON.parse(JSON.stringify(inspectionTasks[0])),
      taskId: 10004,
      taskNo: "INS-2026-001004",
      taskName: "Completed digital media account review",
      status: "COMPLETED",
      inspectionTarget: { ...inspectionTasks[0].inspectionTarget, establishmentId: 5004, establishmentNameEn: "Gulf Digital Media FZ", licenseNumber: "LIC-2026-5004", targetTypeName: "Free Zone", address: { emirateId: 3, emirateNameEn: "Sharjah", communityNameEn: "Media City", street: "Creative Cluster 12" } },
      inspectionConfig: { ...inspectionTasks[0].inspectionConfig, inspectionTypeNameEn: "Digital Inspection", isDigitalVisit: true, priorityNameEn: "Medium", dueDate: "2026-04-20T23:59:59Z", slaMinutes: 2880 },
      assignment: { isAssigned: true, assignedInspector: "inspector-001", assignedInspectors: [inspectors[0]], assignedAt: "2026-04-15T08:00:00Z" },
      reportPreview: {
        reportId: "RPT-10004",
        taskId: 10004,
        taskNo: "INS-2026-001004",
        generatedAt: "2026-04-19T12:30:00Z",
        previewUrl: "/api/admin/inspection/mock-files/reports/inspection-report-INS-2026-001004.pdf",
        reportSummary: {
          result: "COMPLETED",
          accessResult: "accessed_successfully",
          overallComment: "Digital media account review completed with one content violation.",
          checkInAt: "2026-04-19T11:10:00Z",
          checkOutAt: "2026-04-19T12:30:00Z",
          contactPerson: {
            name: "Ava Khan",
            designation: "Digital Account Manager",
            mobilePhone: `${DEFAULT_COUNTRY_DIAL_CODE} 50 440 1100`,
            emailAddress: "ava.khan@example.com",
            declarationStatus: "submitted_by_link",
            signedDeclarationDocument: {
              fileName: "digital-declaration-10004.pdf",
              url: "/mock/inspection/documents/digital-declaration-10004.pdf",
            },
          },
          createdViolations: [
            {
              violationId: "V-CONTENT-10004",
              violationNo: "VN-2026-10004",
              violationCode: "C16",
              violationName: "Publishing rumors or misleading news",
              violationType: "Content Violation",
              status: "PENDING_ROUTING",
              notes: "Digital evidence was captured during the online inspection.",
              attachments: [
                {
                  fileName: "digital-content-evidence.png",
                  fileUrl: "/api/admin/inspection/mock-files/evidence/digital-content-evidence.png",
                },
              ],
            },
          ],
          submittedAt: "2026-04-19T12:30:00Z",
        },
        checklistCategories: [],
      },
      updatedAt: "2026-04-19T12:30:00Z",
      tabs: ["all", "completed", "teamTasks"],
    },
    {
      ...JSON.parse(JSON.stringify(inspectionTasks[1])),
      taskId: 10005,
      taskNo: "INS-2026-001005",
      taskName: "Access failed field visit",
      status: "ACCESS_FAILED",
      inspectionTarget: { ...inspectionTasks[1].inspectionTarget, establishmentId: 5005, establishmentNameEn: "Embassy Cultural Club", licenseNumber: "GOV-2026-5005", targetTypeName: "Government / Embassy / Consulate / Cultural Club", address: { emirateId: 1, emirateNameEn: "Abu Dhabi", communityNameEn: "Al Bateen", street: "Diplomatic Area" } },
      inspectionConfig: { ...inspectionTasks[1].inspectionConfig, inspectionTypeNameEn: "Field Inspection", isDigitalVisit: false, priorityNameEn: "Critical", dueDate: "2026-04-21T23:59:59Z", slaMinutes: 1440 },
      assignment: { isAssigned: true, assignedInspector: "inspector-001", assignedInspectors: [inspectors[0]], assignedAt: "2026-04-18T08:00:00Z" },
      reportPreview: { reportId: "RPT-10005", taskId: 10005, taskNo: "INS-2026-001005", generatedAt: "2026-04-20T10:30:00Z", previewUrl: "/api/admin/inspection/mock-files/reports/inspection-report-INS-2026-001005.pdf", reportSummary: { accessResult: "unable_to_access", accessReason: "Representative refused entry", accessRemark: "Security desk denied access after arrival.", accessAttachments: [{ fileName: "access-denied-evidence.jpg", fileUrl: "/api/admin/inspection/mock-files/evidence/access-denied-evidence.jpg" }], seizedMaterials: [], contactPerson: { name: "N/A", designation: "N/A", declarationStatus: "not_available" }, submittedAt: "2026-04-20T10:30:00Z" }, checklistCategories: [] },
      updatedAt: "2026-04-20T10:30:00Z",
      tabs: ["all", "completed", "teamTasks"],
    },
    {
      ...JSON.parse(JSON.stringify(inspectionTasks[2])),
      taskId: 10006,
      taskNo: "INS-2026-001006",
      taskName: "Cancelled individual seller inspection",
      status: "CANCELLED",
      inspectionTarget: { ...inspectionTasks[2].inspectionTarget, establishmentId: 5006, establishmentNameEn: "Independent Media Seller", licenseNumber: "IND-2026-5006", targetType: 2, targetTypeName: "Individual", address: { emirateId: 5, emirateNameEn: "Ajman", communityNameEn: "City Centre", street: "Market Lane" } },
      updatedAt: "2026-04-22T10:00:00Z",
      tabs: ["all", "teamTasks"],
    },
    {
      ...JSON.parse(JSON.stringify(inspectionTasks[2])),
      taskId: 10007,
      taskNo: "INS-2026-001007",
      taskName: "Queued commercial distributor inspection",
      status: "QUEUED",
      inspectionTarget: { ...inspectionTasks[2].inspectionTarget, establishmentId: 5007, establishmentNameEn: "Union Commercial Distribution", licenseNumber: "COM-2026-5007", targetTypeName: "Commercial", address: { emirateId: 4, emirateNameEn: "Ras Al Khaimah", communityNameEn: "Industrial Zone", street: "Distribution Road" } },
      assignment: { isAssigned: false, assignedInspectors: "", assignmentReasonEn: "Awaiting manager assignment" },
      tabs: ["all", "queued", "unassigned"],
    },
  ] as InspectionTaskDetail[],
);

type TaskCoverageSeed = {
  taskId: number;
  taskNo: string;
  taskName: string;
  status: InspectionTaskStatus;
  sourceType: InspectionTaskSourceType;
  reasonNameEn: string;
  targetName: string;
  targetType?: 1 | 2;
  targetTypeName?: string;
  licenseNumber: string;
  activityName: string;
  emirateId: number;
  emirateNameEn: string;
  communityNameEn: string;
  street: string;
  isDigitalVisit: boolean;
  priorityId: number;
  priorityNameEn: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  inspectorIndexes?: number[];
  riskScore: number;
  riskLevel: InspectionRiskLevel;
  description: string;
  reportSummary?: Record<string, any>;
};

const emirateNameArMap: Record<string, string> = {
  "Abu Dhabi": "أبوظبي",
  Dubai: "دبي",
  Sharjah: "الشارقة",
  Ajman: "عجمان",
  "Ras Al Khaimah": "رأس الخيمة",
  Fujairah: "الفجيرة",
  "Umm Al Quwain": "أم القيوين",
};

const priorityNameArMap: Record<string, string> = {
  Critical: "حرج",
  High: "عال",
  Medium: "متوسط",
  Low: "منخفض",
};

const buildCoverageTask = (seed: TaskCoverageSeed): InspectionTaskDetail => {
  const assignedInspectors = (seed.inspectorIndexes || [])
    .map((index) => inspectors[index])
    .filter(Boolean);
  const isAssigned = assignedInspectors.length > 0;
  const isDigitalInspection = seed.isDigitalVisit;
  const checklistCategories: SmartChecklistCategory[] = seed.reportSummary?.checklistCategories || [];

  return {
    taskId: seed.taskId,
    taskNo: seed.taskNo,
    taskName: seed.taskName,
    status: seed.status,
    taskSource: taskSources[seed.sourceType],
    inspectionTarget: {
      targetType: seed.targetType || 1,
      targetTypeName: seed.targetTypeName || (seed.targetType === 2 ? "Individual" : "Establishment"),
      establishmentId: 6000 + seed.taskId,
      establishmentNameEn: seed.targetName,
      licenseNumber: seed.licenseNumber,
      economicActivityName: seed.activityName,
      address: {
        emirateId: seed.emirateId,
        emirateNameEn: seed.emirateNameEn,
        emirateNameAr: emirateNameArMap[seed.emirateNameEn],
        communityNameEn: seed.communityNameEn,
        street: seed.street,
      },
    },
    riskProfile: {
      riskScore: seed.riskScore,
      riskLevel: seed.riskLevel,
      riskLevelName: `${seed.riskLevel.charAt(0)}${seed.riskLevel.slice(1).toLowerCase()} Risk`,
      riskFactors: [
        {
          factorType: seed.reasonNameEn.toUpperCase().replace(/\s+/g, "_"),
          factorNameEn: seed.reasonNameEn,
          contributionScore: Math.max(10, Math.round(seed.riskScore / 3)),
          details: seed.description,
        },
      ],
      lastAssessmentDate: seed.createdAt,
    },
    inspectionConfig: {
      inspectionTypeId: isDigitalInspection ? 4 : 1,
      inspectionTypeNameEn: isDigitalInspection ? "Digital Inspection" : "Field Inspection",
      inspectionReasonId: seed.taskId,
      inspectionReasonNameEn: seed.reasonNameEn,
      isDigitalVisit: isDigitalInspection,
      priorityId: seed.priorityId,
      priorityNameEn: seed.priorityNameEn,
      priorityNameAr: priorityNameArMap[seed.priorityNameEn],
      dueDate: seed.dueDate,
      slaMinutes: seed.priorityNameEn === "Critical" ? 1440 : seed.priorityNameEn === "High" ? 2880 : 4320,
    },
    assignment: isAssigned
      ? {
        isAssigned: true,
        assignedInspector: assignedInspectors[0].inspectorId,
        assignedInspectors,
        assignmentReasonEn: "Mock assignment for role and status coverage",
        assignedAt: seed.assignedAt || seed.createdAt,
      }
      : {
        isAssigned: false,
        assignedInspectors: [],
        assignmentReasonEn: "Awaiting manager assignment",
      },
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    description: seed.description,
    tabs: [
      "all",
      seed.status === "QUEUED" || seed.status === "PENDING_ASSIGNMENT" ? "queued" : "teamTasks",
      ["COMPLETED", "ACCESS_FAILED", "CANCELLED"].includes(seed.status) ? "completed" : "todo",
    ],
    reportPreview: seed.reportSummary
      ? {
        reportId: `RPT-${seed.taskId}`,
        taskId: seed.taskId,
        taskNo: seed.taskNo,
        generatedAt: seed.reportSummary.submittedAt || seed.updatedAt,
        previewUrl: `/mock/inspection/report/RPT-${seed.taskId}`,
        reportSummary: seed.reportSummary,
        checklistCategories,
      }
      : undefined,
  };
};

const accessFailedSummary = {
  result: "ACCESS_FAILED",
  accessResult: "unable_to_access",
  accessReason: "Representative refused access to the inspection target.",
  accessRemark: "Access was attempted and recorded with supporting evidence.",
  checkInAt: "2026-04-19T08:40:00+04:00",
  checkOutAt: "2026-04-19T09:05:00+04:00",
  location: "Abu Dhabi Authority",
  contactPerson: {
    name: "Not available",
    designation: "Not available",
    mobilePhone: "-",
    emailAddress: "-",
    declarationStatus: "not_available",
  },
  accessFailedHistory: {
    inspectionIntervalExempt: true,
    eligibleManualReason: "Access Failed",
    note: "Target remains eligible for manual Access Failed task creation inside the normal interval window.",
  },
  seizedMaterials: [],
  submittedAt: "2026-04-19T09:05:00+04:00",
};

const fieldSignedDeclarationSummary = {
  result: "COMPLETED",
  accessResult: "accessed_successfully",
  overallComment: "Field inspection completed with signed acknowledgement.",
  recommendedAction: "Keep the signed declaration in the task record.",
  checkInAt: "2026-04-15T09:00:00+04:00",
  checkOutAt: "2026-04-15T11:15:00+04:00",
  checkInLocation: "Ajman Authority, Industrial Area 2",
  checkOutLocation: "Ajman Authority, Industrial Area 2",
  contactPerson: {
    name: "Salim Haddad",
    designation: "Operations Manager",
    mobilePhone: `${DEFAULT_COUNTRY_DIAL_CODE} 50 220 4400`,
    emailAddress: "salim.haddad@example.com",
    declarationStatus: "signed",
    acknowledgedAt: "2026-04-15T10:45:00+04:00",
    signatureImageUrl: "/mock/inspection/signatures/salim-haddad.png",
    signedDeclarationDocument: {
      fileName: "declaration-acknowledgement-signed.pdf",
      documentType: "Declaration and Acknowledgement",
      generatedAt: "2026-04-15T10:46:00+04:00",
      acknowledgingParty: "Salim Haddad",
      acknowledgementDate: "2026-04-15",
      url: "/mock/inspection/documents/declaration-acknowledgement-signed.pdf",
    },
  },
  createdViolations: [
    {
      violationId: "V-LICENSE-10012",
      violationNo: "VN-2026-10012-L",
      violationCode: "L2",
      violationName: "Practicing additional media activity without a license",
      violationType: "License Violation",
      status: "PENDING_PAYMENT",
      notes: "The inspection team confirmed an additional activity at the field location.",
      attachments: [
        {
          fileName: "license-activity-evidence.pdf",
          fileUrl: "/api/admin/inspection/mock-files/evidence/license-activity-evidence.pdf",
        },
      ],
    },
    {
      violationId: "V-CONTENT-10012",
      violationNo: "VN-2026-10012-C",
      violationCode: "C16",
      violationName: "Publishing rumors or misleading news",
      violationType: "Content Violation",
      status: "PENDING_ROUTING",
      notes: "A printed sample was retained for content review.",
      attachments: [
        {
          fileName: "printed-sample-photo.jpg",
          fileUrl: "/api/admin/inspection/mock-files/evidence/printed-sample-photo.jpg",
        },
      ],
    },
  ],
  seizedMaterials: [
    {
      id: "MAT-10012-1",
      materialType: "Book",
      materialName: "Imported Media Guide",
      isbn: "978-1-4028-9462-6",
      author: "Ajman Print Works",
      language: "English",
      numberOfCopy: 3,
    },
    {
      id: "MAT-10012-2",
      materialType: "Magazine",
      materialName: "Weekly Print Sample",
      isbn: "-",
      author: "Editorial Desk",
      language: "Arabic",
      numberOfCopy: 5,
    },
  ],
  submittedAt: "2026-04-15T11:15:00+04:00",
};

const digitalViolationSubmittedSummary = {
  result: "COMPLETED",
  accessResult: "accessed_successfully",
  overallComment: "Digital inspection completed with a content violation.",
  recommendedAction: "Send digital declaration link and route violation for review.",
  checkInAt: "2026-04-16T13:00:00+04:00",
  checkOutAt: "2026-04-16T14:20:00+04:00",
  contactPerson: {
    name: "Nadia Al-Tamimi",
    designation: "Account Owner",
    mobilePhone: `${DEFAULT_COUNTRY_DIAL_CODE} 50 123 4567`,
    emailAddress: "nadia.altamimi@example.com",
    declarationStatus: "submitted_by_link",
  },
  digitalDeclarationLink: {
    status: "submitted",
    sentAt: "2026-04-16T14:25:00+04:00",
    expiresAt: "2026-04-19T14:25:00+04:00",
    submittedAt: "2026-04-17T09:30:00+04:00",
    recipientEmail: "nadia.altamimi@example.com",
    contactInformationFormUrl: "/mock/inspection/forms/contact-person-digital-submitted.pdf",
    signedDeclarationUrl: "/mock/inspection/documents/declaration-digital-submitted.pdf",
  },
  expiredDigitalDeclarationLink: {
    status: "expired",
    sentAt: "2026-04-10T14:25:00+04:00",
    expiresAt: "2026-04-13T14:25:00+04:00",
    recipientEmail: "expired-contact@example.com",
  },
  createdViolations: [
    {
      violationId: "V-LICENSE-10013",
      violationNo: "VN-2026-10013-L",
      violationCode: "L2",
      violationName: "Practicing additional media activity without a license",
      violationType: "License Violation",
      status: "PENDING_PAYMENT",
    },
    {
      violationId: "V-DIGITAL-10013",
      violationNo: "VN-2026-10013-C",
      violationCode: "C15",
      violationName: "Publishing false or forged news or information",
      violationType: "Content Violation",
      status: "PENDING_ROUTING",
    },
  ],
  seizedMaterials: [],
  submittedAt: "2026-04-16T14:20:00+04:00",
};

inspectionTasks.push(
  ...([
    {
      taskId: 10008,
      taskNo: "INS-2026-001008",
      taskName: "Inspector pending visit coverage",
      status: "PENDING_VISIT",
      sourceType: "AUTO",
      reasonNameEn: "Not Inspected Establishments",
      targetName: "Fujairah Book Centre",
      licenseNumber: "LIC-2026-6008",
      activityName: "Issuing License for selling books and publications",
      emirateId: 6,
      emirateNameEn: "Fujairah",
      communityNameEn: "Town Centre",
      street: "Hamad Bin Abdullah Road",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-05-05T23:59:59+04:00",
      createdAt: "2026-04-20T07:30:00+04:00",
      updatedAt: "2026-04-21T08:10:00+04:00",
      assignedAt: "2026-04-21T08:10:00+04:00",
      inspectorIndexes: [0],
      riskScore: 68,
      riskLevel: "HIGH",
      description: "Inspector to-do coverage for a pending field inspection.",
    },
    {
      taskId: 10009,
      taskNo: "INS-2026-001009",
      taskName: "Inspector cancelled digital account check",
      status: "CANCELLED",
      sourceType: "BATCH",
      reasonNameEn: "Valid Licenses Near Expiry Within 1 Year",
      targetName: "Layla Creative Account",
      targetType: 2,
      targetTypeName: "Individual",
      licenseNumber: "EID-2026-6009",
      activityName: "Social Media Advertising",
      emirateId: 7,
      emirateNameEn: "Umm Al Quwain",
      communityNameEn: "Al Salamah",
      street: "King Faisal Street",
      isDigitalVisit: true,
      priorityId: 4,
      priorityNameEn: "Low",
      dueDate: "2026-04-28T23:59:59+04:00",
      createdAt: "2026-04-12T09:00:00+04:00",
      updatedAt: "2026-04-18T15:30:00+04:00",
      assignedAt: "2026-04-13T09:15:00+04:00",
      inspectorIndexes: [0],
      riskScore: 35,
      riskLevel: "LOW",
      description: "Cancelled task assigned to the current inspector for completed tab coverage.",
    },
    {
      taskId: 10010,
      taskNo: "INS-2026-001010",
      taskName: "Digital platform pending review visit",
      status: "PENDING_VISIT",
      sourceType: "AUTO",
      reasonNameEn: "Valid Licenses Near Expiry Within 6 Months",
      targetName: "Dubai Stream Hub",
      licenseNumber: "LIC-2026-6010",
      activityName: "Digital Media Platform",
      emirateId: 2,
      emirateNameEn: "Dubai",
      communityNameEn: "Business Bay",
      street: "Marasi Drive",
      isDigitalVisit: true,
      priorityId: 1,
      priorityNameEn: "Critical",
      dueDate: "2026-05-01T23:59:59+04:00",
      createdAt: "2026-04-22T10:10:00+04:00",
      updatedAt: "2026-04-22T11:00:00+04:00",
      assignedAt: "2026-04-22T11:00:00+04:00",
      inspectorIndexes: [2],
      riskScore: 91,
      riskLevel: "CRITICAL",
      description: "Manager team task coverage for a critical digital pending visit.",
    },
    {
      taskId: 10011,
      taskNo: "INS-2026-001011",
      taskName: "Broadcast station field inspection",
      status: "IN_PROGRESS",
      sourceType: "BATCH",
      reasonNameEn: "Valid Licenses Near Expiry Within 3 Months",
      targetName: "Sharjah Broadcast Network",
      licenseNumber: "LIC-2026-6011",
      activityName: "Broadcasting Station",
      emirateId: 3,
      emirateNameEn: "Sharjah",
      communityNameEn: "Al Majaz",
      street: "Corniche Street",
      isDigitalVisit: false,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-04-29T23:59:59+04:00",
      createdAt: "2026-04-18T08:20:00+04:00",
      updatedAt: "2026-04-23T09:45:00+04:00",
      assignedAt: "2026-04-19T08:35:00+04:00",
      inspectorIndexes: [3],
      riskScore: 57,
      riskLevel: "MEDIUM",
      description: "Manager team task coverage for an in-progress field visit.",
    },
    {
      taskId: 10012,
      taskNo: "INS-2026-001012",
      taskName: "Signed declaration field inspection",
      status: "COMPLETED",
      sourceType: "FOLLOW_UP",
      reasonNameEn: "Corrective Action Reinspection",
      targetName: "Ajman Print Works",
      licenseNumber: "LIC-2026-6012",
      activityName: "Printing Press",
      emirateId: 5,
      emirateNameEn: "Ajman",
      communityNameEn: "Al Jurf",
      street: "Industrial Area 2",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-04-15T23:59:59+04:00",
      createdAt: "2026-04-10T12:00:00+04:00",
      updatedAt: "2026-04-15T11:15:00+04:00",
      assignedAt: "2026-04-11T08:30:00+04:00",
      inspectorIndexes: [1],
      riskScore: 74,
      riskLevel: "HIGH",
      description: "Field inspection report with a signed declaration document.",
      reportSummary: fieldSignedDeclarationSummary,
    },
    {
      taskId: 10013,
      taskNo: "INS-2026-001013",
      taskName: "Digital inspection with declaration link",
      status: "COMPLETED",
      sourceType: "AUTO",
      reasonNameEn: "Critical Content Violation",
      targetName: "Nadia Culture Channel",
      targetType: 2,
      targetTypeName: "Individual",
      licenseNumber: "EID-2026-6013",
      activityName: "Social Media Influencer",
      emirateId: 1,
      emirateNameEn: "Abu Dhabi",
      communityNameEn: "Khalifa City",
      street: "Digital Account",
      isDigitalVisit: true,
      priorityId: 1,
      priorityNameEn: "Critical",
      dueDate: "2026-04-16T23:59:59+04:00",
      createdAt: "2026-04-14T13:10:00+04:00",
      updatedAt: "2026-04-16T14:20:00+04:00",
      assignedAt: "2026-04-15T09:00:00+04:00",
      inspectorIndexes: [2],
      riskScore: 95,
      riskLevel: "CRITICAL",
      description: "Digital inspection with violation and post-inspection declaration link coverage.",
      reportSummary: digitalViolationSubmittedSummary,
    },
    {
      taskId: 10014,
      taskNo: "INS-2026-001014",
      taskName: "Campaign queued cinema inspection",
      status: "QUEUED",
      sourceType: "MANUAL",
      reasonNameEn: "Inspection Campaign",
      targetName: "Fujairah Cinema Circuit",
      licenseNumber: "LIC-2026-6014",
      activityName: "Cinema Theater",
      emirateId: 6,
      emirateNameEn: "Fujairah",
      communityNameEn: "City Centre",
      street: "Cinema Avenue",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-05-07T23:59:59+04:00",
      createdAt: "2026-04-24T08:00:00+04:00",
      updatedAt: "2026-04-24T08:00:00+04:00",
      riskScore: 69,
      riskLevel: "HIGH",
      description: "Queued campaign task available for manager assignment.",
    },
    {
      taskId: 10015,
      taskNo: "INS-2026-001015",
      taskName: "Expired license queued task",
      status: "QUEUED",
      sourceType: "AUTO",
      reasonNameEn: "Expired Licenses Never Inspected",
      targetName: "Umm Al Quwain Game Retail",
      licenseNumber: "LIC-2026-6015",
      activityName: "Game Retail",
      emirateId: 7,
      emirateNameEn: "Umm Al Quwain",
      communityNameEn: "Al Raas",
      street: "Retail Market Road",
      isDigitalVisit: false,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-05-10T23:59:59+04:00",
      createdAt: "2026-04-25T10:20:00+04:00",
      updatedAt: "2026-04-25T10:20:00+04:00",
      riskScore: 62,
      riskLevel: "MEDIUM",
      description: "Queued automatic task for expired license coverage.",
    },
    {
      taskId: 10016,
      taskNo: "INS-2026-001016",
      taskName: "Team access failed task",
      status: "ACCESS_FAILED",
      sourceType: "MANUAL",
      reasonNameEn: "Access Failed",
      targetName: "Abu Dhabi Media Archive",
      licenseNumber: "LIC-2026-6016",
      activityName: "Newspaper-Magazine",
      emirateId: 1,
      emirateNameEn: "Abu Dhabi",
      communityNameEn: "Al Bateen",
      street: "Archive Street",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-04-19T23:59:59+04:00",
      createdAt: "2026-04-17T08:40:00+04:00",
      updatedAt: "2026-04-19T09:05:00+04:00",
      assignedAt: "2026-04-18T08:00:00+04:00",
      inspectorIndexes: [3],
      riskScore: 77,
      riskLevel: "HIGH",
      description: "Access Failed coverage with generated report metadata.",
      reportSummary: accessFailedSummary,
    },
    {
      taskId: 10017,
      taskNo: "INS-2026-001017",
      taskName: "One year expired license digital task",
      status: "PENDING_VISIT",
      sourceType: "AUTO",
      reasonNameEn: "Expired Licenses Within 1 Year",
      targetName: "RAK Video Distribution",
      licenseNumber: "LIC-2026-6017",
      activityName: "Film-Video Distributor",
      emirateId: 4,
      emirateNameEn: "Ras Al Khaimah",
      communityNameEn: "Al Nakheel",
      street: "Media Warehouse 4",
      isDigitalVisit: true,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-05-02T23:59:59+04:00",
      createdAt: "2026-04-20T16:00:00+04:00",
      updatedAt: "2026-04-21T09:30:00+04:00",
      assignedAt: "2026-04-21T09:30:00+04:00",
      inspectorIndexes: [0],
      riskScore: 52,
      riskLevel: "MEDIUM",
      description: "Inspector pending visit coverage for expired license reason.",
    },
    {
      taskId: 10018,
      taskNo: "INS-2026-001018",
      taskName: "Six month expired license field task",
      status: "IN_PROGRESS",
      sourceType: "BATCH",
      reasonNameEn: "Expired Licenses Within 6 Months",
      targetName: "Dubai Production Studios",
      licenseNumber: "LIC-2026-6018",
      activityName: "Production Company",
      emirateId: 2,
      emirateNameEn: "Dubai",
      communityNameEn: "Media City",
      street: "Studio Lane",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-04-22T23:59:59+04:00",
      createdAt: "2026-04-18T09:40:00+04:00",
      updatedAt: "2026-04-23T12:10:00+04:00",
      assignedAt: "2026-04-19T10:00:00+04:00",
      inspectorIndexes: [1],
      riskScore: 73,
      riskLevel: "HIGH",
      description: "Team task in progress for expired license filter coverage.",
    },
    {
      taskId: 10019,
      taskNo: "INS-2026-001019",
      taskName: "Three month expired license completed task",
      status: "COMPLETED",
      sourceType: "AUTO",
      reasonNameEn: "Expired Licenses Within 3 Months",
      targetName: "Sharjah Book Publisher",
      licenseNumber: "LIC-2026-6019",
      activityName: "Publisher",
      emirateId: 3,
      emirateNameEn: "Sharjah",
      communityNameEn: "Al Khan",
      street: "Publishing Road",
      isDigitalVisit: true,
      priorityId: 4,
      priorityNameEn: "Low",
      dueDate: "2026-04-18T23:59:59+04:00",
      createdAt: "2026-04-12T12:15:00+04:00",
      updatedAt: "2026-04-18T15:10:00+04:00",
      assignedAt: "2026-04-13T12:20:00+04:00",
      inspectorIndexes: [0],
      riskScore: 38,
      riskLevel: "LOW",
      description: "Completed digital inspection for low priority filter coverage.",
      reportSummary: {
        result: "COMPLETED",
        accessResult: "accessed_successfully",
        overallComment: "Digital inspection completed without violations.",
        seizedMaterials: [],
        submittedAt: "2026-04-18T15:10:00+04:00",
      },
    },
    {
      taskId: 10020,
      taskNo: "INS-2026-001020",
      taskName: "Repeated violation queued task",
      status: "QUEUED",
      sourceType: "MANUAL",
      reasonNameEn: "Repeated Violation Within 6 Months",
      targetName: "Ajman Advertising Boards",
      licenseNumber: "LIC-2026-6020",
      activityName: "Advertising Agency",
      emirateId: 5,
      emirateNameEn: "Ajman",
      communityNameEn: "Al Nuaimiya",
      street: "Billboard Street",
      isDigitalVisit: false,
      priorityId: 1,
      priorityNameEn: "Critical",
      dueDate: "2026-05-04T23:59:59+04:00",
      createdAt: "2026-04-24T14:15:00+04:00",
      updatedAt: "2026-04-24T14:15:00+04:00",
      riskScore: 88,
      riskLevel: "CRITICAL",
      description: "Queued manual task for repeated violation duplicate warning scenario.",
    },
    {
      taskId: 10021,
      taskNo: "INS-2026-001021",
      taskName: "Twelve month repeated violation task",
      status: "PENDING_VISIT",
      sourceType: "FOLLOW_UP",
      reasonNameEn: "Repeated Violation Within 12 Months",
      targetName: "Abu Dhabi Podcast Studio",
      licenseNumber: "LIC-2026-6021",
      activityName: "Podcast Video Blog Platform",
      emirateId: 1,
      emirateNameEn: "Abu Dhabi",
      communityNameEn: "Khalifa City",
      street: "Creative Studio 8",
      isDigitalVisit: false,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-05-06T23:59:59+04:00",
      createdAt: "2026-04-21T08:30:00+04:00",
      updatedAt: "2026-04-22T08:30:00+04:00",
      assignedAt: "2026-04-22T08:30:00+04:00",
      inspectorIndexes: [2],
      riskScore: 71,
      riskLevel: "HIGH",
      description: "Follow-up task for repeated violation coverage.",
    },
    {
      taskId: 10022,
      taskNo: "INS-2026-001022",
      taskName: "High severity digital violation task",
      status: "IN_PROGRESS",
      sourceType: "AUTO",
      reasonNameEn: "High Severity Violation Detected",
      targetName: "Dubai Social Media Talent",
      targetType: 2,
      targetTypeName: "Individual",
      licenseNumber: "EID-2026-6022",
      activityName: "Social Media Influencer",
      emirateId: 2,
      emirateNameEn: "Dubai",
      communityNameEn: "Jumeirah",
      street: "Social Account",
      isDigitalVisit: true,
      priorityId: 1,
      priorityNameEn: "Critical",
      dueDate: "2026-04-26T23:59:59+04:00",
      createdAt: "2026-04-22T13:00:00+04:00",
      updatedAt: "2026-04-23T16:30:00+04:00",
      assignedAt: "2026-04-23T09:30:00+04:00",
      inspectorIndexes: [3],
      riskScore: 93,
      riskLevel: "CRITICAL",
      description: "Digital in-progress task for high severity violation coverage.",
    },
    {
      taskId: 10023,
      taskNo: "INS-2026-001023",
      taskName: "License status inconsistency completed task",
      status: "COMPLETED",
      sourceType: "BATCH",
      reasonNameEn: "License Status Inconsistency",
      targetName: "Fujairah Foreign Media Office",
      licenseNumber: "LIC-2026-6023",
      activityName: "Foreign Media Office",
      emirateId: 6,
      emirateNameEn: "Fujairah",
      communityNameEn: "Port Area",
      street: "Correspondent Road",
      isDigitalVisit: false,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-04-17T23:59:59+04:00",
      createdAt: "2026-04-11T10:10:00+04:00",
      updatedAt: "2026-04-17T13:25:00+04:00",
      assignedAt: "2026-04-12T09:20:00+04:00",
      inspectorIndexes: [1],
      riskScore: 58,
      riskLevel: "MEDIUM",
      description: "Completed field task for license status inconsistency coverage.",
      reportSummary: {
        result: "COMPLETED",
        accessResult: "accessed_successfully",
        overallComment: "License status inconsistency was resolved during inspection.",
        contactPerson: { name: "Hassan Noor", designation: "Office Manager", mobilePhone: `${DEFAULT_COUNTRY_DIAL_CODE} 52 120 9090`, emailAddress: "hassan.noor@example.com", declarationStatus: "not_signed" },
        createdViolations: [
          {
            violationId: "V-LICENSE-10023",
            violationNo: "VN-2026-10023",
            violationCode: "L10",
            violationName: "Failure to update establishment data or changes",
            violationType: "License Violation",
            status: "PENDING_PAYMENT",
          },
        ],
        seizedMaterials: [],
        submittedAt: "2026-04-17T13:25:00+04:00",
      },
    },
    {
      taskId: 10024,
      taskNo: "INS-2026-001024",
      taskName: "Public complaint access failed task",
      status: "ACCESS_FAILED",
      sourceType: "MANUAL",
      reasonNameEn: "Complaint from Public",
      targetName: "Umm Al Quwain News Desk",
      licenseNumber: "LIC-2026-6024",
      activityName: "Newspaper-Magazine",
      emirateId: 7,
      emirateNameEn: "Umm Al Quwain",
      communityNameEn: "Old Town",
      street: "Press Road",
      isDigitalVisit: true,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-04-20T23:59:59+04:00",
      createdAt: "2026-04-18T11:00:00+04:00",
      updatedAt: "2026-04-20T12:00:00+04:00",
      assignedAt: "2026-04-19T09:00:00+04:00",
      inspectorIndexes: [0],
      riskScore: 79,
      riskLevel: "HIGH",
      description: "Access failed task assigned to current inspector from a public complaint.",
      reportSummary: {
        ...accessFailedSummary,
        accessReason: "Digital account owner did not respond to verified contact attempts.",
        contactPerson: { name: "Unavailable", designation: "Account Owner", mobilePhone: "-", emailAddress: "-", declarationStatus: "not_available" },
        submittedAt: "2026-04-20T12:00:00+04:00",
      },
    },
    {
      taskId: 10025,
      taskNo: "INS-2026-001025",
      taskName: "Authority complaint cancelled task",
      status: "CANCELLED",
      sourceType: "BATCH",
      reasonNameEn: "Complaint from Authority",
      targetName: "RAK Outdoor Media",
      licenseNumber: "LIC-2026-6025",
      activityName: "Advertising Agency",
      emirateId: 4,
      emirateNameEn: "Ras Al Khaimah",
      communityNameEn: "Al Hamra",
      street: "Outdoor Media Road",
      isDigitalVisit: false,
      priorityId: 4,
      priorityNameEn: "Low",
      dueDate: "2026-04-23T23:59:59+04:00",
      createdAt: "2026-04-14T08:00:00+04:00",
      updatedAt: "2026-04-23T15:00:00+04:00",
      assignedAt: "2026-04-15T09:00:00+04:00",
      inspectorIndexes: [2],
      riskScore: 32,
      riskLevel: "LOW",
      description: "Cancelled team task for authority complaint coverage.",
    },
    {
      taskId: 10026,
      taskNo: "INS-2026-001026",
      taskName: "Other reason queued task",
      status: "QUEUED",
      sourceType: "MANUAL",
      reasonNameEn: "Other",
      targetName: "Abu Dhabi Culture Retail",
      licenseNumber: "LIC-2026-6026",
      activityName: "Bookstore",
      emirateId: 1,
      emirateNameEn: "Abu Dhabi",
      communityNameEn: "Al Falah",
      street: "Culture Market",
      isDigitalVisit: false,
      priorityId: 4,
      priorityNameEn: "Low",
      dueDate: "2026-05-12T23:59:59+04:00",
      createdAt: "2026-04-25T15:30:00+04:00",
      updatedAt: "2026-04-25T15:30:00+04:00",
      riskScore: 29,
      riskLevel: "LOW",
      description: "Queued fallback task for other reason coverage.",
    },
    {
      taskId: 10027,
      taskNo: "INS-2026-001027",
      taskName: "Batch generated queued review",
      status: "QUEUED",
      sourceType: "BATCH",
      reasonNameEn: "Inspection Campaign",
      targetName: "Dubai Licensing Batch Review",
      licenseNumber: "LIC-2026-6027",
      activityName: "Media Trading",
      emirateId: 2,
      emirateNameEn: "Dubai",
      communityNameEn: "Business Bay",
      street: "Batch Review Tower",
      isDigitalVisit: false,
      priorityId: 3,
      priorityNameEn: "Medium",
      dueDate: "2026-05-14T23:59:59+04:00",
      createdAt: "2026-04-26T09:00:00+04:00",
      updatedAt: "2026-04-26T09:00:00+04:00",
      riskScore: 46,
      riskLevel: "MEDIUM",
      description: "Queued batch task for Created By filter coverage.",
    },
    {
      taskId: 10028,
      taskNo: "INS-2026-001028",
      taskName: "Follow-up queued inspection",
      status: "QUEUED",
      sourceType: "FOLLOW_UP",
      reasonNameEn: "Corrective Action Reinspection",
      targetName: "Sharjah Follow-up Publisher",
      licenseNumber: "LIC-2026-6028",
      activityName: "Publishing Activity",
      emirateId: 3,
      emirateNameEn: "Sharjah",
      communityNameEn: "Al Majaz",
      street: "Follow-up Street",
      isDigitalVisit: true,
      priorityId: 2,
      priorityNameEn: "High",
      dueDate: "2026-05-15T23:59:59+04:00",
      createdAt: "2026-04-26T11:30:00+04:00",
      updatedAt: "2026-04-26T11:30:00+04:00",
      riskScore: 64,
      riskLevel: "HIGH",
      description: "Queued follow-up task for Created By filter coverage.",
    },
  ] satisfies TaskCoverageSeed[]).map(buildCoverageTask),
);

const clampRiskScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const getRiskLevelFromScore = (score: number): InspectionRiskLevel => {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
};

const getRiskLevelName = (level: InspectionRiskLevel) => {
  if (level === "CRITICAL") return "Critical Risk Level";
  if (level === "HIGH") return "High Risk Level";
  if (level === "MEDIUM") return "Medium Risk Level";
  return "Low Risk Level";
};

const getRiskDimensionTone = (score: number): InspectionRiskLevel => {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
};

const buildRiskDimensions = (
  score: number,
  overrides?: Partial<Record<"entity" | "licensing" | "content" | "pattern", number>>,
): InspectionRiskDimension[] => {
  const values = {
    entity: clampRiskScore(overrides?.entity ?? score - 6),
    licensing: clampRiskScore(overrides?.licensing ?? score - 11),
    content: clampRiskScore(overrides?.content ?? score + 9),
    pattern: clampRiskScore(overrides?.pattern ?? score),
  };

  return [
    {
      key: "entityRiskDetection",
      labelEn: "Entity Risk Detection",
      score: values.entity,
      tone: getRiskDimensionTone(values.entity),
    },
    {
      key: "licensingConsistency",
      labelEn: "Licensing Consistency",
      score: values.licensing,
      tone: getRiskDimensionTone(values.licensing),
    },
    {
      key: "contentRiskDetection",
      labelEn: "Content Risk Detection",
      score: values.content,
      tone: getRiskDimensionTone(values.content),
    },
    {
      key: "patternRecognition",
      labelEn: "Pattern Recognition",
      score: values.pattern,
      tone: getRiskDimensionTone(values.pattern),
    },
  ];
};

const riskInsightOverrides: Record<number, {
  aiRiskScore?: number;
  aiRiskLevelName?: string;
  riskDimensions?: InspectionRiskDimension[];
  aiRiskInsight?: string;
}> = {
  10013: {
    aiRiskScore: 86,
    aiRiskLevelName: "High Risk Level",
    riskDimensions: buildRiskDimensions(86, {
      entity: 80,
      licensing: 75,
      content: 95,
      pattern: 86,
    }),
    aiRiskInsight:
      "This task was automatically created because the establishment showed multiple risk indicators, including expired or missing media license records, previous inspection findings, and repeated activity mismatches against licensed media activities.",
  },
  10012: {
    aiRiskScore: 42,
    aiRiskLevelName: "Low Risk Level",
    riskDimensions: buildRiskDimensions(42, {
      entity: 38,
      licensing: 44,
      content: 29,
      pattern: 41,
    }),
  },
  10023: {
    aiRiskScore: 72,
    aiRiskLevelName: "High Risk Level",
    riskDimensions: buildRiskDimensions(72, {
      entity: 66,
      licensing: 88,
      content: 42,
      pattern: 70,
    }),
  },
  10028: {
    aiRiskScore: 64,
    aiRiskLevelName: "Medium Risk Level",
    riskDimensions: buildRiskDimensions(64, {
      entity: 58,
      licensing: 53,
      content: 73,
      pattern: 64,
    }),
    aiRiskInsight:
      "This queued follow-up inspection was created because previous corrective action records, licensing consistency checks, and content signals require another review before closure.",
  },
};

const applyRiskInsightData = (task: InspectionTaskDetail) => {
  const override = riskInsightOverrides[task.taskId] || {};
  const aiRiskScore = clampRiskScore(override.aiRiskScore ?? task.riskProfile.aiRiskScore ?? task.riskProfile.riskScore);
  const aiRiskLevel = getRiskLevelFromScore(aiRiskScore);
  const aiRiskLevelName = override.aiRiskLevelName || getRiskLevelName(aiRiskLevel);

  task.riskProfile = {
    ...task.riskProfile,
    aiRiskScore,
    aiRiskLevelName,
    aiRiskInsight:
      override.aiRiskInsight ||
      task.riskProfile.aiRiskInsight ||
      `Risk engine assessment for ${task.inspectionTarget.establishmentNameEn} based on licensing records, inspection history, content signals, and repeated behavior patterns.`,
    riskDimensions:
      override.riskDimensions ||
      (task.riskProfile.riskDimensions && task.riskProfile.riskDimensions.length
        ? task.riskProfile.riskDimensions
        : buildRiskDimensions(aiRiskScore)),
  };
};

inspectionTasks.forEach((task) => {
  applyRiskInsightData(task);
  task.smartChecklistSnapshot = createChecklist(
    task.inspectionTarget.establishmentId || 0,
    task.riskProfile,
  );
});

const taskDrafts = new Map<number, TaskDraftRecord>();
const reportStore = new Map<string, InspectionReportPreview>();
/* OCR mock endpoints removed: the OCR flow calls the real backend. */
const declarationStore = new Map<string, Record<string, any>>();

const violationMockData: InspectionViolationItem[] = [
  {
    id: "V-1001",
    violationId: "V-1001",
    violationNo: "VNO-1001",
    violationCode: "V-LIC-001",
    title: "Unauthorized Operation",
    violationName: "Unlicensed Operation",
    level: "High",
    severity: "CRITICAL",
    status: "OPEN",
    description:
      "Operation scope exceeds the active establishment license during inspection.",
    location: "Abu Dhabi - Al Falah Street",
    inspectionDate: "2026-04-13",
    taskId: 10001,
    taskNo: "IN-2026-5453455",
    establishmentId: 5001,
    establishmentNameEn: "Emirates Media Corp",
    categoryName: "Qualification & License Inspection",
    penaltyBasis: "Article 12.1",
    assignedInspector: "Ava Khan",
  },
  {
    id: "V-1002",
    violationId: "V-1002",
    violationNo: "VNO-1002",
    violationCode: "V-OPS-010",
    title: "Inventory Traceability Gap",
    violationName: "Inventory Traceability Gap",
    level: "Medium",
    severity: "HIGH",
    status: "UNDER_REVIEW",
    description: "Stock ledger does not reconcile with delivery source documents.",
    location: "Dubai - Warehouse District 7",
    inspectionDate: "2026-04-18",
    taskId: 10002,
    taskNo: "IN-2026-5453456",
    establishmentId: 5002,
    establishmentNameEn: "Abu Dhabi Media",
    categoryName: "Operational Control Review",
    penaltyBasis: "Article 17.2",
    assignedInspector: "Ethan Noor",
  },
  {
    id: "V-1003",
    violationId: "V-1003",
    violationNo: "VNO-1003",
    violationCode: "V-MKT-004",
    title: "Shelf Labeling Non-compliance",
    violationName: "Shelf Labeling Non-compliance",
    level: "Low",
    severity: "MEDIUM",
    status: "RECTIFICATION_REQUIRED",
    description: "Retail shelf labels do not match registered publication details.",
    location: "Abu Dhabi - Corniche Market Street",
    inspectionDate: "2026-04-20",
    taskId: 10003,
    taskNo: "IN-2026-5453457",
    establishmentId: 5003,
    establishmentNameEn: "Corner Pages Trading",
    categoryName: "Operational Control Review",
    penaltyBasis: "Article 9.7",
    assignedInspector: "Unassigned",
  },
];

violationMockData.push(
  ...[
    ["V-1004", "VNO-1004", "V-CNT-004", "PENDING_ROUTING", 10001, "Emirates Media Corp", "Content Review", "Ava Khan"],
    ["V-1005", "VNO-1005", "V-CNT-005", "PENDING_CONTENT_REPORT", 10004, "Gulf Digital Media FZ", "Content Report", "Ava Khan"],
    ["V-1006", "VNO-1006", "V-CMT-006", "PENDING_COMMITTEE_DECISION", 10004, "Gulf Digital Media FZ", "Committee Decision", "Maya Chen"],
    ["V-1007", "VNO-1007", "V-APP-007", "PENDING_APPROVAL", 10002, "Abu Dhabi Media", "Approval", "Ethan Noor"],
    ["V-1008", "VNO-1008", "V-WRN-008", "WARNING_ISSUED", 10005, "Embassy Cultural Club", "Warning", "Ava Khan"],
    ["V-1009", "VNO-1009", "V-REC-009", "RECTIFICATION", 10003, "Corner Pages Trading", "Rectification", "Omar Saleh"],
    ["V-1010", "VNO-1010", "V-APL-010", "UNDER_APPEAL", 10006, "Independent Media Seller", "Appeal", "Ava Khan"],
    ["V-1011", "VNO-1011", "V-PAY-011", "PAID", 10007, "Union Commercial Distribution", "Payment", "Maya Chen"],
    ["V-1012", "VNO-1012", "V-CAN-012", "CANCELLED", 10007, "Union Commercial Distribution", "Cancellation", "Maya Chen"],
    ["V-1013", "VNO-1013", "V-RES-013", "RESOLVED", 10004, "Gulf Digital Media FZ", "Resolved", "Ava Khan"],
  ].map(([id, violationNo, violationCode, status, taskId, establishmentNameEn, violationType, assignedInspector], index) => ({
    id: String(id),
    violationId: String(id),
    violationNo: String(violationNo),
    violationCode: String(violationCode),
    title: String(violationType) + " Workflow",
    violationName: String(violationType) + " Workflow",
    violationType: String(violationType),
    reason: String(violationType) + " reason",
    level: index % 2 ? "Medium" : "High",
    severity: index % 3 === 0 ? "CRITICAL" : index % 3 === 1 ? "HIGH" : "MEDIUM",
    status: status as InspectionViolationStatus,
    description: String(violationType) + " violation seeded for role-based workflow validation.",
    location: "Abu Dhabi",
    inspectionDate: "2026-04-21",
    taskId: Number(taskId),
    taskNo: "INS-2026-" + String(taskId).padStart(6, "0"),
    establishmentId: 5000 + index,
    establishmentNameEn: String(establishmentNameEn),
    categoryName: String(violationType),
    penaltyBasis: "Article " + (20 + index) + ".1",
    assignedInspector: String(assignedInspector),
    reportedBy: String(assignedInspector),
    workflowOwner: status === "PENDING_COMMITTEE_DECISION" ? "Inspection Committee" : status === "PENDING_CONTENT_REPORT" ? "Content Team" : "Inspection Supervisor",
    fineAmount: 2500 + index * 750,
    reinspectionNo: index % 2 === 0 ? "REI-2026-" + String(200 + index) : undefined,
    appealNo: status === "UNDER_APPEAL" ? "APL-2026-010" : undefined,
    committeeDecision: status === "PENDING_COMMITTEE_DECISION" ? "Pending committee review" : undefined,
    updatedAt: "2026-04-22T09:30:00Z",
    evidences: [{ title: "Evidence pack", description: "Checklist, OCR, and inspector notes are attached." }],
  })),
);


const figmaViolationRows = [
  ["V-FIGMA-1001", "VN-2026-3456789", "Content Violation", "Emirates Media Corp", 0, "PENDING_REVIEW", "2 days", "T-7921T-7921", "Omar Kh", "Transfer to Committee", 10001],
  ["V-FIGMA-1002", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 0, "PENDING_ROUTING", "1 day", "T-8291T-8291", "Fatima A", "Transfer", 10002],
  ["V-FIGMA-1003", "VN-2026-3456789", "License Violation", "OSN", 0, "WARNING_ISSUED", "-", "T-3562T-3562", "Ahmed I", "", 10003],
  ["V-FIGMA-1004", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 2000, "UNDER_APPEAL", "-", "T-9145T-9145", "Layla Ibi", "", 10002],
  ["V-FIGMA-1013", "VN-2026-3456792", "Content Violation", "Abu Dhabi Media", 3000, "PENDING_PAYMENT", "-", "T-6842T-6842", "Mariam Al-Nuaimi", "", 10002],
  ["V-FIGMA-1005", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 0, "PENDING_COMMITTEE_DECISION", "-", "T-2836T-2836", "Yousef I", "", 10002],
  ["V-FIGMA-1006", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 0, "PENDING_CONTENT_REPORT", "-", "T-4758T-4758", "Aisha Re", "", 10002],
  ["V-FIGMA-1007", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 2000, "UNDER_APPEAL", "-", "T-6932T-6932", "Ali Al-Mansouri", "", 10002],
  ["V-FIGMA-1008", "VN-2026-3456789", "License Violation", "Abu Dhabi Media", 0, "WARNING_ISSUED", "-", "T-1029T-1029", "Hessa Al-Ketbi", "", 10002],
  ["V-FIGMA-1009", "VN-2026-3456789", "License Violation", "Abu Dhabi Media", 2000, "PENDING_PAYMENT", "-", "T-5863T-5863", "Saeed Al-Mansoori", "", 10002],
  ["V-FIGMA-1010", "VN-2026-3456789", "Content Violation", "Abu Dhabi Media", 0, "PENDING_APPROVAL", "-", "T-7410T-7410", "Nadia Al-Tamimi", "Approve", 10002],
  ["V-FIGMA-1011", "VN-2026-3456790", "License Violation", "Gulf Digital Media FZ", 2000, "PAID", "-", "T-8754T-8754", "Ava Khan", "", 10004],
  ["V-FIGMA-1012", "VN-2026-3456791", "Content Violation", "Independent Media Seller", 0, "CANCELLED", "-", "T-9620T-9620", "Maya Chen", "", 10006],
] as const;

const figmaArabicEstablishmentName = "\u0646\u0627\u0646\u0633\u064a \u0647\u0641\u0633\u062f\u0641\u0643\u0646";
const figmaMockJpgDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const figmaMockPdfUrl = "http://localhost:5174/mock-inspection-content-review-report.pdf";
const mockDeclarationDocumentUrl = "/declaration-template.pdf";

const figmaReportedViolationItems = [
  {
    key: "foreign-relations",
    title: "Engaging in anything that would harm the State's foreign relations",
    violationDescription: "Engaging in anything that would harm the State's foreign relations",
    status: "PENDING_COMMITTEE_DECISION",
    statusLabel: "Pending Decision",
    attachments: [
      {
        key: "foreign-relations-proof-1",
        name: "violation proof1.jpg",
        url: figmaMockJpgDataUrl,
        type: "JPG",
      },
      {
        key: "foreign-relations-proof-2",
        name: "violation proof1.jpg",
        url: figmaMockJpgDataUrl,
        type: "JPG",
      },
    ],
    notes: "This notification informs the user that their submission has been successfully reviewed and approved. It confirms the approval status and may include relevant details such as the request type, reference number, and any next steps required.",
  },
  {
    key: "national-unity",
    title: "Publishing or circulating anything that harms national unity and social cohesion",
    violationDescription: "Publishing or circulating anything that harms national unity and social cohesion",
    status: "PENDING_COMMITTEE_DECISION",
    statusLabel: "Pending Decision",
    attachments: [],
    notes: "",
  },
  {
    key: "public-interest",
    title: "Insulting the prevailing values in society and disregarding the requirements of public interest",
    violationDescription: "Insulting the prevailing values in society and disregarding the requirements of public interest",
    status: "PENDING_COMMITTEE_DECISION",
    statusLabel: "Pending Decision",
    attachments: [],
    notes: "",
  },
];

const figmaFineDetailRows = [
  {
    key: "fine-license-info",
    violation: "Providing inaccurate, false, incorrect, or misleading information when getting a license or a permit for media activity",
    violationDescription: "Providing inaccurate, false, incorrect, or misleading information when getting a license or a permit for media activity",
    degree: 1,
    amount: 1000,
  },
  {
    key: "fine-unauthorized-content",
    violation: "Printing, circulating, or publishing readable, audio, or visual media content without obtaining authorization from the council or the competent authority, as applicable",
    violationDescription: "Printing, circulating, or publishing readable, audio, or visual media content without obtaining authorization from the council or the competent authority, as applicable",
    degree: 2,
    amount: 2000,
  },
];

const getFigmaFineDetails = (status: InspectionViolationStatus) => (
  ["PENDING_PAYMENT", "UNDER_APPEAL", "PAID"].includes(status)
    ? {
      rows: JSON.parse(JSON.stringify(figmaFineDetailRows)),
      totalFineAmount: 3000,
      originalFineAmount: 3000,
    }
    : null
);

const figmaContentReviewReport = {
  summary: "After thorough review of the submitted materials and the original broadcast, the Content Review team has determined that the content in question does constitute a violation of broadcasting standards. The hate speech elements were clearly identifiable and the misleading information was presented as factual without proper disclaimers.",
  attachments: [
    {
      key: "content-review-report",
      name: "Content_Review_Report_VIO-2024-005.pdf",
      url: figmaMockPdfUrl,
      type: "PDF",
    },
  ],
};

const figmaContentReportStatuses = [
  "PENDING_REVIEW",
  "PENDING_COMMITTEE_DECISION",
  "PENDING_APPROVAL",
  "WARNING_ISSUED",
  "PENDING_PAYMENT",
  "UNDER_APPEAL",
  "PAID",
  "CANCELLED",
];

const figmaCommitteeDecisionStatuses = [
  "WARNING_ISSUED",
  "PENDING_APPROVAL",
  "PENDING_PAYMENT",
  "UNDER_APPEAL",
  "PAID",
  "CANCELLED",
];

const figmaPaymentStatuses = ["PENDING_PAYMENT", "UNDER_APPEAL", "PAID"];

const getFigmaAvailableViolationActions = (status: InspectionViolationStatus) => {
  const actionMap: Record<string, string[]> = {
    PENDING_ROUTING: ["transfer_committee", "transfer_content"],
    PENDING_CONTENT_REPORT: ["submit_report"],
    PENDING_REVIEW: ["transfer_committee"],
    PENDING_COMMITTEE_DECISION: ["review_decide"],
    PENDING_APPROVAL: ["approve"],
  };

  return actionMap[status] || [];
};

const buildFigmaViolationTimeline = (status: InspectionViolationStatus) => {
  const items = [
    {
      key: "violation-created",
      title: "Violation Created",
      actor: "Automated System",
      actorType: "system",
      time: "2025-02-02T10:00:00+04:00",
    },
  ];

  if (["PENDING_CONTENT_REPORT", ...figmaContentReportStatuses].includes(status)) {
    items.unshift({
      key: "transferred-content",
      title: "Violation Transferred to Content Team",
      actor: "Violator",
      actorType: "violator",
      time: "2025-02-01T10:00:01+04:00",
    });
  }

  if (figmaContentReportStatuses.includes(status)) {
    items.unshift({
      key: "content-report-submitted",
      title: "Content Review Report Submitted",
      actor: "Sam",
      actorType: "user",
      time: "2025-02-01T10:00:01+04:00",
    });
  }

  if (["PENDING_COMMITTEE_DECISION", ...figmaCommitteeDecisionStatuses].includes(status)) {
    items.unshift({
      key: "transferred-committee",
      title: "Violation Transferred to Committee",
      actor: "Violator",
      actorType: "violator",
      time: "2025-02-01T10:00:01+04:00",
    });
  }

  if (figmaCommitteeDecisionStatuses.includes(status)) {
    items.unshift({
      key: "committee-decision-submitted",
      title: "Committee Decision Submitted",
      actor: "Inspection Committee",
      actorType: "user",
      time: "2025-02-03T14:30:00+04:00",
    });
  }

  if (status === "WARNING_ISSUED") {
    items.unshift({
      key: "warning-issued",
      title: "Warning Issued",
      actor: "Inspection Committee",
      actorType: "user",
      time: "2025-02-03T15:00:00+04:00",
    });
  }

  if (["PENDING_PAYMENT", "UNDER_APPEAL", "PAID"].includes(status)) {
    items.unshift({
      key: "fine-issued",
      title: "Fine Issued",
      actor: "Inspection Committee",
      actorType: "user",
      time: "2025-02-03T15:00:00+04:00",
    });
  }

  if (status === "UNDER_APPEAL") {
    items.unshift({
      key: "appeal-submitted",
      title: "Appeal Submitted",
      actor: "Violator",
      actorType: "violator",
      time: "2025-02-04T10:15:00+04:00",
    });
  }

  if (status === "PAID") {
    items.unshift({
      key: "payment-completed",
      title: "Payment Completed",
      actor: "Violator",
      actorType: "violator",
      time: "2025-02-05T11:45:00+04:00",
    });
  }

  if (status === "CANCELLED") {
    items.unshift({
      key: "violation-cancelled",
      title: "Violation Cancelled",
      actor: "Inspection Committee",
      actorType: "user",
      time: "2025-02-03T15:00:00+04:00",
    });
  }

  return items;
};

const getFigmaContentReviewReport = (status: InspectionViolationStatus) => (
  figmaContentReportStatuses.includes(status)
    ? JSON.parse(JSON.stringify(figmaContentReviewReport))
    : null
);

const getFigmaCommitteeDecision = (status: InspectionViolationStatus, fineAmount: number) => {
  if (!figmaCommitteeDecisionStatuses.includes(status)) return null;

  const decisionMap: Record<string, { decision: string; outcome: string; notes: string; reason?: string }> = {
    WARNING_ISSUED: {
      decision: "Warning Issued",
      outcome: "Warning",
      notes: "The committee confirmed the violation and issued a formal warning without financial penalty.",
    },
    PENDING_APPROVAL: {
      decision: "Fine Issued",
      outcome: "Pending Approval",
      notes: "The committee confirmed the violation and submitted the decision for approval.",
    },
    PENDING_PAYMENT: {
      decision: "Fine Issued",
      outcome: "Pending Payment",
      notes: "The committee confirmed the violation and issued a fine for payment.",
    },
    UNDER_APPEAL: {
      decision: "Fine Issued",
      outcome: "Under Appeal",
      notes: "The violator submitted an appeal after the committee issued a fine.",
    },
    PAID: {
      decision: "Fine Issued",
      outcome: "Paid",
      notes: "The committee decision was accepted and the issued fine has been paid.",
    },
    CANCELLED: {
      decision: "Violation Cancelled",
      outcome: "Cancelled",
      notes: "The committee cancelled the violation after reviewing the content report and supporting evidence.",
      reason: "Insufficient evidence to proceed with the violation.",
    },
  };
  const decision = decisionMap[status];

  return {
    ...decision,
    decisionBy: "Inspection Committee",
    decisionDate: "2025-02-03T14:30:00+04:00",
    fineAmount: ["WARNING_ISSUED", "CANCELLED"].includes(status) ? 0 : fineAmount,
  };
};

const getFigmaPaymentDetails = (status: InspectionViolationStatus, fineAmount: number, violationNo: string) => {
  if (!figmaPaymentStatuses.includes(status)) return null;

  return {
    paymentStatus: status === "PAID" ? "Paid" : status === "UNDER_APPEAL" ? "On Hold During Appeal" : "Pending Payment",
    amount: fineAmount,
    dueDate: "2025-02-15",
    paidOn: status === "PAID" ? "2025-02-05T11:45:00+04:00" : undefined,
    receiptNo: status === "PAID" ? "RCT-2026-3456790" : undefined,
    attachments: status === "PAID"
      ? [
        {
          key: "payment-receipt",
          name: `Payment_Receipt_${violationNo}.pdf`,
          url: figmaMockPdfUrl,
          type: "PDF",
        },
      ]
      : [],
  };
};

const getFigmaAppealDetails = (status: InspectionViolationStatus, fineAmount: number) => (
  status === "UNDER_APPEAL"
    ? {
      appealNo: "APL-2026-010",
      appealStatus: "Pending Review",
      submittedBy: "BANDAI NAMCO",
      submittedOn: "2025-02-04T10:15:00+04:00",
      reason: "The violator requested a re-evaluation of the issued fine based on additional supporting material.",
      oldFineAmount: fineAmount,
      newFineAmount: null,
      attachments: [
        {
          key: "appeal-support",
          name: "Appeal_Supporting_Document.pdf",
          url: figmaMockPdfUrl,
          type: "PDF",
        },
      ],
    }
    : null
);

const getFigmaViolationDescription = (violationType: string, index: number) => {
  if (violationType === "License Violation") {
    return figmaFineDetailRows[index % figmaFineDetailRows.length].violation;
  }

  return figmaReportedViolationItems[index % figmaReportedViolationItems.length].title;
};

violationMockData.splice(
  0,
  violationMockData.length,
  ...figmaViolationRows.map(([id, violationNo, violationType, establishmentNameEn, fineAmount, status, slaLabel, taskNo, reportedBy, actionLabel, taskId], index) => ({
    id: String(id),
    violationId: String(id),
    violationNo: String(violationNo),
    violationCode: `V-FIG-${index + 1}`,
    title: getFigmaViolationDescription(String(violationType), index),
    violationName: getFigmaViolationDescription(String(violationType), index),
    violationDescription: getFigmaViolationDescription(String(violationType), index),
    violationType: String(violationType),
    reason: String(violationType) === "License Violation" ? "License verification" : "Content compliance review",
    level: ["UNDER_APPEAL", "PENDING_PAYMENT"].includes(String(status)) ? "High" : "Medium",
    severity: ["UNDER_APPEAL", "PENDING_PAYMENT"].includes(String(status)) ? "HIGH" : "MEDIUM",
    status: status as InspectionViolationStatus,
    description: `${String(violationType)} seeded from Figma inspector list.`,
    location: "Abu Dhabi",
    inspectionDate: "2025-09-28",
    taskId: Number(taskId),
    taskNo: String(taskNo),
    establishmentId: 7000 + index,
    establishmentNameEn: String(establishmentNameEn),
    categoryName: String(violationType),
    penaltyBasis: "Article 20.1",
    assignedInspector: String(reportedBy),
    reportedBy: String(reportedBy),
    workflowOwner: "Inspection Team",
    fineAmount: Number(fineAmount),
    slaLabel: String(slaLabel),
    availableActions: getFigmaAvailableViolationActions(status as InspectionViolationStatus),
    actionLabel: String(actionLabel),
    createdAt: "2025-09-28T14:00:00+04:00",
    issuedTime: "2025-09-28T14:00:00+04:00",
    createdAtLabel: "28/09/2025 14:00:00",
    updatedAt: "2025-09-28T14:00:00+04:00",
    evidences: [{ title: "Evidence pack", description: "Checklist and inspector notes are attached." }],
    reportedViolations: JSON.parse(JSON.stringify(figmaReportedViolationItems)),
    contentReviewReport: getFigmaContentReviewReport(status as InspectionViolationStatus),
    committeeDecision: getFigmaCommitteeDecision(status as InspectionViolationStatus, Number(fineAmount)),
    paymentDetails: getFigmaPaymentDetails(status as InspectionViolationStatus, Number(fineAmount), String(violationNo)),
    appealDetails: getFigmaAppealDetails(status as InspectionViolationStatus, Number(fineAmount)),
    fineDetails: getFigmaFineDetails(status as InspectionViolationStatus),
    violatorOverview: {
      profileType: "Commercial",
      statusLabel: "Approved",
      fields: [
        {
          label: "Establishment Name",
          value: "BANDAI NAMCO",
          secondary: figmaArabicEstablishmentName,
        },
        {
          label: "Commercial License Number",
          value: "NMA-4458",
        },
        {
          label: "Emirate",
          value: "Abu Dhabi",
        },
      ],
      statistics: [
        { key: "documents", label: "Documents", count: 3, icon: "documents" },
        { key: "partners", label: "Partners", count: 2, icon: "partners" },
      ],
      alerts: [
        { key: "warnings", label: "Warnings & Violations", count: 0, tone: "danger" },
        { key: "unpaidFines", label: "Unpaid Fines", count: 1, tone: "warning" },
      ],
    },
    relatedReinspection: {
      taskNo: "IN-2026-5453452",
      status: "Queued",
      inspector: "-",
      dueDate: "2025-02-01",
    },
    violationTimeline: buildFigmaViolationTimeline(status as InspectionViolationStatus),
  })),
);

violationMockData.forEach((item) => {
  const task = inspectionTasks.find((candidate) => candidate.taskId === item.taskId);
  if (task) {
    item.taskSource = task.taskSource;
    item.inspectionTarget = task.inspectionTarget;
    item.riskProfile = task.riskProfile;
    item.inspectionConfig = task.inspectionConfig;
    item.assignment = task.assignment;
    item.timeline = [
      {
        action: "CREATED",
        operator: "System",
        actionAt: task.createdAt,
        remark: "Created from inspection result",
      },
      {
        action: "STATUS_UPDATED",
        operator: item.assignedInspector || "System",
        actionAt: `${item.inspectionDate}T09:00:00Z`,
        remark: `Current status: ${item.status}`,
      },
    ];
  }
});

const ok = <T>(data: T, message = "Success"): ApiResponse<T> => ({
  code: 200,
  message,
  data,
});

const normalizeText = (value?: unknown): string => {
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

const toNumber = (value: unknown, fallback: number): number => {
  const normalized = Number(normalizeText(value));
  if (Number.isNaN(normalized) || normalized <= 0) {
    return fallback;
  }

  return normalized;
};

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => asArray(item));
  }

  if (typeof value === "string") {
    if (!value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => asArray(item));
      }
    } catch (_error) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [value.trim()];
  }

  if (typeof value === "number") {
    return [String(value)];
  }

  return [];
};

const parsePayload = (raw: unknown): Record<string, any> => {
  if (!raw) {
    return {};
  }

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return {};
    }
  }

  if (typeof raw === "object") {
    return raw as Record<string, any>;
  }

  return {};
};

const normalizeLookupKey = (value?: unknown) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

const getMockEmirate = (value?: unknown) => {
  const normalized = normalizeLookupKey(value);
  return mockEmirates.find((item) =>
    [item.id, item.nameEn, item.nameAr, item.code].some((candidate) => normalizeLookupKey(candidate) === normalized),
  );
};

const getMockAuthorityForEmirate = (emirateId?: number, value?: unknown) => {
  const scoped = mockAuthorities.filter((item) => !emirateId || item.emirateId === emirateId);
  if (value) {
    const normalized = normalizeLookupKey(value);
    const exact = scoped.find((item) =>
      [item.id, item.nameEn, item.nameAr, item.code].some((candidate) => normalizeLookupKey(candidate) === normalized),
    );
    if (exact) return exact;
  }
  return scoped[0];
};

const getMockRegionForEmirate = (emirateId?: number, value?: unknown) => {
  const scoped = mockRegions.filter((item) => !emirateId || item.emirateId === emirateId);
  if (value) {
    const normalized = normalizeLookupKey(value);
    const exact = scoped.find((item) =>
      [item.id, item.nameEn, item.nameAr, item.code].some((candidate) => normalizeLookupKey(candidate) === normalized),
    );
    if (exact) return exact;
  }
  return scoped[0];
};

const getMockCommunityForRegion = (regionId?: number, value?: unknown) => {
  const scoped = mockCommunities.filter((item) => !regionId || item.regionId === regionId);
  if (value) {
    const normalized = normalizeLookupKey(value);
    const exact = scoped.find((item) =>
      [item.id, item.nameEn, item.nameAr, item.code].some((candidate) => normalizeLookupKey(candidate) === normalized),
    );
    if (exact) return exact;
  }
  return scoped[0];
};

const getMockSubtype = (value?: unknown) => {
  const normalized = normalizeLookupKey(value);
  return mockEstablishmentSubTypes.find((item) =>
    [item.id, item.nameEn, item.nameAr, item.code].some((candidate) => normalizeLookupKey(candidate) === normalized),
  ) || mockEstablishmentSubTypes[0];
};

const mapTaskToEstablishmentLookupItem = (task: InspectionTaskDetail) => {
  const target = task.inspectionTarget;
  const address = target.address || {} as InspectionAddress;
  const emirate = getMockEmirate(address.emirateId || address.emirateNameEn);
  const emirateId = emirate?.id || address.emirateId || 1;
  const authority = getMockAuthorityForEmirate(emirateId, address.authorityId || address.authorityNameEn);
  const region = getMockRegionForEmirate(emirateId, address.regionId || address.regionNameEn);
  const community = getMockCommunityForRegion(region?.id, address.areaId || address.communityId || address.areaNameEn || address.communityNameEn);
  const subtype = getMockSubtype(target.establishmentSubType || target.targetTypeName);

  return {
    id: target.establishmentId || task.taskId,
    userProfileId: target.userProfileId || target.establishmentId || task.taskId,
    hasRegisteredProfile: target.hasRegisteredProfile ?? true,
    nameEn: target.establishmentNameEn,
    nameAr: target.establishmentNameAr,
    establishmentName: target.establishmentNameEn,
    establishmentSubTypeId: target.establishmentSubTypeId || subtype.id,
    establishmentSubType: target.establishmentSubType || subtype.nameEn,
    emirateId,
    emirateName: emirate?.nameEn || address.emirateNameEn || "Abu Dhabi",
    tradeLicenseNumber: target.licenseNumber,
    licenseNumber: target.licenseNumber,
    emails: target.email || "inspection.target@example.com",
    phoneNumber: target.mobile || "0501234567",
    authorityId: authority?.id,
    authorityName: authority?.nameEn,
    regionId: region?.id,
    regionName: region?.nameEn,
    areaId: community?.id || address.areaId || address.communityId,
    area: community?.nameEn || address.areaNameEn || address.communityNameEn,
    street: address.street,
    mapLocationUrl: address.mapLocationUrl,
    latitude: address.latitude,
    longitude: address.longitude,
    activityId: target.economicActivityId,
    activityName: target.economicActivityName,
    activityNameEn: target.economicActivityName,
    inspection: task.inspectionConfig.isDigitalVisit ? "digital_inspection" : "field_inspection",
    isMock: true,
  };
};

const getMockEstablishmentLookupItems = () => {
  const map = new Map<number, ReturnType<typeof mapTaskToEstablishmentLookupItem>>();
  inspectionTasks
    .filter((task) => task.inspectionTarget.targetType !== 2)
    .forEach((task) => {
      const item = mapTaskToEstablishmentLookupItem(task);
      map.set(item.id, item);
    });
  return Array.from(map.values());
};

const mockIndividualLookupItems = [
  {
    id: 2001,
    userProfileId: 801,
    userId: "person-2001",
    hasRegisteredProfile: true,
    name: "John Noor",
    fullName: "John Noor Al Mansoori",
    emiratesId: "784-1989-1234567-1",
    email: "john@example.com",
    personalEmail: "john.personal@example.com",
    mobileNumber: "0501112233",
    personalMobile: "0501112233",
    socialMediaAccountUsername: "johnmedia",
    mediaLicenseNumber: "ML-9921",
    authorityId: 7,
    isMock: true,
  },
  {
    id: 2002,
    userProfileId: 802,
    userId: "person-2002",
    hasRegisteredProfile: true,
    name: "Nadia Al-Tamimi",
    fullName: "Nadia Al-Tamimi",
    emiratesId: "784-1988-1234567-1",
    email: "nadia.altamimi@example.com",
    personalEmail: "nadia.altamimi@example.com",
    mobileNumber: "0501234567",
    personalMobile: "0501234567",
    socialMediaAccountUsername: "nadia.media",
    mediaLicenseNumber: "ML-6620",
    authorityId: 17,
    isMock: true,
  },
  {
    id: 2003,
    userProfileId: 803,
    userId: "person-2003",
    hasRegisteredProfile: false,
    name: "Mariam Hassan",
    fullName: "Mariam Hassan",
    emiratesId: "784-1994-3322110-3",
    email: "mariam.hassan@example.com",
    personalEmail: "mariam.hassan@example.com",
    mobileNumber: "0552341199",
    personalMobile: "0552341199",
    socialMediaAccountUsername: "mariam.media",
    mediaLicenseNumber: "ML-4421",
    authorityId: 27,
    isMock: true,
  },
];

const matchesLookupKeyword = (item: Record<string, any>, keyword?: unknown, fields: string[] = []) => {
  const normalized = normalizeLookupKey(keyword);
  if (!normalized) return true;
  return fields.some((field) => normalizeLookupKey(item[field]).includes(normalized));
};

const normalizeAttachments = (attachments: unknown): InspectionTaskAttachmentPayload[] => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((item) => {
      const attachment = parsePayload(item);
      return {
        fileName: normalizeText(attachment.fileName),
        fileUrl: normalizeText(attachment.fileUrl),
        contentType: normalizeText(attachment.contentType) || undefined,
        attachmentCategory: normalizeText(attachment.attachmentCategory) || "TaskAttachment",
      };
    })
    .filter((item) => item.fileName && item.fileUrl);
};

const parseQueryFilters = (params: Record<string, any>): Record<string, any> => {
  const filters = { ...parsePayload(params.filters) };

  Object.entries(params).forEach(([key, value]) => {
    const match = key.match(/^filters\[([^\]]+)\](?:\[(\d+)\])?$/);
    if (!match) {
      return;
    }

    const [, filterKey, index] = match;
    if (index === undefined) {
      filters[filterKey] = value;
      return;
    }

    const nextValue = Array.isArray(filters[filterKey])
      ? [...filters[filterKey]]
      : filters[filterKey] === undefined
        ? []
        : [filters[filterKey]];
    nextValue[Number(index)] = value;
    filters[filterKey] = nextValue.filter((item) => item !== undefined);
  });

  return filters;
};

const normalizeTaskStatusForMock = (status?: string) => {
  if (status === "PENDING_ASSIGNMENT") return "QUEUED";
  if (status === "ASSIGNED") return "PENDING_VISIT";
  if (status === "SUBMITTED") return "COMPLETED";
  return status || "PENDING_VISIT";
};

const buildTaskSummary = (tasks: InspectionTaskDetail[] = inspectionTasks) => {
  return {
    draftCount: tasks.filter((item) => item.status === "DRAFT").length,
    pendingAssignmentCount: tasks.filter((item) => normalizeTaskStatusForMock(item.status) === "QUEUED").length,
    queuedCount: tasks.filter((item) => normalizeTaskStatusForMock(item.status) === "QUEUED").length,
    assignedCount: tasks.filter((item) => normalizeTaskStatusForMock(item.status) === "PENDING_VISIT").length,
    pendingVisitCount: tasks.filter((item) => normalizeTaskStatusForMock(item.status) === "PENDING_VISIT").length,
    inProgressCount: tasks.filter((item) => item.status === "IN_PROGRESS").length,
    accessFailedCount: tasks.filter((item) => item.status === "ACCESS_FAILED").length,
    submittedCount: tasks.filter((item) => item.status === "SUBMITTED").length,
    completedCount: tasks.filter((item) => normalizeTaskStatusForMock(item.status) === "COMPLETED").length,
    cancelledCount: tasks.filter((item) => item.status === "CANCELLED").length,
  };
};

const buildViolationSummary = (items: InspectionViolationItem[]) => {
  return items.reduce<Record<string, number>>((summary, item) => {
    const status = String(item.status || "OPEN").toUpperCase();
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
};

const getViolationReasonText = (item: InspectionViolationItem) => (
  normalizeText(
    item.violationDescription ||
    item.violationCode,
  )
);

const buildViolationFilterOptions = (items: InspectionViolationItem[]) => {
  return {
    reportedBy: Array.from(
      new Set(
        items
          .map((item) => normalizeText(item.reportedBy || item.assignedInspector))
          .filter(Boolean),
      ),
    ).sort(),
    violationReason: Array.from(
      new Set(
        items
          .map((item) => getViolationReasonText(item))
          .filter(Boolean),
      ),
    ).sort(),
  };
};

const getViolationTypeAliases = (value?: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  if (
    normalized === "licensing" ||
    normalized === "license violation"
  ) {
    return ["licensing", "license violation"];
  }

  if (normalized === "content" || normalized === "content violation") {
    return ["content", "content violation"];
  }

  return [normalized];
};

const matchesViolationTypeFilter = (
  item: InspectionViolationItem,
  filterValues: Set<string>,
) => {
  if (!filterValues.size) return true;
  const itemAliases = getViolationTypeAliases(item.violationType || item.categoryName);
  return itemAliases.some((alias) => filterValues.has(alias));
};

const getViolationIssuedTimestamp = (item: InspectionViolationItem) => {
  const value = normalizeText(item.issuedTime || item.createdAt || item.updatedAt || item.inspectionDate);
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeMockCode = (value?: unknown) =>
  normalizeText(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase();

const adminViolationStatusIdMap: Record<string, InspectionViolationStatus> = {
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

const adminTodoViolationStatuses = new Set([
  "PENDING_ROUTING",
  "PENDING_REVIEW",
  "PENDING_CONTENT_REPORT",
  "REPORT_SUBMITTED",
  "PENDING_COMMITTEE_DECISION",
  "UNDER_APPEAL",
]);

const adminContentTodoViolationStatuses = new Set([
  "PENDING_CONTENT_REPORT",
]);

const adminContentCompletedViolationStatuses = new Set([
  "WARNING_ISSUED",
  "PENDING_REVIEW",
  "PENDING_COMMITTEE_DECISION",
  "PENDING_APPROVAL",
  "PENDING_PAYMENT",
  "UNDER_APPEAL",
  "PAID",
  "CANCELLED",
]);

const adminCommitteeTodoViolationStatuses = new Set([
  "PENDING_COMMITTEE_DECISION",
]);

const adminCommitteeCompletedViolationStatuses = new Set([
  "WARNING_ISSUED",
  "PENDING_APPROVAL",
  "PENDING_PAYMENT",
  "UNDER_APPEAL",
  "PAID",
  "CANCELLED",
]);

const adminCompletedViolationStatuses = new Set([
  "PENDING_APPROVAL",
  "PENDING_PAYMENT",
  "WARNING_ISSUED",
  "RECTIFICATION",
  "UNDER_APPEAL",
  "PAID",
  "RESOLVED",
  "CANCELLED",
]);

const getAdminRoleSet = (role?: unknown) => new Set(
  asArray(role).map((item) => normalizeText(item).toLowerCase()).filter(Boolean),
);

const mergeStatusSets = (sets: Array<Set<string>>) => new Set(
  sets.flatMap((set) => Array.from(set)),
);

const getAdminViolationStatusId = (status?: unknown) => {
  const normalizedStatus = normalizeMockCode(status);
  const matched = Object.entries(adminViolationStatusIdMap).find(([, value]) => value === normalizedStatus);
  return matched ? Number(matched[0]) : undefined;
};

const hasAdminCommitteeDecision = (item: InspectionViolationItem) => {
  const decision = item.committeeDecision;
  if (decision && typeof decision === "object" && Object.keys(decision).length) return true;
  return Boolean(
    normalizeText(item.committeeDecisionTypeId) ||
    normalizeText(item.committeeDecisionTypeCode) ||
    normalizeText(item.committeeDecisionTypeName) ||
    normalizeText(item.committeeDecisionNote)
  );
};

const getAdminViolationScopeStatuses = (scope?: unknown, role?: unknown) => {
  const normalized = normalizeText(scope).toLowerCase();
  const roleSet = getAdminRoleSet(role);
  if (normalized === "todo") {
    const roleStatusSets = [
      roleSet.has("content") ? adminContentTodoViolationStatuses : null,
      roleSet.has("committee") ? adminCommitteeTodoViolationStatuses : null,
    ].filter((set): set is Set<string> => Boolean(set));
    if (roleStatusSets.length) return mergeStatusSets(roleStatusSets);
    return adminTodoViolationStatuses;
  }
  if (normalized === "completed") {
    const roleStatusSets = [
      roleSet.has("content") ? adminContentCompletedViolationStatuses : null,
      roleSet.has("committee") ? adminCommitteeCompletedViolationStatuses : null,
    ].filter((set): set is Set<string> => Boolean(set));
    if (roleStatusSets.length) return mergeStatusSets(roleStatusSets);
    return adminCompletedViolationStatuses;
  }
  return null;
};

const getAdminViolationStatusFilter = (value?: unknown) => {
  const text = normalizeText(value);
  if (!text) return "";
  return adminViolationStatusIdMap[text] || normalizeMockCode(text);
};

const getAdminViolationTypeFilterValues = (value?: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return [];
  if (normalized === "1") return getViolationTypeAliases("licensing");
  if (normalized === "2") return getViolationTypeAliases("content");
  return getViolationTypeAliases(normalized);
};

const getAdminViolationSortValue = (
  item: InspectionViolationItem,
  sortBy?: unknown,
) => {
  switch (normalizeMockCode(sortBy)) {
    case "VIOLATION_NO":
      return normalizeText(item.violationNo);
    case "STATUS_ID":
      return normalizeText(item.status);
    case "SLA_DEADLINE_AT":
      return normalizeText(item.slaDeadlineAt || item.slaLabel);
    case "CREATED_ON":
      return normalizeText(item.createdOn || item.createdAt || item.issuedTime || item.inspectionDate);
    case "LAST_UPDATED_ON":
    default:
      return normalizeText(item.lastUpdatedOn || item.updatedAt || item.createdOn || item.createdAt || item.inspectionDate);
  }
};

const mapAdminViolationListItem = (item: InspectionViolationItem) => {
  const typeAliases = getViolationTypeAliases(item.violationType || item.categoryName);
  const isContentViolation = typeAliases.includes("content") || typeAliases.includes("content violation");
  const typeCode = isContentViolation ? "Content" : "Licensing";

  return {
    id: item.id,
    violationId: item.violationId || item.id,
    violationNo: item.violationNo,
    violationCode: item.violationCode,
    violationTypeId: isContentViolation ? 2 : 1,
    violationTypeCode: typeCode,
    violationTypeName: item.violationType || item.categoryName,
    statusId: getAdminViolationStatusId(item.status),
    statusCode: item.status,
    statusName: item.status,
    violatorName: item.establishmentNameEn,
    violatorIdentifier: item.violatorIdentifier,
    sourceTaskNo: item.taskNo,
    taskNo: item.taskNo,
    taskId: item.taskId,
    reportedByName: item.reportedBy || item.assignedInspector,
    fineAmount: item.fineAmount,
    beforeAppealAdjustedFineAmount: item.beforeAppealAdjustedFineAmount,
    assignedContentId: item.assignedContentId,
    createdOn: item.createdOn || item.createdAt || item.issuedTime || item.inspectionDate,
    lastUpdatedOn: item.lastUpdatedOn || item.updatedAt || item.createdOn || item.createdAt || item.inspectionDate,
    sla: item.sla,
    slaDeadlineAt: item.slaDeadlineAt,
    slaLabel: item.slaLabel,
    availableActions: item.availableActions,
    isMock: item.isMock ?? true,
  };
};

const filterAdminViolationItems = (query: Record<string, unknown> = {}) => {
  const keyword = normalizeText(query.search || query.keyword).toLowerCase();
  const roleSet = getAdminRoleSet(query.role);
  const scope = normalizeText(query.scope).toLowerCase();
  const statusFilter = getAdminViolationStatusFilter(query.statusId || query.statusCode || query.status);
  const typeSet = new Set(getAdminViolationTypeFilterValues(query.violationTypeId || query.violationTypeCode || query.violationType));
  const scopeStatuses = getAdminViolationScopeStatuses(query.scope, query.role);
  const needsCommitteeDecision = roleSet.has("committee") && scope === "completed";
  const createdOnFrom = Date.parse(normalizeText(query.createdOnFrom));
  const createdOnTo = Date.parse(normalizeText(query.createdOnTo));
  const hasCreatedOnFrom = Number.isFinite(createdOnFrom);
  const hasCreatedOnTo = Number.isFinite(createdOnTo);
  const sortMultiplier = normalizeText(query.sortDirection).toLowerCase() === "asc" ? 1 : -1;

  return violationMockData
    .filter((item) => {
      const normalizedStatus = normalizeMockCode(item.status);

      if (keyword) {
        const searchable = [
          item.id,
          item.violationId,
          item.violationNo,
          item.violationCode,
          item.violationDescription,
          item.violationType,
          item.categoryName,
          item.status,
          item.establishmentNameEn,
          item.taskNo,
          item.sourceTask,
          item.reportedBy,
          item.assignedInspector,
        ].join(" ").toLowerCase();

        if (!searchable.includes(keyword)) {
          return false;
        }
      }

      if (statusFilter && normalizedStatus !== statusFilter) {
        return false;
      }

      if (scopeStatuses && !scopeStatuses.has(normalizedStatus)) {
        return false;
      }

      if (
        needsCommitteeDecision &&
        adminCommitteeCompletedViolationStatuses.has(normalizedStatus) &&
        !hasAdminCommitteeDecision(item)
      ) {
        return false;
      }

      if (!matchesViolationTypeFilter(item, typeSet)) {
        return false;
      }

      if (hasCreatedOnFrom || hasCreatedOnTo) {
        const issuedTime = getViolationIssuedTimestamp(item);
        if (issuedTime === null) {
          return false;
        }
        if (hasCreatedOnFrom && issuedTime < createdOnFrom) {
          return false;
        }
        if (hasCreatedOnTo && issuedTime > createdOnTo) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => {
      const leftValue = getAdminViolationSortValue(left, query.sortBy);
      const rightValue = getAdminViolationSortValue(right, query.sortBy);
      return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" }) * sortMultiplier;
    });
};

const addTimelineMinutes = (value: string | undefined, minutes: number) => {
  const parsed = Date.parse(normalizeText(value));
  if (Number.isNaN(parsed)) {
    return new Date(Date.now() + minutes * 60000).toISOString();
  }

  return new Date(parsed + minutes * 60000).toISOString();
};

const getTimelineDurationLabel = (startAt?: string, endAt?: string) => {
  const start = Date.parse(normalizeText(startAt));
  const end = Date.parse(normalizeText(endAt));
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "";
  }

  const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
  if (diffMinutes >= 1440) {
    return `${Math.round(diffMinutes / 1440)}d`;
  }
  if (diffMinutes >= 60) {
    return `${Math.round(diffMinutes / 60)}h`;
  }
  return `${diffMinutes}m`;
};

const getTaskSourceOperatorName = (task: InspectionTaskDetail) => {
  if (task.taskSource.sourceTypeCode === "AUTO") {
    return "Automated System";
  }

  return task.taskSource.sourceTypeNameEn || "System";
};

const getAssignedInspectorsLabel = (task: InspectionTaskDetail) => {
  const inspectorsValue = task.assignment.assignedInspectors;
  if (Array.isArray(inspectorsValue)) {
    const names = inspectorsValue
      .map((item) => normalizeText(item.inspectorName || item.inspectorId))
      .filter(Boolean);
    return names.length ? names.join(" and ") : "";
  }

  return normalizeText(inspectorsValue || task.assignment.assignedInspector);
};

const getTaskTimelineStartAt = (task: InspectionTaskDetail) => (
  normalizeText(task.reportPreview?.reportSummary?.checkInAt) ||
  (normalizeText(task.assignment.assignedAt) ? addTimelineMinutes(task.assignment.assignedAt, 30) : "") ||
  normalizeText(task.createdAt)
);

const getTaskTimelineEndAt = (task: InspectionTaskDetail) => (
  normalizeText(task.reportPreview?.reportSummary?.checkOutAt) ||
  normalizeText(task.reportPreview?.reportSummary?.submittedAt) ||
  normalizeText(task.reportPreview?.generatedAt) ||
  normalizeText(task.updatedAt)
);

const getTaskTimelineResult = (task: InspectionTaskDetail) => {
  const summary = task.reportPreview?.reportSummary || {};
  const normalizedResult = normalizeText(summary.result || task.status).toUpperCase();
  const accessResult = normalizeText(summary.accessResult).toUpperCase();
  if (task.status === "ACCESS_FAILED" || normalizedResult === "ACCESS_FAILED" || accessResult === "UNABLE_TO_ACCESS") {
    return {
      result: "Access Failed",
      resultTone: "danger" as InspectionTaskTimelineTone,
    };
  }

  if (task.status === "CANCELLED") {
    return {
      result: "Cancelled",
      resultTone: "neutral" as InspectionTaskTimelineTone,
    };
  }

  if (normalizeTaskStatusForMock(task.status) !== "COMPLETED") {
    return null;
  }

  const createdViolations = Array.isArray(summary.createdViolations) ? summary.createdViolations : [];
  const checklistHasViolation = Boolean(
    task.reportPreview?.checklistCategories?.some((category) =>
      category.checkItems.some((item) => item.result === "FAIL" || String(item.result).toUpperCase() === "VIOLATION"),
    ),
  );
  if (createdViolations.length || checklistHasViolation) {
    return {
      result: "Violation Found",
      resultTone: "danger" as InspectionTaskTimelineTone,
    };
  }

  return {
    result: "Compliant",
    resultTone: "success" as InspectionTaskTimelineTone,
  };
};

const syncTaskTimeline = (task: InspectionTaskDetail) => {
  const items: InspectionTaskTimelineItem[] = [];
  const taskKey = task.taskId || task.taskNo;
  const queuedAt = addTimelineMinutes(task.createdAt, 1);
  const assignedLabel = getAssignedInspectorsLabel(task);
  const finalResult = getTaskTimelineResult(task);
  const inspectionStartAt = getTaskTimelineStartAt(task);
  const inspectionEndAt = getTaskTimelineEndAt(task);

  items.push({
    id: `${taskKey}-created`,
    eventType: "TaskCreated",
    titleEn: "Task Created",
    titleAr: "تم إنشاء المهمة",
    descriptionEn: task.description || "Inspection task created.",
    descriptionAr: "تم إنشاء مهمة التفتيش.",
    operatorRoleId: 1,
    operatorName: getTaskSourceOperatorName(task),
    createdOn: task.createdAt,
    metadata: {
      sourceType: task.taskSource.sourceTypeCode,
      taskStatus: task.status,
    },
  });

  items.push({
    id: `${taskKey}-queued`,
    eventType: "TaskQueued",
    titleEn: "Task Queued",
    titleAr: "تمت إضافة المهمة إلى قائمة الانتظار",
    descriptionEn: "Task entered assignment queue.",
    descriptionAr: "دخلت المهمة قائمة انتظار التعيين.",
    operatorRoleId: 1,
    operatorName: getTaskSourceOperatorName(task),
    createdOn: queuedAt,
    metadata: {
      taskStatus: task.status,
    },
  });

  if (task.assignment.isAssigned && task.assignment.assignedAt) {
    items.push({
      id: `${taskKey}-assigned`,
      eventType: "TaskAssigned",
      titleEn: "Task Assigned",
      titleAr: "تم تعيين المهمة",
      descriptionEn: assignedLabel ? `Assigned to ${assignedLabel}` : "Assigned to inspector.",
      descriptionAr: "تم تعيين المهمة إلى المفتش.",
      operatorRoleId: 2,
      operatorName: "Sam",
      createdOn: task.assignment.assignedAt,
      metadata: {
        assignedInspectorsLabel: assignedLabel,
        assignmentReason: task.assignment.assignmentReasonEn,
      },
    });
  }

  if (
    task.updatedAt &&
    !["QUEUED", "PENDING_ASSIGNMENT", "ACCESS_FAILED", "COMPLETED", "CANCELLED"].includes(task.status)
  ) {
    items.push({
      id: `${taskKey}-edited`,
      eventType: "TaskEdited",
      titleEn: "Task Edited",
      titleAr: "تم تعديل المهمة",
      descriptionEn: "Task details were updated.",
      descriptionAr: "تم تحديث تفاصيل المهمة.",
      operatorRoleId: 2,
      operatorName: "Sam",
      createdOn: addTimelineMinutes(task.updatedAt, -20),
      metadata: {
        taskStatus: task.status,
      },
    });
  }

  if (["IN_PROGRESS", "ACCESS_FAILED", "COMPLETED", "SUBMITTED"].includes(task.status) && inspectionStartAt) {
    items.push({
      id: `${taskKey}-started`,
      eventType: "InspectionStarted",
      titleEn: "Inspection Started",
      titleAr: "بدأ التفتيش",
      descriptionEn: "Inspector started the inspection.",
      descriptionAr: "بدأ المفتش عملية التفتيش.",
      operatorRoleId: 3,
      operatorName: assignedLabel || "Inspector",
      createdOn: inspectionStartAt,
      metadata: {
        inspectionMethod: task.inspectionConfig.inspectionTypeNameEn,
      },
    });
  }

  if (task.status === "ACCESS_FAILED" && inspectionEndAt) {
    items.push({
      id: `${taskKey}-access-failed`,
      eventType: "InspectionAccessFailed",
      titleEn: "Inspection Access Failed",
      titleAr: "تعذر الوصول أثناء التفتيش",
      descriptionEn: normalizeText(task.reportPreview?.reportSummary?.accessReason) || "Access outcome was recorded.",
      descriptionAr: "تم تسجيل نتيجة الوصول.",
      operatorRoleId: 3,
      operatorName: assignedLabel || "Inspector",
      createdOn: inspectionEndAt,
      durationLabel: getTimelineDurationLabel(inspectionStartAt, inspectionEndAt),
      metadata: {
        accessResult: "Access Failed",
      },
      result: "Access Failed",
      resultTone: "danger",
    });
  }

  if (normalizeTaskStatusForMock(task.status) === "COMPLETED" && inspectionEndAt) {
    items.push({
      id: `${taskKey}-completed`,
      eventType: "InspectionCompleted",
      titleEn: "Inspection Completed",
      titleAr: "اكتمل التفتيش",
      descriptionEn: task.reportPreview?.reportSummary?.overallComment || "Inspection was completed and submitted.",
      descriptionAr: "تم إكمال التفتيش وإرساله.",
      operatorRoleId: 3,
      operatorName: assignedLabel || "Inspector",
      createdOn: inspectionEndAt,
      durationLabel: getTimelineDurationLabel(inspectionStartAt, inspectionEndAt),
      metadata: {
        inspectionResult: finalResult?.result,
      },
      result: finalResult?.result,
      resultTone: finalResult?.resultTone,
    });
  }

  if (task.status === "CANCELLED" && task.updatedAt) {
    items.push({
      id: `${taskKey}-cancelled`,
      eventType: "TaskCancelled",
      titleEn: "Task Cancelled",
      titleAr: "تم إلغاء المهمة",
      descriptionEn: "Task was cancelled.",
      descriptionAr: "تم إلغاء المهمة.",
      operatorRoleId: 2,
      operatorName: "Sam",
      createdOn: task.updatedAt,
      metadata: {
        taskStatus: task.status,
      },
      result: finalResult?.result,
      resultTone: finalResult?.resultTone,
    });
  }

  task.timeline = items.sort((currentItem, nextItem) => {
    const currentTime = Date.parse(currentItem.createdOn);
    const nextTime = Date.parse(nextItem.createdOn);
    return (Number.isNaN(nextTime) ? 0 : nextTime) - (Number.isNaN(currentTime) ? 0 : currentTime);
  });
};

inspectionTasks.forEach(syncTaskTimeline);

const applyTaskFilters = (
  tasks: InspectionTaskDetail[],
  params: Record<string, any>,
) => {
  const toTimestamp = (value?: string) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const keyword = normalizeText(params.keyword).toLowerCase();
  const role = normalizeText(params.role).toLowerCase();
  const currentInspectorId =
    normalizeText(params.currentInspectorId || params.inspectorId) ||
    normalizeText(parsePayload(params.filters).currentInspectorId) ||
    "inspector-001";
  const view = normalizeText(params.view).toLowerCase();
  const tab = normalizeText(params.tab).toLowerCase();
  const filters = parseQueryFilters(params);
  const riskLevels = new Set(asArray(filters.riskLevels));
  const statuses = new Set(asArray(filters.statuses));
  const inspectionReasonIds = new Set(asArray(filters.inspectionReasonId || params.inspectionReasonId).map((item) => normalizeText(item)));
  const inspectionReasonNames = new Set(asArray(filters.inspectionReasonNames));
  const emirates = new Set(asArray(filters.emirates));
  const authorityNames = new Set(asArray(filters.authorityNames));
  const inspectionMethods = new Set(asArray(filters.inspectionMethods));
  const sourceTypes = new Set(asArray(filters.createdByTypes || filters.taskSourceTypes));
  const priorityIds = new Set(asArray(filters.priorityIds));
  const inspectorIds = new Set(asArray(filters.inspectorIds));
  const establishmentIds = new Set(asArray(filters.establishmentIds));
  const assignedOnly = filters.assignedOnly === true || normalizeText(filters.assignedOnly) === "true";
  const createdFrom = toTimestamp(filters.dateFrom);
  const createdTo = toTimestamp(filters.dateTo);
  const dueDateFrom = toTimestamp(filters.dueDateFrom);
  const dueDateTo = toTimestamp(filters.dueDateTo);

  return tasks.filter((task) => {
    if (keyword) {
      const searchable = [
        task.taskNo,
        task.taskName,
        task.inspectionTarget.establishmentNameEn,
        task.inspectionTarget.licenseNumber,
        task.inspectionTarget.economicActivityName,
        task.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(keyword)) {
        return false;
      }
    }

    if (statuses.size && !statuses.has(task.status) && !statuses.has(normalizeTaskStatusForMock(task.status))) {
      return false;
    }

    if (inspectionReasonNames.size && !inspectionReasonNames.has(task.inspectionConfig.inspectionReasonNameEn || "")) {
      return false;
    }

    if (inspectionReasonIds.size && !inspectionReasonIds.has(normalizeText(task.inspectionConfig.inspectionReasonId))) {
      return false;
    }

    if (
      riskLevels.size &&
      !riskLevels.has(task.riskProfile.riskLevel)
    ) {
      return false;
    }

    const emirateId = normalizeText(task.inspectionTarget.address?.emirateId);
    if (emirates.size && !emirates.has(emirateId)) {
      return false;
    }

    const authorityName = `${normalizeText(task.inspectionTarget.address?.emirateNameEn)} Authority`;
    if (authorityNames.size && !authorityNames.has(authorityName)) {
      return false;
    }

    const inspectionMethod = normalizeText(task.inspectionConfig.inspectionTypeNameEn);
    const normalizedInspectionMethod = task.inspectionConfig.isDigitalVisit
      ? "Digital Inspection"
      : "Field Inspection";
    if (
      inspectionMethods.size &&
      !inspectionMethods.has(inspectionMethod) &&
      !inspectionMethods.has(normalizedInspectionMethod)
    ) {
      return false;
    }

    if (
      sourceTypes.size &&
      !sourceTypes.has(task.taskSource.sourceTypeCode)
    ) {
      return false;
    }

    const priorityId = normalizeText(task.inspectionConfig.priorityId);
    if (priorityIds.size && !priorityIds.has(priorityId)) {
      return false;
    }

    const establishmentId = normalizeText(task.inspectionTarget.establishmentId);
    if (establishmentIds.size && !establishmentIds.has(establishmentId)) {
      return false;
    }

    const taskInspectorIds = Array.isArray(task.assignment.assignedInspectors)
      ? task.assignment.assignedInspectors.map((item) => item.inspectorId)
      : asArray(task.assignment.assignedInspectors);
    if (inspectorIds.size && !taskInspectorIds.some((id) => inspectorIds.has(id))) {
      return false;
    }

    const createdAt = toTimestamp(task.createdAt);
    if (createdFrom !== null && (createdAt === null || createdAt < createdFrom)) {
      return false;
    }

    if (createdTo !== null && (createdAt === null || createdAt > createdTo)) {
      return false;
    }

    const dueDate = toTimestamp(task.inspectionConfig.dueDate);
    if (dueDateFrom !== null && (dueDate === null || dueDate < dueDateFrom)) {
      return false;
    }

    if (dueDateTo !== null && (dueDate === null || dueDate > dueDateTo)) {
      return false;
    }

    if (assignedOnly && !task.assignment.isAssigned) {
      return false;
    }

    if (
      role === "inspector" &&
      (!task.assignment.isAssigned || !taskInspectorIds.includes(currentInspectorId))
    ) {
      return false;
    }

    if (role === "customer") {
      const normalizedStatus = normalizeTaskStatusForMock(task.status);
      if (!["COMPLETED", "ACCESS_FAILED"].includes(normalizedStatus)) {
        return false;
      }
    }

    if (role === "content") {
      const normalizedStatus = normalizeTaskStatusForMock(task.status);
      if (!["IN_PROGRESS", "COMPLETED", "ACCESS_FAILED"].includes(normalizedStatus)) {
        return false;
      }
    }

    if (role === "committee") {
      const normalizedStatus = normalizeTaskStatusForMock(task.status);
      if (!["COMPLETED", "ACCESS_FAILED"].includes(normalizedStatus)) {
        return false;
      }
    }

    if (view === "mine" && !taskInspectorIds.includes(currentInspectorId)) {
      return false;
    }

    if (tab) {
      const allowedByTab =
        tab === "all" ||
        task.tabs?.map((item) => item.toLowerCase()).includes(tab) ||
        task.status.toLowerCase() === tab ||
        normalizeTaskStatusForMock(task.status).toLowerCase() === tab ||
        (tab === "todo" && ["PENDING_VISIT", "IN_PROGRESS"].includes(normalizeTaskStatusForMock(task.status))) ||
        (tab === "completed" && ["COMPLETED", "ACCESS_FAILED", "CANCELLED"].includes(normalizeTaskStatusForMock(task.status))) ||
        (tab === "queued" && normalizeTaskStatusForMock(task.status) === "QUEUED") ||
        (tab === "teamtasks" && normalizeTaskStatusForMock(task.status) !== "QUEUED")
      if (!allowedByTab) {
        return false;
      }
    }

    return true;
  });
};

const paginate = <T>(items: T[], pageIndex: number, pageSize: number) => {
  const total = items.length;
  const safePageSize = Math.max(pageSize, 1);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
  const start = (safePageIndex - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: items.slice(start, end),
    total,
    pageIndex: safePageIndex,
    pageSize: safePageSize,
  };
};

const resolveTask = (params: Record<string, any>) => {
  const taskId = normalizeText(params.taskId);
  const taskNo = normalizeText(params.taskNo);
  return (
    inspectionTasks.find((item) => String(item.taskId) === taskId) ||
    inspectionTasks.find((item) => item.taskNo === taskNo) ||
    null
  );
};

const getViolationByParam = (query: Record<string, any>) => {
  const id = normalizeText(query.id);
  const violationId = normalizeText(query.violationId);
  const violationNo = normalizeText(query.violationNo);
  const target = id || violationId || violationNo;

  if (!target) {
    return null;
  }

  return (
    violationMockData.find((item) => item.id === target) ||
    violationMockData.find((item) => item.violationId === target) ||
    violationMockData.find((item) => item.violationNo === target) ||
    null
  );
};

const cloneTask = (task: InspectionTaskDetail): InspectionTaskDetail => ({
  ...task,
  taskSource: { ...task.taskSource },
  inspectionTarget: {
    ...task.inspectionTarget,
    address: task.inspectionTarget.address
      ? { ...task.inspectionTarget.address }
      : undefined,
  },
  riskProfile: {
    ...task.riskProfile,
    riskDimensions: task.riskProfile.riskDimensions?.map((item) => ({ ...item })),
    riskFactors: task.riskProfile.riskFactors?.map((item) => ({ ...item })),
    primaryRiskFactors: task.riskProfile.primaryRiskFactors?.map((item) => ({
      ...item,
    })),
  },
  inspectionConfig: { ...task.inspectionConfig },
  assignment: {
    ...task.assignment,
    assignedInspectors: Array.isArray(task.assignment.assignedInspectors)
      ? task.assignment.assignedInspectors.map((item) => ({ ...item }))
      : task.assignment.assignedInspectors,
  },
  smartChecklistSnapshot: task.smartChecklistSnapshot
    ? JSON.parse(JSON.stringify(task.smartChecklistSnapshot))
    : undefined,
  reportPreview: task.reportPreview
    ? JSON.parse(JSON.stringify(task.reportPreview))
    : undefined,
  targetOverview: task.targetOverview
    ? JSON.parse(JSON.stringify(task.targetOverview))
    : undefined,
  inspectionReport: task.inspectionReport
    ? JSON.parse(JSON.stringify(task.inspectionReport))
    : undefined,
  executionResult: task.executionResult
    ? JSON.parse(JSON.stringify(task.executionResult))
    : undefined,
  executionDraft: task.executionDraft
    ? JSON.parse(JSON.stringify(task.executionDraft))
    : undefined,
  contactPersons: task.contactPersons
    ? JSON.parse(JSON.stringify(task.contactPersons))
    : undefined,
  checklistTemplate: task.checklistTemplate
    ? JSON.parse(JSON.stringify(task.checklistTemplate))
    : undefined,
  executionState: task.executionState
    ? JSON.parse(JSON.stringify(task.executionState))
    : undefined,
  lastSuccessfulInspection: task.lastSuccessfulInspection
    ? JSON.parse(JSON.stringify(task.lastSuccessfulInspection))
    : undefined,
  lastCompletedInspection: task.lastCompletedInspection
    ? JSON.parse(JSON.stringify(task.lastCompletedInspection))
    : undefined,
  previousSuccessfulInspection: task.previousSuccessfulInspection
    ? JSON.parse(JSON.stringify(task.previousSuccessfulInspection))
    : undefined,
  previousInspection: task.previousInspection
    ? JSON.parse(JSON.stringify(task.previousInspection))
    : undefined,
  inspectionHistory: task.inspectionHistory
    ? JSON.parse(JSON.stringify(task.inspectionHistory))
    : undefined,
  reinspectionTask: task.reinspectionTask
    ? JSON.parse(JSON.stringify(task.reinspectionTask))
    : undefined,
  linkedReinspectionTask: task.linkedReinspectionTask
    ? JSON.parse(JSON.stringify(task.linkedReinspectionTask))
    : undefined,
  relatedReinspectionTask: task.relatedReinspectionTask
    ? JSON.parse(JSON.stringify(task.relatedReinspectionTask))
    : undefined,
  attachments: task.attachments?.map((item) => ({ ...item })),
  timeline: task.timeline
    ? JSON.parse(JSON.stringify(task.timeline))
    : undefined,
  violations: task.violations?.map((item) => ({ ...item })),
});

const getChecklistViolations = (
  checklistCategories: SmartChecklistCategory[],
  selectedViolations: any[] = [],
) => {
  const violationMap = new Map<string, any>();

  selectedViolations.forEach((violation) => {
    const key = normalizeText(violation.violationCode || violation.violationId || violation.key || violation.violationName);
    if (key) {
      violationMap.set(key, violation);
    }
  });

  checklistCategories.forEach((category) => {
    category.checkItems.forEach((item) => {
      const normalizedResult = String(item.result || "").toUpperCase();
      if (!["FAIL", "VIOLATION"].includes(normalizedResult)) return;
      (item.relatedViolations || []).forEach((violation) => {
        const key = normalizeText(violation.violationCode || violation.violationId || violation.violationName);
        if (key) {
          violationMap.set(key, {
            ...violation,
            checklistItemId: item.itemId,
            checklistItemName: item.descriptionEn,
            violationDescription: normalizeText((violation as any).violationDescription || (item as any).violationDescription),
            evidenceAttachments: (item as any).evidenceAttachments || [],
            remarks: (item as any).remarks || item.comment,
          });
        }
      });
    });
  });

  return Array.from(violationMap.values());
};

const createViolationRecordsFromReport = (
  task: InspectionTaskDetail,
  checklistCategories: SmartChecklistCategory[],
  reportSummary: Record<string, any>,
  submittedAt: string,
) => {
  const detectedViolations = getChecklistViolations(
    checklistCategories,
    Array.isArray(reportSummary.selectedViolations) ? reportSummary.selectedViolations : [],
  );

  return detectedViolations.map((violation, index) => {
    const sequence = violationMockData.length + index + 1;
    const violationNo = `VN-2026-${String(3457000 + sequence).padStart(7, "0")}`;
    const violationCode = normalizeText(violation.violationCode) || `V-AUTO-${sequence}`;
    const violationDescription = normalizeText(
      violation.violationDescription,
    ) || "Inspection Violation";
    const violationName = violationDescription;
    const violationId = `V-AUTO-${Date.now()}-${index}`;
    const record: InspectionViolationItem = {
      id: violationId,
      violationId,
      violationNo,
      violationCode,
      title: violationName,
      violationName,
      violationDescription,
      violationType: violationName.includes("Content") ? "Content Violation" : "License Violation",
      reason: normalizeText(violation.remarks) || normalizeText(reportSummary.overallComment) || "Created from inspection execution",
      level: normalizeText(violation.severity) || "Medium",
      severity: normalizeText(violation.severity) || "MEDIUM",
      status: "PENDING_REVIEW",
      description: violationDescription,
      location: task.inspectionTarget.address?.emirateNameEn || "Abu Dhabi",
      inspectionDate: submittedAt.slice(0, 10),
      taskId: task.taskId,
      taskNo: task.taskNo,
      establishmentId: task.inspectionTarget.establishmentId || 0,
      establishmentNameEn: task.inspectionTarget.establishmentNameEn,
      categoryName: normalizeText(violation.categoryName) || "Inspection Checklist",
      penaltyBasis: violation.penaltyBasis,
      assignedInspector: Array.isArray(task.assignment.assignedInspectors)
        ? task.assignment.assignedInspectors[0]?.inspectorName
        : task.assignment.assignedInspector,
      taskSource: task.taskSource,
      inspectionTarget: task.inspectionTarget,
      riskProfile: task.riskProfile,
      inspectionConfig: task.inspectionConfig,
      assignment: task.assignment,
      reportedBy: "Inspection Team",
      workflowOwner: "Inspection Supervisor",
      fineAmount: 0,
      createdAt: submittedAt,
      issuedTime: submittedAt,
      updatedAt: submittedAt,
      evidences: Array.isArray(violation.evidenceAttachments) && violation.evidenceAttachments.length
        ? violation.evidenceAttachments.map((file: any) => ({
          title: normalizeText(file.name || file.fileName || file.url) || "Evidence",
          description: normalizeText(violation.remarks) || "Uploaded during inspection execution",
        }))
        : [{ title: "Checklist evidence", description: normalizeText(violation.remarks) || "Created from inspection checklist result." }],
      timeline: [
        {
          action: "CREATED",
          operator: "Inspection Team",
          actionAt: submittedAt,
          remark: "Created from inspection report submission",
        },
      ],
    };
    return record;
  });
};

const createReinspectionTask = (
  sourceTask: InspectionTaskDetail,
  reportSummary: Record<string, any>,
  submittedAt: string,
) => {
  const nextTaskId =
    inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + 1;
  const dueDate = normalizeText(reportSummary.reinspectionDate) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const task: InspectionTaskDetail = {
    ...cloneTask(sourceTask),
    taskId: nextTaskId,
    taskNo: `REI-2026-${String(nextTaskId).padStart(6, "0")}`,
    taskName: `Reinspection - ${sourceTask.inspectionTarget.establishmentNameEn}`,
    status: "PENDING_ASSIGNMENT",
    taskSource: taskSources.FOLLOW_UP,
    inspectionConfig: {
      ...sourceTask.inspectionConfig,
      inspectionReasonNameEn: "Reinspection",
      dueDate,
    },
    assignment: {
      isAssigned: false,
      assignedInspectors: [],
      assignmentReasonEn: "Created from inspection report follow-up",
    },
    createdAt: submittedAt,
    updatedAt: submittedAt,
    description: "Mock reinspection task created from inspection report submission.",
    tabs: ["all", "queued", "unassigned"],
    reportPreview: undefined,
  };

  syncTaskTimeline(task);
  enrichInspectionTaskV4(task);
  inspectionTasks.unshift(task);
  return {
    taskId: task.taskId,
    taskNo: task.taskNo,
    dueDate,
  };
};

const mockNow = "2026-05-01T12:00:00+04:00";

const getTaskPathId = (params: Record<string, any>) => (
  normalizeText(params.id || params.taskId || params.taskNo)
);

const resolveTaskFromPath = (
  params: Record<string, any>,
  body?: Record<string, any>,
) => {
  const id = getTaskPathId(params);
  return (
    inspectionTasks.find((item) => String(item.taskId) === id) ||
    inspectionTasks.find((item) => item.taskNo === id) ||
    resolveTask(body || {}) ||
    null
  );
};

const getMockError = (statusCode: number, message: string) => ({
  code: statusCode,
  message,
  data: null,
});

const getChecklistSeedByCode = (code: string) => (
  checklistSeeds.find((seed) => seed.code === code)
);

const getSavedResultIdFromSmartResult = (value?: string) => {
  const normalized = normalizeText(value).toUpperCase();
  if (["FAIL", "VIOLATION"].includes(normalized)) return 2;
  if (["NA", "N/A", "NOTAPPLICABLE", "NOT_APPLICABLE"].includes(normalized)) return 3;
  if (["PASS", "COMPLIANT"].includes(normalized)) return 1;
  return null;
};

const getSmartResultFromSavedResult = (value: unknown): "PASS" | "FAIL" | "NA" => {
  const resultId = Number(value);
  if (resultId === 2) return "FAIL";
  if (resultId === 3) return "NA";
  return "PASS";
};

const getTaskChecklistItems = (task: InspectionTaskDetail) => (
  task.smartChecklistSnapshot?.checklistCategories.flatMap((category) => category.checkItems) || []
);

const getTaskChecklistItemByCode = (
  task: InspectionTaskDetail,
  code: string,
) => getTaskChecklistItems(task).find((item) => item.checklistCode === code);

const buildChecklistTemplate = (task: InspectionTaskDetail) => {
  const methodId = task.inspectionConfig.isDigitalVisit ? 2 : 1;
  const targetTypeId = task.inspectionTarget.targetType || 1;

  return {
    taskId: task.taskId,
    contentType: task.inspectionTarget.economicActivityName || "Media Activity",
    targetTypeId,
    inspectionMethodId: methodId,
    templateType: "AllChecklistItems",
    templateSource: "Inspection checklist database (full list)",
    items: checklistSeeds.map((seed) => {
      const smartItem = getTaskChecklistItemByCode(task, seed.code);
      const selectedViolations = smartItem?.selectedViolations || [];
      const savedResult = getSavedResultIdFromSmartResult(smartItem?.result);
      const violationItemId = 7000 + seed.displayOrder;

      return {
        id: seed.displayOrder,
        checklistCode: seed.code,
        violationDescription: seed.violationDescription,
        checklistName: seed.checklistName,
        violationItemId,
        violationItemCode: seed.code,
        violationTypeId: seed.type === "Licensing" ? 1 : 2,
        violationTypeCode: seed.type === "Licensing" ? "Licensing" : "Content",
        displayOrder: seed.displayOrder,
        isVisibleInChecklist: seed.isVisibleInChecklist !== false,
        isActive: true,
        requiredWhenViolation: true,
        isSystemTriggered: Boolean(seed.isSystemTriggered),
        applicableTemplateTypes: seed.applicableTemplateTypes || checklistTemplateTypes,
        mappedViolationCodes: [seed.code],
        mappedViolationItems: [
          {
            id: violationItemId,
            code: seed.code,
            violationTypeId: seed.type === "Licensing" ? 1 : 2,
            violationTypeCode: seed.type === "Licensing" ? "LicensingViolation" : "ContentViolation",
            nameEn: seed.violationDescription,
            nameAr: "",
            fineDay1To30: seed.severity === "CRITICAL" ? 500 : seed.severity === "HIGH" ? 300 : 100,
            fineDay31To90: seed.severity === "CRITICAL" ? 1000 : seed.severity === "HIGH" ? 600 : 200,
            fineMax: seed.severity === "CRITICAL" ? 5000 : seed.severity === "HIGH" ? 3000 : 1000,
            isActive: true,
            displayOrder: seed.displayOrder,
          },
        ],
        resultOptions: checklistResultOptions,
        savedResult,
        savedNotes: smartItem?.remarks || smartItem?.comment || null,
        savedSelectedViolationItemIds: selectedViolations.length ? selectedViolations.map((item: any) => item.violationItemId || violationItemId) : savedResult === 2 ? [violationItemId] : [],
      };
    }),
  };
};

const saveChecklistTemplateItems = (
  task: InspectionTaskDetail,
  items: Array<Record<string, any>>,
) => {
  if (!task.smartChecklistSnapshot) {
    task.smartChecklistSnapshot = createChecklist(
      task.inspectionTarget.establishmentId || 0,
      task.riskProfile,
    );
  }

  items.forEach((inputItem) => {
    const code = normalizeText(inputItem.checklistCode || inputItem.violationItemCode);
    const smartItem = getTaskChecklistItemByCode(task, code);
    const seed = getChecklistSeedByCode(code);
    if (!smartItem || !seed) return;

    const result = getSmartResultFromSavedResult(inputItem.resultId || inputItem.savedResult);
    const selectedViolations = asArray(inputItem.selectedViolationItemIds).length
      ? asArray(inputItem.selectedViolationItemIds).map((id) => ({
        violationItemId: toNumber(id, 7000 + seed.displayOrder),
        violationItemCode: code,
        violationTypeId: seed.type === "Licensing" ? 1 : 2,
      }))
      : Array.isArray(inputItem.selectedViolations)
        ? inputItem.selectedViolations
        : result === "FAIL"
          ? [
            {
              violationItemId: 7000 + seed.displayOrder,
              violationItemCode: code,
              violationTypeId: seed.type === "Licensing" ? 1 : 2,
            },
          ]
          : [];

    smartItem.result = result;
    smartItem.comment = normalizeText(inputItem.notes || inputItem.savedNotes);
    smartItem.remarks = smartItem.comment;
    smartItem.evidenceAttachments = Array.isArray(inputItem.attachments)
      ? normalizeAttachments(inputItem.attachments)
      : smartItem.evidenceAttachments || [];
    smartItem.selectedViolations = selectedViolations;
  });

  task.checklistTemplate = buildChecklistTemplate(task);
};

const getDeclarationStatusForTicket = (
  task: InspectionTaskDetail,
  index: number,
): string => {
  if (!task.inspectionConfig.isDigitalVisit) {
    const status = normalizeText(task.reportPreview?.reportSummary?.contactPerson?.declarationStatus);
    if (status === "not_signed") return "Declined";
    if (status === "signed") return "Signed";
    return "NotInitiated";
  }
  if (task.taskId === 10004) return "PendingSignature";
  if (task.taskId === 10013) return index === 0 ? "Signed" : "Declined";
  if (task.taskId === 10022) return "ExpiredReadOnly";
  if (task.taskId === 10028) return "PendingSignature";
  return "NotInitiated";
};

const getDeclarationStatusName = (statusCode: string) => {
  const names: Record<string, string> = {
    NotInitiated: "Not Initiated",
    PendingSignature: "Pending Signature",
    Signed: "Signed",
    Declined: "Declined",
    ExpiredReadOnly: "Expired Read Only",
  };
  return names[statusCode] || statusCode;
};

const createDeclarationRecord = (
  task: InspectionTaskDetail,
  ticket: Record<string, any>,
  statusCode: string,
  index: number,
) => {
  if (statusCode === "NotInitiated") return null;

  const token = `decl-${task.taskId}-${statusCode.toLowerCase()}-${index + 1}`;
  const existing = declarationStore.get(token);
  if (existing) return existing;

  const submittedOn = ["Signed", "Declined"].includes(statusCode)
    ? "2026-05-01T10:30:00+04:00"
    : null;
  const contactPerson = statusCode === "PendingSignature"
    ? null
    : {
      fullName: ticket.contactPersonName || "Nadia Al-Tamimi",
      position: "Account Owner",
      mobile: `${DEFAULT_COUNTRY_DIAL_CODE}501234567`,
      email: "nadia.altamimi@example.com",
      emiratesId: "784-1989-1234567-1",
      collectedChannelCode: "Email",
      submittedOn: submittedOn || "2026-05-01T09:45:00+04:00",
      eidAttachmentFileName: `eid-${task.taskId}-${index + 1}.pdf`,
      eidAttachmentFileUrl: `/api/admin/inspection/mock-files/eid/eid-${task.taskId}-${index + 1}.pdf`,
    };
  const record = {
    token,
    violationId: ticket.violationId || ticket.id,
    violationNo: ticket.violationNo,
    taskId: task.taskId,
    violatorName: task.inspectionTarget.establishmentNameEn,
    recipientAddress: ticket.declarationRecipientAddress || "nadia.altamimi@example.com",
    linkSentOn: "2026-05-01T09:30:00+04:00",
    linkExpiresOn: statusCode === "ExpiredReadOnly" ? "2026-04-28T09:30:00+04:00" : "2026-05-04T09:30:00+04:00",
    declarationSubmittedOn: submittedOn,
    isExpired: statusCode === "ExpiredReadOnly",
    declarationAcknowledged: statusCode === "Signed",
    hasSignedDeclaration: statusCode === "Signed" ? true : statusCode === "Declined" ? false : null,
    declarationDeclinedReason: statusCode === "Declined" ? "Representative declined to sign the declaration." : null,
    contactPerson,
    signatureImageFileName: statusCode === "Signed" ? `signature-${task.taskId}-${index + 1}.png` : null,
    signatureImageFileUrl: statusCode === "Signed" ? `/api/admin/inspection/mock-files/signatures/signature-${task.taskId}-${index + 1}.png` : null,
    declarationDocumentFileName: ["Signed", "Declined"].includes(statusCode) ? `declaration-${task.taskNo}-${index + 1}.pdf` : null,
    declarationDocumentFileUrl: ["Signed", "Declined"].includes(statusCode) ? mockDeclarationDocumentUrl : null,
  };

  declarationStore.set(token, record);
  return record;
};

const buildContactPersons = (task: InspectionTaskDetail) => {
  if (task.taskId === 10019) {
    return [];
  }

  const summaryContact = task.reportPreview?.reportSummary?.contactPerson || {};
  const isDigital = Boolean(task.inspectionConfig.isDigitalVisit);
  const statusCode = isDigital
    ? task.taskId === 10004
      ? "PendingSignature"
      : task.taskId === 10022
        ? "ExpiredReadOnly"
        : task.taskId === 10013
          ? "Signed"
          : "NotInitiated"
    : summaryContact.declarationStatus === "not_signed"
      ? "Declined"
      : summaryContact.declarationStatus === "signed"
        ? "Signed"
        : "NotInitiated";

  return [
    {
      id: task.taskId + 11,
      fullName: summaryContact.name || summaryContact.fullName || (isDigital ? "Nadia Al-Tamimi" : "Maha Ibrahim"),
      position: summaryContact.designation || summaryContact.position || "Compliance Officer",
      mobile: summaryContact.mobilePhone || summaryContact.mobile || `${DEFAULT_COUNTRY_DIAL_CODE}500000000`,
      email: summaryContact.emailAddress || summaryContact.email || "contact@example.com",
      emiratesId: summaryContact.emiratesId || "784-1989-1234567-1",
      declarationAcknowledged: statusCode === "Signed",
      hasSignedDeclaration: statusCode === "Signed" ? true : statusCode === "Declined" ? false : null,
      declarationStatusCode: statusCode,
      declarationStatusName: getDeclarationStatusName(statusCode),
      declarationDocumentFileName: ["Signed", "Declined"].includes(statusCode) ? `declaration-${task.taskNo}.pdf` : null,
      declarationDocumentFileUrl: ["Signed", "Declined"].includes(statusCode) ? mockDeclarationDocumentUrl : null,
      signatureImageFileName: statusCode === "Signed" ? `signature-${task.taskNo}.png` : null,
      signatureImageFileUrl: statusCode === "Signed" ? `/api/admin/inspection/mock-files/signatures/signature-${task.taskNo}.png` : null,
      declarationSubmittedOn: ["Signed", "Declined"].includes(statusCode) ? task.reportPreview?.generatedAt || task.updatedAt : null,
      declarationDeclinedReason: statusCode === "Declined" ? summaryContact.refusalReason || "Representative declined to sign the declaration." : null,
      collectedChannelCode: isDigital ? "Email" : "OnSite",
      eidAttachmentFileName: `eid-${task.taskNo}.pdf`,
      eidAttachmentFileUrl: `/api/admin/inspection/mock-files/eid/eid-${task.taskNo}.pdf`,
      isMock: true,
    },
  ];
};

const buildTargetOverview = (task: InspectionTaskDetail) => {
  const target = task.inspectionTarget;
  const address = (target.address || {}) as Partial<InspectionAddress>;
  const targetName = target.establishmentNameEn;

  return {
    targetSummary: {
      targetId: target.establishmentId,
      targetName,
      targetTypeId: target.targetType,
      targetTypeCode: target.targetType === 2 ? "Individual" : "Establishment",
      targetTypeName: target.targetTypeName,
      emirateName: address.emirateNameEn,
      authorityName: address.emirateNameEn ? `${address.emirateNameEn} Authority` : "NMA",
    },
    licenseSummary: {
      licenseNo: target.licenseNumber,
      status: task.taskId % 5 === 0 ? "Expired" : "Active",
      expiryDate: "2026-11-03T00:00:00+04:00",
      activityName: target.economicActivityName,
      isMock: true,
    },
    inspectionHistory: [
      {
        taskNo: `HIS-${task.taskId}`,
        inspectorName: "Ava Khan",
        completedAt: "2026-03-20T11:30:00+04:00",
        outcome: task.riskProfile.riskLevel === "LOW" ? "No Violation" : "Violation Found",
      },
    ],
    violationHistory: violationMockData
      .filter((item) => item.taskId === task.taskId)
      .slice(0, 3)
      .map((item) => ({
        violationNo: item.violationNo,
        violationCode: item.violationCode,
        statusCode: item.status,
        statusName: item.status,
        createdOn: item.createdAt || item.inspectionDate,
      })),
    applicationHistory: [
      {
        title: "Mock application history",
        referenceNo: `APP-${task.taskId}`,
        statusCode: "Approved",
        statusName: "Approved",
        createdOn: "2026-04-21T10:00:00+04:00",
        isMock: true,
      },
    ],
    ticketHistory: [
      {
        title: "Mock ticket history",
        referenceNo: `TKT-${task.taskId}`,
        statusCode: "Closed",
        statusName: "Closed",
        createdOn: "2026-04-24T10:00:00+04:00",
        isMock: true,
      },
    ],
    accountOwner: {
      name: targetName,
      mobile: `${DEFAULT_COUNTRY_DIAL_CODE}500000001`,
      email: "mock.owner@example.com",
      isMock: true,
    },
    digitalAccounts: [
      {
        platform: task.inspectionConfig.isDigitalVisit ? "Instagram" : "Website",
        accountName: task.inspectionConfig.isDigitalVisit ? `@inspection_target_${task.taskId}` : `www.target-${task.taskId}.example.test`,
        status: "Active",
        isMock: true,
      },
    ],
    isMock: true,
  };
};

const buildReportAttachments = (
  task: InspectionTaskDetail,
  submittedOn?: string,
) => {
  if (!submittedOn) return [];
  return [
    {
      id: task.taskId,
      relatedEntityType: "TaskExecution",
      relatedEntityId: task.taskId,
      attachmentCategory: "InspectionReport",
      fileName: `inspection-report-${task.taskNo}.pdf`,
      fileUrl: `/api/admin/inspection/mock-files/reports/inspection-report-${task.taskNo}.pdf`,
      uploadedBy: "mock-user",
      uploadedAt: submittedOn,
    },
  ];
};

const buildInspectionReport = (task: InspectionTaskDetail) => {
  const summary = task.reportPreview?.reportSummary || {};
  const submittedOn = summary.submittedAt || task.reportPreview?.generatedAt;
  const accessFailed = task.status === "ACCESS_FAILED" || summary.accessResult === "unable_to_access";
  const checklistEvidence = getTaskChecklistItems(task)
    .flatMap((item) => item.evidenceAttachments || [])
    .map((item: any, index) => ({
      id: index + 1,
      relatedEntityType: "Checklist",
      attachmentCategory: "ChecklistEvidence",
      fileName: item.fileName || item.name || `checklist-evidence-${index + 1}.jpg`,
      fileUrl: item.fileUrl || item.url,
      uploadedAt: submittedOn || task.updatedAt,
    }));
  const declarationDocuments = (task.contactPersons || [])
    .filter((item) => item.declarationDocumentFileName)
    .map((item) => ({
      id: item.id,
      relatedEntityType: "DeclarationAcknowledgement",
      relatedEntityId: item.id,
      attachmentCategory: "DeclarationAcknowledgementDocument",
      fileName: item.declarationDocumentFileName,
      fileUrl: item.declarationDocumentFileUrl,
      uploadedBy: "mock-user",
      uploadedAt: item.declarationSubmittedOn || submittedOn,
    }));

  return {
    reportStatusCode: accessFailed ? "AccessFailed" : submittedOn ? "Completed" : task.status === "IN_PROGRESS" ? "Draft" : "NotStarted",
    reportNo: task.reportPreview?.reportId || (submittedOn ? `RPT-${task.taskNo}` : null),
    submittedOn: submittedOn || null,
    submittedByName: submittedOn ? "mock-user" : null,
    summary: summary.overallComment || task.description || null,
    checklistEvidence,
    accessFailedReport: accessFailed
      ? {
        accessReason: summary.accessReason || "Unable to access target.",
        accessRemark: summary.accessRemark || "",
        accessAttachments: summary.accessAttachments || [],
        countsTowardInspectionInterval: false,
      }
      : null,
    reportAttachments: buildReportAttachments(task, submittedOn),
    pdfFileName: submittedOn ? `inspection-report-${task.taskNo}.pdf` : null,
    pdfFileUrl: submittedOn ? `/api/admin/inspection/mock-files/reports/inspection-report-${task.taskNo}.pdf` : null,
    declarationDocuments,
    isMock: true,
  };
};

const buildExecutionResult = (task: InspectionTaskDetail) => {
  const summary = task.reportPreview?.reportSummary || {};
  const createdViolations = Array.isArray(summary.createdViolations)
    ? summary.createdViolations
    : task.violations || [];
  const seedTickets = task.taskId === 10022 && createdViolations.length === 0
    ? [
      {
        violationId: "V-DIGITAL-10022",
        violationNo: "VN-2026-10022",
        violationCode: "C6",
        violationName: "Inciting violence, hatred, terrorism, or discord",
        violationType: "Content Violation",
        status: "PENDING_ROUTING",
      },
    ]
    : createdViolations;
  const tickets = seedTickets.map((violation: any, index: number) => {
    const statusCode = getDeclarationStatusForTicket(task, index);
    const declaration = createDeclarationRecord(task, violation, statusCode, index);
    return {
      violationId: violation.violationId || violation.id || `${task.taskId}-${index + 1}`,
      violationNo: violation.violationNo || `VN-2026-${task.taskId}-${index + 1}`,
      violationCode: violation.violationCode || violation.code,
      typeCode: String(violation.violationType || "").includes("Content") ? "Content" : "Licensing",
      typeName: violation.violationType || "License Violation",
      statusCode: violation.status || "PENDING_REVIEW",
      statusName: violation.status || "Pending Review",
      fineAmount: violation.fineAmount || (String(violation.violationType || "").includes("Content") ? 0 : 2000),
      declarationStatusCode: statusCode,
      declarationStatusName: getDeclarationStatusName(statusCode),
      declarationRecipientAddress: declaration?.recipientAddress || null,
      declarationLinkSentOn: declaration?.linkSentOn || null,
      declarationLinkExpiresOn: declaration?.linkExpiresOn || null,
      declarationSubmittedOn: declaration?.declarationSubmittedOn || null,
      declarationToken: declaration?.token || null,
      declarationPortalUrl: declaration?.token ? `/api/inspection/declarations/${declaration.token}` : null,
      declarationDocumentFileName: declaration?.declarationDocumentFileName || null,
      declarationDocumentFileUrl: declaration?.declarationDocumentFileUrl || null,
      declarationIsMock: Boolean(declaration),
    };
  });
  const accessFailed = task.status === "ACCESS_FAILED" || summary.accessResult === "unable_to_access";
  const hasViolation = tickets.length > 0;

  return {
    outcomeCode: accessFailed ? "AccessFailed" : hasViolation ? "FineIssued" : "NoViolation",
    outcomeName: accessFailed ? "Access Failed" : hasViolation ? "Fine Issued" : "No Violation",
    violationCount: tickets.length,
    violationTickets: tickets,
    reinspectionTasks: summary.reinspectionTask
      ? [summary.reinspectionTask]
      : hasViolation && tickets.some((ticket: any) => ["L1", "L2", "L4", "L10"].includes(String(ticket.violationCode || "")))
        ? [
          {
            taskId: 0,
            taskNo: `RE-${task.taskNo}`,
            statusCode: "PendingVisit",
            statusName: "Pending Visit",
            dueDate: "2026-05-31T00:00:00+04:00",
            isMock: true,
          },
        ]
        : [],
    checkoutOn: summary.checkOutAt || task.reportPreview?.generatedAt || null,
    countsTowardInspectionInterval: !accessFailed,
    isMock: true,
  };
};

const normalizeMockExecutionStepCode = (value?: unknown) => {
  const normalized = normalizeText(value).replace(/[\s_-]+/g, "").toLowerCase();
  const stepMap: Record<string, string> = {
    previsit: "PreVisitChecklist",
    previsitchecklist: "PreVisitChecklist",
    targetaccess: "TargetAccess",
    access: "TargetAccess",
    checkin: "Checkin",
    check_in: "Checkin",
    checklist: "Checklist",
    seizedmaterials: "SeizedMaterials",
    seizedmaterial: "SeizedMaterials",
    contactperson: "ReviewAndSubmit",
    declarationacknowledgement: "declarationAcknowledgement",
    declarationacknowledgment: "declarationAcknowledgement",
    reinspection: "Reinspection",
    review: "ReviewAndSubmit",
    reviewconfirm: "ReviewAndSubmit",
    reviewandconfirm: "ReviewAndSubmit",
    reviewandsubmit: "ReviewAndSubmit",
    submitreport: "ReviewAndSubmit",
    checkout: "CheckOut",
    checkoutfailed: "CheckOut",
    accessfailed: "AccessFailed",
  };
  return stepMap[normalized] || "";
};

const mockExecutionStepIdMap: Record<string, number> = {
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

const getMockExecutionStepId = (currentStepCode: string) => (
  mockExecutionStepIdMap[currentStepCode] || 20
);

const getDefaultExecutionStepCode = (
  task: InspectionTaskDetail,
  checklistSaved: boolean,
) => {
  const summary = task.reportPreview?.reportSummary || {};
  if (!summary.checkInAt && !summary.accessResult) return "TargetAccess";
  if (!checklistSaved) return "Checkin";
  return "ReviewAndSubmit";
};

const setTaskCurrentStepCode = (
  task: InspectionTaskDetail,
  currentStepCode: string,
) => {
  const normalizedStepCode = normalizeMockExecutionStepCode(currentStepCode) || "TargetAccess";
  task.executionState = {
    ...(task.executionState || {}),
    currentStepCode: normalizedStepCode,
    currentStepId: getMockExecutionStepId(normalizedStepCode),
  };
};

const buildExecutionState = (task: InspectionTaskDetail) => {
  const summary = task.reportPreview?.reportSummary || {};
  const checklistSaved = Boolean(task.smartChecklistSnapshot?.checklistCategories.length);
  const hasReport = Boolean(task.reportPreview?.generatedAt);
  const persistedStepCode = normalizeMockExecutionStepCode(task.executionState?.currentStepCode);
  const preVisitConfirmed = Boolean(task.executionState?.preVisitChecklist);
  const currentStepCode = task.status === "PENDING_VISIT"
    ? preVisitConfirmed
      ? persistedStepCode || "TargetAccess"
      : ""
    : task.status === "IN_PROGRESS"
      ? persistedStepCode || getDefaultExecutionStepCode(task, checklistSaved)
    : task.status === "COMPLETED"
        ? "CheckOut"
        : task.status === "ACCESS_FAILED"
          ? "AccessFailed"
          : persistedStepCode || "CheckOut";
  const currentStepId = currentStepCode ? getMockExecutionStepId(currentStepCode) : 0;
  const persistedPreVisitChecklist = task.executionState?.preVisitChecklist || {};

  return {
    taskId: task.taskId,
    currentStepCode,
    currentStepId,
    steps: [
      { code: "TargetAccess", name: "Target Access", completed: Boolean(summary.accessResult || task.status !== "PENDING_VISIT") },
      { code: "Checklist", name: "Checklist", completed: checklistSaved && task.status !== "PENDING_VISIT" },
      { code: "SeizedMaterials", name: "Seized Materials", completed: Array.isArray(summary.seizedMaterials) && summary.seizedMaterials.length > 0 },
      { code: "ReviewAndSubmit", name: "Review & Submit", completed: hasReport },
    ],
    preVisitChecklist: {
      reviewTaskDetailConfirmed:
        persistedPreVisitChecklist.reviewTaskDetailConfirmed ??
        false,
      reviewInspectionTargetDetailsConfirmed:
        persistedPreVisitChecklist.reviewInspectionTargetDetailsConfirmed ??
        false,
      ensureToolsReadyConfirmed:
        persistedPreVisitChecklist.ensureToolsReadyConfirmed ??
        false,
    },
    targetAccess: {
      accessResult: summary.accessResult || null,
      accessReason: summary.accessReason || null,
      accessRemark: summary.accessRemark || null,
      attachments: summary.accessAttachments || [],
    },
    checklistSaved,
    hasSeizedMaterials: Array.isArray(summary.seizedMaterials) && summary.seizedMaterials.length > 0,
    contactPersonSaved: Boolean((task.contactPersons || []).length),
    reportSubmitted: hasReport,
    checkIn: summary.checkInAt || null,
    checkout: summary.checkOutAt || null,
  };
};

const enrichInspectionTaskV4 = (task: InspectionTaskDetail) => {
  if (!task.smartChecklistSnapshot) {
    task.smartChecklistSnapshot = createChecklist(
      task.inspectionTarget.establishmentId || 0,
      task.riskProfile,
    );
  }

  task.contactPersons = buildContactPersons(task);
  task.checklistTemplate = buildChecklistTemplate(task);
  task.targetOverview = buildTargetOverview(task);
  task.inspectionReport = buildInspectionReport(task);
  task.executionResult = buildExecutionResult(task);
  task.executionState = buildExecutionState(task);
  task.countsTowardInspectionInterval = task.status !== "ACCESS_FAILED";
  task.inspectionHistory = task.targetOverview.inspectionHistory;
  task.lastSuccessfulInspection = task.targetOverview.inspectionHistory[0];
  if (task.reportPreview?.reportId) {
    reportStore.set(task.reportPreview.reportId, task.reportPreview);
  }
};

const syncInspectionTaskAfterMutation = (task: InspectionTaskDetail) => {
  syncTaskTimeline(task);
  enrichInspectionTaskV4(task);
};

const reviewExecutionDraftSeizedMaterials = [
  {
    id: "review-material-1",
    materialType: "Book",
    title: "Licensing Department/Media Activity Compliance Guide",
    isbn: "24233534234",
    author: "Suesan",
    language: "English",
    quantity: "2",
  },
  {
    id: "review-material-2",
    materialType: "Book",
    title: "Media Activity Licensing",
    isbn: "24233534234",
    author: "Suesan",
    language: "English",
    quantity: "2",
  },
  {
    id: "review-material-3",
    materialType: "Other",
    title: "Media Activity Licensing",
    isbn: "",
    author: "",
    language: "",
    quantity: "2",
  },
  {
    id: "review-material-4",
    materialType: "Book",
    title: "Press Card Services",
    isbn: "24233534234",
    author: "Suesan",
    language: "English",
    quantity: "2",
  },
  {
    id: "review-material-5",
    materialType: "Document",
    title: "Unapproved promotional leaflet batch",
    isbn: "",
    author: "Marketing Desk",
    language: "Arabic",
    quantity: "6",
  },
  {
    id: "review-material-6",
    materialType: "Art Publication",
    title: "Imported catalogue without permit label",
    isbn: "9789948001254",
    author: "FBC Archive",
    language: "English",
    quantity: "3",
  },
  {
    id: "review-material-7",
    materialType: "Book",
    title: "Retail sales log supplement",
    isbn: "9789948001285",
    author: "Store Team",
    language: "English",
    quantity: "1",
  },
  {
    id: "review-material-8",
    materialType: "CD",
    title: "Digital media sample pack",
    isbn: "",
    author: "Unknown",
    language: "Arabic",
    quantity: "4",
  },
  {
    id: "review-material-9",
    materialType: "Book",
    title: "Children shelf display sample",
    isbn: "9789948001322",
    author: "Noura Ali",
    language: "English",
    quantity: "2",
  },
  {
    id: "review-material-10",
    materialType: "Other",
    title: "Counter notice copy",
    isbn: "",
    author: "",
    language: "",
    quantity: "1",
  },
];

const applyReviewExecutionDraftMock = () => {
  const task = inspectionTasks.find((item) => item.taskId === 10008);
  if (!task) return;

  const checklistCategories = task.smartChecklistSnapshot?.checklistCategories
    ? JSON.parse(JSON.stringify(task.smartChecklistSnapshot.checklistCategories)) as SmartChecklistCategory[]
    : [];
  let failedItemIndex = 0;

  checklistCategories.forEach((category) => {
    category.checkItems.forEach((item) => {
      if (item.result !== "FAIL") return;

      const checklistCode = normalizeText(item.checklistCode || item.itemId || `review-${failedItemIndex + 1}`).toLowerCase();
      item.remarks = item.remarks || `${item.checklistCode || item.itemId} evidence captured during the review flow.`;
      item.evidenceAttachments = [
        {
          fileName: `review-evidence-${checklistCode}-site-photo.jpg`,
          fileUrl: `/api/admin/inspection/mock-files/evidence/review-evidence-${checklistCode}-site-photo.jpg`,
          contentType: "image/jpeg",
        },
        ...(failedItemIndex === 0
          ? [{
            fileName: `review-evidence-${checklistCode}-license-copy.pdf`,
            fileUrl: `/api/admin/inspection/mock-files/evidence/review-evidence-${checklistCode}-license-copy.pdf`,
            contentType: "application/pdf",
          }]
          : []),
      ];
      failedItemIndex += 1;
    });
  });

  task.executionDraft = {
    checklistCategories,
    hasSeizedMaterials: true,
    seizedMaterials: reviewExecutionDraftSeizedMaterials,
    accessResult: "accessed_successfully",
    accessReason: "",
    accessRemark: "",
    accessAttachments: [],
    checkInAt: "2026-05-04T09:00:00+04:00",
    checkOutAt: "",
    contactPerson: {
      name: "Maha Ibrahim",
      position: "Store Supervisor",
      mobilePhone: `${DEFAULT_COUNTRY_DIAL_CODE} 50 000 0000`,
      emailAddress: "maha@example.ae",
      emiratesId: "784-1988-1234567-1",
      eidAttachment: [
        {
          fileName: "maha-ibrahim-eid.pdf",
          fileUrl: "/api/admin/inspection/mock-files/documents/maha-ibrahim-eid.pdf",
          contentType: "application/pdf",
        },
      ],
      declarationStatus: "signed",
      signatureDataUrl: "",
      signatureLocked: false,
      signatureEditing: false,
      refusalReason: "",
    },
  };
};

const ensureTaskReportPreview = (task: InspectionTaskDetail) => {
  if (!task.reportPreview) {
    task.reportPreview = {
      reportId: `RPT-${task.taskId}`,
      taskId: task.taskId,
      taskNo: task.taskNo,
      generatedAt: task.updatedAt,
      previewUrl: `/mock/inspection/report/RPT-${task.taskId}`,
      reportSummary: {},
      checklistCategories: task.smartChecklistSnapshot?.checklistCategories || [],
    };
  }
  return task.reportPreview;
};

const updateTaskReportSummary = (
  task: InspectionTaskDetail,
  patch: Record<string, any>,
) => {
  const preview = ensureTaskReportPreview(task);
  preview.reportSummary = {
    ...(preview.reportSummary || {}),
    ...patch,
  };
  preview.checklistCategories = task.smartChecklistSnapshot?.checklistCategories || preview.checklistCategories || [];
  if (patch.submittedAt || patch.checkOutAt) {
    preview.generatedAt = patch.submittedAt || patch.checkOutAt;
  }
  task.reportPreview = preview;
  return preview.reportSummary;
};

const buildV4TaskListResponse = (query: Record<string, unknown> = {}) => {
  const pageIndex = toNumber(query.pageIndex, 1);
  const pageSize = toNumber(query.pageSize, 10);
  const filtered = applyTaskFilters(inspectionTasks, query || {});
  const page = paginate(filtered.map((item) => cloneTask(item)), pageIndex, pageSize);
  return {
    ...page,
    summary: buildTaskSummary(filtered),
  };
};

const submitMockInspectionReport = (
  task: InspectionTaskDetail,
  payload: Record<string, any>,
) => {
  const submittedAt = normalizeText(payload.submittedAt || payload.reportSubmittedAt) || mockNow;
  const checklistCategories =
    payload.checklistCategories ||
    taskDrafts.get(task.taskId)?.checklistCategories ||
    task.smartChecklistSnapshot?.checklistCategories ||
    [];
  const existingReportSummary = task.reportPreview?.reportSummary || {};
  const reportSummary = {
    ...existingReportSummary,
    ...(payload.reportSummary || {}),
    ...payload,
    submittedAt,
    result: normalizeText(payload.result || payload.reportSummary?.result) || "COMPLETED",
    reinspectionDate: normalizeText(payload.reinspectionDate || payload.reinspectionDueDate || payload.reportSummary?.reinspectionDate || payload.reportSummary?.reinspectionDueDate) || null,
    reviewNote: normalizeText(payload.reviewNote || payload.reportSummary?.reviewNote) || "",
  };
  delete reportSummary.reportSummary;
  const hasCheckOut = Boolean(normalizeText(reportSummary.checkOutAt || reportSummary.checkoutAt));

  const createdViolations = createViolationRecordsFromReport(
    task,
    checklistCategories,
    reportSummary,
    submittedAt,
  );
  const reinspectionTask = reportSummary.needsReinspection
    ? createReinspectionTask(task, reportSummary, submittedAt)
    : null;
  const reportId = normalizeText(payload.reportId) || `RPT-${task.taskId}-${submittedAt.replace(/\D/g, "").slice(0, 12)}`;
  const preview: InspectionReportPreview = {
    reportId,
    taskId: task.taskId,
    taskNo: task.taskNo,
    generatedAt: submittedAt,
    previewUrl: `/mock/inspection/report/${reportId}`,
    reportSummary: {
      ...reportSummary,
      createdViolations: createdViolations.map((item) => ({
        violationId: item.violationId,
        violationNo: item.violationNo,
        violationCode: item.violationCode,
        violationName: item.violationName,
        violationDescription: item.violationDescription,
        violationType: item.violationType,
        status: item.status,
      })),
      reinspectionTask,
    },
    checklistCategories,
  };

  if (createdViolations.length) {
    violationMockData.unshift(...createdViolations);
  }
  reportStore.set(reportId, preview);
  task.reportPreview = preview;
  task.status = reportSummary.result === "ACCESS_FAILED"
    ? "ACCESS_FAILED"
    : hasCheckOut
      ? "COMPLETED"
      : "IN_PROGRESS";
  task.updatedAt = submittedAt;
  setTaskCurrentStepCode(task, hasCheckOut ? "CheckOut" : "ReviewAndSubmit");
  syncInspectionTaskAfterMutation(task);
  const currentStepCode = hasCheckOut ? "CheckOut" : "ReviewAndSubmit";

  return {
    taskId: task.taskId,
    reportId,
    submittedAt,
    submitted: true,
    status: task.status,
    currentStepId: getMockExecutionStepId(currentStepCode),
    currentStepCode,
    reinspectionTask,
  };
};

inspectionTasks.forEach(enrichInspectionTaskV4);
applyReviewExecutionDraftMock();

const inspectionMocks: MockMethod[] = [
  {
    url: "/api/admin/inspection/lookup/emirates",
    method: "get",
    response: () => ok(mockEmirates),
  },
  {
    url: "/api/admin/inspection/lookup/emirates/:emirateId/authorities",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const emirateId = toNumber(query?.emirateId, 1);
      return ok(mockAuthorities.filter((item) => item.emirateId === emirateId));
    },
  },
  {
    url: "/api/admin/inspection/lookup/emirates/:emirateId/regions",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const emirateId = toNumber(query?.emirateId, 1);
      return ok(mockRegions.filter((item) => item.emirateId === emirateId));
    },
  },
  {
    url: "/api/admin/inspection/lookup/regions/:regionId/communities",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const regionId = toNumber(query?.regionId, 20);
      return ok(mockCommunities.filter((item) => item.regionId === regionId));
    },
  },
  {
    url: "/api/admin/inspection/lookup/establishment-sub-types",
    method: "get",
    response: () => ok(mockEstablishmentSubTypes),
  },
  {
    url: "/api/admin/inspection/lookup/establishments/by-trade-license",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const tradeLicenseNumber = normalizeLookupKey(query?.tradeLicenseNumber);
      const emirateId = toNumber(query?.emirateId, 0);
      const item = getMockEstablishmentLookupItems().find((candidate) => {
        const hasLicense = normalizeLookupKey(candidate.tradeLicenseNumber || candidate.licenseNumber) === tradeLicenseNumber;
        const hasEmirate = !emirateId || candidate.emirateId === emirateId;
        return hasLicense && hasEmirate;
      });
      return ok(item || null);
    },
  },
  {
    url: "/api/admin/inspection/lookup/establishments",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const keyword = query?.keyword;
      const emirateId = toNumber(query?.emirateId, 0);
      const pageIndex = toNumber(query?.pageIndex, 1);
      const pageSize = toNumber(query?.pageSize, 20);
      const filtered = getMockEstablishmentLookupItems().filter((item) => {
        const hasEmirate = !emirateId || item.emirateId === emirateId;
        return hasEmirate && matchesLookupKeyword(item, keyword, [
          "nameEn",
          "establishmentName",
          "tradeLicenseNumber",
          "licenseNumber",
          "emails",
          "authorityName",
          "area",
        ]);
      });
      return ok(paginate(filtered, pageIndex, pageSize).items);
    },
  },
  {
    url: "/api/admin/inspection/lookup/individuals",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const pageIndex = toNumber(query?.pageIndex, 1);
      const pageSize = toNumber(query?.pageSize, 20);
      const filtered = mockIndividualLookupItems.filter((item) =>
        matchesLookupKeyword(item, query?.keyword, [
          "name",
          "fullName",
          "emiratesId",
          "email",
          "personalEmail",
          "mobileNumber",
          "personalMobile",
          "socialMediaAccountUsername",
          "mediaLicenseNumber",
        ]),
      );
      return ok(paginate(filtered, pageIndex, pageSize).items);
    },
  },
  {
    url: "/api/admin/inspection/tasks/validate",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      if (!payload.inspectionMethodId || !payload.inspectionReasonId || !payload.priorityId) {
        return ok({
          warnings: [],
          blockingErrors: [
            {
              code: "RequiredLookupMissing",
              message: "Inspection method, reason and priority are required.",
              isMock: true,
            },
          ],
          recentTasks: [],
        });
      }

      const targetKey = normalizeLookupKey(payload.establishmentId || payload.establishmentName || payload.fullName || payload.tradeLicenseNumber);
      const hasOpenTask = inspectionTasks.some((task) => {
        const sameTarget = [
          task.inspectionTarget.establishmentId,
          task.inspectionTarget.establishmentNameEn,
          task.inspectionTarget.fullName,
          task.inspectionTarget.licenseNumber,
        ].some((value) => normalizeLookupKey(value) === targetKey);
        return sameTarget && ["QUEUED", "PENDING_VISIT", "IN_PROGRESS"].includes(normalizeTaskStatusForMock(task.status));
      });

      if (hasOpenTask) {
        return ok({
          warnings: [],
          blockingErrors: [
            {
              code: "TaskAlreadyOpen",
              message: "There is already an active inspection task for the same target.",
              isMock: true,
            },
          ],
          recentTasks: [],
        });
      }

      const recentTasks = inspectionTasks
        .filter((task) => {
          const sameTarget = [
            task.inspectionTarget.establishmentId,
            task.inspectionTarget.establishmentNameEn,
            task.inspectionTarget.fullName,
            task.inspectionTarget.licenseNumber,
          ].some((value) => normalizeLookupKey(value) === targetKey);
          return sameTarget;
        })
        .slice(0, 2)
        .map((task) => ({
          taskId: task.taskId,
          taskNo: task.taskNo,
          dueDate: task.inspectionConfig.dueDate,
          statusCode: task.status,
          statusName: normalizeTaskStatusForMock(task.status),
        }));

      return ok({
        warnings: recentTasks.length
          ? [
            {
              code: "RecentInspectionExists",
              message: "A similar inspection task exists recently.",
              isMock: true,
            },
          ]
          : [],
        blockingErrors: [],
        recentTasks,
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/generate-and-assign",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const pageSize = Math.min(toNumber(payload.pageSize, 50), 500);
      const campaignConfig = parsePayload(payload.campaignConfig);
      if (campaignConfig && Object.keys(campaignConfig).length > 0) {
        const now = new Date().toISOString();
        const activities = asArray(campaignConfig.activityNames).length
          ? asArray(campaignConfig.activityNames)
          : ["Media Trading"];
        const campaignAttachments = normalizeAttachments(campaignConfig.attachments);
        const generated = activities.map((activityName, index) => {
          const nextTaskId =
            inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + index + 1;
          const matchedInspector = inspectors[index % inspectors.length];
          const dueDate = normalizeText(campaignConfig.dueDate) || new Date(Date.now() + 7 * 86400000).toISOString();
          const created: InspectionTaskDetail = {
            taskId: nextTaskId,
            taskNo: `IN-2026-${String(nextTaskId).padStart(7, "0")}`,
            taskName: "Inspection Campaign",
            status: matchedInspector ? "PENDING_VISIT" : "QUEUED",
            taskSource: {
              sourceTypeId: 3,
              sourceTypeCode: "MANUAL",
              sourceTypeNameEn: "Inspection Campaign",
            },
            inspectionTarget: {
              targetType: 1,
              targetTypeName: "Campaign",
              establishmentId: 8000 + index,
              establishmentNameEn: `${normalizeText(campaignConfig.emirateNameEn) || "UAE"} ${activityName} Campaign`,
              economicActivityName: normalizeText(activityName),
              address: {
                emirateId: toNumber(asArray(parsePayload(payload.filters).emirates)[0], 1),
                emirateNameEn: normalizeText(campaignConfig.emirateNameEn) || "Abu Dhabi",
                street: normalizeText(campaignConfig.authorityNameEn) || "Authority",
              },
            },
            riskProfile: {
              riskScore: 70,
              riskLevel: "HIGH",
              riskLevelName: "Campaign Risk",
              lastAssessmentDate: now,
            },
            inspectionConfig: {
              inspectionTypeId: 1,
              inspectionTypeNameEn: "Field Inspection",
              inspectionReasonNameEn: "Inspection Campaign",
              isDigitalVisit: false,
              priorityId: toNumber(parsePayload(payload.filters).priorityIds?.[0], 2),
              priorityNameEn: normalizeText(campaignConfig.priorityNameEn) || "High",
              dueDate,
              slaMinutes: 4320,
            },
            assignment: matchedInspector
              ? {
                isAssigned: true,
                assignedInspector: matchedInspector.inspectorId,
                assignedInspectors: [matchedInspector],
                assignmentReasonEn: "Auto-assigned from inspection campaign",
                assignedAt: now,
              }
              : {
                isAssigned: false,
                assignedInspectors: [],
              },
            createdAt: now,
            updatedAt: now,
            description: normalizeText(campaignConfig.description),
            tabs: ["all", "teamTasks"],
            attachments: campaignAttachments,
          };

          created.smartChecklistSnapshot = createChecklist(
            created.inspectionTarget.establishmentId || 0,
            created.riskProfile,
          );
          syncInspectionTaskAfterMutation(created);
          return created;
        });

        inspectionTasks.unshift(...generated);

        return ok({
          totalCount: generated.length,
          generatedCount: generated.length,
          assignedCount: generated.filter((item) => item.assignment.isAssigned).length,
          assignmentSummary: {
            assignedInspectorCount: new Set(
              generated.flatMap((task) =>
                Array.isArray(task.assignment.assignedInspectors)
                  ? task.assignment.assignedInspectors.map((item) => item.inspectorId)
                  : asArray(task.assignment.assignedInspectors),
              ),
            ).size,
            unassignedCount: generated.filter((item) => !item.assignment.isAssigned).length,
          },
          taskList: generated.map((item) => cloneTask(item)),
        });
      }

      const filtered = applyTaskFilters(inspectionTasks, payload);
      const preferredInspectorIds = asArray(payload.assignmentRules?.preferredInspectorIds);
      const generated = filtered.slice(0, pageSize).map((task, index) => {
        if (!task.assignment.isAssigned && preferredInspectorIds.length) {
          const preferredId =
            preferredInspectorIds[index % preferredInspectorIds.length];
          const matchedInspector = inspectors.find(
            (item) => item.inspectorId === preferredId,
          );
          if (matchedInspector) {
            task.assignment = {
              isAssigned: true,
              assignedInspector: matchedInspector.inspectorId,
              assignedInspectors: [matchedInspector],
              assignmentReasonEn:
                "Assigned from preferred inspector rule during generation",
              assignedAt: new Date().toISOString(),
            };
            task.status = "PENDING_VISIT";
            task.updatedAt = new Date().toISOString();
            syncInspectionTaskAfterMutation(task);
          }
        }

        syncInspectionTaskAfterMutation(task);
        return cloneTask(task);
      });

      return ok({
        totalCount: filtered.length,
        generatedCount: generated.length,
        assignedCount: generated.filter((item) => item.assignment.isAssigned).length,
        assignmentSummary: {
          assignedInspectorCount: new Set(
            generated.flatMap((task) =>
              Array.isArray(task.assignment.assignedInspectors)
                ? task.assignment.assignedInspectors.map((item) => item.inspectorId)
                : asArray(task.assignment.assignedInspectors),
            ),
          ).size,
          unassignedCount: generated.filter((item) => !item.assignment.isAssigned)
            .length,
        },
        taskList: generated,
      });
    },
  },
  {
    url: "/api/inspection/tasks/list",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const pageIndex = toNumber(query?.pageIndex, 1);
      const pageSize = toNumber(query?.pageSize, 10);
      const filtered = applyTaskFilters(inspectionTasks, query || {}).sort((nextTask, currentTask) => {
        const currentTime = Date.parse(currentTask.assignment.assignedAt || currentTask.createdAt || currentTask.updatedAt || "");
        const nextTime = Date.parse(nextTask.assignment.assignedAt || nextTask.createdAt || nextTask.updatedAt || "");
        return (Number.isNaN(currentTime) ? 0 : currentTime) - (Number.isNaN(nextTime) ? 0 : nextTime);
      });
      const page = paginate(filtered.map((item) => cloneTask(item)), pageIndex, pageSize);
      const summaryParams = {
        ...(query || {}),
        tab: "all",
      };
      const summarySource = applyTaskFilters(inspectionTasks, summaryParams);

      return ok({
        ...page,
        summary: buildTaskSummary(summarySource),
      });
    },
  },
  {
    url: "/api/inspection/tasks/detail",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTask(query || {});
      return ok(task ? cloneTask(task) : null);
    },
  },
  {
    url: "/api/admin/inspection/tasks",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      return ok(buildV4TaskListResponse(query || {}));
    },
  },
  {
    url: "/api/admin/inspection/declaration-template",
    method: "get",
    response: () => ok({
      templateFileName: "declaration-and-acknowledgement-template.pdf",
      templateFileUrl: mockDeclarationDocumentUrl,
      declarationDocumentFileName: "declaration-and-acknowledgement-template.pdf",
      declarationDocumentFileUrl: mockDeclarationDocumentUrl,
      fileName: "declaration-and-acknowledgement-template.pdf",
      fileUrl: mockDeclarationDocumentUrl,
    }),
  },
  {
    url: "/api/admin/inspection/tasks/:id/checklist-template",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      return task ? ok(task.checklistTemplate || buildChecklistTemplate(task)) : getMockError(404, "Task not found");
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/checklist-items",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      if (!task) return getMockError(404, "Task not found");
      const template = task.checklistTemplate || buildChecklistTemplate(task);
      return ok((template.items || []).filter((item: any) => item.isVisibleInChecklist !== false && item.isActive !== false));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/target-overview",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      return task ? ok(task.targetOverview || buildTargetOverview(task)) : getMockError(404, "Task not found");
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/report",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      return task ? ok(task.inspectionReport || buildInspectionReport(task)) : getMockError(404, "Task not found");
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/execution-result",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      return task ? ok(task.executionResult || buildExecutionResult(task)) : getMockError(404, "Task not found");
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTaskFromPath((query || {}) as Record<string, any>);
      return task ? ok(cloneTask(task)) : getMockError(404, "Task not found");
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/start-visit",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");

      const confirmations = [
        payload.reviewTaskDetailConfirmed,
        payload.reviewInspectionTargetDetailsConfirmed,
        payload.ensureToolsReadyConfirmed,
      ].filter((value) => value !== undefined);
      if (confirmations.some((value) => value === false)) {
        return getMockError(400, "Inspection.Execution.PreVisitChecklistRequired");
      }

      task.updatedAt = mockNow;
      task.executionState = {
        ...(task.executionState || {}),
        currentStepCode: "PreVisitChecklist",
        currentStepId: getMockExecutionStepId("PreVisitChecklist"),
        preVisitChecklist: {
          reviewTaskDetailConfirmed: true,
          reviewInspectionTargetDetailsConfirmed: true,
          ensureToolsReadyConfirmed: true,
        },
      };
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        currentStepId: getMockExecutionStepId("PreVisitChecklist"),
        currentStepCode: "PreVisitChecklist",
        taskStatusId: 1,
        taskStatusCode: "PendingVisit",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/checkin",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const checkInAt = normalizeText(payload.checkInAt) || mockNow;
      updateTaskReportSummary(task, {
        accessResult: "accessed_successfully",
        checkInAt,
        checkInLat: task.inspectionConfig.isDigitalVisit ? null : payload.checkInLat ?? 24.4539,
        checkInLng: task.inspectionConfig.isDigitalVisit ? null : payload.checkInLng ?? 54.3773,
        checkInAddress: task.inspectionConfig.isDigitalVisit ? null : payload.checkInAddress || task.inspectionTarget.address?.street,
      });
      task.status = "IN_PROGRESS";
      task.updatedAt = checkInAt;
      setTaskCurrentStepCode(task, "Checkin");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        checkInAt,
        currentStepId: getMockExecutionStepId("Checkin"),
        currentStepCode: "Checkin",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/access-failed",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const accessReason = normalizeText(payload.accessFailedReasonCode || payload.accessReason || payload.reasonCode);
      if (!accessReason) {
        return getMockError(400, "Inspection.Execution.AccessFailedReasonRequired");
      }
      const submittedAt = normalizeText(payload.submittedAt || payload.checkOutAt) || mockNow;
      updateTaskReportSummary(task, {
        result: "ACCESS_FAILED",
        accessResult: "unable_to_access",
        accessReason,
        accessRemark: payload.accessFailedRemark || payload.accessRemark || payload.remark || "",
        accessAttachments: normalizeAttachments(payload.attachments || payload.accessAttachments),
        submittedAt,
        checkOutAt: submittedAt,
      });
      task.status = "ACCESS_FAILED";
      task.updatedAt = submittedAt;
      setTaskCurrentStepCode(task, "AccessFailed");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        submitted: true,
        statusCode: "AccessFailed",
        currentStepId: getMockExecutionStepId("AccessFailed"),
        currentStepCode: "AccessFailed",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/checklist",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const items = Array.isArray(payload.items) ? payload.items : [];
      saveChecklistTemplateItems(task, items);
      task.status = "IN_PROGRESS";
      task.draftUpdatedAt = mockNow;
      task.updatedAt = mockNow;
      setTaskCurrentStepCode(task, "Checklist");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        currentStepId: getMockExecutionStepId("Checklist"),
        currentStepCode: "Checklist",
        taskStatusId: 2,
        savedCount: items.length,
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/seized-materials",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      if (task.inspectionConfig.isDigitalVisit) {
        return getMockError(400, "Inspection.Execution.DigitalStepNotSupported");
      }
      const materials = Array.isArray(payload.materials)
        ? payload.materials
        : Array.isArray(payload.items)
          ? payload.items
        : Array.isArray(payload.seizedMaterials)
          ? payload.seizedMaterials
          : [];
      updateTaskReportSummary(task, {
        seizedMaterials: materials,
        hasSeizedMaterials: materials.length > 0,
      });
      task.status = "IN_PROGRESS";
      task.updatedAt = mockNow;
      setTaskCurrentStepCode(task, "SeizedMaterials");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        savedCount: materials.length,
        currentStepId: getMockExecutionStepId("SeizedMaterials"),
        currentStepCode: "SeizedMaterials",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/contact-person",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const fullName = normalizeText(payload.fullName || payload.name);
      if (!fullName) return getMockError(400, "Inspection.Execution.ContactPersonRequired");
      const contactPerson = {
        id: payload.id || task.taskId + 11,
        fullName,
        position: payload.position || payload.designation || "Compliance Officer",
        mobile: payload.mobile || payload.mobilePhone || `${DEFAULT_COUNTRY_DIAL_CODE}500000000`,
        email: payload.email || payload.emailAddress || "contact@example.com",
        emiratesId: payload.emiratesId || "784-1989-1234567-1",
        declarationAcknowledged: Boolean(payload.declarationAcknowledged || payload.hasSignedDeclaration),
        hasSignedDeclaration: payload.hasSignedDeclaration ?? null,
        declarationStatusCode: payload.hasSignedDeclaration === true ? "Signed" : payload.hasSignedDeclaration === false ? "Declined" : "PendingSignature",
        declarationStatusName: payload.hasSignedDeclaration === true ? "Signed" : payload.hasSignedDeclaration === false ? "Declined" : "Pending Signature",
        declarationDeclinedReason: payload.declarationDeclinedReason || payload.refusalReason || null,
        collectedChannelCode: payload.collectedChannelCode || (task.inspectionConfig.isDigitalVisit ? "Email" : "OnSite"),
        submittedOn: payload.submittedOn || mockNow,
        eidAttachmentFileName: payload.eidAttachmentFileName || `eid-${task.taskNo}.pdf`,
        eidAttachmentFileUrl: payload.eidAttachmentFileUrl || `/api/admin/inspection/mock-files/eid/eid-${task.taskNo}.pdf`,
        signatureImageFileName: payload.signatureImageFileName || null,
        signatureImageFileUrl: payload.signatureImageFileUrl || null,
        declarationDocumentFileName: payload.declarationDocumentFileName || null,
        declarationDocumentFileUrl: payload.declarationDocumentFileUrl || null,
        isMock: true,
      };
      task.contactPersons = [contactPerson];
      updateTaskReportSummary(task, {
        contactPerson: {
          name: contactPerson.fullName,
          designation: contactPerson.position,
          mobilePhone: contactPerson.mobile,
          emailAddress: contactPerson.email,
          declarationStatus: contactPerson.hasSignedDeclaration === false ? "not_signed" : contactPerson.hasSignedDeclaration === true ? "signed" : "pending",
        },
      });
      task.updatedAt = mockNow;
      setTaskCurrentStepCode(task, "ReviewAndSubmit");
      syncInspectionTaskAfterMutation(task);
      return ok({
        ...contactPerson,
        currentStepId: getMockExecutionStepId("ReviewAndSubmit"),
        currentStepCode: "ReviewAndSubmit",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/contact-person/declaration",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const existingContact = task.contactPersons?.[0] as any;
      if (!existingContact) return getMockError(400, "Inspection.Execution.ContactPersonRequired");

      const hasSignedDeclaration = payload.hasSignedDeclaration ?? payload.declarationAcknowledged ?? true;
      const declarationStatusCode = hasSignedDeclaration === false ? "Declined" : "Signed";
      const declarationStatusName = hasSignedDeclaration === false ? "Declined" : "Signed";
      const updatedContact: any = {
        ...existingContact,
        declarationAcknowledged: hasSignedDeclaration !== false,
        hasSignedDeclaration,
        declarationStatusCode,
        declarationStatusName,
        declarationDeclinedReason: payload.declarationDeclinedReason || payload.refusalReason || existingContact.declarationDeclinedReason || null,
        signatureImageFileName: payload.signatureImageFileName || existingContact.signatureImageFileName || null,
        signatureImageFileUrl: payload.signatureImageFileUrl || existingContact.signatureImageFileUrl || null,
        signatureSignedOn: payload.signatureSignedOn || mockNow,
      };
      task.contactPersons = [updatedContact];
      updateTaskReportSummary(task, {
        contactPerson: {
          name: updatedContact.fullName,
          designation: updatedContact.position,
          mobilePhone: updatedContact.mobile,
          emailAddress: updatedContact.email,
          declarationStatus: hasSignedDeclaration === false ? "not_signed" : "signed",
        },
      });
      task.updatedAt = mockNow;
      setTaskCurrentStepCode(task, "ReviewAndSubmit");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        currentStepId: getMockExecutionStepId("ReviewAndSubmit"),
        currentStepCode: "ReviewAndSubmit",
        contactPerson: updatedContact,
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/reinspection",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const dueDate = normalizeText(payload.reinspectionDueDate || payload.reinspectionDate) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const reinspectionTask = {
        taskId: task.taskId * 100 + 9,
        parentTaskId: task.taskId,
        taskNo: `REI-${task.taskNo}`,
        dueDate,
        note: payload.reinspectionNote || payload.reviewNote || "",
        status: "PendingVisit",
      };
      updateTaskReportSummary(task, {
        needsReinspection: true,
        reinspectionDate: dueDate,
        reinspectionDueDate: dueDate,
        reinspectionNote: payload.reinspectionNote || payload.reviewNote || "",
        reinspectionTask,
      });
      task.updatedAt = mockNow;
      setTaskCurrentStepCode(task, "Reinspection");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        currentStepId: getMockExecutionStepId("Reinspection"),
        currentStepCode: "Reinspection",
        reinspectionTask,
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/submit-report",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      return ok(submitMockInspectionReport(task, payload));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/review-submit",
    method: "post",
    response: () => getMockError(404, "Inspection.Execution.ReviewSubmitUnavailable"),
  },
  {
    url: "/api/admin/inspection/tasks/:id/checkout",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");
      const hasSubmittedReport = Boolean(normalizeText(
        task.reportPreview?.reportSummary?.submittedAt || task.reportPreview?.generatedAt,
      ));
      if (!hasSubmittedReport) {
        return getMockError(400, "Inspection.Execution.StepOutOfOrder");
      }
      const checkOutAt = normalizeText(payload.checkOutAt) || mockNow;
      updateTaskReportSummary(task, {
        checkOutAt,
        checkOutLat: task.inspectionConfig.isDigitalVisit ? null : payload.checkOutLat ?? 24.4539,
        checkOutLng: task.inspectionConfig.isDigitalVisit ? null : payload.checkOutLng ?? 54.3773,
        checkOutAddress: task.inspectionConfig.isDigitalVisit ? null : payload.checkOutAddress || task.inspectionTarget.address?.street,
      });
      task.status = "COMPLETED";
      task.updatedAt = checkOutAt;
      setTaskCurrentStepCode(task, "CheckOut");
      syncInspectionTaskAfterMutation(task);
      return ok({
        taskId: task.taskId,
        checkOutAt,
        status: task.status,
        currentStepId: getMockExecutionStepId("CheckOut"),
        currentStepCode: "CheckOut",
      });
    },
  },
  {
    url: "/api/admin/inspection/tasks",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const nextTaskId =
        inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + 1;
      const now = new Date().toISOString();
      const created: InspectionTaskDetail = {
        taskId: nextTaskId,
        taskNo: payload.taskNo || `INS-2026-${String(nextTaskId).padStart(6, "0")}`,
        taskName: payload.taskName || "Manual inspection task",
        status: payload.assignment?.isAssigned ? "PENDING_VISIT" : "QUEUED",
        taskSource: payload.taskSource || taskSources.MANUAL,
        inspectionTarget: payload.inspectionTarget,
        riskProfile: payload.riskProfile,
        inspectionConfig: payload.inspectionConfig,
        assignment: payload.assignment || {
          isAssigned: false,
          assignedInspectors: [],
          assignmentReasonEn: "Created without assignment",
        },
        createdAt: now,
        updatedAt: now,
        description: payload.description,
        tabs: ["all"],
        attachments: normalizeAttachments(payload.attachments),
        smartChecklistSnapshot: createChecklist(
          payload.inspectionTarget?.establishmentId || 0,
          payload.riskProfile,
        ),
      };

      syncInspectionTaskAfterMutation(created);
      inspectionTasks.unshift(created);
      return ok(cloneTask(created));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/edit",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");

      task.taskName = payload.taskName ?? task.taskName;
      task.taskSource = payload.taskSource || task.taskSource;
      task.inspectionTarget = payload.inspectionTarget || task.inspectionTarget;
      task.riskProfile = payload.riskProfile || task.riskProfile;
      task.inspectionConfig = payload.inspectionConfig || task.inspectionConfig;
      task.assignment = payload.assignment || task.assignment;
      task.description = payload.description ?? task.description;
      if (Object.prototype.hasOwnProperty.call(payload, "attachments")) {
        task.attachments = normalizeAttachments(payload.attachments);
      }
      task.updatedAt = new Date().toISOString();
      task.smartChecklistSnapshot = createChecklist(
        task.inspectionTarget.establishmentId || 0,
        task.riskProfile,
      );

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/assign",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");

      const assignedInspectors = asArray(payload.inspectorIds)
        .map((id) => inspectors.find((item) => item.inspectorId === id))
        .filter(Boolean) as InspectionAssignedInspector[];
      task.assignment = {
        isAssigned: assignedInspectors.length > 0,
        assignedInspector: assignedInspectors[0]?.inspectorId,
        assignedInspectors,
        assignmentReasonEn:
          payload.reason || "Assigned through inspection task assignment action",
        assignedAt: new Date().toISOString(),
      };
      task.status = assignedInspectors.length ? "PENDING_VISIT" : task.status;
      task.updatedAt = new Date().toISOString();

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/cancel",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");

      task.status = "CANCELLED";
      task.updatedAt = new Date().toISOString();
      task.description = payload.reason
        ? `${task.description || ""} Cancellation reason: ${payload.reason}`.trim()
        : task.description;

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/admin/inspection/tasks/:id/duplicate",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTaskFromPath((query || {}) as Record<string, any>, payload);
      if (!task) return getMockError(404, "Task not found");

      const nextTaskId =
        inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + 1;
      const now = new Date().toISOString();
      const duplicated = cloneTask(task);
      duplicated.taskId = nextTaskId;
      duplicated.taskNo = `INS-2026-${String(nextTaskId).padStart(6, "0")}`;
      duplicated.status = "DRAFT";
      duplicated.assignment = {
        isAssigned: false,
        assignedInspectors: [],
        assignmentReasonEn: "Duplicated task requires fresh assignment",
      };
      duplicated.createdAt = now;
      duplicated.updatedAt = now;
      duplicated.taskName = `${task.taskName || "Inspection task"} copy`;
      syncInspectionTaskAfterMutation(duplicated);
      inspectionTasks.unshift(duplicated);

      return ok(cloneTask(duplicated));
    },
  },
  {
    url: "/api/inspection/tasks/create",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const nextTaskId =
        inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + 1;
      const now = new Date().toISOString();
      const created: InspectionTaskDetail = {
        taskId: nextTaskId,
        taskNo: payload.taskNo || `INS-2026-${String(nextTaskId).padStart(6, "0")}`,
        taskName: payload.taskName || "Manual inspection task",
        status: payload.assignment?.isAssigned ? "PENDING_VISIT" : "QUEUED",
        taskSource: payload.taskSource || taskSources.MANUAL,
        inspectionTarget: payload.inspectionTarget,
        riskProfile: payload.riskProfile,
        inspectionConfig: payload.inspectionConfig,
        assignment: payload.assignment || {
          isAssigned: false,
          assignedInspectors: [],
          assignmentReasonEn: "Created without assignment",
        },
        createdAt: now,
        updatedAt: now,
        description: payload.description,
        tabs: ["all"],
        attachments: normalizeAttachments(payload.attachments),
        smartChecklistSnapshot: createChecklist(
          payload.inspectionTarget?.establishmentId || 0,
          payload.riskProfile,
        ),
      };

      syncInspectionTaskAfterMutation(created);
      inspectionTasks.unshift(created);
      return ok(cloneTask(created));
    },
  },
  {
    url: "/api/inspection/tasks/update",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      task.taskName = payload.taskName ?? task.taskName;
      task.taskSource = payload.taskSource || task.taskSource;
      task.inspectionTarget = payload.inspectionTarget || task.inspectionTarget;
      task.riskProfile = payload.riskProfile || task.riskProfile;
      task.inspectionConfig = payload.inspectionConfig || task.inspectionConfig;
      task.assignment = payload.assignment || task.assignment;
      task.description = payload.description ?? task.description;
      if (Object.prototype.hasOwnProperty.call(payload, "attachments")) {
        task.attachments = normalizeAttachments(payload.attachments);
      }
      task.updatedAt = new Date().toISOString();
      task.smartChecklistSnapshot = createChecklist(
        task.inspectionTarget.establishmentId || 0,
        task.riskProfile,
      );

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/inspection/tasks/assign",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      const assignedInspectors = asArray(payload.inspectorIds)
        .map((id) => inspectors.find((item) => item.inspectorId === id))
        .filter(Boolean) as InspectionAssignedInspector[];
      task.assignment = {
        isAssigned: assignedInspectors.length > 0,
        assignedInspector: assignedInspectors[0]?.inspectorId,
        assignedInspectors,
        assignmentReasonEn:
          payload.reason || "Assigned through inspection task assignment action",
        assignedAt: new Date().toISOString(),
      };
      task.status = assignedInspectors.length ? "PENDING_VISIT" : task.status;
      task.updatedAt = new Date().toISOString();

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/inspection/tasks/cancel",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      task.status = "CANCELLED";
      task.updatedAt = new Date().toISOString();
      task.description = payload.reason
        ? `${task.description || ""} Cancellation reason: ${payload.reason}`.trim()
        : task.description;

      syncInspectionTaskAfterMutation(task);
      return ok(cloneTask(task));
    },
  },
  {
    url: "/api/inspection/tasks/duplicate",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      const nextTaskId =
        inspectionTasks.reduce((max, item) => Math.max(max, item.taskId), 10000) + 1;
      const now = new Date().toISOString();
      const duplicated = cloneTask(task);
      duplicated.taskId = nextTaskId;
      duplicated.taskNo = `INS-2026-${String(nextTaskId).padStart(6, "0")}`;
      duplicated.status = "DRAFT";
      duplicated.assignment = {
        isAssigned: false,
        assignedInspectors: [],
        assignmentReasonEn: "Duplicated task requires fresh assignment",
      };
      duplicated.createdAt = now;
      duplicated.updatedAt = now;
      duplicated.taskName = `${task.taskName || "Inspection task"} copy`;
      syncInspectionTaskAfterMutation(duplicated);
      inspectionTasks.unshift(duplicated);

      return ok(cloneTask(duplicated));
    },
  },
  {
    url: "/api/inspection/smart-checklist",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const task = resolveTask(query || {});
      const establishmentId = toNumber(query?.establishmentId || task?.inspectionTarget.establishmentId, 0);
      const riskProfile = task?.riskProfile || { riskScore: 65, riskLevel: "MEDIUM" as InspectionRiskLevel, lastAssessmentDate: new Date().toISOString() };
      return ok(createChecklist(establishmentId, riskProfile));
    },
  },
  {
    url: "/api/inspection/smart-checklist",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      const establishmentId = toNumber(
        payload.establishmentId || task?.inspectionTarget.establishmentId,
        0,
      );
      const riskProfile = task?.riskProfile || {
        riskScore: 65,
        riskLevel: "MEDIUM" as InspectionRiskLevel,
        lastAssessmentDate: new Date().toISOString(),
      };

      return ok(createChecklist(establishmentId, riskProfile));
    },
  },
  {
    url: "/api/inspection/execution/draft/save",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      const previousVersion = taskDrafts.get(task.taskId)?.version || 0;
      const savedAt = new Date().toISOString();
      taskDrafts.set(task.taskId, {
        version: previousVersion + 1,
        savedAt,
        visitId: payload.visitId ?? null,
        establishmentId: payload.establishmentId ?? task.inspectionTarget.establishmentId,
        checklistCategories:
          payload.checklistCategories || task.smartChecklistSnapshot?.checklistCategories || [],
        summary: payload.summary || {},
      });
      task.draftUpdatedAt = savedAt;
      task.smartChecklistSnapshot = {
        ...(task.smartChecklistSnapshot || createChecklist(
          task.inspectionTarget.establishmentId || 0,
          task.riskProfile,
        )),
        checklistCategories:
          payload.checklistCategories || task.smartChecklistSnapshot?.checklistCategories || [],
      };
      task.updatedAt = savedAt;
      if (task.status === "PENDING_VISIT" || task.status === "ASSIGNED") {
        task.status = "IN_PROGRESS";
      }
      syncInspectionTaskAfterMutation(task);

      return ok({
        taskId: task.taskId,
        savedAt,
        version: previousVersion + 1,
      });
    },
  },
  {
    url: "/api/inspection/reports/submit",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const task = resolveTask(payload);
      if (!task) {
        return {
          code: 404,
          message: "Task not found",
          data: null,
        };
      }

      const reportId = `RPT-${task.taskId}-${Date.now()}`;
      const submittedAt = new Date().toISOString();
      const checklistCategories =
        payload.checklistCategories ||
        taskDrafts.get(task.taskId)?.checklistCategories ||
        task.smartChecklistSnapshot?.checklistCategories ||
        [];
      const reportSummary = {
        ...(payload.reportSummary || {}),
        submittedAt,
      };
      const createdViolations = createViolationRecordsFromReport(
        task,
        checklistCategories,
        reportSummary,
        submittedAt,
      );
      const reinspectionTask = reportSummary.needsReinspection
        ? createReinspectionTask(task, reportSummary, submittedAt)
        : null;
      const preview: InspectionReportPreview = {
        reportId,
        taskId: task.taskId,
        taskNo: task.taskNo,
        generatedAt: submittedAt,
        previewUrl: `/mock/inspection/report/${reportId}`,
        reportSummary: {
          ...reportSummary,
          createdViolations: createdViolations.map((item) => ({
            violationId: item.violationId,
            violationNo: item.violationNo,
            violationCode: item.violationCode,
            violationName: item.violationName,
            violationDescription: item.violationDescription,
            violationType: item.violationType,
            status: item.status,
          })),
          reinspectionTask,
        },
        checklistCategories,
      };

      if (createdViolations.length) {
        violationMockData.unshift(...createdViolations);
      }
      reportStore.set(reportId, preview);
      task.reportPreview = preview;
      task.status = payload.reportSummary?.result === "ACCESS_FAILED" ? "ACCESS_FAILED" : "COMPLETED";
      task.updatedAt = submittedAt;
      syncInspectionTaskAfterMutation(task);

      return ok({
        taskId: task.taskId,
        reportId,
        submittedAt,
        status: task.status as "COMPLETED",
      });
    },
  },
  {
    url: "/api/inspection/reports/preview",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const reportId = normalizeText(query?.reportId);
      if (reportId && reportStore.has(reportId)) {
        return ok(reportStore.get(reportId) || null);
      }

      const task = resolveTask(query || {});
      return ok(task?.reportPreview || null);
    },
  },
  {
    url: "/api/inspection/declarations/:token/contact-person",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const token = normalizeText((query || {}).token);
      const declaration = declarationStore.get(token);
      if (!token) return getMockError(400, "Inspection.Declaration.TokenRequired");
      if (!declaration) return getMockError(400, "Inspection.Declaration.InvalidToken");
      if (declaration.isExpired) return getMockError(400, "Inspection.Declaration.LinkExpired");
      if (declaration.declarationSubmittedOn) return getMockError(400, "Inspection.Declaration.AlreadySubmitted");

      const payload = parsePayload(body);
      const requiredFields = [
        ["fullName", "Inspection.Declaration.ContactPersonNameRequired"],
        ["position", "Inspection.Declaration.ContactPersonPositionRequired"],
        ["mobile", "Inspection.Declaration.ContactPersonMobileRequired"],
        ["email", "Inspection.Declaration.ContactPersonEmailRequired"],
        ["emiratesId", "Inspection.Declaration.ContactPersonEmiratesIdRequired"],
        ["eidAttachmentFileUrl", "Inspection.Declaration.ContactPersonEidAttachmentRequired"],
      ];
      const missing = requiredFields.find(([field]) => !normalizeText(payload[field]));
      if (missing) return getMockError(400, missing[1]);

      declaration.contactPerson = {
        fullName: payload.fullName,
        position: payload.position,
        mobile: payload.mobile,
        email: payload.email,
        emiratesId: payload.emiratesId,
        collectedChannelCode: payload.collectedChannelCode || "Email",
        submittedOn: payload.submittedOn || mockNow,
        eidAttachmentFileName: payload.eidAttachmentFileName || "eid.pdf",
        eidAttachmentFileUrl: payload.eidAttachmentFileUrl,
      };
      declarationStore.set(token, declaration);
      return ok(null);
    },
  },
  {
    url: "/api/inspection/declarations/:token/submit",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const token = normalizeText((query || {}).token);
      const declaration = declarationStore.get(token);
      if (!token) return getMockError(400, "Inspection.Declaration.TokenRequired");
      if (!declaration) return getMockError(400, "Inspection.Declaration.InvalidToken");
      if (declaration.isExpired) return getMockError(400, "Inspection.Declaration.LinkExpired");
      if (declaration.declarationSubmittedOn) return getMockError(400, "Inspection.Declaration.AlreadySubmitted");
      if (!declaration.contactPerson) return getMockError(400, "Inspection.Declaration.ContactPersonRequired");

      const payload = parsePayload(body);
      if (payload.hasSignedDeclaration !== true) return getMockError(400, "Inspection.Declaration.InvalidSubmitSelection");
      if (!normalizeText(payload.signatureImageFileUrl)) return getMockError(400, "Inspection.Declaration.SignatureRequired");
      if (!normalizeText(payload.declarationDocumentFileUrl)) return getMockError(400, "Inspection.Declaration.DocumentRequired");

      declaration.declarationAcknowledged = true;
      declaration.hasSignedDeclaration = true;
      declaration.declarationSubmittedOn = payload.signatureSignedOn || mockNow;
      declaration.signatureImageFileName = payload.signatureImageFileName || "signature.png";
      declaration.signatureImageFileUrl = payload.signatureImageFileUrl;
      declaration.declarationDocumentFileName = payload.declarationDocumentFileName || "signed-declaration.pdf";
      declaration.declarationDocumentFileUrl = payload.declarationDocumentFileUrl;
      declarationStore.set(token, declaration);
      return ok(null);
    },
  },
  {
    url: "/api/inspection/declarations/:token/refuse",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const token = normalizeText((query || {}).token);
      const declaration = declarationStore.get(token);
      if (!token) return getMockError(400, "Inspection.Declaration.TokenRequired");
      if (!declaration) return getMockError(400, "Inspection.Declaration.InvalidToken");
      if (declaration.isExpired) return getMockError(400, "Inspection.Declaration.LinkExpired");
      if (declaration.declarationSubmittedOn) return getMockError(400, "Inspection.Declaration.AlreadySubmitted");
      if (!declaration.contactPerson) return getMockError(400, "Inspection.Declaration.ContactPersonRequired");

      const payload = parsePayload(body);
      const reason = normalizeText(payload.reason || payload.declarationDeclinedReason);
      if (!reason) return getMockError(400, "Inspection.Declaration.RefuseReasonRequired");

      declaration.declarationAcknowledged = false;
      declaration.hasSignedDeclaration = false;
      declaration.declarationDeclinedReason = reason;
      declaration.declarationSubmittedOn = mockNow;
      declarationStore.set(token, declaration);

      const violation = violationMockData.find((item) => item.violationId === declaration.violationId || item.violationNo === declaration.violationNo);
      if (violation) {
        violation.timeline = violation.timeline || [];
        violation.timeline.push({
          action: "DeclarationAcknowledgementRefused",
          operator: declaration.contactPerson.fullName || "Declaration Portal",
          actionAt: mockNow,
          remark: reason,
        });
      }
      return ok(null);
    },
  },
  {
    url: "/api/inspection/declarations/:token",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const token = normalizeText((query || {}).token);
      if (!token) return getMockError(400, "Inspection.Declaration.TokenRequired");
      const declaration = declarationStore.get(token);
      return declaration ? ok(declaration) : getMockError(400, "Inspection.Declaration.InvalidToken");
    },
  },
  {
    url: "/api/admin/inspection/violations/stats",
    method: "get",
    response: () => ok({
      summary: buildViolationSummary(violationMockData),
      statusCounts: buildViolationSummary(violationMockData),
    }),
  },
  {
    url: "/api/admin/inspection/violations",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const pageIndex = toNumber(query?.pageIndex, 1);
      const pageSize = toNumber(query?.pageSize, 10);
      const filtered = filterAdminViolationItems(query || {});
      const page = paginate(filtered, pageIndex, pageSize);

      return ok({
        ...page,
        items: page.items.map(mapAdminViolationListItem),
        totalCount: page.total,
        summary: buildViolationSummary(filtered),
        filterOptions: buildViolationFilterOptions(filtered),
      });
    },
  },
  {
    url: "/api/admin/inspection/violations/:id/timeline",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const violation = getViolationByParam({
        id: query?.id,
        violationId: query?.id,
      });

      return ok(violation?.violationTimeline || violation?.timeline || []);
    },
  },
  {
    url: "/api/inspection/violations/list",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      const pageIndex = toNumber(query?.pageIndex, 1);
      const pageSize = toNumber(query?.pageSize, 10);
      const keyword = normalizeText(query?.keyword).toLowerCase();
      const roleSet = getAdminRoleSet(query?.role);
      const view = normalizeText(query?.view).toLowerCase();
      const tab = normalizeText(query?.tab).toLowerCase();
      const filters = parseQueryFilters((query || {}) as Record<string, any>);
      const statusSet = new Set(asArray(filters.statusList).map((status) => status.toUpperCase()));
      const typeSet = new Set(asArray(filters.typeList).flatMap(getViolationTypeAliases));
      const severitySet = new Set(asArray(filters.severityList));
      const taskIdSet = new Set(asArray(filters.taskIds));
      const establishmentIdSet = new Set(asArray(filters.establishmentIds));
      const reportedBySet = new Set(asArray(filters.reportedByList).map((item) => item.toLowerCase()));
      const violationReasonSet = new Set(asArray(filters.violationReasonList).map((item) => item.toLowerCase()));
      const issuedTimeFrom = Date.parse(normalizeText(filters.issuedTimeFrom));
      const issuedTimeTo = Date.parse(normalizeText(filters.issuedTimeTo));
      const hasIssuedTimeFrom = Number.isFinite(issuedTimeFrom);
      const hasIssuedTimeTo = Number.isFinite(issuedTimeTo);
      const roleStatusSet = new Set<string>();
      const directStatusTab = tab && !["all", "todo", "completed"].includes(tab)
        ? tab.toUpperCase()
        : "";

      if (roleSet.has("content")) {
        const todoStatuses = ["PENDING_CONTENT_REPORT"];
        const completedStatuses = [
          "WARNING_ISSUED",
          "PENDING_REVIEW",
          "PENDING_COMMITTEE_DECISION",
          "PENDING_APPROVAL",
          "PENDING_PAYMENT",
          "UNDER_APPEAL",
          "PAID",
          "CANCELLED",
        ];
        const targetStatuses = tab === "completed"
          ? completedStatuses
          : tab === "todo"
            ? todoStatuses
            : [...todoStatuses, ...completedStatuses];
        targetStatuses.forEach((status) => roleStatusSet.add(status));
      }
      if (roleSet.has("committee")) {
        const todoStatuses = ["PENDING_COMMITTEE_DECISION"];
        const completedStatuses = [
          "WARNING_ISSUED",
          "PENDING_APPROVAL",
          "PENDING_PAYMENT",
          "UNDER_APPEAL",
          "PAID",
          "CANCELLED",
        ];
        const targetStatuses = tab === "completed"
          ? completedStatuses
          : tab === "todo"
            ? todoStatuses
            : [...todoStatuses, ...completedStatuses];
        targetStatuses.forEach((status) => roleStatusSet.add(status));
      }
      if (!roleStatusSet.size && directStatusTab) {
        roleStatusSet.add(directStatusTab);
      }

      const filtered = violationMockData.filter((item) => {
        if (keyword) {
          const searchable = [
            item.id,
            item.violationId,
            item.violationNo,
            item.violationCode,
            item.title,
            item.violationName,
            item.reason,
            item.status,
            item.establishmentNameEn,
            item.taskNo,
            item.sourceTask,
            item.categoryName,
            item.reportedBy,
            item.assignedInspector,
            item.fineAmount,
          ]
            .join(" ")
            .toLowerCase();
          if (!searchable.includes(keyword)) {
            return false;
          }
        }

        const normalizedStatus = normalizeText(item.status).toUpperCase();

        if (statusSet.size && !statusSet.has(normalizedStatus)) {
          return false;
        }

        if (roleStatusSet.size && !roleStatusSet.has(normalizedStatus)) {
          return false;
        }

        if (
          roleSet.has("committee") &&
          tab === "completed" &&
          adminCommitteeCompletedViolationStatuses.has(normalizedStatus) &&
          !hasAdminCommitteeDecision(item)
        ) {
          return false;
        }

        if (!matchesViolationTypeFilter(item, typeSet)) {
          return false;
        }

        if (severitySet.size && !severitySet.has(item.severity)) {
          return false;
        }

        if (taskIdSet.size && !taskIdSet.has(String(item.taskId))) {
          return false;
        }

        if (
          establishmentIdSet.size &&
          !establishmentIdSet.has(String(item.establishmentId))
        ) {
          return false;
        }

        if (reportedBySet.size) {
          const reportedBy = normalizeText(item.reportedBy || item.assignedInspector).toLowerCase();
          if (!reportedBySet.has(reportedBy)) {
            return false;
          }
        }

        if (violationReasonSet.size) {
          const violationReason = getViolationReasonText(item).toLowerCase();
          if (!violationReasonSet.has(violationReason)) {
            return false;
          }
        }

        if (hasIssuedTimeFrom || hasIssuedTimeTo) {
          const issuedTime = getViolationIssuedTimestamp(item);
          if (issuedTime === null) {
            return false;
          }
          if (hasIssuedTimeFrom && issuedTime < issuedTimeFrom) {
            return false;
          }
          if (hasIssuedTimeTo && issuedTime > issuedTimeTo) {
            return false;
          }
        }

        if (view === "mine" && item.assignedInspector !== "Ava Khan") {
          return false;
        }

        if (directStatusTab && normalizedStatus !== directStatusTab) {
          return false;
        }

        return true;
      });

      const page = paginate(filtered, pageIndex, pageSize);
      return ok({
        ...page,
        summary: buildViolationSummary(filtered),
        filterOptions: buildViolationFilterOptions(filtered),
      });
    },
  },
  {
    url: "/api/inspection/violations/detail",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      return ok(getViolationByParam(query || {}) || null);
    },
  },
  {
    url: "/api/admin/inspection/violations/:id/route",
    method: "post",
    response: ({ query, body }: { query?: Record<string, unknown>; body?: unknown }) => {
      const payload = parsePayload(body);
      const violation = getViolationByParam({
        id: query?.id,
        violationId: query?.id,
      });
      if (!violation) {
        return {
          code: 404,
          message: "Violation not found",
          data: null,
        };
      }

      const currentStatus = normalizeText(violation.status).toUpperCase();
      const routeTargetCode = normalizeText(payload.routeTargetCode || "Content").toLowerCase();
      let nextStatus: InspectionViolationStatus | null = null;

      if (routeTargetCode === "content" && currentStatus === "PENDING_ROUTING") {
        nextStatus = "PENDING_CONTENT_REPORT";
      }

      if (
        routeTargetCode === "committee" &&
        ["PENDING_ROUTING", "PENDING_REVIEW", "UNDER_REVIEW"].includes(currentStatus)
      ) {
        nextStatus = "PENDING_COMMITTEE_DECISION";
      }

      if (!nextStatus) {
        return {
          code: 400,
          message: "Invalid violation route target or status",
          data: null,
        };
      }

      violation.status = nextStatus;
      violation.workflowOwner = nextStatus === "PENDING_CONTENT_REPORT" ? "Content Team" : "Inspection Committee";
      violation.timeline = violation.timeline || [];
      violation.timeline.push({
        action: routeTargetCode === "committee" ? "TRANSFERRED_TO_COMMITTEE" : "TRANSFERRED_TO_CONTENT",
        operator: "Mock User",
        actionAt: new Date().toISOString(),
        remark: payload.latestTransferNote || `Transferred to ${violation.workflowOwner}`,
      });

      return ok(violation);
    },
  },
  {
    url: "/api/admin/inspection/violations/:id",
    method: "get",
    response: ({ query }: { query?: Record<string, unknown> }) => {
      return ok(getViolationByParam({
        id: query?.id,
        violationId: query?.id,
      }) || null);
    },
  },
  {
    url: "/api/inspection/violations/update-status",
    method: "post",
    response: ({ body }: { body?: unknown }) => {
      const payload = parsePayload(body);
      const violation = getViolationByParam(payload);
      if (!violation) {
        return {
          code: 404,
          message: "Violation not found",
          data: null,
        };
      }

      violation.status = payload.status || violation.status;
      violation.availableActions = getFigmaAvailableViolationActions(violation.status);
      if (payload.contentReviewReport !== undefined) {
        violation.contentReviewReport = payload.contentReviewReport;
      }
      if (payload.fineAmount !== undefined) {
        violation.fineAmount = Number(payload.fineAmount) || 0;
      }
      if (payload.committeeDecisionTypeId !== undefined) {
        violation.committeeDecisionTypeId = payload.committeeDecisionTypeId;
        violation.committeeDecisionTypeCode = normalizeText(payload.committeeDecisionTypeId);
        violation.committeeDecisionNote = payload.committeeDecisionNote ?? payload.remark ?? "";
      }
      if (payload.committeeDecision !== undefined) {
        violation.committeeDecision = payload.committeeDecision;
      } else if (
        payload.action === "review_decide" ||
        payload.action === "cancel" ||
        payload.committeeDecisionTypeId !== undefined
      ) {
        violation.committeeDecision = getFigmaCommitteeDecision(
          violation.status,
          Number(violation.fineAmount) || 0,
        );
      }
      if (payload.paymentDetails !== undefined) {
        violation.paymentDetails = payload.paymentDetails;
      }
      if (payload.fineDetails !== undefined) {
        violation.fineDetails = payload.fineDetails;
      }
      if (Array.isArray(payload.selectedViolationKeys) && Array.isArray(violation.reportedViolations)) {
        violation.reportedViolations = violation.reportedViolations.filter((item: { key?: string }) => (
          payload.selectedViolationKeys.includes(item.key)
        ));
      }
      if (payload.status) {
        violation.violationTimeline = buildFigmaViolationTimeline(payload.status);
      }
      violation.timeline = violation.timeline || [];
      violation.timeline.push({
        action: "STATUS_UPDATED",
        operator: "Mock User",
        actionAt: new Date().toISOString(),
        remark: payload.remark || `Updated to ${violation.status}`,
      });

      return ok(violation);
    },
  },
];

export default inspectionMocks;
