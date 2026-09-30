import type { UploadFile, FormInstance } from "antd"

interface ICoverFieldType {
  imageUrl: string
}

interface IProps {
  coverForm: FormInstance<ICoverFieldType>
  onChange?: (files: UploadFile[]) => void
}

interface ICoverRef {
  getFileList: () => UploadFile[]
  setFileList: (url:string) => void
}

export type { IProps, ICoverRef, ICoverFieldType }
