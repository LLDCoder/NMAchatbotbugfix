import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailSource = readFileSync(
  "src/pages/TransactionsDetail/index.tsx",
  "utf8",
);

test("opens related applications through the authorized team-management task route", () => {
  assert.match(detailSource, /import \{ getTaskType \} from ['"]@\/services\/tickets['"]/);
  assert.match(detailSource, /createPermissionPathSet/);
  assert.match(detailSource, /getTaskType\(\{ applicationNo \}\)/);
  assert.match(detailSource, /teamManagementScope/);
  assert.match(detailSource, /breadcrumbMode/);
  assert.match(detailSource, /teamTaskSourceType/);
  assert.match(detailSource, /permissionPathSet\.has/);
  assert.match(detailSource, /t\("response\.error\.403"\)/);
  assert.match(detailSource, /response\?\.status === 403/);
  assert.match(
    detailSource,
    /t\("Customer\.customerRefunds\.messages\.relatedApplicationNotFound"\)/,
  );
});
