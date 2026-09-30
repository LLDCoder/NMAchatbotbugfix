import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Tooltip } from "antd";
import type {
  TooltipPlacement,
  TooltipProps,
} from "antd/lib/tooltip";

interface OverflowTooltipProps {
  className?: string;
  children: React.ReactNode;
  title: React.ReactNode;
  placement?: TooltipPlacement;
  color?: TooltipProps["color"];
  overlayInnerStyle?: TooltipProps["overlayInnerStyle"];
  overlayClassName?: TooltipProps["overlayClassName"];
}

const OverflowTooltip: React.FC<OverflowTooltipProps> = ({
  className,
  children,
  title,
  placement = "top",
  color,
  overlayInnerStyle,
  overlayClassName,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const measureOverflow = useCallback(() => {
    const element = contentRef.current;
    if (!element) return;

    const { clientHeight, clientWidth, scrollHeight, scrollWidth } = element;
    setIsOverflowing(
      scrollWidth > clientWidth || scrollHeight > clientHeight,
    );
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
    const frameId = window.requestAnimationFrame(measureOverflow);
    const element = contentRef.current;

    if (!element) {
      return () => window.cancelAnimationFrame(frameId);
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", measureOverflow);
      };
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [children, measureOverflow]);

  useEffect(() => {
    if (!("fonts" in document)) return undefined;

    let isMounted = true;
    void document.fonts.ready.then(() => {
      if (isMounted) measureOverflow();
    });

    return () => {
      isMounted = false;
    };
  }, [measureOverflow]);

  const tooltipTitle = isOverflowing ? title : undefined;

  return (
    <Tooltip
      title={tooltipTitle}
      placement={placement}
      color={color}
      overlayInnerStyle={overlayInnerStyle}
      overlayClassName={overlayClassName}
    >
      <div ref={contentRef} className={className}>
        {children}
      </div>
    </Tooltip>
  );
};

export default OverflowTooltip;
