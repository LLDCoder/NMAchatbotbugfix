import * as React from "react";
import { observer, useField, useForm } from "@formily/react";
import { Card, Tag, Modal, Tooltip } from "antd";
import CustomButton from "../../../../common/CustomButton";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import { AddSocialMediaModal } from "./AddSocialMediaModal";
import { getLookupData } from "../../../../../services/services";
import i18n from "@/localization/config";
import { renderDesignerTooltipIcon } from "../DesignerTooltip";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { useServicesStore } from "@/store/services";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import { resolveExternalWebUrl } from "@/utils/externalWebUrl";
import { SocialMediaAccountIcon } from "./SocialMediaAccountIcon";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import "./styles.less";

export type SocialMediaModalMode = "add" | "edit" | "view";

export type SocialMediaItem = {
  id: string;
  accountName?: string;
  accountUrl?: string;
  mediaCategory?: string;
  mediaSubCategories?: string[];
  accountType?: string;
  accountTitle?: string;
  screenshot?: string;
  operation?: "ADD" | "MODIFY" | "DELETE";
};

type SocialMediaAccountProps = Record<string, unknown> & {
  disabled?: boolean;
  serviceCode?: string | number | null;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type SocialMediaAccountFormField = {
  value?: unknown;
  setValue: (value: SocialMediaItem[]) => void;
  decoratorProps?: Record<string, unknown>;
  pattern?: string;
  designable?: boolean;
};

type NormalizedLookupOption = {
  value: string;
  label: string;
};

export const SocialMediaAccountField: React.FC<SocialMediaAccountProps> =
  observer((props) => {
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const t = i18n.getFixedT(lang);
    const field = useField() as unknown as SocialMediaAccountFormField;
    const form = useForm<{ pattern?: string }>();
    const storedServiceCode = useServicesStore(
      (state) => state.userInfo.servicesCode,
    );
    const serviceCode = props.serviceCode ?? storedServiceCode;
    const value = (
      Array.isArray(field.value) ? field.value : []
    ) as SocialMediaItem[];

    const {
      labelName: legacyLabelName,
      titleEn,
      titleAr,
      addButtonLabel: legacyAddButtonLabel,
      addButtonLabelEn,
      addButtonLabelAr,
      disabled = false,
    } = props;

    const fieldPattern = field?.pattern;
    const formPattern = form?.pattern;
    const isReviewMode = fieldPattern === "readPretty";
    const isFormLocked =
      formPattern === "disabled" ||
      formPattern === "readOnly" ||
      formPattern === "readPretty";
    const hideActionButtons =
      Boolean(disabled) ||
      fieldPattern === "disabled" ||
      fieldPattern === "readOnly" ||
      isReviewMode ||
      isFormLocked;

    const isReadOnlyMode =
      !!props.disabled ||
      field.pattern === "disabled" ||
      field.pattern === "readOnly" ||
      isReviewMode ||
      isFormLocked;

    const tx = React.useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(t(`SocialMediaAccount.${key}`, options)),
      [t],
    );

    const resolvedLabelName = getBilingualValueByLang({
      lang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: legacyLabelName,
      fallback: tx("defaultTitle"),
    });
    const resolvedAddButtonLabel = getBilingualValueByLang({
      lang,
      host,
      en: addButtonLabelEn,
      ar: addButtonLabelAr,
      legacy: legacyAddButtonLabel,
      fallback: tx("defaultAddButtonLabel"),
    });

    const [modalVisible, setModalVisible] = React.useState(false);
    const [modalMode, setModalMode] = React.useState<SocialMediaModalMode>("add");
    const [editingItem, setEditingItem] =
      React.useState<SocialMediaItem | null>(null);
    const [mediaSubCategoriesRaw, setMediaSubCategoriesRaw] = React.useState<
      unknown[]
    >([]);
    const [accountTypesRaw, setAccountTypesRaw] = React.useState<unknown[]>([]);

    const decoratorProps = (field.decoratorProps ?? {}) as Record<
      string,
      unknown
    >;
    const tooltipHtml = getBilingualValueByLang({
      lang,
      host,
      en: decoratorProps.tooltipEn,
      ar: decoratorProps.tooltipAr,
      legacy: decoratorProps.tooltip,
      fallback: "",
    });

    React.useEffect(() => {
      getLookupData("SocialMediaSubCategories", serviceCode).then(
        (res: { data?: unknown }) => {
          const raw = res?.data;
          const list = Array.isArray(raw) ? raw : [];
          setMediaSubCategoriesRaw(list);
        },
      );

      getLookupData("SocialMedias", serviceCode)
        .then((res: { data?: unknown }) => {
          const raw = res?.data;
          const list = Array.isArray(raw) ? raw : [];
          setAccountTypesRaw(list);
        })
        .catch(() => setAccountTypesRaw([]));
    }, [serviceCode]);

    const isAr = lang === "ar";
    const mediaSubCategories = React.useMemo<NormalizedLookupOption[]>(
      () =>
        normalizeLookupOptions(mediaSubCategoriesRaw, isAr).map((item) => ({
          value: String(item.value),
          label: item.label,
        })),
      [mediaSubCategoriesRaw, isAr],
    );
    const mediaSubCategoryLabelByValue = React.useMemo(
      () =>
        new Map(
          mediaSubCategories.map(
            (item) => [item.value, item.label] as const,
          ),
        ),
      [mediaSubCategories],
    );
    const accountTypeNameByValue = React.useMemo(() => {
      const labels = normalizeLookupOptions(accountTypesRaw, false);

      return new Map(
        labels.map((item) => [String(item.value), item.label] as const),
      );
    }, [accountTypesRaw]);

    const handleAdd = () => {
      if (hideActionButtons) return;
      setModalMode("add");
      setEditingItem(null);
      setModalVisible(true);
    };

    const handleEdit = (item: SocialMediaItem) => {
      if (hideActionButtons) return;
      setModalMode("edit");
      setEditingItem(item);
      setModalVisible(true);
    };

    const handleView = (item: SocialMediaItem) => {
      setModalMode("view");
      setEditingItem(item);
      setModalVisible(true);
    };

    const handleDelete = (id: string) => {
      if (hideActionButtons) return;
      Modal.confirm({
        centered: true,
        title: tx("deleteTitle"),
        content: tx("deleteContent"),
        okText: tx("deleteOk"),
        okType: "danger",
        cancelText: tx("cancel"),
        onOk: () => {
          field.setValue(value.filter((v) => v.id !== id));
        },
      });
    };

    const handleSave = (item: Omit<SocialMediaItem, "id">) => {
      if (editingItem) {
        field.setValue(
          value.map((v) => {
            if (v.id !== editingItem.id) {
              return v;
            }

            const nextValue = {
              ...v,
            } as SocialMediaItem & { accountTypeName?: string };
            delete nextValue.accountTypeName;

            return {
              ...nextValue,
              ...item,
            };
          }),
        );
      } else {
        field.setValue([
          ...value,
          {
            id: createId(),
            ...item,
          },
        ]);
      }
      setModalVisible(false);
      setModalMode("add");
      setEditingItem(null);
    };

    const handleCancel = () => {
      setModalVisible(false);
      setModalMode("add");
      setEditingItem(null);
    };

    const getAccountDisplayName = (item: SocialMediaItem): string => {
      return item.accountTitle || item.accountName || tx("untitled");
    };

    return (
      <div className="social-media-account-container">
        <Card
          className="acq-form-card"
          title={
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <span
                data-content-editable={
                  lang === "ar"
                    ? "x-component-props.titleAr"
                    : "x-component-props.titleEn"
                }
              >
                {resolvedLabelName}
              </span>
              {tooltipHtml ? (
                renderDesignerTooltipIcon(tooltipHtml)
              ) : null}
            </span>
          }
          extra={
            isReadOnlyMode ? null : (
              <CustomButton
                disabled={Boolean(disabled)}
                customClassName="social-media-account-add-btn"
                onClick={handleAdd}
              >
                {resolvedAddButtonLabel}
              </CustomButton>
            )
          }
        >
          {value.length === 0 ? (
            <EmptyBox
              title={tx("emptyTitle")}
              hasButton={false}
              onClick={handleAdd}
            />
          ) : (
            <div className="social-media-account-list">
              {value.map((item) => {
                const statusKey =
                  item.operation === "ADD"
                    ? "SocialMediaAccount.statusNew"
                    : item.operation === "MODIFY"
                      ? "SocialMediaAccount.statusModified"
                      : item.operation === "DELETE"
                        ? "SocialMediaAccount.statusDeleted"
                        : null;
                const displayName = getAccountDisplayName(item);

                return (
                  <Card
                    key={item.id}
                    className={`social-media-account-card${
                      item.operation === "DELETE"
                        ? " social-media-account-card--deleted"
                        : ""
                    }`}
                  >
                  <div className="social-media-account-card-header">
                    <div className="social-media-account-icon">
                      <SocialMediaAccountIcon
                        nameEn={accountTypeNameByValue.get(
                          String(item.accountType ?? ""),
                        )}
                      />
                    </div>
                    <div className="social-media-account-info">
                      <div className="social-media-account-card__title-row">
                        <OverflowTooltip
                          className="social-media-account-name"
                          title={displayName}
                        >
                          {displayName}
                        </OverflowTooltip>
                        {isReadOnlyMode && statusKey ? (
                          <Tag
                            className={`social-media-account-status social-media-account-status--${item.operation?.toLowerCase()}`}
                          >
                            {t(statusKey)}
                          </Tag>
                        ) : null}
                      </div>
                      {(() => {
                        const safeAccountUrl = resolveExternalWebUrl(
                          item.accountUrl,
                        );
                        const urlContent = (
                          <>
                            <span className="url-icon">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                stroke="#92722A"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                            </span>
                            <span className="url-text-twoLine">
                              {item.accountUrl || tx("noUrl")}
                            </span>
                          </>
                        );

                        return safeAccountUrl ? (
                          <a
                            className="social-media-account-url social-media-account-url--link"
                            href={safeAccountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.accountUrl}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {urlContent}
                          </a>
                        ) : (
                          <div className="social-media-account-url">
                            {urlContent}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {Array.isArray(item.mediaSubCategories) &&
                    item.mediaSubCategories.length > 0 && (
                      <div className="social-media-account-categories">
                        <div className="category-label">
                          {tx("subCategory")}
                        </div>
                        <div className="category-tags">
                          {item.mediaSubCategories.slice(0, 3).map((cat, idx) => (
                            <Tag key={idx} className="category-tag">
                              {mediaSubCategoryLabelByValue.get(String(cat)) ??
                                String(cat ?? "")}
                            </Tag>
                          ))}
                          {item.mediaSubCategories.length > 3 && (
                            <Tooltip
                              placement="top"
                              overlayClassName="social-media-tags-tooltip"
                              title={
                                <div className="hidden-tags-tooltip">
                                  {item.mediaSubCategories.slice(3).map((cat, idx) => (
                                    <Tag
                                      key={`${String(cat)}-${idx}`}
                                      className="category-tag"
                                    >
                                      {mediaSubCategoryLabelByValue.get(
                                        String(cat),
                                      ) ?? String(cat ?? "")}
                                    </Tag>
                                  ))}
                                </div>
                              }
                            >
                              <Tag className="category-tag category-tag-more">
                                +{item.mediaSubCategories.length - 3}
                              </Tag>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )}

                  {isReadOnlyMode ? (
                    <div className="social-media-account-actions">
                      <CustomButton
                        size="small"
                        customClassName="social-media-account-edit-btn"
                        onClick={() => handleView(item)}
                      >
                          {t("SocialMediaAccount.details")}
                      </CustomButton>
                    </div>
                  ) : (
                    <div className="social-media-account-actions">
                      <CustomButton
                        size="small"
                        variant="text"
                        disabled={Boolean(disabled)}
                        customClassName="social-media-account-delete-btn"
                        onClick={() => handleDelete(item.id)}
                      >
                        {tx("delete")}
                      </CustomButton>
                      <CustomButton
                        size="small"
                        disabled={Boolean(disabled)}
                        customClassName="social-media-account-edit-btn"
                        onClick={() => handleEdit(item)}
                      >
                        {tx("edit")}
                      </CustomButton>
                    </div>
                  )}
                  </Card>
                );
              })}
            </div>
          )}

          <AddSocialMediaModal
            visible={modalVisible}
            mode={modalMode}
            editingItem={editingItem}
            onSave={handleSave}
            onCancel={handleCancel}
            title={modalMode === "add" ? resolvedAddButtonLabel : undefined}
            serviceCode={serviceCode}
            designMode={Boolean(field.designable)}
          />
        </Card>
      </div>
    );
  });
