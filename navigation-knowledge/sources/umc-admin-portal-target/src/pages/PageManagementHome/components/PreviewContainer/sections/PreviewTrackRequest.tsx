import React from "react";
import Trackbac from "@/assets/images/Trackbac.png";
import SearchTwo from "@/assets/images/SearchTwo.svg";
import { ui, pick } from "./sampleData";

/**
 * Preview Track Request section — mirrors the public TrackRequest (.two)
 * block (non-configurable per PRD). Title + gold-bordered search field,
 * display-only; follows the page-local `lan` for bilingual copy and RTL.
 */
const PreviewTrackRequest: React.FC<{ lan: string }> = ({ lan }) => (
  <div
    className="pv-track"
    style={{ backgroundImage: `url(${Trackbac})` }}
  >
    <div className="pv-track-title">{pick(ui.trackRequest.title, lan)}</div>
    <div className="pv-track-search">
      <span className="pv-track-ph">{pick(ui.trackRequest.placeholder, lan)}</span>
      <span className="pv-track-btn">
        <img src={SearchTwo} alt="" />
      </span>
    </div>
  </div>
);

export default PreviewTrackRequest;
