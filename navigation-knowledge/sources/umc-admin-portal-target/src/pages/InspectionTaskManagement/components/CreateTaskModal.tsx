import { toApi, nowGst } from "@/utils/gstTime";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import debounce from 'lodash/debounce';
import { Button, DatePicker, Form, Input, Modal, Progress, Radio, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CustomMessage, SelectAllDropdown } from '@/components/common';
import SimpleBar from '@/components/SimpleBar';
import {
  createMobileNumberFormRule,
  DEFAULT_COUNTRY_DIAL_CODE,
  FormMobileNumberInput,
} from '@/components/common/MobileNumberInput';
import {
  buildContactNumberFields,
  createContactNumberSnapshot,
  readContactFormValue,
  toContactFormValue,
} from '@/components/common/MobileNumberInput';
import { sanitizeInspectionMobileValue } from '@/utils/inspectionMobileValidation';
import {
  createInspectionTask,
  createInspectionTasksBatchByActivity,
  previewInspectionTasksBatchByActivity,
  getInspectionCampaignFilterOptions,
  getInspectionTaskBatchByActivityProgress,
  getAdminInspectionTaskDetail,
  getInspectionEconomicActivities,
  getInspectionAuthoritiesByEmirateFresh,
  getInspectionCommunitiesByRegionFresh,
  getInspectionEmiratesFresh,
  getInspectionEstablishmentByTradeLicense,
  getInspectionEstablishmentSubTypesFresh,
  getInspectionPrioritiesFresh,
  getInspectionReasonsFresh,
  getInspectionRegionsByEmirateFresh,
  searchInspectionEstablishments,
  searchInspectionIndividuals,
  type InspectionTaskAttachmentPayload,
  type InspectionEstablishmentSearchItem,
  type InspectionGeoLookupOption,
  type InspectionIndividualSearchItem,
  type InspectionPriorityLookupOption,
  type InspectionReasonLookupOption,
  type InspectionTaskValidationData,
  type InspectionTargetSearchOption,
  validateInspectionTask,
  updateInspectionTask,
  type InspectionEconomicActivityOption,
  type InspectionTaskBatchByActivityPayload,
  type InspectionTaskBatchByActivityProgressData,
  type InspectionCampaignFilterOptionsData,
} from '@/services/inspection';
import {
  buildInspectionCampaignRegionIds,
  buildInspectionCampaignLocationPayload,
  isInspectionCampaignSelectionValid,
  pruneInspectionAreaSelection,
  requiresInspectionRegion,
} from '../../InspectionCommon/inspectionAreaSelection';
import { inspectionFigmaAssets } from '../../InspectionCommon/assets';
import InspectorSelect from './InspectorSelect';
import TaskAttachmentUpload from './TaskAttachmentUpload';
import { normalizeInspectorIds } from './inspectorSelectUtils';
import DuplicateTaskWarningModal from './DuplicateTaskWarningModal';
import { getCampaignPreviewDecision } from '../../InspectionCommon/inspectionCampaignPreview';
import { getInspectionMethodFromLookupInspection } from './createTaskInspectionMethod';
import {
  areaOptions as fallbackAreaOptions,
  emirateOptions as fallbackEmirateOptions,
  establishmentSubtypeOptions as fallbackEstablishmentSubtypeOptions,
  getAuthorityOptions as getFallbackAuthorityOptions,
  getInspectionTaskAreaLabel,
  getInspectionTaskAuthorityLabel,
  getInspectionTaskEmirateLabel,
  getInspectionTaskEstablishmentSubtypeLabel,
  getInspectionTaskInspectionMethodLabel,
  getEmirateId,
  inspectionMethodOptions as fallbackInspectionMethodOptions,
  inspectorOptions,
  isEstablishmentSubtypeWithoutLicenseId,
  type TargetType,
} from '../taskConfig';

type TaskRecord = Record<string, any>;
export type TaskModalMode = 'create' | 'edit';

type TaskModalMeta = {
  inspectionReasonCode: string;
  targetType: TargetType;
  manualTarget: boolean;
  targetSearch: string;
  selectedTarget?: InspectionTargetSearchOption | null;
  autoMatchedTarget?: InspectionTargetSearchOption | null;
};

type DuplicateTaskWarningState = {
  visible: boolean;
  campaignCount?: number;
  message: string;
  loading: boolean;
  onConfirm?: () => void | Promise<void>;
};

type CampaignActivitySelectOption = {
  value: number | string;
  label: string;
};

type CampaignGeoSelectOption = {
  value: number;
  label: string;
};

const EMPTY_CAMPAIGN_FILTER_OPTIONS: InspectionCampaignFilterOptionsData = {
  emirates: [],
  regions: [],
  areas: [],
  activities: [],
  totalEstablishments: 0,
  alreadyHasOpenTaskCount: 0,
};

type CreateTaskModalProps = {
  visible: boolean;
  mode: TaskModalMode;
  editingTask?: TaskRecord | null;
  isInspectorSelfCreate: boolean;
  currentInspectorId: string;
  getAuthorityName: (record?: TaskRecord) => string;
  onVisibleChange: (visible: boolean) => void;
  onSubmitted: () => void | Promise<void>;
};

const createEmptyTaskModalMeta = (): TaskModalMeta => ({
  inspectionReasonCode: '',
  targetType: 'establishment',
  manualTarget: false,
  targetSearch: '',
  selectedTarget: null,
  autoMatchedTarget: null,
});
const createClosedDuplicateTaskWarningState = (): DuplicateTaskWarningState => ({
  visible: false,
  message: '',
  loading: false,
  onConfirm: undefined,
});
const getSelectPopupContainer = () => document.body;
const renderSelectOptionText = (label: string) => (
  <span className="inspection-task-management__select-option-text" title={label}>
    {label}
  </span>
);

type StaticSelectOption = {
  value: string;
  label: string;
};

const ARABIC_LETTER_REGEX = /^(?:[\u0621-\u063A\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5]|(?=\p{Script_Extensions=Arabic})[\p{L}\p{M}])$/u;
const mobileFieldNames = {
  countryCode: 'mobileCountryCode',
  phoneNumber: 'mobileLocalNumber',
} as const;

const createEmptyMobileSnapshot = () => createContactNumberSnapshot({
  countryCode: DEFAULT_COUNTRY_DIAL_CODE,
  localNumber: '',
  fullNumber: '',
});
const toOptionalMobileFormValue = (
  snapshot: ReturnType<typeof createContactNumberSnapshot>,
) => snapshot.sourceMode === 'empty'
  ? undefined
  : toContactFormValue(snapshot, mobileFieldNames);

const isArabicEnglishFullNameCharacter = (character: string) => (
  /[A-Za-z\s]/.test(character) || ARABIC_LETTER_REGEX.test(character)
);

const normalizeArabicEnglishFullName = (value: unknown) => (
  Array.from(String(value ?? '')).filter(isArabicEnglishFullNameCharacter).join('')
);

const normalizeInspectionMethodValue = (source?: Record<string, any>) => {
  const methodText = String(
    source?.inspectionTypeNameEn ||
    source?.inspectionTypeName ||
    source?.inspectionMethod ||
    source?.inspectionTypeCode ||
    '',
  ).trim().toLowerCase();
  if (methodText.includes('digital')) return 'Digital Inspection';
  if (methodText.includes('field')) return 'Field Inspection';

  const methodId = Number(source?.inspectionTypeId ?? source?.inspectionMethodId);
  if (methodId === 2) return 'Digital Inspection';
  if (methodId === 1) return 'Field Inspection';

  if (source?.isDigitalVisit === true) return 'Digital Inspection';
  if (source?.isDigitalVisit === false) return 'Field Inspection';
  return undefined;
};

const getInspectorIdValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(record.inspectorId || record.id || record.userId || '').trim();
};

const getAssignedInspectorIds = (assignment?: Record<string, any> | null) => {
  const assignedInspectors = assignment?.assignedInspectors;
  if (Array.isArray(assignedInspectors)) {
    const inspectorIds = assignedInspectors
      .map(getInspectorIdValue)
      .filter(Boolean);
    if (inspectorIds.length) return inspectorIds;
  }

  return normalizeInspectorIds(getInspectorIdValue(assignedInspectors) || getInspectorIdValue(assignment?.assignedInspector));
};

type TaskRemarksTextAreaProps = {
  value?: string;
  onChange?: (event: any) => void;
  placeholder?: string;
};

const TaskRemarksTextArea: React.FC<TaskRemarksTextAreaProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const { t } = useTranslation();
  const hasValue = Boolean(value);

  const handleClear = useCallback(() => {
    onChange?.('');
  }, [onChange]);

  return (
    <div className="inspection-task-management__remarks-textarea-control">
      <Input.TextArea
        maxLength={1000}
        placeholder={placeholder}
        rows={4}
        showCount
        value={value}
        onChange={onChange}
      />
      {hasValue ? (
        <button
          type="button"
          aria-label={t("common.clearRemarks")}
          className="inspection-task-management__remarks-clear"
          onClick={handleClear}
          onMouseDown={(event) => event.preventDefault()}
        >
          <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

const renderAttachmentLabel = (label: string, helpText: string) => (
  <span className="inspection-task-management__attachment-label">
    <span>{label}</span>
    <Tooltip
      title={helpText}
      placement="top"
      overlayClassName="inspection-task-management__attachment-tooltip"
      getPopupContainer={() => document.body}
    >
      <span
        className="inspection-task-management__attachment-help"
        tabIndex={0}
        aria-label={helpText}
      >
        <img src={inspectionFigmaAssets.createTask.helpIcon} alt="" aria-hidden="true" />
      </span>
    </Tooltip>
  </span>
);
const normalizeTaskAttachments = (attachments: unknown): InspectionTaskAttachmentPayload[] => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .map((item) => {
      const attachment = item as Partial<InspectionTaskAttachmentPayload>;
      return {
        fileName: String(attachment.fileName || '').trim(),
        fileUrl: String(attachment.fileUrl || '').trim(),
        contentType: attachment.contentType,
        attachmentCategory: attachment.attachmentCategory || 'TaskAttachment',
      };
    })
    .filter((item) => item.fileName && item.fileUrl);
};

const getClearedTargetValues = (targetType: TargetType, overrides: Record<string, any> = {}) => ({
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
  mobileNumber: undefined,
  mediaLicenseNumber: undefined,
  socialMediaAccountUsername: undefined,
  activityNameEn: undefined,
  activityIds: undefined,
  emirateIds: undefined,
  regionIds: undefined,
  areaIds: undefined,
  latitude: undefined,
  longitude: undefined,
  mapLocationUrl: undefined,
  ...(targetType === 'establishment' ? {} : {
    establishmentSubType: undefined,
    tradeLicenseNumber: undefined,
    establishmentNameEn: undefined,
    region: undefined,
    area: undefined,
    street: undefined,
  }),
  ...overrides,
});

const normalizeLookupText = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeLookupKey = (value: unknown) => normalizeLookupText(value).replace(/[^\p{L}\p{N}]+/gu, '');
const campaignInspectionReasonCodes = ['Campaign', '13'];
const campaignInspectionReasonNameKey = 'inspectioncampaign';
const criticalContentViolationReasonKey = 'criticalcontentviolation';

const getLookupLabel = (option?: InspectionGeoLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();

const getReasonLabel = (option?: InspectionReasonLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();

const getPriorityLabel = (option?: InspectionPriorityLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();

const getPriorityValue = (option?: InspectionPriorityLookupOption | null) =>
  String(option?.code || '').trim();

const getReasonSearchText = (option: InspectionReasonLookupOption) =>
  [option.nameEn, option.nameAr, option.name, option.code, option.id]
    .map((item) => normalizeLookupText(item))
    .filter(Boolean)
    .join(' ');

const findReasonOption = (options: InspectionReasonLookupOption[], value?: unknown) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.id, item.code, item.nameEn, item.nameAr, item.name].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

const findPriorityOption = (options: InspectionPriorityLookupOption[], value?: unknown) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.code, item.id, item.nameEn, item.nameAr, item.name].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

const isCampaignReasonOption = (option?: InspectionReasonLookupOption | null) => {
  if (!option) return false;
  const semanticCodeMatch = campaignInspectionReasonCodes.some(
    (code) => normalizeLookupKey(option.code) === normalizeLookupKey(code),
  );
  const nameMatch = [option.nameEn, option.nameAr, option.name].some(
    (candidate) => normalizeLookupKey(candidate) === campaignInspectionReasonNameKey,
  );
  return semanticCodeMatch || nameMatch;
};

const isCampaignReasonValue = (
  options: InspectionReasonLookupOption[],
  value?: unknown,
) => isCampaignReasonOption(findReasonOption(options, value))
  || campaignInspectionReasonCodes.some(
    (code) => normalizeLookupKey(value) === normalizeLookupKey(code),
  );

const toNumberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const toNumberArray = (value: unknown) => (
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
)
  .map(toNumberOrUndefined)
  .filter((item): item is number => item !== undefined);

const getEconomicActivityLabel = (activity: InspectionEconomicActivityOption) =>
  String(activity.nameEn || activity.nameAr || activity.code || activity.id || '').trim();

const flattenEconomicActivityOptions = (
  activities: InspectionEconomicActivityOption[],
) => {
  const optionMap = new Map<string, CampaignActivitySelectOption>();
  const appendActivity = (activity: InspectionEconomicActivityOption) => {
    const value = activity.id;
    const optionKey = String(value ?? '').trim();
    const label = getEconomicActivityLabel(activity);
    if (optionKey && label) {
      optionMap.set(optionKey, {
        value,
        label,
      });
    }
    const children = Array.isArray(activity.childData) ? activity.childData : [];
    children.forEach(appendActivity);
  };

  activities.forEach((activity) => appendActivity(activity));
  return Array.from(optionMap.values());
};

const findLookupOptionByLabel = (options: InspectionGeoLookupOption[], label?: unknown) => {
  const normalized = normalizeLookupKey(label);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.id, item.nameEn, item.nameAr, item.name, item.code].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

const findLookupOptionById = (options: InspectionGeoLookupOption[], id?: unknown) => {
  const value = toNumberOrUndefined(id);
  if (value === undefined) return undefined;
  return options.find((item) => toNumberOrUndefined(item.id) === value);
};

const mapLookupOptionsToNumberOptions = (
  options: InspectionGeoLookupOption[],
) => options
  .map((item) => {
    const value = toNumberOrUndefined(item.id);
    const label = getLookupLabel(item);
    return value !== undefined && label ? { value, label } : null;
  })
  .filter((item): item is CampaignGeoSelectOption => Boolean(item));

const getEstablishmentDisplayName = (item: InspectionEstablishmentSearchItem) =>
  String(item.establishmentName || item.nameEn || item.nameAr || item.licenseNumber || item.tradeLicenseNumber || '').trim();

const getEstablishmentNameValue = (item: InspectionEstablishmentSearchItem) =>
  String(item.establishmentName || item.nameEn || item.nameAr || '').trim();

const getEstablishmentEmirateName = (item: InspectionEstablishmentSearchItem) =>
  String(item.emirateName || item.emirateNameEn || '').trim();

const normalizeIndividualIdNumberValue = (value: unknown) => String(value ?? '').trim();

const getIndividualIdNumberCandidates = (
  item?: Partial<InspectionIndividualSearchItem> & { uaeNumber?: string },
) => [
  item?.emiratesId,
  item?.uid,
  item?.uaeNumber,
  item?.passportNumber,
]
  .map(normalizeIndividualIdNumberValue)
  .filter(Boolean);

const getIndividualIdNumber = (
  item?: Partial<InspectionIndividualSearchItem> & { uaeNumber?: string },
) => getIndividualIdNumberCandidates(item)[0] || '';

const hasMatchingIndividualIdNumber = (
  item: InspectionIndividualSearchItem,
  idNumber: string,
) => {
  const normalizedIdNumber = normalizeLookupKey(idNumber);
  return Boolean(normalizedIdNumber) && getIndividualIdNumberCandidates(item).some(
    (candidate) => normalizeLookupKey(candidate) === normalizedIdNumber,
  );
};

const getIndividualDisplayName = (item: InspectionIndividualSearchItem) =>
  String(item.fullName || item.name || item.email || getIndividualIdNumber(item) || '').trim();

const getActivityNames = (value?: unknown) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)];
};

const hasTargetPayloadValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

const mapEstablishmentToTargetOption = (item: InspectionEstablishmentSearchItem): InspectionTargetSearchOption => {
  const title = getEstablishmentDisplayName(item);
  const establishmentName = getEstablishmentNameValue(item);
  const emirateName = getEstablishmentEmirateName(item);
  const licenseNumber = item.tradeLicenseNumber || item.licenseNumber || '';
  const areaName = item.area || item.areaName || '';
  const activityNames = getActivityNames(item.activityNameEn || item.activityName);
  const inspectionMethod = getInspectionMethodFromLookupInspection(item.inspection);
  return {
    value: `establishment-${item.id}`,
    title,
    subtitle: [emirateName, licenseNumber, areaName].filter(Boolean).join(' | '),
    targetType: 'establishment',
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

const mapIndividualToTargetOption = (item: InspectionIndividualSearchItem): InspectionTargetSearchOption => {
  const title = getIndividualDisplayName(item);
  const email = item.email || item.personalEmail || '';
  const mobileSnapshot = createContactNumberSnapshot({
    countryCode: item.mobileCountryCode,
    localNumber: item.mobileLocalNumber,
    fullNumber: item.mobileNumber || item.personalMobile,
  });
  const idNumber = getIndividualIdNumber(item);

  return {
    value: `individual-${item.id}`,
    title,
    subtitle: [email, idNumber, item.socialMediaAccountUsername, item.mediaLicenseNumber].filter(Boolean).join(' | '),
    targetType: 'individual',
    raw: item,
    payload: {
      individualId: item.userProfileId,
      userProfileId: item.userProfileId,
      userId: item.userId,
      hasRegisteredProfile: item.hasRegisteredProfile,
      eid: idNumber,
      fullName: item.fullName || item.name,
      email,
      mobileNumber: toOptionalMobileFormValue(mobileSnapshot),
      mobileSnapshot,
      mediaLicenseNumber: item.mediaLicenseNumber,
      socialMediaAccountUsername: item.socialMediaAccountUsername,
      authorityId: item.authorityId,
    },
  };
};

const mapTaskDetailToTargetOption = (
  detailTask: TaskRecord,
  values: Record<string, any>,
  targetType: TargetType,
): InspectionTargetSearchOption => {
  const target = detailTask?.inspectionTarget || {};
  const mobileSnapshot = createContactNumberSnapshot({
    countryCode: target.mobileCountryCode,
    localNumber: target.mobileLocalNumber,
    fullNumber: target.mobile,
  });
  const mobileValue = mobileSnapshot.value;

  if (targetType === 'establishment') {
    const title = String(values.establishmentNameEn || values.targetSearch || detailTask?.taskNo || '').trim();
    const valueKey = String(values.establishmentId || values.userProfileId || detailTask?.taskId || title || 'edit').trim();
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
      subtitle: [values.emirateNameEn, values.tradeLicenseNumber, values.area].filter(Boolean).join(' | '),
      targetType,
      raw: {
        id: toNumberOrUndefined(values.establishmentId) || toNumberOrUndefined(values.userProfileId) || toNumberOrUndefined(detailTask?.taskId) || 0,
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

  const title = String(values.fullName || values.targetSearch || detailTask?.taskNo || '').trim();
  const valueKey = String(values.individualId || values.userProfileId || detailTask?.taskId || title || 'edit').trim();
  const payload = {
    individualId: values.individualId,
    userProfileId: values.userProfileId,
    userId: values.userId,
    hasRegisteredProfile: values.hasRegisteredProfile,
    eid: values.eid,
    fullName: values.fullName,
    email: values.email,
    mobileNumber: toOptionalMobileFormValue(mobileSnapshot),
    mobileSnapshot,
    mediaLicenseNumber: values.mediaLicenseNumber,
    socialMediaAccountUsername: values.socialMediaAccountUsername,
    authorityId: values.authorityId,
    inspectionMethod: values.inspectionMethod,
    activityNameEn: values.activityNameEn,
  };

  return {
    value: `individual-${valueKey}`,
    title,
    subtitle: [values.email, values.eid, values.socialMediaAccountUsername, values.mediaLicenseNumber].filter(Boolean).join(' | '),
    targetType,
    raw: {
      id: toNumberOrUndefined(values.individualId) || toNumberOrUndefined(values.userProfileId) || toNumberOrUndefined(detailTask?.taskId) || 0,
      userProfileId: toNumberOrUndefined(values.userProfileId) || null,
      userId: values.userId,
      hasRegisteredProfile: values.hasRegisteredProfile,
      fullName: values.fullName,
      emiratesId: values.eid,
      email: values.email,
      mobileNumber: target.mobile,
      mobileCountryCode: mobileValue.countryCode,
      mobileLocalNumber: mobileValue.phoneNumber,
      socialMediaAccountUsername: values.socialMediaAccountUsername,
      mediaLicenseNumber: values.mediaLicenseNumber,
      authorityId: values.authorityId,
    },
    payload,
  };
};

const hasValidationWarnings = (validationData?: InspectionTaskValidationData | null) =>
  Boolean(validationData?.warnings?.length || validationData?.recentTasks?.length);

const useSyncedVisible = (visible: boolean, onVisibleChange: (visible: boolean) => void) => useMemo(() => ({
  get value() {
    return visible;
  },
  set value(nextVisible: boolean) {
    onVisibleChange(nextVisible);
  },
}), [onVisibleChange, visible]);

const SearchOptionContent: React.FC<{ option: InspectionTargetSearchOption }> = ({ option }) => (
  <div className="inspection-task-management__search-option">
    <span className="inspection-task-management__search-option-icon">
      <img
        src={option.targetType === 'individual'
          ? inspectionFigmaAssets.taskTargetIcons.user
          : inspectionFigmaAssets.taskTargetIcons.company}
        alt=""
      />
    </span>
    <span className="inspection-task-management__search-option-content">
      <strong>{option.title}</strong>
      <small>{option.subtitle}</small>
    </span>
  </div>
);

const mergeSelectedTargetOption = (
  options: InspectionTargetSearchOption[],
  selectedTarget?: InspectionTargetSearchOption | null,
) => {
  if (!selectedTarget) return options;
  if (options.some((option) => option.value === selectedTarget.value)) return options;
  return [selectedTarget, ...options];
};

const getSelectedTargetOptions = (
  selectedTarget: InspectionTargetSearchOption | null | undefined,
  targetType: TargetType,
) => (selectedTarget?.targetType === targetType ? [selectedTarget] : []);

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  mode,
  editingTask,
  isInspectorSelfCreate,
  currentInspectorId,
  getAuthorityName,
  onVisibleChange,
  onSubmitted,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const campaignEmirateId = Form.useWatch('emirateId', form);
  const watchedCampaignEmirateIds = Form.useWatch('emirateIds', form);
  const watchedCampaignRegionIds = Form.useWatch('regionIds', form);
  const campaignEmirateIds = useMemo(
    () => watchedCampaignEmirateIds || [],
    [watchedCampaignEmirateIds],
  );
  const campaignRegionIds = useMemo(
    () => watchedCampaignRegionIds || [],
    [watchedCampaignRegionIds],
  );
  const selectedEstablishmentSubtypeId = Form.useWatch('establishmentSubTypeId', form);
  const [taskModalMeta, setTaskModalMeta] = useState<TaskModalMeta>(() => createEmptyTaskModalMeta());
  const [targetSearchOptions, setTargetSearchOptions] = useState<InspectionTargetSearchOption[]>([]);
  const [targetSearchLoading, setTargetSearchLoading] = useState(false);
  const [authorityLookupLoading, setAuthorityLookupLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskSubmitEnabled, setTaskSubmitEnabled] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<InspectionTaskAttachmentPayload[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [selectedEmirateName, setSelectedEmirateName] = useState<string | undefined>();
  const [, setSelectedEmirateId] = useState<number | undefined>();
  const [, setSelectedRegionId] = useState<number | undefined>();
  const [emirateLookupOptions, setEmirateLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [authorityLookupOptions, setAuthorityLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [regionLookupOptions, setRegionLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [communityLookupOptions, setCommunityLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [establishmentSubtypeLookupOptions, setEstablishmentSubtypeLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [reasonLookupOptions, setReasonLookupOptions] = useState<InspectionReasonLookupOption[]>([]);
  const [priorityLookupOptions, setPriorityLookupOptions] = useState<InspectionPriorityLookupOption[]>([]);
  const [campaignActivityOptions, setCampaignActivityOptions] = useState<CampaignActivitySelectOption[]>([]);
  const [campaignActivityLoading, setCampaignActivityLoading] = useState(false);
  const [campaignFilterOptions, setCampaignFilterOptions] = useState<InspectionCampaignFilterOptionsData>(EMPTY_CAMPAIGN_FILTER_OPTIONS);
  const [campaignFilterLoading, setCampaignFilterLoading] = useState(false);
  const [campaignBatchProgress, setCampaignBatchProgress] = useState<InspectionTaskBatchByActivityProgressData | null>(null);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [reasonSearchKeyword, setReasonSearchKeyword] = useState('');
  const [duplicateTaskWarning, setDuplicateTaskWarning] = useState<DuplicateTaskWarningState>(() => createClosedDuplicateTaskWarningState());
  const duplicateTaskWarningLoading = duplicateTaskWarning.loading;
  const duplicateTaskWarningConfirm = duplicateTaskWarning.onConfirm;
  const reasonSearchInputRef = useRef<HTMLInputElement>(null);
  const reasonLookupOptionsRef = useRef<InspectionReasonLookupOption[]>([]);
  const targetSearchRequestRef = useRef(0);
  const manualLookupRequestRef = useRef(0);
  const emirateRelatedLookupRequestRef = useRef(0);
  const campaignFilterRequestRef = useRef(0);
  const campaignFilterOptionsRef = useRef<InspectionCampaignFilterOptionsData>(EMPTY_CAMPAIGN_FILTER_OPTIONS);
  const taskSubmittingRef = useRef(false);
  const campaignConfirmationPendingRef = useRef(false);
  const duplicateConfirmationSubmittingRef = useRef(false);
  const selectedTargetRef = useRef<InspectionTargetSearchOption | null>(null);
  const targetMobileSnapshotRef = useRef(createEmptyMobileSnapshot());
  const syncedVisible = useSyncedVisible(visible, onVisibleChange);
  const inspectionReasonCode = taskModalMeta.inspectionReasonCode;
  const isCampaignReason = isCampaignReasonValue(reasonLookupOptions, inspectionReasonCode);
  const isCreateCampaign = mode === 'create' && isCampaignReason;
  const currentTargetType = taskModalMeta.targetType;
  const isReadonlyTarget = Boolean((taskModalMeta.selectedTarget && !taskModalMeta.manualTarget) || taskModalMeta.autoMatchedTarget);
  const readonlyTargetPayload = useMemo<Record<string, any>>(() => {
    if (!isReadonlyTarget) return {};
    return ((taskModalMeta.selectedTarget || taskModalMeta.autoMatchedTarget)?.payload || {}) as Record<string, any>;
  }, [isReadonlyTarget, taskModalMeta.autoMatchedTarget, taskModalMeta.selectedTarget]);
  const isReadonlyTargetField = useCallback((...fieldNames: string[]) => (
    isReadonlyTarget && fieldNames.some((fieldName) => hasTargetPayloadValue(readonlyTargetPayload[fieldName]))
  ), [isReadonlyTarget, readonlyTargetPayload]);
  const shouldShowRegion = selectedEmirateName === 'Abu Dhabi';
  const shouldShowCampaignRegion = requiresInspectionRegion(
    campaignFilterOptions.emirates,
    campaignEmirateIds,
  );
  const hasSelectedCampaignEmirateWithoutRequiredRegion = campaignFilterOptions.emirates.some(
    (emirate) => campaignEmirateIds.includes(emirate.id) && !emirate.requiresRegion,
  );
  const campaignAreaDisabled = !campaignEmirateIds.length
    || campaignFilterLoading
    || (
      shouldShowCampaignRegion
      && !campaignRegionIds.length
      && !hasSelectedCampaignEmirateWithoutRequiredRegion
    );
  const campaignRegionOptions = useMemo(() => {
    const regionRequiredEmirateIds = new Set(
      campaignFilterOptions.emirates
        .filter((emirate) => emirate.requiresRegion && campaignEmirateIds.includes(emirate.id))
        .map((emirate) => emirate.id),
    );
    return campaignFilterOptions.regions.filter(
      (region) => region.emirateId && regionRequiredEmirateIds.has(region.emirateId),
    );
  }, [campaignEmirateIds, campaignFilterOptions.emirates, campaignFilterOptions.regions]);
  const isArabic = i18n.resolvedLanguage === 'ar';
  const toCampaignSelectOptions = useCallback((options: Array<{
    id: number | string;
    nameEn: string;
    nameAr?: string;
    establishmentCount?: number;
    selectable?: boolean;
  }>) => options.map((item) => ({
    value: item.id,
    label: (isArabic ? item.nameAr : item.nameEn) || item.nameEn,
    establishmentCount: item.establishmentCount,
    disabled: item.selectable === false,
  })), [isArabic]);
  const reasonOptions = useMemo(() => reasonLookupOptions
    .filter((item) => Boolean(item.code))
    .filter((item) => !isInspectorSelfCreate || !isCampaignReasonOption(item))
    .map((item) => ({
      ...item,
      value: String(item.code),
      label: getReasonLabel(item),
    }))
    .filter((item) => item.value && item.label), [isInspectorSelfCreate, reasonLookupOptions]);
  const filteredReasonOptions = useMemo(() => {
    const normalized = normalizeLookupText(reasonSearchKeyword);
    if (!normalized) return reasonOptions;

    return reasonOptions.filter((item) => getReasonSearchText(item).includes(normalized));
  }, [reasonOptions, reasonSearchKeyword]);
  const prioritySelectOptions = useMemo(() => priorityLookupOptions
    .map((item) => ({
      value: getPriorityValue(item),
      label: getPriorityLabel(item),
    }))
    .filter((item) => item.value && item.label), [priorityLookupOptions]);
  const hasReasonSearchKeyword = reasonSearchKeyword.trim().length > 0;
  const inspectionMethodSelectOptions = useMemo<StaticSelectOption[]>(
    () => fallbackInspectionMethodOptions.map((item) => ({
      value: item,
      label: getInspectionTaskInspectionMethodLabel(item, t),
    })),
    [t],
  );
  const emirateSelectOptions = useMemo(() => (
    emirateLookupOptions.length
      ? emirateLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackEmirateOptions.map((item) => ({
        value: item,
        label: getInspectionTaskEmirateLabel(item, t),
      }))
  ), [emirateLookupOptions, t]);
  const establishmentSubtypeSelectOptions = useMemo(() => (
    establishmentSubtypeLookupOptions.length
      ? establishmentSubtypeLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackEstablishmentSubtypeOptions.map((item) => ({
        value: item,
        label: getInspectionTaskEstablishmentSubtypeLabel(item, t),
      }))
  ), [establishmentSubtypeLookupOptions, t]);
  const isLicenseExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(selectedEstablishmentSubtypeId);
  const authoritySelectOptions = useMemo(() => (
    authorityLookupOptions.length
      ? authorityLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : getFallbackAuthorityOptions(selectedEmirateName).map((item) => ({
        value: item,
        label: getInspectionTaskAuthorityLabel(item, t),
      }))
  ), [authorityLookupOptions, selectedEmirateName, t]);
  const campaignEmirateSelectOptions = useMemo(
    () => mapLookupOptionsToNumberOptions(emirateLookupOptions),
    [emirateLookupOptions],
  );
  const campaignAuthoritySelectOptions = useMemo(
    () => mapLookupOptionsToNumberOptions(authorityLookupOptions),
    [authorityLookupOptions],
  );
  const regionSelectOptions = useMemo(() => (
    regionLookupOptions.length
      ? regionLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackAreaOptions.map((item) => ({
        value: item,
        label: getInspectionTaskAreaLabel(item, t),
      }))
  ), [regionLookupOptions, t]);
  const communitySelectOptions = useMemo(() => (
    communityLookupOptions.length
      ? communityLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackAreaOptions.map((item) => ({
        value: item,
        label: getInspectionTaskAreaLabel(item, t),
      }))
  ), [communityLookupOptions, t]);

  useEffect(() => {
    if (!reasonDropdownOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      reasonSearchInputRef.current?.focus();
    });

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [reasonDropdownOpen]);

  useEffect(() => {
    selectedTargetRef.current = taskModalMeta.selectedTarget || null;
  }, [taskModalMeta.selectedTarget]);

  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      setCampaignActivityOptions([]);
      setCampaignActivityLoading(false);
      return undefined;
    }

    setCampaignActivityLoading(true);
    getInspectionEconomicActivities()
      .then((activities) => {
        if (!cancelled) {
          setCampaignActivityOptions(flattenEconomicActivityOptions(activities));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaignActivityOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCampaignActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const getTaskSubmitEnabled = useCallback((
    meta: TaskModalMeta,
    lookupOptions: InspectionReasonLookupOption[] = reasonLookupOptionsRef.current,
  ) => {
    const values = form.getFieldsValue(true);
    const hasReason = Boolean(values.inspectionReasonCode);
    const hasPriority = Boolean(values.priorityCode);
    const hasDueDate = Boolean(values.dueDate);
    const hasRemarks = true;
    const isCampaign = isCampaignReasonValue(lookupOptions, meta.inspectionReasonCode);

    if (isCampaign && mode === 'create') {
      return Boolean(hasReason && hasPriority && hasDueDate && isInspectionCampaignSelectionValid({
        emirates: campaignFilterOptionsRef.current.emirates,
        emirateIds: toNumberArray(values.emirateIds),
        regionIds: toNumberArray(values.regionIds),
        areaIds: toNumberArray(values.areaIds),
        activityIds: Array.isArray(values.activityIds) ? values.activityIds : [],
      }));
    }

    if (isCampaign) {
      const valid = hasReason && hasPriority && hasDueDate && values.emirateId && values.authorityId && values.activityIds?.length;
      return Boolean(valid && hasRemarks);
    }

    const hasInspector = isInspectorSelfCreate || normalizeInspectorIds(values.assignedInspector).length > 0;
    const hasMethod = Boolean(values.inspectionMethod);
    if (meta.targetType === 'establishment') {
      const hasRegion = values.emirateNameEn === 'Abu Dhabi' ? Boolean(values.region) : true;
      const hasLicenseFields = isEstablishmentSubtypeWithoutLicenseId(values.establishmentSubTypeId)
        ? true
        : Boolean(values.tradeLicenseNumber && values.authorityNameEn);
      const valid = meta.manualTarget || meta.selectedTarget
        ? Boolean(
          values.establishmentSubType &&
          values.emirateNameEn &&
          values.establishmentNameEn &&
          values.area &&
          values.street &&
          hasRegion &&
          hasLicenseFields,
        )
        : Boolean(meta.selectedTarget);
      return Boolean(hasReason && hasPriority && hasMethod && hasInspector && hasDueDate && valid);
    }

    const valid = meta.manualTarget || meta.selectedTarget
      ? Boolean(
        values.fullName &&
        values.email,
      )
      : Boolean(meta.selectedTarget);
    return Boolean(hasReason && hasPriority && hasMethod && hasInspector && hasDueDate && valid);
  }, [form, isInspectorSelfCreate, mode]);

  const clearBaseLookupOptions = useCallback(() => {
    reasonLookupOptionsRef.current = [];
    setReasonLookupOptions([]);
    setPriorityLookupOptions([]);
    setEmirateLookupOptions([]);
    setEstablishmentSubtypeLookupOptions([]);
  }, []);

  const closeModal = useCallback(() => {
    if (taskSubmittingRef.current || campaignConfirmationPendingRef.current) return;
    setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
    syncedVisible.value = false;
  }, [syncedVisible]);

  const closeDuplicateTaskWarning = useCallback(() => {
    if (duplicateTaskWarningLoading || duplicateConfirmationSubmittingRef.current) return;
    campaignConfirmationPendingRef.current = false;
    setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
  }, [duplicateTaskWarningLoading]);

  const confirmDuplicateTaskWarning = useCallback(async () => {
    if (duplicateTaskWarningLoading || duplicateConfirmationSubmittingRef.current || !duplicateTaskWarningConfirm) return;

    duplicateConfirmationSubmittingRef.current = true;
    setDuplicateTaskWarning((prev) => ({ ...prev, loading: true }));
    try {
      await duplicateTaskWarningConfirm();
      setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
    } catch (error) {
      CustomMessage.error(duplicateTaskWarning.campaignCount !== undefined
        ? t('inspection.tasks.messages.campaignRequestFailed')
        : t('inspection.tasks.messages.saveFailed'));
      console.error('Confirm duplicate inspection task failed', error);
      setDuplicateTaskWarning((prev) => prev.campaignCount !== undefined
        ? createClosedDuplicateTaskWarningState()
        : { ...prev, loading: false });
    } finally {
      campaignConfirmationPendingRef.current = false;
      duplicateConfirmationSubmittingRef.current = false;
    }
  }, [duplicateTaskWarning.campaignCount, duplicateTaskWarningConfirm, duplicateTaskWarningLoading, t]);

  const loadBaseLookups = useCallback(async () => {
    const [reasons, priorities, emirates, subTypes, activities] = await Promise.all([
      getInspectionReasonsFresh(),
      getInspectionPrioritiesFresh(),
      getInspectionEmiratesFresh(),
      getInspectionEstablishmentSubTypesFresh(),
      getInspectionEconomicActivities().catch(() => []),
    ]);
    const activityOptions = flattenEconomicActivityOptions(activities);
    reasonLookupOptionsRef.current = reasons;
    setReasonLookupOptions(reasons);
    setPriorityLookupOptions(priorities);
    setEmirateLookupOptions(emirates);
    setEstablishmentSubtypeLookupOptions(subTypes);
    setCampaignActivityOptions(activityOptions);
    return { reasons, priorities, activityOptions };
  }, []);

  const loadEmirateRelatedLookups = useCallback(async (emirateId?: number) => {
    emirateRelatedLookupRequestRef.current += 1;
    const requestId = emirateRelatedLookupRequestRef.current;
    setAuthorityLookupOptions([]);
    setRegionLookupOptions([]);
    setCommunityLookupOptions([]);
    setSelectedRegionId(undefined);
    if (!emirateId) {
      setAuthorityLookupLoading(false);
      return;
    }
    setAuthorityLookupLoading(true);
    try {
      const [authorities, regions] = await Promise.all([
        getInspectionAuthoritiesByEmirateFresh(emirateId),
        getInspectionRegionsByEmirateFresh(emirateId),
      ]);
      if (requestId !== emirateRelatedLookupRequestRef.current) {
        return;
      }
      setAuthorityLookupOptions(authorities);
      setRegionLookupOptions(regions);
    } finally {
      if (requestId === emirateRelatedLookupRequestRef.current) {
        setAuthorityLookupLoading(false);
      }
    }
  }, []);

  const loadRegionCommunities = useCallback(async (regionId?: number) => {
    setCommunityLookupOptions([]);
    if (!regionId) {
      return;
    }
    const communities = await getInspectionCommunitiesByRegionFresh(regionId);
    setCommunityLookupOptions(communities);
  }, []);

  const loadCampaignFilterOptions = useCallback(async (
    selection: {
      emirateIds: number[];
      regionIds: number[];
      areaIds: number[];
      activityIds: Array<number | string>;
    },
  ) => {
    campaignFilterRequestRef.current += 1;
    const requestId = campaignFilterRequestRef.current;
    setCampaignFilterLoading(true);

    try {
      const requestSelection = {
        ...selection,
        regionIds: buildInspectionCampaignRegionIds({
          emirates: campaignFilterOptionsRef.current.emirates,
          regions: campaignFilterOptionsRef.current.regions,
          emirateIds: selection.emirateIds,
          regionIds: selection.regionIds,
        }),
      };
      let options = await getInspectionCampaignFilterOptions({
        ...requestSelection,
        establishmentTypeId: 2,
        includeActivities: true,
      });
      if (requestId !== campaignFilterRequestRef.current) return;

      const resolvedRegionIds = buildInspectionCampaignRegionIds({
        emirates: options.emirates,
        regions: options.regions,
        emirateIds: selection.emirateIds,
        regionIds: selection.regionIds,
      });
      if (
        resolvedRegionIds.length !== requestSelection.regionIds.length
        || resolvedRegionIds.some((regionId) => !requestSelection.regionIds.includes(regionId))
      ) {
        options = await getInspectionCampaignFilterOptions({
          ...selection,
          establishmentTypeId: 2,
          regionIds: resolvedRegionIds,
          includeActivities: true,
        });
        if (requestId !== campaignFilterRequestRef.current) return;
      }

      campaignFilterOptionsRef.current = options;
      setCampaignFilterOptions(options);
      const pruned = pruneInspectionAreaSelection({
        ...selection,
        emirates: options.emirates,
        regions: options.regions,
        areas: options.areas,
      });
      form.setFieldsValue(pruned);
    } catch {
      if (requestId === campaignFilterRequestRef.current) {
        campaignFilterOptionsRef.current = EMPTY_CAMPAIGN_FILTER_OPTIONS;
        setCampaignFilterOptions(EMPTY_CAMPAIGN_FILTER_OPTIONS);
        CustomMessage.error(t('inspection.tasks.messages.campaignOptionsFailed'));
      }
    } finally {
      if (requestId === campaignFilterRequestRef.current) {
        setCampaignFilterLoading(false);
      }
    }
  }, [form, t]);

  useEffect(() => {
    if (!visible || !isCreateCampaign) {
      campaignFilterRequestRef.current += 1;
      setCampaignFilterLoading(false);
      campaignFilterOptionsRef.current = EMPTY_CAMPAIGN_FILTER_OPTIONS;
      setCampaignFilterOptions(EMPTY_CAMPAIGN_FILTER_OPTIONS);
      return;
    }

    const values = form.getFieldsValue(true);
    void loadCampaignFilterOptions({
      emirateIds: toNumberArray(values.emirateIds),
      regionIds: toNumberArray(values.regionIds),
      areaIds: toNumberArray(values.areaIds),
      activityIds: Array.isArray(values.activityIds) ? values.activityIds : [],
    });
  }, [form, isCreateCampaign, loadCampaignFilterOptions, visible]);

  useEffect(() => {
    const batchId = campaignBatchProgress?.batchId;
    if (!batchId) return undefined;

    let cancelled = false;
    let consecutiveFailures = 0;
    let pollTimer: number | undefined;
    const poll = async () => {
      try {
        const progress = await getInspectionTaskBatchByActivityProgress(batchId);
        if (cancelled) return;
        consecutiveFailures = 0;
        setCampaignBatchProgress(progress);
        if (progress.status === 'Completed') {
          CustomMessage.success(t('inspection.tasks.messages.campaignGenerated'));
          try {
            await onSubmitted();
          } catch (error) {
            console.error('Refresh inspection tasks after campaign completion failed', error);
          }
          return;
        }
        if (progress.status === 'Failed') {
          CustomMessage.error(t('inspection.tasks.messages.campaignBatchFailed'));
          return;
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Load inspection campaign batch progress failed', error);
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) {
          CustomMessage.error(t('inspection.tasks.messages.campaignBatchProgressFailed'));
          setCampaignBatchProgress(null);
          return;
        }
      }
      if (!cancelled) {
        pollTimer = window.setTimeout(poll, 2000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [campaignBatchProgress?.batchId, onSubmitted, t]);

  const runTargetSearch = useCallback(async (targetType: TargetType, searchText: string) => {
    const keyword = searchText.trim();
    targetSearchRequestRef.current += 1;
    const requestId = targetSearchRequestRef.current;
    if (!keyword) {
      setTargetSearchOptions(getSelectedTargetOptions(selectedTargetRef.current, targetType));
      setTargetSearchLoading(false);
      return;
    }

    setTargetSearchLoading(true);
    try {
      const values = form.getFieldsValue(true);
      const emirateId = toNumberOrUndefined(values.emirateId)
        || toNumberOrUndefined(findLookupOptionByLabel(emirateLookupOptions, values.emirateNameEn)?.id);
      const options = targetType === 'establishment'
        ? (await searchInspectionEstablishments({
          keyword,
          emirateId,
          pageIndex: 1,
          pageSize: 20,
        })).map(mapEstablishmentToTargetOption)
        : (await searchInspectionIndividuals({
          keyword,
          pageIndex: 1,
          pageSize: 20,
        })).map(mapIndividualToTargetOption);
      if (requestId === targetSearchRequestRef.current) {
        const selectedTarget = selectedTargetRef.current;
        setTargetSearchOptions(
          selectedTarget?.targetType === targetType
            ? mergeSelectedTargetOption(options, selectedTarget)
            : options,
        );
      }
    } catch {
      if (requestId === targetSearchRequestRef.current) {
        setTargetSearchOptions(getSelectedTargetOptions(selectedTargetRef.current, targetType));
      }
    } finally {
      if (requestId === targetSearchRequestRef.current) {
        setTargetSearchLoading(false);
      }
    }
  }, [emirateLookupOptions, form]);

  const debouncedTargetSearch = useMemo(
    () => debounce(runTargetSearch, 350),
    [runTargetSearch],
  );

  const getDefaultCreateValues = useCallback((): Record<string, any> & { targetType: TargetType } => {
    return {
      inspectionReasonCode: undefined,
      priorityCode: undefined,
      targetType: 'establishment',
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
      latitude: undefined,
      longitude: undefined,
      mapLocationUrl: undefined,
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
      mobileNumber: toContactFormValue(createEmptyMobileSnapshot(), mobileFieldNames),
      mediaLicenseNumber: undefined,
      socialMediaAccountUsername: undefined,
      activityNameEn: undefined,
      activityIds: undefined,
      emirateIds: undefined,
      regionIds: undefined,
      areaIds: undefined,
      inspectionMethod: undefined,
      assignedInspector: isInspectorSelfCreate ? currentInspectorId : undefined,
      dueDate: null,
      description: undefined,
    };
  }, [currentInspectorId, isInspectorSelfCreate]);

  const applyTargetPayload = useCallback((option: InspectionTargetSearchOption) => {
    const payload = option.payload as Record<string, any>;
    const { mobileSnapshot: payloadMobileSnapshot, ...targetPayload } = payload;
    const mobileSnapshot = payloadMobileSnapshot || createEmptyMobileSnapshot();
    const currentInspectionMethod = form.getFieldValue('inspectionMethod');
    targetMobileSnapshotRef.current = mobileSnapshot;
    form.setFieldsValue({
      ...targetPayload,
      mobileNumber: option.targetType === 'individual'
        ? toContactFormValue(mobileSnapshot, mobileFieldNames)
        : targetPayload.mobileNumber,
      inspectionMethod: option.targetType === 'establishment'
        ? payload.inspectionMethod
        : payload.inspectionMethod || currentInspectionMethod,
    });
    setSelectedEmirateName(payload.emirateNameEn);
    setSelectedEmirateId(toNumberOrUndefined(payload.emirateId));
    setSelectedRegionId(toNumberOrUndefined(payload.regionId));
    void loadEmirateRelatedLookups(toNumberOrUndefined(payload.emirateId)).catch(() => undefined);
    void loadRegionCommunities(toNumberOrUndefined(payload.regionId)).catch(() => undefined);
  }, [form, loadEmirateRelatedLookups, loadRegionCommunities]);

  const applyAutoMatchedTarget = useCallback((option: InspectionTargetSearchOption) => {
    applyTargetPayload(option);
    setTaskModalMeta((current) => {
      if (!current.manualTarget || current.selectedTarget || current.targetType !== option.targetType) {
        return current;
      }
      const nextMeta = {
        ...current,
        autoMatchedTarget: option,
        targetSearch: option.title,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [applyTargetPayload, getTaskSubmitEnabled]);

  const clearAutoMatchedTarget = useCallback((targetType: TargetType, requestId: number) => {
    if (requestId !== manualLookupRequestRef.current) return;
    setTaskModalMeta((current) => {
      if (!current.manualTarget || current.selectedTarget || current.targetType !== targetType || !current.autoMatchedTarget) {
        return current;
      }
      const nextMeta = {
        ...current,
        autoMatchedTarget: null,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [getTaskSubmitEnabled]);

  const runManualTargetLookup = useCallback(async (meta: TaskModalMeta, values: Record<string, any>) => {
    if (!meta.manualTarget || meta.selectedTarget) return;
    manualLookupRequestRef.current += 1;
    const requestId = manualLookupRequestRef.current;
    const targetType = meta.targetType;

    try {
      if (targetType === 'establishment') {
        const emirateId = toNumberOrUndefined(values.emirateId)
          || toNumberOrUndefined(findLookupOptionByLabel(emirateLookupOptions, values.emirateNameEn)?.id)
          || (values.emirateNameEn ? getEmirateId(values.emirateNameEn) : undefined);
        if (!emirateId) {
          clearAutoMatchedTarget(targetType, requestId);
          return;
        }

        const isExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(values.establishmentSubTypeId);
        let establishment: InspectionEstablishmentSearchItem | null = null;
        if (!isExemptSubtype && values.tradeLicenseNumber) {
          establishment = await getInspectionEstablishmentByTradeLicense({
            emirateId,
            tradeLicenseNumber: String(values.tradeLicenseNumber).trim(),
          });
        } else if (isExemptSubtype && values.establishmentNameEn) {
          const exactName = normalizeLookupKey(values.establishmentNameEn);
          const establishments = await searchInspectionEstablishments({
            emirateId,
            keyword: String(values.establishmentNameEn).trim(),
            pageIndex: 1,
            pageSize: 20,
          });
          establishment = establishments.find((item) =>
            normalizeLookupKey(getEstablishmentDisplayName(item)) === exactName,
          ) || null;
        }

        if (requestId !== manualLookupRequestRef.current) return;
        if (establishment) {
          applyAutoMatchedTarget(mapEstablishmentToTargetOption(establishment));
        } else {
          clearAutoMatchedTarget(targetType, requestId);
        }
        return;
      }

      const idNumber = normalizeIndividualIdNumberValue(values.eid);
      if (!idNumber) {
        clearAutoMatchedTarget(targetType, requestId);
        return;
      }
      const individuals = await searchInspectionIndividuals({
        keyword: idNumber,
        pageIndex: 1,
        pageSize: 20,
      });
      if (requestId !== manualLookupRequestRef.current) return;
      const individual = individuals.find((item) => hasMatchingIndividualIdNumber(item, idNumber)) || null;
      if (individual) {
        applyAutoMatchedTarget(mapIndividualToTargetOption(individual));
      } else {
        clearAutoMatchedTarget(targetType, requestId);
      }
    } catch {
      clearAutoMatchedTarget(targetType, requestId);
    }
  }, [
    applyAutoMatchedTarget,
    clearAutoMatchedTarget,
    emirateLookupOptions,
  ]);

  const debouncedManualTargetLookup = useMemo(
    () => debounce(runManualTargetLookup, 450),
    [runManualTargetLookup],
  );

  useEffect(() => () => {
    debouncedTargetSearch.cancel();
    debouncedManualTargetLookup.cancel();
  }, [debouncedManualTargetLookup, debouncedTargetSearch]);

  const clearTargetFormValues = useCallback((targetType: TargetType, overrides: Record<string, any> = {}) => {
    const mobileSnapshot = createEmptyMobileSnapshot();
    targetMobileSnapshotRef.current = mobileSnapshot;
    form.setFieldsValue({
      ...getClearedTargetValues(targetType, overrides),
      mobileNumber: toContactFormValue(mobileSnapshot, mobileFieldNames),
    });
    setSelectedEmirateName(overrides.emirateNameEn);
    setSelectedEmirateId(toNumberOrUndefined(overrides.emirateId));
    setSelectedRegionId(toNumberOrUndefined(overrides.regionId));
    if (!overrides.emirateId) {
      emirateRelatedLookupRequestRef.current += 1;
      setAuthorityLookupOptions([]);
      setRegionLookupOptions([]);
      setCommunityLookupOptions([]);
      setAuthorityLookupLoading(false);
    }
  }, [form]);

  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      form.resetFields();
      targetMobileSnapshotRef.current = createEmptyMobileSnapshot();
      setTaskModalMeta(createEmptyTaskModalMeta());
      setTaskSubmitEnabled(false);
      clearBaseLookupOptions();
      setTaskAttachments([]);
      setAttachmentUploading(false);
      setSelectedEmirateName(undefined);
      setSelectedEmirateId(undefined);
      setSelectedRegionId(undefined);
      setTargetSearchOptions([]);
      setTargetSearchLoading(false);
      setDetailLoading(false);
      emirateRelatedLookupRequestRef.current += 1;
      setAuthorityLookupOptions([]);
      setRegionLookupOptions([]);
      setCommunityLookupOptions([]);
      setAuthorityLookupLoading(false);
      setReasonDropdownOpen(false);
      setReasonSearchKeyword('');
      return undefined;
    }

    setTaskAttachments([]);
    clearBaseLookupOptions();
    setAttachmentUploading(false);
    setTargetSearchOptions([]);
    setTargetSearchLoading(false);
    setReasonDropdownOpen(false);
    setReasonSearchKeyword('');

    const hydrateModal = async () => {
      const { reasons, priorities, activityOptions } = await loadBaseLookups();
      if (cancelled) return;

      if (mode === 'create' || !editingTask) {
        const defaults = getDefaultCreateValues();
        targetMobileSnapshotRef.current = createEmptyMobileSnapshot();
        const nextMeta: TaskModalMeta = {
          inspectionReasonCode: '',
          targetType: defaults.targetType,
          manualTarget: false,
          targetSearch: '',
          selectedTarget: null,
          autoMatchedTarget: null,
        };
        form.setFieldsValue(defaults);
        setTaskModalMeta(nextMeta);
        setSelectedEmirateName(undefined);
        setSelectedEmirateId(undefined);
        setSelectedRegionId(undefined);
        setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
        return;
      }

      setDetailLoading(true);
      const detailResponse = await getAdminInspectionTaskDetail({
        taskId: editingTask.taskId,
        taskNo: editingTask.taskNo,
      }).catch(() => null);
      if (cancelled) return;
      const detailTask = detailResponse?.data || editingTask;
      const target = detailTask?.inspectionTarget || {};
      const address = target.address || {};
      const targetType: TargetType = Number(target.targetType) === 2 ? 'individual' : 'establishment';
      const inspectionConfig = detailTask.inspectionConfig || {};
      const inspectionMethod = normalizeInspectionMethodValue(inspectionConfig) || 'Field Inspection';
      const assignedInspectorIds = getAssignedInspectorIds(detailTask?.assignment);
      const emirateId = toNumberOrUndefined(address.emirateId)
        || (address.emirateNameEn ? getEmirateId(address.emirateNameEn) : undefined);
      const regionId = toNumberOrUndefined(address.regionId);
      const areaId = toNumberOrUndefined(address.areaId || address.communityId);
      const targetName = target.fullName || target.establishmentNameEn;
      const regionName = address.regionNameEn || (address.communityId ? undefined : address.communityNameEn);
      const areaName = address.areaNameEn || address.communityNameEn;
      const reasonOption = findReasonOption(reasons, inspectionConfig.inspectionReasonCode)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonId)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonNameEn)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonNameAr);
      const inspectionReasonCode = reasonOption?.code ? String(reasonOption.code) : undefined;
      const priorityOption = findPriorityOption(priorities, inspectionConfig.priorityCode)
        || findPriorityOption(priorities, inspectionConfig.priorityId)
        || findPriorityOption(priorities, inspectionConfig.priorityNameEn)
        || findPriorityOption(priorities, inspectionConfig.priorityNameAr);
      const priorityCode = priorityOption?.code
        ? String(priorityOption.code)
        : inspectionConfig.priorityCode || (inspectionConfig.priorityId ? String(inspectionConfig.priorityId) : undefined);
      const mobileSnapshot = createContactNumberSnapshot({
        countryCode: target.mobileCountryCode,
        localNumber: target.mobileLocalNumber,
        fullNumber: target.mobile,
      });
      targetMobileSnapshotRef.current = mobileSnapshot;
      const values = {
        inspectionReasonCode,
        priorityCode,
        targetType,
        targetSearch: targetName,
        establishmentId: target.establishmentId,
        individualId: target.individualId,
        userProfileId: target.userProfileId,
        userId: target.userId,
        hasRegisteredProfile: target.hasRegisteredProfile,
        establishmentSubTypeId: target.establishmentSubTypeId,
        establishmentSubType: target.establishmentSubType || (targetType === 'establishment' ? target.targetTypeName || 'Commercial' : undefined),
        emirateId,
        emirateNameEn: address.emirateNameEn,
        authorityId: address.authorityId,
        authorityNameEn: address.authorityNameEn || getAuthorityName(detailTask),
        regionId,
        region: regionName,
        communityId: address.communityId,
        areaId,
        area: areaName,
        street: address.street,
        latitude: address.latitude,
        longitude: address.longitude,
        mapLocationUrl: address.mapLocationUrl,
        tradeLicenseNumber: target.licenseNumber,
        establishmentNameEn: target.establishmentNameEn,
        eid: getIndividualIdNumber(target),
        fullName: target.fullName || target.establishmentNameEn,
        email: target.email,
        mobileNumber: toContactFormValue(mobileSnapshot, mobileFieldNames),
        mediaLicenseNumber: target.mediaLicenseNumber,
        socialMediaAccountUsername: target.socialMediaAccountUsername,
        activityNameEn: target.economicActivityName
          ? String(target.economicActivityName).split(', ')
          : undefined,
        activityIds: activityOptions
          .filter((option) => (
            option.value === String(target.economicActivityId || '')
            || option.label === target.economicActivityName
          ))
          .map((option) => option.value),
        inspectionMethod,
        assignedInspector: isInspectorSelfCreate ? assignedInspectorIds[0] : assignedInspectorIds,
        dueDate: inspectionConfig.dueDate ? moment(inspectionConfig.dueDate) : null,
        description: detailTask.description,
      };
      const editTargetOption = mapTaskDetailToTargetOption(detailTask, values, targetType);
      const nextMeta: TaskModalMeta = {
        inspectionReasonCode: values.inspectionReasonCode || '',
        targetType,
        manualTarget: false,
        targetSearch: editTargetOption.title,
        selectedTarget: editTargetOption,
        autoMatchedTarget: null,
      };
      form.setFieldsValue({ ...values, targetSearch: editTargetOption.value });
      setTaskAttachments(normalizeTaskAttachments(detailTask.attachments));
      setTargetSearchOptions([editTargetOption]);
      setTaskModalMeta(nextMeta);
      setSelectedEmirateName(values.emirateNameEn);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(regionId);
      await loadEmirateRelatedLookups(emirateId);
      await loadRegionCommunities(regionId);
      if (cancelled) return;
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      setDetailLoading(false);
    };

    hydrateModal().catch(() => {
      if (!cancelled) {
        setDetailLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    editingTask,
    clearBaseLookupOptions,
    form,
    getAuthorityName,
    getDefaultCreateValues,
    getTaskSubmitEnabled,
    isInspectorSelfCreate,
    loadBaseLookups,
    loadEmirateRelatedLookups,
    loadRegionCommunities,
    mode,
    visible,
  ]);

  const handleTaskFormValuesChange = useCallback((changedValues: Record<string, any>, allValues: Record<string, any>) => {
    let nextMeta = taskModalMeta;
    const fieldPatch: Record<string, any> = {};

    if (Object.prototype.hasOwnProperty.call(changedValues, 'inspectionReasonCode')) {
      const nextReasonCode = changedValues.inspectionReasonCode || '';
      const campaign = isCampaignReasonValue(reasonLookupOptions, nextReasonCode);
      nextMeta = {
        ...nextMeta,
        inspectionReasonCode: nextReasonCode,
        targetType: campaign ? 'establishment' : nextMeta.targetType,
        manualTarget: campaign ? false : nextMeta.manualTarget,
        selectedTarget: campaign ? null : nextMeta.selectedTarget,
        autoMatchedTarget: campaign ? null : nextMeta.autoMatchedTarget,
      };
      if (campaign) {
        selectedTargetRef.current = null;
        targetMobileSnapshotRef.current = createEmptyMobileSnapshot();
        emirateRelatedLookupRequestRef.current += 1;
        setSelectedEmirateName(undefined);
        setAuthorityLookupOptions([]);
        setAuthorityLookupLoading(false);
        form.setFieldsValue({
          targetType: 'establishment',
          targetSearch: undefined,
          inspectionMethod: undefined,
          assignedInspector: undefined,
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
          mobileNumber: undefined,
          activityNameEn: undefined,
          activityIds: undefined,
          emirateIds: undefined,
          regionIds: undefined,
          areaIds: undefined,
        });
      } else {
        setAuthorityLookupLoading(false);
        form.setFieldsValue({
          activityIds: undefined,
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'emirateId')) {
      const emirateId = toNumberOrUndefined(allValues.emirateId);
      const emirateOption = findLookupOptionById(emirateLookupOptions, emirateId);
      const emirateName = getLookupLabel(emirateOption);
      fieldPatch.emirateNameEn = emirateName || undefined;
      fieldPatch.authorityId = undefined;
      fieldPatch.authorityNameEn = undefined;
      fieldPatch.regionId = undefined;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      setSelectedEmirateName(emirateName || undefined);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(undefined);
      void loadEmirateRelatedLookups(emirateId).catch(() => undefined);
    }

    if (
      Object.prototype.hasOwnProperty.call(changedValues, 'emirateIds')
      || Object.prototype.hasOwnProperty.call(changedValues, 'regionIds')
      || Object.prototype.hasOwnProperty.call(changedValues, 'areaIds')
      || Object.prototype.hasOwnProperty.call(changedValues, 'activityIds')
    ) {
      const pruned = pruneInspectionAreaSelection({
        emirateIds: toNumberArray(allValues.emirateIds),
        regionIds: toNumberArray(allValues.regionIds),
        areaIds: toNumberArray(allValues.areaIds),
        emirates: campaignFilterOptions.emirates,
        regions: campaignFilterOptions.regions,
        areas: campaignFilterOptions.areas,
      });
      form.setFieldsValue(pruned);
      void loadCampaignFilterOptions({
        ...pruned,
        activityIds: Array.isArray(allValues.activityIds) ? allValues.activityIds : [],
      });
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'authorityId')) {
      const authorityOption = findLookupOptionById(authorityLookupOptions, allValues.authorityId);
      fieldPatch.authorityNameEn = getLookupLabel(authorityOption) || undefined;
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'targetType')) {
      const targetType = changedValues.targetType as TargetType;
      const keepManualTarget = Boolean(nextMeta.manualTarget);
      selectedTargetRef.current = null;
      nextMeta = {
        ...nextMeta,
        targetType,
        manualTarget: keepManualTarget,
        targetSearch: '',
        selectedTarget: null,
        autoMatchedTarget: null,
      };
      setTargetSearchOptions([]);
      clearTargetFormValues(targetType);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'emirateNameEn')) {
      const emirateOption = findLookupOptionByLabel(emirateLookupOptions, allValues.emirateNameEn);
      const emirateId = toNumberOrUndefined(emirateOption?.id)
        || (allValues.emirateNameEn ? getEmirateId(allValues.emirateNameEn) : undefined);
      fieldPatch.emirateId = emirateId;
      fieldPatch.authorityId = undefined;
      fieldPatch.regionId = undefined;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      setSelectedEmirateName(allValues.emirateNameEn);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(undefined);
      void loadEmirateRelatedLookups(emirateId).catch(() => undefined);
      if (!allValues.emirateNameEn) {
        form.setFieldsValue({
          authorityNameEn: undefined,
          region: undefined,
          area: undefined,
          ...fieldPatch,
        });
        setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
        return;
      }
      const isNextLicenseExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(allValues.establishmentSubTypeId);
      const nextValues: Record<string, any> = {};
      if (allValues.emirateNameEn !== 'Abu Dhabi') {
        nextValues.region = undefined;
      }
      if (isNextLicenseExemptSubtype) {
        nextValues.authorityNameEn = undefined;
      } else {
        const nextAuthority = getFallbackAuthorityOptions(allValues.emirateNameEn)[0];
        if (!allValues.authorityNameEn || String(allValues.authorityNameEn).includes('Authority')) {
          nextValues.authorityNameEn = nextAuthority;
        }
      }
      if (Object.keys(nextValues).length) {
        form.setFieldsValue({ ...nextValues, ...fieldPatch });
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'authorityNameEn')) {
      const authorityOption = findLookupOptionByLabel(authorityLookupOptions, allValues.authorityNameEn);
      fieldPatch.authorityId = toNumberOrUndefined(authorityOption?.id);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'region')) {
      const regionOption = findLookupOptionByLabel(regionLookupOptions, allValues.region);
      const regionId = toNumberOrUndefined(regionOption?.id);
      fieldPatch.regionId = regionId;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      fieldPatch.area = undefined;
      setSelectedRegionId(regionId);
      void loadRegionCommunities(regionId).catch(() => undefined);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'area')) {
      const communityOption = findLookupOptionByLabel(communityLookupOptions, allValues.area);
      const areaId = toNumberOrUndefined(communityOption?.id);
      fieldPatch.communityId = areaId;
      fieldPatch.areaId = areaId;
    }

    if (Object.keys(fieldPatch).length) {
      form.setFieldsValue(fieldPatch);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'targetSearch')) {
      nextMeta = {
        ...nextMeta,
        targetSearch: changedValues.targetSearch || '',
      };
      if (!changedValues.targetSearch) {
        nextMeta = {
          ...nextMeta,
          selectedTarget: null,
          autoMatchedTarget: null,
        };
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'establishmentSubType')) {
      const subtypeOption = findLookupOptionByLabel(establishmentSubtypeLookupOptions, changedValues.establishmentSubType);
      const establishmentSubTypeId = toNumberOrUndefined(subtypeOption?.id);
      form.setFieldsValue({
        establishmentSubTypeId,
      });
      if (isEstablishmentSubtypeWithoutLicenseId(establishmentSubTypeId)) {
        form.setFieldsValue({
          tradeLicenseNumber: undefined,
          authorityId: undefined,
          authorityNameEn: undefined,
        });
      } else if (allValues.emirateNameEn && !allValues.authorityNameEn) {
        form.setFieldsValue({
          authorityNameEn: getFallbackAuthorityOptions(allValues.emirateNameEn)[0],
        });
      }
    }

    const isNextCampaign = isCampaignReasonValue(reasonLookupOptions, nextMeta.inspectionReasonCode);

    if (!isNextCampaign && nextMeta.manualTarget && !nextMeta.selectedTarget) {
      debouncedManualTargetLookup(nextMeta, {
        ...allValues,
        ...form.getFieldsValue(true),
        ...fieldPatch,
      });
    }

    if (nextMeta !== taskModalMeta) {
      setTaskModalMeta(nextMeta);
    }
    setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
  }, [
    clearTargetFormValues,
    authorityLookupOptions,
    campaignFilterOptions.areas,
    campaignFilterOptions.emirates,
    campaignFilterOptions.regions,
    communityLookupOptions,
    debouncedManualTargetLookup,
    emirateLookupOptions,
    establishmentSubtypeLookupOptions,
    form,
    getTaskSubmitEnabled,
    loadEmirateRelatedLookups,
    loadCampaignFilterOptions,
    loadRegionCommunities,
    reasonLookupOptions,
    regionLookupOptions,
    taskModalMeta,
  ]);

  const handleTargetSearch = useCallback((searchText: string) => {
    const nextSearchText = searchText || '';
    setTaskModalMeta((current) => {
      if (!nextSearchText && current.selectedTarget) {
        return current;
      }
      return { ...current, targetSearch: nextSearchText };
    });
    if (!nextSearchText.trim()) {
      debouncedTargetSearch.cancel();
      setTargetSearchLoading(false);
      setTargetSearchOptions(getSelectedTargetOptions(selectedTargetRef.current, currentTargetType));
      return;
    }

    debouncedTargetSearch(currentTargetType, nextSearchText);
  }, [currentTargetType, debouncedTargetSearch]);

  const handleTargetSelect = useCallback((value: string) => {
    const option = targetSearchOptions.find((item) => item.value === value) || null;
    if (option) {
      form.setFieldsValue({ targetSearch: option.value });
      applyTargetPayload(option);
      selectedTargetRef.current = option;
      setTargetSearchOptions((currentOptions) => mergeSelectedTargetOption(currentOptions, option));
    }
    setTaskModalMeta((current) => {
      const nextMeta = {
        ...current,
        manualTarget: false,
        selectedTarget: option,
        autoMatchedTarget: null,
        targetSearch: option?.title || '',
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [applyTargetPayload, form, getTaskSubmitEnabled, targetSearchOptions]);

  const handleReasonDropdownVisibleChange = useCallback((open: boolean) => {
    setReasonDropdownOpen(open);
    if (!open) {
      setReasonSearchKeyword('');
    }
  }, []);

  const handleReasonSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setReasonDropdownOpen(true);
    setReasonSearchKeyword(event.target.value);
  }, []);

  const handleReasonSearchClear = useCallback(() => {
    setReasonSearchKeyword('');
    reasonSearchInputRef.current?.focus();
  }, []);

  const handleReasonSelect = useCallback(() => {
    setReasonSearchKeyword('');
  }, []);

  const renderReasonDropdown = useCallback((menu: React.ReactElement) => {
    const searchRowClassName = hasReasonSearchKeyword
      ? 'inspection-task-management__reason-dropdown-search inspection-task-management__reason-dropdown-search--active'
      : 'inspection-task-management__reason-dropdown-search';
    const dropdownPanelClassName = filteredReasonOptions.length
      ? 'inspection-task-management__reason-dropdown-panel'
      : 'inspection-task-management__reason-dropdown-panel inspection-task-management__reason-dropdown-panel--empty';

    return (
      <div className={dropdownPanelClassName}>
        <div
          className={searchRowClassName}
          onClick={() => reasonSearchInputRef.current?.focus()}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <img
            src={inspectionFigmaAssets.createTask.searchIcon}
            alt=""
            className="inspection-task-management__reason-dropdown-search-icon"
          />
          <input
            ref={reasonSearchInputRef}
            className="inspection-task-management__reason-dropdown-search-input"
            value={reasonSearchKeyword}
            placeholder={t('inspection.common.search')}
            onChange={handleReasonSearchChange}
            onKeyDown={(event) => event.stopPropagation()}
          />
          {hasReasonSearchKeyword ? (
            <button
              type="button"
              className="inspection-task-management__reason-dropdown-clear"
              onClick={handleReasonSearchClear}
              onMouseDown={(event) => event.preventDefault()}
              aria-label={t('inspection.common.reset')}
            >
              <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" />
            </button>
          ) : null}
        </div>
        <div className="inspection-task-management__reason-dropdown-menu">
          {menu}
        </div>
      </div>
    );
  }, [
    filteredReasonOptions.length,
    handleReasonSearchChange,
    handleReasonSearchClear,
    hasReasonSearchKeyword,
    reasonSearchKeyword,
    t,
  ]);

  const handleTaskSubmit = useCallback(async () => {
    if (detailLoading || taskSubmittingRef.current || campaignConfirmationPendingRef.current) {
      return;
    }

    if (attachmentUploading) {
      CustomMessage.warning(t('inspection.execution.messages.uploadInProgress'));
      return;
    }

    taskSubmittingRef.current = true;
    setTaskSubmitting(true);
    try {
      const validatedValues = await form.validateFields();
      if (!getTaskSubmitEnabled(taskModalMeta)) {
        return;
      }
      const values = {
        ...form.getFieldsValue(true),
        ...validatedValues,
      };
      const dueDateValue = (values.dueDate ? toApi(values.dueDate) : undefined) || toApi(nowGst().add(5, 'days'));
      const selectedReasonCode = values.inspectionReasonCode;
      const currentReasonOption = findReasonOption(reasonLookupOptions, selectedReasonCode);
      const selectedReasonName = getReasonLabel(currentReasonOption);
      const selectedReasonNameEn = currentReasonOption?.nameEn || selectedReasonName;
      const selectedReasonNameAr = currentReasonOption?.nameAr;
      const selectedPriorityCode = values.priorityCode;
      const currentPriorityOption = findPriorityOption(priorityLookupOptions, selectedPriorityCode);
      const selectedPriorityId = toNumberOrUndefined(currentPriorityOption?.code ?? selectedPriorityCode);
      const selectedPriorityName = getPriorityLabel(currentPriorityOption) || String(selectedPriorityCode || '');
      const selectedPriorityNameEn = currentPriorityOption?.nameEn || selectedPriorityName;
      const selectedPriorityNameAr = currentPriorityOption?.nameAr;
      const isLowPriority = normalizeLookupKey(selectedPriorityNameEn) === 'low' || String(selectedPriorityCode) === '4';
      const isCriticalContentReason = currentReasonOption?.code === 'CriticalContentViolation'
        || normalizeLookupKey(selectedReasonNameEn) === criticalContentViolationReasonKey;
      if (mode === 'create' && isCampaignReason) {
        const locationPayload = buildInspectionCampaignLocationPayload({
          emirateIds: toNumberArray(values.emirateIds),
          regionIds: buildInspectionCampaignRegionIds({
            emirates: campaignFilterOptions.emirates,
            regions: campaignFilterOptions.regions,
            emirateIds: toNumberArray(values.emirateIds),
            regionIds: toNumberArray(values.regionIds),
          }),
          areaIds: toNumberArray(values.areaIds),
          activityIds: Array.isArray(values.activityIds) ? values.activityIds : [],
        });
        if (!isInspectionCampaignSelectionValid({
          emirates: campaignFilterOptions.emirates,
          ...locationPayload,
        })) {
          CustomMessage.error(t('request.parameter.error'));
          return;
        }
        const campaignPayload: InspectionTaskBatchByActivityPayload = {
          ...locationPayload,
          establishmentTypeId: 2,
          targetTypeId: 1,
          sourceTypeId: 2,
          inspectionMethodId: 1,
          inspectionReasonId: toNumberOrUndefined(selectedReasonCode) ?? selectedReasonCode,
          priorityId: selectedPriorityId ?? selectedPriorityCode,
          dueDate: dueDateValue,
          remarks: values.description,
          inspectors: [],
          attachments: taskAttachments,
        };
        const preview = await previewInspectionTasksBatchByActivity(campaignPayload);
        const decision = getCampaignPreviewDecision(preview);
        if (decision === 'empty') {
          CustomMessage.warning(t('inspection.tasks.messages.campaignNoTasksToCreate'));
          return;
        }
        const createCampaign = async () => {
          const { data } = await createInspectionTasksBatchByActivity(campaignPayload);
          if (data.executionMode === 'Async') {
            if (typeof data.batchId !== 'string' || !data.batchId.trim()
              || typeof data.queuedCount !== 'number'
              || !Number.isSafeInteger(data.queuedCount) || data.queuedCount <= 0) {
              throw new Error('Invalid asynchronous inspection campaign response');
            }
            setCampaignBatchProgress({
              batchId: data.batchId,
              status: 'Pending',
              total: data.queuedCount,
              created: 0,
              failed: 0,
              matchedEstablishmentCount: data.matchedEstablishmentCount,
            });
            syncedVisible.value = false;
            return;
          }
          if (data.executionMode !== 'Sync' || !Number.isSafeInteger(data.createdCount) || data.createdCount < 0) {
            throw new Error('Invalid synchronous inspection campaign response');
          }
          if (data.createdCount === 0) {
            CustomMessage.warning(t('inspection.tasks.messages.campaignNoTasksToCreate'));
            return;
          }
          CustomMessage.success(t('inspection.tasks.messages.campaignGenerated'));
          syncedVisible.value = false;
          try {
            await onSubmitted();
          } catch (error) {
            console.error('Refresh inspection tasks after campaign creation failed', error);
          }
        };
        if (decision === 'confirm') {
          campaignConfirmationPendingRef.current = true;
          setDuplicateTaskWarning({
            visible: true,
            campaignCount: preview.recentInspectionTaskCount,
            message: '',
            loading: false,
            onConfirm: createCampaign,
          });
          return;
        }
        await createCampaign();
        return;
      }

      const selectedInspectorIds = isInspectorSelfCreate
        ? [currentInspectorId]
        : normalizeInspectorIds(values.assignedInspector);
      const selectedInspectors = selectedInspectorIds.map((inspectorId) => {
        const option = inspectorOptions.find((item) => item.id === inspectorId);
        return option || { id: inspectorId, name: inspectorId };
      });
      const submitTargetType = values.targetType as TargetType;
      const selectedSearchTarget = taskModalMeta.selectedTarget?.targetType === submitTargetType
        ? taskModalMeta.selectedTarget
        : null;
      const autoMatchedSearchTarget = taskModalMeta.autoMatchedTarget?.targetType === submitTargetType
        ? taskModalMeta.autoMatchedTarget
        : null;
      const searchPayload = ((selectedSearchTarget || autoMatchedSearchTarget)?.payload || {}) as Record<string, any>;
      const activityNameEn = values.activityNameEn || searchPayload.activityNameEn;
      const economicActivityName = Array.isArray(activityNameEn)
        ? activityNameEn.join(', ')
        : activityNameEn;
      const submitEstablishmentSubtypeId = values.establishmentSubTypeId || searchPayload.establishmentSubTypeId;
      const isSubmitLicenseExemptSubtype = submitTargetType === 'establishment'
        && isEstablishmentSubtypeWithoutLicenseId(submitEstablishmentSubtypeId);
      const establishmentAddress = {
        emirateId: toNumberOrUndefined(values.emirateId) || (values.emirateNameEn ? getEmirateId(values.emirateNameEn) : undefined),
        emirateNameEn: values.emirateNameEn,
        authorityId: isSubmitLicenseExemptSubtype ? undefined : toNumberOrUndefined(values.authorityId),
        authorityNameEn: isSubmitLicenseExemptSubtype ? undefined : values.authorityNameEn,
        regionId: toNumberOrUndefined(values.regionId),
        regionNameEn: values.region,
        communityId: toNumberOrUndefined(values.communityId),
        areaId: toNumberOrUndefined(values.areaId),
        areaNameEn: values.area,
        communityNameEn: values.area,
        street: values.street,
        latitude: toNumberOrUndefined(values.latitude),
        longitude: toNumberOrUndefined(values.longitude),
        mapLocationUrl: values.mapLocationUrl,
      };
      const mobileFields = submitTargetType === 'individual'
        ? buildContactNumberFields({
            value: readContactFormValue(values.mobileNumber, mobileFieldNames),
            initial: targetMobileSnapshotRef.current,
            keys: {
              fullNumber: 'mobile',
              countryCode: 'mobileCountryCode',
              localNumber: 'mobileLocalNumber',
            },
          })
        : null;
      const establishmentMobileNumber = sanitizeInspectionMobileValue(values.mobileNumber);
      const searchEstablishmentMobileNumber = sanitizeInspectionMobileValue(
        searchPayload.mobileNumber,
      );
      const baseInspectionTarget = submitTargetType === 'establishment' ? {
        targetType: 1,
        targetTypeName: values.establishmentSubType || searchPayload.establishmentSubType || 'Commercial',
        establishmentId: toNumberOrUndefined(values.establishmentId),
        userProfileId: toNumberOrUndefined(values.userProfileId),
        hasRegisteredProfile: values.hasRegisteredProfile,
        establishmentSubTypeId: toNumberOrUndefined(values.establishmentSubTypeId),
        establishmentSubType: values.establishmentSubType || searchPayload.establishmentSubType,
        establishmentNameEn: values.establishmentNameEn,
        licenseNumber: isSubmitLicenseExemptSubtype ? undefined : values.tradeLicenseNumber,
        email: values.email || searchPayload.email,
        mobile: establishmentMobileNumber || searchEstablishmentMobileNumber,
        economicActivityName,
        address: establishmentAddress,
      } : {
        targetType: 2,
        targetTypeName: 'Individual',
        individualId: toNumberOrUndefined(values.individualId),
        userProfileId: toNumberOrUndefined(values.userProfileId),
        hasRegisteredProfile: values.hasRegisteredProfile,
        establishmentNameEn: values.fullName,
        fullName: values.fullName,
        emiratesId: normalizeIndividualIdNumberValue(values.eid),
        email: values.email,
        mobile: mobileFields?.mobile || '',
        mobileCountryCode: mobileFields?.mobileCountryCode || '',
        mobileLocalNumber: mobileFields?.mobileLocalNumber || '',
        mediaLicenseNumber: values.mediaLicenseNumber,
        socialMediaAccountUsername: values.socialMediaAccountUsername,
        economicActivityName,
      };

      const inspectionMethod = values.inspectionMethod;
      if (!inspectionMethod) {
        return;
      }
      const shouldAssign = selectedInspectors.length > 0;
      const payload = {
        description: values.description,
        taskName: selectedReasonNameEn,
        taskSource: {
          sourceTypeId: 1,
          sourceTypeCode: 'MANUAL',
          sourceTypeNameEn: 'Manual',
        },
        inspectionTarget: baseInspectionTarget,
        riskProfile: {
          riskScore: 76,
          riskLevel: isCriticalContentReason ? 'CRITICAL' : isLowPriority ? 'LOW' : 'HIGH',
          riskLevelName: `${selectedPriorityNameEn || 'High'} Risk`,
        },
        inspectionConfig: {
          inspectionTypeId: inspectionMethod === 'Digital Inspection' ? 2 : 1,
          inspectionTypeNameEn: inspectionMethod,
          inspectionReasonId: selectedReasonCode,
          inspectionReasonCode: selectedReasonCode,
          inspectionReasonNameEn: selectedReasonNameEn,
          inspectionReasonNameAr: selectedReasonNameAr,
          isDigitalVisit: inspectionMethod === 'Digital Inspection',
          priorityId: selectedPriorityId,
          priorityCode: selectedPriorityCode,
          priorityNameEn: selectedPriorityNameEn,
          priorityNameAr: selectedPriorityNameAr,
          dueDate: dueDateValue,
        },
        assignment: shouldAssign ? {
          isAssigned: true,
          assignedInspector: selectedInspectors[0]?.id,
          assignedInspectors: selectedInspectors.map((item) => ({ inspectorId: item.id, inspectorName: item.name })),
        } : {
          isAssigned: false,
          assignedInspectors: [],
        },
        attachments: taskAttachments,
      };

      if (mode === 'edit' && editingTask?.taskId) {
        await updateInspectionTask({ taskId: editingTask.taskId, ...payload } as any);
        CustomMessage.success(t('inspection.tasks.messages.updated'));
      } else {
        const createWithValidatedPayload = async () => {
          await createInspectionTask(payload as any, { skipValidation: true });
          CustomMessage.success(t('inspection.tasks.messages.created'));
          syncedVisible.value = false;
          await onSubmitted();
        };
        const validation = await validateInspectionTask(payload as any);
        const validationData = validation.data;
        if (hasValidationWarnings(validationData)) {
          setDuplicateTaskWarning({
            visible: true,
            message: t('inspection.tasks.messages.duplicateWarningContent'),
            loading: false,
            onConfirm: createWithValidatedPayload,
          });
          return;
        }
        await createWithValidatedPayload();
        return;
      }

      syncedVisible.value = false;
      await onSubmitted();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      CustomMessage.error(mode === 'create' && isCampaignReason
        ? t('inspection.tasks.messages.campaignRequestFailed')
        : t('inspection.tasks.messages.saveFailed'));
      console.error('Save inspection task failed', error);
    } finally {
      taskSubmittingRef.current = false;
      setTaskSubmitting(false);
    }
  }, [
    attachmentUploading,
    campaignFilterOptions.emirates,
    campaignFilterOptions.regions,
    currentInspectorId,
    detailLoading,
    editingTask,
    form,
    getTaskSubmitEnabled,
    isCampaignReason,
    isInspectorSelfCreate,
    mode,
    onSubmitted,
    priorityLookupOptions,
    reasonLookupOptions,
    syncedVisible,
    t,
    taskAttachments,
    taskModalMeta,
  ]);

  const renderTargetSearch = useCallback(() => (
    <Form.Item
      className="inspection-task-management__modal-full-row"
      name="targetSearch"
      required={!taskModalMeta.manualTarget}
      rules={taskModalMeta.manualTarget ? [] : [{ required: true }]}
    >
      <div className="inspection-task-management__search-row">
        <Select
          showSearch
          allowClear
          showArrow={false}
          value={taskModalMeta.selectedTarget?.value}
          loading={targetSearchLoading}
          optionLabelProp="label"
          placeholder={currentTargetType === 'establishment'
            ? t('inspection.tasks.filters.searchTargetPlaceholderEstablishment')
            : t('inspection.tasks.filters.searchTargetPlaceholderIndividual')}
          className="inspection-task-management__target-search"
          dropdownClassName="inspection-task-management__target-search-dropdown"
          aria-label={t('inspection.tasks.fields.targetSearch')}
          onSearch={handleTargetSearch}
          onSelect={handleTargetSelect}
          onFocus={() => {
            if (taskModalMeta.targetSearch) {
              debouncedTargetSearch(currentTargetType, taskModalMeta.targetSearch);
            }
          }}
          onClear={() => {
            selectedTargetRef.current = null;
            setTargetSearchOptions([]);
            clearTargetFormValues(currentTargetType);
            setTaskModalMeta((current) => {
              const nextMeta = {
                ...current,
                targetSearch: '',
                manualTarget: false,
                selectedTarget: null,
                autoMatchedTarget: null,
              };
              setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
              return nextMeta;
            });
          }}
          filterOption={false}
          notFoundContent={
            <div className="inspection-task-management__target-search-empty">
              <div className="inspection-task-management__dropdown-empty-title">{t('inspection.tasks.messages.noRecordsFound')}</div>
            </div>
          }
        >
          {targetSearchOptions.map((option) => (
            <Select.Option key={option.value} value={option.value} label={option.title}>
              <SearchOptionContent option={option} />
            </Select.Option>
          ))}
        </Select>
        <Button
          className="inspection-task-management__outline-button inspection-task-management__cant-find-button"
          onClick={() => {
            selectedTargetRef.current = null;
            clearTargetFormValues(currentTargetType);
            setTargetSearchOptions([]);
            setTaskModalMeta((current) => {
              const nextMeta = {
                ...current,
                targetSearch: '',
                manualTarget: true,
                selectedTarget: null,
                autoMatchedTarget: null,
              };
              setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
              return nextMeta;
            });
          }}
        >
          {t('inspection.tasks.actions.cantFind')}
        </Button>
      </div>
    </Form.Item>
  ), [
    clearTargetFormValues,
    currentTargetType,
    debouncedTargetSearch,
    getTaskSubmitEnabled,
    handleTargetSearch,
    handleTargetSelect,
    t,
    targetSearchOptions,
    targetSearchLoading,
    taskModalMeta.manualTarget,
    taskModalMeta.selectedTarget,
    taskModalMeta.targetSearch,
  ]);

  const renderEstablishmentFields = useCallback(() => (
    <>
      {renderTargetSearch()}
      {taskModalMeta.manualTarget || taskModalMeta.selectedTarget || taskModalMeta.autoMatchedTarget ? (
        <>
          <Form.Item label={t('inspection.tasks.fields.establishmentSubtype')} name="establishmentSubType" preserve={false} rules={[{ required: true }]}>
            <Select allowClear={!isReadonlyTargetField('establishmentSubType', 'establishmentSubTypeId')} disabled={isReadonlyTargetField('establishmentSubType', 'establishmentSubTypeId')} placeholder={t('inspection.tasks.filters.selectSubtype')}>
              {establishmentSubtypeSelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.emirate')} name="emirateNameEn" preserve={false} rules={[{ required: true }]}>
            <Select allowClear={!isReadonlyTargetField('emirateNameEn', 'emirateId')} disabled={isReadonlyTargetField('emirateNameEn', 'emirateId')} placeholder={t('inspection.tasks.filters.selectEmirate')}>
              {emirateSelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          {!isLicenseExemptSubtype ? (
            <Form.Item label={t('inspection.tasks.fields.tradeLicenseNumber')} name="tradeLicenseNumber" preserve={false} rules={[{ required: true }]}>
              <Input allowClear={!isReadonlyTargetField('tradeLicenseNumber')} disabled={isReadonlyTargetField('tradeLicenseNumber')} placeholder={t('inspection.tasks.placeholders.tradeLicenseNumber')} />
            </Form.Item>
          ) : null}
          <Form.Item label={t('inspection.tasks.fields.establishmentName')} name="establishmentNameEn" preserve={false} rules={[{ required: true }]}>
            <Input allowClear={!isReadonlyTargetField('establishmentNameEn')} disabled={isReadonlyTargetField('establishmentNameEn')} placeholder={t('inspection.tasks.placeholders.establishmentName')} />
          </Form.Item>
          {!isLicenseExemptSubtype ? (
            <Form.Item label={t('inspection.tasks.columns.authority')} name="authorityNameEn" preserve={false} rules={[{ required: true }]}>
              <Select allowClear={!isReadonlyTargetField('authorityNameEn', 'authorityId')} disabled={isReadonlyTargetField('authorityNameEn', 'authorityId')} placeholder={t('inspection.tasks.filters.selectAuthority')}>
                {authoritySelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
              </Select>
            </Form.Item>
          ) : null}
          {shouldShowRegion ? (
            <Form.Item label={t('inspection.tasks.fields.region')} name="region" preserve={false} rules={[{ required: true }]}>
              <Select allowClear={!isReadonlyTargetField('region', 'regionId')} disabled={isReadonlyTargetField('region', 'regionId')} placeholder={t('inspection.tasks.filters.selectRegion')}>
                {regionSelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
              </Select>
            </Form.Item>
          ) : null}
          <Form.Item label={t('inspection.tasks.fields.area')} name="area" preserve={false} rules={[{ required: true }]}>
            <Select allowClear={!isReadonlyTargetField('area', 'areaId', 'communityId')} disabled={isReadonlyTargetField('area', 'areaId', 'communityId')} placeholder={t('inspection.tasks.filters.selectArea')}>
              {communitySelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.fields.street')} name="street" preserve={false} rules={[{ required: true }]}>
            <Input allowClear={!isReadonlyTargetField('street')} disabled={isReadonlyTargetField('street')} placeholder={t('inspection.tasks.placeholders.street')} />
          </Form.Item>
        </>
      ) : null}
    </>
  ), [
    isLicenseExemptSubtype,
    isReadonlyTargetField,
    authoritySelectOptions,
    communitySelectOptions,
    emirateSelectOptions,
    establishmentSubtypeSelectOptions,
    renderTargetSearch,
    regionSelectOptions,
    shouldShowRegion,
    t,
    taskModalMeta.manualTarget,
    taskModalMeta.autoMatchedTarget,
    taskModalMeta.selectedTarget,
  ]);

  const renderIndividualFields = useCallback(() => (
    <>
      {renderTargetSearch()}
      {taskModalMeta.manualTarget || taskModalMeta.selectedTarget || taskModalMeta.autoMatchedTarget ? (
        <>
          <Form.Item
            label={t('inspection.tasks.fields.eid')}
            name="eid"
            preserve={false}
            rules={[{ whitespace: true }]}
          >
            <Input
              allowClear={!isReadonlyTargetField('eid')}
              disabled={isReadonlyTargetField('eid')}
              placeholder={t('inspection.tasks.placeholders.eid')}
            />
          </Form.Item>
          <Form.Item
            label={t('inspection.tasks.fields.fullName')}
            name="fullName"
            normalize={normalizeArabicEnglishFullName}
            preserve={false}
            rules={isReadonlyTargetField('fullName')
              ? [{ required: true }]
              : [{ required: true, whitespace: true }]}
            validateTrigger="onBlur"
          >
            <Input allowClear={!isReadonlyTargetField('fullName')} disabled={isReadonlyTargetField('fullName')} placeholder={t('inspection.tasks.placeholders.fullName')} />
          </Form.Item>
          <Form.Item
            label={t('inspection.tasks.fields.email')}
            name="email"
            preserve={false}
            rules={[
              { required: true },
              { type: 'email', message: t('signup.please.emailFormat') },
            ]}
          >
            <Input allowClear={!isReadonlyTargetField('email')} disabled={isReadonlyTargetField('email')} placeholder={t('inspection.tasks.placeholders.email')} />
          </Form.Item>
          <Form.Item
            className="inspection-task-management__mobile-number-form-item"
            label={t('inspection.tasks.fields.mobileNumber')}
            name="mobileNumber"
            preserve={false}
            rules={[
              createMobileNumberFormRule({
                fieldNames: mobileFieldNames,
              }),
            ]}
          >
            <FormMobileNumberInput
              fieldNames={mobileFieldNames}
              defaultCountryCode=""
              placeholder={t('inspection.tasks.placeholders.mobileNumber')}
              searchPlaceholder={t('inspection.common.search')}
            />
          </Form.Item>
        </>
      ) : null}
    </>
  ), [isReadonlyTargetField, renderTargetSearch, t, taskModalMeta.manualTarget, taskModalMeta.autoMatchedTarget, taskModalMeta.selectedTarget]);

  const renderCampaignFields = useCallback(() => {
    if (isCreateCampaign) {
      return (
        <>
          <Form.Item
            className="inspection-task-management__modal-full-row"
            label={t('inspection.tasks.columns.emirate')}
            name="emirateIds"
            rules={[{ required: true }]}
          >
            <SelectAllDropdown
              options={toCampaignSelectOptions(campaignFilterOptions.emirates)}
              placeholder={t('inspection.tasks.placeholders.selectOneOrMoreEmirates')}
              showSearch={false}
              maxTagCount="responsive"
              compactMoreTag
              clearable={false}
              tagRemovable
              getPopupContainer={getSelectPopupContainer}
              className="inspection-task-management__campaign-location-select"
              dropdownPanelClassName="inspection-task-management__campaign-location-dropdown"
            />
          </Form.Item>
          {shouldShowCampaignRegion ? (
            <Form.Item
              className="inspection-task-management__modal-full-row"
              label={t('inspection.tasks.fields.region')}
              name="regionIds"
              rules={[{ required: true }]}
            >
              <SelectAllDropdown
                options={toCampaignSelectOptions(campaignRegionOptions)}
                placeholder={t('inspection.tasks.placeholders.selectOneOrMoreRegions')}
                showSearch={false}
                maxTagCount="responsive"
                compactMoreTag
                tagCountDisplay="space"
                clearable={false}
                tagRemovable
                getPopupContainer={getSelectPopupContainer}
                className="inspection-task-management__campaign-location-select"
                dropdownPanelClassName="inspection-task-management__campaign-location-dropdown"
              />
            </Form.Item>
          ) : null}
          <Form.Item
            className="inspection-task-management__modal-full-row"
            label={t('inspection.tasks.fields.area')}
            name="areaIds"
          >
            <SelectAllDropdown
              options={toCampaignSelectOptions(campaignFilterOptions.areas)}
              placeholder={t('inspection.tasks.placeholders.searchOrSelectAreas')}
              searchPlaceholder={t('inspection.tasks.placeholders.searchArea')}
              maxTagCount="responsive"
              compactMoreTag
              clearable={false}
              tagRemovable
              disabled={campaignAreaDisabled}
              getPopupContainer={getSelectPopupContainer}
              className="inspection-task-management__campaign-location-select"
              dropdownPanelClassName="inspection-task-management__campaign-location-dropdown"
            />
          </Form.Item>
          <Form.Item
            className="inspection-task-management__modal-full-row"
            label={t('inspection.tasks.fields.activity')}
            name="activityIds"
          >
            <SelectAllDropdown
              options={toCampaignSelectOptions(campaignFilterOptions.activities)}
              placeholder={t('inspection.tasks.placeholders.searchOrSelectActivities')}
              searchPlaceholder={t('inspection.tasks.placeholders.searchActivity')}
              maxTagCount={Number.MAX_SAFE_INTEGER}
              clearable={false}
              tagRemovable
              getPopupContainer={getSelectPopupContainer}
              className="inspection-task-management__campaign-location-select inspection-task-management__campaign-activity-select"
              dropdownPanelClassName="inspection-task-management__campaign-location-dropdown"
            />
          </Form.Item>
        </>
      );
    }

    return (
      <>
      <Form.Item label={t('inspection.tasks.columns.emirate')} name="emirateId" rules={[{ required: true }]}>
        <Select allowClear optionLabelProp="label" placeholder={t('inspection.tasks.filters.selectEmirate')}>
          {campaignEmirateSelectOptions.map((item) => (
            <Select.Option key={item.value} value={item.value} label={item.label} title={item.label}>
              {item.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item label={t('inspection.tasks.columns.authority')} name="authorityId" rules={[{ required: true }]}>
        <Select
          allowClear
          disabled={!campaignEmirateId || authorityLookupLoading}
          loading={authorityLookupLoading}
          optionLabelProp="label"
          placeholder={t('inspection.tasks.filters.selectAuthority')}
        >
          {campaignAuthoritySelectOptions.map((item) => (
            <Select.Option key={item.value} value={item.value} label={item.label} title={item.label}>
              {item.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item className="inspection-task-management__modal-full-row" label={t('inspection.tasks.fields.activity')} name="activityIds" rules={[{ required: true }]}>
        <Select
          allowClear
          className="inspection-task-management__campaign-activity-select"
          mode="multiple"
          maxTagCount={2}
          loading={campaignActivityLoading}
          optionFilterProp="label"
          placeholder={t('inspection.tasks.filters.selectActivity')}
        >
          {campaignActivityOptions.map((item) => (
            <Select.Option key={item.value} value={item.value} label={item.label} title={item.label}>
              {renderSelectOptionText(item.label)}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      </>
    );
  }, [
    authorityLookupLoading,
    campaignActivityLoading,
    campaignAreaDisabled,
    campaignActivityOptions,
    campaignAuthoritySelectOptions,
    campaignEmirateId,
    campaignEmirateSelectOptions,
    campaignFilterOptions.activities,
    campaignFilterOptions.areas,
    campaignFilterOptions.emirates,
    campaignRegionOptions,
    isCreateCampaign,
    shouldShowCampaignRegion,
    t,
    toCampaignSelectOptions,
  ]);

  const renderExecutionFields = useCallback(() => {
    const shouldShowInspector = !isCampaignReason;
    const shouldShowMethod = !isCampaignReason;

    return (
      <>
        {shouldShowMethod ? (
          <Form.Item label={t('inspection.tasks.columns.inspectionMethod')} name="inspectionMethod" rules={[{ required: true }]}>
            <Radio.Group className="inspection-task-management__radio-group">
              {inspectionMethodSelectOptions.map((item) => (
                <Radio key={item.value} value={item.value}>
                  {item.label}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        ) : null}
        <Form.Item
          label={t('inspection.tasks.columns.dueDate')}
          name="dueDate"
          rules={[
            { required: true },
            {
              validator: (_, value) => {
                if (!value || value.isSameOrAfter(moment().startOf('day'), 'day')) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('inspection.tasks.messages.dueDateFuture')));
              },
            },
          ]}
        >
          <DatePicker
            className="inspection-task-management__date-picker"
            format="DD/MM/YYYY"
            inputReadOnly
            placeholder={t('inspection.tasks.placeholders.dueDate')}
            disabledDate={(current) => !!current && current < moment().startOf('day')}
          />
        </Form.Item>
        {shouldShowInspector ? (
          <Form.Item className="inspection-task-management__modal-full-row" label={t('inspection.tasks.columns.inspector')} name="assignedInspector" rules={isInspectorSelfCreate ? [] : [{ required: true }]}>
            <InspectorSelect
              allowClear={!isInspectorSelfCreate}
              disabled={isInspectorSelfCreate}
              enabled={syncedVisible.value}
              maxTagCount={isInspectorSelfCreate ? undefined : 2}
              multiple={!isInspectorSelfCreate}
              placeholder={t('inspection.tasks.fields.selectInspector')}
            />
          </Form.Item>
        ) : null}
        <Form.Item className="inspection-task-management__modal-full-row inspection-task-management__remarks-form-item" label={t('inspection.tasks.fields.remarks')} name="description">
          <TaskRemarksTextArea placeholder={t('inspection.tasks.placeholders.remarks')} />
        </Form.Item>
        <Form.Item className="inspection-task-management__modal-full-row inspection-task-management__upload-form-item" label={renderAttachmentLabel(t('inspection.tasks.fields.attachments'), t('inspection.tasks.messages.attachmentsHelp'))}>
          <TaskAttachmentUpload
            value={taskAttachments}
            uploadText={t('inspection.tasks.fields.uploadFile')}
            className="inspection-task-management__task-attachment-upload"
            attachmentGridClassName="inspection-task-management__attachment-grid inspection-attachment-grid--two-columns"
            onChange={setTaskAttachments}
            onUploadingChange={setAttachmentUploading}
          />
        </Form.Item>
      </>
    );
  }, [inspectionMethodSelectOptions, isCampaignReason, isInspectorSelfCreate, syncedVisible.value, t, taskAttachments]);

  const taskSubmitButtonInactive = !taskSubmitEnabled || attachmentUploading || detailLoading || taskSubmitting;
  const taskSubmitButtonClassName = taskSubmitButtonInactive
    ? 'inspection-task-management__primary-button inspection-task-management__primary-button--visual-disabled'
    : 'inspection-task-management__primary-button';
  const campaignBatchTerminal = campaignBatchProgress?.status === 'Completed'
    || campaignBatchProgress?.status === 'Failed';
  const campaignBatchPercent = campaignBatchProgress?.total
    ? Math.min(100, Math.round((campaignBatchProgress.created / campaignBatchProgress.total) * 100))
    : 0;
  const campaignBatchStatusLabel = campaignBatchProgress
    ? {
        Pending: t('inspection.tasks.campaignBatchStatus.pending'),
        Running: t('inspection.tasks.campaignBatchStatus.running'),
        Completed: t('inspection.tasks.campaignBatchStatus.completed'),
        Failed: t('inspection.tasks.campaignBatchStatus.failed'),
      }[campaignBatchProgress.status]
    : '';

  return (
    <>
      <Modal
        className="inspection-task-management__task-modal"
        title={mode === 'create' ? t('inspection.tasks.createTask') : t('inspection.tasks.editTask')}
        visible={syncedVisible.value}
        centered
        forceRender
        closable={!taskSubmitting}
        keyboard={!taskSubmitting}
        maskClosable={!taskSubmitting}
        onCancel={closeModal}
        footer={(
          <div className="inspection-task-management__modal-footer-actions">
            <Button className="inspection-task-management__outline-button" disabled={taskSubmitting} onClick={closeModal}>
              {t('inspection.common.cancel')}
            </Button>
            <Button
              className={taskSubmitButtonClassName}
              aria-disabled={taskSubmitButtonInactive}
              loading={detailLoading || taskSubmitting}
              onClick={handleTaskSubmit}
            >
              {mode === 'create' ? t('inspection.tasks.createTask') : t('inspection.common.save')}
            </Button>
          </div>
        )}
      >
        <SimpleBar
          autoHide
          className="inspection-task-management__task-modal-scroll"
        >
          <div
            className="inspection-task-management__task-modal-scroll-content"
            ref={(element) => {
              if (element) {
                element.inert = isCreateCampaign && (taskSubmitting || duplicateTaskWarning.campaignCount !== undefined);
              }
            }}
          >
            <Form form={form} layout="vertical" className="inspection-task-management__task-form" onValuesChange={handleTaskFormValuesChange}>
          <Form.Item name="establishmentSubTypeId" hidden>
            <Input />
          </Form.Item>
          <div className="inspection-task-management__modal-section">
            <div className="inspection-task-management__modal-section-title">{t('inspection.tasks.sections.taskInformation')}</div>
            <div className="inspection-task-management__modal-grid">
              <Form.Item label={t('inspection.tasks.columns.inspectionReason')} name="inspectionReasonCode" rules={[{ required: true }]}>
                <Select
                  allowClear
                  showSearch={false}
                  filterOption={false}
                  optionLabelProp="label"
                  placeholder={t('inspection.tasks.filters.selectInspectionReason')}
                  dropdownClassName="inspection-task-management__reason-select-dropdown"
                  dropdownRender={renderReasonDropdown}
                  getPopupContainer={getSelectPopupContainer}
                  listHeight={280}
                  menuItemSelectedIcon={null}
                  open={reasonDropdownOpen}
                  virtual={false}
                  onClear={handleReasonSearchClear}
                  onDropdownVisibleChange={handleReasonDropdownVisibleChange}
                  onSelect={handleReasonSelect}
                  notFoundContent={(
                    <div className="inspection-task-management__dropdown-empty">{t('inspection.tasks.messages.noRecordsFound')}</div>
                  )}
                >
                  {filteredReasonOptions.map(({ value, label }) => {
                    return (
                      <Select.Option key={value} value={value} label={label} title={label}>
                        {renderSelectOptionText(label)}
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
              <Form.Item label={t('inspection.tasks.columns.priority')} name="priorityCode" rules={[{ required: true }]}>
                <Select allowClear placeholder={t('inspection.tasks.filters.selectPriority')}>
                  {prioritySelectOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
                </Select>
              </Form.Item>
            </div>
          </div>

          <div className="inspection-task-management__modal-section">
            <div className="inspection-task-management__modal-section-title">{t('inspection.tasks.sections.inspectionTarget')}</div>
            <div className="inspection-task-management__modal-grid">
              {!isCampaignReason ? (
                <Form.Item className="inspection-task-management__modal-full-row" label={t('inspection.tasks.fields.targetType')} name="targetType" initialValue="establishment" required>
                  <Radio.Group className="inspection-task-management__radio-group">
                    <Radio value="establishment">{t('inspection.target.establishment')}</Radio>
                    <Radio value="individual">{t('inspection.target.individual')}</Radio>
                  </Radio.Group>
                </Form.Item>
              ) : null}

              {isCampaignReason
                ? renderCampaignFields()
                : currentTargetType === 'establishment'
                  ? renderEstablishmentFields()
                  : renderIndividualFields()}
            </div>
          </div>

          <div className="inspection-task-management__modal-section">
            <div className="inspection-task-management__modal-section-title">{t('inspection.tasks.sections.executionTimeline')}</div>
            <div className="inspection-task-management__modal-grid">
              {renderExecutionFields()}
            </div>
          </div>
            </Form>
          </div>
        </SimpleBar>
      </Modal>
      <DuplicateTaskWarningModal
        visible={duplicateTaskWarning.visible}
        title={duplicateTaskWarning.campaignCount !== undefined
          ? t('inspection.tasks.messages.campaignExistingTasksTitle')
          : t('inspection.tasks.messages.duplicateWarningTitle')}
        message={duplicateTaskWarning.campaignCount !== undefined
          ? t('inspection.tasks.messages.campaignExistingTasksContent', { count: duplicateTaskWarning.campaignCount })
          : duplicateTaskWarning.message}
        cancelText={duplicateTaskWarning.campaignCount !== undefined
          ? t('inspection.common.cancel')
          : t('inspection.common.no')}
        confirmText={t('inspection.common.continue')}
        confirmLoading={duplicateTaskWarning.loading}
        onCancel={closeDuplicateTaskWarning}
        onConfirm={confirmDuplicateTaskWarning}
      />
      <Modal
        className="inspection-task-management__campaign-progress-modal"
        title={t('inspection.tasks.messages.campaignBatchProgressTitle')}
        visible={Boolean(campaignBatchProgress)}
        centered
        width={640}
        closable={campaignBatchTerminal}
        keyboard={campaignBatchTerminal}
        maskClosable={false}
        onCancel={() => {
          if (campaignBatchTerminal) setCampaignBatchProgress(null);
        }}
        footer={campaignBatchTerminal ? (
          <Button
            className="inspection-task-management__primary-button"
            onClick={() => setCampaignBatchProgress(null)}
          >
            {t('common.close')}
          </Button>
        ) : null}
      >
        {campaignBatchProgress ? (
          <div className="inspection-task-management__campaign-progress">
            <Progress
              percent={campaignBatchPercent}
              status={campaignBatchProgress.status === 'Failed'
                ? 'exception'
                : campaignBatchProgress.status === 'Completed'
                  ? 'success'
                  : 'active'}
            />
            <div className="inspection-task-management__campaign-progress-status">
              {campaignBatchStatusLabel}
            </div>
            <div className="inspection-task-management__campaign-progress-counts">
              <span>{t('inspection.tasks.messages.campaignBatchCreatedCount', {
                created: campaignBatchProgress.created,
                total: campaignBatchProgress.total,
              })}</span>
              <span>{t('inspection.tasks.messages.campaignBatchFailedCount', {
                count: campaignBatchProgress.failed,
              })}</span>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default CreateTaskModal;
