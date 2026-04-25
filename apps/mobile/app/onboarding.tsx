import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS } from "@/lib/theme";

type Step = "welcome" | "budget" | "upload" | "review" | "done";

type PickedFile = { name: string; uri: string; mimeType: string | null };

type UploadResult = {
  orderId: string;
  platform: string;
  total: number;
  itemCount: number;
};

type ReviewItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  totalAmount: number;
};

type OrderDetail = {
  id: string;
  platform: string;
  total: number;
  items: ReviewItem[];
};

const PLATFORM_LABEL: Record<string, string> = {
  zepto: "Zepto",
  blinkit: "Blinkit",
  swiggy_instamart: "Swiggy Instamart",
  other: "grocery bill",
};

const DEV_DIGIT: Record<string, string> = {
  "0": "\u0966",
  "1": "\u0967",
  "2": "\u0968",
  "3": "\u0969",
  "4": "\u096A",
  "5": "\u096B",
  "6": "\u096C",
  "7": "\u096D",
  "8": "\u096E",
  "9": "\u096F",
};
function devNum(n: number): string {
  return String(n)
    .split("")
    .map((d) => DEV_DIGIT[d] ?? d)
    .join("");
}

function formatRupees(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

const BUDGET_MIN = 3000;
const BUDGET_MAX = 50000;
const BUDGET_DEFAULT = 12000;
const BUDGET_PRESETS = [6000, 10000, 15000, 20000, 30000];

function snapBudget(value: number): number {
  // Step 500 below 20k, step 1000 above.
  if (value <= 20000) return Math.round(value / 500) * 500;
  return Math.round(value / 1000) * 1000;
}

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      {[1, 2, 3].map((i) => {
        const active = i === step;
        const past = i < step;
        return (
          <View
            key={i}
            style={{
              width: i === step ? 22 : 16,
              height: 4,
              borderRadius: 2,
              backgroundColor: active ? T.terracotta : past ? T.ink : "rgba(31,26,21,0.18)",
            }}
          />
        );
      })}
    </View>
  );
}

function CircleBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{
        width: 40, height: 40, borderRadius: 999,
        backgroundColor: T.paper2,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink, lineHeight: 20 }}>‹</Text>
    </Pressable>
  );
}

