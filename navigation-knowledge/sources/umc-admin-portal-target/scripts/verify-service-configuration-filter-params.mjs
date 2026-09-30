import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { cwd } from "node:process";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const helperPath = join(
  cwd(),
  "src/pages/ServiceConfiguration/filterParams.ts",
);

assert.ok(existsSync(helperPath), "filterParams.ts should exist");

const source = readFileSync(helperPath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const module = { exports: {} };
const context = {
  exports: module.exports,
  module,
  require,
};

vm.runInNewContext(outputText, context, { filename: helperPath });

const { buildServiceListParams } = module.exports;

assert.equal(
  typeof buildServiceListParams,
  "function",
  "buildServiceListParams should be exported",
);

const buildParams = (filterValues) =>
  JSON.parse(JSON.stringify(buildServiceListParams({
    currentPage: 1,
    pageSize: 10,
    searchText: "",
    statusFilter: null,
    typeFilter: null,
    departmentFilter: "ML",
    filterValues,
  })));

assert.deepEqual(buildParams({ department: ["1"] }), {
  pageIndex: 1,
  pageSize: 10,
  search: "",
  departmentId: "1",
});

assert.deepEqual(buildParams({ department: ["2"] }), {
  pageIndex: 1,
  pageSize: 10,
  search: "",
  departmentId: "2",
});

assert.deepEqual(buildParams({ serviceCategory: ["259", "245"] }), {
  pageIndex: 1,
  pageSize: 10,
  search: "",
  listServiceCategoryId: "259,245",
});

assert.deepEqual(buildParams({ priority: ["2"] }), {
  pageIndex: 1,
  pageSize: 10,
  search: "",
  priority: "2",
});

assert.deepEqual(
  buildParams({
    startTime: "2026-06-12",
    endTime: "2026-06-12",
  }),
  {
    pageIndex: 1,
    pageSize: 10,
    search: "",
    startTime: "2026-06-12T00:00:00",
    endTime: "2026-06-12T23:59:59",
  },
);

console.log("Service configuration filter params checks passed.");
