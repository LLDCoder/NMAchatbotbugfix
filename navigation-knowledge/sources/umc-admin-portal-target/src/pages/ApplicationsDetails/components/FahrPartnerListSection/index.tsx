import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import PartnerList, {
  type PartnerListItem,
} from "@/components/BusinessCmps/PartnerList/PartnerList";
import { isArabicLanguage } from "@/localization/language";
import type { FahrReviewAction } from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import FahrReviewTargetStatus from "@/pages/ApplicationsDetails/components/FahrReviewTargetStatus";
import type { FahrReviewSubmissionPayload } from "@/pages/ApplicationsDetails/components/FahrReviewSubmissionModal";
import type {
  FahrReviewRequestDetails,
  FahrReviewTarget,
} from "@/services/fahr";
import { matchFahrTargetsForPartners } from "../../fahrTargets";

import "./index.less";

export interface FahrPartnerListSectionProps {
  applicationId?: number;
  establishment?: unknown;
  reviewDetails?: FahrReviewRequestDetails | null;
  onFahrAction?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
    payload?: FahrReviewSubmissionPayload,
  ) => Promise<void> | void;
  isFahrActionAvailable?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
  ) => boolean;
}

interface FahrUnmatchedTargetListProps {
  applicationId?: number;
  targets: FahrReviewTarget[];
  onFahrAction?: FahrPartnerListSectionProps["onFahrAction"];
  isFahrActionAvailable?: FahrPartnerListSectionProps["isFahrActionAvailable"];
}

type Partner = PartnerListItem & {
  partnerTypeCode?: string | number | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  uaeNumber?: string | null;
  number?: string | number | null;
  address?: string | null;
  addressName?: string | null;
  emirateObj?: { nameEn?: string | null; nameAr?: string | null } | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";

const firstText = (...values: unknown[]): string =>
  values.map(text).find(Boolean) || "";

const localizedName = (value: unknown, isArabic: boolean): string => {
  const record = toRecord(value);
  return firstText(
    isArabic ? record.nameAr : record.nameEn,
    isArabic ? record.nameEn : record.nameAr,
    record.name,
  );
};

const optionalId = (value: unknown): string | number | null =>
  typeof value === "string" || typeof value === "number" ? value : null;

const FahrUnmatchedTargetList: React.FC<FahrUnmatchedTargetListProps> = ({
  applicationId,
  targets,
  onFahrAction,
  isFahrActionAvailable,
}) => {
  if (!targets.length) return null;

  return (
    <div className="fahr-partner-list-section fahr-partner-list-section__unmatched-targets">
      {targets.map((target) => (
        <div
          className="fahr-partner-list-section__unmatched-target"
          key={target.targetId}
        >
          <span className="fahr-partner-list-section__unmatched-target-name">
            {target.fullName || String(target.targetId)}
          </span>
          <FahrReviewTargetStatus
            applicationId={applicationId}
            target={target}
            isActionAvailable={isFahrActionAvailable}
            onAction={onFahrAction}
          />
        </div>
      ))}
    </div>
  );
};

const FahrPartnerListSection: React.FC<FahrPartnerListSectionProps> = ({
  applicationId,
  establishment,
  reviewDetails,
  onFahrAction,
  isFahrActionAvailable,
}) => {
  const { i18n } = useTranslation();
  const isArabic = isArabicLanguage(i18n.language);
  const partners = useMemo(() => {
    const establishmentRecord = toRecord(establishment);
    const detailedPartners = Array.isArray(establishmentRecord.partnerList)
      ? establishmentRecord.partnerList
      : [];
    const summaryPartners = Array.isArray(establishmentRecord.partners)
      ? establishmentRecord.partners
      : [];
    const source = detailedPartners.length ? detailedPartners : summaryPartners;
    const establishmentAddress = firstText(establishmentRecord.addressName);
    return source.reduce<Partner[]>((result, partner) => {
      const item = toRecord(partner) as Partner;
      if (!Object.keys(item).length) return result;
      result.push({
        ...item,
        name: firstText(
          item.name,
          isArabic ? item.fullNameAr : item.fullNameEn,
          isArabic ? item.fullNameEn : item.fullNameAr,
        ),
        identifier: firstText(
          item.number,
          item.emiratesId,
          item.uaeNumber,
          item.passportNumber,
        ),
        partnerTypeName: firstText(item.partnerTypeName),
        partnerType: firstText(item.partnerType),
        location: firstText(
          item.address,
          localizedName(item.emirateObj, isArabic),
          establishmentAddress,
        ),
        id: optionalId(item.id),
      });
      return result;
    }, []);
  }, [establishment, isArabic]);
  const matches = useMemo(
    () =>
      matchFahrTargetsForPartners(
        reviewDetails,
        "EstablishmentPartner",
        partners,
      ),
    [partners, reviewDetails],
  );
  const unmatchedTargets = useMemo(() => {
    const matchedTargetIds = new Set(
      matches.flatMap((target) => (target ? [target.targetId] : [])),
    );
    return (reviewDetails?.targets || []).filter(
      (target) =>
        target.personType === "EstablishmentPartner" &&
        !matchedTargetIds.has(target.targetId),
    );
  }, [matches, reviewDetails?.targets]);

  return (
    <section className="fahr-partner-list-section">
      <PartnerList
        params={partners}
        variant="fahrReview"
        showPartnerType
        renderStatusSlot={(_, index) => {
          const target = matches[index];
          return target ? (
            <FahrReviewTargetStatus
              applicationId={applicationId}
              target={target}
              isActionAvailable={isFahrActionAvailable}
              onAction={onFahrAction}
            />
          ) : null;
        }}
      />
      <FahrUnmatchedTargetList
        applicationId={applicationId}
        targets={unmatchedTargets}
        isFahrActionAvailable={isFahrActionAvailable}
        onFahrAction={onFahrAction}
      />
    </section>
  );
};

export default FahrPartnerListSection;
