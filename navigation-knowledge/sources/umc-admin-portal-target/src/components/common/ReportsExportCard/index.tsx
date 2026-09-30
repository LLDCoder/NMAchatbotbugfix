import { useState } from "react";
import { DatePicker, Select } from "antd";
import type { Moment } from "moment";
import CustomButton from "../CustomButton";
import "./index.less";
export type ReportsExportSelectOption = {
  value: string;
  label: string;
};
export type ReportsExportField = {
  key: string;
  label: string;
  options: ReportsExportSelectOption[];
  placeholder: string;
};
export type ReportsExportFilters = {
  submissionDate: [Moment | null, Moment | null] | null;
  values: Record<string, string | undefined>;
};
type ReportsExportCardProps = {
  title: string;
  dateLabel: string;
  datePlaceholder: [string, string];
  defaultSubmissionDate?: () => ReportsExportFilters["submissionDate"];
  fields: ReportsExportField[];
  resetLabel: string;
  exportLabel: string;
  columns?: 3 | 4;
  onExport?: (filters: ReportsExportFilters) => Promise<void> | void;
  exportPermissionCode?: string;
  permissionRoutePath?: string;
};
export default function ReportsExportCard({
  title,
  dateLabel,
  datePlaceholder,
  defaultSubmissionDate,
  fields,
  resetLabel,
  exportLabel,
  columns = 3,
  onExport,
  exportPermissionCode,
  permissionRoutePath,
}: ReportsExportCardProps) {
  const [submissionDate, setSubmissionDate] = useState<
    [Moment | null, Moment | null] | null
  >(() => defaultSubmissionDate?.() ?? null);
  const [values, setValues] = useState<Record<string, string | undefined>>({});
  const [exporting, setExporting] = useState(false);
  const reset = () => {
    if (exporting) return;
    setSubmissionDate(defaultSubmissionDate?.() ?? null);
    setValues({});
  };
  const handleExport = async () => {
    if (!onExport || exporting) return;
    setExporting(true);
    try {
      await onExport({ submissionDate, values });
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="reports-export-card">
      <h2 className="reports-export-card__title">{title}</h2>
      <div
        className={`reports-export-card__fields reports-export-card__fields--${columns}`}
      >
        <label className="reports-export-card__field">
          <span>{dateLabel}</span>
          <DatePicker.RangePicker
            className="reports-export-card__date-range"
            value={submissionDate}
            onChange={setSubmissionDate}
            format="DD/MM/YYYY"
            placeholder={datePlaceholder}
          />
        </label>
        {fields.map((field) => (
          <label className="reports-export-card__field" key={field.key}>
            <span>{field.label}</span>
            <Select
              allowClear
              value={values[field.key]}
              placeholder={field.placeholder}
              onChange={(value) =>
                setValues((current) => ({ ...current, [field.key]: value }))
              }
            >
              {field.options.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </label>
        ))}
      </div>
      <div className="reports-export-card__actions">
        <CustomButton
          variant="outline"
          className="reports-export-card__reset"
          onClick={reset}
          disabled={exporting}
        >
          {resetLabel}
        </CustomButton>
        <CustomButton
          variant="primary"
          className="reports-export-card__export"
          onClick={handleExport}
          disabled={exporting}
          loading={exporting}
          permissionCode={exportPermissionCode}
          permissionRoutePath={permissionRoutePath}
        >
          {exportLabel}
        </CustomButton>
      </div>
    </section>
  );
}
