import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const scanRoots = ["src/pages", "src/components/common"];
const extensions = new Set([".ts", ".tsx"]);
const strict = process.argv.includes("--strict");

const implicitExclusions = new Map([
  [
    "src/pages/PageManagement/index.tsx",
    "Server returns at most the requested pageSize and this screen has no existing pagination state; keep current behavior.",
  ],
  [
    "src/pages/ContentDashboard/components/AssignedTasks/index.tsx",
    "Presentation-only TablePanel without a dataSource or active pagination contract.",
  ],
]);

const coveredOptionalFallbacks = new Map([
  [
    "src/pages/CustomerDetails/components/AllProfilesOverview.tsx",
    "All current callers provide migrated per-tab pagination sources.",
  ],
  [
    "src/pages/CustomerDetails/components/CommercialProfileOverview.tsx",
    "All current commercial callers provide a migrated applications pagination source.",
  ],
  [
    "src/pages/CustomerDetails/components/ProfileOverview.tsx",
    "All current profile callers provide a migrated tickets pagination source or a zero-total placeholder.",
  ],
  [
    "src/pages/CustomerDetails/components/allProfilesOverviewTabs/InspectionTab.tsx",
    "All current callers provide a migrated inspection pagination source.",
  ],
  [
    "src/pages/CustomerDetails/components/allProfilesOverviewTabs/InspectionTabNoFullScan.tsx",
    "All current callers provide a migrated inspection pagination source.",
  ],
  [
    "src/pages/CustomerDetails/components/allProfilesOverviewTabs/LicensesTab.tsx",
    "All current callers provide a migrated licenses pagination source.",
  ],
  [
    "src/pages/CustomerDetails/components/allProfilesOverviewTabs/RefundsTab.tsx",
    "All current callers provide a migrated refunds pagination source.",
  ],
  [
    "src/pages/CustomerDetails/components/allProfilesOverviewTabs/TicketsTab.tsx",
    "All current callers provide a migrated tickets pagination source.",
  ],
]);

const getFiles = (directory) =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (path.includes("/designable/")) return [];
    if (entry.isDirectory()) return getFiles(path);
    return extensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [path] : [];
  });

const getLine = (sourceFile, position) =>
  sourceFile.getLineAndCharacterOfPosition(position).line + 1;

const getPropertyName = (node) =>
  ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
    ? node.name.text
    : undefined;

const getJsxAttribute = (node, name) =>
  node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );

const getObjectProperty = (node, name) =>
  node.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) && getPropertyName(property) === name,
  );

const report = [];
const pushReport = (sourceFile, path, node, status, reason) => {
  report.push({
    path,
    line: getLine(sourceFile, node.getStart(sourceFile)),
    status,
    reason,
  });
};

