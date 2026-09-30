import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const result = await build({
    entryPoints: [sourcePath.pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    write: false,
    alias: {
      "@": new URL("../src", import.meta.url).pathname,
    },
  });
  const code = result.outputFiles[0].text;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;
  return import(moduleUrl);
};

const { openSafeFilePreviewUrl, resolveSafeFilePreviewUrl } =
  await loadTypeScriptModule(
    "../src/components/designable/src/components/FileUploadGrid/filePreviewSecurity.ts",
  );

const currentOrigin = "https://admin.example.gov";
const trustedOrigins = ["https://files.example.gov", "http://api.local.test"];

test("preserves legitimate local, configured, blob, and external HTTPS previews", () => {
  const cases = [
    ["/api/Document/Dowload?fileName=permit.pdf", "https://admin.example.gov/api/Document/Dowload?fileName=permit.pdf"],
    ["https://admin.example.gov/files/report.pdf", "https://admin.example.gov/files/report.pdf"],
    ["https://files.example.gov/signed/report.pdf", "https://files.example.gov/signed/report.pdf"],
    ["http://api.local.test/files/report.pdf", "http://api.local.test/files/report.pdf"],
    ["https://signed-storage.example.net/report.pdf?signature=abc", "https://signed-storage.example.net/report.pdf?signature=abc"],
    ["blob:https://admin.example.gov/8f04f633-2ae2-48ee-a294-749f9fe0d44f", "blob:https://admin.example.gov/8f04f633-2ae2-48ee-a294-749f9fe0d44f"],
  ];

  cases.forEach(([input, expected]) => {
    assert.equal(
      resolveSafeFilePreviewUrl(input, currentOrigin, trustedOrigins),
      expected,
    );
  });
});

test("rejects executable, local-file, credentialed, and untrusted HTTP URLs", () => {
  const blocked = [
    "javascript:globalThis.location='https://attacker.example'",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://files.example.gov/report.pdf",
    "mailto:security@example.gov",
    "https://admin.example.gov@attacker.example/report.pdf",
    "https://user:password@files.example.gov/report.pdf",
    "http://attacker.example/report.pdf",
    "blob:https://attacker.example/8f04f633-2ae2-48ee-a294-749f9fe0d44f",
    "blob:null/8f04f633-2ae2-48ee-a294-749f9fe0d44f",
    "http://[",
  ];

  blocked.forEach((input) => {
    assert.equal(
      resolveSafeFilePreviewUrl(input, currentOrigin, trustedOrigins),
      null,
      input,
    );
  });
});

test("opens approved previews without an opener relationship", () => {
  const calls = [];
  const openedWindow = { opener: { location: "original" } };
  const openWindow = (...args) => {
    calls.push(args);
    return openedWindow;
  };

  assert.equal(
    openSafeFilePreviewUrl(
      "https://signed-storage.example.net/report.pdf",
      currentOrigin,
      trustedOrigins,
      openWindow,
    ),
    true,
  );
  assert.deepEqual(calls, [
    [
      "https://signed-storage.example.net/report.pdf",
      "_blank",
      "noopener,noreferrer",
    ],
  ]);
  assert.equal(openedWindow.opener, null);
});

test("does not call window.open for a blocked preview", () => {
  let opened = false;
  const warnings = [];
  const originalWarn = console.warn;
  const openWindow = () => {
    opened = true;
    return null;
  };

  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    assert.equal(
      openSafeFilePreviewUrl(
        "http://attacker.example/report.pdf?signature=secret",
        currentOrigin,
        trustedOrigins,
        openWindow,
      ),
      false,
    );
    assert.equal(opened, false);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "[Security] Restricted URL blocked.");
  assert.equal(warnings[0][1].feature, "file-preview");
  assert.equal(warnings[0][1].hostname, "attacker.example");
  assert.equal(warnings[0][1].origin, "http://attacker.example");
  assert.equal(JSON.stringify(warnings[0][1]).includes("signature=secret"), false);
});

test("keeps the preview working when a restricted WindowProxy rejects opener assignment", () => {
  const restrictedWindow = {};
  Object.defineProperty(restrictedWindow, "opener", {
    set() {
      throw new Error("cross-origin WindowProxy");
    },
  });

  assert.equal(
    openSafeFilePreviewUrl(
      "https://signed-storage.example.net/report.pdf",
      currentOrigin,
      trustedOrigins,
      () => restrictedWindow,
    ),
    true,
  );
});
