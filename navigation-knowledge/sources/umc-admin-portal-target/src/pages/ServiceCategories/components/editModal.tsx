import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Input, Form, Row, Col } from "antd";
import { CustomButton, CustomMessage } from "@/components/common";
import {
  updateServiceCategory,
  addServiceCategory,
  checkServiceCategoryNameExists,
} from "@/services/serviceApi";
import { useTranslation } from "react-i18next";
import {
  serviceCategoryIconOptions,
  type ServiceCategoryIconType,
} from "../categoryIcons";
interface EditModalProps {
  show: boolean;
  close: () => void;
  formData?: {
    id: string;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    iconUri?: string;
  };
  updateData: () => void;
}
interface SelectIconItem {
  checked: boolean;
  src: string;
  name: ServiceCategoryIconType;
}

type CategoryNameField = "nameEn" | "nameAr";
type NameCheckCache = Record<CategoryNameField, Record<string, boolean>>;
type InitialCategoryNameValues = Record<CategoryNameField, string>;

const createNameCheckCache = (): NameCheckCache => ({
  nameEn: {},
  nameAr: {},
});

const createInitialCategoryNameValues = (): InitialCategoryNameValues => ({
  nameEn: "",
  nameAr: "",
});

const normalizeCategoryName = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

const isFormValidationError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "errorFields" in error &&
      Array.isArray(
        (error as { errorFields?: unknown[] }).errorFields
      )
  );

