/* eslint-disable @typescript-eslint/no-explicit-any */
import moment from "moment";
import {
  createContactNumberSnapshot,
  DEFAULT_COUNTRY_DIAL_CODE,
  toContactFormValue,
  type ContactNumberSnapshot,
} from "@/components/common/MobileNumberInput";
import {
  type InspectionEstablishmentSearchItem,
  type InspectionIndividualSearchItem,
  type InspectionTaskAttachmentPayload,
  type InspectionTaskValidationData,
  type InspectionTargetSearchOption,
} from "@/services/inspection";
import { getInspectionMethodFromLookupInspection } from "@/pages/InspectionTaskManagement/components/createTaskInspectionMethod";
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig";
import type {
  InspectionTaskMobileFormValue,
  InspectionTaskModalRecord as TaskRecord,
} from "../type";
import { toNumberOrUndefined } from "./lookup";
import { sanitizeInspectionMobileValue } from "@/utils/inspectionMobileValidation";

export const inspectionTaskMobileFieldNames = {
  countryCode: "mobileCountryCode",
  phoneNumber: "mobileLocalNumber",
};

export const createInspectionTaskMobileFormValue = ({
  countryCode,
  localNumber,
  fullNumber,
}: {
  countryCode?: unknown;
  localNumber?: unknown;
  fullNumber?: unknown;
}): InspectionTaskMobileFormValue => {
  const initialSnapshot = createContactNumberSnapshot({
    countryCode,
    localNumber,
    fullNumber,
  });

  return {
    ...toContactFormValue(initialSnapshot, inspectionTaskMobileFieldNames),
    initialSnapshot,
  } as InspectionTaskMobileFormValue;
};

export const createEmptyInspectionTaskMobileFormValue = () =>
  createInspectionTaskMobileFormValue({
    countryCode: DEFAULT_COUNTRY_DIAL_CODE,
    localNumber: "",
    fullNumber: "",
  });

export const getInspectionTaskMobileSnapshot = (
  value?: Partial<InspectionTaskMobileFormValue> | null,
): ContactNumberSnapshot =>
  value?.initialSnapshot ||
  createContactNumberSnapshot({
    countryCode: value?.mobileCountryCode,
    localNumber: value?.mobileLocalNumber,
  });

export const normalizeInspectionMethodValue = (source?: Record<string, any>) => {
  const methodText = String(
    source?.inspectionTypeNameEn ||
      source?.inspectionTypeName ||
      source?.inspectionMethod ||
      source?.inspectionTypeCode ||
      "",
  )
    .trim()
    .toLowerCase();
  if (methodText.includes("digital")) return "Digital Inspection";
  if (methodText.includes("field")) return "Field Inspection";

  const methodId = Number(source?.inspectionTypeId ?? source?.inspectionMethodId);
  if (methodId === 2) return "Digital Inspection";
  if (methodId === 1) return "Field Inspection";

  if (source?.isDigitalVisit === true) return "Digital Inspection";
  if (source?.isDigitalVisit === false) return "Field Inspection";
  return undefined;
};

export const normalizeTaskAttachments = (
  attachments: unknown,
): InspectionTaskAttachmentPayload[] => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .map((item) => {
      const attachment = item as Partial<InspectionTaskAttachmentPayload>;
      return {
        fileName: String(attachment.fileName || "").trim(),
        fileUrl: String(attachment.fileUrl || "").trim(),
        contentType: attachment.contentType,
        attachmentCategory: attachment.attachmentCategory || "TaskAttachment",
      };
    })
    .filter((item) => item.fileName && item.fileUrl);
};

export const getClearedTargetValues = (
  targetType: TargetType,
  overrides: Record<string, any> = {},
) => ({
  targetSearch: undefined,
  establishmentId: undefined,
  individualId: undefined,
  userProfileId: undefined,
  hasRegisteredProfile: undefined,
  establishmentSubTypeId: undefined,
  emirateId: undefined,
  authorityId: undefined,
  regionId: undefined,
  communityId: undefined,
  areaId: undefined,
  establishmentSubType: undefined,
  emirateNameEn: undefined,
  authorityNameEn: undefined,
  tradeLicenseNumber: undefined,
  establishmentNameEn: undefined,
  region: undefined,
  area: undefined,
  street: undefined,
  eid: undefined,
  fullName: undefined,
  email: undefined,
  mobileNumber: createEmptyInspectionTaskMobileFormValue(),
  mediaLicenseNumber: undefined,
  socialMediaAccountUsername: undefined,
  activityNameEn: undefined,
  activityIds: undefined,
  latitude: undefined,
  longitude: undefined,
  mapLocationUrl: undefined,
  ...(targetType === "establishment"
    ? {}
    : {
        establishmentSubType: undefined,
        tradeLicenseNumber: undefined,
        establishmentNameEn: undefined,
        region: undefined,
        area: undefined,
        street: undefined,
      }),
  ...overrides,
});

