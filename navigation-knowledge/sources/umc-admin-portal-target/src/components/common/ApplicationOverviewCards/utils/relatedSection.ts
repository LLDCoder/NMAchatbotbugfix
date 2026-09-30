import moment from "moment";
import type { TFunction } from "i18next";
import type {
  IRelateApplicationItem,
  IRelateAppsResponse,
  IRelateAppealItem,
  IRelateEnquiryServiceItem,
  IRelateRefundItem,
} from "@/services/tickets";
import type {
  RelatedSectionCardProps,
  RelatedSectionStatusTone,
} from "../RelatedSectionCard";

const DATE_TIME_FORMAT = "DD/MM/YYYY HH:mm:ss";

export type RelatedSectionStatisticKey =
  | "historicalApplications"
  | "historicalTicketsEnquiry"
  | "refund"
  | "appeal";

type LocalizedNameLike = {
  nameEn?: string | null;
  nameAr?: string | null;
};

type RelatedRecord = Record<string, unknown> & {
  createdOn?: string | null;
  submissionTime?: string | null;
  taskCreatedTime?: string | null;
  description?: string | null;
  statusId?: number | null;
  enquiryStatusId?: number | null;
  applicationStatusId?: number | null;
  status?: string | null;
  statusName?: string | null;
  refundStatusName?: string | null;
  appealStatusName?: string | null;
  applicationStatusName?: string | null;
  statusObj?: LocalizedNameLike | null;
  enquiryStatusObj?: LocalizedNameLike | null;
  applicationStatusObj?: LocalizedNameLike | null;
  refundStatusObj?: LocalizedNameLike | null;
  appealStatusObj?: LocalizedNameLike | null;
  serviceName?: string | null;
  serviceNameEn?: string | null;
  serviceNameAr?: string | null;
  serviceObj?: LocalizedNameLike | null;
  applyFor?: string | null;
  applyForEn?: string | null;
  applyForAr?: string | null;
  appliedFor?: string | null;
  appliedForEn?: string | null;
  appliedForAr?: string | null;
  applicantName?: string | null;
  userName?: string | null;
  name?: string | null;
  number?: string | null;
  refundNo?: string | null;
  refundNumber?: string | null;
  appealNo?: string | null;
  appealNumber?: string | null;
  referenceNo?: string | null;
  referenceNumber?: string | null;
};

const getDisplayValue = (
  value?: string | number | null,
  fallback = "-",
) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const getLocalizedValue = (
  language: string,
  source?: LocalizedNameLike | null,
  fallback = "-",
) => {
  if (!source) {
    return fallback;
  }

  return language === "ar"
    ? getDisplayValue(source.nameAr || source.nameEn, fallback)
    : getDisplayValue(source.nameEn || source.nameAr, fallback);
};

const getTextCandidate = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

const getFirstMeaningfulValue = (
  values: unknown[],
  fallback = "-",
) => {
  const matchedValue = values
    .map((value) => getTextCandidate(value))
    .find(Boolean);

  return matchedValue || fallback;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  return moment(value).format(DATE_TIME_FORMAT);
};

const getSortTimestamp = (value?: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedTime = moment(value);
  return parsedTime.isValid()
    ? parsedTime.valueOf()
    : Number.NEGATIVE_INFINITY;
};

const getStatusToneById = (
  statusId?: number | null,
): RelatedSectionStatusTone => {
  switch (statusId) {
    case 5:
    case 6:
      return "success";
    case 2:
      return "warning";
    case 3:
      return "departmentProcessing";
    case 4:
      return "danger";
    case 1:
      return "open";
    case 7:
    default:
      return "neutral";
  }
};

const getStatusToneByLabel = (
  statusLabel?: string | null,
): RelatedSectionStatusTone => {
  const normalized = String(statusLabel ?? "").trim().toLowerCase();

  if (!normalized || normalized === "-") {
    return "neutral";
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("approved") ||
    normalized.includes("success") ||
    normalized.includes("active")
  ) {
    return "success";
  }

  if (
    normalized.includes("department processing")
  ) {
    return "departmentProcessing";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("processing") ||
    normalized.includes("progress") ||
    normalized.includes("review")
  ) {
    return "warning";
  }

  if (
    normalized.includes("reject") ||
    normalized.includes("cancel") ||
    normalized.includes("expire") ||
    normalized.includes("fail")
  ) {
    return "danger";
  }

  return "neutral";
};

