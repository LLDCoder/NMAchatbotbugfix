import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildAdminModifyChangeSummary,
  filterAdminModifyChangeSummaryForDisplay,
  formatChangeSummaryValue,
  shouldDisplayAdminModifyChangeSummary,
} from "../src/components/common/FormilyReviewList/modifyChangeSummaryRules.ts";

test("shows Changes Summary only for supported Modify services", () => {
  for (const serviceCode of [803, 903, 1203, 80011, 80012]) {
    assert.equal(shouldDisplayAdminModifyChangeSummary(serviceCode), true);
  }
  for (const serviceCode of [802, 902, 80022, null, undefined]) {
    assert.equal(shouldDisplayAdminModifyChangeSummary(serviceCode), false);
  }
});

test("keeps Modified social account badges on the shared warning palette", () => {
  const stylesSource = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.less",
    "utf8",
  );

  assert.match(
    stylesSource,
    /\.admin-modify-change-summary__social-status--modified\s*\{\s*color:\s*#f29f0e;\s*background:\s*#fffbeb;/,
  );
});

test("keeps the social account title on one line without wrapping the status", () => {
  const styles = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.less",
    "utf8",
  );
  const nameRowStyles =
    styles.match(
      /\.admin-modify-change-summary__social-name-row\s*\{([^}]*)\}/,
    )?.[1] ?? "";

  assert.match(
    styles,
    /\.admin-modify-change-summary__social-name\s*\{[\s\S]*?flex:\s*1;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.doesNotMatch(nameRowStyles, /flex-wrap:\s*wrap;/);
});

test("shows social account title tooltips only when the title overflows", () => {
  const source = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
    "utf8",
  );
  const overflowTooltipSource = readFileSync(
    "src/components/common/OverflowTooltip/index.tsx",
    "utf8",
  );

  assert.match(source, /import OverflowTooltip from "@\/components\/common\/OverflowTooltip"/);
  assert.match(
    source,
    /<OverflowTooltip[\s\S]*?className="admin-modify-change-summary__social-name"[\s\S]*?title=\{displayAccountName\}/,
  );
  assert.match(overflowTooltipSource, /scrollWidth\s*>\s*clientWidth/);
  assert.match(overflowTooltipSource, /scrollHeight\s*>\s*clientHeight/);
  assert.doesNotMatch(
    overflowTooltipSource,
    /scroll(?:Width|Height)\s*>\s*client(?:Width|Height)\s*\+\s*1/,
  );
  assert.match(overflowTooltipSource, /ResizeObserver/);
  assert.match(overflowTooltipSource, /document\.fonts\.ready/);
  assert.match(
    overflowTooltipSource,
    /<Tooltip\s+title=\{tooltipTitle\}\s+placement=\{placement\}>/,
  );
});

test("truncates language summary values with overflow-aware tooltips", () => {
  const source = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
    "utf8",
  );
  const styles = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.less",
    "utf8",
  );

  assert.match(
    source,
    /const ChangeSummaryTableValue[\s\S]*?<OverflowTooltip[\s\S]*?className="admin-modify-change-summary__table-cell"[\s\S]*?title=\{value\}/,
  );
  assert.match(
    source,
    /<ChangeSummaryTableValue value=\{change\.before\?\.language \|\| "-"\}/,
  );
  assert.match(
    source,
    /<ChangeSummaryTableValue value=\{row\.name \|\| "-"\}/,
  );
  assert.match(
    styles,
    /\.admin-modify-change-summary__table-cell\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/,
  );
});

