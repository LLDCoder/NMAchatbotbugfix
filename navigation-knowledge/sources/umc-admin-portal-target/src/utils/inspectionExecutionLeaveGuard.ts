export const INSPECTION_EXECUTION_PATH = '/inspection/tasks/execution';
export const INSPECTION_EXECUTION_SAVE_DRAFT_EVENT = 'inspectionExecution:saveDraft';

const INSPECTION_LEAVE_CONFIRM_BYPASS_STATE_KEY = '__inspectionLeaveConfirmBypass';
let shouldBypassNextInspectionLeaveConfirm = false;

type HistoryStateRecord = Record<string, unknown>;

const isHistoryStateRecord = (state: unknown): state is HistoryStateRecord =>
  Boolean(state && typeof state === 'object' && !Array.isArray(state));

export const isInspectionExecutionPath = (pathname?: string) =>
  Boolean(
    pathname === INSPECTION_EXECUTION_PATH ||
    pathname?.startsWith(`${INSPECTION_EXECUTION_PATH}/`),
  );

export const getInspectionLeaveConfirmBypassState = (state?: unknown): HistoryStateRecord => ({
  ...(isHistoryStateRecord(state) ? state : {}),
  [INSPECTION_LEAVE_CONFIRM_BYPASS_STATE_KEY]: true,
});

export const shouldBypassInspectionLeaveConfirm = (state?: unknown) =>
  isHistoryStateRecord(state) && state[INSPECTION_LEAVE_CONFIRM_BYPASS_STATE_KEY] === true;

export const markNextInspectionLeaveConfirmBypassed = () => {
  shouldBypassNextInspectionLeaveConfirm = true;
};

export const consumeInspectionLeaveConfirmBypass = (state?: unknown) => {
  const shouldBypass =
    shouldBypassInspectionLeaveConfirm(state) || shouldBypassNextInspectionLeaveConfirm;
  shouldBypassNextInspectionLeaveConfirm = false;
  return shouldBypass;
};

export const requestInspectionExecutionDraftSave = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(INSPECTION_EXECUTION_SAVE_DRAFT_EVENT));
};
