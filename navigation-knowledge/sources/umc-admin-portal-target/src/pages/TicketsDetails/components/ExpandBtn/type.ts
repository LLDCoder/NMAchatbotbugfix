interface IProps {
  isExpanded: boolean
  className?: string
  onShrinkClick: (e: React.MouseEvent) => void
  onExpandClick: (e: React.MouseEvent) => void
}

export type { IProps }
