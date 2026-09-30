import React from "react";
import { CustomButton } from "@/components/common";
import EmptyBoxIcon from "@/assets/images/empty.svg";
import "./index.less";

interface EmptyBoxProps {
  title?: string;
  buttonText?: string;
  customClassName?: string;
  onClick?: () => void;
  hasButton?: boolean;
  icon?: string;
}

const EmptyBox: React.FC<EmptyBoxProps> = ({
  title = "No data",
  buttonText = "Add",
  customClassName = "",
  onClick,
  hasButton = false,
  icon = EmptyBoxIcon,
}) => {
  return (
    <div className={`empty-state ${customClassName}`}>
      <img src={icon} alt="" className="empty-icon" />
      <p className="empty-text">{title}</p>
      {hasButton && onClick && (
        <CustomButton text={buttonText} variant="outline" onClick={onClick} />
      )}
    </div>
  );
};

export default EmptyBox;
