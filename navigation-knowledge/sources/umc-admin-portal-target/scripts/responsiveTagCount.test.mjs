import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const file = new URL("../src/components/common/SelectAllDropdown/responsiveTagCount.ts", import.meta.url);
const { code } = await transformWithEsbuild(await readFile(file, "utf8"), file.pathname, { loader: "ts", format: "esm" });
const { getVisibleTagCount } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("responsive tags fit, collapse, resize and preserve a long first tag", () => {
  const rest = () => 30;
  assert.equal(getVisibleTagCount([], 200, 6, rest), 0);
  assert.equal(getVisibleTagCount([80, 80], 166, 6, rest), 2);
  assert.equal(getVisibleTagCount([80, 80], 150, 6, rest), 1);
  assert.equal(getVisibleTagCount([300, 80], 150, 6, rest), 1);
  assert.equal(getVisibleTagCount([80, 80, 80], 250, 6, rest), 2);
  assert.equal(getVisibleTagCount([80, 80, 80], 252, 6, rest), 3);
  assert.equal(getVisibleTagCount([80, 80], 0, 6, rest), 0);
});

test("uses the measured width of the actual remainder, including +10", () => {
  const widths = Array(12).fill(40);
  const rest = (count) => count >= 10 ? 40 : 30;
  assert.equal(getVisibleTagCount(widths, 125, 6, rest), 1);
  assert.equal(getVisibleTagCount(widths, 132, 6, rest), 2);
  assert.equal(getVisibleTagCount(widths, 168, 6, rest), 3);
});
