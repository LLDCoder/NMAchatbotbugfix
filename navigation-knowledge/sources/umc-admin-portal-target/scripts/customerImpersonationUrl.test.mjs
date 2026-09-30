import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourcePath = new URL(
  "../src/pages/CustomerManagement/customerImpersonationUrl.ts",
  import.meta.url,
);
const source = await readFile(sourcePath, "utf8");
const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const { createCustomerImpersonationUrlBuilder } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("normalizes portal trailing slashes and encodes impersonation codes", () => {
  const expected =
    "https://services.nma.gov.ae/impersonation?code=a%2Bb%2Fc%3D%3D";

  assert.equal(
    createCustomerImpersonationUrlBuilder("https://services.nma.gov.ae")(
      "a+b/c==",
    ),
    expected,
  );
  assert.equal(
    createCustomerImpersonationUrlBuilder("https://services.nma.gov.ae/")(
      "a+b/c==",
    ),
    expected,
  );
});
