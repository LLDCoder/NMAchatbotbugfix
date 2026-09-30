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
import { Table, Modal, Card, Space } from "antd";
import IDSelectorField from "../IDSelector/IDSelectorField";
import { getNationalityList } from "../../../../../services/userProfile";
import { ConfirmModal } from "../../../../common";
import CustomButton from "../../../../common/CustomButton";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";

import "./styles.less";
import { reaction } from "@formily/reactive";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";

type PersonsInChargeModalMode = "add" | "edit" | "view";

type PersonItem = {
  id: string;
  fullNameArabic?: string;
  fullNameEnglish?: string;
  nationality?: number;
  idNumber?: string;
  occupation?: string;
  [key: string]: unknown;
};

type PersonsInChargeListFieldProps = {
  title?: string;
  titleEn?: string;
  titleAr?: string;
  addButtonLabel?: string;
  addButtonLabelEn?: string;
  addButtonLabelAr?: string;
  maxMembers?: number;
  showEmiratesId?: boolean;
  showUID?: boolean;
  showPassport?: boolean;
  className?: string;
  disabled?: boolean;
  [key: string]: unknown;
};

type PersonsInChargeFieldLike = {
  value?: unknown;
  setValue: (value: PersonItem[]) => void;
  pattern?: string;
};

type PersonsInChargeFormValues = Record<string, unknown> & {
  idSelector?: Partial<PersonItem> | PersonItem;
};

type PersonsInChargeFormInstance = {
  validate: () => Promise<void>;
  values: PersonsInChargeFormValues;
};

type NationalityItem = {
  id: number;
  nameEn?: string;
  nameAr?: string;
};

