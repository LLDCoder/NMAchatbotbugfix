import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Modal, Input, Radio, Switch } from "antd";
import { HolderOutlined, DeleteOutlined } from "@ant-design/icons";
import { useForm, useField } from "@formily/react";
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

/** Persisted enum shape for Select / manual options */
export interface SelectEnumOption {
  value: string;
  /** @deprecated use labelEn/labelAr */
  label?: string;
  keyEn?: string;
  keyAr?: string;
  labelEn?: string;
  labelAr?: string;
  /** @deprecated use descriptionEn/descriptionAr */
  description?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  showDescription?: boolean;
}

interface SelectOptionItem {
  keyEn: string;
  keyAr: string;
  labelEn: string;
  labelAr: string;
  value: string;
  descriptionEn: string;
  descriptionAr: string;
  showDescription: boolean;
}

interface SelectOptionsSetterProps {
  value?: SelectEnumOption[];
  onChange?: (value: SelectEnumOption[]) => void;
  /** When true (e.g. Options Source is set), editing manual options is disabled. */
  disabled?: boolean;
}

function defaultOptionLabel(lng: "en" | "ar", num: number): string {
  return i18n.t("SelectOptionsSetter.defaultOptionLabel", { lng, num });
}

function buildDefaultOptionItems(): SelectOptionItem[] {
  return [1, 2, 3].map((num) => {
    const keyEn = defaultOptionLabel("en", num);
    const keyAr = defaultOptionLabel("ar", num);
    return {
      keyEn,
      keyAr,
      labelEn: keyEn,
      labelAr: keyAr,
      value: `Option ${num}`,
      descriptionEn: "",
      descriptionAr: "",
      showDescription: false,
    };
  });
}

function buildPersistedEnum(opts: SelectOptionItem[]): SelectEnumOption[] {
  return opts.map((o) => ({
    value: o.value,
    keyEn: o.keyEn,
    keyAr: o.keyAr,
    labelEn: o.labelEn,
    labelAr: o.labelAr,
    label: o.labelEn,
    descriptionEn: o.descriptionEn,
    descriptionAr: o.descriptionAr,
    description: o.descriptionEn,
    showDescription: o.showDescription,
  }));
}

