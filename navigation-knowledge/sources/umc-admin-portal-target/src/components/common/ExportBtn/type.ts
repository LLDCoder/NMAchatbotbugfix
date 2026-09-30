interface IExportBtnProps {
  exportCb: () => Promise<Blob | string>
  exportName: string
}

export type { IExportBtnProps }
