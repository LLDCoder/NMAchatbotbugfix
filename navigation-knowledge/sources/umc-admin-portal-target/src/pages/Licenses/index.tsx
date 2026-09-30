import { DISPLAY_DATE, fmt, msUntil } from "@/utils/gstTime";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Table, Input, Select, Form, Row, DatePicker, Modal, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import MenuIcon from "@/assets/images/menu.png";
import {
  ConfirmModal,
  CustomButton,
  CustomMessage,
  PaginationTotal,
  PermissionGuard,
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
import Sousuo from "@/assets/icons/Sousuo";
import {
  getLicenseManagementDetails,
  getLicenseManagementList,
  getStatistics,
  postUpdateCertificateStatus,
  exportLicensePermits,
} from "@/services/license";
import type {
  LicenseDetail,
  LicenseManagementListRequestDto,
  LicenseManagementListResponseDto,
  StatisticsResponseDto,
} from "@/services/license";

import SortIcon from "@/assets/images/sort.png";
import moment from "moment";
import "@/components/common/FilterTable/index.less";
import "./index.less";
import { transformDate } from "@/utils/transform";
import { getCertificateStatus, type IDict } from "@/services/dictionary";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import LicenseDownloadPasswordModal from "./components/LicenseDownloadPasswordModal";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { exportCSVFile } from "@/utils/utils";

const { Option } = Select;
const { RangePicker } = DatePicker;
type LicenseActionColumnKey = "download" | "disable" | "enable";

const LICENSE_ACTION_COLUMN_BASE_SCROLL_X = 1260;
const LICENSE_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<LicenseActionColumnKey> =
  {
    download: {
      default: 76,
      compact: 67,
    },
    disable: {
      default: 67,
      compact: 59,
    },
    enable: {
      default: 56,
      compact: 50,
    },
  };
const LICENSE_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 192,
};
const LICENSE_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 176,
};
const LICENSE_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

