export type InspectionTeamTaskListActionKey =
  | "edit"
  | "cancel"
  | "duplicate"
  | "viewReport"

interface GetInspectionTeamTaskListActionKeysParams {
  taskTab: "todo" | "completed"
  statusCode: string
  editable: boolean
  availableActions?: readonly string[] | null
}

export const getInspectionTeamTaskListActionKeys = ({
  taskTab,
  statusCode,
  editable,
  availableActions,
}: GetInspectionTeamTaskListActionKeysParams): InspectionTeamTaskListActionKey[] => {
  let candidateActions: InspectionTeamTaskListActionKey[] = []

  if (taskTab === "todo") {
    candidateActions = editable
      ? ["edit", "duplicate", "cancel"]
      : ["duplicate"]
  } else if (statusCode === "COMPLETED" || statusCode === "ACCESS_FAILED") {
    candidateActions = ["viewReport", "duplicate"]
  } else if (statusCode === "CANCELLED" || statusCode === "CANCELED") {
    candidateActions = ["duplicate"]
  }

  return candidateActions.filter((action) => availableActions?.includes(action))
}
