import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import { approveTask } from "@/services/content";
import { useTranslation } from "react-i18next";
import {
  buildExternalWorkflowApprovalPayload,
  buildWorkflowActionPayload,
  buildWorkflowApprovalPayload,
  normalizeTaskAttachmentFileName,
  resolveTaskWorkflowAction,
} from "../../utils/workflowActionRouting";
import { ExternaltaskApprovalAction } from "@/services/application";
import type { AxiosError } from "axios";
import { isMaterialStatusRequiredError } from "@/utils/service302MaterialStatus";
interface UploadOptions {
  file: Blob;
  onSuccess?: (fileName: string) => void;
  onError?: (error: unknown) => void;
}

interface IReason {
  label: string;
  value: string;
}

type CurrentWithOrganization = IProps["current"] & {
  statusId?: string | number | null;
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

const hasValidationError = (error: unknown) =>
  Boolean(error && typeof error === "object" && "errorFields" in error);

interface ApproveErrorPayload {
  message?: unknown;
}

const getApproveErrorMessage = (error: unknown) => {
  const payload = (error as AxiosError<ApproveErrorPayload>).response?.data;
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  return typeof error === "string" ? error.trim() : "";
};

export const ApproveModal = forwardRef<IApproveModalRef, IProps>(
  (props, ref) => {
    const { current, onOkCb } = props;
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm<IFieldType>();
    const [organizations, setOrganizations] = useState<IReason[]>([]);
    const isExtraApprove =
      (current as CurrentWithOrganization | undefined)?.statusId == 11;
    const tipText = isExtraApprove
      ? t("applications.approvalModals.approve.externalApprovalResultTip", {
          defaultValue:
            "This action completes the current node with external approval result. After approval, it will flow to the next node.",
        })
      : t("applications.approvalModals.approve.conditionalTip");
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
      if (!visible || !isExtraApprove) {
        return undefined;
      }

      let isActive = true;
      getOrganizations(() => isActive);

      return () => {
        isActive = false;
      };
    }, [getOrganizations, isExtraApprove, visible]);

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
        const res = await documentUpload(formData);
        const uploadedFiles = Array.isArray(res.data) ? res.data : [];
        if (uploadedFiles.length > 0) {
          onSuccess?.(uploadedFiles[0]);
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

    const onSubmit = async () => {
      try {
        const values: IFieldType = await form.validateFields();
        const { config: approveAction } = resolveTaskWorkflowAction(
          current,
          "approve",
        );
        setLoading(true);
        if (isExtraApprove) {
          await ExternaltaskApprovalAction(
            buildExternalWorkflowApprovalPayload(current, approveAction, {
              approvalComment: values.notes,
              rejectReasonFile: normalizeTaskAttachmentFileName(
                values.attachments,
              ),
              actionPayload: buildWorkflowActionPayload({}),
              workflowAction: 301,
              approvalAction: "Approval",
            }),
          );
          await onOkCb?.();
        } else {
          const response = await approveTask(
            buildWorkflowApprovalPayload(current, approveAction, {
              approvalComment: values.notes,
              rejectReasonFile: normalizeTaskAttachmentFileName(
                values.attachments,
              ),
              actionPayload: buildWorkflowActionPayload({}),
              workflowAction: approveAction.action
            }),
          );
          await onOkCb?.(response?.data?.nextTaskId);
        }
        setVisible(false);
      } catch (error) {
        if (hasValidationError(error)) {
          return;
        }
        if (isMaterialStatusRequiredError(error)) {
          CustomMessage.error(
            t("DataList.validation.assignNewspapersMagazinesStatus"),
          );
          return;
        }
        const errorMessage = getApproveErrorMessage(error);
        if (errorMessage) {
          CustomMessage.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal
        centered
        title={t("applications.approveModal.title")}
        visible={visible}
        destroyOnClose
        className={`form-modal application-action-modal${
          isArabic ? " content-applications-modal--rtl" : ""
        }`}
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
          {isExtraApprove && (
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
