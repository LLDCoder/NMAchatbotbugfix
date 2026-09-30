import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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
import { taskApprovalAction } from "@/services/application";
import WarningGold from "@/assets/icons/WarningGold";
import {
  buildApplicationActionPayload,
  buildApplicationApprovalPayload,
  normalizeTaskAttachmentFileName,
  resolveApplicationWorkflowAction,
} from "../../utils/workflowActionRouting";
import { getRejectApplicationModalCopy } from "../../utils/workflowActionModalCopy";
import {
  runWithSubmissionLock,
  submitExternalDecisionStages,
} from "../../utils/externalDecisionStages";
import { isFahrExternalApprovalService } from "@/pages/ApplicationsDetails/fahrServiceCodes";
import { useTranslation } from "react-i18next";
interface UploadOptions {
  file: File;
  onSuccess?: (fileName: string) => void;
  onError?: (error: unknown) => void;
}

type CurrentWithOrganization = IRejectProps["current"] & {
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
    const { current, onOkCb, onExternalReject } = props;
    const { t, i18n } = useTranslation();
    const { config: currentAction } = resolveApplicationWorkflowAction(
      current,
      "reject",
    );
    const modalCopy = getRejectApplicationModalCopy(currentAction.action, t);
    const [form] = Form.useForm<IFieldType>();
    const [reasons, setReasons] = useState<IReason[]>([]);
    const [organizations, setOrganizations] = useState<IReason[]>([]);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);
    const completedWorkflowKeyRef = useRef<string | null>(null);
    const completedWorkflowNextTaskIdRef = useRef<string | null>(null);
    const rejectReason = Form.useWatch("rejectReason", form);
    const approvalComment = Form.useWatch("approvalComment", form) as
      | string
      | undefined;
    const APPROVAL_COMMENT_MAX = 1000;
    const isExtraApprove = current?.statusId == 11;
    const isFahrExternalReject =
      isExtraApprove &&
      (Boolean(onExternalReject) ||
        isFahrExternalApprovalService(current?.serviceCode));
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
    const { config: rejectAction } = resolveApplicationWorkflowAction(
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

    const onSubmit = () => runWithSubmissionLock(submittingRef, async () => {
      let submittingExternalDecision = false;
      try {
        const values = await form.validateFields();
        setLoading(true);
        const workflowKey = `${current.id}:${current.taskId}:reject`;
        let nextTaskId: string | null | undefined =
          completedWorkflowKeyRef.current === workflowKey
            ? completedWorkflowNextTaskIdRef.current
            : undefined;
        const submitWorkflow = async () => {
          const response = await taskApprovalAction(
            buildApplicationApprovalPayload(current, rejectAction, {
              approvalComment: values.approvalComment,
              rejectReasonCode: values.rejectReason,
              rejectReasonFile: normalizeTaskAttachmentFileName(
                values.rejectReasonFile,
              ),
              actionPayload: buildApplicationActionPayload(
                isFahrExternalReject
                  ? { organizationCode: "FAHR" }
                  : {},
              ),
              workflowAction: rejectAction.action,
              hideFromCustomer: values.hideFromCustomer
                ? values.hideFromCustomer
                : false,
            }),
          );
          nextTaskId = response?.data?.nextTaskId;
        };
        if (isExtraApprove && onExternalReject) {
          await submitExternalDecisionStages({
            workflowCompleted:
              completedWorkflowKeyRef.current === workflowKey,
            submitExternalDecision: async () => {
              submittingExternalDecision = true;
              await onExternalReject(values);
              submittingExternalDecision = false;
            },
            onWorkflowCompleted: () => {
              completedWorkflowKeyRef.current = workflowKey;
              completedWorkflowNextTaskIdRef.current = nextTaskId || null;
            },
            submitWorkflow,
          });
        } else {
          await submitWorkflow();
        }
        completedWorkflowKeyRef.current = null;
        completedWorkflowNextTaskIdRef.current = null;
        setVisible(false);
        if (!onExternalReject) {
          CustomMessage.info(
            t("applications.approvalModals.reject.operationCompleted"),
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
        console.error("Failed to reject application:", error);
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
      if (!visible || isFahrExternalReject) {
        return undefined;
      }

      let isActive = true;
      getOrganizations(() => isActive);

      return () => {
        isActive = false;
      };
    }, [getOrganizations, isFahrExternalReject, visible]);

    return (
      <Modal
        centered
        title={t("applications.rejectModal.title")}
        className="form-modal application-action-modal application-reject-modal"
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
            renderWhenVisible={isExtraApprove}
          />            

          {isExtraApprove && !isFahrExternalReject && (
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
              // hasDownload
              uploadConfig={{
                customRequest: upload,
                maxSize: 5,
                maxCount: isExtraApprove && onExternalReject ? 1 : 5,
                placeholder: t(
                  "applications.approvalModals.common.upload",
                  "Upload",
                ),
                uploadTip: t(
                  "applications.approvalModals.common.uploadTip",
                  "Maximum Size: 5MB, File Types: jpg, jpeg, png, and pdf.",
                ),
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
                      const nextValue = value.concat(item, "; ");
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
