import { toApi } from "@/utils/gstTime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Tooltip,
  Upload,
} from "antd";
import type { RcFile } from "antd/lib/upload";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import { fileUpload, getDocumentUploadResponseUrl } from "@/services/media";
import {
  getRolesGroupedByDepartmentId,
  type RoleByDepartmentGroupDto,
} from "@/services/roles";
import closeIcon from "../assets/icons/change_status_close.svg";
import calendarIcon from "../assets/icons/change_status_calendar.svg";
import infoCircleIcon from "../assets/icons/change_status_info_circle.svg";
import infoMarkIcon from "../assets/icons/change_status_info_mark.svg";
import radioCheckedIcon from "../assets/icons/change_status_radio_checked.svg";
import radioUncheckedIcon from "../assets/icons/change_status_radio_unchecked.svg";
import uploadIconBase from "../assets/icons/change_status_upload_arrow_1.svg";
import uploadIconMain from "../assets/icons/change_status_upload_arrow_2.svg";
import warningIcon from "../assets/icons/change_status_warning.svg";
import RefundAttachments from "./RefundAttachments";
import type {
  RefundAttachment,
  RefundHandler,
  RefundRecord,
  RefundStatusChangePayload,
} from "../types";
import { buildRefundAttachmentAccessUrl } from "../utils";

interface RefundStatusModalProps {
  open: boolean;
  record: RefundRecord | null;
  handlers: RefundHandler[];
  allowedStatuses: RefundStatusChangePayload["nextStatus"][];
  onCancel: () => void;
  onSubmit: (payload: RefundStatusChangePayload) => Promise<void>;
}
interface StatusFormValues {
  nextStatus?: RefundStatusChangePayload["nextStatus"];
  roleId?: string;
  responseDeadline?: moment.Moment;
  notes?: string;
}

const QUICK_NOTE_KEYS: Record<string, string[]> = {
  "Pending Refund": [
    "Customer.customerRefunds.statusModal.quickNotes.pendingRefund1",
    "Customer.customerRefunds.statusModal.quickNotes.pendingRefund2",
    "Customer.customerRefunds.statusModal.quickNotes.pendingRefund3",
  ],
  Rejected: [
    "Customer.customerRefunds.statusModal.quickNotes.rejected1",
    "Customer.customerRefunds.statusModal.quickNotes.rejected2",
    "Customer.customerRefunds.statusModal.quickNotes.rejected3",
  ],
};

const COMPLEX_STATUS_SET = new Set<RefundStatusChangePayload["nextStatus"]>([
  "Department Processing",
  "Pending Refund",
  "Rejected",
]);
const REFUND_ASSIGNABLE_DEPARTMENT_IDS = [1, 2, 6];

