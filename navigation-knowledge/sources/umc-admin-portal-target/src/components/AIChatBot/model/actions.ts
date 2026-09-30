import { createPortalLoginUrl, portalCardRoutes } from "./cards";
import type { ScenarioAction } from "./types";

const portalActionTargets = {
  OPEN_FINE_PAYMENT: {
    path: "/pay-fines",
    requiresLogin: false,
  },
  SIGN_IN_FOR_FINES: {
    path: portalCardRoutes.violations_fines,
    requiresLogin: true,
  },
  OPEN_ALL_FINE_PAYMENT: {
    path: portalCardRoutes.violations_fines,
    requiresLogin: true,
  },
  OPEN_FINE_SELECTION: {
    path: portalCardRoutes.violations_fines,
    requiresLogin: true,
  },
  OPEN_MY_LICENSES_RENEWAL: {
    path: portalCardRoutes.permits_license,
    requiresLogin: true,
  },
  SEE_RENEWAL_FEES: {
    path: portalCardRoutes.services,
    requiresLogin: true,
  },
  BROWSE_POLICY_LIBRARY: {
    path: portalCardRoutes.knowledge_center,
    requiresLogin: false,
  },
  SUBSCRIBE_REGULATION_UPDATES: {
    path: portalCardRoutes.notifications,
    requiresLogin: true,
  },
  OPEN_FULL_CABINET_RESOLUTION: {
    path: portalCardRoutes.knowledge_center,
    requiresLogin: false,
  },
  SEE_AI_DISCLOSURE_TEMPLATES: {
    path: portalCardRoutes.knowledge_center,
    requiresLogin: false,
  },
  SIGN_IN_FORMAL_COMPLAINT: {
    path: portalCardRoutes.complaints,
    requiresLogin: true,
  },
  CONTACT_PERSON_DIRECTLY: {
    path: portalCardRoutes.inquiries,
    requiresLogin: false,
  },
} as const;

type PortalActionKey = keyof typeof portalActionTargets;

export interface PortalActionNavigation {
  path: string;
  returnUrl?: string;
}

function getPortalActionTarget(key: string) {
  return Object.prototype.hasOwnProperty.call(portalActionTargets, key)
    ? portalActionTargets[key as PortalActionKey]
    : undefined;
}

export function resolvePortalActionNavigation(
  action: ScenarioAction,
  authenticated: boolean,
): PortalActionNavigation | undefined {
  const target = getPortalActionTarget(action.key);
  if (!target) return undefined;

  if (!target.requiresLogin || authenticated) {
    return { path: target.path };
  }

  return {
    path: createPortalLoginUrl(target.path),
    returnUrl: target.path,
  };
}
