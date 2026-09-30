import React, { useState, useEffect, useMemo } from "react";
import { Modal, Select, Tree, Input, Tag, Button, Spin } from "antd";
import { SearchOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { getFeeLinkedService } from "@/services/dictionary";
import { getEconomicActivitys } from "@/services/serviceApi";
import EmptyIcon from "@/assets/images/empty.svg";
import EmptyBox from "../../../../../common/EmptyBox/EmptyBox";
import "./ActivityConfigurationSetter.less";
import { useLocation } from "react-router-dom";
import { CustomButton } from "../../../../../common";
import i18n from "@/localization/config";
import { useFormUiLang } from "@/components/designable/playground/FormPreviewLangContext";
import formatMoney from "@/utils/formatMoney";
const { Option } = Select;

interface ActivityItem {
  id: number;
  nameAr: string | null;
  nameEn: string | null;
  code: string;
  fee?: number;
  parentId?: number;
  childData?: ActivityItem[] | null;
}

interface ServiceItem {
  code: string;
  nameEn: string;
  nameAr: string;
}

interface ActivityConfigurationSetterProps {
  value?: {
    serviceCode?: string;
    selectedActivities?: string[];
    activityData?: any[];
  };
  onChange?: (value: any) => void;
}

const ActivityConfigurationSetter: React.FC<
  ActivityConfigurationSetterProps
> = ({ value, onChange }) => {
  const lang = useFormUiLang();
  const t = i18n.getFixedT(lang);
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);

  const urlserviceCode = queryParams.get("serviceCode"); // 123
  const [modalVisible, setModalVisible] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<string | undefined>(
    value?.serviceCode,
  );
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    value?.selectedActivities || [],
  );
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const getActivityName = (item: {
    nameAr: string | null;
    nameEn: string | null;
  }) => {
    return lang === "ar"
      ? item.nameAr || item.nameEn || ""
      : item.nameEn || item.nameAr || "";
  };

  const isConfigured = !!value?.serviceCode;

  useEffect(() => {
    getFeeLinkedService().then((res) => {
      if (Array.isArray(res.data)) {
        setServices(res.data || []);
      }
    });
  }, []);

  useEffect(() => {
    if (urlserviceCode || localStorage.getItem("serviceCode")) {
      setLoading(true);
      getEconomicActivitys(
        urlserviceCode || localStorage.getItem("serviceCode") || "",
      )
        .then((res) => {
          if (Array.isArray(res.data)) {
            setActivities(res.data || []);
            const keys = res.data.map(
              (item: ActivityItem) => `parent-${item.id}`,
            );
            setExpandedKeys(keys);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  const treeData = useMemo(() => {
    return activities.map((parent) => {
      const children = parent.childData || [];
      const filteredChildren = searchText
        ? children.filter(
            (child) =>
              child.nameEn?.toLowerCase().includes(searchText.toLowerCase()) ||
              child.nameAr?.includes(searchText),
          )
        : children;

      const selectedCount = filteredChildren.filter((child) =>
        selectedKeys.includes(String(child.id)),
      ).length;

      return {
        key: `parent-${parent.id}`,
        title: (
          <div className="activity-tree-parent">
            <span className="activity-tree-parent-name">
              {getActivityName(parent)}
            </span>
            <span className="activity-tree-parent-count">
              {selectedCount}/{filteredChildren.length}
            </span>
          </div>
        ),
        selectable: false,
        children: filteredChildren.map((child) => ({
          key: String(child.id),
          title: (
            <div className="activity-tree-item">
              <span className="activity-tree-item-name">
                {getActivityName(child)}
              </span>
              {child.fee !== undefined && (
                <span className="activity-tree-item-fee">
                  <span className="currency">
                    {t("SelectTable.activityConfigurationSetter.currencyAED")}
                  </span>{" "}
                  {formatMoney(child.fee)}
                </span>
              )}
            </div>
          ),
        })),
      };
    });
  }, [activities, searchText, selectedKeys, t]);

  const selectedActivityItems = useMemo(() => {
    const items: ActivityItem[] = [];
    activities.forEach((parent) => {
      parent.childData?.forEach((child) => {
        if (selectedKeys.includes(String(child.id))) {
          items.push(child);
        }
      });
    });
    return items;
  }, [activities, selectedKeys]);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedService(value?.serviceCode);
    setSelectedKeys(value?.selectedActivities || []);
    setModalVisible(true);
  };

  const handleCancel = () => {
    setModalVisible(false);
    setSearchText("");
  };

  const handleSave = () => {
    const activityData = selectedActivityItems.map((item, index) => ({
      id: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      code: item.code,
      fee: item.fee,
      Number: index + 1,
    }));

    onChange?.({
      serviceCode: selectedService,
      selectedActivities: selectedKeys,
      activityData,
    });
    setModalVisible(false);
    setSearchText("");
  };

  const handleServiceChange = (value: string) => {
    setSelectedService(value);
    setSelectedKeys([]);
  };

  const handleCheck = (checkedKeys: any) => {
    const keys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked;
    setSelectedKeys(keys.filter((k: string) => !k.startsWith("parent-")));
  };

  const handleRemoveTag = (id: string) => {
    setSelectedKeys(selectedKeys.filter((k) => k !== id));
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
  };

  return (
    <div className="activity-configuration-setter">
      <Button
        block
        className={`activity-config-btn ${isConfigured ? "configured" : ""}`}
        onClick={handleOpenModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isConfigured
          ? t("SelectTable.activityConfigurationSetter.configured")
          : t("SelectTable.activityConfigurationSetter.notConfigured")}
      </Button>

      <Modal
        centered
        title={t("SelectTable.optionsEditor.modalTitle")}
        visible={modalVisible}
        onCancel={handleCancel}
        width={900}
        destroyOnClose
        maskClosable={false}
        getContainer={() => document.body}
        footer={
          <div className="activity-modal-footer">
            <CustomButton variant="outline" onClick={handleCancel}>
              {t("SelectTable.optionsEditor.cancel")}
            </CustomButton>
            <CustomButton variant="gold" type="primary" onClick={handleSave}>
              {t("SelectTable.optionsEditor.save")}
            </CustomButton>
          </div>
        }
        className="activity-configuration-modal"
      >
        <div className="activity-modal-content">
          {/* <div className="activity-form-item">
            <label className="activity-label">
              Select Service <span className="required">*</span>
            </label>
            <Select
              placeholder="Select Service"
              value={selectedService}
              onChange={handleServiceChange}
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="children"
              getPopupContainer={(node) => node.parentNode as HTMLElement}
            >
              {services.map((item) => (
                <Option key={item.code} value={item.code}>
                  {item.nameEn}
                </Option>
              ))}
            </Select>
          </div> */}

          <div className="activity-form-item">
            <label className="activity-label">
              {t("SelectTable.columnActivity")}
            </label>
            {!activities.length ? (
              <div className="activity-empty">
                <img
                  src={EmptyIcon}
                  alt={t("SelectTable.activityConfigurationSetter.emptyAlt")}
                />
                <p>
                  {t("SelectTable.activityConfigurationSetter.selectServiceHint")}
                </p>
              </div>
            ) : loading ? (
              <div className="activity-loading">
                <Spin />
              </div>
            ) : (
              <div className="activity-tree-container">
                {/* {selectedKeys.length > 0 && (
                  <div className="activity-selected-tags">
                    {selectedActivityItems.map((item) => (
                      <Tag
                        key={item.id}
                        closable
                        onClose={() => handleRemoveTag(String(item.id))}
                      >
                        {item.nameEn || item.nameAr}
                      </Tag>
                    ))}
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseCircleOutlined />}
                      onClick={handleClearAll}
                      className="clear-all-btn"
                    >
                      Clear All
                    </Button>
                  </div>
                )} */}
                <Input
                  placeholder={t(
                    "SelectTable.activityConfigurationSetter.searchPlaceholder",
                  )}
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="activity-search"
                  allowClear
                />
                <div className="activity-tree-wrapper">
                  {treeData.length > 0 ? (
                    <Tree
                      // checkable
                      checkedKeys={selectedKeys}
                      onCheck={handleCheck}
                      expandedKeys={expandedKeys}
                      onExpand={(keys) => setExpandedKeys(keys as string[])}
                      treeData={treeData}
                      selectable={false}
                    />
                  ) : (
                    <EmptyBox
                      title={t(
                        "SelectTable.activityConfigurationSetter.noActivitiesFound",
                      )}
                      customClassName="activity-empty"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ActivityConfigurationSetter;
