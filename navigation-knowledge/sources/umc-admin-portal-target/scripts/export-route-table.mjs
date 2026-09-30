import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const routesFilePath = path.join(repoRoot, "src/routes/index.tsx");
const pagesDirectory = path.join(repoRoot, "src/pages");
const protectedRouteTablePath = path.join(
  repoRoot,
  "src/generated/protectedRouteTable.ts",
);
const protectedRouteTreePath = path.join(
  repoRoot,
  "src/generated/protectedRouteTree.ts",
);
const protectedRoutePermissionsJsonPath = path.join(
  repoRoot,
  "src/generated/protectedRoutePermissions.json",
);
const markdownOutputPath = path.join(repoRoot, "docs/routes-tree.md");

const sourceText = fs.readFileSync(routesFilePath, "utf8");
const sourceFile = ts.createSourceFile(
  routesFilePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const OMIT = Symbol("omit");

/**
 * @typedef {{
 *   path?: string;
 *   title?: string;
 *   titleKey?: string;
 *   isMenu?: boolean;
 *   page?: string;
 *   i18n?: string;
 *   keepAlive?: {
 *     group?: string;
 *     mode?: string;
 *   };
 *   preferRouteTitle?: boolean;
 *   allowedInspectionRoles?: string | string[];
 *   activeMenuPath?: string;
 *   requiresCustomerAppealsAccess?: boolean;
 *   children?: RouteConfigNode[];
 * }} RouteConfigNode
 */

/**
 * @typedef {"configured-root" | "configured-nested" | "auto-matched" | "auto-fallback"} RouteSource
 */

/**
 * @typedef {{
 *   path: string;
 *   page: string;
 *   title: string;
 *   titleKey?: string;
 *   i18n?: string;
 *   isMenu: boolean;
 *   parentPath: string | null;
 *   source: RouteSource;
 *   activeMenuPath?: string;
 *   preferRouteTitle?: boolean;
 *   requiresCustomerAppealsAccess?: boolean;
 *   allowedInspectionRoles?: string | string[];
 *   keepAlive?: {
 *     group?: string;
 *     mode?: string;
 *   };
 * }} ProtectedRouteRecord
 */

/**
 * @typedef {RouteConfigNode & {
 *   parentPath: string | null;
 *   configOrder: number;
 *   children: ConfiguredRouteNode[];
 * }} ConfiguredRouteNode
 */

/**
 * @typedef {ProtectedRouteRecord & {
 *   configOrder?: number;
 * }} RouteCandidate
 */

/**
 * @typedef {{
 *   path: string;
 *   title: string;
 *   page?: string;
 *   parentPath: string | null;
 *   hasActualRoute: boolean;
 *   isMenu?: boolean;
 *   titleKey?: string;
 *   i18n?: string;
   *   children: TreeNode[];
 * }} TreeNode
 */

/**
 * @typedef {{
 *   path: string;
 *   title: string;
 *   parentPath: string | null;
 *   isRoutable: boolean;
 *   isMenu: boolean;
 *   titleKey?: string;
 *   i18n?: string;
 *   page?: string;
 *   source?: RouteSource;
 *   activeMenuPath?: string;
 *   preferRouteTitle?: boolean;
 *   requiresCustomerAppealsAccess?: boolean;
 *   allowedInspectionRoles?: string | string[];
 *   keepAlive?: {
 *     group?: string;
 *     mode?: string;
 *   };
 *   children: ProtectedRouteTreeNode[];
 * }} ProtectedRouteTreeNode
 */

function unwrapNode(node) {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return unwrapNode(node.expression);
  }

  return node;
}

function getPropertyName(nameNode) {
  if (
    ts.isIdentifier(nameNode) ||
    ts.isStringLiteral(nameNode) ||
    ts.isNumericLiteral(nameNode)
  ) {
    return nameNode.text;
  }

  return null;
}

