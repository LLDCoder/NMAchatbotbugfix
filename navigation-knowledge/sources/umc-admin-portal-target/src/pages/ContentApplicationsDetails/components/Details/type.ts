import type { Service302MaterialStatusStateChange } from "@/utils/service302MaterialStatus"

interface IProps {
  tableData: unknown[]
  applicationId?: number
  serviceCode?: string | number | null
  profileId?: string | number | null
  applicationDetailId?: number
  taskId?: string
  materialStatusEditable?: boolean
  onMaterialStatusStateChange?: (
    change: Service302MaterialStatusStateChange,
  ) => void
}

export type { IProps }
