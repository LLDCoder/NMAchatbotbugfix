import { Tabs } from "antd";
import type { TabOption } from "../type";

interface SectionTabsProps<T extends string = string> {
  items: TabOption<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  variant?: "primary" | "secondary";
}

export default function SectionTabs<T extends string = string>({
  items,
  activeKey,
  onChange,
  variant = "primary",
}: SectionTabsProps<T>) {
  return (
    <Tabs
      className={`reports-tabs reports-tabs-${variant}`}
      activeKey={activeKey}
      onChange={(key) => onChange(key as T)}
    >
      {items.map((item) => (
        <Tabs.TabPane tab={item.label} key={item.key} />
      ))}
    </Tabs>
  );
}
