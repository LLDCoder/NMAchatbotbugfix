import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { IApproveModalRef, IFieldType, IProps } from "./type";
import { Form, Input, Modal, Select } from "antd";
import { CustomButton, CustomMessage } from "@/components/common";
import DocumentViewer from "@/components/common/DocumentViewer";
import { documentUpload, getTypeDictionaries } from "@/services/serviceApi";
import type { TypeDictionary } from "@/services/serviceApi";
import WarningGold from "@/assets/icons/WarningGold";
import "./index.less";
import {
  taskApprovalAction,
  ExternaltaskApprovalAction,
} from "@/services/application";
import { useTranslation } from "react-i18next";
import {
  buildApplicationActionPayload,
  buildApplicationApprovalPayload,
  normalizeTaskAttachmentFileName,
  resolveApplicationWorkflowAction,
} from "../../utils/workflowActionRouting";
import {
  runWithSubmissionLock,
  submitExternalDecisionStages,
} from "../../utils/externalDecisionStages";
import { isFahrExternalApprovalService } from "@/pages/ApplicationsDetails/fahrServiceCodes";

interface IReason {
  label: string;
  value: string;
}

interface UploadOptions {
  file: File;
  onSuccess?: (response: string) => void;
  onError?: (error: unknown) => void;
}

type CurrentWithOrganization = IProps["current"] & {
  externalOrganizationId?: string | number | null;
};

const EXTERNAL_APPROVAL_ORGANIZATION_SCOPE = "ExternalApprovalOrganization";

let cachedOrganizations: TypeDictionary[] | null = null;
let pendingOrganizationsRequest: Promise<TypeDictionary[]> | null = null;

const toSafeString = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const getCachedOrganizations = async () => {
  if (cachedOrganizations) {
    return cachedOrganizations;
  }

  if (!pendingOrganizationsRequest) {
    pendingOrganizationsRequest = getTypeDictionaries(
      EXTERNAL_APPROVAL_ORGANIZATION_SCOPE,
    )
      .then((res) => {
        const organizations = Array.isArray(res?.data) ? res.data : [];
        cachedOrganizations = organizations;
        return organizations;
      })
      .catch((error) => {
        cachedOrganizations = null;
        throw error;
      })
      .finally(() => {
        pendingOrganizationsRequest = null;
      });
  }

  return pendingOrganizationsRequest;
};

const toOrganizationOptions = (
  organizationList: TypeDictionary[],
  isArabic: boolean,
) =>
  organizationList.reduce<IReason[]>((options, item) => {
    const organization = item as Partial<TypeDictionary> | null | undefined;
    const value = toSafeString(organization?.code);
    const primaryName = isArabic
      ? toSafeString(organization?.nameAr)
      : toSafeString(organization?.nameEn);
    const fallbackName = isArabic
      ? toSafeString(organization?.nameEn)
      : toSafeString(organization?.nameAr);
    const label = primaryName || fallbackName || value;

    if (value && label) {
      options.push({ label, value });
    }

    return options;
  }, []);

const getCurrentOrganizationValue = (current: IProps["current"]) => {
  const value = (current as CurrentWithOrganization | undefined)
    ?.externalOrganizationId;
  return value === null || value === undefined ? undefined : String(value);
};

