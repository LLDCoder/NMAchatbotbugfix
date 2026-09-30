import React from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import "./index.less";
import type { TooltipProps } from "antd";
import type { ReactNode } from "react";
 
export type PersonalPhotoTooltipProps = Omit<
  TooltipProps,
  "title" | "children"
> & {
  children?: ReactNode;
};
 
const PersonalPhotoTooltip: React.FC<PersonalPhotoTooltipProps> = ({
  children,
  placement = "bottom",
  overlayClassName = "",
  ...props
}) => {
  const { t } = useTranslation();
  return (
    <Tooltip
      {...props}
      title={
        <div>
          <div>{t("individualIdentity.personalPhotoTooltip.line1")}</div>
          <div>{t("individualIdentity.personalPhotoTooltip.line2")}</div>
          <div>{t("individualIdentity.personalPhotoTooltip.line3")}</div>
          <div>{t("individualIdentity.personalPhotoTooltip.line4")}</div>
        </div>
      }
      placement={placement}
      overlayClassName={`personal-photo-tooltip ${overlayClassName}`}
      color="#fff"
      overlayInnerStyle={{
        color: "#333",
        fontSize: "14px",
        lineHeight: 1.5,
        padding: "12px 16px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        border: "1px solid #e8e8e8",
      }}
    >
      {children || <QuestionCircleOutlined className="personal-photo-tooltip__icon" />}
    </Tooltip>
  );
};
 
export default PersonalPhotoTooltip;
