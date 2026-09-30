import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import {
  createClosedDuplicateTaskWarningState,
} from "../helpers";
import type { InspectionTaskDuplicateWarningState } from "../type";

interface UseInspectionTaskModalStateParams {
  syncedVisible: { value: boolean };
}

const useInspectionTaskModalState = ({
  syncedVisible,
}: UseInspectionTaskModalStateParams) => {
  const { t } = useTranslation();
  const [duplicateTaskWarning, setDuplicateTaskWarning] =
    useState<InspectionTaskDuplicateWarningState>(() =>
      createClosedDuplicateTaskWarningState(),
    );
  const duplicateTaskWarningLoading = duplicateTaskWarning.loading;
  const duplicateTaskWarningConfirm = duplicateTaskWarning.onConfirm;

  const closeModal = useCallback(() => {
    setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
    syncedVisible.value = false;
  }, [syncedVisible]);

  const closeDuplicateTaskWarning = useCallback(() => {
    if (duplicateTaskWarningLoading) return;
    setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
  }, [duplicateTaskWarningLoading]);

  const confirmDuplicateTaskWarning = useCallback(async () => {
    if (duplicateTaskWarningLoading || !duplicateTaskWarningConfirm) return;

    setDuplicateTaskWarning((prev) => ({ ...prev, loading: true }));
    try {
      await duplicateTaskWarningConfirm();
      setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
    } catch (error) {
      CustomMessage.error(t("inspection.tasks.messages.saveFailed"));
      console.error("Confirm duplicate inspection task failed", error);
      setDuplicateTaskWarning((prev) => ({ ...prev, loading: false }));
    }
  }, [duplicateTaskWarningConfirm, duplicateTaskWarningLoading, t]);

  return {
    duplicateTaskWarning,
    setDuplicateTaskWarning,
    closeModal,
    closeDuplicateTaskWarning,
    confirmDuplicateTaskWarning,
  };
};

export default useInspectionTaskModalState;
