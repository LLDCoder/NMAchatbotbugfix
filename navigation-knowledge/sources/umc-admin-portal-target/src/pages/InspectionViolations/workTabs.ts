export type ViolationWorkTab = "todo" | "completed";

export const VIOLATION_WORK_TAB_PERMISSION_CODES: Record<
  ViolationWorkTab,
  string
> = {
  todo: "Inspection.ViolationManagement.ToDo",
  completed: "Inspection.ViolationManagement.Completed",
};

const VIOLATION_WORK_TABS: ViolationWorkTab[] = ["todo", "completed"];

export const isViolationWorkTab = (
  value?: string | null,
): value is ViolationWorkTab => (
  value === "todo" || value === "completed"
);

export const getAvailableViolationWorkTabs = (
  canRenderButton: (permissionCode?: string | null) => boolean,
) => VIOLATION_WORK_TABS.filter((tab) => (
  canRenderButton(VIOLATION_WORK_TAB_PERMISSION_CODES[tab])
));

export const resolveViolationWorkTab = (
  requestedTab: string | null | undefined,
  availableTabs: readonly ViolationWorkTab[],
): ViolationWorkTab | null => {
  if (!availableTabs.length) return null;
  if (isViolationWorkTab(requestedTab) && availableTabs.includes(requestedTab)) {
    return requestedTab;
  }
  return availableTabs[0];
};
