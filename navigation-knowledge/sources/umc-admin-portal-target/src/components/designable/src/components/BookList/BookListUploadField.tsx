/* eslint-disable @typescript-eslint/no-explicit-any -- Formily field / schema-driven props */
import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { observer, useField, useForm } from "@formily/react";
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Typography,
  Tooltip,
  message,
  Row,
  Col,
} from "antd";
import {
  QuestionCircleOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import {
  getLanguages,
  getLookupData,
  getISBNstatus,
} from "../../../../../services/services";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { validateService302BookRows } from "@/utils/service302Utils";
import { useContentApplicationReviewStore } from "@/store/content-application-review";
import "./styles.less";

const { Option } = Select;
const { Text } = Typography;

interface BookItem {
  key: string;
  no: number;
  isbn: string;
  title: string;
  authorName: string;
  author?: string;
  category: string;
  language1: string;
  language2: string;
  quantity: number;
  status?: number;
}

interface BookListUploadValue {
  totalWeight?: number;
  totalQuantity?: number;
  bookList?: BookItem[];
}

type BookListUploadFieldProps = {
  titleEn?: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  title?: React.ReactNode;
  description?: string | null;
  className?: string;
  [key: string]: unknown;
};

type SelectOption = {
  label: string;
  value: string;
  nameEn?: string;
  nameAr?: string;
};

type RawLookupItem = Record<string, unknown>;

function isHtmlTooltip(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmptyTip(html: string): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return (
    stripped.length === 0 && !/<img\s/i.test(html) && !/<video\s/i.test(html)
  );
}

const normalizeString = (value: unknown) => String(value ?? "").trim();
const isTotalWeightInputAllowed = (value: string) =>
  value.length <= 10 && /^\d*\.?\d*$/.test(value);
const isValidTotalWeight = (value: string) => {
  const weight = Number(value);
  return (
    value.length <= 10 &&
    /^(?:\d+|\d*\.\d+)$/.test(value) &&
    Number.isFinite(weight) &&
    weight > 0
  );
};
const normalizeIsbn = (value: unknown) =>
  normalizeString(value)
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
const normalizeBookApprovedStatus = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const status = Number(value);
  return Number.isFinite(status) ? status : undefined;
};

const getLocalizedName = (item: RawLookupItem, isAr: boolean) => {
  const candidates = isAr
    ? [
        item.nameAr,
        item.NameAr,
        item.labelAr,
        item.nameEn,
        item.NameEn,
        item.labelEn,
        item.name,
        item.label,
      ]
    : [
        item.nameEn,
        item.NameEn,
        item.labelEn,
        item.nameAr,
        item.NameAr,
        item.labelAr,
        item.name,
        item.label,
      ];
  return normalizeString(
    candidates.find((candidate) => normalizeString(candidate)),
  );
};

const getSubjectCategoryValue = (item: RawLookupItem) =>
  normalizeString(
    item.nameEn || item.NameEn || item.code || item.Code || item.id || item.Id,
  );

const normalizeBookItem = (
  item: Partial<BookItem>,
  index: number,
): BookItem => ({
  key: item.key || `book-${index}`,
  no: index + 1,
  isbn: normalizeString(item.isbn),
  title: normalizeString(item.title),
  authorName: normalizeString(item.authorName || item.author),
  author: normalizeString(item.author || item.authorName),
  category: normalizeString(item.category),
  language1: normalizeString(item.language1),
  language2: normalizeString(item.language2),
  quantity: Number(item.quantity || 0),
  status: normalizeBookApprovedStatus(item.status),
});

const buildBookListValue = (
  current: BookListUploadValue,
  nextBookList: BookItem[],
): BookListUploadValue => {
  const nextValue: BookListUploadValue & Record<string, unknown> = {
    ...current,
    bookList: nextBookList.map((item, index) => ({
      ...item,
      no: index + 1,
      key: item.key || `book-${index}`,
      authorName: normalizeString(item.authorName || item.author),
      author: normalizeString(item.author || item.authorName),
    })),
    totalQuantity: nextBookList.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    ),
  };

  delete nextValue.totalRows;
  delete nextValue.serviceFees;

  return nextValue;
};

