import { useMemo } from "react";
import {
  COMPACT_VIEWPORT_MAX_WIDTH,
  useResponsiveViewportBand,
} from "./useResponsiveViewportBand";

export type ResponsiveActionColumnBreakpoint = "desktop" | "compact";

export type ResponsiveActionColumnButtonWidth = {
  default: number;
} & Partial<Record<ResponsiveActionColumnBreakpoint, number>>;

export type ResponsiveActionColumnButtonWidthMap<ActionKey extends string> =
  Partial<Record<ActionKey, ResponsiveActionColumnButtonWidth>>;

export interface ResponsiveActionColumnLayoutConfig {
  gap: number;
  padding: number;
  minWidth: number;
  maxWidth: number;
}

export interface ResponsiveActionColumnTextMeasureConfig {
  font: string;
  narrowFont?: string;
  narrowMaxWidth?: number;
  textPadding?: number;
}

export interface ResponsiveActionColumnWidthOptions<
  Row,
  ActionKey extends string,
> {
  rows: readonly Row[];
  buttonWidthMap: ResponsiveActionColumnButtonWidthMap<ActionKey>;
  getVisibleActions: (row: Row) => readonly ActionKey[];
  getActionLabel?: (actionKey: ActionKey) => string | undefined;
  desktopConfig: ResponsiveActionColumnLayoutConfig;
  compactConfig: ResponsiveActionColumnLayoutConfig;
  textMeasureConfig?: ResponsiveActionColumnTextMeasureConfig;
  compactBreakpoint?: number;
}

const DEFAULT_COMPACT_BREAKPOINT = 1440;
const DEFAULT_TEXT_MEASURE_CONFIG: ResponsiveActionColumnTextMeasureConfig = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  narrowMaxWidth: COMPACT_VIEWPORT_MAX_WIDTH,
  textPadding: 0,
};

let measureCanvas: HTMLCanvasElement | undefined;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getButtonWidth = <ActionKey extends string>(
  buttonWidthMap: ResponsiveActionColumnButtonWidthMap<ActionKey>,
  actionKey: ActionKey,
  breakpoint: ResponsiveActionColumnBreakpoint,
) => {
  const widthConfig = buttonWidthMap[actionKey];

  return widthConfig?.[breakpoint] ?? widthConfig?.default ?? 0;
};

const measureLabelWidth = (
  label: string,
  textMeasureConfig: ResponsiveActionColumnTextMeasureConfig,
) => {
  if (typeof document === "undefined") {
    return 0;
  }

  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }

  const context = measureCanvas.getContext("2d");

  if (!context) {
    return 0;
  }

  context.font = textMeasureConfig.font;

  return (
    context.measureText(label).width + (textMeasureConfig.textPadding ?? 0)
  );
};

const getActionWidth = <ActionKey extends string>(
  buttonWidthMap: ResponsiveActionColumnButtonWidthMap<ActionKey>,
  actionKey: ActionKey,
  breakpoint: ResponsiveActionColumnBreakpoint,
  getActionLabel: ((actionKey: ActionKey) => string | undefined) | undefined,
  textMeasureConfig: ResponsiveActionColumnTextMeasureConfig,
) => {
  const actionLabel = getActionLabel?.(actionKey);
  const measuredWidth = actionLabel
    ? measureLabelWidth(actionLabel, textMeasureConfig)
    : 0;
  const mappedWidth = getButtonWidth(buttonWidthMap, actionKey, breakpoint);

  if (measuredWidth > 0) {
    return Math.max(measuredWidth, mappedWidth);
  }

  return mappedWidth;
};

export const calculateResponsiveActionColumnWidth = <
  Row,
  ActionKey extends string,
>({
  rows,
  buttonWidthMap,
  getVisibleActions,
  getActionLabel,
  breakpoint,
  layoutConfig,
  textMeasureConfig = DEFAULT_TEXT_MEASURE_CONFIG,
}: {
  rows: readonly Row[];
  buttonWidthMap: ResponsiveActionColumnButtonWidthMap<ActionKey>;
  getVisibleActions: (row: Row) => readonly ActionKey[];
  getActionLabel?: (actionKey: ActionKey) => string | undefined;
  breakpoint: ResponsiveActionColumnBreakpoint;
  layoutConfig: ResponsiveActionColumnLayoutConfig;
  textMeasureConfig?: ResponsiveActionColumnTextMeasureConfig;
}) => {
  const widestRowWidth = rows.reduce((widestWidth, row) => {
    const actions = getVisibleActions(row);

    if (actions.length === 0) {
      return widestWidth;
    }

    const buttonsWidth = actions.reduce(
      (total, actionKey) =>
        total +
        getActionWidth(
          buttonWidthMap,
          actionKey,
          breakpoint,
          getActionLabel,
          textMeasureConfig,
        ),
      0,
    );
    const gapsWidth = Math.max(0, actions.length - 1) * layoutConfig.gap;
    const rowWidth = buttonsWidth + gapsWidth + layoutConfig.padding;

    return Math.max(widestWidth, rowWidth);
  }, layoutConfig.minWidth);

  return clamp(
    Math.ceil(widestRowWidth),
    layoutConfig.minWidth,
    layoutConfig.maxWidth,
  );
};

export const useResponsiveActionColumnWidth = <
  Row,
  ActionKey extends string,
>({
  rows,
  buttonWidthMap,
  getVisibleActions,
  getActionLabel,
  desktopConfig,
  compactConfig,
  textMeasureConfig = DEFAULT_TEXT_MEASURE_CONFIG,
  compactBreakpoint = DEFAULT_COMPACT_BREAKPOINT,
}: ResponsiveActionColumnWidthOptions<Row, ActionKey>) => {
  const { width } = useResponsiveViewportBand();
  const breakpoint: ResponsiveActionColumnBreakpoint =
    width < compactBreakpoint ? "compact" : "desktop";
  const layoutConfig =
    breakpoint === "compact" ? compactConfig : desktopConfig;
  return useMemo(
    () => {
      const effectiveTextMeasureConfig =
        textMeasureConfig.narrowFont &&
        width <=
          (textMeasureConfig.narrowMaxWidth ?? COMPACT_VIEWPORT_MAX_WIDTH)
          ? {
              ...textMeasureConfig,
              font: textMeasureConfig.narrowFont,
            }
          : textMeasureConfig;

      return calculateResponsiveActionColumnWidth({
        rows,
        buttonWidthMap,
        getVisibleActions,
        getActionLabel,
        breakpoint,
        layoutConfig,
        textMeasureConfig: effectiveTextMeasureConfig,
      });
    },
    [
      rows,
      buttonWidthMap,
      getVisibleActions,
      getActionLabel,
      breakpoint,
      width,
      layoutConfig,
      textMeasureConfig,
    ],
  );
};
