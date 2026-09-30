export function canShowTicketChatInput(params: {
  isTeamTaskTodo: boolean;
  isCustomerHappness: boolean;
  status: number;
}): boolean {
  const { isTeamTaskTodo, isCustomerHappness, status } = params;

  if (isTeamTaskTodo) {
    return false;
  }

  if (isCustomerHappness) {
    return ![5, 6, 7].includes(status);
  }

  return status === 3;
}
