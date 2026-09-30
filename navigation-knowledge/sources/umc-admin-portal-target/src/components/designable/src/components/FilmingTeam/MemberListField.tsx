import * as React from "react";
import { useEffect, useState } from "react";
import {
  observer,
  useField,
  useForm,
  Field,
  FormProvider,
  connect,
  mapProps,
} from "@formily/react";
import { createForm } from "@formily/core";

import { FormItem, Form } from "@formily/antd";
import { Table, Button, Modal, Card, Space, Input, Pagination } from "antd";
import { EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import IDSelectorField from "../IDSelector/IDSelectorField";
import ConfirmModal from "../../../../../components/common/ConfirmModal";
import { getNationalityList } from "../../../../../services/userProfile";
import { exportPhotographyTeamMember } from "@/services/photographyDocumentExport";
import "./styles.less";
import { CustomButton } from "../../../../common";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";

type MemberItem = {
  id: string;
  fullNameArabic?: string;
  fullNameEnglish?: string;
  nationality?: number;
  idNumber?: string;
  occupation?: string;
  type?: string;
  emiratesId?: string;
  uid?: string;
  passportNumber?: string;
  [key: string]: unknown;
};

type NationalityItem = {
  id: number;
  nameEn?: string;
  nameAr?: string;
};

type MemberFormValues = Partial<MemberItem> & {
  idSelector?: Partial<MemberItem>;
};

type FilmingTeamProps = {
  labelName?: string;
  labelNameEn?: string;
  labelNameAr?: string;
  existingMemberButtonLabel?: string;
  existingMemberButtonLabelEn?: string;
  existingMemberButtonLabelAr?: string;
  newMemberButtonLabel?: string;
  newMemberButtonLabelEn?: string;
  newMemberButtonLabelAr?: string;
  memberLimits?: number;
  showEmiratesId?: boolean;
  showUID?: boolean;
  showPassport?: boolean;
  disabled?: boolean;
  serviceCode?: string | number | null;
  /** Licensing application id, required to export a single team member as PDF. */
  applicationId?: number;
} & Record<string, unknown>;

type MemberModalMode = "add" | "edit" | "view";

const MemberListFieldDom: React.FC<FilmingTeamProps> = observer((props) => {
  const field = useField();
  const form = useForm();
  const value = React.useMemo(
    () => (Array.isArray(field.value) ? (field.value as MemberItem[]) : []),
    [field.value],
  );
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const t = i18n.getFixedT(lang);

  const {
    labelName: legacyLabelName,
    labelNameEn,
    labelNameAr,
    existingMemberButtonLabel: legacyExistingMemberButtonLabel,
    existingMemberButtonLabelEn,
    existingMemberButtonLabelAr,
    newMemberButtonLabel: legacyNewMemberButtonLabel,
    newMemberButtonLabelEn,
    newMemberButtonLabelAr,
    memberLimits,
    showEmiratesId = true,
    showUID = true,
    showPassport = true,
    disabled = false,
    serviceCode,
    applicationId,
  } = props;
  const isReadOnlyMode =
    disabled ||
    field.pattern === "disabled" ||
    field.pattern === "readOnly" ||
    field.pattern === "readPretty" ||
    form.pattern === "disabled" ||
    form.pattern === "readOnly" ||
    form.pattern === "readPretty";

  const labelName = getBilingualValueByLang({
    lang,
    host,
    en: labelNameEn,
    ar: labelNameAr,
    legacy: legacyLabelName,
    fallback: t("FilmingTeam.defaultLabelName"),
  });
  const existingMemberButtonLabel = getBilingualValueByLang({
    lang,
    host,
    en: existingMemberButtonLabelEn,
    ar: existingMemberButtonLabelAr,
    legacy: legacyExistingMemberButtonLabel,
    fallback: t("FilmingTeam.defaultExistingMemberButtonLabel"),
  });
  const newMemberButtonLabel = getBilingualValueByLang({
    lang,
    host,
    en: newMemberButtonLabelEn,
    ar: newMemberButtonLabelAr,
    legacy: legacyNewMemberButtonLabel,
    fallback: t("FilmingTeam.defaultNewMemberButtonLabel"),
  });

  const [newMemberModalOpen, setNewMemberModalOpen] = useState(false);
  const [existingMemberModalOpen, setExistingMemberModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberModalMode, setMemberModalMode] = useState<MemberModalMode>("add");
  const [formInstance, setFormInstance] =
    useState<ReturnType<typeof createForm> | null>(null);
  const [nationalityList, setNationalityList] = useState<NationalityItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const loadNationalityList = async () => {
      try {
        const res = await getNationalityList();
        if (res.data) {
          setNationalityList(res.data);
        }
      } catch (error) {
        console.error("Failed to load nationality list:", error);
      }
    };
    loadNationalityList();
  }, []);

  const nationalityMap = React.useMemo(() => {
    const map = new Map<number, NationalityItem>();
    nationalityList.forEach((item) => map.set(item.id, item));
    return map;
  }, [nationalityList]);

  const getFullName = React.useCallback(
    (member: MemberItem): string => {
      if (lang === "ar") {
        if (member.fullNameArabic) return member.fullNameArabic;
        if (member.fullNameEnglish) return member.fullNameEnglish;
        return "-";
      }
      if (member.fullNameEnglish) return member.fullNameEnglish;
      if (member.fullNameArabic) return member.fullNameArabic;
      return "-";
    },
    [lang],
  );

  const getNationalityName = React.useCallback(
    (nationalityId?: number): string => {
      if (!nationalityId) return "-";
      const nationality = nationalityMap.get(nationalityId);
      if (lang === "ar") {
        return nationality?.nameAr || nationality?.nameEn || "-";
      }
      return nationality?.nameEn || nationality?.nameAr || "-";
    },
    [lang, nationalityMap],
  );

  const getIdNumber = React.useCallback((member: MemberItem): string => {
    if (member.emiratesId) return member.emiratesId;
    if (member.uid) return member.uid;
    if (member.passportNumber) return member.passportNumber;
    return "-";
  }, []);

  const isMaxMembersReached =
    memberLimits && memberLimits > 0 && value.length >= memberLimits;

  const openNewMemberModal = () => {
    const hasAtLeastOneMethod = showEmiratesId || showUID || showPassport;
    if (!hasAtLeastOneMethod) {
      Modal.warning({
        centered: true,
        title: t("FilmingTeam.validationErrorTitle"),
        content: t("FilmingTeam.validationMethodRequired"),
      });
      return;
    }

    setEditingId(null);
    setMemberModalMode("add");
    setNewMemberModalOpen(true);
    const form = createForm({
      initialValues: {
        idSelector: {},
      },
    });
    setFormInstance(form);
  };

  const openEditModal = (member: MemberItem) => {
    const hasAtLeastOneMethod = showEmiratesId || showUID || showPassport;
    if (!hasAtLeastOneMethod) {
      Modal.warning({
        centered: true,
        title: t("FilmingTeam.validationErrorTitle"),
        content: t("FilmingTeam.validationMethodRequired"),
      });
      return;
    }

    setEditingId(member.id);
    setMemberModalMode("edit");
    setNewMemberModalOpen(true);
    const form = createForm({
      initialValues: {
        idSelector: { ...member },
      },
    });
    setFormInstance(form);
  };

  const openViewModal = (member: MemberItem) => {
    setEditingId(member.id);
    setMemberModalMode("view");
    setNewMemberModalOpen(true);
    const form = createForm({
      initialValues: {
        idSelector: { ...member },
      },
    });
    setFormInstance(form);
  };

  const closeNewMemberModal = () => {
    setNewMemberModalOpen(false);
    setEditingId(null);
    setMemberModalMode("add");
    setFormInstance(null);
  };

  const viewingMember = React.useMemo(
    () => value.find((item) => item.id === editingId),
    [value, editingId],
  );

  const canExportViewingMember =
    memberModalMode === "view" &&
    Number(serviceCode) === 7 &&
    viewingMember?.type === "passport" &&
    applicationId != null;

  const [exportingMember, setExportingMember] = useState(false);

  const handleExportMember = async () => {
    if (!viewingMember || applicationId == null || exportingMember) return;
    setExportingMember(true);
    try {
      await exportPhotographyTeamMember(applicationId, viewingMember.id);
    } catch (error) {
      console.error("Failed to export filming team member:", error);
    } finally {
      setExportingMember(false);
    }
  };

  const closeExistingMemberModal = () => {
    setExistingMemberModalOpen(false);
    setSelectedRowKeys([]);
    setSearchText("");
    setCurrentPage(1);
  };

  const handleNewMemberSave = async () => {
    if (memberModalMode === "view") {
      closeNewMemberModal();
      return;
    }

    if (!formInstance) return;

    try {
      await formInstance.validate();
      const formValues = formInstance.values as MemberFormValues;
      const idSelectorValue = formValues.idSelector || formValues;

      const newMember: MemberItem = {
        id:
          editingId ||
          `member-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...idSelectorValue,
      };

      if (memberLimits && memberLimits > 0 && !editingId) {
        const currentCount = value.length;
        if (currentCount >= memberLimits) {
          Modal.warning({
            centered: true,
            title: t("FilmingTeam.limitReachedTitle"),
            content: t("FilmingTeam.memberLimitReached", {
              count: memberLimits,
            }),
          });
          return;
        }
      }

      if (editingId) {
        const next = value.map((v) => (v.id === editingId ? newMember : v));
        field.setValue(next);
      } else {
        field.setValue([...value, newMember]);
      }

      closeNewMemberModal();
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };

  const openDeleteModal = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletingId(null);
  };

  const handleDelete = () => {
    if (deletingId) {
      const next = value.filter((v) => v.id !== deletingId);
      field.setValue(next);
    }
    closeDeleteModal();
  };

  const handleAddExistingMembers = () => {
    const selectedMembers = filteredData.filter((item) =>
      selectedRowKeys.includes(item.id),
    );
    const newMembers = selectedMembers.filter(
      (item) => !value.some((v) => v.id === item.id),
    );
    if (newMembers.length > 0) {
      field.setValue([...value, ...newMembers]);
    }
    closeExistingMemberModal();
  };

  const filteredData = React.useMemo(() => {
    const allAvailableMembers: MemberItem[] = [];
    if (!searchText) return allAvailableMembers;
    return allAvailableMembers.filter((item) => {
      const fullName = getFullName(item).toLowerCase();
      const nationality = getNationalityName(item.nationality).toLowerCase();
      const idNumber = getIdNumber(item).toLowerCase();
      const occupation = (item.occupation || "").toLowerCase();
      const search = searchText.toLowerCase();
      return (
        fullName.includes(search) ||
        nationality.includes(search) ||
        idNumber.includes(search) ||
        occupation.includes(search)
      );
    });
  }, [getFullName, getIdNumber, getNationalityName, searchText]);

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, pageSize]);

  const displayData = React.useMemo(() => {
    if (memberLimits && memberLimits > 0) {
      return value.slice(0, memberLimits);
    }
    return value;
  }, [value, memberLimits]);

  const columns = [
    {
      title: t("FilmingTeam.columnFullName"),
      dataIndex: "fullName",
      key: "fullName",
      render: (_value: unknown, record: MemberItem) => getFullName(record),
    },
    {
      title: t("FilmingTeam.columnNationality"),
      dataIndex: "nationality",
      key: "nationality",
      render: (_value: unknown, record: MemberItem) =>
        getNationalityName(record.nationality),
    },
    {
      title: t("FilmingTeam.columnIdNumber"),
      dataIndex: "idNumber",
      key: "idNumber",
      render: (_value: unknown, record: MemberItem) => getIdNumber(record),
    },
    {
      title: t("FilmingTeam.columnOccupation"),
      dataIndex: "occupation",
      key: "occupation",
      render: (occupation: string | undefined) => occupation || "-",
    },
  ];

  if (!isReadOnlyMode) {
    columns.push({
      title: t("FilmingTeam.columnActions"),
      key: "actions",
      render: (_value: unknown, record: MemberItem) => (
        <div className="Formliy-action">
          <Button
            type="link"
            onClick={() => openEditModal(record)}
            disabled={disabled}
            className="Edit"
          >
            {t("FilmingTeam.actionEdit")}
          </Button>
          <Button
            type="link"
            onClick={() => openDeleteModal(record.id)}
            disabled={disabled}
            className="Edit"
          >
            {t("FilmingTeam.actionDelete")}
          </Button>
        </div>
      ),
    });
  } else {
    columns.push({
      title: t("FilmingTeam.columnActions"),
      key: "actions",
      render: (_value: unknown, record: MemberItem) => (
        <Button
          type="link"
          onClick={() => openViewModal(record)}
          className="member-list-view-btn"
        >
          {t("FilmingTeam.actionView")}
        </Button>
      ),
    });
  }

  const existingMemberColumns = [
    {
      title: t("FilmingTeam.columnFullName"),
      dataIndex: "fullName",
      key: "fullName",
      render: (_value: unknown, record: MemberItem) => getFullName(record),
    },
    {
      title: t("FilmingTeam.columnNationality"),
      dataIndex: "nationality",
      key: "nationality",
      render: (_value: unknown, record: MemberItem) =>
        getNationalityName(record.nationality),
    },
    {
      title: t("FilmingTeam.columnIdNumber"),
      dataIndex: "idNumber",
      key: "idNumber",
      render: (_value: unknown, record: MemberItem) => getIdNumber(record),
    },
    {
      title: t("FilmingTeam.columnOccupation"),
      dataIndex: "occupation",
      key: "occupation",
      render: (occupation: string | undefined) => occupation || "-",
    },
  ];

  return (
    <div className="member-list-container" {...props}>
      <Card
        className="member-list-card"
        title={labelName}
        extra={
          !isReadOnlyMode ? (
            <Space>
              <CustomButton
                variant="outline"
                onClick={() => setExistingMemberModalOpen(true)}
                disabled={disabled || isMaxMembersReached}
              >
                {existingMemberButtonLabel}
              </CustomButton>
              <CustomButton
                variant="gold"
                type="primary"
                onClick={openNewMemberModal}
                disabled={disabled || isMaxMembersReached}
              >
                {newMemberButtonLabel}
              </CustomButton>
            </Space>
          ) : null
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={displayData}
          pagination={false}
          size="middle"
          locale={{
            emptyText: <EmptyBox title={t("FilmingTeam.emptyTable")} />,
          }}
        />
      </Card>

      <Modal
        centered
        title={
          memberModalMode === "view"
            ? t("FilmingTeam.viewMemberTitle")
            : editingId
              ? t("FilmingTeam.editMemberTitle")
              : newMemberButtonLabel
        }
        visible={newMemberModalOpen}
        onCancel={closeNewMemberModal}
        footer={null}
        width={900}
        destroyOnClose
      >
        {formInstance && (
          <FormProvider form={formInstance}>
            <Form form={formInstance} layout="vertical">
              <Field
                name="idSelector"
                component={[
                  IDSelectorField,
                  {
                    showEmiratesId,
                    showUID,
                    showPassport,
                    passportMode: "filmingTeam",
                    disabled: memberModalMode === "view",
                  },
                ]}
                decorator={[FormItem]}
              />
            </Form>
          </FormProvider>
        )}
        <div className="member-modal-footer">
          {memberModalMode === "view" ? (
            <>
             {canExportViewingMember ? (
                <CustomButton
                  variant="gold"
                  type="primary"
                  size="medium"
                  loading={exportingMember}
                  onClick={handleExportMember}
                >
                  {t("FilmingTeam.exportButton")}
                </CustomButton>
              ) : null}
              <CustomButton
                variant="outline"
                size="medium"
                onClick={closeNewMemberModal}
              >
                {t("FilmingTeam.closeButton")}
              </CustomButton>
             
            </>
          ) : (
            <>
              <Button onClick={closeNewMemberModal}>
                {t("FilmingTeam.cancelButton")}
              </Button>
              <Button type="primary" onClick={handleNewMemberSave}>
                {t("FilmingTeam.confirmButton")}
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        centered
        title={existingMemberButtonLabel}
        visible={existingMemberModalOpen}
        onCancel={closeExistingMemberModal}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <div className="member-list-search-container">
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("FilmingTeam.searchPlaceholder")}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            style={{ marginBottom: 16 }}
          />
          <div className="member-list-selected-count">
            {selectedRowKeys.length > 0 && (
              <span>
                {t("FilmingTeam.selectedCount", {
                  count: selectedRowKeys.length,
                })}
              </span>
            )}
          </div>
          <Table
            rowKey="id"
            columns={existingMemberColumns}
            dataSource={paginatedData}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={false}
            size="middle"
            locale={{
              emptyText: (
                <EmptyBox title={t("FilmingTeam.emptyExistingMembers")} />
              ),
            }}
          />
          <div className="member-list-pagination">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredData.length}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
              showSizeChanger
              showTotal={(total) =>
                t("FilmingTeam.totalItems", { count: total })
              }
            />
          </div>
        </div>
        <div className="member-modal-footer">
          <Button onClick={closeExistingMemberModal}>
            {t("FilmingTeam.cancelButton")}
          </Button>
          <Button
            type="primary"
            onClick={handleAddExistingMembers}
            disabled={selectedRowKeys.length === 0}
          >
            {t("FilmingTeam.confirmButton")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        visible={deleteModalOpen}
        onCancel={closeDeleteModal}
        onConfirm={handleDelete}
        title={t("FilmingTeam.deleteRecordTitle")}
        content={t("FilmingTeam.deleteRecordContent")}
        cancelText={t("FilmingTeam.cancelButton")}
        confirmText={t("FilmingTeam.confirmButton")}
        type="danger"
      />
    </div>
  );
});

MemberListFieldDom.displayName = "MemberListFieldDom";

export const MemberListField = connect(
  MemberListFieldDom,
  mapProps((currentProps) => currentProps),
);

MemberListField.displayName = "MemberListField";

export default MemberListField;
