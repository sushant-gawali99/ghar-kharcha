import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { CATEGORY_STYLES } from "@/lib/groceryCategoryStyles";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard, shadowHero } from "@/lib/theme";

const PLATFORM_CONFIG: Record<string, { bg: string; fg: string; glyph: string; label: string }> = {
  zepto:            { bg: "#4B1B8C", fg: "#F5E9C0", glyph: "Z", label: "Zepto" },
  blinkit:          { bg: "#F4D00A", fg: "#1A1A1A", glyph: "B", label: "Blinkit" },
  swiggy_instamart: { bg: "#FF5A2D", fg: "#FFF5E0", glyph: "S", label: "Swiggy Instamart" },
  other:            { bg: T.ink2,    fg: T.paper,   glyph: "•", label: "Other" },
};

type HomeData = {
  monthSpend: number;
  monthOrderCount: number;
  topCategories: { category: string; total: number }[];
  recentOrders: {
    id: string;
    platform: string;
    total: number;
    orderedAt: string;
    invoiceNo: string;
    itemCount: number;
    preview: string;
    categories: string[];
  }[];
};

function formatRupees(amount: number): { whole: string; paise: string } {
  const fixed = amount.toFixed(2);
  const [whole, paise] = fixed.split(".");
  return { whole: Number(whole).toLocaleString("en-IN"), paise: `.${paise}` };
}

