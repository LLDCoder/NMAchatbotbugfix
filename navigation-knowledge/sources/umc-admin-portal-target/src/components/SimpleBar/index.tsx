import { forwardRef } from "react";
import type React from "react";
import BaseSimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "./index.less";

type BaseSimpleBarProps = React.ComponentPropsWithoutRef<typeof BaseSimpleBar>;
type BaseSimpleBarRef = React.ElementRef<typeof BaseSimpleBar>;

export type SimpleBarProps = BaseSimpleBarProps;

const SimpleBar = forwardRef<BaseSimpleBarRef, SimpleBarProps>(
  ({ className = "", ...props }, ref) => {
    const mergedClassName = ["custom-simplebar", className]
      .filter(Boolean)
      .join(" ");

    return <BaseSimpleBar ref={ref} className={mergedClassName} {...props} />;
  }
);

SimpleBar.displayName = "SimpleBar";

export default SimpleBar;