const getStatusTone = (
  statusId?: number | null,
  statusLabel?: string | null,
) => {
  if (typeof statusId === "number" && Number.isFinite(statusId)) {
    return getStatusToneById(statusId);
  }

  return getStatusToneByLabel(statusLabel);
};

const toArray = <T,>(value?: T[] | null) => {
  return Array.isArray(value) ? value : [];
};

const normalizeTextValue = (value?: string | null) =>
  String(value ?? "").trim().toLowerCase();

const normalizeServiceId = (value?: string | number | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
};

const getLatestItem = <T,>(
  items: T[],
  getSortTime: (item: T) => string | null | undefined,
  shouldInclude: (item: T) => boolean = () => true,
) =>
  items.reduce<T | null>((latestItem, item) => {
    if (!shouldInclude(item)) {
      return latestItem;
    }

    if (!latestItem) {
      return item;
    }

    return getSortTimestamp(getSortTime(item)) >
      getSortTimestamp(getSortTime(latestItem))
      ? item
      : latestItem;
  }, null);

const getCommonServiceName = (
  item: RelatedRecord,
  language: string,
) =>
  getFirstMeaningfulValue([
    item.serviceName,
    language === "ar" ? item.serviceNameAr : item.serviceNameEn,
    language === "ar" ? item.serviceNameEn : item.serviceNameAr,
    getLocalizedValue(language, item.serviceObj, ""),
  ]);

const getCommonAppliedFor = (
  item: RelatedRecord,
  language: string,
) =>
  getFirstMeaningfulValue([
    item.applyFor,
    item.appliedFor,
    language === "ar" ? item.applyForAr : item.applyForEn,
    language === "ar" ? item.applyForEn : item.applyForAr,
    language === "ar" ? item.appliedForAr : item.appliedForEn,
    language === "ar" ? item.appliedForEn : item.appliedForAr,
    item.applicantName,
    item.userName,
    item.name,
  ]);

const getCommonSubmissionTime = (item: RelatedRecord) =>
  getFirstMeaningfulValue([
    item.submissionTime,
    item.createdOn,
    item.taskCreatedTime,
  ], "");

const getCommonStatusLabel = (
  item: RelatedRecord,
  language: string,
) =>
  getFirstMeaningfulValue([
    item.applicationStatusName,
    item.refundStatusName,
    item.appealStatusName,
    item.statusName,
    item.status,
    getLocalizedValue(language, item.applicationStatusObj, ""),
    getLocalizedValue(language, item.refundStatusObj, ""),
    getLocalizedValue(language, item.appealStatusObj, ""),
    getLocalizedValue(language, item.enquiryStatusObj, ""),
    getLocalizedValue(language, item.statusObj, ""),
  ]);

const getCommonReferenceNo = (
  item: RelatedRecord,
  fallbackKeys: unknown[] = [],
) =>
  getFirstMeaningfulValue([
    ...fallbackKeys,
    item.referenceNo,
    item.referenceNumber,
    item.refundNo,
    item.refundNumber,
    item.appealNo,
    item.appealNumber,
    item.number,
  ]);

