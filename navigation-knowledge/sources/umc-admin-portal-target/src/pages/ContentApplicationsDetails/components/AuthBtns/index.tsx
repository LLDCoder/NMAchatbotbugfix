import {
  CustomFooter,
  FooterActionButtons,
  type FooterActionItem,
} from "@/components/common";
import { disableBtnDisplay } from "@/pages/Applications/constants";
import type { FC } from "react";
import React from "react";
import type { IProps } from "./type";
import { safeParseWorkflowActions } from "@/constants/workflowActions";
import "./index.less";
import { useTranslation } from "react-i18next";
import { useButtonPermission } from "@/routes/access";
import {
  resolveTaskWorkflowAction,
  type WorkflowActionIntent,
  type WorkflowActionRoute,
} from "@/pages/ContentApplications/utils/workflowActionRouting";
import { PERMISSION_CODES } from "@/constants/permissionCodes";

const CONTENT_APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE: Record<
  WorkflowActionRoute,
  string
> = {
  directConfirm: "Content.Applications.Confirm",
  approveApplicationModal: "Content.Applications.Confirm",
  rejectApplicationModal: "Content.Applications.ConfirmRejectModal",
  externalApproveApplicationModal: "Content.Applications.Confirm",
  externalRejectApplicationModal: "Content.Applications.ConfirmRejectModal",
  mediaMaterialReportModal:
    "Content.Applications.ConfirmMediaMaterialReportModal",
  dispositionApproveModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  dispositionApproveConfirmModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  dispositionRejectModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  requestModificationModal:
    "Content.Applications.ConfirmRequestModificationModal",
};

const getContentApplicationWorkflowConfirmPermission = (
  record: IProps["details"],
  intent: WorkflowActionIntent,
) =>
  CONTENT_APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE[
    resolveTaskWorkflowAction(record, intent).route
  ];

const isPendingModificationStatus = (status?: string | null) =>
  String(status ?? "").replace(/\s+/g, "").toLowerCase() ===
  "pendingmodification";

const CONTENT_FOOTER_HIDDEN_STATUSES = [
  106, 105, 108
];

export const AuthBtns: FC<IProps> = React.memo((props) => {
  const { t } = useTranslation();
  const { details, btnsEvent } = props;
  const { canRenderButton } = useButtonPermission(
    "/content/ContentApplications",
  );
  const btnStatus = safeParseWorkflowActions(details?.buttonJson);
  const isExtraApprove = details?.statusId == 11;
  const shouldHideFooterActions =
    disableBtnDisplay.includes(details?.statusId ?? 0) ||
    isPendingModificationStatus(details?.status) ||
    isPendingModificationStatus(details?.taskStatus);
  const footerActions: FooterActionItem[] = [
    {
      key: "reject",
      label: isExtraApprove
        ? t("Content.contentApplications.actions.extrareject")
        : t("Content.contentApplications.actions.reject"),
      visible: Boolean(
        btnStatus?.reject &&
          btnsEvent?.reject &&
          canRenderButton(
            getContentApplicationWorkflowConfirmPermission(details, "reject"),
          ),
      ),
      variant: "outline",
      customClassName: "reject-btn",
      onClick: () => btnsEvent?.reject?.(),
    },
    {
      key: "requestModification",
      label: t("Content.contentApplications.actions.requestModification"),
      visible: Boolean(
        btnStatus?.requestModification &&
          btnsEvent?.requestModification &&
          canRenderButton(
            "Content.Applications.ConfirmRequestModificationModal",
          ),
      ),
      variant: "outline",
      onClick: () => btnsEvent?.requestModification?.(),
    },
    {
      key: "sendBack",
      label: t("Content.contentApplications.actions.sendBack"),
      visible: Boolean(
        btnStatus?.sendBack &&
          btnsEvent?.sendBack &&
          canRenderButton(PERMISSION_CODES.content.applications.sendBack),
      ),
      variant: "outline",
      customClassName: "outline",
      onClick: () => btnsEvent?.sendBack?.(),
    },
    {
      key: "approve",
      label: isExtraApprove
        ? t("Content.contentApplications.actions.extraapprove")
        : t("Content.contentApplications.actions.approve"),
      visible: Boolean(
        btnStatus?.approve &&
          btnsEvent?.approve &&
          canRenderButton(
            getContentApplicationWorkflowConfirmPermission(details, "approve"),
          ),
      ),
      variant: "primary",
      disabled: details?.status === "Completed",
      onClick: () => btnsEvent?.approve?.(),
    },
    {
      key: "externalApproval",
      label: t("Content.contentApplications.actions.externalApproval"),
      visible: Boolean(
        btnStatus?.externalApproval &&
          btnsEvent?.externalApprove &&
          !isExtraApprove &&
          canRenderButton(
            PERMISSION_CODES.content.applications.externalApproval,
          ),
      ),
      variant: "primary",
      onClick: () => btnsEvent?.externalApprove?.(),
    },
  ];

  if (shouldHideFooterActions) {
    return null;
  }

  const hasVisibleFooterAction = footerActions.some(
    (action) => action.visible !== false,
  );
  const shouldRenderFooter =
    !CONTENT_FOOTER_HIDDEN_STATUSES.includes(details?.statusId ?? 0) &&
    hasVisibleFooterAction;

  if (!shouldRenderFooter) {
    return null;
  }

  return (
    <CustomFooter
      rightContent={<FooterActionButtons actions={footerActions} />}
    />
  );
});
