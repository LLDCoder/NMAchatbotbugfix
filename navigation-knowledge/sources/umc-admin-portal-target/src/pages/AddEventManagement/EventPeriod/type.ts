import type { FormInstance } from "antd"
import type { Moment } from "moment"

export interface EventPeriodFieldType {
  publishType: string
  publishTime?: [Moment, Moment]
}

export interface IProps {
  EventForm: FormInstance<EventPeriodFieldType>
}

export type { IProps, EventPeriodFieldType }
