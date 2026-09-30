import React from 'react';
import { Button, Checkbox, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

type PreVisitChecklistModalProps = {
  visible: boolean;
  checkedKeys: string[];
  loading?: boolean;
  onCheckedKeysChange: (keys: string[]) => void;
  onCancel: () => void;
  onStart: () => void | Promise<void>;
};

const preVisitItems = [
  {
    key: 'taskDetails',
    titleKey: 'inspection.execution.preVisitTaskDetailsTitle',
    descriptionKey: 'inspection.execution.preVisitTaskDetailsDescription',
    icon: inspectionFigmaAssets.preVisitChecklistIcons.clipboardText,
  },
  {
    key: 'targetDetails',
    titleKey: 'inspection.execution.preVisitTargetDetailsTitle',
    descriptionKey: 'inspection.execution.preVisitTargetDetailsDescription',
    icon: inspectionFigmaAssets.preVisitChecklistIcons.buildings,
  },
  {
    key: 'toolsReady',
    titleKey: 'inspection.execution.preVisitToolsReadyTitle',
    descriptionKey: 'inspection.execution.preVisitToolsReadyDescription',
    icon: inspectionFigmaAssets.preVisitChecklistIcons.toolbox,
  },
];

const PreVisitChecklistModal: React.FC<PreVisitChecklistModalProps> = ({
  visible,
  checkedKeys,
  loading = false,
  onCheckedKeysChange,
  onCancel,
  onStart,
}) => {
  const { t } = useTranslation();
  const isStartDisabled = checkedKeys.length !== preVisitItems.length;

  return (
    <Modal
      title={t('inspection.execution.preVisitChecklist')}
      visible={visible}
      className="inspection-start-visit__standard-modal inspection-start-visit__previsit-modal"
      centered
      destroyOnClose
      maskClosable={false}
      keyboard={!loading}
      closable={!loading}
      onCancel={onCancel}
      footer={(
        <div className="inspection-start-visit__modal-footer-actions">
          <Button className="inspection-start-visit__outline-button" disabled={loading} onClick={onCancel}>
            {t('inspection.common.cancel')}
          </Button>
          <Button
            className="inspection-start-visit__primary-button"
            loading={loading}
            disabled={isStartDisabled}
            onClick={onStart}
          >
            {t('inspection.execution.startVisit')}
          </Button>
        </div>
      )}
    >
      <Checkbox.Group
        value={checkedKeys}
        onChange={(values) => onCheckedKeysChange(values as string[])}
        className="inspection-start-visit__previsit-list"
      >
        {preVisitItems.map((item) => (
          <Checkbox key={item.key} value={item.key} className="inspection-start-visit__previsit-item">
            <span className="inspection-start-visit__previsit-card">
              <span className="inspection-start-visit__previsit-icon">
                <img src={item.icon} alt="" />
              </span>
              <span className="inspection-start-visit__previsit-text">
                <strong className="inspection-start-visit__previsit-title">{t(item.titleKey)}</strong>
                <span className="inspection-start-visit__previsit-description">{t(item.descriptionKey)}</span>
              </span>
            </span>
          </Checkbox>
        ))}
      </Checkbox.Group>
    </Modal>
  );
};

export default PreVisitChecklistModal;
