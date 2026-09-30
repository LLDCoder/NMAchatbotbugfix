import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { detectPageFailure } from "./admin-menu-audit-policy.mjs";

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.UMC_ADMIN_BASE_URL || "http://localhost:5173").replace(
  /\/+$/,
  "",
);
const password = process.env.UMC_ADMIN_TEST_PASSWORD;
const concurrency = Math.min(
  8,
  Math.max(
    1,
    Number.parseInt(process.env.UMC_ADMIN_TEST_CONCURRENCY || "3", 10) || 3,
  ),
);
const bundledPlaywrightCli = join(
  homedir(),
  ".codex/skills/playwright/scripts/playwright_cli.sh",
);
const playwrightCli =
  process.env.PWCLI ||
  (existsSync(bundledPlaywrightCli) ? bundledPlaywrightCli : "playwright-cli");
const outputDirectory = resolve("output/playwright/admin-menu-audit");
mkdirSync(outputDirectory, { recursive: true });
const configuredAccounts = [
  ["licenses-admin", "header@license.com"],
  ["licenses-staff1", "Test-Admin-Staff@gmail.com"],
  ["license-staff-ff", "license-staff1@gmail.com"],
  ["content-leader", "Content-Manager@test.com"],
  ["content-staff", "Content-Staff1@test.com"],
  ["content-staff2", "menghan.wang@ctechm.com"],
  ["happiness-leader", "text-000@gmail.com"],
  ["happiness-staff", "happiness01@customer.com"],
  ["inspection-admin", "admin@inspection.com"],
  ["inspector-staff", "Inspector1@inspection.com"],
  ["committee-staff", "inspector2@inspection.com"],
  ["finance-admin", "wangmenghanfd@gmail.com"],
  ["super-admin", "Test-Admin@gmail.com"],
  ["it-admin", "it.management@it.com"],
  ["cms-staff", "cms.staff@it.com"],
  ["service-configuration-staff", "service.staff@it.com"],
];

if (!password) {
  console.error(
    "UMC_ADMIN_TEST_PASSWORD is required. Example: UMC_ADMIN_TEST_PASSWORD='***' npm run test:admin-menu",
  );
  process.exit(2);
}