function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const widthRef = useRef(1);
  const valueRef = useRef(value);
  valueRef.current = value;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / widthRef.current));
        onChange(snapBudget(BUDGET_MIN + ratio * (BUDGET_MAX - BUDGET_MIN)));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / widthRef.current));
        onChange(snapBudget(BUDGET_MIN + ratio * (BUDGET_MAX - BUDGET_MIN)));
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setTrackWidth(w);
  };

  const ratio = Math.max(0, Math.min(1, (value - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)));
  const thumbSize = 24;
  const thumbX = ratio * trackWidth - thumbSize / 2;

  return (
    <View>
      <View
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={{
          height: 36,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: "rgba(31,26,21,0.09)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 14,
            height: 8,
            width: `${ratio * 100}%`,
            borderRadius: 999,
            backgroundColor: T.haldi,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: Math.max(0, thumbX),
            top: 6,
            width: thumbSize,
            height: thumbSize,
            borderRadius: 999,
            backgroundColor: T.ink,
            borderWidth: 3,
            borderColor: T.paper,
            shadowColor: T.ink,
            shadowOpacity: 0.22,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 6,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: T.ink3 }}>
          ₹{BUDGET_MIN / 1000}k
        </Text>
        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: T.ink3 }}>
          ₹{BUDGET_MAX / 1000}k
        </Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<Step>("welcome");
  const [budget, setBudget] = useState<number>(BUDGET_DEFAULT);
  const [savingBudget, setSavingBudget] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [uploadedFirstBill, setUploadedFirstBill] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const markOnboarded = useCallback(async () => {
    await authFetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarded: true }),
    }).catch(() => {});
  }, []);

  const skipToHome = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await markOnboarded();
    router.replace("/(auth)/(tabs)/home");
  }, [finishing, markOnboarded]);

  const finishFromDone = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await markOnboarded();
    router.replace("/(auth)/(tabs)/home");
  }, [finishing, markOnboarded]);

  const saveBudgetAndAdvance = useCallback(async () => {
    if (!accessToken) return;
    try {
      setSavingBudget(true);
      const res = await authFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget: budget }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStep("upload");
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSavingBudget(false);
    }
  }, [accessToken, budget]);

  const pickAndUpload = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const file: PickedFile = {
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
      };

      setUploading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/pdf",
      } as unknown as Blob);
      const res = await authFetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const result: UploadResult = await res.json();

      const detailRes = await authFetch(`/api/orders/${result.orderId}`);
      if (!detailRes.ok) throw new Error(`Could not load details (${detailRes.status})`);
      const detail: OrderDetail = await detailRes.json();
      setOrderDetail(detail);
      setUploadedFirstBill(true);
      setStep("review");
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  // ─── renderers ─────────────────────────────────────────────────────────────

  if (step === "welcome") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
        <Text
          style={{
            position: "absolute",
            top: 100,
            right: -20,
            fontFamily: "System",
            fontSize: 240,
            color: "rgba(227,168,46,0.18)",
            lineHeight: 220,
            transform: [{ rotate: "-6deg" }],
          }}
          pointerEvents="none"
        >
          घर
        </Text>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: T.ink, alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: FONTS.serifBoldItalic, fontSize: 18, color: T.paper }}>g</Text>
              </View>
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 18, color: T.ink }}>Ghar Kharcha</Text>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: T.paper2 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: T.ink3, letterSpacing: 0.8 }}>1 / 3</Text>
            </View>
          </View>

          <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 15, color: T.terracotta, marginTop: 40 }}>
            welcome, ji —
          </Text>
          <Text
            style={{
              fontFamily: FONTS.serifBold,
              fontSize: 40,
              color: T.ink,
              marginTop: 6,
              lineHeight: 46,
              letterSpacing: -0.5,
            }}
          >
            Your quiet{" "}
            <Text style={{ fontFamily: FONTS.serifBoldItalic, color: T.terracotta }}>ghar</Text>
            {" "}ledger.
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink2, marginTop: 16, lineHeight: 22 }}>
            Tell us what your household spends on groceries each month. It helps us show you the pace — not judge it.
          </Text>

          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 32 }}>
            WHAT YOU'LL GET
          </Text>

          {[
            { i: 1, title: "Receipts, read for you.", body: "Blinkit, Zepto, BigBasket — parsed automatically." },
            { i: 2, title: "A mirror, not a ruler.", body: "No targets, no red numbers — just the pace." },
            { i: 3, title: "Your ghar, not a dashboard.", body: "Warm, literary. No neon stats." },
          ].map(({ i, title, body }, idx) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: 18,
                alignItems: "flex-start",
                paddingVertical: 16,
                borderTopWidth: idx === 0 ? 0.5 : 0,
                borderBottomWidth: 0.5,
                borderColor: "rgba(31,26,21,0.1)",
                marginTop: idx === 0 ? 12 : 0,
              }}
            >
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 20, color: T.terracotta, minWidth: 36 }}>
                ०{devNum(i)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.serifBold, fontSize: 17, color: T.ink }}>{title}</Text>
                <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: T.ink3, marginTop: 4, lineHeight: 20 }}>
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
          <Pressable
            onPress={() => setStep("budget")}
            style={{
              backgroundColor: T.ink,
              paddingVertical: 20,
              borderRadius: 22,
              alignItems: "center",
              shadowColor: T.ink,
              shadowOpacity: 0.22,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper }}>Set a budget →</Text>
          </Pressable>
          <Pressable onPress={skipToHome} style={{ alignItems: "center", paddingVertical: 14, marginTop: 4 }}>
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.ink3 }}>Skip for now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "budget") {
    const perDay = budget / 30;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
            <CircleBack onPress={() => setStep("welcome")} />
            <StepDots step={2} />
          </View>

          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 36 }}>
            MONTHLY BUDGET
          </Text>
          <Text style={{ fontFamily: FONTS.serifBold, fontSize: 36, color: T.ink, marginTop: 6, lineHeight: 42, letterSpacing: -0.5 }}>
            How much does your{" "}
            <Text style={{ fontFamily: FONTS.serifBoldItalic }}>ghar</Text>
            {" "}spend on groceries?
          </Text>
          <Text style={{ fontFamily: "System", fontSize: 15, color: T.ink3, marginTop: 8 }}>
            महीने का बजट
          </Text>

          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontFamily: FONTS.serifBold, fontSize: 68, color: T.ink, letterSpacing: -2, lineHeight: 74 }}>
              ₹{formatRupees(budget)}
            </Text>
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 2 }}>per month</Text>
          </View>

          <View style={{ marginTop: 32 }}>
            <BudgetSlider value={budget} onChange={setBudget} />
          </View>

          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 28 }}>
            COMMON FOR INDIAN HOUSEHOLDS
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {BUDGET_PRESETS.map((preset) => {
              const isActive = preset === budget;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setBudget(preset)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
                    backgroundColor: isActive ? T.ink : T.paper2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansMedium,
                      fontSize: 14,
                      color: isActive ? T.paper : T.ink,
                    }}
                  >
                    ₹{formatRupees(preset)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              marginTop: 24,
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderRadius: 14,
              backgroundColor: T.card,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 15, color: T.ink2 }}>That's roughly</Text>
            <Text style={{ fontFamily: FONTS.serifBold, fontSize: 18, color: T.ink }}>
              ₹{formatRupees(perDay)}
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3 }}> / day</Text>
            </Text>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
          <Pressable
            onPress={saveBudgetAndAdvance}
            disabled={savingBudget}
            style={{
              backgroundColor: T.ink,
              paddingVertical: 20,
              borderRadius: 22,
              alignItems: "center",
              opacity: savingBudget ? 0.6 : 1,
              shadowColor: T.ink,
              shadowOpacity: 0.22,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper }}>
              {savingBudget ? "Saving…" : "Next · add a receipt →"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "upload") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
            <CircleBack onPress={() => setStep("budget")} />
            <StepDots step={3} />
          </View>

          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 36 }}>
            YOUR FIRST BILL
          </Text>
          <Text style={{ fontFamily: FONTS.serifBold, fontSize: 36, color: T.ink, marginTop: 6, lineHeight: 42, letterSpacing: -0.5 }}>
            Add a grocery bill to start.
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink3, marginTop: 14, lineHeight: 22 }}>
            Upload a photo or PDF of any recent grocery bill — from Blinkit, Zepto, BigBasket, Instamart, or a paper receipt. We'll read the items and prices for you.
          </Text>

          <View
            style={{
              marginTop: 30,
              borderRadius: 26,
              borderWidth: 1.5,
              borderColor: "rgba(200,92,60,0.35)",
              borderStyle: "dashed",
              paddingVertical: 40,
              paddingHorizontal: 24,
              alignItems: "center",
              backgroundColor: "rgba(200,92,60,0.03)",
            }}
          >
            {/* stacked receipt glyph */}
            <View style={{ width: 76, height: 92, marginBottom: 20 }}>
              <View
                style={{
                  position: "absolute", left: 4, top: 4, right: -4, bottom: -4,
                  backgroundColor: T.card, borderRadius: 6,
                  borderWidth: 0.5, borderColor: "rgba(31,26,21,0.08)",
                }}
              />
              <View
                style={{
                  position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
                  backgroundColor: "#FFFBF0", borderRadius: 6, padding: 10,
                  borderWidth: 0.5, borderColor: "rgba(31,26,21,0.12)",
                }}
              >
                <View style={{ height: 3, width: "70%", backgroundColor: "rgba(31,26,21,0.2)", borderRadius: 999, marginBottom: 6 }} />
                <View style={{ height: 3, width: "55%", backgroundColor: "rgba(31,26,21,0.2)", borderRadius: 999, marginBottom: 6 }} />
                <View style={{ height: 3, width: "45%", backgroundColor: "rgba(31,26,21,0.2)", borderRadius: 999 }} />
                <Text style={{ position: "absolute", right: 8, bottom: 6, color: T.terracotta, fontFamily: FONTS.serifBold, fontSize: 14 }}>₹</Text>
              </View>
            </View>

            <Pressable
              onPress={pickAndUpload}
              disabled={uploading}
              style={{
                backgroundColor: T.ink,
                paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
                alignItems: "center",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? (
                <ActivityIndicator color={T.haldi} />
              ) : (
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.paper }}>Upload bill</Text>
              )}
            </Pressable>
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 12 }}>
              Photo or PDF works
            </Text>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
          <Pressable
            onPress={() => setStep("done")}
            style={{
              paddingVertical: 18, borderRadius: 22, alignItems: "center",
              borderWidth: 1, borderColor: "rgba(31,26,21,0.15)",
            }}
          >
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 15, color: T.ink2 }}>Skip for now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "review" && orderDetail) {
    const platform = PLATFORM_LABEL[orderDetail.platform] ?? "Receipt";
    const previewItems = orderDetail.items.slice(0, 4);
    const remaining = orderDetail.items.length - previewItems.length;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
            <CircleBack onPress={() => setStep("upload")} />
            <StepDots step={3} />
          </View>

          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 36 }}>
            YOUR FIRST BILL
          </Text>
          <Text style={{ fontFamily: FONTS.serifBold, fontSize: 36, color: T.ink, marginTop: 6, lineHeight: 42, letterSpacing: -0.5 }}>
            Add a grocery bill to start.
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink3, marginTop: 14, lineHeight: 22 }}>
            Upload a photo or PDF of any recent grocery bill — from Blinkit, Zepto, BigBasket, Instamart, or a paper receipt. We'll read the items and prices for you.
          </Text>

          <View
            style={{
              marginTop: 24,
              borderRadius: 22,
              backgroundColor: T.card,
              paddingVertical: 22, paddingHorizontal: 22,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 999,
                  backgroundColor: "#6F7A3E",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: T.paper, fontFamily: FONTS.sansSemiBold, fontSize: 16 }}>✓</Text>
              </View>
              <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 17, color: T.ink }}>
                {platform} · {orderDetail.items.length} items found
              </Text>
            </View>

            <View style={{ marginTop: 20 }}>
              {previewItems.map((it) => (
                <View
                  key={it.id}
                  style={{
                    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink }} numberOfLines={1}>
                    {it.name}
                    {it.unit ? (
                      <Text style={{ color: T.ink3 }}> · {it.quantity > 1 ? `${it.quantity}×` : ""}{it.unit}</Text>
                    ) : null}
                  </Text>
                  <Text style={{ fontFamily: FONTS.serifBold, fontSize: 15, color: T.ink }}>
                    ₹{formatRupees(it.totalAmount)}
                  </Text>
                </View>
              ))}
              {remaining > 0 && (
                <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 13, color: T.ink3, marginTop: 6 }}>
                  …and {remaining} more
                </Text>
              )}
            </View>

            <View style={{ height: 0.5, backgroundColor: T.rule, marginVertical: 16 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3 }}>TOTAL</Text>
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 26, color: T.ink }}>
                ₹{formatRupees(orderDetail.total)}
              </Text>
            </View>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
          <Pressable
            onPress={() => setStep("done")}
            style={{
              backgroundColor: T.ink,
              paddingVertical: 20, borderRadius: 22, alignItems: "center",
              shadowColor: T.ink, shadowOpacity: 0.22, shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 }, elevation: 10,
            }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper }}>
              Looks right · continue →
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setOrderDetail(null);
              setUploadedFirstBill(false);
              setStep("upload");
            }}
            style={{ alignItems: "center", paddingVertical: 14, marginTop: 2 }}
          >
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.ink3 }}>Try a different one</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // step === "done"
  const perDay = budget / 30;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <Text
        style={{
          position: "absolute",
          top: 120,
          right: -30,
          fontFamily: "System",
          fontSize: 220,
          color: "rgba(31,26,21,0.07)",
          lineHeight: 200,
          transform: [{ rotate: "-4deg" }],
        }}
        pointerEvents="none"
      >
        बस
      </Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <View
            style={{
              width: 22, height: 22, borderRadius: 999,
              backgroundColor: "#6F7A3E",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: T.paper, fontFamily: FONTS.sansSemiBold, fontSize: 11 }}>✓</Text>
          </View>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: "#6F7A3E" }}>
            ALL SET
          </Text>
        </View>

        <Text style={{ fontFamily: FONTS.serifBold, fontSize: 44, color: T.ink, marginTop: 18, lineHeight: 48, letterSpacing: -0.5 }}>
          <Text style={{ fontFamily: FONTS.serifBoldItalic }}>Bas.</Text> You're ready.
        </Text>
        <Text style={{ fontFamily: "System", fontSize: 15, color: T.ink3, marginTop: 8 }}>
          घर का हिसाब तैयार है
        </Text>

        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 40 }}>
          YOUR SETUP
        </Text>

        <View
          style={{
            marginTop: 12, borderRadius: 22,
            backgroundColor: T.card,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 16 }}>
            <View
              style={{
                width: 46, height: 46, borderRadius: 10,
                backgroundColor: "#F2E0B0",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 22, color: T.terracotta }}>₹</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink }}>Monthly budget</Text>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 3 }}>
                <Text style={{ fontFamily: FONTS.serifBold, color: T.ink, fontSize: 15 }}>₹{formatRupees(budget)}</Text>{" "}
                <Text style={{ fontFamily: FONTS.serifItalic }}>· about ₹{formatRupees(perDay)}/day</Text>
              </Text>
            </View>
            <Pressable onPress={() => setStep("budget")}>
              <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.terracotta }}>edit</Text>
            </Pressable>
          </View>

          <View style={{ height: 0.5, backgroundColor: T.rule, marginHorizontal: 16 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 16 }}>
            <View
              style={{
                width: 46, height: 46, borderRadius: 10,
                backgroundColor: "rgba(31,26,21,0.06)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: FONTS.sans, fontSize: 18, color: T.ink3 }}>—</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink }}>First bill</Text>
              <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 13, color: T.ink3, marginTop: 3 }}>
                {uploadedFirstBill
                  ? orderDetail
                    ? `${PLATFORM_LABEL[orderDetail.platform] ?? "Receipt"} · ₹${formatRupees(orderDetail.total)} saved`
                    : "saved"
                  : "skipped — add later from Upload tab"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, color: T.ink3, marginTop: 32 }}>
          NEXT, INSIDE
        </Text>
        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 17, color: T.ink, marginTop: 12, lineHeight: 26 }}>
          "Add bills as they come in — a photo or PDF is enough. We'll read the items, match them to categories, and keep a quiet tally for the month."
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
        <Pressable
          onPress={finishFromDone}
          disabled={finishing}
          style={{
            backgroundColor: T.ink,
            paddingVertical: 20, borderRadius: 22, alignItems: "center",
            opacity: finishing ? 0.6 : 1,
            shadowColor: T.ink, shadowOpacity: 0.22, shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 }, elevation: 10,
          }}
        >
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper }}>
            {finishing ? "Opening…" : "Take me to my ghar →"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
