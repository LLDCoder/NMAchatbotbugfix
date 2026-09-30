import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export interface MaxTagCountForFormilyGridOptions {
  /** maxTagCount when inside `[data-grid-span]` or `.ant-formily-grid-layout` */
  dense?: number;
  /** maxTagCount when outside those containers */
  spacious?: number;
}

const DEFAULT_DENSE = 2;
const DEFAULT_SPACIOUS = 4;
const FORMILY_GRID_SELECTOR = ".ant-formily-grid-layout";

function parseGridTemplateColumnCount(
  gridTemplateColumns: string | undefined,
): number | undefined {
  const value = gridTemplateColumns?.trim();
  if (!value || value === "none") return undefined;

  const repeatMatch = value.match(/^repeat\(\s*(\d+)\s*,/i);
  if (repeatMatch) return Number(repeatMatch[1]);

  let count = 0;
  let depth = 0;
  let inTrack = false;

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(depth - 1, 0);

    if (/\s/.test(char) && depth === 0) {
      inTrack = false;
      continue;
    }

    if (!inTrack) {
      count += 1;
      inTrack = true;
    }
  }

  return count || undefined;
}

function getInlineGridTemplateColumns(grid: Element): string | undefined {
  const styleValue = (grid as HTMLElement).style?.gridTemplateColumns;
  if (styleValue) return styleValue;

  const styleAttribute = grid.getAttribute("style");
  return styleAttribute
    ?.match(/(?:^|;)\s*grid-template-columns\s*:\s*([^;]+)/i)?.[1]
    ?.trim();
}

function getGridColumnCount(grid: Element): number | undefined {
  const computedValue =
    typeof window !== "undefined" && typeof window.getComputedStyle === "function"
      ? window.getComputedStyle(grid).gridTemplateColumns
      : undefined;

  return (
    parseGridTemplateColumnCount(computedValue) ??
    parseGridTemplateColumnCount(getInlineGridTemplateColumns(grid))
  );
}

export function getMaxTagCountForFormilyGridLayout(
  root: Element | null,
  options?: MaxTagCountForFormilyGridOptions,
): number {
  const dense = options?.dense ?? DEFAULT_DENSE;
  const spacious = options?.spacious ?? DEFAULT_SPACIOUS;
  if (!root) return dense;
  const formilyGrid = root.closest(FORMILY_GRID_SELECTOR);
  if (formilyGrid) {
    const columnCount = getGridColumnCount(formilyGrid);
    return columnCount === 1 ? spacious : dense;
  }

  const inGridSpan = root.closest("[data-grid-span]") != null;
  return inGridSpan ? dense : spacious;
}

export function useMaxTagCountForFormilyGrid<E extends HTMLElement>(
  ref: RefObject<E | null>,
  options?: MaxTagCountForFormilyGridOptions,
): number {
  const dense = options?.dense ?? DEFAULT_DENSE;
  const spacious = options?.spacious ?? DEFAULT_SPACIOUS;
  const [maxTagCount, setMaxTagCount] = useState(dense);

  useLayoutEffect(() => {
    const updateMaxTagCount = () => {
      setMaxTagCount(
        getMaxTagCountForFormilyGridLayout(ref.current, { dense, spacious }),
      );
    };

    updateMaxTagCount();

    const observedElement =
      ref.current?.closest(FORMILY_GRID_SELECTOR) ?? ref.current;
    let resizeObserver: ResizeObserver | undefined;

    if (
      observedElement &&
      typeof ResizeObserver !== "undefined"
    ) {
      resizeObserver = new ResizeObserver(updateMaxTagCount);
      resizeObserver.observe(observedElement);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateMaxTagCount);
    }

    return () => {
      resizeObserver?.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateMaxTagCount);
      }
    };
  }, [ref, dense, spacious]);

  return maxTagCount;
}
