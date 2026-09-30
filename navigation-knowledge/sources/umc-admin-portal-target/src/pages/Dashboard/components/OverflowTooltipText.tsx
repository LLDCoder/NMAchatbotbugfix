import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tooltip } from "antd";

type OverflowTooltipTextTag = "span" | "h3" | "strong" | "small";

interface OverflowTooltipTextProps {
  as?: OverflowTooltipTextTag;
  className?: string;
  text?: string;
  tooltipVisibleMode?: "overflow" | "always";
}

const getTooltipPopupContainer = () => document.body;

export default function OverflowTooltipText({
  as = "span",
  className,
  text = "",
  tooltipVisibleMode = "overflow",
}: OverflowTooltipTextProps) {
  const textRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  const isOverflowing = useCallback(() => {
    const element = textRef.current;

    if (!element) {
      return false;
    }

    return (
      element.scrollWidth > element.clientWidth ||
      element.scrollHeight > element.clientHeight
    );
  }, []);

  const handleVisibleChange = useCallback(
    (nextVisible: boolean) => {
      if (!nextVisible) {
        setVisible(false);
        return;
      }

      setVisible(
        Boolean(text) && (tooltipVisibleMode === "always" || isOverflowing())
      );
    },
    [isOverflowing, text, tooltipVisibleMode]
  );

  useEffect(() => {
    setVisible(false);
  }, [text]);

  const childByTag: Record<OverflowTooltipTextTag, React.ReactElement> = {
    h3: (
      <h3 ref={textRef as React.Ref<HTMLHeadingElement>} className={className}>
        {text}
      </h3>
    ),
    small: (
      <small ref={textRef as React.Ref<HTMLElement>} className={className}>
        {text}
      </small>
    ),
    span: (
      <span ref={textRef as React.Ref<HTMLSpanElement>} className={className}>
        {text}
      </span>
    ),
    strong: (
      <strong ref={textRef as React.Ref<HTMLElement>} className={className}>
        {text}
      </strong>
    ),
  };

  return (
    <Tooltip
      title={text}
      visible={visible}
      onVisibleChange={handleVisibleChange}
      destroyTooltipOnHide
      getPopupContainer={getTooltipPopupContainer}
      overlayClassName="dashboard__overflow-tooltip"
    >
      {childByTag[as]}
    </Tooltip>
  );
}
