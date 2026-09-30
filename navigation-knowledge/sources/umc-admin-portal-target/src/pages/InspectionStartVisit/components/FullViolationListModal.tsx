import React from 'react';
import { Button, Checkbox, Empty, Modal, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { getLocalizedText } from '../../InspectionCommon/helpers';

type FullViolationOption = {
  key: string;
  violationDescription?: string | null;
  violationDescriptionAr?: string | null;
};

type FullViolationGroups = {
  licensing: FullViolationOption[];
  contentGeneral: FullViolationOption[];
  contentStandalone: FullViolationOption[];
};

type FullViolationListModalProps = {
  visible: boolean;
  loading?: boolean;
  value: string[];
  saveDisabled?: boolean;
  disabledKeys?: string[];
  groups: FullViolationGroups;
  onChange: (keys: string[]) => void;
  onCancel: () => void;
  onSave: () => void;
};

const getViolationOptionLabel = (violation: FullViolationOption) => getLocalizedText(
  violation.violationDescription,
  violation.violationDescriptionAr,
  '',
) || '-';

const FullViolationListModal: React.FC<FullViolationListModalProps> = ({
  visible,
  loading = false,
  value,
  saveDisabled = false,
  disabledKeys = [],
  groups,
  onChange,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const hasContentOptions = groups.contentGeneral.length > 0 || groups.contentStandalone.length > 0;
  const hasViolationOptions = groups.licensing.length > 0 || hasContentOptions;
  const disabledKeySet = new Set(disabledKeys);
  const modalTitle = (
    <div className="inspection-start-visit__full-list-title">
      <div className="inspection-start-visit__full-list-title-text">{t('inspection.execution.fullViolationList')}</div>
      <div className="inspection-start-visit__full-list-title-hint">{t('inspection.execution.fullViolationListHint')}</div>
    </div>
  );
  const renderViolationOption = (violation: FullViolationOption) => {
    const checked = value.includes(violation.key);
    const disabled = loading || disabledKeySet.has(violation.key);
    return (
      <Checkbox
        key={violation.key}
        value={violation.key}
        disabled={disabled}
        className={`inspection-start-visit__full-list-option${checked ? ' inspection-start-visit__full-list-option--selected' : ''}${disabled ? ' inspection-start-visit__full-list-option--disabled' : ''}`}
      >
        <span className="inspection-start-visit__full-list-option-title">{getViolationOptionLabel(violation)}</span>
      </Checkbox>
    );
  };

  return (
    <Modal
      title={modalTitle}
      visible={visible}
      onCancel={onCancel}
      centered
      destroyOnClose
      className="inspection-start-visit__standard-modal inspection-start-visit__full-list-modal"
      footer={(
        <div className="inspection-start-visit__modal-footer-actions">
          <Button className="inspection-start-visit__outline-button" onClick={onCancel}>
            {t('inspection.common.cancel')}
          </Button>
          <Button
            className="inspection-start-visit__primary-button"
            loading={loading}
            disabled={loading || !hasViolationOptions || saveDisabled}
            onClick={onSave}
          >
            {t('inspection.common.save')}
          </Button>
        </div>
      )}
    >
      <Spin spinning={loading}>
        {hasViolationOptions ? (
          <Checkbox.Group value={value} onChange={(keys) => onChange(keys as string[])} className="inspection-start-visit__full-list">
            <div className="inspection-start-visit__full-list-section">
              <h3 className="inspection-start-visit__full-list-section-title">{t('inspection.execution.licensingViolation')}</h3>
              <div className="inspection-start-visit__full-list-grid">
                {groups.licensing.map(renderViolationOption)}
              </div>
            </div>
            {hasContentOptions ? (
              <div className="inspection-start-visit__full-list-section">
                <h3 className="inspection-start-visit__full-list-section-title">{t('inspection.execution.contentViolation')}</h3>
                {groups.contentGeneral.length ? (
                  <div className="inspection-start-visit__full-list-general">
                    <div className="inspection-start-visit__full-list-general-title">{t('inspection.execution.generalContentViolation')}</div>
                    <div className="inspection-start-visit__full-list-grid">
                      {groups.contentGeneral.map(renderViolationOption)}
                    </div>
                  </div>
                ) : null}
                {groups.contentStandalone.length ? (
                  <div className="inspection-start-visit__full-list-grid">
                    {groups.contentStandalone.map(renderViolationOption)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Checkbox.Group>
        ) : (
          <Empty
            className="inspection-start-visit__full-list-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('inspection.execution.noChecklist')}
          />
        )}
      </Spin>
    </Modal>
  );
};

export default FullViolationListModal;
