import type { FC, ReactElement, ReactNode } from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import CustomButton from "@/components/common/CustomButton";
import "./index.less";

export interface ResponsiveFilterModalField {
  key: string;
  label?: ReactNode;
  element: ReactElement;
  compactOnly?: boolean;
}

export interface ResponsiveFilterModalProps {
  visible: boolean;
  fields: ResponsiveFilterModalField[];
  onCancel: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  title?: ReactNode;
  width?: number;
}

const ResponsiveFilterModal: FC<ResponsiveFilterModalProps> = ({
  visible,
  fields,
  onCancel,
  onApply,
  applyDisabled = false,
  title,
  width = 960,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={title ?? t("common.filter")}
      visible={visible}
      onCancel={onCancel}
      width={width}
      centered
      footer={
        <div className="filter-modal-footer">
          <div className="filter-modal-footer__actions">
            <CustomButton
              variant="outline"
              customClassName="filter-modal-footer__cancel"
              onClick={onCancel}
            >
              {t("common.cancel")}
            </CustomButton>
            <CustomButton
              type="default"
              variant="primary"
              customClassName="filter-modal-footer__apply"
              disabled={applyDisabled}
              onClick={onApply}
            >
              {t("common.apply")}
            </CustomButton>
          </div>
        </div>
      }
      className="filter-modal"
    >
      <div className="filter-modal-content">
        {fields.map((field) => (
          <div
            key={field.key}
            className={[
              "filter-modal-item",
              field.compactOnly ? "filter-modal-item--compact-only" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {field.label && (
              <div className="filter-modal-item-label">{field.label}</div>
            )}
            {field.element}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ResponsiveFilterModal;
