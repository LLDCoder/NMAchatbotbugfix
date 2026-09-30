import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Input, Button, InputNumber } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import Sousuo from "@/assets/icons/Sousuo";
import {
  getAllServices,
  saveServiceSort,
  updateServiceFeatured,
} from "@/services/serviceApi";
import "./index.less";
import StarIcon from "@/assets/images/star.png";
import { CustomMessage, PermissionGuard } from "@/components/common";

interface Service {
  id: number;
  order?: number;
  name: string;
  category: string;
  isFeatured: boolean;
}

interface ManagePriorityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (services: Service[]) => void;
}

const normalizeOrderValue = (value?: number | null) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(Math.trunc(numericValue), 0);
};

const sortByOrder = (first: Service, second: Service) =>
  normalizeOrderValue(first.order) - normalizeOrderValue(second.order);

const ManagePriorityModal: React.FC<ManagePriorityModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { t, i18n } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingServiceIds, setUpdatingServiceIds] = useState<number[]>([]);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllServices({
        pageIndex: 1,
        pageSize: 1000,
        search: "",
        status: "5",
      });
      const responseData: any = response?.data || {};

      const responseItems = Array.isArray(responseData.items)
        ? responseData.items
        : Array.isArray(responseData?.data?.items)
        ? responseData.data.items
        : [];

      if (responseItems.length > 0) {
        const publishedItems = responseItems.filter((item: any) => {
          const statusName = item.statusInfo
            ? (i18n.resolvedLanguage === "ar" ? item.statusInfo.nameAr : item.statusInfo.nameEn)
            : item.status;
          return statusName
          // statusName?.toLowerCase().includes("publish");
        });

        const formattedServices = publishedItems.map((item: any) => ({
          id: item.id,
          order: normalizeOrderValue(item.orderNum),
          name: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
          category:
            (i18n.resolvedLanguage === "ar"
              ? item.serviceCategories?.nameAr
              : item.serviceCategories?.nameEn) ||
            item.serviceCategoryId ||
            "",
          isFeatured: item.iscollect === true,
        }));
        setServices(formattedServices);
        return;
      }

      setServices([]);
    } catch (error) {
      console.error("Failed to fetch services:", error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [i18n.language]);

  useEffect(() => {
    if (visible) {
      fetchServices();
    }
  }, [fetchServices, visible]);


  const updateFeaturedStatus = useCallback(async (id: number, isFeatured: boolean) => {
    if (!id || updatingServiceIds.includes(id)) {
      return;
    }

    try {
      setUpdatingServiceIds((prev) => [...prev, id]);
      await updateServiceFeatured({
        id: id,
        isCollect: isFeatured,
      });

      setServices((prev) =>
        prev.map((service) =>
          service.id === id ? { ...service, isFeatured } : service
        )
      );

      CustomMessage.success(t("common.operationSuccess"));
    } catch (error) {
      CustomMessage.error(t("common.operationFailed"));
    } finally {
      setUpdatingServiceIds((prev) => prev.filter((serviceId) => serviceId !== id));
    }
  }, [t, updatingServiceIds]);

  const setAsStandard = useCallback(async (id: number) => {
    await updateFeaturedStatus(id, false);
  }, [updateFeaturedStatus]);

  const setAsFeatured = useCallback(async (id: number) => {
    await updateFeaturedStatus(id, true);
  }, [updateFeaturedStatus]);

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      const sortData = services.map((service) => ({
        id: service.id,
        orderNum: normalizeOrderValue(service.order),
      }));

      await saveServiceSort(sortData);

      CustomMessage.success(t("common.operationSuccess"));
      if (onSave) {
        onSave(services);
      }
      onClose();
    } catch (error) {
      CustomMessage.error(t("common.operationFailed"));
    } finally {
      setSaving(false);
    }
  }, [onClose, onSave, saving, services, t]);

  const handleOrderChange = useCallback((id: number, newOrder?: number | null) => {
    const normalizedOrder = normalizeOrderValue(newOrder);

    setServices((prev) => {
      const currentItem = prev.find((service) => service.id === id);
      if (!currentItem) {
        return prev;
      }

      const currentOrder = normalizeOrderValue(currentItem.order);
      if (currentOrder === normalizedOrder) {
        return prev;
      }

      const targetItem = prev.find(
        (service) =>
          service.id !== id &&
          service.isFeatured === currentItem.isFeatured &&
          normalizeOrderValue(service.order) === normalizedOrder
      );

      return prev.map((service) => {
        if (service.id === id) {
          return { ...service, order: normalizedOrder };
        }

        if (service.id === targetItem?.id) {
          return { ...service, order: currentOrder };
        }

        return service;
      });
    });
  }, []);

  const filteredServices = useMemo(() => services.filter((service) =>
    String(service.name || "").toLowerCase().includes(searchText.toLowerCase())
  ), [searchText, services]);

  const filteredFeatured = useMemo(
    () => filteredServices.filter((service) => service.isFeatured).sort(sortByOrder),
    [filteredServices]
  );
  const filteredStandard = useMemo(
    () => filteredServices.filter((service) => !service.isFeatured).sort(sortByOrder),
    [filteredServices]
  );

  const moveUp = useCallback((id: number, isFeatured: boolean) => {
    const targetList = isFeatured ? filteredFeatured : filteredStandard;
    const index = targetList.findIndex((s) => s.id === id);
    if (index > 0) {
      const prevItem = targetList[index - 1];
      const currentItem = targetList[index];
      if (prevItem && currentItem) {
        const nextOrder = normalizeOrderValue(prevItem.order);
        const currentOrder = normalizeOrderValue(currentItem.order);
        setServices((prev) =>
          prev.map((service) => {
            if (service.id === currentItem.id) {
              return { ...service, order: nextOrder };
            }

            if (service.id === prevItem.id) {
              return { ...service, order: currentOrder };
            }

            return service;
          })
        );
      }
    }
  }, [filteredFeatured, filteredStandard]);

  const moveDown = useCallback((id: number, isFeatured: boolean) => {
    const targetList = isFeatured ? filteredFeatured : filteredStandard;
    const index = targetList.findIndex((s) => s.id === id);
    if (index < targetList.length - 1) {
      const nextItem = targetList[index + 1];
      const currentItem = targetList[index];
      if (nextItem && currentItem) {
        const nextOrder = normalizeOrderValue(nextItem.order);
        const currentOrder = normalizeOrderValue(currentItem.order);
        setServices((prev) =>
          prev.map((service) => {
            if (service.id === currentItem.id) {
              return { ...service, order: nextOrder };
            }

            if (service.id === nextItem.id) {
              return { ...service, order: currentOrder };
            }

            return service;
          })
        );
      }
    }
  }, [filteredFeatured, filteredStandard]);

  const renderServiceRow = (
    service: Service,
    index: number,
    isFeatured: boolean
  ) => {
    const list = isFeatured ? filteredFeatured : filteredStandard;
    return (
      <div key={service.id} className="service-row">
        <div className="service-order">
          <InputNumber
            min={0}
            value={service.order}
            className="service-order-input"
            onChange={(value) => handleOrderChange(service.id, typeof value === "number" ? value : 0)}
          />
        </div>
        <div className="service-name">
          {isFeatured && <img src={StarIcon} />}
          {service.name}
        </div>
        <div className="service-category">{service.category}</div>
        <div className="service-actions">
          <Button
            type="text"
            icon={<ArrowUpOutlined />}
            disabled={index === 0 || saving || updatingServiceIds.includes(service.id)}
            onClick={() => moveUp(service.id, isFeatured)}
            className="action-btn"
          />
          <Button
            type="text"
            icon={<ArrowDownOutlined />}
            disabled={index === list.length - 1 || saving || updatingServiceIds.includes(service.id)}
            onClick={() => moveDown(service.id, isFeatured)}
            className="action-btn"
          />
          <PermissionGuard
            permissionCode="Service.ServiceConfiguration.UpdateServiceFeatured"
            routePath="/service-management/service-configuration"
          >
            <Button
              type="link"
              disabled={saving || updatingServiceIds.includes(service.id) || (!isFeatured && filteredFeatured.length >= 5)}
              onClick={() =>
                isFeatured ? setAsStandard(service.id) : setAsFeatured(service.id)
              }
              className={`set-as-btn ${!isFeatured && filteredFeatured.length >= 5 ? "set-as-btn-disabled" : ""}`}
            >
              {isFeatured
                ? t("serviceConfiguration.managePriority.actions.remove")
                : t("serviceConfiguration.managePriority.actions.setAsFeatured")}
            </Button>
          </PermissionGuard>
        </div>
      </div>
    );
  };
  return (
    <Modal
      centered
      visible={visible}
      onCancel={onClose}
      footer={null}
      title={t("serviceConfiguration.managePriority.title")}
      className={`manage-priority-modal ${
        i18n.resolvedLanguage === "ar" ? "manage-priority-modal--rtl" : ""
      }`}
    >
      <div className="modal-content">
        <div className="modal-content-wrapper">
          <div className="search-header">
            <Input
              placeholder={t("common.search")}
              prefix={<Sousuo className="search-icon" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
              allowClear
            />
            <span className="total-count">
              {t("common.total")} {services.length}
            </span>
          </div>

          <div className="services-section">
            <div className="section-header">
              <span className="section-title">
                {t("serviceConfiguration.managePriority.featuredServices")}
              </span>
              <span className="section-count">
                {t("common.total")} {filteredFeatured.length}
              </span>
            </div>
            <div className="table-header">
              <div className="header-order">
                {t("serviceConfiguration.managePriority.table.order")}
              </div>
              <div className="header-name">
                {t("serviceConfiguration.managePriority.table.serviceName")}
              </div>
              <div className="header-category">
                {t("serviceConfiguration.managePriority.table.category")}
              </div>
              <div className="header-actions">
                {t("serviceConfiguration.managePriority.table.actions")}
              </div>
            </div>
            <div className="services-list">
              {!loading && filteredFeatured.map((service, index) =>
                renderServiceRow(service, index, true)
              )}
            </div>
          </div>

          <div className="services-section">
            <div className="section-header2">
              <span className="section-title">
                {t("serviceConfiguration.managePriority.standardServices")}
              </span>
              <span className="section-count">
                {t("common.total")} {filteredStandard.length}
              </span>
            </div>
            <div className="table-header">
              <div className="header-order">
                {t("serviceConfiguration.managePriority.table.order")}
              </div>
              <div className="header-name">
                {t("serviceConfiguration.managePriority.table.serviceName")}
              </div>
              <div className="header-category">
                {t("serviceConfiguration.managePriority.table.category")}
              </div>
              <div className="header-actions">
                {t("serviceConfiguration.managePriority.table.actions")}
              </div>
            </div>
            <div className="services-list">
              {!loading && filteredStandard.map((service, index) =>
                renderServiceRow(service, index, false)
              )}
            </div>
          </div>
        </div>
        

        <div className="modal-footer">
          <Button onClick={onClose} className="cancel-btn" disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            className="save-btn"
            loading={saving}
            disabled={loading || updatingServiceIds.length > 0}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManagePriorityModal;
