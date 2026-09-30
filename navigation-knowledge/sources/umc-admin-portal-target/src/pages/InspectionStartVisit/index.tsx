import { nowGst, toApi } from "@/utils/gstTime";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Form, Input, InputNumber, Radio, Select, Spin, Table, Tooltip, Upload, message } from 'antd';
import type { RcFile } from 'antd/lib/upload';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import moment from 'moment';
import i18next from 'i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CustomMessage,
  DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
  createOverviewQuickNavTarget,
  type OverviewQuickNavTarget as SharedOverviewQuickNavTarget,
} from '@/components/common';
import PreviewModal from '@/components/common/PreviewModal';
import {
  createMobileNumberFormRule,
  DEFAULT_COUNTRY_DIAL_CODE,
  FormMobileNumberInput,
} from '@/components/common/MobileNumberInput';
import { INSPECTION_DECLARATION_TEMPLATE_PREVIEW_FILE } from '@/constants/inspectionDeclarationTemplate';
import { UPLOAD_LIMITS } from '@/constants/uploadLimits';
import { KEEP_ALIVE_RESTORE_STATE_KEY } from '@/components/KeepAlive/constants';
import {
  consumeInspectionLeaveConfirmBypass,
  INSPECTION_EXECUTION_SAVE_DRAFT_EVENT,
} from '@/utils/inspectionExecutionLeaveGuard';
import {
  buildContactNumberFields,
  createContactNumberSnapshot,
  normalizeEditedMobileLocalNumber,
  readContactFormValue,
  splitInternationalMobileNumber,
  toContactFormValue,
} from '@/components/common/MobileNumberInput';
import {
  checkinInspectionTask,
  checkoutInspectionTask,
  getAdminInspectionTaskDetail,
  INSPECTION_EXECUTION_STEP_CODES,
  INSPECTION_EXECUTION_STEP_IDS,
  getInspectionDigitalAccessFailedReasons,
  getInspectionFieldAccessFailedReasons,
  getInspectionChecklistTemplateItems,
  getInspectionContactPersonOptions,
  getInspectionLanguages,
  getInspectionMaterialTypes,
  getInspectionSocialMediaLookupOptions,
  getInspectionTaskChecklistItems,
  getInspectionTaskDigitalPresence,
  getInspectionTaskDetail,
  isInspectionDataMissingError,
  normalizeInspectionExecutionStep,
  saveInspectionChecklist,
  saveInspectionContactPerson,
  saveInspectionContactPersonDeclaration,
  saveInspectionReinspection,
  saveInspectionSeizedMaterials,
  scanInspectionOcr,
  startInspectionVisit,
  submitAccessFailedInspectionTask,
  submitInspectionTaskReport,
  updateInspectionOcrScan,
} from '@/services/inspection';
import type {
  InspectionCreatedViolationSummary,
  InspectionDigitalPresenceData,
  InspectionDigitalPresenceSocialMedia,
  InspectionDigitalPresenceWebsite,
  InspectionChecklistTemplateCatalogItem,
  InspectionContactPersonOption,
  InspectionExecutionStepKey,
  InspectionLanguageLookupOption,
  InspectionLookupOption,
  InspectionOcrEditPayload,
  InspectionOcrResult,
  InspectionOcrScanSubType,
  InspectionSocialMediaLookupOption,
  InspectionTaskAttachmentPayload,
  InspectionTaskDetailFragmentKey,
  SubmitInspectionReportData,
  SubmitInspectionTaskReportPayload,
} from '@/services/inspection';
import shrinkIcon from '@/assets/images/shrink_icon.svg';
import toastSuccessIcon from '@/assets/icons/toast-success.svg';
import accessedSuccessfullyStatusIcon from '@/pages/InspectionCommon/assets/images/check.svg';
import accessedSuccessfullyActionIcon from '@/pages/InspectionCommon/assets/images/wancheng.svg';
import visitLocationActionIcon from '@/pages/InspectionCommon/assets/images/check-location.svg';
import FullScreen from '@/components/common/ApplicationOverviewCards/FullScreen/FullScreen';
import type { SelfMonitorProgramInfo } from '@/components/common/SelfMonitorBadge';
import {
  getUserEstablishmentByID,
  profileAndApplicant,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from '@/services/userProfile';
import {
  buildInspectionPath,
  formatDate,
  formatDateTime,
  getAssigneeName,
  getLocalizedText,
  hasStartedPreVisitExecution,
  getTaskAddress,
  getTaskEmirateName,
  getTaskLicenseNumber,
  getTaskTargetName,
} from '../InspectionCommon/helpers';
import {
  INSPECTION_QUERY_KEYS,
  INSPECTION_PATHS,
  INSPECTION_ROUTE_STATE_KEYS,
  formatInspectionAttachmentFileTypes,
} from '../InspectionCommon/constants';
import { inspectionFigmaAssets } from '../InspectionCommon/assets';
import { uploadInspectionFile } from '../InspectionCommon/upload';
import {
  getTargetOverviewStatusTone,
  TargetOverviewCard,
  type TargetOverviewData,
} from '../InspectionCommon/components/TargetOverviewCard';
import { resolveInspectionOverviewIdentity } from '../InspectionCommon/inspectionOverviewIdentity';
import { getInspectionTaskEmirateLabel } from '../InspectionTaskManagement/taskConfig';
import { DetailCardHeader } from '../InspectionCommon/components/DetailCardHeader';
import { AiRiskInsightCard } from '../InspectionCommon/components/AiRiskInsightCard';
import SignaturePad from '../InspectionCommon/components/SignaturePad';
import FullViolationListModal from './components/FullViolationListModal';
import InspectionAttachmentGrid, { type InspectionAttachmentSource } from './components/InspectionAttachmentGrid';
import OcrResultModal from './components/OcrResultModal';
import OcrTypeModal, { type OcrActionSource, type OcrTypeModalSelection } from './components/OcrTypeModal';
import PreVisitChecklistModal from './components/PreVisitChecklistModal';
import SeizedMaterialsDecisionModal from './components/SeizedMaterialsDecisionModal';
import SubmitReportModal from './components/SubmitReportModal';
import SubmitSuccessModal from './components/SubmitSuccessModal';
import UnableToAccessModal, { type UnableToAccessModalValue } from './components/UnableToAccessModal';
import {
  showAccessedSuccessfullyConfirm,
  showDeselectViolationConfirm,
  showLeavePageConfirm,
  showRemoveViolationConfirm,
} from './components/inspectionVisitModalConfirm';
import './index.less';

const INSPECTION_EXECUTION_DETAIL_FRAGMENTS: readonly InspectionTaskDetailFragmentKey[] = [
  'targetOverview',
  'report',
  'executionResult',
  'timeline',
  'review',
  'lastInspection',
  'reinspectionTask',
];

const unwrapPayload = <T,>(response: any): T => response?.data ?? response;
const ensureArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);
const getFirstTextValue = (...values: unknown[]) => (
  values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
);
type BlockedNavigationAction = 'PUSH' | 'REPLACE' | 'POP';
type BlockedNavigationLocation = {
  pathname: string;
  search?: string;
  hash?: string;
  state?: any;
};

const getLocationPath = (target: BlockedNavigationLocation) => (
  `${target.pathname || ''}${target.search || ''}${target.hash || ''}`
);
const EID_ATTACHMENT_ACCEPT = '.pdf,application/pdf';
const INSPECTION_ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.pdf';
const INSPECTION_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const INSPECTION_ATTACHMENT_MAX_SIZE_MB = 5;
const INSPECTION_ATTACHMENT_MAX_COUNT = UPLOAD_LIMITS.MULTI_ATTACHMENT;
const normalizeLocalizedDigits = (value: unknown) => String(value ?? '')
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

const getDigitsOnlyValue = (value: unknown, maxLength?: number) => {
  const digits = normalizeLocalizedDigits(value).replace(/\D/g, '');
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
};
const isDigitsOnlyText = (value: unknown) => /^\d+$/.test(normalizeLocalizedDigits(value));
const getPositiveIntegerNumber = (value: unknown) => {
  const digits = getDigitsOnlyValue(value).replace(/^0+/, '');
  if (!digits) return undefined;
  const numberValue = Number(digits);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
};
const formatPositiveIntegerInput = (
  value: string | number | undefined,
  info?: { userTyping: boolean; input: string },
) => getDigitsOnlyValue(info?.userTyping && info.input ? info.input : value).replace(/^0+/, '');
const parsePositiveIntegerInput = (value?: string) => getPositiveIntegerNumber(value) ?? '';
const digitInputControlKeys = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
  'Enter',
  'Escape',
]);
const preventNonDigitKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.ctrlKey || event.metaKey || digitInputControlKeys.has(event.key)) return;
  if (event.key.length === 1 && !/^\d$/.test(event.key)) {
    event.preventDefault();
  }
};
const preventInvalidPositiveIntegerPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
  const text = event.clipboardData.getData('text');
  if (text && (!isDigitsOnlyText(text) || !getPositiveIntegerNumber(text))) {
    event.preventDefault();
  }
};
const normalizeContactPersonIdNumber = (value: unknown) => String(value ?? '').trim();

const getFileExtension = (fileName?: unknown) => {
  const text = String(fileName || '').trim();
  const dotIndex = text.lastIndexOf('.');
  return dotIndex >= 0 ? text.slice(dotIndex).toLowerCase() : '';
};

const isPdfUploadFile = (file: { name?: unknown; fileName?: unknown; type?: unknown; contentType?: unknown }) => {
  const fileName = String(file?.name || file?.fileName || '').trim();
  const contentType = String(file?.type || file?.contentType || '').trim().toLowerCase();

  return contentType === 'application/pdf' || /\.pdf$/i.test(fileName);
};

const buildInspectionUploadedAttachment = (
  uploadResult: Awaited<ReturnType<typeof uploadInspectionFile>>,
  attachmentCategory: string,
): InspectionTaskAttachmentPayload => ({
  fileName: uploadResult.fileName,
  fileUrl: uploadResult.fileUrl,
  contentType: uploadResult.contentType,
  attachmentCategory,
});

const normalizeDeclarationDocumentUrl = (url?: string) => {
  if (!url) return undefined;
  return url;
};

const getDocumentItemUrl = (item: any) => getFirstTextValue(
  item?.fileUrl,
  item?.url,
  item?.attachmentFileUrl,
  item?.previewUrl,
  item?.downloadUrl,
);

const getDocumentItemName = (item: any) => getFirstTextValue(
  item?.fileName,
  item?.name,
  item?.attachmentFileName,
  item?.title,
);

const isDeclarationDocumentAttachment = (item: any) => {
  const descriptor = [
    item?.attachmentCategory,
    item?.documentType,
    item?.relatedEntityType,
    item?.fileName,
    item?.name,
  ].filter(Boolean).join(' ').toLowerCase();

  return descriptor.includes('declaration');
};

const getDeclarationDocumentItems = (source: any) => [
  ...ensureArray<any>(source?.declarationDocuments),
  ...ensureArray<any>(source?.declarationAttachments),
  ...(source?.declarationDocument ? [source.declarationDocument] : []),
  ...ensureArray<any>(source?.attachments).filter(isDeclarationDocumentAttachment),
];

const getDeclarationDocumentUrl = (...sources: any[]) => {
  for (const source of sources.flatMap((item) => ensureArray<any>(Array.isArray(item) ? item : [item]))) {
    if (source) {
      const directUrl = getFirstTextValue(
        source.declarationDocumentFileUrl,
        source.declarationDocumentUrl,
        source.signedDeclarationUrl,
        source.templateFileUrl,
        source.templateUrl,
      );

      if (directUrl) return normalizeDeclarationDocumentUrl(directUrl);

      const documentUrl = getDeclarationDocumentItems(source)
        .map(getDocumentItemUrl)
        .find(Boolean);

      if (documentUrl) return normalizeDeclarationDocumentUrl(documentUrl);
    }
  }

  return undefined;
};

const getDeclarationDocumentFileName = (...sources: any[]) => {
  for (const source of sources.flatMap((item) => ensureArray<any>(Array.isArray(item) ? item : [item]))) {
    if (source) {
      const directName = getFirstTextValue(
        source.declarationDocumentFileName,
        source.declarationDocumentName,
        source.templateFileName,
        source.templateName,
      );

      if (directName) return directName;

      const documentName = getDeclarationDocumentItems(source)
        .map(getDocumentItemName)
        .find(Boolean);

      if (documentName) return documentName;
    }
  }

  return undefined;
};

const autoReinspectionViolationCodes = new Set(['L1', 'L2', 'L4', 'L10']);

type ExecutionStepKey = InspectionExecutionStepKey;
type LocalExecutionDraft = {
  accessResult?: string;
  accessReason?: string;
  accessRemark?: string;
  accessAttachments?: any[];
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checklistTemplateSignature?: string;
  hasSeizedMaterials?: boolean | null;
  seizedMaterials?: any[];
  contactPerson?: Record<string, any> | null;
  [key: string]: unknown;
};
type ReviewSectionKey = 'checklist' | 'seizedMaterials' | 'contactPerson';
type SeizedMaterialFieldKey = 'materialType' | 'isbn' | 'title' | 'author' | 'languageId' | 'quantity';
type SeizedMaterialValidationErrors = Record<string, Partial<Record<SeizedMaterialFieldKey, string>>>;
type SideSectionKey = 'taskDetails' | 'aiRiskInsight' | 'targetOverview';
type TargetOverviewFullScreenType = 'Individual' | 'Commercial';
type TaskDetailsExpandedSectionKey = 'taskInformation' | 'targetHighlight' | 'executionTimeline' | 'relatedInspection';
type InspectionSubmitToastKind = 'inspectionCompleted' | 'violationSubmitted' | 'reinspectionCreated';
type PendingInspectionSubmitToast = {
  kind: InspectionSubmitToastKind;
  violation?: InspectionCreatedViolationSummary | null;
};
type PendingInspectionReportSubmission = {
  taskKey: string;
  payload: SubmitInspectionTaskReportPayload;
  toastKind?: InspectionSubmitToastKind;
};
type ChecklistValidationReason = 'missingChecklist' | 'missingResult' | 'contentViolationSelection' | 'violationEvidence';
type TargetOverviewProfileAndApplicantData = {
  userId?: string | number | null;
  userProfileId?: string | number | null;
  personalName?: string | null;
  personalNameAr?: string | null;
  userName?: string | null;
  personalEmail?: string | null;
  userEmail?: string | null;
  personalPhoneNumber?: string | null;
  phoneNumber?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  uid?: string | null;
  documentCount?: number | string | null;
  nationalityObj?: {
    id?: number | string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  } | null;
  isVip?: boolean;
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  profileStatusObj?: {
    id?: number | string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  } | null;
};
type TargetOverviewEstablishmentData = IEstablishmentOverview & {
  emiratesInfo?: {
    id?: number | string | null;
    code?: string | null;
    name?: string | null;
  } | null;
};

const SEIZED_MATERIAL_FIELD_KEYS: SeizedMaterialFieldKey[] = [
  'materialType',
  'isbn',
  'title',
  'author',
  'languageId',
  'quantity',
];
const SEIZED_MATERIAL_TYPE_FIELD_KEYS = ['materialType', 'materialTypeCode', 'materialTypeName', 'publicationType'];

const isSeizedMaterialFieldKey = (value: string): value is SeizedMaterialFieldKey =>
  SEIZED_MATERIAL_FIELD_KEYS.includes(value as SeizedMaterialFieldKey);

const getSeizedMaterialPatchFields = (patch: Record<string, any>): SeizedMaterialFieldKey[] => {
  const patchKeys = Object.keys(patch);
  if (patchKeys.some((key) => SEIZED_MATERIAL_TYPE_FIELD_KEYS.includes(key))) {
    return SEIZED_MATERIAL_FIELD_KEYS;
  }
  return patchKeys.filter(isSeizedMaterialFieldKey);
};

type ChecklistValidationState = {
  reason: ChecklistValidationReason;
  message: string;
  categoryIndex?: number;
  itemIndex?: number;
  categoryKey?: string;
  itemKey?: string;
};

type TargetOverviewQuickNavTarget = SharedOverviewQuickNavTarget;

type OcrFlow = 'checklist' | 'seizedMaterials';

type PendingOcrSelection = {
  publicationType: InspectionOcrScanSubType;
  source: OcrActionSource;
  flow: OcrFlow;
};

type ExecutionStepConfig = {
  key: ExecutionStepKey;
  labelKey: string;
};

const DEFAULT_TARGET_OVERVIEW_QUICK_NAV: TargetOverviewQuickNavTarget = {
  ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
};

type DetailField = {
  key: string;
  label: string;
  value: React.ReactNode;
  wide?: boolean;
  tone?: 'gold' | 'status-success' | 'status-warning' | 'status-danger' | 'status-neutral';
  onClick?: () => void;
};

type TaskDetailsAttachmentItem = {
  key: string;
  name: string;
  type: string;
  url?: string;
};

type TargetAccessCardKey = 'targetAccessInformation' | 'digitalPresence';

type SocialMediaPlatform = 'instagram' | 'x' | 'youtube' | 'tiktok' | 'facebook' | 'snapchat';

type SocialMediaDisplayItem = {
  key: string;
  label: string;
  platform?: SocialMediaPlatform;
  url?: string;
};

type WebsiteDisplayItem = {
  key: string;
  label: string;
  url?: string;
};

const contactMobileFieldNames = {
  countryCode: 'mobileCountryCode',
  phoneNumber: 'mobileLocalNumber',
};

const createDefaultContactMobileSnapshot = () => createContactNumberSnapshot({
  countryCode: DEFAULT_COUNTRY_DIAL_CODE,
  localNumber: '',
  fullNumber: '',
});

const createContactPersonMobileSnapshot = (contact: Record<string, any>) => {
  const nestedMobileValue = typeof contact.mobilePhone === 'object' && contact.mobilePhone
    ? readContactFormValue(contact.mobilePhone, contactMobileFieldNames)
    : { countryCode: '', phoneNumber: '' };
  const countryCode = contact.mobileCountryCode ?? nestedMobileValue.countryCode;
  const localNumber = contact.mobileLocalNumber ?? nestedMobileValue.phoneNumber;
  const fullNumber = typeof contact.mobilePhone === 'string'
    ? contact.mobilePhone
    : contact.mobile;
  const splitFullNumber = !localNumber && fullNumber
    ? splitInternationalMobileNumber(
      String(fullNumber),
      String(countryCode || DEFAULT_COUNTRY_DIAL_CODE),
    )
    : null;
  const resolvedCountryCode =
    countryCode || splitFullNumber?.countryCode || DEFAULT_COUNTRY_DIAL_CODE;
  const resolvedLocalNumber = normalizeEditedMobileLocalNumber(
    String(resolvedCountryCode),
    String(localNumber || splitFullNumber?.phoneNumber || ''),
  );
  const isEmptyMobile = !countryCode && !localNumber && !fullNumber;
  return createContactNumberSnapshot({
    countryCode: isEmptyMobile ? DEFAULT_COUNTRY_DIAL_CODE : resolvedCountryCode,
    localNumber: resolvedLocalNumber,
    fullNumber,
  });
};

const socialMediaIconMap: Record<SocialMediaPlatform, { viewBox: string; path: string }> = {
  instagram: {
    viewBox: '0 0 13 13',
    path: 'M9.5 0H3.5C2.57205 0.000992641 1.68238 0.37006 1.02622 1.02622C0.37006 1.68238 0.000992641 2.57205 0 3.5V9.5C0.000992641 10.428 0.37006 11.3176 1.02622 11.9738C1.68238 12.6299 2.57205 12.999 3.5 13H9.5C10.428 12.999 11.3176 12.6299 11.9738 11.9738C12.6299 11.3176 12.999 10.428 13 9.5V3.5C12.999 2.57205 12.6299 1.68238 11.9738 1.02622C11.3176 0.37006 10.428 0.000992641 9.5 0ZM6.5 9.5C5.90666 9.5 5.32664 9.32405 4.83329 8.99441C4.33994 8.66476 3.95542 8.19623 3.72836 7.64805C3.5013 7.09987 3.44189 6.49667 3.55764 5.91473C3.6734 5.33279 3.95912 4.79824 4.37868 4.37868C4.79824 3.95912 5.33279 3.6734 5.91473 3.55764C6.49667 3.44189 7.09987 3.5013 7.64805 3.72836C8.19623 3.95542 8.66476 4.33994 8.99441 4.83329C9.32405 5.32664 9.5 5.90666 9.5 6.5C9.49917 7.2954 9.18284 8.05798 8.62041 8.62041C8.05798 9.18284 7.2954 9.49917 6.5 9.5ZM10.25 3.5C10.1017 3.5 9.95666 3.45601 9.83332 3.3736C9.70999 3.29119 9.61386 3.17406 9.55709 3.03701C9.50033 2.89997 9.48547 2.74917 9.51441 2.60368C9.54335 2.4582 9.61478 2.32456 9.71967 2.21967C9.82456 2.11478 9.9582 2.04335 10.1037 2.01441C10.2492 1.98547 10.4 2.00032 10.537 2.05709C10.6741 2.11386 10.7912 2.20999 10.8736 2.33332C10.956 2.45666 11 2.60166 11 2.75C11 2.94891 10.921 3.13968 10.7803 3.28033C10.6397 3.42098 10.4489 3.5 10.25 3.5ZM8.5 6.5C8.5 6.89556 8.3827 7.28224 8.16294 7.61114C7.94318 7.94004 7.63082 8.19638 7.26537 8.34776C6.89991 8.49913 6.49778 8.53874 6.10982 8.46157C5.72186 8.3844 5.36549 8.19392 5.08579 7.91421C4.80608 7.63451 4.6156 7.27814 4.53843 6.89018C4.46126 6.50222 4.50087 6.10009 4.65224 5.73463C4.80362 5.36918 5.05996 5.05682 5.38886 4.83706C5.71776 4.6173 6.10444 4.5 6.5 4.5C7.03043 4.5 7.53914 4.71071 7.91421 5.08579C8.28929 5.46086 8.5 5.96957 8.5 6.5Z',
  },
  x: {
    viewBox: '0 0 10.9997 12',
    path: 'M10.9377 11.7406C10.8947 11.819 10.8314 11.8845 10.7544 11.9301C10.6775 11.9757 10.5897 11.9999 10.5002 12H7.50024C7.41609 12 7.33331 11.9787 7.25956 11.9382C7.18582 11.8976 7.12349 11.8392 7.07837 11.7681L4.54774 7.79125L0.870243 11.8363C0.780595 11.9326 0.656602 11.9896 0.525147 11.9951C0.393692 12.0006 0.265369 11.9541 0.168001 11.8656C0.070632 11.7771 0.012065 11.6538 0.00499701 11.5224C-0.00207097 11.391 0.04293 11.2622 0.130243 11.1637L3.99087 6.91375L0.0783682 0.76875C0.0301817 0.693152 0.00320702 0.605989 0.000268694 0.516388C-0.00266963 0.426787 0.0185364 0.338044 0.0616665 0.259451C0.104797 0.180859 0.168264 0.115308 0.245423 0.0696624C0.322582 0.0240171 0.410594 -4.35397e-05 0.500243 5.91468e-08H3.50024C3.58439 2.60814e-05 3.66718 0.0212907 3.74092 0.0618237C3.81467 0.102357 3.87699 0.160847 3.92212 0.231875L6.45274 4.20875L10.1302 0.16375C10.2199 0.0674492 10.3439 0.0103647 10.4753 0.00487238C10.6068 -0.0006199 10.7351 0.0459229 10.8325 0.13441C10.9299 0.222897 10.9884 0.346196 10.9955 0.477576C11.0026 0.608956 10.9576 0.737828 10.8702 0.83625L7.00962 5.08313L10.9221 11.2319C10.97 11.3075 10.9968 11.3946 10.9995 11.4841C11.0023 11.5736 10.9809 11.6622 10.9377 11.7406Z',
  },
  youtube: {
    viewBox: '0 0 14 11',
    path: 'M13.6456 1.845C13.5867 1.61459 13.4739 1.40149 13.3164 1.22327C13.159 1.04505 12.9614 0.90683 12.74 0.820002C10.5975 -0.00749767 7.1875 2.37745e-06 7 2.37745e-06C6.8125 2.37745e-06 3.4025 -0.00749767 1.26 0.820002C1.0386 0.90683 0.841021 1.04505 0.683559 1.22327C0.526097 1.40149 0.413266 1.61459 0.354375 1.845C0.1925 2.46875 0 3.60875 0 5.5C0 7.39125 0.1925 8.53125 0.354375 9.155C0.413178 9.38552 0.525969 9.59875 0.683436 9.77709C0.840904 9.95542 1.03853 10.0937 1.26 10.1806C3.3125 10.9725 6.525 11 6.95875 11H7.04125C7.475 11 10.6894 10.9725 12.74 10.1806C12.9615 10.0937 13.1591 9.95542 13.3166 9.77709C13.474 9.59875 13.5868 9.38552 13.6456 9.155C13.8075 8.53 14 7.39125 14 5.5C14 3.60875 13.8075 2.46875 13.6456 1.845ZM9.13875 5.70813L6.13875 7.70813C6.10109 7.73325 6.05732 7.74768 6.0121 7.74987C5.96688 7.75206 5.92192 7.74193 5.882 7.72057C5.84209 7.6992 5.80873 7.66739 5.78548 7.62855C5.76223 7.5897 5.74997 7.54527 5.75 7.5V3.5C5.74997 3.45473 5.76223 3.4103 5.78548 3.37146C5.80873 3.33261 5.84209 3.30081 5.882 3.27944C5.92192 3.25807 5.96688 3.24794 6.0121 3.25013C6.05732 3.25232 6.10109 3.26675 6.13875 3.29188L9.13875 5.29188C9.17304 5.3147 9.20116 5.34564 9.22061 5.38195C9.24007 5.41826 9.25024 5.45881 9.25024 5.5C9.25024 5.54119 9.24007 5.58175 9.22061 5.61806C9.20116 5.65437 9.17304 5.68531 9.13875 5.70813Z',
  },
  tiktok: {
    viewBox: '0 0 13 13.5',
    path: 'M13 4V6.5C13 6.63261 12.9473 6.75979 12.8536 6.85355C12.7598 6.94732 12.6326 7 12.5 7C11.4555 7.00243 10.426 6.75128 9.5 6.26813V8.75C9.5 10.0098 8.99955 11.218 8.10876 12.1088C7.21796 12.9996 6.00978 13.5 4.75 13.5C3.49022 13.5 2.28204 12.9996 1.39124 12.1088C0.500445 11.218 0 10.0098 0 8.75C0 6.44375 1.68187 4.405 3.9125 4.0075C3.98446 3.99471 4.05835 3.99785 4.12896 4.0167C4.19958 4.03555 4.2652 4.06966 4.32121 4.11661C4.37722 4.16356 4.42226 4.22223 4.45315 4.28847C4.48404 4.35471 4.50003 4.42691 4.5 4.5V7.16813C4.50003 7.26275 4.47321 7.35545 4.42265 7.43544C4.37209 7.51543 4.29987 7.57943 4.21438 7.62C4.01227 7.71585 3.83959 7.86417 3.71434 8.04949C3.58909 8.23481 3.51587 8.45035 3.5023 8.67361C3.48873 8.89688 3.53533 9.11969 3.63721 9.31882C3.7391 9.51794 3.89255 9.68608 4.08156 9.80569C4.27057 9.9253 4.48822 9.99201 4.71179 9.99884C4.93536 10.0057 5.15667 9.9524 5.35264 9.84456C5.54861 9.73673 5.71205 9.57828 5.82591 9.38576C5.93978 9.19323 5.9999 8.97368 6 8.75V0.5C6 0.367392 6.05268 0.240215 6.14645 0.146447C6.24021 0.0526784 6.36739 0 6.5 0H9C9.13261 0 9.25979 0.0526784 9.35355 0.146447C9.44732 0.240215 9.5 0.367392 9.5 0.5C9.50083 1.2954 9.81716 2.05798 10.3796 2.62041C10.942 3.18284 11.7046 3.49917 12.5 3.5C12.6326 3.5 12.7598 3.55268 12.8536 3.64645C12.9473 3.74021 13 3.86739 13 4Z',
  },
  facebook: {
    viewBox: '0 0 13 12.9558',
    path: 'M13 6.49925C12.9979 8.08788 12.4151 9.62094 11.3612 10.8097C10.3072 11.9984 8.85504 12.7607 7.2781 12.953C7.24298 12.957 7.20743 12.9535 7.17377 12.9427C7.14011 12.9319 7.10912 12.9141 7.08284 12.8905C7.05656 12.8669 7.03559 12.838 7.0213 12.8056C7.00702 12.7733 6.99975 12.7383 6.99997 12.703V7.99925H8.49997C8.56852 7.9994 8.63636 7.98546 8.69929 7.95828C8.76221 7.93111 8.81888 7.89129 8.86577 7.84129C8.91266 7.7913 8.94877 7.7322 8.97186 7.66766C8.99494 7.60312 9.00451 7.53452 8.99997 7.46613C8.98893 7.33755 8.92961 7.21793 8.83395 7.13131C8.73829 7.0447 8.61338 6.99751 8.48435 6.99925H6.99997V5.49925C6.99997 5.23404 7.10533 4.97968 7.29286 4.79215C7.4804 4.60461 7.73475 4.49925 7.99997 4.49925H8.99997C9.06852 4.4994 9.13636 4.48546 9.19929 4.45829C9.26221 4.43111 9.31888 4.39129 9.36577 4.34129C9.41266 4.2913 9.44877 4.2322 9.47186 4.16766C9.49494 4.10312 9.50451 4.03452 9.49997 3.96613C9.48891 3.83734 9.42942 3.71753 9.33349 3.63088C9.23756 3.54424 9.11235 3.4972 8.9831 3.49925H7.99997C7.46954 3.49925 6.96083 3.70997 6.58576 4.08504C6.21069 4.46011 5.99997 4.96882 5.99997 5.49925V6.99925H4.49997C4.43143 6.9991 4.36359 7.01305 4.30066 7.04022C4.23773 7.06739 4.18106 7.10721 4.13417 7.15721C4.08728 7.20721 4.05117 7.26631 4.02809 7.33085C4.005 7.39539 3.99543 7.46398 3.99997 7.53238C4.01103 7.66117 4.07052 7.78097 4.16645 7.86762C4.26238 7.95427 4.3876 8.00131 4.51685 7.99925H5.99997V12.7043C6.00019 12.7395 5.99293 12.7745 5.97868 12.8067C5.96444 12.839 5.94352 12.8679 5.91731 12.8915C5.8911 12.9151 5.86019 12.9329 5.82661 12.9437C5.79303 12.9545 5.75754 12.9581 5.72247 12.9543C4.10332 12.7571 2.6172 11.9592 1.55827 10.7185C0.499337 9.4779 -0.0552259 7.8849 0.00434661 6.25488C0.129347 2.87988 2.8631 0.136127 6.2406 0.00487675C7.11503 -0.0289945 7.98731 0.113846 8.80526 0.424855C9.62322 0.735863 10.37 1.20865 11.0011 1.81494C11.6321 2.42122 12.1344 3.14855 12.4778 3.95342C12.8213 4.75829 12.9989 5.62417 13 6.49925Z',
  },
  snapchat: {
    viewBox: '0 0 14.9986 13.5013',
    path: 'M14.8408 10.8588C14.3971 11.2756 13.7365 11.3406 13.0983 11.4038C12.704 11.4425 12.2965 11.4831 12.074 11.6056C11.8633 11.7219 11.6458 12.0194 11.4358 12.3069C11.0983 12.77 10.7152 13.2944 10.109 13.4494C9.97335 13.4838 9.8339 13.5008 9.69397 13.5C9.26397 13.5 8.83772 13.355 8.45022 13.2231C8.10335 13.105 7.77522 12.9931 7.4996 12.9931C7.22397 12.9931 6.89585 13.105 6.54897 13.2231C6.0371 13.3975 5.4571 13.5981 4.89022 13.4494C4.28335 13.2944 3.90022 12.77 3.56272 12.3069C3.35272 12.0194 3.13522 11.7219 2.9246 11.6056C2.7021 11.4806 2.2946 11.4425 1.90085 11.4038C1.2621 11.3413 0.601473 11.2756 0.157723 10.8588C0.0953468 10.8002 0.049047 10.7266 0.0232546 10.645C-0.00253776 10.5634 -0.00695953 10.4765 0.0104125 10.3928C0.0277845 10.309 0.0663689 10.231 0.122473 10.1664C0.178578 10.1018 0.250325 10.0527 0.330848 10.0238C0.336473 10.0238 1.13335 9.72 1.91585 8.83625C2.40042 8.2821 2.77653 7.64182 3.0246 6.94875L1.81147 6.46438C1.75049 6.43975 1.69496 6.40336 1.64804 6.35727C1.60112 6.31119 1.56374 6.25631 1.53803 6.19578C1.51232 6.13525 1.49878 6.07024 1.49819 6.00448C1.49761 5.93872 1.50998 5.87348 1.5346 5.8125C1.55922 5.75152 1.59561 5.69598 1.6417 5.64906C1.68779 5.60215 1.74266 5.56477 1.80319 5.53905C1.86373 5.51334 1.92873 5.49981 1.99449 5.49922C2.06026 5.49863 2.12549 5.511 2.18647 5.53562L3.3021 5.9825C3.43737 5.33045 3.50337 4.66592 3.49897 4C3.49897 2.93913 3.9204 1.92172 4.67055 1.17157C5.42069 0.421427 6.43811 0 7.49897 0C8.55984 0 9.57726 0.421427 10.3274 1.17157C11.0775 1.92172 11.499 2.93913 11.499 4C11.4947 4.66632 11.562 5.33116 11.6996 5.98313L12.8115 5.53562C12.8725 5.511 12.9377 5.49863 13.0035 5.49922C13.0692 5.49981 13.1342 5.51334 13.1948 5.53905C13.2553 5.56477 13.3102 5.60215 13.3562 5.64906C13.4023 5.69598 13.4387 5.75152 13.4633 5.8125C13.488 5.87348 13.5003 5.93872 13.4998 6.00448C13.4992 6.07024 13.4856 6.13525 13.4599 6.19578C13.4342 6.25631 13.3968 6.31119 13.3499 6.35727C13.303 6.40336 13.2475 6.43975 13.1865 6.46438L11.9802 6.94688C12.8602 9.34375 14.6452 10.015 14.6677 10.0238C14.7482 10.0527 14.82 10.1018 14.8761 10.1664C14.9322 10.231 14.9708 10.309 14.9882 10.3928C15.0055 10.4765 15.0011 10.5634 14.9753 10.645C14.9495 10.7266 14.9032 10.8002 14.8408 10.8588Z',
  },
};

const emptyDigitalPresenceData: InspectionDigitalPresenceData = {
  websites: [],
  socialMedia: [],
};

const fieldExecutionSteps: ExecutionStepConfig[] = [
  { key: 'targetAccess', labelKey: 'inspection.execution.steps.targetAccess' },
  { key: 'checklist', labelKey: 'inspection.execution.steps.checklist' },
  { key: 'seizedMaterials', labelKey: 'inspection.execution.steps.seizedMaterials' },
  { key: 'review', labelKey: 'inspection.execution.steps.reviewConfirm' },
];

const digitalExecutionSteps: ExecutionStepConfig[] = [
  { key: 'targetAccess', labelKey: 'inspection.execution.steps.targetAccess' },
  { key: 'checklist', labelKey: 'inspection.execution.steps.checklist' },
  { key: 'review', labelKey: 'inspection.execution.steps.reviewSubmit' },
];

type FieldExecutionStepConfigOptions = {
  shouldAskSeizedMaterials: boolean;
  hasSeizedMaterials: boolean | null;
};

const getFieldExecutionStepConfigs = ({
  shouldAskSeizedMaterials,
  hasSeizedMaterials,
}: FieldExecutionStepConfigOptions) => fieldExecutionSteps.filter((step) => {
  if (step.key === 'seizedMaterials') {
    return shouldAskSeizedMaterials && hasSeizedMaterials !== false;
  }

  return true;
});

const ocrTypes = [
  { key: 'BOOK', labelKey: 'inspection.ocr.book' },
  { key: 'NEWSPAPER_MAGAZINE', labelKey: 'inspection.ocr.newspaperMagazine' },
  { key: 'MOVIE', labelKey: 'inspection.ocr.movie' },
  { key: 'GAME', labelKey: 'inspection.ocr.game' },
  { key: 'ART_PUBLICATION', labelKey: 'inspection.ocr.artPublication' },
  { key: 'DOCUMENT', labelKey: 'inspection.ocr.document' },
  { key: 'CD', labelKey: 'inspection.ocr.cd' },
  { key: 'OTHER', labelKey: 'inspection.ocr.other' },
] as const;

const resultOptions = [
  { value: 'COMPLIANT', labelKey: 'inspection.execution.result.compliant', tone: 'success' },
  { value: 'VIOLATION', labelKey: 'inspection.execution.result.violation', tone: 'danger' },
  { value: 'NOT_APPLICABLE', labelKey: 'inspection.execution.result.notApplicable', tone: 'info' },
];

const resultIdByChecklistResult: Record<string, number> = {
  COMPLIANT: 1,
  VIOLATION: 2,
  NOT_APPLICABLE: 3,
};

const normalizeChecklistResult = (value?: unknown) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === '1' || normalized === 'COMPLIANT') return 'COMPLIANT';
  if (normalized === '2' || normalized === 'VIOLATION') return 'VIOLATION';
  if (normalized === '3' || normalized === 'NOTAPPLICABLE' || normalized === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (normalized === 'PASS') return 'COMPLIANT';
  if (normalized === 'FAIL') return 'VIOLATION';
  if (normalized === 'NA') return 'NOT_APPLICABLE';
  return normalized;
};

const normalizeExecutionStepKey = (value?: unknown, currentStepId?: number): ExecutionStepKey => {
  const normalized = normalizeBackendStepCode(value);
  const clientStepMap: Record<string, ExecutionStepKey> = {
    PRE_VISIT_CHECKLIST: 'targetAccess',
    TARGET_ACCESS: 'targetAccess',
    CHECKIN: 'checklist',
    CHECK_IN: 'checklist',
    CHECKLIST: 'checklist',
    SEIZED_MATERIALS: 'seizedMaterials',
    SEIZED_MATERIAL: 'seizedMaterials',
    REVIEW: 'review',
    REVIEW_CONFIRM: 'review',
    REVIEW_AND_CONFIRM: 'review',
    REVIEW_AND_SUBMIT: 'review',
  };

  return clientStepMap[normalized] || normalizeInspectionExecutionStep(value, currentStepId);
};

const getExecutionStepCode = (stepKey: ExecutionStepKey) => (
  INSPECTION_EXECUTION_STEP_CODES[stepKey] || INSPECTION_EXECUTION_STEP_CODES.targetAccess
);

type ResolveTaskStepOptions = {
  isDigitalInspection?: boolean;
  checklistCategories?: any[];
  hasSeizedMaterials?: boolean | null;
  seizedMaterials?: any[];
};

const getTaskCurrentStepId = (task?: any) => Number(
  task?.executionState?.currentStepId ||
  task?.executionResult?.currentStepId ||
  task?.currentStepId ||
  0,
);

const getTaskCurrentStepRaw = (task?: any) => task?.executionState?.currentStepKey ||
  task?.executionState?.currentStepCode ||
  task?.executionState?.currentStep ||
  task?.executionResult?.currentStepKey ||
  task?.executionResult?.currentStepCode ||
  task?.executionResult?.currentStep ||
  task?.currentStepKey ||
  task?.currentStepCode ||
  task?.currentStep;

const getTaskCurrentStepCodeRaw = (task?: any) => task?.executionState?.currentStepCode ||
  task?.executionResult?.currentStepCode ||
  task?.currentStepCode;

const getTaskStatusId = (task?: any) => Number(
  task?.executionState?.taskStatusId ||
  task?.executionResult?.taskStatusId ||
  task?.taskStatusId ||
  task?.statusId ||
  0,
);

const getTaskStatusRaw = (task?: any) => task?.executionState?.taskStatusCode ||
  task?.executionResult?.taskStatusCode ||
  task?.taskStatusCode ||
  task?.statusCode ||
  task?.statusName ||
  task?.status;

const getTaskCheckInAt = (task?: any) => task?.executionState?.checkinAt ||
  task?.executionState?.checkInAt ||
  task?.executionResult?.checkinAt ||
  task?.executionResult?.checkInAt ||
  task?.reportPreview?.reportSummary?.checkinAt ||
  task?.reportPreview?.reportSummary?.checkInAt;

const mergeTaskExecutionState = (
  current: Record<string, any> | null,
  executionState: Record<string, any> = {},
) => current ? ({
  ...current,
  currentStepId: executionState.currentStepId ?? current.currentStepId,
  currentStepCode: executionState.currentStepCode ?? current.currentStepCode,
  currentStep: executionState.currentStep ?? executionState.currentStepCode ?? current.currentStep,
  taskStatusId: executionState.taskStatusId ?? current.taskStatusId,
  taskStatusCode: executionState.taskStatusCode ?? current.taskStatusCode,
  accessOutcomeCode: executionState.accessOutcomeCode ?? current.accessOutcomeCode,
  accessFailedReasonCode: executionState.accessFailedReasonCode ?? current.accessFailedReasonCode,
  accessFailedRemark: executionState.accessFailedRemark ?? current.accessFailedRemark,
  executionState: {
    ...(current.executionState || {}),
    ...executionState,
  },
}) : current;

const hasChecklistViolationInCategories = (categories?: any[]) => ensureArray(categories).some((category: any) => (
  ensureArray<any>(category?.checkItems).some((item: any) => (
    normalizeChecklistResult(item?.result) === 'VIOLATION' ||
    ensureArray(item?.selectedViolationKeys).length > 0 ||
    ensureArray(item?.selectedViolations).length > 0
  ))
));

const normalizeBackendStepCode = (value?: unknown) => String(value ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[\s-]+/g, '_')
  .toUpperCase();

const hasTaskCurrentStepMarker = (task?: any) => Boolean(
  getTaskCurrentStepId(task) ||
  normalizeBackendStepCode(getTaskCurrentStepCodeRaw(task)),
);

const TARGET_ACCESS_DECISION_STEP_CODES = ['PRE_VISIT_CHECKLIST', 'TARGET_ACCESS'];
const TARGET_ACCESS_DECISION_STEP_IDS = [
  INSPECTION_EXECUTION_STEP_IDS.PreVisitChecklist,
  INSPECTION_EXECUTION_STEP_IDS.TargetAccess,
];
const CHECKIN_STEP_CODES = ['CHECKIN', 'CHECK_IN'];
const REVIEW_STEP_CODES = [
  'CONTACT_PERSON',
  'DECLARATION_ACKNOWLEDGEMENT',
  'DECLARATION_ACKNOWLEDGMENT',
  'REINSPECTION',
  'REVIEW_AND_SUBMIT',
];
const REVIEW_STEP_IDS = [
  INSPECTION_EXECUTION_STEP_IDS.ContactPerson,
  INSPECTION_EXECUTION_STEP_IDS.declarationAcknowledgement,
  INSPECTION_EXECUTION_STEP_IDS.Reinspection,
  INSPECTION_EXECUTION_STEP_IDS.ReviewAndSubmit,
];
const TERMINAL_EXECUTION_STEP_CODES = ['CHECK_OUT', 'CHECKOUT', 'ACCESS_FAILED'];
const TERMINAL_EXECUTION_STEP_IDS = [
  INSPECTION_EXECUTION_STEP_IDS.CheckOut,
  INSPECTION_EXECUTION_STEP_IDS.AccessFailed,
];
const RESOLVED_SEIZED_MATERIALS_STEP_CODES = [
  'SEIZED_MATERIALS',
  ...REVIEW_STEP_CODES,
  ...TERMINAL_EXECUTION_STEP_CODES,
];
const RESOLVED_SEIZED_MATERIALS_STEP_IDS = [
  INSPECTION_EXECUTION_STEP_IDS.SeizedMaterials,
  ...REVIEW_STEP_IDS,
  ...TERMINAL_EXECUTION_STEP_IDS,
];

const isTerminalExecutionStep = (task?: any) => {
  const currentStepId = getTaskCurrentStepId(task);
  const currentStepCode = normalizeBackendStepCode(getTaskCurrentStepRaw(task));
  const taskStatusId = getTaskStatusId(task);
  const taskStatusCode = normalizeBackendStepCode(getTaskStatusRaw(task));

  return TERMINAL_EXECUTION_STEP_IDS.includes(currentStepId) ||
    TERMINAL_EXECUTION_STEP_CODES.includes(currentStepCode) ||
    [3, 4].includes(taskStatusId) ||
    ['ACCESS_FAILED', 'COMPLETED', 'SUBMITTED', 'CLOSED'].includes(taskStatusCode);
};

const isTargetAccessDecisionStep = (task?: any) => {
  const currentStepId = getTaskCurrentStepId(task);
  const currentStepCode = normalizeBackendStepCode(getTaskCurrentStepRaw(task));

  return TARGET_ACCESS_DECISION_STEP_IDS.includes(currentStepId) ||
    TARGET_ACCESS_DECISION_STEP_CODES.includes(currentStepCode);
};

const hasResolvedSeizedMaterialsDecision = (task?: any) => {
  const currentStepCode = normalizeBackendStepCode(getTaskCurrentStepRaw(task));
  if (currentStepCode) {
    return RESOLVED_SEIZED_MATERIALS_STEP_CODES.includes(currentStepCode);
  }

  const currentStepId = getTaskCurrentStepId(task);
  return RESOLVED_SEIZED_MATERIALS_STEP_IDS.includes(currentStepId);
};

const getExecutionStepFromTask = (task?: any, options: ResolveTaskStepOptions = {}) => {
  const currentStepRaw = getTaskCurrentStepRaw(task);
  const currentStepId = getTaskCurrentStepId(task);

  if (!currentStepRaw && !currentStepId) return '';

  const normalizedStepCode = normalizeBackendStepCode(currentStepRaw);

  if (isTerminalExecutionStep(task)) return '';
  if (currentStepId === INSPECTION_EXECUTION_STEP_IDS.Checkin || CHECKIN_STEP_CODES.includes(normalizedStepCode)) return 'checklist';
  if (currentStepId === INSPECTION_EXECUTION_STEP_IDS.Checklist || normalizedStepCode === 'CHECKLIST') {
    if (options.isDigitalInspection) return 'review';
    if (!hasChecklistViolationInCategories(options.checklistCategories)) return 'review';
    if (options.hasSeizedMaterials === true || ensureArray(options.seizedMaterials).length > 0) {
      return 'seizedMaterials';
    }
    if (options.hasSeizedMaterials === false) return 'review';
    return 'checklist';
  }
  if (currentStepId === INSPECTION_EXECUTION_STEP_IDS.SeizedMaterials || normalizedStepCode === 'SEIZED_MATERIALS') return 'review';
  if (REVIEW_STEP_IDS.includes(currentStepId) || REVIEW_STEP_CODES.includes(normalizedStepCode)) return 'review';

  return normalizeExecutionStepKey(currentStepRaw, currentStepId);
};

const isPreVisitTaskStatus = (status?: string | null) => (
  ['ASSIGNED', 'PENDING_VISIT'].includes(String(status || '').toUpperCase())
);

const getViolationGroupKey = (violation: any): 'content' | 'licensing' => {
  const type = String(violation?.violationTypeCode || violation?.violationType || violation?.categoryName || '').toLowerCase();
  if (type.includes('content')) return 'content';
  return 'licensing';
};

const normalizeAttachment = (file: any, fallbackPrefix: string) => ({
  fileName: file?.fileName || file?.name || file?.attachmentFileName || `${fallbackPrefix}.pdf`,
  fileUrl: getDocumentItemUrl(file) || '',
  contentType: file?.contentType || file?.type || file?.fileType || 'application/octet-stream',
  attachmentCategory: file?.attachmentCategory,
});

const getViolationCode = (violation: any) => {
  return String(
    violation?.violationCode ||
      violation?.code ||
      violation?.violationItemCode ||
      violation?.checklistCode ||
      '',
  ).trim().toUpperCase();
};

const inspectionSubmitToastMessageKeys: Record<InspectionSubmitToastKind, string> = {
  inspectionCompleted: 'inspection.execution.messages.noViolationToast',
  violationSubmitted: 'inspection.execution.messages.noReinspectionToast',
  reinspectionCreated: 'inspection.execution.messages.reinspectionCreatedToast',
};

const buildInspectionSubmitToastNavigationPatch = () => ({
  [INSPECTION_QUERY_KEYS.from]: 'tasks',
  [INSPECTION_QUERY_KEYS.tab]: null,
  [INSPECTION_QUERY_KEYS.teamTab]: null,
  [INSPECTION_QUERY_KEYS.taskId]: null,
  [INSPECTION_QUERY_KEYS.taskNo]: null,
  [INSPECTION_QUERY_KEYS.visitId]: null,
  [INSPECTION_QUERY_KEYS.step]: null,
  [INSPECTION_QUERY_KEYS.mode]: null,
  [INSPECTION_QUERY_KEYS.reportNo]: null,
  [INSPECTION_QUERY_KEYS.violationId]: null,
  [INSPECTION_QUERY_KEYS.violationNo]: null,
  [INSPECTION_QUERY_KEYS.type]: null,
  [INSPECTION_QUERY_KEYS.status]: null,
});

const hasInspectionSubmitToastNavigationTarget = (violation?: InspectionCreatedViolationSummary | null) => (
  violation?.violationId !== undefined &&
  violation.violationId !== null
) || Boolean(violation?.violationNo);

const normalizeViolationIdentityPart = (value: unknown) => (
  value === undefined || value === null ? '' : String(value).trim()
);

const normalizeChecklistCode = (value: unknown) => normalizeViolationIdentityPart(value).toUpperCase();

const uniqueTruthy = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getViolationOptionKey = (source: any) => normalizeChecklistCode(source?.checklistCode);

const getViolationKey = (violation: any) => getViolationOptionKey(violation);

const getViolationSelectionKeys = (source: any) => uniqueTruthy([getViolationKey(source)].map(normalizeChecklistCode));

const normalizeViolationSelectionKey = (value: unknown) => normalizeChecklistCode(value);

const getChecklistItemViolationDescription = (item: {
  violationDescription?: unknown;
}) => getNormalizedText(item?.violationDescription);

const getChecklistItemViolationDescriptionEn = (item: any) =>
  getNormalizedText(item?.violationDescriptionEn);

const getChecklistItemViolationDescriptionAr = (item: any) =>
  getNormalizedText(item?.violationDescriptionAr);

const getChecklistItemViolationSources = (item: any) => {
  const relatedViolations = ensureArray<any>(item?.relatedViolations);
  const sources = relatedViolations.length ? relatedViolations : [item];
  const sourceMap = new Map<string, any>();

  sources.forEach((violation) => {
    const source = {
      checklistCode: violation?.checklistCode || violation?.violationItemCode || item?.checklistCode,
      violationItemId: violation?.violationItemId ?? item?.violationItemId,
      legacyViolationItemId: violation?.legacyViolationItemId,
      violationItemCode: violation?.violationItemCode || violation?.checklistCode || item?.violationItemCode,
      violationTypeId: violation?.violationTypeId ?? item?.violationTypeId,
      violationTypeCode: violation?.violationTypeCode || item?.violationTypeCode,
      violationDescription: getChecklistItemViolationDescription(violation) || getChecklistItemViolationDescription(item),
      violationDescriptionEn: getChecklistItemViolationDescriptionEn(violation) || getChecklistItemViolationDescriptionEn(item) || null,
      violationDescriptionAr: getChecklistItemViolationDescriptionAr(violation) || getChecklistItemViolationDescriptionAr(item) || null,
      checklistName: getNormalizedText(violation?.checklistName) || getNormalizedText(item?.checklistName) || null,
      checklistNameAr: getNormalizedText(violation?.checklistNameAr) || getNormalizedText(item?.checklistNameAr) || null,
    };
    const key = getViolationOptionKey(source);
    if (key && !sourceMap.has(key)) {
      sourceMap.set(key, source);
    }
  });

  return Array.from(sourceMap.values());
};

const getChecklistItemViolationOptionKeys = (item: any) => uniqueTruthy(
  getChecklistItemViolationSources(item).flatMap((source) => getViolationSelectionKeys(source)),
);

const getChecklistItemText = (item: any) => getNormalizedText(item?.checklistName);

const getChecklistItemTextAr = (item: any) => getNormalizedText(item?.checklistNameAr);

/**
 * Display-only checklist title. Keep `getChecklistItemText` for payloads/merge keys so the
 * English value stays canonical when the portal runs in Arabic.
 */
const getChecklistItemDisplayText = (item: any) => getLocalizedText(
  getChecklistItemText(item),
  getChecklistItemTextAr(item),
  '',
);

/**
 * Display-only violation description. `violationDescription` is always the English copy while
 * `violationDescriptionEn` is only populated on some endpoints, so it is used as a fallback.
 */
const getChecklistItemViolationDescriptionDisplay = (item: any) => getLocalizedText(
  getChecklistItemViolationDescription(item) || getChecklistItemViolationDescriptionEn(item),
  getChecklistItemViolationDescriptionAr(item),
  '',
);

const getChecklistItemKey = (item: any, categoryIndex: number, itemIndex: number) => (
  String(item?.itemId || item?.checklistCode || `${categoryIndex}-${itemIndex}`)
);

const getContentViolationGroupKey = (category: any, categoryIndex: number) => (
  `content-${String(category?.categoryId || categoryIndex)}`
);

const getChecklistCategoryKey = (category: any, categoryIndex: number) => (
  String(category?.categoryId || categoryIndex)
);

const makeChecklistMergeKey = (kind: string, value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized ? `${kind}:${normalized}` : '';
};

const getChecklistItemMergeKeys = (item: any) => uniqueTruthy([
  makeChecklistMergeKey('code', item?.checklistCode),
  makeChecklistMergeKey('code', item?.violationItemCode),
  makeChecklistMergeKey('template-id', item?.itemId),
  makeChecklistMergeKey('template-id', item?.checklistItemId),
  makeChecklistMergeKey('template-id', item?.templateItemId),
  makeChecklistMergeKey('violation-id', item?.violationItemId),
  makeChecklistMergeKey('legacy-violation-id', item?.legacyViolationItemId),
  makeChecklistMergeKey('title', item?.checklistName),
]);

const getChecklistTemplateTypesKey = (item: any) => ensureArray<any>(item?.applicableTemplateTypes)
  .map((type) => String(type).trim())
  .filter(Boolean)
  .sort()
  .join('|');

const getContentGeneralChecklistBoundaryIndex = (category: any) => {
  const items = ensureArray<any>(category?.checkItems);
  if (!items.length) return 0;
  const generalTemplateTypesKey = getChecklistTemplateTypesKey(items[0]);
  if (!generalTemplateTypesKey) return items.length;
  const firstStandaloneIndex = items.findIndex((item) => getChecklistTemplateTypesKey(item) !== generalTemplateTypesKey);
  return firstStandaloneIndex === -1 ? items.length : firstStandaloneIndex;
};

const isStandaloneContentChecklistItem = (category: any, itemIndex: number) => (
  itemIndex >= getContentGeneralChecklistBoundaryIndex(category)
);

const getContentGeneralChecklistEntries = (category: any) => (
  ensureArray<any>(category?.checkItems)
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ itemIndex }) => !isStandaloneContentChecklistItem(category, itemIndex))
);

const getContentStandaloneChecklistEntries = (category: any) => (
  ensureArray<any>(category?.checkItems)
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ itemIndex }) => isStandaloneContentChecklistItem(category, itemIndex))
);

const hasChecklistItemEvidence = (item: any) => (
  Boolean(String(item?.remarks || '').trim()) || ensureArray(item?.evidenceAttachments).length > 0
);

const hasContentViolationSelection = (items: any[]) => (
  ensureArray(items).some((item) => getChecklistItemSelectedViolationKeys(item).length > 0)
);

const getContentViolationGroupResult = (items: any[]) => {
  const normalizedItems = ensureArray(items);
  if (!normalizedItems.length) return '';
  if (normalizedItems.some((item) => normalizeChecklistResult(item.result) === 'VIOLATION')) return 'VIOLATION';
  if (normalizedItems.every((item) => normalizeChecklistResult(item.result) === 'NOT_APPLICABLE')) return 'NOT_APPLICABLE';
  if (normalizedItems.every((item) => normalizeChecklistResult(item.result) === 'COMPLIANT')) return 'COMPLIANT';
  return '';
};

const getDisplayText = (value: any, fallback = '-') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) {
    const displayValue = value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item && item.toLowerCase() !== 'none')
      .join(', ');
    return displayValue || fallback;
  }

  const displayValue = String(value).trim();
  return !displayValue || displayValue.toLowerCase() === 'none' ? fallback : displayValue;
};

const getFirstDisplayValue = (source: any, keys: string[], fallback = '-') => {
  const key = keys.find((item) => source?.[item] !== undefined && source?.[item] !== null && source?.[item] !== '');
  return key ? getDisplayText(source?.[key], fallback) : fallback;
};

const isSignatureDataUrl = (value?: unknown) => (
  typeof value === 'string' && value.startsWith('data:image/')
);

const normalizeSignatureImageDisplayUrl = (value?: unknown) => {
  const url = getNormalizedText(value);
  if (!url) return '';
  if (isSignatureDataUrl(url) || /^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;

  // P8 Plan A: images served same-origin through the gateway (relative paths).
  const imageBaseUrl = '';
  if (url.startsWith('/api/Document/Dowload')) return `${imageBaseUrl}${url}`;
  if (url.startsWith('/')) return url;

  return `${imageBaseUrl}/api/Document/Dowload?fileName=${encodeURIComponent(url)}`;
};

const getSignatureFileName = (taskNo?: string | number, taskId?: string | number) => {
  const fileToken = String(taskNo || taskId || Date.now())
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `signature-${fileToken || Date.now()}.png`;
};

const dataUrlToFile = (dataUrl: string, fileName: string) => {
  const [metadata = '', base64Data = ''] = dataUrl.split(',');
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] || 'image/png';

  if (!base64Data) {
    throw new Error('Invalid signature image data.');
  }

  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
};

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result === 'string' && reader.result) {
      resolve(reader.result);
      return;
    }

    reject(new Error('Invalid OCR image data.'));
  };

  reader.onerror = () => {
    reject(reader.error || new Error('Failed to read OCR image.'));
  };

  reader.readAsDataURL(file);
});

const getUrlSafeContactPersonValues = (values: Record<string, any>): Record<string, any> => {
  if (values.declarationStatus !== 'signed') {
    return {
      ...values,
      emiratesId: normalizeContactPersonIdNumber(values.emiratesId),
      signatureDataUrl: '',
      signatureImageFileName: '',
      signatureImageFileUrl: '',
      signatureLocked: false,
      signatureEditing: false,
    };
  }

  const signatureImageFileUrl = getNormalizedText(values.signatureImageFileUrl);

  return {
    ...values,
    emiratesId: normalizeContactPersonIdNumber(values.emiratesId),
    signatureDataUrl: normalizeSignatureImageDisplayUrl(signatureImageFileUrl || values.signatureDataUrl),
    signatureImageFileName: signatureImageFileUrl ? values.signatureImageFileName : '',
    signatureImageFileUrl,
  };
};

const normalizeContactPersonValues = (
  source?: Record<string, any> | null,
  mobileSnapshot = createContactPersonMobileSnapshot(source || {}),
) => {
  const contact = source || {};
  const statusText = String(
    contact.declarationStatus ||
    contact.declarationStatusCode ||
    contact.declarationStatusName ||
    '',
  ).toLowerCase();
  const signatureImageFileUrl = getNormalizedText(contact.signatureImageFileUrl);
  const signatureDataUrl = normalizeSignatureImageDisplayUrl(
    contact.signatureDataUrl || signatureImageFileUrl,
  );
  const eidAttachment = ensureArray(contact.eidAttachment).length
    ? ensureArray(contact.eidAttachment)
    : contact.eidAttachmentFileName || contact.eidAttachmentFileUrl
      ? [{
        uid: `eid-${contact.eidAttachmentFileName || contact.eidAttachmentFileUrl}`,
        name: contact.eidAttachmentFileName || 'EID Attachment.pdf',
        fileName: contact.eidAttachmentFileName || 'EID Attachment.pdf',
        url: contact.eidAttachmentFileUrl,
        fileUrl: contact.eidAttachmentFileUrl,
      }]
      : [];
  const declined = contact.hasSignedDeclaration === false ||
    statusText === 'not_signed' ||
    statusText === 'declined';
  const signed = contact.hasSignedDeclaration === true ||
    statusText === 'signed' ||
    statusText === 'acknowledged' ||
    Boolean(signatureDataUrl);

  return {
    name: contact.name || contact.fullName || '',
    position: contact.position || contact.designation || '',
    mobilePhone: toContactFormValue(mobileSnapshot, contactMobileFieldNames),
    emailAddress: contact.emailAddress || contact.email || '',
    emiratesId: normalizeContactPersonIdNumber(contact.emiratesId || contact.eid || contact.eidNumber || ''),
    eidAttachment,
    declarationStatus: declined ? 'not_signed' : signed ? 'signed' : undefined,
    refusalReason: contact.refusalReason || contact.declarationDeclinedReason || '',
    signatureDataUrl,
    signatureImageFileName: contact.signatureImageFileName || '',
    signatureImageFileUrl,
    declarationDocumentFileName: getDeclarationDocumentFileName(contact) || '',
    declarationDocumentFileUrl: getDeclarationDocumentUrl(contact) || '',
    signatureLocked: contact.signatureLocked ?? Boolean(signatureDataUrl),
    signatureEditing: contact.signatureEditing ?? false,
  };
};

type FigmaIconProps = {
  className?: string;
};

const FigmaEditIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(2.2008 2.2008)">
      <path
        d="M0 16.7998V2.7998C0 2.0572 0.295211 1.34541 0.820312 0.820312C1.34541 0.295211 2.0572 0 2.7998 0H9.7998C10.2416 0 10.5996 0.357977 10.5996 0.799805C10.5996 1.24163 10.2416 1.59961 9.7998 1.59961H2.7998C2.48154 1.59961 2.17622 1.72613 1.95117 1.95117C1.72613 2.17622 1.59961 2.48154 1.59961 2.7998V16.7998C1.59961 17.1181 1.72613 17.4234 1.95117 17.6484C2.17622 17.8735 2.48155 18 2.7998 18H16.7998C17.1181 18 17.4234 17.8735 17.6484 17.6484C17.8735 17.4234 18 17.1181 18 16.7998V9.7998C18 9.35798 18.358 9 18.7998 9C19.2416 9 19.5996 9.35798 19.5996 9.7998V16.7998C19.5996 17.5424 19.3044 18.2542 18.7793 18.7793C18.2542 19.3044 17.5424 19.5996 16.7998 19.5996H2.7998C2.0572 19.5996 1.34541 19.3044 0.820312 18.7793C0.295211 18.2542 0 17.5424 0 16.7998Z"
        fill="#92722A"
      />
    </g>
    <g transform="translate(7.1952 1.2048)">
      <path
        d="M14.0005 2.9209C14.0004 2.57054 13.8615 2.23407 13.6137 1.98633C13.366 1.73863 13.0295 1.59961 12.6792 1.59961C12.3288 1.59963 11.9924 1.7386 11.7446 1.98633L2.7319 11.001C2.58942 11.1432 2.48491 11.3195 2.42819 11.5127L1.74167 13.8584L4.08835 13.1719H4.08932C4.28235 13.1154 4.45775 13.0112 4.60007 12.8691L13.6137 3.85547L13.7016 3.75879C13.8943 3.52366 14.0005 3.22754 14.0005 2.9209ZM15.601 2.9209C15.601 3.69565 15.2924 4.43848 14.7446 4.98633L5.7319 14.001C5.44101 14.2916 5.08993 14.514 4.70456 14.6533L4.53757 14.708L1.66452 15.5479C1.44091 15.6131 1.20364 15.6173 0.977995 15.5596C0.752395 15.5018 0.546055 15.3843 0.381316 15.2197C0.216563 15.055 0.0983472 14.8487 0.0404953 14.623C-0.017342 14.3973 -0.01304 14.1593 0.0522141 13.9355L0.892058 11.0625L0.893034 11.0615C1.02531 10.6112 1.26799 10.2008 1.60007 9.86914L10.6137 0.855469L10.8276 0.661133C11.3474 0.235208 12.0013 2.16581e-05 12.6792 0C13.4539 0 14.1968 0.307715 14.7446 0.855469C15.2924 1.40327 15.601 2.1462 15.601 2.9209Z"
        fill="#92722A"
      />
    </g>
  </svg>
);

const FigmaChevronIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(1.4005 5.70025)">
      <path
        d="M15.6938 0.234315C16.0383 -0.0781048 16.5962 -0.0781049 16.9406 0.234315C17.2851 0.546734 17.2851 1.05275 16.9406 1.36517L9.2229 8.36517C8.87844 8.67759 8.32054 8.67759 7.97608 8.36517L0.25834 1.36517C-0.0861133 1.05275 -0.0861133 0.546734 0.25834 0.234315C0.602793 -0.0781049 1.1607 -0.0781048 1.50515 0.234315L8.59949 6.66888L15.6938 0.234315Z"
        fill="#361E12"
      />
    </g>
  </svg>
);

const FigmaCheckIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 10.7529 8.12642"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M9.68945 0.25C9.90519 0.250011 10.1121 0.335734 10.2646 0.488281C10.4172 0.640835 10.5029 0.847738 10.5029 1.06348C10.5029 1.27922 10.4172 1.48612 10.2646 1.63867L10.0879 1.81543L10.0869 1.81445L4.26367 7.6377C4.18825 7.71331 4.09863 7.7735 4 7.81445C3.90127 7.85543 3.79538 7.87598 3.68848 7.87598C3.58158 7.87598 3.47568 7.85543 3.37695 7.81445C3.30284 7.78368 3.2336 7.74222 3.17188 7.69141L3.11328 7.6377L0.488281 5.0127C0.412755 4.93716 0.352401 4.8477 0.311523 4.74902C0.270642 4.65033 0.25 4.54433 0.25 4.4375C0.250005 4.33069 0.270647 4.22466 0.311523 4.12598C0.352404 4.02731 0.412764 3.93782 0.488281 3.8623C0.563807 3.78678 0.653278 3.72642 0.751953 3.68555C0.850648 3.64467 0.956649 3.62402 1.06348 3.62402C1.1703 3.62402 1.27631 3.64467 1.375 3.68555C1.47367 3.72642 1.56315 3.78678 1.63867 3.8623L3.68848 5.91211L9.11426 0.488281C9.26681 0.335737 9.47372 0.25 9.68945 0.25Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.5"
    />
  </svg>
);

const FigmaSelectArrowIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(1.4005 5.70025)">
      <path
        d="M15.6938 0.234315C16.0383 -0.0781048 16.5962 -0.0781049 16.9406 0.234315C17.2851 0.546734 17.2851 1.05275 16.9406 1.36517L9.2229 8.36517C8.87844 8.67759 8.32054 8.67759 7.97608 8.36517L0.25834 1.36517C-0.0861133 1.05275 -0.0861133 0.546734 0.25834 0.234315C0.602793 -0.0781049 1.1607 -0.0781048 1.50515 0.234315L8.59949 6.66888L15.6938 0.234315Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigmaSearchIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(1.417 1.417)">
      <path
        d="M10.6667 5.91667C10.6667 3.29331 8.54002 1.16667 5.91667 1.16667C3.29331 1.16667 1.16667 3.29331 1.16667 5.91667C1.16667 8.54002 3.29331 10.6667 5.91667 10.6667C8.54002 10.6667 10.6667 8.54002 10.6667 5.91667ZM11.8333 5.91667C11.8333 9.18435 9.18435 11.8333 5.91667 11.8333C2.64898 11.8333 0 9.18435 0 5.91667C0 2.64898 2.64898 0 5.91667 0C9.18435 0 11.8333 2.64898 11.8333 5.91667Z"
        fill="currentColor"
      />
      <path
        d="M10.665 10.665C10.8928 10.4372 11.2627 10.4372 11.4905 10.665L14.3838 13.5589C14.6114 13.7867 14.6115 14.156 14.3838 14.3838C14.156 14.6115 13.7867 14.6114 13.5589 14.3838L10.665 11.4905C10.4372 11.2627 10.4372 10.8928 10.665 10.665Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

type ContactFullNameSelectorProps = {
  value?: string;
  placeholder?: string;
  searchPlaceholder: string;
  emptyText: string;
  options: InspectionContactPersonOption[];
  onChange?: (value: string) => void;
  onInputChange?: () => void;
  onSelectContact: (option: InspectionContactPersonOption) => void;
};

type NamedContactPersonOption = InspectionContactPersonOption & { name: string };

const isNamedContactPersonOption = (
  option: InspectionContactPersonOption,
): option is NamedContactPersonOption => typeof option.name === 'string' && option.name.trim().length > 0;

const getContactPersonFormTextValue = (value: string | null) => value ?? undefined;

const buildContactPersonEidAttachmentValue = (
  option: InspectionContactPersonOption,
): InspectionAttachmentSource[] => {
  if (!option.eidAttachmentFileName || !option.eidAttachmentFileUrl) return [];

  return [{
    uid: `contact-person-${option.sourceType}-${option.personId}-eid`,
    name: option.eidAttachmentFileName,
    fileName: option.eidAttachmentFileName,
    url: option.eidAttachmentFileUrl,
    fileUrl: option.eidAttachmentFileUrl,
  }];
};

const buildContactPersonSelectionPatch = (
  option: NamedContactPersonOption,
  mobileSnapshot = createContactPersonMobileSnapshot(option),
) => ({
  personId: option.personId,
  sourceType: option.sourceType,
  collectedChannelCode: getContactPersonFormTextValue(option.collectedChannelCode),
  name: option.name,
  position: getContactPersonFormTextValue(option.position),
  mobilePhone: toContactFormValue(mobileSnapshot, contactMobileFieldNames),
  emailAddress: getContactPersonFormTextValue(option.email),
  emiratesId: getContactPersonFormTextValue(option.emiratesId),
  eidAttachment: buildContactPersonEidAttachmentValue(option),
});

const ContactFullNameSelector: React.FC<ContactFullNameSelectorProps> = ({
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  onChange,
  onInputChange,
  onSelectContact,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredOptions = useMemo(
    () => options
      .filter(isNamedContactPersonOption)
      .filter((option) => option.name.toLowerCase().includes(normalizedSearchText)),
    [normalizedSearchText, options],
  );

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchText('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [open]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange?.();
    onChange?.(event.target.value);
  };

  const handleControlBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusedNode = event.relatedTarget as Node | null;
    if (!nextFocusedNode || !rootRef.current?.contains(nextFocusedNode)) {
      setOpen(false);
    }
  };

  const handleControlKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleToggleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleToggleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setOpen((prev) => !prev);
  };

  const handleSelect = (option: NamedContactPersonOption) => {
    onChange?.(option.name);
    onSelectContact(option);
    setOpen(false);
  };

  const handleOptionMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };
  const toggleAriaLabel = open ? 'Close contact person options' : 'Open contact person options';

  return (
    <div
      className="inspection-start-visit__contact-name-control"
      ref={rootRef}
      onBlur={handleControlBlur}
      onKeyDown={handleControlKeyDown}
    >
      <Input
        allowClear
        className="inspection-start-visit__contact-name-input"
        value={value}
        placeholder={placeholder}
        onChange={handleInputChange}
        suffix={(
          <button
            type="button"
            className="inspection-start-visit__contact-name-toggle"
            aria-label={toggleAriaLabel}
            aria-expanded={open}
            aria-haspopup="true"
            onMouseDown={handleToggleMouseDown}
            onClick={handleToggleClick}
          >
            <FigmaSelectArrowIcon
              className={[
                'inspection-start-visit__contact-name-toggle-icon',
                open ? 'is-open' : '',
              ].filter(Boolean).join(' ')}
            />
          </button>
        )}
      />
      {open ? (
        <div className="inspection-start-visit__contact-name-dropdown">
          <div className="inspection-start-visit__contact-name-search">
            <FigmaSearchIcon className="inspection-start-visit__contact-name-search-icon" />
            <input
              className="inspection-start-visit__contact-name-search-input"
              value={searchText}
              placeholder={searchPlaceholder}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div className="inspection-start-visit__contact-name-option-list">
            {filteredOptions.length ? filteredOptions.map((option) => {
              const selected = option.name === value;
              return (
                <button
                  type="button"
                  key={`${option.sourceType}-${option.personId}`}
                  className={[
                    'inspection-start-visit__contact-name-option',
                    selected ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseDown={handleOptionMouseDown}
                  onClick={() => handleSelect(option)}
                >
                  {option.name}
                </button>
              );
            }) : (
              <div className="inspection-start-visit__contact-name-empty">{emptyText}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const FigmaAddIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(2 2)">
      <path
        d="M6 0C6.36817 0 6.66696 0.298832 6.66699 0.666992V5.33398H11.334C11.7019 5.33412 11.9998 5.63208 12 6C12 6.3681 11.7021 6.66685 11.334 6.66699H6.66699V11.334C6.66685 11.7021 6.3681 12 6 12C5.63208 11.9998 5.33412 11.7019 5.33398 11.334V6.66699H0.666992C0.298832 6.66696 0 6.36817 0 6C0.000210932 5.63201 0.298962 5.33402 0.666992 5.33398H5.33398V0.666992C5.33402 0.298962 5.63201 0.000210932 6 0Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigmaTrashIcon: React.FC<FigmaIconProps> = ({ className }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(9.2 10.2)">
      <path d="M0 6.7998V0.799805C0 0.357977 0.357977 0 0.799805 0C1.24163 0 1.59961 0.357977 1.59961 0.799805V6.7998C1.59961 7.24163 1.24163 7.59961 0.799805 7.59961C0.357977 7.59961 0 7.24163 0 6.7998Z" fill="currentColor" />
    </g>
    <g transform="translate(13.2 10.2)">
      <path d="M0 6.7998V0.799805C0 0.357977 0.357977 0 0.799805 0C1.24163 0 1.59961 0.357977 1.59961 0.799805V6.7998C1.59961 7.24163 1.24163 7.59961 0.799805 7.59961C0.357977 7.59961 0 7.24163 0 6.7998Z" fill="currentColor" />
    </g>
    <g transform="translate(4.2 5.2)">
      <path d="M0 14.7998V0.799805C0 0.357977 0.357977 0 0.799805 0C1.24163 0 1.59961 0.357977 1.59961 0.799805V14.7998L1.60547 14.918C1.63266 15.1928 1.75415 15.4514 1.95117 15.6484C2.17622 15.8735 2.48155 16 2.7998 16H12.7998C13.1181 16 13.4234 15.8735 13.6484 15.6484C13.8735 15.4234 14 15.1181 14 14.7998V0.799805C14 0.357977 14.358 0 14.7998 0C15.2416 0 15.5996 0.357977 15.5996 0.799805V14.7998C15.5996 15.5424 15.3044 16.2542 14.7793 16.7793C14.2542 17.3044 13.5424 17.5996 12.7998 17.5996H2.7998C2.0572 17.5996 1.34541 17.3044 0.820312 16.7793C0.295211 16.2542 0 15.5424 0 14.7998Z" fill="currentColor" />
    </g>
    <g transform="translate(2.2 5.2)">
      <path d="M18.7998 0C19.2416 0 19.5996 0.357977 19.5996 0.799805C19.5996 1.24163 19.2416 1.59961 18.7998 1.59961H0.799805C0.357977 1.59961 0 1.24163 0 0.799805C0 0.357977 0.357977 0 0.799805 0H18.7998Z" fill="currentColor" />
    </g>
    <g transform="translate(7.2 1.2)">
      <path d="M8 4.7998V2.7998C8 2.48155 7.87348 2.17622 7.64844 1.95117C7.45142 1.75415 7.19285 1.63266 6.91797 1.60547L6.7998 1.59961H2.7998C2.48154 1.59961 2.17622 1.72613 1.95117 1.95117C1.72613 2.17622 1.59961 2.48155 1.59961 2.7998V4.7998C1.59961 5.24163 1.24163 5.59961 0.799805 5.59961C0.357977 5.59961 0 5.24163 0 4.7998V2.7998C0 2.0572 0.295211 1.34541 0.820312 0.820312C1.34541 0.295211 2.0572 0 2.7998 0H6.7998C7.54241 0 8.2542 0.295211 8.7793 0.820312C9.3044 1.34541 9.59961 2.0572 9.59961 2.7998V4.7998C9.59961 5.24163 9.24163 5.59961 8.7998 5.59961C8.35798 5.59961 8 5.24163 8 4.7998Z" fill="currentColor" />
    </g>
  </svg>
);

const getFirstRawValue = (source: any, keys: string[]) => (
  keys
    .map((key) => source?.[key])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '')
);

const getFiniteNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getTargetOverviewCountDisplayValue = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-';
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : '-';
};

const getAttachmentType = (item: any) => {
  const name = String(item?.name || item?.fileName || item?.attachmentFileName || item?.url || item?.fileUrl || '');
  const match = name.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? match[1].toUpperCase() : 'FILE';
};

const getTaskDetailsAttachments = (detail: any): TaskDetailsAttachmentItem[] => {
  const summary = detail?.reportPreview?.reportSummary || {};
  const sourceList = [
    ...ensureArray(detail?.attachments),
    ...ensureArray(detail?.taskAttachments),
    ...ensureArray(detail?.inspectionConfig?.attachments),
    ...ensureArray(summary.attachments),
    ...ensureArray(summary.accessAttachments),
  ];

  return sourceList
    .map((item: any, index) => {
      const name = getDisplayText(
        item?.name || item?.fileName || item?.attachmentFileName || item?.originalName || item?.title,
        '',
      );
      const url = item?.url || item?.fileUrl || item?.attachmentFileUrl || item?.thumbUrl || item?.response?.url;
      const displayName = name || getDisplayText(url, '');
      return {
        key: String(item?.uid || item?.id || item?.attachmentId || `${displayName}-${index}`),
        name: displayName,
        type: getDisplayText(item?.type || item?.fileType || getAttachmentType({ ...item, name: displayName, url }), 'FILE'),
        url,
      };
    })
    .filter((item) => Boolean(item.name || item.url));
};

const getRelatedInspection = (detail: any) => (
  detail?.lastInspection ||
  null
);

const getLicenseStatusTone = (status: React.ReactNode): DetailField['tone'] => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approved') || normalized.includes('active') || normalized.includes('valid')) {
    return 'status-success';
  }
  if (normalized.includes('expired') || normalized.includes('suspend') || normalized.includes('cancel') || normalized.includes('reject') || normalized.includes('invalid')) {
    return 'status-danger';
  }
  if (normalized.includes('pending') || normalized.includes('inactive') || normalized.includes('review') || normalized.includes('draft')) {
    return 'status-warning';
  }
  return 'status-neutral';
};

const getOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getNormalizedText = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const getLookupOptionCode = (option?: InspectionLookupOption | null) =>
  getNormalizedText(option?.code);

const getLookupOptionLabel = (option?: InspectionLookupOption | null) =>
  getNormalizedText(option?.nameEn || option?.name || option?.code || option?.id);

const normalizeLookupKey = (value: unknown) =>
  getNormalizedText(value).replace(/[^a-z0-9]+/gi, '').toLowerCase();

const findLookupOptionByValue = (
  options: InspectionLookupOption[],
  value?: unknown,
) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return undefined;
  return options.find((option) =>
    [option.code, option.id, option.nameEn, option.nameAr, option.name].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

const OCR_MATERIAL_TYPE_LOOKUP_ALIASES: Record<string, string[]> = {
  BOOK: ['book', 'books'],
  NEWSPAPER_MAGAZINE: ['newspapermagazine', 'newspapersmagazines', 'newspaper', 'magazine'],
  MOVIE: ['movie', 'movies', 'cinema', 'film'],
  GAME: ['game', 'games', 'videogame', 'videogames'],
  OTHER: ['other'],
};

const getMaterialTypeLookupAliases = (value: unknown) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return [];

  if (OCR_MATERIAL_TYPE_LOOKUP_ALIASES.BOOK.includes(normalized)) {
    return OCR_MATERIAL_TYPE_LOOKUP_ALIASES.BOOK;
  }
  if (OCR_MATERIAL_TYPE_LOOKUP_ALIASES.NEWSPAPER_MAGAZINE.includes(normalized)) {
    return OCR_MATERIAL_TYPE_LOOKUP_ALIASES.NEWSPAPER_MAGAZINE;
  }
  if (OCR_MATERIAL_TYPE_LOOKUP_ALIASES.MOVIE.includes(normalized)) {
    return OCR_MATERIAL_TYPE_LOOKUP_ALIASES.MOVIE;
  }
  if (OCR_MATERIAL_TYPE_LOOKUP_ALIASES.GAME.includes(normalized)) {
    return OCR_MATERIAL_TYPE_LOOKUP_ALIASES.GAME;
  }
  if (OCR_MATERIAL_TYPE_LOOKUP_ALIASES.OTHER.includes(normalized)) {
    return OCR_MATERIAL_TYPE_LOOKUP_ALIASES.OTHER;
  }

  return [];
};

const findLookupOptionByAliases = (
  options: InspectionLookupOption[],
  aliases: string[],
) => {
  if (!aliases.length) return undefined;

  return options.find((option) =>
    [option.code, option.id, option.nameEn, option.nameAr, option.name].some(
      (candidate) => aliases.includes(normalizeLookupKey(candidate)),
    ),
  );
};

const isOtherLookupOption = (option?: InspectionLookupOption | null) =>
  [option?.code, option?.nameEn, option?.nameAr, option?.name].some(
    (value) => normalizeLookupKey(value) === 'other',
  );

const isBookMaterialText = (value: unknown) => {
  const normalized = normalizeLookupKey(value);
  return normalized === 'book' || normalized === 'books';
};

const isBookMaterialLookupOption = (option?: InspectionLookupOption | null) =>
  [option?.code, option?.nameEn, option?.nameAr, option?.name].some(
    (value) => isBookMaterialText(value),
  );

type GoogleMapPosition = {
  lat: number;
  lng: number;
};

type GoogleMapsAddressLanguage = 'ar' | 'en';

type InspectionGoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type InspectionGoogleGeocoderResult = {
  formatted_address: string;
  geometry?: {
    location?: InspectionGoogleLatLng;
  };
};

type InspectionGoogleMapInstance = {
  setCenter: (position: GoogleMapPosition) => void;
  setZoom: (zoom: number) => void;
};

type InspectionGoogleMarkerInstance = {
  setMap: (map: any | null) => void;
  setPosition: (position: GoogleMapPosition) => void;
};

type InspectionGoogleMapsApi = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: GoogleMapPosition;
        zoom: number;
        clickableIcons?: boolean;
        fullscreenControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
      }
    ) => InspectionGoogleMapInstance;
    Marker: new (options: {
      map: InspectionGoogleMapInstance;
      position: GoogleMapPosition;
    }) => InspectionGoogleMarkerInstance;
    Geocoder: new () => {
      geocode: (
        request: { address?: string; location?: GoogleMapPosition },
        callback: (results: InspectionGoogleGeocoderResult[] | null, status: string) => void
      ) => void;
    };
  };
};

type InspectionGoogleMapsWindow = Window & {
  google?: InspectionGoogleMapsApi;
  __googleMapsInitInspectionLocationMap__?: () => void;
  gm_authFailure?: () => void;
};

const googleMapsApiKey = getNormalizedText(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
const GOOGLE_MAP_SCRIPT_ID = 'google-maps-script';
const GOOGLE_MAP_CALLBACK = '__googleMapsInitInspectionLocationMap__';
const GOOGLE_GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_GOOGLE_MAP_CENTER = { lat: 25.2048, lng: 55.2708 };
const MAP_INIT_RETRY_DELAY = 150;
const MAP_INIT_MAX_RETRIES = 20;
const BROWSER_LOCATION_TIMEOUT = 8000;

let googleMapsScriptPromise: Promise<void> | null = null;

const getGoogleMapsWindow = () => window as InspectionGoogleMapsWindow;

const getGoogleMapsAddressLanguage = (language?: string): GoogleMapsAddressLanguage => (
  getNormalizedText(language).toLowerCase().startsWith('ar') ? 'ar' : 'en'
);

const loadGoogleMapsScript = (apiKey: string, language: GoogleMapsAddressLanguage = 'en') => {
  const googleWindow = getGoogleMapsWindow();

  if (googleWindow.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      const timeout = window.setTimeout(() => {
        if (googleWindow.google?.maps) {
          resolve();
          return;
        }

        googleMapsScriptPromise = null;
        reject(new Error('Google Maps script loaded but API is unavailable'));
      }, 5000);

      existingScript.addEventListener('load', () => {
        window.clearTimeout(timeout);
        if (googleWindow.google?.maps) {
          resolve();
          return;
        }

        googleMapsScriptPromise = null;
        reject(new Error('Google Maps script loaded but API is unavailable'));
      }, { once: true });
      existingScript.addEventListener('error', () => {
        window.clearTimeout(timeout);
        googleMapsScriptPromise = null;
        reject(new Error('Google Maps failed'));
      }, { once: true });
      return;
    }

    googleWindow.gm_authFailure = () => {
      googleMapsScriptPromise = null;
      reject(new Error('Google Maps authentication failed'));
    };

    googleWindow[GOOGLE_MAP_CALLBACK] = () => {
      resolve();
      delete googleWindow[GOOGLE_MAP_CALLBACK];
      delete googleWindow.gm_authFailure;
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${GOOGLE_MAP_CALLBACK}&loading=async&language=${language}`;
    script.onerror = () => {
      googleMapsScriptPromise = null;
      delete googleWindow[GOOGLE_MAP_CALLBACK];
      delete googleWindow.gm_authFailure;
      reject(new Error('Google Maps failed'));
    };

    document.body.appendChild(script);
  });

  return googleMapsScriptPromise;
};

const waitForMapContainerReady = (
  element: HTMLDivElement,
  retries = MAP_INIT_MAX_RETRIES,
): Promise<void> => {
  if (element.offsetWidth > 0 && element.offsetHeight > 0) {
    return Promise.resolve();
  }

  if (retries <= 0) {
    return Promise.reject(new Error('Map container is not visible yet'));
  }

  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      waitForMapContainerReady(element, retries - 1).then(resolve).catch(reject);
    }, MAP_INIT_RETRY_DELAY);
  });
};

const geocodeMapAddress = (
  geocoder: InstanceType<InspectionGoogleMapsApi['maps']['Geocoder']>,
  address: string,
) => new Promise<GoogleMapPosition | null>((resolve) => {
  geocoder.geocode({ address }, (results, status) => {
    if (status !== 'OK' || !results?.[0]?.geometry?.location) {
      resolve(null);
      return;
    }

    const location = results[0].geometry.location;
    resolve({
      lat: location.lat(),
      lng: location.lng(),
    });
  });
});

const reverseGeocodeBrowserPositionInEnglish = async (position: GoogleMapPosition) => {
  if (!googleMapsApiKey) return '';

  const params = new URLSearchParams({
    latlng: `${position.lat},${position.lng}`,
    key: googleMapsApiKey,
    language: 'en',
  });
  const response = await fetch(`${GOOGLE_GEOCODING_API_URL}?${params.toString()}`);

  if (!response.ok) {
    return '';
  }

  const payload = await response.json() as {
    status?: string;
    results?: Array<{ formatted_address?: string }>;
  };

  if (payload.status !== 'OK') {
    return '';
  }

  return getNormalizedText(payload.results?.[0]?.formatted_address);
};

type InspectionVisitLocation = {
  lat: number | null;
  lng: number | null;
  address: string;
};

const emptyInspectionVisitLocation = (): InspectionVisitLocation => ({
  lat: null,
  lng: null,
  address: '',
});

const getBrowserPosition = () => new Promise<GoogleMapPosition>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Browser geolocation unavailable'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    reject,
    {
      enableHighAccuracy: true,
      timeout: BROWSER_LOCATION_TIMEOUT,
      maximumAge: 0,
    },
  );
});

const resolveInspectionVisitLocation = async (): Promise<InspectionVisitLocation> => {
  try {
    const position = await getBrowserPosition();
    let address = '';

    try {
      if (googleMapsApiKey) {
        address = await reverseGeocodeBrowserPositionInEnglish(position);
      }
    } catch {
      address = '';
    }

    return {
      ...position,
      address,
    };
  } catch {
    return emptyInspectionVisitLocation();
  }
};

const getSocialMediaUrl = (value: unknown) => {
  const text = getNormalizedText(value);
  if (!/^https?:\/\//i.test(text)) return undefined;
  try {
    return new URL(text).href;
  } catch {
    return undefined;
  }
};

const inferSocialMediaPlatform = (value: unknown): SocialMediaPlatform | undefined => {
  const text = getNormalizedText(value).toLowerCase();
  if (!text) return undefined;
  if (text.includes('instagram') || text.includes('instagr.am')) return 'instagram';
  if (text.includes('youtube') || text.includes('youtu.be')) return 'youtube';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('facebook') || text.includes('fb.com')) return 'facebook';
  if (text.includes('snapchat') || text.includes('snap.com')) return 'snapchat';
  if (text === 'x' || text.includes('twitter') || text.includes('x.com')) return 'x';
  return undefined;
};

const getSocialMediaLookupOptionId = (option: InspectionSocialMediaLookupOption) =>
  getNormalizedText(option.id || option.Id);

const getSocialMediaLookupOptionLabel = (option?: InspectionSocialMediaLookupOption) =>
  getNormalizedText(option?.nameEn || option?.NameEn || option?.name || option?.Name || option?.code || option?.Code || option?.id || option?.Id);

const findSocialMediaLookupOption = (
  options: InspectionSocialMediaLookupOption[],
  socialMediaId?: unknown,
) => {
  const normalizedId = getNormalizedText(socialMediaId);
  if (!normalizedId) return undefined;
  return options.find((option) => getSocialMediaLookupOptionId(option) === normalizedId);
};

const normalizeWebsiteDisplayItems = (
  source: InspectionDigitalPresenceWebsite[] = [],
): WebsiteDisplayItem[] => source
  .map((item, index) => {
    const label = getNormalizedText(item.url || item.websiteUrl);
    if (!label) return null;
    return {
      key: `website-${getNormalizedText(item.externalMediaAccountId || item.socialMediaId || label)}-${index}`,
      label,
      url: getSocialMediaUrl(label),
    };
  })
  .filter(Boolean) as WebsiteDisplayItem[];

const normalizeDigitalPresenceSocialMediaItems = (
  source: InspectionDigitalPresenceSocialMedia[] = [],
  lookupOptions: InspectionSocialMediaLookupOption[] = [],
): SocialMediaDisplayItem[] => source
  .map((item, index) => {
    const lookupOption = findSocialMediaLookupOption(lookupOptions, item.socialMediaId);
    const lookupLabel = getSocialMediaLookupOptionLabel(lookupOption);
    const platformLabel = lookupLabel || getNormalizedText(item.socialMediaName);
    const label = getNormalizedText(item.accountName) || platformLabel || getNormalizedText(item.websiteUrl);
    if (!label) return null;

    return {
      key: `social-${getNormalizedText(item.externalMediaAccountId || item.socialMediaId || label)}-${index}`,
      label,
      platform: inferSocialMediaPlatform(`${platformLabel} ${item.websiteUrl || ''}`),
      url: getSocialMediaUrl(item.websiteUrl),
    };
  })
  .filter(Boolean) as SocialMediaDisplayItem[];

const GOOGLE_MAPS_LINK_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.ae',
  'www.google.ae',
  'goo.gl',
  'maps.app.goo.gl',
]);

// The stored link is operator-entered free text, so the host must match exactly —
// checking only the scheme would open any external site from an authenticated page,
// and a host regex would still admit lookalikes such as google.example.com.
const isGoogleMapsLink = (value: string) => {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === 'https:' && GOOGLE_MAPS_LINK_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
};

const buildMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const buildGoogleMapsNavigationUrl = ({
  address,
  latitude,
  longitude,
  locationUrl,
}: {
  address?: string;
  latitude?: number;
  longitude?: number;
  locationUrl?: string;
}) => {
  // A saved pin outranks every text form: it is the spot someone picked on a map,
  // whereas the text is only ever geocoded back to an approximation of it.
  if (
    typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude)
  ) {
    return buildMapsSearchUrl(`${latitude},${longitude}`);
  }
  if (locationUrl && isGoogleMapsLink(locationUrl)) return locationUrl;
  const addressQuery = getNormalizedText(address);
  return addressQuery && addressQuery !== '-'
    ? buildMapsSearchUrl(addressQuery)
    : 'https://www.google.com/maps';
};

function TargetAccessMap({
  address,
  latitude,
  longitude,
  locationUrl,
}: {
  address: string;
  latitude?: number;
  longitude?: number;
  locationUrl?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<InspectionGoogleMarkerInstance | null>(null);
  const { i18n, t } = useTranslation();
  const googleMapsLanguage = useMemo(
    () => getGoogleMapsAddressLanguage(i18n.language),
    [i18n.language],
  );
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const navigationUrl = buildGoogleMapsNavigationUrl({ address, latitude, longitude, locationUrl });

  useEffect(() => {
    let active = true;

    const renderMap = async () => {
      setMapLoading(true);
      setMapError('');

      try {
        if (!googleMapsApiKey) {
          throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
        }

        await loadGoogleMapsScript(googleMapsApiKey, googleMapsLanguage);

        const googleWindow = getGoogleMapsWindow();

        if (!active || !mapContainerRef.current || !googleWindow.google?.maps) {
          return;
        }

        await waitForMapContainerReady(mapContainerRef.current);

        if (!active || !mapContainerRef.current || !googleWindow.google?.maps) {
          return;
        }

        const googleMaps = googleWindow.google.maps;
        const explicitPosition = typeof latitude === 'number' && typeof longitude === 'number'
          ? { lat: latitude, lng: longitude }
          : null;
        const normalizedAddress = getNormalizedText(address);
        const map = new googleMaps.Map(mapContainerRef.current, {
          center: explicitPosition || DEFAULT_GOOGLE_MAP_CENTER,
          zoom: explicitPosition ? 15 : 11,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const position = explicitPosition || (
          normalizedAddress && normalizedAddress !== '-'
            ? await geocodeMapAddress(new googleMaps.Geocoder(), normalizedAddress)
            : null
        );

        if (!active) {
          return;
        }

        if (!position) {
          throw new Error('Map location unavailable');
        }

        map.setCenter(position);
        map.setZoom(15);

        if (!markerRef.current) {
          markerRef.current = new googleMaps.Marker({
            map,
            position,
          });
        } else {
          markerRef.current.setMap(map);
          markerRef.current.setPosition(position);
        }
      } catch (error) {
        if (active) {
          setMapError(error instanceof Error ? error.message : 'Failed to load Google Maps');
        }
      } finally {
        if (active) {
          setMapLoading(false);
        }
      }
    };

    renderMap();

    return () => {
      active = false;
    };
  }, [address, googleMapsLanguage, latitude, longitude]);

  return (
    <div className="inspection-start-visit__location-map">
      <div className="inspection-start-visit__location-map-frame" ref={mapContainerRef} />
      {mapLoading || mapError ? (
        <div className="inspection-start-visit__location-map-fallback">
          <strong>
            {mapLoading
              ? t("inspection.execution.mapLoading")
              : t("inspection.execution.mapUnavailable")}
          </strong>
          <span>{address}</span>
        </div>
      ) : null}
      <a
        className="inspection-start-visit__location-map-navigation"
        href={navigationUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t("inspection.execution.openInGoogleMaps")}
      </a>
    </div>
  );
}

const getTargetTypeNumber = (target?: Record<string, any> | null) => {
  const targetType = Number(target?.targetType);
  if (Number.isFinite(targetType) && targetType > 0) return targetType;

  const targetTypeId = Number(target?.targetTypeId);
  if (Number.isFinite(targetTypeId) && targetTypeId > 0) return targetTypeId;

  return undefined;
};

const getTargetTypeDescriptor = (target?: Record<string, any> | null) => String(
  [
    target?.targetTypeNameEn,
    target?.targetTypeName,
    target?.targetTypeCode,
    target?.userTypeName,
    target?.userTypeNameEn,
    target?.establishmentTypeName,
    target?.establishmentSubType,
  ]
    .filter(Boolean)
    .join(' '),
).toLowerCase();

const hasInspectionTargetEstablishmentEvidence = (target?: Record<string, any> | null) => {
  const rawTarget = target || {};
  const establishmentKeys = [
    'establishmentId',
    'establishmentName',
    'establishmentNameEn',
    'establishmentNameAr',
    'commercialLicenseNumber',
    'tradeLicenseNumber',
    'licenseNumber',
    'establishmentTypeId',
    'establishmentTypeName',
  ];

  return establishmentKeys.some((key) => {
    const value = rawTarget[key];
    return value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0';
  });
};

const resolveInspectionTargetOverviewType = (target?: Record<string, any> | null): TargetOverviewFullScreenType => {
  const targetType = getTargetTypeNumber(target);
  const targetTypeDescriptor = getTargetTypeDescriptor(target);
  const userTypeId = Number(target?.userTypeId ?? target?.userType?.id);

  if (
    targetType === 2 ||
    ['individual', 'person'].some((keyword) => targetTypeDescriptor.includes(keyword))
  ) {
    return 'Individual';
  }

  if (
    targetType === 1 ||
    targetType === 3 ||
    ['establishment', 'commercial', 'company', 'activity', 'government', 'embassy', 'consulate', 'cultural'].some((keyword) =>
      targetTypeDescriptor.includes(keyword))
  ) {
    return 'Commercial';
  }

  if (userTypeId === 1) return 'Individual';
  if (Number.isFinite(userTypeId) && userTypeId > 1) return 'Commercial';

  if (hasInspectionTargetEstablishmentEvidence(target)) return 'Commercial';

  return 'Commercial';
};

const getCommercialProfileTypeLabel = () => i18next.t('inspection.violation.detail.commercial');

const getIndividualProfileTypeLabel = () => i18next.t('inspection.violation.detail.individual');

const getInspectionTargetProfileTypeLabel = (target?: Record<string, any> | null) => {
  const overviewType = resolveInspectionTargetOverviewType(target);
  const explicitLabel = getFirstTextValue(
    target?.establishmentTypeName,
    target?.targetTypeNameEn,
    target?.targetTypeName,
    target?.targetTypeCode,
  );

  if (overviewType === 'Individual') {
    return getDisplayText(explicitLabel || getIndividualProfileTypeLabel(), getIndividualProfileTypeLabel());
  }

  if (explicitLabel && !['individual', 'person'].some((keyword) => explicitLabel.toLowerCase().includes(keyword))) {
    return getDisplayText(explicitLabel, getCommercialProfileTypeLabel());
  }

  return getCommercialProfileTypeLabel();
};

const getTargetOverviewProfileTypeLabel = (targetType: unknown) => {
  const numericTargetType = Number(targetType);
  if (numericTargetType === 1) return getCommercialProfileTypeLabel();
  if (numericTargetType === 2) return getIndividualProfileTypeLabel();
  return '-';
};

const normalizeOptionalId = (value: unknown): string | number | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return typeof value === 'number' ? value : String(value);
};

const normalizePositiveNumericId = (value: unknown): string | number | undefined => {
  const normalizedValue = normalizeOptionalId(value);
  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
  return normalizedValue;
};

const getTargetOverviewRecordKey = (target?: Record<string, any> | null) => {
  if (!target) return '';

  const resolvedTargetType = resolveInspectionTargetOverviewType(target);
  const targetType = resolvedTargetType === 'Commercial' ? 1 : 2;
  const targetId = Number(targetType) === 1
    ? normalizeOptionalId(target?.establishmentId)
    : normalizeOptionalId(
      getFirstRawValue(target || {}, [
        'userProfileId',
        'profileId',
        'individualId',
        'individualID',
        'personId',
      ]),
    );

  return [targetType, targetId].filter(Boolean).join(':');
};

const getChecklistItemSelectedViolationKeys = (item: any) => {
  const selectedKeys = ensureArray<any>(item.selectedViolationKeys || item.selectedViolations)
    .flatMap((violation) => (typeof violation === 'string' ? [violation] : getViolationSelectionKeys(violation)))
    .map(normalizeChecklistCode)
    .filter(Boolean);
  if (selectedKeys.length) return selectedKeys;
  if (normalizeChecklistResult(item.result) !== 'VIOLATION') return [];
  return getChecklistItemViolationOptionKeys(item);
};

const getChecklistItemSelectedViolations = (item: any) => {
  const selectedKeys = new Set(getChecklistItemSelectedViolationKeys(item).map(normalizeViolationSelectionKey));
  return getChecklistItemViolationSources(item).filter((violation) =>
    getViolationSelectionKeys(violation).some((key) => selectedKeys.has(normalizeViolationSelectionKey(key))));
};

const getChecklistCategoryKind = (category: any): 'content' | 'licensing' => {
  const categoryText = String(
    category?.categoryId ||
    category?.categoryName ||
    category?.categoryNameEn ||
    '',
  ).toLowerCase();

  if (categoryText.includes('content') || categoryText === 'c') return 'content';
  return 'licensing';
};

const getChecklistItemCategoryKind = (item: any): 'content' | 'licensing' => {
  const typeText = String(
    item?.violationTypeCode ||
    item?.violationType ||
    item?.categoryName ||
    '',
  ).toLowerCase();
  const typeId = Number(item?.violationTypeId);
  const checklistCode = normalizeChecklistCode(item?.checklistCode || item?.violationItemCode);

  if (typeText.includes('content') || typeId === 2 || checklistCode.startsWith('C')) {
    return 'content';
  }

  return 'licensing';
};

const getServerChecklistCategoryMeta = (kind: 'content' | 'licensing') => (
  kind === 'content'
    ? {
        categoryId: 'ContentViolation',
        categoryName: 'ContentViolation',
        categoryOrder: 2,
      }
    : {
        categoryId: 'LicensingViolation',
        categoryName: 'LicensingViolation',
        categoryOrder: 1,
      }
);

const buildOtherDetectedChecklistCategory = (checkItems: any[]) => ({
  categoryId: 'OTHER_DETECTED',
  categoryName: 'OTHER_DETECTED',
  categoryOrder: 999,
  isRequired: false,
  checkItems: ensureArray<any>(checkItems)
    .slice()
    .sort((next, current) => Number(next.itemOrder || 0) - Number(current.itemOrder || 0)),
});

const isOtherDetectedChecklistItem = (item: any) => Number(item?.itemOrder ?? item?.displayOrder) === 999;

const moveOtherDetectedChecklistItems = (categories: any[]) => {
  const otherItems: any[] = [];
  const regularCategories = ensureArray<any>(categories).flatMap((category) => {
    const checkItems = ensureArray<any>(category?.checkItems);
    if (category?.categoryId === 'OTHER_DETECTED') {
      otherItems.push(...checkItems);
      return [];
    }

    const regularItems = checkItems.filter((item) => !isOtherDetectedChecklistItem(item));
    const detectedItems = checkItems.filter(isOtherDetectedChecklistItem);
    otherItems.push(...detectedItems);

    if (!regularItems.length && checkItems.length) return [];
    return [{
      ...category,
      checkItems: regularItems,
    }];
  });

  if (!otherItems.length) return categories;

  return [
    ...regularCategories,
    buildOtherDetectedChecklistCategory(otherItems),
  ];
};

type ChecklistLocalizedTextField =
  | 'violationDescription'
  | 'violationDescriptionAr'
  | 'checklistName'
  | 'checklistNameAr';

const CHECKLIST_LOCALIZED_TEXT_FIELDS: ChecklistLocalizedTextField[] = [
  'violationDescription',
  'violationDescriptionAr',
  'checklistName',
  'checklistNameAr',
];

type ChecklistLocalizedTextEntry = Record<ChecklistLocalizedTextField, string>;

const getChecklistLocalizedTextEntry = (source: any): ChecklistLocalizedTextEntry => ({
  violationDescription: getChecklistItemViolationDescription(source),
  violationDescriptionAr: getChecklistItemViolationDescriptionAr(source),
  checklistName: getChecklistItemText(source),
  checklistNameAr: getChecklistItemTextAr(source),
});

const getChecklistLocalizedTextCatalogMap = (items?: any[]) => {
  const map = new Map<string, ChecklistLocalizedTextEntry>();
  ensureArray<any>(items).forEach((item) => {
    const entry = getChecklistLocalizedTextEntry(item);
    if (!CHECKLIST_LOCALIZED_TEXT_FIELDS.some((field) => entry[field])) return;

    [
      item?.checklistCode,
      item?.violationItemCode,
    ]
      .map(normalizeChecklistCode)
      .filter(Boolean)
      .forEach((code) => {
        if (!map.has(code)) {
          map.set(code, entry);
        }
      });
  });
  return map;
};

const getChecklistLocalizedTextPatch = (
  source: any,
  textByCode: Map<string, ChecklistLocalizedTextEntry>,
) => {
  const sourceCode = normalizeChecklistCode(source?.checklistCode || source?.violationItemCode);
  const entry = sourceCode ? textByCode.get(sourceCode) : undefined;
  if (!entry) return null;

  const patch: Partial<ChecklistLocalizedTextEntry> = {};
  CHECKLIST_LOCALIZED_TEXT_FIELDS.forEach((field) => {
    if (!getNormalizedText(source?.[field]) && entry[field]) {
      patch[field] = entry[field];
    }
  });

  return Object.keys(patch).length ? patch : null;
};

const hasChecklistLocalizedTextGapInSource = (source: any) => (
  Boolean(normalizeChecklistCode(source?.checklistCode || source?.violationItemCode)) &&
  CHECKLIST_LOCALIZED_TEXT_FIELDS.some((field) => !getNormalizedText(source?.[field]))
);

const hasChecklistLocalizedTextGap = (categories: any[]) => (
  ensureArray<any>(categories).some((category) =>
    ensureArray<any>(category?.checkItems).some((item) => (
      hasChecklistLocalizedTextGapInSource(item) ||
      ensureArray<any>(item?.relatedViolations).some(hasChecklistLocalizedTextGapInSource)
    )))
);

const hydrateChecklistLocalizedTexts = (categories: any[], catalogItems?: any[]) => {
  const textByCode = getChecklistLocalizedTextCatalogMap(catalogItems);
  if (!textByCode.size) return categories;

  let changed = false;
  const hydratedCategories = ensureArray<any>(categories).map((category) => ({
    ...category,
    checkItems: ensureArray<any>(category?.checkItems).map((item) => {
      let relatedChanged = false;
      const relatedViolations = ensureArray<any>(item?.relatedViolations).map((violation) => {
        const relatedPatch = getChecklistLocalizedTextPatch(violation, textByCode);
        if (!relatedPatch) return violation;
        changed = true;
        relatedChanged = true;
        return {
          ...violation,
          ...relatedPatch,
        };
      });

      const itemPatch = getChecklistLocalizedTextPatch(item, textByCode);
      if (!itemPatch) {
        return relatedChanged ? {
          ...item,
          relatedViolations,
        } : item;
      }

      changed = true;
      return {
        ...item,
        ...itemPatch,
        relatedViolations,
      };
    }),
  }));

  return changed ? hydratedCategories : categories;
};

const normalizeCategories = (categories: any[] = []) => categories.map((category, categoryIndex) => ({
  ...category,
  categoryName: category.categoryName || category.categoryNameEn || `Category ${categoryIndex + 1}`,
  checkItems: ensureArray(category.checkItems).map((item: any, itemIndex: number) => ({
    ...item,
    itemId: item.itemId || `${category.categoryId || categoryIndex}-${itemIndex}`,
    result: normalizeChecklistResult(item.result),
    remarks: item.remarks || item.comment || '',
    evidenceAttachments: ensureArray(item.evidenceAttachments || item.attachments),
    relatedViolations: ensureArray(item.relatedViolations),
    selectedViolationKeys: getChecklistItemSelectedViolationKeys(item),
  })),
}));

const normalizeChecklistCatalogItems = (source?: any) => {
  const items = ensureArray<any>(Array.isArray(source) ? source : source?.items)
    .filter((item) => item?.isVisibleInChecklist !== false && item?.isActive !== false);
  if (!items.length) return [];

  const grouped = new Map<string, any>();
  items
    .slice()
    .sort((next, current) => Number(next.displayOrder || 0) - Number(current.displayOrder || 0))
    .forEach((item, itemIndex) => {
      const categoryId = String(item.violationTypeCode || item.violationTypeId || 'GENERAL');
      const category = grouped.get(categoryId) || {
        categoryId,
        categoryName: item.violationTypeCode || 'General',
        categoryOrder: grouped.size + 1,
        isRequired: true,
        checkItems: [],
      };
      const relatedViolations = item.violationItemId || item.violationItemCode
        ? [{
            id: item.violationItemId,
            violationItemId: item.violationItemId,
            legacyViolationItemId: item.legacyViolationItemId,
            code: item.violationItemCode,
            violationItemCode: item.violationItemCode,
            checklistCode: item.checklistCode,
            violationTypeId: item.violationTypeId,
            violationTypeCode: item.violationTypeCode,
          }]
        : [];
      category.checkItems.push({
        itemId: String(item.id || item.checklistCode || `${categoryId}-${itemIndex}`),
        checklistCode: item.checklistCode,
        checklistName: item.checklistName,
        checklistNameAr: item.checklistNameAr,
        violationDescription: item.violationDescription,
        violationDescriptionEn: item.violationDescriptionEn,
        violationDescriptionAr: item.violationDescriptionAr,
        violationItemId: item.violationItemId,
        legacyViolationItemId: item.legacyViolationItemId,
        violationItemCode: item.violationItemCode,
        violationTypeId: item.violationTypeId,
        violationTypeCode: item.violationTypeCode,
        applicableTemplateTypes: ensureArray(item.applicableTemplateTypes),
        requiredWhenViolation: item.requiredWhenViolation,
        isSystemTriggered: item.isSystemTriggered,
        itemOrder: item.displayOrder || itemIndex + 1,
        result: normalizeChecklistResult(item.savedResult || item.resultId || item.result),
        remarks: item.savedNotes || item.notes || item.remarks || '',
        evidenceAttachments: ensureArray(item.attachments || item.evidenceAttachments),
        selectedViolationKeys: ensureArray<any>(item.selectedViolationKeys || item.selectedViolations)
          .flatMap((violation) => (typeof violation === 'string' ? [violation] : getViolationSelectionKeys(violation)))
          .map(normalizeChecklistCode)
          .filter(Boolean),
        relatedViolations: relatedViolations.map((violation) => ({
          violationId: violation.id || violation.violationItemId || item.violationItemId,
          violationItemId: violation.violationItemId || violation.id || item.violationItemId,
          legacyViolationItemId: violation.legacyViolationItemId || item.legacyViolationItemId,
          violationCode: violation.code || violation.violationItemCode || item.violationItemCode || item.checklistCode,
          violationItemCode: violation.violationItemCode || violation.code || item.violationItemCode || item.checklistCode,
          checklistCode: violation.checklistCode || item.checklistCode,
          violationName: item.violationDescription || item.violationItemCode || item.checklistCode,
          violationDescription: item.violationDescription,
          violationDescriptionEn: item.violationDescriptionEn,
          violationDescriptionAr: item.violationDescriptionAr,
          checklistName: item.checklistName,
          checklistNameAr: item.checklistNameAr,
          severity: item.severity || 'MEDIUM',
          violationTypeId: violation.violationTypeId || item.violationTypeId,
          violationTypeCode: violation.violationTypeCode || item.violationTypeCode,
        })),
      });
      grouped.set(categoryId, category);
    });

  return Array.from(grouped.values());
};

const normalizeServerChecklistProgressItems = (items?: any[]) => {
  const checkItems = ensureArray<any>(items).map((item, itemIndex) => {
    const violationSources = ensureArray<any>(
      item?.violations ||
      item?.selectedViolations ||
      item?.relatedViolations ||
      item?.violationItems,
    );
    const primaryViolation = violationSources[0] || {};
    const violationTypeId = item?.violationTypeId || primaryViolation?.violationTypeId;
    const violationTypeCode = item?.violationTypeCode || primaryViolation?.violationTypeCode;
    const relatedViolations = violationSources.map((violation) => ({
      violationId: violation?.violationItemId || violation?.violationId || violation?.id || item?.violationItemId,
      violationItemId: violation?.violationItemId || violation?.id || item?.violationItemId,
      legacyViolationItemId: violation?.legacyViolationItemId || item?.legacyViolationItemId,
      violationCode: violation?.violationItemCode || violation?.violationCode || violation?.code || item?.checklistCode,
      violationItemCode: violation?.violationItemCode || violation?.code || item?.violationItemCode || item?.checklistCode,
      checklistCode: violation?.checklistCode || item?.checklistCode,
      violationName: violation?.violationDescription || item?.violationDescription || violation?.violationItemName || violation?.violationItemCode || item?.violationItemCode || item?.checklistCode,
      violationDescription: violation?.violationDescription || item?.violationDescription,
      violationDescriptionEn: violation?.violationDescriptionEn || item?.violationDescriptionEn,
      violationDescriptionAr: violation?.violationDescriptionAr || item?.violationDescriptionAr,
      checklistName: violation?.checklistName || item?.checklistName,
      checklistNameAr: violation?.checklistNameAr || item?.checklistNameAr,
      applicableTemplateTypes: ensureArray(violation?.applicableTemplateTypes || item?.applicableTemplateTypes),
      severity: violation?.severity || item?.severity || 'MEDIUM',
      violationTypeId: violation?.violationTypeId || violationTypeId,
      violationTypeCode: violation?.violationTypeCode || violationTypeCode,
    }));
    const evidenceAttachments = ensureArray<any>(item?.attachments || item?.evidenceAttachments)
      .map((attachment, attachmentIndex) => normalizeAttachment(attachment, `server-checklist-${itemIndex}-${attachmentIndex}`));
    const result = normalizeChecklistResult(
      item?.resultId ||
      item?.checklistResultId ||
      item?.inspectionResultId ||
      item?.resultCode ||
      item?.result ||
      item?.savedResult,
    );

    const normalizedItem = {
      itemId: String(item?.checklistCode || item?.checklistItemId || item?.violationItemId || `server-${itemIndex}`),
      recordId: item?.id,
      checklistCode: item?.checklistCode,
      checklistName: item?.checklistName,
      checklistNameAr: item?.checklistNameAr,
      violationDescription: item?.violationDescription,
      violationDescriptionAr: item?.violationDescriptionAr,
      violationItemId: item?.violationItemId,
      legacyViolationItemId: item?.legacyViolationItemId,
      violationItemCode: item?.violationItemCode,
      violationTypeId,
      violationTypeCode,
      applicableTemplateTypes: ensureArray(item?.applicableTemplateTypes),
      itemOrder: item?.displayOrder || item?.itemOrder || itemIndex + 1,
      result,
      remarks: item?.notes || item?.remarks || item?.savedNotes || '',
      evidenceAttachments,
      relatedViolations,
    };
    const selectedViolationKeys = relatedViolations.map((violation) => getViolationKey(violation)).filter(Boolean);
    return {
      ...normalizedItem,
      selectedViolationKeys: selectedViolationKeys.length
        ? selectedViolationKeys
        : getChecklistItemSelectedViolationKeys(normalizedItem),
    };
  }).filter((item) => (
    item.checklistCode ||
    item.result ||
    item.remarks ||
    item.evidenceAttachments.length ||
    item.selectedViolationKeys.length
  ));

  if (!checkItems.length) return [];

  const grouped = new Map<'content' | 'licensing', any>();
  checkItems.forEach((item) => {
    const kind = getChecklistItemCategoryKind(item);
    const category = grouped.get(kind) || {
      ...getServerChecklistCategoryMeta(kind),
      isRequired: true,
      checkItems: [],
    };
    category.checkItems.push(item);
    grouped.set(kind, category);
  });

  return Array.from(grouped.values())
    .map((category) => ({
      ...category,
      checkItems: ensureArray(category.checkItems)
        .slice()
        .sort((next: any, current: any) => Number(next.itemOrder || 0) - Number(current.itemOrder || 0)),
    }))
    .sort((next, current) => Number(next.categoryOrder || 0) - Number(current.categoryOrder || 0));
};

const normalizeReportChecklistViolationProgress = (violations?: any[]) => normalizeServerChecklistProgressItems(
  ensureArray<any>(violations).map((violation, index) => ({
    ...violation,
    id: violation?.id || violation?.violationId || violation?.violationItemId || `report-violation-${index}`,
    checklistCode: violation?.checklistCode || violation?.violationItemCode || violation?.violationCode,
    checklistName: violation?.checklistName || violation?.checklistItemName || violation?.violationItemCode || violation?.violationCode,
    checklistNameAr: violation?.checklistNameAr || violation?.checklistItemNameAr,
    resultId: 2,
    notes: violation?.notes || violation?.remarks,
    attachments: violation?.attachments || violation?.evidenceAttachments,
    violations: [violation],
  })),
);

const getReportChecklistItemSources = (detail?: any) => {
  const reportPreview = detail?.reportPreview || {};
  const reportSummary = reportPreview?.reportSummary || {};
  return [
    reportSummary?.checklistItems,
    reportPreview?.checklistItems,
    detail?.report?.checklistItems,
  ];
};

const hasReportChecklistItems = (detail?: any) => (
  getReportChecklistItemSources(detail).some((source) => ensureArray(source).length > 0)
);

const getReportChecklistProgressCategories = (detail?: any) => {
  const reportPreview = detail?.reportPreview || {};
  const reportSummary = reportPreview?.reportSummary || {};

  for (const source of getReportChecklistItemSources(detail)) {
    const normalizedItems = normalizeServerChecklistProgressItems(source);
    if (normalizedItems.length) return normalizedItems;
  }

  const reportChecklistViolationSources = [
    reportSummary?.checklistViolations,
    reportPreview?.checklistViolations,
    detail?.report?.checklistViolations,
  ];

  for (const source of reportChecklistViolationSources) {
    const normalizedViolations = normalizeReportChecklistViolationProgress(source);
    if (normalizedViolations.length) return normalizedViolations;
  }

  return [];
};

const getFirstChecklistProgressCategories = (sources: any[]) => {
  for (const source of sources) {
    const normalizedItems = normalizeServerChecklistProgressItems(source);
    if (normalizedItems.length) return normalizedItems;
  }
  return [];
};

const getServerChecklistProgressCategories = (detail?: any) => {
  const reviewData = detail?.review || {};
  const reportChecklistProgressCategories = getReportChecklistProgressCategories(detail);
  const reviewChecklistProgressCategories = getFirstChecklistProgressCategories([
    reviewData?.checklistItems,
    reviewData?.executionDraft?.checklistItems,
    reviewData?.executionResult?.checklistItems,
  ]);

  if (reportChecklistProgressCategories.length) {
    return reviewChecklistProgressCategories.length
      ? mergeChecklistProgress(reportChecklistProgressCategories, reviewChecklistProgressCategories, {
        includeUnmatchedProgress: true,
      })
      : reportChecklistProgressCategories;
  }

  const detailChecklistProgressCategories = getFirstChecklistProgressCategories([
    detail?.checklistItems,
    detail?.executionDraft?.checklistItems,
    detail?.executionResult?.checklistItems,
  ]);

  if (detailChecklistProgressCategories.length) {
    return reviewChecklistProgressCategories.length
      ? mergeChecklistProgress(detailChecklistProgressCategories, reviewChecklistProgressCategories, {
        includeUnmatchedProgress: true,
      })
      : detailChecklistProgressCategories;
  }

  if (reviewChecklistProgressCategories.length) return reviewChecklistProgressCategories;

  const serverChecklistViolationSources = [
    reviewData?.checklistViolations,
    reviewData?.executionDraft?.checklistViolations,
    reviewData?.executionResult?.checklistViolations,
    detail?.executionDraft?.checklistViolations,
    detail?.executionResult?.checklistViolations,
  ];

  for (const source of serverChecklistViolationSources) {
    const normalizedViolations = normalizeReportChecklistViolationProgress(source);
    if (normalizedViolations.length) return normalizedViolations;
  }

  return [];
};

const buildChecklistProgressMap = (categories?: any[]) => {
  const progressMap = new Map<string, any>();
  ensureArray(categories).forEach((category) => {
    ensureArray<any>(category?.checkItems).forEach((item) => {
      getChecklistItemMergeKeys(item).forEach((itemKey) => {
        if (itemKey && !progressMap.has(itemKey)) {
          progressMap.set(itemKey, item);
        }
      });
    });
  });
  return progressMap;
};

const getChecklistCategoryMergeKey = (category: any) => (
  getChecklistCategoryKind(category) === 'content' ? 'content' : 'licensing'
);

const mergeProgressItemsIntoCategory = (category: any, progressItems: any[]) => {
  if (!progressItems.length) return category;

  const existingItems = ensureArray<any>(category.checkItems);
  const existingKeySet = new Set<string>();
  existingItems.forEach((item) => {
    getChecklistItemMergeKeys(item).forEach((itemKey) => {
      if (itemKey) existingKeySet.add(itemKey);
    });
  });

  const itemsToAdd = progressItems.filter((item) =>
    !getChecklistItemMergeKeys(item).some((itemKey) => existingKeySet.has(itemKey)));

  if (!itemsToAdd.length) return category;

  if (getChecklistCategoryKind(category) === 'content') {
    const boundaryIndex = getContentGeneralChecklistBoundaryIndex(category);
    const generalTemplateTypes = ensureArray<any>(existingItems[0]?.applicableTemplateTypes);
    const normalizedItems = itemsToAdd.map((item) => ({
      ...item,
      applicableTemplateTypes: ensureArray(item.applicableTemplateTypes).length
        ? item.applicableTemplateTypes
        : generalTemplateTypes,
    }));
    return {
      ...category,
      checkItems: [
        ...existingItems.slice(0, boundaryIndex),
        ...normalizedItems,
        ...existingItems.slice(boundaryIndex),
      ],
    };
  }

  return {
    ...category,
    checkItems: [...existingItems, ...itemsToAdd]
      .sort((next, current) => Number(next.itemOrder || 0) - Number(current.itemOrder || 0)),
  };
};

const mergeChecklistProgress = (
  baseCategories: any[],
  progressCategories?: any[],
  options: { includeUnmatchedProgress?: boolean; progressAuthoritative?: boolean } = {},
) => {
  if (!baseCategories.length || !ensureArray(progressCategories).length) {
    return baseCategories.length ? baseCategories : ensureArray(progressCategories);
  }

  const progressMap = buildChecklistProgressMap(progressCategories);
  if (!progressMap.size) {
    return baseCategories;
  }

  const baseMap = buildChecklistProgressMap(baseCategories);

  if (options.progressAuthoritative) {
    const authoritativeCategories = ensureArray<any>(progressCategories).map((category) => ({
      ...category,
      checkItems: ensureArray<any>(category.checkItems).map((progressItem) => {
        const baseItem = getChecklistItemMergeKeys(progressItem)
          .map((itemKey) => baseMap.get(itemKey))
          .find(Boolean);
        if (!baseItem) return progressItem;

        const nextItem = {
          ...baseItem,
          ...progressItem,
          violationDescription: getChecklistItemViolationDescription(progressItem) || baseItem.violationDescription,
          violationDescriptionAr: getChecklistItemViolationDescriptionAr(progressItem) || baseItem.violationDescriptionAr,
          checklistName: getChecklistItemText(progressItem) || baseItem.checklistName,
          checklistNameAr: getChecklistItemTextAr(progressItem) || baseItem.checklistNameAr,
          result: normalizeChecklistResult(progressItem.result) || normalizeChecklistResult(baseItem.result),
          remarks: progressItem.remarks ?? progressItem.comment ?? baseItem.remarks ?? '',
          evidenceAttachments: ensureArray(progressItem.evidenceAttachments || progressItem.attachments || baseItem.evidenceAttachments),
          selectedViolationKeys: progressItem.selectedViolationKeys,
          selectedViolations: progressItem.selectedViolations,
          relatedViolations: ensureArray(baseItem.relatedViolations).length
            ? baseItem.relatedViolations
            : ensureArray(progressItem.relatedViolations),
          applicableTemplateTypes: ensureArray(progressItem.applicableTemplateTypes).length
            ? progressItem.applicableTemplateTypes
            : baseItem.applicableTemplateTypes,
        };

        return {
          ...nextItem,
          selectedViolationKeys: getChecklistItemSelectedViolationKeys(nextItem),
        };
      }),
    }));
    return moveOtherDetectedChecklistItems(authoritativeCategories);
  }

  const baseItemKeys = new Set<string>();
  baseCategories.forEach((category) => {
    ensureArray<any>(category?.checkItems).forEach((item) => {
      getChecklistItemMergeKeys(item).forEach((itemKey) => {
        if (itemKey) baseItemKeys.add(itemKey);
      });
    });
  });

  const unmatchedProgressItems = options.includeUnmatchedProgress
    ? ensureArray<any>(progressCategories)
      .flatMap((category) => ensureArray<any>(category?.checkItems)
        .filter((item) => !getChecklistItemMergeKeys(item).some((itemKey) => baseItemKeys.has(itemKey))))
    : [];

  const unmatchedByCategory = new Map<string, any[]>();
  unmatchedProgressItems.forEach((item: any) => {
    const categoryKey = getChecklistItemCategoryKind(item);
    unmatchedByCategory.set(categoryKey, [
      ...ensureArray<any>(unmatchedByCategory.get(categoryKey)),
      item,
    ]);
  });

  const mergedCategories = baseCategories.map((category) => {
    const mergedCategory = {
      ...category,
      checkItems: ensureArray<any>(category.checkItems).map((item) => {
        const progressItem = getChecklistItemMergeKeys(item)
          .map((itemKey) => progressMap.get(itemKey))
          .find(Boolean);
        if (!progressItem) {
          return item;
        }

        const result = normalizeChecklistResult(progressItem.result) || normalizeChecklistResult(item.result);
        const nextItem = {
          ...item,
          recordId: progressItem.recordId ?? item.recordId,
          violationDescription: getChecklistItemViolationDescription(progressItem) || item.violationDescription,
          violationDescriptionAr: getChecklistItemViolationDescriptionAr(item) || getChecklistItemViolationDescriptionAr(progressItem),
          checklistName: getChecklistItemText(item) || getChecklistItemText(progressItem),
          checklistNameAr: getChecklistItemTextAr(item) || getChecklistItemTextAr(progressItem),
          result,
          remarks: progressItem.remarks ?? progressItem.comment ?? item.remarks ?? '',
          evidenceAttachments: ensureArray(progressItem.evidenceAttachments || progressItem.attachments || item.evidenceAttachments),
          selectedViolationKeys: progressItem.selectedViolationKeys,
          selectedViolations: progressItem.selectedViolations,
          relatedViolations: ensureArray(item.relatedViolations).length
            ? item.relatedViolations
            : ensureArray(progressItem.relatedViolations),
        };

        return {
          ...nextItem,
          selectedViolationKeys: getChecklistItemSelectedViolationKeys(nextItem),
        };
      }),
    };
    const categoryKey = getChecklistCategoryMergeKey(category);
    const unmatchedItems = ensureArray<any>(unmatchedByCategory.get(categoryKey));
    if (unmatchedItems.length) {
      unmatchedByCategory.delete(categoryKey);
    }

    return mergeProgressItemsIntoCategory(mergedCategory, unmatchedItems);
  });

  if (!unmatchedProgressItems.length) return moveOtherDetectedChecklistItems(mergedCategories);

  return moveOtherDetectedChecklistItems([
    ...mergedCategories,
    ...Array.from(unmatchedByCategory.entries()).map(([categoryKey, checkItems]) => ({
      ...getServerChecklistCategoryMeta(categoryKey === 'content' ? 'content' : 'licensing'),
      isRequired: true,
      checkItems,
    })),
  ]);
};

const buildAutosaveKey = (taskId: string, taskNo: string) => `inspectionExecutionDraft:${taskId || taskNo || 'unknown'}`;

const getChecklistTemplateSignature = (categories?: any[]) => ensureArray(categories)
  .flatMap((category) => ensureArray<any>(category?.checkItems))
  .map((item) => getNormalizedText(item?.checklistCode || item?.itemId))
  .filter(Boolean)
  .join('|');

const doesDraftMatchChecklistTemplate = (
  localDraft: Record<string, any>,
  templateCategories: any[],
) => {
  const templateSignature = getChecklistTemplateSignature(templateCategories);
  if (!templateSignature) return true;
  const draftSignature = getNormalizedText(localDraft?.checklistTemplateSignature);
  return draftSignature === templateSignature;
};

const hasDraftValue = (source: Record<string, any> = {}, key: string) => (
  Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined
);

const getExecutionDraftValue = (
  localDraft: Record<string, any>,
  summary: Record<string, any>,
  key: string,
) => {
  if (hasDraftValue(summary, key)) return summary[key];
  if (hasDraftValue(localDraft, key)) return localDraft[key];
  return undefined;
};

const getFirstSeizedMaterialValue = (...values: unknown[]) => (
  values.find((value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  })
);

const isRecordValue = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const getRecordValue = (value: unknown): Record<string, unknown> => (
  isRecordValue(value) ? value : {}
);

const getSeizedMaterialRows = (source: unknown): Record<string, unknown>[] => {
  if (Array.isArray(source)) return source.filter(isRecordValue);
  if (isRecordValue(source) && Array.isArray(source.items)) {
    return source.items.filter(isRecordValue);
  }
  return [];
};

const normalizeSeizedMaterialForEcho = (material: Record<string, unknown>, index: number) => {
  const materialType = getFirstSeizedMaterialValue(
    material.materialTypeCode,
    material.materialType,
    material.publicationType,
    material.materialTypeName,
    material.materialTypeId,
    material.type,
  );
  const title = getFirstSeizedMaterialValue(
    material.title,
    material.materialName,
    material.name,
    material.bookName,
    material.publicationName,
  );
  const quantity = getFirstSeizedMaterialValue(
    material.quantity,
    material.numberOfCopy,
    material.numberOfCopies,
    material.copies,
  );
  const languageId = material.languageId;
  const attachments = getSeizedMaterialRows(
    getFirstSeizedMaterialValue(material.attachments, material.files, material.documents),
  );

  return {
    ...material,
    id: material.id || material.materialId || material.seizedMaterialId || `seized-material-${index}`,
    materialType: getNormalizedText(material.materialType || materialType),
    materialTypeCode: getNormalizedText(material.materialTypeCode || materialType),
    materialTypeName: getNormalizedText(material.materialTypeName || material.materialType || materialType),
    title: getNormalizedText(title),
    quantity: quantity === undefined ? getPositiveIntegerNumber(material.quantity) : getPositiveIntegerNumber(quantity),
    languageId: getNormalizedText(languageId),
    attachments: attachments.length ? attachments : material.attachments,
  };
};

const normalizeOptionalBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = getNormalizedText(value).toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  return undefined;
};

const getFirstBooleanValue = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = normalizeOptionalBoolean(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
};

const createDefaultSeizedMaterial = () => ({
  id: `seized-material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
});

const ensureSeizedMaterialRows = (items: any[]) => (
  items.length ? items : [createDefaultSeizedMaterial()]
);

const resolveSeizedMaterialsEcho = (
  detail: Record<string, unknown>,
  reviewData: Record<string, unknown>,
  summary: Record<string, unknown>,
  localDraft: Record<string, unknown>,
) => {
  const reviewExecutionDraft = getRecordValue(reviewData.executionDraft);
  const reviewReportSummary = getRecordValue(reviewData.reportSummary);
  const reviewExecutionResult = getRecordValue(reviewData.executionResult);
  const detailExecutionDraft = getRecordValue(detail.executionDraft);
  const detailExecutionResult = getRecordValue(detail.executionResult);
  const detailExecutionState = getRecordValue(detail.executionState);
  const serverSources = [
    reviewData?.seizedMaterials,
    reviewExecutionDraft.seizedMaterials,
    reviewReportSummary.seizedMaterials,
    reviewExecutionResult.seizedMaterials,
    summary?.seizedMaterials,
    detailExecutionDraft.seizedMaterials,
    detailExecutionResult.seizedMaterials,
  ];
  const serverRows = serverSources.map(getSeizedMaterialRows).find((items) => items.length > 0);
  const serverHasSeizedMaterials = getFirstBooleanValue(
    reviewData?.hasSeizedMaterials,
    reviewExecutionDraft.hasSeizedMaterials,
    reviewReportSummary.hasSeizedMaterials,
    reviewExecutionResult.hasSeizedMaterials,
    summary?.hasSeizedMaterials,
    detailExecutionDraft.hasSeizedMaterials,
    detailExecutionResult.hasSeizedMaterials,
    detailExecutionState.hasSeizedMaterials,
  );
  const draftRows = getSeizedMaterialRows(localDraft?.seizedMaterials);
  const rows = serverRows || (serverHasSeizedMaterials === false ? [] : draftRows);
  const localHasSeizedMaterials = getFirstBooleanValue(localDraft?.hasSeizedMaterials);
  const hasSeizedMaterials = serverRows ? true : serverHasSeizedMaterials ?? localHasSeizedMaterials;

  return {
    hasSeizedMaterials,
    seizedMaterials: rows.map(normalizeSeizedMaterialForEcho),
  };
};

const InspectionStartVisitPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const params = new URLSearchParams(location.search);
  const taskId = params.get('taskId') || '';
  const taskNo = params.get('taskNo') || '';
  const initialStep = params.get('step') || 'targetAccess';
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskDetail, setTaskDetail] = useState<Record<string, any> | null>(null);
  const [inspectionLookupLoading, setInspectionLookupLoading] = useState(false);
  const [fieldAccessReasonLookupOptions, setFieldAccessReasonLookupOptions] = useState<InspectionLookupOption[]>([]);
  const [digitalAccessReasonLookupOptions, setDigitalAccessReasonLookupOptions] = useState<InspectionLookupOption[]>([]);
  const [materialTypeLookupOptions, setMaterialTypeLookupOptions] = useState<InspectionLookupOption[]>([]);
  const [languageLookupOptions, setLanguageLookupOptions] = useState<InspectionLanguageLookupOption[]>([]);
  const [socialMediaLookupOptions, setSocialMediaLookupOptions] = useState<InspectionSocialMediaLookupOption[]>([]);
  const [digitalPresence, setDigitalPresence] = useState<InspectionDigitalPresenceData>(emptyDigitalPresenceData);
  const [checklistCategories, setChecklistCategories] = useState<any[]>([]);
  const [checklistValidation, setChecklistValidation] = useState<ChecklistValidationState | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [resumeStepKey, setResumeStepKey] = useState('');
  const [preVisitVisible, setPreVisitVisible] = useState(false);
  const [preVisitChecked, setPreVisitChecked] = useState<string[]>([]);
  const [accessResult, setAccessResult] = useState<'accessed_successfully' | 'unable_to_access'>('accessed_successfully');
  const [accessReason, setAccessReason] = useState('');
  const [accessRemark, setAccessRemark] = useState('');
  const [accessAttachments, setAccessAttachments] = useState<any[]>([]);
  const [accessFailedModalVisible, setAccessFailedModalVisible] = useState(false);
  const [checkInAt, setCheckInAt] = useState('');
  const [checkOutAt, setCheckOutAt] = useState('');
  const [seizedMaterials, setSeizedMaterials] = useState<any[]>([]);
  const [seizedMaterialValidationErrors, setSeizedMaterialValidationErrors] = useState<SeizedMaterialValidationErrors>({});
  const [hasSeizedMaterials, setHasSeizedMaterials] = useState<boolean | null>(null);
  const [seizedDecisionVisible, setSeizedDecisionVisible] = useState(false);
  const [seizedDecisionSubmitting, setSeizedDecisionSubmitting] = useState<boolean | null>(null);
  const [fullChecklistVisible, setFullChecklistVisible] = useState(false);
  const [fullViolationCatalogLoading, setFullViolationCatalogLoading] = useState(false);
  const [fullViolationCatalogItems, setFullViolationCatalogItems] = useState<InspectionChecklistTemplateCatalogItem[]>([]);
  const [draftViolationKeys, setDraftViolationKeys] = useState<string[]>([]);
  const [ocrTypeVisible, setOcrTypeVisible] = useState(false);
  const [ocrResultVisible, setOcrResultVisible] = useState(false);
  const [ocrType, setOcrType] = useState<InspectionOcrScanSubType>('BOOK');
  const [ocrResult, setOcrResult] = useState<InspectionOcrResult | null>(null);
  const [ocrEditSaving, setOcrEditSaving] = useState(false);
  const [ocrFlow, setOcrFlow] = useState<OcrFlow>('checklist');
  const [ocrScanningSource, setOcrScanningSource] = useState<OcrActionSource | null>(null);
  const [submitSuccessVisible, setSubmitSuccessVisible] = useState(false);
  const [reinspectionVisible, setReinspectionVisible] = useState(false);
  const [declarationPreviewVisible, setDeclarationPreviewVisible] = useState(false);
  const [submitReportNeedsReinspection, setSubmitReportNeedsReinspection] = useState(true);
  const [reviewSectionOpen, setReviewSectionOpen] = useState<Record<ReviewSectionKey, boolean>>({
    checklist: true,
    seizedMaterials: true,
    contactPerson: true,
  });
  const [reviewChecklistItemOpen, setReviewChecklistItemOpen] = useState<Record<string, boolean>>({});
  const [checklistCategoryOpen, setChecklistCategoryOpen] = useState<Record<string, boolean>>({});
  const [contentViolationSelectorOpen, setContentViolationSelectorOpen] = useState<Record<string, boolean>>({});
  const [contentViolationGroupOpen, setContentViolationGroupOpen] = useState<Record<string, boolean>>({});
  const [contentViolationGroupResult, setContentViolationGroupResult] = useState<Record<string, string>>({});
  const [attachmentUploadingByKey, setAttachmentUploadingByKey] = useState<Record<string, boolean>>({});
  const [seizedMaterialCardOpen, setSeizedMaterialCardOpen] = useState<Record<string, boolean>>({});
  const [sideSectionOpen, setSideSectionOpen] = useState<Record<SideSectionKey, boolean>>({
    taskDetails: true,
    aiRiskInsight: true,
    targetOverview: true,
  });
  const [targetAccessCardOpen, setTargetAccessCardOpen] = useState<Record<TargetAccessCardKey, boolean>>({
    targetAccessInformation: true,
    digitalPresence: true,
  });
  const [targetOverviewExpanded, setTargetOverviewExpanded] = useState(false);
  const [taskDetailsExpanded, setTaskDetailsExpanded] = useState(false);
  const [expandedTaskDetailsSectionOpen, setExpandedTaskDetailsSectionOpen] = useState<Record<TaskDetailsExpandedSectionKey, boolean>>({
    taskInformation: true,
    targetHighlight: true,
    executionTimeline: true,
    relatedInspection: true,
  });
  const [targetOverviewQuickNav, setTargetOverviewQuickNav] = useState<TargetOverviewQuickNavTarget>(
    DEFAULT_TARGET_OVERVIEW_QUICK_NAV,
  );
  const [targetOverviewEstablishment, setTargetOverviewEstablishment] =
    useState<TargetOverviewEstablishmentData | null>(null);
  const [targetOverviewProfileAndApplicant, setTargetOverviewProfileAndApplicant] =
    useState<TargetOverviewProfileAndApplicantData | null>(null);
  const [targetOverviewProfileKey, setTargetOverviewProfileKey] = useState('');
  const [pendingSubmitSummary, setPendingSubmitSummary] = useState<Record<string, any> | null>(null);
  const [contactPersonOptions, setContactPersonOptions] = useState<InspectionContactPersonOption[]>([]);
  const [contactValues, setContactValues] = useState<Record<string, any> | null>(null);
  const [contactSignatureValidationError, setContactSignatureValidationError] = useState('');
  const [contactForm] = Form.useForm();
  const contactMobileSnapshotRef = useRef(createDefaultContactMobileSnapshot());
  const [submitReportForm] = Form.useForm();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const checklistValidationRef = useRef<HTMLDivElement | null>(null);
  const contactPersonConfirmationRef = useRef<HTMLElement | null>(null);
  const ocrUploadInputRef = useRef<HTMLInputElement | null>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement | null>(null);
  const pendingOcrSelectionRef = useRef<PendingOcrSelection | null>(null);
  const pendingReportSubmissionRef = useRef<PendingInspectionReportSubmission | null>(null);
  const pendingSubmitToastRef = useRef<PendingInspectionSubmitToast | null>(null);
  const submitSuccessPendingAfterReportCloseRef = useRef(false);
  const previousInitialStepRef = useRef<string | null>(null);
  const previousStepKeysRef = useRef<ExecutionStepKey[]>([]);
  const lastAutosavedStepRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const executionDataReadyRef = useRef(false);
  const routeStateRef = useRef({
    search: location.search,
    initialStep,
  });
  const seizedDecisionSubmittingRef = useRef(false);
  const allowNextNavigationRef = useRef(false);
  const leaveConfirmVisibleRef = useRef(false);
  const unblockLeaveGuardRef = useRef<(() => void) | null>(null);

  const getPageScrollContainer = useCallback(() => {
    const localContainer = scrollContainerRef.current;
    return localContainer?.closest<HTMLElement>('.page-content-scroll') ?? null;
  }, []);

  const scrollTargetInPageContainer = useCallback((target: HTMLElement, offset = 16) => {
    const pageScrollContainer = getPageScrollContainer();
    if (!pageScrollContainer) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const scrollRect = pageScrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextScrollTop = targetRect.top - scrollRect.top + pageScrollContainer.scrollTop - offset;

    pageScrollContainer.scrollTo({
      top: Math.max(nextScrollTop, 0),
      behavior: 'smooth',
    });
  }, [getPageScrollContainer]);

  const navigateWithoutLeaveConfirm = useCallback((navigate: () => void) => {
    allowNextNavigationRef.current = true;
    navigate();
    window.setTimeout(() => {
      allowNextNavigationRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const contactPersonTaskId = String(taskDetail?.taskId || taskId || '').trim();

  useEffect(() => {
    let active = true;

    if (!contactPersonTaskId) {
      setContactPersonOptions([]);
      return () => {
        active = false;
      };
    }

    getInspectionContactPersonOptions({ taskId: contactPersonTaskId })
      .then((options) => {
        if (active && isMountedRef.current) {
          setContactPersonOptions(options);
        }
      })
      .catch(() => {
        if (active && isMountedRef.current) {
          setContactPersonOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [contactPersonTaskId]);

  useEffect(() => {
    routeStateRef.current = {
      search: location.search,
      initialStep,
    };
  }, [initialStep, location.search]);

  useEffect(() => {
    let active = true;
    setInspectionLookupLoading(true);
    Promise.all([
      getInspectionFieldAccessFailedReasons().catch(() => []),
      getInspectionDigitalAccessFailedReasons().catch(() => []),
      getInspectionMaterialTypes().catch(() => []),
      getInspectionLanguages().catch(() => []),
      getInspectionSocialMediaLookupOptions().catch(() => []),
    ])
      .then(([fieldReasons, digitalReasons, materialTypes, languages, socialMediaOptions]) => {
        if (!active || !isMountedRef.current) return;
        setFieldAccessReasonLookupOptions(fieldReasons);
        setDigitalAccessReasonLookupOptions(digitalReasons);
        setMaterialTypeLookupOptions(materialTypes);
        setLanguageLookupOptions(languages);
        setSocialMediaLookupOptions(socialMediaOptions);
      })
      .finally(() => {
        if (active && isMountedRef.current) {
          setInspectionLookupLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const isDigitalInspection = useMemo(() => {
    const method = String(taskDetail?.inspectionConfig?.inspectionTypeNameEn || '').toLowerCase();
    return Boolean(taskDetail?.inspectionConfig?.isDigitalVisit || method.includes('digital'));
  }, [taskDetail]);

  const activeAccessReasonLookupOptions = useMemo(
    () => (isDigitalInspection ? digitalAccessReasonLookupOptions : fieldAccessReasonLookupOptions),
    [digitalAccessReasonLookupOptions, fieldAccessReasonLookupOptions, isDigitalInspection],
  );

  const getAccessReasonCodeByValue = useCallback((value?: unknown) => {
    const option = findLookupOptionByValue(activeAccessReasonLookupOptions, value);
    return getLookupOptionCode(option) || getNormalizedText(value);
  }, [activeAccessReasonLookupOptions]);

  const accessFailedModalValue = useMemo<UnableToAccessModalValue>(() => ({
    reason: getAccessReasonCodeByValue(accessReason),
    remark: accessRemark,
    attachments: accessAttachments,
  }), [accessAttachments, accessReason, accessRemark, getAccessReasonCodeByValue]);

  const accessReasonOptions = useMemo(() => activeAccessReasonLookupOptions
    .map((reason) => ({
      value: getLookupOptionCode(reason),
      label: getLookupOptionLabel(reason),
    }))
    .filter((reason) => reason.value && reason.label), [activeAccessReasonLookupOptions]);

  const selectedAccessReasonRemarkRequired = useMemo(
    () => isOtherLookupOption(findLookupOptionByValue(activeAccessReasonLookupOptions, accessFailedModalValue.reason)),
    [accessFailedModalValue.reason, activeAccessReasonLookupOptions],
  );

  const materialTypeSelectOptions = useMemo(() => materialTypeLookupOptions
    .map((materialType) => ({
      value: getLookupOptionCode(materialType),
      label: getLookupOptionLabel(materialType),
    }))
    .filter((materialType) => materialType.value && materialType.label), [materialTypeLookupOptions]);

  const getMaterialTypeOption = useCallback((value?: unknown) => {
    const directOption = findLookupOptionByValue(materialTypeLookupOptions, value);
    if (directOption) return directOption;

    const aliases = getMaterialTypeLookupAliases(value);
    return findLookupOptionByAliases(materialTypeLookupOptions, aliases);
  }, [materialTypeLookupOptions]);

  const getMaterialTypeCodeByValue = useCallback((
    value?: unknown,
    options: { preserveUnknown?: boolean } = {},
  ) => {
    const option = getMaterialTypeOption(value);
    if (option) return getLookupOptionCode(option);
    return options.preserveUnknown === false ? '' : getNormalizedText(value);
  }, [getMaterialTypeOption]);

  const getMaterialTypeLabelByValue = useCallback((
    value?: unknown,
    options: { preserveUnknown?: boolean } = {},
  ) => {
    const option = getMaterialTypeOption(value);
    if (option) return getLookupOptionLabel(option);
    return options.preserveUnknown === false ? '' : getNormalizedText(value);
  }, [getMaterialTypeOption]);

  const isBookMaterialTypeValue = useCallback(
    (value?: unknown) => isBookMaterialLookupOption(getMaterialTypeOption(value)) || isBookMaterialText(value),
    [getMaterialTypeOption],
  );

  const languageSelectOptions = useMemo(() => languageLookupOptions
    .map((language) => ({
      value: getNormalizedText(language.id),
      label: getNormalizedText(language.nameEn),
    }))
    .filter((language) => language.value && language.label), [languageLookupOptions]);

  const getLanguageOption = useCallback((languageId?: unknown) => {
    const normalizedLanguageId = getNormalizedText(languageId);
    if (!normalizedLanguageId) return undefined;
    return languageLookupOptions.find((language) =>
      getNormalizedText(language.id) === normalizedLanguageId);
  }, [languageLookupOptions]);

  const getLanguageIdByValue = useCallback((value?: unknown) => {
    const option = getLanguageOption(value);
    return getNormalizedText(option?.id);
  }, [getLanguageOption]);

  const getLanguageLookupIdByValue = useCallback((value?: unknown) => {
    const option = findLookupOptionByValue(languageLookupOptions, value);
    return getNormalizedText(option?.id);
  }, [languageLookupOptions]);

  const getLanguageLabelByValue = useCallback((value?: unknown) => {
    const option = getLanguageOption(value);
    return getNormalizedText(option?.nameEn);
  }, [getLanguageOption]);

  const getSeizedMaterialLanguageSelectValue = useCallback((material: Record<string, any>) => {
    const languageId = getNormalizedText(material.languageId);
    return getLanguageOption(languageId) ? languageId : undefined;
  }, [getLanguageOption]);

  const autosaveKey = useMemo(() => buildAutosaveKey(taskId, taskNo), [taskId, taskNo]);
  const taskRequest = useMemo(() => ({
    taskId: taskDetail?.taskId || taskId || taskNo,
    taskNo: taskDetail?.taskNo || taskNo,
  }), [taskDetail, taskId, taskNo]);
  const taskSubmissionKey = useMemo(
    () => `${String(taskRequest.taskId || '')}::${String(taskRequest.taskNo || '')}`,
    [taskRequest.taskId, taskRequest.taskNo],
  );
  const isInspectionAttachmentUploading = useMemo(
    () => Object.values(attachmentUploadingByKey).some(Boolean),
    [attachmentUploadingByKey],
  );

  useEffect(() => {
    pendingReportSubmissionRef.current = null;
    pendingSubmitToastRef.current = null;
    submitSuccessPendingAfterReportCloseRef.current = false;
    setPendingSubmitSummary(null);
    setSubmitSuccessVisible(false);
    setReinspectionVisible(false);
  }, [taskSubmissionKey]);

  const setInspectionAttachmentUploading = useCallback((key: string, uploading: boolean) => {
    setAttachmentUploadingByKey((prev) => {
      if (!uploading) {
        const { [key]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [key]: true };
    });
  }, []);

  const taskSummary = useMemo(() => ({
    targetName: getTaskTargetName(taskDetail),
    address: getTaskAddress(taskDetail),
    taskNo: taskDetail?.taskNo || taskNo || taskId || '-',
    inspector: getAssigneeName(taskDetail),
    plannedAt: formatDateTime(taskDetail?.plannedVisitAt || taskDetail?.createdAt),
    method: getDisplayText(taskDetail?.inspectionConfig?.inspectionTypeNameEn),
    reason: taskDetail?.inspectionConfig?.inspectionReasonNameEn || '-',
  }), [taskDetail, taskId, taskNo]);

  const reportSummary = useMemo<Record<string, any>>(
    () => taskDetail?.reportPreview?.reportSummary || {},
    [taskDetail],
  );

  const taskDetailsAttachments = useMemo(
    () => getTaskDetailsAttachments(taskDetail),
    [taskDetail],
  );

  const fetchData = useCallback(async () => {
    if (!taskId && !taskNo) return;
    executionDataReadyRef.current = false;
    if (isMountedRef.current) {
      setLoading(true);
    }
    const initialTaskRequest = { taskId, taskNo };
    const routeState = routeStateRef.current;
    const initialDigitalPresenceRequest = getInspectionTaskDigitalPresence(initialTaskRequest as any)
      .catch(() => emptyDigitalPresenceData);
    try {
      const taskPayload = await getAdminInspectionTaskDetail(
        initialTaskRequest as any,
        { includeFragments: INSPECTION_EXECUTION_DETAIL_FRAGMENTS },
      ).catch(() => getInspectionTaskDetail(
        initialTaskRequest as any,
        { includeFragments: INSPECTION_EXECUTION_DETAIL_FRAGMENTS },
      ));
      if (!isMountedRef.current) {
        return;
      }
      const detail = unwrapPayload<any>(taskPayload);
      const resolvedTaskRequest = {
        taskId: detail?.taskId || detail?.id || taskId,
        taskNo: detail?.taskNo || taskNo,
      };
      const normalizedRoutePath = buildInspectionPath(history.location.pathname, routeState.search, {
        mode: null,
      });
      if (normalizedRoutePath !== getLocationPath(history.location as BlockedNavigationLocation)) {
        navigateWithoutLeaveConfirm(() => {
          history.replace(normalizedRoutePath, history.location.state);
        });
      }
      if (isTerminalExecutionStep(detail)) {
        navigateWithoutLeaveConfirm(() => {
          history.replace(buildInspectionPath(INSPECTION_PATHS.taskDetail, routeState.search, {
            taskId: resolvedTaskRequest.taskId,
            taskNo: resolvedTaskRequest.taskNo,
            visitId: null,
            step: null,
            mode: null,
            reportNo: null,
          }));
        });
        return;
      }
      const digitalPresenceRequest = taskId || !resolvedTaskRequest.taskId
        ? initialDigitalPresenceRequest
        : getInspectionTaskDigitalPresence(resolvedTaskRequest as any).catch(() => emptyDigitalPresenceData);
      const [checklistItemsPayload, digitalPresencePayload] = await Promise.all([
        getInspectionTaskChecklistItems(resolvedTaskRequest as any).catch(() => null),
        digitalPresenceRequest,
      ]);
      if (!isMountedRef.current) {
        return;
      }
      const checklistItems = unwrapPayload<any>(checklistItemsPayload);
      const summary = detail?.reportPreview?.reportSummary || {};
      const reviewData = detail?.review || {};
      const executionState = detail?.executionState || {};
      const localDraft = JSON.parse(localStorage.getItem(autosaveKey) || 'null');
      const draft = localDraft?.taskNo === (detail?.taskNo || taskNo) ? localDraft : {};
      const checklistItemCategories = normalizeChecklistCatalogItems(checklistItems);
      const draftMatchesChecklistTemplate = doesDraftMatchChecklistTemplate(draft, checklistItemCategories);
      const serverChecklistProgressCategories = getServerChecklistProgressCategories(detail);
      let sourceCategories = checklistItemCategories.length
          ? mergeChecklistProgress(checklistItemCategories, serverChecklistProgressCategories, {
          includeUnmatchedProgress: true,
          progressAuthoritative: hasReportChecklistItems(detail),
        })
        : serverChecklistProgressCategories.length
          ? serverChecklistProgressCategories
          : [];
      if (hasChecklistLocalizedTextGap(sourceCategories)) {
        const catalogItems = await getInspectionChecklistTemplateItems({ includeInactive: false })
          .then((response) => unwrapPayload<InspectionChecklistTemplateCatalogItem[]>(response))
          .catch((): InspectionChecklistTemplateCatalogItem[] => []);
        if (!isMountedRef.current) {
          return;
        }
        if (catalogItems.length) {
          setFullViolationCatalogItems(catalogItems);
          sourceCategories = hydrateChecklistLocalizedTexts(sourceCategories, catalogItems);
        }
      }
      const routeStepKey = normalizeExecutionStepKey(routeState.initialStep);
      const draftStepKey = draftMatchesChecklistTemplate && draft?.currentStepCode
        ? normalizeExecutionStepKey(draft.currentStepCode)
        : '';
      const detailIsDigitalInspection = Boolean(
        detail?.inspectionConfig?.isDigitalVisit ||
        String(detail?.inspectionConfig?.inspectionTypeNameEn || '').toLowerCase().includes('digital'),
      );
      const shouldRestoreClientSeizedMaterialsStep = !detailIsDigitalInspection &&
        getTaskCurrentStepId(detail) === INSPECTION_EXECUTION_STEP_IDS.Checklist &&
        hasChecklistViolationInCategories(sourceCategories) &&
        (routeStepKey === 'seizedMaterials' || draftStepKey === 'seizedMaterials');
      const seizedMaterialsEcho = resolveSeizedMaterialsEcho(detail, reviewData, summary, draft);
      const normalizedSeizedMaterials = seizedMaterialsEcho.seizedMaterials;
      const sourceHasSeizedMaterials = seizedMaterialsEcho.hasSeizedMaterials;
      const resolvedHasSeizedMaterials = typeof sourceHasSeizedMaterials === 'boolean'
        ? sourceHasSeizedMaterials
        : normalizedSeizedMaterials.length > 0
          ? true
          : shouldRestoreClientSeizedMaterialsStep
            ? true
            : hasResolvedSeizedMaterialsDecision(detail) && !detailIsDigitalInspection
            ? false
            : null;

      setTaskDetail(detail || null);
      setDigitalPresence(digitalPresencePayload || emptyDigitalPresenceData);
      setChecklistCategories(normalizeCategories(sourceCategories));
      setChecklistValidation(null);
      setSeizedMaterials(normalizedSeizedMaterials);
      setHasSeizedMaterials(resolvedHasSeizedMaterials);
      setAccessResult(getExecutionDraftValue(draft, summary, 'accessResult') || 'accessed_successfully');
      setAccessReason(getExecutionDraftValue(draft, summary, 'accessReason') || '');
      setAccessRemark(getExecutionDraftValue(draft, summary, 'accessRemark') || '');
      setAccessAttachments(ensureArray(getExecutionDraftValue(draft, summary, 'accessAttachments')));
      setCheckInAt(getExecutionDraftValue(draft, summary, 'checkInAt') || executionState.checkinAt || executionState.checkInAt || summary.checkinAt || '');
      setCheckOutAt(getExecutionDraftValue(draft, summary, 'checkOutAt') || executionState.checkoutAt || executionState.checkOutAt || summary.checkoutAt || summary.checkOutAt || '');
      const contactPersonSource = ensureArray<any>(detail?.contactPersons)[0] || reviewData?.contactPerson || summary.contactPerson || (
        hasDraftValue(draft, 'contactPerson')
          ? draft.contactPerson
          : {});
      const contactMobileSnapshot = createContactPersonMobileSnapshot(contactPersonSource);
      contactMobileSnapshotRef.current = contactMobileSnapshot;
      setContactValues(normalizeContactPersonValues(contactPersonSource, contactMobileSnapshot));
      const preVisitChecklist = detail?.executionState?.preVisitChecklist || {};
      const preVisitCompleted = Boolean(
        preVisitChecklist.reviewTaskDetailConfirmed &&
        preVisitChecklist.reviewInspectionTargetDetailsConfirmed &&
        preVisitChecklist.ensureToolsReadyConfirmed,
      );
      const preVisitStarted = preVisitCompleted || hasStartedPreVisitExecution(detail);
      const backendStepKey = getExecutionStepFromTask(detail, {
        isDigitalInspection: detailIsDigitalInspection,
        checklistCategories: sourceCategories,
        hasSeizedMaterials: resolvedHasSeizedMaterials,
        seizedMaterials: normalizedSeizedMaterials,
      });
      const resolvedBackendStepKey = shouldRestoreClientSeizedMaterialsStep
        ? 'seizedMaterials'
        : backendStepKey;
      const resolvedResumeStepKey = hasTaskCurrentStepMarker(detail) ? resolvedBackendStepKey : draftStepKey;
      setResumeStepKey(resolvedResumeStepKey);
      if (resolvedResumeStepKey) {
        const currentLocation = history.location as BlockedNavigationLocation;
        const nextPath = buildInspectionPath(currentLocation.pathname, currentLocation.search || '', {
          step: resolvedResumeStepKey,
          mode: null,
        });
        if (nextPath !== getLocationPath(currentLocation)) {
          navigateWithoutLeaveConfirm(() => {
            history.replace(nextPath, currentLocation.state);
          });
        }
      }
      setPreVisitVisible(Boolean(detail && isPreVisitTaskStatus(detail.status) && !preVisitStarted));
    } catch (error) {
      if (isMountedRef.current) {
        const digitalPresencePayload = await initialDigitalPresenceRequest;
        if (!isMountedRef.current) {
          return;
        }
        if (isInspectionDataMissingError(error)) {
          setTaskDetail(null);
          setDigitalPresence(digitalPresencePayload || emptyDigitalPresenceData);
          setChecklistCategories([]);
          return;
        }
        setDigitalPresence(digitalPresencePayload || emptyDigitalPresenceData);
        CustomMessage.error(i18n.t('inspection.execution.messages.loadFailed'));
      }
    } finally {
      if (isMountedRef.current) {
        executionDataReadyRef.current = true;
        setLoading(false);
      }
    }
  }, [autosaveKey, history, i18n, navigateWithoutLeaveConfirm, taskId, taskNo]);

  const refreshTaskDetail = useCallback(async () => {
    const refreshRequest = {
      taskId: taskDetail?.taskId || taskId || taskNo,
      taskNo: taskDetail?.taskNo || taskNo,
    };

    if (!refreshRequest.taskId && !refreshRequest.taskNo) return null;

    const taskPayload = await getAdminInspectionTaskDetail(
      refreshRequest as any,
      { includeFragments: INSPECTION_EXECUTION_DETAIL_FRAGMENTS },
    ).catch(() => getInspectionTaskDetail(
      refreshRequest as any,
      { includeFragments: INSPECTION_EXECUTION_DETAIL_FRAGMENTS },
    ));
    const detail = unwrapPayload<any>(taskPayload);
    if (isMountedRef.current) {
      setTaskDetail(detail || null);
    }
    return detail || null;
  }, [taskDetail?.taskId, taskDetail?.taskNo, taskId, taskNo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let isCurrent = true;
    const target = taskDetail?.inspectionTarget;
    const establishmentId = normalizePositiveNumericId(target?.establishmentId);
    const targetOverviewType = resolveInspectionTargetOverviewType(target);
    const targetProfileId = normalizePositiveNumericId(
      getFirstRawValue(target || {}, [
        'userProfileId',
        'profileId',
        'individualId',
        'individualID',
        'personId',
      ]),
    );
    const targetKey = getTargetOverviewRecordKey(target);

    const clearTargetOverviewProfile = () => {
      setTargetOverviewEstablishment(null);
      setTargetOverviewProfileAndApplicant(null);
      setTargetOverviewProfileKey('');
    };

    const loadTargetOverviewProfile = async () => {
      if (!target || !targetKey) {
        clearTargetOverviewProfile();
        return;
      }

      setTargetOverviewEstablishment(null);
      setTargetOverviewProfileAndApplicant(null);
      setTargetOverviewProfileKey(targetKey);

      let nextEstablishment: TargetOverviewEstablishmentData | null = null;
      let nextProfileAndApplicant: TargetOverviewProfileAndApplicantData | null = null;

      if (targetOverviewType === 'Commercial' && establishmentId) {
        try {
          nextEstablishment =
            unwrapPayload<TargetOverviewEstablishmentData>(await getUserEstablishmentByID(String(establishmentId))) ||
            null;
        } catch {
          nextEstablishment = null;
        }

        const profileId = normalizePositiveNumericId(nextEstablishment?.userProfileId) ||
          targetProfileId;
        if (profileId) {
          try {
            nextProfileAndApplicant =
              unwrapPayload<TargetOverviewProfileAndApplicantData>(await profileAndApplicant(Number(profileId))) ||
              null;
          } catch {
            nextProfileAndApplicant = null;
          }
        }
      } else if (targetOverviewType === 'Individual' && targetProfileId) {
        try {
          nextProfileAndApplicant =
            unwrapPayload<TargetOverviewProfileAndApplicantData>(await profileAndApplicant(Number(targetProfileId))) ||
            null;
        } catch {
          nextProfileAndApplicant = null;
        }
      }

      if (!isCurrent) return;
      setTargetOverviewEstablishment(nextEstablishment);
      setTargetOverviewProfileAndApplicant(nextProfileAndApplicant);
      setTargetOverviewProfileKey(targetKey);
    };

    loadTargetOverviewProfile();

    return () => {
      isCurrent = false;
    };
  }, [taskDetail]);

  const allChecklistItems = useMemo(
    () => checklistCategories.flatMap((category: any, categoryIndex: number) =>
      ensureArray(category.checkItems).map((item: any, itemIndex: number) => ({ category, categoryIndex, item, itemIndex }))),
    [checklistCategories],
  );

  const checklistStats = useMemo(() => {
    const items = allChecklistItems.map((entry) => entry.item);
    return {
      total: items.length,
      compliant: items.filter((item) => normalizeChecklistResult(item.result) === 'COMPLIANT').length,
      violation: items.filter((item) => normalizeChecklistResult(item.result) === 'VIOLATION').length,
      completed: items.filter((item) => normalizeChecklistResult(item.result)).length,
    };
  }, [allChecklistItems]);

  const selectedViolations = useMemo(() => {
    const violations = new Map<string, any>();
    allChecklistItems.forEach(({ item }) => {
      if (normalizeChecklistResult(item.result) !== 'VIOLATION') return;
      getChecklistItemSelectedViolations(item).forEach((violation: any) => {
        const key = getViolationKey(violation);
        violations.set(key, violation);
      });
    });
    return Array.from(violations.values());
  }, [allChecklistItems]);

  const shouldAskSeizedMaterials = !isDigitalInspection && (
    checklistStats.violation > 0 ||
    hasSeizedMaterials === true ||
    seizedMaterials.length > 0
  );
  const shouldShowSeizedMaterials = !isDigitalInspection && hasSeizedMaterials === true;
  const shouldRequireContactPerson = !isDigitalInspection;
  const hasRecordedCheckIn = Boolean(
    checkInAt ||
    getTaskCheckInAt(taskDetail),
  );
  const shouldShowTargetAccessDecisionActions = Boolean(taskDetail) && (
    !hasTaskCurrentStepMarker(taskDetail) ||
    isTargetAccessDecisionStep(taskDetail)
  );

  useEffect(() => {
    if (!shouldAskSeizedMaterials && hasSeizedMaterials !== null) {
      setHasSeizedMaterials(null);
      setSeizedMaterials([]);
    }
  }, [hasSeizedMaterials, shouldAskSeizedMaterials]);

  const getStepConfigsForState = useCallback((
    overrides: Partial<FieldExecutionStepConfigOptions> = {},
  ) => {
    if (isDigitalInspection) {
      return digitalExecutionSteps;
    }

    return getFieldExecutionStepConfigs({
      shouldAskSeizedMaterials: overrides.shouldAskSeizedMaterials ?? shouldAskSeizedMaterials,
      hasSeizedMaterials: overrides.hasSeizedMaterials ?? hasSeizedMaterials,
    });
  }, [hasSeizedMaterials, isDigitalInspection, shouldAskSeizedMaterials]);

  const stepConfigs = useMemo(() => getStepConfigsForState(), [getStepConfigsForState]);
  const stepKeys = useMemo(() => stepConfigs.map((step) => step.key), [stepConfigs]);
  const activeStepKey = stepKeys[currentStep];

  const resolveStepIndex = useCallback((
    stepKey: ExecutionStepKey,
    overrides: Partial<FieldExecutionStepConfigOptions> = {},
  ) => {
    const keys = getStepConfigsForState(overrides).map((step) => step.key);
    const stepIndex = keys.indexOf(stepKey);
    if (stepIndex >= 0) {
      return stepIndex;
    }

    const reviewIndex = keys.indexOf('review');
    return reviewIndex >= 0 ? reviewIndex : Math.max(keys.length - 1, 0);
  }, [getStepConfigsForState]);

  const syncExecutionStepQuery = useCallback((stepKey: ExecutionStepKey) => {
    const currentLocation = history.location as BlockedNavigationLocation;
    const nextPath = buildInspectionPath(currentLocation.pathname, currentLocation.search || '', {
      step: stepKey,
      mode: null,
    });
    if (nextPath === getLocationPath(currentLocation)) return;

    navigateWithoutLeaveConfirm(() => {
      history.replace(nextPath, currentLocation.state);
    });
  }, [history, navigateWithoutLeaveConfirm]);

  const goToStep = useCallback((
    stepKey: ExecutionStepKey,
    overrides: Partial<FieldExecutionStepConfigOptions> = {},
  ) => {
    setResumeStepKey(stepKey);
    setCurrentStep(resolveStepIndex(stepKey, overrides));
    syncExecutionStepQuery(stepKey);
  }, [resolveStepIndex, syncExecutionStepQuery]);

  const scrollExecutionStepToTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      const pageScrollContainer = getPageScrollContainer();
      if (pageScrollContainer) {
        pageScrollContainer.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }

      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [getPageScrollContainer]);

  useEffect(() => {
    if (activeStepKey === 'seizedMaterials') {
      scrollExecutionStepToTop();
    }
  }, [activeStepKey, scrollExecutionStepToTop]);

  useEffect(() => {
    if (activeStepKey !== 'seizedMaterials' || !shouldShowSeizedMaterials || seizedMaterials.length) return;

    const nextMaterials = ensureSeizedMaterialRows(seizedMaterials);
    setSeizedMaterials(nextMaterials);
    setSeizedMaterialCardOpen((prev) => ({
      ...prev,
      [String(nextMaterials[0].id)]: true,
    }));
  }, [activeStepKey, seizedMaterials, shouldShowSeizedMaterials]);

  useEffect(() => {
    if (contactValues && !isDigitalInspection && stepKeys[currentStep] === 'review') {
      contactForm.setFieldsValue(contactValues);
    }
  }, [contactForm, contactValues, currentStep, isDigitalInspection, stepKeys]);

  const resolvedInitialStep = resumeStepKey || normalizeExecutionStepKey(initialStep) || 'targetAccess';

  useEffect(() => {
    const initialStepChanged = previousInitialStepRef.current !== resolvedInitialStep;
    const previousStepKeys = previousStepKeysRef.current;
    const resolvedStepKey = resolvedInitialStep as ExecutionStepKey;
    const resolvedStepBecameAvailable = !previousStepKeys.includes(resolvedStepKey) &&
      stepKeys.includes(resolvedStepKey);
    previousInitialStepRef.current = resolvedInitialStep;
    previousStepKeysRef.current = stepKeys;

    setCurrentStep((prev) => {
      const currentStepKey = stepKeys[prev];
      if (
        stepKeys.includes(resolvedStepKey) &&
        (initialStepChanged || resolvedStepBecameAvailable || currentStepKey !== resolvedStepKey)
      ) {
        return resolveStepIndex(resolvedStepKey);
      }

      const previousStepKey = previousStepKeys[prev];
      if (previousStepKey) {
        const nextIndex = stepKeys.indexOf(previousStepKey);
        if (nextIndex >= 0) return nextIndex;
      }

      return Math.min(prev, Math.max(stepKeys.length - 1, 0));
    });
  }, [resolvedInitialStep, resolveStepIndex, stepKeys]);

  const buildLocalExecutionDraft = useCallback((
    draftPatch: Partial<LocalExecutionDraft> = {},
  ): LocalExecutionDraft => {
    const formContactValues = contactForm.getFieldsValue(true);
    const contactPerson = getUrlSafeContactPersonValues({
      ...(contactValues || {}),
      ...formContactValues,
    });

    return {
      accessResult,
      accessReason,
      accessRemark,
      accessAttachments,
      checkInAt,
      checkOutAt,
      checklistTemplateSignature: getChecklistTemplateSignature(checklistCategories),
      seizedMaterials,
      hasSeizedMaterials,
      contactPerson,
      ...draftPatch,
    };
  }, [accessAttachments, accessReason, accessRemark, accessResult, checkInAt, checkOutAt, checklistCategories, contactForm, contactValues, hasSeizedMaterials, seizedMaterials]);

  const autosaveDraft = useCallback((
    draftPatch: Partial<LocalExecutionDraft> = {},
    stepKeyOverride?: ExecutionStepKey,
  ) => {
    if (!taskId && !taskNo) return;
    if (!executionDataReadyRef.current) return;
    const stepKey = stepKeyOverride || stepKeys[currentStep] || 'targetAccess';
    const payload = {
      taskId,
      taskNo: taskDetail?.taskNo || taskNo,
      savedAt: toApi(nowGst()),
      currentStepCode: getExecutionStepCode(stepKey),
      ...buildLocalExecutionDraft(draftPatch),
    };
    localStorage.setItem(autosaveKey, JSON.stringify(payload));
  }, [autosaveKey, buildLocalExecutionDraft, currentStep, stepKeys, taskDetail, taskId, taskNo]);

  useEffect(() => {
    if (!executionDataReadyRef.current) return;
    if (lastAutosavedStepRef.current === currentStep) return;
    lastAutosavedStepRef.current = currentStep;
    autosaveDraft();
  }, [autosaveDraft, currentStep]);

  useEffect(() => {
    const timer = window.setInterval(autosaveDraft, 10000);
    return () => window.clearInterval(timer);
  }, [autosaveDraft]);

  useEffect(() => {
    const handleDraftSaveRequest = () => {
      autosaveDraft();
    };

    window.addEventListener(INSPECTION_EXECUTION_SAVE_DRAFT_EVENT, handleDraftSaveRequest);
    return () => {
      window.removeEventListener(INSPECTION_EXECUTION_SAVE_DRAFT_EVENT, handleDraftSaveRequest);
    };
  }, [autosaveDraft]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      autosaveDraft();
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autosaveDraft]);

  useEffect(() => {
    const unblock = history.block((nextLocation, action) => {
      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false;
        return undefined;
      }

      const blockedLocation = nextLocation as BlockedNavigationLocation;
      const navigationAction = action as BlockedNavigationAction;
      const nextPath = getLocationPath(blockedLocation);
      const currentPath = getLocationPath(history.location);

      if (nextPath === currentPath) {
        return undefined;
      }

      if (consumeInspectionLeaveConfirmBypass(blockedLocation.state)) {
        return undefined;
      }

      if (leaveConfirmVisibleRef.current) {
        return false;
      }

      leaveConfirmVisibleRef.current = true;
      showLeavePageConfirm({
        title: t('inspection.execution.leaveConfirm.title'),
        content: t('inspection.execution.leaveConfirm.content'),
        okText: t('inspection.execution.leaveConfirm.leave'),
        cancelText: t('inspection.common.no'),
        onCancel: () => {
          leaveConfirmVisibleRef.current = false;
        },
        onOk: () => {
          leaveConfirmVisibleRef.current = false;
          autosaveDraft();
          const releaseGuard = unblockLeaveGuardRef.current;
          unblockLeaveGuardRef.current = null;
          releaseGuard?.();

          if (navigationAction === 'REPLACE' || navigationAction === 'POP') {
            history.replace(nextPath, blockedLocation.state);
            return;
          }

          history.push(nextPath, blockedLocation.state);
        },
      });

      return false;
    });

    unblockLeaveGuardRef.current = unblock;
    return () => {
      unblockLeaveGuardRef.current = null;
      unblock();
    };
  }, [autosaveDraft, history, t]);

  const updateChecklistItem = (categoryIndex: number, itemIndex: number, patch: Record<string, any>) => {
    setChecklistValidation(null);
    setChecklistCategories((prev) => prev.map((category, cIndex) => cIndex !== categoryIndex ? category : {
      ...category,
      checkItems: ensureArray(category.checkItems).map((item: any, iIndex: number) => iIndex === itemIndex ? { ...item, ...patch } : item),
    }));
  };

  const getChecklistAttachmentUploadKey = (categoryIndex: number, itemIndex: number) =>
    `checklist-${categoryIndex}-${itemIndex}`;

  const validateInspectionAttachmentFile = (
    file: RcFile,
    currentCount: number,
    allowedExtensions = INSPECTION_ATTACHMENT_EXTENSIONS,
    maxCount: number = INSPECTION_ATTACHMENT_MAX_COUNT,
  ) => {
    const extension = getFileExtension(file.name);
    if (!allowedExtensions.includes(extension)) {
      const fileTypes = formatInspectionAttachmentFileTypes(allowedExtensions, i18n.language);
      CustomMessage.error(t(
        allowedExtensions.length === 1
          ? 'inspection.tasks.messages.invalidAttachmentFileTypeSingle'
          : 'inspection.tasks.messages.invalidAttachmentFileType',
        { fileType: fileTypes, fileTypes },
      ));
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 > INSPECTION_ATTACHMENT_MAX_SIZE_MB) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentFileSizeExceeded', { maxSize: INSPECTION_ATTACHMENT_MAX_SIZE_MB }));
      return Upload.LIST_IGNORE;
    }
    if (currentCount >= maxCount) {
      CustomMessage.error(t(
        maxCount === 1
          ? 'inspection.tasks.messages.attachmentUploadLimitSingle'
          : 'inspection.tasks.messages.attachmentUploadLimit',
        { maxCount },
      ));
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleChecklistEvidenceUpload = async (
    categoryIndex: number,
    itemIndex: number,
    options: UploadRequestOption,
  ) => {
    const file = options.file as RcFile;
    const uploadKey = getChecklistAttachmentUploadKey(categoryIndex, itemIndex);
    setInspectionAttachmentUploading(uploadKey, true);
    try {
      const uploadResult = await uploadInspectionFile(file);
      const nextAttachment = buildInspectionUploadedAttachment(uploadResult, 'ChecklistItem');
      setChecklistValidation(null);
      setChecklistCategories((prev) => prev.map((category, cIndex) => cIndex !== categoryIndex ? category : {
        ...category,
        checkItems: ensureArray(category.checkItems).map((item: any, iIndex: number) => iIndex === itemIndex
          ? {
              ...item,
              evidenceAttachments: [
                ...ensureArray<InspectionTaskAttachmentPayload>(item.evidenceAttachments),
                nextAttachment,
              ],
            }
          : item),
      }));
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentUploadFailed'));
      options.onError?.(error as Error);
    } finally {
      setInspectionAttachmentUploading(uploadKey, false);
    }
  };

  const handleChecklistResultChange = (categoryIndex: number, itemIndex: number, result: string) => {
    const item = checklistCategories[categoryIndex]?.checkItems?.[itemIndex];
    const violationKeys = getChecklistItemViolationOptionKeys(item);
    const itemKey = getChecklistItemKey(item, categoryIndex, itemIndex);
    if (result === 'VIOLATION') {
      setContentViolationSelectorOpen((prev) => ({ ...prev, [itemKey]: true }));
      updateChecklistItem(categoryIndex, itemIndex, {
        result,
        selectedViolationKeys: getChecklistItemSelectedViolationKeys(item).length
          ? getChecklistItemSelectedViolationKeys(item)
          : violationKeys,
      });
      return;
    }
    setContentViolationSelectorOpen((prev) => ({ ...prev, [itemKey]: false }));
    updateChecklistItem(categoryIndex, itemIndex, {
      result,
      selectedViolationKeys: [],
      evidenceAttachments: [],
      remarks: '',
    });
  };

  const handleChecklistViolationToggle = (categoryIndex: number, itemIndex: number, keys: string[]) => {
    const item = checklistCategories[categoryIndex]?.checkItems?.[itemIndex];
    const itemKey = getChecklistItemKey(item, categoryIndex, itemIndex);
    setContentViolationSelectorOpen((prev) => ({ ...prev, [itemKey]: true }));
    updateChecklistItem(categoryIndex, itemIndex, {
      result: 'VIOLATION',
      selectedViolationKeys: keys,
    });
  };

  const getContentGroupActiveResult = (category: any, categoryIndex: number) => {
    const groupKey = getContentViolationGroupKey(category, categoryIndex);
    const groupItems = getContentGeneralChecklistEntries(category).map(({ item }) => item);
    return contentViolationGroupResult[groupKey] || getContentViolationGroupResult(groupItems);
  };

  const handleContentGroupResultChange = (categoryIndex: number, result: string) => {
    const category = checklistCategories[categoryIndex];
    const groupKey = getContentViolationGroupKey(category, categoryIndex);
    setChecklistValidation(null);
    setContentViolationGroupResult((prev) => ({ ...prev, [groupKey]: result }));
    if (result === 'VIOLATION') {
      setContentViolationGroupOpen((prev) => ({ ...prev, [groupKey]: true }));
      return;
    }
    setChecklistCategories((prev) => prev.map((itemCategory, cIndex) => cIndex !== categoryIndex ? itemCategory : {
      ...itemCategory,
      checkItems: ensureArray(itemCategory.checkItems).map((item: any, itemIndex: number) => (
        isStandaloneContentChecklistItem(itemCategory, itemIndex)
          ? item
          : {
              ...item,
              result,
              selectedViolationKeys: [],
              evidenceAttachments: [],
              remarks: '',
            }
      )),
    }));
  };

  const handleContentViolationItemToggle = (categoryIndex: number, itemIndex: number, checked: boolean) => {
    const category = checklistCategories[categoryIndex];
    const item = category?.checkItems?.[itemIndex];
    const groupKey = getContentViolationGroupKey(category, categoryIndex);
    setChecklistValidation(null);
    setContentViolationGroupResult((prev) => ({ ...prev, [groupKey]: 'VIOLATION' }));
    setContentViolationGroupOpen((prev) => ({ ...prev, [groupKey]: true }));
    if (checked) {
      const selectedKeys = getChecklistItemViolationOptionKeys(item);
      updateChecklistItem(categoryIndex, itemIndex, {
        result: 'VIOLATION',
        selectedViolationKeys: selectedKeys,
      });
      return;
    }

    const clearViolationItem = () => updateChecklistItem(categoryIndex, itemIndex, {
      result: 'COMPLIANT',
      selectedViolationKeys: [],
      evidenceAttachments: [],
      remarks: '',
    });

    if (!hasChecklistItemEvidence(item)) {
      clearViolationItem();
      return;
    }

    showRemoveViolationConfirm({
      title: t('inspection.execution.removeViolationTitle'),
      content: t('inspection.execution.removeViolationContent'),
      okText: t('inspection.common.confirm'),
      cancelText: t('inspection.common.cancel'),
      onOk: clearViolationItem,
    });
  };

  const buildChecklistSaveItems = useCallback(() => allChecklistItems.map(({ item }) => {
    const result = normalizeChecklistResult(item.result);
    const selectedViolations = result === 'VIOLATION'
      ? getChecklistItemSelectedViolations(item)
        .map((violation: any) => ({
          violationItemId: getOptionalNumber(violation.violationItemId || violation.violationId || item.violationItemId) || 0,
          violationItemCode: getNormalizedText(violation.violationItemCode || violation.violationCode || violation.code || item.violationItemCode || item.checklistCode),
          violationTypeId: getOptionalNumber(violation.violationTypeId || item.violationTypeId) || 0,
          violationDescription: getChecklistItemViolationDescription(violation) || getChecklistItemViolationDescription(item),
          violationDescriptionEn: getChecklistItemViolationDescriptionEn(violation) || getChecklistItemViolationDescriptionEn(item) || null,
          violationDescriptionAr: getChecklistItemViolationDescriptionAr(violation) || getChecklistItemViolationDescriptionAr(item) || null,
        }))
        .filter((violation) => violation.violationItemId && violation.violationItemCode && violation.violationTypeId)
      : [];
    return {
      checklistCode: item.checklistCode || item.itemId,
      checklistName: getChecklistItemText(item),
      resultId: resultIdByChecklistResult[result] || 1,
      notes: item.remarks || '',
      displayOrder: item.itemOrder,
      attachments: ensureArray<any>(item.evidenceAttachments).map((file, index) =>
        normalizeAttachment(file, `checklist-${item.itemId}-${index + 1}`)),
      ...(selectedViolations.length ? { selectedViolations } : {}),
    };
  }), [allChecklistItems]);

  const buildSeizedMaterialSaveItems = useCallback(() => seizedMaterials.map((material, index) => ({
    ...material,
    materialTypeCode: getMaterialTypeCodeByValue(
      material.materialTypeCode || material.materialType || material.publicationType,
      { preserveUnknown: false },
    ),
    materialTypeName: getMaterialTypeLabelByValue(
      material.materialTypeCode || material.materialType || material.publicationType,
      { preserveUnknown: false },
    ),
    languageId: getLanguageIdByValue(material.languageId),
    quantity: getPositiveIntegerNumber(material.quantity || material.numberOfCopy),
    numberOfCopy: getPositiveIntegerNumber(material.quantity || material.numberOfCopy) || 1,
    attachments: ensureArray<any>(material.attachments).map((file) => normalizeAttachment(file, `seized-${index + 1}`)),
  })), [getLanguageIdByValue, getMaterialTypeCodeByValue, getMaterialTypeLabelByValue, seizedMaterials]);

  const uploadSignatureImage = useCallback(async (signatureDataUrl: string) => {
    const fileName = getSignatureFileName(taskRequest.taskNo, taskRequest.taskId);
    const signatureFile = dataUrlToFile(signatureDataUrl, fileName);
    return uploadInspectionFile(signatureFile);
  }, [taskRequest.taskId, taskRequest.taskNo]);

  const ensureSignatureImageUploaded = useCallback(async () => {
    const values = contactForm.getFieldsValue(true);

    if (values.declarationStatus !== 'signed') {
      if (values.declarationStatus !== 'not_signed') {
        return values;
      }
      const nextValues = getUrlSafeContactPersonValues(values);
      contactForm.setFieldsValue(nextValues);
      setContactValues(nextValues);
      return nextValues;
    }

    if (values.signatureImageFileUrl) {
      const signatureDataUrl = normalizeSignatureImageDisplayUrl(values.signatureDataUrl || values.signatureImageFileUrl);
      if (signatureDataUrl !== values.signatureDataUrl) {
        const nextValues = { ...values, signatureDataUrl };
        contactForm.setFieldsValue({ signatureDataUrl });
        setContactValues(nextValues);
        return nextValues;
      }
      return values;
    }

    if (!values.signatureDataUrl) {
      return values;
    }

    if (!isSignatureDataUrl(values.signatureDataUrl)) {
      return values;
    }

    const uploadResult = await uploadSignatureImage(values.signatureDataUrl);
    const patch = {
      signatureImageFileName: uploadResult.fileName,
      signatureImageFileUrl: uploadResult.fileUrl,
    };
    const nextValues = { ...values, ...patch };
    contactForm.setFieldsValue(patch);
    setContactValues(nextValues);
    return nextValues;
  }, [contactForm, uploadSignatureImage]);

  const getExecutionSummary = async (validateContact = true) => {
    if (validateContact) {
      await contactForm.validateFields();
    }
    const contactValues = getUrlSafeContactPersonValues(await ensureSignatureImageUploaded());
    const reportMobileFields = buildContactNumberFields({
      value: readContactFormValue(contactValues.mobilePhone, contactMobileFieldNames),
      initial: contactMobileSnapshotRef.current,
      keys: {
        fullNumber: 'mobilePhone',
        countryCode: 'mobileCountryCode',
        localNumber: 'mobileLocalNumber',
      },
    });
    const contactPerson = {
      ...contactValues,
      ...reportMobileFields,
      designation: contactValues.designation || contactValues.position,
    };
    return {
      accessResult,
      accessReason,
      accessRemark,
      accessAttachments,
      location: isDigitalInspection ? undefined : taskSummary.address,
      checkInAt: checkInAt || taskDetail?.createdAt || toApi(nowGst()),
      checkOutAt: checkOutAt || toApi(nowGst()),
      seizedMaterials,
      hasSeizedMaterials,
      contactPerson,
      selectedViolations,
      violationCount: checklistStats.violation,
      submittedAt: toApi(nowGst()),
      needsReinspection: false,
      reinspectionDate: undefined,
    };
  };

  const validateAccess = (result = accessResult, values = accessFailedModalValue) => {
    if (result !== 'unable_to_access') return true;
    if (!values.reason) {
      CustomMessage.error(t('inspection.execution.messages.accessReasonRequired'));
      return false;
    }
    if (!values.attachments.length) {
      CustomMessage.error(t('inspection.execution.messages.accessAttachmentRequired'));
      return false;
    }
    if (isOtherLookupOption(findLookupOptionByValue(activeAccessReasonLookupOptions, values.reason)) && !values.remark.trim()) {
      CustomMessage.error(t('inspection.execution.messages.accessRemarkRequired'));
      return false;
    }
    return true;
  };

  const scrollToChecklistValidationTarget = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scrollContainer = scrollContainerRef.current;
        const targetNode = scrollContainer?.querySelector<HTMLElement>('[data-checklist-validation-target="true"]') ||
          checklistValidationRef.current;
        if (!targetNode) return;

        scrollTargetInPageContainer(targetNode, 16);
      });
    });
  }, [scrollTargetInPageContainer]);

  const showChecklistValidation = useCallback((nextValidation: ChecklistValidationState) => {
    setChecklistValidation(nextValidation);

    if (typeof nextValidation.categoryIndex === 'number') {
      const category = checklistCategories[nextValidation.categoryIndex];
      const categoryKey = getChecklistCategoryKey(category, nextValidation.categoryIndex);
      setChecklistCategoryOpen((prev) => ({ ...prev, [categoryKey]: true }));

      const validationItem = typeof nextValidation.itemIndex === 'number'
        ? ensureArray<any>(category?.checkItems)[nextValidation.itemIndex]
        : undefined;
      if (getChecklistCategoryKind(category) === 'content' &&
        (typeof nextValidation.itemIndex !== 'number' || !isStandaloneContentChecklistItem(category, nextValidation.itemIndex))) {
        const groupKey = getContentViolationGroupKey(category, nextValidation.categoryIndex);
        setContentViolationGroupOpen((prev) => ({ ...prev, [groupKey]: true }));
      }

      if (typeof nextValidation.itemIndex === 'number') {
        const item = validationItem;
        const itemKey = getChecklistItemKey(item, nextValidation.categoryIndex, nextValidation.itemIndex);
        setContentViolationSelectorOpen((prev) => ({ ...prev, [itemKey]: true }));
      }
    }

    CustomMessage.error(nextValidation.message);
    scrollToChecklistValidationTarget();
  }, [checklistCategories, scrollToChecklistValidationTarget]);

  const validateChecklist = () => {
    if (!allChecklistItems.length) {
      showChecklistValidation({
        reason: 'missingChecklist',
        message: t('inspection.execution.noChecklist'),
      });
      return false;
    }

    const missing = allChecklistItems.find(({ category, categoryIndex, item, itemIndex }) => {
      if (getChecklistCategoryKind(category) === 'content') {
        if (isStandaloneContentChecklistItem(category, itemIndex)) {
          return !normalizeChecklistResult(item.result);
        }
        return !normalizeChecklistResult(getContentGroupActiveResult(category, categoryIndex));
      }
      return !normalizeChecklistResult(item.result);
    });
    if (missing) {
      const isMissingContentGroup = getChecklistCategoryKind(missing.category) === 'content' &&
        !isStandaloneContentChecklistItem(missing.category, missing.itemIndex);
      showChecklistValidation({
        reason: 'missingResult',
        message: t('inspection.execution.messages.checklistRequired'),
        categoryIndex: missing.categoryIndex,
        itemIndex: isMissingContentGroup ? undefined : missing.itemIndex,
        categoryKey: getChecklistCategoryKey(missing.category, missing.categoryIndex),
        itemKey: isMissingContentGroup
          ? undefined
          : getChecklistItemKey(missing.item, missing.categoryIndex, missing.itemIndex),
      });
      return false;
    }

    const invalidContentGroup = checklistCategories
      .map((category: any, categoryIndex: number) => ({ category, categoryIndex }))
      .find(({ category, categoryIndex }) => {
        if (getChecklistCategoryKind(category) !== 'content') return false;
        const groupItems = getContentGeneralChecklistEntries(category).map(({ item }) => item);
        return getContentGroupActiveResult(category, categoryIndex) === 'VIOLATION' &&
          !hasContentViolationSelection(groupItems);
      });

    if (invalidContentGroup) {
      showChecklistValidation({
        reason: 'contentViolationSelection',
        message: t('inspection.execution.messages.violationEvidenceRequired'),
        categoryIndex: invalidContentGroup.categoryIndex,
        categoryKey: getChecklistCategoryKey(invalidContentGroup.category, invalidContentGroup.categoryIndex),
      });
      return false;
    }

    const invalidViolation = allChecklistItems.find(({ item }) => {
      if (normalizeChecklistResult(item.result) !== 'VIOLATION') return false;
      return getChecklistItemSelectedViolationKeys(item).length === 0 ||
        !String(item.remarks || '').trim() ||
        ensureArray(item.evidenceAttachments).length === 0;
    });

    if (invalidViolation) {
      showChecklistValidation({
        reason: 'violationEvidence',
        message: t('inspection.execution.messages.violationEvidenceRequired'),
        categoryIndex: invalidViolation.categoryIndex,
        itemIndex: invalidViolation.itemIndex,
        categoryKey: getChecklistCategoryKey(invalidViolation.category, invalidViolation.categoryIndex),
        itemKey: getChecklistItemKey(invalidViolation.item, invalidViolation.categoryIndex, invalidViolation.itemIndex),
      });
      return false;
    }

    setChecklistValidation(null);
    return true;
  };

  const validateSeizedMaterials = () => {
    if (!shouldShowSeizedMaterials) {
      setSeizedMaterialValidationErrors({});
      return true;
    }

    if (!seizedMaterials.length) {
      setSeizedMaterialValidationErrors({});
      CustomMessage.error(t('inspection.execution.messages.seizedMaterialRequired'));
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.inspection-start-visit__seized-add-card')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return false;
    }

    const fieldRequiredMessage = t('common.required');
    const nextErrors: SeizedMaterialValidationErrors = {};

    seizedMaterials.forEach((item, index) => {
      const cardKey = getSeizedMaterialCardKey(item, index);
      const itemErrors: Partial<Record<SeizedMaterialFieldKey, string>> = {};
      const materialTypeValue = getMaterialTypeCodeByValue(
        item.materialTypeCode || item.materialType || item.publicationType,
        { preserveUnknown: false },
      );

      if (!getNormalizedText(materialTypeValue)) {
        itemErrors.materialType = fieldRequiredMessage;
      }

      if (!getPositiveIntegerNumber(item.quantity)) {
        itemErrors.quantity = fieldRequiredMessage;
      }

      if (isBookMaterialTypeValue(materialTypeValue)) {
        if (!getNormalizedText(item.isbn)) itemErrors.isbn = fieldRequiredMessage;
        if (!getNormalizedText(item.title)) itemErrors.title = fieldRequiredMessage;
        if (!getNormalizedText(item.author)) itemErrors.author = fieldRequiredMessage;
        if (!getLanguageOption(item.languageId)) itemErrors.languageId = fieldRequiredMessage;
      } else if (getNormalizedText(materialTypeValue) && !getNormalizedText(item.title)) {
        itemErrors.title = fieldRequiredMessage;
      }

      if (Object.keys(itemErrors).length) {
        nextErrors[cardKey] = itemErrors;
      }
    });

    if (Object.keys(nextErrors).length) {
      setSeizedMaterialValidationErrors(nextErrors);
      setSeizedMaterialCardOpen((prev) => Object.keys(nextErrors).reduce(
        (next, cardKey) => ({ ...next, [cardKey]: true }),
        prev,
      ));
      CustomMessage.error(t('inspection.execution.messages.seizedMaterialRequired'));
      window.requestAnimationFrame(() => {
        const firstInvalidField = document.querySelector<HTMLElement>('.inspection-start-visit__seized-field--error');
        firstInvalidField?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return false;
    }

    setSeizedMaterialValidationErrors({});
    return true;
  };

  const scrollToContactConfirmation = useCallback(() => {
    setReviewSectionOpen((prev) => (
      prev.contactPerson ? prev : { ...prev, contactPerson: true }
    ));

    window.requestAnimationFrame(() => {
      const contactSection = contactPersonConfirmationRef.current;

      if (!contactSection) return;

      scrollTargetInPageContainer(contactSection, 8);
    });
  }, [scrollTargetInPageContainer]);
  const validateContact = async () => {
    setContactSignatureValidationError('');
    const values = contactForm.getFieldsValue(true);
    if (
      values.declarationStatus === 'signed' &&
      !getNormalizedText(values.signatureImageFileUrl)
    ) {
      const signatureRequiredMessage = t('inspection.execution.messages.signatureRequired');
      setContactSignatureValidationError(signatureRequiredMessage);
      CustomMessage.error(signatureRequiredMessage);
      scrollToContactConfirmation();
      return false;
    }
    return contactForm.validateFields()
      .then(() => true)
      .catch(() => {
        scrollToContactConfirmation();
        return false;
      });
  };

  const saveChecklistToServer = useCallback(async () => {
    if (!taskRequest.taskId) return;
    await saveInspectionChecklist({
      ...taskRequest,
      items: buildChecklistSaveItems(),
    } as any);
  }, [buildChecklistSaveItems, taskRequest]);

  const saveSeizedMaterialsToServer = useCallback(async () => {
    if (!taskRequest.taskId || isDigitalInspection) return;
    await saveInspectionSeizedMaterials({
      ...taskRequest,
      items: buildSeizedMaterialSaveItems(),
    } as any);
  }, [buildSeizedMaterialSaveItems, isDigitalInspection, taskRequest]);

  const saveContactPersonToServer = useCallback(async () => {
    if (!taskRequest.taskId || isDigitalInspection) return;
    const values = await ensureSignatureImageUploaded();
    const eidFile = ensureArray<any>(values.eidAttachment)[0];
    const declarationDocumentFileUrl = values.declarationStatus === 'signed'
      ? getDeclarationDocumentUrl(values, contactValues) || null
      : null;
    const declarationDocumentFileName = values.declarationStatus === 'signed'
      ? getDeclarationDocumentFileName(values, contactValues) || null
      : null;
    const mobileFields = buildContactNumberFields({
      value: readContactFormValue(values.mobilePhone, contactMobileFieldNames),
      initial: contactMobileSnapshotRef.current,
      keys: {
        fullNumber: 'mobile',
        countryCode: 'mobileCountryCode',
        localNumber: 'mobileLocalNumber',
      },
    });
    const contactPersonPayload: Parameters<typeof saveInspectionContactPerson>[0] = {
      ...taskRequest,
      fullName: values.name,
      position: values.position,
      mobile: mobileFields.mobile,
      mobileCountryCode: mobileFields.mobileCountryCode,
      mobileLocalNumber: mobileFields.mobileLocalNumber,
      email: values.emailAddress,
      emiratesId: normalizeContactPersonIdNumber(values.emiratesId),
      collectedChannelCode: values.collectedChannelCode,
      eidAttachmentFileName: eidFile?.fileName,
      eidAttachmentFileUrl: eidFile?.fileUrl,
    };
    if (typeof values.personId === 'number') {
      contactPersonPayload.personId = values.personId;
    }
    if (values.sourceType === 1 || values.sourceType === 2) {
      contactPersonPayload.sourceType = values.sourceType;
    }
    await saveInspectionContactPerson(contactPersonPayload);
    const hasCompletedSignedDeclaration =
      values.declarationStatus === 'signed' && Boolean(values.signatureImageFileUrl);
    const hasCompletedDeclinedDeclaration =
      values.declarationStatus === 'not_signed' && Boolean(getNormalizedText(values.refusalReason));
    if (hasCompletedSignedDeclaration || hasCompletedDeclinedDeclaration) {
      await saveInspectionContactPersonDeclaration({
        ...taskRequest,
        declarationAcknowledged: true,
        hasSignedDeclaration: hasCompletedSignedDeclaration,
        declarationDeclinedReason: hasCompletedDeclinedDeclaration ? values.refusalReason : null,
        signatureImageFileName: hasCompletedSignedDeclaration
          ? values.signatureImageFileName || getSignatureFileName(taskRequest.taskNo, taskRequest.taskId)
          : null,
        signatureImageFileUrl: hasCompletedSignedDeclaration ? values.signatureImageFileUrl : null,
        declarationDocumentFileName,
        declarationDocumentFileUrl,
      } as any);
    }
  }, [contactValues, ensureSignatureImageUploaded, isDigitalInspection, taskRequest]);

  const handlePreVisitCancel = useCallback(() => {
    history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
      taskId: taskDetail?.taskId || taskId,
      taskNo: taskDetail?.taskNo || taskNo,
      visitId: null,
      step: null,
      mode: null,
      reportNo: null,
    }));
  }, [history, location.search, taskDetail, taskId, taskNo]);

  const navigateToTasks = useCallback(() => {
    history.push(INSPECTION_PATHS.tasks, {
      [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
    });
  }, [history]);

  const showInspectionSubmitToast = useCallback((kind: InspectionSubmitToastKind, violation?: InspectionCreatedViolationSummary | null) => {
    const showDetails = kind !== 'inspectionCompleted' && hasInspectionSubmitToastNavigationTarget(violation);
    const handleDetailsClick = () => {
      history.push(buildInspectionPath(
        INSPECTION_PATHS.violations,
        location.search,
        buildInspectionSubmitToastNavigationPatch(),
      ));
    };

    message.open({
      type: 'success',
      className: 'inspection-start-visit__submit-toast',
      icon: <img className="inspection-start-visit__submit-toast-icon" src={toastSuccessIcon} alt="" />,
      content: (
        <span className="inspection-start-visit__submit-toast-content">
          <span className="inspection-start-visit__submit-toast-text">
            {t(inspectionSubmitToastMessageKeys[kind])}
          </span>
          {showDetails ? (
            <button
              type="button"
              className="inspection-start-visit__submit-toast-details"
              onClick={handleDetailsClick}
            >
              <span>{t('inspection.common.details')}</span>
              <span className="inspection-start-visit__submit-toast-details-arrow" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ),
    });
  }, [history, location.search, t]);

  const handleStartVisit = async () => {
    if (!taskRequest.taskId) return;
    setSubmitting(true);
    try {
      const startPayload = unwrapPayload<Record<string, any>>(await startInspectionVisit({
        ...taskRequest,
        reviewTaskDetailConfirmed: true,
        reviewInspectionTargetDetailsConfirmed: true,
        ensureToolsReadyConfirmed: true,
      } as any));
      const refreshedDetail = await refreshTaskDetail().catch(() => null);
      if (!refreshedDetail) {
        setTaskDetail((current) => mergeTaskExecutionState(current, {
          ...startPayload,
          currentStepId: startPayload?.currentStepId ?? INSPECTION_EXECUTION_STEP_IDS.PreVisitChecklist,
          currentStepCode: startPayload?.currentStepCode ?? 'PreVisitChecklist',
          currentStep: startPayload?.currentStep ?? startPayload?.currentStepCode ?? 'PreVisitChecklist',
          preVisitChecklist: {
            reviewTaskDetailConfirmed: true,
            reviewInspectionTargetDetailsConfirmed: true,
            ensureToolsReadyConfirmed: true,
          },
        }));
      }
      setPreVisitVisible(false);
      goToStep('targetAccess');
    } catch {
      CustomMessage.error(t('inspection.execution.messages.startVisitFailed'));
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const prepareSubmitReport = async (summaryPatch: Record<string, any> = {}, toastKind?: InspectionSubmitToastKind) => {
    if (!taskRequest.taskId) return;
    setSubmitting(true);
    try {
      const reportTaskRequest: Pick<SubmitInspectionTaskReportPayload, 'taskId' | 'taskNo'> = {
        taskId: taskRequest.taskId,
        taskNo: taskRequest.taskNo,
      };
      const hasSummaryPatch = Object.keys(summaryPatch).length > 0;
      const baseSummary = pendingSubmitSummary || (hasSummaryPatch ? {} : await getExecutionSummary(true));
      const reportSubmittedAt = toApi(nowGst());
      const reportSummary: Record<string, any> = {
        ...baseSummary,
        ...summaryPatch,
        submittedAt: reportSubmittedAt,
        result: accessResult === 'unable_to_access' ? 'ACCESS_FAILED' : 'COMPLETED',
      };
      const needsReinspection = Boolean(reportSummary.needsReinspection);
      const reinspectionDueDate = reportSummary.reinspectionDueDate || reportSummary.reinspectionDate || null;
      if (needsReinspection || reportSummary.reinspectionNote || reportSummary.reviewNote) {
        await saveInspectionReinspection({
          ...taskRequest,
          needsReinspection,
          reinspectionDueDate,
          reinspectionNote: reportSummary.reinspectionNote || reportSummary.reviewNote || null,
        } as any);
      }
      pendingReportSubmissionRef.current = {
        taskKey: taskSubmissionKey,
        toastKind,
        payload: {
          ...reportTaskRequest,
          hasViolationFound: selectedViolations.length > 0,
          needsReinspection,
          reinspectionDueDate,
          reinspectionNote: reportSummary.reinspectionNote || reportSummary.reviewNote || null,
          reviewNote: reportSummary.reviewNote,
          reportSubmittedAt,
          checklistCategories,
          result: reportSummary.result,
          reportSummary: {
            ...reportSummary,
            reinspectionDate: reportSummary.reinspectionDueDate || reportSummary.reinspectionDate || null,
          },
        },
      };
      if (reinspectionVisible) {
        submitSuccessPendingAfterReportCloseRef.current = true;
        setReinspectionVisible(false);
      } else {
        setSubmitSuccessVisible(true);
      }
      setPendingSubmitSummary(null);
      pendingSubmitToastRef.current = toastKind ? { kind: toastKind } : null;
    } catch {
      CustomMessage.error(t('inspection.execution.messages.submitFailed'));
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const buildFinalSubmitReportPayload = (
    pendingSubmission: PendingInspectionReportSubmission,
    checkoutAt: string,
    visitLocation: InspectionVisitLocation,
  ): SubmitInspectionTaskReportPayload => {
    const reportSubmittedAt = toApi(nowGst());
    const pendingReportSummary = pendingSubmission.payload.reportSummary || {};
    return {
      ...pendingSubmission.payload,
      reportSubmittedAt,
      reportSummary: {
        ...pendingReportSummary,
        submittedAt: reportSubmittedAt,
        checkOutAt: checkoutAt,
        checkOutLat: isDigitalInspection ? null : visitLocation.lat,
        checkOutLng: isDigitalInspection ? null : visitLocation.lng,
        checkOutAddress: isDigitalInspection ? null : visitLocation.address,
      },
    };
  };

  const submitPreparedReport = async (
    checkoutAt: string,
    visitLocation: InspectionVisitLocation,
  ) => {
    const pendingSubmission = pendingReportSubmissionRef.current;
    if (!pendingSubmission || pendingSubmission.taskKey !== taskSubmissionKey) {
      throw new Error('Missing pending inspection report submission');
    }

    const submitResult = unwrapPayload<SubmitInspectionReportData>(await submitInspectionTaskReport(
      buildFinalSubmitReportPayload(pendingSubmission, checkoutAt, visitLocation),
    ));
    const createdViolation = Array.isArray(submitResult?.createdViolations)
      ? submitResult.createdViolations[0] || null
      : null;
    const pendingToast = pendingSubmission.toastKind
      ? { kind: pendingSubmission.toastKind, violation: createdViolation }
      : pendingSubmitToastRef.current;

    pendingReportSubmissionRef.current = null;
    pendingSubmitToastRef.current = null;
    localStorage.removeItem(autosaveKey);
    setSubmitSuccessVisible(false);

    return pendingToast;
  };

  const completeAccessFailed = async (values = accessFailedModalValue) => {
    if (!taskRequest.taskId) return false;
    const submittedAt = toApi(nowGst());
    setSubmitting(true);
    try {
      const accessFailedPayload = unwrapPayload<Record<string, any>>(await submitAccessFailedInspectionTask({
        ...taskRequest,
        accessOutcomeCode: 'UnableToAccess',
        accessFailedReasonCode: values.reason,
        accessFailedRemark: values.remark,
        attachments: values.attachments.map((file, index) => normalizeAttachment(file, `access-failed-${index + 1}`)),
      } as any));
      const refreshedDetail = await refreshTaskDetail().catch(() => null);
      if (!refreshedDetail) {
        setTaskDetail((current) => mergeTaskExecutionState(current, {
          ...accessFailedPayload,
          currentStepId: accessFailedPayload?.currentStepId ?? INSPECTION_EXECUTION_STEP_IDS.AccessFailed,
          currentStepCode: accessFailedPayload?.currentStepCode ?? 'AccessFailed',
          currentStep: accessFailedPayload?.currentStep ?? accessFailedPayload?.currentStepCode ?? 'AccessFailed',
          accessOutcomeCode: accessFailedPayload?.accessOutcomeCode ?? 'UnableToAccess',
          accessFailedReasonCode: accessFailedPayload?.accessFailedReasonCode ?? values.reason,
          accessFailedRemark: accessFailedPayload?.accessFailedRemark ?? values.remark,
        }));
      }
      setCheckOutAt(submittedAt);
      localStorage.removeItem(autosaveKey);
      CustomMessage.success(t('inspection.execution.messages.accessFailedSaved'));
      navigateWithoutLeaveConfirm(() => {
        history.push(buildInspectionPath(INSPECTION_PATHS.tasks, '', {
          tab: 'completed',
        }), {
          [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
          [INSPECTION_ROUTE_STATE_KEYS.resetTaskFilters]: true,
        });
      });
      return true;
    } catch {
      CustomMessage.error(t('inspection.execution.messages.submitFailed'));
      return false;
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (isInspectionAttachmentUploading) {
      CustomMessage.error(t('inspection.execution.messages.uploadInProgress'));
      return;
    }
    if (accessResult === 'unable_to_access') {
      if (!validateAccess()) return;
      await completeAccessFailed();
      return;
    }

    if (!validateChecklist()) return;
    if (!validateSeizedMaterials()) return;
    if (shouldRequireContactPerson) {
      if (!(await validateContact())) return;
      await saveContactPersonToServer();
    }

    const summary = await getExecutionSummary(false);
    if (!selectedViolations.length) {
      await prepareSubmitReport({ ...summary, needsReinspection: false, reinspectionDueDate: null }, 'inspectionCompleted');
      return;
    }

    const autoDate = toApi(nowGst().add(30, 'days').endOf('day'));
    const autoReinspection = selectedViolations.some((violation) => autoReinspectionViolationCodes.has(getViolationCode(violation)));
    if (autoReinspection) {
      await prepareSubmitReport({ ...summary, needsReinspection: true, reinspectionDueDate: autoDate, reinspectionDate: autoDate, reinspectionMode: 'auto' }, 'reinspectionCreated');
      return;
    }

    setPendingSubmitSummary(summary);
    setSubmitReportNeedsReinspection(true);
    submitReportForm.setFieldsValue({
      needsReinspection: true,
      reinspectionDueDate: moment().add(30, 'days'),
      reviewNote: '',
    });
    setReinspectionVisible(true);
  };

  const handleConfirmSubmitReport = async () => {
    const values = await submitReportForm.validateFields();
    const dueDate = values.needsReinspection ? values.reinspectionDueDate?.endOf('day')?.toISOString?.() : null;
    await prepareSubmitReport({
      ...(pendingSubmitSummary || {}),
      needsReinspection: values.needsReinspection,
      reinspectionDueDate: dueDate,
      reinspectionDate: dueDate,
      reviewNote: values.reviewNote,
      reinspectionMode: 'manual',
    }, values.needsReinspection ? 'reinspectionCreated' : 'violationSubmitted');
  };

  const handleSubmitReportAfterClose = useCallback(() => {
    if (!submitSuccessPendingAfterReportCloseRef.current) return;
    submitSuccessPendingAfterReportCloseRef.current = false;
    setSubmitSuccessVisible(true);
  }, []);

  const handleCheckoutClose = async () => {
    if (!taskRequest.taskId) return;
    const checkoutAt = toApi(nowGst());
    let checkoutCompleted = false;
    setSubmitting(true);
    try {
      const visitLocation = isDigitalInspection
        ? emptyInspectionVisitLocation()
        : await resolveInspectionVisitLocation();
      await checkoutInspectionTask({
        ...taskRequest,
        checkOutAt: checkoutAt,
        checkOutLat: isDigitalInspection ? null : visitLocation.lat,
        checkOutLng: isDigitalInspection ? null : visitLocation.lng,
        checkOutAddress: isDigitalInspection ? null : visitLocation.address,
      } as any);
      checkoutCompleted = true;
      setCheckOutAt(checkoutAt);
      const pendingToast = await submitPreparedReport(checkoutAt, visitLocation);
      navigateWithoutLeaveConfirm(() => {
        history.push(buildInspectionPath(INSPECTION_PATHS.tasks, '', {
          tab: 'completed',
        }), {
          [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
          [INSPECTION_ROUTE_STATE_KEYS.resetTaskFilters]: true,
        });
      });
      window.setTimeout(() => {
        if (pendingToast) {
          showInspectionSubmitToast(pendingToast.kind, pendingToast.violation);
        } else {
          CustomMessage.success(t('inspection.execution.messages.checkoutSaved'));
        }
      }, 0);
    } catch {
      CustomMessage.error(
        checkoutCompleted
          ? t('inspection.execution.messages.submitFailed')
          : t('inspection.execution.messages.checkoutFailed'),
      );
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleSeizedDecision = async (hasMaterials: boolean) => {
    if (seizedDecisionSubmittingRef.current) return;

    const nextStepKey = hasMaterials ? 'seizedMaterials' : 'review';
    const nextMaterials = hasMaterials ? ensureSeizedMaterialRows(seizedMaterials) : [];

    seizedDecisionSubmittingRef.current = true;
    setSeizedDecisionSubmitting(hasMaterials);
    try {
      await saveChecklistToServer();

      if (!hasMaterials && taskRequest.taskId && !isDigitalInspection) {
        await saveInspectionSeizedMaterials({
          ...taskRequest,
          items: [],
          hasSeizedMaterials: false,
        } as any);
      }

      autosaveDraft({
        hasSeizedMaterials: hasMaterials,
        seizedMaterials: nextMaterials,
      }, nextStepKey);

      setHasSeizedMaterials(hasMaterials);
      if (hasMaterials) {
        setSeizedMaterials(nextMaterials);
        setSeizedMaterialCardOpen((prev) => ({
          ...prev,
          [String(nextMaterials[0].id)]: true,
        }));
      } else {
        setSeizedMaterials([]);
      }
      setSeizedDecisionVisible(false);
      goToStep(nextStepKey, {
        hasSeizedMaterials: hasMaterials,
      });
    } catch {
      CustomMessage.error(t('inspection.execution.messages.submitFailed'));
    } finally {
      seizedDecisionSubmittingRef.current = false;
      if (isMountedRef.current) {
        setSeizedDecisionSubmitting(null);
      }
    }
  };

  const handleNext = async (targetAccessResult = accessResult) => {
    if (isInspectionAttachmentUploading) {
      CustomMessage.error(t('inspection.execution.messages.uploadInProgress'));
      return;
    }
    const stepKey = stepKeys[currentStep];
    if (stepKey === 'targetAccess') {
      if (submitting) return;
      const effectiveAccessResult = shouldShowTargetAccessDecisionActions ? targetAccessResult : 'accessed_successfully';
      if (!validateAccess(effectiveAccessResult)) return;
      if (effectiveAccessResult === 'unable_to_access') {
        await completeAccessFailed();
        return;
      }
      let nextCheckInAt = checkInAt;
      if (!hasRecordedCheckIn) {
        nextCheckInAt = toApi(nowGst());
        setSubmitting(true);
        try {
          const visitLocation = isDigitalInspection
            ? emptyInspectionVisitLocation()
            : await resolveInspectionVisitLocation();
          const checkinPayload = unwrapPayload<Record<string, any>>(await checkinInspectionTask({
            ...taskRequest,
            checkInAt: nextCheckInAt,
            checkInLat: isDigitalInspection ? null : visitLocation.lat,
            checkInLng: isDigitalInspection ? null : visitLocation.lng,
            checkInAddress: isDigitalInspection ? null : visitLocation.address,
          } as any));
          const refreshedDetail = await refreshTaskDetail().catch(() => null);
          if (refreshedDetail) {
            setCheckInAt(getTaskCheckInAt(refreshedDetail) || nextCheckInAt);
          } else {
            setTaskDetail((current) => mergeTaskExecutionState(current, {
              ...checkinPayload,
              currentStepId: checkinPayload?.currentStepId ?? INSPECTION_EXECUTION_STEP_IDS.Checkin,
              currentStepCode: checkinPayload?.currentStepCode ?? 'Checkin',
              currentStep: checkinPayload?.currentStep ?? checkinPayload?.currentStepCode ?? 'Checkin',
              checkinAt: checkinPayload?.checkinAt ?? checkinPayload?.checkInAt ?? nextCheckInAt,
            }));
            setCheckInAt(checkinPayload?.checkinAt ?? checkinPayload?.checkInAt ?? nextCheckInAt);
          }
          goToStep('checklist');
          return;
        } catch {
          CustomMessage.error(t('inspection.execution.messages.checkInFailed'));
          return;
        } finally {
          if (isMountedRef.current) setSubmitting(false);
        }
      }
      goToStep('checklist');
      return;
    }

    if (stepKey === 'checklist') {
      if (submitting) return;
      if (!validateChecklist()) return;
      if (shouldAskSeizedMaterials && hasSeizedMaterials === null) {
        setSeizedDecisionVisible(true);
        return;
      }
      setSubmitting(true);
      try {
        await saveChecklistToServer();
        if (shouldAskSeizedMaterials) {
          const nextStepKey = hasSeizedMaterials ? 'seizedMaterials' : 'review';
          const nextMaterials = hasSeizedMaterials ? ensureSeizedMaterialRows(seizedMaterials) : [];
          if (hasSeizedMaterials) {
            setSeizedMaterials(nextMaterials);
            setSeizedMaterialCardOpen((prev) => ({
              ...prev,
              [String(nextMaterials[0].id)]: true,
            }));
          }
          autosaveDraft({ seizedMaterials: nextMaterials }, nextStepKey);
          goToStep(nextStepKey);
          return;
        }
        autosaveDraft({}, 'review');
        goToStep('review');
      } catch {
        CustomMessage.error(t('inspection.execution.messages.submitFailed'));
      } finally {
        if (isMountedRef.current) setSubmitting(false);
      }
      return;
    }
    if (stepKey === 'seizedMaterials') {
      if (!validateSeizedMaterials()) return;
      await saveSeizedMaterialsToServer();
      goToStep('review');
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, stepKeys.length - 1));
  };

  const handleAccessFailedModalChange = useCallback((nextValue: UnableToAccessModalValue) => {
    setAccessReason(nextValue.reason);
    setAccessRemark(nextValue.remark);
    setAccessAttachments(nextValue.attachments);
  }, []);

  const closeAccessFailedModal = useCallback(() => {
    if (submitting) return;
    setAccessFailedModalVisible(false);
  }, [submitting]);

  const handleAccessFailedModalSubmit = async (nextValue: UnableToAccessModalValue) => {
    handleAccessFailedModalChange(nextValue);
    setAccessResult('unable_to_access');
    if (!validateAccess('unable_to_access', nextValue)) return;
    const completed = await completeAccessFailed(nextValue);
    if (completed && isMountedRef.current) {
      setAccessFailedModalVisible(false);
    }
  };

  const handleAccessFailedAction = () => {
    setAccessFailedModalVisible(true);
  };

  const handleAccessSuccessConfirm = async () => {
    setAccessResult('accessed_successfully');
    await handleNext('accessed_successfully');
  };

  const handleAccessSuccessAction = () => {
    showAccessedSuccessfullyConfirm({
      title: t('inspection.execution.accessedSuccessfully'),
      content: (
        <>
          <p className="inspection-start-visit__accessed-success-confirm-subtitle">
            {t('inspection.execution.checkInInstruction')}
          </p>
          <div className="inspection-start-visit__accessed-success-confirm-callout">
            <span className="inspection-start-visit__accessed-success-confirm-callout-title">
              {t('inspection.execution.checkoutDataTitle')}
            </span>
            <div className="inspection-start-visit__accessed-success-confirm-list">
              <span className="inspection-start-visit__accessed-success-confirm-item">
                {t('inspection.execution.checkInTime')}
              </span>
              {isDigitalInspection ? null : (
                <span className="inspection-start-visit__accessed-success-confirm-item">
                  {t('inspection.execution.checkInLocation')}
                </span>
              )}
            </div>
          </div>
        </>
      ),
      okText: t('inspection.execution.checkInAndStartInspection'),
      cancelText: t('inspection.common.cancel'),
      onOk: handleAccessSuccessConfirm,
      iconSrc: accessedSuccessfullyStatusIcon,
      okButtonIcon: (
        <img
          alt=""
          className="inspection-start-visit__accessed-success-confirm-action-icon"
          src={visitLocationActionIcon}
        />
      ),
    });
  };

  const runOcrScan = async (
    publicationType: InspectionOcrScanSubType,
    imageFile: string,
    source: OcrActionSource,
    flow: OcrFlow,
  ) => {
    setOcrType(publicationType);
    setOcrFlow(flow);
    setOcrScanningSource(source);

    try {
      const result = unwrapPayload<InspectionOcrResult>(
        await scanInspectionOcr({
          taskId,
          taskNo,
          scanType: flow === 'seizedMaterials' ? 2 : 1,
          flow,
          publicationType,
          imageFile,
        }),
      );
      const resultWithPreview = flow === 'seizedMaterials' && !result.imageUrl && !result.coverImageUrl
        ? { ...result, imageUrl: imageFile }
        : result;
      setOcrType(resultWithPreview.publicationType || publicationType);
      setOcrResult(resultWithPreview);
      setOcrTypeVisible(false);
      setOcrResultVisible(true);
    } catch {
      CustomMessage.error(t('inspection.execution.messages.ocrScanFailed'));
    } finally {
      setOcrScanningSource(null);
    }
  };

  const handleOcrTypeSelect = ({ publicationType, source }: OcrTypeModalSelection) => {
    const nextSelection: PendingOcrSelection = {
      publicationType: publicationType as InspectionOcrScanSubType,
      source,
      flow: ocrFlow,
    };
    const input = source === 'camera' ? ocrCameraInputRef.current : ocrUploadInputRef.current;

    pendingOcrSelectionRef.current = nextSelection;

    if (!input) {
      pendingOcrSelectionRef.current = null;
      CustomMessage.error(t('inspection.execution.messages.ocrScanFailed'));
      return;
    }

    input.value = '';
    input.click();
  };

  const handleOcrFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    source: OcrActionSource,
  ) => {
    const selection = pendingOcrSelectionRef.current;
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      if (selection?.source === source) {
        pendingOcrSelectionRef.current = null;
      }
      return;
    }

    const activeSelection = selection?.source === source ? selection : null;
    pendingOcrSelectionRef.current = null;

    if (!activeSelection) {
      CustomMessage.error(t('inspection.execution.messages.ocrScanFailed'));
      return;
    }

    try {
      const imageFile = await fileToDataUrl(file);
      await runOcrScan(activeSelection.publicationType, imageFile, source, activeSelection.flow);
    } catch {
      setOcrScanningSource(null);
      CustomMessage.error(t('inspection.execution.messages.ocrScanFailed'));
    }
  };

  const closeOcrResult = () => {
    setOcrResultVisible(false);
    setOcrResult(null);
  };

  const handleOcrEditSave = async (values: InspectionOcrEditPayload) => {
    const scanId = ocrResult?.scanId || ocrResult?.ocrId;

    if (!ocrResult) return false;

    if (!scanId) {
      setOcrResult({ ...ocrResult, ...values });
      return true;
    }

    if (ocrEditSaving) return false;

    setOcrEditSaving(true);

    try {
      const updated = unwrapPayload<InspectionOcrResult>(
        await updateInspectionOcrScan(scanId, values, {
          scanType: ocrFlow === 'seizedMaterials' ? 2 : 1,
          publicationType: ocrResult.publicationType,
        }),
      );

      if (!isMountedRef.current) return false;

      setOcrResult((prev) => (prev
        ? {
          ...prev,
          ...updated,
          imageUrl: updated.imageUrl || prev.imageUrl,
          coverImageUrl: updated.coverImageUrl || prev.coverImageUrl,
        }
        : updated));
      return true;
    } catch {
      CustomMessage.error(t('inspection.execution.messages.submitFailed'));
      return false;
    } finally {
      if (isMountedRef.current) setOcrEditSaving(false);
    }
  };

  const openOcrTypeModal = (flow: OcrFlow) => {
    pendingOcrSelectionRef.current = null;
    setOcrFlow(flow);
    setOcrType('BOOK');
    setOcrTypeVisible(true);
  };

  const handleScanAnotherOcr = () => {
    pendingOcrSelectionRef.current = null;
    setOcrResultVisible(false);
    setOcrResult(null);
    setOcrType('BOOK');
    setOcrTypeVisible(true);
  };

  const handleSeizedMaterialOcrSave = (
    value: {
      materialType: string;
      materialName: string;
      isbn?: string;
      author?: string;
      languageId?: string;
    },
    action: 'save' | 'saveAndContinue',
  ) => {
    const nextId = `ocr-seized-material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const materialTypeCode = getMaterialTypeCodeByValue(value.materialType, { preserveUnknown: false });
    const nextMaterial = {
      id: nextId,
      materialType: materialTypeCode,
      materialTypeCode,
      materialTypeName: getMaterialTypeLabelByValue(value.materialType, { preserveUnknown: false }),
      publicationType: materialTypeCode,
      isbn: getNormalizedText(value.isbn),
      author: getNormalizedText(value.author),
      languageId: getNormalizedText(value.languageId),
      title: value.materialName,
      materialName: value.materialName,
      quantity: 1,
      numberOfCopy: 1,
    };

    setHasSeizedMaterials(true);
    setSeizedMaterials((prev) => [...prev, nextMaterial]);
    setSeizedMaterialCardOpen((prev) => ({ ...prev, [nextId]: true }));
    setOcrResultVisible(false);
    setOcrResult(null);

    if (action === 'saveAndContinue') {
      pendingOcrSelectionRef.current = null;
      setOcrType('BOOK');
      setOcrFlow('seizedMaterials');
      setOcrTypeVisible(true);
    }
  };

  const defaultOcrMaterialTypeValue = useMemo(() => {
    if (ocrFlow !== 'seizedMaterials') return '';
    // Backend returns publicationTypeId 0 to mark a manual fill; skip lookup matching then.
    if (ocrResult?.publicationTypeId === 0) return '';
    return getMaterialTypeCodeByValue(ocrResult?.publicationType || ocrType, { preserveUnknown: false });
  }, [getMaterialTypeCodeByValue, ocrFlow, ocrResult?.publicationType, ocrResult?.publicationTypeId, ocrType]);

  const defaultOcrLanguageValue = useMemo(
    () => getLanguageLookupIdByValue(ocrResult?.language),
    [getLanguageLookupIdByValue, ocrResult?.language],
  );

  const fullViolationCatalogCategories = useMemo(
    () => normalizeChecklistCatalogItems(fullViolationCatalogItems),
    [fullViolationCatalogItems],
  );

  const allViolationOptions = useMemo(() => {
    const map = new Map<string, any>();
    fullViolationCatalogCategories.forEach((category: any) => {
      ensureArray(category.checkItems).forEach((item: any, itemIndex: number) => {
        const violationDescription = getChecklistItemViolationDescription(item);
        if (!violationDescription) return;
        const optionSource = {
          key: getViolationOptionKey(item),
          checklistCode: item.checklistCode,
          checklistName: getChecklistItemText(item),
          checklistNameAr: getChecklistItemTextAr(item),
          violationDescription,
          violationDescriptionEn: item.violationDescriptionEn,
          violationDescriptionAr: item.violationDescriptionAr,
          violationItemId: item.violationItemId,
          legacyViolationItemId: item.legacyViolationItemId,
          violationItemCode: item.violationItemCode,
          violationTypeId: item.violationTypeId,
          violationTypeCode: item.violationTypeCode,
          isContentStandalone: getChecklistCategoryKind(category) === 'content' &&
            isStandaloneContentChecklistItem(category, itemIndex),
          checklistItemId: item.itemId,
        };
        if (!optionSource.key) return;
        map.set(optionSource.key, {
          ...optionSource,
        });
      });
    });
    return Array.from(map.values());
  }, [fullViolationCatalogCategories]);

  const fullViolationExistingKeySet = useMemo(() => {
    const keySet = new Set<string>();
    allChecklistItems.forEach(({ item }) => {
      getChecklistItemViolationOptionKeys(item).forEach((key) => {
        if (key) keySet.add(key);
      });
    });
    return keySet;
  }, [allChecklistItems]);

  const fullViolationSelectedKeys = useMemo(() => {
    const otherDetectedCategory = checklistCategories.find((category) => category.categoryId === 'OTHER_DETECTED');
    return uniqueTruthy(
      ensureArray<any>(otherDetectedCategory?.checkItems)
        .flatMap((item) => getChecklistItemViolationOptionKeys(item))
        .map(normalizeChecklistCode),
    );
  }, [checklistCategories]);

  const fullViolationDisabledCodes = useMemo(() => {
    const selectedKeySet = new Set(fullViolationSelectedKeys);
    return allViolationOptions
      .map((violation) => violation.key)
      .filter((key) => fullViolationExistingKeySet.has(key) && !selectedKeySet.has(key));
  }, [allViolationOptions, fullViolationExistingKeySet, fullViolationSelectedKeys]);

  const fullViolationSaveDisabled = useMemo(() => {
    if (draftViolationKeys.length !== fullViolationSelectedKeys.length) return false;
    const selectedKeySet = new Set(fullViolationSelectedKeys);
    return draftViolationKeys.every((key) => selectedKeySet.has(key));
  }, [draftViolationKeys, fullViolationSelectedKeys]);

  const fullViolationGroups = useMemo(() => {
    const groups = {
      licensing: [] as any[],
      contentGeneral: [] as any[],
      contentStandalone: [] as any[],
    };
    allViolationOptions.forEach((violation) => {
      if (getViolationGroupKey(violation) !== 'content') {
        groups.licensing.push(violation);
        return;
      }
      if (violation.isContentStandalone) {
        groups.contentStandalone.push(violation);
        return;
      }
      groups.contentGeneral.push(violation);
    });
    return groups;
  }, [allViolationOptions]);

  const loadFullViolationCatalogItems = useCallback(async () => {
    setFullViolationCatalogLoading(true);
    try {
      const response = await getInspectionChecklistTemplateItems({ includeInactive: false });
      const catalogItems = unwrapPayload<InspectionChecklistTemplateCatalogItem[]>(response);
      if (isMountedRef.current) {
        setFullViolationCatalogItems(ensureArray(catalogItems));
      }
    } catch {
      if (isMountedRef.current) {
        setFullViolationCatalogItems([]);
        CustomMessage.error(t('inspection.execution.messages.loadFailed'));
      }
    } finally {
      if (isMountedRef.current) {
        setFullViolationCatalogLoading(false);
      }
    }
  }, [t]);

  const openFullViolationList = () => {
    setDraftViolationKeys(fullViolationSelectedKeys);
    setFullChecklistVisible(true);
    void loadFullViolationCatalogItems();
  };

  const closeFullViolationList = () => {
    setDraftViolationKeys([]);
    setFullChecklistVisible(false);
  };

  const buildFullViolationInjectedItem = (violation: any, itemIdPrefix: string) => {
    const checklistName = getChecklistItemText(violation);
    const checklistNameAr = getChecklistItemTextAr(violation);
    const violationDescription = getChecklistItemViolationDescription(violation);
    return {
      itemId: `${itemIdPrefix}-${violation.key}`,
      checklistCode: violation.checklistCode,
      checklistName,
      checklistNameAr,
      violationDescription,
      violationDescriptionEn: violation.violationDescriptionEn,
      violationDescriptionAr: violation.violationDescriptionAr,
      violationItemId: violation.violationItemId,
      legacyViolationItemId: violation.legacyViolationItemId,
      violationItemCode: violation.violationItemCode,
      violationTypeId: violation.violationTypeId,
      violationTypeCode: violation.violationTypeCode,
      itemOrder: 999,
      result: 'VIOLATION',
      remarks: '',
      evidenceAttachments: [],
      relatedViolations: [{
        checklistCode: violation.checklistCode,
        checklistName,
        checklistNameAr,
        violationDescription,
        violationDescriptionEn: violation.violationDescriptionEn,
        violationDescriptionAr: violation.violationDescriptionAr,
        violationItemId: violation.violationItemId,
        legacyViolationItemId: violation.legacyViolationItemId,
        violationItemCode: violation.violationItemCode,
        violationTypeId: violation.violationTypeId,
        violationTypeCode: violation.violationTypeCode,
      }],
      selectedViolationKeys: [violation.key],
    };
  };

  const applyViolationSelection = (keys: string[]) => {
    const disabledKeySet = new Set(fullViolationDisabledCodes);
    const normalizedKeys = uniqueTruthy(keys.map(normalizeChecklistCode))
      .filter((key) => !disabledKeySet.has(key));
    const keySet = new Set(normalizedKeys);
    if (!normalizedKeys.length) return;

    setChecklistValidation(null);
    setChecklistCategories((prev) => {
      const next = prev.map((category) => ({
        ...category,
        checkItems: ensureArray(category.checkItems),
      }));

      const existingKeys = new Set(next.flatMap((category) =>
        ensureArray(category.checkItems).flatMap((item: any) =>
          getChecklistItemViolationOptionKeys(item))));
      const addedViolations = allViolationOptions.filter((violation) => (
        keySet.has(violation.key) &&
        !existingKeys.has(violation.key)
      ));
      if (addedViolations.length) {
        const otherCategory = next.find((category) => category.categoryId === 'OTHER_DETECTED');
        const otherItems = addedViolations.map((violation) => buildFullViolationInjectedItem(violation, 'OTHER'));
        if (otherCategory) {
          otherCategory.checkItems = [...ensureArray(otherCategory.checkItems), ...otherItems];
          return [...next];
        }
        return [...next, { categoryId: 'OTHER_DETECTED', categoryName: t('inspection.execution.otherViolationItems'), checkItems: otherItems }];
      }
      return next;
    });
  };

  const removeFullViolationSelection = useCallback((keys: string[]) => {
    const keySet = new Set(uniqueTruthy(keys.map(normalizeChecklistCode)));
    if (!keySet.size) return;

    setChecklistValidation(null);
    setChecklistCategories((prev) => prev.flatMap((category) => {
      if (category.categoryId !== 'OTHER_DETECTED') {
        return [category];
      }

      const remainingItems = ensureArray<any>(category.checkItems).filter((item) => (
        !getChecklistItemViolationOptionKeys(item).some((key) => keySet.has(normalizeChecklistCode(key)))
      ));

      if (!remainingItems.length) {
        return [];
      }

      return [{
        ...category,
        checkItems: remainingItems,
      }];
    }));
  }, []);

  const handleFullChecklistChange = (keys: string[]) => {
    const disabledKeySet = new Set(fullViolationDisabledCodes);
    const nextKeys = uniqueTruthy(keys.map(normalizeChecklistCode))
      .filter((key) => !disabledKeySet.has(key));
    const removedKeys = draftViolationKeys.filter((key) => !nextKeys.includes(key));

    if (!removedKeys.length) {
      setDraftViolationKeys(nextKeys);
      return;
    }

    showDeselectViolationConfirm({
      title: t('inspection.execution.deselectViolationTitle'),
      content: t('inspection.execution.deselectViolationContent'),
      okText: t('inspection.common.confirm'),
      cancelText: t('inspection.common.cancel'),
      onOk: () => {
        setDraftViolationKeys(nextKeys);
      },
    });
  };

  const saveFullViolationList = () => {
    const nextKeySet = new Set(draftViolationKeys);
    const removedKeys = fullViolationSelectedKeys.filter((key) => !nextKeySet.has(key));
    const addedKeys = draftViolationKeys.filter((key) => !fullViolationSelectedKeys.includes(key));

    if (removedKeys.length) {
      removeFullViolationSelection(removedKeys);
    }
    if (addedKeys.length) {
      applyViolationSelection(addedKeys);
    }
    setDraftViolationKeys([]);
    setFullChecklistVisible(false);
  };

  const getSeizedMaterialCardKey = (material: Record<string, any>, index: number) =>
    String(material.id || material.materialId || `seized-material-${index}`);

  const clearSeizedMaterialFieldErrors = (index: number, fieldKeys: SeizedMaterialFieldKey[]) => {
    if (!fieldKeys.length) return;

    const cardKey = getSeizedMaterialCardKey(seizedMaterials[index] || {}, index);
    setSeizedMaterialValidationErrors((prev) => {
      const currentErrors = prev[cardKey];
      if (!currentErrors) return prev;

      const nextFieldErrors = { ...currentErrors };
      fieldKeys.forEach((fieldKey) => {
        delete nextFieldErrors[fieldKey];
      });

      if (Object.keys(nextFieldErrors).length) {
        return { ...prev, [cardKey]: nextFieldErrors };
      }

      const nextErrors = { ...prev };
      delete nextErrors[cardKey];
      return nextErrors;
    });
  };

  const updateMaterial = (index: number, patch: Record<string, any>) => {
    clearSeizedMaterialFieldErrors(index, getSeizedMaterialPatchFields(patch));
    setSeizedMaterials((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addSeizedMaterial = () => {
    const nextMaterial = createDefaultSeizedMaterial();
    setSeizedMaterials((prev) => [...prev, nextMaterial]);
    setSeizedMaterialCardOpen((prev) => ({ ...prev, [String(nextMaterial.id)]: true }));
  };

  const removeSeizedMaterial = (index: number) => {
    const cardKey = getSeizedMaterialCardKey(seizedMaterials[index] || {}, index);
    setSeizedMaterialValidationErrors((prev) => {
      if (!prev[cardKey]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[cardKey];
      return nextErrors;
    });
    setSeizedMaterials((prev) => prev.filter((_item, itemIndex) => itemIndex !== index));
  };

  const toggleSeizedMaterialCard = (key: string, isOpen: boolean) => {
    setSeizedMaterialCardOpen((prev) => ({ ...prev, [key]: !isOpen }));
  };

  const renderSeizedMaterialLabel = (label: string) => (
    <span className="inspection-start-visit__seized-field-label">
      <span>{label}</span>
      <span className="inspection-start-visit__seized-field-required" aria-hidden="true">*</span>
    </span>
  );

  const renderSeizedMaterialField = (
    label: string,
    children: React.ReactNode,
    wide = false,
    error?: string,
  ) => (
    <label
      className={`inspection-start-visit__seized-field${wide ? ' inspection-start-visit__seized-field--wide' : ''}${error ? ' inspection-start-visit__seized-field--error' : ''}`}
    >
      {renderSeizedMaterialLabel(label)}
      {children}
      {error ? (
        <span className="inspection-start-visit__seized-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );

  const targetOverviewCurrentProfileKey = getTargetOverviewRecordKey(taskDetail?.inspectionTarget);
  const canUseTargetOverviewEnrichment = Boolean(targetOverviewCurrentProfileKey) &&
    targetOverviewProfileKey === targetOverviewCurrentProfileKey;
  const targetOverviewEnrichedEstablishment = canUseTargetOverviewEnrichment
    ? targetOverviewEstablishment
    : null;
  const targetOverviewEnrichedProfileAndApplicant = canUseTargetOverviewEnrichment
    ? targetOverviewProfileAndApplicant
    : null;

  const targetInformation = useMemo(() => {
    const target = taskDetail?.inspectionTarget || {};
    const address = target.address || {};
    const websites = normalizeWebsiteDisplayItems(digitalPresence.websites);
    const socialMedia = normalizeDigitalPresenceSocialMediaItems(digitalPresence.socialMedia, socialMediaLookupOptions);

    return {
      name: getDisplayText(target.establishmentNameEn || target.nameEn || target.fullName, taskSummary.targetName),
      nameAr: getDisplayText(target.establishmentNameAr || target.nameAr, '-'),
      contact: getFirstDisplayValue(target, ['contactName', 'contactPersonName', 'representativeName'], contactValues?.name || '-'),
      contactNumber: getDisplayText(target.mobile, '-'),
      email: getDisplayText(target.email, '-'),
      location: taskSummary.address,
      latitude: getOptionalNumber(address.latitude),
      longitude: getOptionalNumber(address.longitude),
      locationUrl: getDisplayText(address.locationUrl, ''),
      websites,
      socialMedia,
      profileType: getInspectionTargetProfileTypeLabel(target),
      status: getDisplayText(targetOverviewEnrichedProfileAndApplicant?.profileStatusObj?.nameEn, '-'),
      isVip: Boolean(targetOverviewEnrichedProfileAndApplicant?.isVip),
      licenseNumber: getTaskLicenseNumber(taskDetail),
      authority: getDisplayText(address.authorityNameEn, '-'),
      emirate: getTaskEmirateName(taskDetail),
      documents: getTargetOverviewCountDisplayValue(targetOverviewEnrichedEstablishment?.documentsCount),
      partners: getTargetOverviewCountDisplayValue(targetOverviewEnrichedEstablishment?.partnersCount),
      unpaidFines: getTargetOverviewCountDisplayValue(taskDetail?.targetOverview?.unpayCount),
    };
  }, [
    contactValues,
    digitalPresence,
    socialMediaLookupOptions,
    targetOverviewEnrichedEstablishment,
    targetOverviewEnrichedProfileAndApplicant,
    taskDetail,
    taskSummary.address,
    taskSummary.targetName,
  ]);

  const targetOverviewData = useMemo<TargetOverviewData>(() => {
    const target = taskDetail?.inspectionTarget || {};
    const targetOverview = taskDetail?.targetOverview || {};
    const establishment = targetOverviewEnrichedEstablishment;
    const profileAndApplicantData = targetOverviewEnrichedProfileAndApplicant;
    const targetStatus = getDisplayText(profileAndApplicantData?.profileStatusObj?.nameEn, '-');
    const targetOverviewType = resolveInspectionTargetOverviewType(target);

    if (targetOverviewType === 'Individual') {
      const identity = resolveInspectionOverviewIdentity(profileAndApplicantData);
      const identityLabels = {
        'applicationOverviewCards.emiratesId': t('applicationOverviewCards.emiratesId'),
        'applicationOverviewCards.passport': t('applicationOverviewCards.passport'),
        'applicationOverviewCards.uid': t('applicationOverviewCards.uid'),
      };

      return {
        profileType: getInspectionTargetProfileTypeLabel(target),
        selfMonitorProgram: profileAndApplicantData?.selfMonitorProgram,
        statusLabel: targetStatus,
        statusCode: profileAndApplicantData?.profileStatusObj?.id,
        statusTone: getTargetOverviewStatusTone(targetStatus),
        fields: [
          {
            label: t('applicationOverviewCards.fullName'),
            value: getDisplayText(
              profileAndApplicantData?.personalName ||
                profileAndApplicantData?.userName ||
                target.fullName ||
                target.fullNameEn ||
                target.nameEn,
              '-',
            ),
          },
          ...(identity ? [{ label: identityLabels[identity.labelKey], value: identity.value }] : []),
        ],
        statistics: [],
        alerts: [
          {
            key: 'warnings',
            label: t('inspection.taskDetail.warningsViolations'),
            count: getTargetOverviewCountDisplayValue(targetOverview.violationCount),
            tone: 'danger',
          },
          {
            key: 'fines',
            label: t('inspection.taskDetail.unpaidFines'),
            count: getTargetOverviewCountDisplayValue(targetOverview.unpayCount),
            tone: 'warning',
          },
        ],
      };
    }

    const targetName = getLocalizedText(establishment?.nameEn, establishment?.nameAr, '-');
    const targetEmirate = getInspectionTaskEmirateLabel(establishment?.emiratesInfo?.name || undefined, t) || '-';

    return {
      profileType: getTargetOverviewProfileTypeLabel(target.targetType),
      selfMonitorProgram: profileAndApplicantData?.selfMonitorProgram,
      statusLabel: targetStatus,
      statusCode: profileAndApplicantData?.profileStatusObj?.id,
      statusTone: getTargetOverviewStatusTone(targetStatus),
      fields: [
        {
          label: t('inspection.taskDetail.establishmentName'),
          value: targetName,
        },
        {
          label: t('inspection.taskDetail.commercialLicenseNumber'),
          value: getDisplayText(establishment?.licenseNumber, '-'),
        },
        {
          label: t('inspection.tasks.columns.authority'),
          value: getDisplayText(establishment?.authorityIdName, '-'),
        },
        {
          label: t('inspection.tasks.columns.emirate'),
          value: targetEmirate,
        },
      ],
      statistics: [
        {
          key: 'documents',
          icon: 'documents',
          label: t('inspection.taskDetail.documents'),
          count: getTargetOverviewCountDisplayValue(establishment?.documentsCount),
          tone: 'default',
        },
        {
          key: 'partners',
          icon: 'partners',
          label: t('inspection.taskDetail.partners'),
          count: getTargetOverviewCountDisplayValue(establishment?.partnersCount),
          tone: 'default',
        },
      ],
      alerts: [
        {
          key: 'warnings',
          label: t('inspection.taskDetail.warningsViolations'),
          count: getTargetOverviewCountDisplayValue(targetOverview.violationCount),
          tone: 'danger',
        },
        {
          key: 'fines',
          label: t('inspection.taskDetail.unpaidFines'),
          count: getTargetOverviewCountDisplayValue(targetOverview.unpayCount),
          tone: 'warning',
        },
      ],
    };
  }, [
    targetOverviewEnrichedEstablishment,
    targetOverviewEnrichedProfileAndApplicant,
    taskDetail,
    t,
  ]);

  const targetOverviewFullScreenType = useMemo<TargetOverviewFullScreenType>(
    () => resolveInspectionTargetOverviewType(taskDetail?.inspectionTarget),
    [taskDetail],
  );

  const targetOverviewEstablishmentData = useMemo(
    () => (targetOverviewFullScreenType === 'Commercial' ? targetOverviewEnrichedEstablishment || undefined : undefined),
    [targetOverviewEnrichedEstablishment, targetOverviewFullScreenType],
  );

  const targetOverviewApplicantData = useMemo<IUserIndividualProfile | undefined>(() => {
    if (targetOverviewFullScreenType !== 'Individual') return undefined;

    const target = taskDetail?.inspectionTarget || {};
    const profileAndApplicantData = targetOverviewEnrichedProfileAndApplicant;
    const identity = resolveInspectionOverviewIdentity(profileAndApplicantData);
    const address = target.address || {};
    const profileId = getOptionalNumber(
      profileAndApplicantData?.userProfileId ||
        getFirstRawValue(target, [
          'userProfileId',
          'profileId',
          'individualId',
          'individualID',
          'personId',
        ]),
    );
    const emirateId = getFiniteNumber(address.emirateId, 0);
    const emirateNameEn = getDisplayText(address.emirateNameEn, '');
    const emirateNameAr = getDisplayText(address.emirateNameAr, emirateNameEn);
    const communityName = getDisplayText(
      address.communityNameEn || address.regionNameEn || address.areaNameEn,
      '',
    );
    const nationalityId = getFiniteNumber(
      profileAndApplicantData?.nationalityObj?.id || target.nationalityId,
      0,
    );
    const nationalityNameEn = getDisplayText(
      profileAndApplicantData?.nationalityObj?.nameEn || target.nationalityNameEn,
      '',
    );
    const nationalityNameAr = getDisplayText(
      profileAndApplicantData?.nationalityObj?.nameAr || target.nationalityNameAr,
      nationalityNameEn,
    );

    return {
      type: identity?.field === 'emiratesId' ? 1 : identity?.field === 'passportNumber' ? 3 : 2,
      profileCode: getDisplayText(target.profileCode, ''),
      userId: getDisplayText(profileAndApplicantData?.userId || target.userId, ''),
      proFileId: profileId || 0,
      rejectReason: null,
      dateOfBirth: getDisplayText(target.dateOfBirth || target.dateBirth, ''),
      passportNumber: identity?.field === 'passportNumber' ? identity.value : '',
      uid: identity?.field === 'uid' ? identity.value : '',
      email: getDisplayText(
        profileAndApplicantData?.personalEmail ||
          profileAndApplicantData?.userEmail ||
          target.email ||
          target.personalEmail,
        '',
      ),
      mobileNumber: getDisplayText(
          profileAndApplicantData?.personalPhoneNumber ||
          profileAndApplicantData?.phoneNumber ||
          target.mobileNumber ||
          target.mobile ||
          target.personalMobile ||
          target.phoneNumber,
        '',
      ),
      emiratesId: identity?.field === 'emiratesId' ? identity.value : '',
      fullNameAr: getDisplayText(
        profileAndApplicantData?.personalNameAr ||
          target.fullNameAr ||
          target.nameAr,
        '',
      ),
      fullNameEn: getDisplayText(
        profileAndApplicantData?.personalName ||
          profileAndApplicantData?.userName ||
          target.fullName ||
          target.fullNameEn ||
          target.nameEn,
        '',
      ),
      nationalityId,
      nationalityInfo: {
        id: nationalityId,
        code: '',
        nameEn: nationalityNameEn,
        nameAr: nationalityNameAr,
      },
      genderId: getFiniteNumber(target.genderId, 0),
      genderInfo: target.genderInfo || { id: 0, code: '', nameEn: '', nameAr: '' },
      passportExpiryDate: getDisplayText(target.passportExpiryDate, ''),
      emiratesIdexpiryDate: getDisplayText(target.emiratesIdexpiryDate, ''),
      occupation: getDisplayText(target.occupation, ''),
      personalPhotoUrl: getDisplayText(target.personalPhotoUrl, ''),
      passportCopyUrl: getDisplayText(target.passportCopyUrl || target.passportUrl, ''),
      emiratesIdCopyUrl: getDisplayText(target.emiratesIdCopyUrl || target.emiratesIdurl, ''),
      visaCopyUrl: getDisplayText(target.visaCopyUrl || target.visaUrl, ''),
      visaExpiryDate: getDisplayText(target.visaExpiryDate, ''),
      emirateId,
      emirateInfo: {
        id: emirateId,
        code: '',
        nameEn: emirateNameEn,
        nameAr: emirateNameAr,
      },
      regionId: getFiniteNumber(address.regionId || address.communityId, 0),
      regionInfo: { id: 0, code: '', nameEn: communityName, nameAr: '' },
      areaId: getFiniteNumber(address.areaId, 0),
      areaInfo: { id: 0, code: '', nameEn: getDisplayText(address.areaNameEn, ''), nameAr: '' },
      street: getDisplayText(address.street, ''),
      proFileStatus: {
        id: getFiniteNumber(profileAndApplicantData?.profileStatusObj?.id, 0),
        code: '',
        nameEn: getDisplayText(profileAndApplicantData?.profileStatusObj?.nameEn, ''),
        nameAr: getDisplayText(profileAndApplicantData?.profileStatusObj?.nameAr, ''),
      },
      documents: Math.max(
        0,
        getFiniteNumber(profileAndApplicantData?.documentCount ?? target.documentCount, 0),
      ),
    };
  }, [
    targetOverviewEnrichedProfileAndApplicant,
    targetOverviewFullScreenType,
    taskDetail,
  ]);

  const targetOverviewProfileAndApplicantData = useMemo(() => {
    const profileAndApplicantData = targetOverviewEnrichedProfileAndApplicant;
    return {
      isVip: Boolean(profileAndApplicantData?.isVip),
      profileStatusObj: {
        id: getFiniteNumber(profileAndApplicantData?.profileStatusObj?.id, 0),
        nameEn: getDisplayText(profileAndApplicantData?.profileStatusObj?.nameEn, '-'),
        nameAr: getDisplayText(profileAndApplicantData?.profileStatusObj?.nameAr, '-'),
      },
    };
  }, [targetOverviewEnrichedProfileAndApplicant]);

  const targetOverviewUserId = useMemo(
    () => normalizeOptionalId(targetOverviewEnrichedProfileAndApplicant?.userId) ||
      normalizeOptionalId(taskDetail?.inspectionTarget?.userId),
    [targetOverviewEnrichedProfileAndApplicant, taskDetail],
  );

  const targetOverviewProfileId = useMemo(() => {
    const target = taskDetail?.inspectionTarget || {};
    if (targetOverviewFullScreenType === 'Individual') {
      return normalizeOptionalId(
        getFirstRawValue(target, [
          'userProfileId',
          'profileId',
          'individualId',
          'individualID',
          'personId',
        ]),
      );
    }

    return normalizeOptionalId(targetOverviewEnrichedEstablishment?.userProfileId) ||
      normalizeOptionalId(getFirstRawValue(target, ['userProfileId', 'profileId']));
  }, [targetOverviewEnrichedEstablishment, targetOverviewFullScreenType, taskDetail]);

  const targetOverviewEstablishmentId = useMemo(() => {
    const target = taskDetail?.inspectionTarget;
    if (!target || targetOverviewFullScreenType !== 'Commercial') return undefined;
    return normalizeOptionalId(target.establishmentId);
  }, [targetOverviewFullScreenType, taskDetail]);

  const targetOverviewIndividualId = useMemo(() => {
    if (targetOverviewFullScreenType !== 'Individual') return undefined;
    return normalizeOptionalId(
      getFirstRawValue(taskDetail?.inspectionTarget || {}, [
        'individualId',
        'individualID',
        'personId',
      ]),
    );
  }, [targetOverviewFullScreenType, taskDetail]);

  const targetOverviewTaskId = useMemo(
    () => normalizeOptionalId(taskDetail?.taskId || taskId),
    [taskDetail, taskId],
  );

  const relatedInspection = useMemo(
    () => getRelatedInspection(taskDetail),
    [taskDetail],
  );

  const taskDetailFields: DetailField[] = useMemo(() => {
    const reinspectionNo = getDisplayText(taskDetail?.reinspectionNo);
    const canOpenReinspectionTask = reinspectionNo !== '-';

    return [
      { key: 'taskNo', label: t('inspection.taskDetail.taskNo'), value: taskSummary.taskNo },
      { key: 'reason', label: t('inspection.taskDetail.inspectionReason'), value: taskSummary.reason },
      { key: 'method', label: t('inspection.taskDetail.inspectionMethod'), value: taskSummary.method },
      {
        key: 'relatedTask',
        label: t('inspection.execution.relatedTaskNumber'),
        value: reinspectionNo,
        tone: 'gold',
        onClick: canOpenReinspectionTask
          ? () => {
            history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
              [INSPECTION_QUERY_KEYS.from]: 'tasks',
              [INSPECTION_QUERY_KEYS.tab]: null,
              [INSPECTION_QUERY_KEYS.teamTab]: null,
              [INSPECTION_QUERY_KEYS.taskId]: null,
              [INSPECTION_QUERY_KEYS.taskNo]: reinspectionNo,
              [INSPECTION_QUERY_KEYS.visitId]: null,
              [INSPECTION_QUERY_KEYS.step]: null,
              [INSPECTION_QUERY_KEYS.violationId]: null,
              [INSPECTION_QUERY_KEYS.violationNo]: null,
            }));
          }
          : undefined,
      },
    ];
  }, [history, location.search, taskDetail, taskSummary.method, taskSummary.reason, taskSummary.taskNo, t]);

  const taskDetailsTaskInfoFields: DetailField[] = useMemo(() => [
    {
      key: 'inspectionType',
      label: t('inspection.taskDetail.inspectionType'),
      value: getFirstDisplayValue(
        taskDetail?.inspectionConfig || taskDetail || {},
        ['inspectionTypeNameEn', 'inspectionTypeName', 'inspectionMethodNameEn'],
        taskSummary.method,
      ),
    },
    { key: 'inspectionReason', label: t('inspection.taskDetail.inspectionReason'), value: taskSummary.reason },
  ], [taskDetail, taskSummary.method, taskSummary.reason, t]);

  const taskDetailsTargetHighlightFields: DetailField[] = useMemo(() => {
    const hasViolationFound = relatedInspection?.hasViolationFound;
    const hasViolationFoundValue = hasViolationFound !== undefined &&
      hasViolationFound !== null &&
      typeof hasViolationFound === 'boolean';
    const licenseStatus = getDisplayText(relatedInspection?.licensePermitCurrentStatus);

    return [
      {
        key: 'lastInspection',
        label: t('inspection.taskDetail.lastInspection'),
        value: getDisplayText(relatedInspection?.taskNumber),
      },
      {
        key: 'lastInspectionTime',
        label: t('inspection.taskDetail.lastInspectionTime'),
        value: formatDateTime(String(relatedInspection?.completionTime || '')),
      },
      {
        key: 'violationsFound',
        label: t('inspection.taskDetail.violationsFound'),
        value: hasViolationFoundValue ? (hasViolationFound ? t('inspection.common.yes') : t('inspection.common.no')) : '-',
      },
      {
        key: 'licenseStatus',
        label: t('inspection.taskDetail.licenseStatus'),
        value: licenseStatus,
        tone: getLicenseStatusTone(licenseStatus),
      },
    ];
  }, [relatedInspection, t]);

  const taskDetailsExecutionFields: DetailField[] = useMemo(() => [
    { key: 'inspectionMethod', label: t('inspection.taskDetail.inspectionMethod'), value: taskSummary.method },
    { key: 'dueDate', label: t('inspection.taskDetail.dueDate'), value: formatDate(taskDetail?.inspectionConfig?.dueDate) },
    { key: 'inspector', label: t('inspection.tasks.columns.inspector'), value: taskSummary.inspector },
    {
      key: 'remarks',
      label: t('inspection.taskDetail.remarks'),
      value: getDisplayText(reportSummary.overallComment || reportSummary.reviewNote || taskDetail?.description),
      wide: true,
    },
  ], [reportSummary, taskDetail, taskSummary.inspector, taskSummary.method, t]);

  const taskDetailsRelatedInspectionFields: DetailField[] = useMemo(() => [
    {
      key: 'taskNumber',
      label: t('inspection.taskDetail.taskNumber'),
      value: getDisplayText(relatedInspection?.taskNumber),
      tone: 'gold',
    },
    {
      key: 'inspector',
      label: t('inspection.tasks.columns.inspector'),
      value: getDisplayText(relatedInspection?.inspector),
    },
    {
      key: 'completionTime',
      label: t('inspection.taskDetail.completionTime'),
      value: formatDateTime(String(relatedInspection?.completionTime || '')),
    },
    {
      key: 'violationNumber',
      label: t('inspection.taskDetail.violationNumber'),
      value: getDisplayText(relatedInspection?.violationNo),
    },
  ], [relatedInspection, t]);

  const targetAccessFields: DetailField[] = useMemo(() => [
    { key: 'name', label: t('inspection.taskDetail.establishmentName'), value: targetInformation.name },
    { key: 'nameAr', label: t('inspection.execution.establishmentArabicName'), value: targetInformation.nameAr },
    { key: 'contact', label: t('inspection.execution.contact'), value: targetInformation.contact },
    { key: 'contactNumber', label: t('inspection.execution.contactNumber'), value: targetInformation.contactNumber },
    { key: 'email', label: t('inspection.execution.emailAddress'), value: targetInformation.email },
    { key: 'location', label: t('inspection.taskDetail.address'), value: targetInformation.location, wide: true },
  ], [targetInformation, t]);

  const closeTaskDetailsFullScreen = useCallback(() => {
    setTaskDetailsExpanded(false);
  }, []);

  const openTaskDetailsFullScreen = useCallback(() => {
    setTargetOverviewExpanded(false);
    setTaskDetailsExpanded(true);
  }, []);

  const closeTargetOverviewFullScreen = useCallback(() => {
    setTargetOverviewExpanded(false);
    setTargetOverviewQuickNav(DEFAULT_TARGET_OVERVIEW_QUICK_NAV);
  }, []);

  const openTargetOverviewFullScreen = useCallback((target?: Partial<TargetOverviewQuickNavTarget>) => {
    setTargetOverviewQuickNav(
      createOverviewQuickNavTarget(
        target,
        DEFAULT_TARGET_OVERVIEW_QUICK_NAV.initialTab,
      ),
    );
    setTaskDetailsExpanded(false);
    setTargetOverviewExpanded(true);
  }, []);

  const handleTargetOverviewStatisticClick = useCallback(
    (key: string) => {
      if (key === 'documents') {
        openTargetOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToDocuments: true,
        });
        return;
      }

      if (key === 'partners') {
        openTargetOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToPartners: true,
        });
        return;
      }

      openTargetOverviewFullScreen();
    },
    [openTargetOverviewFullScreen],
  );

  const handleTargetOverviewAlertClick = useCallback(
    (key: string) => {
      if (key === 'warnings' || key === 'fines' || key === 'unpaidFines') {
        openTargetOverviewFullScreen({
          initialTab: 'violations-fines',
        });
        return;
      }

      openTargetOverviewFullScreen();
    },
    [openTargetOverviewFullScreen],
  );

  const renderExecutionStepper = () => (
    <div className={`inspection-start-visit__stepper inspection-start-visit__stepper--${stepConfigs.length}`}>
      <div
        className="inspection-start-visit__stepper-content"
        role="list"
        aria-label={t('inspection.execution.inspectionInProgress')}
      >
        {stepConfigs.map((step, index) => {
          const isActive = currentStep === index;
          const isCompleted = currentStep > index;
          const stepStatus = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
          const stepNumber = index + 1;
          return (
            <div
              key={step.key}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${stepNumber}. ${t(step.labelKey)}`}
              className="inspection-start-visit__stepper-item"
            >
              <span className={`inspection-start-visit__stepper-index inspection-start-visit__stepper-index--${stepStatus}`}>
                {isCompleted ? <FigmaCheckIcon className="inspection-start-visit__stepper-check" /> : stepNumber}
              </span>
              {index < stepConfigs.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`inspection-start-visit__stepper-connector inspection-start-visit__stepper-connector--${index < currentStep ? 'completed' : 'pending'}`}
                />
              ) : null}
              <span className={`inspection-start-visit__stepper-label inspection-start-visit__stepper-label--${stepStatus}`}>
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTargetAccessCard = (key: TargetAccessCardKey, title: string, children: React.ReactNode) => {
    const isOpen = targetAccessCardOpen[key];
    return (
      <section className={`inspection-start-visit__target-card${isOpen ? ' inspection-start-visit__target-card--open' : ''}`}>
        <DetailCardHeader
          title={title}
          open={isOpen}
          onToggle={() => setTargetAccessCardOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
          rootClassName="inspection-start-visit__target-card-header"
          rootPreviewClassName=""
          titleClassName="inspection-start-visit__target-card-title"
          chevronClassName="inspection-start-visit__target-card-chevron"
          chevronOpenClassName="inspection-start-visit__target-card-chevron--open"
        />
        {isOpen ? <div className="inspection-start-visit__target-card-body">{children}</div> : null}
      </section>
    );
  };

  const renderDataGrid = (fields: DetailField[]) => (
    <div className="inspection-start-visit__data-grid">
      {fields.map((field) => {
        const wideClass = field.wide ? ' inspection-start-visit__data-field--wide' : '';
        const toneClass = field.tone ? ` inspection-start-visit__data-field--${field.tone}` : '';
        return (
          <div key={field.key} className={`inspection-start-visit__data-field${wideClass}${toneClass}`}>
            <span className="inspection-start-visit__data-label">{field.label}</span>
            {field.key === 'location' ? (
              <div className="inspection-start-visit__location-content">
                <strong className="inspection-start-visit__data-value inspection-start-visit__location-address">{field.value}</strong>
                <TargetAccessMap
                  address={String(field.value || '')}
                  latitude={targetInformation.latitude}
                  longitude={targetInformation.longitude}
                  locationUrl={targetInformation.locationUrl}
                />
              </div>
            ) : (
              <strong className="inspection-start-visit__data-value">{field.value}</strong>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderWebsiteItem = (item: WebsiteDisplayItem) => {
    if (item.url) {
      return (
        <a
          key={item.key}
          className="inspection-start-visit__presence-link"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          {item.label}
        </a>
      );
    }

    return (
      <span key={item.key} className="inspection-start-visit__presence-value">
        {item.label}
      </span>
    );
  };

  const renderSocialMediaItem = (item: SocialMediaDisplayItem) => {
    const icon = item.platform ? socialMediaIconMap[item.platform] : undefined;
    const content = (
      <>
        {icon ? (
          <span className="inspection-start-visit__social-tag-icon" aria-hidden="true">
            <svg viewBox={icon.viewBox} focusable="false">
              <path d={icon.path} fill="currentColor" />
            </svg>
          </span>
        ) : null}
        <span className="inspection-start-visit__social-tag-text">{item.label}</span>
      </>
    );

    if (item.url) {
      return (
        <a
          key={item.key}
          className="inspection-start-visit__social-tag"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          {content}
        </a>
      );
    }

    return (
      <span key={item.key} className="inspection-start-visit__social-tag">
        {content}
      </span>
    );
  };

  const renderTargetOverviewFullScreen = () => (
    <div className="inspection-start-visit__fullscreen-wrap inspection-start-visit__fullscreen-wrap--target-overview">
      <div className="inspection-start-visit__target-overview-fullscreen">
        <FullScreen
          type={targetOverviewFullScreenType}
          applicant={targetOverviewApplicantData}
          establishment={targetOverviewEstablishmentData}
          userId={targetOverviewUserId}
          profileId={targetOverviewProfileId}
          targetEstablishmentId={targetOverviewEstablishmentId}
          targetIndividualId={targetOverviewIndividualId}
          targetTaskId={targetOverviewTaskId}
          profileAndApplicantData={targetOverviewProfileAndApplicantData}
          quickNav={targetOverviewQuickNav}
          visualVariant="figmaOverview"
          preserveApplicantIdentity
          onClose={closeTargetOverviewFullScreen}
        />
      </div>
    </div>
  );

  const renderTaskDetailsFieldValue = (
    field: DetailField,
    baseClassName: string,
  ) => {
    const toneClass = field.tone ? ` ${baseClassName}--${field.tone}` : '';
    const buttonClass = field.onClick ? ` ${baseClassName}-button` : '';

    if (field.onClick) {
      return (
        <button
          type="button"
          className={`${baseClassName}${toneClass}${buttonClass}`}
          onClick={field.onClick}
        >
          {field.value}
        </button>
      );
    }

    return (
      <strong className={`${baseClassName}${toneClass}`}>
        {field.value}
      </strong>
    );
  };

  const renderTaskDetailsFieldGrid = (fields: DetailField[]) => (
    <div className="inspection-start-visit__task-details-grid">
      {fields.map((field) => {
        const wideClass = field.wide ? ' inspection-start-visit__task-details-field--wide' : '';
        return (
          <div key={field.key} className={`inspection-start-visit__task-details-field${wideClass}`}>
            <span className="inspection-start-visit__task-details-label">{field.label}</span>
            {renderTaskDetailsFieldValue(field, 'inspection-start-visit__task-details-value')}
          </div>
        );
      })}
    </div>
  );

  const renderTaskDetailsExpandedSection = (
    key: TaskDetailsExpandedSectionKey,
    title: string,
    fields: DetailField[],
    extra?: React.ReactNode,
  ) => {
    const isOpen = expandedTaskDetailsSectionOpen[key];
    return (
      <section className={`inspection-start-visit__task-details-section${isOpen ? ' inspection-start-visit__task-details-section--open' : ''}`}>
        <DetailCardHeader
          title={title}
          open={isOpen}
          onToggle={() => setExpandedTaskDetailsSectionOpen((prev) => ({ ...prev, [key]: !isOpen }))}
          rootClassName="inspection-start-visit__task-details-section-header"
          rootPreviewClassName=""
          titleClassName="inspection-start-visit__task-details-section-title"
          chevronClassName="inspection-start-visit__task-details-section-chevron"
          chevronOpenClassName="inspection-start-visit__task-details-section-chevron--open"
          showExpandIcon={false}
        />
        {isOpen ? (
          <div className="inspection-start-visit__task-details-section-body">
            {renderTaskDetailsFieldGrid(fields)}
            {extra}
          </div>
        ) : null}
      </section>
    );
  };

  const renderTaskDetailsAttachments = () => {
    return (
      <div className="inspection-start-visit__task-details-attachments">
        <span className="inspection-start-visit__task-details-attachments-label">{t('inspection.execution.attachments')}</span>
        {taskDetailsAttachments.length ? (
          <InspectionAttachmentGrid
            attachments={taskDetailsAttachments}
            className="inspection-start-visit__attachment-grid--single"
          />
        ) : (
          <strong className="inspection-start-visit__task-details-attachments-empty">-</strong>
        )}
      </div>
    );
  };

  const renderTaskDetailsFullScreen = () => (
    <div className="inspection-start-visit__fullscreen-wrap inspection-start-visit__fullscreen-wrap--task-details">
      <div className="inspection-start-visit__task-details-expanded">
        <div className="inspection-start-visit__task-details-expanded-header">
          <div className="inspection-start-visit__task-details-expanded-title">
            <h2>{t('inspection.taskDetail.title')}</h2>
          </div>
          <button
            type="button"
            className="inspection-start-visit__task-details-shrink"
            aria-label={`${t('inspection.taskDetail.title')} close`}
            onClick={closeTaskDetailsFullScreen}
          >
            <img src={shrinkIcon} alt="" />
          </button>
        </div>
        <div className="inspection-start-visit__task-details-section-stack">
          {renderTaskDetailsExpandedSection(
            'taskInformation',
            t('inspection.taskDetail.taskInformation'),
            taskDetailsTaskInfoFields,
          )}
          {renderTaskDetailsExpandedSection(
            'targetHighlight',
            t('inspection.taskDetail.targetHighlight'),
            taskDetailsTargetHighlightFields,
          )}
          {renderTaskDetailsExpandedSection(
            'executionTimeline',
            t('inspection.taskDetail.executionTimeline'),
            taskDetailsExecutionFields,
            renderTaskDetailsAttachments(),
          )}
          {renderTaskDetailsExpandedSection(
            'relatedInspection',
            t('inspection.taskDetail.relatedInspection'),
            taskDetailsRelatedInspectionFields,
          )}
        </div>
      </div>
    </div>
  );

  const renderSideSection = (key: SideSectionKey, title: string, children: React.ReactNode, onExpand?: () => void) => {
    const isOpen = sideSectionOpen[key];
    return (
      <section className={`inspection-start-visit__side-section${isOpen ? ' inspection-start-visit__side-section--open' : ''}`}>
        <DetailCardHeader
          title={title}
          open={isOpen}
          onToggle={() => setSideSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
          isPreview
          showExpandIcon={Boolean(onExpand)}
          onExpand={onExpand}
          rootClassName="inspection-start-visit__side-section-header"
          rootPreviewClassName=""
          titleClassName="inspection-common-detail-card-header__title"
          chevronClassName="inspection-common-detail-card-header__chevron"
          chevronOpenClassName="inspection-common-detail-card-header__chevron--open"
          expandClassName="inspection-common-detail-card-header__expand"
          expandButtonAriaLabel={`${title} expand`}
        />
        {isOpen ? <div className="inspection-start-visit__side-section-body">{children}</div> : null}
      </section>
    );
  };

  const renderTaskDetailsPreview = () => renderSideSection(
    'taskDetails',
    t('inspection.taskDetail.title'),
    taskDetailFields.map((field) => (
      <div key={field.key} className="inspection-start-visit__task-details-card-row">
        <span className="inspection-start-visit__task-details-card-label">{field.label}</span>
        {renderTaskDetailsFieldValue(field, 'inspection-start-visit__task-details-card-value')}
      </div>
    )),
    openTaskDetailsFullScreen,
  );

  const renderSidePanel = () => (
    <aside className="inspection-start-visit__side-panel">
      <div className="inspection-start-visit__side-panel-column inspection-start-visit__side-panel-column--primary">
        <div className="inspection-start-visit__side-panel-section inspection-start-visit__side-panel-section--task-details">
          {renderTaskDetailsPreview()}
        </div>
        <div className="inspection-start-visit__side-panel-section inspection-start-visit__side-panel-section--ai-risk-insight">
          {renderSideSection('aiRiskInsight', t('inspection.taskDetail.aiRiskInsight'), (
            <AiRiskInsightCard
              riskProfile={taskDetail?.riskProfile}
              fallbackInsight={taskDetail?.aiRiskInsight}
            />
          ))}
        </div>
      </div>
      <div className="inspection-start-visit__side-panel-column inspection-start-visit__side-panel-column--secondary">
        <div className="inspection-start-visit__side-panel-section inspection-start-visit__side-panel-section--target-overview">
          {renderSideSection('targetOverview', t('inspection.taskDetail.targetOverview'), (
            <TargetOverviewCard
              data={targetOverviewData}
              onStatisticClick={handleTargetOverviewStatisticClick}
              onAlertClick={handleTargetOverviewAlertClick}
            />
          ), () => openTargetOverviewFullScreen())}
        </div>
      </div>
    </aside>
  );

  const renderExecutionShell = (children: React.ReactNode) => (
    <div className="inspection-start-visit__layout">
      <main className="inspection-start-visit__main-panel">
        {renderExecutionStepper()}
        {children}
      </main>
      {renderSidePanel()}
    </div>
  );

  const renderDigitalPresence = () => (
    renderTargetAccessCard('digitalPresence', t('inspection.execution.digitalPresence'), (
      <div className="inspection-start-visit__presence-grid">
        <div className="inspection-start-visit__presence-field">
          <span className="inspection-start-visit__presence-label">{t('inspection.execution.website')}</span>
          <div className="inspection-start-visit__presence-list">
            {targetInformation.websites.length
              ? targetInformation.websites.map((item) => renderWebsiteItem(item))
              : <span className="inspection-start-visit__presence-empty">-</span>}
          </div>
        </div>
        <div className="inspection-start-visit__presence-field">
          <span className="inspection-start-visit__presence-label">{t('inspection.execution.socialMedia')}</span>
          <div className="inspection-start-visit__social-list">
            {targetInformation.socialMedia.length
              ? targetInformation.socialMedia.map((item) => renderSocialMediaItem(item))
              : <span className="inspection-start-visit__presence-empty">-</span>}
          </div>
        </div>
      </div>
    ))
  );

  const renderTargetAccess = () => renderExecutionShell(
    <>
      {renderTargetAccessCard('targetAccessInformation', t('inspection.execution.targetAccessInformation'), (
        renderDataGrid(targetAccessFields)
      ))}
      {renderDigitalPresence()}
    </>,
  );

  const renderQuickScan = (flow: OcrFlow) => (
    <div className="inspection-start-visit__quick-scan-card">
      <div className="inspection-start-visit__quick-scan-copy">
      <strong>
      {flow === 'seizedMaterials'
        ? t('inspection.execution.scanMaterialToAutoFill')
        : t('inspection.execution.quickScan')}
      </strong>
      {flow === 'seizedMaterials'
      ? null
      : <span>{t('inspection.execution.scanPublicationsHint')}</span>}
      </div>
      <Button
        className="inspection-start-visit__quick-scan-button"
        icon={<img src={inspectionFigmaAssets.checklist.scan} alt="" />}
        onClick={() => openOcrTypeModal(flow)}
      >
        {t('inspection.execution.scan')}
      </Button>
    </div>
  );

  const renderChecklistHelpIcon = (tooltipTitle?: React.ReactNode) => {
    const icon = (
      <span
        className="inspection-start-visit__checklist-help-icon"
        aria-hidden={tooltipTitle ? undefined : true}
        aria-label={typeof tooltipTitle === 'string' ? tooltipTitle : undefined}
        tabIndex={tooltipTitle ? 0 : undefined}
      >
        <img className="inspection-start-visit__checklist-help-circle" src={inspectionFigmaAssets.checklist.helpCircle} alt="" />
        <img className="inspection-start-visit__checklist-help-mark" src={inspectionFigmaAssets.checklist.helpMark} alt="" />
      </span>
    );

    if (!tooltipTitle) return icon;

    return (
      <Tooltip
        title={tooltipTitle}
        getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
      >
        {icon}
      </Tooltip>
    );
  };

  const renderChecklistUploadIcon = () => (
    <span className="inspection-start-visit__checklist-upload-icon" aria-hidden="true">
      <img className="inspection-start-visit__checklist-upload-cloud" src={inspectionFigmaAssets.checklist.uploadCloud} alt="" />
      <img className="inspection-start-visit__checklist-upload-arrow" src={inspectionFigmaAssets.checklist.uploadArrow} alt="" />
    </span>
  );

  const getChecklistViolationReasonText = (item: any) => {
    const selectedViolationDescription = getChecklistItemSelectedViolations(item)
      .map((violation: any) => getChecklistItemViolationDescriptionDisplay(violation))
      .find(Boolean);
    return selectedViolationDescription || getChecklistItemViolationDescriptionDisplay(item);
  };

  const renderEvidencePanel = (categoryIndex: number, itemIndex: number, item: any) => {
    const uploadKey = getChecklistAttachmentUploadKey(categoryIndex, itemIndex);
    const isUploading = Boolean(attachmentUploadingByKey[uploadKey]);
    const evidenceAttachments = ensureArray<InspectionAttachmentSource>(item.evidenceAttachments);

    return (
      <div className="inspection-start-visit__evidence-panel">
        <div className="inspection-start-visit__evidence-reason">
          <img src={inspectionFigmaAssets.checklist.alert} alt="" />
          <strong>{getChecklistViolationReasonText(item)}</strong>
        </div>
        <div className="inspection-start-visit__evidence-grid">
          <div className="inspection-start-visit__evidence-upload">
            <label className="inspection-start-visit__evidence-label">
              <span>{t('inspection.execution.attachments')}</span>
              {renderChecklistHelpIcon(t('inspection.execution.violationEvidenceNotice'))}
              <em>*</em>
            </label>
            <Upload
              accept={INSPECTION_ATTACHMENT_ACCEPT}
              beforeUpload={(file) => validateInspectionAttachmentFile(file, evidenceAttachments.length)}
              customRequest={(options) => { void handleChecklistEvidenceUpload(categoryIndex, itemIndex, options); }}
              disabled={isUploading || evidenceAttachments.length >= INSPECTION_ATTACHMENT_MAX_COUNT}
              maxCount={INSPECTION_ATTACHMENT_MAX_COUNT}
              showUploadList={false}
            >
              <Button
                className="inspection-start-visit__upload-action"
                disabled={isUploading || evidenceAttachments.length >= INSPECTION_ATTACHMENT_MAX_COUNT}
                icon={renderChecklistUploadIcon()}
              >
                {t('inspection.tasks.fields.uploadFile')}
              </Button>
            </Upload>
          </div>
          {evidenceAttachments.length ? (
            <InspectionAttachmentGrid
              attachments={evidenceAttachments}
              className="inspection-start-visit__evidence-attachment-grid"
              onDelete={(_attachment, removeIndex) => updateChecklistItem(categoryIndex, itemIndex, {
                evidenceAttachments: evidenceAttachments
                  .filter((_file, fileIndex) => fileIndex !== removeIndex),
              })}
            />
          ) : null}
          <div className="inspection-start-visit__notes-box">
            <label className="inspection-start-visit__evidence-label">
              <span>{t('inspection.execution.notes')}</span>
              <em>*</em>
            </label>
            <Input.TextArea
              autoSize={{ minRows: 4 }}
              maxLength={1000}
              value={item.remarks}
              placeholder={t('inspection.execution.enterProblemDescription')}
              onChange={(event) => updateChecklistItem(categoryIndex, itemIndex, { remarks: event.target.value })}
            />
            <small>{t('inspection.execution.charactersCount', { count: String(item.remarks || '').length, max: 1000 })}</small>
          </div>
        </div>
      </div>
    );
  };

  const renderViolationSelector = (categoryIndex: number, itemIndex: number, item: any) => {
    const relatedViolations = ensureArray<any>(item.relatedViolations);
    if (!relatedViolations.length) return null;
    const selectedKeys = getChecklistItemSelectedViolationKeys(item);
    const itemKey = getChecklistItemKey(item, categoryIndex, itemIndex);
    const isOpen = contentViolationSelectorOpen[itemKey] ?? (normalizeChecklistResult(item.result) === 'VIOLATION');
    return (
      <div className="inspection-start-visit__violation-selector">
        <DetailCardHeader
          title={(
            <>
              <strong>{t('inspection.execution.contentViolationChecklist')}</strong>
              <span>{t('inspection.execution.selectMultipleViolations')}</span>
            </>
          )}
          open={isOpen}
          onToggle={() => setContentViolationSelectorOpen((prev) => ({ ...prev, [itemKey]: !isOpen }))}
          rootClassName="inspection-start-visit__violation-selector-head"
          rootPreviewClassName=""
          titleClassName="inspection-start-visit__violation-selector-copy"
          chevronClassName="inspection-start-visit__violation-selector-chevron"
          chevronOpenClassName="inspection-common-detail-card-header__chevron--open"
        />
        {isOpen ? (
          <Checkbox.Group
            value={selectedKeys}
            onChange={(keys) => handleChecklistViolationToggle(categoryIndex, itemIndex, keys as string[])}
            className="inspection-start-visit__violation-options"
          >
            {relatedViolations.map((violation) => {
              const key = getViolationKey(violation);
              if (!key) return null;
              return (
                <Checkbox key={key} value={key} className={`inspection-start-visit__violation-option${selectedKeys.includes(key) ? ' inspection-start-visit__violation-option--selected' : ''}`}>
                  <span>{getChecklistItemViolationDescriptionDisplay(violation) || '-'}</span>
                </Checkbox>
              );
            })}
          </Checkbox.Group>
        ) : null}
      </div>
    );
  };

  const getChecklistItemKind = (category: any) => {
    if (category?.categoryId === 'OTHER_DETECTED') {
      return getChecklistCategoryKind(category);
    }
    return getChecklistCategoryKind(category);
  };

  const checklistResultIconMap: Record<string, { default: string; active: string }> = {
    COMPLIANT: {
      default: inspectionFigmaAssets.checklist.compliant,
      active: inspectionFigmaAssets.checklist.compliantActive,
    },
    VIOLATION: {
      default: inspectionFigmaAssets.checklist.violation,
      active: inspectionFigmaAssets.checklist.violationActive,
    },
    NOT_APPLICABLE: {
      default: inspectionFigmaAssets.checklist.na,
      active: inspectionFigmaAssets.checklist.naActive,
    },
  };

  const isChecklistCategoryInvalid = (category: any, categoryIndex: number) => (
    checklistValidation?.categoryKey === getChecklistCategoryKey(category, categoryIndex)
  );

  const isChecklistItemInvalid = (categoryIndex: number, itemIndex: number, item: any) => (
    checklistValidation?.itemKey === getChecklistItemKey(item, categoryIndex, itemIndex)
  );

  const renderChecklistItem = (category: any, categoryIndex: number, itemIndex: number, item: any, displayIndex = itemIndex + 1) => {
    const result = normalizeChecklistResult(item.result);
    const itemKind = getChecklistItemKind(category);
    const shouldRenderViolationChecklist = itemKind === 'content' && !isStandaloneContentChecklistItem(category, itemIndex);
    const isInvalid = isChecklistItemInvalid(categoryIndex, itemIndex, item);
    const itemKey = getChecklistItemKey(item, categoryIndex, itemIndex);
    return (
      <div
        key={itemKey}
        data-checklist-validation-target={isInvalid ? 'true' : undefined}
        className={`inspection-start-visit__check-item${result === 'VIOLATION' ? ' inspection-start-visit__check-item--violation' : ''}${isInvalid ? ' inspection-start-visit__check-item--invalid' : ''}`}
      >
        <ol className="inspection-start-visit__check-title" start={displayIndex}>
          <li>
            <span>{getChecklistItemDisplayText(item)}</span>
          </li>
        </ol>
        <div className="inspection-start-visit__result-group">
          {resultOptions.map((option) => {
            const isActive = result === option.value;
            const iconSource = isActive ? checklistResultIconMap[option.value].active : checklistResultIconMap[option.value].default;
            return (
              <Button
                key={option.value}
                className={`inspection-start-visit__result-button inspection-start-visit__result-button--${option.tone}${isActive ? ' inspection-start-visit__result-button--active' : ''}`}
                icon={<img src={iconSource} alt="" />}
                onClick={() => handleChecklistResultChange(categoryIndex, itemIndex, option.value)}
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
        </div>
        {shouldRenderViolationChecklist ? renderViolationSelector(categoryIndex, itemIndex, item) : null}
        {result === 'VIOLATION' ? (
          renderEvidencePanel(categoryIndex, itemIndex, item)
        ) : null}
      </div>
    );
  };

  const renderContentViolationOption = (categoryIndex: number, itemIndex: number, item: any) => {
    const selectedKeys = getChecklistItemSelectedViolationKeys(item);
    const isSelected = normalizeChecklistResult(item.result) === 'VIOLATION' && selectedKeys.length > 0;
    const isInvalid = isChecklistItemInvalid(categoryIndex, itemIndex, item);
    return (
      <div
        key={getChecklistItemKey(item, categoryIndex, itemIndex)}
        data-checklist-validation-target={isInvalid ? 'true' : undefined}
        className={`inspection-start-visit__content-violation-option${isSelected ? ' inspection-start-visit__content-violation-option--selected' : ''}${isInvalid ? ' inspection-start-visit__content-violation-option--invalid' : ''}`}
      >
        <button
          type="button"
          className="inspection-start-visit__content-violation-option-toggle"
          aria-pressed={isSelected}
          onClick={() => handleContentViolationItemToggle(categoryIndex, itemIndex, !isSelected)}
        >
          <span className="inspection-start-visit__content-violation-option-title">
            {getChecklistItemDisplayText(item) || '-'}
          </span>
          <span className={`inspection-start-visit__content-violation-checkbox${isSelected ? ' inspection-start-visit__content-violation-checkbox--checked' : ''}`} aria-hidden="true">
            <FigmaCheckIcon />
          </span>
        </button>
        {isSelected ? renderEvidencePanel(categoryIndex, itemIndex, item) : null}
      </div>
    );
  };

  const renderContentViolationGroup = (category: any, categoryIndex: number) => {
    const generalEntries = getContentGeneralChecklistEntries(category);
    const groupKey = getContentViolationGroupKey(category, categoryIndex);
    const groupResult = getContentGroupActiveResult(category, categoryIndex);
    const isSelectorOpen = contentViolationGroupOpen[groupKey] ?? false;
    const isInvalid = isChecklistCategoryInvalid(category, categoryIndex) && !checklistValidation?.itemKey;
    return (
      <div
        data-checklist-validation-target={isInvalid ? 'true' : undefined}
        className={`inspection-start-visit__content-violation-group${groupResult === 'VIOLATION' ? ' inspection-start-visit__content-violation-group--violation' : ''}${isInvalid ? ' inspection-start-visit__content-violation-group--invalid' : ''}`}
      >
        <ol className="inspection-start-visit__check-title" start={1}>
          <li>
            <span>{t('inspection.execution.generalContentViolation')}</span>
          </li>
        </ol>
        <div className="inspection-start-visit__result-group">
          {resultOptions.map((option) => {
            const isActive = groupResult === option.value;
            const iconSource = isActive ? checklistResultIconMap[option.value].active : checklistResultIconMap[option.value].default;
            return (
              <Button
                key={option.value}
                className={`inspection-start-visit__result-button inspection-start-visit__result-button--${option.tone}${isActive ? ' inspection-start-visit__result-button--active' : ''}`}
                icon={<img src={iconSource} alt="" />}
                onClick={() => handleContentGroupResultChange(categoryIndex, option.value)}
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
        </div>
        <div className="inspection-start-visit__content-violation-selector">
          <DetailCardHeader
            title={(
              <>
                <strong>{t('inspection.execution.contentViolationChecklist')}</strong>
                <span>{t('inspection.execution.selectMultipleViolations')}</span>
              </>
            )}
            open={isSelectorOpen}
            onToggle={() => setContentViolationGroupOpen((prev) => ({ ...prev, [groupKey]: !isSelectorOpen }))}
            rootClassName="inspection-start-visit__content-violation-selector-head"
            rootPreviewClassName=""
            titleClassName="inspection-start-visit__violation-selector-copy"
            chevronClassName="inspection-start-visit__violation-selector-chevron"
            chevronOpenClassName="inspection-common-detail-card-header__chevron--open"
          />
          {isSelectorOpen ? (
            <div className="inspection-start-visit__content-violation-list">
              {generalEntries.map(({ item, itemIndex }) => renderContentViolationOption(categoryIndex, itemIndex, item))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderContentChecklistCategoryBody = (category: any, categoryIndex: number) => {
    const generalEntries = getContentGeneralChecklistEntries(category);
    const standaloneEntries = getContentStandaloneChecklistEntries(category);
    return (
      <>
        {generalEntries.length ? renderContentViolationGroup(category, categoryIndex) : null}
        {standaloneEntries.map(({ item, itemIndex }, standaloneIndex) =>
          renderChecklistItem(category, categoryIndex, itemIndex, item, generalEntries.length ? standaloneIndex + 2 : standaloneIndex + 1))}
      </>
    );
  };

  const renderChecklistCategoryCard = (category: any, categoryIndex: number) => {
    const categoryKey = getChecklistCategoryKey(category, categoryIndex);
    const isOpen = checklistCategoryOpen[categoryKey] !== false;
    const categoryKind = getChecklistCategoryKind(category);
    const isInvalid = isChecklistCategoryInvalid(category, categoryIndex);
    const title = categoryKind === 'content'
      ? t('inspection.execution.contentViolation')
      : t('inspection.execution.licensingViolation');

    return (
      <section
        key={categoryKey}
        className={`inspection-start-visit__checklist-card inspection-start-visit__checklist-card--${categoryKind}${isOpen ? ' inspection-start-visit__checklist-card--open' : ''}${isInvalid ? ' inspection-start-visit__checklist-card--invalid' : ''}`}
      >
        <DetailCardHeader
          title={title}
          open={isOpen}
          onToggle={() => setChecklistCategoryOpen((prev) => ({ ...prev, [categoryKey]: !isOpen }))}
          rootClassName="inspection-start-visit__checklist-card-header"
          rootPreviewClassName=""
          titleClassName="inspection-start-visit__checklist-card-title"
          chevronClassName="inspection-start-visit__checklist-card-chevron"
          chevronOpenClassName="inspection-common-detail-card-header__chevron--open"
        />
        {isOpen ? (
          <div className="inspection-start-visit__checklist-card-body">
            {categoryKind === 'content'
              ? renderContentChecklistCategoryBody(category, categoryIndex)
              : ensureArray(category.checkItems).map((item: any, itemIndex: number) =>
                renderChecklistItem(category, categoryIndex, itemIndex, item))}
          </div>
        ) : null}
      </section>
    );
  };

  const renderOtherViolationsCard = (category?: any, categoryIndex = -1) => {
    const items = ensureArray<any>(category?.checkItems);
    return (
      <div className={`inspection-start-visit__other-violations-card${items.length ? ' inspection-start-visit__other-violations-card--open' : ''}`}>
        <div className="inspection-start-visit__other-violations-header">
          <h2>{t('inspection.execution.otherViolationItems')}</h2>
          <Button className="inspection-start-visit__other-violations-button" onClick={openFullViolationList}>
            {t('inspection.execution.addViolationItems')}
          </Button>
        </div>
        {items.length ? (
          <div className="inspection-start-visit__other-violations-body">
            {items.map((item: any, itemIndex: number) => renderChecklistItem(category, categoryIndex, itemIndex, item))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderChecklist = () => renderExecutionShell(
    <>
      {!isDigitalInspection ? renderQuickScan('checklist') : null}
      <div className="inspection-start-visit__checklist-shell">
        {checklistValidation || !allChecklistItems.length ? (
          <div ref={checklistValidationRef} className="inspection-start-visit__checklist-validation">
            <Alert
              type="error"
              showIcon
              message={checklistValidation?.message || t('inspection.execution.noChecklist')}
            />
          </div>
        ) : null}
        <div className="inspection-start-visit__category-stack" style={{display: checklistCategories.length ? 'grid' : 'none'}}>
          {checklistCategories
            .map((category, categoryIndex) =>
              category.categoryId === 'OTHER_DETECTED' ? null : renderChecklistCategoryCard(category, categoryIndex))}
        </div>
      </div>
      {renderOtherViolationsCard(
        checklistCategories.find((category) => category.categoryId === 'OTHER_DETECTED'),
        checklistCategories.findIndex((category) => category.categoryId === 'OTHER_DETECTED'),
      )}
    </>,
  );

  const renderSeizedMaterials = () => {
    const renderSelect = (
      value: any,
      placeholder: string,
      options: Array<string | { value: string; label: string }>,
      onChange: (value: any) => void,
      loadingOption = false,
      searchable = false,
      invalid = false,
    ) => {
      const selectOptions = options
        .map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
        .filter((item) => item.value && item.label);

      return (
        <Select
          className={`inspection-start-visit__seized-select${invalid ? ' inspection-start-visit__seized-select--error' : ''}`}
          value={value || undefined}
          placeholder={placeholder}
          suffixIcon={<FigmaSelectArrowIcon />}
          loading={loadingOption}
          showSearch={searchable}
          optionFilterProp={searchable ? 'label' : undefined}
          options={selectOptions}
          onChange={onChange}
          aria-invalid={invalid || undefined}
        />
      );
    };

    const getInputClassName = (invalid?: boolean) =>
      `inspection-start-visit__seized-input${invalid ? ' inspection-start-visit__seized-input--error' : ''}`;

    const getNumberInputClassName = (invalid?: boolean) =>
      `inspection-start-visit__seized-number-input${invalid ? ' inspection-start-visit__seized-number-input--error' : ''}`;

    const renderQuantityInput = (material: Record<string, any>, index: number, invalid = false) => (
      <InputNumber
        className={getNumberInputClassName(invalid)}
        value={getPositiveIntegerNumber(material.quantity)}
        min={1}
        precision={0}
        controls={false}
        keyboard={false}
        parser={parsePositiveIntegerInput}
        formatter={formatPositiveIntegerInput}
        placeholder={t('inspection.execution.numberOfCopy')}
        onKeyDown={preventNonDigitKeyDown}
        onPaste={preventInvalidPositiveIntegerPaste}
        onChange={(value) => updateMaterial(index, { quantity: getPositiveIntegerNumber(value) })}
        aria-invalid={invalid || undefined}
      />
    );

    return renderExecutionShell(
      <>
        {renderQuickScan('seizedMaterials')}
        <div className="inspection-start-visit__seized-materials-stack">
          {seizedMaterials.map((material, index) => {
            const cardKey = getSeizedMaterialCardKey(material, index);
            const isOpen = seizedMaterialCardOpen[cardKey] !== false;
            const materialTypeValue = getMaterialTypeCodeByValue(
              material.materialTypeCode || material.materialType || material.publicationType,
              { preserveUnknown: false },
            );
            const languageValue = getSeizedMaterialLanguageSelectValue(material);
            const isBook = isBookMaterialTypeValue(materialTypeValue);
            const title = t('inspection.execution.seizedMaterialTitle', { index: index + 1 });
            const fieldErrors = seizedMaterialValidationErrors[cardKey] || {};

            return (
              <section
                className={`inspection-start-visit__seized-card${isOpen ? ' inspection-start-visit__seized-card--open' : ''}`}
                key={cardKey}
              >
                <div className="inspection-start-visit__seized-card-head">
                  <h2 className="inspection-start-visit__seized-card-title">{title}</h2>
                  <div className="inspection-start-visit__seized-card-actions">
                    {seizedMaterials.length > 1 ? (
                      <button
                        type="button"
                        className="inspection-start-visit__seized-card-delete"
                        aria-label={`${title} ${t('common.delete')}`}
                        onClick={() => removeSeizedMaterial(index)}
                      >
                        <FigmaTrashIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`inspection-start-visit__seized-card-toggle${isOpen ? ' is-open' : ''}`}
                      aria-label={isOpen ? t('inspection.common.collapse') : t('inspection.common.expand')}
                      aria-expanded={isOpen}
                      onClick={() => toggleSeizedMaterialCard(cardKey, isOpen)}
                    >
                      <FigmaChevronIcon />
                    </button>
                  </div>
                </div>
                {isOpen ? (
                  <div className="inspection-start-visit__seized-card-body">
                    {renderSeizedMaterialField(
                      t('inspection.execution.materialType'),
                      renderSelect(
                        materialTypeValue,
                        t('inspection.execution.pleaseSelect'),
                        materialTypeSelectOptions,
                        (value) => updateMaterial(index, {
                          materialType: value,
                          materialTypeCode: value,
                          materialTypeName: getMaterialTypeLabelByValue(value, { preserveUnknown: false }),
                        }),
                        inspectionLookupLoading,
                        false,
                        Boolean(fieldErrors.materialType),
                      ),
                      true,
                      fieldErrors.materialType,
                    )}
                    {isBook ? (
                      <>
                        {renderSeizedMaterialField(
                          t('inspection.execution.isbn'),
                          <Input
                            className={getInputClassName(Boolean(fieldErrors.isbn))}
                            value={material.isbn}
                            placeholder={t('inspection.execution.enterIsbn')}
                            onChange={(event) => updateMaterial(index, { isbn: event.target.value })}
                            aria-invalid={Boolean(fieldErrors.isbn) || undefined}
                          />,
                          false,
                          fieldErrors.isbn,
                        )}
                        {renderSeizedMaterialField(
                          t('inspection.execution.bookName'),
                          <Input
                            className={getInputClassName(Boolean(fieldErrors.title))}
                            value={material.title}
                            placeholder={t('inspection.execution.enterBookName')}
                            onChange={(event) => updateMaterial(index, { title: event.target.value })}
                            aria-invalid={Boolean(fieldErrors.title) || undefined}
                          />,
                          false,
                          fieldErrors.title,
                        )}
                        {renderSeizedMaterialField(
                          t('inspection.ocr.author'),
                          <Input
                            className={getInputClassName(Boolean(fieldErrors.author))}
                            value={material.author}
                            placeholder={t('inspection.execution.enterAuthorName')}
                            onChange={(event) => updateMaterial(index, { author: event.target.value })}
                            aria-invalid={Boolean(fieldErrors.author) || undefined}
                          />,
                          false,
                          fieldErrors.author,
                        )}
                        {renderSeizedMaterialField(
                          t('inspection.ocr.language'),
                          renderSelect(
                            languageValue,
                            t('inspection.execution.pleaseSelect'),
                            languageSelectOptions,
                            (value) => updateMaterial(index, { languageId: value }),
                            inspectionLookupLoading,
                            true,
                            Boolean(fieldErrors.languageId),
                          ),
                          false,
                          fieldErrors.languageId,
                        )}
                        {renderSeizedMaterialField(
                          t('inspection.execution.numberOfCopy'),
                          renderQuantityInput(material, index, Boolean(fieldErrors.quantity)),
                          false,
                          fieldErrors.quantity,
                        )}
                      </>
                    ) : getNormalizedText(materialTypeValue) ? (
                      <>
                        {renderSeizedMaterialField(
                          t('inspection.execution.materialName'),
                          <Input
                            className={getInputClassName(Boolean(fieldErrors.title))}
                            value={material.title}
                            placeholder={t('inspection.execution.enterMaterialName')}
                            onChange={(event) => updateMaterial(index, { title: event.target.value })}
                            aria-invalid={Boolean(fieldErrors.title) || undefined}
                          />,
                          false,
                          fieldErrors.title,
                        )}
                        {renderSeizedMaterialField(
                          t('inspection.execution.numberOfCopy'),
                          renderQuantityInput(material, index, Boolean(fieldErrors.quantity)),
                          false,
                          fieldErrors.quantity,
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
          <section className="inspection-start-visit__seized-add-card">
            <h2 className="inspection-start-visit__seized-add-title">{t('inspection.execution.addSeizedMaterial')}</h2>
            <Button className="inspection-start-visit__seized-add-button" icon={<FigmaAddIcon />} onClick={addSeizedMaterial}>
              {t('inspection.execution.add')}
            </Button>
          </section>
        </div>
      </>,
    );
  };

  const renderContactConfirmation = () => {
    const eidAttachments = ensureArray<InspectionAttachmentSource>(
      contactValues?.eidAttachment || [],
    );
    const isEidAttachmentUploadDisabled =
      Boolean(attachmentUploadingByKey.eid) ||
      eidAttachments.length >= UPLOAD_LIMITS.SINGLE_ATTACHMENT;
    const syncContactFormValues = (patch: Record<string, any>) => {
      const nextValues = {
        ...contactForm.getFieldsValue(true),
        ...patch,
      };
      contactForm.setFieldsValue(patch);
      setContactValues(nextValues);
      if (
        Object.prototype.hasOwnProperty.call(patch, 'signatureImageFileUrl') ||
        patch.signatureLocked === true ||
        Object.prototype.hasOwnProperty.call(patch, 'declarationStatus')
      ) {
        setContactSignatureValidationError('');
      }
    };
    const handleContactPersonSelect = (option: InspectionContactPersonOption) => {
      if (!isNamedContactPersonOption(option)) return;
      const mobileSnapshot = createContactPersonMobileSnapshot(option);
      contactMobileSnapshotRef.current = mobileSnapshot;
      const patch = buildContactPersonSelectionPatch(option, mobileSnapshot);
      syncContactFormValues(patch);
      contactForm.validateFields([
        'name',
        'position',
        'mobilePhone',
        'emailAddress',
        'emiratesId',
        'eidAttachment',
      ]).catch(() => undefined);
    };
    const handleContactPersonNameInputChange = () => {
      syncContactFormValues({
        personId: undefined,
        sourceType: undefined,
        collectedChannelCode: undefined,
      });
    };
    const handleEidAttachmentDelete = (_attachment: InspectionAttachmentSource, index: number) => {
      const nextAttachments = eidAttachments.filter((_file, fileIndex) => fileIndex !== index);
      syncContactFormValues({ eidAttachment: nextAttachments });
      contactForm.validateFields(['eidAttachment']).catch(() => undefined);
    };
    const handleEidAttachmentBeforeUpload = (file: RcFile) => {
      if (!isPdfUploadFile(file)) {
        CustomMessage.error(t('inspection.execution.messages.eidAttachmentPdfOnly'));
        return Upload.LIST_IGNORE;
      }
      if (file.size / 1024 / 1024 > INSPECTION_ATTACHMENT_MAX_SIZE_MB) {
        CustomMessage.error(t('inspection.tasks.messages.attachmentFileSizeExceeded', { maxSize: INSPECTION_ATTACHMENT_MAX_SIZE_MB }));
        return Upload.LIST_IGNORE;
      }
      if (eidAttachments.length >= UPLOAD_LIMITS.SINGLE_ATTACHMENT) {
        CustomMessage.error(t('inspection.tasks.messages.attachmentUploadLimitSingle'));
        return Upload.LIST_IGNORE;
      }

      return true;
    };
    const handleEidAttachmentUpload = async (options: UploadRequestOption) => {
      const file = options.file as RcFile;
      const uploadKey = 'eid';
      setInspectionAttachmentUploading(uploadKey, true);
      try {
        const uploadResult = await uploadInspectionFile(file);
        const nextAttachment = buildInspectionUploadedAttachment(uploadResult, 'ContactPersonEid');
        syncContactFormValues({ eidAttachment: [nextAttachment] });
        contactForm.validateFields(['eidAttachment']).catch(() => undefined);
        options.onSuccess?.(nextAttachment);
      } catch (error) {
        CustomMessage.error(t('inspection.tasks.messages.attachmentUploadFailed'));
        options.onError?.(error as Error);
      } finally {
        setInspectionAttachmentUploading(uploadKey, false);
      }
    };
    const handleSignatureSave = async (signatureDataUrl: string) => {
      try {
        const signatureImageFileUrl = getNormalizedText(contactForm.getFieldValue('signatureImageFileUrl'));
        const uploadResult = isSignatureDataUrl(signatureDataUrl)
          ? await uploadSignatureImage(signatureDataUrl)
          : {
            fileName: contactForm.getFieldValue('signatureImageFileName') || getSignatureFileName(taskRequest.taskNo, taskRequest.taskId),
            fileUrl: signatureImageFileUrl,
          };
        if (!uploadResult.fileUrl) {
          throw new Error('Signature image file URL is missing.');
        }

        syncContactFormValues({
          signatureDataUrl: normalizeSignatureImageDisplayUrl(uploadResult.fileUrl || signatureDataUrl),
          signatureImageFileName: uploadResult.fileName,
          signatureImageFileUrl: uploadResult.fileUrl,
          signatureLocked: true,
          signatureEditing: false,
        });
      } catch (error) {
        CustomMessage.error(t('inspection.execution.messages.submitFailed'));
        throw error;
      }
    };
    const handleDeclarationDocumentClick = () => {
      setDeclarationPreviewVisible(true);
    };
    const declarationQuestionLabel = (
      <span className="inspection-start-visit__declaration-question">
        <span>{t('inspection.execution.agreeAndSignPrefix')}</span>
        <button
          type="button"
          className="inspection-start-visit__declaration-link"
          onClick={handleDeclarationDocumentClick}
        >
          {t('inspection.execution.declarationAcknowledgement')}
        </button>
        <span> ?</span>
      </span>
    );
    const renderFormLabel = (label: React.ReactNode, tooltipTitle?: React.ReactNode) => (
      <span className="inspection-start-visit__form-label">
        <span className="inspection-start-visit__form-label-text">{label}</span>
        {tooltipTitle ? (
          <Tooltip
            title={tooltipTitle}
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          >
            <span className="inspection-start-visit__form-info-icon" tabIndex={0}>i</span>
          </Tooltip>
        ) : null}
      </span>
    );
    const renderRequiredFormLabel = (label: React.ReactNode, tooltipTitle?: React.ReactNode) => (
      <span className="inspection-start-visit__form-label">
        <span className="inspection-start-visit__form-label-text">{label}</span>
        <span className="inspection-start-visit__form-required-mark">*</span>
        {tooltipTitle ? (
          <Tooltip
            title={tooltipTitle}
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          >
            <span className="inspection-start-visit__form-info-icon" tabIndex={0}>i</span>
          </Tooltip>
        ) : null}
      </span>
    );

    return (
      <Form
        form={contactForm}
        layout="vertical"
        className="inspection-start-visit__contact-form"
        requiredMark={false}
        initialValues={contactValues || undefined}
        onValuesChange={(_, allValues) => setContactValues(allValues)}
      >
        <Form.Item name="signatureDataUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="signatureImageFileName" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="signatureImageFileUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="declarationDocumentFileName" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="declarationDocumentFileUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="signatureLocked" valuePropName="checked" hidden>
          <Checkbox />
        </Form.Item>
        <Form.Item name="signatureEditing" valuePropName="checked" hidden>
          <Checkbox />
        </Form.Item>
        <Form.Item name="personId" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="sourceType" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="collectedChannelCode" hidden>
          <Input />
        </Form.Item>
        <div className="inspection-start-visit__contact-grid">
          <Form.Item label={renderFormLabel(t('inspection.execution.fullName'))} name="name">
            <ContactFullNameSelector
              options={contactPersonOptions}
              placeholder={t('inspection.execution.enterFullName')}
              searchPlaceholder={t('common.search')}
              emptyText={t('common.noData')}
              onInputChange={handleContactPersonNameInputChange}
              onSelectContact={handleContactPersonSelect}
            />
          </Form.Item>
          <Form.Item label={renderFormLabel(t('inspection.execution.position'))} name="position">
            <Input allowClear placeholder={t('inspection.execution.enterPosition')} />
          </Form.Item>
          <Form.Item
            label={renderFormLabel(t('inspection.execution.mobilePhone'))}
            name="mobilePhone"
            rules={[
              createMobileNumberFormRule({
                fieldNames: contactMobileFieldNames,
                required: false,
              }),
            ]}
          >
            <FormMobileNumberInput
              fieldNames={contactMobileFieldNames}
              defaultCountryCode=""
              placeholder={t('inspection.execution.enterMobilePhone')}
              getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
            />
          </Form.Item>
          <Form.Item
            label={renderFormLabel(t('inspection.execution.emailAddress'))}
            name="emailAddress"
            rules={[
              { type: 'email', message: t('signup.please.emailFormat') },
            ]}
          >
            <Input allowClear placeholder={t('inspection.execution.enterEmailAddress')} />
          </Form.Item>
          <Form.Item
            label={renderFormLabel(t('inspection.tasks.fields.eid'))}
            name="emiratesId"
          >
            <Input
              allowClear
              placeholder={t('inspection.tasks.placeholders.eid')}
            />
          </Form.Item>
          <div className="inspection-start-visit__contact-upload-field">
            <Form.Item
              className={
                isEidAttachmentUploadDisabled
                  ? 'inspection-start-visit__contact-upload-form-item--hidden'
                  : undefined
              }
              label={renderFormLabel(
                t('inspection.execution.eidAttachment'),
                t('inspection.execution.eidAttachmentTooltip'),
              )}
              name="eidAttachment"
              trigger="onValueChange"
              getValueProps={() => ({})}
              rules={[
                {
                  validator: (_, attachments: InspectionAttachmentSource[] = []) => {
                    const attachmentList = ensureArray(attachments);
                    if (!attachmentList.length) return Promise.resolve();
                    return attachmentList.every(isPdfUploadFile)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('inspection.execution.messages.eidAttachmentPdfOnly')));
                  },
                },
              ]}
            >
              {!isEidAttachmentUploadDisabled ? (
                <Upload
                  accept={EID_ATTACHMENT_ACCEPT}
                  beforeUpload={handleEidAttachmentBeforeUpload}
                  customRequest={(options) => { void handleEidAttachmentUpload(options); }}
                  maxCount={UPLOAD_LIMITS.SINGLE_ATTACHMENT}
                  showUploadList={false}
                >
                  <Button
                    className="inspection-start-visit__upload-action"
                    icon={renderChecklistUploadIcon()}
                  >
                    {t('inspection.tasks.fields.uploadFile')}
                  </Button>
                </Upload>
              ) : null}
            </Form.Item>
            {eidAttachments.length ? (
              <InspectionAttachmentGrid
                attachments={eidAttachments}
                className="inspection-start-visit__attachment-grid--single"
                onDelete={handleEidAttachmentDelete}
              />
            ) : null}
          </div>
        </div>
        <div className="inspection-start-visit__contact-divider" />
        <div className="inspection-start-visit__declaration-section">
          <Form.Item label={renderFormLabel(declarationQuestionLabel)} name="declarationStatus">
            <Radio.Group className="inspection-start-visit__declaration-radio-group">
              <Radio value="signed">{t('inspection.common.yes')}</Radio>
              <Radio value="not_signed">{t('inspection.common.no')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const declarationStatus = getFieldValue('declarationStatus');
              if (!declarationStatus) return null;
              return declarationStatus === 'signed' ? (
                <Form.Item
                  label={renderRequiredFormLabel(t('inspection.execution.signHere'))}
                  className="inspection-start-visit__signature-form-item"
                  validateStatus={contactSignatureValidationError ? 'error' : undefined}
                  help={contactSignatureValidationError || undefined}
                >
                  <SignaturePad
                    value={getFieldValue('signatureDataUrl')}
                    locked={Boolean(getFieldValue('signatureLocked'))}
                    editing={Boolean(getFieldValue('signatureEditing'))}
                    className={contactSignatureValidationError ? 'inspection-start-visit__signature-pad--error' : undefined}
                    labels={{
                      clickToSign: t('inspection.execution.clickToSign'),
                      drawHint: t('inspection.execution.drawSignatureHere'),
                      undo: t('common.undo'),
                      clear: t('common.clear'),
                      save: t('inspection.common.save'),
                      clickToEdit: t('inspection.execution.clickToEdit'),
                    }}
                    onStartEditing={() => syncContactFormValues({ signatureEditing: true, signatureLocked: false })}
                    onValueChange={(signatureDataUrl, signatureLocked) => syncContactFormValues({
                      signatureDataUrl,
                      signatureImageFileName: '',
                      signatureImageFileUrl: '',
                      signatureLocked,
                      signatureEditing: !signatureLocked,
                    })}
                    onSave={handleSignatureSave}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  label={renderFormLabel(t('inspection.execution.declarationRefusalReason'))}
                  name="refusalReason"
                  className="inspection-start-visit__refusal-reason-form-item"
                >
                  <Input.TextArea
                    autoSize={{ minRows: 4 }}
                    maxLength={1000}
                    showCount
                    placeholder={t('inspection.execution.enterReason')}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>
      </Form>
    );
  };

  const renderReviewCard = (
    key: ReviewSectionKey,
    title: string,
    onEdit: () => void,
    children: React.ReactNode,
    showActions = true,
    sectionRef?: React.Ref<HTMLElement>,
    showEditAction = true,
  ) => (
    <section
      ref={sectionRef}
      className={`inspection-start-visit__review-card${reviewSectionOpen[key] ? ' inspection-start-visit__review-card--open' : ''}`}
    >
      <div className="inspection-start-visit__review-card-head">
        <DetailCardHeader
          title={title}
          open={reviewSectionOpen[key]}
          onToggle={() => setReviewSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
          showChevron={false}
          rootClassName="inspection-start-visit__review-card-title-button"
          rootPreviewClassName=""
          titleClassName="inspection-start-visit__review-card-title"
          actionsClassName="inspection-start-visit__review-card-title-actions"
        />
        {showActions ? (
          <div className="inspection-common-detail-card-header__actions inspection-start-visit__review-card-actions">
            {showEditAction ? (
              <Button
                type="text"
                className="inspection-start-visit__review-edit"
                aria-label={`${title} ${t('inspection.common.edit')}`}
                icon={<FigmaEditIcon />}
                onClick={onEdit}
              />
            ) : null}
            <Button
              type="text"
              className={`inspection-common-detail-card-header__chevron inspection-start-visit__review-toggle${reviewSectionOpen[key] ? ' is-open' : ''}`}
              aria-label={reviewSectionOpen[key] ? t('inspection.common.collapse') : t('inspection.common.expand')}
              onClick={() => setReviewSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
              icon={<FigmaChevronIcon />}
            />
          </div>
        ) : null}
      </div>
      {reviewSectionOpen[key] || key === 'contactPerson' ? (
        <div className="inspection-start-visit__review-card-body" hidden={!reviewSectionOpen[key]}>
          {children}
        </div>
      ) : null}
    </section>
  );

  const renderReview = () => {
    const violationRows = allChecklistItems
      .filter(({ item }) => normalizeChecklistResult(item.result) === 'VIOLATION')
      .flatMap(({ category, categoryIndex, item, itemIndex }) => {
        const selectedItemViolations = getChecklistItemSelectedViolations(item);
        const reviewSources = selectedItemViolations.length ? selectedItemViolations : [item];
        return reviewSources.map((violation, violationIndex) => {
          const violationDescription = getChecklistItemViolationDescriptionDisplay(violation) ||
            getChecklistItemViolationDescriptionDisplay(item) ||
            '-';
          const checklistName = getChecklistItemDisplayText(violation) || getChecklistItemDisplayText(item);
          return {
            key: `${getChecklistItemKey(item, categoryIndex, itemIndex)}-${getViolationKey(violation) || violationIndex}`,
            title: checklistName || violationDescription,
            violationReason: violationDescription,
            category: category.categoryName,
            notes: item.remarks || '-',
            attachments: ensureArray<InspectionAttachmentSource>(item.evidenceAttachments),
          };
        });
      });
    const renderReviewTableText = (value: any) => {
      const displayValue = value === undefined || value === null || value === '' ? '-' : String(value);
      const textNode = (
        <span className="inspection-start-visit__review-table-text">
          {displayValue}
        </span>
      );

      if (displayValue === '-') return textNode;

      return (
        <Tooltip
          title={displayValue}
          placement="topLeft"
          getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
        >
          {textNode}
        </Tooltip>
      );
    };
    const renderReviewTableTitle = (value: string) => (
      <span className="inspection-start-visit__review-table-title">
        {value}
      </span>
    );
    const seizedMaterialColumns = [
      {
        title: renderReviewTableTitle(t('inspection.execution.materialType')),
        dataIndex: 'materialType',
        key: 'materialType',
        width: 125,
        className: 'inspection-start-visit__review-table-material-type',
        render: (_: any, record: any) =>
          renderReviewTableText(
            getMaterialTypeLabelByValue(
              record.materialTypeCode || record.materialType || record.publicationType,
              { preserveUnknown: false },
            ) || '-',
          ),
      },
      {
        title: renderReviewTableTitle(t('inspection.execution.materialName')),
        dataIndex: 'title',
        key: 'title',
        width: 155,
        render: (value: any, record: any) => renderReviewTableText(value || record.materialName || record.name || '-'),
      },
      {
        title: renderReviewTableTitle(t('inspection.execution.isbn')),
        dataIndex: 'isbn',
        key: 'isbn',
        width: 140,
        render: (value: any) => renderReviewTableText(value || '-'),
      },
      {
        title: renderReviewTableTitle(t('inspection.ocr.author')),
        dataIndex: 'author',
        key: 'author',
        width: 135,
        render: (value: any) => renderReviewTableText(value || '-'),
      },
      {
        title: renderReviewTableTitle(t('inspection.ocr.language')),
        dataIndex: 'languageId',
        key: 'language',
        width: 90,
        render: (value: any) => renderReviewTableText(getLanguageLabelByValue(value) || '-'),
      },
      {
        title: renderReviewTableTitle(t('inspection.execution.numberOfCopy')),
        dataIndex: 'quantity',
        key: 'quantity',
        width: 120,
        render: (value: any, record: any) => renderReviewTableText(value || record.numberOfCopy || '-'),
      },
    ];
    const seizedMaterialRows = seizedMaterials.map((material, index) => ({
      ...material,
      reviewRowKey: getSeizedMaterialCardKey(material, index),
    }));

    return renderExecutionShell(
      <div className="inspection-start-visit__review-content-card">
        {renderReviewCard('checklist', t('inspection.execution.checklistResult'), () => goToStep('checklist'), (
          violationRows.length ? (
            <div className="inspection-start-visit__review-violation-list">
              {violationRows.map((violation, index) => {
                const isOpen = reviewChecklistItemOpen[violation.key] ?? index === 0;
                return (
                  <div className={`inspection-start-visit__review-violation-item${isOpen ? ' inspection-start-visit__review-violation-item--open' : ''}`} key={violation.key}>
                    <button
                      type="button"
                      className="inspection-start-visit__review-violation-head"
                      aria-expanded={isOpen}
                      onClick={() => setReviewChecklistItemOpen((prev) => ({ ...prev, [violation.key]: !isOpen }))}
                    >
                      <span className="inspection-start-visit__review-violation-title">{violation.title}</span>
                      <span className="inspection-start-visit__review-violation-tag">{t('inspection.execution.result.violation')}</span>
                      <FigmaChevronIcon className="inspection-start-visit__review-violation-chevron" />
                    </button>
                    {isOpen ? (
                      <div className="inspection-start-visit__review-violation-body">
                        <div className="inspection-start-visit__review-violation-reason">
                          <img className="inspection-start-visit__review-violation-reason-icon" src={inspectionFigmaAssets.checklist.alert} alt="" />
                          <strong>{violation.violationReason}</strong>
                        </div>
                        <div className="inspection-start-visit__review-violation-attachments">
                          <span className="inspection-start-visit__review-violation-label">{t('inspection.execution.attachments')}</span>
                          {violation.attachments.length ? (
                            <InspectionAttachmentGrid
                              attachments={violation.attachments}
                              className="inspection-start-visit__attachment-grid--review"
                            />
                          ) : (
                            <strong className="inspection-start-visit__review-violation-empty">-</strong>
                          )}
                        </div>
                        <div className="inspection-start-visit__review-violation-notes">
                          <span className="inspection-start-visit__review-violation-label">{t('inspection.execution.notes')}</span>
                          <p>{violation.notes}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('inspection.taskDetail.noViolationFound')} />
          )
        ))}
        {!isDigitalInspection ? renderReviewCard('seizedMaterials', t('inspection.execution.seizedMaterials'), () => goToStep('seizedMaterials'), (
          seizedMaterials.length ? (
            <Table
              rowKey="reviewRowKey"
              columns={seizedMaterialColumns}
              dataSource={seizedMaterialRows}
              pagination={false}
              size="middle"
              tableLayout="fixed"
              className="inspection-start-visit__review-table"
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('inspection.execution.seizedMaterialNotFound')} />
          )
        ), true, undefined, stepKeys.includes('seizedMaterials')) : null}
        {shouldRequireContactPerson ? renderReviewCard(
          'contactPerson',
          t('inspection.execution.contactPersonConfirmation'),
          scrollToContactConfirmation,
          renderContactConfirmation(),
          true,
          contactPersonConfirmationRef,
          false,
        ) : null}
      </div>,
    );
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigateToTasks();
      return;
    }

    const stepKey = stepKeys[currentStep];
    if (stepKey === 'review' && !shouldRequireContactPerson && !isDigitalInspection) {
      goToStep('checklist');
      return;
    }

    goToStep(stepKeys[Math.max(currentStep - 1, 0)] || 'targetAccess');
  };

  const renderFooter = () => {
    const stepKey = stepKeys[currentStep];
    return (
      <div className="inspection-start-visit__footer detail-action-footer">
        <Button
          className="inspection-start-visit__action inspection-start-visit__action--back"
          onClick={handleBack}
        >
          {t('inspection.common.back')}
        </Button>
        <div className="inspection-start-visit__footer-actions">
          {stepKey === 'targetAccess' && shouldShowTargetAccessDecisionActions ? (
            <>
              <Button
                className="inspection-start-visit__action inspection-start-visit__action--danger"
                loading={submitting && accessResult === 'unable_to_access'}
                onClick={handleAccessFailedAction}
              >
                {t('inspection.execution.unableToAccess')}
              </Button>
              <Button
                type="primary"
                className="inspection-start-visit__action inspection-start-visit__action--primary inspection-start-visit__action--with-icon"
                loading={submitting && accessResult === 'accessed_successfully'}
                icon={<img className="inspection-start-visit__action-icon inspection-start-visit__accessed-success-icon" src={accessedSuccessfullyActionIcon} alt="" />}
                onClick={handleAccessSuccessAction}
              >
                {t('inspection.execution.accessedSuccessfully')}
              </Button>
            </>
          ) : currentStep < stepKeys.length - 1 ? (
            <Button
              type="primary"
              className="inspection-start-visit__action inspection-start-visit__action--primary"
              loading={submitting}
              disabled={submitting}
              onClick={() => handleNext()}
            >
              {t('inspection.execution.nextStep')}
            </Button>
          ) : (
            <Button
              type="primary"
              className="inspection-start-visit__action inspection-start-visit__action--primary"
              loading={submitting}
              onClick={handleSubmit}
            >
              {t('inspection.execution.confirmAndSubmit')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const panes: Record<string, React.ReactNode> = {
    targetAccess: renderTargetAccess(),
    checklist: renderChecklist(),
    seizedMaterials: renderSeizedMaterials(),
    review: renderReview(),
  };

  return (
    <div
      className={`inspection-start-visit${targetOverviewExpanded ? '' : ' inspection-start-visit--with-footer'}`}
      dir={i18n.dir()}
    >
      <Spin spinning={loading}>
        {taskDetailsExpanded ? (
          <>
            <div ref={scrollContainerRef} className="inspection-start-visit__scroll">
              {!taskId && !taskNo ? <Alert type="warning" showIcon message={t('inspection.execution.taskMissing')} /> : null}
              {renderTaskDetailsFullScreen()}
            </div>
            {renderFooter()}
          </>
        ) : targetOverviewExpanded ? (
          <div ref={scrollContainerRef} className="inspection-start-visit__scroll">
            {renderTargetOverviewFullScreen()}
          </div>
        ) : (
          <>
            <div ref={scrollContainerRef} className="inspection-start-visit__scroll">
              {!taskId && !taskNo ? <Alert type="warning" showIcon message={t('inspection.execution.taskMissing')} /> : null}
              <div className="inspection-start-visit__panes">
                {stepKeys.map((step, index) => (
                  <div className={`inspection-start-visit__pane${currentStep === index ? ' inspection-start-visit__pane--active' : ''}`} key={step}>
                    {panes[step]}
                  </div>
                ))}
              </div>
            </div>
            {renderFooter()}
          </>
        )}
      </Spin>

      {isDigitalInspection || stepKeys[currentStep] !== 'review' ? (
        <Form form={contactForm} className="inspection-start-visit__form-bridge" />
      ) : null}
      {!reinspectionVisible ? <Form form={submitReportForm} className="inspection-start-visit__form-bridge" /> : null}
      <input
        ref={ocrUploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => { void handleOcrFileChange(event, 'upload'); }}
      />
      <input
        ref={ocrCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => { void handleOcrFileChange(event, 'camera'); }}
      />

      <UnableToAccessModal
        visible={accessFailedModalVisible}
        value={accessFailedModalValue}
        reasonOptions={accessReasonOptions}
        reasonOptionsLoading={inspectionLookupLoading}
        remarkRequired={selectedAccessReasonRemarkRequired}
        submitting={submitting}
        onChange={handleAccessFailedModalChange}
        onCancel={closeAccessFailedModal}
        onSubmit={handleAccessFailedModalSubmit}
      />

      <PreVisitChecklistModal
        visible={preVisitVisible}
        checkedKeys={preVisitChecked}
        loading={submitting}
        onCheckedKeysChange={setPreVisitChecked}
        onCancel={handlePreVisitCancel}
        onStart={handleStartVisit}
      />

      <FullViolationListModal
        visible={fullChecklistVisible}
        loading={fullViolationCatalogLoading}
        value={draftViolationKeys}
        saveDisabled={fullViolationSaveDisabled}
        disabledKeys={fullViolationDisabledCodes}
        groups={fullViolationGroups}
        onChange={handleFullChecklistChange}
        onCancel={closeFullViolationList}
        onSave={saveFullViolationList}
      />

      <SeizedMaterialsDecisionModal
        visible={seizedDecisionVisible}
        submittingDecision={seizedDecisionSubmitting}
        onDecision={handleSeizedDecision}
      />

      <OcrTypeModal
        visible={ocrTypeVisible}
        types={ocrTypes}
        variant={ocrFlow}
        loadingSource={ocrScanningSource}
        onCancel={() => {
          pendingOcrSelectionRef.current = null;
          setOcrTypeVisible(false);
        }}
        onSelect={handleOcrTypeSelect}
      />

      <OcrResultModal
      visible={ocrResultVisible}
      result={ocrResult}
      ocrType={ocrType}
      variant={ocrFlow}
      editSaving={ocrEditSaving}
      onEditSave={handleOcrEditSave}
      materialTypeOptions={materialTypeSelectOptions}
        materialTypeLoading={inspectionLookupLoading}
        defaultMaterialType={defaultOcrMaterialTypeValue}
        languageOptions={languageSelectOptions}
        languageLoading={inspectionLookupLoading}
        defaultLanguageValue={defaultOcrLanguageValue}
        onCancel={closeOcrResult}
        onResultChange={setOcrResult}
        onScanAnother={handleScanAnotherOcr}
        onSeizedMaterialSave={handleSeizedMaterialOcrSave}
      />

      <SubmitReportModal
        visible={reinspectionVisible}
        form={submitReportForm}
        submitting={submitting}
        needsReinspection={submitReportNeedsReinspection}
        onNeedsReinspectionChange={setSubmitReportNeedsReinspection}
        onCancel={() => {
          submitSuccessPendingAfterReportCloseRef.current = false;
          setReinspectionVisible(false);
          setPendingSubmitSummary(null);
        }}
        onAfterClose={handleSubmitReportAfterClose}
        onConfirm={handleConfirmSubmitReport}
      />

      <SubmitSuccessModal
        visible={submitSuccessVisible}
        submitting={submitting}
        isDigitalInspection={isDigitalInspection}
        onCancel={() => setSubmitSuccessVisible(false)}
        onCheckout={handleCheckoutClose}
      />
      <PreviewModal
        visible={declarationPreviewVisible}
        fileData={INSPECTION_DECLARATION_TEMPLATE_PREVIEW_FILE}
        onCancel={() => setDeclarationPreviewVisible(false)}
      />
    </div>
  );
};

export default InspectionStartVisitPage;