export const getEstablishmentDisplayName = (
  item: InspectionEstablishmentSearchItem,
) =>
  String(
    item.establishmentName ||
      item.nameEn ||
      item.nameAr ||
      item.licenseNumber ||
      item.tradeLicenseNumber ||
      "",
  ).trim();

const getEstablishmentNameValue = (item: InspectionEstablishmentSearchItem) =>
  String(item.establishmentName || item.nameEn || item.nameAr || "").trim();

const getEstablishmentEmirateName = (item: InspectionEstablishmentSearchItem) =>
  String(item.emirateName || item.emirateNameEn || "").trim();

const getIndividualDisplayName = (item: InspectionIndividualSearchItem) =>
  String(item.fullName || item.name || item.email || item.emiratesId || "").trim();

const getActivityNames = (value?: unknown) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)];
};

export const mapEstablishmentToTargetOption = (
  item: InspectionEstablishmentSearchItem,
): InspectionTargetSearchOption => {
  const title = getEstablishmentDisplayName(item);
  const establishmentName = getEstablishmentNameValue(item);
  const emirateName = getEstablishmentEmirateName(item);
  const licenseNumber = item.tradeLicenseNumber || item.licenseNumber || "";
  const areaName = item.area || item.areaName || "";
  const activityNames = getActivityNames(item.activityNameEn || item.activityName);
  const inspectionMethod = getInspectionMethodFromLookupInspection(item.inspection);

  return {
    value: `establishment-${item.id}`,
    title,
    subtitle: [emirateName, licenseNumber, areaName].filter(Boolean).join(" | "),
    targetType: "establishment",
    raw: item,
    payload: {
      establishmentId: item.id,
      userProfileId: item.userProfileId,
      hasRegisteredProfile: item.hasRegisteredProfile,
      establishmentSubTypeId: item.establishmentSubTypeId,
      establishmentSubType: item.establishmentSubType,
      emirateId: item.emirateId,
      emirateNameEn: emirateName,
      authorityId: item.authorityId,
      authorityNameEn: item.authorityName || item.authorityNameEn,
      regionId: item.regionId,
      region: item.regionName || item.regionNameEn,
      areaId: item.areaId,
      area: areaName,
      street: item.street,
      tradeLicenseNumber: licenseNumber,
      establishmentNameEn: establishmentName,
      email: item.email || item.emails,
      mobileNumber: sanitizeInspectionMobileValue(item.mobile || item.phoneNumber),
      activityNameEn: activityNames,
      inspectionMethod,
      latitude: item.latitude,
      longitude: item.longitude,
      mapLocationUrl: item.mapLocationUrl,
    },
  };
};

export const mapIndividualToTargetOption = (
  item: InspectionIndividualSearchItem,
): InspectionTargetSearchOption => {
  const title = getIndividualDisplayName(item);
  const email = item.email || item.personalEmail || "";
  const mobileNumber = createInspectionTaskMobileFormValue({
    countryCode: item.mobileCountryCode,
    localNumber: item.mobileLocalNumber,
    fullNumber: item.mobileNumber || item.personalMobile,
  });

  return {
    value: `individual-${item.id}`,
    title,
    subtitle: [
      email,
      item.emiratesId,
      item.socialMediaAccountUsername,
      item.mediaLicenseNumber,
    ]
      .filter(Boolean)
      .join(" | "),
    targetType: "individual",
    raw: item,
    payload: {
      individualId: item.userProfileId,
      userProfileId: item.userProfileId,
      userId: item.userId,
      hasRegisteredProfile: item.hasRegisteredProfile,
      eid: item.emiratesId,
      fullName: item.fullName || item.name,
      email,
      mobileNumber,
      mediaLicenseNumber: item.mediaLicenseNumber,
      socialMediaAccountUsername: item.socialMediaAccountUsername,
      authorityId: item.authorityId,
    },
  };
};

