import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Table, Input, Select, Form, DatePicker, Modal } from "antd";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import { useTranslation } from "react-i18next";
import MenuIcon from "@/assets/images/menu.png";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import Sousuo from "@/assets/icons/Sousuo";
import {
  CustomButton,
  CustomMessage,
  PaginationTotal,
  PermissionGuard,
  ResponsiveFilterModal,
} from "@/components/common";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { statusData } from "./data";
import { useHistory } from "react-router-dom";
import DisableLicenseModal from "./components/DisableLicenseModal";
import FilePassword from "./components/FilePassword";
import enterprise from "@/assets/images/enterprise.svg";
import UnionTable from "@/assets/images/UnionTable.svg";
import {
  getLicenseManagementDetails,
  getLicenseManagementList,
  getStatistics,
  getUserProfileExport,
  postUpdateCertificateStatus,
  exportLicensePermits
} from "@/services/license";
import type {
  LicenseDetail,
  LicenseManagementListRequestDto,
  LicenseManagementListResponseDto,
  StatisticsResponseDto,
} from "@/services/license";

import moment, { type Moment } from "moment";
import { DISPLAY_DATE, fmt } from "@/utils/gstTime";
import "./index.less";
import { transformDate } from "@/utils/transform";
import { getCertificateStatus, type IDict } from "@/services/dictionary";
import DocumentDown from "./components/DocumentDown";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { exportCSVFile } from "@/utils/utils"

const { Option } = Select;
const { RangePicker } = DatePicker;
type PermitActionColumnKey = "preview" | "disable" | "enable";

const PERMIT_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<PermitActionColumnKey> =
  {
    preview: {
      default: 76,
      compact: 67,
    },
    disable: {
      default: 67,
      compact: 59,
    },
    enable: {
      default: 70,
      compact: 62,
    },
  };
const PERMIT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 208,
};
const PERMIT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 188,
};
const PERMIT_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

type CompactPermitFilterValues = {
  timeIssuance?: [Moment | null, Moment | null] | null;
  typeFilter?: string;
};

