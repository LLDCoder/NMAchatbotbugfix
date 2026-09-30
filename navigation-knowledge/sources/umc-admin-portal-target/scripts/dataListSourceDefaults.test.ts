import assert from "node:assert/strict";
import test from "node:test";
import {
  DATA_SOURCE_OPTIONS,
  getDefaultFieldsForDataSource,
} from "../src/components/designable/src/components/DataList/Setter/dataSourceDefaults.ts";

/**
 * These defaults are authored in the admin designer and published verbatim into
 * the service form schema, which the applicant portal then consumes. The
 * applicant portal keys its masked Emirates ID input, mobile/email validation
 * and read-only formatting off `displayType`, and resolves saved record keys off
 * `fieldKey` — so a drift here silently breaks AC-05/06/07 downstream rather
 * than failing loudly in this repo. Hence the exact-value assertions below.
 */

const TRAINEE_SOURCE = "list_of_trainees";

test("exposes List of Trainees as a selectable data source (AC-01)", () => {
  const option = DATA_SOURCE_OPTIONS.find((o) => o.value === TRAINEE_SOURCE);
  assert.ok(option, "list_of_trainees missing from DATA_SOURCE_OPTIONS");
  assert.equal(option.label, "List of Trainees");
});

test("defines the four trainee fields in the order the spec lists them", () => {
  const fields = getDefaultFieldsForDataSource(TRAINEE_SOURCE);
  assert.deepEqual(
    fields.map((f) => f.fieldName),
    ["Full Name", "Emirates ID Number", "Mobile Number", "Email"],
  );
});

test("pins trainee record keys to the camelCase keys the applicant saves", () => {
  const fields = getDefaultFieldsForDataSource(TRAINEE_SOURCE);
  assert.deepEqual(
    fields.map((f) => f.fieldKey),
    ["fullName", "emiratesIdNumber", "mobileNumber", "email"],
  );
});

test("pins trainee displayType to the values the applicant portal branches on", () => {
  // Must stay identical to umc-customer-portal's DataListSourceSetter defaults.
  const fields = getDefaultFieldsForDataSource(TRAINEE_SOURCE);
  assert.deepEqual(
    fields.map((f) => f.displayType),
    ["Text Input", "Emirates ID", "Mobile", "Email"],
  );
});

test("marks every trainee field required and visible in list and form", () => {
  for (const field of getDefaultFieldsForDataSource(TRAINEE_SOURCE)) {
    assert.equal(field.required, true, `${field.fieldName} should be required`);
    assert.equal(field.listVisible, true, `${field.fieldName} listVisible`);
    assert.equal(field.formVisible, true, `${field.fieldName} formVisible`);
    assert.equal(field.fieldType, "string", `${field.fieldName} fieldType`);
  }
});

test("leaves the pre-existing data sources untouched", () => {
  // The trainee work extended getFieldKey with an optional fieldKey; the older
  // sources must keep deriving their key from fieldName, so they carry none.
  for (const source of [
    "equipment_list",
    "material_list",
    "languages_name_list",
  ]) {
    const fields = getDefaultFieldsForDataSource(source);
    assert.ok(fields.length > 0, `${source} should still have defaults`);
    for (const field of fields) {
      assert.equal(
        field.fieldKey,
        undefined,
        `${source}/${field.fieldName} must not gain a fieldKey`,
      );
      assert.ok(
        field.displayType === "Text Input" || field.displayType === "Dropdown",
        `${source}/${field.fieldName} unexpected displayType ${field.displayType}`,
      );
    }
  }
});

test("returns an empty list for an unknown data source", () => {
  assert.deepEqual(getDefaultFieldsForDataSource("not_a_source"), []);
});
