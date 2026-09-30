const NOTIFICATION_REFERENCE_REGEX =
  /\b(?:(?:IN|VN)-\d{4}-\d{7}|(?:ML|MC|MP|HC|RF)-[A-Z0-9]+-[A-Z0-9]+-\d{7})\b/gi;

const SERVICE_APPLICATION_REFERENCE_REGEX = /^(?:ML|MC|MP)-/i;

const APPLICATION_DETAIL_PATHS: Record<number, string> = {
  1: "/licensing/applications/applicationsDetails",
  2: "/content/ContentApplications/ContentApplicationsDetails",
};

const NOTIFICATION_DETAIL_ROUTE_PARAMS: Record<string, readonly string[]> = {
  "/content/contentapplications/contentapplicationsdetails": ["taskId"],
  "/happiness/appeals/appealsdetails": ["appealId"],
  "/happiness/refunds/refundsdetails": ["refundId", "refundNo"],
  "/happiness/tickets/tickets-details": ["id"],
  "/inspection/tasks/detail": ["taskId", "taskNo"],
  "/inspection/violations/detail": ["violationId", "violationNo"],
  "/licensing/applications/applicationsdetails": ["taskId"],
};

export function linkifyNotificationReferenceNumbers(html: string): string {
  if (!html) return "";

  return html
    .split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g)
    .map((fragment) =>
      fragment.startsWith("<")
        ? fragment
        : fragment.replace(
            NOTIFICATION_REFERENCE_REGEX,
            '<span class="notification-ref-no">$&</span>',
          ),
    )
    .join("");
}

export function getInternalNotificationPath(
  link?: string | null,
): string | null {
  const trimmedLink = link?.trim();
  if (!trimmedLink) return null;

  try {
    const parsedUrl = new URL(trimmedLink, "http://admin-portal.local");
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "").toLowerCase();

    const requiredParams = NOTIFICATION_DETAIL_ROUTE_PARAMS[normalizedPath];
    const hasRequiredParam = requiredParams?.some((param) =>
      Boolean(parsedUrl.searchParams.get(param)?.trim()),
    );

    if (!hasRequiredParam) {
      return null;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return null;
  }
}

export function resolveProvidedNotificationPath(
  linkUrl?: string | null,
  linkVariableValues?: string | null,
  referenceNo?: string,
  hasMultipleReferences = false,
): string | null {
  const normalizedLinkUrl = linkUrl?.trim();
  let targetPath: string | null;

  if (normalizedLinkUrl) {
    if (!/^\/[^/\\]/.test(normalizedLinkUrl)) {
      throw new Error("Invalid notification linkUrl");
    }

    targetPath = getInternalNotificationPath(normalizedLinkUrl);
    if (!targetPath) {
      throw new Error("Invalid notification linkUrl");
    }
  } else {
    targetPath = getInternalNotificationPath(linkVariableValues);
  }

  if (!targetPath || !hasMultipleReferences || !referenceNo) {
    return targetPath;
  }

  const targetUrl = new URL(targetPath, "http://admin-portal.local");
  const matchesReference = Array.from(targetUrl.searchParams.values()).some(
    (value) => value.trim().toLowerCase() === referenceNo.trim().toLowerCase(),
  );
  return matchesReference ? targetPath : null;
}

type NotificationRouteMetadata = {
  path?: string | null;
  permissionPath?: string | null;
  activeMenuPath?: string | null;
};

function normalizePath(path?: string | null): string {
  const [pathname = ""] = String(path ?? "").split(/[?#]/);
  return (pathname.startsWith("/") ? pathname : `/${pathname}`)
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function isNotificationRouteAllowed(
  route: NotificationRouteMetadata | undefined,
  permissionPaths: Set<string>,
): boolean {
  if (!route) return false;

  return [route.path, route.permissionPath, route.activeMenuPath].some((path) => {
    const normalizedPath = normalizePath(path);
    return normalizedPath !== "/" && permissionPaths.has(normalizedPath);
  });
}

export function buildDirectNotificationPath(
  referenceNo: string,
  relatedId?: string | null,
): string | null {
  const normalizedReferenceNo = referenceNo.trim();
  const normalizedRelatedId = String(relatedId ?? "").trim();
  const encodedReferenceNo = encodeURIComponent(normalizedReferenceNo);

  if (/^IN-/i.test(normalizedReferenceNo)) {
    return `/inspection/tasks/detail?taskNo=${encodedReferenceNo}`;
  }

  if (/^VN-/i.test(normalizedReferenceNo)) {
    return `/inspection/violations/detail?violationNo=${encodedReferenceNo}`;
  }

  if (/^(?:HC-02-|RF-)/i.test(normalizedReferenceNo)) {
    return `/happiness/refunds/refundsDetails?refundNo=${encodedReferenceNo}`;
  }

  if (/^HC-01-/i.test(normalizedReferenceNo) && normalizedRelatedId) {
    return `/happiness/tickets/tickets-details?id=${encodeURIComponent(
      normalizedRelatedId,
    )}`;
  }

  if (/^HC-03-/i.test(normalizedReferenceNo) && normalizedRelatedId) {
    return `/happiness/appeals/appealsDetails?appealId=${encodeURIComponent(
      normalizedRelatedId,
    )}`;
  }

  return null;
}

export function isServiceApplicationReference(referenceNo: string): boolean {
  return SERVICE_APPLICATION_REFERENCE_REGEX.test(referenceNo.trim());
}

export function buildServiceApplicationPath({
  taskId,
  departmentId,
  referenceNo,
}: {
  taskId: string;
  departmentId: number;
  referenceNo: string;
}): string | null {
  const targetPath = APPLICATION_DETAIL_PATHS[departmentId];
  const normalizedTaskId = taskId.trim();
  const normalizedReferenceNo = referenceNo.trim();

  if (!targetPath || !normalizedTaskId || !normalizedReferenceNo) {
    return null;
  }

  const params = new URLSearchParams({
    taskId: normalizedTaskId,
    applicationNo: normalizedReferenceNo,
  });
  return `${targetPath}?${params.toString()}`;
}
