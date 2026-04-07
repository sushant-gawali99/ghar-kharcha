import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/auth";

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? (
    <Redirect href="/(auth)/(tabs)/home" />
  ) : (
    <Redirect href="/sign-in" />
  );
}
