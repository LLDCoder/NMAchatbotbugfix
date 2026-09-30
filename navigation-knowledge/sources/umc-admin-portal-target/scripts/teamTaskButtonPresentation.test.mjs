import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const teamTaskActionsSource = readFileSync(
  "src/pages/TeamManagement/components/InspectionTeamTasksPanel/hooks/useInspectionTeamTaskActions.ts",
  "utf8",
);
const taskActionPresentationSource = readFileSync(
  "src/pages/InspectionCommon/taskActions.ts",
  "utf8",
);
const taskDetailStylesSource = readFileSync(
  "src/pages/InspectionTaskDetails/index.less",
  "utf8",
);
const violationDetailSource = readFileSync(
  "src/pages/InspectionViolationDetails/index.tsx",
  "utf8",
);
const violationDetailStylesSource = readFileSync(
  "src/pages/InspectionViolationDetails/index.less",
  "utf8",
);
const customButtonStylesSource = readFileSync(
  "src/components/common/CustomButton/index.less",
  "utf8",
);
const inspectionStartVisitStylesSource = readFileSync(
  "src/pages/InspectionStartVisit/index.less",
  "utf8",
);
const financialRefundDetailsStylesSource = readFileSync(
  "src/pages/FinancialRefundsDetails/index.less",
  "utf8",
);

const loadTeamTaskActionKeysModule = async () => {
  const modulePath =
    "src/pages/TeamManagement/components/InspectionTeamTasksPanel/taskActionKeys.ts";
  assert.ok(
    existsSync(modulePath),
    "Expected Team Task list actions to have a testable API-permission policy",
  );

  const source = readFileSync(modulePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;

  return import(moduleUrl);
};

test("shows Team Task list actions only when the API provides them", async () => {
  const { getInspectionTeamTaskListActionKeys } =
    await loadTeamTaskActionKeysModule();

  assert.deepEqual(
    getInspectionTeamTaskListActionKeys({
      taskTab: "todo",
      statusCode: "PENDING_VISIT",
      editable: true,
      availableActions: ["edit", "cancel", "duplicate"],
    }),
    ["edit", "duplicate", "cancel"],
  );
  assert.deepEqual(
    getInspectionTeamTaskListActionKeys({
      taskTab: "todo",
      statusCode: "IN_PROGRESS",
      editable: false,
      availableActions: [],
    }),
    [],
  );
  assert.deepEqual(
    getInspectionTeamTaskListActionKeys({
      taskTab: "completed",
      statusCode: "COMPLETED",
      editable: false,
      availableActions: ["viewReport"],
    }),
    ["viewReport"],
  );
  assert.deepEqual(
    getInspectionTeamTaskListActionKeys({
      taskTab: "completed",
      statusCode: "ACCESS_FAILED",
      editable: false,
      availableActions: ["duplicate", "viewReport"],
    }),
    ["viewReport", "duplicate"],
  );
  assert.deepEqual(
    getInspectionTeamTaskListActionKeys({
      taskTab: "completed",
      statusCode: "CANCELLED",
      editable: false,
      availableActions: null,
    }),
    [],
  );
});

test("keeps the To Do cancel action inside the overflow menu", () => {
  assert.match(
    teamTaskActionsSource,
    /key:\s*"cancel",[\s\S]*?label:[\s\S]*?placement:\s*"overflow",[\s\S]*?onClick:/,
  );
});

test("orders and groups task detail actions according to the Figma footer", () => {
  const orderMatch = taskActionPresentationSource.match(
    /INSPECTION_TASK_ACTION_ORDER[^=]*=\s*\[([\s\S]*?)\];/,
  );
  assert.ok(orderMatch, "Expected the inspection task action order constant");

  const actionOrder = Array.from(
    orderMatch[1].matchAll(/'([^']+)'/g),
    (match) => match[1],
  );
  assert.deepEqual(
    actionOrder.filter((action) => ["cancel", "duplicate", "edit"].includes(action)),
    ["cancel", "duplicate", "edit"],
  );
  assert.deepEqual(
    actionOrder.filter((action) => ["duplicate", "viewReport"].includes(action)),
    ["duplicate", "viewReport"],
  );

  const actionGroupMatch = taskActionPresentationSource.match(
    /export const getInspectionTaskActionGroup[\s\S]*?=>\s*\{([\s\S]*?)\n\};/,
  );
  assert.ok(actionGroupMatch, "Expected the task action group function");
  assert.match(
    actionGroupMatch[1],
    /\[[\s\S]*?'edit'[\s\S]*?'viewReport'[\s\S]*?\]\.includes\(actionKey\)\)\s*return\s*'primary'/,
  );
});

