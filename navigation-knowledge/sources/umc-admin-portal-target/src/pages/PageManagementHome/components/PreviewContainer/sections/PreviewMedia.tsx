import React, { useState } from "react";
import Vector2 from "@/assets/images/Vector2.svg";
import WaveBg from "@/assets/images/wave.png";
import new1 from "@/assets/images/new1.png";
import new2 from "@/assets/images/new2.png";
import new3 from "@/assets/images/new3.png";
import new4 from "@/assets/images/new4.png";
import new5 from "@/assets/images/new5.png";
import { ui, news, events, pick } from "./sampleData";
import type { MediaItem } from "./sampleData";

/**
 * Preview Media section — mirrors the public MediaSection (.six) structure.
 * News / Events tabs switch locally only; renders bilingual sample data
 * (no moment, no API). One large card + a 2x2 grid of small cards; titles
 * and dates follow the page-local `lan`.
 */
const imgs: Record<number, string> = {
  1: new1,
  2: new2,
  3: new3,
  4: new4,
  5: new5,
};

const MediaCard: React.FC<{ item: MediaItem; lan: string; big?: boolean }> = ({
  item,
  lan,
  big,
}) => (
  <div
    className={`pv-media-card ${big ? "big" : "small"}`}
    style={{ backgroundImage: `url(${imgs[item.imgIndex]})` }}
  >
    <div className="pv-media-cont">
      <div className="pv-media-title">{pick(item.title, lan)}</div>
      <div className="pv-media-date">{pick(item.date, lan)}</div>
    </div>
  </div>
);

const PreviewMedia: React.FC<{ lan: string }> = ({ lan }) => {
  const [tab, setTab] = useState<"news" | "events">("news");
  const data = tab === "news" ? news : events;

  return (
    <div className="pv-media" style={{ backgroundImage: `url(${WaveBg})` }}>
      <div className="pv-sec-head">
        <div className="pv-sec-title">{pick(ui.media.title, lan)}</div>
        <div className="pv-viewall-btn white">
          {pick(ui.media.viewAll, lan)}
          <img src={Vector2} alt="" />
        </div>
      </div>

      <div className="pv-media-tabs">
        <div
          className={`pv-media-tab ${tab === "news" ? "active" : ""}`}
          onClick={() => setTab("news")}
        >
          {pick(ui.media.newsTab, lan)}
        </div>
        <div
          className={`pv-media-tab ${tab === "events" ? "active" : ""}`}
          onClick={() => setTab("events")}
        >
          {pick(ui.media.eventsTab, lan)}
        </div>
      </div>

      <div className="pv-media-grid">
        <div className="pv-media-left">
          {data[0] && <MediaCard item={data[0]} lan={lan} big />}
        </div>
        <div className="pv-media-right">
          {data.slice(1, 5).map((it) => (
            <MediaCard key={it.id} item={it} lan={lan} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreviewMedia;
