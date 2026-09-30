import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Modal, Input, Radio } from "antd";
import { HolderOutlined, DeleteOutlined } from "@ant-design/icons";
import { useForm } from "@formily/react";
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
} from "react-sortable-hoc";
import type { SortEnd } from "react-sortable-hoc";
import { arrayMoveImmutable } from "array-move";
import "./index.less";
import i18n from "@/localization/config";
import { useFormUiLang } from "@/components/designable/playground/FormPreviewLangContext";

/** Persisted enum shape for Radio.Group / single select fields */
export interface SingleSelectEnumOption {
  value: string;
  /** @deprecated use labelEn/labelAr; kept for legacy schemas */
  label?: string;
  keyEn?: string;
  keyAr?: string;
  labelEn?: string;
  labelAr?: string;
}

interface OptionItem {
  keyEn: string;
  keyAr: string;
  value: string;
}

interface SingleSelectOptionsSetterProps {
  value?: SingleSelectEnumOption[];
  onChange?: (value: SingleSelectEnumOption[]) => void;
}

function defaultOptionLabel(lng: "en" | "ar", num: number): string {
  return i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
    lng,
    num,
  });
}

function buildDefaultOptionItems(): OptionItem[] {
  return [
    {
      keyEn: defaultOptionLabel("en", 1),
      keyAr: defaultOptionLabel("ar", 1),
      value: "Option 1",
    },
    {
      keyEn: defaultOptionLabel("en", 2),
      keyAr: defaultOptionLabel("ar", 2),
      value: "Option 2",
    },
  ];
}

function buildPersistedEnum(opts: OptionItem[]): SingleSelectEnumOption[] {
  return opts.map((o) => ({
    value: o.value,
    keyEn: o.keyEn,
    keyAr: o.keyAr,
    labelEn: o.keyEn,
    labelAr: o.keyAr,
    label: o.keyEn,
  }));
}

