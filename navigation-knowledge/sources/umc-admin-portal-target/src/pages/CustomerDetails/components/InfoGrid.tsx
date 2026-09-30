import React from "react";
import type { InfoItem } from "../types";

const InfoGrid: React.FC<{
  items: InfoItem[];
  columns?: number;
}> = ({ items, columns = 2 }) => (
  <div
    className="info-grid"
    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
  >
    {items.map((item) => (
      <div
        key={item.key}
        data-key={item.key}
        className="info-item"
        style={
          item.fullWidth
            ? { gridColumn: "1 / -1" }
            : item.span
            ? { gridColumn: `span ${Math.min(item.span, columns)}` }
            : undefined
        }
      >
        <div className="info-label">{item.label}</div>
        <div className="info-value">{item.value}</div>
      </div>
    ))}
  </div>
);

export default InfoGrid;
