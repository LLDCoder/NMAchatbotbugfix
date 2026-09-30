import { useState, type FC } from "react"
import type { IExportBtnProps } from "./type"
import { CustomButton } from "@/components/common"
import { useTranslation } from "react-i18next";

export const ExportBtn: FC<IExportBtnProps> = ({
  exportCb,
  exportName = "export.csv",
}) => {
  const [exportLoading, setExportLoading] = useState(false)
  const { t } = useTranslation();
  const exportHanld = async () => {
    try {
      setExportLoading(true)
      const res = await exportCb()
      // Handle blob response
      if (res instanceof Blob) {
        const url = URL.createObjectURL(res)
        const a = document.createElement('a')
        a.href = url
        a.download = exportName
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Fallback to CSV string handling
        const { exportCSVFile } = await import("@/utils/utils")
        exportCSVFile(res, exportName)
      }
      setExportLoading(false)
    } catch (error) {
      setExportLoading(false)
    }
  }

  return (
    <CustomButton
      text={t("common.export")}
      variant="outline"
      iconPosition="right"
      loading={exportLoading}
      onClick={exportHanld}
    />
  )
}
