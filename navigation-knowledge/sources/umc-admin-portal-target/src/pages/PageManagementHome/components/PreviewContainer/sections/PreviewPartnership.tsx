import React from "react";
import Trackbac from "@/assets/images/Trackbac.png";
import PartnershipWatermark from "@/assets/images/Partnership.svg";
import type { PartnershipParam } from "@/services/cms";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";

/**
 * Preview Partnership section — mirrors the public PartnershipSection (.five)
 * at 0.458 scale: Trackbac background band + the large "PARTNERSHIP"
 * watermark art + a horizontally scrolling row of gold-bordered logo cards.
 * Per PRD, a logo with a configured link opens it in a new tab; the click is
 * stopped from bubbling so it does not trigger module selection in the canvas.
 */
const formatLink = (link: string): string => {
  if (!link) return "";
  return link.startsWith("http://") || link.startsWith("https://")
    ? link
    : `https://${link}`;
};

const PreviewPartnership: React.FC<{ partnershipData: PartnershipParam }> = ({
  partnershipData,
}) => (
  <div className="pv-partnership">
    <div
      className="pv-pt-band"
      style={{ backgroundImage: `url(${Trackbac})` }}
    />
    <img className="pv-pt-watermark" src={PartnershipWatermark} alt="" />
    <div className="pv-pt-scroll">
      {(partnershipData?.partners || []).map((item, index) => (
        <div className="pv-pt-card" key={index}>
          {item.logo &&
            (item.link ? (
              <a
                href={formatLink(item.link)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <AuthenticatedDocumentImage src={item.logo} alt="" />
              </a>
            ) : (
              <AuthenticatedDocumentImage src={item.logo} alt="" />
            ))}
        </div>
      ))}
    </div>
  </div>
);

export default PreviewPartnership;