test("renders all social account changes in one shared before and after pair", () => {
  const source = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
    "utf8",
  );

  assert.match(source, /const beforeAccounts = changes\.map/);
  assert.match(source, /const afterAccounts = changes\.map/);
  assert.match(source, /change\.before \? \(/);
  assert.match(source, /change\.after \? \(/);
  assert.equal(
    source.match(/admin-modify-change-summary__social-comparison-card/g)?.length,
    2,
  );
});

function createStep(parsedFormData: Record<string, unknown>) {
  return {
    stepNameEn: "Establishment Information",
    stepNameAr: "بيانات المنشأة",
    formData: JSON.stringify(parsedFormData),
  };
}

test("builds ordinary field changes only from explicit original values", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          ProfileForm: {
            "x-component": "ProfileForm",
          },
          socialAccounts: {
            "x-component": "SocialMediaAccount",
          },
        },
      },
      modifyOriginalFormValues: {
        ProfileForm: {
          establishmentNameEnglish: "Old Media",
          phoneNumber: "0500000000",
        },
        socialAccounts: [{ id: "1", accountName: "Old account" }],
      },
      formValues: {
        ProfileForm: {
          establishmentNameEnglish: "New Media",
          phoneNumber: "0500000000",
        },
        socialAccounts: [{ id: "1", accountName: "New account" }],
      },
    }),
  ]);

  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.titleEn, "Establishment Information");
  assert.deepEqual(summary[0]?.fields, [
    {
      key: "ProfileForm.establishmentNameEnglish",
      labelEn: "Establishment Name English",
      labelAr: "Establishment Name English",
      labelI18nKey: "ProfileForm.labelEstablishmentNameEnglish",
      before: "Old Media",
      after: "New Media",
    },
  ]);
  assert.deepEqual(summary[0]?.languageChanges, []);
});

test("uses existing bilingual labels for nested composite component values", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          ProfileForm: { "x-component": "ProfileForm" },
          idSelector: { "x-component": "IDSelector" },
        },
      },
      modifyOriginalFormValues: {
        ProfileForm: {
          addressPicker: {
            street: "Old street",
            longitude: 54.4859459667631,
          },
        },
        idSelector: { passportNumber: "OLD" },
      },
      formValues: {
        ProfileForm: {
          addressPicker: {
            street: "New street",
            latitude: 0,
            longitude: 54.666218654071464,
          },
        },
        idSelector: { passportNumber: "NEW" },
      },
    }),
  ]);

  const displayed = filterAdminModifyChangeSummaryForDisplay(summary, "803");

  assert.deepEqual(
    displayed[0]?.fields.map(({ key, labelI18nKey }) => ({
      key,
      labelI18nKey,
    })),
    [
      {
        key: "ProfileForm.addressPicker.street",
        labelI18nKey: "AddressPicker.labelStreet",
      },
      {
        key: "idSelector.passportNumber",
        labelI18nKey: "IDSelector.labelPassportNumber",
      },
    ],
  );
  assert.equal(summary[0]?.fields.length, 4);
});

test("classifies added modified and deleted language rows", () => {
  const summary = buildAdminModifyChangeSummary([
    {
      stepNameEn: "Languages & Names",
      stepNameAr: "اللغات والأسماء",
      formData: JSON.stringify({
        schema: {
          properties: {
            dataList: {
              "x-component": "DataList",
              "x-component-props": {
                fieldSource: { dataSource: "languages_name_list" },
              },
            },
          },
        },
        modifyOriginalFormValues: {
          dataList: [
            { languageId: 1, language: "Arabic", suggested_name: "Old Arabic" },
            { languageId: 2, language: "English", suggested_name: "Old English" },
          ],
        },
        formValues: {
          dataList: [
            { languageId: 2, language: "English", suggested_name: "New English" },
            { languageId: 3, language: "French", suggested_name: "French News" },
          ],
        },
      }),
    },
  ]);

  assert.deepEqual(summary[0]?.languageChanges, [
    {
      key: "id:1",
      changeType: "deleted",
      before: { language: "Arabic", name: "Old Arabic" },
      after: null,
    },
    {
      key: "id:2",
      changeType: "modified",
      before: { language: "English", name: "Old English" },
      after: { language: "English", name: "New English" },
    },
    {
      key: "id:3",
      changeType: "added",
      before: null,
      after: { language: "French", name: "French News" },
    },
  ]);
  assert.deepEqual(summary[0]?.fields, []);
});

test("ignores unchanged steps, malformed data, and steps without an explicit snapshot", () => {
  const unchanged = createStep({
    schema: { properties: { title: { title: "Title", "x-component": "Input" } } },
    modifyOriginalFormValues: { title: "Same" },
    formValues: { title: "Same" },
  });

  assert.deepEqual(
    buildAdminModifyChangeSummary([
      unchanged,
      { stepNameEn: "Invalid", formData: "{" },
      createStep({ formValues: { title: "No source" } }),
    ]),
    [],
  );
});

