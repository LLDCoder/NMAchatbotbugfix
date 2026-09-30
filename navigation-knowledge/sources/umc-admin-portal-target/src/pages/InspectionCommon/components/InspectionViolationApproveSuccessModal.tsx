import React from 'react';
import { useTranslation } from 'react-i18next';
import InspectionLightConfirmModal from './InspectionLightConfirmModal';

type InspectionViolationApproveSuccessModalProps = {
  visible: boolean;
  loading?: boolean;
  onOk: () => void;
  onCancel?: () => void;
};

const InspectionViolationApproveSuccessModal: React.FC<InspectionViolationApproveSuccessModalProps> = ({
  visible,
  loading = false,
  onOk,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <InspectionLightConfirmModal
      visible={visible}
      title={t('inspection.violation.approveSuccess.title', { defaultValue: 'Violation Approved' })}
      content={t('inspection.violation.approveSuccess.content', {
        defaultValue: 'The violation decision has been approved and will be sent to the client for the required action.',
      })}
      okText={t('inspection.violation.approveSuccess.ok', { defaultValue: 'OK' })}
      loading={loading}
      onOk={onOk}
      onCancel={onCancel || onOk}
    />
  );
};

export default InspectionViolationApproveSuccessModal;
