import { Tabs } from "antd"
import { useState } from "react"
import { APP_TAB_LABEL, type TKeyOfAppTabLabel } from "./type"
import "./index.less"
import Books from "./components/Books"
import NewspapersMagazines from "./components/NewspapersMagazines"
import Cinema from "./components/Cinema"
import VideoGames from "./components/VideoGames"
import RegulateEntryItems from "./components/RegulateEntryItems"
import BlockedAuthors from "./components/BlockedAuthors"
import { useTranslation } from "react-i18next"
export default function ContentLibrary() {
  const { t } = useTranslation()
  const [appTab, setAppTab] = useState('books')
  return (
    <div className="content-library-container">
      <Tabs
        className="content-library-tabs"
        defaultActiveKey={'books'}
        activeKey={appTab}
        onChange={(key) => setAppTab(key)}
      >
        {Object.keys(APP_TAB_LABEL).map((key: string) => (
          <Tabs.TabPane
            tab={t(`Content.contentLibrary.tabs.${APP_TAB_LABEL[key as TKeyOfAppTabLabel]}`)}
            key={key}
          />
        ))}
      </Tabs>
      <div className="content-library-content">
        {appTab === 'books' && <Books />}
        {appTab === 'newspapers' && <NewspapersMagazines />}
        {appTab === 'movies' && <Cinema />}
        {appTab === 'videoGames' && <VideoGames />}
        {appTab === 'regulateEntryItems' && <RegulateEntryItems />}
        {appTab === 'blockedAuthors' && <BlockedAuthors />}
      </div>
    </div>
  )
}
