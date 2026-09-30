import type { PortalId } from "./types";

const customerLiveScenarioIds = new Set(["welcome", "history", "continueHist"]);

export function isCustomerLiveScenario(portalId: PortalId, scenarioId: string) {
  return portalId === "customer" && customerLiveScenarioIds.has(scenarioId);
}
