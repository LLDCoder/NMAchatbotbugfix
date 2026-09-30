import { Input, Select } from "antd";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import Sousuo from "@/assets/icons/Sousuo";

interface ToolbarSelectOption {
  label: string;
  value: string;
}

interface ToolbarSelectConfig {
  value?: string;
  options: ToolbarSelectOption[];
  onChange: (value: string) => void;
}

interface TableToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  exportLabel?: string;
  onExport: () => void;
  selects?: ToolbarSelectConfig[];
  isExporting?: boolean;
}

export default function TableToolbar({
  keyword,
  onKeywordChange,
  exportLabel,
  onExport,
  selects = [],
  isExporting,
}: TableToolbarProps) {
  const { t: translate } = useTranslation();

  return (
    <div className="service-reports__toolbar responsive-filter-toolbar responsive-filter-toolbar--wrap responsive-filter-toolbar--center-actions">
      <div className="service-reports__toolbar-left responsive-filter-toolbar__controls">
        <Input
          allowClear
          value={keyword}
          prefix={<Sousuo className="search-icon" />}
          placeholder={translate("common.search")}
          className="service-reports__search-input responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        {selects.map((select, index) => (
          <Select
            key={`service-reports-select-${index + 1}`}
            value={select.value}
            className="service-reports__select responsive-filter-toolbar__field"
            onChange={select.onChange}
            options={select.options}
          />
        ))}
      </div>
      <CustomButton
        variant="outline"
        size="medium"
        text={isExporting ? translate("common.loading") : (exportLabel || translate("common.export"))}
        customClassName="service-reports__export-btn responsive-filter-toolbar__action"
        onClick={onExport}
        disabled={isExporting}
      />
    </div>
  );
}