export default function Permits() {
  const [modal, contextHolder] = Modal.useModal();
  const [form] = Form.useForm();
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [exportLoading, setExportLoading] = useState(false);
  const [disableVisible, setDisableVisible] = useState(false as boolean);
  const [fileVisible, setFileVisible] = useState(false as boolean);
  const [rowData, setRowData] = useState(
    {} as LicenseManagementListResponseDto
  );
  const [tableData, setTableData] = useState(
    [] as LicenseManagementListResponseDto[]
  );
  const [statisticsData, setStatisticsData] = useState(
    {} as StatisticsResponseDto
  );
  const [sort, setSort] = useState<{
    sortBy: string;
    sortDirection: number;
  } | null>(null);
  const history = useHistory();
  const [certificateStatus, setCertificateStatus] = useState<IDict[]>([]);
  const [page, setPage] = useState({
    total: 0,
    current: 1,
    pageSize: 10,
  });
  const listRequestIdRef = useRef(0);
  const searchTimerRef = useRef<number>();
  const [documnetVisible, setDocumnetVisible] = useState(false);
  const [pdfData, setPdfData] = useState<LicenseDetail>({} as LicenseDetail);
  const [compactFilterVisible, setCompactFilterVisible] = useState(false);
  const [compactFilterValues, setCompactFilterValues] =
    useState<CompactPermitFilterValues>({});

  useEffect(() => {
    statistics();
    getCertificateStatus().then((res) => {
      if (res.data) {
        setCertificateStatus(res.data);
      }
    });
  }, []);

  const query = useCallback((params: LicenseManagementListRequestDto) => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    const reqParams = {
      ...params,
      department: 2,
    };
    return getLicenseManagementList(reqParams).then((res) => {
      if (requestId !== listRequestIdRef.current) return;

      const responseData = res.data;
      if (
        !Array.isArray(responseData?.items) ||
        typeof responseData?.total !== "number" ||
        !Number.isFinite(responseData.total) ||
        responseData.total < 0
      ) {
        return;
      }

      setTableData(responseData.items);
      setPage((previous) =>
        previous.total === responseData.total
          ? previous
          : { ...previous, total: responseData.total },
      );
    });
  }, []);

  useEffect(() => {
    const formData = form.getFieldsValue();
    const [issuanceDateStart, issuanceDateEnd] = transformDate(
      formData?.timeIssuance,
    );
    void query({
      keyword: formData?.searchValue,
      status: formData?.typeFilter,
      issuanceDateStart,
      issuanceDateEnd,
      pageIndex: 1,
      pageSize: 10,
    });

    return () => {
      listRequestIdRef.current += 1;
      window.clearTimeout(searchTimerRef.current);
    };
  }, [form, query]);

  useKeepAliveActivated({
    onActivated: () => {
      statistics();
      const formData = form.getFieldsValue();
      const [issuanceDateStart, issuanceDateEnd] = transformDate(
        formData?.timeIssuance
      );
      query({
        keyword: formData?.searchValue,
        status: formData?.typeFilter,
        issuanceDateStart,
        issuanceDateEnd,
        pageIndex: page.current,
        pageSize: page.pageSize,
        ...sort,
      });
    },
  });

  const statistics = () => {
    getStatistics(undefined, undefined, 2).then((res) => {
      if (res.data) {
        setStatisticsData(res.data);
      }
    });
  };

  const exportLiscense = () => {
    const formData = form.getFieldsValue();
    const [issuanceDateStart, issuanceDateEnd] = transformDate(
      formData?.timeIssuance
    );
    exportLicensePermits({
      keyword: formData?.searchValue,
      status: formData?.typeFilter,
      issuanceDateStart,
      issuanceDateEnd,
      pageIndex: page.current,
      pageSize: page.pageSize,
      ...sort,
    })
    .then((res) => {
      exportCSVFile(res, `Licenses_${moment().format("DDMMYYYY_HHmmss")}.csv`)
      setExportLoading(false)
    })
    .finally(() => {
      setExportLoading(false)
    })
  }

  // The filter modal edits these two fields, so the badge counts them.
  const issuanceFilterValue = Form.useWatch("timeIssuance", form);
  const typeFilterValue = Form.useWatch("typeFilter", form);
  const appliedFilterCount = countAppliedFilters([
    issuanceFilterValue,
    typeFilterValue,
  ]);

  const openCompactFilter = () => {
    const values = form.getFieldsValue(["timeIssuance", "typeFilter"]);
    setCompactFilterValues(values);
    setCompactFilterVisible(true);
  };

  const updateCompactFilter = (
    name: keyof CompactPermitFilterValues,
    value: CompactPermitFilterValues[keyof CompactPermitFilterValues],
  ) => {
    const values = { ...compactFilterValues, [name]: value };
    setCompactFilterValues(values);
  };

  const applyCompactFilter = () => {
    const values = compactFilterValues;
    const formData = { ...form.getFieldsValue(), ...values };
    const [issuanceDateStart, issuanceDateEnd] = transformDate(
      formData.timeIssuance,
    );

    form.setFieldsValue(values);
    window.clearTimeout(searchTimerRef.current);
    setPage((previous) => ({ ...previous, current: 1 }));
    void query({
      keyword: formData.searchValue,
      status: formData.typeFilter,
      issuanceDateStart,
      issuanceDateEnd,
      pageIndex: 1,
      pageSize: page.pageSize,
      ...sort,
    });
    setCompactFilterVisible(false);
  };

  const resetFilters = () => {
    window.clearTimeout(searchTimerRef.current);
    form.resetFields(["searchValue", "timeIssuance", "typeFilter"]);
    setCompactFilterValues({});
    setPage((previous) => ({ ...previous, current: 1 }));
    void query({
      keyword: undefined,
      status: undefined,
      issuanceDateStart: undefined,
      issuanceDateEnd: undefined,
      pageIndex: 1,
      pageSize: page.pageSize,
      ...sort,
    });
  };

  const permitActionColumnWidth = useResponsiveActionColumnWidth<
    LicenseManagementListResponseDto,
    PermitActionColumnKey
  >({
    rows: tableData,
    buttonWidthMap: PERMIT_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (row) => {
      const actions: PermitActionColumnKey[] = ["preview"];

      if (row.status === "201") {
        actions.push("disable");
      }

      if (row.status === "204") {
        actions.push("enable");
      }

      return actions;
    },
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "preview":
          return t("Content.permits.actions.preview", "Preview");
        case "disable":
          return t("Content.permits.actions.disable");
        case "enable":
          return t("Content.permits.actions.enable");
        default:
          return undefined;
      }
    },
    desktopConfig: PERMIT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: PERMIT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: PERMIT_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const ColumnData: Array<object> = [
    {
      // title: t("serviceConfiguration.table.requestId"),
      title: t("Content.permits.table.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
    },
    {
      // title: t("serviceConfiguration.table.type"),
      title: t("Content.permits.table.licenseNo"),
      dataIndex: "licenseNumber",
      key: "licenseNumber",
    },
    {
      // title: t("serviceConfiguration.table.license"),
      title: t("Content.permits.table.license"),
      dataIndex: "licenseType",
      key: "licenseType",
    },
    {
      title: t("Content.permits.table.title"),
      dataIndex: "title",
      key: "title",
      width: 120,
      onHeaderCell: () => ({ style: { whiteSpace: "normal" } }),
      render: (text: string | null | undefined) =>
      text ? (
        <OverflowTooltip
        className="permit-ellipsis-cell"
        placement="topLeft"
        title={text}
        >
        {text}
        </OverflowTooltip>
      ) : (
        "-"
      ),
    },
    {
      title: t("Content.permits.table.authorOrPublishingHouse"),
      dataIndex: "authorOrPublishingHouse",
      key: "authorOrPublishingHouse",
      width: 220,
      onHeaderCell: () => ({ style: { whiteSpace: "normal" } }),
      render: (text: string | null | undefined) =>
      text ? (
        <OverflowTooltip
        className="permit-ellipsis-cell"
        placement="topLeft"
        title={text}
        >
        {text}
        </OverflowTooltip>
      ) : (
        "-"
      ),
    },
    {
      // title: t("serviceConfiguration.table.applicant"),
      title: t("Content.permits.table.applyFor"),
        dataIndex: "applicant",
        key: "applicant",
        render: (text: string, row: LicenseManagementListResponseDto) => {
          return (
            <div className="permit-applicant">
              {row?.applicantType === "Person" ? (
                <img className="permit-applicant__icon" src={UnionTable} alt="" />
              ) : (
                <img className="permit-applicant__icon" src={enterprise} alt="" />
              )}
              {text}
            </div>
          );
        },
    },
    {
      // title: t("serviceConfiguration.table.status"),
      title: t("Content.permits.table.status"),
      dataIndex: "status",
      key: "status",
      render: (text: string) => {
        return <CustomStatusTag type="licenseStatus" status={Number(text)} />;
      },
    },
    {
      // title: t("serviceConfiguration.table.ubmitted"),
      title: t("Content.permits.table.effectiveDate"),
      dataIndex: "issuanceTime",
      key: "issuanceTime",
      sorter: true,
      render: (text: string) => {
        return moment(text).format("DD/MM/YYYY");
      },
    },
    {
      // title: t("serviceConfiguration.table.priiority"),
      title: t("Content.permits.table.expirationDate"),
      dataIndex: "expirationTime",
      key: "expirationTime",
      sorter: true,
      render: (text: string | null) => {
        return fmt(text, DISPLAY_DATE);
      },
    },

    {
      // title: t("serviceConfiguration.table.actions"),
      title: t("Content.permits.table.actions"),
      dataIndex: "actions",
      key: "actions",
      // Design: keep actions reachable while the table scrolls sideways.
      fixed: "right" as const,
      width: permitActionColumnWidth,
      render: (_: unknown, row: LicenseManagementListResponseDto) => {
        return (
          <div className="_actions">
            {/* <a onClick={(e) => {
              e.stopPropagation()
              setRowData(row)
              setFileVisible(true)
            // history.push('/licensedatails')
            }}>Preview</a> */}
            {/* <CustomButton
            variant="text"
            onClick={() => {
              setRowData(row)
              setFileVisible(true)
              // history.push('/licensedatails')
            }}>
            Download
          </CustomButton> */}
            <a
              onClick={(e) => {
                e.stopPropagation();
                getLicenseManagementDetails(`${row.id}`).then((res) => {
                  if (res.data) {
                    setPdfData(res.data);
                    setDocumnetVisible(true);
                  }
                }).catch(() => {
                  CustomMessage.error(t("Content.permits.messages.previewPermissionDenied"));
                });
              }}
            >
              {t("Content.permits.actions.preview", "Preview")}
            </a>
            {row.status === "201" && (
              <PermissionGuard
                permissionCode="Content.Permits.Confirm"
                routePath="/content/Permits"
              >
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                    setRowData(row);
                    setDisableVisible(true);
                  }}
                >
                  {t("Content.permits.actions.disable")}
                </a>
              </PermissionGuard>
            )}
            {row.status === "204" && (
              <PermissionGuard
                permissionCode="Content.Permits.Confirm"
                routePath="/content/Permits"
              >
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                    modal.confirm({
                      centered: true,
                      className: "enable-license",
                      width: 600,
                      title: (
                        <div>{t("Content.permits.modals.enableTitle")}</div>
                      ),
                      content: (
                        <div>{t("Content.permits.modals.enableConfirm")}</div>
                      ),
                      okText: t("common.confirm"),
                      onOk: async () => {
                        const res = await postUpdateCertificateStatus({
                          certificateId: row.id,
                          status: "201",
                        });
                        if (res.data) {
                          const formData = form.getFieldsValue();
                          const [issuanceDateStart, issuanceDateEnd] =
                            transformDate(formData?.timeIssuance);
                          query({
                            keyword: formData?.searchValue,
                            status: formData?.typeFilter,
                            issuanceDateStart,
                            issuanceDateEnd,
                            pageIndex: page.current,
                            pageSize: page.pageSize,
                            ...sort,
                          });
                          CustomMessage.success(
                            t("Content.permits.messages.enableSuccess")
                          );
                        } else {
                          CustomMessage.error(
                            t("Content.permits.messages.enableFailed")
                          );
                        }
                      },
                    });
                  }}
                >
                  {t("Content.permits.actions.enable")}
                </a>
              </PermissionGuard>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={`license-container permits-container${isArabic ? " license-container--rtl" : ""}`}>
      {/* <ProcessDesign /> */}
      <div className="stat-cards-grid">
        <Card key={0} className="stat-card">
          <div className="stat-icon _bg-active">
            <img src={MenuIcon} alt="" />
          </div>

          <div className="stat-content">
            <div className="stat-value">{statisticsData.total || 0}</div>
            <div className="stat-label">{t("license.stats.total")}</div>
          </div>
        </Card>
        {statusData.map((card) => (
          <Card key={0} className="stat-card">
            <div className={`stat-icon ${card.bgClass}`}>
              <img src={card.icon} alt="" />
            </div>

            <div className="stat-content">
              <div className="stat-value">
                {statisticsData[card.value] || 0}
              </div>
              <div className="stat-label">{t(`Content.permits.stats.${card.value}`)}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="table-card">
        <div className="table-toolbar filters responsive-filter-toolbar permits-filter-toolbar">
          <Form
            form={form}
            className="responsive-filter-toolbar__controls permits-filter-toolbar__controls"
            onValuesChange={(changedValues) => {
                window.clearTimeout(searchTimerRef.current);
                const formData = form.getFieldsValue();
                const [issuanceDateStart, issuanceDateEnd] = transformDate(
                  formData?.timeIssuance
                );
                if (
                  Object.prototype.hasOwnProperty.call(
                    changedValues,
                    "searchValue"
                  )
                ) {
                  searchTimerRef.current = window.setTimeout(() => {
                    setPage((previous) => ({ ...previous, current: 1 }));
                    void query({
                      keyword: formData?.searchValue,
                      status: formData?.typeFilter,
                      issuanceDateStart,
                      issuanceDateEnd,
                      pageIndex: 1,
                      pageSize: page.pageSize,
                      ...sort,
                    });
                  }, 500);
                } else {
                  setPage((previous) => ({ ...previous, current: 1 }));
                  void query({
                    keyword: formData?.searchValue,
                    status: formData?.typeFilter,
                    issuanceDateStart,
                    issuanceDateEnd,
                    pageIndex: 1,
                    pageSize: page.pageSize,
                    ...sort,
                  });
                }
              }}
          >
            <Form.Item
              name="searchValue"
              className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search permits-filter-toolbar__field permits-filter-toolbar__field--search"
            >
              <Input
                placeholder={t("common.search")}
                prefix={<Sousuo className="search-icon" />}
                className="search-input"
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="timeIssuance"
              className="responsive-filter-toolbar__field permits-filter-toolbar__field permits-filter-toolbar__field--range permits-filter-toolbar__field--secondary"
            >
              <RangePicker
                placeholder={[
                  t("Content.permits.filters.effectiveStartDate"),
                  t("Content.permits.filters.effectiveEndDate"),
                ]}
                className="search-RangePicker"
              />
            </Form.Item>
            <Form.Item
              name="typeFilter"
              className="responsive-filter-toolbar__field permits-filter-toolbar__field permits-filter-toolbar__field--select permits-filter-toolbar__field--secondary"
            >
              <Select
                placeholder={t("Content.permits.filters.allStatuses")}
                allowClear
                getPopupContainer={(triggerNode) => triggerNode.parentNode}
              >
                {certificateStatus.map((item) => {
                  return (
                    <Option key={item.code} value={item.code}>
                      {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
            <CustomButton
              customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button permits-filter-toolbar__filter-button filter-trigger-with-count"
              variant="outline"
              onClick={openCompactFilter}
            >
              {t("common.filter")}
              <img className="filter-trigger-funnel" src={SortIcon} alt="" />
              <FilterCountBadge count={appliedFilterCount} />
            </CustomButton>
            <CustomButton
              text={t("common.reset")}
              customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button permits-filter-toolbar__reset-button"
              variant="outline"
              onClick={resetFilters}
            />
          </Form>
          <div className="responsive-filter-toolbar__action permits-filter-toolbar__action">
            <CustomButton
              text={t("serviceConfiguration.filters.export")}
              customClassName="table-header-btn permits-filter-toolbar__export-button"
              variant="outline"
              iconPosition="right"
              loading={exportLoading}
              onClick={exportLiscense}
              disabled={!tableData.length || page.total === 0}
              permissionCode="Content.Permits.Export"
              permissionRoutePath="/content/Permits"
            />
          </div>
        </div>
        <ResponsiveFilterModal
          visible={compactFilterVisible}
          onCancel={() => setCompactFilterVisible(false)}
          onApply={applyCompactFilter}
          fields={[
            {
              key: "timeIssuance",
              label: t("Content.permits.table.effectiveDate"),
              element: (
                <RangePicker
                  className="search-RangePicker"
                  placeholder={[
                    t("Content.permits.filters.effectiveStartDate"),
                    t("Content.permits.filters.effectiveEndDate"),
                  ]}
                  value={compactFilterValues.timeIssuance}
                  onChange={(value) =>
                    updateCompactFilter("timeIssuance", value)
                  }
                />
              ),
            },
            {
              key: "typeFilter",
              label: t("Content.permits.table.status"),
              element: (
                <Select
                  placeholder={t("Content.permits.filters.allStatuses")}
                  allowClear
                  value={compactFilterValues.typeFilter}
                  onChange={(value) => updateCompactFilter("typeFilter", value)}
                >
                  {certificateStatus.map((item) => {
                    return (
                      <Option key={item.code} value={item.code}>
                        {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                      </Option>
                    );
                  })}
                </Select>
              ),
            },
          ]}
        />

        <Table
        columns={ColumnData}
        className="admin-table"
        scroll={{ x: 1800 }}
        onChange={(pagination, _filters, sorter, extra) => {
            window.clearTimeout(searchTimerRef.current);
            const isSortAction = extra.action === "sort";
            const nextPage = {
              current: isSortAction ? 1 : pagination.current ?? page.current,
              pageSize: pagination.pageSize ?? page.pageSize,
            };
            let nextSort = sort;

            if (isSortAction) {
              const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
              const field = currentSorter?.field;
              nextSort =
                typeof field === "string" && currentSorter?.order
                  ? {
                      sortBy: field,
                      sortDirection: currentSorter.order === "ascend" ? 0 : 1,
                    }
                  : null;
              setSort(nextSort);
            }

            setPage((previous) => ({ ...previous, ...nextPage }));

            const formData = form.getFieldsValue();
            const [issuanceDateStart, issuanceDateEnd] = transformDate(
              formData?.timeIssuance,
            );
            void query({
              keyword: formData?.searchValue,
              status: formData?.typeFilter,
              issuanceDateStart,
              issuanceDateEnd,
              pageIndex: nextPage.current,
              pageSize: nextPage.pageSize,
              ...nextSort,
            });
          }}
          pagination={{
            size: "default",
            position: ["bottomCenter"],
            showSizeChanger: true,
            showTotal: (total) => (
              <PaginationTotal
                label={t("common.total")}
                total={total}
                current={page.current}
                pageSize={page.pageSize}
              />
            ),
            pageSizeOptions: ["10", "20", "50", "100"],
            ...page,
          }}
          dataSource={tableData}
          onRow={(record) => ({
            onClick: () => {
              history.push(
                `/content/Permits/PermitsDetails?code=${record.id}`
              );
            },
          })}
        />
      </Card>
      <DocumentDown
        visible={documnetVisible}
        fileName={pdfData.licenseType}
        url={pdfData.certificateUrl}
        password={pdfData.certificatePassword}
        cancle={() => {
          setDocumnetVisible(false);
        }}
      />
      <DisableLicenseModal
        visible={disableVisible}
        cencelFun={() => {
          setDisableVisible(false);
        }}
        row={rowData}
        onOk={() => {
          const formData = form.getFieldsValue();
          const [issuanceDateStart, issuanceDateEnd] = transformDate(
            formData?.timeIssuance
          );
          query({
            keyword: formData?.searchValue,
            status: formData?.typeFilter,
            issuanceDateStart,
            issuanceDateEnd,
            pageIndex: page.current,
            pageSize: page.pageSize,
            ...sort,
          });
        }}
      />
      <FilePassword
        visible={fileVisible}
        cencelFun={() => {
          setFileVisible(false);
        }}
        src={rowData.src}
      />
      {contextHolder}
    </div>
  );
}
