import { useEffect, useState } from 'react';
import { Button, Empty, Input, Modal, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import AedIcon from '@/assets/icons/Aed';
import { UPLOAD_LIMITS } from '@/constants/uploadLimits';
import type { InspectionTaskAttachmentPayload } from '@/services/inspection';
import InspectionAttachmentUpload from '@/pages/InspectionCommon/components/InspectionAttachmentUpload';
import { formatNumber } from '@/pages/InspectionCommon/helpers';
import './ReviewDecideModal.less';

const REVIEW_NOTE_MAX_LENGTH = 1000;
const REVIEW_NOTE_TEXTAREA_AUTO_SIZE = { minRows: 4, maxRows: 8 };

export type ReviewFineDegreeValue = 1 | 2 | 3 | 4;

export type ReviewFineDegreeOption = {
  value: ReviewFineDegreeValue;
  label: string;
  labelKey: string;
  amount: number;
};

export type ReviewDecideModalViolation = {
  key: string;
  title: string;
  degreeOptions?: ReviewFineDegreeOption[];
};

type ReviewDecideModalProps = {
  visible: boolean;
  violations: ReviewDecideModalViolation[];
  degreeSelections: Record<string, ReviewFineDegreeValue>;
  itemNotes: Record<string, string>;
  itemAttachments: Record<string, InspectionTaskAttachmentPayload[]>;
  itemUploading: Record<string, boolean>;
  loading: boolean;
  submitting: boolean;
  onDegreeChange: (key: string, value: ReviewFineDegreeValue) => void;
  onItemNoteChange: (key: string, value: string) => void;
  onItemAttachmentsChange: (key: string, attachments: InspectionTaskAttachmentPayload[]) => void;
  onItemUploadingChange: (key: string, uploading: boolean) => void;
  onModify: () => void;
  onCancelViolation: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const getDegreeOption = (
  item: ReviewDecideModalViolation,
  value?: ReviewFineDegreeValue,
) => item.degreeOptions?.find((option) => option.value === value);

function ReviewDecideModal({
  visible,
  violations,
  degreeSelections,
  itemNotes,
  itemAttachments,
  itemUploading,
  loading,
  submitting,
  onDegreeChange,
  onItemNoteChange,
  onItemAttachmentsChange,
  onItemUploadingChange,
  onModify,
  onCancelViolation,
  onCancel,
  onConfirm,
}: ReviewDecideModalProps) {
  const { t } = useTranslation();
  const [validationAttempted, setValidationAttempted] = useState(false);
  const hasIncompleteDegreeSelection = violations.some((item) => {
    const degree = degreeSelections[item.key];
    return !degree || !getDegreeOption(item, degree);
  });
  const hasIncompleteEvidence = violations.some((item) => {
    const degree = degreeSelections[item.key];
    if (!degree || !getDegreeOption(item, degree)) return false;
    return !String(itemNotes[item.key] || '').trim() ||
      !(itemAttachments[item.key] || []).length;
  });
  const hasUploadingAttachments = violations.some((item) => itemUploading[item.key]);
  const disableConfirm = loading ||
    !violations.length ||
    hasIncompleteDegreeSelection ||
    hasIncompleteEvidence ||
    hasUploadingAttachments;

  useEffect(() => {
    if (!visible) {
      setValidationAttempted(false);
    }
  }, [visible]);

  const confirmButtonInactive = disableConfirm && !submitting;
  const handleModalCancel = () => {
    if (submitting || hasUploadingAttachments) return;
    onCancel();
  };
  const handleConfirmClick = () => {
    if (submitting) return;
    if (disableConfirm) {
      setValidationAttempted(true);
    }
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      centered
      closable={!submitting}
      destroyOnClose
      keyboard={!submitting}
      maskClosable={!submitting}
      title={(
        <div className="inspection-violation-details__review-title">
          <div className="inspection-violation-details__review-title-main">
            {t('inspection.violation.review.title')}
          </div>
          <div className="inspection-violation-details__review-title-subtitle">
            {t('inspection.violation.review.subtitle')}
          </div>
        </div>
      )}
      className="inspection-violation-details__modal inspection-violation-details__review-modal"
      onCancel={handleModalCancel}
      footer={[
        <Button
          key="modify"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--outline inspection-violation-details__modal-button--left"
          onClick={onModify}
          disabled={submitting || hasUploadingAttachments}
        >
          {t('inspection.violation.review.modify')}
        </Button>,
        <Button
          key="cancel-violation"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--danger-outline"
          onClick={onCancelViolation}
          disabled={submitting || hasUploadingAttachments}
        >
          {t('inspection.violation.review.cancel')}
        </Button>,
        <Button
          key="confirm"
          className={`inspection-violation-details__modal-button inspection-violation-details__modal-button--primary ${confirmButtonInactive ? 'inspection-violation-details__modal-button--visual-disabled' : ''}`}
          onClick={handleConfirmClick}
          loading={submitting}
          disabled={submitting}
        >
          {t('inspection.violation.review.confirm')}
        </Button>,
      ]}
    >
      <div className="inspection-violation-details__review-list">
        {violations.length ? violations.map((item) => {
          const selectedOption = getDegreeOption(item, degreeSelections[item.key]);
          const degreeOptions = item.degreeOptions || [];
          const showDegreeError = validationAttempted && degreeOptions.length > 0 && !selectedOption;
          const noteValue = itemNotes[item.key] || '';
          const attachmentValue = itemAttachments[item.key] || [];
          const showNoteError = validationAttempted && Boolean(selectedOption) && !noteValue.trim();
          const showAttachmentError = validationAttempted && Boolean(selectedOption) && !attachmentValue.length;

          return (
            <div
              key={item.key}
              className={`inspection-violation-details__review-card ${
                showDegreeError || showNoteError || showAttachmentError
                  ? 'inspection-violation-details__review-card--error'
                  : ''
              }`}
            >
              <div className="inspection-violation-details__review-card-header">
                <div className="inspection-violation-details__review-card-title">{item.title}</div>
                {selectedOption ? (
                  <div className="inspection-violation-details__degree-status inspection-violation-details__degree-status--selected">
                    <span>
                      {t('inspection.violation.review.degreeStatus', { degree: selectedOption.value })}
                    </span>
                    <AedIcon withParentheses={false} className="inspection-violation-details__degree-status-icon" />
                    <span>{formatNumber(selectedOption.amount)}</span>
                  </div>
                ) : (
                  <div className="inspection-violation-details__degree-status">
                    {t('inspection.violation.review.selectDegree')}
                  </div>
                )}
              </div>
              {degreeOptions.length ? (
                <Radio.Group
                  className="inspection-violation-details__degree-group"
                  value={degreeSelections[item.key]}
                  onChange={(event) => onDegreeChange(item.key, event.target.value)}
                >
                  {degreeOptions.map((option) => {
                    const isSelected = degreeSelections[item.key] === option.value;

                    return (
                      <div
                        key={option.value}
                        role="button"
                        tabIndex={0}
                        className={`inspection-violation-details__degree-option ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onDegreeChange(item.key, option.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onDegreeChange(item.key, option.value);
                          }
                        }}
                      >
                        <Radio value={option.value} />
                        <span className="inspection-violation-details__degree-copy">
                          <span className="inspection-violation-details__degree-label">
                            <span>{t(option.labelKey)}</span>
                            <AedIcon className="inspection-violation-details__degree-label-icon" />
                          </span>
                          <span className="inspection-violation-details__degree-amount">
                            {formatNumber(option.amount)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </Radio.Group>
              ) : null}
              {showDegreeError ? (
                <div className="inspection-violation-details__degree-error">
                  {t('inspection.violation.review.selectDegree')}
                </div>
              ) : null}
              <div className="inspection-violation-details__review-evidence">
                <div className="inspection-violation-details__review-field inspection-violation-details__review-field--attachments">
                  <div className="inspection-violation-details__review-field-label">
                    <span>{t('inspection.violation.review.attachments')}</span>
                    <span className="inspection-violation-details__review-field-required">*</span>
                  </div>
                  <InspectionAttachmentUpload
                    value={attachmentValue}
                    uploadText={t('inspection.violation.review.uploadAttachment')}
                    uploadingText={t('inspection.violation.review.uploadingAttachment')}
                    disabled={submitting}
                    maxCount={UPLOAD_LIMITS.MULTI_ATTACHMENT}
                    attachmentCategory="CommitteeDecision"
                    attachmentGridClassName="inspection-attachment-grid--two-columns"
                    onUploadingChange={(uploading) => onItemUploadingChange(item.key, uploading)}
                    onChange={(nextAttachments) => onItemAttachmentsChange(item.key, nextAttachments)}
                  />
                  {showAttachmentError ? (
                    <div className="inspection-violation-details__review-field-error">
                      {t('inspection.violation.review.attachmentRequired')}
                    </div>
                  ) : null}
                </div>
                <div className="inspection-violation-details__review-field">
                  <div className="inspection-violation-details__review-field-label">
                    <span>{t('inspection.violation.review.note')}</span>
                    <span className="inspection-violation-details__review-field-required">*</span>
                  </div>
                  <Input.TextArea
                    className="inspection-violation-details__textarea inspection-violation-details__review-textarea"
                    value={noteValue}
                    onChange={(event) => onItemNoteChange(item.key, event.target.value)}
                    placeholder={t('inspection.violation.review.enterNote')}
                    maxLength={REVIEW_NOTE_MAX_LENGTH}
                    showCount
                    autoSize={REVIEW_NOTE_TEXTAREA_AUTO_SIZE}
                    disabled={submitting}
                  />
                  {showNoteError ? (
                    <div className="inspection-violation-details__review-field-error">
                      {t('inspection.violation.review.committeeNoteRequired')}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading
              ? t('inspection.violation.review.loadingViolationStandards')
              : t('inspection.violation.review.noSelectedViolationReason')}
          />
        )}
      </div>
    </Modal>
  );
}

export default ReviewDecideModal;
