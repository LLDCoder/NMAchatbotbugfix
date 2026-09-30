import React from "react"
import {
  ReviewEstablishmentInformation,
  ReviewPersonalInformation,
} from "@/components/common"
import type { IEstablishmentOverview } from "@/services/userProfile"
import type { IUserIndividualProfile } from "@/services/userProfile"

type FullScreenBasicInformationProps = {
  type: "Individual" | "Commercial"
  applicantData?: IUserIndividualProfile
  establishmentData?: IEstablishmentOverview
  hideIdentityFields?: boolean
  documentsSectionRef: React.RefObject<HTMLDivElement>
  partnersSectionRef: React.RefObject<HTMLDivElement>
}

const FullScreenBasicInformation: React.FC<FullScreenBasicInformationProps> = ({
  type,
  applicantData,
  establishmentData,
  hideIdentityFields,
  documentsSectionRef,
  partnersSectionRef,
}) => {
  if (type === "Individual") {
    return (
      <ReviewPersonalInformation
        ProfileInfoIndex={applicantData}
        hideIdentityFields={hideIdentityFields}
        documentsSectionRef={documentsSectionRef}
      />
    )
  }

  return (
    <ReviewEstablishmentInformation
      establishment={establishmentData}
      documentsSectionRef={documentsSectionRef}
      partnersSectionRef={partnersSectionRef}
    />
  )
}

export default FullScreenBasicInformation
