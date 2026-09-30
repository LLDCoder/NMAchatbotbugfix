import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const footerRules = [
  ["src/components/common/CustomFooter/index.tsx", "custom-footer form-footer detail-action-footer", "src/components/common/CustomFooter/index.less", ".custom-footer,\n.form-footer"],
  ["src/pages/CustomerAppealsDetails/index.tsx", "appeal-detail-footer detail-action-footer", "src/pages/CustomerAppealsDetails/index.less", ".appeal-detail-footer"],
  ["src/pages/CustomerRefundsDetails/index.tsx", "refund-detail-footer detail-action-footer", "src/pages/CustomerRefundsDetails/index.less", ".refund-detail-footer"],
  ["src/pages/FinancialRefundsDetails/index.tsx", "financial-refunds-details__footer detail-action-footer", "src/pages/FinancialRefundsDetails/index.less", ".financial-refunds-details__footer"],
  ["src/pages/InspectionTaskDetails/index.tsx", "inspection-task-details__footer detail-action-footer", "src/pages/InspectionTaskDetails/index.less", ".inspection-task-details__footer"],
  ["src/pages/InspectionViolationDetails/index.tsx", "inspection-violation-details__footer detail-action-footer", "src/pages/InspectionViolationDetails/index.less", ".inspection-violation-details__footer"],
  ["src/pages/InspectionStartVisit/index.tsx", "inspection-start-visit__footer detail-action-footer", "src/pages/InspectionStartVisit/index.less", ".inspection-start-visit__footer"],
  ["src/pages/Books/index.tsx", "books-detail-footer detail-action-footer", "src/pages/Books/index.less", ".books-detail-footer"],
  ["src/pages/ProfileDetails/index.tsx", "details-footer detail-action-footer", "src/pages/ProfileDetails/index.less", ".details-footer"],
  ["src/pages/CustomerDetails/index.tsx", "details-footer detail-action-footer", "src/pages/CustomerDetails/index.less", ".details-footer"],
  ["src/pages/LicenseDatails/index.tsx", "form-footer detail-action-footer", "src/pages/LicenseDatails/index.less", ".form-footer"],
  ["src/pages/PermitsDetails/index.tsx", "form-footer detail-action-footer", "src/pages/PermitsDetails/index.less", ".form-footer"],
];

const scrollLayouts = [
  [
    "src/pages/CustomerAppealsDetails/index.less",
    ".appeal-detail-page",
    ".appeal-detail-scroll",
  ],
  [
    "src/pages/CustomerRefundsDetails/index.less",
    ".customer-refunds-details",
    ".customer-refunds-details-scroll",
  ],
];

const getRuleBody = (source, selector) => {
  const selectorIndex = source.indexOf(selector);
  assert.notEqual(selectorIndex, -1, `Expected selector ${selector}`);

  const openingBraceIndex = source.indexOf("{", selectorIndex + selector.length);
  assert.notEqual(openingBraceIndex, -1, `Expected rule body for ${selector}`);

  let depth = 1;
  for (let index = openingBraceIndex + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBraceIndex + 1, index);
  }

  assert.fail(`Expected closing brace for ${selector}`);
};

const getTopLevelContent = (ruleBody) => {
  let depth = 0;
  let content = "";

  for (const character of ruleBody) {
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (depth === 0) content += character;
  }

  return content;
};

