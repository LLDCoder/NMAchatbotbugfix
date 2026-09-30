export type LanguageChangeType = "added" | "modified" | "deleted";

export interface AdminModifyChangeValueOption {
  value: string | number;
  labelEn: string;
  labelAr: string;
}

export type AdminModifyChangeValueSource =
  | { type: "lookup"; source: string }
  | { type: "nationality" }
  | { type: "emirate" }
  | { type: "region" }
  | { type: "area" };

export interface AdminModifyChangeField {
  key: string;
  labelEn: string;
  labelAr: string;
  labelI18nKey?: string;
  before: unknown;
  after: unknown;
  component?: string;
  ownerComponent?: string;
  valueOptions?: AdminModifyChangeValueOption[];
  valueSource?: AdminModifyChangeValueSource;
}

export interface LanguageChangeValue {
  language: string;
  name: string;
}

export interface AdminModifyLanguageChange {
  key: string;
  changeType: LanguageChangeType;
  before: LanguageChangeValue | null;
  after: LanguageChangeValue | null;
}

export interface AdminModifyLanguageSnapshot {
  key: string;
  beforeRows: LanguageChangeValue[];
  afterRows: Array<
    LanguageChangeValue & { changeType?: LanguageChangeType }
  >;
  deletedRows: Array<
    LanguageChangeValue & { changeType: "deleted" }
  >;
}

