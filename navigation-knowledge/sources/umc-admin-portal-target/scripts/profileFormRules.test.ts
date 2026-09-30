import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as profileFormRules from "../src/components/designable/src/components/ProfileForm/profileFormRules.ts";
import {
  normalizeAdminReviewFormValues,
} from "../src/components/common/FormliyView/reviewFormValues.ts";

test("uses a fixed commercial-license designer preview", () => {
  assert.deepEqual(profileFormRules.getProfileFormDesignerPreviewValues(), {
    hasTradeLicense: true,
    commercialLicenseNumber: "CN-123456",
    licenseExpiryDate: "2026-12-31",
  });
});

test("resolves the submitted ProfileForm value without replacing it", () => {
  const submittedValue = {
    establishmentNameEnglish: "Submitted Establishment",
    workEmail: "submitted@example.com",
  };
  const resolveProfileFormReviewValue = (
    profileFormRules as typeof profileFormRules & {
      resolveProfileFormReviewValue: (
        fieldValue: unknown,
        formValues: Record<string, unknown>,
      ) => Record<string, unknown>;
    }
  ).resolveProfileFormReviewValue;

  assert.equal(
    resolveProfileFormReviewValue(undefined, {
      ProfileForm: submittedValue,
    }),
    submittedValue,
  );
});

test("maps submitted ProfileForm values to the actual schema property name", () => {
  const submitted = { workEmail: "submitted@example.com" };
  assert.deepEqual(
    normalizeAdminReviewFormValues({
      schema: {
        properties: {
          "Profile Form": { "x-component": "ProfileForm" },
        },
      },
      formValues: { ProfileForm: submitted },
    }),
    { "Profile Form": submitted, ProfileForm: submitted },
  );
});

test("hides original 903 activities from the ordinary read-only form", () => {
  assert.deepEqual(
    normalizeAdminReviewFormValues({
      serviceCode: 903,
      schema: {
        properties: {
          SelectTable: { "x-component": "SelectTable" },
        },
      },
      modifyOriginalFormValues: {
        SelectTable: {
          selectedKey: ["1"],
          tableData: [{ Activity: "Original" }],
        },
      },
      formValues: {
        SelectTable: {
          selectedKey: ["1", "2"],
          tableData: [
            { Activity: "Original" },
            { Activity: "Added" },
          ],
        },
      },
    }),
    {
      SelectTable: {
        selectedKey: ["2"],
        tableData: [{ Activity: "Added" }],
      },
    },
  );
});

test("narrows submitted Profile Form documents to DocumentViewer values", () => {
  const normalizeProfileFormReviewDocumentValue = (
    profileFormRules as typeof profileFormRules & {
      normalizeProfileFormReviewDocumentValue: (
        value: unknown,
      ) => string | string[] | undefined;
    }
  ).normalizeProfileFormReviewDocumentValue;

  assert.equal(
    normalizeProfileFormReviewDocumentValue("common/license.pdf"),
    "common/license.pdf",
  );
  assert.deepEqual(
    normalizeProfileFormReviewDocumentValue([
      "common/first.pdf",
      null,
      "",
      "common/second.pdf",
    ]),
    ["common/first.pdf", "common/second.pdf"],
  );
  assert.equal(
    normalizeProfileFormReviewDocumentValue({ path: "unsafe" }),
    undefined,
  );
});

test("keeps the Admin Profile Form preview read-only", () => {
  const source = readFileSync(
    "src/components/designable/src/components/ProfileForm/ProfileFormField.tsx",
    "utf8",
  );

  assert.doesNotMatch(source, /useField|field\.setValue|applyTradeLicenseMode/);
  assert.doesNotMatch(source, /\bonChange=/);
  assert.match(source, /<Radio\.Group[\s\S]*?value=\{true\}/);
  assert.match(source, /<Radio value=\{false\} disabled>/);
  assert.equal(source.match(/<AntdCard/g)?.length, 3);
  assert.match(source, /name="addressPicker"/);
  assert.match(source, /component=\{\[AddressPicker, \{ disabled: true \}\]\}/);

  const addressPickerSource = readFileSync(
    "src/components/designable/src/components/AddressPicker/preview.tsx",
    "utf8",
  );
  assert.equal(
    addressPickerSource.match(/disabled=\{props\.disabled\}/g)?.length,
    4,
  );
});

test("registers the read-only Profile Form in Admin FormliyView", () => {
  const source = readFileSync(
    "src/components/common/FormliyView/index.tsx",
    "utf8",
  );

  assert.match(
    source,
    /import \{ ProfileFormReviewField \} from ["']@\/components\/designable\/src\/components\/ProfileForm\/ProfileFormReviewField["']/,
  );
  assert.match(
    source,
    /ProfileForm:\s*resolvedPattern !== "editable"\s*\?\s*ProfileFormReviewField\s*:\s*\(props:/,
  );
});

test("hides the outer Formily label for ProfileForm in Admin review pages", () => {
  const source = readFileSync(
    "src/components/common/FormliyView/index.tsx",
    "utf8",
  );

  assert.match(source, /function hideProfileFormOuterLabels/);
  assert.match(source, /next\["x-component"\] === "ProfileForm"/);
  assert.match(source, /label: false/);
  assert.match(source, /delete next\.title/);
  assert.match(
    source,
    /schema:\s*hideProfileFormOuterLabels\(\s*normalizeTrainingVideoCardTitles\(parsed\.schema\)/,
  );
});

test("renders submitted Profile Form values without editable controls or profile requests", () => {
  const source = readFileSync(
    "src/components/designable/src/components/ProfileForm/ProfileFormReviewField.tsx",
    "utf8",
  );

  assert.match(source, /useField/);
  assert.match(source, /resolveProfileFormReviewValue/);
  assert.doesNotMatch(source, /<ProfileFormField/);
  assert.doesNotMatch(source, /<(Input|Select|DatePicker|Radio)(?:\.|\s|>)/);
  assert.doesNotMatch(source, /\b(onChange|setValue)\b/);
  assert.doesNotMatch(source, /get(UserEstablishment|Establishment|UserProfile)/);
  assert.equal(source.match(/<Card/g)?.length, 3);
  assert.match(source, /displayValue\.hasTradeLicense/);
  assert.match(source, /displayValue\.addressPicker/);
  assert.match(source, /fileName=\{documentPath\}/);
  assert.match(source, /fileUrl=\{documentPath\}/);
  assert.doesNotMatch(source, /<DocumentViewer[\s\S]*?uploadConfig=/);
});
