import "../global.css";
import { Stack } from "expo-router";
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
import * as FileSystem from "expo-file-system";
import { usePendingPdfStore } from "@/stores/pendingPdfStore";
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
    const handleIncomingUri = async (uri: string | null) => {
      if (!uri?.startsWith("content://")) return;
      try {
        const dest = FileSystem.cacheDirectory + "pending-invoice.pdf";
        await FileSystem.copyAsync({ from: uri, to: dest });
        usePendingPdfStore.getState().setPending(dest);
      } catch (err) {
        console.warn("[PDF intent] failed to copy file:", err);
      }
    };

    Linking.getInitialURL().then(handleIncomingUri);
    const sub = Linking.addEventListener("url", ({ url }) => handleIncomingUri(url));
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
