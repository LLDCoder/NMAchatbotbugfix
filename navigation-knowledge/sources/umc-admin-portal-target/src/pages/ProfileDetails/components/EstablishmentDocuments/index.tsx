import React, { useMemo } from "react";
import { Empty } from "antd";
import DocumentViewer, {
  type FileType as DocumentFileType,
} from "@/components/common/DocumentViewer";
import type {
  EstablishmentDocumentInfo,
  EstablishmentInfo,
} from "@/services/userManagement";

type EstablishmentDocumentKey = keyof EstablishmentDocumentInfo;

interface EstablishmentDocumentConfig {
  key: EstablishmentDocumentKey;
  labelKey: string;
  fallbackLabel: string;
}

interface EstablishmentDocumentItem {
  key: string;
  label: string;
  fileName: string;
  fileUrl: string;
  fileType?: DocumentFileType;
}

interface EstablishmentDocumentsProps {
  documentInfo?: EstablishmentDocumentInfo | null;
  establishment?: EstablishmentInfo | null;
  t: (key: string) => string;
}

const COMMERCIAL_GROUP_IDS = new Set([2, 5, 20, 27]);
const COMMERCIAL_GROUP_CODES = new Set(["2", "5", "7", "12"]);
const GOVERNMENT_GROUP_IDS = new Set([3, 4, 31, 32, 33]);
const GOVERNMENT_GROUP_CODES = new Set(["3", "4", "13", "14", "15"]);

const COMMERCIAL_DOCUMENTS: EstablishmentDocumentConfig[] = [
  {
    key: "licenseCopyUrl",
    labelKey: "Profile.details.document.commercialLicense",
    fallbackLabel: "Commercial License",
  },
  {
    key: "tenancyContractCopyUrl",
    labelKey: "Profile.details.document.tenancyContract",
    fallbackLabel: "Tenancy Contract",
  },
  {
    key: "memorandumOfAssociationCopyUrl",
    labelKey: "Profile.details.document.memorandumOfAssociation",
    fallbackLabel: "Memorandum of Association",
  },
  {
    key: "powerOfAttorneyCopyUrl",
    labelKey: "Profile.details.document.powerOfAttorney",
    fallbackLabel: "Power of Attorney",
  },
];

const GOVERNMENT_DOCUMENTS: EstablishmentDocumentConfig[] = [
  {
    key: "officialLetterUrl",
    labelKey: "Profile.details.document.officialLetterFromEntityToNma",
    fallbackLabel: "Official Letter from the Entity to NMA",
  },
];

const LEGACY_DOCUMENT_LABELS: Partial<
  Record<EstablishmentDocumentKey, Omit<EstablishmentDocumentConfig, "key">>
> = {
  statementCopyUrl: {
    labelKey: "Profile.details.document.statement",
    fallbackLabel: "Statement",
  },
  frequencyUrl: {
    labelKey: "Profile.details.document.frequency",
    fallbackLabel: "Frequency",
  },
};

const isValidUrlValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const extractFileName = (url?: string | null) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, "http://placeholder");
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.pop() || parsed.pathname || undefined;
  } catch {
    const segments = url.split("/").filter(Boolean);
    return segments.pop() || undefined;
  }
};

const inferFileType = (fileName?: string): DocumentFileType | undefined => {
  if (!fileName) return undefined;
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "PDF";
    case "jpg":
      return "JPG";
    case "jpeg":
      return "JPEG";
    case "png":
      return "PNG";
    default:
      return undefined;
  }
};