test("does not report equivalent empty values as changes", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          latitude: { title: "Latitude", "x-component": "Input" },
          attachments: { title: "Attachments", "x-component": "Upload" },
        },
      },
      modifyOriginalFormValues: { latitude: null },
      formValues: { attachments: [] },
    }),
  ]);

  assert.deepEqual(summary, []);
});

test("counts a social-only modified section without generating duplicate comparison rows", () => {
  const summary = buildAdminModifyChangeSummary([
    {
      stepNameEn: "Social Media Accounts",
      stepNameAr: "حسابات التواصل الاجتماعي",
      formData: JSON.stringify({
        schema: {
          properties: {
            socialAccounts: {
              name: "SocialMediaAccount",
              "x-component": "SocialMediaAccount",
            },
          },
        },
        modifyOriginalFormValues: {
          socialAccounts: [{ id: "1", accountName: "Before" }],
        },
        formValues: {
          socialAccounts: [
            { id: "1", accountName: "After", operation: "MODIFY" },
          ],
        },
      }),
    },
  ]);

  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.hasSocialChanges, true);
  assert.deepEqual(summary[0]?.fields, []);
  assert.deepEqual(summary[0]?.languageChanges, []);
  assert.deepEqual(summary[0]?.socialChanges, [
    {
      key: "id:1",
      changeType: "modified",
      before: { id: "1", accountName: "Before" },
      after: { id: "1", accountName: "After" },
    },
  ]);
});

test("keeps both social account values for before and after rendering", () => {
  const summary = buildAdminModifyChangeSummary([
    {
      stepNameEn: "Social Media Accounts",
      stepNameAr: "حسابات التواصل الاجتماعي",
      formData: JSON.stringify({
        schema: {
          properties: {
            socialAccounts: {
              name: "SocialMediaAccount",
              "x-component": "SocialMediaAccount",
            },
          },
        },
        modifyOriginalFormValues: {
          socialAccounts: [
            { id: "1", accountTitle: "Before account", accountUrl: "before" },
          ],
        },
        formValues: {
          socialAccounts: [
            {
              id: "1",
              accountTitle: "After account",
              accountUrl: "after",
              operation: "MODIFY",
            },
          ],
        },
      }),
    },
  ]);

  assert.equal(summary[0]?.socialChanges[0]?.before?.accountTitle, "Before account");
  assert.equal(summary[0]?.socialChanges[0]?.after?.accountTitle, "After account");
});

test("uses schema labels and formats values without inventing data", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          phoneNumber: {
            title: "Phone Number",
            "x-component": "Input",
            "x-component-props": { titleAr: "رقم الهاتف" },
          },
        },
      },
      modifyOriginalFormValues: { phoneNumber: "0500000000" },
      formValues: { phoneNumber: "0500000001" },
    }),
  ]);

  assert.equal(summary[0]?.fields[0]?.labelEn, "Phone Number");
  assert.equal(summary[0]?.fields[0]?.labelAr, "رقم الهاتف");
  assert.equal(formatChangeSummaryValue(undefined), "-");
  assert.equal(formatChangeSummaryValue(["One", "Two"]), "One, Two");
  assert.equal(
    formatChangeSummaryValue("common/2026/07/document.pdf"),
    "document.pdf",
  );
  assert.equal(
    formatChangeSummaryValue("2027-07-16T23:59:59", { dateOnly: true }),
    "2027-07-16",
  );
});

test("prefers a valid persisted change set over recomputing original values", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          phoneNumber: {
            title: "Phone Number",
            "x-component": "Input",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Persisted Establishment",
        sectionNameAr: "بيانات المنشأة المحفوظة",
        changes: [
          {
            kind: "field",
            changeType: "MODIFIED",
            fieldKey: "phoneNumber",
            labelEn: "Persisted Phone",
            labelAr: "رقم الهاتف المحفوظ",
            beforeValue: "0501111111",
            afterValue: "0502222222",
          },
        ],
      },
      modifyOriginalFormValues: { phoneNumber: "legacy-before" },
      formValues: { phoneNumber: "legacy-after" },
    }),
  ]);

  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.titleEn, "Persisted Establishment");
  assert.equal(summary[0]?.titleAr, "بيانات المنشأة المحفوظة");
  assert.deepEqual(summary[0]?.fields, [
    {
      key: "phoneNumber",
      labelEn: "Persisted Phone",
      labelAr: "رقم الهاتف المحفوظ",
      before: "0501111111",
      after: "0502222222",
      component: "Input",
    },
  ]);
});

