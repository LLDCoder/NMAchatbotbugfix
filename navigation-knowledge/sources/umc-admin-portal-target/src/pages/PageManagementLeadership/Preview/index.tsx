import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PreviewContainer from "../components/PreviewContainer";
import { readLeadershipPreviewData } from "../previewStorage";
import "./index.less";

// Standalone new-window preview for the Leadership page (PRD): language
// toggle + Web / Tablet / Mobile device toggle, draft via sessionStorage.
const DEVICE_WIDTHS: Record<string, number> = {
  web: 1200,
  tablet: 768,
  mobile: 390,
};

// The preview canvas markup is authored against the editor column width.
const CANVAS_BASE_WIDTH = 773;

const PageManagementLeadershipPreview: React.FC = () => {
  const { t } = useTranslation();
  const data = useMemo(readLeadershipPreviewData, []);
  const [lan, setLan] = useState<string>(data?.lan === "ar" ? "ar" : "en");
  const [device, setDevice] = useState<string>("web");

  if (!data) {
    return (
      <div className="home-preview-page">
        <div className="preview-empty">{t("CMS.preview.noData")}</div>
      </div>
    );
  }

  const width = DEVICE_WIDTHS[device];

  return (
    <div className="home-preview-page">
      <div className="preview-toolbar">
        <div className="toolbar-group">
          <div
            className={lan === "en" ? "toolbar-item active" : "toolbar-item"}
            onClick={() => setLan("en")}
          >
            {t("CMS.common.english")}
          </div>
          <div
            className={lan === "ar" ? "toolbar-item active" : "toolbar-item"}
            onClick={() => setLan("ar")}
          >
            عربي
          </div>
        </div>
        <div className="toolbar-group">
          {(["web", "tablet", "mobile"] as const).map((d) => (
            <div
              key={d}
              className={device === d ? "toolbar-item active" : "toolbar-item"}
              onClick={() => setDevice(d)}
            >
              {t(`CMS.preview.device.${d}`)}
            </div>
          ))}
        </div>
      </div>
      <div className="preview-stage">
        {/* Layout width stays at the canvas design base (773) so nothing
            overflows; zoom alone scales the visual size to the device width. */}
        <div
          className="preview-canvas"
          style={{ width: CANVAS_BASE_WIDTH, zoom: width / CANVAS_BASE_WIDTH }}
        >
          <PreviewContainer
            crrent={0}
            lan={lan}
            mode="preview"
            chairmanData={data.chairmanData}
            directorData={data.directorsData}
            managementData={data.managementData}
            selcetArea={() => {}}
          />
        </div>
      </div>
    </div>
  );
};

export default PageManagementLeadershipPreview;
