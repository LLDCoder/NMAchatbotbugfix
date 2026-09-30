import React, { useMemo, useState } from "react";
import i18n from "@/localization/config";
import PreviewContainer from "../components/PreviewContainer";
import { readHomePreviewData } from "../previewStorage";
import "./index.less";
import "./mobile.less";
import WebIcon from "@/assets/images/PageManagementHome-Desktop.svg";
import TabletIcon from "@/assets/images/PageManagementHome-Vector.svg";
import MobileIcon from "@/assets/images/PageManagementHome-DeviceMobileCamera.svg";

// Per PRD the editor's Preview button opens the whole homepage in a new
// window with its own language toggle and a Web / Tablet / Mobile device
// toggle (default Web). Draft data arrives via sessionStorage, so no save
// or API round-trip is needed.
// Web/Tablet scale the desktop canvas; Mobile renders 1:1 inside an
// iPhone 17 frame (393 x 852 viewport) with a dedicated mobile layout.
const DEVICE_WIDTHS: Record<string, number> = {
  web: 1200,
  tablet: 768,
  mobile: 393,
};

// The preview canvas markup is authored against the editor column width.
const CANVAS_BASE_WIDTH = 773;

const LAN_KEY = "cms-homepage-preview-lan";
const DEVICE_KEY = "cms-homepage-preview-device";

const DEVICE_ICONS: Record<string, string> = {
  web: WebIcon,
  tablet: TabletIcon,
  mobile: MobileIcon,
};

const PageManagementHomePreview: React.FC = () => {
  const data = useMemo(readHomePreviewData, []);
  // Persist the toggles so a reload (incl. dev HMR full-reload) does not
  // silently reset the selection back to English / Web.
  const [lan, setLanState] = useState<string>(
    () => sessionStorage.getItem(LAN_KEY) || (data?.lan === "ar" ? "ar" : "en"),
  );
  const [device, setDeviceState] = useState<string>(
    () => sessionStorage.getItem(DEVICE_KEY) || "web",
  );
  const tPreview = useMemo(
    () => i18n.getFixedT(lan === "ar" ? "ar" : "en"),
    [lan],
  );
  const setLan = (v: string) => {
    sessionStorage.setItem(LAN_KEY, v);
    setLanState(v);
  };
  const setDevice = (v: string) => {
    sessionStorage.setItem(DEVICE_KEY, v);
    setDeviceState(v);
  };

  const pageClassName =
    lan === "ar" ? "home-preview-page lan-ar" : "home-preview-page";

  if (!data) {
    return (
      <div className={pageClassName}>
        <div className="preview-empty">{tPreview("CMS.preview.noData")}</div>
      </div>
    );
  }

  const width = DEVICE_WIDTHS[device];

  return (
    <div className={pageClassName}>
      <div className="preview-toolbar">
        <div className="toolbar-group">
          <div
            className={lan === "en" ? "toolbar-item active" : "toolbar-item"}
            onClick={() => setLan("en")}
          >
            {tPreview("CMS.common.english")}
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
              <img
                className="toolbar-device-icon"
                src={DEVICE_ICONS[d]}
                alt=""
                aria-hidden="true"
              />
              {tPreview(`CMS.preview.device.${d}`)}
            </div>
          ))}
        </div>
      </div>
      <div className="preview-stage">
        {device === "mobile" ? (
          /* iPhone 17 frame: 393 x 852 viewport rendered 1:1 with the
             dedicated mobile layout (.pv-mobile overrides). */
          <div className="iphone-frame">
            <div className="iphone-screen">
              <div className="pv-mobile">
                <PreviewContainer
                  crrent={0}
                  lan={lan}
                  mode="preview"
                  isMobile
                  bannerList={data.bannerList}
                  aboutData={data.aboutParam}
                  partnershipData={data.partnerParam}
                  footerData={data.footerParam}
                  selectArea={() => {}}
                />
              </div>
            </div>
            <div className="iphone-island" />
            <div className="iphone-home-bar" />
          </div>
        ) : (
          /* Layout width stays at the canvas design base (773) so nothing
             overflows; zoom alone scales the visual size to the device width. */
          <div
            className="preview-canvas"
            style={{ width: CANVAS_BASE_WIDTH, zoom: width / CANVAS_BASE_WIDTH }}
          >
            <PreviewContainer
              crrent={0}
              lan={lan}
              mode="preview"
              bannerList={data.bannerList}
              aboutData={data.aboutParam}
              partnershipData={data.partnerParam}
              footerData={data.footerParam}
              selectArea={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PageManagementHomePreview;
