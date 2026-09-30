import React, { useEffect, useState } from "react";
import {
  connect,
  mapProps,
  mapReadPretty,
  observer,
  useField,
  useForm,
} from "@formily/react";
import { Select as AntdSelect } from "antd";
import type { SelectProps } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { PreviewText } from "@formily/antd";
import { getPortsList } from "@/services/services";
import {
  useFormPreviewLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { normalizeBilingualComponentProps } from "@/components/designable/src/utils/bilingual";
import "./index.less";

type LookupPortRecord = {
  id?: string | number;
  value?: string | number;
  code?: string | number;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  NameEn?: string;
  NameAr?: string;
  nameEnglish?: string;
  nameArabic?: string;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  emirateId?: string | number;
  emirateNameEn?: string;
  emirateNameAr?: string;
};

type EmiratePortValue =
  | string
  | number
  | {
    id?: string | number;
    emirateId?: string | number;
  };

type PortOption = {
  label: string;
  value: string | number;
  country: string;
  id: string | number;
  emirateId?: string | number;
};

const getResponseData = (response: unknown): unknown[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray((response as { data?: unknown }).data)
  ) {
    return (response as { data: unknown[] }).data;
  }

  return [];
};

const normalizeOptions = (data: unknown): PortOption[] => {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const record = item as LookupPortRecord;
    const label =
      record.nameEn ??
      record.name ??
      record.label ??
      record.labelEn ??
      String(record.id ?? record.value ?? "");
    const value = record.id ?? record.value ?? record.code ?? label;
    const country = record.emirateNameEn ? record.emirateNameEn : "-";
    return {
      label: String(label),
      value,
      country,
      id: record.id ?? record.value ?? record.code ?? label,
      emirateId: record.emirateId,
    };
  });
};

interface EmiratePortProps
  extends Omit<SelectProps<string | number>, "value" | "onChange"> {
  value?: EmiratePortValue;
  onChange?: (value: { id: string | number; emirateId?: string | number } | undefined) => void;
}

const getSelectedPortId = (value?: EmiratePortValue) => {
  if (value && typeof value === "object") {
    return value.id;
  }
  return value;
};

const EmiratePortReadPretty: React.FC<EmiratePortProps> = ({ value }) => {
  const [rawOptions, setRawOptions] = useState<unknown[]>([]);

  useEffect(() => {
    getPortsList()
      .then((res) => {
        setRawOptions(getResponseData(res));
      })
      .catch(() => setRawOptions([]));
  }, []);

  const options = React.useMemo(
    () => normalizeOptions(rawOptions),
    [rawOptions],
  );
  const selectedPortId = getSelectedPortId(value);
  const selectedPort = options.find((item) => item.value === selectedPortId);

  return (
    <PreviewText.Input value={selectedPort?.label ?? String(selectedPortId ?? "")} />
  );
};

const EmiratePortComponent: React.FC<EmiratePortProps> = ({
  value,
  onChange,
  ...props
}) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const field = useField();
  const form = useForm();
  const [rawOptions, setRawOptions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPortsList()
      .then((res) => {
        setRawOptions(getResponseData(res));
      })
      .catch(() => setRawOptions([]))
      .finally(() => setLoading(false));
  }, []);

  const options = React.useMemo(
    () => normalizeOptions(rawOptions),
    [rawOptions],
  );
  const normalizedProps = normalizeBilingualComponentProps(props, {
    lang,
    host,
    placeholderFallback: "",
  });
  const selectProps = { ...normalizedProps };
  delete selectProps.disabled;
  const isDisabled =
    Boolean(props.disabled) ||
    field?.pattern === "disabled" ||
    field?.pattern === "readOnly" ||
    field?.pattern === "readPretty" ||
    form?.pattern === "disabled" ||
    form?.pattern === "readOnly" ||
    form?.pattern === "readPretty";

  // return id and emirateId for rule strategy validation
  const handleChange = (selectedValue: string | number | undefined) => {
    if (isDisabled) {
      return;
    }

    if (selectedValue === undefined) {
      onChange?.(undefined);
      return;
    }

    const selectedOption = options.find((item) => item.value === selectedValue);

    if (!selectedOption) {
      onChange?.(undefined);
      return;
    }

    onChange?.({
      id: selectedOption.id,
      emirateId: selectedOption.emirateId,
    });
  };

  return (
    <AntdSelect
      {...selectProps}
      value={getSelectedPortId(value)}
      disabled={isDisabled}
      onChange={handleChange}
      loading={loading}
      optionLabelProp="label"
    >
      {options.map((item) => (
        <AntdSelect.Option key={item.value} value={item.value} label={item.label}>
          <div className="emirate-port-option">
            <div className="emirate-port-option-label">{item.label}</div>
            <div className="emirate-port-option-country">{item.country}</div>
          </div>
        </AntdSelect.Option>
      ))}
    </AntdSelect>
  );
};

const EmiratePortObserved = observer(EmiratePortComponent);

export const EmiratePort = connect(
  EmiratePortObserved,
  mapProps(
    { loading: true },
    (props, field) => {
      const currentField = field as { loading?: boolean; validating?: boolean } | undefined;
      return {
        ...props,
        suffixIcon:
          currentField?.loading || currentField?.validating ? (
            <LoadingOutlined />
          ) : (
            props.suffixIcon
          ),
      };
    }
  ),
  mapReadPretty(EmiratePortReadPretty)
);

export default EmiratePort;
