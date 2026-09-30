import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const languageSourceUrl = new URL(
  "../src/localization/language.ts",
  import.meta.url
);
const localizationSourceUrl = new URL(
  "../src/pages/CustomerRefunds/listLocalization.ts",
  import.meta.url
);
const languageSource = await readFile(languageSourceUrl, "utf8");
const localizationSource = await readFile(localizationSourceUrl, "utf8");
const combinedSource = `${languageSource}\n${localizationSource.replace(
  'import { isArabicLanguage } from "@/localization/language";',
  ""
)}`;
const { code } = await transformWithEsbuild(
  combinedSource,
  localizationSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  }
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64"
)}`;
const { resolveAdminRefundListDisplayFields } = await import(moduleUrl);

const apiItem = {
  refundCategory: "Application",
  refundCategoryObj: {
    nameEn: "Application",
    nameAr: "category-ar",
  },
  applyFor: {
    userTypeId: 2,
    userName: "Commercial DP",
    userNameAr: "apply-for-ar",
  },
  sla: "8d Overdue",
  slaObj: {
    nameEn: "8d Overdue",
    nameAr: "sla-ar",
  },
};

test("uses Arabic API display fields for refund todo rows", () => {
  assert.deepEqual(resolveAdminRefundListDisplayFields(apiItem, "ar-AE"), {
    category: "Application",
    categoryDisplay: "category-ar",
    applyForName: "apply-for-ar",
    sla: "8d Overdue",
    slaDisplay: "sla-ar",
  });
});

test("keeps English API display fields for English refund todo rows", () => {
  assert.deepEqual(resolveAdminRefundListDisplayFields(apiItem, "en-US"), {
    category: "Application",
    categoryDisplay: "Application",
    applyForName: "Commercial DP",
    sla: "8d Overdue",
    slaDisplay: "8d Overdue",
  });
});

test("falls back to English API fields when Arabic fields are missing", () => {
  assert.deepEqual(
    resolveAdminRefundListDisplayFields(
      {
        ...apiItem,
        refundCategoryObj: { nameEn: "Application", nameAr: null },
        applyFor: { ...apiItem.applyFor, userNameAr: null },
        slaObj: { nameEn: "8d Overdue", nameAr: null },
      },
      "ar-AE"
    ),
    {
      category: "Application",
      categoryDisplay: "Application",
      applyForName: "Commercial DP",
      sla: "8d Overdue",
      slaDisplay: "8d Overdue",
    }
  );
});
