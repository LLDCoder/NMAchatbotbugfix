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

const loadFahrServiceWithRequest = async (request) => {
  const sourcePath = new URL("../src/services/fahr.ts", import.meta.url);
  const source = (await readFile(sourcePath, "utf8")).replace(
    'import request from "@/utils/request";',
    "const request = globalThis.__fahrTestRequest;",
  );
  globalThis.__fahrTestRequest = request;
  const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}#${Date.now()}`;
  try {
    return await import(moduleUrl);
  } finally {
    delete globalThis.__fahrTestRequest;
  }
};

const {
  getFahrExternalDecisionDisabledReason,
  getFahrRejectReasonFile,
  resolveFahrExternalApprovalRoute,
  resolveFahrExternalDecisionRoute,
  shouldLoadFahrApplicationStatus,
} = await loadTypeScriptModule("../src/services/fahrPolicy.ts");

const { runWithSubmissionLock, submitExternalDecisionStages } =
  await loadTypeScriptModule(
    "../src/pages/Applications/utils/externalDecisionStages.ts",
  );
const { matchFahrTargetsForPartners } = await loadTypeScriptModule(
  "../src/pages/ApplicationsDetails/fahrTargets.ts",
);
const {
  FAHR_EXTERNAL_APPROVAL_SERVICE_CODES,
  isFahrExternalApprovalService,
} = await loadTypeScriptModule(
  "../src/pages/ApplicationsDetails/fahrServiceCodes.ts",
);
const eligibility = (overrides = {}) => ({
  applicationId: 10,
  eligible: true,
  requiresExternalApproval: true,
  requiresPersonSelection: false,
  showExternalApprovalDialog: false,
  status: "Eligible",
  ...overrides,
});

test("preserves the legacy external approval route for non-FAHR services", () => {
  assert.equal(resolveFahrExternalApprovalRoute(false), "legacyDialog");
});

test("opens the dialog when FAHR requires person selection", () => {
  assert.equal(
    resolveFahrExternalApprovalRoute(
      true,
      eligibility({ requiresPersonSelection: true }),
    ),
    "fahrDialog",
  );
});

test("uses the direct route only for eligible external approval", () => {
  assert.equal(
    resolveFahrExternalApprovalRoute(true, eligibility()),
    "direct",
  );
  assert.equal(
    resolveFahrExternalApprovalRoute(
      true,
      eligibility({ requiresExternalApproval: false }),
    ),
    "legacyDialog",
  );
});

test("requires readiness to match the requested external decision", () => {
  assert.equal(
    resolveFahrExternalDecisionRoute(
      eligibility(),
      { externalReviewAction: "Approve" },
      "approve",
    ),
    "external",
  );
  assert.equal(
    resolveFahrExternalDecisionRoute(
      eligibility(),
      { externalReviewAction: "Reject" },
      "approve",
    ),
    "blocked",
  );
});

test("prefers the readiness disabled reason for blocked decisions", () => {
  assert.equal(
    getFahrExternalDecisionDisabledReason({
      externalReviewAction: null,
      disabledReason: "  Waiting for all FAHR decisions.  ",
    }),
    "Waiting for all FAHR decisions.",
  );
  assert.equal(
    getFahrExternalDecisionDisabledReason({
      externalReviewAction: null,
      disabledReason: " ",
    }),
    null,
  );
});

test("uses one attachment key for the FAHR reject decision", () => {
  assert.equal(getFahrRejectReasonFile(["", " first-key ", "second-key"]), "first-key");
  assert.equal(getFahrRejectReasonFile(" first-key ; second-key "), "first-key");
  assert.equal(getFahrRejectReasonFile([]), undefined);
});

