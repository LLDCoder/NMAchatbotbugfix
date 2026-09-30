import React from 'react';
import { Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

type SeizedMaterialsDecisionModalProps = {
  visible: boolean;
  submittingDecision?: boolean | null;
  onDecision: (hasMaterials: boolean) => void;
};

const secondaryButtonClassName = [
  'inspection-start-visit__outline-button',
  'inspection-start-visit__seized-decision-action',
  'inspection-start-visit__seized-decision-action--secondary',
].join(' ');

const primaryButtonClassName = [
  'inspection-start-visit__primary-button',
  'inspection-start-visit__seized-decision-action',
  'inspection-start-visit__seized-decision-action--primary',
].join(' ');

const SeizedMaterialsDecisionModal: React.FC<SeizedMaterialsDecisionModalProps> = ({
  visible,
  submittingDecision = null,
  onDecision,
}) => {
  const { t } = useTranslation();
  const submitting = submittingDecision !== null;

  return (
    <Modal
      title={null}
      visible={visible}
      centered
      closable={false}
      destroyOnClose
      maskClosable={false}
      className="inspection-start-visit__decision-modal inspection-start-visit__seized-decision-modal"
      footer={null}
      width={640}
    >
      <div className="inspection-start-visit__seized-decision-body">
        <img
          className="inspection-start-visit__seized-decision-icon"
          src={inspectionFigmaAssets.modalConfirm.warningGold}
          alt=""
          aria-hidden="true"
        />
        <div className="inspection-start-visit__seized-decision-content">
          <div className="inspection-start-visit__seized-decision-copy">
            <h3 className="inspection-start-visit__seized-decision-title">
              {t('inspection.execution.addSeizedMaterials')}
            </h3>
            <p className="inspection-start-visit__seized-decision-message">
              {t('inspection.execution.seizedMaterialsQuestion')}
            </p>
          </div>
          <div className="inspection-start-visit__seized-decision-actions">
            <Button
              className={secondaryButtonClassName}
              disabled={submitting}
              loading={submittingDecision === false}
              onClick={() => onDecision(false)}
            >
              {t('inspection.common.no')}
            </Button>
            <Button
              className={primaryButtonClassName}
              disabled={submitting}
              loading={submittingDecision === true}
              onClick={() => onDecision(true)}
            >
              {t('inspection.common.yes')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SeizedMaterialsDecisionModal;
