import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL(
  "../src/pages/InspectionCommon/roleMapping.ts",
  import.meta.url
);
const source = await readFile(sourceUrl, "utf8");
const { code } = await transformWithEsbuild(source, sourceUrl.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64"
)}`;
const {
  getInspectionRolesFromLegacyNames,
  getInspectionRolesFromRoleValues,
  resolveInspectionRoleFromLegacyName,
  resolveInspectionRoleFromRoleValue,
} = await import(moduleUrl);

// Roles exactly as the backend returns them today, captured from the JWT `ListRole`
// claim of every admin-portal test account on the daypop environment.
const BACKEND_ROLES = [
  { roleId: "INSPECTOR", roleName: "Inspector", role: "inspector" },
  {
    roleId: "INSPECTION_MANAGER",
    roleName: "Inspection Manager",
    role: "manager",
  },
  {
    roleId: "COMPLIANCE_COMMITTEE",
    roleName: "Compliance Committee",
    role: "committee",
  },
  { roleId: "CONTENT_MANAGER", roleName: "Content Manager", role: "content" },
  {
    roleId: "CONTENT_SUPERVISOR",
    roleName: "Content Supervisor",
    role: "content",
  },
  { roleId: "CONTENT_OFFICER", roleName: "Content Officer", role: "content" },
];

// Roles that must never resolve to an inspection role.
const UNRELATED_ROLES = [
  { roleId: "LICENSING_MANAGER", roleName: "Licensing Manager" },
  { roleId: "LICENSING_OFFICER", roleName: "Licensing Officer" },
  { roleId: "FOREIGN_MEDIA_MANAGER", roleName: "Foreign Media Manager" },
  { roleId: "FOREIGN_MEDIA_OFFICER", roleName: "Foreign Media Officer" },
  { roleId: "HAPPINESS_CENTER_MANAGER", roleName: "Happiness Center Manager" },
  { roleId: "HAPPINESS_CENTER_AGENT", roleName: "Happiness Center Agent" },
  { roleId: "FINANCE_OFFICER", roleName: "Finance Officer" },
  { roleId: "SUPER_ADMINISTRATOR", roleName: "Super Administrator" },
  { roleId: "SYSTEM_ADMINISTRATOR", roleName: "System Administrator" },
];

test("resolves every backend role from its role id", () => {
  for (const { roleId, role } of BACKEND_ROLES) {
    assert.equal(resolveInspectionRoleFromRoleValue(roleId), role, roleId);
  }
});

test("resolves every backend role from its display name", () => {
  for (const { roleName, role } of BACKEND_ROLES) {
    assert.equal(resolveInspectionRoleFromRoleValue(roleName), role, roleName);
  }
});

test("keeps the legacy exact role names working", () => {
  const legacyNames = [
    ["committee", "committee"],
    ["Committee", "committee"],
    ["content team", "content"],
    ["Content Team", "content"],
    ["inspector", "inspector"],
    ["Inspector", "inspector"],
    ["inspection manager", "manager"],
    ["Inspection Manager", "manager"],
    ["manager", "manager"],
    ["Manager", "manager"],
  ];

  for (const [roleName, role] of legacyNames) {
    assert.equal(resolveInspectionRoleFromRoleValue(roleName), role, roleName);
    assert.equal(resolveInspectionRoleFromLegacyName(roleName), role, roleName);
  }
});

test("tolerates casing, padding and separator differences", () => {
  const variants = [
    ["  Compliance   Committee  ", "committee"],
    ["COMPLIANCE COMMITTEE", "committee"],
    ["compliance-committee", "committee"],
    ["compliance_committee", "committee"],
    ["inspection_manager", "manager"],
    ["INSPECTION-MANAGER", "manager"],
    ["content_officer", "content"],
  ];

  for (const [value, role] of variants) {
    assert.equal(resolveInspectionRoleFromRoleValue(value), role, value);
  }
});

test("falls back to keywords so a future rename still resolves", () => {
  const renamed = [
    ["Compliance Committee Member", "committee"],
    ["Violation Committee", "committee"],
    ["VIOLATION_COMMITTEE", "committee"],
    ["Content Review Team", "content"],
    ["CONTENT_REVIEWER", "content"],
    ["Senior Inspector", "inspector"],
    ["Field Inspector", "inspector"],
    ["Inspection Officer", "inspector"],
    ["Inspection Department Head", "manager"],
    ["Inspection Supervisor", "manager"],
    ["Inspection Admin", "manager"],
  ];

  for (const [roleName, role] of renamed) {
    assert.equal(resolveInspectionRoleFromRoleValue(roleName), role, roleName);
  }
});

test("never grants an inspection role to another department", () => {
  for (const { roleId, roleName } of UNRELATED_ROLES) {
    assert.equal(resolveInspectionRoleFromRoleValue(roleId), undefined, roleId);
    assert.equal(
      resolveInspectionRoleFromRoleValue(roleName),
      undefined,
      roleName
    );
  }
});

test("ignores empty and non-role values", () => {
  for (const value of ["", "   ", null, undefined, "Unknown Role", "staff"]) {
    assert.equal(resolveInspectionRoleFromRoleValue(value), undefined);
  }
});

test("does not keyword-match free text such as a role description", () => {
  // The COMPLIANCE_COMMITTEE description mentions both "inspection" and "content";
  // matching it would resolve the wrong role.
  const committeeDescription =
    "Reviews inspection cases involving suspected violations or problematic content " +
    "and issues the final decision, including no action, warning, corrective action, " +
    "fine, suspension, or escalation.";

  assert.equal(
    resolveInspectionRoleFromRoleValue(committeeDescription),
    undefined
  );
  assert.deepEqual(
    getInspectionRolesFromLegacyNames([committeeDescription, "ApprovalRole"]),
    []
  );
});

test("resolves a role list, de-duplicated and order preserving", () => {
  assert.deepEqual(
    getInspectionRolesFromRoleValues([
      "Compliance Committee",
      "COMPLIANCE_COMMITTEE",
    ]),
    ["committee"]
  );

  assert.deepEqual(
    getInspectionRolesFromRoleValues([
      "Inspection Manager",
      "INSPECTION_MANAGER",
      "Licensing Manager",
      null,
      "Content Officer",
    ]),
    ["manager", "content"]
  );

  assert.deepEqual(getInspectionRolesFromRoleValues([]), []);
});
