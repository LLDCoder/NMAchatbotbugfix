import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.UMC_ADMIN_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const email = process.env.UMC_ADMIN_TEST_EMAIL;
const password = process.env.UMC_ADMIN_TEST_PASSWORD;
const routes = (process.env.UMC_ADMIN_PAGINATION_ROUTES || "/licensing/profile")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const outputDirectory = resolve("output/playwright/pagination-total");
const bundledPlaywrightCli = join(homedir(), ".codex/skills/playwright/scripts/playwright_cli.sh");
const playwrightCli = process.env.PWCLI || (existsSync(bundledPlaywrightCli) ? bundledPlaywrightCli : "playwright-cli");
const viewports = [
  [1280, 891],
  [1919, 1080],
  [1920, 1080],
];

if (!email || !password) {
  console.error("UMC_ADMIN_TEST_EMAIL and UMC_ADMIN_TEST_PASSWORD are required.");
  process.exit(2);
}

mkdirSync(outputDirectory, { recursive: true });

const runCli = async (session, ...args) => {
  const { stdout, stderr } = await execFileAsync(playwrightCli, ["--session", session, ...args], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  return `${stdout}${stderr}`;
};

const readResult = (output) => {
  const marker = "### Result\n";
  const index = output.lastIndexOf(marker);
  if (index === -1) throw new Error(`Playwright CLI returned no result:\n${output}`);
  return JSON.parse(output.slice(index + marker.length).split(/\r?\n/, 1)[0]);
};

const browserProbe = (route, width, height, screenshotPath) => `async (page) => {
  await page.setViewportSize({ width: ${width}, height: ${height} });
  await page.goto(${JSON.stringify(`${baseUrl}${route}`)}, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const totals = [...document.querySelectorAll(".ant-pagination-total-text > .pagination-total")]
      .filter(visible)
      .map((element) => {
        const children = [...element.children];
        const style = window.getComputedStyle(element);
        return {
          childCount: children.length,
          childTags: children.map((child) => child.tagName),
          texts: children.map((child) => child.textContent?.trim() || ""),
          display: style.display,
          gap: style.columnGap || style.gap,
        };
      });
    return {
      totals,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const failures = result.totals.flatMap((total) => {
    const errors = [];
    if (total.childCount !== 2 || total.childTags.some((tag) => tag !== "DIV")) errors.push("requires two direct div children");
    if (total.texts.some((text) => !text)) errors.push("requires non-empty total and page text");
    if (total.display !== "flex" || total.gap !== "16px") errors.push("requires flex layout with a 16px gap");
    return errors;
  });
  if (result.overflow > 1) failures.push("document horizontal overflow");
  await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: true });
  return { route: ${JSON.stringify(route)}, width: ${width}, height: ${height}, totals: result.totals.length, failures };
}`;

const session = `pagination-total-${process.pid}`;
const failures = [];

try {
  await runCli(session, "open", `${baseUrl}/login`);
  await runCli(session, "run-code", `async (page) => {
    await page.getByRole("textbox", { name: /Email/i }).fill(${JSON.stringify(email)});
    await page.getByRole("textbox", { name: /Password/i }).fill(${JSON.stringify(password)});
    await page.getByRole("button", { name: /^Login$/i }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 });
    return { loggedIn: true };
  }`);

  for (const route of routes) {
    for (const [width, height] of viewports) {
      const safeRoute = route.replaceAll("/", "_").replace(/^_+/, "") || "root";
      const screenshotPath = join(outputDirectory, `${safeRoute}-${width}x${height}.png`);
      const result = readResult(await runCli(session, "run-code", browserProbe(route, width, height, screenshotPath)));
      console.log(result);
      failures.push(...result.failures.map((failure) => `${route} ${width}px: ${failure}`));
    }
  }
} catch (error) {
  failures.push(String(error.message || error).replaceAll(password, "***"));
} finally {
  await runCli(session, "close").catch(() => undefined);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
