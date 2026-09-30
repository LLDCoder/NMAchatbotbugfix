import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { transformWithEsbuild } from "vite";

const sourcePath = new URL(
  "../src/pages/ContentApplications/components/ContentApplicationStatus/statusStyle.ts",
  import.meta.url,
);

const loadStatusStyleModule = async () => {
  try {
    const source = await readFile(sourcePath, "utf8");
    const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
      loader: "ts",
      format: "esm",
      target: "node20",
    });
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
      "base64",
    )}`;
    return import(moduleUrl);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

test("maps every known status ID to a language-neutral component class", async () => {
  const { getContentApplicationStatusStyleClass } = await loadStatusStyleModule();
  const cases = [
    [2, "orange"], [7, "orange"], [8, "danger"], [10, "neutral"],
    [11, "warning"], [12, "success"], [13, "warning"],
    [103, "info"], [104, "warning"], [105, "success"],
    [106, "danger"], [107, "neutral"], [108, "warning"], [109, "orange"],
  ];
  for (const [id, tone] of cases) {
    for (const statusId of [id, String(id), ` ${id} `]) {
      assert.equal(
        getContentApplicationStatusStyleClass(statusId),
        `content-application-status__main--${tone}`,
        `status ID ${statusId}`,
      );
    }
  }
});

test("uses neutral styling for missing and unknown IDs", async () => {
  const { getContentApplicationStatusStyleClass } = await loadStatusStyleModule();
  for (const id of [undefined, null, "", " ", 0, 999, "unknown", NaN, "toString", "__proto__"]) {
    assert.equal(
      getContentApplicationStatusStyleClass(id),
      "content-application-status__main--neutral",
    );
  }
});

test("renders localized labels and empty states without global status classes", async () => {
  const result = await build({
    entryPoints: [new URL("index.tsx", sourcePath).pathname],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname,
    loader: { ".less": "empty" },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url), module, module.exports,
  );
  const { ContentApplicationStatus } = module.exports;
  const cases = [
    [2, "Initial Approval", "orange"],
    [2, "الموافقة الأولية", "orange"],
    [10, "Cancelled", "neutral"],
    [10, "ملغى", "neutral"],
    [13, "Pending Modification", "warning"],
    [13, "بانتظار التعديل", "warning"],
    [999, "Completed", "neutral"],
    [undefined, "مكتمل", "neutral"],
    [null, "", "neutral"],
    [null, null, "neutral"],
  ];
  for (const layout of ["stacked", "inline"]) {
    for (const [statusId, status, tone] of cases) {
      const element = ContentApplicationStatus({ statusId, status, layout });
      const main = element.props.children[0];
      assert.equal(main.props.children, status || "-");
      assert.equal(
        main.props.className,
        `content-application-status__main content-application-status__main--${tone}`,
      );
      assert.equal(element.props.children[1], null);
    }
  }
});
