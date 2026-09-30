export type InspectionRole =
  | "inspector"
  | "manager"
  | "content"
  | "committee"
  | "customer";

// Legacy exact role names. Kept as-is so nothing that already worked can regress.
const INSPECTION_ROLE_NAME_PRIORITY: Array<{
  roleName: string;
  role: InspectionRole;
}> = [
  { roleName: "committee", role: "committee" },
  { roleName: "content team", role: "content" },
  { roleName: "inspector", role: "inspector" },
  { roleName: "inspection manager", role: "manager" },
  { roleName: "manager", role: "manager" },
];

const INSPECTION_ROLE_NAME_MAP = new Map(
  INSPECTION_ROLE_NAME_PRIORITY.map(({ roleName, role }) => [roleName, role]),
);

// Roles as the backend returns them today, e.g.
// `ListRole: [{ RoleID: "COMPLIANCE_COMMITTEE", RoleName: "Compliance Committee" }]`.
// Both columns are matched, so a payload carrying only the id or only the name resolves.
export const INSPECTION_ROLE_ID_PRIORITY: Array<{
  roleId: string;
  roleName: string;
  role: InspectionRole;
}> = [
  {
    roleId: "COMPLIANCE_COMMITTEE",
    roleName: "compliance committee",
    role: "committee",
  },
  { roleId: "INSPECTOR", roleName: "inspector", role: "inspector" },
  {
    roleId: "INSPECTION_MANAGER",
    roleName: "inspection manager",
    role: "manager",
  },
  { roleId: "CONTENT_MANAGER", roleName: "content manager", role: "content" },
  {
    roleId: "CONTENT_SUPERVISOR",
    roleName: "content supervisor",
    role: "content",
  },
  { roleId: "CONTENT_OFFICER", roleName: "content officer", role: "content" },
];

const INSPECTION_ROLE_ID_MAP = new Map(
  INSPECTION_ROLE_ID_PRIORITY.map(({ roleId, role }) => [roleId, role]),
);

const INSPECTION_ROLE_NAME_ALIAS_MAP = new Map(
  INSPECTION_ROLE_ID_PRIORITY.map(({ roleName, role }) => [roleName, role]),
);

// Last-resort keyword rules so a future backend rename still resolves without a
// frontend release. Ordered from the most specific keyword to the least, and every
// rule is scoped to an inspection/content keyword so roles from other departments
// ("Licensing Manager", "Happiness Center Manager", "Finance Officer") never match.
const MANAGER_KEYWORD_PATTERN =
  /manager|supervisor|leader|head|chief|director|admin/;

const INSPECTION_ROLE_KEYWORD_PRIORITY: Array<{
  test: (roleName: string) => boolean;
  role: InspectionRole;
}> = [
  { test: (roleName) => roleName.includes("committee"), role: "committee" },
  { test: (roleName) => roleName.includes("content"), role: "content" },
  { test: (roleName) => roleName.includes("inspector"), role: "inspector" },
  {
    test: (roleName) =>
      roleName.includes("inspect") && MANAGER_KEYWORD_PATTERN.test(roleName),
    role: "manager",
  },
  { test: (roleName) => roleName.includes("inspect"), role: "inspector" },
];

// Keyword rules only ever run against short role-name-like values, never against
// free text such as a role description.
const INSPECTION_ROLE_NAME_MAX_LENGTH = 64;

export const normalizeInspectionRoleName = (roleName?: string | null) =>
  String(roleName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// Accepts both `COMPLIANCE_COMMITTEE` and a display name accidentally sent as an id.
export const normalizeInspectionRoleId = (roleId?: string | null) =>
  String(roleId || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const resolveInspectionRoleByKeyword = (normalizedRoleName: string) => {
  if (
    !normalizedRoleName ||
    normalizedRoleName.length > INSPECTION_ROLE_NAME_MAX_LENGTH
  ) {
    return undefined;
  }

  return INSPECTION_ROLE_KEYWORD_PRIORITY.find(({ test }) =>
    test(normalizedRoleName),
  )?.role;
};

// Exact-match only. Used for loosely typed fields (role description, discriminator)
// where keyword matching would produce false positives.
export const resolveInspectionRoleFromLegacyName = (
  roleName?: string | null,
) => INSPECTION_ROLE_NAME_MAP.get(normalizeInspectionRoleName(roleName));

// Full pipeline for role id / role name fields: legacy exact name, renamed id,
// renamed display name, then keyword fallback.
export const resolveInspectionRoleFromRoleValue = (value?: string | null) => {
  const normalizedRoleName = normalizeInspectionRoleName(value);

  if (!normalizedRoleName) {
    return undefined;
  }

  return (
    INSPECTION_ROLE_NAME_MAP.get(normalizedRoleName) ||
    INSPECTION_ROLE_ID_MAP.get(normalizeInspectionRoleId(value)) ||
    INSPECTION_ROLE_NAME_ALIAS_MAP.get(normalizedRoleName) ||
    INSPECTION_ROLE_NAME_ALIAS_MAP.get(
      normalizedRoleName.replace(/_+/g, " ").replace(/\s+/g, " "),
    ) ||
    resolveInspectionRoleByKeyword(normalizedRoleName.replace(/_+/g, " "))
  );
};

export const uniqueInspectionRoles = (
  roles: Array<InspectionRole | null | undefined>,
) =>
  Array.from(
    new Set(roles.filter((role): role is InspectionRole => Boolean(role))),
  );

export const getInspectionRolesFromRoleValues = (
  values: Array<string | null | undefined>,
) => uniqueInspectionRoles(values.map(resolveInspectionRoleFromRoleValue));

export const getInspectionRolesFromLegacyNames = (
  roleNames: Array<string | null | undefined>,
) => uniqueInspectionRoles(roleNames.map(resolveInspectionRoleFromLegacyName));
