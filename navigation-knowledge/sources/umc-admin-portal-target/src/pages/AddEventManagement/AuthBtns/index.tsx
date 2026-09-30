import { CustomButton, CustomFooter } from "@/components/common"
import type { FC } from "react"
import React from "react"
import type { IProps } from "./type"
import { useTranslation } from "react-i18next"

const ADD_EVENT_PERMISSION_ROUTE = "/cms/EventManagement/AddEventManagement";

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
              disabled={btnsDisabled}
              onClick={() => btnsEvent?.saveDraft?.()}
              permissionCode="CMS.Event.AddEventManagement.SaveDraft"
              permissionRoutePath={ADD_EVENT_PERMISSION_ROUTE}
            />

            {canPublish ? (
              <CustomButton
                text={t("CMS.common.publish")}
                disabled={btnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.publish?.()}
                permissionCode="CMS.Event.AddEventManagement.Publish"
                permissionRoutePath={ADD_EVENT_PERMISSION_ROUTE}
              />
            ) : canSaveAndSubmit ? (
              <CustomButton
                text={t("CMS.common.saveAndSubmit")}
                disabled={btnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.submit?.()}
                permissionCode="CMS.Event.AddEventManagement.SaveAndSubmit"
                permissionRoutePath={ADD_EVENT_PERMISSION_ROUTE}
              />
            ) : null}
          </>
        }
      />
    )
  }

  return renderFooterBtns()
})
