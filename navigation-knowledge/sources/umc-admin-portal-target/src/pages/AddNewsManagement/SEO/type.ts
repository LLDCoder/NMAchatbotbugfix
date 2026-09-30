import type { FormInstance } from "antd"

interface ISEOFieldType {
  seotitle: string
  seodescription: string
  seokeyWords: string
}

interface IProps {
  seoForm: FormInstance<ISEOFieldType>
}

export type { IProps, ISEOFieldType }
