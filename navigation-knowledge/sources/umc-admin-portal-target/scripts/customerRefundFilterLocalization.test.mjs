import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const languageSourceUrl = new URL(
  "../src/localization/language.ts",
  import.meta.url
);
const filterOptionsSourceUrl = new URL(
  "../src/pages/CustomerRefunds/filterOptions.ts",
  import.meta.url
);
const languageSource = await readFile(languageSourceUrl, "utf8");
const filterOptionsSource = await readFile(filterOptionsSourceUrl, "utf8");
const combinedSource = `${languageSource}\n${filterOptionsSource.replace(
  'import { isArabicLanguage } from "@/localization/language";',
  ""
)}`;
const { code } = await transformWithEsbuild(
  combinedSource,
  filterOptionsSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  }
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64"
)}`;
const { mapRefundFilterSelectOptions } = await import(moduleUrl);

const statusItems = [
  {
    id: 1,
    code: "1",
    nameEn: "Department Processing",
    nameAr: "processing-ar\r",
  },
  {
    id: 2,
    code: "2",
    nameEn: "Department Processed",
    nameAr: "processed-ar\r",
  },
  {
    id: 3,
    code: "3",
    nameEn: "Department Processed",
    nameAr: "processed-ar\r",
  },
  {
    id: 5,
    code: "5",
    nameEn: "Rejected",
    nameAr: "rejected-ar\r",
  },
];

test("keeps canonical values while displaying Arabic labels", () => {
  assert.deepEqual(
    mapRefundFilterSelectOptions(statusItems, "ar-AE", [
      "Department Processing",
      "Department Processed",
    ]),
    [
      { value: "Department Processing", label: "processing-ar" },
      { value: "Department Processed", label: "processed-ar" },
    ]
  );
});

test("filters statuses by canonical values instead of localized labels", () => {
  assert.deepEqual(
    mapRefundFilterSelectOptions(statusItems, "ar", ["Rejected"]),
    [{ value: "Rejected", label: "rejected-ar" }]
  );
});

test("falls back to English when an Arabic label is missing", () => {
  assert.deepEqual(
    mapRefundFilterSelectOptions(
      [{ id: 1, code: "1", nameEn: "Fine", nameAr: null }],
      "ar-AE"
    ),
    [{ value: "Fine", label: "Fine" }]
  );
});

test("returns an empty list for missing option data", () => {
  assert.deepEqual(mapRefundFilterSelectOptions(undefined, "ar-AE"), []);
  assert.deepEqual(mapRefundFilterSelectOptions(null, "ar-AE"), []);
});
