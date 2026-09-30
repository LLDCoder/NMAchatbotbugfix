import { toApi } from "@/utils/gstTime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePicker, Form, Input, Modal, Radio, Select, Tooltip, Upload } from "antd";
import type { RadioChangeEvent } from "antd/es/radio";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import type { RcFile } from "antd/es/upload";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import {
  getRolesGroupedByDepartmentId,
  type RoleByDepartmentGroupDto,
} from "@/services/roles";
import calendarIcon from "@/pages/CustomerRefunds/assets/icons/change_status_calendar.svg";
import closeIcon from "@/pages/CustomerRefunds/assets/icons/change_status_close.svg";
import infoCircleIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_circle.svg";
import infoMarkIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_mark.svg";
import radioCheckedIcon from "@/pages/CustomerRefunds/assets/icons/change_status_radio_checked.svg";
import radioUncheckedIcon from "@/pages/CustomerRefunds/assets/icons/change_status_radio_unchecked.svg";
import uploadIconBase from "@/pages/CustomerRefunds/assets/icons/change_status_upload_arrow_1.svg";
import uploadIconMain from "@/pages/CustomerRefunds/assets/icons/change_status_upload_arrow_2.svg";
import warningIcon from "@/pages/CustomerRefunds/assets/icons/change_status_warning.svg";
import type {
  AppealAttachment,
  AppealRecord,
  AppealStatusChangePayload,
} from "../types";
import { resolveAllowedFinalStatuses } from "../apiAdapter";
import {
  getAppealStatusTranslationKey,
} from "../utils";
import {
  APPEAL_ATTACHMENT_ACCEPT,
  APPEAL_ATTACHMENT_MAX_COUNT,
  getAppealAttachmentValidationError,
  useAppealAttachmentUploadLock,
  uploadAppealAttachmentFile,
} from "../upload";
import AppealAttachments from "./AppealAttachments";

interface AppealStatusModalProps {
  visible: boolean;
  record: AppealRecord | null;
  onCancel: () => void;
  onConfirm: (payload: AppealStatusChangePayload) => Promise<void> | void;
}

interface StatusFormValues {
  nextStatus: AppealStatusChangePayload["nextStatus"];
  roleId?: string;
  responseDeadline?: moment.Moment;
  notes?: string;
}
const APPEAL_ASSIGNABLE_DEPARTMENT_IDS = [1, 2, 6];

