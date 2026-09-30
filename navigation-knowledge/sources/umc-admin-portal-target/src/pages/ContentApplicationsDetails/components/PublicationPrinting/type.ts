import type { ITaskDetails } from "@/services/content"

interface IProps {
  data?: ITaskDetails
}

interface ITaskList {
  name: string
  value: string | number | boolean
  icon: string
}

export type { IProps, ITaskList }
