import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const require = createRequire(import.meta.url);
const sourcePath = fileURLToPath(
  new URL("../src/pages/BroadcastEdit/saveError.ts", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const { code } = await transformWithEsbuild(source, sourcePath, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { isSmsRecipientMobileMissingError } = module.exports;

test("recognizes the broadcast SMS recipient mobile error code", () => {
  assert.equal(
    isSmsRecipientMobileMissingError({
      isSuccess: false,
      errorCode: "SMS_RECIPIENT_MOBILE_MISSING",
    }),
    true,
  );
});

test("recognizes an Axios-style nested broadcast error response", () => {
  assert.equal(
    isSmsRecipientMobileMissingError({
      response: {
        data: {
          data: { errorCode: "sms_recipient_mobile_missing" },
        },
      },
    }),
    true,
  );
});

test("recognizes the legacy backend diagnostic without displaying it", () => {
  assert.equal(
    isSmsRecipientMobileMissingError({
      message:
        "Recipient mobile number is missing on the customer profile. The message could not be submitted to the SMS provider.",
    }),
    true,
  );
});

test("does not classify SMS content or unrelated failures as recipient errors", () => {
  assert.equal(
    isSmsRecipientMobileMissingError({
      smsen: "Recipient mobile number is missing on the customer profile.",
    }),
    false,
  );
  assert.equal(isSmsRecipientMobileMissingError({ message: "Request failed" }), false);
});
