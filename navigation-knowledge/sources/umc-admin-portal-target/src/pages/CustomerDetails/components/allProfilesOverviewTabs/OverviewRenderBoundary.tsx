import React, { memo } from "react";

const OverviewRenderBoundary = memo(
  ({
    children,
  }: {
    dependencies: readonly unknown[];
    children: React.ReactNode;
  }) => <>{children}</>,
  (previous, next) =>
    previous.dependencies.length === next.dependencies.length &&
    previous.dependencies.every((value, index) =>
      Object.is(value, next.dependencies[index]),
    ),
);

OverviewRenderBoundary.displayName = "OverviewRenderBoundary";

export default OverviewRenderBoundary;
