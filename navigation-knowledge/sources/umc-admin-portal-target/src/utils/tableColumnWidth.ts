export interface DynamicActionColumnWidthRow {
  texts?: Array<unknown> | null
  hasMoreIcon?: boolean | null
}

export interface DynamicActionColumnWidthOptions {
  defaultWidth?: number
  expandedWidth?: number
  fontSize?: number
  gap?: number
  cellPadding?: number
  moreIconWidth?: number
  averageCharWidthRatio?: number
}

const DEFAULT_DYNAMIC_ACTION_COLUMN_WIDTH_OPTIONS = {
  defaultWidth: 200,
  expandedWidth: 350,
  fontSize: 16,
  gap: 12,
  cellPadding: 32,
  moreIconWidth: 24,
  averageCharWidthRatio: 0.5,
}

const toText = (value: unknown) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const estimateTextWidth = (
  text: string,
  fontSize: number,
  averageCharWidthRatio: number,
) => Array.from(text).length * fontSize * averageCharWidthRatio

export const getDynamicActionColumnWidth = (
  rows: DynamicActionColumnWidthRow[] | null | undefined,
  options: DynamicActionColumnWidthOptions = {},
) => {
  const resolvedOptions = {
    ...DEFAULT_DYNAMIC_ACTION_COLUMN_WIDTH_OPTIONS,
    ...options,
  }
  const {
    defaultWidth,
    expandedWidth,
    fontSize,
    gap,
    cellPadding,
    moreIconWidth,
    averageCharWidthRatio,
  } = resolvedOptions

  const needsExpandedWidth = (rows || []).some((row) => {
    const texts = (row?.texts || []).map(toText).filter(Boolean)
    const itemCount = texts.length + (row?.hasMoreIcon ? 1 : 0)

    if (itemCount === 0) {
      return false
    }

    const textWidth = texts.reduce(
      (total, text) =>
        total + estimateTextWidth(text, fontSize, averageCharWidthRatio),
      0,
    )
    const gapsWidth = Math.max(0, itemCount - 1) * gap
    const iconWidth = row?.hasMoreIcon ? moreIconWidth : 0

    return textWidth + gapsWidth + iconWidth + cellPadding > defaultWidth
  })

  return needsExpandedWidth ? expandedWidth : defaultWidth
}