const buildApplicationSection = ({
  item,
  language,
  t,
}: {
  item: IRelateApplicationItem;
  language: string;
  t: TFunction;
}): RelatedSectionCardProps => {
  const statusLabel = getDisplayValue(
    getCommonStatusLabel(item as RelatedRecord, language),
  );
  const applicationNo = getDisplayValue(
    item.applicationNumber || item.applicationNo || item.number,
  );

  return {
    variant: "relatedApplication",
    title: t("Customer.ticketsDetails.applicationOverview.relatedApplications"),
    referenceNo: applicationNo,
    applicationNo: applicationNo !== "-" ? applicationNo : null,
    sortTime: item.submissionTime || item.createdOn || item.taskCreatedTime,
    sourceServiceId:
      typeof item.serviceId === "number" && Number.isFinite(item.serviceId)
        ? item.serviceId
        : null,
    statusLabel,
    statusTone: getStatusTone(
      item.applicationStatusId ?? item.statusId,
      statusLabel,
    ),
    fields: [
      {
        label: t("Customer.ticketsDetails.applicationOverview.serviceName"),
        value: getDisplayValue(
          getCommonServiceName(item as RelatedRecord, language),
        ),
      },
      {
        label: t("Customer.ticketsDetails.applicationOverview.appliedFor"),
        value: getDisplayValue(
          getCommonAppliedFor(item as RelatedRecord, language),
        ),
      },
      {
        label: t("Customer.ticketsDetails.applicationOverview.submissionTime"),
        value: formatDateTime(
          item.submissionTime || item.createdOn || item.taskCreatedTime,
        ),
      },
    ],
  };
};

const buildCommonApplicationStyleSection = ({
  item,
  language,
  t,
  variant,
  title,
  referenceNo,
}: {
  item: RelatedRecord;
  language: string;
  t: TFunction;
  variant: "relatedRefund" | "relatedAppeal";
  title: string;
  referenceNo: string;
}): RelatedSectionCardProps => {
  const statusLabel = getCommonStatusLabel(item, language);

  return {
    variant,
    title,
    referenceNo,
    sortTime: getCommonSubmissionTime(item),
    sourceServiceId:
      typeof item.serviceId === "number" && Number.isFinite(item.serviceId)
        ? item.serviceId
        : null,
    statusLabel,
    statusTone: getStatusTone(
      item.applicationStatusId ?? item.enquiryStatusId ?? item.statusId,
      statusLabel,
    ),
    fields: [
      {
        label: t("Customer.ticketsDetails.applicationOverview.serviceName"),
        value: getCommonServiceName(item, language),
      },
      {
        label: t("Customer.ticketsDetails.applicationOverview.appliedFor"),
        value: getCommonAppliedFor(item, language),
      },
      {
        label: t("Customer.ticketsDetails.applicationOverview.submissionTime"),
        value: formatDateTime(getCommonSubmissionTime(item)),
      },
    ],
  };
};

const buildEnquirySection = ({
  item,
  language,
  t,
}: {
  item: IRelateEnquiryServiceItem;
  language: string;
  t: TFunction;
}): RelatedSectionCardProps => {
  const statusLabel = getDisplayValue(
    getLocalizedValue(language, item.enquiryStatusObj, ""),
  );

  return {
    variant: "relatedEnquiry",
    title: t("Customer.ticketsDetails.applicationOverview.TicketsEnquiry"),
    referenceNo: getDisplayValue(item.enquiryNumber),
    enquiryId:
      typeof item.enquiryId === "number" && Number.isFinite(item.enquiryId)
        ? item.enquiryId
        : null,
    sortTime: item.createdOn,
    statusLabel,
    statusValue: item.enquiryStatusId,
    statusType: "enquiryStatus",
    statusTone: getStatusTone(item.enquiryStatusId, statusLabel),
    fields: [
      {
        label: t(
          "Customer.ticketsDetails.applicationOverview.ProblemDescription",
        ),
        value: getDisplayValue(item.description),
      },
      {
        label: t("Customer.ticketsDetails.applicationOverview.submissionTime"),
        value: formatDateTime(item.createdOn),
      },
    ],
  };
};

const buildRefundSection = ({
  item,
  language,
  t,
}: {
  item: IRelateRefundItem;
  language: string;
  t: TFunction;
}): RelatedSectionCardProps =>
  buildCommonApplicationStyleSection({
    item: item as RelatedRecord,
    language,
    t,
    variant: "relatedRefund",
    title: t(
      "Customer.ticketsDetails.applicationOverview.relatedRefund",
      { defaultValue: "Related Refund" },
    ),
    referenceNo: getCommonReferenceNo(item as RelatedRecord),
  });

