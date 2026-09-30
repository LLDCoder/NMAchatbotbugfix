import { normalizeAllowedExternalUrl } from "./urlPolicy";

export const PORTAL_RETURN_URL_KEY = "nma:portal:return-url";

export const portalCardRoutes = {
  home: "/home",
  services: "/services",
  media_license: "/services/media-license",
  service_card: "/services/service-card",
  my_requests: "/my-requests",
  payments: "/payments",
  permits_license: "/permits-license",
  violations_fines: "/violations-fines",
  refund: "/refund",
  complaints: "/complaints",
  knowledge_center: "/knowledge-center",
  notifications: "/notifications",
  inquiries: "/inquiries",
  personal_profile: "/my-account/personal-profile",
  establishment_profile: "/my-account/establishment-profile",
} as const;

export type PortalCardRouteKey = keyof typeof portalCardRoutes;
export type ChatCardKind = "portal_route" | "external_link";

interface ChatCardBase {
  id: string;
  title: string;
  description?: string;
  icon_key?: string;
  cta_label?: string;
  badge?: string;
}

export interface PortalRouteChatCard extends ChatCardBase {
  kind: "portal_route";
  destination: { route_key: PortalCardRouteKey };
}

export interface ExternalLinkChatCard extends ChatCardBase {
  kind: "external_link";
  destination: { url: string };
}

export type ChatCard = PortalRouteChatCard | ExternalLinkChatCard;

export interface WorkflowCardsPayload {
  version: 1;
  cards: ChatCard[];
}

const CARD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ROUTE_PATHS = new Set<string>(Object.values(portalCardRoutes));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function limitedText(value: unknown, maximum: number, required = false) {
  if (value === undefined || value === null) return required ? null : undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if ((!trimmed && required) || [...trimmed].length > maximum) return null;
  return trimmed || undefined;
}

export function normalizeExternalCardUrl(
  value: unknown,
  allowedHosts: readonly string[],
) {
  return normalizeAllowedExternalUrl(value, allowedHosts);
}

function normalizeCard(value: unknown, allowedHosts: readonly string[]): ChatCard | null {
  if (!isRecord(value) || typeof value.id !== "string" || !CARD_ID_PATTERN.test(value.id)) {
    return null;
  }
  const title = limitedText(value.title, 120, true);
  const description = limitedText(value.description, 280);
  const iconKey = limitedText(value.icon_key, 40);
  const ctaLabel = limitedText(value.cta_label, 40);
  const badge = limitedText(value.badge, 40);
  if (!title || description === null || iconKey === null || ctaLabel === null || badge === null) {
    return null;
  }
  if (!isRecord(value.destination)) return null;

  const common = {
    id: value.id,
    title,
    ...(description ? { description } : {}),
    ...(iconKey ? { icon_key: iconKey } : {}),
    ...(ctaLabel ? { cta_label: ctaLabel } : {}),
    ...(badge ? { badge } : {}),
  };

  if (value.kind === "portal_route") {
    if (
      Object.keys(value.destination).length !== 1 ||
      typeof value.destination.route_key !== "string"
    ) return null;
    const routeKey = value.destination.route_key as PortalCardRouteKey;
    if (!getPortalCardRoute(routeKey)) return null;
    return { ...common, kind: "portal_route", destination: { route_key: routeKey } };
  }

  if (value.kind === "external_link") {
    if (Object.keys(value.destination).length !== 1) return null;
    const url = normalizeExternalCardUrl(value.destination.url, allowedHosts);
    if (!url) return null;
    return { ...common, kind: "external_link", destination: { url } };
  }

  return null;
}

export function normalizeChatCards(
  value: unknown,
  allowedHosts: readonly string[],
): ChatCard[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && value.version === 1 && Array.isArray(value.cards)
      ? value.cards
      : [];
  const cards: ChatCard[] = [];
  const ids = new Set<string>();
  for (const candidate of source) {
    const card = normalizeCard(candidate, allowedHosts);
    if (!card || ids.has(card.id)) continue;
    ids.add(card.id);
    cards.push(card);
    if (cards.length === 4) break;
  }
  return cards;
}

export function getPortalCardRoute(routeKey: string) {
  return Object.prototype.hasOwnProperty.call(portalCardRoutes, routeKey)
    ? portalCardRoutes[routeKey as PortalCardRouteKey]
    : undefined;
}

export function isPortalCardRoutePath(value: unknown): value is string {
  return typeof value === "string" && ROUTE_PATHS.has(value);
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function rememberPortalReturnUrl(search: string) {
  const candidate = new URLSearchParams(search).get("returnUrl");
  if (!isPortalCardRoutePath(candidate)) return undefined;
  try {
    getSessionStorage()?.setItem(PORTAL_RETURN_URL_KEY, candidate);
  } catch {
    // Login still works when session storage is unavailable.
  }
  return candidate;
}

export function storePortalReturnUrl(path: string) {
  if (!isPortalCardRoutePath(path)) return false;
  try {
    const storage = getSessionStorage();
    if (!storage) return false;
    storage.setItem(PORTAL_RETURN_URL_KEY, path);
    return true;
  } catch {
    return false;
  }
}

export function consumePortalReturnUrl(search: string) {
  const fromQuery = new URLSearchParams(search).get("returnUrl");
  let fromStorage: string | null = null;
  try {
    fromStorage = getSessionStorage()?.getItem(PORTAL_RETURN_URL_KEY) ?? null;
    getSessionStorage()?.removeItem(PORTAL_RETURN_URL_KEY);
  } catch {
    // Invalid or unavailable storage falls back to the existing login destination.
  }
  if (fromQuery !== null) {
    return isPortalCardRoutePath(fromQuery) ? fromQuery : undefined;
  }
  return isPortalCardRoutePath(fromStorage) ? fromStorage : undefined;
}

export function createPortalLoginUrl(path: string) {
  return isPortalCardRoutePath(path)
    ? `/login?returnUrl=${encodeURIComponent(path)}`
    : "/login";
}
