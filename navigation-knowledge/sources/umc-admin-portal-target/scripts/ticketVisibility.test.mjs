import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const source = await readFile(sourcePath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "export {};";
    throw error;
  });
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

const visibility = await loadTypeScriptModule(
  "../src/pages/Tickets/utils/ticketVisibility.ts",
);

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("hides customer conversations from business department users", () => {
  assert.equal(typeof visibility.getVisibleTicketConversations, "function");

  const records = [1, 2, 3, 4, 5, 6, 7].map((surceTypeId) => ({
    surceTypeId,
  }));

  assert.deepEqual(
    visibility
      .getVisibleTicketConversations(records, false)
      .map((record) => record.surceTypeId),
    [3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    visibility
      .getVisibleTicketConversations(records, true)
      .map((record) => record.surceTypeId),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test("protects reopened department actions without hiding ordinary tasks", () => {
  assert.equal(typeof visibility.canShowDepartmentProcessActions, "function");

  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      isCurrentHandler: true,
    }),
    true,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: 1,
      isCurrentHandler: false,
    }),
    false,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: 0,
      isCurrentHandler: false,
    }),
    true,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: -1,
      isCurrentHandler: false,
    }),
    false,
  );
  for (const reopenTimes of [null, undefined, "0"]) {
    assert.equal(
      visibility.canShowDepartmentProcessActions({
        enquiryStatusId: 3,
        isCustomerHappiness: false,
        reopenTimes,
        isCurrentHandler: false,
      }),
      false,
    );
  }
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: 1,
    }),
    false,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: null,
      isCurrentHandler: false,
      requireCurrentHandler: true,
    }),
    false,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: false,
      reopenTimes: null,
      isCurrentHandler: true,
      requireCurrentHandler: true,
    }),
    true,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 3,
      isCustomerHappiness: true,
      isCurrentHandler: true,
    }),
    false,
  );
  assert.equal(
    visibility.canShowDepartmentProcessActions({
      enquiryStatusId: 6,
      isCustomerHappiness: false,
      isCurrentHandler: true,
    }),
    false,
  );
});

test("requires team todo context, leadership, and an active status to reassign", () => {
  assert.equal(typeof visibility.canShowTeamTaskReassignAction, "function");

  for (const enquiryStatusId of [1, 2, 3, 4]) {
    assert.equal(
      visibility.canShowTeamTaskReassignAction({
        enquiryStatusId,
        isLeader: true,
        isTeamTaskTodo: true,
      }),
      true,
    );
  }
  assert.equal(
    visibility.canShowTeamTaskReassignAction({
      enquiryStatusId: 3,
      isLeader: false,
      isTeamTaskTodo: true,
    }),
    false,
  );
  assert.equal(
    visibility.canShowTeamTaskReassignAction({
      enquiryStatusId: 3,
      isLeader: true,
      isTeamTaskTodo: false,
    }),
    false,
  );
  for (const enquiryStatusId of [5, 6, 7]) {
    assert.equal(
      visibility.canShowTeamTaskReassignAction({
        enquiryStatusId,
        isLeader: true,
        isTeamTaskTodo: true,
      }),
      false,
    );
  }
});

test("wires filtered conversations into every communication render decision", async () => {
  const source = await readSource(
    "../src/pages/TicketsDetails/components/CommunicationRecords/index.tsx",
  );

  assert.match(source, /const accessibleRecords = getVisibleTicketConversations/);
  assert.match(source, /accessibleRecords\.length > DEFAULT_VISIBLE_MESSAGE_COUNT/);
  assert.match(source, /\? accessibleRecords\s*: accessibleRecords\.slice/);
  assert.match(source, /if \(accessibleRecords\.length > 0\)/);
  assert.match(source, /renderChatBoxItem\(visibleRecords\)/);
});

test("wires strict detail and team-task authorization into the footer", async () => {
  const source = await readSource("../src/pages/TicketsDetails/index.tsx");

  assert.equal(source.match(/requireCurrentHandler: true/g)?.length, 2);
  assert.match(source, /const canShowTeamTaskReassign = canShowTeamTaskReassignAction/);
  assert.match(source, /\) : canShowTeamTaskReassign \? \(/);
});
