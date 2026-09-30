import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card as AntdCard, Col, Form, Input, Modal, Pagination, Row, Select, Table } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import { getLanguages } from "@/services/services";
import "../DataList/DataList.less";

const PAGE_SIZE = 10;

type SelectOption = {
  label: string;
  value: string;
  saveLabel?: string;
  nameEn?: string;
  nameAr?: string;
};

export type MaterialListMaterialTypeOption = {
  value: string;
  label: string;
  saveLabel?: string;
  tableLabel?: string;
  code?: string;
  materialTypeId?: number | string;
};

export type MaterialListRow = Record<string, unknown> & {
  customMaterialId?: number | string;
  material_type?: string;
  materialTypeId?: number | string;
  materialTypeCode?: string;
  title?: string;
  language?: number | string;
  number_of_title?: number | string;
};

type MaterialListTableProps = {
  value?: MaterialListRow[];
  onChange?: (value: MaterialListRow[]) => void;
  materialTypeOptions?: MaterialListMaterialTypeOption[];
  loading?: boolean;
  disabled?: boolean;
  designMode?: boolean;
  addButtonText?: string;
  title?: string;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const NumberOnlyInput: React.FC<
  React.ComponentProps<typeof Input> & { maxLength?: number }
> = ({ onChange, ...rest }) => (
  <Input
    {...rest}
    onChange={(event) => {
      const digitsOnly = event.target.value.replace(/\D/g, "");
      (event.target as HTMLInputElement).value = digitsOnly;
      onChange?.(event);
    }}
  />
);

const findMaterialTypeOption = (
  value: unknown,
  options: MaterialListMaterialTypeOption[],
) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return undefined;

  return options.find((option) => {
    return (
      option.value === normalizedValue ||
      option.label === normalizedValue ||
      option.saveLabel === normalizedValue ||
      option.tableLabel === normalizedValue ||
      normalizeText(option.materialTypeId) === normalizedValue ||
      option.code === normalizedValue
    );
  });
};

const getMaterialTypeDisplayValue = (
  row: MaterialListRow,
  options: MaterialListMaterialTypeOption[],
) => {
  const option =
    findMaterialTypeOption(row.customMaterialId, options) ||
    findMaterialTypeOption(row.materialTypeId, options) ||
    findMaterialTypeOption(row.material_type, options) ||
    findMaterialTypeOption(row.materialTypeCode, options);

  if (option) {
    return option.tableLabel || option.label;
  }

  if (normalizeText(row.material_type)) {
    return normalizeText(row.material_type);
  }

  if (normalizeText(row.materialTypeCode)) {
    return normalizeText(row.materialTypeCode);
  }

  return normalizeText(row.materialTypeId);
};

const findLanguageOption = (value: unknown, options: SelectOption[]) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return undefined;

  return options.find((option) => {
    return (
      option.value === normalizedValue ||
      option.label === normalizedValue ||
      option.nameEn === normalizedValue ||
      option.nameAr === normalizedValue
    );
  });
};

