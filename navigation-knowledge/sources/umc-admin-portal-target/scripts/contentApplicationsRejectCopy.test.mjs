import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;
  return import(moduleUrl);
};

const { getRejectApplicationModalCopy } = await loadTypeScriptModule(
  "../src/pages/ContentApplications/utils/workflowActionModalCopy.ts",
);

test("uses the material disposition warning for a direct application rejection", () => {
  const translations = {
    "applications.approvalModals.reject.title": "Reject Application",
    "applications.approvalModals.reject.materialDispositionTip":
      "Once rejected, all publications in this application will be rejected. The applicant will be required to select a disposition method and submit supporting documentation within 14 days.",
    "applications.approvalModals.common.notes": "Notes",
    "applications.approvalModals.common.attachments": "Attachments",
  };
  const translate = (key, options) => {
    assert.equal(options, undefined);
    return translations[key];
  };

  assert.equal(
    getRejectApplicationModalCopy(101, translate).tip,
    "Once rejected, all publications in this application will be rejected. The applicant will be required to select a disposition method and submit supporting documentation within 14 days.",
  );
});

test("keeps the next review stage warning for a routed rejection", () => {
  const translations = {
    "applications.approvalModals.reject.title": "Reject Application",
    "applications.approvalModals.reject.routeTip":
      "This rejection applies to this step only. The application will still move to the next review stage.",
    "applications.approvalModals.common.notes": "Notes",
    "applications.approvalModals.common.attachments": "Attachments",
  };
  const translate = (key, options) => {
    assert.equal(options, undefined);
    return translations[key];
  };

  assert.equal(
    getRejectApplicationModalCopy(102, translate).tip,
    "This rejection applies to this step only. The application will still move to the next review stage.",
  );
});

test("localizes fallback approval results without changing request values", async () => {
  const { getDefaultApprovalResults } = await loadTypeScriptModule(
    "../src/pages/ContentApplications/components/MyTasks/localization.ts",
  );
  const translations = {
    "Content.contentApplications.approvalResults.approved": "موافق عليه",
    "Content.contentApplications.approvalResults.rejected": "مرفوض",
    "Content.contentApplications.approvalResults.requestModification":
      "طلب تعديل",
    "Content.contentApplications.approvalResults.externalApproval":
      "موافقة خارجية",
    "Content.contentApplications.approvalResults.sendBack": "إرجاع",
  };

  assert.deepEqual(
    getDefaultApprovalResults((key) => translations[key] ?? key),
    [
      { label: "موافق عليه", value: "Approved" },
      { label: "مرفوض", value: "Rejected" },
      { label: "طلب تعديل", value: "Request Modification" },
      { label: "موافقة خارجية", value: "External Approval" },
      { label: "إرجاع", value: "Send Back" },
    ],
  );
});

test("rebuilds service category labels for the selected language", async () => {
  const { getServiceCategoryOptions } = await loadTypeScriptModule(
    "../src/pages/ContentApplications/components/MyTasks/localization.ts",
  );
  const categories = [
    {
      id: "1",
      nameEn: "Books",
      nameAr: "الكتب",
    },
  ];
  const translate = () => "كل الفئات";

  assert.deepEqual(getServiceCategoryOptions(categories, true, translate), [
    { label: "كل الفئات", value: "" },
    { label: "الكتب", value: "1" },
  ]);
  assert.deepEqual(getServiceCategoryOptions(categories, false, translate), [
    { label: "كل الفئات", value: "" },
    { label: "Books", value: "1" },
  ]);
});
