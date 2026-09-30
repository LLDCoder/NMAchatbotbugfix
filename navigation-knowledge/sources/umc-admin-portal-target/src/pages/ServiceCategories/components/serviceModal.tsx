import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Input, Pagination, Tag, Tooltip } from "antd";
import { CustomButton, PaginationTotal } from "@/components/common";
import SearchIcon from "@/assets/icons/SearchIcon";
import { ArrowRightOutlined } from "@ant-design/icons";
import { getServicesToPageByCategory } from "@/services/serviceApi";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getServiceConfigStatus, type IDict } from "@/services/dictionary";

interface ServiceModalProps {
  show: boolean;
  close: () => void;
  id: string;
  title?: string;
}

interface ServiceItem {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  status: string;
}

const ADD_NEW_SERVICE_PATH =
  "/service-management/service-configuration/addnewservice";

const ServiceModal: React.FC<ServiceModalProps> = ({
  show,
  close,
  id,
  title,
}) => {
  const history = useHistory();
  const { t, i18n } = useTranslation();
  const [list, setList] = useState<ServiceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [serviceConfigStatus, setServiceConfigStatus] = useState<IDict[]>([]);
  const listRequestIdRef = useRef(0);
  const [queryParam, setQueryParam] = useState({
    pageIndex: 1,
    pageSize: 10,
    search: "",
  });

  const resolvedTitle =
    title?.trim() || t("serviceCategories.serviceModal.title");

  const buildNavigationState = () => ({
    backPath: history.location.pathname || "",
    backSearch: history.location.search || "",
  });

  const navigateToServiceDetail = (item: ServiceItem) => {
    const navigationState = buildNavigationState();
    const serviceCode = String(item?.code ?? "").trim();
    const serviceId = String(item?.id ?? "").trim();

    if (!serviceCode || !serviceId) {
      return;
    }

    if (item.status === "5") {
      history.push(
        `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.viewService&serviceCode=${serviceCode}&id=${serviceId}&view=1`,
        navigationState,
      );
      return;
    }

    history.push(
      `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.configureService&serviceCode=${serviceCode}&id=${serviceId}`,
      navigationState,
    );
  };

  const getList = useCallback(async () => {
    if (!id) {
      setList([]);
      setTotal(0);
      return;
    }

    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;

    try {
      const res = await getServicesToPageByCategory({
        ...queryParam,
        ServiceCategoryId: id,
      });
      if (requestId !== listRequestIdRef.current) return;

      setList(Array.isArray(res?.data?.items) ? res.data.items : []);
      setTotal(Number(res?.data?.totalItems) || 0);
    } catch (error) {
      if (requestId !== listRequestIdRef.current) return;
      setList([]);
      setTotal(0);
    }
  }, [id, queryParam]);

  useEffect(() => {
    if (id) {
      getList();
    }
  }, [id, getList]);

  useEffect(() => {
    let isMounted = true;

    const fetchServiceConfigStatus = async () => {
      try {
        const res = await getServiceConfigStatus();
        if (!isMounted) return;
        setServiceConfigStatus(Array.isArray(res?.data) ? res.data : []);
      } catch (error) {
        if (!isMounted) return;
        setServiceConfigStatus([]);
      }
    };

    fetchServiceConfigStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCancel = () => {
    close();
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "#F8F7F4";

    const colors: { [key: string]: string } = {
      Suspended: "#FEF2F2",
      Draft: "#E1E3E580",
      Published: "#F3FAF4",
      "Pre-published": "#FFFBEB",
    };

    return colors[status] || "#F8F7F4";
  };

  const getStatusTextColor = (status: string | undefined) => {
    if (!status) return "#F8F7F4";

    const colors: { [key: string]: string } = {
      Suspended: "#EA4F49",
      Draft: "#5F646D",
      Published: "#4A9D5C",
      "Pre-published": "#F29F0E",
    };

    return colors[status] || "#999";
  };

  const services = list.map((item) => {
    const currentStatus = serviceConfigStatus.find(
      (status) => status.code === item.status
    );
    const currentStatusNameEn = currentStatus?.nameEn;
    const currentStatusNameAr = currentStatus?.nameAr;

    return (
      <div
        className="service-item"
        key={item.id}
        onClick={() => navigateToServiceDetail(item)}
      >
        <div>
          <Tooltip title={i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}>
            <div className="service-name">
              {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
            </div>
          </Tooltip>
          <Tag
            style={{
              backgroundColor: getStatusColor(currentStatusNameEn),
              color: getStatusTextColor(currentStatusNameEn),
              border: "none",
            }}
            className="status-tag"
          >
            {i18n.resolvedLanguage === "ar" ? currentStatusNameAr : currentStatusNameEn}
          </Tag>
        </div>
        <ArrowRightOutlined
          className="arrow-name"
          style={{ color: "#92722A" }}
        />
      </div>
    );
  });

  const onClose = () => {
    listRequestIdRef.current += 1;
    setQueryParam({
      pageIndex: 1,
      pageSize: 10,
      search: "",
    });
    setList([]);
    setTotal(0);
  };

  return (
    <Modal
      centered
      width={960}
      wrapClassName={`service-modal${
        i18n.resolvedLanguage === "ar" ? " service-modal--rtl" : ""
      }`}
      title={resolvedTitle}
      visible={show}
      onCancel={handleCancel}
      destroyOnClose
      afterClose={onClose}
      footer={
        <CustomButton
          text={t("common.close")}
          variant="primary"
          customClassName="footer-btn"
          onClick={handleCancel}
        />
      }
    >
      <div className="option_line">
        <div className="search_box">
          <Input
            size="large"
            placeholder={t("common.search")}
            prefix={<SearchIcon />}
            allowClear
            onChange={(e) =>
              setQueryParam({
                ...queryParam,
                search: e.target.value,
              })
            }
          />
        </div>
        <CustomButton
          text={t("serviceCategories.serviceModal.addNewService")}
          variant="outline"
          iconStyle={{ marginRight: "10px" }}
          onClick={() => {
            history.push(ADD_NEW_SERVICE_PATH, buildNavigationState());
          }}
        />
      </div>
      <div className="service-list">{services}</div>
      <div className="pagination-box">
        {list.length ? (
          <Pagination
            total={total}
            showSizeChanger
            showTotal={(totalValue) => (
              <PaginationTotal
                label={t("common.total")}
                total={totalValue}
                current={queryParam.pageIndex}
                pageSize={queryParam.pageSize}
              />
            )}
            current={queryParam.pageIndex}
            pageSize={queryParam.pageSize}
            onChange={(page, pageSize) => {
              setQueryParam({
                ...queryParam,
                pageIndex: page,
                pageSize,
              });
            }}
          />
        ) : null}
      </div>
    </Modal>
  );
};

export default ServiceModal;