test("uses the Figma task detail button dimensions", () => {
  const baseButtonBlock = taskDetailStylesSource.match(
    /\.inspection-task-details__action\.ant-btn\s*\{([\s\S]*?)\/\* rwd-ramp \*\//,
  );
  assert.ok(baseButtonBlock, "Expected the task detail action button style block");
  assert.match(baseButtonBlock[1], /min-width:\s*128px;/);
  assert.match(baseButtonBlock[1], /height:\s*48px;/);
  assert.match(baseButtonBlock[1], /padding:\s*0 20px;/);

  const primaryButtonBlock = taskDetailStylesSource.match(
    /\.inspection-task-details__action--primary\.ant-btn-primary\s*\{([\s\S]*?)\}/,
  );
  assert.ok(primaryButtonBlock, "Expected the primary action button style block");
  assert.match(primaryButtonBlock[1], /linear-gradient\(/);

  const dangerButtonBlock = taskDetailStylesSource.match(
    /\.inspection-task-details__action--danger\.ant-btn\s*\{([\s\S]*?)\}/,
  );
  assert.ok(dangerButtonBlock, "Expected the danger action button style block");
  assert.match(dangerButtonBlock[1], /min-width:\s*120px;/);
});

test("renders the last violation detail action as solid and earlier actions as outline", () => {
  assert.match(
    violationDetailSource,
    /const getButtonClassName = \(index: number\) =>[\s\S]*?index === actions\.length - 1[\s\S]*?'inspection-violation-details__footer-button--primary'[\s\S]*?'inspection-violation-details__footer-button--outline'/,
  );
  assert.match(
    violationDetailSource,
    /actions\.map\(\(action, index\) =>[\s\S]*?className=\{getButtonClassName\(index\)\}/,
  );
});

test("matches the refund detail footer button colors in default and interactive states", () => {
  const getRuleBody = (source, selector) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `Expected style rule for ${selector}`);
    return match[1];
  };

  const taskOutline = getRuleBody(
    taskDetailStylesSource,
    ".inspection-task-details__action--secondary.ant-btn",
  );
  const taskOutlineInteractive = getRuleBody(
    taskDetailStylesSource,
    ".inspection-task-details__action--secondary.ant-btn:focus",
  );
  const violationOutline = getRuleBody(
    violationDetailStylesSource,
    ".inspection-violation-details__footer-button--outline.ant-btn",
  );
  const violationOutlineInteractive = getRuleBody(
    violationDetailStylesSource,
    ".inspection-violation-details__footer-button--outline.ant-btn:focus",
  );
  const violationPrimaryInteractive = getRuleBody(
    violationDetailStylesSource,
    ".inspection-violation-details__footer-button--primary.ant-btn:focus",
  );

  assert.match(taskOutline, /border-color:\s*#92722a;/);
  assert.match(taskOutline, /color:\s*#92722a;/);
  assert.match(taskOutline, /background:\s*transparent;/);
  assert.match(taskOutlineInteractive, /border-color:\s*#92722a;/);
  assert.match(taskOutlineInteractive, /color:\s*#92722a;/);
  assert.match(taskOutlineInteractive, /background:\s*transparent;/);
  assert.match(violationOutline, /border:\s*1px solid #92722a;/);
  assert.match(violationOutline, /background:\s*transparent;/);
  assert.match(violationOutline, /color:\s*#92722a;/);
  assert.match(violationOutlineInteractive, /border-color:\s*#92722a;/);
  assert.match(violationOutlineInteractive, /background:\s*transparent;/);
  assert.match(violationOutlineInteractive, /color:\s*#92722a;/);
  assert.match(
    violationPrimaryInteractive,
    /background:\s*linear-gradient\(90deg, #9e7538 0%, #c19453 100%\);/,
  );
});

test("keeps shared and remaining detail footer buttons on the refund color states", () => {
  assert.match(
    customButtonStylesSource,
    /\.custom-button-primary[\s\S]*?&:hover:not\(:disabled\)[\s\S]*?linear-gradient\(to right, #9e7538, #c19453\)/,
  );
  assert.match(
    customButtonStylesSource,
    /\.custom-button-outline[\s\S]*?&:hover:not\(:disabled\)[\s\S]*?background-color:\s*transparent;[\s\S]*?border-color:\s*@primary-color;[\s\S]*?color:\s*@primary-color;/,
  );
  assert.match(
    inspectionStartVisitStylesSource,
    /\.inspection-start-visit__action--secondary\.ant-btn\s*\{[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    inspectionStartVisitStylesSource,
    /\.inspection-start-visit__action--secondary\.ant-btn:focus\s*\{[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    financialRefundDetailsStylesSource,
    /&\.is-outline\s*\{[\s\S]*?color:\s*#92722a;[\s\S]*?background:\s*transparent;[\s\S]*?border-color:\s*#92722a;/,
  );
});
