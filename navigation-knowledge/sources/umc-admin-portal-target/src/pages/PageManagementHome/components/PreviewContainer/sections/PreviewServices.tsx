import React, { useState } from "react";
import Frame1 from "@/assets/images/Frame1.svg";
import Frame2 from "@/assets/images/Frame2.svg";
import Frame3 from "@/assets/images/Frame3.svg";
import Frame4 from "@/assets/images/Frame4.svg";
import Vector2 from "@/assets/images/Vector2.svg";
import bannericon from "@/assets/images/bannericon.svg";
import leftgrey from "@/assets/images/leftgrey.svg";
import rightglod from "@/assets/images/rightglod.svg";
import { ui, serviceCategories, services, pick } from "./sampleData";

/**
 * Preview Services section — mirrors public ServicesSection (.one) at 0.458
 * scale: head row (title + View All) / category tab row (scroll arrows on the
 * end side) / horizontal card list. Matches public behavior: cards show only
 * icon + name + category tag by default, action buttons appear on hover.
 * Category tabs switch locally only; no selection/submit logic is triggered.
 */
const icons = [Frame1, Frame2, Frame3, Frame4];

const PreviewServices: React.FC<{ lan: string }> = ({ lan }) => {
  const [menu, setMenu] = useState(0);
  const list =
    menu === 0 ? services : services.filter((s) => s.categoryId === menu);

  return (
    <div className="pv-services">
      <div className="pv-sec-head">
        <div className="pv-sec-title">{pick(ui.services.title, lan)}</div>
        <div className="pv-viewall-btn">
          {pick(ui.services.viewAll, lan)}
          <img src={Vector2} alt="" />
        </div>
      </div>

      <div className="pv-svc-tabrow">
        <div className="pv-svc-tabs">
          {serviceCategories.map((c) => (
            <div
              key={c.id}
              className={`pv-svc-tab ${menu === c.id ? "active" : ""}`}
              onClick={() => setMenu(c.id)}
            >
              {pick(c.name, lan)}
            </div>
          ))}
        </div>
        <div className="pv-svc-scroll">
          <img src={leftgrey} alt="" />
          <img src={rightglod} alt="" />
        </div>
      </div>

      <div className="pv-svc-list">
        {list.map((s) => (
          <div className="pv-svc-card" key={s.id}>
            <div className="pv-svc-card-top">
              <img className="pv-svc-icon" src={icons[s.iconIndex % 4]} alt="" />
              <div className="pv-svc-name">{pick(s.name, lan)}</div>
              <span className="pv-svc-cat">{pick(s.category, lan)}</span>
            </div>
            <div className="pv-svc-card-btns">
              <button className="pv-svc-learn">
                {pick(ui.services.learnMore, lan)}
              </button>
              <button className="pv-svc-start">
                {pick(ui.services.startService, lan)}
                <img src={bannericon} alt="" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreviewServices;
