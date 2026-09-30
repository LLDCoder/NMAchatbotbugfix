import "./index.less"
import type { IProps } from "./type"
import React, { useState, type FC } from "react"
import FormilyReviewList from "@/components/common/FormilyReviewList/index.tsx"
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader"
import { useTranslation } from "react-i18next"

export const Details: FC<IProps> = React.memo((props) => {
  const { t } = useTranslation()
  const {
    tableData,
    applicationId,
    applicationDetailId,
    taskId,
    serviceCode,
    profileId,
    materialStatusEditable,
    onMaterialStatusStateChange,
  } = props
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="application-details">
      <CollapsibleCardHeader
        title={t("Content.contentApplicationsDetails.details.applicationDetails")}
        expanded={isOpen}
        onToggle={() => setIsOpen((current) => !current)}
      />
      <div className="application-details__body" hidden={!isOpen}>
        <FormilyReviewList
          formilyList={tableData as Array<{ formData: string }>}
          formilyData={(tableData || []) as Array<Record<string, unknown>>}
          applicationId={applicationId}
          applicationDetailId={applicationDetailId}
          taskId={taskId}
          materialStatusEditable={materialStatusEditable}
          onMaterialStatusStateChange={onMaterialStatusStateChange}
          icpProfileId={profileId ?? undefined}
          serviceCode={serviceCode}
          // presentationPattern="readPretty"
        />
      </div>
    </div>
  )
})
