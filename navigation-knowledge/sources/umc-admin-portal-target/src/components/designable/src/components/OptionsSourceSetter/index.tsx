import React, { useState, useEffect, useCallback } from "react";
import { Select } from "antd";
import { useDesigner } from "@designable/react";
import "../UniqueValueSetter/index.less";
import { getLookupTables } from "@/services/services";
import { useTranslation } from "react-i18next";

export interface OptionsSourceSetterProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
}

const OptionsSourceSetter: React.FC<OptionsSourceSetterProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const engine = useDesigner();
  const [currentValue, setCurrentValue] = useState<string | undefined>(value);

  const getSelectedNode = useCallback(() => {
    try {
      const tree = engine?.getCurrentTree?.();
      const workspace = (engine as any)?.workbench?.currentWorkspace;
      const selectedId = workspace?.operation?.selection?.selected?.[0];
      return selectedId && tree ? tree.findById(selectedId) : null;
    } catch {
      return null;
    }
  }, [engine]);

  useEffect(() => {
    if (value !== currentValue) {
      setCurrentValue(value);
    }
  }, [value]);

  useEffect(() => {
    getLookupTables().then((res) => {
      const list = res.data || [];
      const formatted = (Array.isArray(list) ? list : [])
        .map((item: any) => {
          const name = item?.name != null ? String(item.name) : "";
          return { label: name, value: name };
        })
        .filter((o) => o.label.length > 0);
      setOptions(formatted);
    });
  }, []);

  const handleChange = (selectedValue: string | undefined) => {
    setCurrentValue(selectedValue);
    onChange?.(selectedValue);

    const node = getSelectedNode();
    if (!node) return;

    const prev = node.props["x-component-props"] || {};
    const next = { ...prev };
    if (selectedValue) {
      next.Source = selectedValue;
    } else {
      delete next.Source;
    }
    node.props["x-component-props"] = next;
  };

  return (
    <div className="unique-value-setter">
      <Select
        value={currentValue}
        onChange={handleChange}
        options={options}
        placeholder={t("Formily.designerSetters.selectOptionsSource")}
        allowClear
        showSearch
        optionFilterProp="label"
        style={{ width: "100%" }}
        getPopupContainer={(trigger) =>
          trigger.closest(".dn-settings-form") || document.body
        }
        className="umc-select-arrow-manual"
      />
    </div>
  );
};

export default OptionsSourceSetter;
