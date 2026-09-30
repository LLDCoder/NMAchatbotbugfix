/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { nowGst, toApi } from "@/utils/gstTime";
import type { FormInstance } from "antd";
import { CustomMessage } from "@/components/common";
import {
  buildContactNumberFields,
  readContactFormValue,
} from "@/components/common/MobileNumberInput";
import { sanitizeInspectionMobileValue } from "@/utils/inspectionMobileValidation";
import {
  type InspectionPriorityLookupOption,
  type InspectionReasonLookupOption,
  type InspectionTaskAttachmentPayload,
  validateInspectionTask,
} from "@/services/inspection";
import {
  createInspectionTeamManagementTask,
  editInspectionTeamManagementTask,
} from "@/services/inspectionTeamManagement";
import { normalizeInspectorIds } from "@/pages/InspectionTaskManagement/components/inspectorSelectUtils";
import type { InspectorSelectOption } from "@/pages/InspectionTaskManagement/components/InspectorSelect";
import {
  getEmirateId,
  isEstablishmentSubtypeWithoutLicenseId,
  type TargetType,
} from "@/pages/InspectionTaskManagement/taskConfig";
import type {
  CampaignActivitySelectOption,
  InspectionTaskDuplicateWarningState,
  InspectionTaskModalMeta,
  InspectionTaskModalMode,
  InspectionTaskModalRecord,
} from "../type";
import {
  criticalContentViolationReasonKey,
  findPriorityOption,
  findReasonOption,
  getPriorityLabel,
  getReasonLabel,
  normalizeLookupKey,
  toNumberOrUndefined,
} from "../utils/lookup";
import {
  getInspectionTaskMobileSnapshot,
  hasValidationWarnings,
  inspectionTaskMobileFieldNames,
} from "../utils/target";

interface NumberSelectOption {
  value: number;
  label: string;
}

interface UseInspectionTaskSubmitParams {
  form: FormInstance;
  mode: InspectionTaskModalMode;
  editingTask?: InspectionTaskModalRecord | null;
  detailLoading: boolean;
  attachmentUploading: boolean;
  isCampaignReason: boolean;
  isInspectorSelfCreate: boolean;
  currentInspectorId: string;
  inspectorSubmitLookupOptions: InspectorSelectOption[];
  reasonLookupOptions: InspectionReasonLookupOption[];
  priorityLookupOptions: InspectionPriorityLookupOption[];
  campaignActivityOptions: CampaignActivitySelectOption[];
  campaignAuthoritySelectOptions: NumberSelectOption[];
  campaignEmirateSelectOptions: NumberSelectOption[];
  taskAttachments: InspectionTaskAttachmentPayload[];
  taskModalMeta: InspectionTaskModalMeta;
  syncedVisible: { value: boolean };
  getTaskSubmitEnabled: (meta: InspectionTaskModalMeta) => boolean;
  setDuplicateTaskWarning: Dispatch<
    SetStateAction<InspectionTaskDuplicateWarningState>
  >;
  onSubmitted: () => void | Promise<void>;
  t: (key: string) => string;
}

