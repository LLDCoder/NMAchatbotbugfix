import React, { useEffect, useMemo, useState } from "react";
import { Modal, Input } from "antd";
import { useTranslation } from "react-i18next";
import CustomButton from "../CustomButton";
import "./index.less";

const { TextArea } = Input;

export interface RejectModalProps {
  visible: boolean;
  title?: string;
  placeholder?: string;
  quickNotes?: string[];
  initialRemarks?: string;
  onCancel: () => void;
  onConfirm: (remarks: string) => void;
  loading?: boolean;
  confirmPermissionCode?: string;
  permissionRoutePath?: string;
}

const splitTokens = (value: string) =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

const joinTokens = (tokens: string[]) =>
  tokens.length > 0 ? `${tokens.join(" ; ")} ;` : "";

const normalize = (value: string) => value.trim().toLowerCase();

const RejectModal: React.FC<RejectModalProps> = ({
  visible,
  title,
  placeholder,
  quickNotes,
  initialRemarks = "",
  onCancel,
  onConfirm,
  loading = false,
  confirmPermissionCode,
  permissionRoutePath,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title || t("sharedComponents.rejectModal.title");
  const resolvedPlaceholder =
    placeholder || t("sharedComponents.rejectModal.placeholder");
  const resolvedQuickNotes = useMemo(
    () => (quickNotes?.length
      ? quickNotes
      : [
          t("sharedComponents.rejectModal.quickNotes.documentUnclear"),
          t("sharedComponents.rejectModal.quickNotes.documentMismatch"),
          t("sharedComponents.rejectModal.quickNotes.invalidOrExpiredEmiratesId"),
          t("sharedComponents.rejectModal.quickNotes.faceNotClearlyVisible"),
          t("sharedComponents.rejectModal.quickNotes.missingRequiredDocument"),
          t("sharedComponents.rejectModal.quickNotes.photoMismatch"),
        ]),
    [quickNotes, t],
  );
  const [remarks, setRemarks] = useState(initialRemarks);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);

  const handleNoteToggle = (note: string) => {
    const tokens = splitTokens(remarks);
    const noteKey = normalize(note);
    const noteExists = tokens.some((token) => normalize(token) === noteKey);
    if (noteExists) {
      const nextTokens = tokens.filter((token) => normalize(token) !== noteKey);
      setSelectedNotes((prev) =>
        prev.filter((item) => normalize(item) !== noteKey)
      );
      setRemarks(joinTokens(nextTokens));
    } else {
      const nextTokens = [...tokens, note];
      setSelectedNotes((prev) => [...prev, note]);
      setRemarks(joinTokens(nextTokens));
    }
  };

  useEffect(() => {
    if (visible) {
      setRemarks(initialRemarks);
      const tokens = splitTokens(initialRemarks);
      const matchedNotes = resolvedQuickNotes.filter((note) =>
        tokens.some((token) => normalize(token) === normalize(note))
      );
      setSelectedNotes(matchedNotes);
    }
  }, [initialRemarks, resolvedQuickNotes, visible]);

  useEffect(() => {
    const tokens = splitTokens(remarks);
    const matchedNotes = resolvedQuickNotes.filter((note) =>
      tokens.some((token) => normalize(token) === normalize(note))
    );
    setSelectedNotes(matchedNotes);
  }, [remarks, resolvedQuickNotes]);

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={640}
      centered
      className="reject-modal"
      title={resolvedTitle}
    >
      {/* <div className="reject-modal__header">
        <h3>{resolvedTitle}</h3>
      </div> */}
      <div className="reject-modal__body">
        <div className="reject-modal__label">
          {t("sharedComponents.rejectModal.notes")} <span className="required">*</span>
        </div>
        <TextArea
          value={remarks}
          placeholder={resolvedPlaceholder}
          maxLength={1000}
          showCount
          onChange={(event) => setRemarks(event.target.value)}
          className="reject-modal__textarea"
        />
        <div className="reject-modal__quick-note-label">{t("sharedComponents.rejectModal.quickNote")}</div>
        <div className="reject-modal__quick-note">
          {resolvedQuickNotes.map((note) => {
            const active = selectedNotes.includes(note);
            return (
              <button
                key={note}
                type="button"
                className={`reject-modal__quick-note-item ${
                  active ? "is-active" : ""
                }`}
                onClick={() => handleNoteToggle(note)}
              >
                {note}
              </button>
            );
          })}
        </div>
      </div>
      <div className="reject-modal__footer">
        <CustomButton
          text={t("common.cancel")}
          variant="outline"
          type="default"
          onClick={onCancel}
          customClassName="reject-modal__btn"
          disabled={loading}
        />
        <CustomButton
          text={t("common.confirm")}
          variant="primary"
          onClick={() => onConfirm(remarks.trim())}
          customClassName="reject-modal__btn"
          loading={loading}
          disabled={!remarks.trim()}
          permissionCode={confirmPermissionCode}
          permissionRoutePath={permissionRoutePath}
        />
      </div>
    </Modal>
  );
};

export default RejectModal;