function formatRupeesShort(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function platformConfig(platform: string) {
  return PLATFORM_CONFIG[platform.toLowerCase().replace(/\s+/g, "_")] ?? PLATFORM_CONFIG.other;
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHome = useCallback(async () => {
    if (!accessToken) return;
    try {
      setError(null);
      const res = await authFetch("/api/analytics/home");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as HomeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHome();
    }, [fetchHome])
  );

  const monthSpend = data?.monthSpend ?? 0;
  const { whole: spendWhole } = formatRupees(monthSpend);

  const now = new Date();
  const monthName = now.toLocaleString("en-IN", { month: "long" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar ── */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4,
        }}>
          <View>
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink, letterSpacing: -0.5 }}>
              Ghar <Text style={{ fontFamily: FONTS.serif, fontStyle: "normal" }}>Kharcha</Text>
            </Text>
            <Text style={{ fontFamily: "System", fontSize: 12, color: T.ink3, marginTop: 1 }}>
              घर खर्चा
            </Text>
          </View>
        </View>

        {/* ── Hero — this month ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{
                fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4,
                textTransform: "uppercase", color: T.ink3,
              }}>{monthName} · so far</Text>
              <Text style={{ fontFamily: "System", fontSize: 12, color: T.ink3, marginTop: 2 }}>
                {monthName === "January" ? "जनवरी" : monthName === "February" ? "फ़रवरी" : monthName === "March" ? "मार्च" : monthName === "April" ? "अप्रैल" : monthName === "May" ? "मई" : monthName === "June" ? "जून" : monthName === "July" ? "जुलाई" : monthName === "August" ? "अगस्त" : monthName === "September" ? "सितंबर" : monthName === "October" ? "अक्तूबर" : monthName === "November" ? "नवंबर" : "दिसंबर"} का हिसाब
              </Text>
            </View>
          </View>

          {/* Big amount */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 14 }}>
            <Text style={{
              fontFamily: FONTS.serifItalic, fontSize: 44, color: T.ink2,
              lineHeight: 44, transform: [{ translateY: -3 }],
            }}>₹</Text>
            {loading && !data ? (
              <ActivityIndicator color={T.terracotta} size="large" />
            ) : (
              <Text style={{
                fontFamily: FONTS.serifBold, fontSize: 80, color: T.ink,
                lineHeight: 80, letterSpacing: -3,
              }}>{spendWhole}</Text>
            )}
          </View>

          {data && data.monthOrderCount > 0 && (
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, marginBottom: 4 }}>
              {data.monthOrderCount} {data.monthOrderCount === 1 ? "order" : "orders"} this month
              {daysLeft > 0 ? ` · ${daysLeft} days left` : ""}
            </Text>
          )}
        </View>

        {/* ── Top categories ── */}
        <View style={{ paddingTop: 28 }}>
          <View style={{
            paddingHorizontal: 22,
            flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: T.ink, letterSpacing: -0.3 }}>
              <Text style={{ fontFamily: FONTS.serifItalic }}>Where</Text> it went
            </Text>
            <Pressable onPress={() => router.push("/(auth)/(tabs)/insights")}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: T.terracotta }}>See all →</Text>
            </Pressable>
          </View>

          {data && data.topCategories.length > 0 ? (
            <View style={{ paddingHorizontal: 22, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[...data.topCategories].sort((a, b) => b.total - a.total).slice(0, 4).map((cat) => {
                const style = CATEGORY_STYLES[cat.category] ?? CATEGORY_STYLES.other;
                const pct = data.monthSpend > 0 ? Math.round((cat.total / data.monthSpend) * 100) : 0;
                return (
                  <View key={cat.category} style={[{
                    width: "47.5%", borderRadius: 18, padding: 14,
                    backgroundColor: style.tint,
                  }, shadowCard]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.55)",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ fontSize: 18 }}>{style.icon}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: T.ink, lineHeight: 15 }} numberOfLines={1}>
                          {style.label}
                        </Text>
                        <Text style={{ fontFamily: "System", fontSize: 10, color: T.ink3, marginTop: 1 }}>
                          {style.hindi}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                      <Text style={{ fontFamily: FONTS.serifBold, fontSize: 22, color: T.ink, letterSpacing: -0.5 }}>
                        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.ink2 }}>₹</Text>
                        {Math.round(cat.total).toLocaleString("en-IN")}
                      </Text>
                      <View style={{
                        backgroundColor: "rgba(255,255,255,0.4)",
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                      }}>
                        <Text style={{ fontFamily: FONTS.sans, fontSize: 10, color: T.ink2 }}>{pct}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[{
              marginHorizontal: 22, borderRadius: 18, padding: 24,
              backgroundColor: T.card, alignItems: "center",
            }, shadowCard]}>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, textAlign: "center" }}>
                {loading ? "Loading…" : "No spending yet this month."}
              </Text>
            </View>
          )}
        </View>

        {/* ── Recent deliveries ── */}
        <View style={{ paddingTop: 28 }}>
          <View style={{
            paddingHorizontal: 22,
            flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: T.ink, letterSpacing: -0.3 }}>
              <Text style={{ fontFamily: FONTS.serifItalic }}>Recent</Text> deliveries
            </Text>
            <Pressable onPress={() => router.push("/(auth)/(tabs)/orders")}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: T.terracotta }}>All orders →</Text>
            </Pressable>
          </View>

          {data && data.recentOrders.length > 0 ? (
            <View style={{ paddingHorizontal: 22, gap: 12 }}>
              {data.recentOrders.map((order) => {
                const p = platformConfig(order.platform);
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => router.push("/(auth)/(tabs)/orders")}
                    style={{
                      backgroundColor: "#FFFBF0",
                      borderRadius: 22,
                      paddingVertical: 18,
                      paddingHorizontal: 18,
                      borderWidth: 1,
                      borderColor: "rgba(31,26,21,0.1)",
                      shadowColor: "#1F1A15",
                      shadowOpacity: 0.08,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 }}>
                        <View style={{
                          flexDirection: "row", alignItems: "center", gap: 8,
                          paddingLeft: 4, paddingRight: 12, paddingVertical: 4,
                          backgroundColor: T.paper, borderRadius: 999,
                        }}>
                          <View style={{
                            width: 24, height: 24, borderRadius: 999,
                            backgroundColor: p.bg,
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Text style={{ color: p.fg, fontFamily: FONTS.sansSemiBold, fontSize: 12 }}>{p.glyph}</Text>
                          </View>
                          <Text style={{ color: T.ink, fontFamily: FONTS.sansMedium, fontSize: 14 }}>{p.label ?? "Order"}</Text>
                        </View>
                        <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13 }}>
                          {formatOrderDate(order.orderedAt)}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 26, lineHeight: 30 }}>
                          ₹{Math.round(order.total).toLocaleString("en-IN")}
                        </Text>
                        <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13, marginTop: 4 }}>
                          {order.itemCount} items
                        </Text>
                      </View>
                    </View>
                    {order.preview ? (
                      <Text
                        numberOfLines={1}
                        style={{ color: T.ink, fontFamily: FONTS.sans, fontSize: 16, marginTop: 14 }}
                      >
                        {order.preview}
                      </Text>
                    ) : null}
                    {order.categories.length > 0 ? (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                        {order.categories.map((id) => (
                          <View
                            key={id}
                            style={{
                              flex: 1,
                              height: 5,
                              borderRadius: 3,
                              backgroundColor: (CATEGORY_STYLES[id] ?? CATEGORY_STYLES.other).color,
                            }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[{
              marginHorizontal: 22, borderRadius: 18, padding: 24,
              backgroundColor: T.card, alignItems: "center",
            }, shadowCard]}>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, textAlign: "center" }}>
                {loading ? "Loading…" : error ?? "No orders yet."}
              </Text>
            </View>
          )}
        </View>

        {/* ── Upload prompt ── */}
        <Pressable
          onPress={() => router.push("/(auth)/(tabs)/upload")}
          style={[
            {
              marginHorizontal: 22, marginTop: 26, borderRadius: 22,
              overflow: "hidden", backgroundColor: T.ink, padding: 22,
            },
            shadowHero,
          ]}
        >
          <View style={{
            position: "absolute", top: -30, right: -30,
            width: 140, height: 140, borderRadius: 999,
            backgroundColor: "rgba(227,168,46,0.25)",
          }} />
          <Text style={{
            fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4,
            textTransform: "uppercase", color: "rgba(243,234,219,0.55)",
            marginBottom: 6,
          }}>Add an invoice</Text>
          <Text style={{
            fontFamily: FONTS.serif, fontSize: 26, color: T.paper,
            letterSpacing: -0.5, lineHeight: 30, marginBottom: 6,
          }}>
            Got a bill from{" "}
            <Text style={{ fontFamily: FONTS.serifItalic, color: T.haldi }}>Zepto?</Text>
          </Text>
          <Text style={{
            fontFamily: FONTS.sans, fontSize: 13, color: "rgba(243,234,219,0.7)",
            lineHeight: 18, maxWidth: 260, marginBottom: 14,
          }}>
            Drop the PDF and we'll sort it into dal, doodh and sab kuch else.
          </Text>
          <View style={{
            alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: T.haldi,
          }}>
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink }}>Upload PDF →</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
