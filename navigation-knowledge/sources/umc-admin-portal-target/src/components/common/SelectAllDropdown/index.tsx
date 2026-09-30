import React, { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Checkbox, Input } from "antd";
import { useTranslation } from "react-i18next";
import { DownOutlined, CloseCircleFilled, CloseOutlined } from "@ant-design/icons";
import Sousuo from "@/assets/icons/Sousuo";
import SimpleBar from "@/components/SimpleBar";
import type { SelectAllDropdownProps } from "./types";
import { getVisibleTagCount } from "./responsiveTagCount";
import "./index.less";

const SelectAllDropdown: React.FC<SelectAllDropdownProps> = ({
  value = [],
  onChange,
  options,
  placeholder,
  label,
  required = false,
  disabled = false,
  showSearch = true,
  maxTagCount = 3,
  compactMoreTag = false,
  className,
  showSelectAll = true,
  selectionDisplay = "tags",
  clearable = true,
  searchPlaceholder,
  noResultsText,
  selectAllLabel,
  tagRemovable = false,
  getPopupContainer,
  dropdownPanelClassName,
  tagCountDisplay = "parentheses",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleTagCount, setVisibleTagCount] = useState(0);
  const getOptionLabel = (label: unknown) => String(label ?? "");
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.selectOptions");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("common.search");
  const resolvedSelectAllLabel = selectAllLabel ?? t("common.selectAll");
  const resolvedNoResultsText = noResultsText ?? t("common.noOptionsFound");
  const getOptionDisplayLabel = (
    option: SelectAllDropdownProps["options"][number],
  ) => {
    const labelText = getOptionLabel(option.label);
    return typeof option.establishmentCount === "number"
      ? tagCountDisplay === "space"
        ? `${labelText} ${option.establishmentCount.toLocaleString("en-US")}`
        : `${labelText}(${option.establishmentCount.toLocaleString("en-US")})`
      : labelText;
  };

  const updateDropdownPosition = useCallback(() => {
    if (!getPopupContainer || !selectorRef.current) {
      return;
    }

    const popupContainer = getPopupContainer();
    const triggerRect = selectorRef.current.getBoundingClientRect();
    const containerRect =
      popupContainer === document.body
        ? { left: 0, top: 0 }
        : popupContainer.getBoundingClientRect();
    const scrollLeft =
      popupContainer === document.body ? window.scrollX : popupContainer.scrollLeft;
    const scrollTop =
      popupContainer === document.body ? window.scrollY : popupContainer.scrollTop;

    setDropdownStyle({
      left: triggerRect.left - containerRect.left + scrollLeft,
      top: triggerRect.bottom - containerRect.top + scrollTop + 8,
      width: triggerRect.width,
    });
  }, [getPopupContainer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(targetNode) &&
        !panelRef.current?.contains(targetNode)
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
    if (!isOpen || !getPopupContainer) {
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [getPopupContainer, isOpen, updateDropdownPosition]);

  const filteredOptions = options.filter((option) =>
    getOptionLabel(option.label)
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );
  const enabledFilteredOptions = filteredOptions.filter(
    (option) => !option.disabled,
  );
  const selectAllCount = options.some((option) => typeof option.establishmentCount === "number")
    ? filteredOptions.reduce((total, option) => total + (option.establishmentCount ?? 0), 0)
    : undefined;

  const selectedOptions = value
    .map((selectedValue) =>
      options.find((option) => option.value === selectedValue),
    )
    .filter(
      (
        option,
      ): option is NonNullable<(typeof options)[number]> => Boolean(option),
    );

  const isAllSelected =
    enabledFilteredOptions.length > 0 &&
    enabledFilteredOptions.every((option) => value.includes(option.value));
  const isIndeterminate =
    enabledFilteredOptions.some((option) => value.includes(option.value)) &&
    !isAllSelected;

  const responsive = maxTagCount === "responsive" && selectionDisplay === "tags";
  const measurementKey = JSON.stringify(selectedOptions.map((option) => [
    option.value, getOptionDisplayLabel(option), option.disabled,
  ]));
  useEffect(() => {
    const content = contentRef.current;
    const measure = measureRef.current;
    if (!responsive || !content || !measure || !measure.children.length) return;
    const update = () => {
      const tags = Array.from(measure.querySelectorAll<HTMLElement>("[data-tag-measure]"));
      const rests = Array.from(measure.querySelectorAll<HTMLElement>("[data-rest-measure]"));
      const gap = parseFloat(getComputedStyle(content).columnGap) || 0;
      setVisibleTagCount(getVisibleTagCount(
        tags.map((tag) => tag.getBoundingClientRect().width),
        content.getBoundingClientRect().width,
        gap,
        (count) => rests[count - 1]?.getBoundingClientRect().width || 0,
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    Array.from(measure.children).forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [responsive, measurementKey, compactMoreTag, disabled, tagRemovable, t]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    setIsOpen(false);
    selectorRef.current?.focus();
  };

  const handleOptionChange = (
    option: SelectAllDropdownProps["options"][number],
    checked: boolean,
  ) => {
    if (option.disabled) return;

    const optionValue = option.value;
    let newValues: typeof value;
    if (checked) {
      newValues = [...value, optionValue];
    } else {
      newValues = value.filter((v) => v !== optionValue);
    }
    onChange?.(newValues);
  };

  const handleSelectAll = (checked: boolean) => {
    const enabledFilteredValues = enabledFilteredOptions.map(
      (option) => option.value,
    );

    if (checked) {
      const newValues = [...new Set([...value, ...enabledFilteredValues])];
      onChange?.(newValues);
    } else {
      const newValues = value.filter(
        (v) => !enabledFilteredValues.includes(v),
      );
      onChange?.(newValues);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const disabledValues = new Set(
      options
        .filter((option) => option.disabled)
        .map((option) => option.value),
    );
    onChange?.(value.filter((item) => disabledValues.has(item)));
  };

  const handleRemoveTag = (
    option: SelectAllDropdownProps["options"][number],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (option.disabled) return;
    onChange?.(value.filter((item) => item !== option.value));
  };

  const renderSelectedContent = () => {
    if (selectedOptions.length === 0) {
      return <span className="placeholder">{resolvedPlaceholder}</span>;
    }

    if (selectionDisplay === "text") {
      const selectedText = selectedOptions
        .map((option) => getOptionLabel(option.label))
        .join(", ");
      return (
        <input
          readOnly
          tabIndex={-1}
          className="selected-text-input"
          value={selectedText}
          title={selectedText}
        />
      );
    }

    const count = typeof maxTagCount === "number" ? maxTagCount : visibleTagCount;
    const displayOptions = selectedOptions.slice(0, count);
    const remainingCount = selectedOptions.length - displayOptions.length;

    return (
      <>
        {displayOptions.map((option) => (
          <span key={option.value} className="selected-tag">
            <span
              className="selected-tag-label"
              title={getOptionDisplayLabel(option)}
            >
              {getOptionDisplayLabel(option)}
            </span>
            {tagRemovable && !disabled && !option.disabled && (
              <CloseOutlined
                className="tag-close"
                onClick={(e) => handleRemoveTag(option, e)}
              />
            )}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="selected-tag more-tag">
            {compactMoreTag ? `+${remainingCount}` : t("common.moreSelected", { count: remainingCount })}
          </span>
        )}
      </>
    );
  };

  const renderDropdownPanel = () => (
    <div
      ref={panelRef}
      className={[
        "dropdown-panel",
        getPopupContainer ? "select-all-dropdown-portal" : "",
        dropdownPanelClassName || "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={getPopupContainer ? dropdownStyle : undefined}
      onKeyDown={handlePanelKeyDown}
    >
      {showSearch && (
        <div className="search-box">
          <Input
            prefix={<Sousuo className="search-icon" />}
            placeholder={resolvedSearchPlaceholder}
            value={searchText}
            allowClear
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      )}
      <div className="options-list">
        {showSelectAll && (
          <>
            <div
              className="option-item select-all-item"
              onClick={(event) => {
                if (
                  enabledFilteredOptions.length === 0 ||
                  (event.target as HTMLElement).closest(".ant-checkbox-wrapper")
                ) return;
                handleSelectAll(!isAllSelected);
              }}
            >
              <Checkbox
                checked={isAllSelected}
                indeterminate={isIndeterminate}
                disabled={enabledFilteredOptions.length === 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                <span className="select-all-dropdown__option-content">
                  <span className="option-label">{resolvedSelectAllLabel}</span>
                  {selectAllCount !== undefined && (
                    <span className="select-all-dropdown__option-count">
                      {selectAllCount.toLocaleString("en-US")}
                    </span>
                  )}
                </span>
              </Checkbox>
            </div>

            <div className="divider" />
          </>
        )}

        <SimpleBar
          autoHide
          className="select-all-dropdown__options-scroll"
        >
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              className={`option-item${option.disabled ? " option-item-disabled" : ""}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest(".ant-checkbox-wrapper")) return;
                handleOptionChange(option, !value.includes(option.value));
              }}
            >
              <Checkbox
                checked={value.includes(option.value)}
                disabled={option.disabled}
                onChange={(e) =>
                  handleOptionChange(option, e.target.checked)
                }
              >
                <span className="select-all-dropdown__option-content">
                  <span className="option-label">
                    {getOptionLabel(option.label)}
                  </span>
                  {typeof option.establishmentCount === "number" ? (
                    <span className="select-all-dropdown__option-count">
                      {option.establishmentCount.toLocaleString("en-US")}
                    </span>
                  ) : null}
                </span>
              </Checkbox>
            </div>
          ))}

          {filteredOptions.length === 0 && (
            <div className="no-results">{resolvedNoResultsText}</div>
          )}
        </SimpleBar>
      </div>
    </div>
  );

  const popupContainer = isOpen ? getPopupContainer?.() : undefined;

  return (
    <div
      className={[
        "select-all-dropdown",
        selectionDisplay === "text" ? "selection-display-text" : "",
        responsive ? "select-all-dropdown--responsive" : "",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={dropdownRef}
    >
      {label && (
        <div className="dropdown-label">
          {label}
          {required && <span className="required-mark"> *</span>}
        </div>
      )}
      <div
        ref={selectorRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label || resolvedPlaceholder}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        className={`dropdown-selector ${isOpen ? "open" : ""} ${
          disabled ? "disabled" : ""
        }`}
        onClick={handleToggle}
        onKeyDown={handleSelectorKeyDown}
      >
        <div ref={contentRef} className="selected-content">
          {renderSelectedContent()}
          {responsive && (
            <div ref={measureRef} className="select-all-dropdown__measure" aria-hidden="true">
              {selectedOptions.map((option) => (
                <span key={option.value} data-tag-measure className="selected-tag">
                  <span className="selected-tag-label">{getOptionDisplayLabel(option)}</span>
                  {tagRemovable && !disabled && !option.disabled && <CloseOutlined className="tag-close" />}
                </span>
              ))}
              {selectedOptions.map((option, index) => (
                <span key={option.value} data-rest-measure className="selected-tag more-tag">
                  {compactMoreTag ? `+${index + 1}` : t("common.moreSelected", { count: index + 1 })}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="dropdown-actions">
          {clearable && selectedOptions.length > 0 && !disabled ? (
            <CloseCircleFilled
              className="clear-icon"
              onClick={handleClearAll}
            />
          ) : (
            <DownOutlined className={`arrow-icon ${isOpen ? "open" : ""}`} />
          )}
        </div>
      </div>

      {isOpen &&
        (popupContainer
          ? createPortal(renderDropdownPanel(), popupContainer)
          : renderDropdownPanel())}
    </div>
  );
};

export default SelectAllDropdown;