test("hides persisted AddressPicker coordinates without changing source data", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          ProfileForm: {
            "x-component": "ProfileForm",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Establishment Information",
        sectionNameAr: "بيانات المنشأة",
        changes: [
          {
            kind: "field",
            component: "AddressPicker",
            ownerComponent: "ProfileForm",
            changeType: "ADDED",
            fieldKey: "ProfileForm.addressPicker.latitude",
            labelEn: "latitude",
            labelAr: "latitude",
            beforeValue: null,
            afterValue: 0,
          },
          {
            kind: "field",
            component: "AddressPicker",
            ownerComponent: "ProfileForm",
            changeType: "MODIFIED",
            fieldKey: "ProfileForm.addressPicker.longitude",
            labelEn: "longitude",
            labelAr: "longitude",
            beforeValue: 54.4859459667631,
            afterValue: 54.666218654071464,
          },
        ],
      },
    }),
  ]);

  assert.equal(summary[0]?.fields.length, 2);
  assert.equal(summary[0]?.fields[0]?.after, 0);
  assert.deepEqual(
    filterAdminModifyChangeSummaryForDisplay(summary, "1203"),
    [],
  );
  assert.equal(summary[0]?.fields.length, 2);
});

test("keeps coordinate fields for non-target services", () => {
  const sections = [
    {
      key: "address",
      titleEn: "Address",
      titleAr: "Address",
      fields: [
        {
          key: "addressPicker.latitude",
          labelEn: "Latitude",
          labelAr: "Latitude",
          before: 24,
          after: 25,
          component: "AddressPicker",
        },
      ],
      languageChanges: [],
      socialChanges: [],
    },
  ];

  assert.equal(
    filterAdminModifyChangeSummaryForDisplay(sections, "901"),
    sections,
  );
});

test("hides social comparisons for social media modify services", () => {
  const sections = [
    {
      key: "social",
      titleEn: "Social Media Accounts",
      titleAr: "Social Media Accounts",
      fields: [
        {
          key: "referenceNumber",
          labelEn: "Reference Number",
          labelAr: "Reference Number",
          before: "before",
          after: "after",
          component: "Input",
        },
      ],
      languageChanges: [
        {
          key: "language:1",
          changeType: "modified" as const,
          before: { language: "English", name: "Before" },
          after: { language: "English", name: "After" },
        },
      ],
      activityChanges: [
        {
          key: "activity:1",
          changeType: "modified" as const,
          before: { id: 1 },
          after: { id: 2 },
        },
      ],
      socialChanges: [
        {
          key: "social:1",
          changeType: "modified" as const,
          before: { accountName: "Before" },
          after: { accountName: "After" },
        },
      ],
    },
  ];

  for (const serviceCode of ["80011", "80012"]) {
    const [displayed] = filterAdminModifyChangeSummaryForDisplay(
      sections,
      serviceCode,
    );
    assert.deepEqual(displayed?.fields, sections[0].fields);
    assert.deepEqual(displayed?.languageChanges, sections[0].languageChanges);
    assert.deepEqual(displayed?.activityChanges, sections[0].activityChanges);
    assert.deepEqual(displayed?.socialChanges, []);
  }
  assert.deepEqual(
    filterAdminModifyChangeSummaryForDisplay(
      [{ ...sections[0], fields: [], languageChanges: [], activityChanges: [], hasSocialChanges: true }],
      "80011",
    ),
    [],
  );
  assert.deepEqual(filterAdminModifyChangeSummaryForDisplay(sections, "903"), sections);
});

test("keeps snapshot-only language changes after hiding social comparisons", () => {
  const [displayed] = filterAdminModifyChangeSummaryForDisplay(
    [
      {
        key: "language-snapshot",
        titleEn: "Social Media Accounts",
        titleAr: "Social Media Accounts",
        fields: [],
        languageChanges: [],
        languageSnapshots: [
          {
            key: "language-snapshot:1",
            before: { language: "English", name: "Before" },
            after: { language: "English", name: "After" },
          },
        ],
        socialChanges: [
          {
            key: "social:1",
            changeType: "modified" as const,
            before: { accountName: "Before" },
            after: { accountName: "After" },
          },
        ],
      },
    ],
    "80011",
  );

  assert.equal(displayed?.languageSnapshots?.length, 1);
  assert.deepEqual(displayed?.socialChanges, []);
});

