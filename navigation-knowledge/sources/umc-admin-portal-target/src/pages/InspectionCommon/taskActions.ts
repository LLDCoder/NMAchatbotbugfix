import type { InspectionRole } from './access';
import { hasStartedPreVisitExecution, normalizeTaskStatus } from './helpers';

type TaskLike = Record<string, unknown>;

export type InspectionTaskActionKey =
  | 'assign'
  | 'startVisit'
  | 'continueVisit'
  | 'edit'
  | 'cancel'
  | 'duplicate'
  | 'viewReport';

export type InspectionTaskActionGroup = 'danger' | 'secondary' | 'primary';

export const INSPECTION_TASK_ACTION_ORDER: InspectionTaskActionKey[] = [
  'cancel',
  'duplicate',
  'edit',
  'assign',
  'startVisit',
  'continueVisit',
  'viewReport',
];

export const normalizeInspectorIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const normalized = String(value || '').trim();
  return normalized ? [normalized] : [];
};

const asRecord = (value: unknown): TaskLike => (
  value && typeof value === 'object' ? value as TaskLike : {}
);

const getStringField = (record: TaskLike, key: string) => {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

export const getTaskInspectorIds = (record?: TaskLike | null) => {
  const assignment = asRecord(record?.assignment);
  const assignedInspectors = assignment.assignedInspectors;
  const getInspectorId = (value: unknown) => {
    const inspector = asRecord(value);
    return getStringField(inspector, 'inspectorId') ||
      getStringField(inspector, 'id') ||
      getStringField(inspector, 'userId') ||
      (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
  };

  if (Array.isArray(assignedInspectors)) {
    return assignedInspectors
      .map((item) => getInspectorId(item).trim())
      .filter(Boolean);
  }

  return normalizeInspectorIds(getInspectorId(assignedInspectors) || getInspectorId(assignment.assignedInspector));
};

const normalizeRoles = (role: InspectionRole | readonly InspectionRole[] | null | undefined) => (
  Array.isArray(role) ? role : role ? [role] : []
);

const hasRole = (
  roles: readonly InspectionRole[],
  allowedRoles: readonly InspectionRole[],
) => allowedRoles.some((role) => roles.includes(role));

const uniqueActionKeys = (actions: InspectionTaskActionKey[]) => (
  actions.filter((action, index) => actions.indexOf(action) === index)
);

export const isInspectionManagerRole = (
  role: InspectionRole | readonly InspectionRole[] | null | undefined,
) => hasRole(normalizeRoles(role), ['manager']);

const isManualInspectionTask = (record?: TaskLike | null) => (
  getStringField(asRecord(record?.taskSource), 'sourceTypeCode').toUpperCase() === 'MANUAL'
);

export const isInspectorOwnManualTask = (
  role: InspectionRole | readonly InspectionRole[] | null | undefined,
  record?: TaskLike | null,
  currentInspectorId = '',
) => (
  normalizeRoles(role).includes('inspector')
  && isManualInspectionTask(record)
  && getTaskInspectorIds(record).includes(currentInspectorId)
);

const getInspectionTaskActionKeysForRole = ({
  role,
  task,
  currentInspectorId = '',
}: {
  role: InspectionRole;
  task?: TaskLike | null;
  currentInspectorId?: string;
}): InspectionTaskActionKey[] => {
  const status = normalizeTaskStatus(getStringField(task || {}, 'status'));
  const isManagerRole = isInspectionManagerRole(role);
  const isOwnManualTask = isInspectorOwnManualTask(role, task, currentInspectorId);

  if (status === 'QUEUED') {
    return isManagerRole ? ['assign'] : [];
  }

  if (status === 'PENDING_VISIT') {
    if (role === 'inspector') {
      const visitAction: InspectionTaskActionKey = hasStartedPreVisitExecution(task)
        ? 'continueVisit'
        : 'startVisit';
      return isOwnManualTask
        ? [visitAction, 'duplicate', 'edit', 'cancel']
        : [visitAction, 'duplicate'];
    }

    return isManagerRole ? ['edit', 'cancel', 'duplicate'] : [];
  }

  if (status === 'IN_PROGRESS') {
    return role === 'inspector' ? ['continueVisit', 'duplicate'] : isManagerRole ? ['duplicate'] : [];
  }

  if (status === 'COMPLETED' || status === 'ACCESS_FAILED') {
    return role === 'inspector' || isManagerRole ? ['viewReport', 'duplicate'] : [];
  }

  if (status === 'CANCELLED') {
    return role === 'inspector' || isManagerRole ? ['duplicate'] : [];
  }

  return [];
};

export const getInspectionTaskActionKeys = ({
  role,
  task,
  currentInspectorId = '',
}: {
  role: InspectionRole | readonly InspectionRole[] | null | undefined;
  task?: TaskLike | null;
  currentInspectorId?: string;
}): InspectionTaskActionKey[] => {
  const roleActions = normalizeRoles(role).flatMap((item) =>
    getInspectionTaskActionKeysForRole({ role: item, task, currentInspectorId }),
  );

  return uniqueActionKeys(roleActions);
};

export const getInspectionTaskActionGroup = (
  actionKey: InspectionTaskActionKey,
): InspectionTaskActionGroup => {
  if (actionKey === 'cancel') return 'danger';
  if (['assign', 'startVisit', 'continueVisit', 'edit', 'viewReport'].includes(actionKey)) return 'primary';
  return 'secondary';
};
