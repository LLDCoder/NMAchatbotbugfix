# MobileNumberInput

A portable mobile number input component package that provides dedicated Form and standalone components. Both share local dialing code data, local country icons, a 30-character input limit, an AntD Form Rule based on `libphonenumber-js`, and standalone validation utilities.

## Dependencies

- React 17+
- Ant Design 4.22+
- `@ant-design/icons`
- `libphonenumber-js`

## Recommended Usage

The package exposes two public components:

- `FormMobileNumberInput`: used as a controlled component inside an outer `Form.Item`, integrating with Ant Design Form through `value`, `onChange`, and `fieldNames`.
- `StandaloneMobileNumberInput`: works independently through `countryCode`, `phoneNumber`, and their corresponding change callbacks, and also supports uncontrolled state.

Both public components share the same internal input control, so dialing code selection, mobile number input, character limits, and change notifications use one implementation.

`defaultCountryCode` defaults to an empty string. Creation pages that require `+971` should set it through Form `initialValues`, page-level initial state, or an explicit `defaultCountryCode`; the shared component does not provide a business-specific default dialing code.

`FormMobileNumberInput` does not register internal fields. The outer `Form.Item` owns the field name, validation rules, and error display, and injects `value` and `onChange` into the component.

## AntD Form Split-Field Mode

Split-field mode is the default. The outer Form field stores an object, and `fieldNames` specifies the country dialing code and local number properties within that object.

```tsx
import { Form } from "antd";
import {
  createMobileNumberFormRule,
  FormMobileNumberInput,
} from "@/components/common/MobileNumberInput";

interface FormValues {
  mobileNumber: {
    mobileCountryCode: string;
    mobileLocalNumber: string;
  };
  email: string;
}

const phoneFields = {
  countryCode: "mobileCountryCode",
  phoneNumber: "mobileLocalNumber",
} as const;
const [form] = Form.useForm<FormValues>();

<Form<FormValues>
  form={form}
  initialValues={{
    mobileNumber: {
      mobileCountryCode: "+971",
      mobileLocalNumber: "",
    },
    email: "user@example.com",
  }}
  onFinish={submit}
>
  <Form.Item
    name="mobileNumber"
    rules={[
      createMobileNumberFormRule({
        fieldNames: phoneFields,
      }),
    ]}
  >
    <FormMobileNumberInput
      fieldNames={phoneFields}
      placeholder="Enter mobile number"
      searchPlaceholder="Search country or code"
      emptyText="No results"
    />
  </Form.Item>
</Form>;
```

`createMobileNumberFormRule()` returns a standard AntD Rule and uses the same `fieldNames` mapping to read and validate the combined object value. Both `form.validateFields()` and Form submission run this rule.

For business APIs with three phone fields, the page maintains the complete number, country dialing code, and local number together. If a legacy API returns only the complete number, initialize the component with `countryCode: ""` and assign the complete number to `phoneNumber`. The user must manually select a country dialing code and pass combined validation before the page can submit all three fields. Optional fields pass validation when the local number is empty; submission conversion clears the complete number, country dialing code, and local number together.

The Form value retains its object structure and is converted into three API fields before business submission:

```ts
{
  mobileNumber: {
    mobileCountryCode: "+971",
    mobileLocalNumber: "501234567",
  },
  email: "user@example.com",
}
```

## AntD Form Single-Field Mode

In single-field mode, the outer Form field stores an international number string that includes the country dialing code.

```tsx
<Form
  initialValues={{
    mobileNumber: "+971501234567",
  }}
  onFinish={(values) => submit(values)}
>
  <Form.Item
    name="mobileNumber"
    rules={[createMobileNumberFormRule()]}
  >
    <FormMobileNumberInput singlePhoneField />
  </Form.Item>
</Form>;
```

When the local number is empty, single-field mode stores an intermediate dialing-code-only value such as `+971`, preserving the user's current dialing code selection. Complete validity is determined during submission validation.

## Standalone Controlled Split-Field Mode