export const mapTaskDetailToTargetOption = (
  detailTask: TaskRecord,
  values: Record<string, any>,
  targetType: TargetType,
): InspectionTargetSearchOption => {
  const target = detailTask?.inspectionTarget || {};

  if (targetType === "establishment") {
    const title = String(
      values.establishmentNameEn || values.targetSearch || detailTask?.taskNo || "",
    ).trim();
    const valueKey = String(
      values.establishmentId ||
        values.userProfileId ||
        detailTask?.taskId ||
        title ||
        "edit",
    ).trim();
    const payload = {
      establishmentId: values.establishmentId,
      userProfileId: values.userProfileId,
      hasRegisteredProfile: values.hasRegisteredProfile,
      establishmentSubTypeId: values.establishmentSubTypeId,
      establishmentSubType: values.establishmentSubType,
      emirateId: values.emirateId,
      emirateNameEn: values.emirateNameEn,
      authorityId: values.authorityId,
      authorityNameEn: values.authorityNameEn,
      regionId: values.regionId,
      region: values.region,
      communityId: values.communityId,
      areaId: values.areaId,
      area: values.area,
      street: values.street,
      tradeLicenseNumber: values.tradeLicenseNumber,
      establishmentNameEn: values.establishmentNameEn,
      email: values.email,
      mobileNumber: sanitizeInspectionMobileValue(target.mobile),
      activityNameEn: values.activityNameEn,
      inspectionMethod: values.inspectionMethod,
      latitude: values.latitude,
      longitude: values.longitude,
      mapLocationUrl: values.mapLocationUrl,
    };

    return {
      value: `establishment-${valueKey}`,
      title,
      subtitle: [values.emirateNameEn, values.tradeLicenseNumber, values.area]
        .filter(Boolean)
        .join(" | "),
      targetType,
      raw: {
        id:
          toNumberOrUndefined(values.establishmentId) ||
          toNumberOrUndefined(values.userProfileId) ||
          toNumberOrUndefined(detailTask?.taskId) ||
          0,
        establishmentName: values.establishmentNameEn,
        establishmentSubTypeId: values.establishmentSubTypeId,
        establishmentSubType: values.establishmentSubType,
        emirateId: values.emirateId,
        emirateName: values.emirateNameEn,
        tradeLicenseNumber: values.tradeLicenseNumber,
        licenseNumber: values.tradeLicenseNumber,
        email: values.email,
        phoneNumber: sanitizeInspectionMobileValue(target.mobile),
        authorityId: values.authorityId,
        authorityName: values.authorityNameEn,
        regionId: values.regionId,
        regionName: values.region,
        areaId: values.areaId,
        area: values.area,
        street: values.street,
        latitude: values.latitude,
        longitude: values.longitude,
        mapLocationUrl: values.mapLocationUrl,
        activityNameEn: values.activityNameEn,
      },
      payload,
    };
  }

  const title = String(
    values.fullName || values.targetSearch || detailTask?.taskNo || "",
  ).trim();
  const valueKey = String(
    values.individualId || values.userProfileId || detailTask?.taskId || title || "edit",
  ).trim();
  const payload = {
    individualId: values.individualId,
    userProfileId: values.userProfileId,
    userId: values.userId,
    hasRegisteredProfile: values.hasRegisteredProfile,
    eid: values.eid,
    fullName: values.fullName,
    email: values.email,
    mobileNumber: values.mobileNumber,
    mediaLicenseNumber: values.mediaLicenseNumber,
    socialMediaAccountUsername: values.socialMediaAccountUsername,
    authorityId: values.authorityId,
    inspectionMethod: values.inspectionMethod,
    activityNameEn: values.activityNameEn,
  };

  return {
    value: `individual-${valueKey}`,
    title,
    subtitle: [
      values.email,
      values.eid,
      values.socialMediaAccountUsername,
      values.mediaLicenseNumber,
    ]
      .filter(Boolean)
      .join(" | "),
    targetType,
    raw: {
      id:
        toNumberOrUndefined(values.individualId) ||
        toNumberOrUndefined(values.userProfileId) ||
        toNumberOrUndefined(detailTask?.taskId) ||
        0,
      userProfileId: toNumberOrUndefined(values.userProfileId) || null,
      userId: values.userId,
      hasRegisteredProfile: values.hasRegisteredProfile,
      fullName: values.fullName,
      emiratesId: values.eid,
      email: values.email,
      mobileNumber: values.mobileNumber?.initialSnapshot?.originalFullNumber,
      mobileCountryCode: values.mobileNumber?.mobileCountryCode,
      mobileLocalNumber: values.mobileNumber?.mobileLocalNumber,
      socialMediaAccountUsername: values.socialMediaAccountUsername,
      mediaLicenseNumber: values.mediaLicenseNumber,
      authorityId: values.authorityId,
    },
    payload,
  };
};

export const hasValidationWarnings = (
  validationData?: InspectionTaskValidationData | null,
) => Boolean(validationData?.warnings?.length || validationData?.recentTasks?.length);

export const getDuplicateDueDateMoment = (value?: unknown) => {
  const sourceDate = moment(String(value || ""));
  const baseDate = sourceDate.isValid() ? sourceDate : moment();
  return baseDate.clone().add(14, "days");
};

export const mergeSelectedTargetOption = (
  options: InspectionTargetSearchOption[],
  selectedTarget?: InspectionTargetSearchOption | null,
) => {
  if (!selectedTarget) return options;
  if (options.some((option) => option.value === selectedTarget.value)) return options;
  return [selectedTarget, ...options];
};

export const getSelectedTargetOptions = (
  selectedTarget: InspectionTargetSearchOption | null | undefined,
  targetType: TargetType,
) => (selectedTarget?.targetType === targetType ? [selectedTarget] : []);
