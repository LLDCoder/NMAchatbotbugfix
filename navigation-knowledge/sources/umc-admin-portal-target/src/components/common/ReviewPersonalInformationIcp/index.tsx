import { useEffect, useMemo, useState, type ReactNode } from "react";
import moment from "moment";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  getApplicantProfile,
  type ApplicantProfileEnvelope,
  type IcpApplicantAddress,
  type IcpApplicantChild,
  type IcpApplicantFriend,
  type IcpApplicantPersonProfile,
  type IcpApplicantRelative,
  type IcpApplicantWife,
} from "@/services/icp";
import DocumentViewer from "@/components/common/DocumentViewer";
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader";
import "./ReviewPersonalInformationIcp.less";

interface ReviewPersonalInformationIcpProps {
  expanded: boolean;
  onToggle: () => void;
  profileId?: string | number;
  className?: string;
}

interface PersonalInformationReviewData {
  personalInformation?: {
    fullName?: string | null;
    fullNameArabic?: string | null;
    surname?: string | null;
    surnameArabic?: string | null;
    dateOfBirth?: string | null;
    placeOfBirth?: string | null;
    currentNationality?: string | null;
    previousNationality?: string | null;
    religion?: string | null;
    sect?: string | null;
    profession?: string | null;
    maritalStatus?: string | null;
    entryDateToUae?: string | null;
    portOfEntry?: string | null;
    sponsorUponEntry?: string | null;
    arrivingFrom?: string | null;
    languages?: string[] | null;
    educationalQualification?: {
      specialization?: string | null;
      academyName?: string | null;
      grade?: string | null;
    } | null;
    spouseName?: string | null;
    spouseNationality?: string | null;
    spouseProfession?: string | null;
    countriesVisited?: string[] | null;
  } | null;
  childrenInformation?: {
    hasChildren?: boolean | string | null;
    children?: Array<{
      name?: string | null;
      idn?: string | null;
    }> | null;
  } | null;
  parentsInformation?: {
    fatherName?: string | null;
    fatherNationality?: string | null;
    fatherProfession?: string | null;
    fatherEmployer?: string | null;
    fatherDateOfBirth?: string | null;
    fatherPlaceOfBirth?: string | null;
    motherName?: string | null;
    motherNationality?: string | null;
    motherProfession?: string | null;
    motherEmployer?: string | null;
    motherDateOfBirth?: string | null;
    motherPlaceOfBirth?: string | null;
  } | null;
  militaryExperience?: {
    servedInMilitary?: string | null;
  } | null;
  relatives?: Array<{
    name?: string | null;
    employer?: string | null;
  }> | null;
  friends?: Array<{
    name?: string | null;
    employer?: string | null;
  }> | null;
  cardDetails?: {
    plateNumber?: string | null;
    colourOfPlate?: string | null;
    type?: string | null;
    plateOfRegistration?: string | null;
  } | null;
  residenceDetails?: {
    flatHouseNumber?: string | null;
    street?: string | null;
    emirate?: string | null;
    area?: string | null;
    telephoneNo?: string | null;
  } | null;
  passportDetails?: {
    passportNumber?: string | null;
    placeOfIssue?: string | null;
    dateOfIssue?: string | null;
    expiryDate?: string | null;
  } | null;
  residencyDetails?: {
    residencyNumber?: string | null;
    placeOfIssue?: string | null;
    dateOfIssue?: string | null;
    expiryDate?: string | null;
  } | null;
  financialSponsor?: {
    fullName?: string | null;
    address?: {
      buildingNumber?: string | null;
      building?: string | null;
      street?: string | null;
      area?: string | null;
      emirate?: string | null;
    } | null;
    placeOfEmployment?: string | null;
    profession?: string | null;
    workPhone?: string | null;
  } | null;
  declaration?: {
    signature?: string | null;
    date?: string | null;
  } | null;
}

interface ReviewField {
  key: string;
  label: string;
  value: string;
  className?: string;
  renderValue?: () => ReactNode;
}

interface ReviewSection {
  key: string;
  title: string;
  fields: ReviewField[];
}

