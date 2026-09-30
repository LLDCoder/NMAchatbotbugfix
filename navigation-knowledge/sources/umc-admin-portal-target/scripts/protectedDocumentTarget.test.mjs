import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourcePath = new URL(
  "../src/utils/protectedDocumentTarget.ts",
  import.meta.url,
);
const source = await readFile(sourcePath, "utf8");
const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const {
  createProtectedDocumentPlaceholder,
  maskProtectedDocumentHtmlSources,
  parseProtectedDocumentPlaceholder,
  parseProtectedDocumentTarget,
  restoreProtectedDocumentHtmlSources,
} = await import(moduleUrl);

const loaderSource = await readFile(
  new URL("../src/utils/loadAuthenticatedDocumentSource.ts", import.meta.url),
  "utf8",
);

const allowedOrigins = new Set([
  "https://umc-adminportal.sol.daypop.ai",
]);

test("maps protected document download URLs to the authenticated request target", () => {
  assert.deepEqual(
    parseProtectedDocumentTarget(
      "https://umc-adminportal.sol.daypop.ai/api/Document/Dowload?fileName=a436508f14e94f5baee0dc7451df3937.png",
      "https://umc-adminportal.sol.daypop.ai",
      allowedOrigins,
    ),
    {
      endpoint: "/api/Document/Dowload",
      fileName: "a436508f14e94f5baee0dc7451df3937.png",
    },
  );
});

test("maps protected PDF previews and the corrected Download spelling", () => {
  assert.deepEqual(
    parseProtectedDocumentTarget(
      "/api/pdf/preview?fileName=report.pdf",
      "https://umc-adminportal.sol.daypop.ai",
      allowedOrigins,
    ),
    { endpoint: "/api/pdf/preview", fileName: "report.pdf" },
  );
  assert.deepEqual(
    parseProtectedDocumentTarget(
      "/api/Document/Download?fileName=image.png",
      "https://umc-adminportal.sol.daypop.ai",
      allowedOrigins,
    ),
    { endpoint: "/api/Document/Dowload", fileName: "image.png" },
  );
});

test("rejects unapproved origins and missing file names", () => {
  assert.equal(
    parseProtectedDocumentTarget(
      "https://example.com/api/Document/Dowload?fileName=image.png",
      "https://umc-adminportal.sol.daypop.ai",
      allowedOrigins,
    ),
    null,
  );
  assert.equal(
    parseProtectedDocumentTarget(
      "/api/Document/Dowload",
      "https://umc-adminportal.sol.daypop.ai",
      allowedOrigins,
    ),
    null,
  );
});

test("keeps ordinary root-relative media URLs as direct browser sources", () => {
  assert.match(loaderSource, /\^\(https\?:\|\\\/\|data:\|blob:\)/);
  assert.match(
    loaderSource,
    /if \(!protectedTarget && isDirectBrowserSource\(reference\)\)/,
  );
});

test("round-trips protected editor media through a non-network placeholder", () => {
  assert.equal(typeof createProtectedDocumentPlaceholder, "function");
  assert.equal(typeof parseProtectedDocumentPlaceholder, "function");

  const source =
    "/api/Document/Dowload?fileName=a436508f14e94f5baee0dc7451df3937.png";
  const placeholder = createProtectedDocumentPlaceholder(source);

  assert.match(placeholder, /^data:image\/gif;base64,/);
  assert.equal(parseProtectedDocumentPlaceholder(placeholder), source);
  assert.equal(parseProtectedDocumentPlaceholder(source), null);
});

test("masks protected rich-text sources before rendering and restores them for saving", () => {
  assert.equal(typeof maskProtectedDocumentHtmlSources, "function");
  assert.equal(typeof restoreProtectedDocumentHtmlSources, "function");

  const source =
    "/api/Document/Dowload?fileName=a436508f14e94f5baee0dc7451df3937.png";
  const html = `<p>Signature</p><p><img src="${source}" alt="Signature" /></p>`;
  const maskedHtml = maskProtectedDocumentHtmlSources(
    html,
    "https://umc-adminportal.sol.daypop.ai",
    allowedOrigins,
  );

  assert.doesNotMatch(maskedHtml, /<img src="\/api\/Document\/Dowload/);
  assert.match(maskedHtml, /<img src="data:image\/gif;base64,/);
  assert.equal(restoreProtectedDocumentHtmlSources(maskedHtml), html);
});