export const ApproveModal = forwardRef<IApproveModalRef, IProps>(
  (props, ref) => {
    const { current, onOkCb, onExternalApprove } = props;
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm<IFieldType>();
    const [organizations, setOrganizations] = useState<IReason[]>([]);
    const submittingRef = useRef(false);
    const completedWorkflowKeyRef = useRef<string | null>(null);
    const isExtraApprove = current?.statusId == 11;
    const isFahrExternalApprove =
      isExtraApprove &&
      (Boolean(onExternalApprove) ||
        isFahrExternalApprovalService(current?.serviceCode));
    const tipText = isExtraApprove
      ? t("applications.approvalModals.approve.externalApprovalResultTip", {
          defaultValue:
            "This action completes the current node with external approval result. After approval, it will flow to the next node.",
        })
      : t("applications.approveModal.warning");

    useImperativeHandle(ref, () => ({
      show: () => {
        form?.resetFields();
        setVisible(true);
      },
    }));
    const getOrganizations = useCallback(
      async (isActive: () => boolean) => {
        try {
          const isArabic = i18n.language?.toLowerCase().startsWith("ar");
          const organizationList = await getCachedOrganizations();
          if (!isActive()) {
            return;
          }
          setOrganizations(toOrganizationOptions(organizationList, isArabic));
          form.setFieldValue(
            "organization",
            getCurrentOrganizationValue(current),
          );
        } catch (error) {
          if (!isActive()) {
            return;
          }
          setOrganizations([]);
          form.setFieldValue(
            "organization",
            getCurrentOrganizationValue(current),
          );
          console.error("Load external approval organizations failed:", error);
        }
      },
      [current, form, i18n.language],
    );

    useEffect(() => {
      if (!visible || isFahrExternalApprove) {
        return undefined;
      }

      let isActive = true;
      getOrganizations(() => isActive);

      return () => {
        isActive = false;
      };
    }, [getOrganizations, isFahrExternalApprove, visible]);
    const renderTips = () => {
      return (
        <div className="custom-tips">
          <WarningGold className="warning-icon" />
          <span className="tips-text">{tipText}</span>
        </div>
      );
    };

    const upload = async (options: UploadOptions) => {
      const { file, onSuccess, onError } = options;
      const formData = new FormData();
      formData.append("files", file);
      try {
        const res = (await documentUpload(formData)) as { data?: string[] };
        if (res.data?.length && onSuccess) {
          onSuccess(res.data[0]);
        }
      } catch (error) {
        console.error("Upload failed:", error);
        if (onError) {
          onError(error);
        }
      } finally {
        setLoading(false);
      }
    };

    const onSubmit = () => runWithSubmissionLock(submittingRef, async () => {
      let submittingExternalDecision = false;
      let nextTaskId: string | null | undefined;
      try {
        const values: IFieldType = await form.validateFields();
        const { config: approveAction } = resolveApplicationWorkflowAction(
          current,
          "approve",
        );
        setLoading(true);
        if (isExtraApprove) {
          const workflowKey = `${current.id}:${current.taskId}:approve`;
          const submitWorkflow = async () => {
            await ExternaltaskApprovalAction(
              buildApplicationApprovalPayload(current, approveAction, {
                approvalComment: values.notes,
                rejectReasonFile: normalizeTaskAttachmentFileName(
                  values.attachments,
                ),
                actionPayload: buildApplicationActionPayload(
                  isFahrExternalApprove
                    ? { organizationCode: "FAHR" }
                    : {},
                ),
                workflowAction: 301,
                approvalAction: "Approval",
              }),
            );
          };
          if (onExternalApprove) {
            await submitExternalDecisionStages({
              workflowCompleted:
                completedWorkflowKeyRef.current === workflowKey,
              submitExternalDecision: async () => {
                submittingExternalDecision = true;
                await onExternalApprove(values);
                submittingExternalDecision = false;
              },
              onWorkflowCompleted: () => {
                completedWorkflowKeyRef.current = workflowKey;
              },
              submitWorkflow,
            });
          } else {
            await submitWorkflow();
          }
        } else {
          const response = await taskApprovalAction(
            buildApplicationApprovalPayload(current, approveAction, {
              approvalComment: values.notes,
              rejectReasonFile: normalizeTaskAttachmentFileName(
                values.attachments,
              ),
              actionPayload: buildApplicationActionPayload({}),
              approvalAction: "Approval",
              workflowAction: approveAction.action,
            }),
          );
          nextTaskId = response?.data?.nextTaskId;
        }
        completedWorkflowKeyRef.current = null;
        setVisible(false);
        if (!onExternalApprove) {
          CustomMessage.success(
            t("applications.approvalModals.approve.operationCompleted"),
          );
        }
        try {
          await onOkCb?.(nextTaskId);
        } catch (refreshError) {
          console.error("Failed to refresh application data:", refreshError);
          CustomMessage.error(
            t("applications.approvalModals.common.refreshFailed"),
          );
        }
      } catch (error) {
        if (error && typeof error === "object" && "errorFields" in error) {
          return;
        }
        console.error("Failed to approve application:", error);
        CustomMessage.error(
          t(
            submittingExternalDecision
              ? "Licensing.fahrReview.messages.externalDecisionFailed"
              : "applications.approvalModals.common.operationFailed",
          ),
        );
      } finally {
        setLoading(false);
      }
    });

    return (
      <Modal
        centered
        title={t("applications.approveModal.title")}
        visible={visible}
        destroyOnClose
        className="form-modal application-action-modal"
        onCancel={() => setVisible(false)}
        footer={
          <div>
            <CustomButton
              text={t("applications.approveModal.cancel")}
              variant="outline"
              onClick={() => setVisible(false)}
            />
            <CustomButton
              loading={loading}
              text={t("applications.approveModal.confirm")}
              variant="primary"
              onClick={onSubmit}
            />
          </div>
        }
      >
        {renderTips()}
        <Form form={form} layout="vertical" className="custom-form">
          {isExtraApprove && !isFahrExternalApprove && (
            <Form.Item
              name="organization"
              label={t(
                "Content.contentApplications.modals.externalApproval.organization",
              )}
            >
              <Select
                placeholder={t(
                  "Content.contentApplications.placeholders.selectOrganization",
                )}
                className="select-reason"
                options={organizations}
                disabled
              />
            </Form.Item>
          )}
          <Form.Item
            name="attachments"
            label={t("applications.approveModal.attachments")}
          >
            <DocumentViewer
              hasDelete
              hasDownload
              uploadConfig={{
                customRequest: upload,
                maxSize: 5,
                maxCount: 5,
                placeholder: t("applications.approveModal.uploadFile"),
                uploadTip: t("applications.approveModal.uploadTip"),
              }}
            />
          </Form.Item>
          <Form.Item name="notes" label={t("applications.approveModal.notes")}>
            <Input.TextArea
              className="custom-textarea"
              showCount
              placeholder={t("applications.approveModal.enterNotes")}
              maxLength={1000}
            />
          </Form.Item>
        </Form>
        {/* <div className="custom-quick-note">
          <p className="note-title">
            {t("applications.approvalModals.common.quickNote", "Quick Note")}
          </p>
          <div className="notes-list">
            {notes.map((item) => (
              <Tag
                key={item}
                color="rgba(225, 227, 229, 0.5)"
                className="note-item"
                onClick={() => {
                  const value = (form.getFieldValue("notes") as string) || ""
                  form.setFieldValue(
                    "notes",
                    value ? `${value};${item}` : item
                  )
                }}
              >
                {item}
              </Tag>
            ))}
          </div>
        </div> */}
      </Modal>
    );
  },
);
