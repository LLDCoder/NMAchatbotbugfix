import assert from "node:assert/strict";
import test from "node:test";
import { resolveInspectionOverviewIdentity } from "../src/pages/InspectionCommon/inspectionOverviewIdentity.ts";

test("prefers Emirates ID when every identity field is present", () => {
  assert.deepEqual(
    resolveInspectionOverviewIdentity({
      emiratesId: "784-1990-1234567-1",
      passportNumber: "P1234567",
      uid: "123456789",
    }),
    {
      field: "emiratesId",
      labelKey: "applicationOverviewCards.emiratesId",
      value: "784-1990-1234567-1",
    },
  );
});

test("prefers Passport Number over UID when Emirates ID is blank", () => {
  assert.deepEqual(
    resolveInspectionOverviewIdentity({
      emiratesId: "   ",
      passportNumber: " EK1290000 ",
      uid: "123456789",
    }),
    {
      field: "passportNumber",
      labelKey: "applicationOverviewCards.passport",
      value: "EK1290000",
    },
  );
});

test("uses UID when it is the only populated identity field", () => {
  assert.deepEqual(
    resolveInspectionOverviewIdentity({ uid: " 123456789 " }),
    {
      field: "uid",
      labelKey: "applicationOverviewCards.uid",
      value: "123456789",
    },
  );
});

test("returns null when every identity field is empty", () => {
  assert.equal(
    resolveInspectionOverviewIdentity({
      emiratesId: null,
      passportNumber: "",
      uid: "   ",
    }),
    null,
  );
});
