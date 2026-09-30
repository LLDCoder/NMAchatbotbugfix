import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Select } from "antd";
import { useDesigner } from "@designable/react";
import { useLocation } from "react-router-dom";
import "./index.less";
import {
  getFieldDictionaryList,
  type FieldDictionaryItem,
} from "@/services/services";
import { useTranslation } from "react-i18next";
// Mock data - replace with API data later
// const MOCK_OPTIONS= []
export interface UniqueValueSetterProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
}

interface UniqueValueOption {
  label: string;
  value: string;
}

interface DesignerSelectionWorkspace {
  workbench?: {
    currentWorkspace?: {
      operation?: {
        selection?: {
          selected?: string[];
        };
      };
    };
  };
}

interface DesignerNodeWithProps {
  props: {
    name?: string;
  };
}

const UniqueValueSetter: React.FC<UniqueValueSetterProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const [MOCK_OPTIONS, setMOCK_OPTIONS] = useState<UniqueValueOption[]>([]);
  const engine = useDesigner();
  const location = useLocation();
  const [currentValue, setCurrentValue] = useState<string | undefined>(value);
  const currentServiceCode = useMemo(() => {
    const serviceCodeFromUrl = new URLSearchParams(location.search)
      .get("serviceCode")
      ?.trim();
    const serviceCodeFromStorage = localStorage.getItem("serviceCode")?.trim();

    return serviceCodeFromUrl || serviceCodeFromStorage || "";
  }, [location.search]);

  const getSelectedNode = useCallback(() => {
    try {
      const tree = engine?.getCurrentTree?.();
      const workspace = (engine as DesignerSelectionWorkspace)?.workbench
        ?.currentWorkspace;
      const selectedId = workspace?.operation?.selection?.selected?.[0];
      return selectedId && tree
        ? (tree.findById(selectedId) as DesignerNodeWithProps | null)
        : null;
    } catch {
      return null;
    }
  }, [engine]);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    getFieldDictionaryList(currentServiceCode).then((res) => {
      const fieldDictionaryList = Array.isArray(res.data) ? res.data : [];
      const formattedOptions = fieldDictionaryList.map(
        (item: FieldDictionaryItem) => ({
          label: item.fieldValue,
          value: item.fieldKey,
        }),
      );
      setMOCK_OPTIONS(formattedOptions);
    });
  }, [currentServiceCode]);

  const handleChange = (selectedValue: string | undefined) => {
    setCurrentValue(selectedValue);
    onChange?.(selectedValue);

    const node = getSelectedNode();
    if (node && selectedValue) {
      node.props.name = selectedValue;
    }
  };

  return (
    <div className="unique-value-setter">
      <Select
        value={currentValue}
        onChange={handleChange}
        options={MOCK_OPTIONS}
        placeholder={t("Formily.designerSetters.selectUniqueValue")}
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

export default UniqueValueSetter;
