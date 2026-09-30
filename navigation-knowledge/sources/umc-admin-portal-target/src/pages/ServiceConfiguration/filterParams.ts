import type { GetAllServicesParams } from "@/services/serviceApi";
import type { FilterValues } from "./FilterModal";

interface BuildServiceListParamsOptions {
  currentPage: number;
  pageSize: number;
  searchText: string;
  statusFilter?: string | null;
  typeFilter?: string | null;
  departmentFilter?: string | null;
  filterValues?: FilterValues;
}

type SelectValue = Array<string | number> | string | number | null | undefined;

const normalizeSelectValues = (value: SelectValue): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (value === null || value === undefined) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeDateBoundary = (
  value: string | undefined,
  boundaryTime: string,
) => {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue.includes("T")) {
    return normalizedValue;
  }

  return `${normalizedValue}T${boundaryTime}`;
};

const addDictionaryFilter = (
  params: GetAllServicesParams,
  key: "status" | "type",
  value?: string | null,
) => {
  if (value && value !== "all" && value !== "1") {
    params[key] = value;
  }
};

export const buildServiceListParams = ({
  currentPage,
  pageSize,
  searchText,
  statusFilter,
  typeFilter,
  departmentFilter,
  filterValues = {},
}: BuildServiceListParamsOptions): GetAllServicesParams => {
  const params: GetAllServicesParams = {
    pageIndex: currentPage,
    pageSize,
    search: searchText,
  };

  addDictionaryFilter(params, "status", statusFilter);
  addDictionaryFilter(params, "type", typeFilter);

  if (
    departmentFilter &&
    departmentFilter !== "all" &&
    departmentFilter !== "ML"
  ) {
    params.departmentId = departmentFilter;
  }

  const selectedPriorities = normalizeSelectValues(filterValues.priority);
  if (selectedPriorities.length > 0) {
    params.priority = selectedPriorities.join(",");
  }

  const selectedServiceCategories = normalizeSelectValues(
    filterValues.serviceCategory,
  );
  if (selectedServiceCategories.length > 0) {
    params.listServiceCategoryId = selectedServiceCategories.join(",");
  }

  const selectedDepartments = normalizeSelectValues(filterValues.department);
  if (selectedDepartments.length > 0) {
    params.departmentId = selectedDepartments[0];
  }

  const startTime = normalizeDateBoundary(filterValues.startTime, "00:00:00");
  const endTime = normalizeDateBoundary(filterValues.endTime, "23:59:59");

  if (startTime) {
    params.startTime = startTime;
  }

  if (endTime) {
    params.endTime = endTime;
  }

  return params;
};
