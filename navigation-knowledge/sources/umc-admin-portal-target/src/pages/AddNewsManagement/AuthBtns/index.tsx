import { CustomButton, CustomFooter } from "@/components/common"
import type { FC } from "react"
import React from "react"
import type { IProps } from "./type"
import { useTranslation } from "react-i18next"
import { useButtonPermission } from "@/routes/access"
import { useUserStore } from "@/store/user"

const ADD_NEWS_PERMISSION_ROUTE = "/cms/NewsManagement/AddNewsManagement";

export const AuthBtns: FC<IProps> = React.memo((props) => {
  const { t } = useTranslation();
  const { btnsEvent, saveDraftDisabled, actionBtnsDisabled } = props
  const { canRenderButton } = useButtonPermission(ADD_NEWS_PERMISSION_ROUTE);
  const listSysPermission = useUserStore(
    (state) => state.userInfo?.listSysPermission,
  );
  const canPublish = canRenderButton("CMS.News.AddNewsManagement.Publish");
  const canSaveAndSubmit = canRenderButton(
    "CMS.News.AddNewsManagement.SaveAndSubmit",
  );
  const primaryActionLoading = !listSysPermission?.length;

  const renderFooterBtns = () => {
    return (
      <CustomFooter
        onBack={() => btnsEvent?.back?.()}
        rightContent={
          <>
            <CustomButton
              text={t("CMS.addNewsManagement.buttons.preview")}
              variant="outline"
              disabled={actionBtnsDisabled}
              customClassName="reject-btn"
              onClick={() => btnsEvent?.preview?.()}
            />
            <CustomButton
              text={t("CMS.addNewsManagement.buttons.saveDraft")}
              variant="outline"
              disabled={saveDraftDisabled}
              onClick={() => btnsEvent?.saveDraft?.()}
              permissionCode="CMS.News.AddNewsManagement.SaveDraft"
              permissionRoutePath={ADD_NEWS_PERMISSION_ROUTE}
            />

            {canPublish ? (
              <CustomButton
                text={t("CMS.common.publish")}
                disabled={actionBtnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.publish?.()}
                permissionCode="CMS.News.AddNewsManagement.Publish"
                permissionRoutePath={ADD_NEWS_PERMISSION_ROUTE}
              />
            ) : canSaveAndSubmit ? (
              <CustomButton
                text={t("CMS.addNewsManagement.buttons.saveAndSubmit")}
                disabled={actionBtnsDisabled}
                variant="primary"
                onClick={() => btnsEvent?.submit?.()}
                permissionCode="CMS.News.AddNewsManagement.SaveAndSubmit"
                permissionRoutePath={ADD_NEWS_PERMISSION_ROUTE}
              />
            ) : primaryActionLoading ? (
              <CustomButton
                text={t("CMS.addNewsManagement.buttons.saveAndSubmit")}
                disabled
                loading
                variant="primary"
              />
            ) : null}
          </>
        }
      />
    )
  }

  return renderFooterBtns()
})
