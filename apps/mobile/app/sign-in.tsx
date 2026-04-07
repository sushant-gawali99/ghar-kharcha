import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { useAuthStore } from "@/lib/auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

function GoogleLogo() {
  return (
    <View style={styles.googleLogoContainer}>
      <Text style={styles.googleLogoText}>G</Text>
    </View>
  );
}

function DecoCircle({
  size,
  top,
  right,
  left,
  opacity,
  color = "rgba(86,254,124,0.15)",
}: {
  size: number;
  top?: number;
  right?: number;
  left?: number;
  opacity?: number;
  color?: string;
}) {
  return (
    <View
      style={[
        styles.decoCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top,
          right,
          left,
          opacity: opacity ?? 1,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export default function SignInScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (!idToken) {
        throw new Error("No ID token received from Google.");
      }

      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Auth failed");
      }

      const { accessToken, refreshToken, user } = await res.json();
      await setSession(accessToken, refreshToken, user);
      router.replace("/(auth)/(tabs)/home");
    } catch (err: any) {
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert(
        "Sign-in failed",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Hero area ── */}
      <View style={styles.hero}>
        <SafeAreaView edges={["top"]} style={styles.safeTop}>
          <DecoCircle size={320} top={-120} right={-100} />
          <DecoCircle size={180} top={60} left={-60} opacity={0.6} />
          <DecoCircle
            size={80}
            top={180}
            right={40}
            color="rgba(255,255,255,0.08)"
          />

          <View style={styles.wordmark}>
            <View style={styles.logoChip}>
              <Text style={styles.logoChipText}>GK</Text>
            </View>
            <Text style={styles.appName}>Ghar Kharcha</Text>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Your grocery{"\n"}story, told.</Text>
            <Text style={styles.heroSub}>
              Upload invoices from Zepto & Swiggy{"\n"}Instamart and watch your
              spending{"\n"}come alive.
            </Text>
          </View>
        </SafeAreaView>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={styles.sheet}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetInner}>
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Get started</Text>
          <Text style={styles.sheetSub}>
            Sign in to track, analyse and save on your grocery spends.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && styles.googleBtnPressed,
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#006a28" size="small" />
            ) : (
              <>
                <GoogleLogo />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>
              More sign-in options coming soon
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#006a28" },

  hero: { flex: 1, backgroundColor: "#006a28", overflow: "hidden" },
  safeTop: { flex: 1, paddingHorizontal: 28, paddingBottom: 32 },
  decoCircle: { position: "absolute" },

  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    zIndex: 1,
  },
  logoChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#56fe7c",
    alignItems: "center",
    justifyContent: "center",
  },
  logoChipText: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontSize: 16,
    color: "#004818",
  },
  appName: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 20,
    color: "#ffffff",
    letterSpacing: -0.3,
  },

  heroCopy: { flex: 1, justifyContent: "flex-end", zIndex: 1 },
  heroTitle: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: "#ffffff",
    marginBottom: 16,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(214,255,225,0.85)",
  },

  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#2d2f31",
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -16 },
    elevation: 16,
  },
  sheetInner: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: "#e1e2e6",
    marginBottom: 28,
  },
  sheetTitle: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontSize: 28,
    letterSpacing: -0.8,
    color: "#2d2f31",
    marginBottom: 8,
  },
  sheetSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#5a5c5e",
    marginBottom: 28,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: "#2d2f31",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(172,173,175,0.25)",
  },
  googleBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  googleBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: "#2d2f31",
    letterSpacing: -0.2,
  },
  googleLogoContainer: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    backgroundColor: "#f6f6f9",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogoText: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontSize: 14,
    color: "#4285F4",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e1e2e6" },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#acadaf",
    textAlign: "center",
    flexShrink: 1,
  },

  terms: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#acadaf",
    textAlign: "center",
    paddingBottom: 8,
  },
  termsLink: { color: "#006a28", fontFamily: "Inter_600SemiBold" },
});
