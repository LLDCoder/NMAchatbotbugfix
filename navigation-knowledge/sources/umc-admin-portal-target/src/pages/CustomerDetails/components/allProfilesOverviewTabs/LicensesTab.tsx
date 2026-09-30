import React, { useEffect, useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table, Tooltip } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import moment from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import type { LicenseItem } from "../../types";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { canAccessRouteWithToast } from "@/routes/permissionNavigation";
import {
  formatOverviewRequestDateTime,
  renderOverviewSearchPrefix,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import {
  getCertificateStatus,
  type IDict,
} from "@/services/dictionary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";

type SelectOption = { label: string; value: string };
type RangeValue = [moment.Moment | null, moment.Moment | null] | null;

const FALLBACK_LICENSE_STATUS_OPTIONS = [
  { value: "201", translationKey: "customStatusTag.active" },
  { value: "202", translationKey: "customStatusTag.expired" },
  { value: "203", translationKey: "customStatusTag.cancelled" },
  { value: "204", translationKey: "customStatusTag.disabled" },
];

const getDictionaryItems = (response: unknown): IDict[] => {
  if (Array.isArray(response)) return response as IDict[];

  const firstLevel = (response as { data?: unknown } | null)?.data;
  if (Array.isArray(firstLevel)) return firstLevel as IDict[];

  const secondLevel = (firstLevel as { data?: unknown } | null)?.data;
  return Array.isArray(secondLevel) ? (secondLevel as IDict[]) : [];
};

const parseDateValue = (value?: string) => {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;

  const parsed = moment(
    text,
    [
      moment.ISO_8601,
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "YYYY-MM-DD",
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      "DD/MM/YYYY",
    ],
    true,
  );

  return parsed.isValid() ? parsed : null;
};

const renderEllipsisText = (value?: string | null) => {
  const text = (value ?? "-").trim() || "-";

  return (
    <Tooltip title={text}>
      <span className="overview-cell-ellipsis">{text}</span>
    </Tooltip>
  );
};

const renderLicenseName = (value?: string | null) => {
  const text = (value ?? "-").trim() || "-";

  return (
    <Tooltip title={text}>
      <div className="overview-two-line overview-two-line--clamp">
        <span className="overview-primary">{text}</span>
      </div>
    </Tooltip>
  );
};

const renderDateCell = (value?: string | null) => {
  const parsed = parseDateValue(value || undefined);
  return parsed ? parsed.format("DD/MM/YYYY") : "-";
};

const toLicenseStatusValue = (status?: string | null) => {
  const numericStatus = Number(status);
  return Number.isFinite(numericStatus) ? numericStatus : status;
};

const LicensesTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  licenses?: LicenseItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<LicenseItem> | SorterResult<LicenseItem>[],
  ) => void;
  showApplyFor?: boolean;
  status?: string;
  onStatusChange?: (value?: string) => void;
  issuanceDateStart?: string;
  issuanceDateEnd?: string;
  onIssuanceDateRangeChange?: (value: {
    issuanceDateStart?: string;
    issuanceDateEnd?: string;
  }) => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  licenses,
  loading,
  pagination,
  onTableChange,
  showApplyFor,
  status,
  onStatusChange,
  issuanceDateStart,
  issuanceDateEnd,
  onIssuanceDateRangeChange,
}) => {
  const { i18n, t } = useTranslation();
  const history = useHistory();
  const [certificateStatuses, setCertificateStatuses] = useState<IDict[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | undefined>();
  const [draftIssuanceRange, setDraftIssuanceRange] = useState<RangeValue>(null);

  useEffect(() => {
    let cancelled = false;

    getCertificateStatus()
      .then((response) => {
        if (cancelled) return;
        const items = getDictionaryItems(response).filter(
          (item) => String(item?.code ?? "") !== "205",
        );
        setCertificateStatuses(items.length ? items : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load certificate statuses:", error);
        setCertificateStatuses([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo<ColumnsType<LicenseItem>>(() => {
    const cols: ColumnsType<LicenseItem> = [
      {
        title: t("Customer.customerDetails.tabs.licenses.licenseNo"),
        dataIndex: "licenseNumber",
        key: "licenseNumber",
        width: 220,
        render: (text: string) => renderEllipsisText(text),
      },
      {
        title: t("Customer.customerDetails.tabs.licenses.applicationNo"),
        dataIndex: "applicationNumber",
        key: "applicationNumber",
        width: 200,
        render: (text: string) => renderEllipsisText(text),
      },
      {
        title: t("Customer.customerDetails.tabs.licenses.license"),
        dataIndex: "licenseType",
        key: "licenseType",
        width: 260,
        render: (text: string, record) =>
          renderLicenseName(
            i18n.language.toLowerCase().startsWith("ar")
              ? record.licenseTypeAr !== "-"
                ? record.licenseTypeAr
                : text
              : text,
          ),
      },
      {
        title: t("Customer.customerDetails.tabs.licenses.mediaActivity"),
        dataIndex: "mediaActivity",
        key: "mediaActivity",
        width: 260,
        // Backend sends one localized, ", "-joined string, so this renders it
        // straight through with the same two-line clamp as the name column.
        render: (text: string) => renderLicenseName(text),
      },
      {
        title: t("Customer.customerDetails.tabs.licenses.status"),
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (text: string) => {
          return (
            <CustomStatusTag
              type="licenseStatus"
              status={toLicenseStatusValue(text)}
            />
          );
        },
      },
      {
        title: (
          <span className="overview-sort-title">
            {t("Customer.customerDetails.tabs.licenses.effectiveDate")}
          </span>
        ),
        dataIndex: "issuanceTime",
        key: "issuanceTime",
        width: 150,
        sorter: true,
        defaultSortOrder: "descend",
        render: (text: string) => renderDateCell(text),
      },
      {
        title: (
          <span className="overview-sort-title">
            {t("Customer.customerDetails.tabs.licenses.expirationDate")}
          </span>
        ),
        dataIndex: "expirationTime",
        key: "expirationTime",
        width: 150,
        sorter: true,
        render: (text: string) => renderDateCell(text),
      },
    ];

    if (showApplyFor) {
      cols.splice(3, 0, {
        title: t("Customer.customerDetails.tabs.licenses.applyFor"),
        dataIndex: "applicant",
        key: "applicant",
        width: 220,
        render: (text: string) => renderEllipsisText(text),
      });
    }

    return cols;
  }, [i18n.language, showApplyFor, t]);

  const statusOptions = useMemo(() => {
    return [
      {
        label: t("Customer.customerDetails.common.allStatuses"),
        value: "",
      } as SelectOption,
    ].concat(
      certificateStatuses.length
        ? certificateStatuses.map((item) => ({
            label:
              (i18n.language.toLowerCase().startsWith("ar")
                ? item.nameAr || item.nameEn
                : item.nameEn || item.nameAr) || item.code,
            value: String(item.code),
          }))
        : FALLBACK_LICENSE_STATUS_OPTIONS.map((item) => ({
            label: t(item.translationKey),
            value: item.value,
          })),
    );
  }, [certificateStatuses, i18n.language, t]);

  const rangeValue = useMemo<RangeValue>(() => {
    if (!issuanceDateStart && !issuanceDateEnd) return null;

    return [
      issuanceDateStart ? parseDateValue(issuanceDateStart) : null,
      issuanceDateEnd ? parseDateValue(issuanceDateEnd) : null,
    ];
  }, [issuanceDateEnd, issuanceDateStart]);

  const rows = useMemo(() => licenses || [], [licenses]);

  // The modal filters status and an issuance date range (counted as one).
  const appliedFilterCount =
    countAppliedFilters([status]) +
    (isAppliedFilterValue(issuanceDateStart) ||
    isAppliedFilterValue(issuanceDateEnd)
      ? 1
      : 0);

  const openFilterModal = () => {
    setDraftStatus(status);
    setDraftIssuanceRange(rangeValue);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftStatus(status);
    setDraftIssuanceRange(rangeValue);
    setFilterModalOpen(false);
  };

  const handleApply = () => {
    const start = draftIssuanceRange?.[0];
    const end = draftIssuanceRange?.[1];
    if (draftStatus !== status) {
      onStatusChange?.(draftStatus || undefined);
    }
    onIssuanceDateRangeChange?.({
      issuanceDateStart: start
        ? formatOverviewRequestDateTime(start.clone().startOf("day"))
        : undefined,
      issuanceDateEnd: end
        ? formatOverviewRequestDateTime(end.clone().startOf("day"))
        : undefined,
    });
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setDraftStatus(undefined);
    setDraftIssuanceRange(null);
    setFilterModalOpen(false);
    onSearchKeyChange("");
    onStatusChange?.(undefined);
    onIssuanceDateRangeChange?.({
      issuanceDateStart: undefined,
      issuanceDateEnd: undefined,
    });
  };

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          draftIssuanceRange,
          draftStatus,
          filterModalOpen,
          rangeValue,
          searchKey,
          status,
          statusOptions,
          t,
        ]}
      >
        <AllOverviewFilterToolbar>
          <Input
            allowClear
            prefix={renderOverviewSearchPrefix()}
            placeholder={t("Customer.customerDetails.common.search")}
            value={searchKey}
            className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
            onChange={(e) => onSearchKeyChange(e.target.value)}
          />

          <Select
            value={status}
            onChange={(v) => onStatusChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allStatuses")}
            options={statusOptions}
            optionFilterProp="label"
          />
          <DatePicker.RangePicker
            key="range-time"
            value={rangeValue ?? undefined}
            format="DD/MM/YYYY"
            placeholder={[
              t("Customer.customerDetails.tabs.licenses.effectiveStartDate"),
              t("Customer.customerDetails.tabs.licenses.effectiveEndDate"),
            ]}
            onChange={(values) => {
              const start = values?.[0]
                ? formatOverviewRequestDateTime(values[0].clone().startOf("day"))
                : undefined;
              const end = values?.[1]
                ? formatOverviewRequestDateTime(values[1].clone().startOf("day"))
                : undefined;
              onIssuanceDateRangeChange?.({
                issuanceDateStart: start,
                issuanceDateEnd: end,
              });
            }}
            inputReadOnly
            allowClear
            className="est-overview-range responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
          />
          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button all-overview-filter-toolbar__filter-button--compact all-overview-filter-toolbar__action--responsive-only filter-trigger-with-count"
            onClick={openFilterModal}
          >
            {t("Customer.customerDetails.common.filter")}
            <img className="filter-trigger-funnel" src={sortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={t("common.reset")}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button all-overview-filter-toolbar__action--responsive-only"
            onClick={handleReset}
          />
        </AllOverviewFilterToolbar>

        <Modal
          visible={filterModalOpen}
          onCancel={handleCancel}
          centered
          width={960}
          className="overview-filter-modal"
          title={t("Customer.customerDetails.common.filter")}
          destroyOnClose
          footer={
            <div className="overview-filter-footer">
              <CustomButton
                text={t("common.cancel")}
                variant="outline"
                onClick={handleCancel}
              />
              <CustomButton
                text={t("common.apply")}
                variant="primary"
                onClick={handleApply}
              />
            </div>
          }
        >
          <div className="overview-filter-body">
            <div className="overview-filter-form overview-filter-form--two-column">
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.licenses.status")}
                </div>
                <Select
                  value={draftStatus}
                  onChange={(value) => setDraftStatus(value || undefined)}
                  allowClear
                  placeholder={t("Customer.customerDetails.common.allStatuses")}
                  options={statusOptions}
                  optionFilterProp="label"
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.licenses.effectiveDate")}
                </div>
                <DatePicker.RangePicker
                  value={draftIssuanceRange ?? undefined}
                  format="DD/MM/YYYY"
                  placeholder={[
                    t("Customer.customerDetails.tabs.licenses.effectiveStartDate"),
                    t("Customer.customerDetails.tabs.licenses.effectiveEndDate"),
                  ]}
                  onChange={(value) => setDraftIssuanceRange(value as RangeValue)}
                />
              </div>
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>

      <Table<LicenseItem>
        className="admin-table all-overview-table"
        columns={columns}
        tableLayout="fixed"
        dataSource={rows}
        rowKey={(record, index) => record.id ?? `license-${index ?? 0}`}
        scroll={{ x: showApplyFor ? 1300 : 1080 }}
        loading={loading}
        pagination={pagination || { pageSize: 10, showSizeChanger: true }}
        sortDirections={["descend", "ascend"]}
        onRow={(record) => ({
          onClick: () => {
            if (
              record.id === null ||
              record.id === undefined ||
              record.id === ""
            ) {
              return;
            }
            const targetPath = `/licensing/license/licenseDatails?code=${record.id}`;
            if (!canAccessRouteWithToast(targetPath)) return;
            history.push(targetPath);
          },
        })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Customer.customerDetails.common.noData")}
            />
          ),
        }}
        onChange={(p, _f, s) => {
          onTableChange?.(p, s);
        }}
      />
    </>
  );
};

export default LicensesTab;
