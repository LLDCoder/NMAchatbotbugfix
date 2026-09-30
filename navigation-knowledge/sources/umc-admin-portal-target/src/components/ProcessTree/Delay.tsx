import { useState } from "react";
import Clock from "@/assets/icons/Clock";
import type { IConfig, TNodeType } from ".";
import Node from "./Node";
import { useTranslation } from "react-i18next";

interface IApprovalProps {
  config: IConfig;
  onClick: () => {};
  onInsertNode: (type: TNodeType) => {};
  onDelNode: () => void;
}

export default function Delay({
  config,
  onClick,
  onInsertNode,
  onDelNode,
}: IApprovalProps) {
  const { t } = useTranslation();
  const [showError, setShowError] = useState(false);
  const [errorInfo, setErrorInfo] = useState("");

  function getName(unit: string) {
    switch (unit) {
      case "D":
        return t("workflow.processTree.delay.units.day");
      case "H":
        return t("workflow.processTree.delay.units.hour");
      case "M":
        return t("workflow.processTree.delay.units.minute");
      default:
        return t("workflow.processTree.delay.units.unknown");
    }
  }
  function content() {
    if (config.props.type === "FIXED") {
      return t("workflow.processTree.delay.wait", {
        time: config.props.time,
        unit: getName(config.props.unit),
      });
    } else if (config.props.type === "AUTO") {
      return t("workflow.processTree.delay.until", {
        dateTime: config.props.dateTime,
      });
    } else {
      return null;
    }
  }

  return (
    <Node
      title={config?.name}
      onClick={onClick}
      onDelNode={onDelNode}
      onInsertNode={onInsertNode}
      placeholder={t("workflow.processTree.delay.placeholder")}
      headerBgc="#f25643"
      showError={showError}
      errorInfo={errorInfo}
      content={content()}
      headerIcon={<Clock />}
    />
  );
}
