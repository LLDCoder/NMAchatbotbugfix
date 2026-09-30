import { useEffect, useState } from "react";

export const COMPACT_VIEWPORT_MAX_WIDTH = 1919.98;
export const NARROW_VIEWPORT_MAX_WIDTH = 1439.98;

export const getEffectiveViewportWidth = (): number => {
  if (typeof window === "undefined") {
    return Number.POSITIVE_INFINITY;
  }

  const innerWidth = window.innerWidth;
  const documentWidth = window.document.documentElement.clientWidth || innerWidth;

  return Math.min(innerWidth, documentWidth);
};

export const useResponsiveViewportBand = () => {
  const [width, setWidth] = useState(getEffectiveViewportWidth);

  useEffect(() => {
    const updateWidth = () => setWidth(getEffectiveViewportWidth());

    updateWidth();
    window.addEventListener("resize", updateWidth);
    window.visualViewport?.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
      window.visualViewport?.removeEventListener("resize", updateWidth);
    };
  }, []);

  return {
    width,
    isCompact: width <= COMPACT_VIEWPORT_MAX_WIDTH,
    isNarrow: width <= NARROW_VIEWPORT_MAX_WIDTH,
  };
};
