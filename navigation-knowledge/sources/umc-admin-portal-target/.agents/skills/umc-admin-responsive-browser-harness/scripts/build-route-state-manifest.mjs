#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

const scriptDirectory = path.dirname(new URL(import.meta.url).pathname);
const routeOutput = execFileSync(
  process.execPath,
  [path.join(scriptDirectory, "extract-secondary-menu-routes.mjs")],
  { encoding: "utf8" },
);
const routes = JSON.parse(routeOutput);

const moduleRoles = {
  "/licensing": ["Licensing Admin", "Licensing Staff"],
  "/content": ["Content Leader", "Content Staff"],
  "/inspection": [
    "Inspection Admin",
    "Inspector Staff",
    "Committee Staff",
  ],
  "/happiness": ["Happiness Leader", "Happiness Staff"],
  "/service-management": ["Service Configuration Staff"],
  "/financial-payment": ["Finance Admin"],
  "/cms": ["CMS Staff"],
  "/communications": ["IT Admin"],
  "/system-management": ["Super Admin", "IT Admin"],
};

const routeStates = {
  "/licensing/applications": ["To Do", "Completed"],
  "/licensing/team-management": [
    "Team Tasks / To Do",
    "Team Tasks / Completed",
    "Team Members",
  ],
  "/content/ContentApplications": ["My Tasks / To Do", "My Tasks / Completed"],
  "/content/team-management": [
    "Team Tasks / To Do",
    "Team Tasks / Completed",
    "Team Members",
  ],
  "/content/ContentLibrary": [
    "Books",
    "Newspapers",
    "Cinema",
    "Video Games",
    "Regulate Entry Items",
  ],
  "/inspection/tasks": [
    "Queued",
    "To Do",
    "Completed",
    "Team Tasks / Inspection",
    "Team Tasks / Other",
    "Team Members",
  ],
  "/inspection/violations": ["To Do", "Completed"],
  "/happiness/tickets": ["To Do", "Completed"],
  "/happiness/team-management": [
    "Team Tasks / To Do",
    "Team Tasks / Completed",
    "Team Members",
  ],
  "/happiness/customerManagement": ["Accounts", "Profiles"],
  "/happiness/refunds": ["To Do", "Completed"],
  "/happiness/appeals": ["To Do", "Completed"],
  "/system-management/adminPortalLogs": [
    "User Activity",
    "System Operations",
    "Security Logs",
    "Security Audit",
  ],
};

const excludedToolbarRoutes = new Set([
  "/service-management/mydashboard",
  "/cms/pageManagement",
  "/financial-payment/reports-analytics",
]);

const manifest = routes.map((route) => ({
  roleNames: moduleRoles[route.modulePath] ?? [],
  route: route.path,
  page: route.page,
  states: routeStates[route.path] ?? ["Default"],
  toolbarAudit: !excludedToolbarRoutes.has(route.path),
  expectedActions: {
    source: "captured-1920-baseline",
  },
  expectedModalFields: {
    source: "semantic-page-config",
  },
}));

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