function ModalActionButton({
  children,
  variant,
  onClick,
  disabled = false,
  loading = false,
}: {
  children: React.ReactNode;
  variant: "primary" | "outline";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`refund-modal-action-button is-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? t("common.loading") : children}
    </button>
  );
}

const RefundStatusModal: React.FC<RefundStatusModalProps> = ({
  open,
  allowedStatuses,
  onCancel,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm<StatusFormValues>();
  const [attachments, setAttachments] = useState<RefundAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roleGroups, setRoleGroups] = useState<RoleByDepartmentGroupDto[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const roleRequestIdRef = useRef(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedStatus = Form.useWatch("nextStatus", form);
  const roleId = Form.useWatch<string | undefined>("roleId", form);
  const selectedNotes = Form.useWatch("notes", form) ?? "";
  const isDepartmentProcessing = selectedStatus === "Department Processing";
  const previousStatusRef = useRef<
    RefundStatusChangePayload["nextStatus"] | undefined
  >(undefined);
  const statusOptions = useMemo(() => allowedStatuses, [allowedStatuses]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setAttachments([]);
    previousStatusRef.current = undefined;
  }, [form, open]);

  useEffect(() => {
    if (!open || !selectedStatus) return;

    if (!statusOptions.includes(selectedStatus)) {
      form.resetFields([
        "nextStatus",
        "roleId",
        "responseDeadline",
        "notes",
      ]);
      setAttachments([]);
      previousStatusRef.current = undefined;
      return;
    }

    if (
      previousStatusRef.current &&
      previousStatusRef.current !== selectedStatus
    ) {
      form.resetFields([
        "roleId",
        "responseDeadline",
        "notes",
      ]);
      setAttachments([]);
    }

    previousStatusRef.current = selectedStatus;
  }, [form, open, selectedStatus, statusOptions]);
  useEffect(() => {
    if (!open || !isDepartmentProcessing) {
      roleRequestIdRef.current += 1;
      setRoleGroups([]);
      setRolesLoading(false);
      return;
    }
    const requestId = roleRequestIdRef.current + 1;
    roleRequestIdRef.current = requestId;
    setRolesLoading(true);
    setRoleGroups([]);
    getRolesGroupedByDepartmentId(REFUND_ASSIGNABLE_DEPARTMENT_IDS)
      .then((response) => {
        if (requestId === roleRequestIdRef.current) {
          setRoleGroups(response.data ?? []);
        }
      })
      .catch(() => {
        if (requestId === roleRequestIdRef.current) {
          setRoleGroups([]);
        }
      })
      .finally(() => {
        if (requestId === roleRequestIdRef.current) {
          setRolesLoading(false);
        }
      });
  }, [isDepartmentProcessing, open]);

  const selectedRoleGroup = useMemo(
    () =>
      roleGroups.find((group) =>
        group.roles?.some((role) => role.id === roleId),
      ),
    [roleGroups, roleId],
  );
  const assignedDepartmentId = selectedRoleGroup?.departmentId?.toString();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");

  const beforeUpload = (file: RcFile) => {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".pdf"].includes(extension)) {
      CustomMessage.error(t("Customer.customerRefunds.messages.invalidUploadFormat"));
      return false;
    }
    if (file.size / 1024 / 1024 > 5) {
      CustomMessage.error(t("Customer.customerRefunds.messages.fileSizeExceeds"));
      return false;
    }
    if (attachments.length >= 3) {
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadLimit"));
      return false;
    }
    return true;
  };

  const handleUploadTriggerClick = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    if (attachments.length < 3) return;
    event.preventDefault();
    event.stopPropagation();
    CustomMessage.error(t("Customer.customerRefunds.messages.uploadLimit"));
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const { file, onSuccess, onError } = options;
    const nextFile = file as RcFile;
    const extension = nextFile.name
      .slice(nextFile.name.lastIndexOf(".") + 1)
      .toLowerCase() as RefundAttachment["type"];

    const formData = new FormData();
    formData.append("files", nextFile);

    setUploading(true);
    setUploadProgress(0);
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    let currentProgress = 0;
    const timer = setInterval(() => {
      if (currentProgress < 80) {
        currentProgress += 8;
        if (currentProgress >= 80) {
          currentProgress = 80;
          clearInterval(timer);
          progressTimerRef.current = null;
        }
        setUploadProgress(currentProgress);
      }
    }, 100);
    progressTimerRef.current = timer;

    try {
      const response = await fileUpload(formData);
      const uploadedUrl = getDocumentUploadResponseUrl(response);
      if (!uploadedUrl) {
        throw new Error("Upload response did not include a file URL.");
      }

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      currentProgress = 80;
      const finalTimer = setInterval(() => {
        if (currentProgress < 100) {
          currentProgress += 2;
          if (currentProgress >= 100) {
            currentProgress = 100;
            clearInterval(finalTimer);
            progressTimerRef.current = null;
          }
          setUploadProgress(currentProgress);
        }
      }, 100);
      progressTimerRef.current = finalTimer;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const attachment: RefundAttachment = {
        id: `${nextFile.uid}-${Date.now()}`,
        name: nextFile.name,
        type: extension,
        filePath: uploadedUrl,
        url: buildRefundAttachmentAccessUrl(uploadedUrl),
      };

      setAttachments((prev) => [...prev, attachment]);
      onSuccess?.(attachment);
      setUploading(false);
      setUploadProgress(0);
    } catch (error) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setUploading(false);
      setUploadProgress(0);
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadFailed"));
      onError?.(error as Error);
    }
  };

  const quickNotes = (QUICK_NOTE_KEYS[selectedStatus ?? ""] ?? []).map((key) =>
    t(key),
  );
  const statusLabelMap: Record<string, string> = {
    "Department Processing": t(
      "Customer.customerRefunds.statuses.departmentProcessing",
    ),
    "Pending Customer": t("Customer.customerRefunds.statuses.pendingCustomer"),
    "Pending Refund": t("Customer.customerRefunds.statuses.pendingRefund"),
    Rejected: t("Customer.customerRefunds.statuses.rejected"),
  };
  const confirmEnabled = Boolean(selectedStatus) && !loading;
  const isComplexLayout = Boolean(
    selectedStatus && COMPLEX_STATUS_SET.has(selectedStatus),
  );

  return (
    <Modal
      visible={open}
      title={t("Customer.customerRefunds.statusModal.title")}
      onCancel={onCancel}
      className={`refund-status-modal ${
        isComplexLayout ? "is-complex" : "is-simple"
      }`}
      centered
      closeIcon={
        <img src={closeIcon} alt="" className="refund-modal-close-icon" />
      }
      footer={
        <div className="refund-modal-footer">
          <ModalActionButton variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </ModalActionButton>
          <ModalActionButton
            variant="primary"
            disabled={!confirmEnabled}
            loading={loading}
            onClick={async () => {
              try {
                setLoading(true);
                const values = await form.validateFields();
                await onSubmit({
                  nextStatus: values.nextStatus,
                  departmentId: assignedDepartmentId,
                  roleId: values.roleId,
                  responseDeadline: values.responseDeadline
                    ? toApi(values.responseDeadline)
                    : undefined,
                  notes: values.notes,
                  attachments,
                });
              } finally {
                setLoading(false);
              }
            }}
          >
            {t("common.confirm")}
          </ModalActionButton>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="custorm-form refund-status-form"
      >
        <div
          className={`refund-status-layout ${
            isComplexLayout ? "is-complex" : "is-simple"
          }`}
        >
          <div className="refund-status-layout-left">
            <Form.Item
              name="nextStatus"
              label={t("Customer.customerRefunds.statusModal.selectNewStatus")}
              required
              rules={[
                {
                  required: true,
                  message: t("Customer.customerRefunds.messages.fieldRequired"),
                },
              ]}
            >
              <Radio.Group className="refund-status-radio-list">
                {statusOptions.map((item) => {
                  const isChecked = selectedStatus === item;
                  return (
                    <Radio
                      value={item}
                      key={item}
                      className="refund-status-radio-item"
                    >
                      <span className="refund-status-radio-content">
                        <img
                          src={
                            isChecked ? radioCheckedIcon : radioUncheckedIcon
                          }
                          alt=""
                          className="refund-status-radio-icon"
                        />
                        <span>{statusLabelMap[item] ?? item}</span>
                      </span>
                    </Radio>
                  );
                })}
              </Radio.Group>
            </Form.Item>
          </div>

          {isComplexLayout ? (
            <div className="refund-status-layout-right">
              {isDepartmentProcessing && (
                <div className="refund-modal-section">
                  <Form.Item
                    name="roleId"
                    label={t("Customer.customerRefunds.statusModal.assignedDepartment")}
                    required
                    rules={[
                      {
                        required: true,
                        message: t("Customer.customerRefunds.messages.fieldRequired"),
                      },
                    ]}
                  >
                    <Select
                      placeholder={t("Customer.customerRefunds.statusModal.selectDepartment")}
                      loading={rolesLoading}
                      disabled={rolesLoading}
                    >
                      {roleGroups
                        .filter((group) => group.roles?.length)
                        .map((group) => (
                          <Select.OptGroup
                            key={group.departmentId}
                            label={
                              isArabic
                                ? group.departmentNameAr ?? group.departmentNameEn
                                : group.departmentNameEn ?? group.departmentNameAr
                            }
                          >
                            {group.roles?.map((role) => (
                              <Select.Option value={role.id ?? ""} key={role.id}>
                                {isArabic
                                  ? role.nameAr ?? role.nameEn
                                  : role.nameEn ?? role.nameAr}
                              </Select.Option>
                            ))}
                          </Select.OptGroup>
                        ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="responseDeadline"
                    label={t("Customer.customerRefunds.statusModal.responseDeadline")}
                    required
                    rules={[
                      {
                        required: true,
                        message: t("Customer.customerRefunds.messages.fieldRequired"),
                      },
                      {
                        validator: async (_, value) => {
                          if (value && value.isBefore(moment())) {
                            throw new Error(
                              t("Customer.customerRefunds.messages.scheduleTimeInvalid"),
                            );
                          }
                        },
                      },
                    ]}
                  >
                    <DatePicker
                      showTime={{ format: "HH:mm" }}
                      format="DD/MM/YYYY HH:mm"
                      placeholder={t("Customer.customerRefunds.statusModal.dateTimePlaceholder")}
                      suffixIcon={
                        <img
                          src={calendarIcon}
                          alt=""
                          className="refund-status-calendar-icon"
                        />
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name="notes"
                    label={t("Customer.profileDetail.modals.notes")}
                    required
                    rules={[
                      {
                        required: true,
                        message: t("Customer.customerRefunds.messages.fieldRequired"),
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={1000}
                      placeholder={t("Customer.profileDetail.modals.enterNotes")}
                    />
                  </Form.Item>
                  <div className="refund-notes-counter">
                    {selectedNotes.length}/1000
                  </div>
                </div>
              )}

              {selectedStatus === "Pending Refund" && (
                <div className="refund-modal-section">
                  <div className="refund-status-alert">
                    <img
                      src={warningIcon}
                      alt=""
                      className="refund-status-alert-icon"
                    />
                    <div className="refund-status-alert-text">
                      {t("Customer.customerRefunds.statusModal.pendingRefundAlert")}
                    </div>
                  </div>
                  <Form.Item
                    className="refund-status-upload-item"
                    label={
                      <span>
                        {t("Customer.customerRefunds.statusModal.attachments")}{" "}
                        <Tooltip title={t("Customer.customerRefunds.statusModal.uploadTip")}>
                          <span className="refund-field-info-icon">
                            <img
                              src={infoCircleIcon}
                              alt=""
                              className="refund-field-info-circle"
                            />
                            <img
                              src={infoMarkIcon}
                              alt=""
                              className="refund-field-info-mark"
                            />
                          </span>
                        </Tooltip>
                      </span>
                    }
                  >
                    <div className="refund-upload-progress-wrap">
                      <Upload
                        showUploadList={false}
                        beforeUpload={beforeUpload}
                        customRequest={handleUpload}
                        accept=".jpg,.jpeg,.png,.pdf"
                        openFileDialogOnClick={!uploading && attachments.length < 3}
                      >
                        <button
                          type="button"
                          className="refund-upload-button is-figma"
                          disabled={uploading}
                          onClick={uploading ? undefined : handleUploadTriggerClick}
                        >
                          <span className="refund-upload-icon">
                            <img
                              src={uploadIconBase}
                              alt=""
                              className="refund-upload-icon-layer is-base"
                            />
                            <img
                              src={uploadIconMain}
                              alt=""
                              className="refund-upload-icon-layer is-main"
                            />
                          </span>
                          <span>{t("Customer.customerRefunds.actions.uploadFile")}</span>
                        </button>
                      </Upload>
                      {uploading && (
                        <div className="upload-progress">
                          <div
                            className="upload-progress-bar"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Form.Item>
                  {attachments.length ? (
                    <RefundAttachments
                      attachments={attachments}
                      compact
                      variant="decision"
                      onDelete={(attachmentId) => {
                        setAttachments((prev) =>
                          prev.filter((item) => item.id !== attachmentId),
                        );
                      }}
                    />
                  ) : null}
                  <Form.Item
                    className="refund-status-notes-item is-pending-refund"
                    name="notes"
                    label={t("Customer.profileDetail.modals.notes")}
                    required
                    rules={[
                      {
                        required: true,
                        message: t("Customer.customerRefunds.messages.fieldRequired"),
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={1000}
                      showCount={true}
                      placeholder={t("Customer.profileDetail.modals.enterNotes")}
                    />
                  </Form.Item>
                  <div className="refund-quick-notes-group">
                    <div className="refund-quick-notes-title">
                      {t("Customer.profileDetail.modals.quickNotes")}
                    </div>
                    <div className="refund-quick-notes">
                      {quickNotes.map((item, idx) => (
                        <button
                          type="button"
                          key={`refund-status-note-${idx}`}
                          className="refund-quick-note"
                          onClick={() => {
                            const current = form.getFieldValue("notes") ?? "";
                            const nextText = current
                              ? `${current}; ${item}`
                              : item;
                            form.setFieldsValue({ notes: nextText });
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedStatus === "Rejected" && (
                <div className="refund-modal-section">
                  <div className="refund-status-alert">
                    <img
                      src={warningIcon}
                      alt=""
                      className="refund-status-alert-icon"
                    />
                    <div className="refund-status-alert-text">
                      {t("Customer.customerRefunds.statusModal.rejectedAlert")}
                    </div>
                  </div>
                  <Form.Item
                    className="refund-status-upload-item"
                    label={
                      <span>
                        {t("Customer.customerRefunds.statusModal.attachments")}{" "}
                        <Tooltip title={t("Customer.customerRefunds.statusModal.uploadTip")}>
                          <span className="refund-field-info-icon">
                            <img
                              src={infoCircleIcon}
                              alt=""
                              className="refund-field-info-circle"
                            />
                            <img
                              src={infoMarkIcon}
                              alt=""
                              className="refund-field-info-mark"
                            />
                          </span>
                        </Tooltip>
                      </span>
                    }
                  >
                    <div className="refund-upload-progress-wrap">
                      <Upload
                        showUploadList={false}
                        beforeUpload={beforeUpload}
                        customRequest={handleUpload}
                        accept=".jpg,.jpeg,.png,.pdf"
                        openFileDialogOnClick={!uploading && attachments.length < 3}
                      >
                        <button
                          type="button"
                          className="refund-upload-button is-figma"
                          disabled={uploading}
                          onClick={uploading ? undefined : handleUploadTriggerClick}
                        >
                          <span className="refund-upload-icon">
                            <img
                              src={uploadIconBase}
                              alt=""
                              className="refund-upload-icon-layer is-base"
                            />
                            <img
                              src={uploadIconMain}
                              alt=""
                              className="refund-upload-icon-layer is-main"
                            />
                          </span>
                          <span>{t("Customer.customerRefunds.actions.uploadFile")}</span>
                        </button>
                      </Upload>
                      {uploading && (
                        <div className="upload-progress">
                          <div
                            className="upload-progress-bar"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Form.Item>
                  {attachments.length ? (
                    <RefundAttachments
                      attachments={attachments}
                      compact
                      variant="decision"
                      onDelete={(attachmentId) => {
                        setAttachments((prev) =>
                          prev.filter((item) => item.id !== attachmentId),
                        );
                      }}
                    />
                  ) : null}
                  <Form.Item
                    className="refund-status-notes-item is-pending-refund"
                    name="notes"
                    label={t("Customer.profileDetail.modals.notes")}
                    required
                    rules={[
                      {
                        required: true,
                        message: t("Customer.customerRefunds.messages.fieldRequired"),
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={1000}
                      showCount={true}
                      placeholder={t("Customer.profileDetail.modals.enterNotes")}
                    />
                  </Form.Item>
                  <div className="refund-quick-notes-group">
                    <div className="refund-quick-notes-title">
                      {t("Customer.profileDetail.modals.quickNotes")}
                    </div>
                    <div className="refund-quick-notes">
                      {quickNotes.map((item, idx) => (
                        <button
                          type="button"
                          key={`refund-status-rejected-note-${idx}`}
                          className="refund-quick-note"
                          onClick={() => {
                            const current = form.getFieldValue("notes") ?? "";
                            const nextText = current
                              ? `${current}; ${item}`
                              : item;
                            form.setFieldsValue({ notes: nextText });
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Form>
    </Modal>
  );
};

export default RefundStatusModal;
