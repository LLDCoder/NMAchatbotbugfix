import { Form, Input, Modal } from "antd";
import type { ColumnsType } from "antd/lib/table";
import type { TablePaginationConfig } from "antd/lib/table/interface";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfirmModal,
  CustomButton,
  CustomMessage,
  PaginationTotal,
} from "@/components/common";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import Sousuo from "@/assets/icons/Sousuo";
import {
  addBlockedAuthor,
  deleteBlockedAuthor,
  getBlockedAuthorList,
  updateBlockedAuthor,
  type IBlockedAuthor,
  type IBlockedAuthorListRequest,
  type IBlockedAuthorListResponse,
  type IBlockedAuthorPayload,
} from "@/services/contentLibrary";
import { DISPLAY_DATETIME, fmt } from "@/utils/gstTime";
import "./index.less";

type BlockedAuthorFormValues = {
  authorNameAr: string;
  authorNameEn: string;
  notes?: string;
};

type BlockedAuthorFilterValues = {
  SearchKey?: string;
};

type FormMode = "add" | "edit";
const ARABIC_AUTHOR_NAME_PATTERN =
  /^[\p{Script_Extensions=Arabic}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\-']*$/u;



const INITIAL_PARAMS: IBlockedAuthorListRequest = {
  PageIndex: 1,
  PageSize: 10,
  SortDirection: "Descending",
};

const EMPTY_LIST: IBlockedAuthorListResponse = {
  items: [],
  totalItems: 0,
  currentPage: 1,
  itemsPerPage: 10,
  totalPage: 0,
  totalAmount: 0,
};

export default function BlockedAuthors() {
  const { t } = useTranslation();
  const [filterStore] = useFilter();
  const [form] = Form.useForm<BlockedAuthorFormValues>();
  const [params, setParams] =
    useState<IBlockedAuthorListRequest>(INITIAL_PARAMS);
  const [data, setData] = useState<IBlockedAuthorListResponse>(EMPTY_LIST);
  const [loading, setLoading] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [selectedAuthor, setSelectedAuthor] =
    useState<IBlockedAuthor | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const authorNameAr = Form.useWatch("authorNameAr", form);
  const authorNameEn = Form.useWatch("authorNameEn", form);
  const submitDisabled =
    !authorNameAr?.trim() || !authorNameEn?.trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getBlockedAuthorList(params)
      .then((response) => {
        if (!cancelled) {
          setData(response.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load blocked authors:", error);
          setData({
            ...EMPTY_LIST,
            currentPage: params.PageIndex,
            itemsPerPage: params.PageSize,
          });
          CustomMessage.error(
            t("Content.contentLibrary.blockedAuthors.messages.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params, t]);

  const refreshCurrentPage = useCallback(() => {
    setParams((current) => ({ ...current }));
  }, []);

  const closeFormModal = useCallback(() => {
    if (submitLoading) return;
    setFormModalVisible(false);
    setSelectedAuthor(null);
    form.resetFields();
  }, [form, submitLoading]);

  const openAddModal = useCallback(() => {
    setFormMode("add");
    setSelectedAuthor(null);
    form.resetFields();
    setFormModalVisible(true);
  }, [form]);

  const openEditModal = useCallback(
    (record: IBlockedAuthor) => {
      setFormMode("edit");
      setSelectedAuthor(record);
      form.setFieldsValue({
        authorNameAr: record.authorNameAr,
        authorNameEn: record.authorNameEn,
        notes: record.notes ?? undefined,
      });
      setFormModalVisible(true);
    },
    [form],
  );

  const openDeleteModal = useCallback((record: IBlockedAuthor) => {
    setSelectedAuthor(record);
    setDeleteModalVisible(true);
  }, []);

  const handleSubmit = async (values: BlockedAuthorFormValues) => {
    const payload: IBlockedAuthorPayload = {
      authorNameAr: values.authorNameAr.trim(),
      authorNameEn: values.authorNameEn.trim(),
      notes: values.notes?.trim() || null,
    };

    setSubmitLoading(true);
    try {
      if (formMode === "edit" && selectedAuthor) {
        const response = await updateBlockedAuthor({
          id: selectedAuthor.id,
          ...payload,
        });
        if (response.data !== true) {
          throw new Error("Blocked author update was not completed.");
        }
        CustomMessage.success(
          t("Content.contentLibrary.blockedAuthors.messages.updateSuccess"),
        );
        refreshCurrentPage();
      } else {
        const response = await addBlockedAuthor(payload);
        if (response.data !== true) {
          throw new Error("Blocked author creation was not completed.");
        }
        CustomMessage.success(
          t("Content.contentLibrary.blockedAuthors.messages.addSuccess"),
        );
        filterStore.resetFields();
        setParams((current) => ({
          ...current,
          SearchKey: undefined,
          PageIndex: 1,
        }));
      }
      setFormModalVisible(false);
      setSelectedAuthor(null);
      form.resetFields();
    } catch (error) {
      console.error(`Failed to ${formMode} blocked author:`, error);
      CustomMessage.error(
        t(
          formMode === "edit"
            ? "Content.contentLibrary.blockedAuthors.messages.updateFailed"
            : "Content.contentLibrary.blockedAuthors.messages.addFailed",
        ),
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAuthor) return;

    setDeleteLoading(true);
    try {
      const response = await deleteBlockedAuthor(selectedAuthor.id);
      if (response.data !== true) {
        throw new Error("Blocked author deletion was not completed.");
      }
      CustomMessage.success(
        t("Content.contentLibrary.blockedAuthors.messages.deleteSuccess"),
      );
      setDeleteModalVisible(false);
      setSelectedAuthor(null);
      setParams((current) => ({
        ...current,
        PageIndex:
          data.items.length === 1 && current.PageIndex > 1
            ? current.PageIndex - 1
            : current.PageIndex,
      }));
    } catch (error) {
      console.error("Failed to delete blocked author:", error);
      CustomMessage.error(
        t("Content.contentLibrary.blockedAuthors.messages.deleteFailed"),
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = useMemo<ColumnsType<IBlockedAuthor>>(
    () => [
      {
        title: t(
          "Content.contentLibrary.blockedAuthors.columns.authorNameAr",
        ),
        dataIndex: "authorNameAr",
        key: "authorNameAr",
        render: (value: string) => (
          <span className="blocked-authors__arabic-name" dir="rtl">
            {value}
          </span>
        ),
      },
      {
        title: t(
          "Content.contentLibrary.blockedAuthors.columns.authorNameEn",
        ),
        dataIndex: "authorNameEn",
        key: "authorNameEn",
      },
      {
        title: t(
          "Content.contentLibrary.blockedAuthors.columns.creationTime",
        ),
        dataIndex: "createdOn",
        key: "createdOn",
        width: 240,
        render: (value: string) => fmt(value, DISPLAY_DATETIME),
      },
      {
        title: t("Content.contentLibrary.columns.actions"),
        key: "actions",
        width: 190,
        render: (_value, record) => (
          <div className="blocked-authors__actions">
            <CustomButton
              customClassName="blocked-authors__action-button"
              onClick={() => openEditModal(record)}
              text={t("common.edit")}
              variant="text"
            />
            <CustomButton
              customClassName="blocked-authors__action-button"
              onClick={() => openDeleteModal(record)}
              text={t("common.delete")}
              variant="text"
            />
          </div>
        ),
      },
    ],
    [openDeleteModal, openEditModal, t],
  );

  const tableFilters = useMemo(
    () => [
      {
        label: t("Content.contentLibrary.blockedAuthors.searchLabel"),
        element: (
          <Input
            allowClear
            key="input-SearchKey"
            placeholder={t(
              "Content.contentLibrary.blockedAuthors.searchPlaceholder",
            )}
            prefix={<Sousuo className="blocked-authors__search-icon" />}
          />
        ),
        requestDebounceMs: 300,
      },
    ],
    [t],
  );

  const handleFilterRequest = async () => {
    const values = filterStore.getFieldsValue() as BlockedAuthorFilterValues;
    setParams((current) => ({
      ...current,
      SearchKey: values.SearchKey?.trim() || undefined,
      PageIndex: 1,
    }));
  };

  return (
    <div className="blocked-authors">
      <FilterTable
        columns={columns}
        containerCls="blocked-authors__filter-table"
        dataSource={data.items}
        extraBtn={
          <CustomButton
            customClassName="blocked-authors__add-button"
            onClick={openAddModal}
            text={t("Content.contentLibrary.blockedAuthors.actions.addAuthor")}
            variant="outline"
          />
        }
        filterStore={filterStore}
        loading={loading}
        pagination={{
          current: data.currentPage,
          pageSize: data.itemsPerPage,
          pageSizeOptions: ["10", "20", "50"],
          showSizeChanger: true,
          showTotal: (total: number) => (
            <PaginationTotal
              current={data.currentPage}
              label={t("common.total")}
              pageSize={data.itemsPerPage}
              total={total}
            />
          ),
          total: data.totalItems,
        }}
        request={handleFilterRequest}
        responsiveToolbar
        rowKey="id"
        scroll={{ x: 1080 }}
        tableFilters={tableFilters}
        onChange={(pagination: TablePaginationConfig) => {
          setParams((current) => ({
            ...current,
            PageIndex: pagination.current ?? 1,
            PageSize: pagination.pageSize ?? current.PageSize,
          }));
        }}
      />

      <Modal
        centered
        className="blocked-authors__form-modal"
        destroyOnClose
        footer={null}
        forceRender
        maskClosable={!submitLoading}
        title={t(
          formMode === "add"
            ? "Content.contentLibrary.blockedAuthors.modals.addTitle"
            : "Content.contentLibrary.blockedAuthors.modals.editTitle",
        )}
        visible={formModalVisible}
        width={640}
        onCancel={closeFormModal}
      >
        <Form
          className="blocked-authors__form"
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label={t(
              "Content.contentLibrary.blockedAuthors.fields.authorNameAr",
            )}
            name="authorNameAr"
            validateTrigger={["onBlur", "onSubmit"]}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t(
                  "Content.contentLibrary.blockedAuthors.validation.authorNameArRequired",
                ),
              },
              {
                pattern: ARABIC_AUTHOR_NAME_PATTERN,
                message: t(
                  "Content.contentLibrary.blockedAuthors.validation.authorNameArArabicOnly",
                ),
              },
            ]}
          >
            <Input
              dir="rtl"
              maxLength={300}
              placeholder={t(
                "Content.contentLibrary.blockedAuthors.placeholders.authorNameAr",
              )}
            />
          </Form.Item>
          <Form.Item
            label={t(
              "Content.contentLibrary.blockedAuthors.fields.authorNameEn",
            )}
            name="authorNameEn"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t(
                  "Content.contentLibrary.blockedAuthors.validation.authorNameEnRequired",
                ),
              },
            ]}
          >
            <Input
              dir="ltr"
              maxLength={300}
              placeholder={t(
                "Content.contentLibrary.blockedAuthors.placeholders.authorNameEn",
              )}
            />
          </Form.Item>
          <Form.Item
            className="blocked-authors__notes-field"
            label={t("Content.contentLibrary.blockedAuthors.fields.notes")}
            name="notes"
          >
            <Input.TextArea
              maxLength={1000}
              placeholder={t(
                "Content.contentLibrary.blockedAuthors.placeholders.notes",
              )}
              rows={4}
              showCount
            />
          </Form.Item>
        </Form>
        <div className="blocked-authors__form-footer">
          <CustomButton
            disabled={submitLoading}
            onClick={closeFormModal}
            text={t("common.cancel")}
            variant="outline"
          />
          <CustomButton
            disabled={Boolean(submitDisabled)}
            loading={submitLoading}
            onClick={() => form.submit()}
            text={t("common.confirm")}
            variant="primary"
          />
        </div>
      </Modal>

      <ConfirmModal
        content={t(
          "Content.contentLibrary.blockedAuthors.modals.deleteContent",
        )}
        loading={deleteLoading}
        title={t(
          "Content.contentLibrary.blockedAuthors.modals.deleteTitle",
        )}
        type="danger"
        visible={deleteModalVisible}
        onCancel={() => {
          if (deleteLoading) return;
          setDeleteModalVisible(false);
          setSelectedAuthor(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