const SingleSelectOptionsSetter: React.FC<SingleSelectOptionsSetterProps> = ({
  value,
  onChange,
}) => {
  const lang = useFormUiLang();
  const t = useCallback(
    (key: string, opts?: object) => i18n.t(key, { lng: lang, ...opts }),
    [lang],
  );

  const defaultOptions = useMemo(() => buildDefaultOptionItems(), []);

  const form = useForm();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<OptionItem[]>(defaultOptions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [defaultIndex, setDefaultIndex] = useState(0);

  const enumValue = value;
  type SettingsFormLike = {
    values?: { default?: string };
    setValuesIn?: (path: string, val: unknown) => void;
  };
  const settingsForm = form as SettingsFormLike;
  const defaultVal = settingsForm.values?.default;

  const parseOptions = useCallback(
    (enumArr: SingleSelectEnumOption[] | undefined): OptionItem[] => {
      if (!enumArr || !Array.isArray(enumArr) || enumArr.length === 0) {
        return buildDefaultOptionItems();
      }
      return enumArr.map((item) => {
        const legacyLabel =
          typeof item.label === "string" ? item.label : "";
        const labelEn =
          typeof item.labelEn === "string" && item.labelEn !== ""
            ? item.labelEn
            : legacyLabel;
        const labelAr =
          typeof item.labelAr === "string" && item.labelAr !== ""
            ? item.labelAr
            : legacyLabel;
        return {
          keyEn:
            typeof item.keyEn === "string" && item.keyEn !== ""
              ? item.keyEn
              : labelEn,
          keyAr:
            typeof item.keyAr === "string" && item.keyAr !== ""
              ? item.keyAr
              : labelAr,
          value: item.value,
        };
      });
    },
    [],
  );

  const findDefaultIndex = useCallback(
    (opts: OptionItem[], def: string | undefined): number => {
      if (!def || opts.length === 0) return 0;
      const idx = opts.findIndex((o) => o.value === def);
      return idx >= 0 ? idx : 0;
    },
    [],
  );

  useEffect(() => {
    const opts = parseOptions(enumValue);
    setOptions(opts);
    setSelectedIndex(0);
    setDefaultIndex(findDefaultIndex(opts, defaultVal));
  }, [visible, enumValue, defaultVal, parseOptions, findDefaultIndex]);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const opts = parseOptions(enumValue);
    setOptions(opts.length > 0 ? opts : defaultOptions);
    setSelectedIndex(0);
    setDefaultIndex(findDefaultIndex(opts, defaultVal));
    setVisible(true);
  };

  const handleSave = () => {
    const enumArr = buildPersistedEnum(options);
    const defaultOptionValue =
      options.length > 0 ? options[defaultIndex].value : undefined;

    onChange?.(enumArr);
    settingsForm.setValuesIn?.("default", defaultOptionValue);
    setVisible(false);
  };

  const handleCancel = () => {
    const opts = parseOptions(enumValue);
    setOptions(opts.length > 0 ? opts : defaultOptions);
    setSelectedIndex(0);
    setDefaultIndex(findDefaultIndex(opts, defaultVal));
    setVisible(false);
  };

  const isConfigured =
    enumValue && Array.isArray(enumValue) && enumValue.length > 0;

  const handleAddNode = () => {
    const num = options.length + 1;
    const newOpt: OptionItem = {
      keyEn: defaultOptionLabel("en", num),
      keyAr: defaultOptionLabel("ar", num),
      value: `Option ${num}`,
    };
    setOptions([...options, newOpt]);
    setSelectedIndex(options.length);
  };

  const handleDelete = (index: number) => {
    if (options.length <= 1) return;
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
    if (selectedIndex >= next.length) {
      setSelectedIndex(Math.max(0, next.length - 1));
    } else if (selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (defaultIndex >= next.length) {
      setDefaultIndex(Math.max(0, next.length - 1));
    } else if (defaultIndex > index) {
      setDefaultIndex(defaultIndex - 1);
    }
  };

  const handleKeyEnChange = (index: number, keyEn: string) => {
    const next = [...options];
    next[index] = { ...next[index], keyEn };
    setOptions(next);
  };

  const handleKeyArChange = (index: number, keyAr: string) => {
    const next = [...options];
    next[index] = { ...next[index], keyAr };
    setOptions(next);
  };

  const handleValueChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = { ...next[index], value: val };
    setOptions(next);
  };

  const onSortEnd = ({ oldIndex, newIndex }: SortEnd) => {
    if (oldIndex === newIndex) return;
    const next = arrayMoveImmutable(options, oldIndex, newIndex);
    setOptions(next);
    setSelectedIndex(
      selectedIndex === oldIndex
        ? newIndex
        : selectedIndex < oldIndex && selectedIndex >= newIndex
          ? selectedIndex + 1
          : selectedIndex > oldIndex && selectedIndex <= newIndex
            ? selectedIndex - 1
            : selectedIndex,
    );
    setDefaultIndex(
      defaultIndex === oldIndex
        ? newIndex
        : defaultIndex < oldIndex && defaultIndex >= newIndex
          ? defaultIndex + 1
          : defaultIndex > oldIndex && defaultIndex <= newIndex
            ? defaultIndex - 1
            : defaultIndex,
    );
  };

  const selectedOption = options[selectedIndex];

  const treeDisplayLabel = (opt: OptionItem) =>
    lang === "ar" ? opt.keyAr : opt.keyEn;

  const DragHandle = SortableHandle(() => (
    <span className="drag-handle">
      <HolderOutlined />
    </span>
  ));

  const SortableOptionItem = SortableElement(
    ({
      opt,
      index: _sortableIndex,
      isSelected,
      isDefault,
      onSelect,
      onDefaultChange,
      onDelete,
    }: {
      opt: OptionItem;
      index: number;
      isSelected: boolean;
      isDefault: boolean;
      onSelect: () => void;
      onDefaultChange: () => void;
      onDelete: () => void;
    }) => {
      void _sortableIndex;
      return (
        <div
          className={`option-item ${isSelected ? "selected" : ""}`}
          onClick={onSelect}
        >
          <DragHandle />
          <span className="option-label">{treeDisplayLabel(opt)}</span>
          <Radio
            checked={isDefault}
            onChange={onDefaultChange}
            onClick={(e) => e.stopPropagation()}
          />
          <span
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlined />
          </span>
        </div>
      );
    },
  );

  const SortableOptionsList = SortableContainer(
    ({ children }: { children?: React.ReactNode }) => (
      <div className="options-list">{children}</div>
    ),
  );

  return (
    <div className="single-select-options-setter">
      <Button
        block
        type="default"
        htmlType="button"
        className={`options-config-btn ${isConfigured ? "configured" : ""}`}
        onClick={handleOpenModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isConfigured
          ? t("SingleSelectOptionsSetter.configured")
          : t("SingleSelectOptionsSetter.configure")}
      </Button>
      <Modal
        centered
        title={t("SingleSelectOptionsSetter.modalTitle")}
        visible={visible}
        onCancel={handleCancel}
        footer={null}
        width={900}
        className="single-select-options-modal"
        destroyOnClose
        maskClosable={false}
        getContainer={() => document.body}
        style={{ top: 20 }}
      >
        <div className="modal-scroll-dom">
          <div className="options-config-content">
            <div className="options-tree-section">
              <div className="section-header">
                <span className="section-label">
                  {t("SingleSelectOptionsSetter.treeTitle")}
                </span>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  onClick={handleAddNode}
                  className="add-node-btn"
                >
                  {t("SingleSelectOptionsSetter.addNode")}
                </Button>
              </div>
              <SortableOptionsList
                onSortEnd={onSortEnd}
                useDragHandle
                helperClass="sortable-helper"
              >
                {options.map((opt, index) => (
                  <SortableOptionItem
                    key={`opt-${index}`}
                    index={index}
                    opt={opt}
                    isSelected={selectedIndex === index}
                    isDefault={defaultIndex === index}
                    onSelect={() => setSelectedIndex(index)}
                    onDefaultChange={() => setDefaultIndex(index)}
                    onDelete={() => handleDelete(index)}
                  />
                ))}
              </SortableOptionsList>
            </div>
            <div className="node-property-section">
              <div className="section-label">
                {t("SingleSelectOptionsSetter.nodePropertyTitle")}
              </div>
              {selectedOption ? (
                <div className="property-fields">
                  <div className="field-item">
                    <label>
                      {t("SingleSelectOptionsSetter.keyEnLabel")}{" "}
                      <span className="required-mark">*</span>
                    </label>
                    <Input
                      value={selectedOption.keyEn}
                      onChange={(e) =>
                        handleKeyEnChange(
                          selectedIndex,
                          e.target.value.slice(0, 200),
                        )
                      }
                      maxLength={200}
                      placeholder={t(
                        "SingleSelectOptionsSetter.keyEnPlaceholder",
                      )}
                    />
                  </div>
                  <div className="field-item">
                    <label>
                      {t("SingleSelectOptionsSetter.keyArLabel")}{" "}
                      <span className="required-mark">*</span>
                    </label>
                    <Input
                      value={selectedOption.keyAr}
                      onChange={(e) =>
                        handleKeyArChange(
                          selectedIndex,
                          e.target.value.slice(0, 200),
                        )
                      }
                      maxLength={200}
                      placeholder={t(
                        "SingleSelectOptionsSetter.keyArPlaceholder",
                      )}
                    />
                  </div>
                  <div className="field-item">
                    <label>
                      {t("SingleSelectOptionsSetter.valueLabel")}{" "}
                      <span className="required-mark">*</span>
                    </label>
                    <Input
                      value={selectedOption.value}
                      onChange={(e) =>
                        handleValueChange(
                          selectedIndex,
                          e.target.value.slice(0, 200),
                        )
                      }
                      maxLength={200}
                      placeholder={t("SingleSelectOptionsSetter.valuePlaceholder")}
                    />
                  </div>
                </div>
              ) : (
                <div className="no-selection">
                  {t("SingleSelectOptionsSetter.noSelection")}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer-custom">
          <Button onClick={handleCancel} className="cancel-btn">
            {t("SingleSelectOptionsSetter.cancel")}
          </Button>
          <Button type="primary" onClick={handleSave} className="save-btn">
            {t("SingleSelectOptionsSetter.save")}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default SingleSelectOptionsSetter;