const PersonsInChargeListFieldDom: React.FC<PersonsInChargeListFieldProps> =
  observer((props) => {
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const t = i18n.getFixedT(lang);
    const isAr = lang === "ar";
    const field = useField() as unknown as PersonsInChargeFieldLike;
    const form = useForm();
    const value = (
      Array.isArray(field.value) ? field.value : []
    ) as PersonItem[];
    const isReviewMode = field.pattern === "readPretty";
    const isFormLocked =
      form.pattern === "disabled" ||
      form.pattern === "readOnly" ||
      form.pattern === "readPretty";
    const isReadOnlyMode =
      !!props.disabled ||
      field.pattern === "disabled" ||
      field.pattern === "readOnly" ||
      isReviewMode ||
      isFormLocked;

    const {
      title: legacyTitle,
      titleEn,
      titleAr,
      addButtonLabel: legacyAddButtonLabel,
      addButtonLabelEn,
      addButtonLabelAr,
      maxMembers,
      showEmiratesId = true,
      showUID = false,
      showPassport = false,
      className,
      ...restProps
    } = props;

    const tx = React.useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(t(`PersonsInChargeList.${key}`, options)),
      [t],
    );

    const resolvedTitle = getBilingualValueByLang({
      lang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: legacyTitle,
      fallback: tx("defaultTitle"),
    });
    const resolvedAddButtonLabel = getBilingualValueByLang({
      lang,
      host,
      en: addButtonLabelEn,
      ar: addButtonLabelAr,
      legacy: legacyAddButtonLabel,
      fallback: tx("defaultAddButton"),
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<PersonsInChargeModalMode>("add");
    const [formInstance, setFormInstance] =
      useState<PersonsInChargeFormInstance | null>(null);
    const [nationalityList, setNationalityList] = useState<NationalityItem[]>(
      [],
    );
    const [deleteModal, setDeleteModal] = useState<{
      visible: boolean;
      id: string | null;
    }>({
      visible: false,
      id: null,
    });
    const [isFormValid, setIsFormValid] = useState(false);
    const [isIcpReady, setIsIcpReady] = useState(false);

    useEffect(() => {
      const loadNationalityList = async () => {
        try {
          const res = await getNationalityList();
          if (Array.isArray(res.data)) {
            setNationalityList(res.data as NationalityItem[]);
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

    const getFullName = (person: PersonItem): string => {
      if (isAr) {
        if (person.fullNameArabic) return person.fullNameArabic;
        if (person.fullNameEnglish) return person.fullNameEnglish;
        return "-";
      }
      if (person.fullNameEnglish) return person.fullNameEnglish;
      if (person.fullNameArabic) return person.fullNameArabic;
      return "-";
    };

    const getNationalityName = (nationalityId?: number): string => {
      if (!nationalityId) return "-";
      const nationality = nationalityMap.get(nationalityId);
      if (!nationality) return "-";
      if (isAr) {
        return nationality.nameAr || nationality.nameEn || "-";
      }
      return nationality.nameEn || nationality.nameAr || "-";
    };

    const getIdNumber = (person: PersonItem): string => {
      if (person.emiratesId) return person.emiratesId;
      if (person.uid) return person.uid;
      if (person.passportNumber) return person.passportNumber;
      return "-";
    };

    const openModal = () => {
      const hasAtLeastOneMethod = showEmiratesId || showUID || showPassport;
      if (!hasAtLeastOneMethod) {
        Modal.warning({
          centered: true,
          title: tx("validationErrorTitle"),
          content: tx("validationMethodRequired"),
        });
        return;
      }

      setEditingId(null);
      setModalMode("add");
      setModalOpen(true);
      setIsFormValid(false);
      setIsIcpReady(false);
      const form = createForm({
        initialValues: {
          idSelector: {},
        },
      }) as unknown as PersonsInChargeFormInstance;
      setFormInstance(form);
    };

    const openEditModal = (person: PersonItem) => {
      const hasAtLeastOneMethod = showEmiratesId || showUID || showPassport;
      if (!hasAtLeastOneMethod) {
        Modal.warning({
          centered: true,
          title: tx("validationErrorTitle"),
          content: tx("validationMethodRequired"),
        });
        return;
      }

      setEditingId(person.id);
      setModalMode("edit");
      setModalOpen(true);
      setIsFormValid(false);
      setIsIcpReady(false);
      const form = createForm({
        initialValues: {
          idSelector: person,
        },
      }) as unknown as PersonsInChargeFormInstance;
      setFormInstance(form);
    };

    const openViewModal = (person: PersonItem) => {
      setEditingId(person.id);
      setModalMode("view");
      setModalOpen(true);
      setIsFormValid(true);
      setIsIcpReady(true);
      const form = createForm({
        initialValues: {
          idSelector: person,
        },
      }) as unknown as PersonsInChargeFormInstance;
      setFormInstance(form);
    };

    // Monitor form instance changes to validate
    useEffect(() => {
      if (!formInstance) return;

      const validateForm = async () => {
        try {
          await formInstance.validate();
          setIsFormValid(true);
        } catch {
          setIsFormValid(false);
        }
      };

      // Initial validation
      validateForm();

      const dispose = reaction(
        () => field.value,
        () => {
          validateForm();
        },
      );

      return () => dispose();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `reaction` already tracks `field.value`; adding it here would resubscribe on every change.
    }, [formInstance]);

    const closeModal = () => {
      setModalOpen(false);
      setEditingId(null);
      setModalMode("add");
      setFormInstance(null);
      setIsFormValid(false);
      setIsIcpReady(false);
    };

    const handleSave = async () => {
      if (modalMode === "view") {
        closeModal();
        return;
      }

      if (!formInstance) return;

      try {
        await formInstance.validate();
        const formValues = formInstance.values;
        const idSelectorValue = formValues.idSelector || formValues;

        const newPerson: PersonItem = {
          id:
            editingId ||
            `person-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...idSelectorValue,
        };

        if (maxMembers && maxMembers > 0 && !editingId) {
          const currentCount = value.length;
          if (currentCount >= maxMembers) {
            Modal.warning({
              centered: true,
              title: tx("limitReachedTitle"),
              content: tx("limitReachedContent", { count: maxMembers }),
            });
            return;
          }
        }

        if (editingId) {
          const next = value.map((v) => (v.id === editingId ? newPerson : v));
          field.setValue(next);
        } else {
          field.setValue([...value, newPerson]);
        }

        closeModal();
      } catch (error) {
        console.error("Form validation failed:", error);
      }
    };

    const openDeleteModal = (id: string) => {
      setDeleteModal({ visible: true, id });
    };

    const closeDeleteModal = () => {
      setDeleteModal({ visible: false, id: null });
    };

    const handleDelete = () => {
      if (deleteModal.id) {
        const next = value.filter((v) => v.id !== deleteModal.id);
        field.setValue(next);
      }
      closeDeleteModal();
    };

    const isAddButtonDisabled =
      maxMembers && maxMembers > 0 && value.length >= maxMembers;

    const renderEllipsisText = (text?: string) => {
      const displayText = text || "-";
      return (
        <div className="persons-in-charge-list-ellipsis" title={displayText}>
          {displayText}
        </div>
      );
    };

    const columns = [
      {
        title: tx("columnFullName"),
        dataIndex: "fullName",
        key: "fullName",
        ellipsis: true,
        width: "26%",
        render: (_value: unknown, record: PersonItem) =>
          renderEllipsisText(getFullName(record)),
      },
      {
        title: tx("columnNationality"),
        dataIndex: "nationality",
        key: "nationality",
        ellipsis: true,
        width: "18%",
        render: (_value: unknown, record: PersonItem) =>
          renderEllipsisText(getNationalityName(record.nationality)),
      },
      {
        title: tx("columnIdNumber"),
        dataIndex: "idNumber",
        key: "idNumber",
        ellipsis: true,
        width: "22%",
        render: (_value: unknown, record: PersonItem) =>
          renderEllipsisText(getIdNumber(record)),
      },
      {
        title: tx("columnOccupation"),
        dataIndex: "occupation",
        key: "occupation",
        ellipsis: true,
        width: "20%",
        render: (occupation: string | undefined) =>
          renderEllipsisText(occupation),
      },
      {
        title: tx("columnActions"),
        key: "actions",
        width: 120,
        render: (_value: unknown, record: PersonItem) => (
          <Space>
            {isReadOnlyMode ? (
              <span
                className="action-view "
                onClick={() => openViewModal(record)}
              >
                {String(
                  t("PersonsInChargeList.actionView", {
                    defaultValue: isAr ? "عرض" : "View",
                  }),
                )}
              </span>
            ) : (
              <>
                <span
                  className="action-edit "
                  onClick={() => openEditModal(record)}
                >
                  {tx("actionEdit")}
                </span>
                <span
                  className="action-delete"
                  onClick={() => openDeleteModal(record.id)}
                >
                  {tx("actionDelete")}
                </span>
              </>
            )}
          </Space>
        ),
      },
    ];

    return (
      <div
        {...restProps}
        className={["persons-in-charge-list-container", className]
          .filter(Boolean)
          .join(" ")}
      >
        <Card
          className="persons-in-charge-list-card"
          title={
            <div className="persons-in-charge-list-title">
              <div>
                {" "}
                {resolvedTitle}{" "}
                <span style={{ color: "#EA4F49"}}>*</span>
              </div>

              {!isReadOnlyMode && (
                <CustomButton
                  disabled={isAddButtonDisabled}
                  className="social-media-account-add-btn"
                  onClick={openModal}
                >
                  {resolvedAddButtonLabel}
                </CustomButton>
              )}
            </div>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={value}
            pagination={false}
            size="middle"
            tableLayout="fixed"
            style={{ width: "100%" }}
            locale={{
              emptyText: (
                <EmptyBox
                  title={tx("emptyText")}
                  customClassName="persons-in-charge-list-empty"
                />
              ),
            }}
          />
        </Card>

        <Modal
          centered
          title={
            modalMode === "view"
              ? String(
                  t("PersonsInChargeList.viewPersonTitle", {
                    defaultValue: isAr ? "عرض العضو" : "View Person",
                  }),
                )
              : editingId
              ? tx("editPersonTitle")
              : tx("addPersonTitle")
          }
          visible={modalOpen}
          onCancel={closeModal}
          onOk={modalMode === "view" ? closeModal : handleSave}
          okText={
            modalMode === "view" ? tx("cancelButton") : tx("confirmButton")
          }
          cancelText={tx("cancelButton")}
          width={900}
          destroyOnClose
          cancelButtonProps={{
            style: {
              display: modalMode === "view" ? "none" : undefined,
            },
          }}
          okButtonProps={{
            disabled:
              modalMode === "view" ? false : !isFormValid || !isIcpReady,
            className: "custom-button-primary  Formily-save-btn",
          }}
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
                      disabled: modalMode === "view",
                      onIcpLoadedChange: setIsIcpReady,
                    },
                  ]}
                  decorator={[FormItem]}
                />
              </Form>
            </FormProvider>
          )}
        </Modal>

        <ConfirmModal
          visible={deleteModal.visible}
          type="danger"
          title={tx("deleteRecordTitle")}
          content={tx("deleteRecordContent")}
          cancelText={tx("cancelButton")}
          confirmText={tx("actionDelete")}
          onCancel={closeDeleteModal}
          onConfirm={handleDelete}
        />
      </div>
    );
  });

PersonsInChargeListFieldDom.displayName = "PersonsInChargeListFieldDom";

export const PersonsInChargeListField = connect(
  PersonsInChargeListFieldDom,
  mapProps((props) => {
    return props;
  }),
);

PersonsInChargeListField.displayName = "PersonsInChargeListField";

export default PersonsInChargeListField;
