import { useContext } from "react";
import { FormilyRenderSlotContext } from "./runtimeSlotContext";

// Schema components call this hook only at their declared insertion points.
export function useFormilyRenderSlot() {
  return useContext(FormilyRenderSlotContext);
}
