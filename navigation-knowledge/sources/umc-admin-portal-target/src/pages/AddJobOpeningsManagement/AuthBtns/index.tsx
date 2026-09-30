import { CustomButton, CustomFooter } from "@/components/common"
import type { FC } from "react"
import React from "react"
import type { IProps } from "./type"
import { useTranslation } from "react-i18next"

const ADD_JOB_PERMISSION_ROUTE = "/cms/JobOpeningsManagement/addJobOpeningsManagement";

export const AuthBtns: FC<IProps> = React.memo((props) => {
  const { btnsEvent, btnsDisabled, canPublish, canSaveAndSubmit } = props
  const { t } = useTranslation()

  const renderFooterBtns = () => {
    return (
      <CustomFooter
        onBack={() => btnsEvent?.back?.()}
        rightContent={
          <>
            <CustomButton
              text={t("CMS.common.preview")}
              variant="outline"
              disabled={btnsDisabled}
              customClassName="reject-btn"
              onClick={() => btnsEvent?.preview?.()}
            />
            <CustomButton
              text={t("CMS.common.saveDraft")}
              variant="outline"
              onClick={() => btnsEvent?.saveDraft?.()}
              permissionCode="CMS.JobOpenings.AddJobOpeningsManagement.SaveDraft"
              permissionRoutePath={ADD_JOB_PERMISSION_ROUTE}
            />

            {canPublish ? (
              <CustomButton
                text={t("CMS.common.publish")}
                disabled={btnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.publish?.()}
                permissionCode="CMS.JobOpenings.AddJobOpeningsManagement.Publish"
                permissionRoutePath={ADD_JOB_PERMISSION_ROUTE}
              />
            ) : canSaveAndSubmit ? (
              <CustomButton
                text={t("CMS.common.saveAndSubmit")}
                disabled={btnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.submit?.()}
                permissionCode="CMS.JobOpenings.AddJobOpeningsManagement.SaveAndSubmit"
                permissionRoutePath={ADD_JOB_PERMISSION_ROUTE}
              />
            ) : null}
          </>
        }
      />
    )
  }

  return renderFooterBtns()
})
