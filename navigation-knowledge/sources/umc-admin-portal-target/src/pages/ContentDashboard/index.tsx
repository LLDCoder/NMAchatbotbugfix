import { AIModelCenter } from "./components/AIModelCenter"
import { ApplicationTasks } from "./components/ApplicationTasks"
import { AssignedTasks } from "./components/AssignedTasks"
import { RecommendationSts } from "./components/RecommendationSts"
import { StatusBreakdown } from "./components/StatusBreakdown"
import { Summary } from "./components/Summary"
import { TaskBreakDown } from "./components/TaskBreakDown"
import "./index.less"

/*
  Layout mirrors Figma "Content / My Dashboard" (📒Tablet canvas).
  Desktop (grid-areas t/b/s/m/a/c):
    row1  Application Tasks              (full)
    row2  Task Breakdown | SLA | Summary
    row3  Recently Assigned | AI Model Center
  Tablet reorders (see index.less): Summary + AI Model Center drop to a bottom
  pair and the Recently Assigned table goes full width in the middle.

  The AI Model Center column stacks the risk card over the recommendation stats
  (Adoption Rate / Avg Processing Time), matching the single right-hand column in
  the design. PermitDistribution is not part of the design's My Dashboard, so it
  is no longer rendered here.
*/
export default function ContentDashboard() {
  return (
    <div className="content-dashboard">
      <div className="cd-area cd-area--apptasks">
        <ApplicationTasks />
      </div>
      <div className="cd-area cd-area--breakdown">
        <TaskBreakDown />
      </div>
      <div className="cd-area cd-area--sla">
        <StatusBreakdown />
      </div>
      <div className="cd-area cd-area--summary">
        <Summary />
      </div>
      <div className="cd-area cd-area--assigned">
        <AssignedTasks />
      </div>
      <div className="cd-area cd-area--aicenter">
        <AIModelCenter />
        <RecommendationSts />
      </div>
    </div>
  )
}
