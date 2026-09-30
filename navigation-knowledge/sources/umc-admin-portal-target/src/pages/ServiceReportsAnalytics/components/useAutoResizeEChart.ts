import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";

type EChartsComponentInstance = InstanceType<typeof ReactECharts>;
type ChartSize = {
  width: number;
  height: number;
};

const CARD_SELECTOR = ".service-reports__card";

export default function useAutoResizeEChart(visible = true) {
  const chartRef = useRef<EChartsComponentInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const firstFrameRef = useRef<number | null>(null);
  const secondFrameRef = useRef<number | null>(null);
  const lastSizeRef = useRef<ChartSize | null>(null);

  useEffect(() => {
    const cancelScheduledResize = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (firstFrameRef.current !== null) {
        window.cancelAnimationFrame(firstFrameRef.current);
        firstFrameRef.current = null;
      }

      if (secondFrameRef.current !== null) {
        window.cancelAnimationFrame(secondFrameRef.current);
        secondFrameRef.current = null;
      }
    };

    const resizeChart = (force = false) => {
      const container = containerRef.current;
      const chartInstance = chartRef.current?.getEchartsInstance();

      if (!container || !chartInstance) {
        return;
      }

      const { width, height } = container.getBoundingClientRect();

      if (width <= 0 || height <= 0) {
        return;
      }

      const nextSize = {
        width: Math.round(width),
        height: Math.round(height),
      };
      const lastSize = lastSizeRef.current;

      if (
        !force &&
        lastSize &&
        lastSize.width === nextSize.width &&
        lastSize.height === nextSize.height
      ) {
        return;
      }

      chartInstance.resize(nextSize);
      lastSizeRef.current = nextSize;
    };

    const scheduleResize = (force = false) => {
      if (typeof window === "undefined" || !visible) {
        return;
      }

      cancelScheduledResize();

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        firstFrameRef.current = window.requestAnimationFrame(() => {
          firstFrameRef.current = null;
          secondFrameRef.current = window.requestAnimationFrame(() => {
            secondFrameRef.current = null;
            resizeChart(force);
          });
        });
      }, 0);
    };

    const container = containerRef.current;
    const card = container?.closest(CARD_SELECTOR) as HTMLElement | null;
    const handleWindowResize = () => {
      scheduleResize();
    };

    if (visible) {
      lastSizeRef.current = null;
      scheduleResize(true);
    }

    if (
      visible &&
      container &&
      typeof ResizeObserver !== "undefined"
    ) {
      const observer = new ResizeObserver(() => {
        scheduleResize();
      });

      observer.observe(container);

      if (card && card !== container) {
        observer.observe(card);
      }

      window.addEventListener("resize", handleWindowResize);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", handleWindowResize);
        cancelScheduledResize();
      };
    }

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      cancelScheduledResize();
    };
  }, [visible]);

  return {
    chartRef,
    containerRef,
  };
}
