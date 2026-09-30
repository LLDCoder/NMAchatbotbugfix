import type {
  DashboardDepartment,
  DashboardRoleVariant,
  DashboardTableSortDirection,
  DashboardTimeFilter,
} from "./type";

export const DASHBOARD_RETURN_STATE_KEY = "__dashboardReturn";

export interface DashboardAttentionReturnState {
  tabKey: string;
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
}

export interface DashboardReturnState {
  version: 1;
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  timeFilter: DashboardTimeFilter;
  attention: DashboardAttentionReturnState;
  scrollTop: number;
}

export type DashboardReturnContext = Pick<
  DashboardReturnState,
  "department" | "roleVariant" | "timeFilter"
>;

export const normalizeDashboardAttentionPageIndex = (
  pageIndex: number,
  pageSize: number,
  totalCount: number,
) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  return totalPages > 0 ? Math.min(pageIndex, totalPages) : 1;
};

const DASHBOARD_DEPARTMENTS: DashboardDepartment[] = [
  "license",
  "content",
  "inspection",
  "customer",
];
const DASHBOARD_ROLE_VARIANTS: DashboardRoleVariant[] = ["staff", "manager"];
const DASHBOARD_TIME_PRESETS = [
  "last7",
  "last30",
  "last6Months",
  "lastYear",
  "custom",
] as const;
const DASHBOARD_SORT_DIRECTIONS: DashboardTableSortDirection[] = ["asc", "desc"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isOptionalString = (value: unknown) =>
  value === undefined || typeof value === "string";

const isDashboardTimeFilter = (
  value: unknown,
): value is DashboardTimeFilter => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.preset !== "string" ||
    !DASHBOARD_TIME_PRESETS.includes(
      value.preset as (typeof DASHBOARD_TIME_PRESETS)[number],
    )
  ) {
    return false;
  }

  if (
    value.days !== undefined &&
    (!isPositiveInteger(value.days) || value.preset === "custom")
  ) {
    return false;
  }

  if (!isOptionalString(value.startDate) || !isOptionalString(value.endDate)) {
    return false;
  }

  return value.preset !== "custom" ||
    (Boolean(value.startDate) && Boolean(value.endDate));
};

const isDashboardAttentionReturnState = (
  value: unknown,
): value is DashboardAttentionReturnState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.tabKey === "string" &&
    Boolean(value.tabKey.trim()) &&
    isPositiveInteger(value.pageIndex) &&
    isPositiveInteger(value.pageSize) &&
    isOptionalString(value.sortBy) &&
    (value.sortDirection === undefined ||
      DASHBOARD_SORT_DIRECTIONS.includes(
        value.sortDirection as DashboardTableSortDirection,
      ))
  );
};

const isDashboardReturnState = (value: unknown): value is DashboardReturnState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    DASHBOARD_DEPARTMENTS.includes(value.department as DashboardDepartment) &&
    DASHBOARD_ROLE_VARIANTS.includes(value.roleVariant as DashboardRoleVariant) &&
    isDashboardTimeFilter(value.timeFilter) &&
    isDashboardAttentionReturnState(value.attention) &&
    isNonNegativeFiniteNumber(value.scrollTop)
  );
};

export const readDashboardReturnState = (
  locationState: unknown,
): DashboardReturnState | undefined => {
  if (!isRecord(locationState)) {
    return undefined;
  }

  const returnState = locationState[DASHBOARD_RETURN_STATE_KEY];

  return isDashboardReturnState(returnState) ? returnState : undefined;
};

export const withDashboardReturnState = (
  locationState: unknown,
  returnState: DashboardReturnState,
): Record<string, unknown> => ({
  ...(isRecord(locationState) ? locationState : {}),
  [DASHBOARD_RETURN_STATE_KEY]: returnState,
});

export const createDashboardReturnLocation = (
  returnState: DashboardReturnState,
) => ({
  pathname: "/dashboard",
  state: withDashboardReturnState(undefined, returnState),
});