const formatLabelFromKey = (key: string) =>
  key
    .replace(/Url$/i, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const resolveTranslatedLabel = (
  t: EstablishmentDocumentsProps["t"],
  labelKey: string,
  fallbackLabel: string
) => {
  const translated = t(labelKey);
  return translated && translated !== labelKey ? translated : fallbackLabel;
};

const normalizeCode = (value?: string | number | null) =>
  value === null || value === undefined ? "" : String(value).trim();

const getDocumentGroup = (establishment?: EstablishmentInfo | null) => {
  const subtypeId = establishment?.establishmentTypeId;
  const subtypeCode = normalizeCode(establishment?.establishmentTypeObj?.code);

  if (
    (typeof subtypeId === "number" && COMMERCIAL_GROUP_IDS.has(subtypeId)) ||
    COMMERCIAL_GROUP_CODES.has(subtypeCode)
  ) {
    return "commercial";
  }

  if (
    (typeof subtypeId === "number" && GOVERNMENT_GROUP_IDS.has(subtypeId)) ||
    GOVERNMENT_GROUP_CODES.has(subtypeCode)
  ) {
    return "government";
  }

  return "unknown";
};

const createDocumentItem = (
  key: string,
  url: string,
  label: string
): EstablishmentDocumentItem => {
  const fileUrl = url.trim();
  const fileName = extractFileName(fileUrl) || label;
  return {
    key,
    label,
    fileName,
    fileUrl,
    fileType: inferFileType(fileName),
  };
};

const buildConfiguredDocuments = (
  documentInfo: EstablishmentDocumentInfo,
  configs: EstablishmentDocumentConfig[],
  usedKeys: Set<string>,
  t: EstablishmentDocumentsProps["t"]
) =>
  configs.reduce<EstablishmentDocumentItem[]>((items, config) => {
    const value = documentInfo[config.key];
    if (!isValidUrlValue(value)) return items;

    usedKeys.add(config.key);
    items.push(
      createDocumentItem(
        config.key,
        value,
        resolveTranslatedLabel(t, config.labelKey, config.fallbackLabel)
      )
    );
    return items;
  }, []);

const buildFallbackDocuments = (
  documentInfo: EstablishmentDocumentInfo,
  usedKeys: Set<string>,
  t: EstablishmentDocumentsProps["t"]
) =>
  Object.entries(documentInfo).reduce<EstablishmentDocumentItem[]>(
    (items, [key, value]) => {
      if (usedKeys.has(key) || !isValidUrlValue(value)) return items;

      const legacyLabel = LEGACY_DOCUMENT_LABELS[key as EstablishmentDocumentKey];
      const label = legacyLabel
        ? resolveTranslatedLabel(t, legacyLabel.labelKey, legacyLabel.fallbackLabel)
        : formatLabelFromKey(key);

      items.push(createDocumentItem(key, value, label));
      return items;
    },
    []
  );

const buildEstablishmentDocuments = (
  documentInfo: EstablishmentDocumentInfo,
  establishment: EstablishmentInfo | null | undefined,
  t: EstablishmentDocumentsProps["t"]
) => {
  const usedKeys = new Set<string>();
  const group = getDocumentGroup(establishment);
  const configuredDocuments =
    group === "commercial"
      ? buildConfiguredDocuments(documentInfo, COMMERCIAL_DOCUMENTS, usedKeys, t)
      : group === "government"
        ? buildConfiguredDocuments(documentInfo, GOVERNMENT_DOCUMENTS, usedKeys, t)
        : [];

  return [
    ...configuredDocuments,
    ...buildFallbackDocuments(documentInfo, usedKeys, t),
  ];
};

const EstablishmentDocuments: React.FC<EstablishmentDocumentsProps> = ({
  documentInfo,
  establishment,
  t,
}) => {
  const documents = useMemo(() => {
    if (!documentInfo) return [];
    return buildEstablishmentDocuments(documentInfo, establishment, t);
  }, [documentInfo, establishment, t]);

  if (!documents.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("Profile.details.empty.noDocuments")}
      />
    );
  }

  return (
    <div className="profile-establishment-documents document-viewer-grid">
      {documents.map((doc) => (
        <div className="profile-establishment-document-item" key={doc.key}>
          <div className="document-item-label">{doc.label}</div>
          <DocumentViewer
            hasDownload
            fileName={doc.fileName}
            fileUrl={doc.fileUrl}
            fileType={doc.fileType}
          />
        </div>
      ))}
    </div>
  );
};

export default EstablishmentDocuments;
