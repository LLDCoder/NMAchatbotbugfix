import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Modal, Form, Select, Input, Tag } from "antd";
import {
  CustomButton,
  CustomMessage,
  HideFromCustomerFormItem,
} from "@/components/common";
import "./index.less";
import type {
  IFieldType,
  IReason,
  IRejectModalRef,
  IRejectProps,
} from "./type";
import DocumentViewer from "@/components/common/DocumentViewer";
import { documentUpload, getTypeDictionaries } from "@/services/serviceApi";
import type { TypeDictionary } from "@/services/serviceApi";
import { approveTask } from "@/services/content";
import WarningGold from "@/assets/icons/WarningGold";
import {
  buildWorkflowActionPayload,
  buildWorkflowApprovalPayload,
  normalizeTaskAttachmentFileName,
  resolveTaskWorkflowAction,
} from "../../utils/workflowActionRouting";
import { getRejectApplicationModalCopy } from "../../utils/workflowActionModalCopy";
import { useTranslation } from "react-i18next";
import { isMaterialStatusRequiredError } from "@/utils/service302MaterialStatus";
interface UploadOptions {
  file: Blob;
  onSuccess?: (fileName: string) => void;
  onError?: (error: unknown) => void;
}

type CurrentWithOrganization = IRejectProps["current"] & {
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

const getCurrentOrganizationValue = (current: IRejectProps["current"]) => {
  const value = (current as CurrentWithOrganization | undefined)
    ?.externalOrganizationId;
  return value === null || value === undefined ? undefined : String(value);
};

export const RejectModal = forwardRef<IRejectModalRef, IRejectProps>(
  (props, ref) => {
    const { current, onOkCb } = props;
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const { config: currentAction } = resolveTaskWorkflowAction(
      current,
      "reject",
    );
    const modalCopy = getRejectApplicationModalCopy(currentAction.action, t);
    const [form] = Form.useForm<IFieldType>();
    const [reasons, setReasons] = useState<IReason[]>([]);
    const [organizations, setOrganizations] = useState<IReason[]>([]);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const rejectReason = Form.useWatch("rejectReason", form);
    const approvalComment = Form.useWatch("approvalComment", form) as
      | string
      | undefined;
    const APPROVAL_COMMENT_MAX = 1000;
    const isExtraApprove =
      (current as CurrentWithOrganization | undefined)?.statusId == 11;
    const tipText = isExtraApprove
      ? t("applications.approvalModals.reject.externalApprovalResultTip", {
          defaultValue:
            "This action completes the current node with external approval result. After rejection, the process will end directly.",
        })
      : modalCopy.tip;
    const NOTES = [
      t("applications.rejectModal.quickNote1"),
      t("applications.rejectModal.quickNote2"),
      t("applications.rejectModal.quickNote3"),
      t("applications.rejectModal.quickNote4"),
    ];
    const { config: rejectAction } = resolveTaskWorkflowAction(
      current,
      "reject",
    );
    useImperativeHandle(ref, () => ({
      show: () => {
        form.resetFields();
        setVisible(true);
      },
    }));

    const renderTips = () => {
      return (
        <div className="custom-tips">
          <WarningGold className="warning-icon" />
          <span className="tips-text">{tipText}</span>
        </div>
      );
    };

    const onSubmit = async () => {
      try {
        const values: IFieldType = await form.validateFields();
        setLoading(true);
        const response = await approveTask(
          buildWorkflowApprovalPayload(current, rejectAction, {
            approvalComment: values.approvalComment,
            rejectReasonCode: values.rejectReason,
            rejectReasonFile: normalizeTaskAttachmentFileName(
              values.rejectReasonFile,
            ),
            actionPayload: buildWorkflowActionPayload({}),
            workflowAction: rejectAction.action,
            hideFromCustomer: values.hideFromCustomer
              ? values.hideFromCustomer
              : false,
          }),
        );
        await onOkCb?.(response?.data?.nextTaskId);
        setVisible(false);
      } catch (err) {
        console.error(err);
        CustomMessage.error(
          t(
            isMaterialStatusRequiredError(err)
              ? "DataList.validation.assignNewspapersMagazinesStatus"
              : "common.operationFailed",
          ),
        );
      } finally {
        setLoading(false);
      }
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

    const getReasons = useCallback(async () => {
      try {
        const res = await getTypeDictionaries("RejectionReason");
        const isArabic = i18n.language?.startsWith("ar");
        setReasons(
          (res?.data || []).map((item) => ({
            label: isArabic ? item.nameAr || item.nameEn : item.nameEn,
            value: item.code,
          })),
        );
      } catch (error) {
        console.error("Load rejection reasons failed:", error);
      }
    }, [i18n.language]);

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
      getReasons();
    }, [getReasons]);

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

    return (
      <Modal
        centered
        title={t("applications.rejectModal.title")}
        className={`form-modal application-action-modal application-reject-modal${
          isArabic ? " application-reject-modal--rtl" : ""
        }`}
        visible={visible}
        destroyOnClose
        onCancel={() => setVisible(false)}
        footer={
          <div>
            <CustomButton
              text={t("applications.rejectModal.cancel")}
              variant="outline"
              onClick={() => setVisible(false)}
            />
            <CustomButton
              loading={loading}
              text={t("applications.rejectModal.confirm")}
              variant="primary"
              disabled={!rejectReason}
              onClick={onSubmit}
            />
          </div>
        }
      >
        {renderTips()}
        <Form form={form} layout="vertical" className="custom-form reject-form">
          <HideFromCustomerFormItem
            action={rejectAction.action}
            externalApproval={isExtraApprove}
            initialValue
            renderWhenVisible={isExtraApprove}
          />
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
            name="rejectReason"
            label={t("applications.rejectModal.rejectionReason")}
            rules={[
              {
                required: true,
                message: t("applications.rejectModal.selectRejectionReason"),
              },
            ]}
          >
            <Select
              placeholder={t("applications.rejectModal.selectRejectionReason")}
              className="select-reason"
              options={reasons}
            />
          </Form.Item>
          <Form.Item
            name="rejectReasonFile"
            label={t("applications.rejectModal.uploadAttachment")}
          >
            <DocumentViewer
              hasDelete
              uploadConfig={{
                customRequest: upload,
                maxSize: 5,
                maxCount: 5,
                placeholder: t("applications.approveModal.uploadFile"),
                uploadTip: t("applications.approveModal.uploadTip"),
              }}
            />
          </Form.Item>
          <Form.Item
            label={t("applications.rejectModal.notes")}
            className="reject-approval-comment-outer"
          >
            <div className="reject-notes-field-wrap">
              <Form.Item name="approvalComment" noStyle>
                <Input.TextArea
                  className="custom-textarea reject-notes-textarea"
                  placeholder={t("applications.rejectModal.enterNotes")}
                  maxLength={APPROVAL_COMMENT_MAX}
                />
              </Form.Item>
              <div className="reject-notes-meta-row">
                <span className="reject-notes-quick-label">
                  {t("applications.rejectModal.quickNote")}
                </span>
                <span className="reject-notes-char-count" aria-live="polite">
                  {approvalComment?.length ?? 0}/{APPROVAL_COMMENT_MAX}
                </span>
              </div>
              <div className="notes-list reject-notes-tags">
                {NOTES.map((item) => (
                  <Tag
                    key={item.slice(0, 5)}
                    color="rgba(225, 227, 229, 0.5)"
                    className="note-item"
                    onClick={() => {
                      const value =
                        (form.getFieldValue("approvalComment") as string) ?? "";
                      const nextValue = value.concat(item, ";");
                      if (nextValue.length > APPROVAL_COMMENT_MAX) return;
                      form.setFieldValue("approvalComment", nextValue);
                    }}
                  >
                    {item}
                  </Tag>
                ))}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);
