import axios from "axios";
import {
  resolveUaePassLogoutUrl,
  type UaePassLogoutResponse,
} from "@/utils/uaePassLogoutResponse";

const logoutClient = axios.create({
  baseURL: import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
  },
});

export async function requestUaePassLogout(
  token: string,
): Promise<string | null> {
  try {
    const response = await logoutClient.post<UaePassLogoutResponse>(
      "/api/UAEPASS/LoginOut?from=admin",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return resolveUaePassLogoutUrl(response.data);
  } catch {
    return null;
  }
}