test("retries only the workflow stage after the FAHR stage succeeds", async () => {
  let workflowCalls = 0;
  let externalCalls = 0;
  let externalDecisionCompleted = false;
  const callOrder = [];
  const submit = () =>
    submitExternalDecisionStages({
      externalDecisionCompleted,
      submitExternalDecision: async () => {
        externalCalls += 1;
        callOrder.push("external");
      },
      onExternalDecisionCompleted: () => {
        externalDecisionCompleted = true;
      },
      submitWorkflow: async () => {
        workflowCalls += 1;
        callOrder.push("workflow");
        if (workflowCalls === 1) throw new Error("workflow failed");
      },
    });

  await assert.rejects(submit);
  await submit();
  assert.deepEqual(callOrder, ["external", "workflow", "workflow"]);
  assert.equal(externalCalls, 1);
  assert.equal(workflowCalls, 2);
});

test("stops before the workflow stage when the FAHR stage fails", async () => {
  let workflowCalls = 0;

  await assert.rejects(() =>
    submitExternalDecisionStages({
      externalDecisionCompleted: false,
      submitExternalDecision: async () => {
        throw new Error("external failed");
      },
      onExternalDecisionCompleted: () => {},
      submitWorkflow: async () => {
        workflowCalls += 1;
      },
    }),
  );

  assert.equal(workflowCalls, 0);
});

test("locks concurrent modal submissions synchronously", async () => {
  const lock = { current: false };
  let submitCalls = 0;
  let releaseFirstSubmit;
  const firstSubmitGate = new Promise((resolve) => {
    releaseFirstSubmit = resolve;
  });
  const submit = () =>
    runWithSubmissionLock(lock, async () => {
      submitCalls += 1;
      if (submitCalls === 1) await firstSubmitGate;
    });

  const firstSubmit = submit();
  await submit();
  assert.equal(submitCalls, 1);
  assert.equal(lock.current, true);

  releaseFirstSubmit();
  await firstSubmit;
  await submit();
  assert.equal(submitCalls, 2);
  assert.equal(lock.current, false);
});

test("releases the modal submission lock after a failed request", async () => {
  const lock = { current: false };

  await assert.rejects(() =>
    runWithSubmissionLock(lock, async () => {
      throw new Error("submit failed");
    }),
  );

  assert.equal(lock.current, false);
});

test("matches establishment partners by the backend personRefId contract", () => {
  const targets = [
    { targetId: 1, personType: "EstablishmentPartner", personRefId: 901 },
    { targetId: 2, personType: "ChiefEditor", personRefId: 901 },
    { targetId: 3, personType: "EstablishmentPartner", personRefId: 902 },
  ];
  const reviewDetails = { targets };

  const matches = matchFahrTargetsForPartners(
    reviewDetails,
    "EstablishmentPartner",
    [{ id: " 901 " }, { id: 902 }, { id: 999 }],
  );

  assert.deepEqual(
    matches.map((target) => target?.targetId),
    [1, 3, undefined],
  );
});

test("gates FAHR logic with the complete supported service set", () => {
  assert.deepEqual(FAHR_EXTERNAL_APPROVAL_SERVICE_CODES, [
    "4",
    "804",
    "801",
    "905",
    "1201",
    "1205",
    "1801",
    "8007",
    "8008",
    "901",
    "903",
    "8006",
  ]);
  for (const serviceCode of FAHR_EXTERNAL_APPROVAL_SERVICE_CODES) {
    assert.equal(isFahrExternalApprovalService(serviceCode), true);
  }
  assert.equal(isFahrExternalApprovalService("9999"), false);
  assert.equal(isFahrExternalApprovalService(undefined), false);
});

