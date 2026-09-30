import {
  useRef,
  type ChangeEvent,
  type FC,
  useLayoutEffect,
  useReducer,
  useState,
  useEffect,
} from "react";
import type { IFilterStore, IFilterTableProps, ISubscribeEntity, FilterItem } from "./type";
import React from "react";
import "./index.less";
import type { TableRowSelection } from "antd/lib/table/interface";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import isEqual from "lodash/isEqual";
import { TablePanel, CustomButton } from "@/components/common";
import ResponsiveFilterModal from "@/components/common/ResponsiveFilterModal";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge from "@/components/common/FilterCountBadge";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { appliedFilterSignature, readerFilterScope } from "./readerScope";
import {
  COMPACT_TOOLBAR_MEDIA_QUERY,
  getResponsiveFilterTableLayout,
  NARROW_TOOLBAR_MEDIA_QUERY,
  RESPONSIVE_NARROW_FILTER_COUNT,
  splitResponsiveFilterItems,
} from "./responsiveLayout";


class FormStore {
  store: Record<string, any> = {};
  registerEntities: Array<ISubscribeEntity> = [];
  constructor() {
    this.store = {};
    this.registerEntities = [];
  }

  getFieldValue = (key: string) => {
    return this.store[key];
  };

  getFieldsValue = () => {
    return this.store;
  };

  setFieldValue = (key: string, value: any) => {
    this.store[key] = value;
    // update subscribe entity
    this.registerEntities.forEach((item) => {
      if (item.name === key) {
        item.onStoreChange();
      }
    });
    return true;
  };

  setFieldsValue = (entity: Record<string, any>) => {
    this.store = { ...this.store, ...entity };
    // update subscribe entity
    this.registerEntities.forEach((item) => {
      if (item.name === entity.name) {
        item.onStoreChange();
      }
    });
    return true;
  };

  resetFields = () => {
    Object.keys(this.store).forEach((key) => {
      this.store[key] = undefined;
    });

    // update registerQueue and set its value to empty at same time
    this.registerEntities.forEach((item, index) => {
      if (index === this.registerEntities.length - 1) {
        // flush once
        item.freshItself();
      }
    });
    return true;
  };

  // subscribe entity
  register = (entity: ISubscribeEntity) => {
    this.registerEntities.push(entity);
    return () => {
      this.registerEntities = this.registerEntities.filter(
        (item) => item.name !== entity.name,
      );
    };
  };

  getFilters = () => {
    return {
      register: this.register,
      getFieldValue: this.getFieldValue,
      getFieldsValue: this.getFieldsValue,
      setFieldValue: this.setFieldValue,
      setFieldsValue: this.setFieldsValue,
      resetFields: this.resetFields,
    };
  };
}

export const useFilter = () => {
  const filterStore = useRef<IFilterStore>();
  if (!filterStore.current) {
    const formStore = new FormStore();
    filterStore.current = formStore.getFilters();
  }
  return [filterStore.current];
};

const DEFAULT_MAX_VISIBLE_FILTERS = 3;
let nextReaderScopeId = 0;

