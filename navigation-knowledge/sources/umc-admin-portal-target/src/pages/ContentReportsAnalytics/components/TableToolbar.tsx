import { Input, Select } from "antd";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import Sousuo from "@/assets/icons/Sousuo";

import type { SelectOption } from "../type";

interface TableToolbarProps {
  exportLabel: string;
  onExport: () => void;
  keyword?: string;
  onKeywordChange?: (value: string) => void;
  selectOptions?: SelectOption[];
  selectValue?: string;
  onSelectChange?: (value: string) => void;
}

export default function TableToolbar({
  keyword,
  onKeywordChange,
  exportLabel,
  onExport,
  selectOptions,
  selectValue,
  onSelectChange,
}: TableToolbarProps) {
  const { t: translate } = useTranslation();

  return (
    <div className="content-reports__toolbar">
      <div className="content-reports__toolbar-left">
        {onKeywordChange ? (
          <Input
            allowClear
            value={keyword}
            prefix={<Sousuo className="search-icon" />}
            placeholder={translate("common.search")}
            className="content-reports__search-input"
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        ) : null}
        {selectOptions && onSelectChange ? (
          <Select
            value={selectValue}
            className="content-reports__select"
            onChange={onSelectChange}
            options={selectOptions}
          />
        ) : null}
      </div>
      <CustomButton
        variant="outline"
        size="medium"
        text={exportLabel || translate("common.export")}
        customClassName="content-reports__export-btn"
        onClick={onExport}
      />
    </div>
  );
}
