import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const definitions = [
  ["src/components/designable/src/components/AcquaintanceForm/AcquaintanceFormField.tsx", "ARABIC_NAME_PATTERN", false, false],
  ["src/pages/ContentLibrary/components/BlockedAuthors/index.tsx", "ARABIC_AUTHOR_NAME_PATTERN", false, false],
  ["src/pages/RoleDetails/index.tsx", "ROLE_NAME_AR_FILTER_PATTERN", true, false],
  ["src/utils/isPureArabic.ts", "pureArabicRegex", false, false],
  ["src/pages/TeamManagement/components/InspectionTaskModal/utils/validation.ts", "ARABIC_LETTER_REGEX", false, true],
  ["src/pages/InspectionTaskManagement/components/CreateTaskModal.tsx", "ARABIC_LETTER_REGEX", false, true],
];
const extract = (text, name) => {
  const root = ts.createSourceFile("source.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(root) === name) expression = node.initializer.getText(root);
    ts.forEachChild(node, visit);
  };
  visit(root);
  assert.ok(expression, name);
  return vm.runInNewContext(expression);
};
const accepts = (pattern, value, filter) => {
  pattern.lastIndex = 0;
  return filter ? value.replace(pattern, "") === value : pattern.test(value);
};
for (const [file, name, filter, lettersOnly] of definitions) {
  const before = extract(execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }), name);
  const after = extract(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), name);
  test(`${name}: preserves the old accepted set and adds only Arabic characters`, () => {
    let additions = 0;
    for (let point = 0; point <= 0x10ffff; point++) {
      const character = String.fromCodePoint(point);
      const oldValid = accepts(before, character, filter);
      const newValid = accepts(after, character, filter);
      if (oldValid) assert.equal(newValid, true, `${file}: lost U+${point.toString(16)}`);
      if (newValid && !oldValid) {
        additions++;
        assert.equal(/^\p{Script_Extensions=Arabic}$/u.test(character), true, `Non-Arabic addition U+${point.toString(16)}`);
        if (lettersOnly) assert.equal(/^[\p{L}\p{M}]$/u.test(character), true);
      }
    }
    assert.ok(additions > 0);
    for (const value of ["م", "ـ", "ُ", "ࡰ"]) assert.equal(accepts(after, value, filter), true);
    for (const value of ["J", "é", "John"]) assert.equal(accepts(after, value, filter), false);
    if (!lettersOnly) {
      assert.equal(accepts(after, "مــوزه المــرر", filter), true);
      for (const value of ["", "123", "١٢٣", "!!!", " ", "-", "'"]) {
        assert.equal(accepts(after, value, filter), accepts(before, value, filter), `${file}: unrelated behavior ${value}`);
      }
    }
  });
}

test("Arabic role truncation cannot produce half of a supplementary character", async () => {
  const file = "src/pages/RoleDetails/index.tsx";
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const root = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["ROLE_NAME_MAX_LENGTH", "ROLE_NAME_AR_FILTER_PATTERN", "normalizeRoleNameAr"]);
  const declarations = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && names.has(node.name.getText(root))) declarations.push(`const ${node.getText(root)};`);
    ts.forEachChild(node, visit);
  };
  visit(root);
  const code = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const normalize = vm.runInNewContext(`${code}\nnormalizeRoleNameAr;`);
  const letter = "\u{1EE00}";
  assert.equal(normalize("ب".repeat(98) + letter), "ب".repeat(98) + letter);
  assert.equal(normalize("ب".repeat(99) + letter), "ب".repeat(99));
  assert.equal(normalize("ب".repeat(101)), "ب".repeat(100));
});
