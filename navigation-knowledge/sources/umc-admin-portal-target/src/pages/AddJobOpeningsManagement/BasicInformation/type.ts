import type { FormInstance } from "antd"

interface IBasicFieldType {
  jobTitleEn: string
  jobTitleAr: string
  jobTypes: string
  applicationDeadline: string
  emirateId:number
}

interface IProps {
  BasicInformationForm: FormInstance<IBasicFieldType>
  ref: React.RefObject<any>
}

export type { IProps, IBasicFieldType }
