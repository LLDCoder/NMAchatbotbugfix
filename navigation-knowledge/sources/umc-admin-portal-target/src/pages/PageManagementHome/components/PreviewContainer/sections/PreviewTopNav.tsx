import React from "react";
import eagle from "@/assets/images/eagle.svg";
import rightion from "@/assets/images/rightion.svg";
import SearchTwo from "@/assets/images/SearchTwo.svg";
import language from "@/assets/images/language.svg";
import man from "@/assets/images/man.svg";
import loginWhite from "@/assets/images/loginWhite.svg";
import MenuList from "@/assets/images/MenuList.svg";
import { ui, topNavMenu, pick } from "./sampleData";

/**
 * Preview top nav — mirrors the public Header (.header-publics) glass capsule:
 * eagle logo + 5 menu items (About NMA / Services / Knowledge Hub / Media /
 * Contact Us) + search / language / user / Login icons on the end side.
 * Display-only; follows the page-local `lan` for bilingual copy and RTL.
 */
const PreviewTopNav: React.FC<{ lan: string }> = ({ lan }) => (
  <div className="pv-topnav">
    <div className="pv-tn-left">
      <img className="pv-tn-eagle" src={eagle} alt="" />
      <div className="pv-tn-menu">
        {topNavMenu.map((m, i) => (
          <span className="pv-tn-item" key={i}>
            {pick(m.label, lan)}
            {m.hasDropdown && (
              <img className="pv-tn-caret" src={rightion} alt="" />
            )}
          </span>
        ))}
      </div>
    </div>
    <div className="pv-tn-actions">
      <img className="pv-tn-ico" src={SearchTwo} alt="" />
      <img className="pv-tn-ico pv-tn-lang" src={language} alt="" />
      {/* Hamburger replaces the menu/profile/login cluster on the mobile preview */}
      <img className="pv-tn-ico pv-tn-burger" src={MenuList} alt="" />
      <img className="pv-tn-ico pv-tn-man" src={man} alt="" />
      {/* Arabic uses a text pill — loginWhite.svg has the English label baked in as paths */}
      {lan === "ar" ? (
        <span className="pv-tn-login-pill">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M2 13C2 13 3.5 9.5 8 9.5C12.5 9.5 14 13 14 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {pick(ui.login, lan)}
        </span>
      ) : (
        <img className="pv-tn-login" src={loginWhite} alt="" />
      )}
    </div>
  </div>
);

export default PreviewTopNav;
