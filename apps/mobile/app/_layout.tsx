import "../global.css";
import { router, Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from "@expo-google-fonts/fraunces";
import { View } from "react-native";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import * as Linking from "expo-linking";
import { handleIncomingPdfUri } from "@/lib/handleIncomingPdfUri";
import { PdfConfirmSheet } from "@/components/PdfConfirmSheet";

const queryClient = new QueryClient();

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
  });

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const handleUri = async (uri: string | null) => {
      await handleIncomingPdfUri(uri);
      if (uri?.startsWith("content://")) {
        try { router.replace("/"); } catch {}
      }
    };
    Linking.getInitialURL().then(handleUri).catch((err) => {
      console.warn("[PDF intent] getInitialURL failed:", err);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handleUri(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#F3EADB" }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
      {isAuthenticated && <PdfConfirmSheet />}
    </QueryClientProvider>
  );
}
