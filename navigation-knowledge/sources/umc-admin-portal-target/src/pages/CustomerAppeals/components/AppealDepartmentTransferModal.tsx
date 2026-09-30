import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Form, Input, Modal, Tooltip, Upload } from "antd";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import type { RcFile } from "antd/es/upload";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import { getLocalizedText } from "@/pages/InspectionCommon/helpers";
import {
  getInspectionAppealViolationItems,
  type InspectionAppealViolationItemDto,
  type InspectionAppealViolationItemPenaltyStandardDto,
} from "@/services/inspectionAppeals";
import formatMoney from "@/utils/formatMoney";
import infoCircleIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_circle.svg";
import infoMarkIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_mark.svg";
import radioApproveIcon from "@/pages/CustomerRefunds/assets/icons/transfer_decision_approve.svg";
import radioApproveInactiveIcon from "@/pages/CustomerRefunds/assets/icons/transfer_decision_approve_inactive.svg";
import radioRejectActiveIcon from "@/pages/CustomerRefunds/assets/icons/transfer_decision_reject_active.svg";
import radioRejectIcon from "@/pages/CustomerRefunds/assets/icons/transfer_decision_reject.svg";
import uploadIconBase from "@/pages/CustomerRefunds/assets/icons/transfer_upload_base.svg";
import uploadIconMain from "@/pages/CustomerRefunds/assets/icons/transfer_upload_main.svg";
import type {
  AppealAttachment,
  AppealDepartmentDecision,
  AppealDepartmentProcessPayload,
  AppealProcessAdjustmentItem,
  AppealRecord,
  AppealSendBackPayload,
} from "../types";
import {
  getAppealDecisionTranslationKey,
} from "../utils";
import {
  APPEAL_ATTACHMENT_ACCEPT,
  APPEAL_ATTACHMENT_MAX_COUNT,
  getAppealAttachmentValidationError,
  useAppealAttachmentUploadLock,
  uploadAppealAttachmentFile,
} from "../upload";
import AppealAttachments from "./AppealAttachments";
import { AppealViolationAedIcon } from "./AppealViolationIcons";

type AppealDepartmentModalMode = "process" | "send_back";
type AppealProcessViewMode = "modify" | "cancel";
type FineDegreeValue = 1 | 2 | 3 | 4;
type WarningDegreeValue = number;
type FineStandardSource = InspectionAppealViolationItemPenaltyStandardDto & {
  contentPenaltyStandards?: FineStandardSource[];
  contentStandards?: FineStandardSource[];
};

interface AppealDepartmentTransferModalProps {
  visible: boolean;
  mode: AppealDepartmentModalMode;
  record?: AppealRecord | null;
  onCancel: () => void;
  onConfirm: (
    payload: AppealDepartmentProcessPayload | AppealSendBackPayload,
  ) => Promise<void> | void;
}

interface FineDegreeOption {
  value: FineDegreeValue;
  labelKey: string;
  amount?: number;
}

interface ProcessViolationItem {
  key: string;
  violationItemId?: number | string | null;
  violationItemCode?: string | null;
  title: string;
  violationTypeId?: number;
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  warningDegree?: WarningDegreeValue;
  displayWarningDegree?: WarningDegreeValue;
  initialDegree?: WarningDegreeValue;
  proposedViolationStatusId?: number | string | null;
  selectedByDefault: boolean;
  degreeOptions: FineDegreeOption[];
}

function isSelectableProcessViolationItem(item: ProcessViolationItem) {
  return item.warningDegree !== undefined || item.degreeOptions.length > 0;
}

function getSelectedViolationValidationState(
  items: ProcessViolationItem[],
  selectedDegrees: Record<string, FineDegreeValue>,
) {
  if (!items.length) {
    return {
      hasMissingDegree: false,
      hasUnavailableWarningStatus: false,
      hasMissingViolationCode: false,
      isInvalid: false,
    };
  }

  const hasMissingDegree = items.some((item) => {
    if (!item.degreeOptions.length) return item.warningDegree === undefined;

    const selectedDegree = selectedDegrees[item.key];
    const selectedOption = item.degreeOptions.find(
      (option) => option.value === selectedDegree,
    );

    return !selectedDegree || !selectedOption;
  });
  const hasUnavailableWarningStatus = items.some(
    (item) => !item.degreeOptions.length && item.warningDegree === undefined,
  );
  const hasMissingViolationCode = items.some(
    (item) => !normalizeText(item.violationItemCode),
  );

  return {
    hasMissingDegree,
    hasUnavailableWarningStatus,
    hasMissingViolationCode,
    isInvalid:
      hasMissingDegree || hasUnavailableWarningStatus || hasMissingViolationCode,
  };
}

