import { Stack } from "expo-router";

export default function AuthLayout() {
  // TODO: guard this layout — redirect to /sign-in if unauthenticated
  return <Stack screenOptions={{ headerShown: false }} />;
}
