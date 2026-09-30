interface IApplicationContext {
  urgentCount: number
  dispatch: () => void
}

interface ApplicationStatusItem {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface IAction {
  type: "UPDATE_URGENT_COUNT"
  payload: number
}

interface IStatus {
  label: string;
  value: string;
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

export { reducer, INIT_STATE }
export type { IStatus, IApplicationContext, ApplicationStatusItem }