test("uses the FAHR service method, path, body, and blob contract", async () => {
  const calls = [];
  const response = {
    isSuccess: true,
    statusCode: 200,
    message: "",
    data: {},
  };
  const request = {
    get: async (...args) => {
      calls.push(["get", ...args]);
      return response;
    },
    post: async (...args) => {
      calls.push(["post", ...args]);
      return response;
    },
    getRaw: async (...args) => {
      calls.push(["getRaw", ...args]);
      return { data: "blob" };
    },
  };
  const fahrService = await loadFahrServiceWithRequest(request);

  await fahrService.getFahrExternalReviewReadiness(42);
  await fahrService.submitFahrExternalReviewDecision(42, {
    decision: "Approved",
  });
  await fahrService.getFahrPermitFile(7);

  assert.deepEqual(calls[0], [
    "get",
    "/api/AdminFahr/Applications/42/ExternalReviewReadiness",
  ]);
  assert.deepEqual(calls[1], [
    "post",
    "/api/AdminFahr/Applications/42/ExternalReviewDecision",
    { decision: "Approved" },
  ]);
  assert.deepEqual(calls[2], [
    "getRaw",
    "/api/AdminFahr/Permits/7/Download",
    {},
    { responseType: "blob" },
  ]);
});

test("keeps NotRequired decisions on the workflow route", () => {
  assert.equal(
    resolveFahrExternalDecisionRoute(
      eligibility({ status: "NotRequired", eligible: false }),
      null,
      "reject",
    ),
    "workflow",
  );
});

test("keeps services outside the eligible FAHR flow on legacy routes", () => {
  const notRequired = eligibility({
    requiresExternalApproval: false,
    status: "Eligible",
  });

  assert.equal(
    resolveFahrExternalApprovalRoute(true, notRequired),
    "legacyDialog",
  );
  assert.equal(
    resolveFahrExternalDecisionRoute(notRequired, null, "approve"),
    "workflow",
  );
});

test("loads FAHR status only when external approval is required", () => {
  assert.equal(shouldLoadFahrApplicationStatus(eligibility()), true);
  assert.equal(
    shouldLoadFahrApplicationStatus(
      eligibility({ eligible: false, status: "AlreadyTriggered" }),
    ),
    true,
  );
  assert.equal(
    shouldLoadFahrApplicationStatus(
      eligibility({
        eligible: false,
        requiresExternalApproval: false,
        status: "NotRequired",
      }),
    ),
    false,
  );
});

