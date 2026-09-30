import React, { useState, useEffect, useMemo, useRef } from "react";
import FormliyView from "@/components/common/FormliyView";
import {
  getServiceApplicationPayment,
  mapServiceApplicationPaymentToFeeQuote,
  type FeeQuoteResponse,
  type ServiceApplicationPaymentApiResponse,
} from "@/services/services";
import { getVisibleFormilyList } from "./stepVisibility";
import "./index.less";
import FeeQuoteDisplay from "./FeeQuoteDisplay";
import ReviewPersonalInformationIcp from "@/components/common/ReviewPersonalInformationIcp";
import AdminModifyChangeSummary from "./AdminModifyChangeSummary";
import {
  buildAdminModifyChangeSummary,
  shouldDisplayAdminModifyChangeSummary,
} from "./modifyChangeSummaryRules";
import type { PartnerItem } from "@/components/designable/src/components/PartnerList/PartnerListField";
import type { FormilyRenderSlot } from "@/components/common/FormliyView/runtimeSlots";
import {
  hasSelectedActivityCode,
  NEWSPAPER_REPRINT_ACTIVITY_CODES,
} from "@/components/common/formilyActivityRules";
import type { Service302MaterialStatusStateChange } from "@/utils/service302MaterialStatus";

type FormilyStepItem = Record<string, unknown> & {
  formData?: string;
};

interface FormilyReviewListProps {
  formilyList: FormilyStepItem[];
  formilyData: Record<string, unknown>[];
  /** When set, Services Fees are loaded from payment-center for this application. */
  applicationId?: number;
  applicationDetailId?: number;
  taskId?: string;
  materialStatusEditable?: boolean;
  onMaterialStatusStateChange?: (
    change: Service302MaterialStatusStateChange,
  ) => void;
  icpProfileId?: string | number;
  serviceCode?: string | number | null;
  renderSlot?: FormilyRenderSlot;
  presentationPattern?: "disabled" | "readPretty";
  service905OwnerPartners?: PartnerItem[];
}

const ICP_REVIEW_PERSONAL_INFORMATION_SERVICE_IDS = new Set([
  801,
  1,
  6,
  1201,
  1801,
]);

/** Service ids whose ICP Personal Information card starts collapsed. */
const ICP_PERSONAL_INFORMATION_DEFAULT_COLLAPSED_SERVICE_IDS = new Set([1801]);

function normalizePositiveNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const normalizedValue = Number(String(value).trim());
  return Number.isFinite(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : undefined;
}

