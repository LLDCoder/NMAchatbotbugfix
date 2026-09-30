import { useMemo, useState, type FC, type ReactNode } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomButton, PermissionGuard } from "@/components/common";
import type { TeamManagementScope } from "@/services/teamManagement";
import { getTeamManagementScopeConfigByScope } from "../../taskConfig";
import { ReassignTasksModal } from "../modal/ReassignTasksModal";
import type { ReassignModalState } from "../../type";

const TEAM_TASK_DETAIL_SOURCE_PAGE = "teamManagement";

const TRUE_QUERY_VALUES = new Set(["1", "true", "yes"]);

const isTeamManagementScope = (
  value: string | null,
): value is TeamManagementScope =>
  value === "licensing" ||
  value === "content" ||
  value === "customer" ||
  value === "inspection";

const normalizeQueryValue = (value?: string | null) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
};

const parseBooleanQueryValue = (value?: string | null) =>
  TRUE_QUERY_VALUES.has(String(value || "").trim().toLowerCase());

export interface TeamTaskDetailContextValue {
  isTeamManagementSource: boolean;
  shouldHideDefaultActions: boolean;
  canReassign: boolean;
  teamManagementScope: TeamManagementScope | null;
  teamTaskSourceType: string | null;
  teamTaskSourceId: string | null;
  canRenderReassign: boolean;
}

export const useTeamTaskDetailContext = (): TeamTaskDetailContextValue => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const isTeamManagementSource =
      normalizeQueryValue(params.get("sourcePage")) ===
      TEAM_TASK_DETAIL_SOURCE_PAGE;
    const teamManagementScopeValue = normalizeQueryValue(
      params.get("teamManagementScope"),
    );
    const teamManagementScope = isTeamManagementScope(teamManagementScopeValue)
      ? teamManagementScopeValue
      : null;
    const canReassign = parseBooleanQueryValue(params.get("canReassign"));
    const teamTaskSourceType = normalizeQueryValue(
      params.get("teamTaskSourceType"),
    );
    const teamTaskSourceId = normalizeQueryValue(params.get("teamTaskSourceId"));
    const canRenderReassign =
      isTeamManagementSource &&
      canReassign &&
      Boolean(teamManagementScope && teamTaskSourceType && teamTaskSourceId);

    return {
      isTeamManagementSource,
      shouldHideDefaultActions: isTeamManagementSource,
      canReassign,
      teamManagementScope,
      teamTaskSourceType,
      teamTaskSourceId,
      canRenderReassign,
    };
  }, [location.search]);
};

interface TeamTaskDetailReassignActionRenderParams {
  onClick: () => void;
  text: string;
}

interface TeamTaskDetailReassignActionProps {
  fallbackBackPath?: string;
  renderTrigger?: (
    params: TeamTaskDetailReassignActionRenderParams,
  ) => ReactNode;
}

export const TeamTaskDetailReassignAction: FC<
  TeamTaskDetailReassignActionProps
> = ({ fallbackBackPath, renderTrigger }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const [visible, setVisible] = useState(false);

  const scopeConfig = useMemo(() => {
    if (!teamTaskDetailContext.teamManagementScope) {
      return null;
    }

    return getTeamManagementScopeConfigByScope(
      teamTaskDetailContext.teamManagementScope,
    );
  }, [teamTaskDetailContext.teamManagementScope]);

  const reassignTasks = useMemo<ReassignModalState["tasks"]>(() => {
    if (
      !teamTaskDetailContext.teamTaskSourceType ||
      !teamTaskDetailContext.teamTaskSourceId
    ) {
      return [];
    }

    return [
      {
        sourceType: teamTaskDetailContext.teamTaskSourceType,
        sourceId: teamTaskDetailContext.teamTaskSourceId,
        userId: null,
        assignedTo: "",
        assignedToUserId: null,
      },
    ];
  }, [
    teamTaskDetailContext.teamTaskSourceId,
    teamTaskDetailContext.teamTaskSourceType,
  ]);

  const handleModalClose = () => {
    setVisible(false);
  };

  const handleSuccess = () => {
    setVisible(false);

    if (typeof window !== "undefined" && window.history.length > 1) {
      history.goBack();
      return;
    }

    history.push(fallbackBackPath || scopeConfig?.routePath || "/");
  };

  if (!teamTaskDetailContext.canRenderReassign || !scopeConfig) {
    return null;
  }

  const buttonText = t("teamManagement.reassign.action");
  const triggerNode = renderTrigger ? (
    renderTrigger({
      onClick: () => setVisible(true),
      text: buttonText,
    })
  ) : (
    <CustomButton
      text={buttonText}
      variant="primary"
      onClick={() => setVisible(true)}
    />
  );

  return (
    <>
      {scopeConfig.permissions.reassign ? (
        <PermissionGuard
          permissionCode={scopeConfig.permissions.reassign}
          routePath={scopeConfig.permissionRoutePath}
        >
          {triggerNode}
        </PermissionGuard>
      ) : (
        triggerNode
      )}
      <ReassignTasksModal
        scope={scopeConfig.scope}
        serviceAdapterMode="default"
        manualReassignSelection={
          scopeConfig.capabilities.manualReassignSelection
        }
        confirmPermissionCode={scopeConfig.permissions.confirmReassign}
        permissionRoutePath={scopeConfig.permissionRoutePath}
        visible={visible}
        tasks={reassignTasks}
        selectedCount={1}
        onCancel={handleModalClose}
        onSuccess={handleSuccess}
      />
    </>
  );
};
