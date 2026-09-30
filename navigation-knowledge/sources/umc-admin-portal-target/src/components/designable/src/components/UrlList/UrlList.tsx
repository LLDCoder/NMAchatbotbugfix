import * as React from "react";
import { observer, useField, useForm } from "@formily/react";
import {
  Button,
  Card as AntdCard,
  Col,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Table,
  Tooltip,
} from "antd";
import {
  ExclamationCircleFilled,
  InfoCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { fileUpload } from "@/services/media";
import DocumentViewer from "@/components/common/DocumentViewer";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from "@/components/designable/src/utils/bilingual";
import "../FormItemWithHtmlTooltip/index.less";
import "./UrlList.less";

type UrlType = "File" | "URL";

type LegacyFilmUrlItem = {
  id?: string;
  title?: string;
  url?: string;
};

export type UrlListRecord = {
  title: string;
  type: UrlType;
  data: string;
  password: string;
  fileUrl?: string;
};

type UrlListValue = Array<LegacyFilmUrlItem | UrlListRecord>;

type UrlListProps = {
  value?: UrlListValue;
  onChange?: (value: UrlListRecord[]) => void;
  addButtonText?: string;
  addButtonTextEn?: string;
  addButtonTextAr?: string;
  designMode?: boolean;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  maxItems?: number;
  fileSizeLimit?: number;
  disabled?: boolean;
  readOnly?: boolean;
};

type FormilyLikeField = {
  value?: unknown;
  setValue?: (value: UrlListRecord[]) => void;
  designable?: boolean;
  pattern?: string;
  decoratorProps?: Record<string, unknown>;
};

type FormValues = {
  title: string;
  type: UrlType;
  url?: string;
  password?: string;
  file?: string | string[];
  fileName?: string;
};

type DocumentViewerUploadRequest = {
  file: File;
  onSuccess?: (url: string) => void;
  onError?: (error: unknown) => void;
};

type ModalMode = "add" | "edit" | "view";

const FILE_ACCEPT =
  ".mp4,.mov,.avi,.mkv,.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
const MAX_TITLE_LENGTH = 100;
const MAX_URL_LENGTH = 2000;
const MAX_PASSWORD_LENGTH = 50;
const DEFAULT_MAX_ITEMS = 3;
const DEFAULT_FILE_SIZE_LIMIT = 100;

const normalizeMaxItems = (value?: number) =>
  Math.min(
    12,
    Math.max(1, Number.isFinite(value) ? Number(value) : DEFAULT_MAX_ITEMS),
  );

const normalizeFileSizeLimit = (value?: number) =>
  Math.min(
    200,
    Math.max(
      1,
      Number.isFinite(value) ? Number(value) : DEFAULT_FILE_SIZE_LIMIT,
    ),
  );

const normalizeUrlListValue = (value: unknown): UrlListRecord[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const rawItem = item as Record<string, unknown>;
      const title = String(rawItem.title ?? "").trim();
      const rawType = rawItem.type;
      const type: UrlType = rawType === "File" ? "File" : "URL";

      if (rawType === "File" || rawType === "URL") {
        return {
          title,
          type,
          data: String(rawItem.data ?? "").trim(),
          password: String(rawItem.password ?? "").slice(
            0,
            MAX_PASSWORD_LENGTH,
          ),
          fileUrl:
            typeof rawItem.fileUrl === "string"
              ? rawItem.fileUrl.trim()
              : undefined,
        } satisfies UrlListRecord;
      }

      return {
        title,
        type: "URL",
        data: String(rawItem.url ?? "").trim(),
        password: "",
      } satisfies UrlListRecord;
    })
    .filter(
      (item): item is UrlListRecord =>
        !!item && Boolean(item.title || item.data || item.fileUrl),
    );
};

const getFileNameFromPath = (value?: string) => {
  if (!value) return "";
  const normalized = value.split("?")[0];
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
};

