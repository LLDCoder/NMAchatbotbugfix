/** Display helpers for API objects that expose *En / *Ar name pairs. */

export function preferLocalizedEnAr(
  isAr: boolean,
  en?: string | null,
  ar?: string | null,
): string {
  const v = isAr ? (ar ?? en) : (en ?? ar);
  return String(v ?? "").trim();
}

/** PendingActions row: bilingual service title from `serviceNameEn` / `serviceNameAr`. */
export function pendingActionServiceDisplayName(
  isAr: boolean,
  row: { serviceNameEn?: string | null; serviceNameAr?: string | null },
): string {
  return preferLocalizedEnAr(isAr, row.serviceNameEn, row.serviceNameAr);
}

/** PendingActions row: English status text for legacy string checks (`applicationStatusEn` or `applicationStatusNameEn`). */
export function pendingActionStatusLabelEn(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const o = row as Record<string, unknown>;
  return String(
    o.applicationStatusEn ?? o.applicationStatusNameEn ?? "",
  ).trim();
}

export function resolveApiEntityLabel(isAr: boolean, entity: unknown): string {
  if (!entity || typeof entity !== "object") return "";
  const o = entity as Record<string, unknown>;
  const en = o.nameEn ?? o.NameEn;
  const ar = o.nameAr ?? o.NameAr;
  const hasNamePair =
    "nameEn" in o ||
    "nameAr" in o ||
    "NameEn" in o ||
    "NameAr" in o;
  if (hasNamePair) {
    return String(isAr ? (ar ?? en) : (en ?? ar) ?? "").trim();
  }
  return String(o.label ?? en ?? ar ?? o.value ?? o.id ?? "").trim();
}

export function resolveTableActivityLabel(isAr: boolean, row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const o = row as Record<string, unknown>;
  if ("ActivityEn" in o || "ActivityAr" in o) {
    return String(
      isAr
        ? (o.ActivityAr ?? o.ActivityEn)
        : (o.ActivityEn ?? o.ActivityAr) ?? "",
    );
  }
  return String(o.Activity ?? o.ActivityEn ?? o.activity ?? "");
}

/** When `stepNameAr` is missing, map known English API titles to i18n keys under `mediaLicensePage.stepTitles.*`. */
const KNOWN_STEP_NAME_EN_TO_I18N_KEY: Record<string, string> = {
  "Media Activity": "mediaLicensePage.stepTitles.mediaActivity",
  "Social Account Manager Details":
    "mediaLicensePage.stepTitles.socialAccountManagerDetails",
  "Training Program": "mediaLicensePage.stepTitles.trainingProgram",
};

/** License / permit list row or card title when API sends `nameEn` + `nameAr`. */
export function licensePermitListDisplayName(
  isAr: boolean,
  item: {
    documentName?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  },
): string {
  if (item.nameEn != null || item.nameAr != null) {
    const v = preferLocalizedEnAr(isAr, item.nameEn, item.nameAr);
    if (v) return v;
  }
  const fallback = String(item.documentName ?? "").trim();
  return fallback || "-";
}

/** Certificate / license detail modal filename when API sends `nameEn` + `nameAr`. */
export function licenseDetailDisplayName(
  isAr: boolean,
  detail: {
    name?: string | null;
    documentName?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  },
): string {
  if (detail.nameEn != null || detail.nameAr != null) {
    const v = preferLocalizedEnAr(isAr, detail.nameEn, detail.nameAr);
    if (v) return v;
  }
  return String(detail.name ?? detail.documentName ?? "").trim();
}

/**
 * @param translate - Pass `t` from react-i18next so Arabic can fall back when API omits `stepNameAr`.
 */
export function resolveStepNameLabel(
  isAr: boolean,
  step: unknown,
  translate?: (key: string) => string,
): string {
  if (!step || typeof step !== "object") return "";
  const o = step as Record<string, unknown>;
  const en = String(o.stepNameEn ?? "").trim();
  const ar = String(o.stepNameAr ?? "").trim();

  if (isAr) {
    if (ar) return ar;
    const key = en ? KNOWN_STEP_NAME_EN_TO_I18N_KEY[en] : "";
    if (key && translate) {
      const localized = String(translate(key) ?? "").trim();
      if (localized) return localized;
    }
    return en;
  }

  if (en) return en;
  return ar;
}
