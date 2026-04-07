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
    const userJson = await storage.getItem(USER_KEY);
    const user = userJson ? (JSON.parse(userJson) as User) : null;
    set({ accessToken, user, isAuthenticated: !!accessToken });
  },
}));
