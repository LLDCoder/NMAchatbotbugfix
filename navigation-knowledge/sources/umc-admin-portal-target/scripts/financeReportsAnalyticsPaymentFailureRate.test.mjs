import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const financeReportsServicePath = new URL(
  "../src/services/financeReportsAnalytics.ts",
  import.meta.url,
);

test("maps Payment Failure Rate from the API paymentFailureRate field", async () => {
  const source = await readFile(financeReportsServicePath, "utf8");

  assert.match(source, /paymentFailureRate\?: string;/);
  assert.match(
    source,
    /const mapPaymentFailureRate = \(\s*paymentFailureRate\?: string,?\s*\): CardHeaderMetric => \(\{[\s\S]*?value: paymentFailureRate \?\? "--"/,
  );
  assert.match(
    source,
    /paymentsByTypeMetric: mapPaymentFailureRate\(response\.data\?\.paymentFailureRate\)/,
  );
});
