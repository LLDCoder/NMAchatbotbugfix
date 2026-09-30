import { Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';
import './DeselectViolationConfirmModal.less';

type DeselectViolationConfirmModalProps = {
  visible: boolean;
  onNo: () => void;
  onYes: () => void;
};

function DeselectViolationConfirmModal({
  visible,
  onNo,
  onYes,
}: DeselectViolationConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      centered
      destroyOnClose
      title={null}
      closable={false}
      className="inspection-violation-details__confirm-modal"
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
              {t('inspection.violation.deselectConfirm.title')}
            </div>
            <div className="inspection-violation-details__confirm-description">
              {t('inspection.violation.deselectConfirm.description')}
            </div>
          </div>
          <div className="inspection-violation-details__confirm-actions">
            <Button
              className="inspection-violation-details__modal-button inspection-violation-details__modal-button--danger-outline"
              onClick={onNo}
            >
              {t('inspection.violation.deselectConfirm.no')}
            </Button>
            <Button
              className="inspection-violation-details__modal-button inspection-violation-details__modal-button--danger"
              onClick={onYes}
            >
              {t('inspection.violation.deselectConfirm.yes')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default DeselectViolationConfirmModal;