const EMPTY_VALUE = "-";

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function normalizeValue(value: unknown): string {
  if (isEmptyValue(value)) return EMPTY_VALUE;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : EMPTY_VALUE;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.trim() || EMPTY_VALUE;
  return EMPTY_VALUE;
}

function normalizeDisplayValue(value: unknown, t: TFunction): string {
  if (typeof value === "boolean") {
    return t(
      value
        ? "ReviewPersonalInformationIcp.values.yes"
        : "ReviewPersonalInformationIcp.values.no",
    );
  }

  const normalizedValue = normalizeValue(value);
  if (normalizedValue === "Yes") {
    return t("ReviewPersonalInformationIcp.values.yes");
  }
  if (normalizedValue === "No") {
    return t("ReviewPersonalInformationIcp.values.no");
  }

  return normalizedValue;
}

function formatDate(value: unknown): string {
  if (isEmptyValue(value)) return EMPTY_VALUE;
  const parsed = moment(value as moment.MomentInput);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : EMPTY_VALUE;
}

function joinValues(values: unknown[], separator = ", "): string {
  const normalized = values
    .map((value) => normalizeValue(value))
    .filter((value) => value !== EMPTY_VALUE);

  return normalized.length > 0 ? normalized.join(separator) : EMPTY_VALUE;
}

function formatStringArray(values?: string[] | null): string {
  return Array.isArray(values) && values.length > 0
    ? joinValues(values)
    : EMPTY_VALUE;
}

function formatIndexedRows<T>(
  rows: T[] | null | undefined,
  formatter: (row: T, index: number) => string,
): string {
  if (!Array.isArray(rows) || rows.length === 0) return EMPTY_VALUE;
  const values = rows
    .map((row, index) => formatter(row, index))
    .filter((value) => value !== EMPTY_VALUE);

  return values.length > 0 ? values.join("; ") : EMPTY_VALUE;
}

function formatIndexedValue(prefix: string, values: unknown[]): string {
  const normalized = values
    .map((value) => normalizeValue(value))
    .filter((value) => value !== EMPTY_VALUE);

  return normalized.length > 0
    ? [prefix, ...normalized].join(" - ")
    : EMPTY_VALUE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getField<T>(source: unknown, ...keys: string[]): T | undefined {
  if (!isRecord(source)) return undefined;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key] as T;
    }
  }

  return undefined;
}

