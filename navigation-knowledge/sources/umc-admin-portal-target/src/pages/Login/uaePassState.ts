const UAE_PASS_STATE_STORAGE_KEY = "auth:uaepass:oauth-state";
const STATE_LENGTH_BYTES = 24;
const UAE_PASS_STATE_TTL_MS = 30 * 60 * 1000;

// Fixed URL state is the current business default. Set this to true to restore
// the recommended per-flow 48-character random state for UAE PASS login.
const USE_RANDOM_UAE_PASS_STATE = false;

const createOAuthState = () => {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    return "";
  }

  const bytes = new Uint8Array(STATE_LENGTH_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function createUAEPassLoginUrl(
  baseUrl: string,
  useRandomState = USE_RANDOM_UAE_PASS_STATE,
): string {
  const text = baseUrl.trim();
  if (!text) {
    throw new Error("Missing UAEPASS login URL");
  }

  const url = new URL(text);
  const redirectUri = url.searchParams.get("redirect_uri")?.trim() || "";
  const configuredState = url.searchParams.get("state")?.trim() || "";
  const state = useRandomState ? createOAuthState() : configuredState;
  if (!state || (!useRandomState && !redirectUri)) {
    throw new Error("Invalid UAEPASS state configuration");
  }
  const storage = getSessionStorage();

  storage?.setItem(
    UAE_PASS_STATE_STORAGE_KEY,
    JSON.stringify({ state, createdAt: Date.now() }),
  );
  if (useRandomState) {
    url.searchParams.set("state", state);
    return url.toString();
  }

  return text;
}

export function consumeUAEPassState(receivedState: string): boolean {
  const storage = getSessionStorage();
  const storedValue = storage?.getItem(UAE_PASS_STATE_STORAGE_KEY) || "";

  storage?.removeItem(UAE_PASS_STATE_STORAGE_KEY);

  try {
    const stored = JSON.parse(storedValue) as {
      state?: unknown;
      createdAt?: unknown;
    };
    const age = Date.now() - Number(stored.createdAt);

    return Boolean(
      receivedState &&
        typeof stored.state === "string" &&
        receivedState === stored.state &&
        Number.isFinite(age) &&
        age >= 0 &&
        age <= UAE_PASS_STATE_TTL_MS,
    );
  } catch {
    return false;
  }
}
