import { useEffect, useState } from "react";

import authStorage from "@/storage/authStorage";

export function useStoredAuthToken(): string {
  const [token, setToken] = useState(() => authStorage.getToken());

  useEffect(() => {
    const syncToken = () => setToken(authStorage.getToken());

    window.addEventListener("auth-changed", syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener("auth-changed", syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  return token;
}
