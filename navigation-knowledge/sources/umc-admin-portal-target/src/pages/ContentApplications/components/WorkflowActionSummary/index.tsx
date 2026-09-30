import type { FC } from "react"
import "./index.less"

interface WorkflowActionSummaryProps {
  title?: string
  items?: string[]
}

export const WorkflowActionSummary: FC<WorkflowActionSummaryProps> = ({
  title,
  items,
}) => {
  if (!items?.length) return null

  return (
    <div className="workflow-action-summary">
      {title && <div className="workflow-action-summary-title">{title}</div>}
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
