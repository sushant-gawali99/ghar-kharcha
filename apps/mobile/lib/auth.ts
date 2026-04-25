import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

// expo-secure-store is native-only; fall back to localStorage on web
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decode = Platform.OS === "web" ? atob : globalThis.atob;
    if (!decode) return null;
    const json = decode(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 <= Date.now();
}

type AuthState = {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setSession: (
    accessToken: string,
    refreshToken: string,
    user: User
  ) => Promise<void>;
  clearSession: () => Promise<void>;
  loadSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setSession: async (accessToken, refreshToken, user) => {
    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    set({ accessToken, user, isAuthenticated: true });
  },

  clearSession: async () => {
    await storage.deleteItem(ACCESS_TOKEN_KEY);
    await storage.deleteItem(REFRESH_TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    const accessToken = await storage.getItem(ACCESS_TOKEN_KEY);
    if (accessToken && isTokenExpired(accessToken)) {
      await storage.deleteItem(ACCESS_TOKEN_KEY);
      await storage.deleteItem(REFRESH_TOKEN_KEY);
      await storage.deleteItem(USER_KEY);
      set({ accessToken: null, user: null, isAuthenticated: false });
      return;
    }
    const userJson = await storage.getItem(USER_KEY);
    const user = userJson ? (JSON.parse(userJson) as User) : null;
    set({ accessToken, user, isAuthenticated: !!accessToken });
  },
}));
