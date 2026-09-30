import { getTaskType } from "@/services/tickets";
import { canAccessRouteWithToast } from "@/routes/permissionNavigation";

const LICENSE_APPLICATION_DETAILS_PATH =
  "/licensing/applications/applicationsDetails";
const CONTENT_APPLICATION_DETAILS_PATH =
  "/content/ContentApplications/ContentApplicationsDetails";

type NavigationHistory = {
  push: (path: string) => void;
};

type TicketApplicationDetailsParams = {
  taskId: string;
  departmentId: number;
  applicationNo?: string;
};

function getTicketApplicationDetailsTarget(departmentId: number) {
  if (departmentId === 1) {
    return LICENSE_APPLICATION_DETAILS_PATH;
  }

  if (departmentId === 2) {
    return CONTENT_APPLICATION_DETAILS_PATH;
  }

  return "";
}

export function buildTicketApplicationDetailsPath({
  taskId,
  departmentId,
  applicationNo,
}: TicketApplicationDetailsParams) {
  const targetPath = getTicketApplicationDetailsTarget(departmentId);

  if (!targetPath) {
    return "";
  }

  const query = new URLSearchParams({
    taskId,
    sourcePage: "tickets",
    readOnly: "1",
  });

  if (applicationNo) {
    query.set("applicationNo", applicationNo);
  }

  return `${targetPath}?${query.toString()}`;
}

export async function navigateToTicketApplicationDetails(
  history: NavigationHistory,
  applicationNo?: string | null,
) {
  const normalizedApplicationNo = String(applicationNo || "").trim();

  if (!normalizedApplicationNo) {
    return;
  }

  const res = await getTaskType({ applicationNo: normalizedApplicationNo });
  const task = res.data;

  if (!task?.taskId || !task.departmentId) {
    return;
  }

  const targetPath = getTicketApplicationDetailsTarget(task.departmentId);

  if (!targetPath) {
    return;
  }

  if (!canAccessRouteWithToast(targetPath)) {
    return;
  }

  const detailPath = buildTicketApplicationDetailsPath({
    taskId: task.taskId,
    departmentId: task.departmentId,
    applicationNo: normalizedApplicationNo,
  });

  if (detailPath) {
    history.push(detailPath);
  }
}
