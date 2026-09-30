import { Tabs } from "antd";
import type { TabOption } from "../type";

interface SectionTabsProps<T extends string = string> {
  items: TabOption<T>[];
  activeKey: T;
  onChange: (key: T) => void;
}

export default function SectionTabs<T extends string = string>({
  items,
  activeKey,
  onChange,
}: SectionTabsProps<T>) {
  return (
    <Tabs
      className="service-reports__tabs"
      activeKey={activeKey}
      onChange={(key) => onChange(key as T)}
    >
      {items.map((item) => (
        <Tabs.TabPane tab={item.label} key={item.key} />
      ))}
    </Tabs>
  );
}
