import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/common/SelectAllDropdown/index.tsx", import.meta.url), "utf8");
const expression = source.match(/const selectAllCount = ([\s\S]*?);\n/)?.[1];
assert.ok(expression);
const getCount = new Function("options", "filteredOptions", `return (${expression});`);

test("sums displayed counts and follows the visible search results", () => {
  const options = [69, 64, 23, 20, 8, 11, 5].map(establishmentCount => ({ establishmentCount }));
  assert.equal(getCount(options, options), 200);
  assert.equal(getCount(options, options.slice(0, 2)), 133);
  assert.equal(getCount(options, []), 0);
  assert.equal(getCount([{ establishmentCount: 0 }], [{ establishmentCount: 0 }]), 0);
});

test("does not add counts to name-only dropdowns", () => {
  assert.equal(getCount([{ label: "Dubai" }], [{ label: "Dubai" }]), undefined);
  assert.equal(getCount([], []), undefined);
});
