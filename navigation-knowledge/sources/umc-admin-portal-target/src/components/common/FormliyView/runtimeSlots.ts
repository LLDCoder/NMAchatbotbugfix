import type { ReactNode } from "react";

/**
 * Runtime extension contract for components rendered from a Formily schema.
 * The schema and designer remain unchanged; the host page supplies optional
 * content by matching a component instance and one of its declared slots.
 */
export const FORMILY_COMPONENT_KEYS = {
  CARD: "Card",
  DATA_LIST: "DataList",
  ID_SELECTOR: "IDSelector",
  PARTNER_LIST: "PartnerList",
  PROFILE_FORM: "ProfileForm",
  SOCIAL_MEDIA_MANAGER: "SocialMediaManager",
} as const;

export const FORMILY_SLOT_KEYS = {
  AFTER_CONTENT: "afterContent",
  BEFORE_CONTENT: "beforeContent",
  FOOTER: "footer",
  HEADER_EXTRA: "headerExtra",
  ITEM_STATUS: "itemStatus",
  LABEL_EXTRA: "labelExtra",
} as const;

export type FormilyComponentKey =
  (typeof FORMILY_COMPONENT_KEYS)[keyof typeof FORMILY_COMPONENT_KEYS];

export type FormilySlotKey =
  (typeof FORMILY_SLOT_KEYS)[keyof typeof FORMILY_SLOT_KEYS];

export interface FormilyRenderSlotContext {
  /** Component type requesting runtime content. */
  componentKey: FormilyComponentKey;
  /** Identifies one schema instance when a form contains repeated component types. */
  designableId?: string;
  /** Named insertion point exposed by the component. */
  slotKey: FormilySlotKey;
  /** Runtime component data used for item-level matching when required. */
  componentProps: Readonly<Record<string, unknown>>;
}

export type FormilyRenderSlot = (
  context: FormilyRenderSlotContext,
) => ReactNode;