function getVisibleStepEmiratesId(
  visibleSteps: FormilyStepItem[],
): string | number | undefined {
  for (const step of visibleSteps) {
    try {
      const parsedFormData =
        typeof step?.formData === "string"
          ? JSON.parse(step.formData)
          : step?.formData;
      const emiratesId = parsedFormData?.formValues?.idSelector?.emiratesId;

      if (typeof emiratesId === "string" && emiratesId.trim()) {
        return emiratesId;
      }
      if (typeof emiratesId === "number") {
        return emiratesId;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

const FormilyReviewList: React.FC<FormilyReviewListProps> = ({
  formilyList,
  formilyData,
  applicationId,
  applicationDetailId,
  taskId,
  materialStatusEditable,
  onMaterialStatusStateChange,
  icpProfileId,
  serviceCode,
  service905OwnerPartners,
  renderSlot,
}) => {
  const [paymentQuote, setPaymentQuote] = useState<FeeQuoteResponse | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(() => Boolean(applicationId));
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const isIcpPersonalInfoCollapsedByDefault = useMemo(() => {
    const normalizedServiceCode = normalizePositiveNumber(serviceCode);
    return (
      normalizedServiceCode !== undefined &&
      ICP_PERSONAL_INFORMATION_DEFAULT_COLLAPSED_SERVICE_IDS.has(
        normalizedServiceCode,
      )
    );
  }, [serviceCode]);
  const [icpPersonalInfoExpanded, setIcpPersonalInfoExpanded] = useState(
    () => !isIcpPersonalInfoCollapsedByDefault,
  );
  /**
   * serviceCode arrives asynchronously (details request), so the lazy initial
   * state above still runs with an empty serviceCode. Re-apply the default
   * expansion whenever the resolved serviceCode actually changes, without
   * overriding a manual toggle afterwards.
   */
  const appliedDefaultServiceCodeRef = useRef<string | number | null | undefined>(
    serviceCode,
  );
  useEffect(() => {
    if (appliedDefaultServiceCodeRef.current === serviceCode) return;
    appliedDefaultServiceCodeRef.current = serviceCode;
    setIcpPersonalInfoExpanded(!isIcpPersonalInfoCollapsedByDefault);
  }, [isIcpPersonalInfoCollapsedByDefault, serviceCode]);
  const visibleFormilySteps = useMemo(
    () => getVisibleFormilyList(formilyList || [], serviceCode),
    [formilyList, serviceCode],
  );

  const modifyChangeSections = useMemo(
    () =>
      shouldDisplayAdminModifyChangeSummary(serviceCode)
        ? buildAdminModifyChangeSummary(visibleFormilySteps)
        : [],
    [serviceCode, visibleFormilySteps],
  );
  const shouldShowPaymentQuote = Number(paymentQuote?.totalAmount ?? 0) > 0;
  const normalizedIcpProfileId = useMemo(
    () => normalizePositiveNumber(icpProfileId),
    [icpProfileId],
  );
  const resolvedIcpProfileId = useMemo(
    () =>
      getVisibleStepEmiratesId(visibleFormilySteps) ?? normalizedIcpProfileId,
    [normalizedIcpProfileId, visibleFormilySteps],
  );
  const shouldShowIcpPersonalInformation = useMemo(() => {
    const normalizedServiceCode = normalizePositiveNumber(serviceCode);
    if (
      resolvedIcpProfileId === undefined ||
      normalizedServiceCode === undefined ||
      !ICP_REVIEW_PERSONAL_INFORMATION_SERVICE_IDS.has(normalizedServiceCode)
    ) {
      return false;
    }

    const shouldHideForSelectedActivity =
      normalizedServiceCode === 1201 &&
      hasSelectedActivityCode(
        formilyList,
        NEWSPAPER_REPRINT_ACTIVITY_CODES,
      );

    return !shouldHideForSelectedActivity;
  }, [formilyList, resolvedIcpProfileId, serviceCode]);

  useEffect(() => {
    if (applicationId == null || !Number.isFinite(applicationId) || applicationId <= 0) {
      setPaymentQuote(null);
      setPaymentError(null);
      setPaymentLoading(false);
      return;
    }
    let cancelled = false;
    setPaymentQuote(null);
    setPaymentLoading(true);
    setPaymentError(null);
    getServiceApplicationPayment(applicationId)
      .then((res) => {
        if (cancelled) return;
        const body = res as unknown as ServiceApplicationPaymentApiResponse;
        if (body.isSuccess && body.data) {
          setPaymentQuote(mapServiceApplicationPaymentToFeeQuote(body.data));
        } else {
          setPaymentQuote(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentQuote(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPaymentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <div className="FormilyReviewList-container FormilyReviewList">
      <AdminModifyChangeSummary
        sections={modifyChangeSections}
        serviceCode={serviceCode}
      />
      {visibleFormilySteps.map((step, index) => (
        <div className="FormilyReviewList__step" key={`form-step-${index}`}>
          <FormliyView
            formData={step || formilyData[index] || {}}
            disabled={true}
            pattern="readOnly"
            formMode="review"
            profileId={icpProfileId}
            serviceCode={serviceCode}
            service905OwnerPartners={service905OwnerPartners}
            renderSlot={renderSlot}
            applicationId={applicationId}
            applicationDetailId={applicationDetailId}
            taskId={taskId}
            materialStatusEditable={materialStatusEditable}
            reviewStepIndex={index}
            onMaterialStatusStateChange={onMaterialStatusStateChange}
          />
        </div>
      ))}
        {shouldShowIcpPersonalInformation ? (
          <ReviewPersonalInformationIcp
            profileId={resolvedIcpProfileId}
            expanded={icpPersonalInfoExpanded}
            onToggle={() =>
              setIcpPersonalInfoExpanded((expanded) => !expanded)
            }
          />
        ) : null}
      {applicationId && (paymentLoading || paymentQuote || paymentError) && shouldShowPaymentQuote && (
        <FeeQuoteDisplay
          quoteData={paymentQuote}
          quoteLoading={paymentLoading}
          quoteError={paymentError}
        />
      )}
    </div>
  );
};

export default FormilyReviewList;