test("keeps sections when the service code is missing", () => {
  const sections = [
    {
      key: "address",
      titleEn: "Address",
      titleAr: "Address",
      fields: [],
      languageChanges: [],
      socialChanges: [],
    },
  ];

  assert.equal(
    filterAdminModifyChangeSummaryForDisplay(sections, undefined),
    sections,
  );
  assert.equal(
    filterAdminModifyChangeSummaryForDisplay(sections, null),
    sections,
  );
});

test("filters coordinate fields for numeric target service codes", () => {
  const sections = [
    {
      key: "address",
      titleEn: "Address",
      titleAr: "Address",
      fields: [
        {
          key: "addressPicker.latitude",
          labelEn: "Latitude",
          labelAr: "Latitude",
          before: 24,
          after: 25,
          component: "AddressPicker",
        },
      ],
      languageChanges: [],
      socialChanges: [],
    },
  ];

  assert.deepEqual(
    filterAdminModifyChangeSummaryForDisplay(sections, 803),
    [],
  );
});

test("normalizes persisted ProfileForm phone parts into one Phone Number field", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          ProfileForm: {
            "x-component": "ProfileForm",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Activity Details",
        sectionNameAr: "تفاصيل النشاط",
        changes: [
          {
            kind: "field",
            component: "ProfileForm",
            changeType: "ADDED",
            fieldKey: "phoneNumberCountryCode",
            labelEn: "phoneNumberCountryCode",
            labelAr: "phoneNumberCountryCode",
            beforeValue: "",
            afterValue: "+971",
          },
          {
            kind: "field",
            component: "ProfileForm",
            changeType: "ADDED",
            fieldKey: "phoneNumberLocalNumber",
            labelEn: "phoneNumberLocalNumber",
            labelAr: "phoneNumberLocalNumber",
            beforeValue: "",
            afterValue: "501234567",
          },
        ],
      },
    }),
  ]);

  assert.deepEqual(summary[0]?.fields, [
    {
      key: "phoneNumber",
      labelEn: "Phone Number",
      labelAr: "رقم الهاتف",
      labelI18nKey: "ProfileForm.labelPhoneNumber",
      before: "",
      after: "+971501234567",
      component: "ProfileForm",
    },
  ]);
});

test("prefers a persisted complete Phone Number over internal phone parts", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          ProfileForm: {
            "x-component": "ProfileForm",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Activity Details",
        sectionNameAr: "تفاصيل النشاط",
        changes: [
          {
            kind: "field",
            component: "ProfileForm",
            changeType: "MODIFIED",
            fieldKey: "phoneNumber",
            labelEn: "Phone Number",
            labelAr: "رقم الهاتف",
            beforeValue: "+971501234567",
            afterValue: "+971501234568",
          },
          {
            kind: "field",
            component: "ProfileForm",
            changeType: "MODIFIED",
            fieldKey: "phoneNumberCountryCode",
            labelEn: "Country Code",
            labelAr: "رمز الدولة",
            beforeValue: "+971",
            afterValue: "+971",
          },
          {
            kind: "field",
            component: "ProfileForm",
            changeType: "MODIFIED",
            fieldKey: "phoneNumberLocalNumber",
            labelEn: "Local Number",
            labelAr: "الرقم المحلي",
            beforeValue: "501234567",
            afterValue: "501234568",
          },
        ],
      },
    }),
  ]);

  assert.deepEqual(summary[0]?.fields, [
    {
      key: "phoneNumber",
      labelEn: "Phone Number",
      labelAr: "رقم الهاتف",
      labelI18nKey: "ProfileForm.labelPhoneNumber",
      before: "+971501234567",
      after: "+971501234568",
      component: "ProfileForm",
    },
  ]);
});

