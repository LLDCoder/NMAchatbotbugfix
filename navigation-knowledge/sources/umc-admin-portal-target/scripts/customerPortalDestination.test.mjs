import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync("src/pages/AddNewService/index.tsx", "utf8");
const parsed = ts.createSourceFile("index.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["getNormalizedOptionalText", "getCustomerPortalMediaLicenseUrl"]);
const functions = parsed.statements.filter(statement => ts.isVariableStatement(statement) &&
  statement.declarationList.declarations.some(declaration => names.has(declaration.name.getText(parsed))))
  .map(statement => statement.getText(parsed)).join("\n");
const compiled = ts.transpileModule(functions.replaceAll("import.meta.env", "env"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const resolve = (origin, env) => new Function("window", "env", compiled +
  "\nreturn getCustomerPortalMediaLicenseUrl('123', '302');")({ location: { origin } }, env);

test("portal destination follows configuration except localhost development", () => {
  const env = { DEV: false, VITE_CUSTOMER_PORTAL_URL: "https://customer.example" };
  const expected = "https://customer.example/services/media-license?serviceId=123&serviceCode=302";
  assert.equal(resolve("https://umc-adminportal.sol.daypop.ai", env), expected);
  assert.equal(resolve("http://localhost:5173", env), expected);
  assert.equal(resolve("http://localhost:5173", { ...env, DEV: true }),
    "http://localhost:5174/services/media-license?serviceId=123&serviceCode=302");
  assert.equal(resolve("https://admin.example", { DEV: false }), "");
  assert.equal(resolve("https://admin.example", { ...env, VITE_CUSTOMER_PORTAL_URL: "invalid" }), "");
});
