interface IFilter {
  keyword: string
  range: TMomentTuple
  member: string
}

type TAction = "update"

type TMomentTuple = [moment.Moment, moment.Moment]

interface IAction {
  type: TAction
  payload: Partial<IFilter>
}

interface IMemberSelection {
  label: string
  value: string
}

export type { IFilter, IAction, TMomentTuple, IMemberSelection }

/**
 * Modal ref type
 */
export interface IResumeWorkModalRef {
  show: () => void
}

export interface IMarkEmgLeaveModalRef {
  show: () => void
}
