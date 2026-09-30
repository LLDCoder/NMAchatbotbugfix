import React, { useState, useEffect, useMemo } from "react";
import {
  Input,
  Select,
  Checkbox,
  Radio,
  Form,
  Row,
  Col,
  Tooltip,
  Card,
} from "antd";
import { useTranslation } from "react-i18next";
import type { FormInstance, RadioChangeEvent } from "antd";
import type { CheckboxValueType } from "antd/es/checkbox/Group";
import messageQuestionIcon from "@/assets/images/messageQuestion.png";
import {
  IsExistingCodes,
  getAllServiceCategories,
  getTypeDictionaries,
  getAllUserType,
  getServiceOnlyParent,
  type TypeDictionary,
  type ServiceInfoDetail,
  type ServiceCategory,
} from "@/services/serviceApi";
import { useServiceStore } from "@/store/service-store";
import { useLocation } from "react-router-dom";
import EventEmiiter from "@/utils/EventEmiiter";
import { getDepartments, type DepartmentItem } from "@/services/department";

const { Option } = Select;
const { TextArea } = Input;
const NEW_SERVICE_TYPE_CODE = "2";
const SERVICE_NAME_MAX_LENGTH = 200;
const SERVICE_INFO_INPUT_MAX_LENGTH = 200;
const SERVICE_INFO_TEXTAREA_MAX_LENGTH = 5000;
const INDIVIDUAL_USER_TYPE_CODE = "01";
const LEGACY_INDIVIDUAL_USER_TYPE_CODE = "1";
const ESTABLISHMENT_USER_TYPE_CODE = "99";
const INDIVIDUAL_USER_TYPE_CODES = [
  INDIVIDUAL_USER_TYPE_CODE,
  LEGACY_INDIVIDUAL_USER_TYPE_CODE,
];

const normalizeIndividualUserTypeCode = (code: string) => {
  if (
    code === INDIVIDUAL_USER_TYPE_CODE ||
    code === LEGACY_INDIVIDUAL_USER_TYPE_CODE
  ) {
    return INDIVIDUAL_USER_TYPE_CODE;
  }

  return code;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeParentServiceValue = (
  value: unknown,
  services: ServiceInfoDetail[],
): number | string | undefined => {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue || normalizedValue === "0") {
    return undefined;
  }

  if (!Array.isArray(services) || !services.length) {
    return value as number | string;
  }

  const matchedService = services.find(
    (item) => String(item?.id ?? "").trim() === normalizedValue,
  );

  return matchedService?.id;
};

interface ServicesInformationProps {
  form: FormInstance;
  onFormChange?: () => void;
  loadServiceData?: (serviceId: string | number, isParentService?: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const ServicesInformation: React.FC<ServicesInformationProps> = ({
  form,
  onFormChange,
  loadServiceData,
  onDirtyChange,
}) => {
  const { t, i18n } = useTranslation();
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [establishmentSubTypes, setEstablishmentSubTypes] = useState<string[]>(
    [],
  );
  const [, update] = useState({});
  const serviceData = useServiceStore((state) => state.serviceData);
  const { userType, type, scopes } = serviceData;
  const [loginRequired, setLoginRequired] = useState<string>("no");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [, setHasUnsavedChanges] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (type) {
      setSelectedServiceType(type);
    }
  }, [type]);

