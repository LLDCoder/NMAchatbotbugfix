import { useState } from "react";
import { useTranslation } from "react-i18next";
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader";
import ReviewPersonalInformation from "@/components/common/ReviewPersonalInformation";
import FahrReviewTargetStatus from "@/pages/ApplicationsDetails/components/FahrReviewTargetStatus";
import type { FahrReviewAction } from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import type { FahrReviewSubmissionPayload } from "@/pages/ApplicationsDetails/components/FahrReviewSubmissionModal";
import type { FahrReviewTarget } from "@/services/fahr";
import type { IUserIndividualProfile } from "@/services/userProfile";
import "./index.less";

interface FahrPersonalProfileSectionProps {
  applicationId?: number;
  profile?: IUserIndividualProfile;
  target?: FahrReviewTarget;
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

export default function FahrPersonalProfileSection({
  applicationId,
  profile,
  target,
  isActionAvailable,
  onAction,
}: FahrPersonalProfileSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="fahr-personal-profile-section">
      <CollapsibleCardHeader
        title={t("Licensing.fahrReview.personalProfile")}
        toggleAriaLabel={t("Licensing.fahrReview.personalProfile")}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        extra={
          target ? (
            <FahrReviewTargetStatus
              applicationId={applicationId}
              target={target}
              isActionAvailable={isActionAvailable}
              onAction={onAction}
            />
          ) : undefined
        }
      />
      <div
        className="fahr-personal-profile-section__content"
        hidden={!expanded}
      >
        <ReviewPersonalInformation ProfileInfoIndex={profile} />
      </div>
    </section>
  );
}
