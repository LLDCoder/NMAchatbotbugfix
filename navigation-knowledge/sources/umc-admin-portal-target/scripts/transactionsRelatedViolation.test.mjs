import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const financeSource = readFileSync("src/services/finance.ts", "utf8");
const detailSource = readFileSync(
  "src/pages/TransactionsDetail/index.tsx",
  "utf8",
);

test("models and displays the verified related violation fields for fine details", () => {
  assert.match(financeSource, /export interface RelatedViolation/);
  assert.match(
    financeSource,
    /relatedViolation\?: RelatedViolation \| null/,
  );
  assert.match(
    detailSource,
    /const relatedViolation = detail\.relatedViolation/,
  );
  assert.match(detailSource, /relatedViolation\?\.violationNo/);
  assert.match(detailSource, /relatedViolation\?\.violationId/);
  assert.match(detailSource, /relatedViolation\?\.violationTypeObj/);
  assert.match(detailSource, /relatedViolation\?\.violationTime/);
  assert.match(
    detailSource,
    /relatedViolation\?\.beforeAppealAdjustedFineAmount/,
  );
  assert.match(detailSource, /relatedViolation\?\.inspectorName/);
  assert.match(detailSource, /relatedViolation\?\.entityName/);
});