  // Dropdown data states
  const [, setCategories] = useState<TypeDictionary[]>([]);
  const [serviceTypes, setServiceTypes] = useState<TypeDictionary[]>([]);
  const [, setDepartments] = useState<TypeDictionary[]>([]);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory[]>([]);
  const [responsibleDepartment, setResponsibleDepartment] = useState<
    DepartmentItem[]
  >([]);
  const [userTypesData, setUserTypesData] = useState<TypeDictionary[]>([]);
  const [scopeData, setScopeData] = useState<TypeDictionary[]>([]);
  const [, setEmiratesData] = useState<TypeDictionary[]>([]);
  const [parentServices, setParentServices] = useState<ServiceInfoDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const watchedScopes = Form.useWatch("scopes", form);
  const individualMainUserTypeCode = useMemo(
    () =>
      userTypesData.some(
        (item) => String(item.code) === LEGACY_INDIVIDUAL_USER_TYPE_CODE,
      )
        ? LEGACY_INDIVIDUAL_USER_TYPE_CODE
        : INDIVIDUAL_USER_TYPE_CODE,
    [userTypesData],
  );
  const mainUserTypeCodes = useMemo(
    () => [...INDIVIDUAL_USER_TYPE_CODES, ESTABLISHMENT_USER_TYPE_CODE],
    [],
  );
  const mainUserTypeOptions = useMemo(() => {
    const individual =
      userTypesData.find(
        (item) => String(item.code) === LEGACY_INDIVIDUAL_USER_TYPE_CODE,
      ) ||
      userTypesData.find(
        (item) => String(item.code) === INDIVIDUAL_USER_TYPE_CODE,
      );
    const establishment =
      userTypesData.find(
        (item) => String(item.code) === ESTABLISHMENT_USER_TYPE_CODE,
      );

    return [
      individual && {
        option: individual,
        value: individualMainUserTypeCode,
      },
      establishment && {
        option: establishment,
        value: ESTABLISHMENT_USER_TYPE_CODE,
      },
    ].filter(Boolean) as Array<{ option: TypeDictionary; value: string }>;
  }, [individualMainUserTypeCode, userTypesData]);
  const establishmentSubTypeOptions = useMemo(
    () =>
      userTypesData.filter((item) => {
        const code = String(item.code);
        return !mainUserTypeCodes.includes(code);
      }),
    [mainUserTypeCodes, userTypesData],
  );
  const defaultNewServiceTypeCode = useMemo(() => {
    const matchedType =
      serviceTypes.find(
        (item) => String(item.code ?? "").trim() === NEW_SERVICE_TYPE_CODE,
      ) ||
      serviceTypes.find(
        (item) => String(item.nameEn ?? "").trim().toLowerCase() === "new",
      );

    return String(matchedType?.code ?? NEW_SERVICE_TYPE_CODE).trim();
  }, [serviceTypes]);

  const urlParams = new URLSearchParams(location.search);
  const from = urlParams.get("from");
  const serviceCode = urlParams.get("serviceCode");
  const pageType = String(urlParams.get("type") ?? "")
    .trim()
    .toLowerCase();
  const serviceIdFromUrl = String(
    urlParams.get("id") ?? urlParams.get("serviceId") ?? "",
  ).trim();
  const validationServiceId = useMemo(() => {
    const normalizedFrom = String(from ?? "").trim().toLowerCase();

    if (normalizedFrom === "add" || pageType === "duplicate") {
      return "";
    }

    if (serviceIdFromUrl) {
      return serviceIdFromUrl;
    }

    if (serviceData.serviceId === null || serviceData.serviceId === undefined) {
      return "";
    }

    return String(serviceData.serviceId).trim();
  }, [from, pageType, serviceData.serviceId, serviceIdFromUrl]);
  
  useEffect(() => {
    const parsedUserTypes =
      userType
        ?.split(",")
        ?.map((value: string) => value.trim())
        .filter(Boolean) || [];
    const selectedEstablishmentSubTypes = parsedUserTypes.filter(
      (value: string) => !mainUserTypeCodes.includes(value),
    );
    const hasIndividual =
      parsedUserTypes.includes(INDIVIDUAL_USER_TYPE_CODE) ||
      parsedUserTypes.includes(LEGACY_INDIVIDUAL_USER_TYPE_CODE);
    const hasEstablishment =
      parsedUserTypes.includes(ESTABLISHMENT_USER_TYPE_CODE) ||
      selectedEstablishmentSubTypes.length > 0;
    const selectedMainUserTypes = [];
    if (hasIndividual) {
      selectedMainUserTypes.push(individualMainUserTypeCode);
    }
    if (hasEstablishment) {
      selectedMainUserTypes.push(ESTABLISHMENT_USER_TYPE_CODE);
    }
    const normalizedUserType = [
      ...selectedMainUserTypes,
      ...selectedEstablishmentSubTypes,
    ].join(",");

    setEstablishmentSubTypes(selectedEstablishmentSubTypes);
    setUserTypes(selectedMainUserTypes);
    form?.setFieldsValue({
      userType: normalizedUserType,
      userTypes: selectedMainUserTypes,
    });
  }, [form, individualMainUserTypeCode, mainUserTypeCodes, userType]);

