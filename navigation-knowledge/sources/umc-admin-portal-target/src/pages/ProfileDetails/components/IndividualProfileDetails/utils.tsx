import { Radio } from "antd";
import DocumentViewer, {
  type FileType as DocumentFileType,
} from "@/components/common/DocumentViewer";
import type {
  PersonalInfo,
  UserProfileAddressInfoDto,
  UserProfileDocInfoDto,
} from "@/services/userManagement";
import type { InfoItem } from "../../type";
import { formatDate, getValueObjectName, safeText } from "../../utils";

type PersonalInfoWithLegacyIdentity = PersonalInfo & {
  identityTypeObj?: {
    id?: number | null;
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
  uid?: string | null;
  passportNumber?: string | null;
  emiratesIdexpiryDate?: string | null;
};

export interface DocumentItem {
  key: string;
  name: string;
  type?: DocumentFileType;
  size?: string;
  url?: string;
  label?: string;
}

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

export const buildDocuments = (
  documentInfo?: UserProfileDocInfoDto | null,
): DocumentItem[] => {
  if (!documentInfo) return [];

  return Object.entries(documentInfo)
    .filter(([, value]) => typeof value === "string" && value)
    .map(([key, value]) => {
      const url = value as string;
      const fileName = extractFileName(url) || formatLabelFromKey(key);
      return {
        key,
        name: fileName,
        type: inferFileType(fileName),
        url,
        label: formatLabelFromKey(key),
      };
    });
};

export const buildPersonalAddressItems = (
  addressInfo?: UserProfileAddressInfoDto | null,
  t?: (key: string) => string,
  preferAr = false,
): InfoItem[] => {
  const translate = t || ((key: string) => key);

  return [
    {
      key: "emirate",
      label: translate("Profile.details.address.emirate"),
      value: getValueObjectName(addressInfo?.emirateObj, preferAr),
    },
    {
      key: "region",
      label: translate("Profile.details.address.region"),
      value: getValueObjectName(addressInfo?.regionObj, preferAr),
    },
    {
      key: "area",
      label: translate("Profile.details.address.area"),
      value: getValueObjectName(addressInfo?.areaObj, preferAr),
    },
    {
      key: "street",
      label: translate("Profile.details.address.street"),
      value: getValueObjectName(addressInfo?.streetObj, preferAr),
      fullWidth: true,
    },
  ];
};

export const buildPersonalInfoItems = (
  personal?: PersonalInfo | null,
  t?: (key: string) => string,
  preferAr = false,
): InfoItem[] => {
  const translate = t || ((key: string) => key);
  const legacyPersonal = personal as PersonalInfoWithLegacyIdentity | null | undefined;
  const identityTypeId =
    legacyPersonal?.identityTypeObj?.id ?? legacyPersonal?.idTypeObj?.id;

  return [
    {
      key: "verify-method",
      label: translate("Profile.details.personal.verifyMethod"),
      value: (
        <Radio.Group value={identityTypeId} className="verify-options">
          <Radio value={1}>{translate("Profile.details.personal.emiratesId")}</Radio>
          <Radio value={2}>{translate("Profile.details.personal.uid")}</Radio>
          <Radio value={3}>{translate("Profile.details.personal.passport")}</Radio>
        </Radio.Group>
      ),
      fullWidth: true,
    },
    {
      key: "dob",
      label: translate("Profile.details.personal.dateOfBirth"),
      value: formatDate(personal?.birthDate),
    },
    {
      key: "emirates-id",
      label:
        identityTypeId === 1
          ? translate("Profile.details.personal.emiratesId")
          : identityTypeId === 2
            ? translate("Profile.details.personal.uid")
            : translate("Profile.details.personal.passportNumber"),
      value: safeText(
        legacyPersonal?.emiratesId ||
          legacyPersonal?.uid ||
          legacyPersonal?.passportNumber,
      ),
    },
    {
      key: "name-ar",
      label: translate("Profile.details.personal.fullNameAr"),
      value: safeText(personal?.nameAr),
    },
    {
      key: "name-en",
      label: translate("Profile.details.personal.fullNameEn"),
      value: safeText(personal?.nameEn),
    },
    {
      key: "nationality",
      label: translate("Profile.details.personal.nationality"),
      value: getValueObjectName(personal?.nationalityObj, preferAr),
    },
    {
      key: "gender",
      label: translate("Profile.details.personal.gender"),
      value: getValueObjectName(personal?.genderObj, preferAr),
    },
    {
      key: "occupation",
      label: translate("Profile.details.personal.occupation"),
      value: safeText(personal?.occupation),
    },
    {
      key: "passport-expiry",
      label: translate("Profile.details.personal.expiryDate"),
      value: formatDate(
        identityTypeId === 1
          ? legacyPersonal?.emiratesIdexpiryDate
          : legacyPersonal?.passportExpiryDate,
      ),
    },
  ];
};

export const renderPersonalDocument = (
  doc: DocumentItem,
  t: (key: string) => string,
) => (
  <DocumentViewer
    key={doc.key}
    hasDownload
    uploadConfig={{
      maxCount: 1,
      maxSize: 5,
      uploadTip: t("Profile.details.document.uploadTip"),
    }}
    fileName={doc.url}
  />
);
