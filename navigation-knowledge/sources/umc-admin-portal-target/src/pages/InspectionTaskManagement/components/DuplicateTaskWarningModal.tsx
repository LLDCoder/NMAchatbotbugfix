import React from 'react';
import { Button, Modal } from 'antd';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';
import './DuplicateTaskWarningModal.less';

type DuplicateTaskWarningModalProps = {
  visible: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  cancelText: React.ReactNode;
  confirmText: React.ReactNode;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

const secondaryButtonClassName = [
  'inspection-duplicate-task-modal__action',
  'inspection-duplicate-task-modal__action--secondary',
].join(' ');

const primaryButtonClassName = [
  'inspection-duplicate-task-modal__action',
  'inspection-duplicate-task-modal__action--primary',
].join(' ');

const getMessageLines = (message: React.ReactNode) => {
  if (typeof message !== 'string') return [];
  return message
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const DuplicateTaskWarningModal: React.FC<DuplicateTaskWarningModalProps> = ({
  visible,
  title,
  message,
  cancelText,
  confirmText,
  confirmLoading = false,
  onCancel,
  onConfirm,
}) => {
  const messageLines = getMessageLines(message);

  const handleCancel = () => {
    if (!confirmLoading) {
      onCancel();
    }
  };

  return (
    <Modal
      className="inspection-duplicate-task-modal"
      visible={visible}
      centered
      closable={false}
      destroyOnClose
      footer={null}
      keyboard={!confirmLoading}
      maskClosable={false}
      onCancel={handleCancel}
    >
      <div className="inspection-duplicate-task-modal__body">
        <img
          className="inspection-duplicate-task-modal__icon"
          src={inspectionFigmaAssets.modalConfirm.warningGold}
          alt=""
          aria-hidden="true"
        />
        <div className="inspection-duplicate-task-modal__content">
          <div className="inspection-duplicate-task-modal__copy">
            <h3 className="inspection-duplicate-task-modal__title">{title}</h3>
            <div className="inspection-duplicate-task-modal__message">
              {messageLines.length ? (
                messageLines.map((line) => (
                  <p key={line} className="inspection-duplicate-task-modal__message-line">
                    {line}
                  </p>
                ))
              ) : (
                <div className="inspection-duplicate-task-modal__message-node">{message}</div>
              )}
            </div>
          </div>
          <div className="inspection-duplicate-task-modal__actions">
            <Button className={secondaryButtonClassName} disabled={confirmLoading} onClick={handleCancel}>
              {cancelText}
            </Button>
            <Button className={primaryButtonClassName} loading={confirmLoading} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateTaskWarningModal;
