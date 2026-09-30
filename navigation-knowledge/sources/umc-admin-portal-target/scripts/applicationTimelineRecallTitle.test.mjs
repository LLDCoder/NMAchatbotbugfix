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

const { isRecallApprovalNode } = await loadTypeScriptModule(
  "../src/pages/ContentApplicationsDetails/components/ApplicationTimeline/timelineNode.ts",
);

test("recognizes recall approval timeline title variants", () => {
  const variants = [
    "Recall",
    "Recalled",
    "Recall Approval",
    "Recalled Approval",
    "RECALL_APPROVAL",
    "recall-approval",
  ];

  variants.forEach((value) => {
    assert.equal(isRecallApprovalNode({ title: value }), true);
    assert.equal(isRecallApprovalNode({ nodeType: value }), true);
  });
});

test("does not classify other approval nodes as recalled", () => {
  assert.equal(isRecallApprovalNode({ title: "Initial Approval" }), false);
  assert.equal(isRecallApprovalNode({ title: "Final Approval" }), false);
  assert.equal(isRecallApprovalNode({ nodeType: "Review" }), false);
});
