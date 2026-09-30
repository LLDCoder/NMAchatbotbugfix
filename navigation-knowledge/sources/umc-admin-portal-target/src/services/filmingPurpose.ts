/**
 * Text Permit dropdown — replace with real API that returns applicant-approved,
 * valid permits for the given service type (Approved, not expired).
 */
export type TextPermitServiceType = "film_script" | "series_script";

export type TextPermitOption = { label: string; value: string };

export async function fetchTextPermitOptions(
  _serviceType: TextPermitServiceType,
): Promise<TextPermitOption[]> {
  return [];
}