const requestedAccounts = new Set(
  (process.env.UMC_ADMIN_TEST_ACCOUNTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const accounts = requestedAccounts.size
  ? configuredAccounts.filter(
      ([name, email]) =>
        requestedAccounts.has(name.toLowerCase()) ||
        requestedAccounts.has(email.toLowerCase()),
    )
  : configuredAccounts;

if (!accounts.length) {
  console.error("No configured account matched UMC_ADMIN_TEST_ACCOUNTS.");
  process.exit(2);
}

function createBrowserScript(name, email) {
  return `async (page) => {
    const result = {
      email: ${JSON.stringify(email)},
      clickedRoutes: [],
      failures: [],
    };
    const routeErrorPattern = /failed to fetch dynamically imported module|page module not found|cannot find module|chunkloaderror|loading chunk|\\/src\\/pages\\/.*404/i;
    const routeErrors = [];
    const detectPageFailure = ${detectPageFailure.toString()};
    const accountName = ${JSON.stringify(name)};

    page.on("pageerror", (error) => {
      routeErrors.push({ route: page.url(), message: error.message });
    });
    page.on("console", (message) => {
      if (message.type() === "error" && routeErrorPattern.test(message.text())) {
        routeErrors.push({ route: page.url(), message: message.text() });
      }
    });
    page.on("response", (response) => {
      const url = response.url();
      if (
        response.status() >= 400 &&
        (/\\/src\\/pages\\//i.test(url) || /\\/assets\\/.*\\.js(?:\\?|$)/i.test(url))
      ) {
        routeErrors.push({
          route: page.url(),
          message: \`\${response.status()} \${url}\`,
        });
      }
    });

    const normalizePath = (value) => {
      const path = value
        .replace(${JSON.stringify(baseUrl)}, "")
        .split(/[?#]/, 1)[0];
      return (path.replace(/\\/+$/, "") || "/").toLowerCase();
    };
    const verifyCurrentPage = async (expectedHref) => {
      await page.waitForLoadState("domcontentloaded");
      await page
        .locator(".route-status--loading")
        .waitFor({ state: "hidden", timeout: 30000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
      const expectedPath = normalizePath(expectedHref);
      let pageState;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          pageState = await page.evaluate(() => {
            const statusElement = document.querySelector(".route-status");
            const style = statusElement
              ? window.getComputedStyle(statusElement)
              : null;

            return {
              rootTextLength:
                document.querySelector("#root")?.textContent?.trim().length || 0,
              routeStatusVisible: Boolean(
                statusElement &&
                  style?.display !== "none" &&
                  style?.visibility !== "hidden" &&
                  statusElement.getClientRects().length > 0,
              ),
              resultTitle:
                statusElement
                  ?.querySelector(".ant-result-title")
                  ?.textContent?.trim() || "",
              diagnosticText:
                statusElement
                  ?.querySelector(".route-status__diagnostic")
                  ?.textContent?.trim() || "",
            };
          });
          break;
        } catch (error) {
          if (attempt === 2 || !/execution context was destroyed/i.test(String(error))) {
            throw error;
          }
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(500);
        }
      }
      const actualPath = normalizePath(page.url());
      const routeStatus = pageState || {
        routeStatusVisible: false,
        resultTitle: "",
        diagnosticText: "",
      };
      const pageFailure = detectPageFailure(routeStatus);
      let failureReason = "";

      if (actualPath !== expectedPath) {
        failureReason =
          \`redirected to \${normalizePath(page.url())}\`;
      } else if (!pageState?.rootTextLength) {
        failureReason = "empty page";
      } else if (pageFailure) {
        failureReason = pageFailure;
      }

      if (failureReason) {
        result.failures.push({
          route: expectedHref,
          reason: failureReason,
        });
        const safeRoute = expectedPath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
        await page.screenshot({
          path: ${JSON.stringify(outputDirectory)} + "/" + accountName + "-" + safeRoute + ".png",
          fullPage: true,
        });
      }
    };
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(${JSON.stringify(`${baseUrl}/login`)}, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("textbox", { name: /Email/i }).fill(${JSON.stringify(email)});
    await page.getByRole("textbox", { name: /Password/i }).fill(${JSON.stringify(password)});
    await page.getByRole("button", { name: /^Login$/i }).click();
    await page.waitForURL(
      (url) => normalizePath(url.toString()) !== "/login",
      { timeout: 20000 },
    );
    try {
      await page.waitForSelector(".sider .menu .menu-item", { timeout: 20000 });
    } catch {
      await verifyCurrentPage(normalizePath(page.url()));
      return result;
    }
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => undefined);
    await page.waitForTimeout(500);
    const discoveredRoutes = new Set();
    let previousRouteSignature = "";
    let stableRouteChecks = 0;

    for (let checkIndex = 0; checkIndex < 20; checkIndex += 1) {
      const topLevelMenus = page.locator(".sider .menu > .menu-item");
      const topLevelCount = await topLevelMenus.count();

      for (let menuIndex = 0; menuIndex < topLevelCount; menuIndex += 1) {
        const menu = topLevelMenus.nth(menuIndex);
        const directHref = await menu.getAttribute("href");
        if (directHref) {
          discoveredRoutes.add(directHref);
          continue;
        }

        await menu.hover();
        const activePopover = page.locator(".ant-popover:visible").last();
        const visibleLinks = activePopover.locator("a.menu-item-drop:visible");
        await visibleLinks
          .first()
          .waitFor({ state: "visible", timeout: 5000 })
          .catch(() => undefined);
        const childHrefs = await visibleLinks.evaluateAll((links) =>
          links
            .map((link) => link.getAttribute("href"))
            .filter((href) => Boolean(href)),
        );
        childHrefs.forEach((href) => discoveredRoutes.add(href));
      }

      const routeSignature = [...discoveredRoutes].sort().join("|");
      if (routeSignature === previousRouteSignature) {
        stableRouteChecks += 1;
      } else {
        previousRouteSignature = routeSignature;
        stableRouteChecks = 0;
      }

      if (stableRouteChecks >= 4) break;
      await page.waitForTimeout(500);
    }

    for (const href of discoveredRoutes) {
      const clicked = await page.evaluate((targetHref) => {
        const link = [...document.querySelectorAll("a")].find(
          (candidate) => candidate.getAttribute("href") === targetHref,
        );
        if (!(link instanceof HTMLElement)) return false;
        link.click();
        return true;
      }, href);

      if (!clicked) {
        result.failures.push({ route: href, reason: "menu link disappeared" });
        continue;
      }

      await verifyCurrentPage(href);
      result.clickedRoutes.push(href);
    }

    const uniqueRouteErrors = new Map();
    for (const item of routeErrors) {
      const route = normalizePath(item.route);
      uniqueRouteErrors.set(\`\${route}:\${item.message}\`, { route, reason: item.message });
    }
    for (const failure of uniqueRouteErrors.values()) {
      result.failures.push(failure);
    }

    return result;
  }`;
}

async function runCli(session, ...args) {
  const { stdout, stderr } = await execFileAsync(
    playwrightCli,
    ["--session", session, ...args],
    {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return `${stdout}${stderr}`;
}

function parseResult(output) {
  const resultMarker = "### Result\n";
  const markerIndex = output.lastIndexOf(resultMarker);

  if (markerIndex === -1) {
    throw new Error(`Playwright CLI returned no result:\n${output}`);
  }

  const resultLine = output
    .slice(markerIndex + resultMarker.length)
    .split(/\r?\n/, 1)[0];

  return JSON.parse(resultLine);
}

async function testAccount([name, email], index) {
  const session = `admin-menu-${process.pid}-${index}`;

  try {
    await runCli(session, "open", `${baseUrl}/login`);
    const output = await runCli(session, "run-code", createBrowserScript(name, email));
    return { name, ...parseResult(output) };
  } catch (error) {
    const reason = String(error.message || error).replaceAll(password, "***");

    return {
      name,
      email,
      clickedRoutes: [],
      failures: [{ route: "/login", reason }],
    };
  } finally {
    await runCli(session, "close").catch(() => undefined);
  }
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runNext()),
  );

  return results;
}

console.log(
  `Testing ${accounts.length} account(s) against ${baseUrl} with concurrency ${concurrency}...`,
);
const results = await runPool(accounts, concurrency, testAccount);
const uniqueRoutes = new Set(
  results.flatMap((result) => result.clickedRoutes),
);
let totalRoutes = 0;
let totalFailures = 0;

for (const result of results) {
  totalRoutes += result.clickedRoutes.length;
  totalFailures += result.failures.length;
  const status = result.failures.length ? "FAIL" : "PASS";
  console.log(
    `${status} ${result.name} (${result.email}): ${result.clickedRoutes.length} menu route(s)`,
  );

  for (const failure of result.failures) {
    console.log(`  ${failure.route}: ${failure.reason}`);
  }
}

console.log(
  `Checked ${totalRoutes} menu route visit(s), ${uniqueRoutes.size} unique route(s); ${totalFailures} failure(s).`,
);
writeFileSync(
  join(outputDirectory, "latest.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      accounts: results,
      summary: {
        accountCount: results.length,
        routeVisits: totalRoutes,
        uniqueRoutes: uniqueRoutes.size,
        failures: totalFailures,
      },
    },
    null,
    2,
  )}\n`,
);
process.exitCode = totalFailures ? 1 : 0;
