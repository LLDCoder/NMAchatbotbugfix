import type { ReactNode } from "react"
import type { TableProps } from "antd"

interface IFilterItem {
  element: React.ReactElement
  label?: string
  requestDebounceMs?: number
}

type FilterItem = React.ReactElement | IFilterItem

type IFilterTableProps<T extends TableProps<Record<string, any>>> = {
  [key in keyof T]: T[key]
} & {
  tableFilters: FilterItem[]
  request: () => Promise<void> | undefined
  extraBtn?: React.ReactElement
  containerCls?: string
  renderSelectionTip?: () => React.ReactElement
  filterStore: IFilterStore
  autoRequestOnFilterChange?: boolean
  toolbarExtraContent?: ReactNode
  onOpenFilterModal?: () => void | Promise<void>
  /**
   * How many filters stay inline in the toolbar; the rest collapse into the filter
   * modal. Defaults to 3.
   */
  maxVisibleFilters?: number
  /**
   * Applies the shared FilterTable responsive contract. Three business filters
   * stay inline from 1440px upward; narrow layouts keep the first filter inline.
   */
  responsiveToolbar?: boolean
}

interface IFilterStore {
  register: (entity: ISubscribeEntity) => () => void
  getFieldValue: (key: string) => any
  getFieldsValue: () => any
  setFieldValue: (key: string, value: any) => boolean
  setFieldsValue: (value: Record<string, any>) => boolean
  resetFields: () => boolean
}

interface ISubscribeEntity {
  name: string
  onStoreChange: () => void
  freshItself: () => void
}

export type { IFilterTableProps, IFilterStore, ISubscribeEntity, IFilterItem, FilterItem }
