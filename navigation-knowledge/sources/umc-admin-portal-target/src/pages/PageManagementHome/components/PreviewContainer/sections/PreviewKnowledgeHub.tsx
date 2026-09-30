import React from "react";
import KnowledgeBg from "@/assets/images/KnowledgeCenter.png";
import Vector3 from "@/assets/images/Vector3.svg";
import Vector2 from "@/assets/images/Vector2.svg";
import { ui, knowledgeHub, pick } from "./sampleData";

/**
 * Preview Knowledge Hub section — mirrors the public KnowledgeHub (.three)
 * structure. The public version is static i18n copy anyway; this renders the
 * default collapsed state (title + group titles + arrows) with bilingual samples.
 */
const PreviewKnowledgeHub: React.FC<{ lan: string }> = ({ lan }) => {
  return (
    <div
      className="pv-knowledge"
      style={{ backgroundImage: `url(${KnowledgeBg})` }}
    >
      <div className="pv-kh-inner">
        <img src={Vector3} className="pv-kh-star" alt="" />
        <div className="pv-kh-title">{pick(ui.knowledgeHub.title, lan)}</div>
        <div className="pv-kh-list">
          {knowledgeHub.map((item) => (
            <div className="pv-kh-item" key={item.slug}>
              <div className="pv-kh-item-title">{pick(item.title, lan)}</div>
              <img src={Vector2} className="pv-kh-arrow" alt="" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreviewKnowledgeHub;
