import { Button, Checkbox, Empty, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import './ModifyViolationModal.less';

export type ModifyViolationModalItem = {
  key: string;
  title: string;
};

type ModifyViolationModalProps = {
  visible: boolean;
  reportedViolations: ModifyViolationModalItem[];
  draftKeys: string[];
  loading: boolean;
  submitting: boolean;
  onToggle: (key: string, checked: boolean) => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
};

function ModifyViolationModal({
  visible,
  reportedViolations,
  draftKeys,
  loading,
  submitting,
  onToggle,
  onReset,
  onCancel,
  onSave,
}: ModifyViolationModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      centered
      destroyOnClose
      title={t('inspection.violation.modify.title')}
      className="inspection-violation-details__modal inspection-violation-details__modify-modal"
      onCancel={onCancel}
      footer={[
        <Button
          key="reset"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--outline inspection-violation-details__modal-button--left"
          onClick={onReset}
          disabled={submitting || loading}
        >
          {t('inspection.violation.modify.reset')}
        </Button>,
        <Button
          key="cancel"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--outline"
          onClick={onCancel}
          disabled={submitting || loading}
        >
          {t('inspection.violation.modify.cancel')}
        </Button>,
        <Button
          key="save"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--primary"
          onClick={onSave}
          disabled={loading || submitting || !draftKeys.length}
        >
          {t('inspection.violation.modify.save')}
        </Button>,
      ]}
    >
      <div className="inspection-violation-details__modify-list">
        {reportedViolations.length ? reportedViolations.map((item) => {
          const checked = draftKeys.includes(item.key);

          return (
            <Checkbox
              key={item.key}
              className={`inspection-violation-details__modify-option ${checked ? 'is-selected' : ''}`}
              checked={checked}
              disabled={loading || submitting}
              onChange={(event) => onToggle(item.key, event.target.checked)}
            >
              <span className="inspection-violation-details__modify-option-title">{item.title}</span>
            </Checkbox>
          );
        }) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading
              ? t('inspection.violation.modify.loadingReasons')
              : t('inspection.violation.modify.noReasons')}
          />
        )}
      </div>
    </Modal>
  );
}

export default ModifyViolationModal;
