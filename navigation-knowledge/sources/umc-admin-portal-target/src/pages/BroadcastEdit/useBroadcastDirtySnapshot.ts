import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { FormInstance } from "antd/lib/form";
import type { BroadcastChannelValues, ChannelsContentRef } from "./ChannelsContent";

interface BroadcastSnapshotFormValues {
  portal?: unknown;
  userTypes?: unknown;
  publishType?: unknown;
  expiryTime?: unknown;
  displayPeriod?: unknown;
}

const normalizeComparable = (value: unknown): unknown => {
  if (value && typeof value === "object" && "isValid" in value && "format" in value) {
    const dateValue = value as { isValid: () => boolean; format: (format: string) => string };
    return dateValue.isValid() ? dateValue.format("YYYY-MM-DD HH:mm") : null;
  }

  if (Array.isArray(value)) return value.map(normalizeComparable);

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeComparable((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value === undefined ? null : value;
};

export const createBroadcastSnapshot = (
  formValues: BroadcastSnapshotFormValues,
  channelValues: BroadcastChannelValues,
) =>
  JSON.stringify(normalizeComparable({
    form: {
      portal: formValues.portal ?? null,
      userTypes: Array.isArray(formValues.userTypes) ? formValues.userTypes : [],
      publishType: formValues.publishType ?? null,
      expiryTime: formValues.expiryTime ?? null,
      displayPeriod: formValues.displayPeriod ?? null,
    },
    channels: channelValues,
  }));

export const useBroadcastDirtySnapshot = ({
  form,
  channels,
  channelsRef,
}: {
  form: FormInstance;
  channels: BroadcastChannelValues;
  channelsRef: RefObject<ChannelsContentRef>;
}) => {
  const initialSnapshotRef = useRef<string | null>(null);

  const getCurrentSnapshot = useCallback(
    () =>
      createBroadcastSnapshot(
        form.getFieldsValue(true),
        channelsRef.current?.getValue() || channels,
      ),
    [channels, channelsRef, form],
  );

  const resetInitialSnapshot = useCallback(
    (
      formValues: BroadcastSnapshotFormValues,
      channelValues: BroadcastChannelValues,
    ) => {
      initialSnapshotRef.current = createBroadcastSnapshot(formValues, channelValues);
    },
    [],
  );

  const setCurrentSnapshotAsInitial = useCallback(() => {
    initialSnapshotRef.current = getCurrentSnapshot();
  }, [getCurrentSnapshot]);

  const isDirty = useCallback(
    () =>
      Boolean(
        initialSnapshotRef.current &&
          getCurrentSnapshot() !== initialSnapshotRef.current,
      ),
    [getCurrentSnapshot],
  );

  return useMemo(
    () => ({
      isDirty,
      resetInitialSnapshot,
      setCurrentSnapshotAsInitial,
    }),
    [isDirty, resetInitialSnapshot, setCurrentSnapshotAsInitial],
  );
};
