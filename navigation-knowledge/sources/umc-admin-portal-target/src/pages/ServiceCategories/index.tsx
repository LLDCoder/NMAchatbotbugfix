import { useState, useEffect, useMemo } from "react";
import SearchIcon from "@/assets/icons/SearchIcon";
import { Input } from "antd";
import { debounce } from "lodash";
import "./index.less";
import {
  CustomButton,
  ConfirmModal,
  CustomMessage,
  PermissionGuard,
} from "@/components/common";
import Sort from "@/assets/icons/Sort";
import RightArrow from "@/assets/icons/RightArrow";
import ServiceModal from "./components/serviceModal";
import EditModal from "./components/editModal";
import SortModal from "./components/sortModal";
import { useTranslation } from "react-i18next";
import {
  getAllServiceCategories,
  delServiceCategories,
} from "@/services/serviceApi";
import GameImg from "@/assets/images/game.png";
import type { ServiceCategory } from "@/services/serviceApi";
import {
  serviceCategoryIconList,
  type ServiceCategoryIconType,
} from "./categoryIcons";

type IconType = ServiceCategoryIconType;
interface CategoriesItem {
  id: string;
  serviceInfoCount: number;
  nameEn: string;
  nameAr: string;
  iconUri: IconType;
  descriptionEn: string;
  descriptionAr: string;
}
interface FormValues {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  iconUri?: IconType;
}
export default function ServiceCategories() {
  const { t, i18n } = useTranslation();
  const [serviceList, setServiceList] = useState<ServiceCategory[]>([]);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Pick<
    CategoriesItem,
    "id" | "nameEn" | "nameAr"
  > | null>(null);
  const [editModalData, setEditModalData] = useState({
    visible: false,
    formData: {} as FormValues,
  });
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{
    visible: boolean;
    service: string | null;
  }>({
    visible: false,
    service: null,
  });
  useEffect(() => {
    getCategories();
  }, []);
  const categoryModalTitle = useMemo(() => {
    if (!selectedCategory) {
      return t("serviceCategories.serviceModal.title");
    }
    const resolvedTitle =
      i18n.resolvedLanguage === "ar" ? selectedCategory.nameAr : selectedCategory.nameEn;

    return resolvedTitle?.trim() || t("serviceCategories.serviceModal.title");
  }, [i18n.language, selectedCategory, t]);
  const openCategoriesDetail = (item: CategoriesItem) => {
    if (item.serviceInfoCount === 0) return;
    setSelectedCategory({
      id: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
    });
    setServiceModalVisible(true);
  };
  // const addServiceCategory = () => {
  //     setEditModalData({
  //         visible: true
  //     })
  // };
  const openEditModal = (item: FormValues) => {
    setEditModalData({
      visible: true,
      formData: item,
    });
  };
  const handleDuplicate = () => {
    if (duplicateModal.service) {
      delServiceCategories(duplicateModal.service).then(() => {
        getCategories();
        CustomMessage.success(t("common.operationSuccess"));
        setDuplicateModal({
          visible: false,
          service: null,
        });
      });
    }
  };
  const deleteService = (id: string, count: number) => {
    if (count !== 0) return;
    setDuplicateModal({ visible: true, service: id });
  };
  // api
  const getCategories = (value?: string) => {
    getAllServiceCategories({ name: value }).then((res) => {
      setServiceList(res.data ?? []);
    });
  };
  const debouncedGetCategories = debounce((value: string) => {
    getCategories(value);
  }, 500);
  const services = serviceList.map((item) => {
    const currentIcon = serviceCategoryIconList[item.iconUri as IconType];

    return (
      <div className="service_item" key={item.id}>
        <div className="top_line">
          {currentIcon ? currentIcon : <img src={GameImg} alt="" />}
          <CustomButton
            text={t("serviceCategories.count.services", {
              count: item.serviceInfoCount,
            })}
            variant="outline"
            icon={<RightArrow />}
            iconPosition="right"
            customClassName={`count-btn ${
              item.serviceInfoCount === 0 ? "disabled" : ""
            }`}
            iconClassName="count-icon"
            onClick={() =>
              openCategoriesDetail({
                id: item.id,
                serviceInfoCount: item.serviceInfoCount,
                nameEn: item.nameEn,
                nameAr: item.nameAr,
                iconUri: item.iconUri as IconType,
                descriptionEn: item.descriptionEn,
                descriptionAr: item.descriptionAr,
              })
            }
          />
        </div>
        <h2>{i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}</h2>
        <div className="content_text">
          {i18n.resolvedLanguage === "ar" ? item.descriptionAr : item.descriptionEn}
        </div>
        <div className="bottom_btn">
          <CustomButton
            text={t("common.delete")}
            customStyle={{
              color: item.serviceInfoCount === 0 ? "#92722A" : "#9EA2A9",
            }}
            variant="text"
            customClassName="option-btn"
            onClick={() => deleteService(item.id, item.serviceInfoCount)}
          />
          <PermissionGuard
            permissionCode="Service.ServiceCategories.Save"
            routePath="/service-management/service-categories"
          >
            <CustomButton
              text={t("common.edit")}
              variant="primary"
              customClassName="option-btn"
              onClick={() =>
                openEditModal({
                  id: item.id,
                  nameEn: item.nameEn,
                  nameAr: item.nameAr,
                  descriptionEn: item.descriptionEn,
                  descriptionAr: item.descriptionAr,
                  iconUri: item.iconUri as IconType,
                })
              }
            />
          </PermissionGuard>
        </div>
      </div>
    );
  });
  return (
    <div
      className={`serviceCategories_container ${
        i18n.resolvedLanguage === "ar" ? "serviceCategories_container--rtl" : ""
      }`}
    >
      <div className="card_box">
        <div className="option_line flex_sp_al responsive-filter-toolbar responsive-filter-toolbar--center-actions">
          <div className="search_box responsive-filter-toolbar__controls">
            <Input
              size="large"
              placeholder={t("common.search")}
              allowClear
              prefix={<SearchIcon />}
              onChange={(e) => debouncedGetCategories(e.target.value)}
              className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
            />
          </div>
          <div className="btn_group responsive-filter-toolbar__action">
            <PermissionGuard
              permissionCode="Service.ServiceCategories.SaveServiceCategories"
              routePath="/service-management/service-categories"
            >
              <CustomButton
                text={t("serviceCategories.actions.sort")}
                variant="outline"
                icon={<Sort />}
                iconPosition="right"
                onClick={() => setSortModalVisible(true)}
                iconStyle={{ marginLeft: "12px" }}
              />
            </PermissionGuard>
            <PermissionGuard
              permissionCode="Service.ServiceCategories.Save"
              routePath="/service-management/service-categories"
            >
              <CustomButton
                text={t("serviceCategories.actions.addNew")}
                variant="primary"
                onClick={() => openEditModal({} as FormValues)}
              />
            </PermissionGuard>
          </div>
        </div>
        <div className="service_list">{services}</div>
        {/* service modal */}
        <ServiceModal
          show={serviceModalVisible}
          close={() => setServiceModalVisible(false)}
          id={selectedCategory?.id ?? ""}
          title={categoryModalTitle}
        />
        {/* edit & Add modal */}
        <EditModal
          show={editModalData.visible}
          close={() => setEditModalData({ ...editModalData, visible: false })}
          formData={editModalData.formData}
          updateData={getCategories}
        />
        {/* sort modal */}
        <SortModal
          show={sortModalVisible}
          close={() => setSortModalVisible(false)}
          tableData={serviceList}
          updateData={getCategories}
        />
        <ConfirmModal
          width={600}
          visible={duplicateModal.visible}
          type="danger"
          title={t("serviceCategories.deleteModal.title")}
          content={t("serviceCategories.deleteModal.content")}
          cancelText={t("common.cancel")}
          confirmText={t("common.delete")}
          onCancel={() => setDuplicateModal({ visible: false, service: null })}
          onConfirm={handleDuplicate}
        />
      </div>
    </div>
  );
}
