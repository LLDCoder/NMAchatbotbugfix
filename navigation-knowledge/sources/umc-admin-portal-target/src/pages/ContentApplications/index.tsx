import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import {
  INIT_STATE,
  reducer,
  type TKeyOfAppTab,
  APP_TAB,
  type TValOfAppTab,
} from "./type"
import "./index.less"
import { MyTasks } from "./components/MyTasks"
import { getContentUrgentCount } from "@/services/content"
import { CustomMessage } from "@/components/common"
import { useTranslation } from "react-i18next"
import { useHistory, useLocation } from "react-router-dom"
import { ContentContext } from "./context"

const VISIBLE_TABS: TValOfAppTab[] = [APP_TAB.myTasks]

const APP_TAB_VALUES = new Set<TValOfAppTab>(Object.values(APP_TAB))
const APP_TAB_ALIAS_TO_VALUE: Record<TKeyOfAppTab, TValOfAppTab> = {
  myTasks: APP_TAB.myTasks,
  teamMembers: APP_TAB.teamMembers,
  teamTasks: APP_TAB.teamTasks,
}
const APP_TAB_VALUE_TO_ALIAS: Record<TValOfAppTab, TKeyOfAppTab> = {
  [APP_TAB.myTasks]: "myTasks",
  [APP_TAB.teamMembers]: "teamMembers",
  [APP_TAB.teamTasks]: "teamTasks",
}

const getAppTabFromSearch = (search: string): TValOfAppTab => {
  const tab = new URLSearchParams(search).get("tab")

  if (tab && tab in APP_TAB_ALIAS_TO_VALUE) {
    return APP_TAB_ALIAS_TO_VALUE[tab as TKeyOfAppTab]
  }

  return APP_TAB_VALUES.has(tab as TValOfAppTab)
    ? (tab as TValOfAppTab)
    : APP_TAB.myTasks
}

export default function ContentApplications() {
  const { t } = useTranslation()
  const history = useHistory()
  const location = useLocation()
  const [contentContext, setContext] = useReducer(reducer, INIT_STATE)
  const [appTab, setAppTab] = useState<TValOfAppTab>(() =>
    getAppTabFromSearch(location.search)
  )

  const syncAppTabToUrl = useCallback(
    (nextTab: TValOfAppTab) => {
      const params = new URLSearchParams(location.search)
      const nextTabAlias = APP_TAB_VALUE_TO_ALIAS[nextTab]

      if (params.get("tab") === nextTabAlias) {
        return
      }

      params.set("tab", nextTabAlias)
      history.replace({
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      })
    },
    [history, location.pathname, location.search]
  )

  const handleAppTabChange = useCallback(
    (nextTab: TValOfAppTab) => {
      if (!VISIBLE_TABS.includes(nextTab)) {
        return
      }

      setAppTab(nextTab)
      syncAppTabToUrl(nextTab)
    },
    [syncAppTabToUrl]
  )

  const getUrgentCount = useCallback(async () => {
    try {
      const res = await getContentUrgentCount()
      const urgentCount = Number(res.data)

      if (Number.isFinite(urgentCount)) {
        setContext({ type: "UPDATE_URGENT_COUNT", payload: urgentCount })
      }
    } catch {
      CustomMessage.error(t("Content.contentApplications.messages.failedToGetUrgentCount"))
    }
  }, [t])

  const dispatch = useCallback(() => {
    getUrgentCount()
  }, [getUrgentCount])

  const contextValue = useMemo(() => {
    return {
      ...contentContext,
      dispatch,
    }
  }, [contentContext, dispatch])

  // ------ effect -------

  useEffect(() => {
    const nextTab = getAppTabFromSearch(location.search)

    if (nextTab !== appTab) {
      setAppTab(nextTab)
    }
  }, [appTab, location.search])

  useEffect(() => {
    if (!VISIBLE_TABS.includes(appTab)) {
      handleAppTabChange(APP_TAB.myTasks)
    }
  }, [appTab, handleAppTabChange])

  return (
    <ContentContext.Provider value={contextValue}>
      <div className="content-applications-container">
        <MyTasks />
      </div>
    </ContentContext.Provider>
  )
}
