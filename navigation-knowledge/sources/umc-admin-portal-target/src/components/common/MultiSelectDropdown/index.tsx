import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input, Checkbox } from "antd";
import { CloseOutlined, CloseCircleFilled } from "@ant-design/icons";
import Sousuo from "@/assets/icons/Sousuo";
import { useTranslation } from "react-i18next";
import "./index.less";
import DownloadIcon from "@/assets/images/down.svg";
import RightIcon from "@/assets/images/right.svg";
export interface OptionItem {
  id: string;
  label: string;
  value: string;
  price?: number;
  category: string;
  hasHierarchy?: boolean;
  nameAr?: string;
  nameEn?: string;
}

export interface CategoryGroup {
  key: string;
  category?: string;
  options: OptionItem[];
  hasHierarchy: boolean;
}

interface MultiSelectDropdownProps {
  value?: string[];
  onChange?: (values: string[]) => void;
  options: OptionItem[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean; // /， true ()
  lockedValues?: string[];
  minSelectedCount?: number;
  hideClearAll?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  value = [],
  onChange,
  options,
  placeholder,
  label,
  required = false,
  disabled = false,
  multiple = true, //
  lockedValues = [],
  minSelectedCount = 0,
  hideClearAll = false,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder || t("sharedComponents.multiSelectDropdown.placeholder");
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipNextAutoSelectRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen && searchText) {
      setSearchText("");
    }
  }, [isOpen, searchText]);

  useEffect(() => {
    if (options.length === 1 && (!value || value.length === 0) && onChange) {
      if (skipNextAutoSelectRef.current) {
        skipNextAutoSelectRef.current = false;
        return;
      }
      onChange([options[0].value]);
    }
  }, [options, value, onChange]);

  // Preserve grouping only when the API actually returns parent-child activities.
  const groupedOptions = useMemo(
    () =>
      options.reduce((acc, option) => {
        const hasHierarchy = option.hasHierarchy !== false;
        const groupKey = hasHierarchy
          ? `group:${option.category}`
          : `option:${option.value}`;
        const existingGroup = acc.find((g) => g.key === groupKey);
        if (existingGroup) {
          existingGroup.options.push(option);
        } else {
          acc.push({
            key: groupKey,
            category: hasHierarchy ? option.category : undefined,
            options: [option],
            hasHierarchy,
          });
        }
        return acc;
      }, [] as CategoryGroup[]),
    [options],
  );

  useEffect(() => {
    const nextExpanded = new Set(groupedOptions.map((group) => group.category));
    setExpandedCategories((prev) => {
      if (prev.size === nextExpanded.size) {
        const isSame = Array.from(nextExpanded).every((item) => prev.has(item));
        if (isSame) {
          return prev;
        }
      }
      return nextExpanded;
    });
  }, [groupedOptions]);

  const filteredGroups = groupedOptions
    .map((group) => {
      const keyword = searchText.toLowerCase();
      const categoryMatched = group.hasHierarchy
        ? group.category?.toLowerCase().includes(keyword)
        : false;

      const filteredOptions = group.options.filter((option) => {
        if (!keyword) return true;
        if (categoryMatched) return true;
        return option.label.toLowerCase().includes(keyword);
      });

      return {
        ...group,
        options: filteredOptions,
      };
    })
    .filter((group) => group.options.length > 0);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const normalizedLockedValues = useMemo(
    () => Array.from(new Set((lockedValues || []).map((item) => String(item)))),
    [lockedValues],
  );
  const lockedValueSet = useMemo(
    () => new Set(normalizedLockedValues),
    [normalizedLockedValues],
  );
  const hasLockedValues = normalizedLockedValues.length > 0;

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleOptionChange = (optionValue: string, checked: boolean) => {
    if (!checked && lockedValueSet.has(optionValue)) {
      return;
    }

    let newValues: string[];
    if (multiple) {
      // ：
      if (checked) {
        newValues = [...new Set([...value, optionValue])];
      } else {
        if (value.includes(optionValue) && value.length <= minSelectedCount) {
          return;
        }
        if (value.includes(optionValue)) {
          skipNextAutoSelectRef.current = true;
        }
        newValues = value.filter((v) => v !== optionValue);
      }
    } else {
      // ：
      if (checked) {
        newValues = [optionValue];
        setIsOpen(false); //
      } else {
        if (value.includes(optionValue) && value.length <= minSelectedCount) {
          return;
        }
        if (value.includes(optionValue)) {
          skipNextAutoSelectRef.current = true;
        }
        newValues = [];
      }
    }
    onChange?.(newValues);
  };

  const handleRemoveTag = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || lockedValueSet.has(optionValue)) {
      return;
    }
    if (value.includes(optionValue) && value.length <= minSelectedCount) {
      return;
    }
    skipNextAutoSelectRef.current = true;
    const newValues = value.filter((v) => v !== optionValue);
    onChange?.(newValues);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || hasLockedValues || hideClearAll || minSelectedCount > 0) {
      return;
    }
    skipNextAutoSelectRef.current = true;
    onChange?.([]);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategorySelectAll = (category: string, checked: boolean) => {
    //
    if (!multiple) return;

    const categoryOptions =
      groupedOptions.find((g) => g.category === category)?.options || [];
    const categoryValues = categoryOptions.map((opt) => opt.value);

    let newValues: string[];
    if (checked) {
      newValues = [...new Set([...value, ...categoryValues])];
    } else {
      const removableValues = categoryValues.filter(
        (item) => !lockedValueSet.has(item),
      );
      if (
        value.length -
          removableValues.filter((item) => value.includes(item)).length <
        minSelectedCount
      ) {
        return;
      }
      newValues = value.filter(
        (v) => lockedValueSet.has(v) || !categoryValues.includes(v),
      );
    }
    onChange?.(newValues);
  };

  const isCategoryFullySelected = (category: string) => {
    const categoryOptions =
      groupedOptions.find((g) => g.category === category)?.options || [];
    return (
      categoryOptions.length > 0 &&
      categoryOptions.every((opt) => value.includes(opt.value))
    );
  };

  const isCategoryPartiallySelected = (category: string) => {
    const categoryOptions =
      groupedOptions.find((g) => g.category === category)?.options || [];
    return (
      categoryOptions.some((opt) => value.includes(opt.value)) &&
      !isCategoryFullySelected(category)
    );
  };

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      {label && (
        <div className="dropdown-label">
          {label}
          {required && <span className="required-mark"> *</span>}
        </div>
      )}

      <div
        className={`dropdown-selector ${isOpen ? "open" : ""} ${
          disabled ? "disabled" : ""
        }`}
        onClick={handleToggle}
      >
        <div className="selected-tags">
          {selectedOptions.length === 0 ? (
            <span className="placeholder">{resolvedPlaceholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                title={
                  lockedValueSet.has(option.value)
                    ? t("sharedComponents.multiSelectDropdown.prefilledLocked")
                    : undefined
                }
                className={[
                  "multi-select-dropdown__selected-tag",
                  multiple
                    ? "multi-select-dropdown__selected-tag--multiple"
                    : "multi-select-dropdown__selected-tag--single",
                  lockedValueSet.has(option.value)
                    ? "multi-select-dropdown__selected-tag--locked"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {option.label}
                {multiple && !disabled && value.length > minSelectedCount && (
                  !lockedValueSet.has(option.value) && (
                    <CloseOutlined
                      className="multi-select-dropdown__tag-close"
                      onClick={(e) => handleRemoveTag(option.value, e)}
                    />
                  )
                )}
              </span>
            ))
          )}
        </div>
        {selectedOptions.length > 0 &&
          !disabled &&
          !hasLockedValues &&
          !hideClearAll &&
          minSelectedCount === 0 && (
          <CloseCircleFilled
            className="clear-all-icon"
            onClick={handleClearAll}
          />
          )}
      </div>

      {isOpen && (
        <div className="dropdown-panel">
          <div className="search-box">
            <Input
              prefix={<Sousuo className="search-icon" />}
              placeholder={t("sharedComponents.multiSelectDropdown.search")}
              value={searchText}
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="options-list">
            {filteredGroups.map((group) => {
              if (!group.hasHierarchy) {
                return (
                    <div key={group.key} className="option-group">
                      <div className="group-options group-options-flat">
                      {group.options.map((option) => {
                        const isLocked =
                          lockedValueSet.has(option.value) &&
                          value.includes(option.value);
                        const isMinSelectionProtected =
                          value.includes(option.value) &&
                          value.length <= minSelectedCount;

                        return (
                        <div
                          key={option.value}
                          className={`option-item${isLocked ? " is-locked" : ""}`}
                        >
                          {multiple ? (
                            <Checkbox
                              disabled={isLocked || isMinSelectionProtected}
                              checked={value.includes(option.value)}
                              onChange={(e) =>
                                handleOptionChange(option.value, e.target.checked)
                              }
                            >
                              <span className="option-label">
                                {option.label}
                              </span>
                            </Checkbox>
                          ) : (
                            <div
                              className={`option-radio single ${
                                value.includes(option.value) ? "selected" : ""
                              }${isLocked ? " disabled" : ""}`}
                              onClick={() =>
                                !isLocked &&
                                handleOptionChange(
                                  option.value,
                                  !value.includes(option.value),
                                )
                              }
                            >
                              <span className="option-label">
                                {option.label}
                              </span>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const category = group.category || "";
              const isExpanded = expandedCategories.has(category);
              const isFullySelected = isCategoryFullySelected(category);
              const isPartiallySelected = isCategoryPartiallySelected(category);

              return (
                <div key={group.key} className="option-group">
                  <>
                    {" "}
                    <div
                      className="group-title"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="group-title-content">
                        <div className="group-title-left">
                          <span className="expand-icon">
                            {isExpanded ? (
                              <img src={DownloadIcon} />
                            ) : (
                              <img src={RightIcon} />
                            )}
                          </span>
                          {multiple ? (
                            <Checkbox
                              checked={isFullySelected}
                              indeterminate={isPartiallySelected}
                              onChange={(e) =>
                                handleCategorySelectAll(category, e.target.checked)
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="category-label">
                                {category}
                              </span>
                            </Checkbox>
                          ) : (
                            <span className="category-label single">
                              {category}
                            </span>
                          )}
                        </div>
                        {multiple && (
                          <span className="category-count">
                            {
                              group.options.filter((option) =>
                                value.includes(option.value),
                              ).length
                            }
                            /{group.options.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="group-options">
                        {group.options.map((option) => {
                          const isLocked =
                            lockedValueSet.has(option.value) &&
                            value.includes(option.value);
                          const isMinSelectionProtected =
                            value.includes(option.value) &&
                            value.length <= minSelectedCount;

                          return (
                          <div
                            key={option.value}
                            className={`option-item${isLocked ? " is-locked" : ""}`}
                          >
                            {multiple ? (
                              <Checkbox
                                disabled={isLocked || isMinSelectionProtected}
                                checked={value.includes(option.value)}
                                onChange={(e) =>
                                  handleOptionChange(
                                    option.value,
                                    e.target.checked,
                                  )
                                }
                              >
                                <span className="option-label">
                                  {option.label}
                                </span>
                              </Checkbox>
                            ) : (
                              <div
                                className={`option-radio single ${
                                  value.includes(option.value) ? "selected" : ""
                                }${isLocked ? " disabled" : ""}`}
                                onClick={() =>
                                  !isLocked &&
                                  handleOptionChange(
                                    option.value,
                                    !value.includes(option.value),
                                  )
                                }
                              >
                                <span className="option-label">
                                  {option.label}
                                </span>
                              </div>
                            )}
                            {/* {option.price !== undefined && (
                                <span className="option-price">
                                  <img src={AED}></img>
                                  {option.price ? formatPrice(option.price) : 0}
                                </span>
                              )} */}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                </div>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="no-results">{t("sharedComponents.multiSelectDropdown.noResults")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
