import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const routesFilePath = "src/routes/index.tsx";
const routesSource = readFileSync(routesFilePath, "utf8");
const sourceFile = ts.createSourceFile(
  routesFilePath,
  routesSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const shellRoutePaths = new Set([
  "/licensing",
  "/content",
  "/happiness",
  "/cms",
]);

function getPropertyName(property) {
  if (
    property.name &&
    (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
  ) {
    return property.name.text;
  }

  return "";
}

function getStringProperty(object, name) {
  const property = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && getPropertyName(item) === name,
  );

  if (
    !property ||
    !ts.isPropertyAssignment(property) ||
    !ts.isStringLiteral(property.initializer)
  ) {
    return undefined;
  }

  return property.initializer.text;
}

function getBooleanProperty(object, name) {
  const property = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && getPropertyName(item) === name,
  );

  if (!property || !ts.isPropertyAssignment(property)) {
    return undefined;
  }

  if (property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (property.initializer.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  return undefined;
}

function getChildRouteObjects(object) {
  const property = object.properties.find(
    (item) =>
      ts.isPropertyAssignment(item) && getPropertyName(item) === "children",
  );

  if (
    !property ||
    !ts.isPropertyAssignment(property) ||
    !ts.isArrayLiteralExpression(property.initializer)
  ) {
    return [];
  }

  return property.initializer.elements.filter(ts.isObjectLiteralExpression);
}

function getMenuRouteConfig() {
  let menuRouteConfig;

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    node.declarationList.declarations.forEach((declaration) => {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "menuRouteConfig" &&
        declaration.initializer &&
        ts.isArrayLiteralExpression(declaration.initializer)
      ) {
        menuRouteConfig = declaration.initializer;
      }
    });
  });

  assert.ok(menuRouteConfig, "menuRouteConfig must exist");
  return menuRouteConfig;
}

function collectConfiguredRoutes() {
  const configuredRoutes = [];

  const visit = (object) => {
    const path = getStringProperty(object, "path");
    const page = getStringProperty(object, "page");
    const childRoutes = getChildRouteObjects(object);

    if (path) {
      configuredRoutes.push({
        path,
        page,
        isMenu: getBooleanProperty(object, "isMenu"),
        childCount: childRoutes.length,
      });
    }

    childRoutes.forEach(visit);
  };

  getMenuRouteConfig()
    .elements.filter(ts.isObjectLiteralExpression)
    .forEach(visit);

  return configuredRoutes;
}

function isNonRenderableMenuShell(route) {
  return (
    shellRoutePaths.has(route.path) &&
    route.isMenu === true &&
    route.childCount > 0
  );
}

function normalizeConfiguredRoutePath(path) {
  const normalized = `/${path}`.replace(/^\/+/, "/").replace(/\/+$/, "") || "/";

  return normalized.toLowerCase();
}

test("declares an explicit page for every renderable configured route", () => {
  const missingPagePaths = collectConfiguredRoutes()
    .filter((route) => !route.page && !isNonRenderableMenuShell(route))
    .map((route) => route.path);

  assert.deepEqual(missingPagePaths, []);
});

test("does not assign page modules to non-renderable menu shells", () => {
  const configuredRoutesByPath = new Map(
    collectConfiguredRoutes().map((route) => [route.path, route]),
  );
  const invalidShellPaths = [...shellRoutePaths].filter(
    (path) => {
      const route = configuredRoutesByPath.get(path);

      return !route || route.page || !isNonRenderableMenuShell(route);
    },
  );

  assert.deepEqual(invalidShellPaths, []);
});

test("maps configured pages to exact page module directory names", () => {
  const pageDirectoryNames = new Set(
    readdirSync("src/pages", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  collectConfiguredRoutes().forEach(({ path, page }) => {
    if (!page) {
      return;
    }

    assert.ok(
      pageDirectoryNames.has(page),
      `${path} must map to an exact src/pages directory name: ${page}`,
    );
    assert.ok(
      existsSync(`src/pages/${page}/index.tsx`),
      `${path} must map to src/pages/${page}/index.tsx`,
    );
  });
});

test("does not declare semantically duplicate configured route paths", () => {
  const routePaths = collectConfiguredRoutes().map(({ path }) => ({
    path,
    normalizedPath: normalizeConfiguredRoutePath(path),
  }));
  const duplicatePaths = routePaths.filter(
    ({ normalizedPath }, index) =>
      routePaths.findIndex((route) => route.normalizedPath === normalizedPath) !==
      index,
  );

  assert.deepEqual(duplicatePaths, []);
});
