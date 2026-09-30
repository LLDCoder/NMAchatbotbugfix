import React from 'react';
import { Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import accessedSuccessfullyStatusIcon from '@/pages/InspectionCommon/assets/images/check.svg';
import visitLocationActionIcon from '@/pages/InspectionCommon/assets/images/check-location.svg';

type SubmitSuccessModalProps = {
  visible: boolean;
  submitting: boolean;
  isDigitalInspection: boolean;
  onCancel: () => void;
  onCheckout: () => void | Promise<void>;
};

const SubmitSuccessModal: React.FC<SubmitSuccessModalProps> = ({
  visible,
  submitting,
  isDigitalInspection,
  onCancel,
  onCheckout,
}) => {
  const { t } = useTranslation();
  const submitSuccessTitle = t('inspection.execution.inspectionReportSubmitted');

  return (
    <Modal
      title={submitSuccessTitle}
      visible={visible}
      onCancel={onCancel}
      centered
      closable={false}
      destroyOnClose
      footer={null}
      keyboard={false}
      maskClosable={false}
      className="inspection-start-visit__submit-success-modal"
    >
      <div className="inspection-start-visit__submit-success-body">
        <img
          alt=""
          className="inspection-start-visit__submit-success-icon"
          src={accessedSuccessfullyStatusIcon}
        />
        <div className="inspection-start-visit__submit-success-content">
          <div className="inspection-start-visit__submit-success-copy">
            <h2 className="inspection-start-visit__submit-success-title">
              {submitSuccessTitle}
            </h2>
            <p className="inspection-start-visit__checkout-instruction">
              {t('inspection.execution.checkOutInstruction')}
            </p>
          </div>
          <div className="inspection-start-visit__checkout-callout">
            <strong className="inspection-start-visit__checkout-callout-title">
              {t('inspection.execution.checkoutDataTitle')}
            </strong>
            <div className="inspection-start-visit__checkout-callout-list">
              <span className="inspection-start-visit__checkout-callout-label">
                {t('inspection.execution.checkOutTime')}
              </span>
              {!isDigitalInspection ? (
                <span className="inspection-start-visit__checkout-callout-label">
                  {t('inspection.execution.checkOutLocation')}
                </span>
              ) : null}
            </div>
          </div>
          <div className="inspection-start-visit__submit-success-actions">
            <Button
              className="inspection-start-visit__primary-button inspection-start-visit__submit-success-action"
              icon={(
                <img
                  alt=""
                  className="inspection-start-visit__checkout-action-icon"
                  src={visitLocationActionIcon}
                />
              )}
              loading={submitting}
              onClick={onCheckout}
            >
              {t('inspection.execution.checkOutAndClose')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SubmitSuccessModal;