const { TextArea } = Input;
const EditModal: React.FC<EditModalProps> = ({
  show,
  close,
  formData,
  updateData,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSaveDisabled, setIsSaveDisabled] = useState(false);
  const isMountedRef = useRef(true);
  const nameCheckCacheRef = useRef<NameCheckCache>(createNameCheckCache());
  const initialNameValuesRef = useRef<InitialCategoryNameValues>(
    createInitialCategoryNameValues()
  );
  const fieldValidationIndexRef = useRef<Record<CategoryNameField, number>>({
    nameEn: 0,
    nameAr: 0,
  });
  const [iconList, setIconList] = useState<SelectIconItem[]>(() =>
    serviceCategoryIconOptions.map((item) => ({
      ...item,
      checked: item.name === "icon1",
    }))
  );
  const onFieldsChange = useCallback(() => {
    const values = form.getFieldsValue();
    const isValid =
      values.nameEn?.trim() &&
      values.nameAr?.trim() &&
      values.descriptionEn?.trim() &&
      values.descriptionAr?.trim();
    setIsSaveDisabled(!isValid);
  }, [form]);
  const resetNameValidationState = useCallback(() => {
    nameCheckCacheRef.current = createNameCheckCache();
    fieldValidationIndexRef.current = {
      nameEn: 0,
      nameAr: 0,
    };
  }, []);
  useEffect(() => {
    resetNameValidationState();
    initialNameValuesRef.current = {
      nameEn: normalizeCategoryName(formData?.id ? formData.nameEn : ""),
      nameAr: normalizeCategoryName(formData?.id ? formData.nameAr : ""),
    };

    if (formData?.id) {
      setTimeout(() => {
        form.setFieldsValue({
          nameEn: formData.nameEn,
          nameAr: formData.nameAr,
          descriptionEn: formData.descriptionEn,
          descriptionAr: formData.descriptionAr,
        });
        Promise.resolve().then(() => {
          onFieldsChange();
        });
      }, 0);
      setIconList((previousIconList) => {
        const matchedIndex = previousIconList.findIndex(
          (item) => item.name === formData.iconUri
        );

        if (matchedIndex === -1) {
          return previousIconList;
        }

        return previousIconList.map((item, index) => ({
          ...item,
          checked: index === matchedIndex,
        }));
      });
    } else {
      form.resetFields();
      setIconList((previousIconList) =>
        previousIconList.map((item) => ({
          ...item,
          checked: item.name === "icon1",
        }))
      );
      onFieldsChange();
    }
  }, [formData, form, onFieldsChange, resetNameValidationState]);
  useEffect(() => {
    onFieldsChange();
  }, [onFieldsChange]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const validateCategoryName = useCallback(
    async (fieldName: CategoryNameField, value?: string) => {
      const normalizedValue = normalizeCategoryName(value);

      if (!normalizedValue) {
        return Promise.resolve();
      }

      if (
        formData?.id &&
        normalizedValue === initialNameValuesRef.current[fieldName]
      ) {
        return Promise.resolve();
      }

      const cachedResult = nameCheckCacheRef.current[fieldName][normalizedValue];

      if (typeof cachedResult === "boolean") {
        if (cachedResult) {
          return Promise.reject(
            new Error(t("serviceCategories.validation.categoryExists"))
          );
        }

        return Promise.resolve();
      }

      const currentValidationIndex =
        fieldValidationIndexRef.current[fieldName] + 1;
      fieldValidationIndexRef.current[fieldName] = currentValidationIndex;

      try {
        const res = await checkServiceCategoryNameExists(
          fieldName === "nameEn"
            ? { nameEn: normalizedValue }
            : { nameAr: normalizedValue }
        );

        if (
          !isMountedRef.current ||
          currentValidationIndex !== fieldValidationIndexRef.current[fieldName]
        ) {
          return Promise.resolve();
        }

        const isExists = res?.data === true;
        nameCheckCacheRef.current[fieldName][normalizedValue] = isExists;

        if (isExists) {
          return Promise.reject(
            new Error(t("serviceCategories.validation.categoryExists"))
          );
        }

        return Promise.resolve();
      } catch {
        if (
          !isMountedRef.current ||
          currentValidationIndex !== fieldValidationIndexRef.current[fieldName]
        ) {
          return Promise.resolve();
        }

        return Promise.resolve();
      }
    },
    [formData?.id, t]
  );

  const handleCancel = useCallback(() => {
    close();
  }, [close]);
  const saveHanld = useCallback(async () => {
    if (saveLoading) {
      return;
    }

    setSaveLoading(true);

    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        PmoCode: "PMO1",
        id: formData?.id,
        iconUri: iconList.find((item) => item.checked)?.name,
      };

      if (formData?.id) {
        await updateServiceCategory(formData.id as string, payload);
        resetNameValidationState();
        close();
        updateData();
        CustomMessage.success(t("serviceCategories.messages.editSuccess"));
        return;
      }

      await addServiceCategory(payload);
      resetNameValidationState();
      close();
      updateData();
      CustomMessage.success(t("serviceCategories.messages.addSuccess"));
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }
      console.error("Failed to save service category:", error);
      CustomMessage.error(t("common.operationFailed"));
    } finally {
      if (isMountedRef.current) {
        setSaveLoading(false);
      }
    }
  }, [
    close,
    form,
    formData?.id,
    iconList,
    resetNameValidationState,
    saveLoading,
    t,
    updateData,
  ]);
  const checkIcon = useCallback((index: number) => {
    const newIconList = iconList.map((item, i) => {
      if (i === index) {
        return { ...item, checked: true };
      }
      return { ...item, checked: false };
    });
    setIconList(newIconList);
  }, [iconList]);
  const icons = iconList.map((item, i) => (
    <div
      className={`icon-item ${item.checked ? "select-item" : ""}`}
      key={i}
      onClick={() => checkIcon(i)}
    >
      <img src={item.src} alt={item.name} />
    </div>
  ));
  return (
    <Modal
      width={960}
      centered
      wrapClassName="service-modal service-category-modal"
      title={t(
        formData?.id
          ? "serviceCategories.editModal.titleEdit"
          : "serviceCategories.editModal.titleAdd"
      )}
      destroyOnClose
      visible={show}
      onCancel={handleCancel}
      footer={
        <div>
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            customClassName="footer-btn"
            onClick={handleCancel}
          />
          <CustomButton
            text={t("common.save")}
            variant="primary"
            customClassName="footer-btn"
            loading={saveLoading}
            disabled={isSaveDisabled}
            customStyle={{ marginLeft: "16px" }}
            onClick={saveHanld}
          />
        </div>
      }
    >
      <Form
        className="fee-form"
        form={form}
        onFieldsChange={onFieldsChange}
        layout="vertical"
      >
        <Row gutter={16} className="form-two-column-row">
          <Col className="gutter-row" flex={1}>
            <Form.Item
              name="nameEn"
              validateTrigger="onBlur"
              label={t("serviceCategories.editModal.nameEn")}
              rules={[
                { required: true, message: t("common.required") },
                {
                  validator: (_, value) =>
                    validateCategoryName("nameEn", value),
                },
              ]}
            >
              <Input
                maxLength={100}
                placeholder={t("serviceCategories.editModal.nameEnPlaceholder")}
              />
            </Form.Item>
          </Col>
          <Col className="gutter-row" flex={1}>
            <Form.Item
              name="nameAr"
              validateTrigger="onBlur"
              label={t("serviceCategories.editModal.nameAr")}
              rules={[
                { required: true, message: t("common.required") },
                {
                  validator: (_, value) =>
                    validateCategoryName("nameAr", value),
                },
              ]}
            >
              <Input
                className="arabic-input"
                maxLength={100}
                placeholder={t("serviceCategories.editModal.nameArPlaceholder")}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16} className="mt-24 form-two-column-row">
          <Col className="gutter-row" flex={1}>
            <Form.Item
              name="descriptionEn"
              validateTrigger="onBlur"
              label={t("serviceCategories.editModal.descriptionEn")}
              rules={[{ required: true, message: t("common.required") }]}
            >
              <TextArea
                maxLength={1000}
                showCount
                rows={4}
                placeholder={t(
                  "serviceCategories.editModal.descriptionEnPlaceholder"
                )}
              />
            </Form.Item>
          </Col>
          <Col className="gutter-row" flex={1}>
            <Form.Item
              name="descriptionAr"
              validateTrigger="onBlur"
              label={t("serviceCategories.editModal.descriptionAr")}
              rules={[{ required: true, message: t("common.required") }]}
            >
              <TextArea
                className="arabic-input"
                maxLength={1000}
                showCount
                rows={4}
                placeholder={t(
                  "serviceCategories.editModal.descriptionArPlaceholder"
                )}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          className="select-icon"
          label={t("serviceCategories.editModal.selectIcon")}
          required
        >
          <div className="icon-list">{icons}</div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditModal;
