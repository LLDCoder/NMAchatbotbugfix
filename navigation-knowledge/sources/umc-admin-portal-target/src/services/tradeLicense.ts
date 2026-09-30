import request from "@/utils/request";

/** Issuing authority for trade licenses, scoped by emirate. */
export interface TradeLicenseAuthorityItem {
  id: number;
  nameEn: string;
  nameAr?: string;
}

export const unwrapTradeLicenseListResponse = (res: unknown): unknown[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object" && "data" in res) {
    const d = (res as { data?: unknown }).data;
    if (Array.isArray(d)) return d;
  }
  return [];
};

export type NormalizeTradeLicenseAuthorityOptions = {
  /**
   * GetAuthoritiesByEmirateId returns `isShown`; exclude rows explicitly false.
   * Rows without `isShown` are kept (other APIs / backward compatibility).
   */
  visibleOnly?: boolean;
};

export const normalizeTradeLicenseAuthorityList = (
  data: unknown[],
  options?: NormalizeTradeLicenseAuthorityOptions
): TradeLicenseAuthorityItem[] => {
  if (!Array.isArray(data)) return [];
  const source =
    options?.visibleOnly === true
      ? data.filter((item) => {
          const row = item as Record<string, unknown>;
          return row.isShown !== false;
        })
      : data;
  return source
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: Number(row.id ?? row.authorityId ?? row.value),
        nameEn: String(
          row.nameEn ?? row.name ?? row.labelEn ?? row.label ?? ""
        ).trim(),
        nameAr: row.nameAr as string | undefined,
      };
    })
    .filter((x) => Number.isFinite(x.id) && x.nameEn.length > 0);
};

/**
 * Trade license issuing authorities for the selected emirate.
 * Confirm path/contract with backend if this returns 404.
 */
export const getTradeLicenseAuthorityList = (emirateId: number) => {
  return request.get<unknown>(
    "/api/User/GetTradeLicenseAuthorityList",
    { emirateId },
    { skipErrorMessage: true }
  );
};

export const fetchTradeLicenseAuthorityOptions = async (
  emirateId: number
): Promise<TradeLicenseAuthorityItem[]> => {
  const res = await getTradeLicenseAuthorityList(emirateId);
  return normalizeTradeLicenseAuthorityList(unwrapTradeLicenseListResponse(res));
};
