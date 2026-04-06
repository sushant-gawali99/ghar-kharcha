import { hc } from "hono/client";
import type { AppType } from "../../api/src/index";

export function createApiClient(baseUrl: string, getToken?: () => string | null) {
  return hc<AppType>(baseUrl, {
    headers: () => {
      const token = getToken?.();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
