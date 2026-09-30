interface ISearchParams {
  taskId: string
}

type TWhichToExpand =
  | "applicantInformation"
  | "applicationOverview"
  | "ai"
  | "applicant"
  | "establishment"
  | ""

type TWhichExpanded = Partial<{
  [key in TWhichToExpand]: boolean
}>

interface IExpandContext {
  whichIsExpanded?: TWhichExpanded
  dispatch?: (whichToExpand: TWhichExpanded) => void
}

export type { ISearchParams, IExpandContext, TWhichExpanded, TWhichToExpand }
