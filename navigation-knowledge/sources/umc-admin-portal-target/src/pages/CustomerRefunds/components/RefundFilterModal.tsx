import { toApi } from "@/utils/gstTime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CloseCircleFilled, DownOutlined } from "@ant-design/icons";
import { Form, Modal, Select } from "antd";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import DatePicker from "@/components/common/LocalizedDatePicker";
import { SearchIcon } from "./RefundIcons";
import type { RefundFilterModalMode } from "../roleConfig";
import type {
  RefundHandler,
  RefundFilterOptions,
  RefundListFilters,
  RefundTabKey,
} from "../types";

interface RefundFilterModalProps {
  open: boolean;
  tabKey: RefundTabKey;
  mode: RefundFilterModalMode;
  responsiveCompactFields: {
    category?: boolean;
    source?: boolean;
    status?: boolean;
  };
  value: RefundListFilters;
  options: RefundFilterOptions;
  onCancel: () => void;
  onApply: (
    nextValue: Partial<
      Pick<
        RefundListFilters,
        | "category"
        | "handlerId"
        | "source"
        | "status"
        | "startDate"
        | "endDate"
      >
    >,
  ) => void;
}

const RefundFilterModal: React.FC<RefundFilterModalProps> = ({
  open,
  tabKey,
  mode,
  responsiveCompactFields,
  value,
  options,
  onCancel,
  onApply,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [form] = Form.useForm();
  const [handlerSearch, setHandlerSearch] = useState("");
  const [handlerDropdownOpen, setHandlerDropdownOpen] = useState(false);
  const [selectedHandlerId, setSelectedHandlerId] = useState<string | undefined>();
  const handlerFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setHandlerSearch("");
    setHandlerDropdownOpen(false);
    setSelectedHandlerId(value.handlerId);
    form.setFieldsValue({
      category: value.category,
      handlerId: value.handlerId,
      source: value.source,
      status: value.status,
      dateRange:
        value.startDate && value.endDate
          ? [moment(value.startDate), moment(value.endDate)]
          : undefined,
    });
  }, [
    form,
    mode,
    open,
    tabKey,
    value.category,
    value.endDate,
    value.handlerId,
    value.source,
    value.startDate,
    value.status,
  ]);

  useEffect(() => {
    if (!handlerDropdownOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (handlerFieldRef.current?.contains(event.target as Node)) return;
      setHandlerDropdownOpen(false);
      setHandlerSearch("");
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [handlerDropdownOpen]);

  const isDepartmentTodoDateOnly = mode === "department_todo_date_only";
  const isDepartmentDateOnly =
    isDepartmentTodoDateOnly || mode === "department_completed_date_only";
  const groupedHandlers = useMemo(() => {
    const searchText = handlerSearch.trim().toLowerCase();
    const isCustomerOption = (item: RefundHandler) =>
      item.id === "__refund_customer_handler__" && !item.department;
    const matchesSearch = (item: RefundHandler) => {
      if (!searchText) return true;

      return [item.name, item.department].some((value) =>
        value.toLowerCase().includes(searchText),
      );
    };
    const visibleHandlers = options.handlers.filter(matchesSearch);
    const customerOption = visibleHandlers.find(isCustomerOption);
    const groups = new Map<string, RefundHandler[]>();

    visibleHandlers
      .filter((item) => !isCustomerOption(item))
      .forEach((item) => {
        const groupKey = item.department;
        const existing = groups.get(groupKey) ?? [];
        existing.push(item);
        groups.set(groupKey, existing);
      });

    return {
      customerOption,
      groups: Array.from(groups.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, handlers]) => ({
          label,
          handlers: handlers.sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        })),
    };
  }, [handlerSearch, options.handlers]);
  const hasVisibleHandlerOptions =
    Boolean(groupedHandlers.customerOption) || groupedHandlers.groups.length > 0;
  const selectedHandler = useMemo(
    () => options.handlers.find((item) => item.id === selectedHandlerId),
    [options.handlers, selectedHandlerId],
  );
  const selectedHandlerLabel =
    selectedHandler?.name || t("Customer.customerRefunds.filterModal.allHandlers");

  return (
    <Modal
      visible={open}
      title={t("Customer.customerRefunds.filterModal.title")}
      onCancel={onCancel}
      className={`refund-filter-modal${isArabic ? " refund-filter-modal--rtl" : ""}`}
      width={960}
      centered
      footer={
        <div className="refund-modal-footer">
          <CustomButton
            variant="outline"
            text={t("common.cancel")}
            onClick={onCancel}
          />
          <CustomButton
            text={t("common.apply")}
            variant="primary"
            onClick={async () => {
              const values = form.getFieldsValue();
              const range = values.dateRange as undefined | [moment.Moment, moment.Moment];
              const isCompact =
                typeof window !== "undefined" &&
                window.matchMedia("(max-width: 1439.98px)").matches;
              const responsiveCompactValues = isCompact
                ? {
                    ...(responsiveCompactFields.category
                      ? { category: values.category }
                      : {}),
                    ...(responsiveCompactFields.source
                      ? { source: values.source }
                      : {}),
                    ...(responsiveCompactFields.status
                      ? { status: values.status }
                      : {}),
                  }
                : {};
              const completedStatusValue =
                !isDepartmentDateOnly && tabKey === "completed"
                  ? { status: values.status }
                  : {};

              onApply({
                handlerId:
                  tabKey === "todo" && !isDepartmentTodoDateOnly
                    ? values.handlerId
                    : undefined,
                startDate: range?.[0] ? toApi(range[0].startOf("day").toDate()) : undefined,
                endDate: range?.[1] ? toApi(range[1].endOf("day").toDate()) : undefined,
                ...completedStatusValue,
                ...responsiveCompactValues,
              });
            }}
          />
        </div>
      }
    >
      <Form form={form} layout="vertical" className="custorm-form refund-filter-form">
        <div className="refund-filter-grid">
          {responsiveCompactFields.category ? (
              <Form.Item
                className="refund-filter-form-responsive-field"
                label={t("Customer.customerRefunds.table.refundCategory")}
                name="category"
              >
                <Select
                  allowClear
                  placeholder={t("Customer.customerRefunds.toolbar.allCategories")}
                >
                  {options.categories.map((item) => (
                    <Select.Option value={item.value} key={item.value}>
                      {item.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
          ) : null}
          {responsiveCompactFields.status ? (
              <Form.Item
                className="refund-filter-form-responsive-field"
                label={t("Customer.customerRefunds.table.status")}
                name="status"
              >
                <Select
                  allowClear
                  placeholder={t("Customer.customerRefunds.toolbar.allStatuses")}
                >
                  {(tabKey === "todo"
                    ? options.todoStatuses
                    : options.completedStatuses
                  ).map((item) => (
                    <Select.Option value={item.value} key={item.value}>
                      {item.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
          ) : null}
          {responsiveCompactFields.source ? (
            <Form.Item
              className="refund-filter-form-responsive-field"
              label={t("Customer.customerRefunds.table.source")}
              name="source"
            >
              <Select
                allowClear
                placeholder={t("Customer.customerRefunds.toolbar.allSources")}
              >
                {options.completedSources.map((item) => (
                  <Select.Option value={item.value} key={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
          {tabKey === "todo" && !isDepartmentTodoDateOnly ? (
            <Form.Item label={t("Customer.customerRefunds.table.currentHandler")}>
              <Form.Item name="handlerId" hidden>
                <input type="hidden" />
              </Form.Item>
              <div
                className={`refund-handler-field ${handlerDropdownOpen ? "is-open" : ""}`}
                ref={handlerFieldRef}
              >
                <div
                  role="combobox"
                  aria-expanded={handlerDropdownOpen}
                  tabIndex={0}
                  className={`refund-handler-trigger ${selectedHandler ? "has-value" : ""}`}
                  onClick={() => {
                    setHandlerDropdownOpen((prev) => !prev);
                    if (handlerDropdownOpen) {
                      setHandlerSearch("");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setHandlerDropdownOpen((prev) => !prev);
                    if (handlerDropdownOpen) {
                      setHandlerSearch("");
                    }
                  }}
                >
                  <span
                    className={`refund-handler-trigger-text ${selectedHandler ? "is-selected" : ""}`}
                  >
                    {selectedHandlerLabel}
                  </span>
                  <span className="refund-handler-trigger-actions">
                    {selectedHandler ? (
                      <button
                        type="button"
                        className="refund-handler-clear"
                        aria-label={t("Customer.customerRefunds.filterModal.clearCurrentHandler")}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedHandlerId(undefined);
                          setHandlerDropdownOpen(false);
                          setHandlerSearch("");
                          form.setFieldsValue({ handlerId: undefined });
                        }}
                      >
                        <CloseCircleFilled />
                      </button>
                    ) : (
                      <DownOutlined
                        className={`refund-handler-arrow ${
                          handlerDropdownOpen ? "is-open" : ""
                        }`}
                      />
                    )}
                  </span>
                </div>
                {handlerDropdownOpen ? (
                  <div className="refund-handler-dropdown-panel">
                    <div className="refund-handler-dropdown-search">
                      <SearchIcon />
                      <input
                        type="text"
                        autoFocus
                        value={handlerSearch}
                        placeholder={t("Customer.customerRefunds.toolbar.search")}
                        className="refund-handler-dropdown-search-input"
                        onChange={(event) => setHandlerSearch(event.target.value)}
                      />
                    </div>
                    <div className="refund-handler-dropdown-scroll">
                      {groupedHandlers.customerOption ? (
                        <button
                          type="button"
                          className={`refund-handler-dropdown-option ${
                            selectedHandlerId === groupedHandlers.customerOption.id
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedHandlerId(groupedHandlers.customerOption?.id);
                            form.setFieldsValue({
                              handlerId: groupedHandlers.customerOption?.id,
                            });
                            setHandlerDropdownOpen(false);
                            setHandlerSearch("");
                          }}
                        >
                          {groupedHandlers.customerOption.name}
                        </button>
                      ) : null}
                      {groupedHandlers.groups.map((group) => (
                        <div key={group.label} className="refund-handler-dropdown-group">
                          <div className="refund-handler-dropdown-group-label">
                            {group.label}
                          </div>
                          {group.handlers.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              className={`refund-handler-dropdown-option ${
                                selectedHandlerId === item.id ? "is-selected" : ""
                              }`}
                              onClick={() => {
                                setSelectedHandlerId(item.id);
                                form.setFieldsValue({ handlerId: item.id });
                                setHandlerDropdownOpen(false);
                                setHandlerSearch("");
                              }}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      ))}
                      {!hasVisibleHandlerOptions ? (
                        <div className="refund-filter-empty">
                          {t("Customer.customerRefunds.filterModal.noMatchingHandlers")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Form.Item>
          ) : !isDepartmentDateOnly ? (
            <Form.Item label={t("Customer.customerRefunds.table.status")} name="status">
              <Select
                allowClear
                placeholder={t("Customer.customerRefunds.toolbar.allStatuses")}
              >
                {options.completedStatuses.map((item) => (
                  <Select.Option value={item.value} key={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
          <Form.Item label={t("Customer.customerRefunds.table.lastUpdated")} name="dateRange">
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              separator="-"
              allowClear
              placeholder={[
                t("Customer.customerRefunds.filterModal.startDate"),
                t("Customer.customerRefunds.filterModal.endDate"),
              ]}
              getPopupContainer={(node) => node}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default RefundFilterModal;
