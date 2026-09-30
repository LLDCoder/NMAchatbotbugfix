import React, { type ReactNode } from 'react';
import InspectionLightConfirmModal from '@/pages/InspectionCommon/components/InspectionLightConfirmModal';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

type CancelTaskModalProps = {
  visible: boolean;
  title: ReactNode;
  content: ReactNode;
  cancelText: ReactNode;
  confirmText: ReactNode;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

const CancelTaskModal: React.FC<CancelTaskModalProps> = ({
  visible,
  title,
  content,
  cancelText,
  confirmText,
  loading = false,
  onCancel,
  onConfirm,
}) => {
  const handleCancel = () => {
    if (!loading) {
      onCancel();
    }
  };

  return (
    <InspectionLightConfirmModal
      visible={visible}
      title={title}
      content={content}
      okText={confirmText}
      cancelText={cancelText}
      className="inspection-light-confirm-modal--cancel"
      iconSrc={inspectionFigmaAssets.modalConfirm.warningRed}
      loading={loading}
      variant="danger"
      maskClosable={!loading}
      keyboard={!loading}
      onCancel={handleCancel}
      onOk={onConfirm}
    />
  );
};

export default CancelTaskModal;
