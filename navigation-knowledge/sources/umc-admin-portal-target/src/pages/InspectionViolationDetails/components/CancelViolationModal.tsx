import { useEffect } from 'react';
import { Button, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';
import './CancelViolationModal.less';

const REVIEW_NOTE_MAX_LENGTH = 1000;
const REVIEW_NOTE_TEXTAREA_AUTO_SIZE = { minRows: 4, maxRows: 8 };

export type CancelViolationPayload = {
  note: string;
};

type CancelViolationModalProps = {
  visible: boolean;
  paid: boolean;
  submitting: boolean;
  onNo: () => void;
  onYes: (payload: CancelViolationPayload) => Promise<void>;
};

function CancelViolationModal({
  visible,
  paid,
  submitting,
  onNo,
  onYes,
}: CancelViolationModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!visible) return;
    form.resetFields();
  }, [form, visible]);

  const handleYes = async () => {
    if (submitting) return;
    const values = await form.validateFields();
    await onYes({ note: String(values.note || '').trim() });
  };

  const description = paid
    ? t('inspection.violation.cancelModal.paidDescription')
    : t('inspection.violation.cancelModal.unpaidDescription');

  return (
    <Modal
      visible={visible}
      centered
      destroyOnClose
      title={null}
      closable={false}
      className="inspection-violation-details__confirm-modal inspection-violation-details__cancel-modal"
      footer={null}
    >
      <div className="inspection-violation-details__confirm-content">
        <img
          src={inspectionFigmaAssets.modalConfirm.warningRed}
          alt=""
          aria-hidden="true"
          className="inspection-violation-details__confirm-icon"
        />
        <div className="inspection-violation-details__confirm-main">
          <div className="inspection-violation-details__confirm-copy">
            <div className="inspection-violation-details__confirm-title">
              {t('inspection.violation.cancelModal.title')}
            </div>
            <div className="inspection-violation-details__confirm-description">{description}</div>
          </div>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            className="inspection-violation-details__form inspection-violation-details__confirm-form"
          >
            <Form.Item
              name="note"
              label={(
                <span className="inspection-violation-details__confirm-required-label">
                  <span>{t('inspection.violation.cancelModal.note')}</span>
                  <span className="inspection-violation-details__confirm-required-mark">*</span>
                </span>
              )}
              rules={[{
                required: true,
                whitespace: true,
                message: t('inspection.violation.cancelModal.noteRequired'),
              }]}
            >
              <Input.TextArea
                className="inspection-violation-details__textarea inspection-violation-details__confirm-textarea"
                placeholder={t('inspection.violation.cancelModal.enterNote')}
                maxLength={REVIEW_NOTE_MAX_LENGTH}
                showCount
                autoSize={REVIEW_NOTE_TEXTAREA_AUTO_SIZE}
              />
            </Form.Item>
          </Form>
          <div className="inspection-violation-details__confirm-actions">
            <Button
              className="inspection-violation-details__modal-button inspection-violation-details__modal-button--danger-outline"
              onClick={onNo}
              disabled={submitting}
            >
              {t('inspection.violation.cancelModal.no')}
            </Button>
            <Button
              className="inspection-violation-details__modal-button inspection-violation-details__modal-button--danger"
              onClick={handleYes}
              loading={submitting}
              disabled={submitting}
            >
              {t('inspection.violation.cancelModal.yes')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default CancelViolationModal;
