import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const path = new URL("../src/components/common/MobileNumberInput/components/FormMobileNumberInput.tsx", import.meta.url);
const source = ts.createSourceFile(path.pathname, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "resolvedDefaultCountryCode") expression = node.initializer.getText(source);
  ts.forEachChild(node, visit);
};
visit(source);
assert.ok(expression);
test("the actual form adapter respects an explicitly empty default country", () => {
  const resolve = (defaultCountryCode) => vm.runInNewContext(expression, { defaultCountryCode, DEFAULT_COUNTRY_DIAL_CODE: "+971" });
  assert.equal(resolve(undefined), "+971");
  assert.equal(resolve(""), "");
  assert.equal(resolve("  "), "");
  assert.equal(resolve(" +966 "), "+966");
});