function serializeExpression(node) {
  const normalizedNode = unwrapNode(node);

  if (ts.isStringLiteral(normalizedNode) || ts.isNoSubstitutionTemplateLiteral(normalizedNode)) {
    return normalizedNode.text;
  }

  if (normalizedNode.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (normalizedNode.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (normalizedNode.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isIdentifier(normalizedNode)) {
    return normalizedNode.text;
  }

  if (ts.isPropertyAccessExpression(normalizedNode)) {
    return normalizedNode.getText(sourceFile);
  }

  if (ts.isArrayLiteralExpression(normalizedNode)) {
    return normalizedNode.elements
      .map((element) => serializeExpression(element))
      .filter((value) => value !== OMIT);
  }

  if (ts.isObjectLiteralExpression(normalizedNode)) {
    const objectValue = {};

    normalizedNode.properties.forEach((property) => {
      if (ts.isPropertyAssignment(property)) {
        const propertyName = getPropertyName(property.name);
        if (!propertyName) {
          return;
        }

        const propertyValue = serializeExpression(property.initializer);
        if (propertyValue !== OMIT) {
          objectValue[propertyName] = propertyValue;
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        objectValue[property.name.text] = property.name.text;
      }
    });

    return objectValue;
  }

  if (
    ts.isNewExpression(normalizedNode) &&
    ts.isIdentifier(normalizedNode.expression) &&
    normalizedNode.expression.text === "Set"
  ) {
    const [setArgument] = normalizedNode.arguments ?? [];
    const setValues = setArgument ? serializeExpression(setArgument) : [];
    return Array.isArray(setValues) ? setValues : [];
  }

  return OMIT;
}

function findVariableDeclaration(name) {
  /** @type {ts.VariableDeclaration | undefined} */
  let matchedDeclaration;

  function visit(node) {
    if (matchedDeclaration) {
      return;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      matchedDeclaration = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matchedDeclaration;
}

function requireInitializer(name) {
  const declaration = findVariableDeclaration(name);
  if (!declaration?.initializer) {
    throw new Error(`Unable to find initializer for "${name}".`);
  }

  return declaration.initializer;
}

function normalizeKeepAlive(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return undefined;
  }

  const keepAlive = {};
  if (typeof rawValue.group === "string") {
    keepAlive.group = rawValue.group;
  }
  if (typeof rawValue.mode === "string") {
    keepAlive.mode = rawValue.mode;
  }

  return Object.keys(keepAlive).length > 0 ? keepAlive : undefined;
}

function normalizeAllowedInspectionRoles(rawValue) {
  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    const roleNames = rawValue.filter((item) => typeof item === "string");
    return roleNames.length > 0 ? roleNames : undefined;
  }

  return undefined;
}

let configOrderCounter = 0;

function normalizeRouteNode(rawNode, parentPath = null) {
  if (!rawNode || typeof rawNode !== "object" || Array.isArray(rawNode)) {
    return null;
  }

  const node = {
    path: typeof rawNode.path === "string" ? rawNode.path : undefined,
    title: typeof rawNode.title === "string" ? rawNode.title : undefined,
    titleKey: typeof rawNode.titleKey === "string" ? rawNode.titleKey : undefined,
    isMenu: typeof rawNode.isMenu === "boolean" ? rawNode.isMenu : undefined,
    page: typeof rawNode.page === "string" ? rawNode.page : undefined,
    i18n: typeof rawNode.i18n === "string" ? rawNode.i18n : undefined,
    keepAlive: normalizeKeepAlive(rawNode.keepAlive),
    preferRouteTitle:
      typeof rawNode.preferRouteTitle === "boolean" ? rawNode.preferRouteTitle : undefined,
    allowedInspectionRoles: normalizeAllowedInspectionRoles(rawNode.allowedInspectionRoles),
    activeMenuPath:
      typeof rawNode.activeMenuPath === "string" ? rawNode.activeMenuPath : undefined,
    requiresCustomerAppealsAccess:
      typeof rawNode.requiresCustomerAppealsAccess === "boolean"
        ? rawNode.requiresCustomerAppealsAccess
        : undefined,
    parentPath,
    configOrder: configOrderCounter++,
    children: [],
  };

  const currentPath = node.path ?? parentPath;
  const rawChildren = Array.isArray(rawNode.children) ? rawNode.children : [];
  node.children = rawChildren
    .map((child) => normalizeRouteNode(child, currentPath ?? null))
    .filter(Boolean);

  return node;
}

function getTopLevelPageEntries() {
  const pageEntries = fs
    .readdirSync(pagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((directoryName) =>
      fs.existsSync(path.join(pagesDirectory, directoryName, "index.tsx")),
    )
    .sort((left, right) => left.localeCompare(right));

  const normalizedPageModulePaths = new Set(
    pageEntries.map((pageName) => `../pages/${pageName}/index.tsx`.replace(/\\/g, "/").toLowerCase()),
  );

  return {
    pageNames: pageEntries,
    hasPageModule(pageName) {
      const expectedPath = `../pages/${pageName}/index.tsx`
        .replace(/\\/g, "/")
        .toLowerCase();
      return normalizedPageModulePaths.has(expectedPath);
    },
  };
}

function cloneRouteRecord(route) {
  return {
    path: route.path,
    title: route.title,
    titleKey: route.titleKey,
    isMenu: route.isMenu,
    page: route.page,
    i18n: route.i18n,
    keepAlive: route.keepAlive ? { ...route.keepAlive } : undefined,
    preferRouteTitle: route.preferRouteTitle,
    allowedInspectionRoles: Array.isArray(route.allowedInspectionRoles)
      ? [...route.allowedInspectionRoles]
      : route.allowedInspectionRoles,
    activeMenuPath: route.activeMenuPath,
    requiresCustomerAppealsAccess: route.requiresCustomerAppealsAccess,
    parentPath: route.parentPath,
    configOrder: route.configOrder,
    children: route.children ? route.children.map((child) => cloneRouteRecord(child)) : undefined,
  };
}

function createCandidateFromNode(route, source) {
  if (!route.path || !route.title) {
    return null;
  }

  return {
    path: route.path,
    page: route.page ?? "",
    title: route.title,
    titleKey: route.titleKey,
    i18n: route.i18n,
    isMenu: route.isMenu ?? false,
    parentPath: route.parentPath,
    source,
    activeMenuPath: route.activeMenuPath,
    preferRouteTitle: route.preferRouteTitle,
    requiresCustomerAppealsAccess: route.requiresCustomerAppealsAccess,
    allowedInspectionRoles: route.allowedInspectionRoles,
    keepAlive: route.keepAlive ? { ...route.keepAlive } : undefined,
    configOrder: route.configOrder,
  };
}

function normalizeRouteKey(value) {
  return value?.toLowerCase().replace(/-/g, "") ?? "";
}

function createFlattenedRoute(route) {
  const flattenedRoute = cloneRouteRecord(route);
  delete flattenedRoute.children;

  return {
    ...flattenedRoute,
    isMenu: false,
  };
}

function collectMatchingChildren(items, pageName) {
  const normalizedPageName = normalizeRouteKey(pageName);
  let pageExact = [];
  let segmentExact = [];
  let fuzzy = [];

  items.forEach((item) => {
    const normalizedItemPage = normalizeRouteKey(item.page);
    const normalizedItemPath = normalizeRouteKey(item.path);
    const normalizedLastSegment = normalizeRouteKey(item.path?.split("/").pop());

    if (normalizedItemPage === normalizedPageName) {
      pageExact.push(item);
    } else if (normalizedLastSegment === normalizedPageName) {
      segmentExact.push(item);
    } else if (normalizedItemPath && normalizedItemPath.includes(normalizedPageName)) {
      fuzzy.push(item);
    }

    if (item.children?.length) {
      const childMatches = collectMatchingChildren(item.children, pageName);
      pageExact = pageExact.concat(childMatches.pageExact);
      segmentExact = segmentExact.concat(childMatches.segmentExact);
      fuzzy = fuzzy.concat(childMatches.fuzzy);
    }
  });

  return { pageExact, segmentExact, fuzzy };
}

function findMatchingChildren(items, pageName) {
  const { pageExact, segmentExact, fuzzy } = collectMatchingChildren(items, pageName);
  if (pageExact.length > 0) {
    return pageExact;
  }
  if (segmentExact.length > 0) {
    return segmentExact;
  }
  return fuzzy;
}

function generateAllRoutes(menuRouteConfig, pageNames, excludedAutoRoutePages) {
  const routes = menuRouteConfig
    .map((route) => createCandidateFromNode(route, "configured-root"))
    .filter(Boolean);
  const routePaths = new Set(routes.map((route) => route.path).filter(Boolean));

  const appendRoute = (route) => {
    if (!route?.path || routePaths.has(route.path)) {
      return;
    }

    routePaths.add(route.path);
    routes.push(route);
  };

  const appendConfiguredNestedRoutes = (items) => {
    items.forEach((item) => {
      if (item.path && item.page) {
        appendRoute(createCandidateFromNode(createFlattenedRoute(item), "configured-nested"));
      }

      if (item.children?.length) {
        appendConfiguredNestedRoutes(item.children);
      }
    });
  };

  menuRouteConfig.forEach((route) => {
    if (route.children?.length) {
      appendConfiguredNestedRoutes(route.children);
    }
  });

  pageNames.forEach((pageName) => {
    if (excludedAutoRoutePages.has(pageName)) {
      return;
    }

    const existingRoute = routes.find(
      (route) => route.page?.toLowerCase() === pageName.toLowerCase(),
    );

    if (existingRoute) {
      return;
    }

    let found = false;
    for (const menuRouteItem of menuRouteConfig) {
      const targets = findMatchingChildren([menuRouteItem], pageName);
      if (targets.length > 0) {
        const target = targets[0];
        appendRoute({
          path: target.path,
          title: pageName,
          isMenu: false,
          page: pageName,
          titleKey: `menu.${pageName.charAt(0).toLowerCase()}${pageName.slice(1)}`,
          i18n: `menu.${pageName.charAt(0).toLowerCase()}${pageName.slice(1)}`,
          parentPath: target.parentPath,
          source: "auto-matched",
          activeMenuPath: target.activeMenuPath,
          preferRouteTitle: target.preferRouteTitle,
          requiresCustomerAppealsAccess: target.requiresCustomerAppealsAccess,
          allowedInspectionRoles: target.allowedInspectionRoles,
          keepAlive: target.keepAlive ? { ...target.keepAlive } : undefined,
        });
        found = true;
        break;
      }
    }

    if (!found) {
      appendRoute({
        path: `/${pageName.toLowerCase()}`,
        title: pageName,
        isMenu: false,
        page: pageName,
        titleKey: `menu.${pageName.charAt(0).toLowerCase()}${pageName.slice(1)}`,
        i18n: `menu.${pageName.charAt(0).toLowerCase()}${pageName.slice(1)}`,
        parentPath: null,
        source: "auto-fallback",
      });
    }
  });

  return routes;
}

function sanitizeProtectedRouteRecord(route) {
  const record = {
    path: route.path,
    page: route.page,
    title: route.title,
    isMenu: Boolean(route.isMenu),
    parentPath: route.parentPath ?? null,
    source: route.source,
  };

  if (route.titleKey) {
    record.titleKey = route.titleKey;
  }
  if (route.i18n) {
    record.i18n = route.i18n;
  }
  if (route.activeMenuPath) {
    record.activeMenuPath = route.activeMenuPath;
  }
  if (typeof route.preferRouteTitle === "boolean") {
    record.preferRouteTitle = route.preferRouteTitle;
  }
  if (typeof route.requiresCustomerAppealsAccess === "boolean") {
    record.requiresCustomerAppealsAccess = route.requiresCustomerAppealsAccess;
  }
  if (route.allowedInspectionRoles) {
    record.allowedInspectionRoles = route.allowedInspectionRoles;
  }
  if (route.keepAlive && Object.keys(route.keepAlive).length > 0) {
    record.keepAlive = route.keepAlive;
  }

  return record;
}

function createConfiguredNodeIndex(menuRouteConfig) {
  const byPath = new Map();
  const childrenByParent = new Map();
  const topLevelPaths = [];
  const unresolvedConfiguredRoutes = [];

  const visit = (node) => {
    if (node.path) {
      byPath.set(node.path, node);

      const parentKey = node.parentPath;
      const siblings = childrenByParent.get(parentKey) ?? [];
      siblings.push(node.path);
      childrenByParent.set(parentKey, siblings);

      if (parentKey === null) {
        topLevelPaths.push(node.path);
      }
    }

    node.children.forEach(visit);
  };

  menuRouteConfig.forEach(visit);

  return {
    byPath,
    childrenByParent,
    topLevelPaths,
    unresolvedConfiguredRoutes,
  };
}

function buildActualRouteTree(
  topLevelPaths,
  childrenByParent,
  actualRoutesByPath,
  configuredRoutesByPath,
) {
  const visit = (pathValue) => {
    const configuredChildren = childrenByParent.get(pathValue) ?? [];
    const childNodes = configuredChildren.map(visit).filter(Boolean);
    const actualRoute = actualRoutesByPath.get(pathValue);
    const configuredNode = configuredRoutesByPath.get(pathValue);

    if (!actualRoute && childNodes.length === 0) {
      return null;
    }

    return {
      path: pathValue,
      title: configuredNode?.title ?? actualRoute?.title ?? pathValue,
      page: actualRoute?.page,
      parentPath: configuredNode?.parentPath ?? actualRoute?.parentPath ?? null,
      hasActualRoute: Boolean(actualRoute),
      isMenu: configuredNode?.isMenu ?? actualRoute?.isMenu ?? false,
      titleKey: configuredNode?.titleKey ?? actualRoute?.titleKey,
      i18n: configuredNode?.i18n ?? actualRoute?.i18n,
      children: childNodes,
    };
  };

  return topLevelPaths.map(visit).filter(Boolean);
}

function buildProtectedRouteTreeNodes(treeNodes, actualRoutesByPath) {
  return treeNodes.map((node) => {
    const actualRoute = actualRoutesByPath.get(node.path);
    const treeNode = {
      path: node.path,
      title: node.title,
      parentPath: node.parentPath ?? null,
      isRoutable: Boolean(actualRoute),
      isMenu: Boolean(actualRoute?.isMenu ?? node.isMenu),
      children: buildProtectedRouteTreeNodes(node.children, actualRoutesByPath),
    };

    if (node.titleKey) {
      treeNode.titleKey = node.titleKey;
    }
    if (node.i18n) {
      treeNode.i18n = node.i18n;
    }

    if (actualRoute) {
      treeNode.page = actualRoute.page;
      treeNode.source = actualRoute.source;

      if (actualRoute.titleKey) {
        treeNode.titleKey = actualRoute.titleKey;
      }
      if (actualRoute.i18n) {
        treeNode.i18n = actualRoute.i18n;
      }
      if (actualRoute.activeMenuPath) {
        treeNode.activeMenuPath = actualRoute.activeMenuPath;
      }
      if (typeof actualRoute.preferRouteTitle === "boolean") {
        treeNode.preferRouteTitle = actualRoute.preferRouteTitle;
      }
      if (typeof actualRoute.requiresCustomerAppealsAccess === "boolean") {
        treeNode.requiresCustomerAppealsAccess = actualRoute.requiresCustomerAppealsAccess;
      }
      if (actualRoute.allowedInspectionRoles) {
        treeNode.allowedInspectionRoles = actualRoute.allowedInspectionRoles;
      }
      if (actualRoute.keepAlive) {
        treeNode.keepAlive = actualRoute.keepAlive;
      }
    }

    return treeNode;
  });
}

function renderRouteTreeMarkdown(treeNodes, actualRoutesByPath, indentLevel = 0) {
  const lines = [];
  const indent = "  ".repeat(indentLevel);

  treeNodes.forEach((node) => {
    if (node.hasActualRoute) {
      const route = actualRoutesByPath.get(node.path);
      const metadata = [`page=${route.page}`, `source=${route.source}`];
      if (route.isMenu) {
        metadata.push("menu");
      }
      if (route.allowedInspectionRoles) {
        metadata.push(`inspectionRoles=${Array.isArray(route.allowedInspectionRoles) ? route.allowedInspectionRoles.join("|") : route.allowedInspectionRoles}`);
      }
      if (route.requiresCustomerAppealsAccess) {
        metadata.push("customerAppealsAccess");
      }
      if (route.keepAlive?.group) {
        metadata.push(`keepAlive=${route.keepAlive.group}:${route.keepAlive.mode ?? "unknown"}`);
      }

      lines.push(
        `${indent}- \`${route.path}\` -> \`${route.page}\` [${metadata.join(", ")}]`,
      );
      lines.push(...renderRouteTreeMarkdown(node.children, actualRoutesByPath, indentLevel + 1));
      return;
    }

    lines.push(`${indent}- group \`${node.path}\` [not directly routed]`);
    lines.push(...renderRouteTreeMarkdown(node.children, actualRoutesByPath, indentLevel + 1));
  });

  return lines;
}

function collectUnresolvedConfiguredRoutes(configuredNodeIndex, actualRoutesByPath, hasPageModule) {
  const unresolvedRoutes = [];

  configuredNodeIndex.byPath.forEach((node, pathValue) => {
    if (actualRoutesByPath.has(pathValue)) {
      return;
    }

    let reason = "no page mapping";
    if (node.page && !hasPageModule(node.page)) {
      reason = `missing page module "${node.page}"`;
    } else if (node.page) {
      reason = `page "${node.page}" not emitted after filtering`;
    }

    unresolvedRoutes.push({
      path: pathValue,
      title: node.title ?? pathValue,
      reason,
      parentPath: node.parentPath,
    });
  });

  unresolvedRoutes.sort((left, right) => {
    const leftOrder = configuredNodeIndex.byPath.get(left.path)?.configOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = configuredNodeIndex.byPath.get(right.path)?.configOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return unresolvedRoutes;
}

function createMarkdownDocument({
  generatedAt,
  protectedRoutes,
  actualRouteTree,
  actualRoutesByPath,
  unresolvedConfiguredRoutes,
  autoFallbackRoutes,
}) {
  const summary = [
    `- Total actual protected routes: ${protectedRoutes.length}`,
    `- Menu routes: ${protectedRoutes.filter((route) => route.isMenu).length}`,
    `- Configured root routes: ${protectedRoutes.filter((route) => route.source === "configured-root").length}`,
    `- Configured nested routes: ${protectedRoutes.filter((route) => route.source === "configured-nested").length}`,
    `- Auto-matched routes: ${protectedRoutes.filter((route) => route.source === "auto-matched").length}`,
    `- Auto-fallback routes: ${autoFallbackRoutes.length}`,
  ];

  const treeLines = renderRouteTreeMarkdown(actualRouteTree, actualRoutesByPath);
  const unresolvedLines =
    unresolvedConfiguredRoutes.length > 0
      ? unresolvedConfiguredRoutes.map(
          (route) => `- \`${route.path}\` (${route.title}): ${route.reason}`,
        )
      : ["- None"];

  const autoFallbackLines =
    autoFallbackRoutes.length > 0
      ? [...autoFallbackRoutes]
          .sort((left, right) => left.path.localeCompare(right.path))
          .map(
            (route) =>
              `- \`${route.path}\` -> \`${route.page}\` [source=${route.source}]`,
          )
      : ["- None"];

  return [
    "# Protected Route Tree",
    "",
    `Generated: \`${generatedAt}\``,
    "",
    "## Summary",
    ...summary,
    "",
    "## Tree",
    ...(treeLines.length > 0 ? treeLines : ["- None"]),
    "",
    "## Unresolved Configured Routes Excluded From Output",
    ...unresolvedLines,
    "",
    "## Auto-Fallback Routes Without Configured Parent",
    ...autoFallbackLines,
    "",
  ].join("\n");
}

function writeProtectedRouteTable(outputPath, generatedAt, protectedRoutes) {
  const headerLines = [
    "// This file is auto-generated by `npm run routes:export`.",
    `// Generated at: ${generatedAt}`,
    "",
    "export type ProtectedRouteRecord = {",
    "  path: string;",
    "  page: string;",
    "  title: string;",
    "  titleKey?: string;",
    "  i18n?: string;",
    "  isMenu: boolean;",
    "  parentPath: string | null;",
    '  source: "configured-root" | "configured-nested" | "auto-matched" | "auto-fallback";',
    "  activeMenuPath?: string;",
    "  preferRouteTitle?: boolean;",
    "  requiresCustomerAppealsAccess?: boolean;",
    "  allowedInspectionRoles?: string | string[];",
    "  keepAlive?: {",
    "    group?: string;",
    "    mode?: string;",
    "  };",
    "};",
    "",
    `export const protectedRouteTable: ProtectedRouteRecord[] = ${JSON.stringify(protectedRoutes, null, 2)};`,
    "",
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, headerLines.join("\n"), "utf8");
}

function writeProtectedRouteTree(outputPath, generatedAt, protectedRouteTree) {
  const headerLines = [
    "// This file is auto-generated by `npm run routes:export`.",
    `// Generated at: ${generatedAt}`,
    "",
    "export type ProtectedRouteTreeNode = {",
    "  path: string;",
    "  title: string;",
    "  parentPath: string | null;",
    "  isRoutable: boolean;",
    "  isMenu: boolean;",
    "  titleKey?: string;",
    "  i18n?: string;",
    "  page?: string;",
    '  source?: "configured-root" | "configured-nested" | "auto-matched" | "auto-fallback";',
    "  activeMenuPath?: string;",
    "  preferRouteTitle?: boolean;",
    "  requiresCustomerAppealsAccess?: boolean;",
    "  allowedInspectionRoles?: string | string[];",
    "  keepAlive?: {",
    "    group?: string;",
    "    mode?: string;",
    "  };",
    "  children: ProtectedRouteTreeNode[];",
    "};",
    "",
    `export const protectedRouteTree: ProtectedRouteTreeNode[] = ${JSON.stringify(protectedRouteTree, null, 2)};`,
    "",
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, headerLines.join("\n"), "utf8");
}

function createUniqueChildKeys(nodes) {
  const usageCount = new Map();

  return nodes.map((node) => {
    const baseKey = node.title || node.page || node.path;
    const seenCount = usageCount.get(baseKey) ?? 0;
    usageCount.set(baseKey, seenCount + 1);

    if (seenCount === 0) {
      return baseKey;
    }

    return `${baseKey} (${node.path})`;
  });
}

function buildPermissionRouteJsonNode(node, isTopLevel = false) {
  const payload = {
    permissionName: isTopLevel ? node.title : "",
    frontendRoute: node.path,
  };

  if (node.children.length > 0) {
    const childKeys = createUniqueChildKeys(node.children);
    const childObject = {};

    node.children.forEach((childNode, index) => {
      childObject[childKeys[index]] = buildPermissionRouteJsonNode(childNode, false);
    });

    payload.children = [childObject];
  } else {
    payload.children = [];
  }

  return payload;
}

function buildPermissionRouteJson(protectedRouteTree) {
  return protectedRouteTree.map((node) => buildPermissionRouteJsonNode(node, true));
}

function writeProtectedRoutePermissionsJson(outputPath, permissionRouteJson) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(permissionRouteJson, null, 2)}\n`, "utf8");
}

function main() {
  const rawMenuRouteConfig = serializeExpression(requireInitializer("menuRouteConfig"));
  if (!Array.isArray(rawMenuRouteConfig)) {
    throw new Error("menuRouteConfig did not evaluate to an array.");
  }

  const rawPublicRoutes = serializeExpression(requireInitializer("publicRoutes"));
  if (!Array.isArray(rawPublicRoutes)) {
    throw new Error("publicRoutes did not evaluate to an array.");
  }

  const rawExcludedPages = serializeExpression(requireInitializer("excludedAutoRoutePages"));
  if (!Array.isArray(rawExcludedPages)) {
    throw new Error("excludedAutoRoutePages did not evaluate to an array.");
  }

  configOrderCounter = 0;
  const menuRouteConfig = rawMenuRouteConfig
    .map((route) => normalizeRouteNode(route, null))
    .filter(Boolean);

  const publicPaths = new Set(
    rawPublicRoutes
      .map((route) =>
        route && typeof route === "object" && typeof route.path === "string"
          ? route.path
          : null,
      )
      .filter(Boolean),
  );

  const excludedAutoRoutePages = new Set(
    rawExcludedPages.filter((pageName) => typeof pageName === "string"),
  );

  const { pageNames, hasPageModule } = getTopLevelPageEntries();
  const allRoutes = generateAllRoutes(menuRouteConfig, pageNames, excludedAutoRoutePages);
  const dedupedProtectedRoutes = [];
  const emittedPaths = new Set();

  allRoutes.forEach((route) => {
    if (!route.path || !route.page || publicPaths.has(route.path) || !hasPageModule(route.page)) {
      return;
    }

    if (emittedPaths.has(route.path)) {
      return;
    }

    emittedPaths.add(route.path);
    dedupedProtectedRoutes.push(route);
  });

  const protectedRoutes = dedupedProtectedRoutes.map(sanitizeProtectedRouteRecord);
  const protectedRoutesByPath = new Map(protectedRoutes.map((route) => [route.path, route]));
  const configuredNodeIndex = createConfiguredNodeIndex(menuRouteConfig);
  const actualRouteTree = buildActualRouteTree(
    configuredNodeIndex.topLevelPaths,
    configuredNodeIndex.childrenByParent,
    protectedRoutesByPath,
    configuredNodeIndex.byPath,
  );
  const unresolvedConfiguredRoutes = collectUnresolvedConfiguredRoutes(
    configuredNodeIndex,
    protectedRoutesByPath,
    hasPageModule,
  );
  const autoFallbackRoutes = protectedRoutes.filter(
    (route) => route.source === "auto-fallback" && route.parentPath === null,
  );
  const protectedRouteTree = buildProtectedRouteTreeNodes(
    actualRouteTree,
    protectedRoutesByPath,
  ).concat(
    autoFallbackRoutes
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((route) => ({
        ...route,
        isRoutable: true,
        children: [],
      })),
  );
  const protectedRoutePermissionsJson = buildPermissionRouteJson(protectedRouteTree);
  const generatedAt = new Date().toISOString();

  writeProtectedRouteTable(protectedRouteTablePath, generatedAt, protectedRoutes);
  writeProtectedRouteTree(protectedRouteTreePath, generatedAt, protectedRouteTree);
  writeProtectedRoutePermissionsJson(
    protectedRoutePermissionsJsonPath,
    protectedRoutePermissionsJson,
  );

  fs.mkdirSync(path.dirname(markdownOutputPath), { recursive: true });
  fs.writeFileSync(
    markdownOutputPath,
    createMarkdownDocument({
      generatedAt,
      protectedRoutes,
      actualRouteTree,
      actualRoutesByPath: protectedRoutesByPath,
      unresolvedConfiguredRoutes,
      autoFallbackRoutes,
    }),
    "utf8",
  );

  console.log(
    `Exported ${protectedRoutes.length} protected routes to ${path.relative(
      repoRoot,
      protectedRouteTablePath,
    )}, ${path.relative(repoRoot, protectedRouteTreePath)}, ${path.relative(
      repoRoot,
      protectedRoutePermissionsJsonPath,
    )}, and ${path.relative(repoRoot, markdownOutputPath)}.`,
  );
}

main();
