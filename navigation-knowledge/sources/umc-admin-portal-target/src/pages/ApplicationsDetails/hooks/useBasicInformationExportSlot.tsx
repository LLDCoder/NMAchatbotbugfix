import { useMemo } from "react";
import {
  FORMILY_COMPONENT_KEYS,
  FORMILY_SLOT_KEYS,
  type FormilyRenderSlot,
} from "@/components/common/FormliyView/runtimeSlots";
import BasicInformationExportButton from "../components/BasicInformationExportButton";

// serviceCode 7 exposes an Export action in the Basic Information card header.
const BASIC_INFORMATION_EXPORT_SERVICE_CODE = "7";
// Basic Information Card instance id in the current serviceCode 7 schema.
// Update this designableId here if the backend schema is replaced.
const BASIC_INFORMATION_CARD_DESIGNABLE_ID = "e0dky1dr6y0";

interface UseBasicInformationExportSlotParams {
  serviceCode?: string | number | null;
  applicationId?: number;
}

/**
 * Page-owned runtime slot that renders an Export button in the Basic
 * Information card header for serviceCode 7 review pages.
 */
export function useBasicInformationExportSlot({
  serviceCode,
  applicationId,
}: UseBasicInformationExportSlotParams): FormilyRenderSlot | undefined {
  const normalizedServiceCode = String(serviceCode ?? "");

  return useMemo<FormilyRenderSlot | undefined>(() => {
    if (normalizedServiceCode !== BASIC_INFORMATION_EXPORT_SERVICE_CODE) {
      return undefined;
    }

    return ({ componentKey, designableId, slotKey }) => {
      const matchesConfiguredSlot =
        componentKey === FORMILY_COMPONENT_KEYS.CARD &&
        slotKey === FORMILY_SLOT_KEYS.HEADER_EXTRA &&
        designableId === BASIC_INFORMATION_CARD_DESIGNABLE_ID;
      if (!matchesConfiguredSlot) return undefined;

      return <BasicInformationExportButton applicationId={applicationId} />;
    };
  }, [applicationId, normalizedServiceCode]);
}
