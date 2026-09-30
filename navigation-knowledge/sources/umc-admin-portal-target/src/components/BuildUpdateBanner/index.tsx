import { Button } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getBuildUpdatePromptVisible,
  subscribeBuildUpdatePrompt,
} from "@/utils/buildVersionWatcher";
import "./index.less";

function refreshCurrentPage() {
  window.location.reload();
}

function BuildUpdateBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(getBuildUpdatePromptVisible);

  useEffect(
    () =>
      subscribeBuildUpdatePrompt((nextVisible) => {
        setVisible(nextVisible);
      }),
    [],
  );

  if (!visible) {
    return null;
  }

  return (
    <div className="build-update-banner" role="status">
      <div className="build-update-banner__content">
        <strong className="build-update-banner__title">
          {t("appUpdate.title")}
        </strong>
        <span className="build-update-banner__description">
          {t("appUpdate.description")}
        </span>
      </div>
      <Button
        className="build-update-banner__button"
        type="primary"
        onClick={refreshCurrentPage}
      >
        {t("appUpdate.refresh")}
      </Button>
    </div>
  );
}

export default BuildUpdateBanner;
