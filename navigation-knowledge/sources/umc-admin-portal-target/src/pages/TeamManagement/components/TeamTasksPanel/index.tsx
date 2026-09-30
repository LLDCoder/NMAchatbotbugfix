import { type FC } from "react"
import { Card, Tabs } from "antd"
import { useTranslation } from "react-i18next"
import { FilterTable } from "@/components/common/FilterTable"
import { TEAM_TASK_TABS } from "../../constants"
import type { TeamTasksPanelProps } from "./type"
import { useTeamTasksPanel } from "./useTeamTasksPanel"
import "./index.less"

const supportsCompactFilters = (scope: string) =>
  scope === "licensing" ||
  scope === "content" ||
  scope === "customer" ||
  scope === "inspection"

export const TeamTasksPanel: FC<TeamTasksPanelProps> = (props) => {
  const { t } = useTranslation()
  const {
    scopeConfig,
    toggleControl,
    taskHeaderExtraContent,
  } = props
  const {
    activeTab,
    activePanelConfig,
    filterTableRenderKey,
    handleTabChange,
    resolvedTableConfigs,
    resolvedTableFilters,
    resolvedFilterStore,
    resolvedLoading,
    resolvedRequest,
    resolvedRenderSelectionTip,
    resolvedFilterTableContainerCls,
    extraActions,
    ensureMemberOptionsLoaded,
  } = useTeamTasksPanel(props)

  const filterTableContainerCls = [
    resolvedFilterTableContainerCls,
    scopeConfig.scope === "licensing" &&
      "team-management-filter-table--licensing",
    scopeConfig.scope === "content" &&
      "team-management-filter-table--content",
    scopeConfig.scope === "customer" &&
      "team-management-filter-table--customer",
    scopeConfig.scope === "inspection" &&
      "team-management-filter-table--inspection",
  ]
    .filter(Boolean)
    .join(" ")

  const headerExtraContent =
    toggleControl || taskHeaderExtraContent
      ? {
          right: (
            <div className="team-management-table-card__header-extra">
              {toggleControl}
              {taskHeaderExtraContent}
            </div>
          ),
        }
      : undefined

  const header = (
    <div className="team-management-table-card__header">
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        destroyInactiveTabPane={false}
        className={activePanelConfig?.tabsClassName}
        tabBarExtraContent={headerExtraContent}
      >
        {TEAM_TASK_TABS.map((item) => (
          <Tabs.TabPane tab={t(item.labelKey)} key={item.key} />
        ))}
      </Tabs>
    </div>
  )

  if (activePanelConfig?.customContent) {
    return (
      <Card
        className={[
          "team-management-table-card",
          activePanelConfig.cardClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {header}
        {activePanelConfig.customContent}
      </Card>
    )
  }

  return (
    <Card
      className={[
        "team-management-table-card",
        activePanelConfig?.cardClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {header}
      <FilterTable
        key={filterTableRenderKey}
        responsiveToolbar={supportsCompactFilters(scopeConfig.scope)}
        containerCls={filterTableContainerCls}
        {...resolvedTableConfigs}
        loading={resolvedLoading}
        filterStore={resolvedFilterStore}
        renderSelectionTip={resolvedRenderSelectionTip}
        tableFilters={resolvedTableFilters}
        request={resolvedRequest}
        autoRequestOnFilterChange={
          activePanelConfig?.autoRequestOnFilterChange
        }
        toolbarExtraContent={activePanelConfig?.toolbarExtraContent}
        extraBtn={extraActions || undefined}
        onOpenFilterModal={ensureMemberOptionsLoaded}
      />
    </Card>
  )
}
