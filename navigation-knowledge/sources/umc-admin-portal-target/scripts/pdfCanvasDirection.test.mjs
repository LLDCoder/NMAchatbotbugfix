import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/components/common/PdfScrollPreview/index.tsx",
  "utf8",
);

test("PDF canvas isolates rendering from the application text direction", () => {
  const canvas = (source.match(/<canvas[\s\S]*?\/>/g) || []).find((tag) =>
    tag.includes("ref={canvasRef}"),
  ) || "";

  assert.match(canvas, /\bdir="ltr"/);
});
