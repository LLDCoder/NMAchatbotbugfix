import type { FC } from "react";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import { getContentApplicationStatusStyleClass } from "./statusStyle";
import "./index.less";

interface ContentApplicationStatusProps {
  layout?: "stacked" | "inline";
  status?: string | null;
  statusId: string | number | null | undefined;
}

const CONTENT_APPLICATION_SUB_STATUS_PATTERN =
  /^([\s\S]*?)\s*[(（]\s*([^()（）]*?)\s*[)）]\s*$/;

const CONTENT_APPLICATION_SUB_STATUS_TONE_MAP: Record<string, string> = {
  dispositionverified: "success",
  dispositionnotverified: "danger",
};

const splitContentApplicationStatus = (status?: string | null) => {
  const statusText = typeof status === "string" ? status.trim() : "";
  if (!statusText) {
    return { mainStatus: "", subStatus: "" };
  }

  const matched = statusText.match(CONTENT_APPLICATION_SUB_STATUS_PATTERN);
  const mainStatus = (matched?.[1] ?? "").trim();
  const subStatus = (matched?.[2] ?? "").trim();

  if (!matched || !mainStatus || !subStatus) {
    return { mainStatus: statusText, subStatus: "" };
  }

  return { mainStatus, subStatus };
};

const getContentApplicationSubStatusTone = (subStatus: string) =>
  CONTENT_APPLICATION_SUB_STATUS_TONE_MAP[
    subStatus.replace(/\s+/g, "").toLowerCase()
  ] ?? "default";

export const ContentApplicationStatus: FC<ContentApplicationStatusProps> = ({
  layout = "stacked",
  status,
  statusId,
}) => {
  const { mainStatus, subStatus } = splitContentApplicationStatus(status);

  return (
    <div
      className={`content-application-status content-application-status--${layout}`}
    >
      <OverflowTooltip
        title={mainStatus || undefined}
        color="#fff"
        overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
        placement="topLeft"
        className={`content-application-status__main ${getContentApplicationStatusStyleClass(
          statusId,
        )}`}
      >
        {mainStatus || "-"}
      </OverflowTooltip>
      {subStatus ? (
        <OverflowTooltip
          title={subStatus}
          color="#fff"
          overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
          placement="topLeft"
          className={`content-application-status__sub content-application-status__sub--${getContentApplicationSubStatusTone(
            subStatus,
          )}`}
        >
          {subStatus}
        </OverflowTooltip>
      ) : null}
    </div>
  );
};