```tsx
import { StandaloneMobileNumberInput } from "@/components/common/MobileNumberInput";

const [countryCode, setCountryCode] = useState("+971");
const [phoneNumber, setPhoneNumber] = useState("");

<StandaloneMobileNumberInput
  countryCode={countryCode}
  phoneNumber={phoneNumber}
  onCountryCodeChange={setCountryCode}
  onPhoneNumberChange={setPhoneNumber}
/>;
```

## Standalone Controlled Single-Field Mode

In single-field mode, only the complete `phoneNumber` string needs to be controlled. The dialing code is parsed from that string.

```tsx
const [phoneNumber, setPhoneNumber] = useState("+971501234567");

<StandaloneMobileNumberInput
  singlePhoneField
  phoneNumber={phoneNumber}
  onPhoneNumberChange={setPhoneNumber}
/>;
```

## Standalone Uncontrolled Split-Field Mode

When `countryCode` and `phoneNumber` are omitted, the component uses internal state. `defaultCountryCode` and `defaultPhoneNumber` set only the initial values.

```tsx
<StandaloneMobileNumberInput
  defaultCountryCode="+971"
  defaultPhoneNumber=""
  onCountryCodeChange={(countryCode) => console.log(countryCode)}
  onPhoneNumberChange={(phoneNumber) => console.log(phoneNumber)}
/>;
```

## Standalone Uncontrolled Single-Field Mode

```tsx
<StandaloneMobileNumberInput
  singlePhoneField
  defaultPhoneNumber="+971501234567"
  onPhoneNumberChange={(phoneNumber) => console.log(phoneNumber)}
/>;
```

## Change Callbacks

`StandaloneMobileNumberInput` provides the following field change callbacks:

- `onCountryCodeChange`: triggered when a country dialing code is selected.
- `onPhoneNumberChange`: triggered when the mobile number is entered; also triggered when the dialing code changes in single-field mode.
- In split-field mode, `onPhoneNumberChange` returns the local mobile number.
- In single-field mode, `onPhoneNumberChange` returns the complete international number or the intermediate dialing-code-only value.

## Form Rule Validation

In object-value split-field mode, pass the same `fieldNames` mapping to both the component and the validation rule. In single-field mode, call the no-argument version directly:

```tsx
<Form.Item
  name="mobileNumber"
  rules={[
    createMobileNumberFormRule({
      fieldNames: phoneFields,
      messageOverrides: {
        TOO_SHORT: "The mobile number needs more digits",
      },
    }),
  ]}
>
  <FormMobileNumberInput fieldNames={phoneFields} />
</Form.Item>;
```

The outer `Form.Item` may continue to configure other standard AntD Rules, `validateFirst`, and other Form props.

`createMobileNumberFormRule()` options:

| Option | Type | Description |
| --- | --- | --- |
| `fieldNames` | `{ countryCode, phoneNumber }` | Property-name mapping for object-value split-field mode |
| `countryCodeField` | `NamePath` | Country dialing code field path used for compatibility with flattened-field validation |
| `messageOverrides` | `Partial<MobileNumberValidationMessages>` | Overrides default messages by error code |
| `required` | `boolean` | Controls whether an empty number passes validation |
| `shouldValidate` | `(value, form) => boolean` | Determines whether validation runs based on business state |

## Standalone Validation Utilities

```ts
import {
  isValidMobileNumber,
  isValidSingleMobileNumber,
  validateMobileNumber,
} from "@/components/common/MobileNumberInput";

isValidMobileNumber("+971", "501234567");
isValidSingleMobileNumber("+971501234567");

validateMobileNumber({
  countryCode: "+971",
  phoneNumber: "501234567",
});
validateMobileNumber(
  "+971501234567",
  {
    TOO_SHORT: "The mobile number needs more digits",
    INVALID_FORMAT: "The mobile number format is unsupported",
  },
);
```

