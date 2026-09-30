import React from "react";
import { Form } from "antd";
import type { FormInstance, FormProps } from "antd/es/form";
import "./index.less";

export type FormPanelMode = "view" | "edit";

export type FormPanelColumns = 1 | 2 | 3;

export interface FormPanelItemConfig {
  key: string;
  label?: React.ReactNode;
  renderView?: (value: any, record?: any) => React.ReactNode;
  renderEdit?: (form: FormInstance, record?: any) => React.ReactNode;
  colSpan?: 1 | 2 | 3;
  className?: string;
  editClassName?: string;
}

export interface FormPanelSectionConfig {
  key: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerSlot?: React.ReactNode;
  columns?: FormPanelColumns;
  items: FormPanelItemConfig[];
  gap?: number;
  rowGap?: number;
  containerColumns?: number;
  last?: boolean;
}

export interface FormPanelProps {
  mode?: FormPanelMode;
  sections: FormPanelSectionConfig[];
  form?: FormInstance;
  record?: any;
  onValuesChange?: FormProps["onValuesChange"];
  className?: string;
  style?: React.CSSProperties;
}

const FormPanel: React.FC<FormPanelProps> = ({
  mode = "edit",
  sections,
  form,
  record,
  onValuesChange,
  className = "",
  style,
}) => {
  const [internalForm] = Form.useForm();
  const formInstance = form || internalForm;

  return (
    <Form
      form={formInstance}
      layout="vertical"
      className={`custorm-form formPanelContainer ${className}`}
      style={style}
      onValuesChange={onValuesChange}
    >
      {sections.map((section) => {
        const columns = section.columns || 3;
        const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        const gap = section.gap;
        const rowGap = section.rowGap;

        return (
          <div
            key={section.key}
            className={`form-panel ${
              section.last ? "last" : section.containerColumns ? "other-form-panel" : ""
            }`}
          >
            {(section.title || section.description || section.headerSlot) && (
              <div className="form-panel-header">
                {section.headerSlot ? (
                  section.headerSlot
                ) : (
                  <>
                    {section.title && (
                      <div className="form-panel-title">{section.title}</div>
                    )}
                    {section.description && (
                      <div className="form-panel-description">
                        {section.description}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div
              className="form-panel-grid"
              style={{
                gridTemplateColumns,
                columnGap: gap,
                rowGap,
              }}
            >
              {section.items.map((item) => {
                const span = Math.min(item.colSpan || 1, columns);
                const value =
                  record &&
                  Object.prototype.hasOwnProperty.call(record, item.key)
                    ? record[item.key]
                    : formInstance.getFieldValue(item.key);

                return (
                  <div
                    key={item.key}
                    className="form-panel-item"
                    style={{ gridColumn: `span ${span}` }}
                  >
                    {mode === "view" && item.label && (
                      <div className="form-panel-item-label">
                        <span className="form-panel-item-label-text">
                          {item.label}
                        </span>
                      </div>
                    )}
                    <div
                      className={`${
                        mode === "edit" && item.editClassName && value
                          ? item.editClassName
                          : item.className || ""
                      } form-panel-item-content`}
                    >
                      {mode === "view"
                        ? item.renderView
                          ? item.renderView(value, record)
                          : value
                        : item.renderEdit
                        ? item.renderEdit(formInstance, record)
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Form>
  );
};

export default FormPanel;
