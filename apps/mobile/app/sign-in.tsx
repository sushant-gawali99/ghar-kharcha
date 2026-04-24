import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState } from "react";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { T, FONTS } from "@/lib/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

function GoogleLogo() {
  return (
    <View
      style={{
        width: 38, height: 38, borderRadius: 999,
        backgroundColor: "#FFFFFF",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.serifBold,
          fontSize: 22,
          color: "#4285F4",
          lineHeight: 24,
        }}
      >
        G
      </Text>
    </View>
  );
}

function PaperInvoice() {
  // Decorative torn-receipt in the top-right corner.
  return (
    <View
      style={{
        position: "absolute",
        top: 80,
        right: 24,
        width: 108,
        height: 152,
        transform: [{ rotate: "10deg" }],
      }}
      pointerEvents="none"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#FBF5E8",
          borderRadius: 6,
          paddingTop: 16,
          paddingHorizontal: 12,
          borderWidth: 0.5,
          borderColor: "rgba(31,26,21,0.08)",
          shadowColor: "#1F1A15",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        {[0.78, 0.62, 0.7, 0.5, 0.66, 0.42].map((w, i) => (
          <View
            key={i}
            style={{
              height: 3,
              width: `${w * 100}%`,
              backgroundColor: "rgba(31,26,21,0.18)",
              borderRadius: 999,
              marginBottom: 8,
            }}
          />
        ))}
      </View>
      {/* torn bottom edge */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          marginTop: -1,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 6,
              borderRightWidth: 6,
              borderTopWidth: 8,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#FBF5E8",
            }}
          />
        ))}
      </View>
    </View>
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
      if (!idToken) throw new Error("No ID token received from Google.");

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch (err) {
        throw new Error(
          "Could not reach the app server. Check that the local API is running and the emulator can access it.",
        );
      }

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
        err instanceof Error ? err.message : "Google sign-in failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.paper }}>
      {/* ── Background Devanagari watermark ── */}
      <Text
        style={{
          position: "absolute",
          top: 340,
          left: -20,
          fontFamily: "System",
          fontSize: 220,
          color: "rgba(227,168,46,0.22)",
          lineHeight: 200,
          transform: [{ rotate: "-6deg" }],
        }}
        pointerEvents="none"
      >
        खर्चा
      </Text>

      {/* ── Torn paper receipt top-right ── */}
      <PaperInvoice />

      {/* ── Hero copy ── */}
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "flex-end", paddingBottom: 28 }}>
        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 60, color: T.ink, letterSpacing: -1, lineHeight: 64 }}>
          Ghar <Text style={{ fontFamily: FONTS.serifBold, fontStyle: "normal" }}>Kharcha</Text>
        </Text>
        <Text style={{ fontFamily: "System", fontSize: 24, color: T.ink2, marginTop: 10 }}>
          घर खर्चा
        </Text>

        <Text
          style={{
            fontFamily: FONTS.serifBold,
            fontSize: 30,
            color: T.ink,
            marginTop: 36,
            lineHeight: 38,
            letterSpacing: -0.5,
          }}
        >
          A quiet ledger for{" "}
          <Text style={{ fontFamily: FONTS.serifBoldItalic, color: T.terracotta }}>dal,</Text>{" "}
          <Text style={{ fontFamily: FONTS.serifBoldItalic, color: T.terracotta }}>doodh</Text>{" "}
          and everything else.
        </Text>

        <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink2, marginTop: 18, lineHeight: 22, maxWidth: 340 }}>
          Drop in a Zepto or Blinkit bill. We'll sort every line into its pantry shelf.
        </Text>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 40, paddingTop: 12 }}>
        <Pressable
          onPress={handleGoogleSignIn}
          disabled={loading}
          style={{
            flexDirection: "row", alignItems: "center",
            gap: 14, paddingVertical: 14, paddingHorizontal: 14,
            borderRadius: 20,
            backgroundColor: T.ink,
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
            opacity: loading ? 0.75 : 1,
          }}
        >
          <GoogleLogo />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper, letterSpacing: 0.2 }}>
              {loading ? "Signing in…" : "Continue with Google"}
            </Text>
            <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: "rgba(243,234,219,0.55)", marginTop: 2 }}>
              Fastest way in · ~2 seconds
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={T.haldi} />
          ) : (
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 22, color: T.haldi, marginRight: 6 }}>→</Text>
          )}
        </Pressable>

        <Text
          style={{
            fontFamily: FONTS.serifItalic,
            fontSize: 13,
            color: T.ink3,
            textAlign: "center",
            marginTop: 22,
          }}
        >
          More sign-in options, soon.
        </Text>

        <Text
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: T.ink3,
            textAlign: "center",
            lineHeight: 18,
            marginTop: 14,
          }}
        >
          By continuing, you agree to our{" "}
          <Text style={{ color: T.ink2, textDecorationLine: "underline" }}>Terms</Text>
          {" "}and{" "}
          <Text style={{ color: T.ink2, textDecorationLine: "underline" }}>Privacy</Text>.
        </Text>
      </View>
    </View>
  );
}