`validateMobileNumber` shares the same underlying validation logic as the Form Rule. It supports both split values and complete number strings, and returns `{ isValid, errorCode, message }`. On success, `errorCode` is `null` and `message` is an empty string; on failure, it returns a specific error code and the corresponding message.

| `errorCode` | Meaning |
| --- | --- |
| `REQUIRED` | The mobile number is empty; a single-field value containing only a dialing code also falls into this category |
| `INVALID_COUNTRY` | The country dialing code is invalid, or a single-field number lacks a valid country dialing code |
| `NOT_A_NUMBER` | The input cannot be recognized as a telephone number |
| `TOO_SHORT` | The number is shorter than the length permitted by that country's numbering rules |
| `TOO_LONG` | The number is longer than the length permitted by that country's numbering rules |
| `INVALID_LENGTH` | The length is within the minimum and maximum range but is not one of the specific lengths permitted for that country |
| `INVALID_FORMAT` | The length is valid, but the number range or format does not comply with that country's rules |

The second argument supports overriding messages by error code. Error codes without an override use `common.mobileNumberValidation.*` for the current language, falling back to the default English messages in `DEFAULT_MOBILE_NUMBER_VALIDATION_MESSAGES` when language resources are missing.

When the user edits the local number, spaces, hyphens, parentheses, and other non-digit characters are removed immediately, and at most 30 digits are retained. Existing controlled values preserve their original characters on initial display; after the user starts editing, the value switches to digits-only mode. The current local number is preserved when the country dialing code changes.

`FormMobileNumberInput` participates in the AntD validation lifecycle through its outer `Form.Item`. Callers of `StandaloneMobileNumberInput` invoke the standalone validation utilities on submission or at another business-defined point.

## Dialing Code Data

```ts
import {
  COUNTRY_DIAL_CODE_OPTIONS,
  COUNTRY_DIAL_CODE_OPTIONS_MAP,
  findCountryDialCodeOption,
} from "@/components/common/MobileNumberInput";

COUNTRY_DIAL_CODE_OPTIONS;
COUNTRY_DIAL_CODE_OPTIONS_MAP.get("+971");
findCountryDialCodeOption("+971");
```

Each option contains an English `label` and an Arabic `labelAr`. The dialing code selector uses `react-i18next` to observe the current language. It displays `labelAr` when the language code starts with `ar`, and `label` for other languages. Search matches both languages, country codes, and country dialing codes.

`COUNTRY_DIAL_CODE_OPTIONS_MAP` is created once when the module initializes. When multiple countries share the same dialing code, the Map retains the first country option in the dialing code list.

## Common Props

| Prop | Component | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `singlePhoneField` | Both | `boolean` | `false` | Selects split-field or single-field mode |
| `fieldNames` | Form | `{ countryCode, phoneNumber }` | `{ countryCode, phoneNumber }` | Property-name mapping for object-value split-field mode |
| `value` | Form | `object \| string` | - | Controlled value injected by the outer `Form.Item` |
| `onChange` | Form | `(value) => void` | - | Change callback injected by the outer `Form.Item` |
| `countryCode` | Standalone | `string` | - | Controlled dialing code in split-field mode |
| `phoneNumber` | Standalone | `string` | - | Controlled mobile number; its format depends on the mode |
| `defaultCountryCode` | Both | `string` | `""` | Initial uncontrolled dialing code; business defaults are supplied explicitly by the consuming page |
| `defaultPhoneNumber` | Standalone | `string` | - | Initial uncontrolled mobile number; its format depends on the mode |
| `onCountryCodeChange` | Standalone | `(value: string) => void` | - | Dialing code change notification |
| `onPhoneNumberChange` | Standalone | `(value: string) => void` | - | Mobile number change notification |
| `placeholder` | Both | `string` | - | Mobile number input placeholder |
| `searchPlaceholder` | Both | `string` | `Search country or code` | Country dialing code search placeholder |
| `emptyText` | Both | `string` | `No results` | Text shown when dialing code search has no results |
| `hasError` | Both | `boolean` | `false` | Controls the component's error-state styling |
