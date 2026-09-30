import type { FC, ReactNode } from "react";
import "./AllOverviewFilterToolbar.less";

interface AllOverviewFilterToolbarProps {
  children: ReactNode;
}

const AllOverviewFilterToolbar: FC<AllOverviewFilterToolbarProps> = ({
  children,
}) => (
  <div className="all-overview-filters all-overview-filter-toolbar responsive-filter-toolbar">
    <div className="all-overview-filter-toolbar__controls responsive-filter-toolbar__controls">
      {children}
    </div>
  </div>
);

export default AllOverviewFilterToolbar;
