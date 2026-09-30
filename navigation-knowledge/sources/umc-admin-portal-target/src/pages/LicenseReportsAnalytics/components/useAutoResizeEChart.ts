import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";

type EChartsComponentInstance = InstanceType<typeof ReactECharts>;

export default function useAutoResizeEChart(visible = true) {
  const chartRef = useRef<EChartsComponentInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const resizeChart = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        chartRef.current?.getEchartsInstance().resize();
      });
    };

    resizeChart();

    const container = containerRef.current;

    if (container && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        resizeChart();
      });

      observer.observe(container);
      window.addEventListener("resize", resizeChart);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", resizeChart);

        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    window.addEventListener("resize", resizeChart);

    return () => {
      window.removeEventListener("resize", resizeChart);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!visible) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      chartRef.current?.getEchartsInstance().resize();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [visible]);

  return {
    chartRef,
    containerRef,
  };
}