test("does not merge persisted phone-like fields from another component", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      modifyChangeSet: {
        sectionNameEn: "Chief Editor Information",
        sectionNameAr: "معلومات رئيس التحرير",
        changes: [
          {
            kind: "field",
            component: "IDSelector",
            changeType: "ADDED",
            fieldKey: "phoneNumberCountryCode",
            labelEn: "Country Code",
            labelAr: "رمز الدولة",
            beforeValue: "",
            afterValue: "+971",
          },
          {
            kind: "field",
            component: "IDSelector",
            changeType: "ADDED",
            fieldKey: "phoneNumberLocalNumber",
            labelEn: "Local Number",
            labelAr: "الرقم المحلي",
            beforeValue: "",
            afterValue: "501234567",
          },
        ],
      },
    }),
  ]);

  assert.equal(summary[0]?.fields.length, 2);
  assert.equal(summary[0]?.fields[0]?.key, "phoneNumberCountryCode");
  assert.equal(summary[0]?.fields[1]?.key, "phoneNumberLocalNumber");
});

test("maps persisted language and social changes without duplicate field rows", () => {
  const summary = buildAdminModifyChangeSummary([
    {
      stepNameEn: "Languages & Social",
      stepNameAr: "اللغات والتواصل الاجتماعي",
      formData: JSON.stringify({
        schema: {
          properties: {
            dataList: {
              "x-component": "DataList",
              "x-component-props": {
                fieldSource: { dataSource: "languages_name_list" },
              },
            },
            socialAccounts: {
              "x-component": "SocialMediaAccount",
            },
          },
        },
        modifyChangeSet: {
          sectionNameEn: "Languages & Social",
          sectionNameAr: "اللغات والتواصل الاجتماعي",
          changes: [
            {
              kind: "list",
              changeType: "MODIFIED",
              fieldKey: "dataList",
              labelEn: "Language & Name List",
              labelAr: "قائمة اللغات والأسماء",
              beforeValue: {
                languageId: 2,
                language: "English",
                suggested_name: "Old name",
              },
              afterValue: {
                languageId: 2,
                language: "English",
                suggested_name: "New name",
              },
            },
            {
              kind: "list",
              component: "SocialMediaAccount",
              changeType: "ADDED",
              fieldKey: "socialAccounts",
              labelEn: "Social Media Account",
              labelAr: "حساب التواصل الاجتماعي",
              beforeValue: null,
              afterValue: { accountName: "New account" },
            },
          ],
        },
      }),
    },
  ]);

  assert.equal(summary.length, 1);
  assert.deepEqual(summary[0]?.fields, []);
  assert.equal(summary[0]?.hasSocialChanges, true);
  assert.deepEqual(summary[0]?.socialChanges, [
    {
      key: "socialAccounts:1",
      changeType: "added",
      before: null,
      after: { accountName: "New account" },
    },
  ]);
  assert.deepEqual(summary[0]?.languageChanges, [
    {
      key: "dataList:0",
      changeType: "modified",
      before: { language: "English", name: "Old name" },
      after: { language: "English", name: "New name" },
    },
  ]);
});

test("builds complete language snapshots when a persisted delta is present", () => {
  const summary = buildAdminModifyChangeSummary([
    {
      stepNameEn: "Languages & Names",
      stepNameAr: "اللغات والأسماء",
      formData: JSON.stringify({
        schema: {
          properties: {
            dataList: {
              "x-component": "DataList",
              "x-component-props": {
                fieldSource: { dataSource: "languages_name_list" },
              },
            },
          },
        },
        modifyOriginalFormValues: {
          dataList: [
            {
              languageId: 2,
              language: "English",
              suggested_name: "Suggested",
            },
          ],
        },
        formValues: {
          dataList: [
            {
              languageId: 2,
              language: "English",
              suggested_name: "Suggested",
            },
            {
              languageId: 1,
              language: "Arabic",
              suggested_name: "Hello",
            },
          ],
        },
        modifyChangeSet: {
          sectionNameEn: "Languages & Names",
          sectionNameAr: "اللغات والأسماء",
          changes: [],
        },
      }),
    },
  ]);

  assert.deepEqual(summary[0]?.languageSnapshots, [
    {
      key: "dataList",
      beforeRows: [{ language: "English", name: "Suggested" }],
      afterRows: [
        { language: "English", name: "Suggested" },
        { language: "Arabic", name: "Hello", changeType: "added" },
      ],
      deletedRows: [],
    },
  ]);

  const source = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
    "utf8",
  );
  assert.match(source, /FormilyReviewList\.changeSummary\.changeType/);
  assert.match(source, /snapshot\.deletedRows/);
});

