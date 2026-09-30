export type DraftFileOrLinkType = "link" | "file";

export const DEFAULT_DRAFT_FILE_OR_LINK_TYPE: DraftFileOrLinkType = "file";

export const resolveDraftFileOrLinkTypeFieldName = (
  valueFieldName: string,
): string => `${valueFieldName}Type`;

export const resolveDraftFileOrLinkPasswordFieldName = (
  valueFieldName: string,
): string => `${valueFieldName}Password`;

export const isDraftFileOrLinkType = (
  value: unknown,
): value is DraftFileOrLinkType => value === "link" || value === "file";