function isHtmlString(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmpty(str: string): boolean {
  if (!str) return true;
  const text = str.replace(/<[^>]*>/g, "").trim();
  return text.length === 0 && !/<img\s/i.test(str) && !/<video\s/i.test(str);
}

export const FilmsUrlsListField: React.FC<UrlListProps> = observer((props) => {
  const { i18n } = useTranslation();
  const field = useField<FormilyLikeField>();
  const formilyForm = useForm();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18n.language);
  const lngOpt = previewLang === "ar" ? "ar" : "en";
  const tx = React.useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(i18n.t(`UrlList.${key}`, { lng: lngOpt, ...options })),
    [i18n, lngOpt],
  );
  const editableTitleProp = getEditableTitlePathByLang(previewLang);
  const decoratorProps = (field?.decoratorProps ?? {}) as Record<
    string,
    unknown
  >;
  const resolvedTitle = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: props.titleEn,
    ar: props.titleAr,
    legacy: props.title,
    fallback: tx("defaultTitle"),
  });
  const resolvedAddButtonText = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: props.addButtonTextEn,
    ar: props.addButtonTextAr,
    legacy: props.addButtonText,
    fallback: tx("defaultAddButton"),
  });
  const tooltipRaw = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: decoratorProps.tooltipEn,
    ar: decoratorProps.tooltipAr,
    legacy: decoratorProps.tooltip,
    fallback: "",
  });
  const showTooltip =
    typeof tooltipRaw === "string" && !isEffectivelyEmpty(tooltipRaw);
  const tooltipTitle = showTooltip ? (
    isHtmlString(tooltipRaw) ? (
      <div
        className="html-tooltip-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipRaw) }}
      />
    ) : (
      tooltipRaw
    )
  ) : undefined;
  const designMode = Boolean(props.designMode ?? field?.designable);
  const externalValue = field ? field.value : props.value;
  const normalizedExternalValue = React.useMemo(
    () => normalizeUrlListValue(externalValue),
    [externalValue],
  );
  const previewData = React.useMemo<UrlListRecord[]>(
    () => [
      {
        title: tx("previewSampleFileTitle"),
        type: "File",
        data: "document.pdf",
        password: "",
      },
      {
        title: tx("previewSampleUrlTitle"),
        type: "URL",
        data: "https://example.com/resource",
        password: "123456",
      },
    ],
    [tx],
  );

  const [data, setData] = React.useState<UrlListRecord[]>(
    designMode ? previewData : normalizedExternalValue,
  );
  const [modalVisible, setModalVisible] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<ModalMode>("add");
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = React.useState<number | null>(null);
  const [pendingFormValues, setPendingFormValues] =
    React.useState<Partial<FormValues> | null>(null);
  const [form] = Form.useForm<FormValues>();

  const normalizedMaxItems = React.useMemo(
    () => normalizeMaxItems(props.maxItems),
    [props.maxItems],
  );
  const normalizedFileSizeLimit = React.useMemo(
    () => normalizeFileSizeLimit(props.fileSizeLimit),
    [props.fileSizeLimit],
  );
  const isPreviewMode =
    field?.pattern === "readPretty" ||
    field?.pattern === "disabled" ||
    formilyForm?.pattern === "readPretty" ||
    formilyForm?.pattern === "disabled";
  const isDisabled =
    Boolean(props.disabled || props.readOnly) ||
    field?.pattern === "readOnly" ||
    field?.pattern === "readPretty" ||
    field?.pattern === "disabled" ||
    formilyForm?.pattern === "readOnly" ||
    formilyForm?.pattern === "readPretty" ||
    formilyForm?.pattern === "disabled";
  const hideActionControls = designMode || isPreviewMode || isDisabled;
  const showPreviewViewAction = !designMode && isPreviewMode;
  const isViewMode = modalMode === "view";

  React.useEffect(() => {
    setData(designMode ? previewData : normalizedExternalValue);
  }, [designMode, normalizedExternalValue, previewData]);

  React.useEffect(() => {
    if (!modalVisible || !pendingFormValues) return;
    form.resetFields();
    form.setFieldsValue(pendingFormValues);
    setPendingFormValues(null);
  }, [form, modalVisible, pendingFormValues]);

  const triggerChange = React.useCallback(
    (next: UrlListRecord[]) => {
      setData(next);
      field?.setValue?.(next);
      props.onChange?.(next);
    },
    [field, props],
  );

  const reachedMaxItems = !designMode && data.length >= normalizedMaxItems;

  const openAddModal = React.useCallback(() => {
    if (designMode || isDisabled || reachedMaxItems) return;
    setModalMode("add");
    setEditingIndex(null);
    setPendingFormValues({ type: "File" });
    setModalVisible(true);
  }, [designMode, isDisabled, reachedMaxItems]);

  const openEditModal = React.useCallback(
    (record: UrlListRecord, index: number) => {
      if (designMode || isDisabled) return;
      setModalMode("edit");
      setEditingIndex(index);
      setPendingFormValues({
        title: record.title,
        type: record.type,
        url: record.type === "URL" ? record.data : undefined,
        password: record.type === "URL" ? record.password : undefined,
        file: record.type === "File" ? record.fileUrl : undefined,
        fileName: record.type === "File" ? record.data : undefined,
      });
      setModalVisible(true);
    },
    [designMode, isDisabled],
  );

  const openViewModal = React.useCallback(
    (record: UrlListRecord) => {
      setModalMode("view");
      setEditingIndex(null);
      setPendingFormValues({
        title: record.title,
        type: record.type,
        url: record.type === "URL" ? record.data : undefined,
        password: record.type === "URL" ? record.password : undefined,
        file: record.type === "File" ? record.fileUrl : undefined,
        fileName: record.type === "File" ? record.data : undefined,
      });
      setModalVisible(true);
    },
    [],
  );

  const confirmDelete = React.useCallback(
    (index: number) => {
      if (designMode || isDisabled) return;
      setDeletingIndex(index);
      setDeleteModalVisible(true);
    },
    [designMode, isDisabled],
  );

  const handleDeleteConfirm = React.useCallback(() => {
    if (deletingIndex == null) return;
    const next = data.filter((_, index) => index !== deletingIndex);
    triggerChange(next);
    setDeleteModalVisible(false);
    setDeletingIndex(null);
  }, [data, deletingIndex, triggerChange]);

  const closeFormModal = React.useCallback(() => {
    setModalVisible(false);
    setPendingFormValues(null);
    setEditingIndex(null);
    setModalMode("add");
    form.resetFields();
  }, [form]);

  const handleOk = React.useCallback(async () => {
    try {
      const values = await form.validateFields();
      const normalizedTitle = String(values.title || "")
        .slice(0, MAX_TITLE_LENGTH)
        .trim();
      const type = values.type || "File";
      const uploadedUrl = Array.isArray(values.file)
        ? values.file[0]
        : values.file;
      const urlValue = String(values.url || "")
        .slice(0, MAX_URL_LENGTH)
        .trim();
      const passwordValue = String(values.password || "").slice(
        0,
        MAX_PASSWORD_LENGTH,
      );
      const item: UrlListRecord = {
        title: normalizedTitle,
        type,
        data:
          type === "File"
            ? String(values.fileName || getFileNameFromPath(uploadedUrl)).trim()
            : urlValue,
        password: type === "URL" ? passwordValue : "",
        fileUrl: type === "File" ? uploadedUrl : undefined,
      };
      const next = [...data];
      if (editingIndex != null) {
        next[editingIndex] = item;
      } else {
        next.push(item);
      }
      triggerChange(next);
      setModalVisible(false);
      setPendingFormValues(null);
      form.resetFields();
    } catch {
      // validation handled by antd form
    }
  }, [data, editingIndex, form, triggerChange]);

  const customRequest = React.useCallback(
    async (options: DocumentViewerUploadRequest) => {
      const { file, onSuccess, onError } = options;
      const formData = new FormData();
      formData.append("files", file as Blob);

      try {
        const res = await fileUpload(formData);
        if (Array.isArray(res.data) && res.data.length > 0) {
          const fileUrl = res.data[0];
          onSuccess?.(fileUrl);
          return;
        }

        onError?.(new Error(tx("uploadResponseEmpty")));
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [tx],
  );

  const validateUrl = React.useCallback(
    async (_: unknown, value?: string) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) {
        return Promise.reject(new Error(tx("validationEnterUrl")));
      }

      try {
        const parsed = new URL(trimmed);
        if (!/^https?:$/.test(parsed.protocol)) {
          return Promise.reject(new Error(tx("validationEnterValidUrl")));
        }
        return Promise.resolve();
      } catch {
        return Promise.reject(new Error(tx("validationEnterValidUrl")));
      }
    },
    [tx],
  );

  const columns = React.useMemo(() => {
    const baseColumns = [
      {
        title: tx("tableColumnTitle"),
        dataIndex: "title",
        key: "title",
        width: 120,
        ellipsis: true,
      },
      {
        title: tx("tableColumnType"),
        dataIndex: "type",
        key: "type",
        width: 120,
        render: (type: UrlType) => (type === "URL" ? tx("typeUrl") : tx("typeFile")),
      },
      {
        title: tx("tableColumnData"),
        dataIndex: "data",
        key: "data",
        width: 160,
        ellipsis: true,
      },
      {
        title: tx("tableColumnPassword"),
        key: "password",
        width: 180,
        ellipsis: true,
        render: (_: unknown, record: UrlListRecord) =>
          record.type === "URL" ? record.password || "" : "---",
      },
    ];

    if (showPreviewViewAction) {
      return [
        ...baseColumns,
        {
          title: tx("tableColumnActions"),
          key: "actions",
          width: 100,
          render: (_: unknown, record: UrlListRecord) => (
            <span className="new-url-list-actions">
              <a className="action-view" onClick={() => openViewModal(record)}>
                {String(i18n.t("UrlList.view", { lng: lngOpt }))}
              </a>
            </span>
          ),
        },
      ];
    }

    if (hideActionControls) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        title: tx("tableColumnActions"),
        key: "actions",
        width: 140,
        render: (_: unknown, record: UrlListRecord, index: number) => (
          <span className="new-url-list-actions">
            <a className="action-edit" onClick={() => openEditModal(record, index)}>
              {tx("actionEdit")}
            </a>
            <a className="action-delete" onClick={() => confirmDelete(index)}>
              {tx("actionDelete")}
            </a>
          </span>
        ),
      },
    ];
  }, [
    confirmDelete,
    hideActionControls,
    i18n,
    lngOpt,
    openEditModal,
    openViewModal,
    showPreviewViewAction,
    tx,
  ]);

  return (
    <div className="new-url-list-wrapper">
      <AntdCard
        title={
          <div className="new-url-list-inner-header">
            <div className="new-url-list-inner-header-box">
              <div
                className="new-url-list-inner-title"
                data-content-editable={editableTitleProp}
              >
                {resolvedTitle}
              </div>
              {showTooltip && (
                <Tooltip
                  title={tooltipTitle}
                  overlayInnerStyle={{ maxWidth: 800 }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      marginLeft: 4,
                      lineHeight: 1,
                    }}
                  >
                    <QuestionCircleOutlined
                      style={{
                        color: "rgba(0,0,0,0.45)",
                        cursor: "help",
                        fontSize: 14,
                      }}
                    />
                  </span>
                </Tooltip>
              )}
            </div>
            {!hideActionControls ? (
              <Button
                type="primary"
                className="new-url-list-add-btn"
                onClick={openAddModal}
                disabled={reachedMaxItems}
              >
                {resolvedAddButtonText}
              </Button>
            ) : null}
          </div>
        }
        className="new-url-list-card"
      >
        {data.length > 0 ? (
          <Table
            rowKey={(_, index) => `row-${index}`}
            columns={columns}
            dataSource={data}
            pagination={false}
            className="new-url-list-table"
            scroll={{ x: 680 }}
          />
        ) : (
          <div className="new-url-list-empty">
            <EmptyBox title={tx("noDataAvailable")} />
          </div>
        )}
      </AntdCard>

      <Modal
        centered
        title={
          isViewMode
            ? String(i18n.t("UrlList.view", { lng: lngOpt }))
            : editingIndex != null
              ? tx("modalEdit")
              : tx("modalAddNew")
        }
        visible={modalVisible}
        onCancel={closeFormModal}
        footer={null}
        destroyOnClose
        className={
          isViewMode
            ? "new-url-list-form-modal new-url-list-form-modal--view"
            : "new-url-list-form-modal"
        }
        maskClosable={false}
        getContainer={() => document.body}
        width={800}
      >
        <Form form={form} layout="vertical" className="new-url-list-modal-form">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label={tx("labelTitle")}
                name="title"
                rules={[
                  {
                    required: true,
                    message: tx("validationEnterTitle"),
                  },
                ]}
              >
                <Input
                  disabled={isViewMode}
                  placeholder={tx("placeholderTitle")}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(event) => {
                    const next = event.target.value.slice(0, MAX_TITLE_LENGTH);
                    if (next !== event.target.value) {
                      form.setFieldsValue({ title: next });
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={tx("labelType")}
                name="type"
                rules={[
                  {
                    required: true,
                    message: tx("validationSelectType"),
                  },
                ]}
              >
                <Radio.Group disabled={isViewMode}>
                  <Radio value="File">{tx("typeFile")}</Radio>
                  <Radio value="URL">{tx("typeUrl")}</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Form.Item noStyle dependencies={["type"]}>
              {({ getFieldValue }) => {
                const currentType = getFieldValue("type") as
                  | UrlType
                  | undefined;
                const isFile = currentType === "File";

                return isFile ? (
                  <Col span={12}>
                    <Form.Item
                      label={
                        <span className="new-url-list-label-with-tip">
                          {tx("labelFile")}
                          <Tooltip title={tx("fileUploadTooltip")}>
                            <InfoCircleOutlined className="label-tip-icon" />
                          </Tooltip>
                        </span>
                      }
                      name="file"
                      rules={[
                        {
                          required: true,
                          message: tx("validationUploadFile"),
                        },
                      ]}
                    >
                      <DocumentViewer
                        hasView={true}
                        hasDownload={true}
                        hasDelete={!isDisabled && !isViewMode}
                        disabled={isDisabled || isViewMode}
                        uploadConfig={{
                          maxCount: 1,
                          maxSize: normalizedFileSizeLimit,
                          accept: FILE_ACCEPT,
                          placeholder: tx("uploadFile"),
                          uploadTip: tx("fileUploadTooltip"),
                          maxSizeErrorMessage: tx("fileSizeError", {
                            maxSizeMb: normalizedFileSizeLimit,
                          }),
                          customRequest,
                          onUploadSuccess: (fileData) => {
                            form.setFieldsValue({
                              fileName: fileData[0]?.name || "",
                            });
                          },
                        }}
                      />
                    </Form.Item>
                  </Col>
                ) : (
                  <>
                    <Col span={12}>
                      <Form.Item
                        label={tx("labelUrl")}
                        name="url"
                        rules={[{ validator: validateUrl }]}
                      >
                        <Input
                          disabled={isViewMode}
                          placeholder={tx("placeholderUrl")}
                          maxLength={MAX_URL_LENGTH}
                          onChange={(event) => {
                            const next = event.target.value.slice(
                              0,
                              MAX_URL_LENGTH,
                            );
                            if (next !== event.target.value) {
                              form.setFieldsValue({ url: next });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>

                    <Col span={12}>
                      <Form.Item label={tx("labelPassword")} name="password">
                        <Input
                          disabled={isViewMode}
                          placeholder={tx("placeholderPassword")}
                          maxLength={MAX_PASSWORD_LENGTH}
                          onChange={(event) => {
                            const next = event.target.value.slice(
                              0,
                              MAX_PASSWORD_LENGTH,
                            );
                            if (next !== event.target.value) {
                              form.setFieldsValue({ password: next });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </>
                );
              }}
            </Form.Item>
          </Row>
        </Form>

        <div className="modal-footer-custom">
          <Button onClick={closeFormModal} className="cancel-btn">
            {tx("cancel")}
          </Button>
          {!isViewMode ? (
            <Button type="primary" onClick={handleOk} className="save-btn">
              {editingIndex != null ? tx("save") : tx("confirm")}
            </Button>
          ) : null}
        </div>
      </Modal>

      <Modal
        centered
        title={null}
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        footer={null}
        destroyOnClose
        className="new-url-list-delete-modal"
        width={480}
        maskClosable={false}
        getContainer={() => document.body}
        closable={false}
      >
        <div className="delete-modal-content">
          <div className="delete-modal-icon">
            <ExclamationCircleFilled />
          </div>
          <div className="delete-modal-body">
            <div className="delete-modal-title">{tx("deleteRecordTitle")}</div>
            <div className="delete-modal-desc">{tx("deleteRecordConfirm")}</div>
          </div>
        </div>
        <div className="delete-modal-footer">
          <Button
            onClick={() => setDeleteModalVisible(false)}
            className="cancel-btn"
          >
            {tx("cancel")}
          </Button>
          <Button
            type="primary"
            danger
            onClick={handleDeleteConfirm}
            className="confirm-btn"
          >
            {tx("confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
});

export type { UrlListProps };
export default FilmsUrlsListField;
