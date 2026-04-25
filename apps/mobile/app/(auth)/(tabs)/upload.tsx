import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard, shadowHero } from "@/lib/theme";

const TAB_BAR_HEIGHT = 68;
const TAB_BAR_BOTTOM_OFFSET = 18;
const TAB_BAR_TOTAL_OFFSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET;

type PickedFile = {
  name: string;
  uri: string;
  size: number;
  mimeType: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function PdfGlyph({ platform, big = false }: { platform?: string; big?: boolean }) {
  const platformColor = {
    zepto: "#4B1B8C",
    blinkit: "#F4D00A",
    swiggy_instamart: "#FF5A2D",
  }[platform?.toLowerCase().replace(/\s+/g, "_") ?? ""] ?? T.terracotta;
  const s = big ? 54 : 40;
  return (
    <View style={{
      width: s, height: s * 1.2, borderRadius: 6,
      backgroundColor: T.paper2, flexShrink: 0,
      borderWidth: 0.5, borderColor: T.rule,
      alignItems: "flex-end", justifyContent: "flex-end", padding: 4,
    }}>
      <Text style={{ fontFamily: FONTS.serifBold, fontSize: big ? 11 : 9, color: platformColor, letterSpacing: 0.3 }}>
        PDF
      </Text>
      <View style={{
        position: "absolute", top: 0, right: 0,
        width: "30%", height: "30%",
        backgroundColor: T.paper,
        borderLeftWidth: 0.5, borderBottomWidth: 0.5, borderColor: T.rule,
      }} />
    </View>
  );
}

const HOW_IT_WORKS = [
  { n: "1", t: "Drop a PDF", d: "Invoice or order summary from Zepto, Blinkit, or Instamart." },
  { n: "2", t: "We read every line", d: "Each item gets tagged — dal, doodh, bhindi, all of it." },
  { n: "3", t: "Your ledger updates", d: "Month, categories, pantry — all in one place." },
];

export default function UploadScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFile({ name: asset.name, uri: asset.uri, size: asset.size ?? 0, mimeType: asset.mimeType ?? null });
    } catch (err) {
      Alert.alert("Could not pick file", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleUpload = async () => {
    if (!file || !accessToken) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/pdf" } as unknown as Blob);
      const res = await authFetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const result = await res.json();
      const platformLabel: Record<string, string> = {
        zepto: "Zepto",
        swiggy_instamart: "Swiggy Instamart",
        other: "other",
      };
      const title = result.status === "duplicate" ? "Already imported" : "Uploaded";
      const body =
        result.status === "duplicate"
          ? `Invoice ${result.invoiceNo} is already in your ledger.`
          : `₹${Number(result.total).toFixed(2)} · ${result.itemCount} items from ${platformLabel[result.platform] ?? result.platform}.`;
      Alert.alert(title, body, [{ text: "OK", onPress: () => router.back() }]);
      setFile(null);
    } catch (err) {
      const detail = err instanceof Error
        ? `${err.name}: ${err.message}${err.cause ? `\ncause: ${String(err.cause)}` : ""}`
        : "Please try again.";
      Alert.alert("Upload failed", detail);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3 }}>
            New invoice
          </Text>
          <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 40, color: T.ink, marginTop: 6, letterSpacing: -1, lineHeight: 44 }}>
            Add a <Text style={{ fontFamily: FONTS.serif }}>bill</Text>
          </Text>
          <Text style={{ fontFamily: "System", fontSize: 14, color: T.ink3, marginTop: 4 }}>
            बिल जोड़ें
          </Text>
        </View>

        {/* ── Drop zone / file card ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
          {file ? (
            <View style={[{ borderRadius: 20, padding: 18, backgroundColor: T.card }, shadowCard]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <PdfGlyph big />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink }} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink3, marginTop: 3 }}>
                    {formatBytes(file.size)}
                  </Text>
                </View>
              </View>
              <View style={{ height: 0.5, backgroundColor: T.rule, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setFile(null)}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: "rgba(31,26,21,0.06)" }}
                >
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Change</Text>
                </Pressable>
                <Pressable
                  onPress={handleUpload}
                  disabled={uploading}
                  style={{ flex: 2, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: T.ink }}
                >
                  {uploading
                    ? <ActivityIndicator color={T.paper} size="small" />
                    : <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.paper }}>Parse invoice →</Text>
                  }
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={pickFile}
              style={{
                borderRadius: 24, padding: 40, borderWidth: 1.5, borderStyle: "dashed",
                borderColor: T.ink3, backgroundColor: T.card,
                alignItems: "center",
              }}
            >
              {/* PDF stack illustration */}
              <View style={{ width: 64, height: 78, marginBottom: 18, position: "relative" }}>
                <View style={{
                  position: "absolute", inset: 0, right: 8,
                  backgroundColor: T.paper2, borderRadius: 6,
                  borderWidth: 0.5, borderColor: T.rule,
                  transform: [{ rotate: "-4deg" }],
                }} />
                <View style={{
                  position: "absolute", top: 2, left: 6, right: 4,
                  bottom: 0, backgroundColor: T.paper2, borderRadius: 6,
                  borderWidth: 0.5, borderColor: T.rule,
                  transform: [{ rotate: "2deg" }],
                }} />
                <View style={{
                  position: "absolute", inset: 0,
                  backgroundColor: T.card, borderRadius: 6,
                  borderWidth: 0.5, borderColor: T.rule,
                  padding: 8, gap: 5,
                  shadowColor: T.ink, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}>
                  {[0.8, 0.6, 0.9, 0.5, 0.7].map((w, i) => (
                    <View key={i} style={{ height: 3, width: `${w * 100}%`, borderRadius: 2, backgroundColor: i === 0 ? T.terracotta : T.paper2 }} />
                  ))}
                </View>
              </View>
              <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: T.ink, letterSpacing: -0.3 }}>
                Drop a <Text style={{ fontFamily: FONTS.serifItalic }}>PDF invoice</Text>
              </Text>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 240, lineHeight: 18 }}>
                Tap to browse. Max 10 MB · Single file.
              </Text>
              <View style={{
                marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
                backgroundColor: T.ink,
              }}>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: T.paper }}>Browse files</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── How it works ── */}
        {!file && (
          <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
              How it works
            </Text>
            <View style={[{ borderRadius: 18, backgroundColor: T.cardAlt, overflow: "hidden" }, shadowCard]}>
              {HOW_IT_WORKS.map((s, i) => (
                <View key={s.n} style={{
                  flexDirection: "row", gap: 14, alignItems: "flex-start",
                  padding: 14,
                  borderBottomWidth: i < HOW_IT_WORKS.length - 1 ? 0.5 : 0,
                  borderBottomColor: T.rule,
                }}>
                  <View style={{
                    width: 26, height: 26, borderRadius: 999,
                    backgroundColor: T.paper2,
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.terracotta }}>{s.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 16, color: T.ink, letterSpacing: -0.2 }}>{s.t}</Text>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink2, marginTop: 2, lineHeight: 16 }}>{s.d}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
