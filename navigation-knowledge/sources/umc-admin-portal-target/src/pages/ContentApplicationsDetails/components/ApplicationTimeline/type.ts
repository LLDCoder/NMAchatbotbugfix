import type { ITimeline } from "@/services/content"

interface IProps {
  timelineList: ITimeline[]
  serviceCode?: number | string | null
}

export type { IProps }