  // Fetch dropdown data
  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    setLoading(true);
    try {
      // Fetch all dropdown data in parallel
      const [
        categoriesRes,
        serviceTypesRes,
        departmentsRes,
        responsibleDepartmentRes,
        serviceCategoryRes,
        userTypesRes,
        scopeRes,
        parentServicesRes,
      ] = await Promise.all([
        getTypeDictionaries("Category"),
        getTypeDictionaries("ServiceConfigServiceType"),
        getTypeDictionaries("ServiceConfigDepartment"),
        getDepartments({ PageIndex: 1, PageSize: 1000 }),
        getAllServiceCategories(),
        getAllUserType(),
        getTypeDictionaries("ServiceConfigScope"),
        getServiceOnlyParent(),
      ]);

      // Process response data and ensure array format
      setCategories(
        Array.isArray(categoriesRes)
          ? categoriesRes
          : categoriesRes?.data || [],
      );
      setServiceTypes(
        Array.isArray(serviceTypesRes)
          ? serviceTypesRes
          : serviceTypesRes?.data || [],
      );
      setDepartments(
        Array.isArray(departmentsRes)
          ? departmentsRes
          : departmentsRes?.data || [],
      );
      setResponsibleDepartment(
        Array.isArray(responsibleDepartmentRes)
          ? responsibleDepartmentRes
          : responsibleDepartmentRes?.data.items || [],
      );
      setServiceCategory(
        Array.isArray(serviceCategoryRes)
          ? serviceCategoryRes
          : serviceCategoryRes?.data || [],
      );
      setUserTypesData(
        Array.isArray(userTypesRes) ? userTypesRes : userTypesRes?.data || [],
      );

      // Scope data contains all options: first two are main options, rest are emirates options
      const scopeDataArray = Array.isArray(scopeRes)
        ? scopeRes
        : scopeRes?.data || [];
      setScopeData(scopeDataArray);
      // Emirates data is extracted from scopeData instead of fetching separately
      setEmiratesData(scopeDataArray.slice(2));

      // Parent services data
      const parentServicesArray = Array.isArray(parentServicesRes)
        ? parentServicesRes
        : parentServicesRes?.data || [];
      setParentServices(parentServicesArray);

    } catch (error) {
      console.error("Failed to fetch dropdown data:", error);
      // Set to empty arrays to avoid errors
      setCategories([]);
      setServiceTypes([]);
      setDepartments([]);
      setResponsibleDepartment([]);
      setServiceCategory([]);
      setUserTypesData([]);
      setScopeData([]);
      setEmiratesData([]);
      setParentServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeChange = (checkedValues: CheckboxValueType[]) => {
    const selectedMainUserTypes = Array.from(
      new Set<string>(
        checkedValues
          .map((value) => {
            const code = normalizeIndividualUserTypeCode(String(value));
            return INDIVIDUAL_USER_TYPE_CODES.includes(code)
              ? individualMainUserTypeCode
              : code;
          })
          .filter((value) => mainUserTypeCodes.includes(value)),
      ),
    );
    setUserTypes(selectedMainUserTypes);
    const allEstablishmentSubTypes = establishmentSubTypeOptions.map(
      (subType) => String(subType.code),
    );
    let allUserTypes = [...selectedMainUserTypes];
    if (selectedMainUserTypes.includes(ESTABLISHMENT_USER_TYPE_CODE)) {
      allUserTypes = [...selectedMainUserTypes, ...allEstablishmentSubTypes];
      setEstablishmentSubTypes(allEstablishmentSubTypes);
    } else {
      setEstablishmentSubTypes([]);
    }
    // Update form value with main options and sub-options combined
    const userTypeValue = allUserTypes
      .filter(Boolean)
      .join(",");
    console.log("User Types changed:", userTypeValue);
    form.setFieldsValue({
      userType: userTypeValue,
      userTypes: selectedMainUserTypes,
    });
    void form.validateFields(["userTypes"]).catch(() => undefined);
  };

  const handleEstablishmentSubTypeChange = (
    checkedValues: CheckboxValueType[],
  ) => {
    const selectedSubTypes = checkedValues.map((value) =>
      String(value),
    );
    setEstablishmentSubTypes(selectedSubTypes);
    // Update form value with main options and sub-options combined
    const allUserTypes = [...userTypes, ...selectedSubTypes];
    const userTypeValue = allUserTypes
      .filter(Boolean)
      .join(",");
    form.setFieldsValue({
      userType: userTypeValue,
      userTypes,
    });
    void form.validateFields(["userTypes"]).catch(() => undefined);
  };

  useEffect(() => {
    const call = () => {
      setHasUnsavedChanges(false);
      onDirtyChange?.(false);
    };
    EventEmiiter.on("save:serviceInfo", call);
    return () => {
      EventEmiiter.off("save:serviceInfo", call);
    };
  }, [onDirtyChange]);
  // useEffect(() => {
  //   const unblock = history.block((location) => {
  //     if (hasUnsavedChanges) {
  //       const modal = Modal.confirm({
  //         className: "unsaved-prompt",
  //         title: t("unsavedPrompt.title"),
  //         content: t("unsavedPrompt.message"),
  //         icon: <WarningGold className="warn-icon" />,
  //         okText: t("common.save"),
  //         cancelText: t("common.back"),
  //         onOk: () => {
  //           modal.destroy();
  //         },
  //         onCancel: () => {
  //           unblock();
  //           history.push(location.pathname);
  //         },
  //       });
  //       return false;
  //     }
  //   });

  //   return () => unblock();
  // }, [hasUnsavedChanges, history]);

  const [radioValue, setRadioValue] = useState<string>("");
  const [checkboxValues, setCheckboxValues] = useState<string[]>([]);
  const federalScope = useMemo(
    () =>
      scopeData.find((item) => item.nameEn?.toLowerCase() === "federal") ||
      scopeData[0],
    [scopeData],
  );
  const emiratesScope = useMemo(
    () =>
      scopeData.find((item) => item.nameEn?.toLowerCase() === "emirates") ||
      scopeData.find((item) => item !== federalScope),
    [scopeData, federalScope],
  );
  const federalScopeCode = useMemo(
    () => String(federalScope?.code ?? ""),
    [federalScope],
  );
  const emiratesScopeCode = useMemo(
    () => String(emiratesScope?.code ?? "2"),
    [emiratesScope],
  );
  const emiratesChildrenCodes = useMemo(
    () =>
      scopeData
        .filter(
          (scope) =>
            String(scope.code) !== federalScopeCode &&
            String(scope.code) !== emiratesScopeCode,
        )
        .map((scope) => String(scope.code)),
    [scopeData, federalScopeCode, emiratesScopeCode],
  );

  useEffect(() => {
    const scopeValue = String(watchedScopes ?? scopes ?? "");
    const selectedScopes = scopeValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!selectedScopes?.length) {
      setRadioValue("");
      setCheckboxValues([]);
      return;
    }

    const isFederalOnly =
      selectedScopes.length === 1 && selectedScopes[0] === federalScopeCode;

    if (isFederalOnly) {
      setRadioValue(federalScopeCode);
      setCheckboxValues([]);
      return;
    }

    const isEmiratesSelection =
      selectedScopes.includes(emiratesScopeCode) ||
      selectedScopes.some((code) => emiratesChildrenCodes.includes(code));

    if (!isEmiratesSelection) {
      setRadioValue(selectedScopes[0]);
      setCheckboxValues([]);
      return;
    }

    setRadioValue(emiratesScopeCode);
    setCheckboxValues(
      selectedScopes.filter((code) => emiratesChildrenCodes.includes(code)),
    );
  }, [
    watchedScopes,
    scopes,
    federalScopeCode,
    emiratesScopeCode,
    emiratesChildrenCodes,
  ]);

