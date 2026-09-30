import { DatePicker, Input, Select } from "antd";
import type { ColumnsType } from "antd/lib/table";
import type { Moment } from "moment";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomButton, PaginationTotal } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import BookApproved from "@/assets/images/book-approved.png";
import BookRejected from "@/assets/images/book-rejected.png";
import BookTotal from "@/assets/images/book-total.png";
import Sousuo from "@/assets/icons/Sousuo";
import {
  exportRegulateEntryItemList,
  getMaterialTypeLookup,
  getRegulateEntryItemList,
  getRegulateEntryItemsCount,
  type IRegulateEntryItem,
  type IRegulateEntryItemListRequest,
  type IRegulateEntryItemListResponse,
  type IRegulateEntryItemsCountResponse,
  type MaterialTypeLookupDto,
} from "@/services/contentLibrary";
import { getLanguages } from "@/services/services";
import { toApi } from "@/utils/gstTime";
import LanguageListCell from "../LanguageListCell";
import "./index.less";

type LookupItem = {
  id?: number | string;
  Id?: number | string;
  nameEn?: string;
  NameEn?: string;
  nameAr?: string;
  NameAr?: string;
};

type FilterFormValues = {
  SearchKey?: string;
  materialtypeCode?: string;
  languageid?: number;
  statuscode?: number;
  dateRange?: [Moment | null, Moment | null] | null;
};

const INITIAL_PARAMS: IRegulateEntryItemListRequest = {
  PageIndex: 1,
  PageSize: 10,
  SortBy: "Id",
  SortDirection: "Descending",
};

const EMPTY_LIST_RESPONSE: IRegulateEntryItemListResponse = {
  items: [],
  totalItems: 0,
  pageIndex: 1,
  pageSize: 10,
};

