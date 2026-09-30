import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourcePath = new URL(
  "../src/pages/ContentApplications/components/MediaMaterialReportModal/reportRules.ts",
  import.meta.url,
);

const loadRules = async () => {
  assert.ok(existsSync(sourcePath), "reportRules.ts is not implemented");

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

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const submissionValues = {
  detailedReport: "Detailed report",
  ageClassification: 3,
  classificationIds: [10, 20],
  notes: [{ Note: "Keep this note" }],
};

test("removes age classification for services 21 and 1005", async () => {
  const { getMediaMaterialReportRules } = await loadRules();

  for (const serviceCode of [21, "21", 1005, "1005"]) {
    assert.deepEqual(getMediaMaterialReportRules(serviceCode, false), {
      showAgeClassification: false,
      showDetailedReport: true,
      showNotes: true,
      includeNotesInPayload: true,
    });
  }
});

test("keeps only classification and age inputs for service 2201", async () => {
  const { getMediaMaterialReportRules } = await loadRules();

  assert.deepEqual(getMediaMaterialReportRules("2201", false), {
    showAgeClassification: true,
    showDetailedReport: false,
    showNotes: false,
    includeNotesInPayload: false,
  });
});

test("preserves newspaper and magazine report behavior", async () => {
  const { getMediaMaterialReportRules } = await loadRules();

  assert.deepEqual(getMediaMaterialReportRules("1101", true), {
    showAgeClassification: false,
    showDetailedReport: true,
    showNotes: false,
    includeNotesInPayload: true,
  });
});

test("keeps existing fields for other content services", async () => {
  const { getMediaMaterialReportRules } = await loadRules();

  for (const serviceCode of [null, undefined, "", "1002"]) {
    assert.deepEqual(getMediaMaterialReportRules(serviceCode, false), {
      showAgeClassification: true,
      showDetailedReport: true,
      showNotes: true,
      includeNotesInPayload: true,
    });
  }
});

test("omits age and obligation fields for services 21 and 1005 on approve and reject", async () => {
  const module = await loadRules();
  assert.equal(
    typeof module.buildMediaMaterialReportSubmission,
    "function",
    "buildMediaMaterialReportSubmission is not implemented",
  );

  for (const serviceCode of ["21", "1005"]) {
    const rules = module.getMediaMaterialReportRules(serviceCode, false);

    for (const workflowAction of [4, 105]) {
      const request = {
        workflowAction,
        ...module.buildMediaMaterialReportSubmission(rules, submissionValues),
      };

      assert.equal(hasOwn(request, "rejectReasonFile"), false);
      assert.equal(hasOwn(request, "approvalComment"), true);
      assert.equal(hasOwn(request.actionPayload, "ageClassification"), false);
      assert.equal(hasOwn(request.actionPayload, "detailedReport"), true);
      assert.equal(hasOwn(request.actionPayload, "notes"), true);
    }
  }
});

test("submits only classification fields for service 2201 on approve and reject", async () => {
  const module = await loadRules();
  assert.equal(
    typeof module.buildMediaMaterialReportSubmission,
    "function",
    "buildMediaMaterialReportSubmission is not implemented",
  );
  const rules = module.getMediaMaterialReportRules("2201", false);

  for (const workflowAction of [4, 105]) {
    const request = {
      workflowAction,
      ...module.buildMediaMaterialReportSubmission(rules, submissionValues),
    };

    assert.equal(hasOwn(request, "rejectReasonFile"), false);
    assert.equal(hasOwn(request, "approvalComment"), false);
    assert.equal(hasOwn(request.actionPayload, "ageClassification"), true);
    assert.equal(hasOwn(request.actionPayload, "classificationIds"), true);
    assert.equal(hasOwn(request.actionPayload, "detailedReport"), false);
    assert.equal(hasOwn(request.actionPayload, "notes"), false);
  }
});

test("preserves hidden newspaper notes in the request payload", async () => {
  const module = await loadRules();
  assert.equal(
    typeof module.buildMediaMaterialReportSubmission,
    "function",
    "buildMediaMaterialReportSubmission is not implemented",
  );
  const rules = module.getMediaMaterialReportRules("1101", true);
  const submission = module.buildMediaMaterialReportSubmission(rules, {
    ...submissionValues,
    notes: [],
  });

  assert.equal(rules.showNotes, false);
  assert.equal(hasOwn(submission.actionPayload, "notes"), true);
  assert.deepEqual(submission.actionPayload.notes, []);
});

test("preserves the existing payload fields for a control service", async () => {
  const module = await loadRules();
  assert.equal(
    typeof module.buildMediaMaterialReportSubmission,
    "function",
    "buildMediaMaterialReportSubmission is not implemented",
  );
  const rules = module.getMediaMaterialReportRules("1002", false);
  const submission = module.buildMediaMaterialReportSubmission(
    rules,
    submissionValues,
  );

  assert.equal(hasOwn(submission, "approvalComment"), true);
  assert.equal(hasOwn(submission.actionPayload, "ageClassification"), true);
  assert.equal(hasOwn(submission.actionPayload, "detailedReport"), true);
  assert.equal(hasOwn(submission.actionPayload, "classificationIds"), true);
  assert.equal(hasOwn(submission.actionPayload, "notes"), true);
});
