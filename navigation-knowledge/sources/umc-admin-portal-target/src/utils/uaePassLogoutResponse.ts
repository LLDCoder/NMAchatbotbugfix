export interface UaePassLogoutResponse {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: string | null;
}

export function resolveUaePassLogoutUrl(
  response: UaePassLogoutResponse | null | undefined,
): string | null {
  if (
    response?.isSuccess !== true ||
    response.statusCode !== 200 ||
    typeof response.data !== "string"
  ) {
    return null;
  }

  const value = response.data.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
