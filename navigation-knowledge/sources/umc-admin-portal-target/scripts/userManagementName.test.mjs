import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const path = new URL("../src/pages/UserManagement/validation.ts", import.meta.url);
const { outputFiles } = await build({entryPoints:[path.pathname], bundle:true, platform:"node", format:"esm", write:false});
const code = outputFiles[0].text;
const { getTextError, trimText, getFieldsToUnlock } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("international names preserve text and count Unicode code points", () => {
  for (const value of ["مــوزه المــرر", "مُوزة", "José", "John Smith", "𐐀𐐁", "A🙂", "Anne-Marie", "A1", "A\u200cB", "A\u200dB"]) assert.equal(getTextError(value, "name"), null, value);
  for (const value of ["", "  ", "\u00a0"]) assert.equal(getTextError(value, "name"), "required");
  for (const value of [" A ", "𐐀", "A".repeat(51)]) assert.equal(getTextError(value, "name"), "length");
  assert.equal(getTextError("𐐀".repeat(50), "name"), null);
  for (const value of ["١٢٣", "ــ", "🙂🙂", "ُّ", "--"]) assert.equal(getTextError(value, "name"), "letter");
  for (const value of ["A\nB", "A\tB", "A\u202eB", "A\ufeffB", "A\ud800", "A\ue000", "A\u0378"]) assert.equal(getTextError(value, "name"), "characters");
  assert.equal(trimText("\u00a0 A  B \u00a0"), "A  B");
});
test("department names retain language and length constraints", () => {
  assert.equal(getTextError(" Dept-2 ", "departmentEn"), null);
  assert.equal(getTextError("قسم 2،", "departmentAr"), null);
  assert.equal(getTextError("ࡰࡰ", "departmentAr"), null);
  assert.equal(getTextError("قسم", "departmentEn"), "characters");
  assert.equal(getTextError("Dept", "departmentAr"), "characters");
  for (const kind of ["departmentEn", "departmentAr"]) {
    const char = kind === "departmentEn" ? "A" : "م";
    assert.equal(getTextError(char.repeat(100), kind), null);
    assert.equal(getTextError(char.repeat(101), kind), "length");
    assert.equal(getTextError("12", kind), null);
  }
});
test("only supported top-level fields can unlock, without duplicates", () => {
  assert.deepEqual(getFieldsToUnlock([["email"], ["gender"], ["department"], ["email"], ["nested", "firstName"]]), ["email", "gender"]);
  assert.deepEqual(getFieldsToUnlock([]), []);
});
