import {
  AUTH_STORAGE_KEYS,
  AUTH_USER_STORAGE_KEY,
} from '@/storage/authStorage';

const LEGACY_AUTH_STORAGE_KEYS = {
  TOKEN: 'auth:token',
  REFRESH_TOKEN: 'auth:refreshToken',
  TOKEN_EXPIRES: 'auth:tokenExpires',
  USER_INFO: 'auth:userInfo',
  UAE_PASS_SESSION: 'auth:uaePassSession',
} as const;
const LEGACY_USER_STORAGE_KEY = 'user-storage';
type LegacyAuthStorageKey = keyof typeof LEGACY_AUTH_STORAGE_KEYS;

function isValidLegacyAuthValue(
  name: LegacyAuthStorageKey,
  value: string,
): boolean {
  try {
    const parsed = JSON.parse(value) as {
      value?: unknown;
      timestamp?: unknown;
      expires?: unknown;
    } | null;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Object.prototype.hasOwnProperty.call(parsed, 'value') ||
      typeof parsed.timestamp !== 'number' ||
      !Number.isFinite(parsed.timestamp) ||
      (parsed.expires !== undefined &&
        (typeof parsed.expires !== 'number' || !Number.isFinite(parsed.expires)))
    ) {
      return false;
    }

    if (name === 'TOKEN') {
      return typeof parsed.value === 'string' && Boolean(parsed.value.trim());
    }
    if (name === 'REFRESH_TOKEN') {
      return typeof parsed.value === 'string';
    }
    if (name === 'TOKEN_EXPIRES') {
      return typeof parsed.value === 'number' && Number.isFinite(parsed.value);
    }
    if (name === 'UAE_PASS_SESSION') {
      return typeof parsed.value === 'boolean';
    }

    return Boolean(parsed.value && typeof parsed.value === 'object');
  } catch {
    return false;
  }
}

function isAdminUserStorage(value: string | null): boolean {
  if (!value) return false;

  try {
    const parsed = JSON.parse(value) as {
      state?: { userInfo?: Record<string, unknown> };
    };
    const userInfo = parsed?.state?.userInfo;

    return Boolean(
      String(userInfo?.id ?? '').trim() &&
      Array.isArray(userInfo?.listSysPermission),
    );
  } catch {
    return false;
  }
}

// TEMPORARY: Remove this file and its call in src/store/user.ts after 2026-08-13.
export function migrateLegacyAuthStorage(): void {
  if (
    typeof localStorage === 'undefined' ||
    typeof sessionStorage === 'undefined'
  ) {
    return;
  }

  const legacyUserStorage = localStorage.getItem(LEGACY_USER_STORAGE_KEY);
  const hasLegacyToken = Boolean(
    localStorage.getItem(LEGACY_AUTH_STORAGE_KEYS.TOKEN) ||
    sessionStorage.getItem(LEGACY_AUTH_STORAGE_KEYS.TOKEN),
  );

  if (!hasLegacyToken || !isAdminUserStorage(legacyUserStorage)) {
    return;
  }

  const storages = [localStorage, sessionStorage];
  const hasNamespacedState =
    localStorage.getItem(AUTH_USER_STORAGE_KEY) !== null ||
    Object.keys(AUTH_STORAGE_KEYS).some((name) =>
      storages.some(
        (storage) =>
          storage.getItem(
            AUTH_STORAGE_KEYS[name as keyof typeof AUTH_STORAGE_KEYS],
          ) !== null,
      ),
    );
  if (hasNamespacedState) {
    return;
  }

  const legacyEntries: Array<{
    storage: Storage;
    name: LegacyAuthStorageKey;
    value: string;
  }> = [];
  const presentNames = new Set<LegacyAuthStorageKey>();
  for (const name of Object.keys(LEGACY_AUTH_STORAGE_KEYS) as LegacyAuthStorageKey[]) {
    for (const storage of [localStorage, sessionStorage]) {
      const legacyValue = storage.getItem(LEGACY_AUTH_STORAGE_KEYS[name]);
      if (legacyValue === null) {
        continue;
      }
      if (!isValidLegacyAuthValue(name, legacyValue)) {
        return;
      }
      legacyEntries.push({ storage, name, value: legacyValue });
      presentNames.add(name);
    }
  }

  if (
    !presentNames.has('TOKEN') ||
    !presentNames.has('REFRESH_TOKEN') ||
    !presentNames.has('TOKEN_EXPIRES')
  ) {
    return;
  }

  const copiedEntries: Array<{ storage: Storage; key: string }> = [];
  try {
    for (const entry of legacyEntries) {
      const key = AUTH_STORAGE_KEYS[entry.name];
      entry.storage.setItem(key, entry.value);
      copiedEntries.push({ storage: entry.storage, key });
    }
    localStorage.setItem(AUTH_USER_STORAGE_KEY, legacyUserStorage as string);
    copiedEntries.push({ storage: localStorage, key: AUTH_USER_STORAGE_KEY });
  } catch {
    for (const entry of copiedEntries) {
      entry.storage.removeItem(entry.key);
    }
    return;
  }

  for (const entry of legacyEntries) {
    entry.storage.removeItem(LEGACY_AUTH_STORAGE_KEYS[entry.name]);
  }
  localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
}
