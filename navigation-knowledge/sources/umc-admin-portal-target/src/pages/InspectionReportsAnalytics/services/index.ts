import type {
  AnalyticsResponse,
  InspectionAnalyticsTab,
  AnalyticsTimeFilter,
  InspectionReportsAnalyticsData,
} from "../types";
import {
  exportEmirateBreakdown,
  exportInspectionExpiredLicenses,
  exportInspectionTasks,
  exportInspectionViolations,
  exportTeamPerformance,
  getEmirateBreakdown,
  getOperationalInsights,
  getRiskInsights,
  getTeamPerformancePage,
} from "./api";
import {
  mapEmirateBreakdownRows,
  mapOperationalInsights,
  mapRiskInsights,
} from "./adapters";
import { buildEmptyInspectionReportsAnalytics } from "./empty";

export const getInspectionReportsAnalytics = async (
  filter: AnalyticsTimeFilter = {},
  tab: InspectionAnalyticsTab = "operational",
): Promise<AnalyticsResponse<InspectionReportsAnalyticsData>> => {
  const baseline = buildEmptyInspectionReportsAnalytics();

  if (tab === "risk") {
    const riskResult = await getRiskInsights(filter);
    return {
      data: {
        ...baseline,
        risk: mapRiskInsights(riskResult, baseline.risk),
      },
    };
  }

  const [operationalResult] = await Promise.allSettled([getOperationalInsights(filter)]);
  let operational = baseline.operational;

  if (operationalResult.status === "fulfilled") {
    operational = mapOperationalInsights(operationalResult.value, operational);
  }

  return {
    data: {
      ...baseline,
      operational,
    },
  };
};

export const getEmirateBreakdownRows = async (
  filter: AnalyticsTimeFilter = {},
  search?: string,
) => mapEmirateBreakdownRows((await getEmirateBreakdown(filter, { search })).rows);

export { exportEmirateBreakdown, exportTeamPerformance, getTeamPerformancePage, exportInspectionTasks, exportInspectionViolations, exportInspectionExpiredLicenses };
export type {
  EmirateBreakdownQueryOptions,
  TeamPerformancePage,
  TeamPerformanceQueryOptions,
} from "./api";
