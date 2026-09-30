import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("uses the next task returned by Content ApproveV2 for 302 approvals", async () => {
  const [serviceSource, modalSource, modalTypeSource, detailsSource] =
    await Promise.all([
      readSource("src/services/content.ts"),
      readSource("src/pages/ContentApplications/components/ApproveModal/index.tsx"),
      readSource("src/pages/ContentApplications/components/ApproveModal/type.ts"),
      readSource("src/pages/ContentApplicationsDetails/index.tsx"),
    ]);

  assert.match(
    serviceSource,
    /interface ContentApproveResponse\s*\{[\s\S]*?data\?:\s*\{[\s\S]*?nextTaskId\?: string \| null/,
  );
  assert.match(
    serviceSource,
    /request\.post<\s*ContentApproveResponse,\s*ContentApproveResponse\s*>\(\s*"\/api\/Content\/ApproveV2"/,
  );
  assert.match(
    modalTypeSource,
    /onOkCb\?: \(nextTaskId\?: string \| null\) => void \| Promise<void>/,
  );
  assert.match(modalSource, /const response = await approveTask\(/);
  assert.match(modalSource, /await onOkCb\?\.\(response\?\.data\?\.nextTaskId\)/);
  assert.match(
    modalSource,
    /AxiosError<ApproveErrorPayload>[\s\S]*?response\?\.data/,
  );
  assert.match(modalSource, /CustomMessage\.error\(errorMessage\)/);
  assert.match(
    detailsSource,
    /isConditionalMaterialDispositionService\(\s*details\?\.serviceCode,?\s*\)/,
  );
  assert.match(
    detailsSource,
    /nextSearchParams\.set\("taskId", normalizedNextTaskId\)/,
  );
  assert.match(detailsSource, /history\.replace\(\{[\s\S]*?pathname,[\s\S]*?search:/);
});
