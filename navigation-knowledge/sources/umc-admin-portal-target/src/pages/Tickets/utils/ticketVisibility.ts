interface TicketConversationSource {
  surceTypeId?: number;
}

interface DepartmentProcessVisibility {
  enquiryStatusId?: number;
  isCustomerHappiness: boolean;
  reopenTimes?: number | null;
  isCurrentHandler?: boolean | null;
  requireCurrentHandler?: boolean;
}

interface TeamTaskReassignVisibility {
  enquiryStatusId?: number;
  isLeader?: boolean;
  isTeamTaskTodo: boolean;
}

export const getVisibleTicketConversations = <
  T extends TicketConversationSource,
>(records: T[], isCustomerHappiness: boolean): T[] => {
  if (isCustomerHappiness) return records;

  return records.filter((record) => ![1, 2].includes(record.surceTypeId ?? 0));
};

export const canShowDepartmentProcessActions = ({
  enquiryStatusId,
  isCustomerHappiness,
  reopenTimes,
  isCurrentHandler,
  requireCurrentHandler = false,
}: DepartmentProcessVisibility): boolean =>
  enquiryStatusId === 3 &&
  !isCustomerHappiness &&
  (isCurrentHandler === true ||
    (!requireCurrentHandler && reopenTimes === 0));

export const canShowTeamTaskReassignAction = ({
  enquiryStatusId,
  isLeader,
  isTeamTaskTodo,
}: TeamTaskReassignVisibility): boolean =>
  isTeamTaskTodo &&
  isLeader === true &&
  [1, 2, 3, 4].includes(enquiryStatusId ?? 0);
