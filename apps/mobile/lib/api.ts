import { createApiClient } from "@ghar-kharcha/api-client";
import { useAuthStore } from "./auth";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = createApiClient(API_BASE_URL, () =>
  useAuthStore.getState().accessToken
);
