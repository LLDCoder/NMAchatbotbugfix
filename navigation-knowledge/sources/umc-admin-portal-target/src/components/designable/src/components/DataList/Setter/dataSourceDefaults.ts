import { languageOptions } from "../../LanguageSelectMulti/language";

/**
 * Pure data-source configuration for the DataList setter.
 *
 * Kept free of React/antd imports so it can be unit tested directly
 * (see scripts/dataListSourceDefaults.test.ts), mirroring dataListRules.ts.
 * These defaults are authored into the published schema, so the applicant
 * portal depends on their exact fieldKey/displayType values.
 */

export interface DropdownOption {
  label: string;
  value: number | string;
}

export interface DataListFieldConfig {
  fieldName: string;
  /**
   * Optional fixed record key (camelCase). When present it overrides the
   * fieldName-derived key so downstream read-only rendering resolves the same
   * key the applicant saved (e.g. `fullName`, `emiratesIdNumber`). Used by the
   * List of Trainees variant to stay aligned with customer-portal storage.
   */
  fieldKey?: string;
  required: boolean;
  placeholderText: string;
  listVisible: boolean;
  formVisible: boolean;
  displayType: "Text Input" | "Dropdown" | "Emirates ID" | "Email" | "Mobile";
  options?: DropdownOption[];
  fieldType: 'string' | 'number';
}

export interface DataListSourceConfig {
  dataSource: string;
  fields: DataListFieldConfig[];
}

export interface DataSourceOption {
  label: string;
  value: string;
}

// equipmentId for rule strategy validation
const EQUIPMENT_OPTIONS: DropdownOption[] = [
  { label: "Camera", value: "1" },
  { label: "Tripod", value: "2" },
  { label: "Reflector", value: "3" },
  { label: "Light Meter", value: "4" },
  { label: "Monopod", value: "5" },
  { label: "Photographic filter", value: "6" },
  { label: "Loupe", value: "7" },
  { label: "Photographic film", value: "8" },
  { label: "Extension tube", value: "9" },
  { label: "Snoot", value: "10" },
  { label: "Batteries", value: "11" },
  { label: "Other", value: "12" },
];

export const DATA_SOURCE_OPTIONS: DataSourceOption[] = [
  { label: "Equipment List", value: "equipment_list" },
  { label: "Material List", value: "material_list" },
  { label: "Languages & Name List", value: "languages_name_list" },
  { label: "List of Trainees", value: "list_of_trainees" },
];

export const getDefaultFieldsForDataSource = (
  dataSource: string
): DataListFieldConfig[] => {
  const mapping: Record<string, DataListFieldConfig[]> = {
    equipment_list: [
      {
        fieldName: "Equipment",
        fieldType: 'string',
        required: true,
        placeholderText: "Select Equipment",
        listVisible: true,
        formVisible: true,
        displayType: "Dropdown",
        options: EQUIPMENT_OPTIONS,
      },
      {
        fieldName: "Number",
        fieldType: 'number',
        required: true,
        placeholderText: "Enter Number",
        listVisible: true,
        formVisible: true,
        displayType: "Text Input",
      },
    ],
    material_list: [
      {
        fieldName: "Title",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter Title",
        listVisible: true,
        formVisible: true,
        displayType: "Text Input",
      },
      {
        fieldName: "Language",
        fieldType: 'string',
        required: true,
        placeholderText: "Select Language",
        listVisible: true,
        formVisible: true,
        displayType: "Dropdown",
        options: languageOptions,
      },
      {
        fieldName: "Number Of Title",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter Number Of Title",
        listVisible: true,
        formVisible: true,
        displayType: "Text Input",
      },
    ],
    languages_name_list: [
      {
        fieldName: "Language",
        fieldType: 'string',
        required: true,
        placeholderText: "Select Language",
        listVisible: true,
        formVisible: true,
        displayType: "Dropdown",
        options: languageOptions,
      },
      {
        fieldName: "Suggested Name",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter Suggested Name",
        listVisible: true,
        formVisible: true,
        displayType: "Text Input",
      },
    ],
    list_of_trainees: [
      {
        fieldName: "Full Name",
        fieldKey: "fullName",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter full name",
        listVisible: true,
        formVisible: true,
        displayType: "Text Input",
      },
      {
        fieldName: "Emirates ID Number",
        fieldKey: "emiratesIdNumber",
        fieldType: 'string',
        required: true,
        placeholderText: "784-XXXX-XXXXXXX-X",
        listVisible: true,
        formVisible: true,
        // Keep these display types identical to the customer-portal setter:
        // the applicant-side DataList keys its masked Emirates ID input,
        // mobile/email validation and read-only formatting off displayType,
        // so a trainee schema authored here must carry the same values.
        displayType: "Emirates ID",
      },
      {
        fieldName: "Mobile Number",
        fieldKey: "mobileNumber",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter mobile number",
        listVisible: true,
        formVisible: true,
        displayType: "Mobile",
      },
      {
        fieldName: "Email",
        fieldKey: "email",
        fieldType: 'string',
        required: true,
        placeholderText: "Enter email address",
        listVisible: true,
        formVisible: true,
        displayType: "Email",
      },
    ],
  };

  return mapping[dataSource] || [];
};
