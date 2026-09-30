export const AUTH_STORAGE_KEYS = {
  TOKEN: 'auth:token',  // access token
  REFRESH_TOKEN: 'auth:refreshToken', // refresh token
  TOKEN_EXPIRES: 'auth:tokenExpires', // Token expiration time, this is not a 7-day expiration time, but an imperceptible refresh time
  USER_INFO: 'auth:userInfo' // User information
} as const;
class Cookies {
    /**
     * set cookie
     * @param name cookie name
     * @param value cookie value
     * @param days expires
     */
    static setCookie(name: string, value: string, days: number = 7) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    /**
     * get cookie
     * @param name cookie name
     * @returns cookie value
     */
    static getCookie(name: string): string | null {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    /**
     * get token
     * @return token value
     */
    static getToken () {
      return this.getCookie(AUTH_STORAGE_KEYS.TOKEN)
    }
    /**
     * remove tokne
     */
    static removeToken () {
      this.deleteCookie(AUTH_STORAGE_KEYS.TOKEN)
    }
    /**
     * set token
     * @param token string
     */
    static setToken (token: string, days: number = 7) {
      this.setCookie(AUTH_STORAGE_KEYS.TOKEN, token, days)
    }
    /**
     * delete cookie
     * @param name cookie name
     */
    static deleteCookie(name: string) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
}


export default Cookies;