function AppealModalButton({
  children,
  variant = "solid",
  onClick,
  disabled,
  visualDisabled,
  ariaDisabled,
  htmlType = "button",
}: {
  children: React.ReactNode;
  variant?: "solid" | "outline";
  onClick?: () => void;
  disabled?: boolean;
  visualDisabled?: boolean;
  ariaDisabled?: boolean;
  htmlType?: "button" | "submit";
}) {
  return (
    <button
      type={htmlType}
      className={`appeal-modal-button appeal-modal-button--${variant} ${
        visualDisabled ? "appeal-modal-button--visual-disabled" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={ariaDisabled}
    >
      {children}
    </button>
  );
}

function renderRequiredLabel(label: React.ReactNode) {
  return (
    <span className="appeal-status-required-label">
      <span>{label}</span>
      <span className="appeal-status-required-label__mark">*</span>
    </span>
  );
}

const AppealStatusModal: React.FC<AppealStatusModalProps> = ({
  visible,
  record,
  onCancel,
  onConfirm,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm<StatusFormValues>();
  const [attachments, setAttachments] = useState<AppealAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roleGroups, setRoleGroups] = useState<RoleByDepartmentGroupDto[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const roleRequestIdRef = useRef(0);
  const uploadResetVersionRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    attachmentUploading,
    isAttachmentUploading,
    reserveAttachmentUpload,
    releaseAttachmentUpload,
    resetAttachmentUploadLock,
  } = useAppealAttachmentUploadLock();
  const selectedStatus = Form.useWatch("nextStatus", form);
  const roleId = Form.useWatch("roleId", form);
  const responseDeadline = Form.useWatch("responseDeadline", form);
  const selectedNotes = Form.useWatch("notes", form) ?? "";
  const allowedStatuses = useMemo(() => resolveAllowedFinalStatuses(record), [record]);
  const assignedDepartmentCode = useMemo(
    () => roleGroups.find((group) =>
      group.roles?.some((role) => role.id === roleId),
    )?.departmentNameEn,
    [roleGroups, roleId],
  );
  const slaDeadline = useMemo(() => {
    if (!record?.slaDeadline) return null;
    const parsedDeadline = moment(record.slaDeadline);
    return parsedDeadline.isValid() ? parsedDeadline : null;
  }, [record?.slaDeadline]);
  const requiresDepartment = selectedStatus === "Department Processing";
  const isTerminal = selectedStatus === "Approved" || selectedStatus === "Rejected";
  const isComplexLayout = requiresDepartment || isTerminal;
  const attachmentUploadDisabled =
    attachmentUploading || attachments.length >= APPEAL_ATTACHMENT_MAX_COUNT;

  const clearUploadProgressTimer = useCallback(() => {
    if (!progressTimerRef.current) return;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }, []);

  const resetAttachments = useCallback(() => {
    uploadResetVersionRef.current += 1;
    clearUploadProgressTimer();
    setUploadProgress(0);
    setAttachments([]);
    resetAttachmentUploadLock();
  }, [clearUploadProgressTimer, resetAttachmentUploadLock]);

  useEffect(() => {
    if (!visible) {
      roleRequestIdRef.current += 1;
      setRoleGroups([]);
      setRolesLoading(false);
      resetAttachments();
      return;
    }
    form.resetFields();
    resetAttachments();
  }, [form, resetAttachments, visible]);
  useEffect(() => {
    if (!visible || !requiresDepartment) {
      roleRequestIdRef.current += 1;
      setRoleGroups([]);
      setRolesLoading(false);
      return;
    }
    const requestId = roleRequestIdRef.current + 1;
    roleRequestIdRef.current = requestId;
    setRolesLoading(true);
    setRoleGroups([]);
    getRolesGroupedByDepartmentId(APPEAL_ASSIGNABLE_DEPARTMENT_IDS)
      .then((response) => {
        if (requestId === roleRequestIdRef.current) {
          setRoleGroups(response?.data ?? []);
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
  }, [requiresDepartment, visible]);
  useEffect(
    () => () => {
      clearUploadProgressTimer();
    },
    [clearUploadProgressTimer],
  );

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
    const uploadVersion = uploadResetVersionRef.current;
    const showUploadProgress = true;
    let currentProgress = 0;

    if (showUploadProgress) {
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
    }

    try {
      const nextAttachment = await uploadAppealAttachmentFile(file);
      if (uploadVersion !== uploadResetVersionRef.current) return;

      if (showUploadProgress) {
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (uploadVersion !== uploadResetVersionRef.current) return;
      }

      setAttachments((current) => [
        ...current,
        nextAttachment,
      ]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      if (uploadVersion !== uploadResetVersionRef.current) return;
      clearUploadProgressTimer();
      setUploadProgress(0);
      CustomMessage.error(t("Customer.customerAppeals.messages.uploadFailed"));
      options.onError?.(error as Error);
    } finally {
      if (uploadVersion === uploadResetVersionRef.current) {
        clearUploadProgressTimer();
        setUploadProgress(0);
        releaseAttachmentUpload(file);
      }
    }
  };

  const handleFinish = async (values: StatusFormValues) => {
    if (!values.nextStatus || attachmentUploading) return;
    setSubmitting(true);
    try {
      await onConfirm({
        nextStatus: values.nextStatus,
        assignedDepartmentCode,
        roleId: values.roleId,
        responseDeadline: values.responseDeadline
          ? toApi(values.responseDeadline.toDate())
          : undefined,
        notes: values.notes?.trim(),
        attachments,
      });
      form.resetFields();
      resetAttachments();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    resetAttachments();
    onCancel();
  };

  const handleStatusChange = (event: RadioChangeEvent) => {
    const nextStatus = event.target.value as StatusFormValues["nextStatus"];
    form.setFields([
      { name: "nextStatus", value: nextStatus, errors: [] },
      { name: "roleId", value: undefined, errors: [] },
      { name: "responseDeadline", value: undefined, errors: [] },
      { name: "notes", value: undefined, errors: [] },
    ]);
    resetAttachments();
  };

  const handleUploadTriggerClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!attachmentUploadDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    CustomMessage.error(t("Customer.customerAppeals.messages.uploadLimit"));
  };

  const hasValidResponseDeadline =
    Boolean(responseDeadline) &&
    responseDeadline?.isAfter(moment());
  const responseDeadlineExceedsSla =
    Boolean(responseDeadline && slaDeadline && responseDeadline.isAfter(slaDeadline));
  const hasNotes = Boolean(selectedNotes.trim());
  const confirmEnabled =
    Boolean(selectedStatus) &&
    !submitting &&
    !attachmentUploading &&
    ((requiresDepartment &&
      Boolean(
        assignedDepartmentCode &&
        roleId &&
        hasValidResponseDeadline &&
        hasNotes,
      )) ||
      (isTerminal && hasNotes) ||
      (!requiresDepartment && !isTerminal));
  const confirmButtonInactive = !confirmEnabled && !submitting;

  return (
    <Modal
      visible={visible}
      title={t("Customer.customerAppeals.statusModal.title")}
      onCancel={handleCancel}
      footer={
        <div className="appeal-modal-footer">
          <AppealModalButton variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </AppealModalButton>
          <AppealModalButton
            htmlType="submit"
            disabled={submitting}
            visualDisabled={confirmButtonInactive}
            ariaDisabled={confirmButtonInactive}
            onClick={() => form.submit()}
          >
            {submitting ? t("common.loading") : t("common.confirm")}
          </AppealModalButton>
        </div>
      }
      centered
      destroyOnClose
      closeIcon={
        <img src={closeIcon} alt="" className="appeal-status-modal__close-icon" />
      }
      className={`appeal-action-modal appeal-status-modal ${
        isComplexLayout ? "is-complex" : "is-simple"
      }`}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
        className="appeal-status-form"
      >
        <div
          className={`appeal-status-form__layout ${
            isComplexLayout ? "is-complex" : "is-simple"
          }`}
        >
          <Form.Item
            name="nextStatus"
            label={renderRequiredLabel(
              t("Customer.customerAppeals.statusModal.selectNewStatus"),
            )}
            rules={[
              {
                required: true,
                message: t("Customer.customerAppeals.messages.fieldRequired"),
              },
            ]}
            className="appeal-status-form__item appeal-status-form__item--status"
          >
            <Radio.Group
              className="appeal-status-radio-list"
              onChange={handleStatusChange}
            >
              {allowedStatuses.map((status) => {
                const checked = selectedStatus === status;
                return (
                  <Radio
                    key={status}
                    value={status}
                    className="appeal-status-radio-item"
                  >
                    <span className="appeal-status-radio-content">
                      <img
                        src={checked ? radioCheckedIcon : radioUncheckedIcon}
                        alt=""
                        className="appeal-status-radio-icon"
                      />
                      <span>
                        {(() => {
                          const statusKey = getAppealStatusTranslationKey(status);
                          return statusKey
                            ? t(statusKey, { defaultValue: status })
                            : status;
                        })()}
                      </span>
                    </span>
                  </Radio>
                );
              })}
            </Radio.Group>
          </Form.Item>

          {isComplexLayout ? (
          <div className="appeal-status-form__details">
            {requiresDepartment ? (
              <>
                <Form.Item
                  name="roleId"
                  label={renderRequiredLabel(
                    t("Customer.customerAppeals.statusModal.assignedDepartment"),
                  )}
                  rules={[
                    {
                      required: true,
                      message: t("Customer.customerAppeals.messages.fieldRequired"),
                    },
                  ]}
                >
                  <Select
                    placeholder={t(
                      "Customer.customerAppeals.statusModal.selectDepartment",
                    )}
                    loading={rolesLoading}
                    disabled={rolesLoading || !roleGroups.some(
                      (group) => group.roles?.some((role) => role.id),
                    )}
                    notFoundContent={
                      rolesLoading
                        ? t("common.loading")
                        : t(
                            "Customer.customerAppeals.messages.noRolesAvailable",
                            { defaultValue: "No roles available" },
                          )
                    }
                  >
                    {roleGroups
                      .filter((group) => group.roles?.some((role) => role.id))
                      .map((group) => {
                      const departmentName = i18n.language.startsWith("ar")
                        ? group.departmentNameAr || group.departmentNameEn
                        : group.departmentNameEn || group.departmentNameAr;
                      return (
                        <Select.OptGroup
                          key={String(group.departmentId)}
                          label={departmentName || String(group.departmentId ?? "")}
                        >
                          {(group.roles ?? []).map((role) => {
                            const roleName = i18n.language.startsWith("ar")
                              ? role.nameAr || role.nameEn
                              : role.nameEn || role.nameAr;
                            return (
                              <Select.Option key={role.id} value={role.id ?? ""}>
                                {roleName || role.id}
                              </Select.Option>
                            );
                          })}
                        </Select.OptGroup>
                      );
                      })}
                  </Select>
                </Form.Item>
                <Form.Item
                  name="responseDeadline"
                  label={renderRequiredLabel(
                    t("Customer.customerAppeals.statusModal.responseDeadline"),
                  )}
                  rules={[
                    {
                      required: true,
                      message: t("Customer.customerAppeals.messages.fieldRequired"),
                    },
                    {
                      validator: (_, value?: moment.Moment) => {
                        if (!value) {
                          return Promise.resolve();
                        }
                        if (!value.isAfter(moment())) {
                          return Promise.reject(
                            new Error(
                              t("Customer.customerAppeals.messages.scheduleTimeInvalid"),
                            ),
                          );
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <DatePicker
                    showTime={{ format: "HH:mm" }}
                    format="DD/MM/YYYY HH:mm"
                    placeholder={t("Customer.customerAppeals.statusModal.dateTimePlaceholder")}
                    suffixIcon={
                      <img
                        src={calendarIcon}
                        alt=""
                        className="appeal-status-calendar-icon"
                      />
                    }
                  />
                </Form.Item>
                {responseDeadlineExceedsSla ? (
                  <div className="appeal-status-alert appeal-status-alert--deadline-warning">
                    <img
                      src={warningIcon}
                      alt=""
                      className="appeal-status-alert-icon"
                    />
                    <div className="appeal-status-alert-text">
                      {t("Customer.customerAppeals.statusModal.slaDeadlineWarning")}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {isTerminal ? (
              <div className="appeal-status-alert">
                <img
                  src={warningIcon}
                  alt=""
                  className="appeal-status-alert-icon"
                />
                <div className="appeal-status-alert-text">
                  {selectedStatus === "Approved"
                    ? t("Customer.customerAppeals.statusModal.approvedAlert")
                    : t("Customer.customerAppeals.statusModal.rejectedAlert")}
                </div>
              </div>
            ) : null}

            {isTerminal ? (
              <div className="appeal-upload-field">
                <Form.Item
                  label={
                    <span>
                      {t("Customer.customerAppeals.statusModal.attachments")}{" "}
                      <Tooltip title={t("Customer.customerAppeals.statusModal.uploadTip")}>
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
                    </span>
                  }
                >
                  <div className="appeal-upload-progress-wrap">
                    <Upload
                      showUploadList={false}
                      beforeUpload={beforeUpload}
                      customRequest={handleUpload}
                      accept={APPEAL_ATTACHMENT_ACCEPT}
                      disabled={attachmentUploadDisabled}
                      maxCount={APPEAL_ATTACHMENT_MAX_COUNT}
                      openFileDialogOnClick={!attachmentUploadDisabled}
                    >
                      <button
                        type="button"
                        className={`appeal-upload-button is-figma ${
                          attachmentUploadDisabled ? "is-disabled" : ""
                        }`}
                        disabled={attachmentUploadDisabled}
                        onClick={handleUploadTriggerClick}
                      >
                        <span className="appeal-upload-icon">
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
                      </button>
                    </Upload>
                    {attachmentUploading ? (
                      <div className="appeal-upload-progress">
                        <div
                          className="appeal-upload-progress__bar"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </Form.Item>
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
            ) : null}

            {(requiresDepartment || isTerminal) ? (
              <>
                <Form.Item
                  name="notes"
                  label={renderRequiredLabel(
                    t("Customer.customerAppeals.statusModal.notes"),
                  )}
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t("Customer.customerAppeals.messages.fieldRequired"),
                    },
                  ]}
                >
                  <Input.TextArea
                    placeholder={t("Customer.customerAppeals.statusModal.enterNotes")}
                    maxLength={1000}
                    rows={4}
                  />
                </Form.Item>
                <div className="appeal-notes-counter">
                  {selectedNotes.length}/1000
                </div>
              </>
            ) : null}
          </div>
          ) : null}
        </div>
      </Form>
    </Modal>
  );
};

export default AppealStatusModal;
