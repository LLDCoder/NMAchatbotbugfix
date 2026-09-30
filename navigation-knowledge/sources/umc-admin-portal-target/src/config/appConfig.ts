interface AppConfig {
  signalr: {
    hubUrl: string;
  };
  ffAi: {
    apiBaseUrl: string;
    cardAllowedExternalHosts: string[];
  };
}

let appConfig: AppConfig | null = null;
let configLoadingPromise: Promise<AppConfig> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function withPublicBase(path: string) {
  if (!path || /^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }

  const publicBase =
    (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/";
  const normalizedBase = publicBase === "/" ? "" : publicBase.replace(/\/+$/, "");

  if (!normalizedBase || path === normalizedBase || path.startsWith(`${normalizedBase}/`)) {
    return path;
  }

  return `${normalizedBase}/${path.replace(/^\/+/, "")}`;
}

function createAppConfig(value?: unknown): AppConfig {
  const root = isRecord(value) ? value : {};
  const signalr = isRecord(root.signalr) ? root.signalr : {};
  const ffAi = isRecord(root.ffAi) ? root.ffAi : {};

  return {
    signalr: {
      hubUrl: withPublicBase(asString(signalr.hubUrl) || "/chatHub"),
    },
    // The Admin Chatbot uses the same rendering components as Customer.
    // Keep these fields present even when runtime config omits them so a
    // normal assistant response cannot crash the root Admin layout.
    ffAi: {
      apiBaseUrl: withPublicBase(asString(ffAi.apiBaseUrl)),
      cardAllowedExternalHosts: asStringArray(ffAi.cardAllowedExternalHosts),
    },
  };
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (appConfig) {
    return appConfig;
  }

  if (configLoadingPromise) {
    return configLoadingPromise;
  }

  configLoadingPromise = (async () => {
    try {
      const baseUrl =
        (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/";
      const configUrl = new URL(`config.json?t=${Date.now()}`, window.location.origin + baseUrl);
      const response = await fetch(configUrl.toString());
      if (response.ok) {
        const config: unknown = await response.json();
        appConfig = createAppConfig(config);
        console.log('App config loaded from config.json:', appConfig);
        return appConfig;
      }
    } catch (error) {
      console.warn('Failed to load config.json, using default config:', error);
    }

    appConfig = createAppConfig();
    console.log('App config using defaults:', appConfig);
    return appConfig;
  })();

  return configLoadingPromise;
}

export function getAppConfig(): AppConfig {
  if (!appConfig) {
    console.warn('App config not loaded yet, using default config');
    return createAppConfig();
  }
  return appConfig;
}

export async function initAppConfig(): Promise<void> {
  await loadAppConfig();
}
