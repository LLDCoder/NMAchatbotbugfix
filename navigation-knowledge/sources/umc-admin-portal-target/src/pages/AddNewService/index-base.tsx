import React, { Suspense, useState, useEffect, useRef, useLayoutEffect } from "react";
import { Card, Form, Modal, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import {
  CustomButton,
  StepTabsHeader,
  StepTabsContent,
  CustomMessage,
} from "@/components/common";
import type { TabItem } from "@/components/common";
import Edit2 from "@/assets/icons/Edit2";
import Text from "@/assets/icons/Text";
import Structure from "@/assets/icons/Structure";
import Aed from "@/assets/icons/Aed";
import Certificate from "@/assets/icons/Certificate";
import "./index.less";
import {
  addService,
  getServiceById,
  addServiceCertificate,
  getServiceCanPublish,
  updateServiceStatus,
  getTypeDictionaries,
  updateService,
  putSerivceCertificate,
  getMainHaveChildren,
  type TypeDictionary,
} from "@/services/serviceApi";
import type {
  AddServiceParams,
  AddServiceResponse,
  UpdateServiceResponese,
  UpdateServiceParams,
} from "@/services/serviceApi";
import ServicesInformation from "./components/ServicesInformation";
import FeeConfiguration, {
  type FeeConfigurationRef,
} from "./components/FeeConfiguration";
import CertificateConfiguration from "./components/CertificateConfiguration";
import type { ICertificateConfigurationRefProps } from "./components/CertificateConfiguration";
import {
  PrePublishModal,
  PublishingModal,
  PublishModal,
  SuccessModal,
} from "./components/PublishModals";
import ProcessDesign from "@/components/common/ProcessDesign";
import type { IProcessDesignRef } from "@/components/common/ProcessDesign";
import { useServiceStore } from "@/store/service-store";
import type Playground from "@/components/designable/playground/main";
import { loadDesignablePlaygroundModule } from "@/components/designable/playground/preload";
import { resetStoredDesignerContentLang } from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import EventEmiiter from "@/utils/EventEmiiter";
import { useUserStore } from "@/store/user";
import WarningGold from "@/assets/icons/WarningGold";
import type { AxiosResponse } from "axios";
import clamp2 from "@/utils/clamp2";
import WG from "@/assets/images/warning-gold.png";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

type DesignablePlayProps = React.ComponentPropsWithoutRef<typeof Playground>;
type DesignablePlayRef = React.ElementRef<typeof Playground>;

const LazyPlayInner = lazyWithRetry(loadDesignablePlaygroundModule);

const LazyPlay = React.forwardRef<DesignablePlayRef, DesignablePlayProps>(
  (props, ref) =>
    React.createElement(
      LazyPlayInner as unknown as React.ComponentType<
        DesignablePlayProps & React.RefAttributes<DesignablePlayRef>
      >,
      {
        ...props,
        ref,
      },
    ),
);

LazyPlay.displayName = "LazyPlay";

function DesignableLoadingFallback() {
  return (
    <div className="playground-loading">
      <Spin size="large" />
    </div>
  );
}

export default function AddNewService() {
  const { t } = useTranslation();
  const location = useLocation();
  const [, update] = useState({});
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("1");
  const [loading, setLoading] = useState(false);
  const [isPrePublished, setIsPrePublished] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState<number | null>(null);
  const processDesignRef = React.useRef<IProcessDesignRef>(null);
  const certificateConfigurationRef =
    React.useRef<ICertificateConfigurationRefProps>(null);
  const [processLoading, setProcessLoading] = useState(false);
  const setData = useServiceStore((state) => state.setData);
  const serviceData = useServiceStore((state) => state.serviceData);
  const resetSerivceData = useServiceStore((state) => state.resetSerivceData);
  const [prePublishModalVisible, setPrePublishModalVisible] = useState(false);
  const [publishingModalVisible, setPublishingModalVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const feeConfigurationRef = useRef<FeeConfigurationRef>(null);
  const [prePublishDisabled, setPrePublishDisabled] = useState<boolean>(true);
  const [successType, setSuccessType] = useState<
    "pre-publish" | "publish" | null
  >(null);
  const history = useHistory();
  const statusRef = useRef<TypeDictionary[] | null>(null);
  const [completedList, setCompletedList] = useState<string[]>([]);
  const userInfo = useUserStore((state) => state.userInfo);
  const searchParams = new URLSearchParams(location.search);
  const serviceCode = searchParams.get("serviceCode");
  const serviceIdFromUrl = searchParams.get("id") || searchParams.get("serviceId");
  const from = searchParams.get("from");
  const [mode, setMode] = useState<{
    serviceInfo: string;
    serivceCertificate: string;
  }>({
    serviceInfo: from ?? "edit",
    serivceCertificate: from ?? "edit",
  });
  const [serviceNameDiv, setServiceNameDiv] = useState<HTMLDivElement | null>(
    null,
  );
  const [serviceConflictModalItem, setServiceConflictModalItem] = useState<{
    nameAr: string;
    nameEn: string;
    typeInfo: {
      nameAr: string;
      nameEn: string;
    };
  } | null>();
  useEffect(() => {
    return () => {
      resetSerivceData();
      resetStoredDesignerContentLang();
    };
  }, []);

  async function init() {
    if (serviceIdFromUrl) {
      setIsEditMode(true);
      const activeKey = sessionStorage.getItem(
        `service-active-${userInfo?.id}-${serviceCode}`,
      );
      if (activeKey) {
        setActiveTab(activeKey);
      }
      const data: any = await loadServiceData(serviceIdFromUrl);
      if (data && data.id) {
        const res = await getServiceCanPublish(data.id);
        setPrePublishDisabled(!res.data);
      }
    }
  }

  useEffect(() => {
    init();
  }, [location.search]);

  useEffect(() => {
    getTypeDictionaries("ServiceConfigStatus").then((res) => {
      statusRef.current = res.data;
    });
  }, []);

  const loadServiceData = async (
    serviceId: string | number,
    isParentService?: boolean,
  ) => {
    try {
      setLoading(true);
      const response = await getServiceById(serviceId);

      const data = response.data || response;

      const isPrePublished = data.status !== undefined && data.status === "4";
      const isPublish = data.status !== undefined && data.status === "5";
      setIsPrePublished(isPrePublished);
      setSuccessType(
        isPrePublished ? "pre-publish" : isPublish ? "publish" : successType,
      );

      if (data) {
        setCurrentServiceId(data.id);
        const [certificate] = data.serivceCertificates || [];
        // Save to localStorage
        const sdata: any = {
          serviceName: i18n.resolvedLanguage === "ar" ? data.nameAr : data.nameEn,
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          serviceCategoryId: data.serviceCategoryId,
          department: data.department,
          scopes: data.scope || "",
          userType: data.userType || "",
          isLoginRequired: data.isLoginRequired,
          status: data.status,
          loadedAt: new Date().toISOString(),
          workflowConfigurations: data.workflowConfigurations || [],
          serviceFees: data.serviceFees || {},
          serivceCertificates: data.serivceCertificates || [],
          templateId: certificate?.templateId,
          createdAt: data.createAt,
        };
        const values: any = {
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          serviceCategoryId: String(data.serviceCategoryId),
          serviceDescriptionEn: data.serviceDescriptionEn,
          serviceDescriptionAr: data.serviceDescriptionAr,
          scopes: data.scope,
          department: data.department,
          loginRequired: data.isLoginRequired ? "yes" : "no",
          userType: data.userType,
          status: data.status,
          formCode: data.formCode,
          workFlowCode: data.workFlowCode,
          feeCode: data.feeCode,
          certificateCode: data.certificateCode,
          ruleCode: data.ruleCode,
          cNameEn: certificate?.nameEn || "",
          cNameAr: certificate?.nameAr || "",
          validityPeriod: certificate?.validityPeriod || "",
          templateId: certificate?.templateId,
        };
        if (!isParentService) {
          sdata.type = data.type;
          sdata.parentId = data.parentId;
          sdata.serviceId = data.id;
          sdata.serviceCode = data.code;
          values.type = data.type;
          values.parentId = data.parentId;
          values.code = data.code;
        }
        setData(sdata);
        form.setFieldsValue(values);
        if (
          data.serivceCertificates &&
          data.serivceCertificates.filter(Boolean).length > 0
        ) {
          completedList.push("5");
        }
        if (data.serviceFees) {
          completedList.push("4");
          feeConfigurationRef.current?.setData(data.serviceFees);
        }
        if (
          data.workflowConfigurations &&
          data.workflowConfigurations.filter(Boolean).length > 0
        ) {
          completedList.push("3");
        }
        if (data.forms && data.forms.filter(Boolean).length > 0) {
          completedList.push("2");
        }
        completedList.push("1");
        setCompletedList([...completedList]);
      }
      return data;
    } catch (error: any) {
      console.error("Failed to load service data:", error);
      CustomMessage.error(
        error.message ||
          t("addNewService.messages.loadFailed") ||
          "Failed to load service data",
      );
    } finally {
      setLoading(false);
    }
  };
  const formRef = useRef<any>(null);

  const formSave = async () => {
    if (formRef.current) {
      await formRef.current.save();
      CustomMessage.success(t("Operation successful!"));
      const set = new Set(completedList);
      set.add("2");
      setCompletedList(Array.from(set));
    }
  };
  const handleSave = async () => {
    try {
      let fieldsToValidate: string[] = [];

      if (activeTab === "1") {
        fieldsToValidate = [
          "serviceCategoryId",
          "nameEn",
          "nameAr",
          "serviceDescriptionEn",
          "serviceDescriptionAr",
          "type",
          "department",
          "parentId",
          "userTypes",
          "scopes",
        ];
      } else if (activeTab === "5") {
        fieldsToValidate = ["cNameEn", "cNameAr", "validityPeriod"];
      }
      const values =
        fieldsToValidate.length > 0
          ? await form.validateFields(fieldsToValidate)
          : await form.validateFields();

      setLoading(true);

      const allValues = form.getFieldsValue();

      const status = statusRef.current?.find((item) => item.nameEn === "Draft");
      if (activeTab === "1") {
        let response = {} as AxiosResponse<
          AddServiceResponse | UpdateServiceResponese,
          any,
          {}
        >;
        if (serviceData.serviceId && mode.serviceInfo === "edit") {
          const params: UpdateServiceParams = {
            nameEn: values.nameEn,
            nameAr: values.nameAr,
            serviceDescriptionEn: values.serviceDescriptionEn,
            serviceDescriptionAr: values.serviceDescriptionAr,
            serviceCategoryId: values.serviceCategoryId,
            type: values.type,
            scope: allValues.scopes || "",
            department: values.department,
            isLoginRequired:
              allValues.loginRequired !== undefined
                ? allValues.loginRequired === "yes"
                : false,
            userType: allValues.userType || "",
            status: status?.code,
            id: serviceData.serviceId,
            code: serviceData.serviceCode,
            parentId: allValues.parentId || null,
          };
          if (params.parentId) {
            const res = await getMainHaveChildren({
              serviceId: Number(params.parentId),
              typeCode: params.type,
              childServiceCode: serviceData.serviceCode,
            });
            if (res.data) {
              setServiceConflictModalItem(res.data);
              return;
            }
          }

          response = await updateService(params);
        } else {
          const params: AddServiceParams = {
            nameEn: values.nameEn,
            nameAr: values.nameAr,
            serviceDescriptionEn: values.serviceDescriptionEn,
            serviceDescriptionAr: values.serviceDescriptionAr,
            serviceCategoryId: values.serviceCategoryId,
            type: values.type,
            scope: allValues.scopes || "",
            department: values.department,
            isLoginRequired:
              allValues.loginRequired !== undefined
                ? allValues.loginRequired === "yes"
                : false,
            userType: allValues.userType || "",
            status: status?.code,
            parentId: allValues.parentId || null,
            code: allValues.code || undefined,
          };
          if (params.parentId) {
            const res = await getMainHaveChildren({
              serviceId: Number(params.parentId),
              typeCode: params.type,
            });
            if (res.data) {
              setServiceConflictModalItem(res.data);
              return;
            }
          }
          response = await addService(params);
          localStorage.setItem("serviceCode", response.data?.code || "");
          setMode({
            ...mode,
            serviceInfo: "edit",
          });
          loadServiceData(response.data.id);
        }
        // @ts-ignore
        if (response.statusCode === 200) {
          const serviceId = response.data?.id;
          if (serviceId) {
            setCurrentServiceId(serviceId);
            // Save service data to localStorage
            setData({
              ...serviceData,
              serviceId: serviceId,
              serviceCode: isEditMode
                ? serviceData.serviceCode
                : response.data?.code || allValues.code || "",
              serviceName:
                i18n.resolvedLanguage === "ar" ? values.nameAr : values.nameEn,
              nameEn: values.nameEn,
              nameAr: values.nameAr,
              serviceCategoryId: values.serviceCategoryId,
              type: values.type,
              department: values.department,
              scopes: allValues.scope || "",
              userType: allValues.userType || "",
              isLoginRequired:
                allValues.isLoginRequired !== undefined
                  ? allValues.isLoginRequired
                  : true,
              status: status?.code,
              createdAt: new Date().toISOString(),
            });
          }
          CustomMessage.success("Operation successful!");
          EventEmiiter.emit("save:serviceInfo");
        } else {
          // @ts-ignore
          CustomMessage.error(
            response.message || t("addNewService.messages.saveFailed"),
          );
        }
      } else if (activeTab === "4") {
        // Fee Configuration page
        if (!currentServiceId) {
          CustomMessage.error("Please save service information first");
          setLoading(false);
          return;
        }
        await feeConfigurationRef.current?.save();
        loadServiceData(serviceData.serviceId!);
      } else if (activeTab === "5") {
        if (!certificateConfigurationRef.current?.hasTemplate()) {
          CustomMessage.error("Please select a certificate template");
          return;
        }
        let params = Object.keys(allValues).reduce((acc: any, key: string) => {
          if (allValues[key]) {
            acc[key] = allValues[key];
          }
          return acc;
        }, {});
        params["nameEn"] = params["cNameEn"];
        params["nameAr"] = params["cNameAr"];
        if (certificateConfigurationRef.current) {
          params = {
            ...params,
            ...certificateConfigurationRef.current.getData(),
            serviceId: serviceData.serviceId,
          };
        }
        const [serivceCertificate] = serviceData.serivceCertificates || [];
        if (serivceCertificate && mode.serivceCertificate === "edit") {
          await putSerivceCertificate({ ...params, id: serivceCertificate.id });
        } else {
          await addServiceCertificate(params);
          setMode({
            ...mode,
            serivceCertificate: "edit",
          });
          loadServiceData(serviceData.serviceId!);
        }
        CustomMessage.success("Operation successful!");
        const res = await getServiceCanPublish(serviceData.serviceId!);
        setPrePublishDisabled(!res.data);
      }
      const set = new Set(completedList);
      set.add(activeTab);
      setCompletedList(Array.from(set));
    } catch (error: any) {
      if (error.errorFields) {
        console.log(error.errorFields);
        CustomMessage.error("Please fill in all required fields");
      } else {
        // CustomMessage.error(error.message || "Failed to save service");
      }
    } finally {
      setLoading(false);
    }
  };
  const freshStatusRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 116 || (e.ctrlKey && e.keyCode === 82)) {
        if (!isEditMode && !freshStatusRef.current) {
          e.preventDefault();
          freshStatusRef.current = true;
          const modal = Modal.confirm({
            centered: true,
            className: "unsaved-prompt",
            title: t("unsavedPrompt.title2"),
            content: t("unsavedPrompt.message2"),
            icon: <WarningGold className="warn-icon" />,
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            onOk: () => {
              window.location.reload();
            },
            onCancel: () => {
              freshStatusRef.current = false;
              modal.destroy();
            },
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode]);

  const handlePrePublish = async () => {
    setPrePublishModalVisible(true);
  };

  const handlePrePublishConfirm = async () => {
    try {
      setPublishProgress(0);
      setPrePublishModalVisible(false);
      setPublishingModalVisible(true);
      const status = statusRef.current?.find(
        (item) => item.nameEn === "Pre-published",
      );
      const response = await updateServiceStatus({
        id: serviceData.serviceId!,
        status: status?.code!,
      });
      if (response.data) {
        setPublishProgress(100);
        setSuccessType("pre-publish");
        setSuccessModalVisible(true);
        setIsPrePublished(true);
        CustomMessage.success("Service pre-published successfully!");
      } else {
        CustomMessage.error("Service pre-published failed!");
      }
      setPublishingModalVisible(false);
    } catch (error) {
      setPublishingModalVisible(false);
      CustomMessage.error("Failed to pre-publish");
    }
  };

  const handlePublish = async () => {
    setPublishModalVisible(true);
  };
  const handlePublishConfirm = async () => {
    try {
      setPublishProgress(0);
      setPublishModalVisible(false);
      setPublishingModalVisible(true);
      const status = statusRef.current?.find(
        (item) => item.nameEn === "Published",
      );
      const response = await updateServiceStatus({
        id: serviceData.serviceId!,
        status: status?.code!,
      });
      if (response.data) {
        setPublishProgress(100);
        setSuccessType("publish");
        setSuccessModalVisible(true);
        CustomMessage.success("Service published successfully!");
      } else {
        CustomMessage.error("Service published failed!");
      }
      setPublishingModalVisible(false);
    } catch (error) {
      setPublishingModalVisible(false);
      CustomMessage.error("Failed to publish");
    }
  };

  const tabItems: TabItem[] = [
    {
      key: "1",
      label: t("addNewService.tabs.servicesInformation"),
      icon: <Edit2 />,
      children: (
        <ServicesInformation
          form={form}
          onFormChange={() => update({})}
          loadServiceData={loadServiceData}
        />
      ),
    },
    {
      key: "2",
      label: t("addNewService.tabs.formConfiguration"),
      icon: <Text />,
      children: null,
    },
    {
      key: "3",
      label: t("addNewService.tabs.approvalWorkflow"),
      icon: <Structure />,
      children: (
        <div className="tab-content">
          <ProcessDesign ref={processDesignRef} />
        </div>
      ),
    },
    {
      key: "4",
      label: t("addNewService.tabs.feeConfiguration"),
      icon: <Aed />,
      children: (
        <FeeConfiguration
          serviceId={currentServiceId}
          ref={feeConfigurationRef}
        />
      ),
    },
    {
      key: "5",
      label: t("addNewService.tabs.certificateConfiguration"),
      icon: <Certificate />,
      children: (
        <CertificateConfiguration
          form={form}
          ref={certificateConfigurationRef}
        />
      ),
    },
  ];

  async function handleProcessSave() {
    if (processLoading) return;
    try {
      setProcessLoading(true);
      await processDesignRef.current?.save();
      CustomMessage.success(t("Operation successful!"));
      const set = new Set(completedList);
      set.add("3");
      setCompletedList(Array.from(set));
      loadServiceData(serviceData.serviceId!);
    } finally {
      setProcessLoading(false);
    }
  }
  const serviceName =
    i18n.resolvedLanguage === "ar"
      ? form.getFieldValue("nameAr")
      : form.getFieldValue("nameEn");
  const isView = new URLSearchParams(location.search).get("view") === "1";
  useLayoutEffect(() => {
    if (serviceNameDiv) {
      serviceNameDiv.dataset.originalText = serviceName;
      clamp2(serviceNameDiv);
    }
  }, [serviceNameDiv, serviceName]);
  return (
    <div
      className={`add-new-service-container ${
        activeTab === "2" ? "flexdom" : ""
      }`}
    >
      <Card className="service-name-card">
        {serviceName && (
          <h3
            ref={(e) => setServiceNameDiv(e)}
            title={serviceName}
            className="service-name"
          >
            {serviceName}
          </h3>
        )}
        <StepTabsHeader
          completedList={completedList}
          items={tabItems}
          activeKey={activeTab}
          onChange={(activeKey) => {
            if (!serviceData.serviceId) {
              CustomMessage.error(t("addNewService.messages.saveServiceFirst"));
              return;
            }
            if (activeKey === "4" && serviceData.serviceFees) {
              if (serviceData.serviceId || serviceIdFromUrl) {
                loadServiceData(serviceData.serviceId || serviceIdFromUrl!);
              }
              requestAnimationFrame(() => {
                feeConfigurationRef.current?.setData(serviceData.serviceFees!);
              });
            }
            if (serviceData.serviceCode) {
              sessionStorage.setItem(
                `service-active-${userInfo?.id}-${serviceData.serviceCode}`,
                activeKey,
              );
            }
            setActiveTab(activeKey);
          }}
        />
      </Card>

      {activeTab === "2" ? (
        <div className={`playgroundcontainer ${isView ? "page-disabled" : ""}`}>
          <Suspense fallback={<DesignableLoadingFallback />}>
            <LazyPlay ref={formRef} readOnly={isView} />
          </Suspense>
        </div>
      ) : activeTab === "3" ? (
        <div className="process-content-wrapper">
          <div className={`process-content ${isView ? "page-disabled" : ""}`}>
            <ProcessDesign ref={processDesignRef} />
          </div>
        </div>
      ) : activeTab === "4" ? (
        <div>
          <FeeConfiguration
            serviceId={currentServiceId}
            ref={feeConfigurationRef}
          />
        </div>
      ) : (
        <Card
          className={`service-card ${activeTab === "4" ? "compact-card" : ""} ${
            activeTab === "5" || activeTab === "1" ? "certificate-card" : ""
          }`}
        >
          <StepTabsContent items={tabItems} activeKey={activeTab} />
        </Card>
      )}
      {!isView && <div className="form-footer">
        <CustomButton
          onClick={() =>
            history.push("/service-management/service-configuration")
          }
          text={t("common.back")}
          variant="outline"
        />
        <div className="form-footer-right">
          {isView ? null : activeTab === "5" ? (
            <>
              {successType !== "pre-publish" && successType !== "publish" && (
                <CustomButton
                  text={t("addNewService.buttons.save")}
                  variant="outline"
                  customClassName="saveBtn"
                  onClick={handleSave}
                  loading={loading}
                  permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService2"
                  permissionRoutePath="/service-management/service-configuration/addnewservice"
                />
              )}
              {successType !== "pre-publish" && successType !== "publish" && (
                <CustomButton
                  text="Pre-Publish"
                  variant="outline"
                  customClassName="saveBtn"
                  onClick={handlePrePublish}
                  loading={loading}
                  disabled={prePublishDisabled}
                />
              )}

              {successType !== "publish" && (
                <CustomButton
                  text="Publish"
                  variant="primary"
                  customClassName="saveBtn"
                  onClick={handlePublish}
                  loading={loading}
                  disabled={!isPrePublished}
                />
              )}
            </>
          ) : activeTab === "3" ? (
            <>
              <CustomButton
                customClassName="saveBtn"
                text={t("addNewService.buttons.test")}
                variant="outline"
              />
              <CustomButton
                text={t("addNewService.buttons.save")}
                variant="primary"
                customClassName="saveBtn"
                onClick={handleProcessSave}
                loading={processLoading}
                permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService"
                permissionRoutePath="/service-management/service-configuration/addnewservice"
              />
            </>
          ) : activeTab === "2" ? (
            //  Save
            <CustomButton
              text={t("addNewService.buttons.save")}
              variant="primary"
              customClassName="saveBtn"
              onClick={formSave}
              loading={loading}
              permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService"
              permissionRoutePath="/service-management/service-configuration/addnewservice"
            />
          ) : (
            <CustomButton
              text={t("addNewService.buttons.save")}
              variant="primary"
              customClassName="saveBtn"
              onClick={handleSave}
              loading={loading}
              permissionCode="Service.ServiceConfiguration.AddNewService.Save"
              permissionRoutePath="/service-management/service-configuration/addnewservice"
            />
          )}
        </div>
      </div>}

      <PrePublishModal
        visible={prePublishModalVisible}
        onCancel={() => setPrePublishModalVisible(false)}
        onConfirm={handlePrePublishConfirm}
        testAccount="test001@umc.gov"
      />

      <PublishingModal
        visible={publishingModalVisible}
        progress={publishProgress}
      />

      <PublishModal
        visible={publishModalVisible}
        onCancel={() => setPublishModalVisible(false)}
        onConfirm={handlePublishConfirm}
        serviceName="Issuing License for selling books and publications"
      />

      <SuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        type={successType!}
        testAccount="test001@umc.gov"
        accessLink="https://test.umc.gov/services/2025-001"
      />

      <Modal
        centered
        className="service-conflict-modal"
        visible={!!serviceConflictModalItem}
        footer={
          <div>
            <CustomButton
              text="Close"
              onClick={() => setServiceConflictModalItem(null)}
            />
          </div>
        }
        closable={false}
        onCancel={() => setServiceConflictModalItem(null)}
      >
        <div className="service-conflict-modal-content">
          <div className="service-conflict-modal-icon">
            <img src={WG} />
          </div>
          <div>
            <div className="service-conflict-modal-title">Service Conflict</div>
            <div className="service-conflict-modal-desc">
              Issuing License for selling books and publications already has an
              active renewal service. You canâ€™t create another renewal service
              for this record.
            </div>
            <div className="service-conflict-modal-subtitle">
              Existing service
            </div>
            <div className="service-conflict-modal-serviceinfo">
              <div>
                <b>Service name:</b>{" "}
                {i18n.resolvedLanguage === "ar"
                  ? serviceConflictModalItem?.nameAr
                  : serviceConflictModalItem?.nameEn}
              </div>
              <div>
                <b>Service type:</b>{" "}
                {i18n.resolvedLanguage === "ar"
                  ? serviceConflictModalItem?.typeInfo?.nameAr
                  : serviceConflictModalItem?.typeInfo?.nameEn}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
