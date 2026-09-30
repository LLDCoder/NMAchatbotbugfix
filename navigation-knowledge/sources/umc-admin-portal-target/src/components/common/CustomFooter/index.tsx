import React from "react";
import { CustomButton } from "@/components/common";
import { useTranslation } from "react-i18next";
import "./index.less";
export interface CustomFooterProps {
  rightContent?: React.ReactNode;
  onBack?: () => void;
  needBack?: boolean;
}
const CustomFooter: React.FC<CustomFooterProps> = ({
  rightContent,
  onBack,
  needBack = true,
}) => {
  const { t } = useTranslation();

  if (!rightContent) {
    return null;
  }

  let hasBrowserHistory = false;

  try {
    hasBrowserHistory =
      typeof window !== "undefined" && window.history.length > 1;
  } catch {
    hasBrowserHistory = false;
  }

  const shouldRenderBackButton = needBack && (Boolean(onBack) || hasBrowserHistory);

  return (
    <div className="custom-footer form-footer detail-action-footer">
      <div className="custom-footer__back-slot">
        {shouldRenderBackButton && <CustomButton
          variant="outline"
          text={t("common.back")}
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              window.history.go(-1);
            }
          }}
        />}
      </div>
      <div className="custom-footer__actions">{rightContent}</div>
    </div>
  );
};

export default CustomFooter;