export const BookListUploadField: React.FC<BookListUploadFieldProps> = observer(
  ({
    titleEn,
    titleAr,
    descriptionEn,
    descriptionAr,
    title,
    description,
    className,
    ...restProps
  }) => {
    const field = useField<any>();
    const form = useForm();
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const { i18n: i18nReact } = useTranslation();
    const current = useMemo<BookListUploadValue>(
      () => (field.value as BookListUploadValue | undefined) || {},
      [field.value],
    );
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [totalWeightInput, setTotalWeightInput] = useState(() =>
      current.totalWeight === undefined ? "" : String(current.totalWeight),
    );
    const isUpdatingTotalWeightInputRef = React.useRef(false);
    const previewLang =
      host === "designer"
        ? lang === "ar"
          ? "ar"
          : "en"
        : i18nReact.language?.toLowerCase().startsWith("ar")
        ? "ar"
        : "en";
    const isAr = previewLang === "ar";
    const isReviewMode = field.pattern === "readPretty";
    const isFormLocked =
      form.pattern === "disabled" ||
      form.pattern === "readOnly" ||
      form.pattern === "readPretty";
    const hideActionButtons =
      field.pattern === "disabled" ||
      field.pattern === "readOnly" ||
      isReviewMode ||
      isFormLocked;
    const isFirstApprovalRejected = useContentApplicationReviewStore(
      (state) => state.isFirstApprovalRejected,
    );
    const [editingKey, setEditingKey] = useState("");
    const [editingRecord, setEditingRecord] = useState<BookItem | null>(null);
    const [languageItemsRaw, setLanguageItemsRaw] = useState<RawLookupItem[]>(
      [],
    );
    const [categoryItemsRaw, setCategoryItemsRaw] = useState<RawLookupItem[]>(
      [],
    );

    const translate = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`BookList.${key}`, {
            lng: previewLang,
            ...(options ?? {}),
          }),
        ),
      [previewLang],
    );

    const languageOptions = useMemo<SelectOption[]>(() => {
      return languageItemsRaw
        .filter(
          (item) =>
            normalizeString(item.nameEn ?? item.NameEn) &&
            Number.isFinite(Number(item.id ?? item.Id)),
        )
        .map((item) => {
          const nameEn = normalizeString(item.nameEn ?? item.NameEn);
          return {
            label: getLocalizedName(item, isAr) || nameEn,
            value: normalizeString(item.id ?? item.Id),
            nameEn,
            nameAr: normalizeString(item.nameAr ?? item.NameAr),
          };
        });
    }, [isAr, languageItemsRaw]);

    const categoryOptions = useMemo<SelectOption[]>(
      () =>
        categoryItemsRaw
          .map((item) => {
            const value = getSubjectCategoryValue(item);
            const label = getLocalizedName(item, isAr) || value;
            return { label, value };
          })
          .filter((item) => item.label && item.value),
      [categoryItemsRaw, isAr],
    );

    const resolvedTitleText = useMemo(() => {
      const raw = getBilingualValueByLang({
        lang: previewLang,
        host,
        en: titleEn,
        ar: titleAr,
        legacy: typeof title === "string" ? title : undefined,
        fallback: "",
      });
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      if (trimmed.length > 0) return trimmed;
      if (host === "designer") return "";
      return translate("defaultCardTitle");
    }, [previewLang, host, titleEn, titleAr, title, translate]);

    const descriptionTipRaw = useMemo(
      () =>
        getBilingualValueByLang({
          lang: previewLang,
          host,
          en: descriptionEn,
          ar: descriptionAr,
          legacy: typeof description === "string" ? description : undefined,
          fallback: "",
        }),
      [previewLang, host, descriptionEn, descriptionAr, description],
    );

    const descriptionTipEl = useMemo(() => {
      const tip = descriptionTipRaw;
      if (!tip || typeof tip !== "string") return null;
      if (isEffectivelyEmptyTip(tip)) return null;
      const content = isHtmlTooltip(tip) ? (
        <div
          className="html-tooltip-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(tip) }}
          style={{ maxWidth: 800 }}
        />
      ) : (
        tip
      );
      return (
        <Tooltip title={content} overlayInnerStyle={{ maxWidth: 800 }}>
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
      );
    }, [descriptionTipRaw]);

    const getOptionDisplay = useCallback(
      (raw: string, options: SelectOption[]) => {
        const normalized = normalizeString(raw).toLowerCase();
        const option = options.find(
          (item) =>
            item.value === normalizeString(raw) ||
            [item.label, item.nameEn, item.nameAr]
              .filter(Boolean)
              .some((name) => normalizeString(name).toLowerCase() === normalized),
        );
        return option?.label || raw;
      },
      [],
    );

    const bookList = useMemo(
      () =>
        (current.bookList || []).map((item, index) =>
          normalizeBookItem(item, index),
        ),
      [current.bookList],
    );
    const displayBookList = useMemo(() => {
      if (isFirstApprovalRejected !== true || !hideActionButtons) {
        return bookList;
      }

      return bookList.map((item) => ({
        ...item,
        status: 0,
      }));
    }, [bookList, hideActionButtons, isFirstApprovalRejected]);
    const validation = useMemo(
      () => validateService302BookRows(bookList),
      [bookList],
    );

    useEffect(() => {
      let cancelled = false;
      getLanguages()
        .then((res) => {
          if (cancelled) return;
          setLanguageItemsRaw(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          if (!cancelled) {
            setLanguageItemsRaw([]);
          }
        });

      getLookupData("SubjectCategories")
        .then((res) => {
          if (cancelled) return;
          setCategoryItemsRaw(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          if (!cancelled) {
            setCategoryItemsRaw([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (
        field.pattern !== "readOnly" &&
        field.pattern !== "disabled" &&
        field.pattern !== "readPretty"
      ) {
        return;
      }

      if (isFirstApprovalRejected === true) {
        return;
      }

      const isbnList = Array.from(
        new Set(
          (current.bookList || [])
            .map((item) => normalizeIsbn(item?.isbn))
            .filter(Boolean),
        ),
      );

      if (!isbnList.length) return;

      let cancelled = false;
      getISBNstatus(isbnList)
        .then((res) => {
          if (cancelled) return;
          const statusList = Array.isArray(res?.data)
            ? res.data
            : [];
          const statusMap = new Map(
            statusList
              .map((item) => [
                normalizeIsbn(item?.isbn),
                normalizeBookApprovedStatus(item?.BookApprovedStatus),
              ] as const)
              .filter(([isbn, status]) => isbn && status !== undefined),
          );
          if (!statusMap.size) return;

          let hasStatusChanged = false;
          const nextBookList = (current.bookList || []).map((item, index) => {
            const normalizedItem = normalizeBookItem(item, index);
            const matchedStatus = statusMap.get(
              normalizeIsbn(normalizedItem.isbn),
            );
            const nextStatus =
              matchedStatus !== undefined ? matchedStatus : normalizedItem.status;

            if (nextStatus !== normalizedItem.status) {
              hasStatusChanged = true;
            }

            return {
              ...normalizedItem,
              status: nextStatus,
            };
          });
          if (hasStatusChanged && field.pattern !== "readPretty") {
            field.setValue(buildBookListValue(current, nextBookList));
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error("Load ISBN status failed:", error);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [current, field, isFirstApprovalRejected]);

    const updateBookList = useCallback(
      (nextBookList: BookItem[]) => {
        field.setValue(buildBookListValue(current, nextBookList));
      },
      [current, field],
    );

    useEffect(() => {
      if (isUpdatingTotalWeightInputRef.current) {
        isUpdatingTotalWeightInputRef.current = false;
        return;
      }

      setTotalWeightInput(
        current.totalWeight === undefined ? "" : String(current.totalWeight),
      );
    }, [current.totalWeight]);

    const updateTotalWeight = useCallback(
      (value: string) => {
        const nextValue: BookListUploadValue & Record<string, unknown> = {
          ...current,
          totalWeight: isValidTotalWeight(value) ? Number(value) : undefined,
        };
        delete nextValue.totalRows;
        field.setValue(nextValue);
      },
      [current, field],
    );

    const handleTotalWeightChange = useCallback(
      (value: string) => {
        if (!isTotalWeightInputAllowed(value)) {
          return;
        }

        isUpdatingTotalWeightInputRef.current = true;
        setTotalWeightInput(value);
        updateTotalWeight(value);
      },
      [updateTotalWeight],
    );

    const openUploadDialog = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleExcelUpload = useCallback(
      (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const books: BookItem[] = (jsonData as unknown[][])
              .slice(1)
              .filter((row) => row.some((cell) => normalizeString(cell)))
              .map((row, index) =>
                normalizeBookItem(
                  {
                    key: `book-${index}`,
                    no: index + 1,
                    isbn: normalizeString(row[1]),
                    title: normalizeString(row[2]),
                    authorName: normalizeString(row[3]),
                    author: normalizeString(row[3]),
                    category: normalizeString(row[4]),
                    language1: normalizeString(row[5]) || "English",
                    language2: normalizeString(row[6]),
                    quantity: Number(row[7] || 0),
                  },
                  index,
                ),
              );

            updateBookList(books);
            message.success(
              translate("importSuccess", { count: books.length }),
            );
          } catch (error) {
            console.error("Excel parsing error:", error);
            message.error(translate("parseExcelFailed"));
          }
        };
        reader.readAsArrayBuffer(file);
        return false;
      },
      [translate, updateBookList],
    );

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        handleExcelUpload(file);
        e.target.value = "";
      },
      [handleExcelUpload],
    );

    const resolveLanguageId = useCallback(
      (value: string) => {
        const normalized = normalizeString(value).toLowerCase();
        return (
          languageOptions.find(
            (option) =>
              option.value === normalizeString(value) ||
              [option.label, option.nameEn, option.nameAr]
                .filter(Boolean)
                .some(
                  (name) =>
                    normalizeString(name).toLowerCase() === normalized,
                ),
          )?.value || value
        );
      },
      [languageOptions],
    );

    const startEdit = useCallback(
      (record: BookItem) => {
        setEditingKey(record.key);
        setEditingRecord({
          ...record,
          language1: resolveLanguageId(record.language1),
          language2: resolveLanguageId(record.language2),
        });
      },
      [resolveLanguageId],
    );

    useEffect(() => {
      if (!editingRecord || languageOptions.length === 0) return;

      const language1 = resolveLanguageId(editingRecord.language1);
      const language2 = resolveLanguageId(editingRecord.language2);
      if (
        language1 !== editingRecord.language1 ||
        language2 !== editingRecord.language2
      ) {
        setEditingRecord({ ...editingRecord, language1, language2 });
      }
    }, [editingRecord, languageOptions.length, resolveLanguageId]);

    const cancelEdit = useCallback(() => {
      setEditingKey("");
      setEditingRecord(null);
    }, []);

    const saveEdit = useCallback(() => {
      if (!editingRecord) return;

      const nextRecord = normalizeBookItem(editingRecord, editingRecord.no - 1);
      const nextBookList = bookList.map((book) =>
        book.key === editingKey ? nextRecord : book,
      );
      updateBookList(nextBookList);
      setEditingKey("");
      setEditingRecord(null);
    }, [bookList, editingKey, editingRecord, updateBookList]);

    const updateEditingRecord = useCallback(
      (fieldName: keyof BookItem, value: unknown) => {
        if (!editingRecord) return;

        setEditingRecord({
          ...editingRecord,
          [fieldName]:
            fieldName === "quantity"
              ? Number(String(value ?? "").replace(/\D/g, "")) || 0
              : value,
        });
      },
      [editingRecord],
    );

    const renderCellText = useCallback((value: string, invalid = false) => {
      if (invalid) {
        return <Text type="danger">{value || "-"}</Text>;
      }
      return <span>{value || "-"}</span>;
    }, []);

    const columns = useMemo(() => {
      const baseColumns = [
        {
          title: translate("colNo"),
          dataIndex: "no",
          key: "no",
          width: 60,
        },
        {
          title: translate("colIsbn"),
          dataIndex: "isbn",
          key: "isbn",
          width: 160,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Input
                  value={editingRecord?.isbn}
                  onChange={(e) => updateEditingRecord("isbn", e.target.value)}
                  size="small"
                />
              );
            }

            const normalizedIsbn = normalizeIsbn(text);
            const isInvalid =
              !normalizedIsbn ||
              validation.duplicateIsbnSet.has(normalizedIsbn) ||
              validation.invalidIsbnSet.has(normalizedIsbn);

            return renderCellText(text, isInvalid);
          },
        },
        {
          title: translate("colTitle"),
          dataIndex: "title",
          key: "title",
          width: 240,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Input
                  value={editingRecord?.title}
                  onChange={(e) => updateEditingRecord("title", e.target.value)}
                  size="small"
                  maxLength={200}
                />
              );
            }
            return renderCellText(text, !text);
          },
        },
        {
          title: translate("colAuthor"),
          dataIndex: "authorName",
          key: "authorName",
          width: 200,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Input
                  value={editingRecord?.authorName}
                  onChange={(e) =>
                    updateEditingRecord("authorName", e.target.value)
                  }
                  size="small"
                  maxLength={100}
                />
              );
            }
            return renderCellText(text, !text);
          },
        },
        {
          title: translate("colCategory"),
          dataIndex: "category",
          key: "category",
          width: 180,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Select
                  value={editingRecord?.category || undefined}
                  onChange={(value) => updateEditingRecord("category", value)}
                  size="small"
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                  className="umc-select-arrow-manual"
                >
                  {categoryOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              );
            }
            return (
              <span>
                {text ? getOptionDisplay(text, categoryOptions) : "-"}
              </span>
            );
          },
        },
        {
          title: translate("colLanguage1"),
          dataIndex: "language1",
          key: "language1",
          width: 130,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Select
                  value={editingRecord?.language1 || undefined}
                  onChange={(value) => updateEditingRecord("language1", value)}
                  size="small"
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                  className="umc-select-arrow-manual"
                >
                  {languageOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              );
            }
            return (
              <span>
                {text ? getOptionDisplay(text, languageOptions) : "-"}
              </span>
            );
          },
        },
        {
          title: translate("colLanguage2"),
          dataIndex: "language2",
          key: "language2",
          width: 130,
          render: (text: string, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Select
                  value={editingRecord?.language2 || undefined}
                  onChange={(value) => updateEditingRecord("language2", value)}
                  size="small"
                  style={{ width: "100%" }}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  className="umc-select-arrow-manual"
                >
                  {languageOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              );
            }
            return (
              <span>
                {text ? getOptionDisplay(text, languageOptions) : "-"}
              </span>
            );
          },
        },
        {
          title: translate("colQuantity"),
          dataIndex: "quantity",
          key: "quantity",
          width: 100,
          render: (text: number, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <Input
                  value={
                    editingRecord?.quantity
                      ? String(editingRecord.quantity)
                      : ""
                  }
                  onChange={(e) =>
                    updateEditingRecord("quantity", e.target.value)
                  }
                  size="small"
                />
              );
            }
            return <span>{text || "-"}</span>;
          },
        },
      ];

      if (hideActionButtons) {
        return [
          ...baseColumns,
          {
            title: (
              <Tooltip
                title={translate("statusColumnTooltip")}
                overlayInnerStyle={{ whiteSpace: "pre-line" }}
              >
                <span>{translate("colStatus")}</span>
              </Tooltip>
            ),
            dataIndex: "status",
            key: "status",
            width: 100,
            render: (status: number | undefined) => {
              const normalizedStatus = normalizeBookApprovedStatus(status);
              if (normalizedStatus === undefined) return "-";

              const statusClass =
                normalizedStatus === 1
                  ? "approved"
                  : normalizedStatus === 0
                  ? "rejected"
                  : "default";
              const statusText =
                normalizedStatus === 1
                  ? translate("statusApproved")
                  : normalizedStatus === 0
                  ? translate("statusRejected")
                  : translate("statusReviewRequired");
              return (
                  <span
                    className={`book-list-status-pill book-list-status-pill-${statusClass}`}
                  >
                    {statusText}
                  </span>
              );
            },
          },
        ];
      }
      return [
        ...baseColumns,
        {
          title: translate("colAction"),
          key: "action",
          width: 100,
          render: (_: unknown, record: BookItem) => {
            const isEditing = record.key === editingKey;
            if (isEditing) {
              return (
                <div className="book-list-actions">
                  <Button
                    type="link"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={saveEdit}
                  />
                  <Button
                    type="link"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={cancelEdit}
                  />
                </div>
              );
            }

            return (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => startEdit(record)}
              />
            );
          },
        },
      ];
    }, [
      cancelEdit,
      categoryOptions,
      editingKey,
      editingRecord,
      getOptionDisplay,
      hideActionButtons,
      languageOptions,
      renderCellText,
      saveEdit,
      startEdit,
      translate,
      updateEditingRecord,
      validation.duplicateIsbnSet,
      validation.invalidIsbnSet,
    ]);

    const invalidRowCount =
      validation.duplicateIsbnSet.size +
      validation.invalidIsbnSet.size +
      validation.missingRequiredIndexSet.size;
    const invalidRowsText =
      previewLang === "ar"
        ? "تحتوي بعض الصفوف على بيانات غير صالحة أو مكررة."
        : "Some rows contain invalid or duplicate data.";
    const cardTitleNode = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span data-content-editable="x-component-props.title">
          {resolvedTitleText}
        </span>
        {descriptionTipEl}
      </span>
    );
    const downloadTemplate = useCallback(() => {
      const templateData = [
        [
          "No",
          "ISBN",
          "Title",
          "Author",
          "Category",
          "Language1",
          "Language2",
          "Quantity",
        ],
        [
          1,
          "9781302000011",
          "Sample Book 1",
          "Author 1",
          "Books",
          "English",
          "Arabic",
          2,
        ],
        [
          2,
          "9781302000028",
          "Sample Book 2",
          "Author 2",
          "Books",
          "English",
          "",
          5,
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Books");
      XLSX.writeFile(wb, "service302_book_list_template.xlsx");
    }, []);
    return (
      <div
        {...restProps}
        className={["book-list-upload-container", className]
          .filter(Boolean)
          .join(" ")}
      >
        <Card className="book-list-header" size="small">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <div className="header-item">
                <Text strong>
                  {translate("totalWeightLabel")}{" "}
                  <span
                    className="book-list-upload__total-weight-required"
                    aria-hidden="true"
                  >
                    *
                  </span>
                </Text>
                <Input
                  className="book-list-upload__total-weight-input"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder={translate("totalWeightPlaceholder")}
                  maxLength={10}
                  required
                  value={totalWeightInput}
                  disabled={isFormLocked}
                  onChange={(event) => handleTotalWeightChange(event.target.value)}
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="header-item">
                <Text strong>{translate("totalQuantityLabel")} </Text>
                <Text className="header-value">
                  {current.totalQuantity || 0}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        <Card className="book-list-upload-section" size="small">
          <div className="upload-header">
            <Text>{translate("uploadInstruction")}</Text>
            {!hideActionButtons && (
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={downloadTemplate}
                className="download-template-btn"
              >
                {translate("downloadTemplateButton")}
              </Button>
            )}
          </div>

          {!hideActionButtons && (
            <Button icon={<UploadOutlined />} onClick={openUploadDialog}>
              {bookList.length > 0
                ? translate("reuploadExcelFileButton")
                : translate("uploadExcelFileButton")}
            </Button>
          )}
        </Card>
        <Card className="book-list-upload-card" title={cardTitleNode}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {invalidRowCount > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="danger">{invalidRowsText}</Text>
            </div>
          )}

          <Table
            columns={columns}
            dataSource={displayBookList}
            pagination={false}
            size="small"
            scroll={{ x: 1300 }}
            className="book-list-table"
            locale={{
              emptyText: (
                <EmptyBox
                  customClassName="book-list-empty"
                  title={translate("emptyHintTitle")}
                  buttonText={translate("uploadExcelButton")}
                  hasButton={!hideActionButtons}
                  onClick={hideActionButtons ? undefined : openUploadDialog}
                />
              ),
            }}
          />
        </Card>
      </div>
    );
  },
);