for (const directory of scanRoots) {
  for (const path of getFiles(directory)) {
    const source = readFileSync(join(root, path), "utf8");
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const declarations = new Map();

    const collectDeclarations = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        declarations.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, collectDeclarations);
    };
    collectDeclarations(sourceFile);

    const classifyExpression = (expression, seen = new Set()) => {
      if (!expression) return { status: "unclassified", reason: "Missing expression" };
      if (expression.kind === ts.SyntaxKind.FalseKeyword) {
        return { status: "disabled", reason: "Explicit pagination={false}" };
      }

      const text = expression.getText(sourceFile);
      if (text.includes("PaginationTotal")) {
        return { status: "migrated", reason: "Uses PaginationTotal" };
      }

      if (ts.isParenthesizedExpression(expression)) {
        return classifyExpression(expression.expression, seen);
      }

      if (ts.isIdentifier(expression)) {
        if (seen.has(expression.text)) {
          return { status: "unclassified", reason: "Circular pagination reference" };
        }
        const declaration = declarations.get(expression.text);
        if (declaration) {
          return classifyExpression(declaration, new Set([...seen, expression.text]));
        }
        return {
          status: "passthrough",
          reason: `Pagination prop ${expression.text} is supplied by the owning component`,
        };
      }

      if (ts.isPropertyAccessExpression(expression)) {
        return {
          status: "passthrough",
          reason: "Pagination override is supplied by the owning configuration",
        };
      }

      if (ts.isConditionalExpression(expression)) {
        const branches = [
          classifyExpression(expression.whenTrue, seen),
          classifyExpression(expression.whenFalse, seen),
        ];
        if (branches.every((branch) => branch.status === "disabled")) {
          return { status: "disabled", reason: "All conditional branches disable pagination" };
        }
        if (
          branches.every((branch) =>
            ["migrated", "disabled", "passthrough"].includes(branch.status),
          )
        ) {
          return { status: "migrated", reason: "All enabled conditional branches are covered" };
        }
        return { status: "unclassified", reason: "Conditional pagination has an uncovered branch" };
      }

      if (
        ts.isBinaryExpression(expression) &&
        [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
          expression.operatorToken.kind,
        )
      ) {
        const left = classifyExpression(expression.left, seen);
        const right = classifyExpression(expression.right, seen);
        if (
          [left, right].every((branch) =>
            ["migrated", "passthrough", "disabled"].includes(branch.status),
          )
        ) {
          return {
            status: [left, right].some((branch) => branch.status === "migrated")
              ? "migrated"
              : "passthrough",
            reason: "Fallback and supplied pagination are covered",
          };
        }
        if (
          coveredOptionalFallbacks.has(path) &&
          [left, right].some((branch) => branch.status === "passthrough")
        ) {
          return {
            status: "passthrough",
            reason: coveredOptionalFallbacks.get(path),
          };
        }
        return { status: "unclassified", reason: "Fallback pagination has an uncovered branch" };
      }

      if (ts.isObjectLiteralExpression(expression)) {
        const total = getObjectProperty(expression, "total");
        if (
          total &&
          total.initializer.kind === ts.SyntaxKind.NumericLiteral &&
          total.initializer.text === "0"
        ) {
          return {
            status: "non-terminal-unused",
            reason: "Zero-total placeholder does not reach an enabled pagination endpoint",
          };
        }
        return { status: "missing", reason: "Enabled pagination does not use PaginationTotal" };
      }

      return { status: "unclassified", reason: `Unsupported pagination expression: ${text}` };
    };

    const inspectPaginationAttribute = (node, attribute) => {
      if (!attribute.initializer || !ts.isJsxExpression(attribute.initializer)) {
        pushReport(sourceFile, path, node, "unclassified", "Pagination attribute is not an expression");
        return;
      }
      const result = classifyExpression(attribute.initializer.expression);
      pushReport(sourceFile, path, node, result.status, result.reason);
    };

    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        (node.type?.getText(sourceFile) === "TablePaginationConfig" ||
          (ts.isCallExpression(node.initializer) &&
            node.initializer.typeArguments?.some(
              (typeArgument) =>
                typeArgument.getText(sourceFile) === "TablePaginationConfig",
            )))
      ) {
        const result = classifyExpression(node.initializer);
        pushReport(sourceFile, path, node, result.status, `Pagination source: ${result.reason}`);
      }

      if (ts.isPropertyAssignment(node) && getPropertyName(node) === "pagination") {
        const result = classifyExpression(node.initializer);
        pushReport(sourceFile, path, node, result.status, result.reason);
      }

      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tagName = node.tagName.getText(sourceFile);
        const pagination = getJsxAttribute(node, "pagination");

        if (tagName === "Pagination") {
          const showTotal = getJsxAttribute(node, "showTotal");
          const result = showTotal?.getText(sourceFile).includes("PaginationTotal")
            ? { status: "migrated", reason: "Standalone Pagination uses PaginationTotal" }
            : { status: "missing", reason: "Standalone Pagination lacks PaginationTotal" };
          pushReport(sourceFile, path, node, result.status, result.reason);
        } else if (pagination) {
          inspectPaginationAttribute(node, pagination);
        } else if (["Table", "FilterTable", "TablePanel"].includes(tagName)) {
          const hasSpread = node.attributes.properties.some(ts.isJsxSpreadAttribute);
          const tableProps = getJsxAttribute(node, "tableProps");
          const tablePropsText = tableProps?.getText(sourceFile) || "";
          if (
            hasSpread ||
            tablePropsText.includes("pagination") ||
            tablePropsText.includes("...")
          ) {
            pushReport(
              sourceFile,
              path,
              node,
              "passthrough",
              "Pagination is supplied through spread/tableProps",
            );
          } else if (implicitExclusions.has(path)) {
            pushReport(
              sourceFile,
              path,
              node,
              "implicit-excluded",
              implicitExclusions.get(path),
            );
          } else {
            pushReport(
              sourceFile,
              path,
              node,
              "missing",
              "Implicit AntD pagination is not explicitly classified",
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }
}

const uniqueReport = Array.from(
  new Map(
    report.map((entry) => [
      `${entry.path}:${entry.line}:${entry.status}:${entry.reason}`,
      entry,
    ]),
  ).values(),
);
const counts = uniqueReport.reduce(
  (result, entry) => ({
    ...result,
    [entry.status]: (result[entry.status] || 0) + 1,
  }),
  {},
);

console.table(uniqueReport);
console.log("Pagination total coverage:", counts);

if (strict && (counts.missing || counts.unclassified)) {
  process.exitCode = 1;
}