export interface AdminModifySocialChange {
  key: string;
  changeType: LanguageChangeType;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AdminModifyActivityChange {
  key: string;
  changeType: LanguageChangeType;
  before: unknown;
  after: unknown;
}

export interface AdminModifyChangeSection {
  key: string;
  titleEn: string;
  titleAr: string;
  fields: AdminModifyChangeField[];
  languageChanges: AdminModifyLanguageChange[];
  languageSnapshots?: AdminModifyLanguageSnapshot[];
  socialChanges: AdminModifySocialChange[];
  activityChanges?: AdminModifyActivityChange[];
  hasSocialChanges: boolean;
}

type UnknownRecord = Record<string, unknown>;

interface SchemaFieldDescriptor {
  key: string;
  aliases: string[];
  component: string;
  labelEn: string;
  labelAr: string;
  dataSource?: string;
}

interface ParsedStep {
  schema?: unknown;
  formValues?: unknown;
  modifyOriginalFormValues?: unknown;
  modifyChangeSet?: unknown;
}

interface PersistedModifyChangeItem {
  kind: "field" | "list";
  changeType: "ADDED" | "MODIFIED" | "DELETED";
  fieldKey: string;
  labelEn: string;
  labelAr: string;
  beforeValue: unknown;
  afterValue: unknown;
  component?: string;
  ownerComponent?: string;
  valueOptions?: AdminModifyChangeValueOption[];
  valueSource?: AdminModifyChangeValueSource;
}

interface PersistedModifyChangeSet {
  sectionNameEn: string;
  sectionNameAr: string;
  changes: PersistedModifyChangeItem[];
}

const PATH_SEPARATOR = ".";
const ADMIN_MODIFY_CHANGE_SUMMARY_SERVICE_CODES = new Set([
  "803",
  "903",
  "1203",
  "80011",
  "80012",
]);

export const shouldDisplayAdminModifyChangeSummary = (
  serviceCode?: string | number | null,
) =>
  ADMIN_MODIFY_CHANGE_SUMMARY_SERVICE_CODES.has(String(serviceCode ?? ""));

const PERSISTED_LANGUAGE_CHANGE_TYPES: Record<
  PersistedModifyChangeItem["changeType"],
  LanguageChangeType
> = {
  ADDED: "added",
  MODIFIED: "modified",
  DELETED: "deleted",
};

const PROFILE_FORM_LABEL_I18N_KEYS: Record<string, string> = {
  hastradelicense: "ProfileForm.labelHasTradeLicense",
  commerciallicensenumber: "ProfileForm.labelTradeLicenseNumber",
  reservetradenumber: "ProfileForm.labelReserveTradeNumber",
  licenseexpirydate: "ProfileForm.labelLicenseExpiryDate",
  commerciallicense: "ProfileForm.labelUploadCommercialLicense",
  reservetradename: "ProfileForm.labelUploadReserveTradeName",
  establishmentsubtypes: "ProfileForm.labelEstablishmentSubTypes",
  workemail: "ProfileForm.labelWorkEmail",
  establishmentnamearabic: "ProfileForm.labelEstablishmentNameArabic",
  establishmentnameenglish: "ProfileForm.labelEstablishmentNameEnglish",
  emirate: "ProfileForm.labelEmirate",
  establishmentemiratename: "ProfileForm.labelEmirate",
  licensingauthority: "ProfileForm.labelLicensingAuthority",
  phonenumber: "ProfileForm.labelPhoneNumber",
  tenancycontractenddate: "ProfileForm.labelTenancyContractEndDate",
  tenancycontract: "ProfileForm.labelUploadTenancyContract",
  memorandumofassociation: "ProfileForm.labelMemorandumOfAssociation",
  powerofattorney: "ProfileForm.labelPowerOfAttorney",
};

const ADDRESS_PICKER_LABEL_I18N_KEYS: Record<string, string> = {
  emirateid: "AddressPicker.labelEmirate",
  regionid: "AddressPicker.labelRegion",
  areaid: "AddressPicker.labelArea",
  street: "AddressPicker.labelStreet",
};

const ID_SELECTOR_LABEL_I18N_KEYS: Record<string, string> = {
  dateofbirth: "IDSelector.labelDateOfBirth",
  emiratesid: "IDSelector.labelEmiratesId",
  uid: "IDSelector.labelUid",
  passportnumber: "IDSelector.labelPassportNumber",
  fullnamearabic: "IDSelector.labelFullNameAr",
  fullnameenglish: "IDSelector.labelFullNameEn",
  nationality: "IDSelector.labelNationality",
  gender: "IDSelector.labelGender",
  occupation: "IDSelector.labelOccupation",
  emiratesidexpirydate: "IDSelector.labelExpiryDate",
  passportexpirydate: "IDSelector.labelPassportExpiry",
  visaexpirydate: "IDSelector.labelVisaExpiry",
  passporttype: "IDSelector.labelPassportType",
  placeofissueen: "IDSelector.labelPlaceOfIssueEn",
  placeofissuear: "IDSelector.labelPlaceOfIssueAr",
  mobileno: "IDSelector.labelMobileNo",
  telephoneno: "IDSelector.labelTelephoneNo",
  fax: "IDSelector.labelFax",
  workno: "IDSelector.labelWorkNo",
  areacode: "IDSelector.labelContactArea",
  emailaddress: "IDSelector.labelEmailAddress",
  personalphoto: "IDSelector.labelPersonalPhoto",
  passportscan: "IDSelector.labelPassportScan",
  passport: "IDSelector.labelPassportDoc",
  visa: "IDSelector.labelVisaDoc",
};

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseStepFormData(step: UnknownRecord): ParsedStep | null {
  const rawFormData = step.formData;
  if (typeof rawFormData === "string") {
    try {
      const parsed = JSON.parse(rawFormData) as unknown;
      return isRecord(parsed) ? (parsed as ParsedStep) : null;
    } catch {
      return null;
    }
  }
  return isRecord(rawFormData) ? (rawFormData as ParsedStep) : null;
}

function humanizeKey(key: string): string {
  const withSpaces = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return withSpaces.replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isAddressCoordinateField(field: AdminModifyChangeField): boolean {
  const pathParts = field.key.split(".").filter(Boolean);
  const terminalField = normalizeKey(
    pathParts[pathParts.length - 1] ?? field.key,
  );

  if (terminalField !== "latitude" && terminalField !== "longitude") {
    return false;
  }

  return (
    pathParts
      .slice(0, -1)
      .some((part) => normalizeKey(part) === "addresspicker") ||
    [field.component, field.ownerComponent].some(
      (component) => normalizeKey(String(component ?? "")) === "addresspicker",
    )
  );
}

export function filterAdminModifyChangeSummaryForDisplay(
  sections: AdminModifyChangeSection[],
  serviceCode: string | number | null | undefined,
): AdminModifyChangeSection[] {
  const normalizedServiceCode = String(serviceCode ?? "").trim();
  const shouldFilterCoordinates = ["903", "803", "1203"].includes(
    normalizedServiceCode,
  );
  const shouldHideSocialChanges = ["80011", "80012"].includes(
    normalizedServiceCode,
  );
  if (!shouldFilterCoordinates && !shouldHideSocialChanges) {
    return sections;
  }

  return sections
    .map((section) => ({
      ...section,
      fields: shouldFilterCoordinates
        ? section.fields.filter((field) => !isAddressCoordinateField(field))
        : section.fields,
      ...(shouldHideSocialChanges
        ? { socialChanges: [], hasSocialChanges: false }
        : {}),
    }))
    .filter(
      (section) =>
        section.fields.length > 0 ||
        section.languageChanges.length > 0 ||
        (section.languageSnapshots?.length ?? 0) > 0 ||
        (section.activityChanges?.length ?? 0) > 0 ||
        section.socialChanges.length > 0,
    );
}

function collectSchemaFields(schema: unknown): SchemaFieldDescriptor[] {
  const descriptors: SchemaFieldDescriptor[] = [];

  const visitProperties = (properties: unknown) => {
    if (!isRecord(properties)) return;

    Object.entries(properties).forEach(([propertyKey, value]) => {
      if (!isRecord(value)) return;

      const component = String(value["x-component"] ?? "");
      const componentProps = isRecord(value["x-component-props"])
        ? value["x-component-props"]
        : {};
      const fieldSource = isRecord(componentProps.fieldSource)
        ? componentProps.fieldSource
        : {};
      const labelEn = String(
        componentProps.titleEn ?? value.title ?? humanizeKey(propertyKey),
      );
      const labelAr = String(
        componentProps.titleAr ?? value.titleAr ?? labelEn,
      );

      if (component) {
        const aliases = Array.from(
          new Set(
            [
              propertyKey,
              value.name,
              value.uniqueValue,
              componentProps.uniqueValue,
            ]
              .filter((alias): alias is string => typeof alias === "string")
              .filter(Boolean),
          ),
        );
        descriptors.push({
          key: propertyKey,
          aliases,
          component,
          labelEn,
          labelAr,
          dataSource:
            typeof fieldSource.dataSource === "string"
              ? fieldSource.dataSource
              : undefined,
        });
      }

      visitProperties(value.properties);
    });
  };

  if (isRecord(schema)) {
    visitProperties(schema.properties);
  }
  return descriptors;
}

function flattenValues(
  value: UnknownRecord,
  excludedTopLevelKeys: Set<string>,
): Map<string, unknown> {
  const result = new Map<string, unknown>();

  const visit = (currentValue: unknown, path: string[]) => {
    if (path.length === 1 && excludedTopLevelKeys.has(normalizeKey(path[0]))) {
      return;
    }

    if (isRecord(currentValue)) {
      const entries = Object.entries(currentValue);
      if (entries.length === 0) {
        result.set(path.join(PATH_SEPARATOR), currentValue);
        return;
      }
      entries.forEach(([key, childValue]) => visit(childValue, [...path, key]));
      return;
    }

    result.set(path.join(PATH_SEPARATOR), currentValue);
  };

  Object.entries(value).forEach(([key, fieldValue]) => visit(fieldValue, [key]));
  return result;
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map(canonicalize);
  }
  if (!isRecord(value)) return value;

  const canonicalRecord = Object.keys(value)
    .sort()
    .reduce<UnknownRecord>((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  return Object.values(canonicalRecord).every((item) => item === null)
    ? null
    : canonicalRecord;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function findDescriptor(
  fieldPath: string,
  descriptors: SchemaFieldDescriptor[],
): SchemaFieldDescriptor | undefined {
  const fieldKey = fieldPath.split(PATH_SEPARATOR).at(-1) ?? fieldPath;
  const normalizedFieldKey = normalizeKey(fieldKey);
  return descriptors.find(
    (descriptor) =>
      descriptor.aliases.some(
        (alias) => normalizeKey(alias) === normalizedFieldKey,
      ),
  );
}

function findRootDescriptor(
  fieldPath: string,
  descriptors: SchemaFieldDescriptor[],
): SchemaFieldDescriptor | undefined {
  const rootKey = fieldPath.split(PATH_SEPARATOR)[0] ?? fieldPath;
  const normalizedRootKey = normalizeKey(rootKey);
  return descriptors.find((descriptor) =>
    descriptor.aliases.some(
      (alias) => normalizeKey(alias) === normalizedRootKey,
    ),
  );
}

function getCompositeFieldLabelI18nKey(
  fieldPath: string,
  descriptors: SchemaFieldDescriptor[],
): string | undefined {
  const pathParts = fieldPath.split(PATH_SEPARATOR);
  const fieldKey = normalizeKey(pathParts.at(-1) ?? fieldPath);
  const nestedPath = pathParts.slice(1, -1).map(normalizeKey);
  const rootComponent = findRootDescriptor(fieldPath, descriptors)?.component;

  if (
    rootComponent === "AddressPicker" ||
    nestedPath.includes("addresspicker")
  ) {
    return ADDRESS_PICKER_LABEL_I18N_KEYS[fieldKey];
  }
  if (rootComponent === "ProfileForm") {
    return PROFILE_FORM_LABEL_I18N_KEYS[fieldKey];
  }
  if (rootComponent === "IDSelector") {
    return ID_SELECTOR_LABEL_I18N_KEYS[fieldKey];
  }
  return undefined;
}

function getPersistedFieldLabelI18nKey(
  change: PersistedModifyChangeItem,
  component: string | undefined,
  descriptors: SchemaFieldDescriptor[],
): string | undefined {
  const pathParts = change.fieldKey.split(PATH_SEPARATOR);
  const fieldKey = normalizeKey(pathParts.at(-1) ?? change.fieldKey);
  const normalizedPath = pathParts.slice(0, -1).map(normalizeKey);
  const normalizedComponent = normalizeKey(component ?? "");
  const normalizedOwnerComponent = normalizeKey(change.ownerComponent ?? "");

  if (
    normalizedComponent === "profileform" &&
    normalizeKey(change.fieldKey) === "phonenumber"
  ) {
    return PROFILE_FORM_LABEL_I18N_KEYS.phonenumber;
  }

  if (
    normalizedComponent === "addresspicker" ||
    normalizedOwnerComponent === "addresspicker" ||
    normalizedPath.includes("addresspicker")
  ) {
    return ADDRESS_PICKER_LABEL_I18N_KEYS[fieldKey];
  }

  return getCompositeFieldLabelI18nKey(change.fieldKey, descriptors);
}

function findDescriptorValue(
  values: UnknownRecord,
  descriptor: SchemaFieldDescriptor,
): unknown {
  const normalizedAliases = new Set(descriptor.aliases.map(normalizeKey));
  const matchingKey = Object.keys(values).find((key) =>
    normalizedAliases.has(normalizeKey(key)),
  );
  return matchingKey ? values[matchingKey] : undefined;
}

function getLanguageRowKey(row: UnknownRecord, index: number, side: "before" | "after") {
  if (row.languageId !== undefined && row.languageId !== null && row.languageId !== "") {
    return `id:${String(row.languageId)}`;
  }

  if (typeof row.language === "string" && row.language.trim()) {
    return `language:${row.language.trim().toLowerCase()}`;
  }

  return `${side}:${index}`;
}

function toLanguageValue(row: UnknownRecord): LanguageChangeValue {
  return {
    language: typeof row.language === "string" ? row.language : "",
    name: typeof row.suggested_name === "string" ? row.suggested_name : "",
  };
}

function indexLanguageRows(
  value: unknown,
  side: "before" | "after",
): Map<string, LanguageChangeValue> {
  const rows = Array.isArray(value) ? value.filter(isRecord) : [];
  const occurrences = new Map<string, number>();
  const result = new Map<string, LanguageChangeValue>();

  rows.forEach((row, index) => {
    const baseKey = getLanguageRowKey(row, index, side);
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);
    const key = occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`;
    result.set(key, toLanguageValue(row));
  });
  return result;
}

function buildLanguageChanges(
  beforeValue: unknown,
  afterValue: unknown,
): AdminModifyLanguageChange[] {
  const beforeRows = indexLanguageRows(beforeValue, "before");
  const afterRows = indexLanguageRows(afterValue, "after");
  const changes: AdminModifyLanguageChange[] = [];

  beforeRows.forEach((before, key) => {
    const after = afterRows.get(key);
    if (!after) {
      changes.push({ key, changeType: "deleted", before, after: null });
      return;
    }
    if (!valuesEqual(before, after)) {
      changes.push({ key, changeType: "modified", before, after });
    }
  });

  afterRows.forEach((after, key) => {
    if (!beforeRows.has(key)) {
      changes.push({ key, changeType: "added", before: null, after });
    }
  });

  return changes;
}

function getSocialRowKey(row: UnknownRecord, index: number): string {
  const id = String(row.id ?? "").trim();
  return id ? `id:${id}` : `index:${index}`;
}

function withoutSocialOperation(row: UnknownRecord): UnknownRecord {
  const normalized = { ...row };
  delete normalized.operation;
  return normalized;
}

function buildSocialChanges(
  beforeValue: unknown,
  afterValue: unknown,
): AdminModifySocialChange[] {
  const beforeRows = Array.isArray(beforeValue)
    ? beforeValue.filter(isRecord)
    : [];
  const afterRows = Array.isArray(afterValue) ? afterValue.filter(isRecord) : [];
  const beforeByKey = new Map(
    beforeRows.map((row, index) => [getSocialRowKey(row, index), row]),
  );
  const afterKeys = new Set<string>();
  const changes: AdminModifySocialChange[] = [];

  afterRows.forEach((row, index) => {
    const key = getSocialRowKey(row, index);
    const original = beforeByKey.get(key);
    const operation = String(row.operation ?? "").toUpperCase();
    const current = withoutSocialOperation(row);
    afterKeys.add(key);

    if (operation === "DELETE") {
      if (original) {
        changes.push({ key, changeType: "deleted", before: original, after: null });
      }
      return;
    }

    if (operation === "ADD" || !original) {
      changes.push({ key, changeType: "added", before: null, after: current });
      return;
    }

    if (operation === "MODIFY" || !valuesEqual(original, current)) {
      changes.push({
        key,
        changeType: "modified",
        before: original,
        after: current,
      });
    }
  });

  beforeByKey.forEach((before, key) => {
    if (!afterKeys.has(key)) {
      changes.push({ key, changeType: "deleted", before, after: null });
    }
  });

  return changes;
}

function buildLanguageSnapshots(
  descriptors: SchemaFieldDescriptor[],
  beforeValues: UnknownRecord,
  afterValues: UnknownRecord,
): AdminModifyLanguageSnapshot[] {
  return descriptors.flatMap((descriptor) => {
    if (
      descriptor.component !== "DataList" ||
      descriptor.dataSource !== "languages_name_list"
    ) {
      return [];
    }

    const beforeValue = findDescriptorValue(beforeValues, descriptor);
    const afterValue = findDescriptorValue(afterValues, descriptor);
    if (
      !Array.isArray(beforeValue) ||
      !beforeValue.every(isRecord) ||
      !Array.isArray(afterValue) ||
      !afterValue.every(isRecord) ||
      buildLanguageChanges(beforeValue, afterValue).length === 0
    ) {
      return [];
    }

    const changes = buildLanguageChanges(beforeValue, afterValue);
    const changesByKey = new Map(
      changes.map((change) => [change.key, change]),
    );
    const beforeRows = Array.from(
      indexLanguageRows(beforeValue, "before").values(),
    );
    const afterRows = Array.from(
      indexLanguageRows(afterValue, "after"),
      ([key, row]) => {
        const changeType = changesByKey.get(key)?.changeType;
        return {
          ...row,
          ...(changeType ? { changeType } : {}),
        };
      },
    );
    const deletedRows = changes.flatMap((change) =>
      change.changeType === "deleted" && change.before
        ? [{ ...change.before, changeType: "deleted" as const }]
        : [],
    );

    return [
      {
        key: descriptor.key,
        beforeRows,
        afterRows,
        deletedRows,
      },
    ];
  });
}

function resolveStepTitle(
  step: UnknownRecord,
  index: number,
): { titleEn: string; titleAr: string } {
  const fallback = `Section ${index + 1}`;
  const titleEn =
    typeof step.stepNameEn === "string" && step.stepNameEn.trim()
      ? step.stepNameEn.trim()
      : fallback;
  const titleAr =
    typeof step.stepNameAr === "string" && step.stepNameAr.trim()
      ? step.stepNameAr.trim()
      : titleEn;
  return { titleEn, titleAr };
}

function parsePersistedValueOptions(
  value: unknown,
): AdminModifyChangeValueOption[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const options: AdminModifyChangeValueOption[] = [];
  for (const rawOption of value) {
    if (
      !isRecord(rawOption) ||
      (typeof rawOption.value !== "string" &&
        typeof rawOption.value !== "number") ||
      typeof rawOption.labelEn !== "string" ||
      typeof rawOption.labelAr !== "string"
    ) {
      return null;
    }
    options.push({
      value: rawOption.value,
      labelEn: rawOption.labelEn,
      labelAr: rawOption.labelAr,
    });
  }
  return options;
}

function parsePersistedValueSource(
  value: unknown,
): AdminModifyChangeValueSource | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "lookup") {
    return typeof value.source === "string" && value.source.trim()
      ? { type: "lookup", source: value.source }
      : null;
  }
  if (
    value.type === "nationality" ||
    value.type === "emirate" ||
    value.type === "region" ||
    value.type === "area"
  ) {
    return { type: value.type };
  }
  return null;
}

const PERSISTED_PHONE_NUMBER_FIELD_KEYS = new Set([
  "phonenumber",
  "phonenumbercountrycode",
  "phonenumberlocalnumber",
]);

function combinePersistedPhoneNumber(
  countryCode: unknown,
  localNumber: unknown,
): string {
  const countryCodeDigits = String(countryCode ?? "").replace(/\D/g, "");
  const localNumberDigits = String(localNumber ?? "").replace(/\D/g, "");

  if (countryCodeDigits && localNumberDigits) {
    return `+${countryCodeDigits}${localNumberDigits}`;
  }
  if (countryCodeDigits) return `+${countryCodeDigits}`;
  return localNumberDigits;
}

function getPersistedPhoneChangeType(
  beforeValue: unknown,
  afterValue: unknown,
): PersistedModifyChangeItem["changeType"] {
  const before = String(beforeValue ?? "").trim();
  const after = String(afterValue ?? "").trim();
  if (!before && after) return "ADDED";
  if (before && !after) return "DELETED";
  return "MODIFIED";
}

function normalizePersistedPhoneNumberChanges(
  changes: PersistedModifyChangeItem[],
): PersistedModifyChangeItem[] {
  const isPhoneField = (change: PersistedModifyChangeItem) =>
    normalizeKey(change.component ?? "") === "profileform" &&
    PERSISTED_PHONE_NUMBER_FIELD_KEYS.has(normalizeKey(change.fieldKey));
  const phoneChanges = changes.filter(isPhoneField);
  const hasSplitFields = phoneChanges.some(
    (change) => normalizeKey(change.fieldKey) !== "phonenumber",
  );
  if (!hasSplitFields) return changes;

  const fullNumberChange = phoneChanges.find(
    (change) => normalizeKey(change.fieldKey) === "phonenumber",
  );
  const countryCodeChange = phoneChanges.find(
    (change) => normalizeKey(change.fieldKey) === "phonenumbercountrycode",
  );
  const localNumberChange = phoneChanges.find(
    (change) => normalizeKey(change.fieldKey) === "phonenumberlocalnumber",
  );
  const firstPhoneIndex = changes.findIndex(isPhoneField);
  const baseChange =
    fullNumberChange ?? countryCodeChange ?? localNumberChange;
  if (!baseChange || firstPhoneIndex < 0) return changes;

  const beforeValue = fullNumberChange
    ? fullNumberChange.beforeValue
    : combinePersistedPhoneNumber(
        countryCodeChange?.beforeValue,
        localNumberChange?.beforeValue,
      );
  const afterValue = fullNumberChange
    ? fullNumberChange.afterValue
    : combinePersistedPhoneNumber(
        countryCodeChange?.afterValue,
        localNumberChange?.afterValue,
      );
  const normalizedChange: PersistedModifyChangeItem = {
    ...baseChange,
    kind: "field",
    fieldKey: "phoneNumber",
    labelEn: "Phone Number",
    labelAr: "رقم الهاتف",
    beforeValue,
    afterValue,
    changeType: getPersistedPhoneChangeType(beforeValue, afterValue),
  };

  return changes.flatMap((change, index) => {
    if (!isPhoneField(change)) return [change];
    return index === firstPhoneIndex ? [normalizedChange] : [];
  });
}

function parsePersistedModifyChangeSet(
  value: unknown,
): PersistedModifyChangeSet | null {
  if (
    !isRecord(value) ||
    typeof value.sectionNameEn !== "string" ||
    typeof value.sectionNameAr !== "string" ||
    !Array.isArray(value.changes)
  ) {
    return null;
  }

  const changes: PersistedModifyChangeItem[] = [];
  for (const rawChange of value.changes) {
    if (
      !isRecord(rawChange) ||
      (rawChange.kind !== "field" && rawChange.kind !== "list") ||
      (rawChange.changeType !== "ADDED" &&
        rawChange.changeType !== "MODIFIED" &&
        rawChange.changeType !== "DELETED") ||
      typeof rawChange.fieldKey !== "string" ||
      !rawChange.fieldKey.trim() ||
      typeof rawChange.labelEn !== "string" ||
      typeof rawChange.labelAr !== "string" ||
      !Object.prototype.hasOwnProperty.call(rawChange, "beforeValue") ||
      !Object.prototype.hasOwnProperty.call(rawChange, "afterValue") ||
      (rawChange.component !== undefined &&
        typeof rawChange.component !== "string") ||
      (rawChange.ownerComponent !== undefined &&
        typeof rawChange.ownerComponent !== "string")
    ) {
      return null;
    }

    const valueOptions = parsePersistedValueOptions(rawChange.valueOptions);
    const valueSource = parsePersistedValueSource(rawChange.valueSource);
    if (valueOptions === null || valueSource === null) return null;

    changes.push({
      kind: rawChange.kind,
      changeType: rawChange.changeType,
      fieldKey: rawChange.fieldKey,
      labelEn: rawChange.labelEn,
      labelAr: rawChange.labelAr,
      beforeValue: rawChange.beforeValue,
      afterValue: rawChange.afterValue,
      component: rawChange.component,
      ownerComponent: rawChange.ownerComponent,
      ...(valueOptions ? { valueOptions } : {}),
      ...(valueSource ? { valueSource } : {}),
    });
  }

  return {
    sectionNameEn: value.sectionNameEn,
    sectionNameAr: value.sectionNameAr,
    changes: normalizePersistedPhoneNumberChanges(changes),
  };
}

function buildPersistedModifyChangeSection(
  changeSet: PersistedModifyChangeSet,
  step: UnknownRecord,
  index: number,
  parsed: ParsedStep,
): AdminModifyChangeSection | null {
  const descriptors = collectSchemaFields(parsed.schema);
  const languageSnapshots =
    isRecord(parsed.modifyOriginalFormValues) && isRecord(parsed.formValues)
      ? buildLanguageSnapshots(
          descriptors,
          parsed.modifyOriginalFormValues,
          parsed.formValues,
        )
      : [];
  const fieldKeyCounts = changeSet.changes.reduce<Map<string, number>>(
    (counts, change) => {
      counts.set(change.fieldKey, (counts.get(change.fieldKey) ?? 0) + 1);
      return counts;
    },
    new Map(),
  );
  const fields: AdminModifyChangeField[] = [];
  const languageChanges: AdminModifyLanguageChange[] = [];
  const socialChanges: AdminModifySocialChange[] = [];
  const activityChanges: AdminModifyActivityChange[] = [];

  changeSet.changes.forEach((change, changeIndex) => {
    const descriptor =
      findDescriptor(change.fieldKey, descriptors) ??
      findRootDescriptor(change.fieldKey, descriptors);
    const component = change.component || descriptor?.component;

    if (component === "SocialMediaAccount") {
      socialChanges.push({
        key: `${change.fieldKey}:${changeIndex}`,
        changeType: PERSISTED_LANGUAGE_CHANGE_TYPES[change.changeType],
        before: isRecord(change.beforeValue) ? change.beforeValue : null,
        after: isRecord(change.afterValue) ? change.afterValue : null,
      });
      return;
    }

    if (change.kind === "list" && component === "SelectTable") {
      activityChanges.push({
        key: `${change.fieldKey}:${changeIndex}`,
        changeType: PERSISTED_LANGUAGE_CHANGE_TYPES[change.changeType],
        before: change.beforeValue,
        after: change.afterValue,
      });
      return;
    }

    if (
      descriptor?.component === "DataList" &&
      descriptor.dataSource === "languages_name_list"
    ) {
      languageChanges.push({
        key: `${change.fieldKey}:${changeIndex}`,
        changeType: PERSISTED_LANGUAGE_CHANGE_TYPES[change.changeType],
        before: isRecord(change.beforeValue)
          ? toLanguageValue(change.beforeValue)
          : null,
        after: isRecord(change.afterValue)
          ? toLanguageValue(change.afterValue)
          : null,
      });
      return;
    }

    const hasDuplicateFieldKey = (fieldKeyCounts.get(change.fieldKey) ?? 0) > 1;
    const labelI18nKey = getPersistedFieldLabelI18nKey(
      change,
      component,
      descriptors,
    );
    fields.push({
      key: hasDuplicateFieldKey
        ? `${change.fieldKey}:${changeIndex}`
        : change.fieldKey,
      labelEn: change.labelEn,
      labelAr: change.labelAr,
      ...(labelI18nKey ? { labelI18nKey } : {}),
      before: change.beforeValue,
      after: change.afterValue,
      ...(component ? { component } : {}),
      ...(change.ownerComponent
        ? { ownerComponent: change.ownerComponent }
        : {}),
      ...(change.valueOptions
        ? { valueOptions: change.valueOptions }
        : {}),
      ...(change.valueSource ? { valueSource: change.valueSource } : {}),
    });
  });

  if (changeSet.changes.length === 0 && languageSnapshots.length === 0) {
    return null;
  }

  const fallbackTitles = resolveStepTitle(step, index);
  const titleEn = changeSet.sectionNameEn.trim() || fallbackTitles.titleEn;
  const titleAr = changeSet.sectionNameAr.trim() || fallbackTitles.titleAr;
  return {
    key: `${index}:${titleEn}`,
    titleEn,
    titleAr,
    fields,
    languageChanges,
    ...(languageSnapshots.length > 0 ? { languageSnapshots } : {}),
    socialChanges,
    ...(activityChanges.length > 0 ? { activityChanges } : {}),
    hasSocialChanges: socialChanges.length > 0,
  };
}

// Mirrors the customer-side normalizeProfileFormBranches
// (umc-customer-portal ProfileForm/profileFormRules.ts): before diffing a step
// that has no persisted changeSet, drop the inactive trade-license branch so a
// stale opposite-branch value carried in the original snapshot (e.g. a legacy
// Reserve Trade Number on a Yes/Trade-License profile) is not surfaced as a
// phantom "changed" row that the customer summary correctly suppresses.
function normalizeProfileTradeLicenseBranches(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProfileTradeLicenseBranches(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      normalizeProfileTradeLicenseBranches(nested),
    ]),
  );

  if (normalized.hasTradeLicense === true) {
    delete normalized.reserveTradeNumber;
    delete normalized.reserveTradeName;
  } else if (normalized.hasTradeLicense === false) {
    delete normalized.commercialLicenseNumber;
    delete normalized.licenseExpiryDate;
    delete normalized.commercialLicense;
  }

  return normalized;
}

export function buildAdminModifyChangeSummary(
  steps: unknown[],
): AdminModifyChangeSection[] {
  if (!Array.isArray(steps)) return [];

  const hasPersistedChangeSet = steps.some((rawStep) => {
    if (!isRecord(rawStep)) return false;
    const parsed = parseStepFormData(rawStep);
    return Boolean(
      parsed && Object.prototype.hasOwnProperty.call(parsed, "modifyChangeSet"),
    );
  });

  return steps.flatMap((rawStep, index) => {
    if (!isRecord(rawStep)) return [];
    const parsed = parseStepFormData(rawStep);
    if (!parsed) return [];

    if (Object.prototype.hasOwnProperty.call(parsed, "modifyChangeSet")) {
      const persistedChangeSet = parsePersistedModifyChangeSet(
        parsed.modifyChangeSet,
      );
      if (persistedChangeSet) {
        const section = buildPersistedModifyChangeSection(
          persistedChangeSet,
          rawStep,
          index,
          parsed,
        );
        return section ? [section] : [];
      }
    }

    if (hasPersistedChangeSet) return [];

    if (
      !Object.prototype.hasOwnProperty.call(parsed, "modifyOriginalFormValues") ||
      !isRecord(parsed.modifyOriginalFormValues)
    ) {
      return [];
    }

    const beforeValues = normalizeProfileTradeLicenseBranches(
      parsed.modifyOriginalFormValues,
    ) as Record<string, unknown>;
    const afterValues = isRecord(parsed.formValues)
      ? (normalizeProfileTradeLicenseBranches(parsed.formValues) as Record<
          string,
          unknown
        >)
      : {};
    const descriptors = collectSchemaFields(parsed.schema);
    const socialDescriptors = descriptors.filter(
      (descriptor) => descriptor.component === "SocialMediaAccount",
    );
    const socialKeys = new Set(
      socialDescriptors.flatMap((descriptor) =>
        descriptor.aliases.map(normalizeKey),
      ),
    );
    const languageDescriptors = descriptors.filter(
      (descriptor) =>
        descriptor.component === "DataList" &&
        descriptor.dataSource === "languages_name_list",
    );
    const languageKeys = new Set(
      languageDescriptors.flatMap((descriptor) =>
        descriptor.aliases.map(normalizeKey),
      ),
    );
    const excludedKeys = new Set([...socialKeys, ...languageKeys]);
    const beforeFields = flattenValues(beforeValues, excludedKeys);
    const afterFields = flattenValues(afterValues, excludedKeys);
    const fieldPaths = Array.from(
      new Set([...beforeFields.keys(), ...afterFields.keys()]),
    );
    const fields = fieldPaths.flatMap<AdminModifyChangeField>((fieldPath) => {
      const before = beforeFields.get(fieldPath);
      const after = afterFields.get(fieldPath);
      if (valuesEqual(before, after)) return [];

      const descriptor = findDescriptor(fieldPath, descriptors);
      const fieldKey = fieldPath.split(PATH_SEPARATOR).at(-1) ?? fieldPath;
      const fallbackLabel = humanizeKey(fieldKey);
      return [
        {
          key: fieldPath,
          labelEn: descriptor?.labelEn || fallbackLabel,
          labelAr: descriptor?.labelAr || fallbackLabel,
          labelI18nKey: descriptor
            ? undefined
            : getCompositeFieldLabelI18nKey(fieldPath, descriptors),
          before,
          after,
        },
      ];
    });

    const languageChanges = languageDescriptors.flatMap((descriptor) => {
      return buildLanguageChanges(
        findDescriptorValue(beforeValues, descriptor),
        findDescriptorValue(afterValues, descriptor),
      );
    });
    const languageSnapshots = buildLanguageSnapshots(
      descriptors,
      beforeValues,
      afterValues,
    );
    const socialChanges = socialDescriptors.flatMap((descriptor) =>
      buildSocialChanges(
        findDescriptorValue(beforeValues, descriptor),
        findDescriptorValue(afterValues, descriptor),
      ),
    );
    const hasSocialChanges = socialChanges.length > 0;

    if (
      fields.length === 0 &&
      languageChanges.length === 0 &&
      !hasSocialChanges
    ) {
      return [];
    }
    const titles = resolveStepTitle(rawStep, index);
    return [
      {
        key: `${index}:${titles.titleEn}`,
        ...titles,
        fields,
        languageChanges,
        ...(languageSnapshots.length > 0 ? { languageSnapshots } : {}),
        socialChanges,
        hasSocialChanges,
      },
    ];
  });
}

export function formatChangeSummaryValue(
  value: unknown,
  options?: { dateOnly?: boolean },
): string {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) {
    return value.map((item) => formatChangeSummaryValue(item)).join(", ") || "-";
  }
  if (isRecord(value)) {
    return (
      Object.values(value)
        .map((item) => formatChangeSummaryValue(item))
        .join(", ") || "-"
    );
  }
  if (typeof value === "string" && value.includes("/")) {
    const fileName = value.split("/").at(-1);
    if (fileName?.includes(".")) return fileName;
  }
  if (
    options?.dateOnly &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
  ) {
    return value.slice(0, 10);
  }
  return String(value);
}
