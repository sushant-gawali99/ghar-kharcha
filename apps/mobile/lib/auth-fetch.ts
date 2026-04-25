import { useAuthStore } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const { accessToken, clearSession } = useAuthStore.getState();

  const headers = new Headers(init.headers ?? {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    await clearSession();
  }

  return response;
}
