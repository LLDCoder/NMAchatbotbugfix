import React from 'react';
import { Button, Modal } from 'antd';
import checkIcon from '../assets/images/check.svg';
import './InspectionLightConfirmModal.less';

type InspectionLightConfirmModalProps = {
  visible: boolean;
  title: React.ReactNode;
  content: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  className?: string;
  iconSrc?: string;
  loading?: boolean;
  variant?: 'primary' | 'danger';
  keyboard?: boolean;
  maskClosable?: boolean;
  onOk: () => void | Promise<void>;
  onCancel?: () => void;
};

const InspectionLightConfirmModal: React.FC<InspectionLightConfirmModalProps> = ({
  visible,
  title,
  content,
  okText = 'OK',
  cancelText,
  className,
  iconSrc = checkIcon,
  loading = false,
  variant = 'primary',
  keyboard = false,
  maskClosable = false,
  onOk,
  onCancel,
}) => (
  <Modal
    centered
    closable={false}
    destroyOnClose
    footer={null}
    keyboard={keyboard}
    maskClosable={maskClosable}
    onCancel={onCancel || onOk}
    visible={visible}
    className={['inspection-light-confirm-modal', className].filter(Boolean).join(' ')}
  >
    <div className="inspection-light-confirm-modal__content">
      <img className="inspection-light-confirm-modal__icon" src={iconSrc} alt="" aria-hidden="true" />
      <div className="inspection-light-confirm-modal__main">
        <div className="inspection-light-confirm-modal__copy">
          <h3 className="inspection-light-confirm-modal__title">{title}</h3>
          <div className="inspection-light-confirm-modal__message">{content}</div>
        </div>
        <div className="inspection-light-confirm-modal__footer">
          {cancelText ? (
            <Button
              className={[
                'inspection-light-confirm-modal__button',
                variant === 'danger'
                  ? 'inspection-light-confirm-modal__button--danger-outline'
                  : 'inspection-light-confirm-modal__button--outline',
              ].join(' ')}
              disabled={loading}
              onClick={onCancel}
            >
              {cancelText}
            </Button>
          ) : null}
          <Button
            className={[
              'inspection-light-confirm-modal__button',
              variant === 'danger'
                ? 'inspection-light-confirm-modal__button--danger'
                : 'inspection-light-confirm-modal__primary-button',
            ].join(' ')}
            loading={loading}
            onClick={onOk}
          >
            {okText}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
);

export default InspectionLightConfirmModal;
