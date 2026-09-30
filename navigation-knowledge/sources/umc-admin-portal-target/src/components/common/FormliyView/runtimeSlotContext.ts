import { createContext } from "react";
import type { FormilyRenderSlot } from "./runtimeSlots";

export const FormilyRenderSlotContext = createContext<
  FormilyRenderSlot | undefined
>(undefined);
