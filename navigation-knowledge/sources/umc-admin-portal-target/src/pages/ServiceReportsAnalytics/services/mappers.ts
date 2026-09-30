import type {
  AnalyticsSortOrder,
  CustomerProfileInsightsRow,
  CustomerProfileInsightsTableParams,
  MetricCellData,
  PaginatedTableResult,
  ServiceOperationsRow,
  ServiceOperationsTableParams,
  ServiceScopeOption,
} from "../type";
import {
  customerProfileInsightsRowsMock,
  serviceOperationsRowsMock,
} from "../data";

const sortMetricValue = (metric: MetricCellData) =>
  Number.parseFloat(metric.value.replace(/[^0-9.-]/g, "")) || 0;

const compareNumber = (left: number, right: number, order?: AnalyticsSortOrder) =>
  order === "asc" ? left - right : right - left;

const paginate = <T,>(
  rows: T[],
  pageIndex: number,
  pageSize: number,
): PaginatedTableResult<T> => {
  const start = (pageIndex - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: rows.slice(start, end),
    total: rows.length,
    pageIndex,
    pageSize,
  };
};

const getDisplayName = (
  row: ServiceOperationsRow,
  option: ServiceScopeOption,
) => (option === "AllCategories" ? row.serviceCategory : row.serviceName);

const getCustomerDisplayName = (
  row: CustomerProfileInsightsRow,
  option: ServiceScopeOption,
) => (option === "AllCategories" ? row.serviceCategory : row.serviceName);

const formatWholeNumber = (value: number) => Math.round(value).toLocaleString();

const buildCustomerProfileCategoryRows = () => {
  const categoryRowMap = new Map<string, CustomerProfileInsightsRow>();

  customerProfileInsightsRowsMock.forEach((row) => {
    const existing = categoryRowMap.get(row.serviceCategory);
    const currentApplications = sortMetricValue(row.applications);

    if (!existing) {
      categoryRowMap.set(row.serviceCategory, {
        ...row,
        id: `customer-category-${row.serviceCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        applications: {
          ...row.applications,
          value: formatWholeNumber(currentApplications),
        },
      });

      return;
    }

    const aggregatedApplications =
      sortMetricValue(existing.applications) + currentApplications;

    categoryRowMap.set(row.serviceCategory, {
      ...existing,
      applications: {
        ...existing.applications,
        value: formatWholeNumber(aggregatedApplications),
      },
    });
  });

  return Array.from(categoryRowMap.values());
};

export const buildServiceOperationsRows = ({
  keyword = "",
  option = "AllServices",
  department = "AllDepartments",
  pageIndex,
  pageSize,
  orderby,
  sort,
}: ServiceOperationsTableParams): PaginatedTableResult<ServiceOperationsRow> => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filtered = serviceOperationsRowsMock.filter((row) => {
    const matchesKeyword =
      !normalizedKeyword ||
      row.serviceName.toLowerCase().includes(normalizedKeyword) ||
      row.serviceCategory.toLowerCase().includes(normalizedKeyword);
    const matchesDepartment =
      department === "AllDepartments" || row.department === department;

    return matchesKeyword && matchesDepartment;
  });

  const sorted = [...filtered].sort((left, right) => {
    switch (orderby) {
      case "Applications":
        return compareNumber(
          sortMetricValue(left.applications),
          sortMetricValue(right.applications),
          sort,
        );
      case "TotalRevenue":
        return compareNumber(
          sortMetricValue(left.totalRevenue),
          sortMetricValue(right.totalRevenue),
          sort,
        );
      case "ApprovalRate":
        return compareNumber(
          sortMetricValue(left.approvalRate),
          sortMetricValue(right.approvalRate),
          sort,
        );
      case "AvgProcessingTime":
        return compareNumber(
          sortMetricValue(left.avgProcessingTime),
          sortMetricValue(right.avgProcessingTime),
          sort,
        );
      case "AvgSatisfaction":
        return compareNumber(
          sortMetricValue(left.avgSatisfaction),
          sortMetricValue(right.avgSatisfaction),
          sort,
        );
      case "RefundApplications":
        return compareNumber(
          sortMetricValue(left.refundApplications),
          sortMetricValue(right.refundApplications),
          sort,
        );
      case "TotalRefunds":
        return compareNumber(
          sortMetricValue(left.totalRefunds),
          sortMetricValue(right.totalRefunds),
          sort,
        );
      case "RefundRate":
        return compareNumber(
          sortMetricValue(left.refundRate),
          sortMetricValue(right.refundRate),
          sort,
        );
      default:
        return getDisplayName(left, option).localeCompare(
          getDisplayName(right, option),
        );
    }
  });

  return paginate(sorted, pageIndex, pageSize);
};

export const buildCustomerProfileInsightsRows = ({
  keyword = "",
  option = "AllServices",
  pageIndex,
  pageSize,
  orderby,
  sort,
}: CustomerProfileInsightsTableParams): PaginatedTableResult<CustomerProfileInsightsRow> => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const sourceRows =
    option === "AllCategories"
      ? buildCustomerProfileCategoryRows()
      : customerProfileInsightsRowsMock;
  const filtered = sourceRows.filter((row) => {
    const matchesKeyword =
      !normalizedKeyword ||
      row.serviceName.toLowerCase().includes(normalizedKeyword) ||
      row.serviceCategory.toLowerCase().includes(normalizedKeyword);

    return matchesKeyword;
  });

  const sorted = [...filtered].sort((left, right) => {
    if (orderby === "Applications") {
      return compareNumber(
        sortMetricValue(left.applications),
        sortMetricValue(right.applications),
        sort,
      );
    }

    return getCustomerDisplayName(left, option).localeCompare(
      getCustomerDisplayName(right, option),
    );
  });

  return paginate(sorted, pageIndex, pageSize);
};