test("uses uploaded URLs and person identifiers for FAHR bindings", async () => {
  const actionsSource = await readFile(
    new URL(
      "../src/pages/ApplicationsDetails/hooks/useFahrReviewActions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const slotsSource = await readFile(
    new URL(
      "../src/pages/ApplicationsDetails/hooks/useFahrFormilySlots.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(actionsSource, /return attachment\.url/);
  assert.doesNotMatch(
    slotsSource,
    /newPartnerTargets\[newIndividualPartnerIndex\]/,
  );
});

test("keeps an unknown FAHR status renderable", async () => {
  const statusSource = await readFile(
    new URL(
      "../src/pages/ApplicationsDetails/components/FahrReviewStatusTag/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(statusSource, /statusConfig\[status\] \|\| UNKNOWN_STATUS_CONFIG/);
  assert.match(statusSource, /Licensing\.fahrReview\.status\.unknown/);
});

test("wires both approval modals to the staged decision coordinator", async () => {
  const approveSource = await readFile(
    new URL(
      "../src/pages/Applications/components/ApproveModal/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const rejectSource = await readFile(
    new URL(
      "../src/pages/Applications/components/RejectModal/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(approveSource, /submitExternalDecisionStages\(\{/);
  assert.match(approveSource, /ExternaltaskApprovalAction\(/);
  assert.match(approveSource, /await onExternalApprove\(values\)/);
  assert.match(rejectSource, /submitExternalDecisionStages\(\{/);
  assert.match(rejectSource, /taskApprovalAction\(/);
  assert.match(rejectSource, /await onExternalReject\(values\)/);
  assert.match(rejectSource, /workflowAction: rejectAction\.action/);
});

test("opens the approval modal for FAHR external approve", async () => {
  const detailsPageSource = await readFile(
    new URL("../src/pages/ApplicationsDetails/index.tsx", import.meta.url),
    "utf8",
  );
  const listPageSource = await readFile(
    new URL("../src/pages/Applications/index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detailsPageSource, /setIsFahrDecisionFlow\(true\)/);
  assert.match(listPageSource, /setFahrDecisionApplicationId\(record\.id\)/);
  assert.match(detailsPageSource, /onExternalApprove=/);
  assert.match(listPageSource, /onExternalApprove=/);
});

test("loads detail readiness after eligibility and rechecks it on demand", async () => {
  const detailsHookSource = await readFile(
    new URL(
      "../src/pages/ApplicationsDetails/hooks/useFahrReviewDetails.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const detailsLoaderStart = detailsHookSource.indexOf(
    "const loadFahrReviewDetails =",
  );
  const effectStart = detailsHookSource.indexOf(
    "useEffect(() =>",
    detailsLoaderStart,
  );
  const detailsLoaderSource = detailsHookSource.slice(
    detailsLoaderStart,
    effectStart,
  );
  const eligibilityIndex = detailsLoaderSource.indexOf(
    "getFahrExternalApprovalEligibility(",
  );
  const statusIndex = detailsLoaderSource.indexOf("getFahrApplicationStatus(");

  assert.ok(detailsLoaderStart >= 0);
  assert.ok(effectStart > detailsLoaderStart);
  assert.ok(eligibilityIndex >= 0);
  assert.ok(statusIndex >= 0);
  assert.ok(eligibilityIndex < statusIndex);
  assert.match(
    detailsLoaderSource,
    /shouldLoadFahrApplicationStatus\(\s*eligibilityResponse\.data,?\s*\)/,
  );
  assert.match(
    detailsLoaderSource,
    /readinessEnabled[\s\S]*getFahrExternalReviewReadiness\(applicationId\)/,
  );
  assert.match(detailsHookSource, /const loadFahrReadiness = useCallback/);
  assert.match(
    detailsHookSource,
    /await getFahrExternalApprovalEligibility\(applicationId\);\s+if \(!isCurrent\(\)\) return null;/,
  );
  assert.match(
    detailsHookSource,
    /await getFahrExternalReviewReadiness\(applicationId\);\s+if \(!isCurrent\(\)\) return null;/,
  );
});

test("gates detail FAHR APIs and UI with service and eligibility checks", async () => {
  const detailsPageSource = await readFile(
    new URL("../src/pages/ApplicationsDetails/index.tsx", import.meta.url),
    "utf8",
  );
  const mainContentSource = await readFile(
    new URL(
      "../src/pages/ApplicationsDetails/MainContent/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    detailsPageSource,
    /const isFahrService = isFahrExternalApprovalService\(/,
  );
  assert.match(
    detailsPageSource,
    /readinessEnabled: details\?\.statusId == 11/,
  );
  assert.match(detailsPageSource, /!fahrEligibilityLoaded/);
  assert.match(detailsPageSource, /fahrReadinessLoading/);
  assert.match(
    detailsPageSource,
    /const isFahrFlowEnabled = isFahrEnabled && isFahrRequired/,
  );
  assert.match(
    mainContentSource,
    /fahrEnabled && isFahrEstablishmentPartnerService\(currentServiceCode\)/,
  );
});

test("enforces Fahr.Admin permission on list and detail FAHR entry points", async () => {
  const detailsPageSource = await readFile(
    new URL("../src/pages/ApplicationsDetails/index.tsx", import.meta.url),
    "utf8",
  );
  const listPageSource = await readFile(
    new URL("../src/pages/Applications/index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    detailsPageSource,
    /const hasFahrAdminPermission = canRenderButton\(\s*PERMISSION_CODES\.licensing\.fahr\.admin/,
  );
  assert.doesNotMatch(detailsPageSource, /hasFahrAdminPermission = true/);
  assert.match(
    listPageSource,
    /const hasFahrAdminPermission = canRenderDetailButton\(\s*PERMISSION_CODES\.licensing\.fahr\.admin/,
  );
  assert.match(
    listPageSource,
    /!isExtraApprove \|\| !isFahrService \|\| hasFahrAdminPermission/,
  );
  assert.match(listPageSource, /if \(!hasFahrAdminPermission\) return/);
});
