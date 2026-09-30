import {
  getResolvedTeamManagementScopeMeta,
  type TeamManagementAdapterMode,
  type TeamManagementScope,
  type TeamManagementScopeMeta,
} from "@/services/teamManagement"

const ENABLE_TEAM_MANAGEMENT_LEADER_CHECK = false

export interface TeamManagementScopeConfig extends TeamManagementScopeMeta {
  scope: TeamManagementScope
  routePath: string
  breadcrumbKey: string
  titleKey: string
  moduleLabelKey: string
  leaderCheck: boolean
  accessDeniedRedirectPath: string
  permissionRoutePath: string
}

interface TeamManagementScopeBaseConfig {
  scope: TeamManagementScope
  routePath: string
  breadcrumbKey: string
  titleKey: string
  moduleLabelKey: string
  leaderCheck: boolean
  accessDeniedRedirectPath: string
}

const TEAM_MANAGEMENT_SCOPE_BASE_CONFIGS: Record<
  TeamManagementScope,
  TeamManagementScopeBaseConfig
> = {
  licensing: {
    scope: "licensing",
    routePath: "/licensing/team-management",
    breadcrumbKey: "menu.licensing",
    titleKey: "menu.teamManagement",
    moduleLabelKey: "menu.licensingManagement",
    leaderCheck: ENABLE_TEAM_MANAGEMENT_LEADER_CHECK,
    accessDeniedRedirectPath: "/licensing/applications",
  },
  content: {
    scope: "content",
    routePath: "/content/team-management",
    breadcrumbKey: "menu.content",
    titleKey: "menu.teamManagement",
    moduleLabelKey: "menu.contentManagement",
    leaderCheck: ENABLE_TEAM_MANAGEMENT_LEADER_CHECK,
    accessDeniedRedirectPath: "/content/ContentApplications",
  },
  customer: {
    scope: "customer",
    routePath: "/happiness/team-management",
    breadcrumbKey: "menu.Customer",
    titleKey: "menu.teamManagement",
    moduleLabelKey: "menu.CustomerHappiness",
    leaderCheck: ENABLE_TEAM_MANAGEMENT_LEADER_CHECK,
    accessDeniedRedirectPath: "/happiness/tickets",
  },
  inspection: {
    scope: "inspection",
    routePath: "/inspection/tasks",
    breadcrumbKey: "menu.inspection",
    titleKey: "menu.teamManagement",
    moduleLabelKey: "menu.inspection",
    leaderCheck: false,
    accessDeniedRedirectPath: "/inspection/tasks",
  },
}

const buildTeamManagementScopeConfig = (
  scope: TeamManagementScope,
  adapterMode: TeamManagementAdapterMode = "default"
): TeamManagementScopeConfig => {
  const baseConfig = TEAM_MANAGEMENT_SCOPE_BASE_CONFIGS[scope]
  const meta = getResolvedTeamManagementScopeMeta(scope, adapterMode)

  return {
    ...baseConfig,
    ...meta,
    permissionRoutePath: meta.permissions.routePath,
  }
}

export const getTeamManagementScopeConfigByScope = (
  scope: TeamManagementScope,
  adapterMode: TeamManagementAdapterMode = "default"
) => buildTeamManagementScopeConfig(scope, adapterMode)

export const getTeamManagementScopeConfig = (
  pathname: string,
  adapterMode: TeamManagementAdapterMode = "default"
) => {
  if (pathname.startsWith("/licensing/team-management")) {
    return buildTeamManagementScopeConfig("licensing", adapterMode)
  }
  if (pathname.startsWith("/content/team-management")) {
    return buildTeamManagementScopeConfig("content", adapterMode)
  }
  if (pathname.startsWith("/happiness/team-management")) {
    return buildTeamManagementScopeConfig("customer", adapterMode)
  }
  if (pathname.startsWith("/inspection")) {
    return buildTeamManagementScopeConfig("inspection", adapterMode)
  }

  return buildTeamManagementScopeConfig("licensing", adapterMode)
}
