import React, { useEffect, useMemo, useRef, useState } from "react";
import { CloseCircleFilled } from "@ant-design/icons";
import { DatePicker, Form, Modal, Select } from "antd";
import moment from "moment";
import type { Moment } from "moment";
import { useTranslation } from "react-i18next";
import CustomButton from "@/components/common/CustomButton";
import filterModalCalendarIcon from "../assets/icons/filter_modal_calendar.svg";
import type { AppealFilterModalMode } from "../roleConfig";
import type { AppealFilterOptions, AppealHandler, AppealListFilters } from "../types";
import { getAppealDepartmentTranslationKey } from "../utils";
import { AppealExpandArrowIcon, AppealSearchIcon } from "./AppealIcons";

interface AppealFilterModalProps {
  visible: boolean;
  mode: AppealFilterModalMode;
  filters: AppealListFilters;
  options: AppealFilterOptions;
  reasonOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: number; label: string }>;
  showReasonSelect: boolean;
  showStatusSelect: boolean;
  onCancel: () => void;
  onApply: (filters: AppealListFilters) => void;
}

interface FilterFormValues {
  appealReason?: string;
  statusId?: number;
  handlerId?: string;
  lastUpdated?: [Moment, Moment];
}

function getHandlerLabel(handler?: AppealHandler) {
  if (!handler) return "";
  return handler.department ? `${handler.name} / ${handler.department}` : handler.name;
}

function formatAppealDateRangeStart(date?: Moment | null) {
  return date?.format("YYYY-MM-DDT00:00:00[Z]");
}

function formatAppealDateRangeEnd(date?: Moment | null) {
  return date?.format("YYYY-MM-DDT23:59:59[Z]");
}

function parseAppealFilterDate(value?: string) {
  if (!value) return undefined;
  const parsed = moment(value);
  return parsed.isValid() ? parsed : undefined;
}

function parseAppealFilterDateRange(startDate?: string, endDate?: string) {
  const start = parseAppealFilterDate(startDate);
  const end = parseAppealFilterDate(endDate);
  return start && end ? [start, end] as [Moment, Moment] : undefined;
}

