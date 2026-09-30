import React from "react";
import emailgold from "@/assets/images/emailgold.png";
import ArrowCircleRight from "@/assets/images/ArrowCircleRight.svg";
import { ui, pick } from "./sampleData";

/**
 * Preview footer subscribe card — mirrors the public Footer subscribe area.
 * Title + description + email input placeholder + submit arrow. Display-only;
 * follows the page-local `lan` for bilingual copy and RTL.
 */
const PreviewSubscribe: React.FC<{ lan: string }> = ({ lan }) => (
  <div className="pv-subscribe">
    <div className="pv-sub-title">{pick(ui.subscribe.title, lan)}</div>
    <div className="pv-sub-desc">{pick(ui.subscribe.desc, lan)}</div>
    <div className="pv-sub-input">
      <img className="pv-sub-mail" src={emailgold} alt="" />
      <span className="pv-sub-ph">{pick(ui.subscribe.placeholder, lan)}</span>
      <img className="pv-sub-arrow" src={ArrowCircleRight} alt="" />
    </div>
  </div>
);

export default PreviewSubscribe;