const MaterialListTable: React.FC<MaterialListTableProps> = ({
  value = [],
  onChange,
  materialTypeOptions = [],
  loading = false,
  disabled,
  designMode,
  addButtonText = "Add Material",
  title = "Material List",
}) => {
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [languageItemsRaw, setLanguageItemsRaw] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [modalForm] = Form.useForm();

  const rows = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const isReadOnly = Boolean(disabled || designMode);
  const hasOptions = materialTypeOptions.length > 0;
  const languageSelectOptions = useMemo<SelectOption[]>(
    () =>
      languageItemsRaw.flatMap((item) => {
        const value = Number(item.id ?? item.Id);
        const nameEn = normalizeText(item.nameEn ?? item.NameEn);
        const nameAr = normalizeText(item.nameAr ?? item.NameAr);
        const label = i18n.language?.startsWith("ar")
          ? nameAr || nameEn
          : nameEn || nameAr;
        return Number.isFinite(value) && label
          ? [{ value: String(value), label, nameEn, nameAr }]
          : [];
      }),
    [i18n.language, languageItemsRaw],
  );

  useEffect(() => {
    let cancelled = false;
    getLanguages()
      .then((response) => {
        if (!cancelled) {
          setLanguageItemsRaw(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setLanguageItemsRaw([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalVisible || languageSelectOptions.length === 0) return;

    const currentLanguage = modalForm.getFieldValue("language");
    const languageOption = findLanguageOption(
      currentLanguage,
      languageSelectOptions,
    );
    if (languageOption && String(currentLanguage) !== languageOption.value) {
      modalForm.setFieldsValue({ language: languageOption.value });
    }
  }, [languageSelectOptions, modalForm, modalVisible]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, rows.length]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingIndex(null);
    modalForm.resetFields();
  }, [modalForm]);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalVisible(false);
    setDeletingIndex(null);
  }, []);

  const openAddModal = useCallback(() => {
    if (isReadOnly) return;
    setEditingIndex(null);
    modalForm.resetFields();
    setModalVisible(true);
  }, [isReadOnly, modalForm]);

  const openEditModal = useCallback(
    (row: MaterialListRow, index: number) => {
      if (isReadOnly) return;

      const option =
        findMaterialTypeOption(row.customMaterialId, materialTypeOptions) ||
        findMaterialTypeOption(row.materialTypeId, materialTypeOptions) ||
        findMaterialTypeOption(row.material_type, materialTypeOptions) ||
        findMaterialTypeOption(row.materialTypeCode, materialTypeOptions);

      setEditingIndex(index);
      modalForm.setFieldsValue({
        material_type:
          option?.value ||
          normalizeText(row.customMaterialId) ||
          normalizeText(row.materialTypeId),
        title: normalizeText(row.title),
        language:
          findLanguageOption(row.language, languageSelectOptions)?.value ||
          normalizeText(row.language),
        number_of_title: normalizeText(row.number_of_title),
      });
      setModalVisible(true);
    },
    [isReadOnly, languageSelectOptions, materialTypeOptions, modalForm],
  );

  const openDeleteModal = useCallback(
    (index: number) => {
      if (isReadOnly) return;
      setDeletingIndex(index);
      setDeleteModalVisible(true);
    },
    [isReadOnly],
  );

  const handleSave = useCallback(async () => {
    if (isReadOnly) return;

    try {
      const values = await modalForm.validateFields();
      const selectedOption = findMaterialTypeOption(
        values.material_type,
        materialTypeOptions,
      );

      if (!selectedOption) return;
      const selectedLanguage = findLanguageOption(
        values.language,
        languageSelectOptions,
      );
      if (!selectedLanguage) return;

      const baseRow = editingIndex != null ? rows[editingIndex] || {} : {};
      const resolvedMaterialTypeId =
        selectedOption.materialTypeId ?? selectedOption.value;
      const numericMaterialTypeId = Number(resolvedMaterialTypeId);
      const nextRow: MaterialListRow = {
        ...baseRow,
        customMaterialId: selectedOption.value,
        material_type:
          selectedOption.tableLabel || selectedOption.saveLabel || selectedOption.label,
        materialTypeId: Number.isFinite(numericMaterialTypeId)
          ? numericMaterialTypeId
          : resolvedMaterialTypeId,
        materialTypeCode: selectedOption.code || "",
        title: values.title,
        language: Number(selectedLanguage.value),
        number_of_title: values.number_of_title,
      };

      const nextRows = [...rows];
      if (editingIndex != null) {
        nextRows[editingIndex] = nextRow;
      } else {
        nextRows.push(nextRow);
      }

      onChange?.(nextRows);
      closeModal();
      if (editingIndex == null) {
        setCurrentPage(Math.ceil(nextRows.length / PAGE_SIZE));
      }
    } catch {
      // validation failed
    }
  }, [
    closeModal,
    editingIndex,
    isReadOnly,
    languageSelectOptions,
    materialTypeOptions,
    modalForm,
    onChange,
    rows,
  ]);

  const handleDelete = useCallback(() => {
    if (isReadOnly || deletingIndex == null) return;

    const nextRows = rows.filter((_, index) => index !== deletingIndex);
    onChange?.(nextRows);
    closeDeleteModal();
  }, [closeDeleteModal, deletingIndex, isReadOnly, onChange, rows]);

  const columns = useMemo<ColumnsType<MaterialListRow>>(
    () => {
      const nextColumns: ColumnsType<MaterialListRow> = [
        {
          title: t("DataList.materialType"),
          dataIndex: "material_type",
          key: "material_type",
          ellipsis: true,
          render: (_value, record) => getMaterialTypeDisplayValue(record, materialTypeOptions),
        },
        {
          title: t("DataList.sourceSetter.fieldLabels.title"),
          dataIndex: "title",
          key: "title",
          ellipsis: true,
        },
        {
          title: t("DataList.sourceSetter.fieldLabels.language"),
          dataIndex: "language",
          key: "language",
          ellipsis: true,
          render: (value: unknown) => {
            const option = findLanguageOption(value, languageSelectOptions);
            return option?.label || value;
          },
        },
        {
          title: t("DataList.sourceSetter.fieldLabels.numberOfTitle"),
          dataIndex: "number_of_title",
          key: "number_of_title",
          ellipsis: true,
        },
      ];

      if (!isReadOnly) {
        nextColumns.push({
          title: t("DataList.actions"),
          key: "actions",
          width: 140,
          render: (_value, _record, index) => {
            const rowIndex = (currentPage - 1) * PAGE_SIZE + index;

            return (
              <span className="beneficiary-material-list-actions">
                <a className="action-edit" onClick={() => openEditModal(rows[rowIndex], rowIndex)}>
                  {t("DataList.edit")}
                </a>
                <a className="action-delete" onClick={() => openDeleteModal(rowIndex)}>
                  {t("DataList.delete")}
                </a>
              </span>
            );
          },
        });
      }

      return nextColumns;
    },
    [
      currentPage,
      isReadOnly,
      languageSelectOptions,
      materialTypeOptions,
      openDeleteModal,
      openEditModal,
      rows,
      t,
    ],
  );

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [currentPage, rows]);

  return (
    <div className="beneficiary-material-list">
      <AntdCard
        title={
          <div className="beneficiary-material-list-header">
            <div className="beneficiary-material-list-title">{title}</div>
            {!isReadOnly && (
              <Button
                type="primary"
                className="beneficiary-material-list-add-btn"
                onClick={openAddModal}
                disabled={!hasOptions}
              >
                {addButtonText}
              </Button>
            )}
          </div>
        }
        className="beneficiary-material-list-card"
      >
        {rows.length > 0 ? (
          <>
            <Table
              rowKey={(_row, index) => `material-row-${index}`}
              columns={columns}
              dataSource={pagedRows}
              pagination={false}
              tableLayout="fixed"
              className="beneficiary-material-list-table"
            />
            {rows.length > PAGE_SIZE ? (
              <div className="beneficiary-material-list-pagination">
                <Pagination
                  current={currentPage}
                  pageSize={PAGE_SIZE}
                  total={rows.length}
                  onChange={setCurrentPage}
                  size="small"
                  showTotal={(total, range) => {
                    return t("DataList.paginationRangeOfTotal", {
                      start: range[0],
                      end: range[1],
                      total,
                    });
                  }}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="beneficiary-material-list-empty">
            <EmptyBox title={t("DataList.noDataAvailable")} />
          </div>
        )}
      </AntdCard>

      <Modal
        centered
        title={editingIndex != null ? t("DataList.modalEdit") : t("DataList.modalAddMaterialSource")}
        visible={modalVisible}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        maskClosable={false}
        className="datalist-form-modal"
        getContainer={() => document.body}
        width={900}
      >
        <Form form={modalForm} layout="vertical" className="Formily-Modal-Form">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label={t("DataList.materialType")}
                name="material_type"
                rules={[
                  {
                    required: true,
                    message: t("DataList.validation.selectMaterialType"),
                  },
                ]}
              >
                <Select
                  placeholder={t("DataList.placeholders.selectMaterialType")}
                  loading={loading}
                  showSearch
                  optionFilterProp="label"
                  options={materialTypeOptions}
                  className="umc-select-arrow-manual"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={t("DataList.sourceSetter.fieldLabels.title")}
                name="title"
                rules={[
                  {
                    required: true,
                    message: t("DataList.validateEnterField", {
                      field: t("DataList.sourceSetter.fieldLabels.title"),
                    }),
                  },
                  {
                    pattern: /^.{0,200}$/,
                    message: t("DataList.validateMaxChars200"),
                  },
                ]}
              >
                <Input placeholder={t("DataList.sourceSetter.placeholders.enterTitle")} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={t("DataList.sourceSetter.fieldLabels.language")}
                name="language"
                rules={[
                  {
                    required: true,
                    message: t("DataList.validateSelectField", {
                      field: t("DataList.sourceSetter.fieldLabels.language"),
                    }),
                  },
                ]}
              >
                <Select
                  placeholder={t("DataList.sourceSetter.placeholders.selectLanguage")}
                  showSearch
                  optionFilterProp="label"
                  options={languageSelectOptions}
                  className="umc-select-arrow-manual"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={t("DataList.sourceSetter.fieldLabels.numberOfTitle")}
                name="number_of_title"
                rules={[
                  {
                    required: true,
                    message: t("DataList.validateEnterField", {
                      field: t("DataList.sourceSetter.fieldLabels.numberOfTitle"),
                    }),
                  },
                  {
                    pattern: /^[1-9]\d{0,4}$/,
                    message: t("DataList.validateNaturalNumber99999"),
                  },
                ]}
              >
                <NumberOnlyInput
                  placeholder={t("DataList.sourceSetter.placeholders.enterNumberOfTitle")}
                  maxLength={15}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div className="modal-footer-custom">
          <Button onClick={closeModal} className="cancel-btn">
            {t("DataList.sourceSetter.cancel")}
          </Button>
          <Button type="primary" onClick={handleSave} className="save-btn">
            {t("DataList.sourceSetter.save")}
          </Button>
        </div>
      </Modal>

      <Modal
        centered
        title={null}
        visible={deleteModalVisible}
        onCancel={closeDeleteModal}
        footer={null}
        destroyOnClose
        maskClosable={false}
        closable={false}
        className="datalist-delete-modal"
        getContainer={() => document.body}
        width={480}
      >
        <div className="delete-modal-content">
          <div className="delete-modal-icon">
            <ExclamationCircleFilled />
          </div>
          <div className="delete-modal-body">
            <div className="delete-modal-title">
              {t("DataList.deleteRecordTitle")}
            </div>
            <div className="delete-modal-desc">
              {t("DataList.deleteRecordConfirm")}
            </div>
          </div>
        </div>

        <div className="delete-modal-footer">
          <Button onClick={closeDeleteModal} className="cancel-btn">
            {t("DataList.sourceSetter.cancel")}
          </Button>
          <Button type="primary" danger onClick={handleDelete} className="confirm-btn">
            {t("DataList.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default MaterialListTable;
