import { useEffect, useState } from "react";

import authStorage from "@/storage/authStorage";

const readAdminAuthToken = () => authStorage.getToken()?.trim() || "";

/**
 * Read the Admin UMC token from the same isolated storage used by the
 * portal request interceptor. Admin intentionally removes the token from the
 * persisted user profile, so Customer Portal's userInfo.token is not valid
 * for this application.
 */
export function useAdminAuthToken() {
  const [token, setToken] = useState(readAdminAuthToken);

  useEffect(() => {
    const synchronize = () => setToken(readAdminAuthToken());

    synchronize();
    window.addEventListener("auth-changed", synchronize);
    window.addEventListener("storage", synchronize);

    return () => {
      window.removeEventListener("auth-changed", synchronize);
      window.removeEventListener("storage", synchronize);
    };
  }, []);

  return token;
}
