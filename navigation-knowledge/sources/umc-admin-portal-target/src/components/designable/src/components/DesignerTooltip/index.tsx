import React from "react";
import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import "../FormItemWithHtmlTooltip/index.less";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

function isHtmlString(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmpty(str: string | undefined): boolean {
  if (!str) return true;
  const text = str.replace(/<[^>]*>/g, "").trim();
  return text.length === 0 && !/<img\s/i.test(str) && !/<video\s/i.test(str);
}

/** Designer canvas: same pattern as FormItemWithHtmlTooltip + Form.Item question icon. */
export function renderDesignerTooltipIcon(html: string | undefined) {
  if (!html || typeof html !== "string" || isEffectivelyEmpty(html))
    return null;
  const title = isHtmlString(html) ? (
    <div
      className="html-tooltip-content"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      style={{ maxWidth: 800 }}
    />
  ) : (
    html
  );
  return (
    <Tooltip title={title} overlayInnerStyle={{ maxWidth: 800 }}>
      <span style={{ display: "inline-flex", marginLeft: 4, lineHeight: 1 }}>
        <QuestionCircleOutlined
          style={{ color: "rgba(0,0,0,0.45)", cursor: "help", fontSize: 14 }}
        />
      </span>
    </Tooltip>
  );
}
