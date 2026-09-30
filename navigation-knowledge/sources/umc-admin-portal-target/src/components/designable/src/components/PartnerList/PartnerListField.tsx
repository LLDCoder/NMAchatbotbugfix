import * as React from "react";
import { useEffect, useState } from "react";
import {
  observer,
  useField,
  useFieldSchema,
  useForm,
  Field,
  FormProvider,
} from "@formily/react";
import { createForm } from "@formily/core";
import { FormItem, Form } from "@formily/antd";
import { Modal, Row, Col, Input, Select, Card } from "antd";
import { EMIRATES_ID_REGEX, type IDSelectorValue } from "../IDSelector/idSelectorUtils";
import IDSelectorField from "../IDSelector/IDSelectorField";
import QueryInput from "../IDSelector/components/QueryInput";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import CustomButton from "../../../../../components/common/CustomButton";
import {
  getNationalityList,
} from "../../../../../services/userProfile";
import { CustomMessage } from "../../../../../components/common";
import EmptyIcon from "@/assets/images/empty.svg";
import CompanyProfileIcon from "@/assets/images/profile-company.svg";
import IndividualProfileIcon from "@/assets/images/profile-individual.svg";
import PartnerUserIcon from "./assets/partner-user.svg";
import NumberIcon from "@/assets/images/number.svg";
import PartnerLocationIcon from "./assets/partner-location.svg";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { renderDesignerTooltipIcon } from "../DesignerTooltip";
import {
  FORMILY_COMPONENT_KEYS,
  FORMILY_SLOT_KEYS,
} from "@/components/common/FormliyView/runtimeSlots";
import { useFormilyRenderSlot } from "@/components/common/FormliyView/useFormilyRenderSlot";
import "./styles.less";

const { Option } = Select;

const SERVICE_905_INITIAL_PARTNER_IDS_FIELD = "partnerManagementInitialPartnerIds";
const INDIVIDUAL_ATTACHMENT_EDIT_FIELDS = [
  "PersonalPhoto",
  "EmiratesID",
  "PassportScan",
  "Passport",
  "Visa",
] as const;
const DUPLICATE_IDENTIFIER_FIELDS = [
  "emiratesId",
  "uid",
  "passportNumber",
] as const;
const REMOVED_PARTNER_LIST_FIELD = "removedPartnerList";

export type PartnerItem = IDSelectorValue & {
  id: string;
  isOwner?: boolean;
  partnerType: "individual" | "company";
  partnerTypeCode?: number | string;
  fullNameArabic?: string;
  fullNameEnglish?: string;
  fullNameAr?: string;
  fullNameEn?: string;
  representativeNameEn?: string | null;
  representativeNameAr?: string | null;
  representativeEmiratesId?: string | null;
  establishmentNameArabic?: string;
  establishmentNameEnglish?: string;
  nationality?: number | string;
  nationalityId?: number | string;
  idNumber?: string;
  eid?: string;
  uaeNumber?: string;
  uidNumber?: string;
  passportNo?: string;
  licenseNumber?: string;
  city?: string;
  cityEn?: string;
  cityAr?: string;
  emirate?: string;
  emirateEn?: string;
  emirateAr?: string;
  location?: string;
  locationEn?: string;
  locationAr?: string;
  status?: string;
  statusEn?: string;
  statusAr?: string;
  statusName?: string;
  statusNameEn?: string;
  statusNameAr?: string;
  personalPhotoUrl?: string;
  partnerPhotoUrl?: string;
  PersonalPhoto?: string;
  memorandumOfAssociation?: any;
  powerOfAttorney?: any;
  statement?: any;
};


const normalizeRepresentativeValue = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};
const isValidRepresentativeEmiratesId = (value: unknown): boolean => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return EMIRATES_ID_REGEX.test(digits);
};


type DuplicateIdentifierField = (typeof DUPLICATE_IDENTIFIER_FIELDS)[number];

const getIdentifierSourceValue = (
  partner: PartnerItem | null | undefined,
  fieldName: DuplicateIdentifierField,
) => {
  if (!partner) {
    return undefined;
  }

  if (fieldName === "emiratesId") {
    return partner.emiratesId ?? partner.eid;
  }

  if (fieldName === "uid") {
    return partner.uid ?? partner.uaeNumber ?? partner.uidNumber;
  }

  return partner.passportNumber ?? partner.passportNo;
};

const isOwnerPartner = (partner: unknown) =>
  Boolean((partner as { isOwner?: boolean } | null | undefined)?.isOwner);

const resolvePartnerType = (partner: PartnerItem): "individual" | "company" => {
  const partnerTypeCode = String(partner.partnerTypeCode ?? "").trim();

  if (partnerTypeCode === "1") {
    return "company";
  }

  if (partnerTypeCode === "2") {
    return "individual";
  }

  return partner.partnerType === "company" ? "company" : "individual";
};

const normalizePartnerId = (value: unknown) => String(value ?? "").trim();

const normalizeIdentifierValue = (
  fieldName: DuplicateIdentifierField,
  value: unknown,
) => {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (fieldName === "passportNumber") {
    return normalizedValue.toUpperCase();
  }

  return normalizedValue.replace(/\D/g, "");
};

const getPartnerIdentifierValues = (
  partner?: PartnerItem | null,
): Record<DuplicateIdentifierField, string> => ({
  emiratesId: normalizeIdentifierValue(
    "emiratesId",
    getIdentifierSourceValue(partner, "emiratesId"),
  ),
  uid: normalizeIdentifierValue("uid", getIdentifierSourceValue(partner, "uid")),
  passportNumber: normalizeIdentifierValue(
    "passportNumber",
    getIdentifierSourceValue(partner, "passportNumber"),
  ),
});