test("defines the shared detail footer presentation", () => {
  const appStyles = readFileSync("src/App.less", "utf8");
  const layoutStyles = readFileSync("src/layout/index.css", "utf8");
  const sharedSource = readFileSync("src/styles/detail-action-footer.less", "utf8");
  const sharedRuleBody = getRuleBody(sharedSource, ".detail-action-footer");

  assert.match(appStyles, /@import "@\/styles\/detail-action-footer\.less";/);
  assert.match(
    layoutStyles,
    /\.layout:has\(\.detail-action-footer\)\s*\{[^}]*padding-block-end:\s*var\(--layout-spacing-bottom\);/s,
  );
  assert.match(
    layoutStyles,
    /\.layout:has\(\.detail-action-footer\) \.page-content__inner\s*\{[^}]*padding-block-end:\s*0;/s,
  );
  assert.doesNotMatch(layoutStyles, /\.layout:has\(\.(?:custom-footer|form-footer)\)/);
  assert.match(sharedRuleBody, /position:\s*sticky;/);
  assert.match(sharedRuleBody, /bottom:\s*0;/);
  assert.match(sharedRuleBody, /z-index:\s*20;/);
  assert.match(sharedRuleBody, /width:\s*100%;/);
  assert.match(sharedRuleBody, /flex-shrink:\s*0;/);
  assert.match(sharedRuleBody, /margin-top:\s*auto;/);
  assert.doesNotMatch(sharedRuleBody, /(?:min-height|padding|box-sizing)\s*:/);
  assert.match(
    sharedRuleBody,
    /linear-gradient\(180deg, rgba\(238, 237, 234, 0\) 0%, #eeedea 50%\)/,
  );
  assert.match(sharedRuleBody, /backdrop-filter:\s*blur\(4px\);/);
  assert.match(sharedRuleBody, /-webkit-backdrop-filter:\s*blur\(8px\);/);
});

test("uses the shared presentation for every page-level detail footer", () => {
  for (const [componentPath, className, stylePath, selector] of footerRules) {
    const componentSource = readFileSync(componentPath, "utf8");
    const styleSource = readFileSync(stylePath, "utf8");
    const declarations = getTopLevelContent(getRuleBody(styleSource, selector));

    assert.match(
      componentSource,
      new RegExp(`className=["']${className}["']`),
      `Expected ${componentPath} to use the shared detail footer class`,
    );
    assert.doesNotMatch(
      declarations,
      /^\s*(?:position|bottom|z-index|width|flex-shrink|margin-top|background|backdrop-filter|-webkit-backdrop-filter)\s*:/m,
      `Expected ${selector} in ${stylePath} to avoid shared declaration overrides`,
    );
    assert.doesNotMatch(styleSource, /\.detail-action-footer\(\);/);
  }
});

test("keeps the violation footer dimensions owned by its business layout", () => {
  const componentSource = readFileSync(
    "src/pages/InspectionViolationDetails/index.tsx",
    "utf8",
  );
  const source = readFileSync(
    "src/pages/InspectionViolationDetails/index.less",
    "utf8",
  );
  const scrollDeclarations = getTopLevelContent(
    getRuleBody(source, ".inspection-violation-details__scroll"),
  );
  const declarations = getTopLevelContent(
    getRuleBody(source, ".inspection-violation-details__footer"),
  );

  assert.doesNotMatch(componentSource, /inspection-violation-details--with-footer/);
  assert.doesNotMatch(source, /\.inspection-violation-details--with-footer/);
  assert.match(scrollDeclarations, /flex:\s*1 0 auto;/);
  assert.match(scrollDeclarations, /overflow:\s*visible;/);
  assert.doesNotMatch(scrollDeclarations, /overflow-y:\s*auto;/);
  assert.match(declarations, /align-items:\s*center;/);
  assert.match(declarations, /padding:\s*16px 0 0;/);
  assert.doesNotMatch(declarations, /min-height\s*:/);
});

test("keeps long appeal and refund content inside the footer viewport", () => {
  for (const [stylePath, pageSelector, scrollSelector] of scrollLayouts) {
    const source = readFileSync(stylePath, "utf8");
    const pageDeclarations = getTopLevelContent(
      getRuleBody(source, pageSelector),
    );
    const scrollDeclarations = getTopLevelContent(
      getRuleBody(source, scrollSelector),
    );

    assert.match(pageDeclarations, /height:\s*100%;/);
    assert.match(pageDeclarations, /min-height:\s*0;/);
    assert.match(pageDeclarations, /overflow:\s*hidden;/);
    assert.match(scrollDeclarations, /flex:\s*1 1 0;/);
    assert.match(scrollDeclarations, /overflow-y:\s*auto;/);
  }
});
