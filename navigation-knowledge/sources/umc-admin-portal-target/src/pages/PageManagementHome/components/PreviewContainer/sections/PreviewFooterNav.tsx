import React from "react";
import footer5 from "@/assets/images/footer5.svg";
import { footerNav, pick } from "./sampleData";

/**
 * Preview footer bottom nav — mirrors the public Footer footer-main-bottom:
 * three bilingual link columns + logo. Display-only; follows the page-local
 * `lan` for bilingual copy and RTL.
 */
const PreviewFooterNav: React.FC<{ lan: string }> = ({ lan }) => (
  <div className="pv-footernav">
    {footerNav.map((col, i) => (
      <div className="pv-fn-col" key={i}>
        <div className="pv-fn-title">{pick(col.title, lan)}</div>
        <div className="pv-fn-list">
          {col.items.map((it, j) => (
            <p className="pv-fn-link" key={j}>
              {pick(it, lan)}
            </p>
          ))}
        </div>
      </div>
    ))}
    <div className="pv-fn-logo">
      <img src={footer5} alt="" />
    </div>
  </div>
);

export default PreviewFooterNav;
