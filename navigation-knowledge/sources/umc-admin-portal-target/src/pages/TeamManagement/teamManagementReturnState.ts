export const TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY =
  "__teamManagementReturnLocation"

export const readTeamManagementReturnLocation = (state: unknown) => {
  if (!state || typeof state !== "object") {
    return null
  }

  const returnLocation = (
    state as Record<string, unknown>
  )[TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY]

  return typeof returnLocation === "string" && returnLocation.startsWith("/")
    ? returnLocation
    : null
}

export const resolveTeamManagementBreadcrumbNavigation = (
  breadcrumbKey: string,
  fallbackPath: string,
  state: unknown,
) => {
  const returnLocation = readTeamManagementReturnLocation(state)

  if (breadcrumbKey === "team-management-list" && returnLocation) {
    return {
      path: returnLocation,
      restoreHistory: true,
    }
  }

  return {
    path: fallbackPath,
    restoreHistory: false,
  }
}