export const FilterTable: FC<IFilterTableProps<Record<string, any>>> = (
  props,
) => {
  const {
    tableFilters,
    loading,
    request,
    extraBtn,
    rowSelection,
    renderSelectionTip = null,
    filterStore = new FormStore(),
    containerCls = "",
    autoRequestOnFilterChange = true,
    toolbarExtraContent,
    onOpenFilterModal,
    maxVisibleFilters,
    responsiveToolbar = false,
    ...tableProps
  } = props;
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const savedValuesRef = useRef<Record<string, any>>({});
  const isInitialMountRef = useRef(true);
  const requestRef = useRef(request);
  const autoRequestRef = useRef<() => Promise<void>>();
  const debouncedRequestMapRef = useRef<
    Record<string, { wait: number; handler: DebouncedFunc<() => void> }>
  >({});
  const { t } = useTranslation();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const modalTempValuesRef = useRef<Record<string, any>>({});
  const modalChangeArgsRef = useRef<Record<string, unknown>>({});
  const isBatchUpdatingRef = useRef(false);
  const [readerScopeId] = useState(() => `table-${++nextReaderScopeId}`);
  const appliedReaderScopeRef = useRef({ signature: "", revision: 0 });
  const [appliedReaderScope, setAppliedReaderScope] = useState("");
  const isCompactToolbar = useMediaQuery(COMPACT_TOOLBAR_MEDIA_QUERY);
  const isNarrowFilters = useMediaQuery(NARROW_TOOLBAR_MEDIA_QUERY);
  const responsiveLayout = getResponsiveFilterTableLayout(
    isNarrowFilters ? 0 : isCompactToolbar ? 1440 : 1920,
  );
  const shouldShowAllFilterLabels = isNarrowFilters;
  const configuredMaxVisibleFilters =
    maxVisibleFilters ??
    (responsiveToolbar
      ? responsiveLayout.inlineFilterCount
      : isNarrowFilters
        ? RESPONSIVE_NARROW_FILTER_COUNT
        : DEFAULT_MAX_VISIBLE_FILTERS);
  const effectiveMaxVisibleFilters =
    tableFilters.length <= 2
      ? tableFilters.length
      : configuredMaxVisibleFilters;


  // Keep request ref up to date
  requestRef.current = request;
  
  // Keep autoRequest ref up to date
  autoRequestRef.current = async () => {
    publishAppliedReaderScope();
    await requestRef.current();
  };

  const splitDiffentTypeOfElement = (name: string) => {
    const normalizedName = name.replace(/^\.\$/, "");
    const separatorIndex = normalizedName.indexOf("-");
    if (separatorIndex < 0) {
      return { type: "", key: normalizedName };
    }

    const type = normalizedName.slice(0, separatorIndex);
    const key = normalizedName.slice(separatorIndex + 1);
    return { type, key };
  };

  const isFilterItemObject = (
    item: FilterItem
  ): item is {
    element: React.ReactElement;
    label?: string;
    requestDebounceMs?: number;
  } => {
    return typeof item === "object" && "element" in item;
  };

  const getFilterElement = (item: FilterItem): React.ReactElement => {
    return isFilterItemObject(item) ? item.element : item;
  };

  const publishAppliedReaderScope = () => {
    const values = filterStore.getFieldsValue();
    const signature = appliedFilterSignature(values);
    const previous = appliedReaderScopeRef.current;
    if (signature === previous.signature) return;
    const revision = previous.revision + 1;
    appliedReaderScopeRef.current = { signature, revision };
    setAppliedReaderScope(readerFilterScope(readerScopeId, revision, values,
      tableFilters.map((item) => splitDiffentTypeOfElement(String(getFilterElement(item).key)))));
  };

  // Parent-driven pagination/filter requests also enter the loading state.
  // Do not publish store edits merely because draft controls re-render.
  useEffect(() => {
    if (loading) publishAppliedReaderScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const getFilterLabel = (item: FilterItem): string | undefined => {
    return isFilterItemObject(item) ? item.label : undefined;
  };

  const getResponsiveFilterLabel = (
    item: FilterItem,
  ): string | undefined => {
    const configuredLabel = getFilterLabel(item);
    if (configuredLabel || !shouldShowAllFilterLabels) {
      return configuredLabel;
    }

    const placeholder = getFilterElement(item).props?.placeholder;
    if (typeof placeholder === "string") {
      return placeholder;
    }
    if (
      Array.isArray(placeholder) &&
      placeholder.every((value) => typeof value === "string")
    ) {
      return placeholder.join(" - ");
    }
    return undefined;
  };

  const getFilterRequestDebounceMs = (item: FilterItem): number | undefined => {
    return isFilterItemObject(item) ? item.requestDebounceMs : undefined;
  };

  const getResponsiveFilterClassName = (element: React.ReactElement) => {
    if (!responsiveToolbar) {
      return element.props.className;
    }

    const { type } = splitDiffentTypeOfElement(String(element.key));
    const modifierByType: Record<string, string> = {
      input: "filter-table__filter-field--search",
      range: "filter-table__filter-field--range",
      select: "filter-table__filter-field--select",
    };
    const modifier = modifierByType[type];

    return [element.props.className, "filter-table__filter-field", modifier]
      .filter(Boolean)
      .join(" ");
  };

  const cancelAllDebouncedRequests = () => {
    Object.values(debouncedRequestMapRef.current).forEach(({ handler }) => {
      handler.cancel();
    });
  };

  const getModalFilterValue = (key: string) => {
    if (Object.prototype.hasOwnProperty.call(modalTempValuesRef.current, key)) {
      return modalTempValuesRef.current[key];
    }
    return filterStore.getFieldValue(key);
  };

  const getDebouncedRequest = (key: string, wait: number) => {
    const currentDebouncedRequest = debouncedRequestMapRef.current[key];
    if (currentDebouncedRequest && currentDebouncedRequest.wait === wait) {
      return currentDebouncedRequest.handler;
    }

    currentDebouncedRequest?.handler.cancel();
    const nextHandler = debounce(() => {
      void autoRequestRef.current?.();
    }, wait);
    debouncedRequestMapRef.current[key] = {
      wait,
      handler: nextHandler,
    };
    return nextHandler;
  };

  const getStoredFilterValue = (type: string, value: unknown) => {
    if (type === "input") {
      return (value as ChangeEvent<HTMLInputElement>)?.target?.value ?? "";
    }

    return value;
  };

  const getControlled = (name: string, isModal = false) => {
    const { type, key } = splitDiffentTypeOfElement(name);
    const currentElement = tableFilters
      .map(getFilterElement)
      .find((item) => item.key === name);
    const originalOnChange = currentElement?.props?.onChange;

    // Modal fields stay in draft state until the user confirms the filter.
    if (isModal) {
      return {
        value: getModalFilterValue(key),
        onChange: (value: unknown) => {
          const changeEvent = value as ChangeEvent<HTMLInputElement>;
          changeEvent?.persist?.();
          modalTempValuesRef.current[key] = getStoredFilterValue(type, value);
          modalChangeArgsRef.current[key] = value;
          forceUpdate();
        },
      };
    }

    return {
      value: filterStore.getFieldValue(key),
      // support different element type
      onChange: (value: unknown) => {
        originalOnChange?.(value);
        filterStore.setFieldValue(key, getStoredFilterValue(type, value));
      },
    };
  };

  const { inlineItems, modalItems } = splitResponsiveFilterItems(
    tableFilters,
    effectiveMaxVisibleFilters,
  );

  // Inline and modal filters always come from the page-owned tableFilters list.
  const wrapChildren = () => {
    return inlineItems.map((item, index) => {
      const element = getFilterElement(item);
      const clonedElement = React.cloneElement(element, {
        ...getControlled(element.key as string),
        className: getResponsiveFilterClassName(element),
      });
      if (!shouldShowAllFilterLabels) {
        return clonedElement;
      }

      const label = getResponsiveFilterLabel(item);
      return (
        <div
          key={element.key || index}
          className={[
            "filter-table-responsive-item",
            "filter-table__filter-field-wrapper",
            splitDiffentTypeOfElement(String(element.key)).type === "input"
              ? "filter-table__filter-field-wrapper--search"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {label && (
            <div className="filter-table-responsive-item-label">{label}</div>
          )}
          {clonedElement}
        </div>
      );
    });
  };

  const getModalFilterItems = (includeDraftItems = false) => {
    const modalItemMap = new Map<string, FilterItem>();
    const addItem = (item: FilterItem) => {
      const element = getFilterElement(item);
      modalItemMap.set(String(element.key), item);
    };

    modalItems.forEach(addItem);

    if (includeDraftItems) {
      Object.keys(modalTempValuesRef.current).forEach((draftKey) => {
        const matchingItem = tableFilters.find((item) => {
          const element = getFilterElement(item);
          return splitDiffentTypeOfElement(String(element.key)).key === draftKey;
        });
        if (matchingItem) {
          addItem(matchingItem);
        }
      });
    }

    return Array.from(modalItemMap.values());
  };

  // Modal fields are always the current page's hidden filters.
  const getModalFields = () => {
    return getModalFilterItems().map((item, index) => {
      const element = getFilterElement(item);
      const label = getResponsiveFilterLabel(item);
      const clonedElement = React.cloneElement(element, {
        ...getControlled(element.key as string, true),
      });

      return {
        key: String(element.key || index),
        label,
        element: clonedElement,
      };
    });
  };

  const handleOpenModal = () => {
    void onOpenFilterModal?.();
    modalTempValuesRef.current = {};
    modalChangeArgsRef.current = {};
    getModalFilterItems().forEach((item) => {
      const element = getFilterElement(item);
      const { key } = splitDiffentTypeOfElement(element.key as string);
      modalTempValuesRef.current[key] = filterStore.getFieldValue(key);
    });
    setFilterModalVisible(true);
  };

  const isMeaningfulFilterValue = (value: unknown): boolean => {
    if (value === undefined || value === null || value === "") {
      return false;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return false;
      }
      if (value.every((v) => v == null || v === "")) {
        return false;
      }
    }
    return true;
  };

  const checkAnyModalFilterHasValue = () => {
    return getModalFilterItems(true).some((item) => {
      const element = getFilterElement(item);
      const { key } = splitDiffentTypeOfElement(element.key as string);
      return isMeaningfulFilterValue(getModalFilterValue(key));
    });
  };

  const checkAnyAppliedModalFilterHasValue = () => {
    return getModalFilterItems(true).some((item) => {
      const element = getFilterElement(item);
      const { key } = splitDiffentTypeOfElement(element.key as string);
      return isMeaningfulFilterValue(filterStore.getFieldValue(key));
    });
  };

  /**
   * Only the filters folded into the modal are counted. The inline ones are
   * already on screen, so the badge exists to surface what the button hides.
   */
  const appliedModalFilterCount = getModalFilterItems(true).filter((item) => {
    const element = getFilterElement(item);
    const { key } = splitDiffentTypeOfElement(element.key as string);
    return isMeaningfulFilterValue(filterStore.getFieldValue(key));
  }).length;

  const handleModalConfirm = () => {
    const changedFields: Array<{
      value: unknown;
      originalOnChange?: (value: unknown) => void;
    }> = [];

    // Apply all changes as one store transaction, then request once.
    isBatchUpdatingRef.current = true;

    getModalFilterItems(true).forEach((item) => {
      const element = getFilterElement(item);
      const { key } = splitDiffentTypeOfElement(String(element.key));
      const nextValue = getModalFilterValue(key);
      const currentValue = filterStore.getFieldValue(key);

      if (isEqual(nextValue, currentValue)) {
        return;
      }

      filterStore.setFieldValue(key, nextValue);
      changedFields.push({
        value: modalChangeArgsRef.current[key] ?? nextValue,
        originalOnChange: element.props?.onChange,
      });
    });

    isBatchUpdatingRef.current = false;

    changedFields.forEach(({ value, originalOnChange }) => {
      originalOnChange?.(value);
    });

    if (autoRequestOnFilterChange && autoRequestRef.current) {
      cancelAllDebouncedRequests();
      void autoRequestRef.current();
    }

    setFilterModalVisible(false);
    modalTempValuesRef.current = {};
    modalChangeArgsRef.current = {};
  };

  const handleModalCancel = () => {
    setFilterModalVisible(false);
    modalTempValuesRef.current = {};
    modalChangeArgsRef.current = {};
  };

  const handleReset = () => {
    filterStore.resetFields();
    if (autoRequestOnFilterChange && autoRequestRef.current) {
      cancelAllDebouncedRequests();
      autoRequestRef.current();
    }
  };

  useEffect(() => {
    return () => {
      cancelAllDebouncedRequests();
    };
  }, []);

  // Filter
  const shouldShowFilterActions =
    tableFilters.length > effectiveMaxVisibleFilters;
  const isModalConfirmEnabled =
    checkAnyModalFilterHasValue() || checkAnyAppliedModalFilterHasValue();

  /* ========================render logic=========================== */

  const renderDefaultSelectionTip = () => {
    return (
      <div className="selection-tip">
        {
          (rowSelection as TableRowSelection<Record<string, any>>)
            ?.selectedRowKeys?.length
        }
      </div>
    );
  };

  const renderInternalSelectionTip = () => {
    // no checked
    if (
      !(rowSelection as TableRowSelection<Record<string, any>>)?.selectedRowKeys
        ?.length
    ) {
      return null;
    }
    return !renderSelectionTip
      ? renderDefaultSelectionTip()
      : renderSelectionTip();
  };

  useLayoutEffect(() => {
    const unRegisterQueue: (() => void)[] = [];
    const fieldsNeedRestore: Record<string, any> = {};
    
    tableFilters.forEach((item) => {
      const element = getFilterElement(item);
      const { key } = splitDiffentTypeOfElement(element.key as string);
      const requestDebounceMs = getFilterRequestDebounceMs(item);
      const currentValue = filterStore.getFieldValue(key);
      const savedValue = savedValuesRef.current[key];
      if (currentValue === undefined && savedValue !== undefined) {
        fieldsNeedRestore[key] = savedValue;
      }
      if (currentValue !== undefined) {
        savedValuesRef.current[key] = currentValue;
      }
      const unRegister = filterStore.register({
        name: key as string,
        onStoreChange: () => {
          if (
            autoRequestOnFilterChange &&
            !isInitialMountRef.current &&
            !isBatchUpdatingRef.current &&
            autoRequestRef.current
          ) {
            if (requestDebounceMs && requestDebounceMs > 0) {
              getDebouncedRequest(key, requestDebounceMs)();
            } else {
              cancelAllDebouncedRequests();
              autoRequestRef.current();
            }
          }
          forceUpdate();
        },
        freshItself: () => {
          forceUpdate();
        },
      });
      // Don't restore saved values when tableFilters changes (e.g., due to options update)
      // Only restore during initial mount is handled by parent component
      // Restoring saved values here would trigger onStoreChange and cause infinite loop
      unRegisterQueue.push(unRegister);
    });

    const restoreEntries = Object.entries(fieldsNeedRestore);
    if (restoreEntries.length) {
      isBatchUpdatingRef.current = true;
      restoreEntries.forEach(([key, value]) => {
        filterStore.setFieldValue(key, value);
      });
      isBatchUpdatingRef.current = false;
      forceUpdate();
    }

    // Mark that initial mount is complete after filters are registered
    if (isInitialMountRef.current) {
      publishAppliedReaderScope();
      isInitialMountRef.current = false;
    }

    return () => {
      tableFilters.forEach((item) => {
        const element = getFilterElement(item);
        const { key } = splitDiffentTypeOfElement(element.key as string);
        const value = filterStore.getFieldValue(key);
        savedValuesRef.current[key] = value;
      });
      unRegisterQueue.forEach((unRegister) => unRegister());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequestOnFilterChange, tableFilters]);

  return (
    <div
      data-reader-filter-name="tableFilters"
      data-reader-filter-value={appliedReaderScope}
      className={[
        "filter-table",
        responsiveToolbar ? "filter-table--responsive-toolbar" : "",
        containerCls,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="filter-table-header filter-table__toolbar">
        <div className="header-filter filter-table__filter-controls">
          {wrapChildren()}
          {toolbarExtraContent}
          {shouldShowFilterActions && (
            <>
              {/* Composed as children rather than via the `icon` slot: that
                  slot is pinned to a fixed 16/20px here, which would crush the
                  funnel and the count together. */}
              <CustomButton
                variant="outline"
                customClassName="filters-filterBtn filter-table__filter-button responsive-filter-toolbar__filter-button filter-trigger-with-count"
                onClick={handleOpenModal}
              >
                {t("common.filter")}
                <img
                  className="filter-table__filter-funnel"
                  src={SortIcon}
                  alt=""
                />
                <FilterCountBadge count={appliedModalFilterCount} />
              </CustomButton>
              <CustomButton
                text={t("common.reset")}
                variant="outline"
                customClassName="filters-filterBtn filter-table__reset-button responsive-filter-toolbar__reset-button"
                onClick={handleReset}
              />
            </>
          )}
        </div>
        <div className="header-extra-btn filter-table__actions">{extraBtn}</div>
      </div>
      <>
        {renderInternalSelectionTip()}
        <TablePanel
          tableProps={{
            ...tableProps,
            rowSelection,
            loading,
            // scroll: { x: 1000 },
          }}
        />
      </>

      <ResponsiveFilterModal
        visible={filterModalVisible}
        onCancel={handleModalCancel}
        onApply={handleModalConfirm}
        applyDisabled={!isModalConfirmEnabled}
        fields={getModalFields()}
      />
    </div>
  );
};
