#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../..",
);
const routesPath = path.join(repoRoot, "src/routes/index.tsx");
const sourceText = fs.readFileSync(routesPath, "utf8");
const sourceFile = ts.createSourceFile(
  routesPath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const getProperty = (objectNode, name) =>
  objectNode.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === name) ||
        (ts.isStringLiteral(property.name) && property.name.text === name)),
  );

const getStringProperty = (objectNode, name) => {
  const property = getProperty(objectNode, name);
  return property &&
    ts.isPropertyAssignment(property) &&
    (ts.isStringLiteral(property.initializer) ||
      ts.isNoSubstitutionTemplateLiteral(property.initializer))
    ? property.initializer.text
    : undefined;
};

let menuConfig;
const visit = (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "menuRouteConfig" &&
    node.initializer
  ) {
    const initializer = ts.isAsExpression(node.initializer)
      ? node.initializer.expression
      : node.initializer;
    if (ts.isArrayLiteralExpression(initializer)) {
      menuConfig = initializer;
    }
  }
  ts.forEachChild(node, visit);
};
visit(sourceFile);

if (!menuConfig) {
  throw new Error("Unable to find menuRouteConfig in src/routes/index.tsx.");
}

const routes = [];
for (const rootElement of menuConfig.elements) {
  if (!ts.isObjectLiteralExpression(rootElement)) continue;
  const rootPath = getStringProperty(rootElement, "path");
  const childrenProperty = getProperty(rootElement, "children");
  if (
    !rootPath ||
    !childrenProperty ||
    !ts.isPropertyAssignment(childrenProperty) ||
    !ts.isArrayLiteralExpression(childrenProperty.initializer)
  ) {
    continue;
  }

  for (const child of childrenProperty.initializer.elements) {
    if (!ts.isObjectLiteralExpression(child)) continue;
    const routePath = getStringProperty(child, "path");
    const page = getStringProperty(child, "page");
    if (!routePath || !page) continue;
    routes.push({
      modulePath: rootPath,
      path: routePath,
      page,
      title: getStringProperty(child, "title") ?? "",
      titleKey: getStringProperty(child, "titleKey") ?? "",
    });
  }
}

process.stdout.write(`${JSON.stringify(routes, null, 2)}\n`);