export default function License() {
  const [form] = Form.useForm();
  const [filterModalForm] = Form.useForm();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterModalDirty, setFilterModalDirty] = useState(false);
  const { i18n, t } = useTranslation();
  const [exportLoading, setExportLoading] = useState(false);
  const [disableVisible, setDisableVisible] = useState(false as boolean);
  const [enableVisible, setEnableVisible] = useState(false);
  const [enableLoading, setEnableLoading] = useState(false);
  const [fileVisible, setFileVisible] = useState(false as boolean);
  const [rowData, setRowData] = useState(
    {} as LicenseManagementListResponseDto,
  );
  const [tableData, setTableData] = useState(
    [] as LicenseManagementListResponseDto[],
  );
  const [statisticsData, setStatisticsData] = useState(
    {} as StatisticsResponseDto,
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
      department: 1,
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
        formData?.timeIssuance,
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
    getStatistics(undefined, undefined, 1).then((res) => {
      if (res.data) {
        setStatisticsData(res.data);
      }
    });
  };

  const handleEnableConfirm = async () => {
    if (enableLoading) return;
    if (!rowData?.id) {
      setEnableVisible(false);
      return;
    }
    setEnableLoading(true);
    try {
      const res = await postUpdateCertificateStatus({
        certificateId: rowData.id,
        status: "201",
      });
      if (res.data) {
        const formData = form.getFieldsValue();
        const [issuanceDateStart, issuanceDateEnd] = transformDate(
          formData?.timeIssuance,
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
        CustomMessage.success(t("Licensing.messages.enableSuccess"));
        setEnableVisible(false);
      } else {
        CustomMessage.error(t("Licensing.messages.enableFailed"));
      }
    } catch {
      CustomMessage.error(t("Licensing.messages.enableFailed"));
    } finally {
      setEnableLoading(false);
    }
  };


  const exportLiscense = () => {
    const formData = form.getFieldsValue();
    const [issuanceDateStart, issuanceDateEnd] = transformDate(
      formData?.timeIssuance,
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
        exportCSVFile(
          res,
          `Licenses_${moment().format("DDMMYYYY_HHmmss")}.csv`,
        );
        setExportLoading(false);
      })
      .finally(() => {
        setExportLoading(false);
      });
  };

  // The filter modal edits these two fields, so the badge counts them.
  const issuanceFilterValue = Form.useWatch("timeIssuance", form);
  const typeFilterValue = Form.useWatch("typeFilter", form);
  const appliedFilterCount = countAppliedFilters([
    issuanceFilterValue,
    typeFilterValue,
  ]);

  const handleOpenFilterModal = () => {
    filterModalForm.setFieldsValue({
      timeIssuance: form.getFieldValue("timeIssuance"),
      typeFilter: form.getFieldValue("typeFilter"),
    });
    setFilterModalDirty(false);
    setFilterModalVisible(true);
  };

  const handleCancelFilterModal = () => {
    setFilterModalVisible(false);
    setFilterModalDirty(false);
  };

  const handleApplyFilterModal = () => {
    const modalValues = filterModalForm.getFieldsValue();
    const formData = {
      ...form.getFieldsValue(),
      ...modalValues,
    };
    form.setFieldsValue(modalValues);
    const [issuanceDateStart, issuanceDateEnd] = transformDate(
      formData.timeIssuance,
    );
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
    setFilterModalVisible(false);
    setFilterModalDirty(false);
  };

  const handleResetFilters = () => {
    window.clearTimeout(searchTimerRef.current);
    form.resetFields(["searchValue", "timeIssuance", "typeFilter"]);
    filterModalForm.resetFields(["timeIssuance", "typeFilter"]);
    setFilterModalDirty(false);
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

  const licenseActionColumnWidth = useResponsiveActionColumnWidth<
    LicenseManagementListResponseDto,
    LicenseActionColumnKey
  >({
    rows: tableData,
    buttonWidthMap: LICENSE_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (row) => {
      const actions: LicenseActionColumnKey[] = ["download"];

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
        case "download":
          return t("Licensing.rowActions.download");
        case "disable":
          return t("Licensing.rowActions.disable");
        case "enable":
          return t("Licensing.rowActions.enable");
        default:
          return undefined;
      }
    },
    desktopConfig: LICENSE_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: LICENSE_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: LICENSE_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const ColumnData: ColumnsType<LicenseManagementListResponseDto> = [
    {
      title: t("Licensing.table.licenseNo"),
      dataIndex: "showLicenseNumber",
      key: "licenseNumber",
      width: 140,
      // showLicenseNumber carries the media license number for the families that own one and falls
      // back to the certificate number for the rest.
      render: (text: string, row: LicenseManagementListResponseDto) =>
        text || row.licenseNumber,
    },
    {
      title: t("Licensing.table.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      width: 180,
    },
    {
      title: t("Licensing.table.license"),
      dataIndex: "licenseType",
      key: "licenseType",
      width: 260,
    },
    {
      title: t("Licensing.table.mediaActivity"),
      dataIndex: "mediaActivity",
      key: "mediaActivity",
      width: 260,
      // Backend joins every activity into one string; a few licences carry 30 of
      // them, so the cell truncates and defers the full text to the tooltip.
      ellipsis: { showTitle: false },
      render: (text?: string | null) => {
        const value = (text ?? "").trim() || "-";
        return (
          <Tooltip
            title={value}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
          >
            <span>{value}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t("Licensing.table.applyFor"),
      dataIndex: "applicant",
      key: "applicant",
      width: 240,
      render: (text: string, row: LicenseManagementListResponseDto) => {
        return (
          <div className="license-applicant-cell">
            {row?.applicantType === "Person" ? (
              <img
                className="license-applicant-cell__icon"
                src={UnionTable}
                alt=""
              />
            ) : (
              <img
                className="license-applicant-cell__icon"
                src={enterprise}
                alt=""
              />
            )}
            {text}
          </div>
        );
      },
    },
    {
      title: t("Licensing.table.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (text: string) => {
        return <CustomStatusTag type="licenseStatus" status={Number(text)} />;
      },
    },
    {
      title: t("Licensing.table.effectiveDate"),
      dataIndex: "issuanceTime",
      key: "issuanceTime",
      width: 160,
      sorter: true,
      render: (text: string) => {
        return moment(text).format("DD/MM/YYYY");
      },
    },
    {
      title: t("Licensing.table.expirationDate"),
      dataIndex: "expirationTime",
      key: "expirationTime",
      width: 160,
      sorter: true,
      render: (text: string | null) => {
        // Compare against the Dubai clock (backend sends Dubai wall-clock, no offset).
        const remaining = msUntil(text);
        const isExpired = remaining !== null && remaining < 0;
        return (
          <span className={isExpired ? "text-danger" : ""}>
            {fmt(text, DISPLAY_DATE)}
          </span>
        );
      },
    },

    {
      title: t("Licensing.table.actions"),
      dataIndex: "actions",
      key: "actions",
      // Design: keep actions reachable while the table scrolls sideways.
      width: licenseActionColumnWidth,
      fixed: "right",
      render: (_text, row) => {
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
                });
              }}
            >
              {t("Licensing.rowActions.download")}
            </a>
            {row.status === "201" && (
              <PermissionGuard
                permissionCode="Licensing.Licenses.Confirm"
                routePath="/licensing/licenses"
              >
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                    setRowData(row);
                    setDisableVisible(true);
                  }}
                >
                  {t("Licensing.rowActions.disable")}
                </a>
              </PermissionGuard>
            )}
            {row.status === "204" && (
              <PermissionGuard
                permissionCode="Licensing.Licenses.Confirm"
                routePath="/licensing/licenses"
              >
                <a
                onClick={(e) => {
                e.stopPropagation();
                setRowData(row);
                setEnableVisible(true);
                }}
                >
                {t("Licensing.rowActions.enable")}
                </a>
              </PermissionGuard>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="license-container license-container--scoped-toolbar">
      {/* <ProcessDesign /> */}
      <div className="stat-cards-grid">
        <Card key={0} className="stat-card">
          <div className="stat-icon _bg-active">
            <img src={MenuIcon} alt="" />
          </div>

          <div className="stat-content">
            <div className="stat-value">{statisticsData.total || 0}</div>
            <div className="stat-label">{t("Licensing.stats.total")}</div>
          </div>
        </Card>
        {statusData.map((card) => (
          <Card key={card.code} className="stat-card">
            <div className={`stat-icon ${card.bgClass}`}>
              <img src={card.icon} alt="" />
            </div>

            <div className="stat-content">
              <div className="stat-value">
                {statisticsData[card.value] || 0}
              </div>
              <div className="stat-label">{t(card.labelKey)}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filters">
            <Form
              form={form}
              onValuesChange={(changedValues) => {
                window.clearTimeout(searchTimerRef.current);
                const formData = form.getFieldsValue();
                const [issuanceDateStart, issuanceDateEnd] = transformDate(
                  formData?.timeIssuance,
                );
                if (
                  Object.prototype.hasOwnProperty.call(
                    changedValues,
                    "searchValue",
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
              <Row
                className="container-row responsive-filter-toolbar licenses-filter-toolbar"
                // gutter={[16, 16]}
              >
                {/* <Col span={6}> */}
                <div className="filters-container responsive-filter-toolbar__controls licenses-filter-toolbar__controls">
                  <Form.Item
                    name="searchValue"
                    className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search licenses-filter-toolbar__field licenses-filter-toolbar__field--search"
                  >
                    <Input
                      placeholder={t("common.search")}
                      prefix={<Sousuo className="search-icon" />}
                      className="search-input"
                      allowClear
                    />
                  </Form.Item>
                  {/* </Col> */}
                  {/* <Col span={5}> */}
                  <Form.Item
                    name="timeIssuance"
                    className="responsive-filter-toolbar__field responsive-filter-toolbar__field--range licenses-filter-toolbar__field licenses-filter-toolbar__field--range licenses-filter-toolbar__field--secondary"
                  >
                    <RangePicker
                      placeholder={[
                        t("Licensing.filters.effectiveStartDate"),
                        t("Licensing.filters.effectiveEndDate"),
                      ]}
                      // prefix={<Sousuo className="search-icon" />}
                      className="search-RangePicker"
                    />
                  </Form.Item>
                  {/* </Col> */}

                  {/* <Col span={4}> */}
                  <Form.Item
                    name="typeFilter"
                    className="responsive-filter-toolbar__field responsive-filter-toolbar__field--select licenses-filter-toolbar__field licenses-filter-toolbar__field--select licenses-filter-toolbar__field--secondary"
                  >
                    <Select
                      placeholder={t("Licensing.filters.allStatuses")}
                      allowClear
                      getPopupContainer={(triggerNode) =>
                        triggerNode.parentNode
                      }
                    >
                      <Option value="">
                        {t("Licensing.filters.allStatuses")}
                      </Option>
                      {certificateStatus.map((item) => {
                        return (
                          <Option key={item.code} value={item.code}>
                            {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                  {/* </Col> */}
                  <CustomButton
                    variant="outline"
                    customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__filter-button licenses-filter-toolbar__filter-button filter-trigger-with-count"
                    onClick={handleOpenFilterModal}
                  >
                    {t("common.filter")}
                    <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                    <FilterCountBadge count={appliedFilterCount} />
                  </CustomButton>
                  <CustomButton
                    text={t("common.reset")}
                    variant="outline"
                    customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__reset-button licenses-filter-toolbar__reset-button"
                    onClick={handleResetFilters}
                  />
                </div>

                {/* <Col span={5} style={{ display: 'flex', justifyContent: 'flex-end' }}> */}
                <div className="responsive-filter-toolbar__action licenses-filter-toolbar__action">
                  <CustomButton
                    text={t("Licensing.export")}
                    customClassName="table-header-btn"
                    variant="outline"
                    iconPosition="right"
                    loading={exportLoading}
                    onClick={exportLiscense}
                    disabled={!tableData.length || page.total === 0}
                    permissionCode="Licensing.Licenses.Export"
                    permissionRoutePath="/licensing/licenses"
                  />
                </div>
                {/* </Col> */}
              </Row>
            </Form>
          </div>
        </div>

        <Table
          columns={ColumnData}
          className="admin-table"
          scroll={{ x: LICENSE_ACTION_COLUMN_BASE_SCROLL_X + licenseActionColumnWidth }}
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
                `/licensing/license/licenseDatails?code=${record.id}`,
                // Same number the row shows, so the detail header does not flip to the
                // certificate number when the license owns a media-license shell.
                {
                  licenseNumber:
                    record.showLicenseNumber || record.licenseNumber,
                },
              );
            },
          })}
        />
      </Card>
      <Form
        form={filterModalForm}
        component={false}
        onValuesChange={() => setFilterModalDirty(true)}
      >
        <Modal
          title={t("common.filter")}
          visible={filterModalVisible}
          onCancel={handleCancelFilterModal}
          width={960}
          centered
          footer={(
            <div className="filter-modal-footer">
              <div className="filter-modal-footer-actions">
                <CustomButton
                  variant="outline"
                  customClassName="filter-modal-cancel-btn"
                  onClick={handleCancelFilterModal}
                >
                  {t("common.cancel")}
                </CustomButton>
                <CustomButton
                  type="default"
                  variant="primary"
                  customClassName={`filter-modal-apply-btn ${
                    filterModalDirty ? "filter-modal-apply-btn-active" : ""
                  }`}
                  disabled={!filterModalDirty}
                  onClick={handleApplyFilterModal}
                >
                  {t("common.apply")}
                </CustomButton>
              </div>
            </div>
          )}
          className="filter-modal"
        >
          <div className="filter-modal-content">
            <div className="filter-modal-item">
              <div className="filter-modal-item-label">
                {t("Licensing.table.effectiveDate")}
              </div>
              <Form.Item name="timeIssuance" noStyle>
                <RangePicker
                  placeholder={[
                    t("Licensing.filters.effectiveStartDate"),
                    t("Licensing.filters.effectiveEndDate"),
                  ]}
                />
              </Form.Item>
            </div>
            <div className="filter-modal-item">
              <div className="filter-modal-item-label">
                {t("Licensing.table.status")}
              </div>
              <Form.Item name="typeFilter" noStyle>
                <Select
                  placeholder={t("Licensing.filters.allStatuses")}
                  allowClear
                  getPopupContainer={(triggerNode) => triggerNode.parentNode}
                >
                  <Option value="">
                    {t("Licensing.filters.allStatuses")}
                  </Option>
                  {certificateStatus.map((item) => (
                    <Option key={item.code} value={item.code}>
                      {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
          </div>
        </Modal>
      </Form>
      <LicenseDownloadPasswordModal
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
            formData?.timeIssuance,
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
      <ConfirmModal
        visible={enableVisible}
        width={600}
        title={t("Licensing.modal.enableTitle")}
        content={t("Licensing.modal.enableContent")}
        cancelText={t("Licensing.modal.cancel")}
        confirmText={t("Licensing.modal.confirm")}
        loading={enableLoading}
        onCancel={() => {
          setEnableVisible(false);
        }}
        onConfirm={handleEnableConfirm}
      />
    </div>
  );
}
