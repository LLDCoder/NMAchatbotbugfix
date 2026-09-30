export function normalizeBuildVersion(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const buildId = String(value.buildId || "").trim();
  if (!buildId) {
    return null;
  }

  return {
    buildId,
    buildTime: String(value.buildTime || ""),
    packageVersion: String(value.packageVersion || ""),
  };
}

export function hasBuildVersionChanged(currentVersion, latestVersion) {
  return Boolean(
    currentVersion &&
      latestVersion &&
      currentVersion.buildId &&
      latestVersion.buildId &&
      currentVersion.buildId !== latestVersion.buildId,
  );
}

export function shouldStartBuildVersionCheck(checking) {
  return !checking;
}
