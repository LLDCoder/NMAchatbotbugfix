import { Input, Select } from "antd";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import Sousuo from "@/assets/icons/Sousuo";
import { PERMISSION_CODES } from "@/constants/permissionCodes";

import { LICENSE_REPORTS_PATH } from "../constants";
import type { SelectOption } from "../type";

interface TableToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  exportLabel: string;
  onExport: () => void;
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
    <div className="reports-table-toolbar">
      <div className="reports-table-toolbar-left">
        <Input
          allowClear
          value={keyword}
          prefix={<Sousuo className="search-icon" />}
          placeholder={translate("common.search")}
          className="reports-search-input"
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        {selectOptions && onSelectChange ? (
          <Select
            value={selectValue}
            className="reports-select"
            onChange={onSelectChange}
            options={selectOptions}
          />
        ) : null}
      </div>
      <CustomButton
        variant="outline"
        size="medium"
        text={exportLabel || translate("common.export")}
        customClassName="reports-export-button"
        onClick={onExport}
        permissionCode={PERMISSION_CODES.licensing.reports.export}
        permissionRoutePath={LICENSE_REPORTS_PATH}
      />
    </div>
  );
}
