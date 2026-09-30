import StorageManager from './storageManager';
import { TIME } from '@/config/constants';

/**
 * Auth Storage related constants
 */
export const AUTH_STORAGE_KEYS = {
  TOKEN: 'NMA_WORKSPACE_AUTH_TOKEN',  // access token
  REFRESH_TOKEN: 'NMA_WORKSPACE_AUTH_REFRESH_TOKEN', // refresh token
  TOKEN_EXPIRES: 'NMA_WORKSPACE_AUTH_TOKEN_EXPIRES', // Token expiration time, this is not a 7-day expiration time, but an imperceptible refresh time
  USER_INFO: 'NMA_WORKSPACE_AUTH_USER_INFO', // User information
  UAE_PASS_SESSION: 'NMA_WORKSPACE_AUTH_UAE_PASS_SESSION'
} as const;

export const AUTH_USER_STORAGE_KEY = 'NMA_WORKSPACE_USER_STORAGE';

/**
 * Auth Storage management category
 */
class AuthStorage {
  private emitAuthChanged() {
    window.dispatchEvent(new Event('auth-changed'));
  }

  /**
   * Set authentication information
   */
  setTokenInfo(data: {
    token: string;
    refreshToken: string;
    expiresIn: number;
    remember?: boolean;
  }) {
    const { token, refreshToken, expiresIn } = data;
    const type = 'local';
    const expires = Date.now() + expiresIn;
    this.clearTokenExpires();
    StorageManager.set(AUTH_STORAGE_KEYS.TOKEN, token, { type });
    StorageManager.set(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, { type });
    StorageManager.set(AUTH_STORAGE_KEYS.TOKEN_EXPIRES, expires, { type });
    this.emitAuthChanged();
  }

  /**
   * access token
   */
  getToken() {
    return StorageManager.get<string>(AUTH_STORAGE_KEYS.TOKEN, '', { type: 'local' }) ||
           StorageManager.get<string>(AUTH_STORAGE_KEYS.TOKEN, '', { type: 'session' });
  }

  removeToken() {
    ['local', 'session'].forEach(type => {
      StorageManager.remove(AUTH_STORAGE_KEYS.TOKEN, { type: type as 'local' | 'session' });
      StorageManager.remove(AUTH_STORAGE_KEYS.REFRESH_TOKEN, { type: type as 'local' | 'session' });
    });
    this.clearTokenExpires();
    this.emitAuthChanged();
  }

  /**
   * Get refresh token
   */
  getRefreshToken() {
    return StorageManager.get<string>(AUTH_STORAGE_KEYS.REFRESH_TOKEN, '', { type: 'local' }) ||
           StorageManager.get<string>(AUTH_STORAGE_KEYS.REFRESH_TOKEN, '', { type: 'session' });
  }

  /**
   * Check if the token is valid
   */
  isTokenValid(threshold = TIME.TOKEN_REFRESH_AHEAD): boolean {
    const token = this.getToken();
    if (!token) return false;

    const expires = this.getTokenExpires();
    if (!expires) return false;
    
    // Check if it has expired
    return Date.now() + threshold < expires;
  }

  getTokenExpires(): number | null {
    const expires = StorageManager.get<number>(AUTH_STORAGE_KEYS.TOKEN_EXPIRES, 0, { type: 'local' }) ||
                   StorageManager.get<number>(AUTH_STORAGE_KEYS.TOKEN_EXPIRES, 0, { type: 'session' });
    return expires || null;
  }

  clearTokenExpires(){
    StorageManager.set<number>(AUTH_STORAGE_KEYS.TOKEN_EXPIRES, 0, { type: 'local' });
    StorageManager.set<number>(AUTH_STORAGE_KEYS.TOKEN_EXPIRES, 0, { type: 'session' })
  }

  /**
   * Get storage type
   */
  getStorageType(): 'local' | 'session' {
    return StorageManager.has(AUTH_STORAGE_KEYS.TOKEN, { type: 'local' }) ? 'local' : 'session';
  }

  markUaePassSession() {
    StorageManager.set(AUTH_STORAGE_KEYS.UAE_PASS_SESSION, true, { type: 'local' });
  }

  clearUaePassSession() {
    ['local', 'session'].forEach(type => {
      StorageManager.remove(AUTH_STORAGE_KEYS.UAE_PASS_SESSION, { type: type as 'local' | 'session' });
    });
  }

  isUaePassSession(): boolean {
    return Boolean(
      StorageManager.get<boolean>(AUTH_STORAGE_KEYS.UAE_PASS_SESSION, false, { type: 'local' }) ||
      StorageManager.get<boolean>(AUTH_STORAGE_KEYS.UAE_PASS_SESSION, false, { type: 'session' })
    );
  }

  /**
   * Clear authentication information
   */
  clearAuth() {
    ['local', 'session'].forEach(type => {
      StorageManager.remove(Object.values(AUTH_STORAGE_KEYS), { type: type as 'local' | 'session' });
    });
    this.emitAuthChanged();
  }
}

export const authStorage = new AuthStorage();
export default authStorage;
