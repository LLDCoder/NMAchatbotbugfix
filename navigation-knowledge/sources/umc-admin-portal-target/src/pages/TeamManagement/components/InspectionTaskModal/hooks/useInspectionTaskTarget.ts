/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { FormInstance } from "antd";
import type { DebouncedFunc } from "lodash";
import type { InspectionTargetSearchOption } from "@/services/inspection";
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig";
import type { InspectionTaskModalMeta as TaskModalMeta } from "../type";
import {
  getSelectedTargetOptions,
  mergeSelectedTargetOption,
} from "../utils/target";

interface UseInspectionTaskTargetParams {
  form: FormInstance;
  currentTargetType: TargetType;
  taskModalMeta: TaskModalMeta;
  targetSearchOptions: InspectionTargetSearchOption[];
  selectedTargetRef: MutableRefObject<InspectionTargetSearchOption | null>;
  debouncedTargetSearch: DebouncedFunc<
    (targetType: TargetType, searchText: string) => Promise<void>
  >;
  applyTargetPayload: (option: InspectionTargetSearchOption) => void;
  clearTargetFormValues: (
    targetType: TargetType,
    overrides?: Record<string, any>,
  ) => void;
  getTaskSubmitEnabled: (meta: TaskModalMeta) => boolean;
  setTaskModalMeta: Dispatch<SetStateAction<TaskModalMeta>>;
  setTargetSearchOptions: Dispatch<
    SetStateAction<InspectionTargetSearchOption[]>
  >;
  setTargetSearchLoading: Dispatch<SetStateAction<boolean>>;
  setTaskSubmitEnabled: Dispatch<SetStateAction<boolean>>;
}

const useInspectionTaskTarget = ({
  form,
  currentTargetType,
  taskModalMeta,
  targetSearchOptions,
  selectedTargetRef,
  debouncedTargetSearch,
  applyTargetPayload,
  clearTargetFormValues,
  getTaskSubmitEnabled,
  setTaskModalMeta,
  setTargetSearchOptions,
  setTargetSearchLoading,
  setTaskSubmitEnabled,
}: UseInspectionTaskTargetParams) => {
  const handleTargetSearch = useCallback((searchText: string) => {
    const nextSearchText = searchText || "";
    setTaskModalMeta((current) => {
      if (!nextSearchText && current.selectedTarget) {
        return current;
      }
      return { ...current, targetSearch: nextSearchText };
    });
    if (!nextSearchText.trim()) {
      debouncedTargetSearch.cancel();
      setTargetSearchLoading(false);
      setTargetSearchOptions(
        getSelectedTargetOptions(selectedTargetRef.current, currentTargetType),
      );
      return;
    }

    debouncedTargetSearch(currentTargetType, nextSearchText);
  }, [
    currentTargetType,
    debouncedTargetSearch,
    selectedTargetRef,
    setTargetSearchLoading,
    setTargetSearchOptions,
    setTaskModalMeta,
  ]);

  const handleTargetSelect = useCallback((value: string) => {
    const option = targetSearchOptions.find((item) => item.value === value) || null;
    if (option) {
      form.setFieldsValue({ targetSearch: option.value });
      applyTargetPayload(option);
      selectedTargetRef.current = option;
      setTargetSearchOptions((currentOptions) =>
        mergeSelectedTargetOption(currentOptions, option),
      );
    }
    setTaskModalMeta((current) => {
      const nextMeta = {
        ...current,
        manualTarget: false,
        selectedTarget: option,
        autoMatchedTarget: null,
        targetSearch: option?.title || "",
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [
    applyTargetPayload,
    form,
    getTaskSubmitEnabled,
    selectedTargetRef,
    setTargetSearchOptions,
    setTaskModalMeta,
    setTaskSubmitEnabled,
    targetSearchOptions,
  ]);

  const handleTargetFocus = useCallback(() => {
    if (taskModalMeta.targetSearch) {
      debouncedTargetSearch(currentTargetType, taskModalMeta.targetSearch);
    }
  }, [currentTargetType, debouncedTargetSearch, taskModalMeta.targetSearch]);

  const handleTargetClear = useCallback(() => {
    selectedTargetRef.current = null;
    setTargetSearchOptions([]);
    clearTargetFormValues(currentTargetType);
    setTaskModalMeta((current) => {
      const nextMeta = {
        ...current,
        targetSearch: "",
        manualTarget: false,
        selectedTarget: null,
        autoMatchedTarget: null,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [
    clearTargetFormValues,
    currentTargetType,
    getTaskSubmitEnabled,
    selectedTargetRef,
    setTargetSearchOptions,
    setTaskModalMeta,
    setTaskSubmitEnabled,
  ]);

  const handleManualTargetStart = useCallback(() => {
    selectedTargetRef.current = null;
    clearTargetFormValues(
      currentTargetType,
      currentTargetType === "establishment" ? { establishmentSubType: "Commercial" } : {},
    );
    setTargetSearchOptions([]);
    setTaskModalMeta((current) => {
      const nextMeta = {
        ...current,
        targetSearch: "",
        manualTarget: true,
        selectedTarget: null,
        autoMatchedTarget: null,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [
    clearTargetFormValues,
    currentTargetType,
    getTaskSubmitEnabled,
    selectedTargetRef,
    setTargetSearchOptions,
    setTaskModalMeta,
    setTaskSubmitEnabled,
  ]);

  return {
    handleTargetSearch,
    handleTargetSelect,
    handleTargetFocus,
    handleTargetClear,
    handleManualTargetStart,
  };
};

export default useInspectionTaskTarget;
