import React from 'react';
import { Modal } from 'antd';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

type ShowRemoveViolationConfirmParams = {
  title: string;
  content: React.ReactNode;
  okText: string;
  cancelText: string;
  onOk: () => void | Promise<void>;
  onCancel?: () => void;
};

type ShowInspectionVisitConfirmParams = ShowRemoveViolationConfirmParams & {
  className: string;
  iconSrc: string;
  iconClassName: string;
  okButtonClassName: string;
  cancelButtonClassName: string;
  okButtonIcon?: React.ReactNode;
};

const showInspectionVisitConfirm = ({
  title,
  content,
  okText,
  cancelText,
  onOk,
  className,
  iconSrc,
  iconClassName,
  okButtonClassName,
  cancelButtonClassName,
  okButtonIcon,
  onCancel,
}: ShowInspectionVisitConfirmParams) => {
  const confirmModal = Modal.confirm({
    className,
    title,
    content,
    centered: true,
    icon: React.createElement('img', {
      alt: '',
      className: iconClassName,
      src: iconSrc,
    }),
    okText,
    cancelText,
    autoFocusButton: null,
    maskClosable: false,
    okButtonProps: {
      className: okButtonClassName,
      ...(okButtonIcon ? { icon: okButtonIcon } : {}),
    },
    cancelButtonProps: {
      className: cancelButtonClassName,
    },
    onOk,
    onCancel,
  });

  return confirmModal;
};

export const showAccessedSuccessfullyConfirm = (params: Omit<
  ShowInspectionVisitConfirmParams,
  'className' | 'iconClassName' | 'okButtonClassName' | 'cancelButtonClassName'
>) => {
  showInspectionVisitConfirm({
    ...params,
    className: 'inspection-start-visit__decision-modal inspection-start-visit__accessed-success-confirm',
    iconClassName: 'inspection-start-visit__accessed-success-confirm-icon',
    okButtonClassName: 'inspection-start-visit__primary-button inspection-start-visit__accessed-success-action',
    cancelButtonClassName: 'inspection-start-visit__outline-button inspection-start-visit__accessed-success-action',
  });
};

export const showRemoveViolationConfirm = (params: ShowRemoveViolationConfirmParams) => {
  showInspectionVisitConfirm({
    ...params,
    className: 'inspection-start-visit__decision-modal inspection-start-visit__remove-violation-confirm',
    iconSrc: inspectionFigmaAssets.modalConfirm.warningGold,
    iconClassName: 'inspection-start-visit__remove-violation-icon',
    okButtonClassName: 'inspection-start-visit__primary-button inspection-start-visit__remove-violation-action',
    cancelButtonClassName: 'inspection-start-visit__outline-button inspection-start-visit__remove-violation-action',
  });
};

export const showDeselectViolationConfirm = (params: ShowRemoveViolationConfirmParams) => {
  showInspectionVisitConfirm({
    ...params,
    className: 'inspection-start-visit__decision-modal inspection-start-visit__remove-violation-confirm inspection-start-visit__deselect-violation-confirm',
    iconSrc: inspectionFigmaAssets.modalConfirm.warningRed,
    iconClassName: 'inspection-start-visit__remove-violation-icon',
    okButtonClassName: 'inspection-start-visit__danger-button inspection-start-visit__remove-violation-action',
    cancelButtonClassName: 'inspection-start-visit__danger-outline-button inspection-start-visit__remove-violation-action',
  });
};

export const showLeavePageConfirm = (params: ShowRemoveViolationConfirmParams) => {
  showInspectionVisitConfirm({
    ...params,
    className: 'inspection-start-visit__decision-modal inspection-start-visit__accessed-success-confirm inspection-start-visit__leave-confirm',
    iconSrc: inspectionFigmaAssets.modalConfirm.warningGold,
    iconClassName: 'inspection-start-visit__accessed-success-confirm-icon',
    okButtonClassName: 'inspection-start-visit__primary-button inspection-start-visit__leave-confirm-action',
    cancelButtonClassName: 'inspection-start-visit__outline-button inspection-start-visit__leave-confirm-action',
  });
};
