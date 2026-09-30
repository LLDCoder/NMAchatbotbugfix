import type { FormInstance } from "antd"

interface IContentFieldType {
  titleEn: string
  titleAr: string
  contentEn: string
  contentAr: string
}

interface IProps {
  contentForm: FormInstance<IContentFieldType>
}

export type { IProps, IContentFieldType }