const AppealFilterModal: React.FC<AppealFilterModalProps> = ({
  visible,
  mode,
  filters,
  options,
  reasonOptions,
  statusOptions,
  showReasonSelect,
  showStatusSelect,
  onCancel,
  onApply,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [form] = Form.useForm<FilterFormValues>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [handlerSearch, setHandlerSearch] = useState("");
  const [handlerDropdownOpen, setHandlerDropdownOpen] = useState(false);
  const [selectedHandlerId, setSelectedHandlerId] = useState<string | undefined>();
  const showHandler = mode === "handler_and_date";

  useEffect(() => {
    if (!visible) return;

    setSelectedHandlerId(filters.handlerId);
    setHandlerSearch("");
    setHandlerDropdownOpen(false);
    form.setFieldsValue({
      appealReason: filters.appealReason,
      statusId:
        typeof filters.statusId === "number" ? filters.statusId : undefined,
      handlerId: filters.handlerId,
      lastUpdated: parseAppealFilterDateRange(filters.startDate, filters.endDate),
    });
  }, [
    filters.appealReason,
    filters.endDate,
    filters.handlerId,
    filters.startDate,
    filters.statusId,
    form,
    visible,
  ]);

  useEffect(() => {
    if (!handlerDropdownOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setHandlerDropdownOpen(false);
        setHandlerSearch("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [handlerDropdownOpen]);

  const selectedHandler = useMemo(
    () => options.handlers.find((handler) => handler.id === selectedHandlerId),
    [options.handlers, selectedHandlerId],
  );

  const handlerGroups = useMemo(() => {
    const keyword = handlerSearch.trim().toLowerCase();
    const groups = new Map<string, AppealHandler[]>();

    options.handlers.forEach((handler) => {
      const label = getHandlerLabel(handler).toLowerCase();
      if (keyword && !label.includes(keyword)) return;
      const groupName = handler.department || "Handlers";
      groups.set(groupName, [...(groups.get(groupName) ?? []), handler]);
    });

    return [...groups.entries()].map(([groupName, handlers]) => ({
      groupName,
      handlers,
    }));
  }, [handlerSearch, options.handlers]);

  const translateDepartment = (department: string) => {
    const key = getAppealDepartmentTranslationKey(department);
    return key ? t(key, { defaultValue: department }) : department;
  };

  const getTranslatedHandlerLabel = (handler?: AppealHandler) => {
    if (!handler) return "";
    return handler.department
      ? `${handler.name} / ${translateDepartment(handler.department)}`
      : handler.name;
  };

  const handleApply = () => {
    const values = form.getFieldsValue();
    onApply({
      ...filters,
      appealReason: showReasonSelect
        ? values.appealReason
        : filters.appealReason,
      statusId: showStatusSelect ? values.statusId : filters.statusId,
      handlerId: showHandler ? selectedHandlerId : undefined,
      startDate: formatAppealDateRangeStart(values.lastUpdated?.[0]),
      endDate: formatAppealDateRangeEnd(values.lastUpdated?.[1]),
    });
  };

  return (
    <Modal
      visible={visible}
      title={t("Customer.customerAppeals.filterModal.title")}
      onCancel={onCancel}
      footer={
        <div className="appeal-modal-footer">
          <CustomButton
            variant="outline"
            customClassName="appeal-filter-modal__footer-button"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </CustomButton>
          <CustomButton
            type="default"
            variant="primary"
            customClassName="appeal-filter-modal__footer-button"
            onClick={handleApply}
          >
            {t("common.apply")}
          </CustomButton>
        </div>
      }
      width={960}
      centered
      destroyOnClose
      className={`appeal-filter-modal${isArabic ? " appeal-filter-modal--rtl" : ""}`}
    >
      <Form form={form} layout="vertical" className="appeal-filter-form">
        <div className="appeal-filter-grid">
          {showReasonSelect ? (
            <Form.Item
              name="appealReason"
              label={t("Customer.customerAppeals.table.appealReason")}
              className="appeal-filter-form__item appeal-filter-form__item--responsive"
            >
              <Select<string>
                allowClear
                placeholder={t("Customer.customerAppeals.toolbar.allReasons")}
                options={reasonOptions}
              />
            </Form.Item>
          ) : null}
          {showStatusSelect ? (
            <Form.Item
              name="statusId"
              label={t("Customer.customerAppeals.table.status")}
              className="appeal-filter-form__item appeal-filter-form__item--responsive"
            >
              <Select<number>
                allowClear
                placeholder={t("Customer.customerAppeals.toolbar.allStatuses")}
                options={statusOptions}
              />
            </Form.Item>
          ) : null}
          {showHandler ? (
            <Form.Item
              label={t("Customer.customerAppeals.filterModal.currentHandler")}
              className="appeal-filter-form__item"
            >
              <Form.Item name="handlerId" hidden>
                <input type="hidden" />
              </Form.Item>
              <div
                ref={dropdownRef}
                className={`appeal-handler-field ${
                  handlerDropdownOpen ? "is-open" : ""
                }`}
              >
                <button
                  type="button"
                  className="appeal-handler-trigger"
                  onClick={() => {
                    setHandlerDropdownOpen((current) => {
                      const nextOpen = !current;
                      if (!nextOpen) {
                        setHandlerSearch("");
                      }
                      return nextOpen;
                    });
                  }}
                >
                  <span
                    className={`appeal-handler-trigger-text ${
                      selectedHandler ? "is-selected" : ""
                    }`}
                  >
                    {selectedHandler
                      ? getTranslatedHandlerLabel(selectedHandler)
                      : t("Customer.customerAppeals.filterModal.allHandlers")}
                  </span>
                  <span className="appeal-handler-trigger-actions">
                    {selectedHandler ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="appeal-handler-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedHandlerId(undefined);
                          setHandlerSearch("");
                          setHandlerDropdownOpen(false);
                          form.setFieldsValue({ handlerId: undefined });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedHandlerId(undefined);
                          setHandlerSearch("");
                          setHandlerDropdownOpen(false);
                          form.setFieldsValue({ handlerId: undefined });
                        }}
                      >
                        <CloseCircleFilled />
                      </span>
                    ) : (
                      <AppealExpandArrowIcon open={handlerDropdownOpen} />
                    )}
                  </span>
                </button>
                {handlerDropdownOpen ? (
                  <div className="appeal-handler-dropdown-panel">
                    <div className="appeal-handler-dropdown-search">
                      <AppealSearchIcon />
                      <input
                        type="text"
                        autoFocus
                        className="appeal-handler-dropdown-search-input"
                        value={handlerSearch}
                        onChange={(event) => setHandlerSearch(event.target.value)}
                        placeholder={t("Customer.customerAppeals.filterModal.search")}
                      />
                    </div>
                    <div className="appeal-handler-dropdown-scroll">
                      {handlerGroups.length ? (
                        handlerGroups.map((group) => (
                          <div
                            key={group.groupName}
                            className="appeal-handler-dropdown-group"
                          >
                            <div className="appeal-handler-dropdown-group-label">
                              {translateDepartment(group.groupName)}
                            </div>
                            {group.handlers.map((handler) => (
                              <button
                                type="button"
                                key={handler.id}
                                className={`appeal-handler-dropdown-option ${
                                  handler.id === selectedHandlerId
                                    ? "is-selected"
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedHandlerId(handler.id);
                                  form.setFieldsValue({ handlerId: handler.id });
                                  setHandlerDropdownOpen(false);
                                  setHandlerSearch("");
                                }}
                              >
                                {handler.name}
                              </button>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="appeal-filter-empty">
                          {t("Customer.customerAppeals.filterModal.noData")}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </Form.Item>
          ) : null}
          <Form.Item
            name="lastUpdated"
            label={t("Customer.customerAppeals.filterModal.lastUpdated")}
            className="appeal-filter-form__item"
          >
            <DatePicker.RangePicker
              allowClear
              format="DD/MM/YYYY"
              placeholder={[
                t("Customer.customerAppeals.filterModal.startDate"),
                t("Customer.customerAppeals.filterModal.endDate"),
              ]}
              separator={<span className="appeal-filter-range-separator">-</span>}
              onChange={(value) => {
                form.setFieldsValue({ lastUpdated: value ?? undefined });
              }}
              suffixIcon={
                <img
                  src={filterModalCalendarIcon}
                  alt=""
                  className="appeal-filter-calendar-icon"
                />
              }
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default AppealFilterModal;
