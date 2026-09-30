import * as React from "react";
import { Checkbox, Modal, Form, Input, Select, Row, Col } from "antd";
import { useTranslation } from "react-i18next";
import type {
  SocialMediaItem,
  SocialMediaModalMode,
} from "./SocialMediaAccountField";
import CustomButton from "../../../../common/CustomButton";
import DocumentViewer from "../../../../common/DocumentViewer";
import {
  getLookupData,
  getSocialMediaSubCategory,
} from "../../../../../services/services";
import { useServicesStore } from "@/store/services";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import CustomMessage from "@/components/common/CustomMessage";
import { SocialMediaAccountIcon } from "./SocialMediaAccountIcon";

const { Option } = Select;

interface AddSocialMediaModalProps {
  visible: boolean;
  mode?: SocialMediaModalMode;
  editingItem: SocialMediaItem | null;
  onSave: (item: Omit<SocialMediaItem, "id">) => void;
  onCancel: () => void;
  title?: string;
  serviceCode?: string | number | null;
  designMode?: boolean;
}

export const AddSocialMediaModal: React.FC<AddSocialMediaModalProps> = ({
  visible,
  mode = "add",
  editingItem,
  onSave,
  onCancel,
  title,
  serviceCode: serviceCodeProp,
  designMode = false,
}) => {
  const { t, i18n } = useTranslation();
  const storedServiceCode = useServicesStore(
    (state) => state.userInfo.servicesCode,
  );
  const serviceCode = serviceCodeProp ?? storedServiceCode;
  const [form] = Form.useForm();
  const selectedMediaCategory = Form.useWatch("mediaCategory", form);
  const selectedMediaSubCategoriesValue = Form.useWatch(
    "mediaSubCategories",
    form,
  );
  const selectedMediaSubCategories: string[] = Array.isArray(
    selectedMediaSubCategoriesValue,
  )
    ? selectedMediaSubCategoriesValue.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const [mediaCategoriesRaw, setMediaCategoriesRaw] = React.useState<
    unknown[]
  >([]);
  const [mediaSubCategoriesRaw, setMediaSubCategoriesRaw] = React.useState<
    unknown[]
  >([]);
  const [accountTypesRaw, setAccountTypesRaw] = React.useState<unknown[]>([]);
  const [
    mediaCategoryForSubCategories,
    setMediaCategoryForSubCategories,
  ] = React.useState<string>();

  const isAr = Boolean(i18n.language?.startsWith("ar"));

  const mediaCategories = React.useMemo(
    () =>
      normalizeLookupOptions(mediaCategoriesRaw, isAr).map((item) => ({
        value: String(item.value),
        label: item.label,
      })),
    [mediaCategoriesRaw, isAr],
  );

  const mediaSubCategories = React.useMemo(
    () =>
      normalizeLookupOptions(mediaSubCategoriesRaw, isAr).map((item) => ({
        value: String(item.value),
        label: item.label,
      })),
    [mediaSubCategoriesRaw, isAr],
  );

  const accountTypeNameByValue = React.useMemo(() => {
    const labels = normalizeLookupOptions(accountTypesRaw, false);

    return new Map(
      labels.map((item) => [String(item.value), item.label] as const),
    );
  }, [accountTypesRaw]);

  const accountTypes = React.useMemo(
    () =>
      normalizeLookupOptions(accountTypesRaw, isAr).map((item) => ({
        value: String(item.value),
        label: item.label,
        nameEn: accountTypeNameByValue.get(String(item.value)),
      })),
    [accountTypesRaw, accountTypeNameByValue, isAr],
  );

  const p = "SocialMediaAccount" as const;
  const isViewMode = mode === "view";
  const isRuntimeMultiSelect = designMode === false;
  const mediaSubCategoryValues = mediaSubCategories.map((item) => item.value);
  const allMediaSubCategoriesSelected =
    mediaSubCategoryValues.length > 0 &&
    mediaSubCategoryValues.every((value) =>
      selectedMediaSubCategories.includes(value),
    );
  const hasSelectedMediaSubCategories = mediaSubCategoryValues.some((value) =>
    selectedMediaSubCategories.includes(value),
  );
  const handleSelectAllMediaSubCategories = (checked: boolean) => {
    if (
      !isRuntimeMultiSelect ||
      isViewMode ||
      mediaSubCategoryValues.length === 0
    )
      return;
    form.setFieldsValue({
      mediaSubCategories: checked ? mediaSubCategoryValues : [],
    });
  };

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getLookupData("SocialMediaCategories", serviceCode)
      .then((res: { data?: unknown }) => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setMediaCategoriesRaw(list);
      })
      .catch(() => {
        if (!cancelled) {
          setMediaCategoriesRaw([]);
        }
      });

    getLookupData("SocialMedias", serviceCode)
      .then((res: { data?: unknown }) => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setAccountTypesRaw(list);
      })
      .catch(() => {
        if (!cancelled) {
          setAccountTypesRaw([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, serviceCode]);

  React.useEffect(() => {
    if (!visible) return;
    if (!mediaCategoryForSubCategories) {
      setMediaSubCategoriesRaw([]);
      return;
    }
    let cancelled = false;
    getSocialMediaSubCategory(mediaCategoryForSubCategories)
      .then((res: { data?: unknown }) => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setMediaSubCategoriesRaw(list);
      })
      .catch(() => {
        if (!cancelled) {
          setMediaSubCategoriesRaw([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, mediaCategoryForSubCategories]);
  React.useEffect(() => {
    if (visible) {
      if (editingItem) {
        form.setFieldsValue({
          mediaCategory: editingItem.mediaCategory,
          mediaSubCategories: editingItem.mediaSubCategories,
          accountType: editingItem.accountType,
          accountTitle: editingItem.accountTitle,
          accountUrl: editingItem.accountUrl,
          screenshot: editingItem.screenshot,
        });
        setMediaCategoryForSubCategories(editingItem.mediaCategory);
      } else {
        form.resetFields();
        setMediaCategoryForSubCategories(undefined);
      }
    }
  }, [visible, editingItem, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSave({
        accountName: values.accountTitle,
        accountUrl: values.accountUrl,
        mediaCategory: values.mediaCategory,
        mediaSubCategories: values.mediaSubCategories,
        accountType: values.accountType,
        accountTitle: values.accountTitle,
        screenshot: values.screenshot,
      });
      CustomMessage.success(t(`${p}.addSuccess`));
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleMediaCategoryChange = (mediaCategory: string) => {
    setMediaCategoryForSubCategories(mediaCategory);
    form.setFieldsValue({ mediaSubCategories: [] });
  };

  const resolvedTitle =
    title ??
    (isViewMode
      ? t(`${p}.modalViewTitle`)
      : editingItem
      ? t(`${p}.modalEditTitle`)
      : t(`${p}.modalAddTitle`));

  return (
    <Modal
      centered
      title={resolvedTitle}
      visible={visible}
      onCancel={onCancel}
      width={900}
      className="social-media-modal"
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        disabled={isViewMode}
        layout="vertical"
        className="custorm-form social-media-form"
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="mediaCategory"
              label={<span>{t(`${p}.mediaCategory`)}</span>}
              rules={[
                { required: true, message: t(`${p}.mediaCategoryRequired`) },
              ]}
            >
              <Select
                placeholder={t(`${p}.mediaCategoryPlaceholder`)}
                showSearch
                optionFilterProp="children"
                className="umc-select-arrow-manual"
                onChange={handleMediaCategoryChange}
              >
                {mediaCategories.map((cat) => (
                  <Option key={cat.value} value={cat.value}>
                    {cat.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="mediaSubCategories"
              label={<span>{t(`${p}.mediaSubCategory`)}</span>}
              rules={[
                {
                  required: true,
                  message: t(`${p}.mediaSubCategoryRequired`),
                },
              ]}
            >
              <Select
                key={`media-sub-categories-${selectedMediaCategory || "empty"}`}
                mode="multiple"
                placeholder={t(`${p}.mediaSubCategoryPlaceholder`)}
                maxTagCount={2}
                showArrow
                showSearch
                optionFilterProp={isRuntimeMultiSelect ? "title" : "children"}
                optionLabelProp={isRuntimeMultiSelect ? "label" : undefined}
                className={
                  isRuntimeMultiSelect
                    ? "Formily-multi-select social-media-sub-category-multi-select"
                    : "Formily-multi-select"
                }
                dropdownClassName={
                  isRuntimeMultiSelect
                    ? "social-media-sub-category-multi-select-dropdown"
                    : undefined
                }
                dropdownRender={
                  isRuntimeMultiSelect
                    ? (menu) => (
                        <div>
                          <div className="social-media-sub-category-multi-select-all">
                            <Checkbox
                              className={
                                hasSelectedMediaSubCategories &&
                                !allMediaSubCategoriesSelected
                                  ? "social-media-sub-category-multi-select-all-checkbox has-selection"
                                  : "social-media-sub-category-multi-select-all-checkbox"
                              }
                              checked={allMediaSubCategoriesSelected}
                              disabled={
                                isViewMode ||
                                mediaSubCategoryValues.length === 0
                              }
                              onChange={(event) =>
                                handleSelectAllMediaSubCategories(
                                  event.target.checked,
                                )
                              }
                            >
                              {t("LanguageSelectMulti.selectAll")}
                            </Checkbox>
                          </div>
                          <div>{menu}</div>
                        </div>
                      )
                    : undefined
                }
              >
                {mediaSubCategories.map((cat) => (
                  <Option
                    key={cat.value}
                    value={cat.value}
                    title={cat.label}
                    label={
                      isRuntimeMultiSelect ? (
                        <div className="social-media-sub-category-multi-selection-item">
                          <Checkbox checked />
                          <span>{cat.label}</span>
                        </div>
                      ) : undefined
                    }
                  >
                    {isRuntimeMultiSelect ? (
                      <div className="social-media-sub-category-multi-option">
                        <Checkbox
                          checked={selectedMediaSubCategories.includes(cat.value)}
                        />
                        <span>{cat.label}</span>
                      </div>
                    ) : (
                      cat.label
                    )}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="accountType"
              label={<span>{t(`${p}.accountType`)}</span>}
              rules={[
                { required: true, message: t(`${p}.accountTypeRequired`) },
              ]}
            >
              <Select
                placeholder={t(`${p}.accountTypePlaceholder`)}
                showSearch
                optionFilterProp="label"
                className="umc-select-arrow-manual"
              >
                {accountTypes.map((type) => (
                  <Option
                    key={type.value}
                    value={type.value}
                    label={type.label}
                  >
                    <span className="social-media-account-type-option">
                      <SocialMediaAccountIcon
                        nameEn={type.nameEn}
                        className="social-media-account-type-option__icon"
                      />
                      <span className="social-media-account-type-option__label">
                        {type.label}
                      </span>
                    </span>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="accountTitle"
              label={<span>{t(`${p}.accountTitle`)}</span>}
              rules={[
                { required: true, message: t(`${p}.accountTitleRequired`) },
                {
                  pattern: /^.{0,200}$/,
                  message: t(`${p}.accountTitleMax`),
                },
              ]}
            >
              <Input placeholder={t(`${p}.accountTitlePlaceholder`)} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="accountUrl"
              label={<span>{t(`${p}.accountUrl`)}</span>}
              rules={[
                { required: true, message: t(`${p}.accountUrlRequired`) },
                {
                  pattern: /^.{0,300}$/,
                  message: t(`${p}.accountUrlMax`),
                },
                {
                  validator: async (_, value?: string) => {
                    if (!value) return;
                    try {
                      const url = new URL(value.trim());
                      if (url.protocol === "http:" || url.protocol === "https:") {
                        return;
                      }
                    } catch {
                      // Fall through to the validation error below.
                    }
                    throw new Error(t(`${p}.accountUrlInvalid`));
                  },
                },
              ]}
            >
              <Input placeholder={t(`${p}.accountUrlPlaceholder`)} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              className="ant-formily-item-control-content-component"
              name="screenshot"
              label={t(`${p}.screenshotLabel`)}
            >
              <DocumentViewer
                disabled={isViewMode}
                hasDelete={!isViewMode}
                uploadConfig={{
                  maxCount: 1,
                  maxSize: 5,
                  placeholder: t(`${p}.uploadPlaceholder`),
                  uploadTip: t(`${p}.uploadTip`),
                  accept: ".jpg,.jpeg,.png",
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div className="social-media-modal-footer">
        <CustomButton variant="outline" onClick={onCancel}>
          {t(`${p}.cancel`)}
        </CustomButton>
        {!isViewMode && (
          <CustomButton variant="gold" onClick={handleSubmit}>
            {t(`${p}.save`)}
          </CustomButton>
        )}
      </div>
    </Modal>
  );
};