test("does not invent complete language snapshots for legacy persisted deltas", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          dataList: {
            "x-component": "DataList",
            "x-component-props": {
              fieldSource: { dataSource: "languages_name_list" },
            },
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Languages & Names",
        sectionNameAr: "اللغات والأسماء",
        changes: [
          {
            kind: "list",
            component: "DataList",
            changeType: "ADDED",
            fieldKey: "dataList",
            labelEn: "Language & Name List",
            labelAr: "قائمة اللغات والأسماء",
            beforeValue: null,
            afterValue: {
              language: "Arabic",
              suggested_name: "Hello",
            },
          },
        ],
      },
    }),
  ]);

  assert.equal(summary[0]?.languageSnapshots, undefined);
  assert.equal(summary[0]?.languageChanges.length, 1);
});

test("renders persisted SelectTable list changes as activity rows", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          activities: {
            "x-component": "SelectTable",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Media Activities",
        sectionNameAr: "الأنشطة الإعلامية",
        changes: [
          {
            kind: "list",
            component: "SelectTable",
            changeType: "ADDED",
            fieldKey: "activities",
            labelEn: "Activities",
            labelAr: "الأنشطة",
            beforeValue: null,
            afterValue: ["New Activity"],
          },
          {
            kind: "list",
            component: "SelectTable",
            changeType: "DELETED",
            fieldKey: "activities",
            labelEn: "Activities",
            labelAr: "الأنشطة",
            beforeValue: ["Old Activity"],
            afterValue: null,
          },
        ],
      },
    }),
  ]);

  assert.equal(summary.length, 1);
  assert.deepEqual(summary[0]?.fields, []);
  assert.deepEqual(summary[0]?.activityChanges, [
    {
      key: "activities:0",
      changeType: "added",
      before: null,
      after: ["New Activity"],
    },
    {
      key: "activities:1",
      changeType: "deleted",
      before: ["Old Activity"],
      after: null,
    },
  ]);
});

test("preserves persisted value labels, remote sources, ownership, and file metadata", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          qualification: {
            "x-component": "Select",
          },
          qualificationCopy: {
            "x-component": "Upload",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Chief Editor Information",
        sectionNameAr: "معلومات رئيس التحرير",
        changes: [
          {
            kind: "field",
            component: "Select",
            ownerComponent: "IDSelector",
            changeType: "MODIFIED",
            fieldKey: "qualification",
            labelEn: "Qualification",
            labelAr: "المؤهل",
            beforeValue: 3,
            afterValue: 4,
            valueOptions: [
              { value: 3, labelEn: "Bachelor", labelAr: "بكالوريوس" },
              { value: 4, labelEn: "Master", labelAr: "ماجستير" },
            ],
            valueSource: { type: "lookup", source: "Qualifications" },
          },
          {
            kind: "field",
            component: "Upload",
            changeType: "MODIFIED",
            fieldKey: "qualificationCopy",
            labelEn: "Qualification Copy",
            labelAr: "نسخة المؤهل",
            beforeValue: "common/old.pdf",
            afterValue: "common/new.pdf",
          },
        ],
      },
      formValues: {},
    }),
  ]);

  assert.deepEqual(summary[0]?.fields[0], {
    key: "qualification",
    labelEn: "Qualification",
    labelAr: "المؤهل",
    before: 3,
    after: 4,
    component: "Select",
    ownerComponent: "IDSelector",
    valueOptions: [
      { value: 3, labelEn: "Bachelor", labelAr: "بكالوريوس" },
      { value: 4, labelEn: "Master", labelAr: "ماجستير" },
    ],
    valueSource: { type: "lookup", source: "Qualifications" },
  });
  assert.equal(summary[0]?.fields[1]?.component, "Upload");
});

test("treats a malformed persisted change set as authoritative", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          phoneNumber: {
            title: "Phone Number",
            "x-component": "Input",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Broken",
        sectionNameAr: "تالف",
        changes: [{ kind: "unknown" }],
      },
      modifyOriginalFormValues: { phoneNumber: "0500000000" },
      formValues: { phoneNumber: "0500000001" },
    }),
  ]);

  assert.deepEqual(summary, []);
});

