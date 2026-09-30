import type { CallbackDataParams } from "echarts/types/dist/shared";

interface TooltipPositionSize {
  contentSize?: [number, number];
  viewSize?: [number, number];
}

export default function createViewportEdgeTooltipPosition(
  getChartElement: () => HTMLElement | null | undefined,
) {
  return (
    point: [number, number],
    _params: CallbackDataParams | CallbackDataParams[],
    _dom: HTMLElement,
    _rect: unknown,
    size: TooltipPositionSize,
  ): [number, number] => {
    const chartRect = getChartElement()?.getBoundingClientRect();
    const [contentWidth = 0, contentHeight = 0] = size.contentSize ?? [];
    const [viewWidth = 0, viewHeight = 0] = size.viewSize ?? [];

    if (!chartRect || !contentWidth || !contentHeight) {
      return point;
    }

    const gap = 20;
    const margin = 8;
    const maxViewportLeft = Math.max(
      margin,
      window.innerWidth - contentWidth - margin,
    );
    const maxViewportTop = Math.max(
      margin,
      window.innerHeight - contentHeight - margin,
    );
    let left =
      point[0] + contentWidth + gap > viewWidth
        ? point[0] - contentWidth - gap
        : point[0] + gap;
    let top =
      point[1] + contentHeight + gap > viewHeight
        ? point[1] - contentHeight - gap
        : point[1] + gap;

    left =
      Math.min(
        Math.max(margin, chartRect.left + left),
        maxViewportLeft,
      ) - chartRect.left;
    top =
      Math.min(
        Math.max(margin, chartRect.top + top),
        maxViewportTop,
      ) - chartRect.top;

    return [left, top];
  };
}