const EMPTY_COUNT_RESPONSE: IRegulateEntryItemsCountResponse = {
  total: 0,
  approved: 0,
  rejected: 0,
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getLookupId = (item: LookupItem) => item.id ?? item.Id;

const getMaterialTypeCode = (item: MaterialTypeLookupDto) =>
  String(item.code ?? "").trim();

const isLookupItem = (item: unknown): item is LookupItem =>
  Boolean(item) && typeof item === "object";

const isMaterialTypeLookupDto = (item: unknown): item is MaterialTypeLookupDto =>
  Boolean(item) && typeof item === "object";

const isRegulateEntryItem = (item: unknown): item is IRegulateEntryItem =>
  Boolean(item) && typeof item === "object";

const getLocalizedLookupLabel = (item: LookupItem, isArabic: boolean) => {
  const preferredName = isArabic
    ? item.nameAr ?? item.NameAr
    : item.nameEn ?? item.NameEn;
  const fallbackName = isArabic
    ? item.nameEn ?? item.NameEn
    : item.nameAr ?? item.NameAr;

  return String(preferredName ?? fallbackName ?? getLookupId(item) ?? "").trim();
};

export default function RegulateEntryItems() {
  const { i18n, t } = useTranslation();
  const [filterStore] = useFilter();
  const [params, setParams] = useState<IRegulateEntryItemListRequest>(INITIAL_PARAMS);
  const [data, setData] = useState<IRegulateEntryItemListResponse>(
    EMPTY_LIST_RESPONSE,
  );
  const [statistics, setStatistics] = useState<IRegulateEntryItemsCountResponse>(
    EMPTY_COUNT_RESPONSE,
  );
  const [loading, setLoading] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [languages, setLanguages] = useState<LookupItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeLookupDto[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [materialTypesLoading, setMaterialTypesLoading] = useState(false);
  const isArabic = i18n.language?.startsWith("ar");

  const languageOptions = useMemo(
    () =>
      languages
        .filter(isLookupItem)
        .map((item) => {
          const value = toOptionalNumber(getLookupId(item));
          const label = getLocalizedLookupLabel(item, Boolean(isArabic));
          return value === undefined || !label ? null : { value, label };
        })
        .filter((item): item is { value: number; label: string } => item !== null),
    [isArabic, languages],
  );

  const materialTypeOptions = useMemo(
    () =>
      materialTypes
        .map((item) => {
          const value = getMaterialTypeCode(item);
          const label = getLocalizedLookupLabel(item, Boolean(isArabic));
          return !value || !label ? null : { value, label };
        })
        .filter((item): item is { value: string; label: string } => item !== null),
    [isArabic, materialTypes],
  );

  const filters = useMemo(
    () => ({
      SearchKey: params.SearchKey,
      materialtypeCode: params.materialtypeCode,
      languageid: params.languageid,
      statuscode: params.statuscode,
      CreatedOnFr: params.CreatedOnFr,
      CreatedOnTo: params.CreatedOnTo,
    }),
    [
      params.SearchKey,
      params.materialtypeCode,
      params.languageid,
      params.statuscode,
      params.CreatedOnFr,
      params.CreatedOnTo,
    ],
  );

  const tableFilters = useMemo(
    () => [
      {
        label: t("common.search"),
        element: (
          <Input
            allowClear
            className="regulate-entry-items-search"
            key="input-SearchKey"
            placeholder={t("common.search")}
            prefix={<Sousuo className="regulate-entry-items-search-icon" />}
          />
        ),
        requestDebounceMs: 300,
      },
      {
        label: t("Content.contentLibrary.columns.materialType"),
        element: (
          <Select
            allowClear
            className="regulate-entry-items-select"
            dropdownClassName="content-library-select-dropdown"
            key="select-materialtypeCode"
            loading={materialTypesLoading}
            options={materialTypeOptions}
            placeholder={t("Content.contentLibrary.filters.allMaterialTypes")}
          />
        ),
      },
      {
        label: t("Content.contentLibrary.columns.materialStatus"),
        element: (
          <Select
            allowClear
            className="regulate-entry-items-select"
            dropdownClassName="content-library-select-dropdown"
            key="select-statuscode"
            placeholder={t("Content.contentLibrary.filters.allMaterialStatuses")}
          >
            <Select.Option value={1}>
              {t("Content.contentLibrary.stats.approved")}
            </Select.Option>
            <Select.Option value={0}>
              {t("Content.contentLibrary.stats.rejected")}
            </Select.Option>
          </Select>
        ),
      },
      {
        label: t("Content.contentLibrary.filters.languages"),
        element: (
          <Select
            allowClear
            className="regulate-entry-items-select"
            dropdownClassName="content-library-select-dropdown"
            key="select-languageid"
            loading={languagesLoading}
            options={languageOptions}
            placeholder={t("Content.contentLibrary.filters.allLanguages")}
          />
        ),
      },
      {
        label: t("Content.contentLibrary.filters.approvalDate"),
        element: (
          <DatePicker.RangePicker
            allowClear
            className="regulate-entry-items-date-range"
            format="DD/MM/YYYY"
            key="range-dateRange"
            placeholder={[
              t("Content.contentLibrary.filters.startDate"),
              t("Content.contentLibrary.filters.endDate"),
            ]}
          />
        ),
      },
    ],
    [
      languageOptions,
      languagesLoading,
      materialTypeOptions,
      materialTypesLoading,
      t,
    ],
  );

  const columns = useMemo<ColumnsType<IRegulateEntryItem>>(
    () => [
      {
        title: t("Content.contentLibrary.columns.title"),
        dataIndex: "title",
        key: "title",
        render: (value: unknown) => String(value ?? "-"),
      },
      {
        title: t("Content.contentLibrary.columns.hsCode"),
        dataIndex: "hsCode",
        key: "hsCode",
        render: (value: unknown) => String(value ?? "-"),
      },
      {
        title: t("Content.contentLibrary.columns.materialType"),
        key: "materialType",
        render: (_value, record) =>
          String(
            (isArabic
              ? record.materialTypeNameAr ?? record.materialTypeNameEn
              : record.materialTypeNameEn ?? record.materialTypeNameAr) ?? "-",
          ),
      },
      {
        title: t("Content.contentLibrary.columns.language"),
        dataIndex: "language",
        key: "language",
        render: (value: unknown) => <LanguageListCell value={value} emptyText="-" />,
      },
      {
        title: t("Content.contentLibrary.columns.numberOfTitles"),
        dataIndex: "numberOfTitles",
        key: "numberOfTitles",
        render: (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) ? value : 0,
      },
      {
        title: t("Content.contentLibrary.columns.materialStatus"),
        dataIndex: "status",
        key: "status",
        render: (value: unknown) => (
          <CustomStatusTag
            type="contentLibraryStatus"
            status={typeof value === "string" ? value : ""}
          />
        ),
      },
    ],
    [isArabic, t],
  );

  useEffect(() => {
    let cancelled = false;
    setLanguagesLoading(true);

    getLanguages()
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response?.data) ? response.data : [];
        setLanguages(items.filter(isLookupItem));
      })
      .catch(() => {
        if (!cancelled) setLanguages([]);
      })
      .finally(() => {
        if (!cancelled) setLanguagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMaterialTypesLoading(true);

    getMaterialTypeLookup()
      .then((response) => {
        if (!cancelled) {
          const items = Array.isArray(response?.data) ? response.data : [];
          setMaterialTypes(items.filter(isMaterialTypeLookupDto));
        }
      })
      .catch(() => {
        if (!cancelled) setMaterialTypes([]);
      })
      .finally(() => {
        if (!cancelled) setMaterialTypesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getRegulateEntryItemList(params)
      .then((response) => {
        if (!cancelled) {
          setData({
            items: Array.isArray(response?.data?.items)
              ? response.data.items.filter(isRegulateEntryItem)
              : [],
            totalItems: response?.data?.totalItems ?? 0,
            pageIndex: response?.data?.pageIndex ?? params.PageIndex,
            pageSize: response?.data?.pageSize ?? params.PageSize,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            ...EMPTY_LIST_RESPONSE,
            pageIndex: params.PageIndex,
            pageSize: params.PageSize,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    setStatisticsLoading(true);

    getRegulateEntryItemsCount()
      .then((response) => {
        if (!cancelled) {
          setStatistics({
            total: response?.data?.total ?? 0,
            approved: response?.data?.approved ?? 0,
            rejected: response?.data?.rejected ?? 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStatistics(EMPTY_COUNT_RESPONSE);
      })
      .finally(() => {
        if (!cancelled) setStatisticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterRequest = async () => {
    const values = filterStore.getFieldsValue() as FilterFormValues;
    const [startDate, endDate] = Array.isArray(values.dateRange)
      ? values.dateRange
      : [null, null];
    const startMoment = moment.isMoment(startDate) && startDate.isValid() ? startDate : null;
    const endMoment = moment.isMoment(endDate) && endDate.isValid() ? endDate : null;

    setParams((previous) => ({
      ...previous,
      SearchKey: values.SearchKey?.trim() || undefined,
      materialtypeCode: String(values.materialtypeCode ?? "").trim() || undefined,
      languageid: toOptionalNumber(values.languageid),
      statuscode: toOptionalNumber(values.statuscode),
      CreatedOnFr: startMoment ? toApi(startMoment.clone().startOf("day")) : undefined,
      CreatedOnTo: endMoment ? toApi(endMoment.clone().endOf("day")) : undefined,
      PageIndex: 1,
    }));
  };

  const handleExport = () => {
    setExportLoading(true);
    exportRegulateEntryItemList(filters).finally(() => setExportLoading(false));
  };

  return (
    <div className="regulate-entry-items">
      <div className="regulate-entry-items-statistics">
        <StatisticCard
          icon={BookTotal}
          label={t("Content.contentLibrary.stats.total")}
          value={statistics.total}
          loading={statisticsLoading}
        />
        <StatisticCard
          icon={BookApproved}
          label={t("Content.contentLibrary.stats.approved")}
          value={statistics.approved}
          loading={statisticsLoading}
        />
        <StatisticCard
          icon={BookRejected}
          label={t("Content.contentLibrary.stats.rejected")}
          value={statistics.rejected}
          loading={statisticsLoading}
        />
      </div>
      <div className="regulate-entry-items-table-container">
        <FilterTable
          containerCls="regulate-entry-items-filter-table"
          columns={columns}
          dataSource={data.items ?? []}
          extraBtn={
            <CustomButton
              loading={exportLoading}
              onClick={handleExport}
              permissionCode="Content.ContentLibrary.ExportRegulateEntryItems"
              permissionRoutePath="/content/ContentLibrary"
              text={t("common.export")}
              variant="outline"
            />
          }
          filterStore={filterStore}
          loading={loading}
          pagination={{
            size: "default",
            current: data.pageIndex ?? params.PageIndex,
            pageSize: data.pageSize ?? params.PageSize,
            total: data.totalItems ?? 0,
            pageSizeOptions: ["10", "20", "50", "100"],
            showSizeChanger: true,
            showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={data.pageIndex ?? params.PageIndex} pageSize={data.pageSize ?? params.PageSize} />,
          }}
          request={handleFilterRequest}
          rowKey={(record, index) => String(record.id ?? `${record.title ?? "item"}-${index}`)}
          scroll={{ x: "max-content" }}
          tableFilters={tableFilters}
          responsiveToolbar
          onChange={(pagination) => {
            setParams((previous) => ({
              ...previous,
              PageIndex: pagination.current ?? 1,
              PageSize: pagination.pageSize ?? previous.PageSize,
            }));
          }}
        />
      </div>
    </div>
  );
}

type StatisticCardProps = {
  icon: string;
  label: string;
  value?: number;
  loading: boolean;
};

function StatisticCard({ icon, label, value, loading }: StatisticCardProps) {
  return (
    <div className="regulate-entry-items-statistic-card">
      <div className="regulate-entry-items-statistic-icon">
        <img alt={label} src={icon} />
      </div>
      <div>
        <div className="regulate-entry-items-statistic-value">
          {loading ? "-" : value ?? 0}
        </div>
        <div className="regulate-entry-items-statistic-label">{label}</div>
      </div>
    </div>
  );
}