const SelectOptionsSetter: React.FC<SelectOptionsSetterProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const lang = useFormUiLang();
  const t = useCallback(
    (key: string, opts?: object) => i18n.t(key, { lng: lang, ...opts }),
    [lang],
  );

  const defaultOptions = useMemo(() => buildDefaultOptionItems(), []);

  const form = useForm();
  const field = useField();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<SelectOptionItem[]>(defaultOptions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [defaultIndex, setDefaultIndex] = useState<number | null>(null);

  const enumValue = value;
  const defaultVal = (form as any).values?.default;

  const parseOptions = useCallback(
    (enumArr: SelectEnumOption[] | undefined): SelectOptionItem[] => {
      if (!enumArr || !Array.isArray(enumArr) || enumArr.length === 0) {
        return buildDefaultOptionItems();
      }
      return enumArr.map((item) => {
        const legacyLabel =
          typeof item.label === "string" ? item.label : "";
        const legacyDesc =
          typeof item.description === "string" ? item.description : "";
        const keyEnRaw =
          typeof item.keyEn === "string" && item.keyEn !== ""
            ? item.keyEn
            : legacyLabel;
        const keyArRaw =
          typeof item.keyAr === "string" && item.keyAr !== ""
            ? item.keyAr
            : legacyLabel;
        const labelEnRaw =
          typeof item.labelEn === "string" && item.labelEn !== ""
            ? item.labelEn
            : keyEnRaw;
        const labelArRaw =
          typeof item.labelAr === "string" && item.labelAr !== ""
            ? item.labelAr
            : keyArRaw;
        return {
          keyEn: keyEnRaw,
          keyAr: keyArRaw,
          labelEn: labelEnRaw,
          labelAr: labelArRaw,
          value: item.value,
          descriptionEn:
            typeof item.descriptionEn === "string"
              ? item.descriptionEn
              : legacyDesc,
          descriptionAr:
            typeof item.descriptionAr === "string"
              ? item.descriptionAr
              : legacyDesc,
          showDescription: item.showDescription || false,
        };
      });
    },
    [],
  );

  const findDefaultIndex = useCallback(
    (opts: SelectOptionItem[], def: string | undefined): number | null => {
      if (!def || opts.length === 0) return null;
      const idx = opts.findIndex((o) => o.value === def);
      return idx >= 0 ? idx : null;
    },
    [],
  );

  const fieldDisabled = Boolean(
    disabled ?? (field as any)?.disabled ?? field?.pattern === "disabled",
  );

  useEffect(() => {
    const opts = parseOptions(enumValue);
    setOptions(opts);
    setSelectedIndex(0);
    setDefaultIndex(findDefaultIndex(opts, defaultVal));
  }, [visible, enumValue, defaultVal, parseOptions, findDefaultIndex]);

  useEffect(() => {
    if (fieldDisabled && visible) {
      setVisible(false);
    }
  }, [fieldDisabled, visible]);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fieldDisabled) return;
    const opts = parseOptions(enumValue);
    setOptions(opts.length > 0 ? opts : defaultOptions);
    setSelectedIndex(0);
    setDefaultIndex(findDefaultIndex(opts, defaultVal));
    setVisible(true);
  };

  const handleSave = () => {
    const enumArr = buildPersistedEnum(options);
    const defaultOptionValue =
      defaultIndex !== null && options.length > 0
        ? options[defaultIndex].value
        : undefined;

    onChange?.(enumArr);
    (form as any).setValuesIn?.("default", defaultOptionValue);
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
    const keyEn = defaultOptionLabel("en", num);
    const keyAr = defaultOptionLabel("ar", num);
    const newOpt: SelectOptionItem = {
      keyEn,
      keyAr,
      labelEn: keyEn,
      labelAr: keyAr,
      value: `Option ${num}`,
      descriptionEn: "",
      descriptionAr: "",
      showDescription: false,
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
    if (defaultIndex === null) {
      // no-op
    } else if (defaultIndex === index) {
      setDefaultIndex(null);
    } else if (defaultIndex >= next.length) {
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

  const handleLabelEnChange = (index: number, labelEn: string) => {
    const next = [...options];
    next[index] = { ...next[index], labelEn };
    setOptions(next);
  };

  const handleLabelArChange = (index: number, labelAr: string) => {
    const next = [...options];
    next[index] = { ...next[index], labelAr };
    setOptions(next);
  };

  const handleValueChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = { ...next[index], value: val };
    setOptions(next);
  };

  const handleDescriptionEnChange = (index: number, desc: string) => {
    const next = [...options];
    next[index] = { ...next[index], descriptionEn: desc };
    setOptions(next);
  };

  const handleDescriptionArChange = (index: number, desc: string) => {
    const next = [...options];
    next[index] = { ...next[index], descriptionAr: desc };
    setOptions(next);
  };

  const handleShowDescriptionChange = (index: number, showDesc: boolean) => {
    const next = [...options];
    next[index] = { ...next[index], showDescription: showDesc };
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
      defaultIndex === null
        ? null
        : defaultIndex === oldIndex
          ? newIndex
          : defaultIndex < oldIndex && defaultIndex >= newIndex
            ? defaultIndex + 1
            : defaultIndex > oldIndex && defaultIndex <= newIndex
              ? defaultIndex - 1
              : defaultIndex,
    );
  };

  const selectedOption = options[selectedIndex];

  const treeDisplayLabel = (opt: SelectOptionItem) =>
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
      opt: SelectOptionItem;
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
          <span
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlined />
          </span>
          <Radio
            checked={isDefault}
            onClick={(e) => {
              e.stopPropagation();
              onDefaultChange();
            }}
          />
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
    <div className="select-options-setter">
      <Button
        block
        type="default"
        htmlType="button"
        disabled={fieldDisabled}
        className={`options-config-btn ${isConfigured ? "configured" : ""}`}
        onClick={handleOpenModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isConfigured
          ? t("SelectOptionsSetter.configured")
          : t("SelectOptionsSetter.configure")}
      </Button>
      <Modal
        centered
        title={t("SelectOptionsSetter.modalTitle")}
        visible={visible}
        onCancel={handleCancel}
        footer={null}
        width={900}
        className="select-options-modal"
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
                  {t("SelectOptionsSetter.treeTitle")}
                </span>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  onClick={handleAddNode}
                  className="add-node-btn"
                >
                  {t("SelectOptionsSetter.addNode")}
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
                    onDefaultChange={() =>
                      setDefaultIndex(defaultIndex === index ? null : index)
                    }
                    onDelete={() => handleDelete(index)}
                  />
                ))}
              </SortableOptionsList>
            </div>
            <div className="node-property-section">
              <div className="section-label">
                {t("SelectOptionsSetter.nodePropertyTitle")}
              </div>
              {selectedOption ? (
                <div className="property-fields">
                  <div className="field-item">
                    <label>
                      {t("SelectOptionsSetter.keyEnLabel")}{" "}
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
                      placeholder={t("SelectOptionsSetter.keyEnPlaceholder")}
                    />
                  </div>
                  <div className="field-item">
                    <label>
                      {t("SelectOptionsSetter.keyArLabel")}{" "}
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
                      placeholder={t("SelectOptionsSetter.keyArPlaceholder")}
                    />
                  </div>
                  <div className="field-item">
                    <label>
                      {t("SelectOptionsSetter.valueLabel")}{" "}
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
                      placeholder={t("SelectOptionsSetter.valuePlaceholder")}
                    />
                  </div>
                  <div className="field-item description-field">
                    <div className="description-header">
                      <label>{t("SelectOptionsSetter.descriptionLabel")}</label>
                      <Switch
                        checked={selectedOption.showDescription}
                        onChange={(checked) =>
                          handleShowDescriptionChange(selectedIndex, checked)
                        }
                        size="small"
                      />
                    </div>
                    {selectedOption.showDescription && (
                      <>
                        <Input.TextArea
                          value={selectedOption.descriptionEn}
                          onChange={(e) =>
                            handleDescriptionEnChange(
                              selectedIndex,
                              e.target.value.slice(0, 200),
                            )
                          }
                          maxLength={200}
                          placeholder={t(
                            "SelectOptionsSetter.descriptionEnPlaceholder",
                          )}
                          rows={3}
                          showCount
                        />
                        <Input.TextArea
                          value={selectedOption.descriptionAr}
                          onChange={(e) =>
                            handleDescriptionArChange(
                              selectedIndex,
                              e.target.value.slice(0, 200),
                            )
                          }
                          maxLength={200}
                          placeholder={t(
                            "SelectOptionsSetter.descriptionArPlaceholder",
                          )}
                          rows={3}
                          showCount
                          style={{ marginTop: 8 }}
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no-selection">
                  {t("SelectOptionsSetter.noSelection")}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer-custom">
          <Button onClick={handleCancel} className="cancel-btn">
            {t("SelectOptionsSetter.cancel")}
          </Button>
          <Button type="primary" onClick={handleSave} className="save-btn">
            {t("SelectOptionsSetter.save")}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default SelectOptionsSetter;
