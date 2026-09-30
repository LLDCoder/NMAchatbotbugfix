import {
  buildServiceOperationsAnalyticsMock,
  customerProfileInsightsMock,
} from "../data";
import type {
  AnalyticsResponse,
  AnalyticsTimeFilter,
  CustomerProfileInsightsData,
  CustomerProfileInsightsRow,
  CustomerProfileInsightsTableParams,
  PaginatedTableResult,
  ServiceOperationsAnalyticsData,
  ServiceOperationsRow,
  ServiceOperationsTableParams,
} from "../type";
import {
  buildCustomerProfileInsightsRows,
  buildServiceOperationsRows,
} from "./mappers";

const wait = (timeout = 120) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, timeout);
  });

export async function getServiceOperationsAnalytics(
  filter?: AnalyticsTimeFilter,
): Promise<
  AnalyticsResponse<ServiceOperationsAnalyticsData>
> {
  await wait();

  return {
    data: buildServiceOperationsAnalyticsMock(filter),
  };
}

export async function getServiceOperationsTable(
  params: ServiceOperationsTableParams,
): Promise<AnalyticsResponse<PaginatedTableResult<ServiceOperationsRow>>> {
  await wait();

  return {
    data: buildServiceOperationsRows(params),
  };
}

export async function getCustomerProfileInsightsAnalytics(): Promise<
  AnalyticsResponse<CustomerProfileInsightsData>
> {
  await wait();

  return {
    data: customerProfileInsightsMock,
  };
}

export async function getCustomerProfileInsightsTable(
  params: CustomerProfileInsightsTableParams,
): Promise<AnalyticsResponse<PaginatedTableResult<CustomerProfileInsightsRow>>> {
  await wait();

  return {
    data: buildCustomerProfileInsightsRows(params),
  };
}

export async function exportServiceOperationsTable() {
  await wait(80);
}

export async function exportCustomerProfileInsightsTable() {
  await wait(80);
}