const LICENSING_VIOLATION_TYPE_ID = 1;
const CONTENT_VIOLATION_TYPE_ID = 2;
const DEGREE_VALUES: FineDegreeValue[] = [1, 2, 3, 4];
const DEGREE_LABEL_KEYS: Record<FineDegreeValue, string> = {
  1: "Customer.customerAppeals.departmentModal.degree1",
  2: "Customer.customerAppeals.departmentModal.degree2",
  3: "Customer.customerAppeals.departmentModal.degree3",
  4: "Customer.customerAppeals.departmentModal.degree4",
};
const WARNING_LABEL_KEYS: Record<FineDegreeValue, string> = {
  1: "Customer.customerAppeals.departmentModal.warning1",
  2: "Customer.customerAppeals.departmentModal.warning2",
  3: "Customer.customerAppeals.departmentModal.warning3",
  4: "Customer.customerAppeals.departmentModal.warning4",
};

function AppealModalButton({
  children,
  variant = "solid",
  onClick,
  disabled,
  visualDisabled,
  ariaDisabled,
}: {
  children: React.ReactNode;
  variant?: "solid" | "outline" | "dangerOutline";
  onClick?: () => void;
  disabled?: boolean;
  visualDisabled?: boolean;
  ariaDisabled?: boolean;
}) {
  const variantClass = variant === "dangerOutline" ? "danger-outline" : variant;

  return (
    <button
      type="button"
      className={`appeal-modal-button appeal-modal-button--${variantClass} ${
        visualDisabled ? "appeal-modal-button--visual-disabled" : ""
      }`}
      aria-disabled={ariaDisabled}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function unwrapServiceData<T>(payload: unknown): T | null {
  if (!payload) return null;
  if (typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      return ((data as { data?: T | null }).data ?? null) as T | null;
    }
    return (data ?? null) as T | null;
  }
  return payload as T;
}

function normalizeText(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeNumber(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDegree(value: unknown): FineDegreeValue | undefined {
  const raw = normalizeText(value).toLowerCase();
  const numeric = normalizeNumber(raw.match(/\d+/)?.[0] ?? value);
  if (numeric && DEGREE_VALUES.includes(numeric as FineDegreeValue)) {
    return numeric as FineDegreeValue;
  }
  if (raw.includes("first")) return 1;
  if (raw.includes("second")) return 2;
  if (raw.includes("third")) return 3;
  if (raw.includes("fourth")) return 4;
  return undefined;
}

function normalizeWarningDegree(value: unknown): WarningDegreeValue | undefined {
  const raw = normalizeText(value).toLowerCase();
  const numeric = normalizeNumber(raw.match(/\d+/)?.[0] ?? value);
  if (numeric && numeric > 0) return Math.round(numeric);
  if (raw.includes("first")) return 1;
  if (raw.includes("second")) return 2;
  if (raw.includes("third")) return 3;
  if (raw.includes("fourth")) return 4;
  return undefined;
}

function formatOrdinal(value: WarningDegreeValue) {
  const rounded = Math.round(value);
  const remainder = rounded % 100;
  if (remainder >= 11 && remainder <= 13) return `${rounded}th`;

  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}

function resolveAppealViolationTypeId(record?: AppealRecord | null) {
  return normalizeNumber(record?.violationTypeId);
}

function isContentViolationTypeId(value: unknown) {
  return normalizeNumber(value) === CONTENT_VIOLATION_TYPE_ID;
}

function isLicensingViolationTypeId(value: unknown) {
  return normalizeNumber(value) === LICENSING_VIOLATION_TYPE_ID;
}

function getPositiveMoneyAmount(value: unknown) {
  const amount = normalizeNumber(value);
  return amount !== undefined && amount > 0 ? amount : undefined;
}



function getDegreeAmount(
  penalty: FineStandardSource | null | undefined,
  value: FineDegreeValue,
) {
  if (!penalty) return undefined;
  return normalizeNumber(
    penalty[`degree${value}FineAmount` as keyof FineStandardSource],
  );
}

function resolveDegreeByFineAmount(
  penalty: FineStandardSource | null | undefined,
  fineAmount: unknown,
): FineDegreeValue | undefined {
  const amount = normalizeNumber(fineAmount);
  if (amount === undefined) return undefined;

  return DEGREE_VALUES.find((value) => {
    const degreeAmount = getDegreeAmount(penalty, value);
    return (
      degreeAmount !== undefined &&
      Math.abs(degreeAmount - amount) < 0.01
    );
  });
}

function getAppealViolationLookupIds(
  appealId: AppealRecord["appealId"] | undefined,
) {
  return Array.from(
    new Set(
      [appealId]
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  );
}

function buildDegreeOptions(
  penalty?: FineStandardSource | null,
  includeMissingAmounts = false,
): FineDegreeOption[] {
  if (!penalty && !includeMissingAmounts) return [];

  return DEGREE_VALUES.map((value) => {
    const amount = getDegreeAmount(penalty, value);
    return {
      value,
      labelKey: DEGREE_LABEL_KEYS[value],
      amount,
    };
  }).filter(
    (option) => includeMissingAmounts || typeof option.amount === "number",
  );
}

function getViolationDescriptionTitle(
  record: Record<string, unknown> | null | undefined,
) {
  const source = record || {};
  const localizedDescription = getLocalizedText(
    (source.violationDescription || source.violationDescriptionEn) as string | undefined,
    source.violationDescriptionAr as string | undefined,
    "",
  );

  return normalizeText(
    localizedDescription,
    source.violationDescription,
  );
}

function buildAppealViolationProcessItems(
  items: InspectionAppealViolationItemDto[],
  appealViolationTypeId: number | undefined,
): ProcessViolationItem[] {
  return normalizeArray(items)
    .map((item, index) => {
      const violationTypeId =
        normalizeNumber(item.violationTypeId) ?? appealViolationTypeId;
      const shouldShowFineDegreeOptions =
        isContentViolationTypeId(violationTypeId);
      const shouldShowWarningStatus =
        isLicensingViolationTypeId(violationTypeId);
      const penalty = shouldShowFineDegreeOptions
        ? item.contentPenaltyStandard as FineStandardSource | null
        : null;
      const currentDegree =
        (shouldShowFineDegreeOptions
          ? normalizeDegree(item.newDegree) ??
            normalizeDegree(item.oldDegree) ??
            resolveDegreeByFineAmount(penalty, item.fineAmount)
          : shouldShowWarningStatus
            ? normalizeWarningDegree(item.newDegree) ??
              normalizeWarningDegree(item.oldDegree)
            : undefined);
      const displayWarningDegree = shouldShowWarningStatus
        ? normalizeWarningDegree(item.oldDegree)
        : currentDegree;
      const title =
        getViolationDescriptionTitle(item as unknown as Record<string, unknown>);
      const degreeOptions = buildDegreeOptions(
        penalty,
        shouldShowFineDegreeOptions,
      );

      return {
        sortOrder: index,
        item: {
          key:
            normalizeText(
              item.taskChecklistItemId,
              item.violationItemId,
              item.violationItemCode,
              item.checklistCode,
              item.id,
              index,
            ) || `appeal-violation-${index}`,
          violationItemId:
            item.violationItemId ??
            item.id ??
            item.taskChecklistItemId,
          violationItemCode:
            normalizeText(
              item.violationItemCode,
              item.checklistCode,
            ) || undefined,
          title,
          violationTypeId,
          fineAmount: item.fineAmount,
          beforeAppealAdjustedFineAmount: item.beforeAppealAdjustedFineAmount,
          warningDegree: currentDegree,
          displayWarningDegree,
          initialDegree: currentDegree,
          proposedViolationStatusId: undefined,
          selectedByDefault: false,
          degreeOptions,
        } satisfies ProcessViolationItem,
      };
    })
    .sort((current, next) => current.sortOrder - next.sortOrder)
    .map((entry) => entry.item);
}

function buildProcessItems(
  appealViolationItems: InspectionAppealViolationItemDto[],
  violationTypeId: number | undefined,
): ProcessViolationItem[] {
  return buildAppealViolationProcessItems(
    appealViolationItems,
    violationTypeId,
  );
}

function createInitialSelection(items: ProcessViolationItem[]) {
  const selectedKeys = items
    .filter((item) => item.selectedByDefault)
    .map((item) => item.key);
  const selectedDegrees: Record<string, FineDegreeValue> = {};

  items.forEach((item) => {
    if (!selectedKeys.includes(item.key)) return;
    const selectedDegree = item.initialDegree;
    if (item.degreeOptions.length && normalizeDegree(selectedDegree)) {
      selectedDegrees[item.key] = selectedDegree as FineDegreeValue;
    }
  });

  return { selectedKeys, selectedDegrees };
}

const AppealDepartmentTransferModal: React.FC<AppealDepartmentTransferModalProps> = ({
  visible,
  mode,
  record,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ notes: string }>();
  const [decision, setDecision] = useState<AppealDepartmentDecision | null>(null);
  const [processMode, setProcessMode] =
    useState<AppealProcessViewMode>("modify");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<AppealAttachment[]>([]);
  const [selectedViolationKeys, setSelectedViolationKeys] = useState<string[]>([]);
  const [selectedDegrees, setSelectedDegrees] = useState<
    Record<string, FineDegreeValue>
  >({});
  const [appealViolationItems, setAppealViolationItems] = useState<
    InspectionAppealViolationItemDto[]
  >([]);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadRevisionRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    attachmentUploading,
    isAttachmentUploading,
    reserveAttachmentUpload,
    releaseAttachmentUpload,
    resetAttachmentUploadLock,
  } = useAppealAttachmentUploadLock();
  const clearUploadProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);
  const isProcess = mode === "process";
  const isRejectRecommendation = isProcess && decision === "Reject";
  const isApprove = isProcess && decision === "Approve";
  const showExtended = !isProcess || Boolean(decision);
  const violationTypeId = resolveAppealViolationTypeId(record);
  const attachmentUploadDisabled =
    attachmentUploading || attachments.length >= APPEAL_ATTACHMENT_MAX_COUNT;

  const processItems = useMemo(
    () =>
      buildProcessItems(
        appealViolationItems,
        violationTypeId,
      ),
    [
      appealViolationItems,
      violationTypeId,
    ],
  );
  const processItemsSignature = processItems.map((item) => item.key).join("|");
  const selectedItems = processItems.filter((item) =>
    selectedViolationKeys.includes(item.key),
  );

  const resetProcessSelection = (items = processItems) => {
    const initial = createInitialSelection(items);
    setSelectedViolationKeys(initial.selectedKeys);
    setSelectedDegrees(initial.selectedDegrees);
  };

  const resetUserInputs = () => {
    uploadRevisionRef.current += 1;
    clearUploadProgressTimer();
    setUploadProgress(0);
    setNotes("");
    form.resetFields(["notes"]);
    setAttachments([]);
    resetAttachmentUploadLock();
    setValidationAttempted(false);
  };

  useEffect(() => {
    if (!visible) return;
    setDecision(null);
    setProcessMode("modify");
    uploadRevisionRef.current += 1;
    clearUploadProgressTimer();
    setUploadProgress(0);
    setNotes("");
    form.resetFields(["notes"]);
    setAttachments([]);
    resetAttachmentUploadLock();
    setValidationAttempted(false);
    setSelectedViolationKeys([]);
    setSelectedDegrees({});
  }, [
    visible,
    mode,
    form,
    clearUploadProgressTimer,
    resetAttachmentUploadLock,
  ]);
  useEffect(
    () => () => {
      clearUploadProgressTimer();
    },
    [clearUploadProgressTimer],
  );

  useEffect(() => {
    if (!visible || !isProcess) return;
    let cancelled = false;
    const appealLookupIds = getAppealViolationLookupIds(record?.appealId);

    setLoadingStandards(true);
    const loadItems = async () => {
      for (const appealId of appealLookupIds) {
        try {
          const appealItemsResponse = await getInspectionAppealViolationItems(
            appealId,
            { skipErrorMessage: true },
          );
          const appealItemsData =
            unwrapServiceData<{
              items?: InspectionAppealViolationItemDto[] | null;
            }>(appealItemsResponse);
          const nextAppealItems = normalizeArray(appealItemsData?.items);
          if (nextAppealItems.length) {
            if (!cancelled) {
              setAppealViolationItems(nextAppealItems);
            }
            return;
          }
        } catch {
          // Keep the process list empty when the confirmed appeal item endpoint is unavailable.
        }
      }

      if (!cancelled) {
        setAppealViolationItems([]);
      }
    };

    loadItems()
      .catch(() => {
        if (cancelled) return;
        setAppealViolationItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStandards(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    visible,
    isProcess,
    record?.appealId,
  ]);

  useEffect(() => {
    if (!visible || !isApprove) return;
    if (!processItems.length) {
      setSelectedViolationKeys([]);
      setSelectedDegrees({});
      return;
    }
    const initialSelection = createInitialSelection(processItems);
    setSelectedViolationKeys(initialSelection.selectedKeys);
    setSelectedDegrees(initialSelection.selectedDegrees);
  }, [visible, isApprove, processItems, processItemsSignature]);

  const beforeUpload = (file: RcFile) => {
    if (isAttachmentUploading()) {
      return Upload.LIST_IGNORE;
    }

    const validationError = getAppealAttachmentValidationError(file, attachments.length);
    if (validationError) {
      const messageKey = validationError === "format"
        ? "Customer.customerAppeals.messages.invalidUploadFormat"
        : validationError === "size"
          ? "Customer.customerAppeals.messages.fileSizeExceeds"
          : "Customer.customerAppeals.messages.uploadLimit";
      CustomMessage.error(t(messageKey));
      return Upload.LIST_IGNORE;
    }
    if (!reserveAttachmentUpload(file)) {
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    const uploadRevision = uploadRevisionRef.current;
    let currentProgress = 0;
    clearUploadProgressTimer();
    setUploadProgress(0);
    const timer = setInterval(() => {
      if (currentProgress < 80) {
        currentProgress = Math.min(currentProgress + 8, 80);
        setUploadProgress(currentProgress);
      }
      if (currentProgress >= 80) {
        clearInterval(timer);
        progressTimerRef.current = null;
      }
    }, 100);
    progressTimerRef.current = timer;
    try {
      const nextAttachment = await uploadAppealAttachmentFile(file);
      if (uploadRevision !== uploadRevisionRef.current) return;
      clearUploadProgressTimer();
      currentProgress = 80;
      setUploadProgress(currentProgress);
      const finalTimer = setInterval(() => {
        currentProgress = Math.min(currentProgress + 2, 100);
        setUploadProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(finalTimer);
          progressTimerRef.current = null;
        }
      }, 100);
      progressTimerRef.current = finalTimer;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (uploadRevision !== uploadRevisionRef.current) return;
      setAttachments((current) => [
        ...current,
        nextAttachment,
      ]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      if (uploadRevision !== uploadRevisionRef.current) return;
      clearUploadProgressTimer();
      setUploadProgress(0);
      CustomMessage.error(t("Customer.customerAppeals.messages.uploadFailed"));
      options.onError?.(error as Error);
    } finally {
      if (uploadRevision === uploadRevisionRef.current) {
        clearUploadProgressTimer();
        setUploadProgress(0);
        releaseAttachmentUpload(file);
      }
    }
  };

  const handleDecisionSelect = (nextDecision: AppealDepartmentDecision) => {
    if (decision !== nextDecision) {
      resetUserInputs();
    }
    setDecision(nextDecision);
    if (nextDecision === "Approve") {
      setProcessMode("modify");
      resetProcessSelection(processItems);
    }
  };

  const handleProcessModeSelect = (nextMode: AppealProcessViewMode) => {
    if (processMode !== nextMode) {
      resetUserInputs();
    }
    setProcessMode(nextMode);
  };

  const handleViolationCheck = (item: ProcessViolationItem, checked: boolean) => {
    if (checked && !isSelectableProcessViolationItem(item)) return;

    setSelectedViolationKeys((current) =>
      checked
        ? Array.from(new Set([...current, item.key]))
        : current.filter((key) => key !== item.key),
    );
    if (!checked) {
      setSelectedDegrees((current) => {
        const next = { ...current };
        delete next[item.key];
        return next;
      });
    } else if (item.degreeOptions.length && normalizeDegree(item.initialDegree)) {
      setSelectedDegrees((current) => ({
        ...current,
        [item.key]: item.initialDegree as FineDegreeValue,
      }));
    }
  };

  const buildModifyAdjustmentItems = (): AppealProcessAdjustmentItem[] =>
    selectedItems.map((item) => {
      const selectedDegree = item.degreeOptions.length
        ? selectedDegrees[item.key]
        : item.warningDegree;
      const option = item.degreeOptions.find(
        (degreeOption) => degreeOption.value === selectedDegree,
      );
      const processItem: AppealProcessAdjustmentItem = {
        violationItemId: item.violationItemId,
        violationItemCode: normalizeText(item.violationItemCode),
        isSelected: true,
        proposedDegree: selectedDegree ?? 0,
        notes: notes.trim(),
      };

      const proposedFineAmount = item.degreeOptions.length ? option?.amount : 0;
      if (typeof proposedFineAmount === "number") {
        processItem.proposedFineAmount = proposedFineAmount;
      }

      if (
        item.proposedViolationStatusId !== undefined &&
        item.proposedViolationStatusId !== null &&
        String(item.proposedViolationStatusId).trim() !== ""
      ) {
        processItem.proposedViolationStatusId = item.proposedViolationStatusId;
      }

      return processItem;
    });

  const resetFormState = () => {
    setDecision(null);
    setProcessMode("modify");
    resetUserInputs();
    setSelectedViolationKeys([]);
    setSelectedDegrees({});
  };

  const selectedViolationValidation = getSelectedViolationValidationState(
    selectedItems,
    selectedDegrees,
  );

  const hasInvalidSelectedViolationItems = () => {
    if (selectedViolationValidation.hasMissingViolationCode) {
      CustomMessage.error(
        t("Customer.customerAppeals.departmentModal.adjustedViolationDataUnavailable"),
      );
      return true;
    }

    return selectedViolationValidation.isInvalid;
  };

  const submitDepartmentPayload = async (
    payload?: Pick<
      AppealDepartmentProcessPayload,
      "processMode" | "adjustmentItems"
    >,
  ) => {
    await onConfirm({
      decision: decision || "Approve",
      notes: notes.trim(),
      attachments,
      processMode: payload?.processMode,
      adjustmentItems: payload?.adjustmentItems,
    });
  };

  const handleConfirm = async () => {
    if (isProcess && !decision) return;
    if (
      isApprove &&
      processMode === "modify" &&
      hasInvalidSelectedViolationItems()
    ) {
      return;
    }

    setSubmitting(true);
    try {
      if (isProcess) {
        await submitDepartmentPayload(
          decision === "Approve" && processMode === "modify"
            ? {
                processMode: "modify",
                adjustmentItems: buildModifyAdjustmentItems(),
              }
            : undefined,
        );
      } else {
        await onConfirm({
          notes: notes.trim(),
          attachments,
        });
      }
      resetFormState();
    } finally {
      setSubmitting(false);
    }
  };
  const handleCancelViolationConfirm = async () => {
    if (!isApprove) return;

    setSubmitting(true);
    try {
      await submitDepartmentPayload({ processMode: "cancel" });
      resetFormState();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetFormState();
    onCancel();
  };

  const handleUploadTriggerClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!attachmentUploadDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    CustomMessage.error(t("Customer.customerAppeals.messages.uploadLimit"));
  };

  const hasProcessNote = Boolean(notes.trim());
  const hasMissingDecision = isProcess && !decision;
  const canSubmitReviewDecision =
    !submitting && !attachmentUploading && hasProcessNote && !selectedViolationValidation.isInvalid;
  const canCancelViolation = !submitting && !attachmentUploading && hasProcessNote;
  const canSubmit = (() => {
    if (submitting || attachmentUploading) return false;
    if (!isProcess) return hasProcessNote;
    if (!decision) return false;
    if (decision === "Reject") return hasProcessNote;
    return processMode === "cancel"
      ? canCancelViolation
      : canSubmitReviewDecision;
  })();
  const confirmButtonInactive = isProcess && !canSubmit && !submitting;
  const showDecisionError = validationAttempted && hasMissingDecision;

  const handleFooterConfirm = () => {
    form
      .validateFields(["notes"])
      .then(() => {
        if (!canSubmit) {
          setValidationAttempted(true);
          return;
        }
        const confirmHandler =
          isApprove && processMode === "cancel"
            ? handleCancelViolationConfirm
            : handleConfirm;
        confirmHandler();
      })
      .catch(() => {
        setValidationAttempted(true);
      });
  };

  const renderDecisionSelector = (
    labelKey:
      | "Customer.customerAppeals.departmentModal.decision"
      | "Customer.customerAppeals.departmentModal.recommendation" =
      "Customer.customerAppeals.departmentModal.decision",
  ) => (
    <div className="appeal-transfer-field appeal-transfer-field-decision">
      <div className="appeal-transfer-label is-required">
        {t(labelKey)}
      </div>
      <div className="appeal-transfer-decision-group">
        {(["Approve", "Reject"] as AppealDepartmentDecision[]).map((item) => {
          const active = decision === item;
          return (
            <button
              key={item}
              type="button"
              className={`appeal-transfer-decision-option ${
                active ? "is-active" : ""
              }`}
              onClick={() => handleDecisionSelect(item)}
            >
              <img
                src={
                  item === "Approve"
                    ? active
                      ? radioApproveIcon
                      : radioApproveInactiveIcon
                    : active
                      ? radioRejectActiveIcon
                      : radioRejectIcon
                }
                alt=""
                className="appeal-transfer-decision-icon"
              />
              <span>
                {(() => {
                  const decisionKey = getAppealDecisionTranslationKey(item);
                  return decisionKey
                    ? t(decisionKey, { defaultValue: item })
                    : item;
                })()}
              </span>
            </button>
          );
        })}
      </div>
      {showDecisionError ? (
        <div className="appeal-transfer-validation-error">
          {t("Customer.customerAppeals.messages.fieldRequired")}
        </div>
      ) : null}
    </div>
  );

  const renderAttachmentsField = () => (
    <div className="appeal-transfer-field">
      <div className="appeal-transfer-label">
        <span>{t("Customer.customerAppeals.departmentModal.attachments")}</span>
        <Tooltip title={t("Customer.customerAppeals.departmentModal.uploadTip")}>
          <span className="appeal-field-info-icon">
            <img
              src={infoCircleIcon}
              alt=""
              className="appeal-field-info-circle"
            />
            <img
              src={infoMarkIcon}
              alt=""
              className="appeal-field-info-mark"
            />
          </span>
        </Tooltip>
      </div>
      <Upload
        showUploadList={false}
        beforeUpload={beforeUpload}
        customRequest={handleUpload}
        accept={APPEAL_ATTACHMENT_ACCEPT}
        disabled={attachmentUploadDisabled}
        maxCount={APPEAL_ATTACHMENT_MAX_COUNT}
        openFileDialogOnClick={!attachmentUploadDisabled}
      >
        <div className="appeal-upload-progress-wrap">
          <div
            className={`appeal-upload-button is-figma appeal-transfer-upload ${
              attachmentUploadDisabled ? "is-disabled" : ""
            }`}
            aria-disabled={attachmentUploadDisabled}
            onClick={handleUploadTriggerClick}
          >
            <span className="appeal-upload-icon appeal-transfer-upload-icon">
              <img
                src={uploadIconBase}
                alt=""
                className="appeal-upload-icon-layer is-base"
              />
              <img
                src={uploadIconMain}
                alt=""
                className="appeal-upload-icon-layer is-main"
              />
            </span>
            <span>{t("Customer.customerAppeals.actions.uploadFile")}</span>
          </div>
          {attachmentUploading ? (
            <div className="appeal-upload-progress">
              <div
                className="appeal-upload-progress__bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
        </div>
      </Upload>
      <AppealAttachments
        attachments={attachments}
        onDelete={(id) =>
          setAttachments((current) =>
            current.filter((attachment) => attachment.id !== id),
          )
        }
        compact
        variant="decision"
      />
    </div>
  );

  const renderNotesField = (
    required = isProcess,
    labelKey = "Customer.customerAppeals.departmentModal.notes",
    placeholderKey = "Customer.customerAppeals.departmentModal.enterNotes",
  ) => (
    <div className="appeal-transfer-field appeal-transfer-notes-field appeal-department-process__notes-field">
      <div className={`appeal-transfer-label ${required ? "is-required" : ""}`}>
        {t(labelKey)}
      </div>
      <Form.Item
        name="notes"
        rules={[
          {
            validator: (_, value) =>
              !required || String(value || "").trim()
                ? Promise.resolve()
                : Promise.reject(
                    new Error(t("Customer.customerAppeals.messages.fieldRequired")),
                  ),
          },
        ]}
        className="appeal-transfer-notes-form-item"
      >
        <Input.TextArea
          className="appeal-transfer-textarea"
          placeholder={t(placeholderKey)}
          maxLength={1000}
          showCount
          autoSize={{ minRows: 4, maxRows: 8 }}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Form.Item>
    </div>
  );

  const renderViolationStatus = (
    item: ProcessViolationItem,
    checked: boolean,
  ) => {
    if (!item.degreeOptions.length) {
      const adjustedFineAmount = getPositiveMoneyAmount(
        item.beforeAppealAdjustedFineAmount,
      );
      if (
        isLicensingViolationTypeId(item.violationTypeId) &&
        adjustedFineAmount !== undefined
      ) {
        return (
          <span className="appeal-department-process__violation-status appeal-department-process__violation-status--amount">
            <AppealViolationAedIcon
              className="appeal-department-process__status-aed"
              aria-hidden="true"
            />
            <span>{formatMoney(adjustedFineAmount)}</span>
          </span>
        );
      }

      const warningDisplayDegree = item.displayWarningDegree;
      const warningLabelKey =
        warningDisplayDegree !== undefined
          ? WARNING_LABEL_KEYS[warningDisplayDegree as FineDegreeValue]
          : undefined;
      const warningLabel =
        warningDisplayDegree !== undefined
          ? warningLabelKey
            ? t(warningLabelKey)
            : String(
                t("Customer.customerAppeals.departmentModal.warningStatusLabel"),
              ).replace("{{count}}", formatOrdinal(warningDisplayDegree))
          : "";

      return (
        <span
          className={`appeal-department-process__violation-status ${
            warningLabel
              ? "appeal-department-process__violation-status--warning"
              : "appeal-department-process__violation-status--unavailable"
          }`}
        >
          {warningLabel ||
            t(
              "Customer.customerAppeals.departmentModal.fineStandardModificationUnavailable",
            )}
        </span>
      );
    }

    const selectedDegree = selectedDegrees[item.key];
    const selectedOption = item.degreeOptions.find(
      (option) => option.value === selectedDegree,
    );

    const hasAmount = typeof selectedOption?.amount === "number";

    if (selectedOption) {
      return (
        <span className="appeal-department-process__violation-status appeal-department-process__violation-status--selected">
          <span>
            {t("Customer.customerAppeals.departmentModal.degreeStatusLabel", {
              degree: selectedOption.value,
            })}
          </span>
          {hasAmount ? (
            <>
              <AppealViolationAedIcon
                className="appeal-department-process__status-aed"
                aria-hidden="true"
              />
              <span>{formatMoney(selectedOption.amount)}</span>
            </>
          ) : null}
        </span>
      );
    }

    return (
      <span
        className={`appeal-department-process__violation-status ${
          checked
            ? "appeal-department-process__violation-status--pending"
            : "appeal-department-process__violation-status--hidden"
        }`}
      >
        {checked
          ? t("Customer.customerAppeals.departmentModal.selectDegree")
          : "\u00A0"}
      </span>
    );
  };

  const renderDegreeOptions = (item: ProcessViolationItem) => {
    const selectedDegree = selectedDegrees[item.key];

    return (
      <div className="appeal-department-process__degree-grid">
        {item.degreeOptions.map((option) => {
          const active = selectedDegree === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`appeal-department-process__degree-card ${
                active
                  ? "appeal-department-process__degree-card--selected"
                  : ""
              }`}
              onClick={() =>
                setSelectedDegrees((current) => ({
                  ...current,
                  [item.key]: option.value,
                }))
              }
            >
              <span className="appeal-department-process__degree-label">
                {t(option.labelKey)}
              </span>
              {typeof option.amount === "number" ? (
                <span className="appeal-department-process__degree-amount">
                  <AppealViolationAedIcon
                    className="appeal-department-process__degree-aed"
                    aria-hidden="true"
                  />
                  {formatMoney(option.amount)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  };

  const renderProcessViolationCard = (item: ProcessViolationItem) => {
    const selectable = isSelectableProcessViolationItem(item);
    const checked = selectedViolationKeys.includes(item.key);
    const expanded = checked && item.degreeOptions.length > 0;
    const showDegreeError =
      validationAttempted &&
      checked &&
      item.degreeOptions.length > 0 &&
      !selectedDegrees[item.key];

    return (
      <div
        key={item.key}
        className={`appeal-department-process__violation-card ${
          expanded ? "appeal-department-process__violation-card--expanded" : ""
        } ${showDegreeError ? "appeal-department-process__violation-card--error" : ""} ${
          !selectable ? "appeal-department-process__violation-card--disabled" : ""
        }`}
      >
        <div className="appeal-department-process__violation-header">
          <label
            className={`appeal-department-process__violation-left ${
              !selectable ? "is-disabled" : ""
            }`}
          >
            <Checkbox
              checked={checked}
              disabled={!selectable}
              onChange={(event) =>
                handleViolationCheck(item, event.target.checked)
              }
            />
            <span className="appeal-department-process__violation-title">
              {item.title || "-"}
            </span>
          </label>
          {renderViolationStatus(item, checked)}
        </div>
        {expanded ? renderDegreeOptions(item) : null}
        {showDegreeError ? (
          <div className="appeal-department-process__validation-message">
            {t("Customer.customerAppeals.departmentModal.selectDegree")}
          </div>
        ) : null}
      </div>
    );
  };

  const renderProcessAlert = (messageKey: string) => (
    <div className="appeal-department-process__alert">
      <span className="appeal-department-process__alert-icon">!</span>
      <span>{t(messageKey)}</span>
    </div>
  );

  const renderApproveModeToolbar = () => (
    <div className="appeal-department-process__mode-toolbar">
      <div className="appeal-department-process__mode-options">
        {(["modify", "cancel"] as AppealProcessViewMode[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`appeal-department-process__mode-button ${
              processMode === item
                ? "appeal-department-process__mode-button--active"
                : ""
            }`}
            onClick={() => handleProcessModeSelect(item)}
          >
            {t(
              item === "modify"
                ? "Customer.customerAppeals.departmentModal.modifyViolation"
                : "Customer.customerAppeals.departmentModal.cancelViolation",
            )}
          </button>
        ))}
      </div>
      {processMode === "modify" ? (
        <button
          type="button"
          className="appeal-department-process__reset-button"
          onClick={() => resetProcessSelection(processItems)}
          disabled={submitting || loadingStandards}
        >
          {t("Customer.customerAppeals.departmentModal.reset")}
        </button>
      ) : null}
    </div>
  );

  const renderApproveModifyProcess = () => (
    <>
      <div className="appeal-department-process__section-divider" />
      <div className="appeal-department-process__approval-section">
        {renderApproveModeToolbar()}
        {renderProcessAlert(
          "Customer.customerAppeals.departmentModal.modifyAlert",
        )}
      </div>
      {loadingStandards ? (
        <div className="appeal-department-process__loading">
          {t("Customer.customerAppeals.departmentModal.loadingStandards")}
        </div>
      ) : processItems.length ? (
        <div className="appeal-department-process__violation-list">
          {processItems.map(renderProcessViolationCard)}
        </div>
      ) : (
        <div className="appeal-department-process__loading">
          {t("Customer.customerAppeals.departmentModal.noViolationItems")}
        </div>
      )}
      {renderAttachmentsField()}
      {renderNotesField(true, "Customer.customerAppeals.departmentModal.note")}
    </>
  );

  const renderApproveCancelProcess = () => (
    <>
      <div className="appeal-department-process__section-divider" />
      <div className="appeal-department-process__approval-section">
        {renderApproveModeToolbar()}
        {renderProcessAlert(
          record?.hasPaidFine
            ? "Customer.customerAppeals.departmentModal.paidCancelAlert"
            : "Customer.customerAppeals.departmentModal.unpaidCancelAlert",
        )}
      </div>
      {renderAttachmentsField()}
      {renderNotesField(true, "Customer.customerAppeals.departmentModal.note")}
    </>
  );

  const getModalTitle = () => {
    if (!isProcess) {
      return t("Customer.customerAppeals.departmentModal.sendBackTitle");
    }
    return t("Customer.customerAppeals.departmentModal.processTitle");
  };

  const renderFooter = () => {
    return (
      <div className="appeal-modal-footer">
        <AppealModalButton variant="outline" onClick={handleCancel}>
          {t("common.cancel")}
        </AppealModalButton>
        <AppealModalButton
          disabled={submitting}
          visualDisabled={confirmButtonInactive}
          onClick={handleFooterConfirm}
        >
          {submitting ? t("common.loading") : t("common.confirm")}
        </AppealModalButton>
      </div>
    );
  };

  return (
    <Modal
      visible={visible}
      title={getModalTitle()}
      onCancel={handleCancel}
      footer={renderFooter()}
      width={
        isProcess
          ? 960
          : 800
      }
      centered
      destroyOnClose
      className={`appeal-action-modal appeal-transfer-modal ${
        isProcess ? "is-process" : "is-send-back"
      } ${showExtended ? "is-complex" : "is-simple"} ${
        isProcess && decision
          ? "appeal-transfer-modal--process-active"
          : ""
      } ${
        isProcess && !decision
          ? "appeal-transfer-modal--process-initial"
          : ""
      }`}
    >
      <Form
        form={form}
        className={`appeal-department-form appeal-department-process ${
          isApprove
            ? `appeal-department-process--${processMode}`
            : ""
        }`}
      >
        {isProcess
          ? renderDecisionSelector(
              isRejectRecommendation
                ? "Customer.customerAppeals.departmentModal.recommendation"
                : "Customer.customerAppeals.departmentModal.decision",
            )
          : null}

        {isRejectRecommendation ? (
          <>
            <div className="appeal-department-process__section-divider" />
            {renderAttachmentsField()}
            {renderNotesField(
              true,
              "Customer.customerAppeals.departmentModal.notes",
            )}
          </>
        ) : null}

        {isApprove
          ? processMode === "cancel"
            ? renderApproveCancelProcess()
            : renderApproveModifyProcess()
          : null}

        {!isProcess && showExtended ? (
          <>
            {renderAttachmentsField()}
            {renderNotesField(true)}
          </>
        ) : null}
      </Form>
    </Modal>
  );
};

export default AppealDepartmentTransferModal;
