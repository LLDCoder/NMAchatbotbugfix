import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signaturePadSource = await readFile(
  new URL(
    "../src/pages/InspectionCommon/components/SignaturePad.tsx",
    import.meta.url,
  ),
  "utf8",
);
const authenticatedUrlHookSource = await readFile(
  new URL("../src/hooks/useAuthenticatedDocumentUrl.ts", import.meta.url),
  "utf8",
);
const authenticatedHtmlSource = await readFile(
  new URL("../src/components/common/AuthenticatedDocumentHtml.tsx", import.meta.url),
  "utf8",
);
const authenticatedMediaHookSource = await readFile(
  new URL("../src/hooks/useAuthenticatedDocumentMedia.ts", import.meta.url),
  "utf8",
);

test("loads protected signature previews through the authenticated document hook", () => {
  assert.match(
    signaturePadSource,
    /useAuthenticatedDocumentUrl\(value\)/,
  );
  assert.match(
    signaturePadSource,
    /className="inspection-signature-pad__preview-image"\s+src=\{authenticatedPreviewUrl\}/,
  );
});

test("revokes object URLs when authenticated media consumers are no longer active", () => {
  assert.match(
    authenticatedUrlHookSource,
    /abortController\.signal\.aborted[\s\S]*URL\.revokeObjectURL\(resolvedSource\.objectUrl\)/,
  );
  assert.match(
    authenticatedHtmlSource,
    /abortController\.signal\.aborted[\s\S]*URL\.revokeObjectURL\(authenticatedSource\.objectUrl\)/,
  );
  assert.match(
    authenticatedMediaHookSource,
    /abortController\.signal\.aborted \|\|[\s\S]*!element\.isConnected[\s\S]*URL\.revokeObjectURL\(authenticatedSource\.objectUrl\)/,
  );
  assert.match(
    authenticatedMediaHookSource,
    /pendingSources\.get\(element\) !== documentSource[\s\S]*currentDocumentSource !== documentSource/,
  );
  assert.match(
    authenticatedMediaHookSource,
    /source !== currentObjectUrl[\s\S]*revokeElementObjectUrl\(element\)/,
  );
  assert.match(
    authenticatedMediaHookSource,
    /!element\.isConnected \|\| !container\.contains\(element\)[\s\S]*revokeElementObjectUrl\(element\)/,
  );
});
