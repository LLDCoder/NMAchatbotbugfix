import {
  emirateTableMock,
  financeReportsOverviewMock,
  userTypeTableMock,
} from "../data";
import type {
  AnalyticsResponse,
  EmirateTableRow,
  FinanceReportsOverviewData,
  UserTypeTableRow,
} from "../type";

const wait = (timeout = 120) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, timeout);
  });

export async function getFinanceReportsOverview(): Promise<
  AnalyticsResponse<FinanceReportsOverviewData>
> {
  await wait();

  return {
    data: financeReportsOverviewMock,
  };
}

export async function getFinanceEmirateTable(): Promise<
  AnalyticsResponse<EmirateTableRow[]>
> {
  await wait();

  return {
    data: emirateTableMock,
  };
}

export async function getFinanceUserTypeTable(): Promise<
  AnalyticsResponse<UserTypeTableRow[]>
> {
  await wait();

  return {
    data: userTypeTableMock,
  };
}

export async function exportFinanceEmirateTable() {
  await wait(80);
}

export async function exportFinanceUserTypeTable() {
  await wait(80);
}
