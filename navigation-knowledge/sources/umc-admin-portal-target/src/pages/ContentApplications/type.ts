interface IContentContext {
  urgentCount: number
  dispatch: () => void
}

interface IAction {
  type: "UPDATE_URGENT_COUNT"
  payload: number
}

const APP_TAB = {
  myTasks: "1",
  teamMembers: "2",
  teamTasks: "3",
} as const

type TValOfAppTab = (typeof APP_TAB)[keyof typeof APP_TAB]
type TKeyOfAppTab = keyof typeof APP_TAB

type TValList = TValOfAppTab[]

const Sorter = {
  ascend: 0,
  descend: 1,
} as const

const SorterKeys = {
  ascend: "ascend",
  descend: "descend",
} as const

type TSorter = typeof Sorter

// single sort rule
interface ISortRule<T extends Record<string, any>> {
  sortOrder: TSorter[keyof TSorter]
  sortField: keyof T | string
}

const INIT_STATE = {
  urgentCount: 0,
}

const reducer = (state: typeof INIT_STATE, action: IAction) => {
  switch (action.type) {
    case "UPDATE_URGENT_COUNT":
      return {
        ...state,
        urgentCount: action.payload,
      }
    default:
      return state
  }
}

export { reducer, INIT_STATE, APP_TAB }
export { Sorter, SorterKeys }
export type { TSorter, ISortRule }
export type { IContentContext, IAction, TKeyOfAppTab, TValOfAppTab, TValList }
