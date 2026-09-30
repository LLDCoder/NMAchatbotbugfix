export type BuildVersionInfo = {
  buildId: string;
  buildTime: string;
  packageVersion: string;
};

export function normalizeBuildVersion(value: unknown): BuildVersionInfo | null;

export function hasBuildVersionChanged(
  currentVersion: BuildVersionInfo | null,
  latestVersion: BuildVersionInfo | null,
): boolean;

export function shouldStartBuildVersionCheck(checking: boolean): boolean;
