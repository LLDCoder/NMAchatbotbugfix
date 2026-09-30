import React from "react";
import ServiceStepIcon from "./ServiceStepIcon";
import "./index.less";

export interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export interface CustomStepTabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export interface StepTabsHeaderProps {
  items: TabItem[];
  completedList: string[];
  activeKey: string;
  onChange: (key: string) => void;
}

export interface StepTabsContentProps {
  items: TabItem[];
  activeKey: string;
}

// 
export const StepTabsHeader: React.FC<StepTabsHeaderProps> = ({
  items,
  completedList = [],
  activeKey,
  onChange,
}) => {
  return (
    <div className="service-stepper">
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const isCompleted = completedList.includes(item.key);
        return (
          <div
            key={item.key}
            className={[
              "service-stepper__item",
              isActive ? "service-stepper__item--active" : "",
              isCompleted ? "service-stepper__item--completed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(item.key)}
          >
            <div className="service-stepper__content">
              <div className="service-stepper__icon">
                {isCompleted ? (
                  <ServiceStepIcon type="completed" />
                ) : (
                  item.icon
                )}
              </div>
              <div className="service-stepper__label">{item.label}</div>
            </div>
            {isActive && <div className="service-stepper__indicator" />}
          </div>
        );
      })}
    </div>
  );
};

// 
export const StepTabsContent: React.FC<StepTabsContentProps> = ({
  items,
  activeKey,
}) => {
  const isView = new URLSearchParams(location.search).get('view') === '1';

  return (
    <div className={`step-tabs-content ${isView ? 'page-disabled' : ''}`}>
      {items.map(
        (item) =>
          item.key != "2" && (
            <div
              key={item.key}
              className={`step-content ${
                item.key === activeKey ? "active" : ""
              }`}
            >
              {activeKey === item.key && item.children}
            </div>
          )
      )}
    </div>
  );
};

// （）
const CustomStepTabs: React.FC<CustomStepTabsProps> = ({
  items,
  activeKey,
  onChange,
}) => {
  return (
    <div className="custom-step-tabs">
      <StepTabsHeader
        items={items}
        completedList={[]}
        activeKey={activeKey}
        onChange={onChange}
      />
      <StepTabsContent items={items} activeKey={activeKey} />
    </div>
  );
};

export default CustomStepTabs;