  const handleScopeChange = (radioVal: string, checkboxVals: string[]) => {
    let scopeValues: string[];

    if (radioVal === emiratesScopeCode) {
      scopeValues = [radioVal, ...checkboxVals].filter(Boolean);
    } else {
      scopeValues = [radioVal].filter(Boolean);
    }

    form.setFieldsValue({ scopes: scopeValues.toString() });
    void form.validateFields(["scopes"]).catch(() => undefined);
  };

  const handleRadioChange = (e: RadioChangeEvent) => {
    const value = e.target.value;
    console.log('value', value);
    setRadioValue(value);

    let nextCheckboxValues: string[] = [];
    if (value !== emiratesScopeCode) {
      setCheckboxValues([]);
    } else {
      nextCheckboxValues = [...emiratesChildrenCodes];
      setCheckboxValues(nextCheckboxValues);
    }

    handleScopeChange(
      value,
      value !== emiratesScopeCode ? [] : nextCheckboxValues,
    );
  };

  const handleCheckboxChange = (values: CheckboxValueType[]) => {
    const selectedValues = values.map((value) => String(value));
    setCheckboxValues(selectedValues);
    handleScopeChange(radioValue, selectedValues);
  };

  // Handle service code input to only allow numbers and limit to 5 digits
  const handleServiceCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove non-digit characters
    value = value.replace(/[^0-9]/g, '');
    // Truncate to 5 digits
    value = value.slice(0, 5);
    // Update form value
    form.setFieldsValue({ code: value });
  };

  const getLimitedServiceNameValue = (
    event?: React.ChangeEvent<HTMLInputElement>,
  ) => String(event?.target?.value ?? "").slice(0, SERVICE_NAME_MAX_LENGTH);

  const getLimitedTextValue = (
    maxLength: number,
    event?: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => String(event?.target?.value ?? "").slice(0, maxLength);

  const validateUserTypes = async (_: unknown, value?: string[]) => {
    const selectedMainUserTypes = normalizeStringArray(
      value ?? form.getFieldValue("userTypes"),
    );

    if (!selectedMainUserTypes.length) {
      return Promise.resolve();
    }

    const shouldValidateEstablishmentSubTypes =
      selectedMainUserTypes.includes(ESTABLISHMENT_USER_TYPE_CODE) &&
      establishmentSubTypeOptions.length > 0;

    if (!shouldValidateEstablishmentSubTypes) {
      return Promise.resolve();
    }

    const selectedAllUserTypes = normalizeStringArray(
      form.getFieldValue("userType"),
    );
    const selectedSubTypes = selectedAllUserTypes.filter(
      (code) => !mainUserTypeCodes.includes(code),
    );

    if (!selectedSubTypes.length) {
      return Promise.reject(
        new Error(t("addNewService.messages.atLeastOneUserType")),
      );
    }

    return Promise.resolve();
  };

  const validateScopes = async (_: unknown, value?: string) => {
    const selectedScopes = normalizeStringArray(
      value ?? form.getFieldValue("scopes"),
    );

    if (!selectedScopes.length) {
      return Promise.resolve();
    }

    const shouldValidateEmiratesChildren =
      selectedScopes.includes(emiratesScopeCode) &&
      emiratesChildrenCodes.length > 0;

    if (!shouldValidateEmiratesChildren) {
      return Promise.resolve();
    }

    const selectedEmiratesChildren = selectedScopes.filter((code) =>
      emiratesChildrenCodes.includes(code),
    );

    if (!selectedEmiratesChildren.length) {
      return Promise.reject(
        new Error(t("addNewService.messages.atLeastOneUserType")),
      );
    }

    return Promise.resolve();
  };

  const validateServiceCode = async (params?: {
    code?: string;
    serviceType?: string;
  }) => {
    const code = params?.code ?? form.getFieldValue("code");
    const serviceType = params?.serviceType ?? form.getFieldValue("type");

    if (!code) return;
    if (!serviceType) return;

    try {
      await IsExistingCodes(code, serviceType, validationServiceId);
      form.setFields([{ name: "code", errors: [] }]);
    } catch (error: unknown) {
      const errorMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      form.setFields([
        {
          name: "code",
          errors: [
            errorMessage ||
              "This Service Code is already in use. Please enter a different code.",
          ],
        },
      ]);
    }
  };

  useEffect(() => {
    const normalizedFrom = String(from ?? "").trim().toLowerCase();
    const currentType = String(
      form.getFieldValue("type") ?? type ?? selectedServiceType ?? "",
    ).trim();

    if (normalizedFrom !== "add") return;
    if (currentType) return;
    if (!Array.isArray(serviceTypes) || !serviceTypes.length) return;
    if (!defaultNewServiceTypeCode) return;

    setSelectedServiceType(defaultNewServiceTypeCode);
    form.setFieldsValue({
      type: defaultNewServiceTypeCode,
      parentId: undefined,
    });
    void validateServiceCode({ serviceType: defaultNewServiceTypeCode });
  }, [
    defaultNewServiceTypeCode,
    form,
    from,
    selectedServiceType,
    serviceTypes,
    type,
  ]);

  useEffect(() => {
    const currentType = String(
      form.getFieldValue("type") ?? selectedServiceType ?? type ?? "",
    ).trim();
    const currentParentId = form.getFieldValue("parentId");
    const currentParentIdText = String(currentParentId ?? "").trim();

    if (!currentType) {
      return;
    }

    if (currentType === NEW_SERVICE_TYPE_CODE) {
      if (currentParentIdText) {
        form.setFieldsValue({ parentId: undefined });
      }
      return;
    }

    const normalizedParentId = normalizeParentServiceValue(
      currentParentId,
      parentServices,
    );
    const normalizedParentIdText = String(normalizedParentId ?? "").trim();

    if (!normalizedParentIdText) {
      if (currentParentIdText) {
        form.setFieldsValue({ parentId: undefined });
      }
      return;
    }

    if (normalizedParentIdText !== currentParentIdText) {
      form.setFieldsValue({ parentId: normalizedParentId });
    }
  }, [form, parentServices, selectedServiceType, type]);
  return (
    <div className="tab-content">
      <Card className="basic-info">
        <h3 className="section-title">{t("addNewService.basicInformation")}</h3>

        <Form
          form={form}
          layout="vertical"
          className="addService-form"
          onValuesChange={() => {
            setHasUnsavedChanges(true);
            onDirtyChange?.(true);
            update({});
          }}
          onChange={() => onFormChange?.()}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item 
                name="code"
                label={t("addNewService.fields.serviceCode")} 
                rules={[
                  {
                    required: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  placeholder={t("addNewService.placeholders.serviceCode")}
                  disabled={!!serviceData.serviceCode && !(serviceCode?.includes('Copy'))}
                  onChange={handleServiceCodeChange}
                  onBlur={() => validateServiceCode()}
                  maxLength={5}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="serviceCategoryId"
                label={t("addNewService.fields.category")}
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Select
                  placeholder={t("addNewService.placeholders.selectCategory")}
                  loading={loading}
                >
                  {serviceCategory.map((category) => (
                    <Option key={category.id} value={category.id}>
                      {i18n.resolvedLanguage === "en"
                        ? category.nameEn
                        : category.nameAr}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="nameEn"
                label={t("addNewService.fields.nameInEnglish")}
                getValueFromEvent={getLimitedServiceNameValue}
                rules={[
                  {
                    required: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_NAME_MAX_LENGTH}
                  placeholder={t("addNewService.placeholders.nameInEnglish")}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nameAr"
                label={t("addNewService.fields.nameInArabic")}
                getValueFromEvent={getLimitedServiceNameValue}
                rules={[
                  {
                    required: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_NAME_MAX_LENGTH}
                  className="ar-input"
                  placeholder={t("addNewService.placeholders.nameInArabic")}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <div className="textarea-desc">
                <Form.Item
                  name="serviceDescriptionEn"
                  label={t("addNewService.fields.descriptionInEnglish")}
                  rules={[
                    {
                      required: true,
                      message: t("common.required"),
                    },
                  ]}
                >
                  <TextArea
                    maxLength={1000}
                    rows={4}
                    placeholder={t("addNewService.placeholders.descriptionInEnglish")}
                  />
                </Form.Item>
                <div className="textarea-desc-count">
                  {form.getFieldValue("serviceDescriptionEn")?.length ?? 0}/1000
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="textarea-desc">
                <Form.Item
                  name="serviceDescriptionAr"
                  label={t("addNewService.fields.descriptionInArabic")}
                  rules={[
                    {
                      required: true,
                      message: t("common.required"),
                    },
                  ]}
                >
                  <TextArea
                    maxLength={1000}
                    className="ar-input"
                    onChange={() => update({})}
                    rows={4}
                    placeholder={t("addNewService.placeholders.descriptionInArabic")}
                  />
                </Form.Item>
                <div className="textarea-desc-count">
                  {form.getFieldValue("serviceDescriptionAr")?.length ?? 0}/1000
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="serviceFeeEn"
                label={t("addNewService.fields.serviceFeeEn")}
                getValueFromEvent={(event) =>
                  getLimitedTextValue(SERVICE_INFO_INPUT_MAX_LENGTH, event)
                }
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_INFO_INPUT_MAX_LENGTH}
                  placeholder={t("addNewService.placeholders.serviceFeeEn")}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="serviceFeeAr"
                label={t("addNewService.fields.serviceFeeAr")}
                getValueFromEvent={(event) =>
                  getLimitedTextValue(SERVICE_INFO_INPUT_MAX_LENGTH, event)
                }
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_INFO_INPUT_MAX_LENGTH}
                  className="ar-input"
                  placeholder={t("addNewService.placeholders.serviceFeeAr")}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="serviceDeliveryTimeEn"
                label={t("addNewService.fields.serviceDeliveryTimeEn")}
                getValueFromEvent={(event) =>
                  getLimitedTextValue(SERVICE_INFO_INPUT_MAX_LENGTH, event)
                }
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_INFO_INPUT_MAX_LENGTH}
                  placeholder={t(
                    "addNewService.placeholders.serviceDeliveryTimeEn",
                  )}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="serviceDeliveryTimeAr"
                label={t("addNewService.fields.serviceDeliveryTimeAr")}
                getValueFromEvent={(event) =>
                  getLimitedTextValue(SERVICE_INFO_INPUT_MAX_LENGTH, event)
                }
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input
                  maxLength={SERVICE_INFO_INPUT_MAX_LENGTH}
                  className="ar-input"
                  placeholder={t(
                    "addNewService.placeholders.serviceDeliveryTimeAr",
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <div className="textarea-desc">
                <Form.Item
                  name="termsConditionsEn"
                  label={t("addNewService.fields.termsAndConditionsEn")}
                  getValueFromEvent={(event) =>
                    getLimitedTextValue(SERVICE_INFO_TEXTAREA_MAX_LENGTH, event)
                  }
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t("common.required"),
                    },
                  ]}
                >
                  <TextArea
                    maxLength={SERVICE_INFO_TEXTAREA_MAX_LENGTH}
                    rows={4}
                    placeholder={t(
                      "addNewService.placeholders.termsAndConditionsEn",
                    )}
                  />
                </Form.Item>
                <div className="textarea-desc-count">
                  {form.getFieldValue("termsConditionsEn")?.length ?? 0}/
                  {SERVICE_INFO_TEXTAREA_MAX_LENGTH}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="textarea-desc">
                <Form.Item
                  name="termsConditionsAr"
                  label={t("addNewService.fields.termsAndConditionsAr")}
                  getValueFromEvent={(event) =>
                    getLimitedTextValue(SERVICE_INFO_TEXTAREA_MAX_LENGTH, event)
                  }
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t("common.required"),
                    },
                  ]}
                >
                  <TextArea
                    maxLength={SERVICE_INFO_TEXTAREA_MAX_LENGTH}
                    className="ar-input"
                    rows={4}
                    placeholder={t(
                      "addNewService.placeholders.termsAndConditionsAr",
                    )}
                  />
                </Form.Item>
                <div className="textarea-desc-count">
                  {form.getFieldValue("termsConditionsAr")?.length ?? 0}/
                  {SERVICE_INFO_TEXTAREA_MAX_LENGTH}
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="type"
                label={
                  <span>
                    {t("addNewService.fields.serviceType")}
                    <Tooltip
                      title={
                        <div>
                          <div>
                            <b>
                              {t("addNewService.serviceTypeHelp.new.label")}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.new.description",
                            )}
                          </div>
                          <div>
                            <b>
                              {t("addNewService.serviceTypeHelp.renew.label")}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.renew.description",
                            )}
                          </div>
                          <div>
                            <b>
                              {t("addNewService.serviceTypeHelp.modify.label")}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.modify.description",
                            )}
                          </div>
                          <div>
                            <b>
                              {t("addNewService.serviceTypeHelp.cancel.label")}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.cancel.description",
                            )}
                          </div>
                          <div>
                            <b>
                              {t("addNewService.serviceTypeHelp.transfer.label")}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.transfer.description",
                            )}
                          </div>
                          <div>
                            <b>
                              {t(
                                "addNewService.serviceTypeHelp.partnerManagement.label",
                              )}
                            </b>{" "}
                            -{" "}
                            {t(
                              "addNewService.serviceTypeHelp.partnerManagement.description",
                            )}
                          </div>
                        </div>
                      }
                    >
                      <img className="info-icon" src={messageQuestionIcon} />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Select
                  placeholder={t("addNewService.placeholders.selectType")}
                  loading={loading}
                  disabled={serviceData.status === "3"}
                  onChange={async (value) => {
                    setSelectedServiceType(value);
                    const normalizedParentId =
                      value === NEW_SERVICE_TYPE_CODE
                        ? undefined
                        : normalizeParentServiceValue(
                            form.getFieldValue("parentId"),
                            parentServices,
                          );

                    if (
                      value === NEW_SERVICE_TYPE_CODE ||
                      normalizedParentId === undefined
                    ) {
                      form.setFieldsValue({ parentId: undefined });
                    } else if (
                      String(normalizedParentId).trim() !==
                      String(form.getFieldValue("parentId") ?? "").trim()
                    ) {
                      form.setFieldsValue({ parentId: normalizedParentId });
                    }
                    await validateServiceCode({ serviceType: value });
                  }}
                >
                  {serviceTypes.map((type) => (
                    <Option key={type.id} value={type.code}>
                      {i18n.resolvedLanguage === "en" ? type.nameEn : type.nameAr}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {/* Display Related New Service when serviceType is not "New" (code=2) */}
            {selectedServiceType && selectedServiceType !== NEW_SERVICE_TYPE_CODE && (
              <Col span={12}>
                <Form.Item
                  name="parentId"
                  label={
                    <span>
                      {t("addNewService.fields.relatedNewService")}
                      <Tooltip
                        title={
                          <div>
                            {t(
                              "addNewService.hints.relatedNewService",
                            )}
                          </div>
                        }
                      >
                        <img className="info-icon" src={messageQuestionIcon} />
                      </Tooltip>
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      message: t("common.required"),
                    },
                  ]}
                >
                  <Select
                  className="umc-select-arrow-manual"
                    showSearch
                    placeholder={t("addNewService.placeholders.searchService")}
                    loading={loading}
                    optionFilterProp="children"
                    filterOption={(input, option) => {
                      const label = option?.children?.toString() || "";
                      return label.toLowerCase().includes(input.toLowerCase());
                    }}
                    onChange={(value) => {
                      const service = parentServices.find(
                        (item) => item.id === value,
                      );
                      if (from === "add" && service) {
                        loadServiceData?.(service.code, true);
                      }
                    }}
                  >
                    {parentServices.map((service) => (
                      <Option key={service.id} value={service.id}>
                        {i18n.resolvedLanguage === "en"
                          ? service.nameEn
                          : service.nameAr}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Card>
      {/* Advanced Information Section */}
      <Card className="advanced-section">
        <h3 className="section-title">
          {t("addNewService.advancedInformation")}
        </h3>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            setHasUnsavedChanges(true);
            onDirtyChange?.(true);
          }}
          className="addService-form"
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label={t("addNewService.fields.loginRequired")}
                name="loginRequired"
                required
              >
                <Radio.Group
                  defaultValue={"no"}
                  value={loginRequired}
                  onChange={(e) => setLoginRequired(e.target.value)}
                >
                  <Radio value="yes">
                    {t("addNewService.loginRequired.yes")}
                  </Radio>
                  <Radio value="no">
                    {t("addNewService.loginRequired.no")}
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label={
                  <span>
                    {t("addNewService.fields.responsibleDepartment")}{" "}
                    <Tooltip
                      title={t(
                        "addNewService.hints.responsibleDepartment",
                      )}
                    >
                      <img className="info-icon" src={messageQuestionIcon} />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Select
                  placeholder={t("addNewService.placeholders.selectDepartment")}
                  loading={loading}
                >
                  {responsibleDepartment.map((dept) => (
                    <Option key={dept.id} value={dept.id}>
                      {i18n.resolvedLanguage === "en" ? dept.nameEn : dept.nameAr}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div className="form-scopeBlock">
            <Form.Item name="userType" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label={
                <span>
                  {t("addNewService.fields.userTypes")}
                  <Tooltip title={t("addNewService.hints.userTypes")}>
                    <img className="info-icon" src={messageQuestionIcon} />
                  </Tooltip>
                </span>
              }
              name="userTypes"
              rules={[
                { required: true, message: t("common.required") },
                { validator: validateUserTypes },
              ]}
              required
            >
              <Checkbox.Group
                value={userTypes}
                onChange={handleUserTypeChange}
                className="checkbox-group"
              >
                {mainUserTypeOptions.map(({ option, value }) => (
                  <Checkbox key={option.id} value={value}>
                    {i18n.resolvedLanguage === "en" ? option.nameEn : option.nameAr}
                  </Checkbox>
                ))}
              </Checkbox.Group>

              {establishmentSubTypeOptions.length > 0 &&
                userTypes.includes(ESTABLISHMENT_USER_TYPE_CODE) && (
                  <div className="sub-section">
                    <div className="sub-section-title">
                      {t("addNewService.establishmentSubTypes.title")}
                    </div>
                    <Checkbox.Group
                      value={establishmentSubTypes}
                      onChange={handleEstablishmentSubTypeChange}
                      className="checkbox-group-grid"
                    >
                      {/* Display all options from 3rd onwards as sub-options */}
                      {establishmentSubTypeOptions.map((subType) => (
                        <Checkbox key={subType.id} value={String(subType.code)}>
                          {i18n.resolvedLanguage === "en"
                            ? subType.nameEn
                            : subType.nameAr}
                        </Checkbox>
                      ))}
                    </Checkbox.Group>
                  </div>
                )}
            </Form.Item>
          </div>
          <div className="form-scopeBlock">
            <Form.Item
              label={
                <span>
                  {t("addNewService.fields.scope")}{" "}
                  <Tooltip title={t("addNewService.hints.scope")}>
                    <img className="info-icon" src={messageQuestionIcon} />
                  </Tooltip>
                </span>
              }
              name="scopes"
              rules={[
                { required: true, message: t("common.required") },
                { validator: validateScopes },
              ]}
              required
            >
              {scopeData.length && (
                <Radio.Group
                  value={radioValue}
                  onChange={handleRadioChange}
                  className="checkbox-group"
                >
                  <Radio
                    key={`radio-${federalScopeCode}`}
                    value={federalScopeCode}
                  >
                    {i18n.resolvedLanguage === "en"
                      ? federalScope?.nameEn
                      : federalScope?.nameAr}
                  </Radio>
                  <Radio key={`radio-${emiratesScopeCode}`} value={emiratesScopeCode}>
                    {i18n.resolvedLanguage === "en"
                      ? emiratesScope?.nameEn ||
                        t("addNewService.emirates.title")
                      : emiratesScope?.nameAr ||
                        t("addNewService.emirates.title")}
                  </Radio>
                </Radio.Group>
              )}

              {/* {radioValue == "Emirates" && (
                
              )} */}
              <div className="sub-section" style={{display: radioValue === emiratesScopeCode ? "block" : "none"}}>
                <div className="sub-section-title">
                  {t("addNewService.emirates.title")}
                </div>
                <Checkbox.Group
                  value={checkboxValues}
                  onChange={handleCheckboxChange}
                  className="checkbox-group-grid"
                >
                  {/* Display all options from 3rd onwards as sub-options */}
                  {scopeData
                    .filter(
                      (scope) =>
                        String(scope.code) !== federalScopeCode &&
                        String(scope.code) !== emiratesScopeCode,
                    )
                    .map((subType) => (
                      <Checkbox
                        key={`chk-${subType.id}`}
                        value={subType.code}
                      >
                        {i18n.resolvedLanguage === "en"
                          ? subType.nameEn
                          : subType.nameAr}
                      </Checkbox>
                    ))}
                </Checkbox.Group>
              </div>
            </Form.Item>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ServicesInformation;
