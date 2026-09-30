import type { FormInstance } from "antd"
import type { Moment } from "moment"

export interface ITimingFieldType {
  publishType: string
  publishTime?: Moment
}

export interface IProps {
  timingForm: FormInstance<ITimingFieldType>
}

export type { IProps, ITimingFieldType }