const useInspectionTaskSubmit = ({
  form,
  mode,
  editingTask,
  detailLoading,
  attachmentUploading,
  isCampaignReason,
  isInspectorSelfCreate,
  currentInspectorId,
  inspectorSubmitLookupOptions,
  reasonLookupOptions,
  priorityLookupOptions,
  campaignActivityOptions,
  campaignAuthoritySelectOptions,
  campaignEmirateSelectOptions,
  taskAttachments,
  taskModalMeta,
  syncedVisible,
  getTaskSubmitEnabled,
  setDuplicateTaskWarning,
  onSubmitted,
  t,
}: UseInspectionTaskSubmitParams) =>
  useCallback(async () => {
    if (detailLoading) {
      return;
    }

    if (attachmentUploading) {
      CustomMessage.warning(t("inspection.execution.messages.uploadInProgress"));
      return;
    }

    try {
      const validatedValues = await form.validateFields();
      if (!getTaskSubmitEnabled(taskModalMeta)) {
        return;
      }
      const values = {
        ...form.getFieldsValue(true),
        ...validatedValues,
      };
      // Project time contract: submit Dubai wall-clock without Z/offset.
      const dueDateValue =
        (values.dueDate ? toApi(values.dueDate) : undefined) ||
        toApi(nowGst().add(5, "days"));
      const selectedReasonCode = values.inspectionReasonCode;
      const currentReasonOption = findReasonOption(
        reasonLookupOptions,
        selectedReasonCode,
      );
      const selectedReasonName = getReasonLabel(currentReasonOption);
      const selectedReasonNameEn = currentReasonOption?.nameEn || selectedReasonName;
      const selectedReasonNameAr = currentReasonOption?.nameAr;
      const selectedPriorityCode = values.priorityCode;
      const currentPriorityOption = findPriorityOption(
        priorityLookupOptions,
        selectedPriorityCode,
      );
      const selectedPriorityId = toNumberOrUndefined(
        currentPriorityOption?.code ?? selectedPriorityCode,
      );
      const selectedPriorityName =
        getPriorityLabel(currentPriorityOption) || String(selectedPriorityCode || "");
      const selectedPriorityNameEn =
        currentPriorityOption?.nameEn || selectedPriorityName;
      const selectedPriorityNameAr = currentPriorityOption?.nameAr;
      const isLowPriority =
        normalizeLookupKey(selectedPriorityNameEn) === "low" ||
        String(selectedPriorityCode) === "4";
      const isCriticalContentReason =
        currentReasonOption?.code === "CriticalContentViolation" ||
        normalizeLookupKey(selectedReasonNameEn) === criticalContentViolationReasonKey;

      if (mode === "create" && isCampaignReason) {
        const activityIds = Array.from(
          new Set(
            (Array.isArray(values.activityIds)
              ? values.activityIds
              : [values.activityIds]
            )
              .map(toNumberOrUndefined)
              .filter(
                (activityId: number | undefined): activityId is number =>
                  activityId !== undefined,
              ),
          ),
        );
        const selectedEmirateId = toNumberOrUndefined(values.emirateId);
        const selectedAuthorityId = toNumberOrUndefined(values.authorityId);
        if (
          !activityIds.length ||
          selectedEmirateId === undefined ||
          selectedAuthorityId === undefined
        ) {
          CustomMessage.error(t("request.parameter.error"));
          return;
        }
        const selectedEmirateLabel =
          campaignEmirateSelectOptions.find(
            (item) => item.value === selectedEmirateId,
          )?.label || String(values.emirateId || "");
        const selectedAuthorityLabel =
          campaignAuthoritySelectOptions.find(
            (item) => item.value === selectedAuthorityId,
          )?.label || String(values.authorityId || "");

        for (const activityId of activityIds) {
          const activityLabel =
            campaignActivityOptions.find((item) => item.value === activityId)?.label ||
            String(activityId);
          const campaignTargetName = [
            selectedEmirateLabel,
            activityLabel,
            "Campaign",
          ]
            .filter(Boolean)
            .join(" ");
          const campaignPayload = {
            description: values.description,
            taskName: selectedReasonNameEn,
            taskSource: {
              sourceTypeId: 2,
              sourceTypeCode: "MANUAL",
              sourceTypeNameEn: "Inspection Campaign",
            },
            inspectionTarget: {
              targetType: 3,
              targetTypeName: "Campaign",
              establishmentNameEn: campaignTargetName,
              fullName: campaignTargetName,
              economicActivityId: activityId,
              economicActivityName: activityLabel,
              address: {
                emirateId: selectedEmirateId,
                emirateNameEn: selectedEmirateLabel,
                authorityId: selectedAuthorityId,
                authorityNameEn: selectedAuthorityLabel,
                street: selectedAuthorityLabel,
              },
            },
            riskProfile: {
              riskScore: 76,
              riskLevel: isCriticalContentReason
                ? "CRITICAL"
                : isLowPriority
                  ? "LOW"
                  : "HIGH",
              riskLevelName: `${selectedPriorityNameEn || "High"} Risk`,
            },
            inspectionConfig: {
              inspectionTypeId: 1,
              inspectionTypeNameEn: "Field Inspection",
              inspectionReasonId: selectedReasonCode,
              inspectionReasonCode: selectedReasonCode,
              inspectionReasonNameEn: selectedReasonNameEn,
              inspectionReasonNameAr: selectedReasonNameAr,
              isDigitalVisit: false,
              priorityId: selectedPriorityId,
              priorityCode: selectedPriorityCode,
              priorityNameEn: selectedPriorityNameEn,
              priorityNameAr: selectedPriorityNameAr,
              dueDate: dueDateValue,
            },
            assignment: {
              isAssigned: false,
              assignedInspectors: [],
            },
            attachments: taskAttachments,
          };
          await createInspectionTeamManagementTask(campaignPayload as any);
        }
        CustomMessage.success(t("inspection.tasks.messages.campaignGenerated"));
        syncedVisible.value = false;
        await onSubmitted();
        return;
      }

      const selectedInspectorIds = isInspectorSelfCreate
        ? [currentInspectorId]
        : normalizeInspectorIds(values.assignedInspector);
      const selectedInspectors = selectedInspectorIds.map((inspectorId) => {
        const option = inspectorSubmitLookupOptions.find(
          (item) => item.id === inspectorId,
        );
        return option || { id: inspectorId, name: inspectorId };
      });
      const submitTargetType = values.targetType as TargetType;
      const selectedSearchTarget =
        taskModalMeta.selectedTarget?.targetType === submitTargetType
          ? taskModalMeta.selectedTarget
          : null;
      const autoMatchedSearchTarget =
        taskModalMeta.autoMatchedTarget?.targetType === submitTargetType
          ? taskModalMeta.autoMatchedTarget
          : null;
      const searchPayload = ((selectedSearchTarget || autoMatchedSearchTarget)
        ?.payload || {}) as Record<string, any>;
      const activityNameEn = values.activityNameEn || searchPayload.activityNameEn;
      const economicActivityName = Array.isArray(activityNameEn)
        ? activityNameEn.join(", ")
        : activityNameEn;
      const submitEstablishmentSubtypeId =
        values.establishmentSubTypeId || searchPayload.establishmentSubTypeId;
      const isSubmitLicenseExemptSubtype =
        submitTargetType === "establishment" &&
        isEstablishmentSubtypeWithoutLicenseId(submitEstablishmentSubtypeId);
      const establishmentAddress = {
        emirateId:
          toNumberOrUndefined(values.emirateId) ||
          (values.emirateNameEn ? getEmirateId(values.emirateNameEn) : undefined),
        emirateNameEn: values.emirateNameEn,
        authorityId: isSubmitLicenseExemptSubtype
          ? undefined
          : toNumberOrUndefined(values.authorityId),
        authorityNameEn: isSubmitLicenseExemptSubtype
          ? undefined
          : values.authorityNameEn,
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
      const mobileFields = submitTargetType === "individual"
        ? buildContactNumberFields({
            value: readContactFormValue(
              values.mobileNumber,
              inspectionTaskMobileFieldNames,
            ),
            initial: getInspectionTaskMobileSnapshot(values.mobileNumber),
            keys: {
              fullNumber: "mobile",
              countryCode: "mobileCountryCode",
              localNumber: "mobileLocalNumber",
            },
          })
        : null;
      const establishmentMobileNumber = sanitizeInspectionMobileValue(
        values.mobileNumber,
      );
      const searchEstablishmentMobileNumber = sanitizeInspectionMobileValue(
        searchPayload.mobileNumber,
      );
      const baseInspectionTarget =
        submitTargetType === "establishment"
          ? {
              targetType: 1,
              targetTypeName:
                values.establishmentSubType ||
                searchPayload.establishmentSubType ||
                "Commercial",
              establishmentId: toNumberOrUndefined(values.establishmentId),
              userProfileId: toNumberOrUndefined(values.userProfileId),
              hasRegisteredProfile: values.hasRegisteredProfile,
              establishmentSubTypeId: toNumberOrUndefined(
                values.establishmentSubTypeId,
              ),
              establishmentSubType:
                values.establishmentSubType || searchPayload.establishmentSubType,
              establishmentNameEn: values.establishmentNameEn,
              licenseNumber: isSubmitLicenseExemptSubtype
                ? undefined
                : values.tradeLicenseNumber,
              email: values.email || searchPayload.email,
              mobile:
                establishmentMobileNumber || searchEstablishmentMobileNumber,
              economicActivityName,
              address: establishmentAddress,
            }
          : {
              targetType: 2,
              targetTypeName: "Individual",
              individualId: toNumberOrUndefined(values.individualId),
              userProfileId: toNumberOrUndefined(values.userProfileId),
              hasRegisteredProfile: values.hasRegisteredProfile,
              establishmentNameEn: values.fullName,
              fullName: values.fullName,
              emiratesId: values.eid,
              email: values.email,
              mobile: mobileFields?.mobile || "",
              mobileCountryCode: mobileFields?.mobileCountryCode || "",
              mobileLocalNumber: mobileFields?.mobileLocalNumber || "",
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
          sourceTypeCode: "MANUAL",
          sourceTypeNameEn: "Manual",
        },
        inspectionTarget: baseInspectionTarget,
        riskProfile: {
          riskScore: 76,
          riskLevel: isCriticalContentReason
            ? "CRITICAL"
            : isLowPriority
              ? "LOW"
              : "HIGH",
          riskLevelName: `${selectedPriorityNameEn || "High"} Risk`,
        },
        inspectionConfig: {
          inspectionTypeId: inspectionMethod === "Digital Inspection" ? 2 : 1,
          inspectionTypeNameEn: inspectionMethod,
          inspectionReasonId: selectedReasonCode,
          inspectionReasonCode: selectedReasonCode,
          inspectionReasonNameEn: selectedReasonNameEn,
          inspectionReasonNameAr: selectedReasonNameAr,
          isDigitalVisit: inspectionMethod === "Digital Inspection",
          priorityId: selectedPriorityId,
          priorityCode: selectedPriorityCode,
          priorityNameEn: selectedPriorityNameEn,
          priorityNameAr: selectedPriorityNameAr,
          dueDate: dueDateValue,
        },
        assignment: shouldAssign
          ? {
              isAssigned: true,
              assignedInspector: selectedInspectors[0]?.id,
              assignedInspectors: selectedInspectors.map((item) => ({
                inspectorId: item.id,
                inspectorName: item.name,
              })),
            }
          : {
              isAssigned: false,
              assignedInspectors: [],
            },
        attachments: taskAttachments,
      };

      if (mode === "edit" && (editingTask?.taskId || editingTask?.sourceId)) {
        await editInspectionTeamManagementTask(
          editingTask.taskId || editingTask.sourceId,
          { taskId: editingTask.taskId || editingTask.sourceId, ...payload } as any,
        );
        CustomMessage.success(t("inspection.tasks.messages.updated"));
      } else {
        const createWithValidatedPayload = async () => {
          await createInspectionTeamManagementTask(payload as any);
          CustomMessage.success(
            t(
              mode === "duplicate"
                ? "inspection.tasks.messages.duplicated"
                : "inspection.tasks.messages.created",
            ),
          );
          syncedVisible.value = false;
          await onSubmitted();
        };
        const validation = await validateInspectionTask(payload as any);
        const validationData = validation.data;
        if (hasValidationWarnings(validationData)) {
          setDuplicateTaskWarning({
            visible: true,
            message: t("inspection.tasks.messages.duplicateWarningContent"),
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
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }
      CustomMessage.error(t("inspection.tasks.messages.saveFailed"));
      console.error("Save inspection task failed", error);
    }
  }, [
    attachmentUploading,
    campaignActivityOptions,
    campaignAuthoritySelectOptions,
    campaignEmirateSelectOptions,
    currentInspectorId,
    detailLoading,
    editingTask,
    form,
    getTaskSubmitEnabled,
    inspectorSubmitLookupOptions,
    isCampaignReason,
    isInspectorSelfCreate,
    mode,
    onSubmitted,
    priorityLookupOptions,
    reasonLookupOptions,
    setDuplicateTaskWarning,
    syncedVisible,
    t,
    taskAttachments,
    taskModalMeta,
  ]);

export default useInspectionTaskSubmit;
