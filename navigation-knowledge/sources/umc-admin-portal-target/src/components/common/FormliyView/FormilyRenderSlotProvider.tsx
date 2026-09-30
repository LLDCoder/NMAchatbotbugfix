import type { PropsWithChildren } from "react";
import { FormilyRenderSlotContext } from "./runtimeSlotContext";
import type { FormilyRenderSlot } from "./runtimeSlots";

interface FormilyRenderSlotProviderProps {
  renderSlot?: FormilyRenderSlot;
}

// Keeps page-specific runtime additions outside reusable schema components.
export default function FormilyRenderSlotProvider({
  children,
  renderSlot,
}: PropsWithChildren<FormilyRenderSlotProviderProps>) {
  return (
    <FormilyRenderSlotContext.Provider value={renderSlot}>
      {children}
    </FormilyRenderSlotContext.Provider>
  );
}