function getStringField(source: unknown, ...keys: string[]): string | undefined {
  const value = getField<unknown>(source, ...keys);
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getArrayField<T>(source: unknown, ...keys: string[]): T[] {
  const value = getField<unknown>(source, ...keys);
  return Array.isArray(value) ? (value as T[]) : [];
}

function getDescriptionEnglish(source: unknown): string | undefined {
  return getStringField(source, "DescriptionEnglish", "descriptionEnglish");
}

function getStreetValue(street: unknown): string | undefined {
  if (typeof street === "string") {
    const trimmed = street.trim();
    return trimmed || undefined;
  }

  return getDescriptionEnglish(street);
}

function getAddressStreet(address: unknown): string | undefined {
  return getStreetValue(getField<unknown>(address, "Street", "street"));
}

function getFullNameEnglish(source: unknown): string | undefined {
  return getStringField(source, "FullNameEnglish", "fullNameEnglish");
}

function getFullNameArabic(source: unknown): string | undefined {
  return getStringField(source, "FullNameArabic", "fullNameArabic");
}

function getFamilyNameEnglish(source: unknown): string | undefined {
  return getStringField(source, "FamilyNameEnglish", "familyNameEnglish");
}

function getFamilyNameArabic(source: unknown): string | undefined {
  return getStringField(source, "FamilyNameArabic", "familyNameArabic");
}

function getRelationName(relative: IcpApplicantRelative): string {
  return (
    getDescriptionEnglish(getField(relative, "Relation", "relation")) ?? ""
  )
    .trim()
    .toLowerCase();
}

function findRelativeByRelation(
  relatives: IcpApplicantRelative[],
  relationName: string,
): IcpApplicantRelative | undefined {
  const normalizedRelationName = relationName.trim().toLowerCase();
  return relatives.find(
    (relative) => getRelationName(relative) === normalizedRelationName,
  );
}

function resolveBirthPlace(
  personProfile: IcpApplicantPersonProfile,
): string | undefined {
  return joinValues([
    getStringField(personProfile, "BirthPlaceEnglish", "birthPlaceEnglish"),
    getDescriptionEnglish(getField(personProfile, "BirthCountry", "birthCountry")),
    getDescriptionEnglish(getField(personProfile, "BirthCity", "birthCity")),
  ]);
}

function mapApplicantProfileResponseToReviewData(
  response:
    | ApplicantProfileEnvelope
    | { data?: ApplicantProfileEnvelope }
    | null
    | undefined,
): PersonalInformationReviewData | null {
  const envelope = getField<ApplicantProfileEnvelope>(response, "data") ?? response;
  if (!isRecord(envelope) || getField(envelope, "Success", "success") !== true) {
    return null;
  }

  const profile = getField(envelope, "Profile", "profile");
  const personProfile = getField<IcpApplicantPersonProfile>(
    profile,
    "PersonProfile",
    "personProfile",
  );

  if (!isRecord(personProfile)) return null;

  const personName = getField(personProfile, "PersonName", "personName");
  const passport = getField(personProfile, "Passport", "passport");
  const sponsor = getField(personProfile, "Sponsor", "sponsor");
  const immigrationFile = getField(
    personProfile,
    "ImmigrationFile",
    "immigrationFile",
  );
  const qualification = getField(personProfile, "Qualification", "qualification");
  const qualificationSpecialization = getField(
    qualification,
    "Specialization",
    "specialization",
  );
  const relatives = getArrayField<IcpApplicantRelative>(
    personProfile,
    "Relatives",
    "relatives",
  );
  const friends = getArrayField<IcpApplicantFriend>(
    personProfile,
    "Friends",
    "friends",
  );
  const father = findRelativeByRelation(relatives, "Father");
  const mother = findRelativeByRelation(relatives, "Mother");
  const wives = getArrayField<IcpApplicantWife>(personProfile, "Wives", "wives");
  const spouse = wives[0];
  const addresses = getArrayField<IcpApplicantAddress>(
    personProfile,
    "Addresses",
    "addresses",
  );
  const residenceAddress = addresses[0];
  const sponsorAddresses = getArrayField<IcpApplicantAddress>(
    sponsor,
    "Addresses",
    "addresses",
  );
  const sponsorAddress = sponsorAddresses[0];
  const motherChildCountRaw = getField<unknown>(
    personProfile,
    "MotherChildCount",
    "motherChildCount",
  );
  const motherChildCount = Number(motherChildCountRaw ?? 0);
  const motherChildren = getArrayField<IcpApplicantChild>(
    personProfile,
    "MotherChildren",
    "motherChildren",
  );

  return {
    personalInformation: {
      fullName: getFullNameEnglish(personName),
      fullNameArabic: getFullNameArabic(personName),
      surname: getFamilyNameEnglish(personName),
      surnameArabic: getFamilyNameArabic(personName),
      dateOfBirth: getStringField(personProfile, "BirthDate", "birthDate"),
      placeOfBirth: resolveBirthPlace(personProfile),
      currentNationality: getDescriptionEnglish(
        getField(personProfile, "Nationality", "nationality"),
      ),
      previousNationality: getDescriptionEnglish(
        getField(personProfile, "PreviousNationality", "previousNationality"),
      ),
      religion: getDescriptionEnglish(
        getField(personProfile, "Religion", "religion"),
      ),
      sect: getDescriptionEnglish(getField(personProfile, "Faith", "faith")),
      profession: getDescriptionEnglish(
        getField(personProfile, "Occupation", "occupation"),
      ),
      maritalStatus: getDescriptionEnglish(
        getField(personProfile, "MaritalStatus", "maritalStatus"),
      ),
      entryDateToUae: getStringField(
        personProfile,
        "LastEntryDate",
        "lastEntryDate",
      ),
      sponsorUponEntry: getStringField(sponsor, "NameEnglish", "nameEnglish"),
      languages: [
        getStringField(personProfile, "PrimaryLangCode", "primaryLangCode"),
      ].filter(Boolean) as string[],
      educationalQualification: {
        specialization: getDescriptionEnglish(qualificationSpecialization),
        academyName: getStringField(qualification, "AcademyName", "academyName"),
        grade: getStringField(qualification, "Grade", "grade"),
      },
      spouseName: getFullNameEnglish(getField(spouse, "Name", "name")),
      spouseNationality: getDescriptionEnglish(
        getField(spouse, "Nationality", "nationality"),
      ),
    },
    childrenInformation: {
      hasChildren:
        Number.isFinite(motherChildCount) && motherChildCount > 0,
      children: motherChildren.map((child) => ({
        idn: getStringField(child, "EmiratesId", "emiratesId"),
      })),
    },
    parentsInformation: {
      fatherName: getFullNameEnglish(getField(father, "Name", "name")),
      fatherNationality: getDescriptionEnglish(
        getField(father, "Nationality", "nationality"),
      ),
      fatherDateOfBirth: getStringField(father, "BirthDate", "birthDate"),
      motherName:
        getFullNameEnglish(getField(mother, "Name", "name")) ??
        getStringField(personProfile, "MotherNameEnglish", "motherNameEnglish"),
      motherNationality: getDescriptionEnglish(
        getField(mother, "Nationality", "nationality"),
      ),
      motherDateOfBirth: getStringField(mother, "BirthDate", "birthDate"),
    },
    relatives: relatives.map((relative) => ({
      name:
        getFullNameEnglish(getField(relative, "Name", "name")) ??
        getStringField(relative, "NameEnglish", "nameEnglish"),
      employer: getStringField(relative, "Employer", "employer"),
    })),
    friends: friends.map((friend) => ({
      name: getStringField(friend, "NameEnglish", "nameEnglish"),
      employer: getStringField(friend, "Employer", "employer"),
    })),
    residenceDetails: {
      flatHouseNumber: getStringField(
        residenceAddress,
        "BuildingNumber",
        "buildingNumber",
      ),
      street: getAddressStreet(residenceAddress),
      emirate: getDescriptionEnglish(
        getField(residenceAddress, "Emirate", "emirate"),
      ),
      area: getDescriptionEnglish(getField(residenceAddress, "Area", "area")),
      telephoneNo:
        getStringField(residenceAddress, "HomePhone", "homePhone") ??
        getStringField(residenceAddress, "MobileNo", "mobileNo"),
    },
    passportDetails: {
      passportNumber: getStringField(passport, "PassportNo", "passportNo"),
      placeOfIssue: getStringField(passport, "IssuePlace", "issuePlace"),
      dateOfIssue: getStringField(passport, "IssueDate", "issueDate"),
      expiryDate: getStringField(passport, "ExpiryDate", "expiryDate"),
    },
    residencyDetails: {
      residencyNumber: getStringField(immigrationFile, "FileNo", "fileNo"),
      dateOfIssue: getStringField(immigrationFile, "IssueDate", "issueDate"),
      expiryDate: getStringField(immigrationFile, "ExpiryDate", "expiryDate"),
    },
    financialSponsor: {
      fullName: getStringField(sponsor, "NameEnglish", "nameEnglish"),
      address: {
        buildingNumber: getStringField(
          sponsorAddress,
          "BuildingNumber",
          "buildingNumber",
        ),
        building: getStringField(sponsorAddress, "Building", "building"),
        street: getAddressStreet(sponsorAddress),
        area: getDescriptionEnglish(getField(sponsorAddress, "Area", "area")),
        emirate: getDescriptionEnglish(
          getField(sponsorAddress, "Emirate", "emirate"),
        ),
      },
      workPhone: getStringField(sponsorAddress, "WorkPhone", "workPhone"),
    },
    declaration: {
      signature: getStringField(personProfile, "Signature", "signature"),
    },
  };
}

function normalizeProfileId(profileId?: string | number): string | undefined {
  if (profileId === undefined || profileId === null) return undefined;
  const rawProfileId = String(profileId).trim();
  return rawProfileId || undefined;
}

function buildSections(
  data: PersonalInformationReviewData | null,
  t: TFunction,
): ReviewSection[] {
  const personal = data?.personalInformation;
  const children = data?.childrenInformation;
  const parents = data?.parentsInformation;
  const military = data?.militaryExperience;
  const sponsorAddress = data?.financialSponsor?.address;
  const signatureFile = normalizeValue(data?.declaration?.signature);
  const label = (key: string) => t(`ReviewPersonalInformationIcp.labels.${key}`);
  const sectionTitle = (key: string) =>
    t(`ReviewPersonalInformationIcp.sections.${key}`);
  const indexed = (key: string, index: number) =>
    t(`ReviewPersonalInformationIcp.indexed.${key}`, { index: index + 1 });
  const value = (input: unknown) => normalizeDisplayValue(input, t);
  const buildIndexedPersonFields = (
    rows: Array<{ name?: string | null; employer?: string | null }> | null | undefined,
    keyPrefix: string,
  ): ReviewField[] => {
    const normalizedRows =
      Array.isArray(rows) && rows.length > 0
        ? rows
        : [{ name: null, employer: null }];

    return normalizedRows.flatMap((row, index) => [
      {
        key: `${keyPrefix}-${index}-name`,
        label: indexed("name", index),
        value: value(row.name),
      },
      {
        key: `${keyPrefix}-${index}-employer`,
        label: indexed("employer", index),
        value: value(row.employer),
      },
    ]);
  };

  return [
    {
      key: "personalInformation",
      title: sectionTitle("personalInformation"),
      fields: [
        { key: "fullName", label: label("fullName"), value: value(personal?.fullName) },
        {
          key: "fullNameArabic",
          label: label("fullNameArabic"),
          value: value(personal?.fullNameArabic),
        },
        { key: "surname", label: label("surname"), value: value(personal?.surname) },
        {
          key: "surnameArabic",
          label: label("surnameArabic"),
          value: value(personal?.surnameArabic),
        },
        { key: "dateOfBirth", label: label("dateOfBirth"), value: formatDate(personal?.dateOfBirth) },
        {
          key: "placeOfBirth",
          label: label("placeOfBirth"),
          value: value(personal?.placeOfBirth),
        },
        {
          key: "currentNationality",
          label: label("currentNationality"),
          value: value(personal?.currentNationality),
        },
        {
          key: "previousNationality",
          label: label("previousNationality"),
          value: value(personal?.previousNationality),
        },
        { key: "religion", label: label("religion"), value: value(personal?.religion) },
        { key: "sect", label: label("sect"), value: value(personal?.sect) },
        { key: "profession", label: label("profession"), value: value(personal?.profession) },
        {
          key: "maritalStatus",
          label: label("maritalStatus"),
          value: value(personal?.maritalStatus),
        },
        {
          key: "entryDateToUae",
          label: label("entryDateToUae"),
          value: formatDate(personal?.entryDateToUae),
        },
        { key: "portOfEntry", label: label("portOfEntry"), value: value(personal?.portOfEntry) },
        {
          key: "sponsorUponEntry",
          label: label("sponsorUponEntry"),
          value: value(personal?.sponsorUponEntry),
        },
        {
          key: "arrivingFrom",
          label: label("arrivingFrom"),
          value: value(personal?.arrivingFrom),
        },
        { key: "languages", label: label("languages"), value: formatStringArray(personal?.languages) },
        {
          key: "educationalQualification",
          label: label("educationalQualification"),
          value: joinValues([
            personal?.educationalQualification?.specialization,
            personal?.educationalQualification?.academyName,
            personal?.educationalQualification?.grade,
          ]),
        },
        {
          key: "spouseName",
          label: label("spouseName"),
          value: value(personal?.spouseName),
        },
        {
          key: "spouseNationality",
          label: label("spouseNationality"),
          value: value(personal?.spouseNationality),
        },
        {
          key: "spouseProfession",
          label: label("spouseProfession"),
          value: value(personal?.spouseProfession),
        },
        {
          key: "countriesVisited",
          label: label("countriesVisited"),
          value: formatStringArray(personal?.countriesVisited),
        },
      ],
    },
    {
      key: "childrenInformation",
      title: sectionTitle("childrenInformation"),
      fields: [
        {
          key: "hasChildren",
          label: label("hasChildren"),
          value: value(children?.hasChildren),
        },
        {
          key: "children",
          label: label("children"),
          value: formatIndexedRows(children?.children, (child, index) =>
            formatIndexedValue(indexed("child", index), [child.name, child.idn]),
          ),
        },
      ],
    },
    {
      key: "parentsInformation",
      title: sectionTitle("parentsInformation"),
      fields: [
        { key: "fatherName", label: label("fatherName"), value: value(parents?.fatherName) },
        {
          key: "fatherNationality",
          label: label("fatherNationality"),
          value: value(parents?.fatherNationality),
        },
        {
          key: "fatherProfession",
          label: label("fatherProfession"),
          value: value(parents?.fatherProfession),
        },
        {
          key: "fatherEmployer",
          label: label("fatherEmployer"),
          value: value(parents?.fatherEmployer),
        },
        {
          key: "fatherDateOfBirth",
          label: label("fatherDateOfBirth"),
          value: formatDate(parents?.fatherDateOfBirth),
        },
        {
          key: "fatherPlaceOfBirth",
          label: label("fatherPlaceOfBirth"),
          value: value(parents?.fatherPlaceOfBirth),
        },
        { key: "motherName", label: label("motherName"), value: value(parents?.motherName) },
        {
          key: "motherNationality",
          label: label("motherNationality"),
          value: value(parents?.motherNationality),
        },
        {
          key: "motherProfession",
          label: label("motherProfession"),
          value: value(parents?.motherProfession),
        },
        {
          key: "motherEmployer",
          label: label("motherEmployer"),
          value: value(parents?.motherEmployer),
        },
        {
          key: "motherDateOfBirth",
          label: label("motherDateOfBirth"),
          value: formatDate(parents?.motherDateOfBirth),
        },
        {
          key: "motherPlaceOfBirth",
          label: label("motherPlaceOfBirth"),
          value: value(parents?.motherPlaceOfBirth),
        },
      ],
    },
    {
      key: "militaryExperience",
      title: sectionTitle("militaryExperience"),
      fields: [
        {
          key: "servedInMilitary",
          label: label("servedInMilitary"),
          value: value(military?.servedInMilitary),
        },
      ],
    },
    {
      key: "relatives",
      title: sectionTitle("relatives"),
      fields: buildIndexedPersonFields(data?.relatives, "relative"),
    },
    {
      key: "friends",
      title: sectionTitle("friends"),
      fields: buildIndexedPersonFields(data?.friends, "friend"),
    },
    {
      key: "cardDetails",
      title: sectionTitle("cardDetails"),
      fields: [
        {
          key: "plateNumber",
          label: label("plateNumber"),
          value: value(data?.cardDetails?.plateNumber),
        },
        {
          key: "colourOfPlate",
          label: label("colourOfPlate"),
          value: value(data?.cardDetails?.colourOfPlate),
        },
        { key: "type", label: label("type"), value: value(data?.cardDetails?.type) },
        {
          key: "plateOfRegistration",
          label: label("plateOfRegistration"),
          value: value(data?.cardDetails?.plateOfRegistration),
        },
      ],
    },
    {
      key: "residenceDetails",
      title: sectionTitle("residenceDetails"),
      fields: [
        {
          key: "flatHouseNumber",
          label: label("flatHouseNumber"),
          value: value(data?.residenceDetails?.flatHouseNumber),
        },
        {
          key: "street",
          label: label("street"),
          value: value(data?.residenceDetails?.street),
        },
        {
          key: "emirate",
          label: label("emirate"),
          value: value(data?.residenceDetails?.emirate),
        },
        { key: "area", label: label("area"), value: value(data?.residenceDetails?.area) },
        {
          key: "telephoneNo",
          label: label("telephoneNo"),
          value: value(data?.residenceDetails?.telephoneNo),
        },
      ],
    },
    {
      key: "passportDetails",
      title: sectionTitle("passportDetails"),
      fields: [
        {
          key: "passportNumber",
          label: label("passportNumber"),
          value: value(data?.passportDetails?.passportNumber),
        },
        {
          key: "passportPlaceOfIssue",
          label: label("placeOfIssue"),
          value: value(data?.passportDetails?.placeOfIssue),
        },
        {
          key: "passportDateOfIssue",
          label: label("dateOfIssue"),
          value: formatDate(data?.passportDetails?.dateOfIssue),
        },
        {
          key: "passportExpiryDate",
          label: label("expiryDate"),
          value: formatDate(data?.passportDetails?.expiryDate),
        },
      ],
    },
    {
      key: "residencyDetails",
      title: sectionTitle("residencyDetails"),
      fields: [
        {
          key: "residencyNumber",
          label: label("residencyNumber"),
          value: value(data?.residencyDetails?.residencyNumber),
        },
        {
          key: "residencyPlaceOfIssue",
          label: label("placeOfIssue"),
          value: value(data?.residencyDetails?.placeOfIssue),
        },
        {
          key: "residencyDateOfIssue",
          label: label("dateOfIssue"),
          value: formatDate(data?.residencyDetails?.dateOfIssue),
        },
        {
          key: "residencyExpiryDate",
          label: label("expiryDate"),
          value: formatDate(data?.residencyDetails?.expiryDate),
        },
      ],
    },
    {
      key: "financialSponsor",
      title: sectionTitle("financialSponsor"),
      fields: [
        {
          key: "sponsorFullName",
          label: label("fullName"),
          value: value(data?.financialSponsor?.fullName),
        },
        {
          key: "sponsorAddress",
          label: label("address"),
          value: joinValues([
            sponsorAddress?.buildingNumber,
            sponsorAddress?.building,
            sponsorAddress?.street,
            sponsorAddress?.area,
            sponsorAddress?.emirate,
          ]),
        },
        {
          key: "placeOfEmployment",
          label: label("placeOfEmployment"),
          value: value(data?.financialSponsor?.placeOfEmployment),
        },
        {
          key: "sponsorProfession",
          label: label("profession"),
          value: value(data?.financialSponsor?.profession),
        },
        {
          key: "workPhone",
          label: label("workPhone"),
          value: value(data?.financialSponsor?.workPhone),
        },
      ],
    },
    {
      key: "declaration",
      title: sectionTitle("declaration"),
      fields: [
        {
          key: "signature",
          label: label("signature"),
          value: signatureFile,
          className: "info-item--signature",
          renderValue: () =>
            signatureFile !== EMPTY_VALUE ? (
              <DocumentViewer
                fileName={t("ReviewPersonalInformationIcp.signature.fileName")}
                fileUrl={signatureFile}
                fileType="PNG"
                hasView
                className="signature-document-viewer"
              />
            ) : (
              EMPTY_VALUE
            ),
        },
        { key: "declarationDate", label: label("date"), value: formatDate(data?.declaration?.date) },
      ],
    },
  ];
}

export default function ReviewPersonalInformationIcp({
  expanded,
  onToggle,
  profileId,
  className = "",
}: ReviewPersonalInformationIcpProps) {
  const { t } = useTranslation();
  const [profileData, setProfileData] =
    useState<PersonalInformationReviewData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const normalizedProfileId = normalizeProfileId(profileId);

    if (normalizedProfileId === undefined) {
      setProfileData(null);
      return () => {
        isMounted = false;
      };
    }

    setProfileData(null);

    getApplicantProfile(normalizedProfileId)
      .then((res) => {
        if (!isMounted) return;
        setProfileData(mapApplicantProfileResponseToReviewData(res));
      })
      .catch(() => {
        if (!isMounted) return;
        setProfileData(null);
      });

    return () => {
      isMounted = false;
    };
  }, [profileId]);

  const sections = useMemo(() => buildSections(profileData, t), [profileData, t]);
  const rootClassName = ["review-personal-information-icp-section", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <CollapsibleCardHeader
        title={t("ReviewPersonalInformationIcp.header.personalInformation")}
        expanded={expanded}
        onToggle={onToggle}
      />

      <div className="section-content" hidden={!expanded}>
        {sections.map((section) => (
          <div className="info-block" key={section.key}>
            <h4 className="block-title">{section.title}</h4>
            <div className="info-grid">
              {section.fields.map((field) => (
                <div
                  className={["info-item", field.className]
                    .filter(Boolean)
                    .join(" ")}
                  key={field.key}
                >
                  <span className="info-label">{field.label}</span>
                  <span className="info-value">
                    {field.renderValue
                      ? field.renderValue()
                      : field.value || EMPTY_VALUE}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
