import { useMemo } from "react";
import {
  FORMILY_COMPONENT_KEYS,
  FORMILY_SLOT_KEYS,
  type FormilyRenderSlot,
} from "@/components/common/FormliyView/runtimeSlots";
import FahrReviewTargetStatus from "@/pages/ApplicationsDetails/components/FahrReviewTargetStatus";
import type { FahrReviewAction } from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import type { FahrReviewSubmissionPayload } from "@/pages/ApplicationsDetails/components/FahrReviewSubmissionModal";
import type {
  FahrReviewRequestDetails,
  FahrReviewTarget,
} from "@/services/fahr";
import {
  findFahrTargetByPersonType,
  findFahrTargetForPartner,
} from "../fahrTargets";

interface UseFahrFormilySlotsParams {
  serviceCode?: string | number | null;
  reviewDetails?: FahrReviewRequestDetails | null;
  isActionAvailable?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
  ) => boolean;
  onAction?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
    payload?: FahrReviewSubmissionPayload,
  ) => Promise<void> | void;
}

const CHIEF_EDITOR_SERVICE_CODES = ["801", "803", "1201", "1203"] as const;
const CHIEF_EDITOR_DESIGNABLE_ID_MAP: Record<
  (typeof CHIEF_EDITOR_SERVICE_CODES)[number],
  string
> = {
  "801": "rh0iijlc8ey",
  "803": "sn3imbpdqj6",
  "1201": "o99foxlo5vm",
  "1203": "u15aa4c52fn",
};
const NEW_INDIVIDUAL_PARTNER_SERVICE_CODES = [
  "804",
  "905",
  "1205",
] as const;
const NEW_INDIVIDUAL_PARTNER_DESIGNABLE_ID_MAP: Record<
  (typeof NEW_INDIVIDUAL_PARTNER_SERVICE_CODES)[number],
  string
> = {
  "804": "e2o1sex73h7",
  "905": "6bcszqx3a4z",
  "1205": "r9cy7ymvlec",
};
const FOREIGN_CORRESPONDENT_SERVICE_CODES = ["1801", "1802"] as const;

/**
 * Page-owned registry that maps a service and schema instance to a runtime slot.
 * Update the designableId here when the corresponding backend schema is replaced.
 * targetPersonType selects a backend FAHR target; item slots resolve it per item.
 */
const FAHR_FORMILY_SLOT_CONFIGS = [
  {
    serviceCode: "4",
    designableId: "z5mssu1degg",
    componentKey: FORMILY_COMPONENT_KEYS.CARD,
    slotKey: FORMILY_SLOT_KEYS.HEADER_EXTRA,
    targetPersonType: "ForeignJournalist",
  },
  ...FOREIGN_CORRESPONDENT_SERVICE_CODES.map((serviceCode) => ({
    serviceCode,
    designableId: "vjbdk1pu33o",
    componentKey: FORMILY_COMPONENT_KEYS.CARD,
    slotKey: FORMILY_SLOT_KEYS.HEADER_EXTRA,
    targetPersonType: "ForeignCorrespondent",
  })),
  ...CHIEF_EDITOR_SERVICE_CODES.map((serviceCode) => ({
    serviceCode,
    designableId: CHIEF_EDITOR_DESIGNABLE_ID_MAP[serviceCode],
    componentKey: FORMILY_COMPONENT_KEYS.CARD,
    slotKey: FORMILY_SLOT_KEYS.HEADER_EXTRA,
    targetPersonType: "ChiefEditor",
  })),
  ...NEW_INDIVIDUAL_PARTNER_SERVICE_CODES.map((serviceCode) => ({
    serviceCode,
    designableId: NEW_INDIVIDUAL_PARTNER_DESIGNABLE_ID_MAP[serviceCode],
    componentKey: FORMILY_COMPONENT_KEYS.PARTNER_LIST,
    slotKey: FORMILY_SLOT_KEYS.ITEM_STATUS,
    targetPersonType: "NewIndividualPartner",
    matchPartnerTarget: true,
  })),
  {
    serviceCode: "8007",
    designableId: "8sv0hdms0ek",
    componentKey: FORMILY_COMPONENT_KEYS.SOCIAL_MEDIA_MANAGER,
    slotKey: FORMILY_SLOT_KEYS.LABEL_EXTRA,
    targetPersonType: "SocialMediaManager",
  },
  {
    serviceCode: "80021",
    designableId: "8sv0hdms0ek",
    componentKey: FORMILY_COMPONENT_KEYS.SOCIAL_MEDIA_MANAGER,
    slotKey: FORMILY_SLOT_KEYS.LABEL_EXTRA,
    targetPersonType: "SocialMediaManager",
  },
  {
    serviceCode: "8008",
    designableId: "l512wt5crgf",
    componentKey: FORMILY_COMPONENT_KEYS.CARD,
    slotKey: FORMILY_SLOT_KEYS.HEADER_EXTRA,
    targetPersonType: "VisitingInfluencer",
  },
] as const;

export function useFahrFormilySlots({
  serviceCode,
  reviewDetails,
  isActionAvailable,
  onAction,
}: UseFahrFormilySlotsParams): FormilyRenderSlot | undefined {
  const normalizedServiceCode = String(serviceCode);
  const slotConfig = FAHR_FORMILY_SLOT_CONFIGS.find(
    (config) => config.serviceCode === normalizedServiceCode,
  );
  const target = slotConfig && !("matchPartnerTarget" in slotConfig)
    ? "targetPersonType" in slotConfig
      ? findFahrTargetByPersonType(
          reviewDetails,
          slotConfig.targetPersonType,
        )
      : reviewDetails?.targets?.[0]
    : undefined;

  return useMemo<FormilyRenderSlot | undefined>(() => {
    if (!slotConfig) return undefined;
    if (!("matchPartnerTarget" in slotConfig) && !target) return undefined;

    return ({
      componentKey,
      componentProps,
      designableId,
      slotKey,
    }) => {
      const matchesConfiguredSlot =
        designableId === slotConfig.designableId &&
        componentKey === slotConfig.componentKey &&
        slotKey === slotConfig.slotKey;
      if (!matchesConfiguredSlot) return undefined;

      // PartnerList supplies the current item so one status is bound to one target.
      const resolvedTarget = "matchPartnerTarget" in slotConfig
        ? findFahrTargetForPartner(
            reviewDetails,
            slotConfig.targetPersonType,
            componentProps.partner,
          )
        : target;

      return resolvedTarget ? (
        <FahrReviewTargetStatus
          applicationId={reviewDetails?.applicationId}
          target={resolvedTarget}
          isActionAvailable={isActionAvailable}
          onAction={onAction}
        />
      ) : undefined;
    };
  }, [
    isActionAvailable,
    onAction,
    reviewDetails,
    slotConfig,
    target,
  ]);
}