test("treats an explicitly empty persisted change set as authoritative", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      schema: {
        properties: {
          phoneNumber: {
            title: "Phone Number",
            "x-component": "Input",
          },
        },
      },
      modifyChangeSet: {
        sectionNameEn: "Establishment Information",
        sectionNameAr: "بيانات المنشأة",
        changes: [],
      },
      modifyOriginalFormValues: { phoneNumber: "0500000000" },
      formValues: { phoneNumber: "0500000001" },
    }),
  ]);

  assert.deepEqual(summary, []);
});

test("persisted changes suppress legacy fallback for unchanged sibling steps", () => {
  const summary = buildAdminModifyChangeSummary([
    createStep({
      stepNameEn: "Establishment Information",
      modifyOriginalFormValues: {
        ProfileForm: { workEmail: "before@example.com" },
      },
      formValues: {
        ProfileForm: { workEmail: "after@example.com" },
      },
    }),
    createStep({
      stepNameEn: "Social Media Accounts",
      modifyChangeSet: {
        sectionNameEn: "Social Media Accounts",
        sectionNameAr: "Social Media Accounts",
        changes: [
          {
            kind: "list",
            component: "SocialMediaAccount",
            changeType: "MODIFIED",
            fieldKey: "socialMediaAccounts",
            labelEn: "Social Media Account",
            labelAr: "Social Media Account",
            beforeValue: { accountTitle: "Before" },
            afterValue: { accountTitle: "After" },
          },
        ],
      },
      formValues: {},
    }),
  ]);

  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.titleEn, "Social Media Accounts");
  assert.equal(summary[0]?.socialChanges.length, 1);
});

test("integrates the bilingual BEM change summary without service-code rules", () => {
  const componentSource = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.tsx",
    "utf8",
  );
  const reviewListSource = readFileSync(
    "src/components/common/FormilyReviewList/index.tsx",
    "utf8",
  );
  const styles = readFileSync(
    "src/components/common/FormilyReviewList/AdminModifyChangeSummary.less",
    "utf8",
  );
  const reviewListStyles = readFileSync(
    "src/components/common/FormilyReviewList/index.less",
    "utf8",
  );

  assert.match(componentSource, /FormilyReviewList\.changeSummary\.title/);
  assert.doesNotMatch(
    componentSource,
    /FormilyReviewList\.changeSummary\.modifiedSections/,
  );
  assert.doesNotMatch(
    componentSource,
    /admin-modify-change-summary__overview/,
  );
  assert.match(componentSource, /admin-modify-change-summary__before-card/);
  assert.match(componentSource, /admin-modify-change-summary__after-card/);
  assert.match(componentSource, /DocumentViewer/);
  assert.match(
    componentSource,
    /PROFILE_FILE_FIELD_KEYS\.has\(field\.key\.split\("\."\)\.at\(-1\)/,
  );
  assert.match(componentSource, /admin-modify-change-summary__social-card/);
  assert.match(componentSource, /socialChanges/);
  assert.match(componentSource, /SocialMediaAccount\.statusNew/);
  assert.match(componentSource, /FormilyReviewList\.changeSummary\.activity/);
  assert.doesNotMatch(componentSource, /1203|803|903|80011|80012|3248|2308/);
  assert.match(reviewListSource, /buildAdminModifyChangeSummary/);
  assert.match(
    reviewListSource,
    /<AdminModifyChangeSummary\s+sections=\{modifyChangeSections\}/,
  );
  assert.match(reviewListSource, /FormilyReviewList__step/);
  assert.match(
    reviewListStyles,
    /\.FormilyReviewList__step\s*\+\s*\.FormilyReviewList__step/,
  );
  assert.doesNotMatch(styles, /&__(?:[a-z-]+)/);

  for (const locale of ["en", "ar"]) {
    const translations = JSON.parse(
      readFileSync(`src/localization/formily/${locale}.json`, "utf8"),
    );
    assert.equal(typeof translations.FormilyReviewList.changeSummary.title, "string");
    assert.equal(
      translations.FormilyReviewList.changeSummary.modifiedSections,
      undefined,
    );
    assert.equal(typeof translations.FormilyReviewList.changeSummary.before, "string");
    assert.equal(typeof translations.FormilyReviewList.changeSummary.after, "string");
  }
});