const buildAppealSection = ({
  item,
  language,
  t,
}: {
  item: IRelateAppealItem;
  language: string;
  t: TFunction;
}): RelatedSectionCardProps => {
  const referenceNo = getCommonReferenceNo(item as RelatedRecord);
  const resolvedAppealId =
    typeof item.id === "number" && Number.isFinite(item.id)
      ? item.id
      : referenceNo !== "-"
        ? referenceNo
        : null;

  return {
    ...buildCommonApplicationStyleSection({
      item: item as RelatedRecord,
      language,
      t,
      variant: "relatedAppeal",
      title: t(
        "Customer.ticketsDetails.applicationOverview.relatedAppeal",
        { defaultValue: "Related Appeal" },
      ),
      referenceNo,
    }),
    appealId: resolvedAppealId,
  };
};

export const buildRelatedSectionsFromData = ({
  data,
  language,
  t,
}: {
  data?: IRelateAppsResponse | null;
  language: string;
  t: TFunction;
}) => {
  if (!data) {
    return [];
  }

  const applicationSections = toArray(data.applications).map((item) =>
    buildApplicationSection({ item, language, t }),
  );
  const enquirySections = toArray(data.enquiryServices).map((item) =>
    buildEnquirySection({ item, language, t }),
  );
  const refundSections = toArray(data.refunds).map((item) =>
    buildRefundSection({ item, language, t }),
  );
  const appealSections = toArray(data.appeals).map((item) =>
    buildAppealSection({ item, language, t }),
  );

  return [
    ...applicationSections,
    ...enquirySections,
    ...refundSections,
    ...appealSections,
  ];
};

export const buildLatestRelatedSectionsByStatisticKey = ({
  data,
  language,
  t,
  shouldFilterHistoricalApplications = false,
  currentApplicationNumber,
  currentEnquiryNumber,
  currentServiceId,
}: {
  data?: IRelateAppsResponse | null;
  language: string;
  t: TFunction;
  shouldFilterHistoricalApplications?: boolean;
  currentApplicationNumber?: string | null;
  currentEnquiryNumber?: string | null;
  currentServiceId?: string | number | null;
}): Partial<Record<RelatedSectionStatisticKey, RelatedSectionCardProps | null>> => {
  if (!data) {
    return {};
  }

  const normalizedCurrentApplicationNumber = normalizeTextValue(
    currentApplicationNumber,
  );
  const normalizedCurrentEnquiryNumber = normalizeTextValue(
    currentEnquiryNumber,
  );
  const normalizedCurrentServiceId = normalizeServiceId(currentServiceId);

  const latestApplication = getLatestItem(
    toArray(data.applications),
    (item) => item.submissionTime || item.createdOn || item.taskCreatedTime,
    (item) => {
      if (
        !shouldFilterHistoricalApplications ||
        normalizedCurrentServiceId === null
      ) {
        return true;
      }

      const normalizedReferenceNo = normalizeTextValue(
        item.applicationNumber || item.applicationNo || item.number,
      );
      const isSameApplication =
        normalizedCurrentApplicationNumber &&
        normalizedReferenceNo === normalizedCurrentApplicationNumber;
      const isSameService =
        normalizeServiceId(item.serviceId) === normalizedCurrentServiceId;

      return isSameService && !isSameApplication;
    },
  );
  const latestEnquiry = getLatestItem(
    toArray(data.enquiryServices),
    (item) => item.createdOn,
    (item) => {
      if (!normalizedCurrentEnquiryNumber) {
        return true;
      }

      return (
        normalizeTextValue(item.enquiryNumber) !== normalizedCurrentEnquiryNumber
      );
    },
  );
  const latestRefund = getLatestItem(
    toArray(data.refunds),
    (item) => getCommonSubmissionTime(item as RelatedRecord),
  );
  const latestAppeal = getLatestItem(
    toArray(data.appeals),
    (item) => getCommonSubmissionTime(item as RelatedRecord),
  );

  return {
    historicalApplications: latestApplication
      ? buildApplicationSection({ item: latestApplication, language, t })
      : null,
    historicalTicketsEnquiry: latestEnquiry
      ? buildEnquirySection({ item: latestEnquiry, language, t })
      : null,
    refund: latestRefund
      ? buildRefundSection({ item: latestRefund, language, t })
      : null,
    appeal: latestAppeal
      ? buildAppealSection({ item: latestAppeal, language, t })
      : null,
  };
};