const hasPartnerIdentifierChanges = (
  previousPartner: PartnerItem | undefined,
  nextPartner: PartnerItem,
) => {
  const previousIdentifiers = getPartnerIdentifierValues(previousPartner);
  const nextIdentifiers = getPartnerIdentifierValues(nextPartner);

  return DUPLICATE_IDENTIFIER_FIELDS.some(
    (fieldName) => previousIdentifiers[fieldName] !== nextIdentifiers[fieldName],
  );
};

const hasDuplicatePartnerIdentifiers = (
  nextPartner: PartnerItem,
  partners: PartnerItem[],
  currentId?: string | null,
) => {
  const nextPartnerIdentifiers = getPartnerIdentifierValues(nextPartner);

  return DUPLICATE_IDENTIFIER_FIELDS.some((fieldName) => {
    const identifierValue = nextPartnerIdentifiers[fieldName];

    if (!identifierValue) {
      return false;
    }

    return partners.some((partner) => {
      if (partner.id === currentId) {
        return false;
      }

      return (
        getPartnerIdentifierValues(partner)[fieldName] === identifierValue
      );
    });
  });
};

const PartnerListFieldDom: React.FC<any> = observer((props) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const fixedT = React.useMemo(() => i18n.getFixedT(lang), [lang]);
  const t = React.useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(fixedT(key, options)),
    [fixedT],
  );
  const field = useField<any>();
  const fieldSchema = useFieldSchema();
  const form = useForm();
  const renderSlot = useFormilyRenderSlot();
  const value = React.useMemo(
    () => (Array.isArray(field.value) ? field.value : []) as PartnerItem[],
    [field.value],
  );
  const isAr = lang === "ar";

  const {
    labelName: legacyLabelName,
    labelNameEn,
    labelNameAr,
    addButtonLabel: legacyAddButtonLabel,
    addButtonLabelEn,
    addButtonLabelAr,
    description,
    showEmiratesId = true,
    showUID = true,
    showPassport = true,
    service905OwnerPartners = [],
  } = props;
  const decoratorProps = (field.decoratorProps ?? {}) as Record<string, unknown>;
  const tooltipHtml = getBilingualValueByLang({
    lang,
    host,
    en: decoratorProps.tooltipEn,
    ar: decoratorProps.tooltipAr,
    legacy:
      typeof decoratorProps.tooltip === "string"
        ? decoratorProps.tooltip
        : description,
    fallback: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [formInstance, setFormInstance] = useState<any>(null);
  const [nationalityList, setNationalityList] = useState<any[]>([]);
  const [partnerType, setPartnerType] = useState<"individual" | "company">(
    "individual",
  );
  const [companyData, setCompanyData] = useState<any>({});
  const [companyErrors, setCompanyErrors] = useState<Record<string, string>>({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingPartner, setDeletingPartner] = useState<PartnerItem | null>(null);
  const isEditing = modalMode === "edit";
  const isViewing = modalMode === "view";
  const isReviewMode =
    field.pattern === "readPretty" || form.pattern === "readPretty";
  const isFieldLocked =
    field.pattern === "disabled" || field.pattern === "readOnly";
  const isFormLocked =
    form.pattern === "disabled" ||
    form.pattern === "readOnly";
  const hideActionButtons = isFieldLocked || isFormLocked;
  const isReadonlyPresentation =
    isReviewMode || isFieldLocked || isFormLocked;
  const localizedLabelName = getBilingualValueByLang({
    lang,
    host,
    en: labelNameEn,
    ar: labelNameAr,
    legacy: legacyLabelName,
    fallback: t("PartnerList.title"),
  });
  const localizedAddButtonLabel = getBilingualValueByLang({
    lang,
    host,
    en: addButtonLabelEn,
    ar: addButtonLabelAr,
    legacy: legacyAddButtonLabel,
    fallback: t("PartnerList.addNewPartner"),
  });
  // The list exposes an item-level slot; the host resolves each partner to its backend target.
  const rawDesignableId = (
    fieldSchema as unknown as Record<string, unknown> | undefined
  )?.["x-designable-id"];
  const designableId =
    typeof rawDesignableId === "string" ? rawDesignableId : undefined;
  const renderPartnerItemStatus = (partner: PartnerItem, index: number) => {
    const isInitialPartner = initialPartnerIdSet.has(normalizePartnerId(partner.id));
    const isIndividualPartner = resolvePartnerType(partner) === "individual";
    const newIndividualPartnerIndex = editablePartners
      .slice(0, index)
      .filter(
        (item) =>
          resolvePartnerType(item) === "individual" &&
          !initialPartnerIdSet.has(normalizePartnerId(item.id)),
      ).length;

    return renderSlot?.({
      componentKey: FORMILY_COMPONENT_KEYS.PARTNER_LIST,
      designableId,
      slotKey: FORMILY_SLOT_KEYS.ITEM_STATUS,
      componentProps: {
        partner,
        index,
        isInitialPartner,
        isIndividualPartner,
        newIndividualPartnerIndex,
      },
    });
  };
  const partnerTypeOptions = React.useMemo(
    () => [
      { label: t("PartnerList.partnerType.individual"), value: "individual" },
      { label: t("PartnerList.partnerType.company"), value: "company" },
    ],
    [t],
  );

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

  useEffect(() => {
    if (!Array.isArray(field.value)) {
      return;
    }

    const editablePartners = field.value.filter((partner: PartnerItem) => {
      return !isOwnerPartner(partner);
    });

    if (editablePartners.length !== field.value.length) {
      field.setValue(editablePartners);
    }
  }, [field, field.value]);

  const nationalityMap = React.useMemo(() => {
    const map = new Map<number, any>();
    nationalityList.forEach((item) => map.set(item.id, item));
    return map;
  }, [nationalityList]);

  const ownerPartners = React.useMemo(
    () =>
      Array.isArray(service905OwnerPartners)
        ? (service905OwnerPartners as PartnerItem[])
        : [],
    [service905OwnerPartners],
  );
  const ownerPartnerIdSet = React.useMemo(
    () =>
      new Set(
        ownerPartners.map((partner) => normalizePartnerId(partner.id)).filter(Boolean),
      ),
    [ownerPartners],
  );
  const rawRemovedPartnerList = (form.values as Record<string, unknown> | undefined)?.[
    REMOVED_PARTNER_LIST_FIELD
  ];
  const rawPendingDeletePartnerList = (form.values as Record<string, unknown> | undefined)?.[
    "pendingDeletePartnerList"
  ];
  const removedPartnerList = React.useMemo(
    () =>
      Array.isArray(rawRemovedPartnerList)
        ? (rawRemovedPartnerList as PartnerItem[])
        : Array.isArray(rawPendingDeletePartnerList)
          ? (rawPendingDeletePartnerList as PartnerItem[])
          : [],
    [rawRemovedPartnerList, rawPendingDeletePartnerList],
  );
  const removedOwnerIdSet = React.useMemo(
    () =>
      new Set(
        removedPartnerList
          .map((partner) => normalizePartnerId(partner?.id))
          .filter((id) => id && ownerPartnerIdSet.has(id)),
      ),
    [ownerPartnerIdSet, removedPartnerList],
  );
  const ownerPartnerOverrides = React.useMemo(() => {
    const overrides = new Map<string, PartnerItem>();
    value.forEach((partner) => {
      const normalizedId = normalizePartnerId(partner.id);
      if (normalizedId && ownerPartnerIdSet.has(normalizedId)) {
        overrides.set(normalizedId, partner);
      }
    });
    return overrides;
  }, [ownerPartnerIdSet, value]);
  const displayedOwnerPartners = React.useMemo(
    () =>
      ownerPartners
        .filter((partner) => !removedOwnerIdSet.has(normalizePartnerId(partner.id)))
        .map((partner) => {
          const normalizedId = normalizePartnerId(partner.id);
          const overridePartner = ownerPartnerOverrides.get(normalizedId);

          if (!overridePartner) {
            return partner;
          }

          return {
            ...partner,
            ...overridePartner,
            isOwner: true,
          };
        }),
    [ownerPartnerOverrides, ownerPartners, removedOwnerIdSet],
  );
  const editablePartners = React.useMemo(
    () =>
      value.filter((partner) => {
        const normalizedId = normalizePartnerId(partner.id);

        if (!normalizedId) {
          return true;
        }

        return !ownerPartnerIdSet.has(normalizedId) && !isOwnerPartner(partner);
      }),
    [ownerPartnerIdSet, value],
  );
  const rawInitialPartnerIds = (form.values as Record<string, unknown> | undefined)?.[
    SERVICE_905_INITIAL_PARTNER_IDS_FIELD
  ];
  const ownerPartnerIdFallbacks = React.useMemo(
    () =>
      ownerPartners
        .map((partner) => normalizePartnerId(partner.id))
        .filter((id) => Boolean(id)),
    [ownerPartners],
  );
  const initialPartnerIdSet = React.useMemo(() => {
    const set = new Set<string>();

    if (Array.isArray(rawInitialPartnerIds)) {
      rawInitialPartnerIds.forEach((id) => {
        const normalizedId = normalizePartnerId(id);
        if (normalizedId) {
          set.add(normalizedId);
        }
      });
    }

    ownerPartnerIdFallbacks.forEach((id) => {
      set.add(id);
    });

    return set;
  }, [rawInitialPartnerIds, ownerPartnerIdFallbacks]);

  const isExistingInitialPartner = (partner: PartnerItem | undefined) => {
    if (!partner) {
      return false;
    }

    return initialPartnerIdSet.has(normalizePartnerId(partner.id));
  };
  const isOwnerPartnerById = React.useCallback(
    (partnerId: unknown) => ownerPartnerIdSet.has(normalizePartnerId(partnerId)),
    [ownerPartnerIdSet],
  );
  const updateRemovedPartnerList = React.useCallback(
    (nextRemovedPartners: PartnerItem[]) => {
      if (nextRemovedPartners.length > 0) {
        form.setValuesIn(REMOVED_PARTNER_LIST_FIELD, nextRemovedPartners);
        return;
      }

      form.deleteValuesIn(REMOVED_PARTNER_LIST_FIELD);
    },
    [form],
  );
  const getPartnerById = React.useCallback(
    (partnerId: string | null | undefined) => {
      const normalizedId = normalizePartnerId(partnerId);
      if (!normalizedId) {
        return undefined;
      }

      return value.find((partner) => normalizePartnerId(partner.id) === normalizedId)
        || ownerPartners.find((partner) => normalizePartnerId(partner.id) === normalizedId);
    },
    [ownerPartners, value],
  );

  const getDisplayName = (partner: PartnerItem): string => {
    if (resolvePartnerType(partner) === "company") {
      return (
        preferLocalizedEnAr(
        isAr,
        partner.establishmentNameEnglish ||
          partner.fullNameEn ||
          partner.fullNameEnglish,
        partner.establishmentNameArabic ||
          partner.fullNameAr ||
          partner.fullNameArabic,
        ) || "-"
      );
    }
    return (
      preferLocalizedEnAr(
        isAr,
        partner.fullNameEnglish ||
          partner.fullNameEn,
        partner.fullNameArabic ||
          partner.fullNameAr,
      ) || "-"
    );
  };

  const getIdNumber = (partner: PartnerItem): string => {
    if (resolvePartnerType(partner) === "company") {
      return partner.licenseNumber || "-";
    }
    const emiratesId = getIdentifierSourceValue(partner, "emiratesId");
    if (emiratesId) return String(emiratesId);
    const uid = getIdentifierSourceValue(partner, "uid");
    if (uid) return String(uid);
    const passportNumber = getIdentifierSourceValue(partner, "passportNumber");
    if (passportNumber) return String(passportNumber);
    return "-";
  };

  const getNationalityName = (nationalityId?: number | string): string => {
    if (!nationalityId) return "-";
    const item = nationalityMap.get(Number(nationalityId));
    if (!item) return "-";
    return (
      preferLocalizedEnAr(
        isAr,
        item.nameEn ?? item.fullNameEn ?? item.name,
        item.nameAr ?? item.fullNameAr,
      ) || "-"
    );
  };

  const getPartnerStatusLabel = (partner: PartnerItem, isDeleted = false): string | null => {
    if (isDeleted) return isAr ? "محذوف" : "Deleted";
    if (isReadonlyPresentation && !isExistingInitialPartner(partner)) return isAr ? "جديد" : "New";

    const label =
      preferLocalizedEnAr(
        isAr,
        partner.statusNameEn || partner.statusEn || partner.statusName || partner.status,
        partner.statusNameAr || partner.statusAr,
      ) || "";

    return label.trim() || null;
  };

  const getPartnerLocation = (partner: PartnerItem): string => {
    const location =
      preferLocalizedEnAr(
        isAr,
        partner.locationEn || partner.cityEn || partner.emirateEn || partner.location || partner.city || partner.emirate,
        partner.locationAr || partner.cityAr || partner.emirateAr,
      ) || "";

    return location.trim() || getNationalityName(partner.nationality ?? partner.nationalityId);
  };

  const openModal = () => {
    setEditingId(null);
    setModalMode("add");
    setPartnerType("individual");
    setCompanyData({});
    setCompanyErrors({});
    setModalOpen(true);
    const form = createForm({
      initialValues: {
        idSelector: {},
      },
    });
    setFormInstance(form);
  };

  const openEditModal = (partner: PartnerItem) => {
    setEditingId(partner.id);
    setModalMode("edit");
    setPartnerType(resolvePartnerType(partner));
    setModalOpen(true);

    if (resolvePartnerType(partner) === "company") {
      setCompanyData({
        nationality: partner.nationality,
        establishmentNameArabic: partner.establishmentNameArabic,
        establishmentNameEnglish: partner.establishmentNameEnglish,
        representativeNameEn: partner.representativeNameEn ?? null,
        representativeNameAr: partner.representativeNameAr ?? null,
        representativeEmiratesId: partner.representativeEmiratesId ?? null,
        memorandumOfAssociation: partner.memorandumOfAssociation,
        powerOfAttorney: partner.powerOfAttorney,
        statement: partner.statement,
      });
      setCompanyErrors({});
      setFormInstance(null);
    } else {
      setCompanyData({});
      const form = createForm({
        initialValues: {
          idSelector: partner,
        },
      });
      setFormInstance(form);
    }
  };

  const openViewModal = (partner: PartnerItem) => {
    setEditingId(partner.id);
    setModalMode("view");
    setPartnerType(resolvePartnerType(partner));
    setModalOpen(true);

    if (resolvePartnerType(partner) === "company") {
      setCompanyData({
        nationality: partner.nationality,
        establishmentNameArabic: partner.establishmentNameArabic,
        establishmentNameEnglish: partner.establishmentNameEnglish,
        representativeNameEn: partner.representativeNameEn ?? null,
        representativeNameAr: partner.representativeNameAr ?? null,
        representativeEmiratesId: partner.representativeEmiratesId ?? null,
        memorandumOfAssociation: partner.memorandumOfAssociation,
        powerOfAttorney: partner.powerOfAttorney,
        statement: partner.statement,
      });
      setCompanyErrors({});
      setFormInstance(null);
      return;
    }

    setCompanyData({});
    const nextForm = createForm({
      initialValues: {
        idSelector: partner,
      },
    });
    nextForm.setPattern("readOnly");
    setFormInstance(nextForm);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setModalMode("add");
    setFormInstance(null);
    setCompanyData({});
    setCompanyErrors({});
  };

  const handleSave = async () => {
    let newPartner: PartnerItem;
    let idSelectorValue: IDSelectorValue | undefined;
    const existingPartner = editingId ? getPartnerById(editingId) : undefined;
    const partnersForDuplicateCheck = [...ownerPartners, ...value];
    const isEditingOwnerPartner = existingPartner
      ? isOwnerPartnerById(existingPartner.id)
      : false;
    const isEditingExistingInitialPartner =
      isExistingInitialPartner(existingPartner) || isEditingOwnerPartner;

    if (partnerType === "company") {
      const representativeNameEn = normalizeRepresentativeValue(
        companyData.representativeNameEn,
      );
      const representativeNameAr = normalizeRepresentativeValue(
        companyData.representativeNameAr,
      );
      const representativeEmiratesId = normalizeRepresentativeValue(
        companyData.representativeEmiratesId,
      );
      const nextErrors: Record<string, string> = {};
      if (!companyData.establishmentNameArabic?.trim()) {
        nextErrors.establishmentNameArabic = t("PartnerList.validation.required");
      }
      if (!companyData.establishmentNameEnglish?.trim()) {
        nextErrors.establishmentNameEnglish = t("PartnerList.validation.required");
      }
      if (!representativeNameEn) nextErrors.representativeNameEn = t("PartnerList.validation.required");
      if (!representativeNameAr) nextErrors.representativeNameAr = t("PartnerList.validation.required");
      if (!representativeEmiratesId) {
        nextErrors.representativeEmiratesId = t("PartnerList.validation.required");
      } else if (!isValidRepresentativeEmiratesId(representativeEmiratesId)) {
        nextErrors.representativeEmiratesId = t("PartnerList.validation.invalidRepresentativeEmiratesId");
      }
      if (Object.keys(nextErrors).length) {
        setCompanyErrors(nextErrors);
        return;
      }
      newPartner = {
        ...(existingPartner || {}),
        id:
          editingId ||
          `partner-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        partnerType: "company",
        ...companyData,
        establishmentNameArabic: companyData.establishmentNameArabic.trim(),
        establishmentNameEnglish: companyData.establishmentNameEnglish.trim(),
        representativeNameEn,
        representativeNameAr,
        representativeEmiratesId,
      };
    } else {
      if (!formInstance) return;
      try {
        await formInstance.validate();
        const formValues = formInstance.values;
        idSelectorValue = formValues.idSelector || formValues;

        newPartner = {
          ...(existingPartner || {}),
          id:
            editingId ||
            `partner-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          partnerType: "individual",
          ...idSelectorValue,
          representativeNameEn: null,
          representativeNameAr: null,
          representativeEmiratesId: null,
        };
      } catch (error) {
        console.error("Form validation failed:", error);
        return;
      }
    }
    if (partnerType === "individual" && isEditingExistingInitialPartner) {
      newPartner = {
        ...newPartner,
        PersonalPhoto: idSelectorValue?.PersonalPhoto,
        EmiratesID: idSelectorValue?.EmiratesID,
        PassportScan: idSelectorValue?.PassportScan,
        Passport: idSelectorValue?.Passport,
        Visa: idSelectorValue?.Visa,
      } as PartnerItem;
    }

    if (partnerType === "company" && isEditingExistingInitialPartner) {
      newPartner = {
        ...newPartner,
        memorandumOfAssociation: companyData.memorandumOfAssociation,
        powerOfAttorney: companyData.powerOfAttorney,
        statement: companyData.statement,
      } as PartnerItem;
    }

    const shouldCheckDuplicate =
      !editingId || hasPartnerIdentifierChanges(existingPartner, newPartner);

    if (
      shouldCheckDuplicate &&
      hasDuplicatePartnerIdentifiers(
        newPartner,
        partnersForDuplicateCheck,
        editingId,
      )
    ) {
      CustomMessage.error(t("PartnerList.duplicatePartner"));
      return;
    }

    if (editingId) {
      const normalizedEditingId = normalizePartnerId(editingId);

      if (isEditingOwnerPartner) {
        const nextOwnerPartner: PartnerItem = {
          ...newPartner,
          isOwner: undefined,
        };
        const nextPartners = value.filter(
          (partner) => normalizePartnerId(partner.id) !== normalizedEditingId,
        );

        nextPartners.push(nextOwnerPartner);
        field.setValue(nextPartners);
        updateRemovedPartnerList(
          removedPartnerList.filter(
            (partner) => normalizePartnerId(partner.id) !== normalizedEditingId,
          ),
        );
      } else {
        const next = value.map((v) => (v.id === editingId ? newPartner : v));
        field.setValue(next);
      }
    } else {
      field.setValue([...value, newPartner]);
    }

    closeModal();
  };

  const openDeleteModal = (partner: PartnerItem) => {
    setDeletingPartner(partner);
    setDeleteModalVisible(true);
  };

  const handleDelete = () => {
    if (deletingPartner) {
      const normalizedDeletingId = normalizePartnerId(deletingPartner.id);

      if (isOwnerPartnerById(deletingPartner.id)) {
        const nextPartners = value.filter(
          (partner) => normalizePartnerId(partner.id) !== normalizedDeletingId,
        );
        const ownerSourcePartner =
          ownerPartners.find(
            (partner) => normalizePartnerId(partner.id) === normalizedDeletingId,
          ) || deletingPartner;
        const nextRemovedPartnerList = removedPartnerList.filter(
          (partner) => normalizePartnerId(partner.id) !== normalizedDeletingId,
        );

        nextRemovedPartnerList.push(ownerSourcePartner);
        field.setValue(nextPartners);
        updateRemovedPartnerList(nextRemovedPartnerList);
      } else {
        const next = value.filter(
          (partner) => normalizePartnerId(partner.id) !== normalizedDeletingId,
        );
        field.setValue(next);
      }
    }
    setDeleteModalVisible(false);
    setDeletingPartner(null);
  };

  const handleCompanyFieldChange = (key: string, val: unknown) => {
    setCompanyData((prev: Record<string, unknown>) => ({ ...prev, [key]: val }));
    setCompanyErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const editingPartner = editingId ? getPartnerById(editingId) : undefined;
  const isEditingExistingInitialPartner =
    isExistingInitialPartner(editingPartner)
    || (editingPartner ? isOwnerPartnerById(editingPartner.id) : false);

  const renderCompanyForm = () => (
    <div className="partner-company-form">
      <Row gutter={24} className="partner-company-grid">
        <Col span={12}>
          <div className="partner-form-label">{t("PartnerList.label.nationality")}</div>
          <Select
            placeholder={t("PartnerList.placeholder.selectNationality")}
            value={companyData.nationality}
            onChange={(val) => handleCompanyFieldChange("nationality", val)}
            showSearch
            optionFilterProp="children"
            disabled={isViewing || isEditingExistingInitialPartner}
            style={{ width: "100%" }}
            className="umc-select-arrow-manual"
          >
            {nationalityList.map((item) => (
              <Option key={item.id} value={item.id}>
                {preferLocalizedEnAr(
                  isAr,
                  item.nameEn ?? item.fullNameEn ?? item.name,
                  item.nameAr ?? item.fullNameAr,
                )}
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.establishmentNameArabic")}{" "}
            <span className="partner-required">*</span>
          </div>
          <Input
            placeholder={t("PartnerList.placeholder.establishmentNameArabic")}
            value={companyData.establishmentNameArabic}
            disabled={isViewing || isEditingExistingInitialPartner}
            onChange={(e) =>
              handleCompanyFieldChange(
                "establishmentNameArabic",
                e.target.value,
              )
            }
          />
        </Col>
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.establishmentNameEnglish")}{" "}
            <span className="partner-required">*</span>
          </div>
          <Input
            placeholder={t("PartnerList.placeholder.establishmentNameEnglish")}
            value={companyData.establishmentNameEnglish}
            disabled={isViewing || isEditingExistingInitialPartner}
            onChange={(e) =>
              handleCompanyFieldChange(
                "establishmentNameEnglish",
                e.target.value,
              )
            }
          />
        </Col>
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.representativeNameEn")} <span className="partner-required">*</span>
          </div>
          <Input
            maxLength={512}
            placeholder={t("PartnerList.placeholder.representativeNameEn")}
            value={companyData.representativeNameEn ?? ""}
            disabled={isViewing}
            onChange={(e) => handleCompanyFieldChange("representativeNameEn", e.target.value)}
          />
          {companyErrors.representativeNameEn && <div className="partner-form-error">{companyErrors.representativeNameEn}</div>}
        </Col>
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.representativeNameAr")} <span className="partner-required">*</span>
          </div>
          <Input
            maxLength={200}
            placeholder={t("PartnerList.placeholder.representativeNameAr")}
            value={companyData.representativeNameAr ?? ""}
            disabled={isViewing}
            onChange={(e) => handleCompanyFieldChange("representativeNameAr", e.target.value)}
          />
          {companyErrors.representativeNameAr && <div className="partner-form-error">{companyErrors.representativeNameAr}</div>}
        </Col>
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.representativeEmiratesId")} <span className="partner-required">*</span>
          </div>
          {isViewing ? (
            <Input
              value={normalizeRepresentativeValue(companyData.representativeEmiratesId) || "-"}
              disabled
            />
          ) : (
            <QueryInput
              inputMask="784-9999-9999999-9"
              maxLength={18}
              placeholder="784-XXXX-XXXXXXX-X"
              showQueryButton={false}
              value={companyData.representativeEmiratesId ?? ""}
              onChange={(event) =>
                handleCompanyFieldChange("representativeEmiratesId", event.target.value)
              }
            />
          )}
          {companyErrors.representativeEmiratesId && <div className="partner-form-error">{companyErrors.representativeEmiratesId}</div>}
        </Col>
        <Col span={12} />
        <Col span={12}>
          <div className="partner-form-label">
            {t("PartnerList.label.memorandumOfAssociation")}
          </div>
          <DocumentViewer
            hasDelete={!isViewing}
            value={companyData.memorandumOfAssociation}
            onChange={(val) =>
              handleCompanyFieldChange("memorandumOfAssociation", val)
            }
            disabled={isViewing}
            uploadConfig={{
              maxCount: 1,
              maxSize: 5,
              uploadTip: t("PartnerList.uploadTip.pdf"),
              accept: ".pdf",
            }}
          />
        </Col>
        <Col span={12}>
          <div className="partner-form-label">{t("PartnerList.label.powerOfAttorney")}</div>
          <DocumentViewer
            hasDelete={!isViewing}
            value={companyData.powerOfAttorney}
            onChange={(val) => handleCompanyFieldChange("powerOfAttorney", val)}
            disabled={isViewing}
            uploadConfig={{
              maxCount: 1,
              maxSize: 5,
              uploadTip: t("PartnerList.uploadTip.pdf"),
              accept: ".pdf",
            }}
          />
        </Col>
        <Col span={12}>
          <div className="partner-form-label">{t("PartnerList.label.statement")}</div>
          <DocumentViewer
            hasDelete={!isViewing}
            value={companyData.statement}
            onChange={(val) => handleCompanyFieldChange("statement", val)}
            disabled={isViewing}
            uploadConfig={{
              maxCount: 1,
              maxSize: 5,
              uploadTip: t("PartnerList.uploadTip.pdf"),
              accept: ".pdf",
            }}
          />
        </Col>
      </Row>
    </div>
  );

  const renderIndividualForm = () => (
    <div className="partner-individual-form">
      <div className="partner-verify-question">
        {t("PartnerList.verifyQuestion")}
      </div>
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
                  editableFieldKeys: isEditingExistingInitialPartner
                    ? [...INDIVIDUAL_ATTACHMENT_EDIT_FIELDS]
                    : undefined,
                },
              ]}
              decorator={[FormItem]}
            />
          </Form>
        </FormProvider>
      )}
    </div>
  );

  const renderPartnerDetailsAction = (partner: PartnerItem) =>
    (isReadonlyPresentation || (!hideActionButtons && !isOwnerPartner(partner))) ? (
      <CustomButton
        text={isReadonlyPresentation ? t("PartnerList.details") : t("common.edit")}
        variant="primary"
        size="small"
        customClassName="partner-card-details-button"
        onClick={() =>
          isReadonlyPresentation ? openViewModal(partner) : openEditModal(partner)
        }
      />
    ) : null;

  const renderOwnerCardActions = (partner: PartnerItem) => {
    if (resolvePartnerType(partner) === "individual") {
      return (
        <CustomButton
          text={t("common.view")}
          variant="primary"
          size="small"
          customClassName="partner-card-details-button"
          onClick={() => openViewModal(partner)}
        />
      );
    }

    return (
      <CustomButton
        text={t("PartnerList.details")}
        variant="primary"
        size="small"
        customClassName="partner-card-details-button"
        onClick={() => openViewModal(partner)}
      />
    );
  };

  const renderCompanyCardActions = (partner: PartnerItem) => {
    if (isReadonlyPresentation) {
      return renderPartnerDetailsAction(partner);
    }

    if (hideActionButtons) {
      return null;
    }

    return (
      <div className="partner-card-company-actions">
        <CustomButton
          text={t("PartnerList.delete")}
          variant="outline"
          size="small"
          customClassName="partner-card-company-action-btn partner-card-company-action-btn-delete"
          onClick={() => openDeleteModal(partner)}
        />
        <CustomButton
          text={t("PartnerList.edit")}
          variant="primary"
          size="small"
          customClassName="partner-card-company-action-btn"
          onClick={() => openEditModal(partner)}
        />
      </div>
    );
  };

  const renderIndividualCardActions = (partner: PartnerItem) => {
    if (isReadonlyPresentation) {
      return (
        <CustomButton
          text={t("common.view")}
          variant="primary"
          size="small"
          customClassName="partner-card-details-button"
          onClick={() => openViewModal(partner)}
        />
      );
    }

    if (hideActionButtons) {
      return null;
    }

    return (
      <div className="partner-card-company-actions">
        <CustomButton
          text={t("PartnerList.delete")}
          variant="outline"
          size="small"
          customClassName="partner-card-company-action-btn partner-card-company-action-btn-delete"
          onClick={() => openDeleteModal(partner)}
        />
        <CustomButton
          text={t("PartnerList.edit")}
          variant="primary"
          size="small"
          customClassName="partner-card-company-action-btn"
          onClick={() => openEditModal(partner)}
        />
      </div>
    );
  };

  const handleDeleteFromModal = () => {
    if (!editingPartner) {
      return;
    }

    setModalOpen(false);
    setFormInstance(null);
    setCompanyData({});
    setDeletingPartner(editingPartner);
    setDeleteModalVisible(true);
    setEditingId(null);
    setModalMode("add");
  };

  const renderIndividualPartnerCard = (
    partner: PartnerItem,
    ownerCard = false,
    isDeleted = false,
    fahrStatusSlot?: React.ReactNode,
  ) => {
    const statusLabel = getPartnerStatusLabel(partner, isDeleted);
    const hasFahrStatus =
      fahrStatusSlot !== null &&
      fahrStatusSlot !== undefined &&
      fahrStatusSlot !== false;

    return (
      <div
        key={partner.id}
        className={`partner-card partner-card-individual${
          ownerCard ? " partner-card-owner" : ""
        }${hasFahrStatus ? " partner-card--with-fahr-status" : ""}`}
      >
        {ownerCard && (
          <div className="partner-card-owner-badge">
            <span className="partner-card-owner-badge-text">
              {t("establishmentProfile.actions.licenseOwnerBadge")}
            </span>
          </div>
        )}
        <div className="partner-card-body">
          <div className="partner-card-main">
            <div className="partner-card-name" title={getDisplayName(partner)}>
              {getDisplayName(partner)}
            </div>
            {statusLabel ? (
              <div className={`partner-card-status partner-card-status--${statusLabel.toLowerCase()}`}>{statusLabel}</div>
            ) : null}
            <div className="partner-card-meta-list">
              <div className="partner-card-meta-item">
                <img
                  src={PartnerUserIcon}
                  alt={t("PartnerList.partnerType.individual")}
                  className="partner-card-meta-icon"
                />
                <span>{t("PartnerList.partnerType.individual")}</span>
              </div>
              <div className="partner-card-meta-item">
                <img
                  src={NumberIcon}
                  alt={t("PartnerList.card.id")}
                  className="partner-card-meta-icon"
                />
                <span className="partner-card-meta-value-ltr">
                  {getIdNumber(partner)}
                </span>
              </div>
              <div className="partner-card-meta-item">
                <img
                  src={PartnerLocationIcon}
                  alt={t("PartnerList.card.loc")}
                  className="partner-card-meta-icon"
                />
                <span>{getPartnerLocation(partner)}</span>
              </div>
            </div>
          </div>
          <div className="partner-card-aside">
            <div className="partner-card-avatar">
              <img
                src={IndividualProfileIcon}
                alt={t("PartnerList.partnerType.individual")}
                className="partner-card-avatar-placeholder"
              />
            </div>
            {ownerCard
              ? renderOwnerCardActions(partner)
              : renderIndividualCardActions(partner)}
          </div>
        </div>
        {hasFahrStatus ? (
          <div className="partner-card__fahr-status">{fahrStatusSlot}</div>
        ) : null}
      </div>
    );
  };

  const renderCompanyPartnerCard = (
    partner: PartnerItem,
    ownerCard = false,
    isDeleted = false,
    fahrStatusSlot?: React.ReactNode,
  ) => {
    const statusLabel = getPartnerStatusLabel(partner, isDeleted);
    const hasFahrStatus =
      fahrStatusSlot !== null &&
      fahrStatusSlot !== undefined &&
      fahrStatusSlot !== false;

    return (
      <div
        key={partner.id}
        className={`partner-card partner-card-company${
          ownerCard ? " partner-card-owner" : ""
        }${hasFahrStatus ? " partner-card--with-fahr-status" : ""}`}
      >
        {ownerCard && (
          <div className="partner-card-owner-badge">
            <span className="partner-card-owner-badge-text">
              {t("establishmentProfile.actions.licenseOwnerBadge")}
            </span>
          </div>
        )}
        <div className="partner-card-body">
          <div className="partner-card-main">
            <div className="partner-card-name" title={getDisplayName(partner)}>
              {getDisplayName(partner)}
            </div>
            {statusLabel ? (
              <div className={`partner-card-status partner-card-status--${statusLabel.toLowerCase()}`}>{statusLabel}</div>
            ) : null}
            <div className="partner-card-meta-list">
              <div className="partner-card-meta-item">
                <img
                  src={PartnerUserIcon}
                  alt={t("PartnerList.partnerType.company")}
                  className="partner-card-meta-icon"
                />
                <span>{t("PartnerList.partnerType.company")}</span>
              </div>
              <div className="partner-card-meta-item">
                <img
                  src={NumberIcon}
                  alt={t("PartnerList.card.id")}
                  className="partner-card-meta-icon"
                />
                <span className="partner-card-meta-value-ltr">
                  {getIdNumber(partner)}
                </span>
              </div>
              <div className="partner-card-meta-item">
                <img
                  src={PartnerLocationIcon}
                  alt={t("PartnerList.card.loc")}
                  className="partner-card-meta-icon"
                />
                <span>{getPartnerLocation(partner)}</span>
              </div>
            </div>
          </div>
          <div className="partner-card-aside">
            <div className="partner-card-avatar">
              <img
                src={CompanyProfileIcon}
                alt={t("PartnerList.partnerType.company")}
                className="partner-card-avatar-placeholder"
              />
            </div>
            {ownerCard
              ? renderOwnerCardActions(partner)
              : renderCompanyCardActions(partner)}
          </div>
        </div>
        {hasFahrStatus ? (
          <div className="partner-card__fahr-status">{fahrStatusSlot}</div>
        ) : null}
      </div>
    );
  };

  const renderPartnerCard = (
    partner: PartnerItem,
    ownerCard = false,
    isDeleted = false,
    index?: number,
  ) => {
    const fahrStatusSlot =
      resolvePartnerType(partner) === "individual" &&
      !ownerCard &&
      !isDeleted &&
      index !== undefined
        ? renderPartnerItemStatus(partner, index)
        : undefined;

    return resolvePartnerType(partner) === "individual"
      ? renderIndividualPartnerCard(
          partner,
          ownerCard,
          isDeleted,
          fahrStatusSlot,
        )
      : renderCompanyPartnerCard(
          partner,
          ownerCard,
          isDeleted,
          fahrStatusSlot,
        );
  };

  const renderEmptyState = () => (
    <div className="partner-empty-state">
      <img src={EmptyIcon} alt={t("PartnerList.emptyAlt")} className="partner-empty-icon" />
      <div className="partner-empty-text">{t("PartnerList.emptyText")}</div>
      {!hideActionButtons && !isReadonlyPresentation && (
        <CustomButton
          text={localizedAddButtonLabel}
          variant="gold"
          size="medium"
          onClick={openModal}
        />
      )}
    </div>
  );

  const isSaveDisabled = () => {
    if (isViewing) {
      return true;
    }

    if (partnerType === "company") {
      return (
        !companyData.establishmentNameArabic?.trim() ||
        !companyData.establishmentNameEnglish?.trim() ||
        !companyData.representativeNameEn?.trim() ||
        !companyData.representativeNameAr?.trim() ||
        !companyData.representativeEmiratesId?.trim() ||
        !isValidRepresentativeEmiratesId(companyData.representativeEmiratesId)
      );
    }
    return false;
  };

  return (
    <div className="partner-list-container">
      <Card className="ant-card ant-card-bordered">
        <div className="partner-list-header">
          <div className="partner-list-title">
            {localizedLabelName}
            {renderDesignerTooltipIcon(tooltipHtml)}
          </div>
          {!hideActionButtons &&
            !isReadonlyPresentation &&
            (editablePartners.length > 0 || displayedOwnerPartners.length > 0) && (
            <CustomButton
              text={localizedAddButtonLabel}
              variant="gold"
              size="medium"
              onClick={openModal}
            />
          )}
        </div>
        <div className="partner-list-content">
          {displayedOwnerPartners.length > 0 ||
          editablePartners.length > 0 ||
          (isReadonlyPresentation && removedPartnerList.length > 0) ? (
            <div className="partner-cards-container">
              {displayedOwnerPartners.map((partner) =>
                renderPartnerCard(partner, true),
              )}
              {editablePartners.map((partner, index) =>
                renderPartnerCard(partner, false, false, index),
              )}
              {isReadonlyPresentation &&
                removedPartnerList.map((partner) =>
                  renderPartnerCard(partner, false, true),
                )}
            </div>
          ) : (
            renderEmptyState()
          )}
        </div>

        <Modal
          centered
          title={
            isViewing
              ? t("PartnerList.details")
              : editingId
                ? t("PartnerList.editPartner")
                : t("PartnerList.addNewPartner")
          }
          visible={modalOpen}
          onCancel={closeModal}
          footer={null}
          width={800}
          destroyOnClose
          className="partner-modal"
        >
          <div className="partner-modal-content">
            <div className="partner-form-label">
              {t("PartnerList.label.partnerType")} <span className="partner-required">*</span>
            </div>
            <Select
              value={partnerType}
              onChange={(val) => {
                setPartnerType(val);
                if (val === "individual") {
                  const nextForm = createForm({
                    initialValues: {
                      idSelector: {},
                    },
                  });
                  setFormInstance(nextForm);
                  setCompanyData({});
                } else {
                  setFormInstance(null);
                }
              }}
              disabled={isEditing || isViewing}
              className="partner-type-select"
              style={{ width: "100%" }}
            >
              {partnerTypeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>

            {partnerType === "company"
              ? renderCompanyForm()
              : renderIndividualForm()}
          </div>
          <div className="partner-modal-footer">
            {!isViewing && editingPartner && !isOwnerPartnerById(editingPartner.id) ? (
              <CustomButton
                text={t("PartnerList.delete")}
                variant="danger-outline"
                size="medium"
                onClick={handleDeleteFromModal}
              />
            ) : null}
            <CustomButton
              text={isViewing ? t("PartnerList.close") : t("PartnerList.cancel")}
              variant="outline"
              size="medium"
              onClick={closeModal}
            />
            {!isViewing ? (
              <CustomButton
                text={t("PartnerList.save")}
                variant="primary"
                size="medium"
                onClick={handleSave}
                disabled={isSaveDisabled()}
              />
            ) : null}
          </div>
        </Modal>

        <Modal
          centered
          title={t("PartnerList.deletePartner")}
          visible={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setDeletingPartner(null);
          }}
          footer={null}
          className="partner-delete-modal"
        >
          <div className="partner-delete-content">
            {t("PartnerList.deleteConfirm")}
          </div>
          <div className="partner-modal-footer">
            <CustomButton
              text={t("PartnerList.cancel")}
              variant="outline"
              size="medium"
              onClick={() => {
                setDeleteModalVisible(false);
                setDeletingPartner(null);
              }}
            />
            <CustomButton
              text={t("PartnerList.delete")}
              variant="danger"
              size="medium"
              onClick={handleDelete}
            />
          </div>
        </Modal>
      </Card>
    </div>
  );
});

PartnerListFieldDom.displayName = "PartnerListFieldDom";

export const PartnerListField = PartnerListFieldDom;

PartnerListField.displayName = "PartnerListField";

export default PartnerListField;
