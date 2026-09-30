import type { Moment } from "moment";
import type { InspectionRole } from "@/pages/InspectionCommon/access";

export type DashboardDepartment =
  | "license"
  | "content"
  | "inspection"
  | "customer";

export type DashboardRoleVariant = "staff" | "manager";

export type DashboardTimePreset =
  | "last7"
  | "last30"
  | "last6Months"
  | "lastYear"
  | "custom";

export type DashboardRangeValue = [Moment, Moment] | null;

export type DashboardTone =
  | "default"
  | "gold"
  | "green"
  | "blue"
  | "red"
  | "orange"
  | "yellow"
  | "neutral";

export interface DashboardTimeFilter {
  preset: DashboardTimePreset;
  days?: number;
  startDate?: string;
  endDate?: string;
}

export interface DashboardTimeQueryParams {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export interface DashboardDataQueryParams extends DashboardTimeQueryParams {
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
}

export interface DashboardDepartmentOption {
  key: DashboardDepartment;
  labelKey: string;
  shortLabelKey: string;
}

export type DashboardRoleOptionsByDepartment = Partial<
  Record<DashboardDepartment, DashboardRoleVariant[]>
>;

export interface DashboardNavigationTarget {
  targetPath?: string;
  permissionPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
  // Equivalent destinations, tried in order when the primary target is not permitted.
  // Lets one card serve roles that reach the same page through different modules.
  fallbackTargets?: DashboardNavigationTarget[];
}

export type DashboardTaskSourceType =
  | "application"
  | "profile"
  | "enquiry"
  | "ticket"
  | "refund"
  | "appeal"
  | "inspection"
  | "violation"
  | "content"
  | "license";

export type DashboardEntityIconType = "enterprise" | "personal";
export type DashboardInspectionTargetIconType =
  | "inspectionTargetCompany"
  | "inspectionTargetGovernment"
  | "inspectionTargetUser";
export type DashboardTableIconType =
  | DashboardEntityIconType
  | DashboardInspectionTargetIconType;

export interface DashboardReassignTask {
  sourceType: DashboardTaskSourceType;
  sourceId: string;
  userId?: string | null;
  assignedTo?: string | null;
  assignedToUserId?: string | null;
}

export interface DashboardTaskCard {
  key: string;
  statusKey?: string;
  statusText?: string;
  statusTone: DashboardTone;
  alertText?: string;
  alertKey?: string;
  alertParams?: Record<string, string | number>;
  title?: string;
  titleKey?: string;
  subtitle?: string;
  subtitleKey?: string;
  subtitleIcon?: DashboardEntityIconType;
  sourceType?: DashboardTaskSourceType;
  sourceId?: string;
  statusCode?: string;
  lastUpdatedAt?: string;
  targetPath?: string;
  permissionPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
  fallbackTargets?: DashboardNavigationTarget[];
}

export interface DashboardTaskTab {
  key: string;
  labelKey?: string;
  labelText?: string;
  count: number | "-";
  actionPath?: string;
  actionPermissionPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
  cards: DashboardTaskCard[];
}

export interface DashboardLegendItem {
  key: string;
  labelKey?: string;
  labelText?: string;
  value: number;
  displayValue?: string;
  color: string;
}

export interface DashboardLegendPlaceholderItem {
  key: string;
  labelKey?: string;
  labelText?: string;
  displayValue: string;
  color: string;
}

export interface DashboardSummaryTile {
  key: string;
  labelKey?: string;
  labelText?: string;
  infoTooltipKey?: string;
  infoTooltipText?: string;
  value: string;
  tone?: DashboardTone;
  icon?: "certificate" | "warning" | "fileX" | "prohibit" | "clock";
}

export interface DashboardDonutCard {
  key: string;
  titleKey?: string;
  titleText?: string;
  actionPath?: string;
  actionPermissionPath?: string;
  centerValue: string;
  centerLabelKey?: string;
  centerLabelText?: string;
  legends: DashboardLegendItem[];
  legendPlaceholders?: DashboardLegendPlaceholderItem[];
  showLegendPercentage?: boolean;
  summaryTiles: DashboardSummaryTile[];
}

export type DashboardRiskIcon =
  | "politicalSensitivity"
  | "religiousContent"
  | "lgbtContent"
  | "royalFamily"
  | "adultContent"
  | "violenceHateSpeech"
  | "childProtection"
  | "prohibitedWords";

export interface DashboardRiskGridItem {
  key: string;
  labelKey?: string;
  labelText?: string;
  value: number;
  icon?: DashboardRiskIcon;
}

export interface DashboardRiskGridCard {
  key: string;
  titleKey?: string;
  titleText?: string;
  items: DashboardRiskGridItem[];
}

export interface DashboardMetricCard {
  key: string;
  labelKey?: string;
  labelText?: string;
  infoTooltipKey?: string;
  infoTooltipText?: string;
  value?: string;
  tone: DashboardTone;
  variant: "gauge" | "timer" | "ring" | "alert";
}

export interface DashboardDisplayValue {
  text: string;
  available: boolean;
}

export interface DashboardApiGap {
  key: string;
  roleVariant: DashboardRoleVariant;
  cardTitle: string;
  endpoint: string;
  expectedShape: string;
  actualValue: string;
}

export type LicenseDisplayValue = DashboardDisplayValue;
export type LicenseApiGap = DashboardApiGap;

export type LicenseMetricIconType =
  | "slaCompliance"
  | "avgProcessingTime"
  | "overdueTasks"
  | "approvalRate";

export interface LicenseMetricTile {
  key: string;
  labelText: string;
  value: LicenseDisplayValue;
  icon: LicenseMetricIconType;
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface LicenseMetricSectionCard
  extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  tiles: LicenseMetricTile[];
}

export interface LicenseDonutStatusLegend {
  key: string;
  labelText: string;
  color: string;
  value: LicenseDisplayValue;
}

export interface LicenseFooterStat {
  key: string;
  labelText: string;
  value: LicenseDisplayValue;
  tone?: DashboardTone;
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface LicenseDonutStatusCard extends DashboardNavigationTarget {
  key: string;
  variant: "donutStatus";
  titleText: string;
  centerValue: LicenseDisplayValue;
  centerLabelText: string;
  legends: LicenseDonutStatusLegend[];
  footerStats: LicenseFooterStat[];
  chartSegments: Array<{
    key: string;
    color: string;
    value: number;
  }>;
}

export interface LicenseStatusGridTile {
  key: string;
  labelText: string;
  value: LicenseDisplayValue;
  tone?: DashboardTone;
  icon: "certificate" | "warning" | "fileX" | "prohibit";
}

export interface LicenseStatusGridCard extends DashboardNavigationTarget {
  key: string;
  variant: "statusGrid";
  titleText: string;
  totalValue: LicenseDisplayValue;
  totalLabelText: string;
  tiles: LicenseStatusGridTile[];
}

export type LicenseSummaryCard =
  | LicenseDonutStatusCard
  | LicenseStatusGridCard;

export interface LicenseTrendSeries {
  key: string;
  labelText: string;
  color: string;
  axis: "left" | "right";
  unit: "%" | "h" | "count";
  values: number[];
  available: boolean;
}

export interface LicenseTrendCard {
  key: string;
  titleText: string;
  categories: string[];
  series: LicenseTrendSeries[];
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface LicenseCoachingTableCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  rows: DashboardCoachingRow[];
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface LicenseLeaveListCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  rows: DashboardLeaveRow[];
  totalCount?: number;
}

export type ContentMetricIconType =
  | "slaCompliance"
  | "avgProcessingTime"
  | "overdueTasks"
  | "approvalRate";

export interface ContentMetricTile {
  key: string;
  labelText: string;
  value: DashboardDisplayValue;
  icon: ContentMetricIconType;
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface ContentMetricSectionCard
  extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  tiles: ContentMetricTile[];
}

export interface ContentDonutStatusLegend {
  key: string;
  labelText: string;
  color: string;
  value: DashboardDisplayValue;
}

export interface ContentFooterStat {
  key: string;
  labelText: string;
  value: DashboardDisplayValue;
  tone?: DashboardTone;
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface ContentDonutStatusCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  centerValue: DashboardDisplayValue;
  centerLabelText: string;
  legends: ContentDonutStatusLegend[];
  footerStats: ContentFooterStat[];
  chartSegments: Array<{
    key: string;
    color: string;
    value: number;
  }>;
}

export interface ContentRiskTagItem {
  key: string;
  labelText: string;
  value: DashboardDisplayValue;
  icon: DashboardRiskIcon;
  highlight?: boolean;
}

export interface ContentRiskTagGridCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  items: ContentRiskTagItem[];
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface ContentTrendAxis {
  unit: "minutes" | "hours" | "days";
  tickLabels: string[];
  maxValueMinutes: number;
}

export interface ContentTrendSeries {
  key: string;
  labelText: string;
  color: string;
  axis: "left" | "right";
  unit: "%" | "time";
  values: number[];
  displayValues?: string[];
  available: boolean;
}

export interface ContentTrendCard {
  key: string;
  titleText: string;
  categories: string[];
  series: ContentTrendSeries[];
  avgProcessingTimeAxis?: ContentTrendAxis;
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface ContentCoachingTableCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  rows: DashboardCoachingRow[];
  showInfo?: boolean;
  infoTooltipText?: string;
}

export interface ContentLeaveListCard extends DashboardNavigationTarget {
  key: string;
  titleText: string;
  rows: DashboardLeaveRow[];
  totalCount?: number;
}

export interface DashboardTrendSeries {
  key: string;
  labelKey?: string;
  labelText?: string;
  color: string;
  axis?: "left" | "right";
  values: number[];
  displayValues?: string[];
  unit?: string;
}

export interface DashboardTrendAxis {
  unit?: string;
  tickLabels?: string[];
  minValue?: number;
  maxValue?: number;
}

export interface DashboardTrendChart {
  key: string;
  titleKey?: string;
  titleText?: string;
  infoTooltipKey?: string;
  infoTooltipText?: string;
  smooth?: boolean;
  tooltipVariant?: "default" | "compact";
  categories: string[];
  series: DashboardTrendSeries[];
  leftAxis?: DashboardTrendAxis;
  rightAxis?: DashboardTrendAxis;
}

export interface DashboardTableCell {
  text?: string;
  textKey?: string;
  params?: Record<string, string | number>;
  tone?: DashboardTone;
  urgent?: boolean;
  icon?: DashboardTableIconType;
}

export interface DashboardTableAction {
  key: string;
  labelKey?: string;
  labelText?: string;
  mode?: "inline" | "menu";
  actionCode?: string;
  sourceActionUrl?: string;
  openMode?: string;
  taskId?: string;
  targetPath?: string;
  permissionPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
  fallbackTargets?: DashboardNavigationTarget[];
  tone?: DashboardTone;
}

export interface DashboardAvailableAction {
  actionCode?: string;
  actionLabel?: string;
  actionUrl?: string;
  openMode?: string;
}

export interface DashboardTableRow {
  key: string;
  sourceType?: DashboardTaskSourceType;
  sourceId?: string;
  targetPath?: string;
  permissionPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
  fallbackTargets?: DashboardNavigationTarget[];
  reassignTask?: DashboardReassignTask;
  actions?: DashboardTableAction[];
  availableActions?: DashboardAvailableAction[];
  [field: string]:
    | DashboardTableCell
    | DashboardAvailableAction[]
    | DashboardTableAction[]
    | DashboardNavigationTarget[]
    | DashboardReassignTask
    | readonly InspectionRole[]
    | string
    | undefined;
}

export interface DashboardTableColumn {
  key: string;
  titleKey?: string;
  titleText?: string;
  dataIndex: string;
  width?: number;
  sortKey?: string;
}

export type DashboardTableSortDirection = "asc" | "desc";

export interface DashboardTableTab {
  key: string;
  labelKey?: string;
  labelText?: string;
  count: number;
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
  selectable?: boolean;
  allowedInspectionRoles?: readonly InspectionRole[];
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
}

export interface DashboardTableSection {
  key: string;
  titleKey: string;
  actionPath?: string;
  actionPermissionPath?: string;
  actionLabelKey?: string;
  tabs: DashboardTableTab[];
}

export interface DashboardCoachingRow {
  key: string;
  member?: string;
  overdue: number;
  slaCompliance?: string;
  avgProcessingTime?: string;
  reopenRate?: string;
}

export interface DashboardLeaveRow {
  key: string;
  name?: string;
  reasonKey: string;
  reason?: string;
  returnAt?: string;
  todoCount: number;
  avatar?: string;
}

export interface DashboardWorkloadData {
  type: "workload";
  layout?: "generic";
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  taskTabs: DashboardTaskTab[];
  performanceTitleKey: string;
  performanceMetrics: DashboardMetricCard[];
  donutCards: DashboardDonutCard[];
  riskGridCard?: DashboardRiskGridCard;
  trendChart?: DashboardTrendChart;
  attentionTable: DashboardTableSection;
  supportAction?: DashboardNavigationTarget;
  coachingInfoTooltipKey?: string;
  coachingInfoTooltipText?: string;
  coachingRows?: DashboardCoachingRow[];
  leaveRows?: DashboardLeaveRow[];
  leaveTotalCount?: number;
}

export interface DashboardLicenseWorkloadData {
  type: "workload";
  layout: "license";
  department: "license";
  roleVariant: DashboardRoleVariant;
  taskTabs: DashboardTaskTab[];
  attentionTable: DashboardTableSection;
  performanceCard: LicenseMetricSectionCard;
  summaryCards: LicenseSummaryCard[];
  trendCard?: LicenseTrendCard;
  coachingCard?: LicenseCoachingTableCard;
  leaveCard?: LicenseLeaveListCard;
  apiGaps: LicenseApiGap[];
}

export interface DashboardContentWorkloadData {
  type: "workload";
  layout: "content";
  department: "content";
  roleVariant: DashboardRoleVariant;
  taskTabs: DashboardTaskTab[];
  attentionTable: DashboardTableSection;
  performanceCard: ContentMetricSectionCard;
  serviceApplicationCard: ContentDonutStatusCard;
  aiRiskCard: ContentRiskTagGridCard;
  trendCard?: ContentTrendCard;
  coachingCard?: ContentCoachingTableCard;
  leaveCard?: ContentLeaveListCard;
  apiGaps: DashboardApiGap[];
}

export type DashboardData =
  | DashboardWorkloadData
  | DashboardLicenseWorkloadData
  | DashboardContentWorkloadData;

export interface DashboardDataParams {
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  timeFilter: DashboardTimeFilter;
  signal?: AbortSignal;
}

export interface DashboardContext {
  departments: DashboardDepartmentOption[];
  defaultDepartment?: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  roleVariantsByDepartment?: Partial<Record<DashboardDepartment, DashboardRoleVariant>>;
  roleOptionsByDepartment?: DashboardRoleOptionsByDepartment;
}
