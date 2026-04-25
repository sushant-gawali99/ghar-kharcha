import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type {
  GroceryMonthAnalytics,
  MonthlyComparisonAnalytics,
} from "@ghar-kharcha/shared-types";
import { useAuthStore } from "@/lib/auth";
import { CATEGORY_STYLES } from "@/lib/groceryCategoryStyles";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard } from "@/lib/theme";

const MONTH_STRIP_COUNT = 18;

function getCurrentUtcMonthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

function utcMonthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "";
  return new Intl.DateTimeFormat("en-IN", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

function buildUtcMonthStrip(count: number): { key: string; labelUpper: string }[] {
  const out: { key: string; labelUpper: string }[] = [];
  const n = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      labelUpper: new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" })
        .format(d).toUpperCase(),
    });
  }
  return out;
}

function formatRupees(amount: number): { whole: string; paise: string } {
  const fixed = amount.toFixed(2);
  const [whole, paise] = fixed.split(".");
  return { whole: Number(whole).toLocaleString("en-IN"), paise: `.${paise}` };
}

function formatRupeesShort(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function InsightsScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const monthOptions = useMemo(() => buildUtcMonthStrip(MONTH_STRIP_COUNT), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentUtcMonthKey);

  const [data, setData] = useState<GroceryMonthAnalytics | null>(null);
  const [comparison, setComparison] = useState<MonthlyComparisonAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (monthKey: string) => {
    if (!accessToken) return;
    setError(null);
    const qs = new URLSearchParams({ month: monthKey });
    const res = await authFetch(`/api/analytics/grocery/month?${qs.toString()}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    setData((await res.json()) as GroceryMonthAnalytics);

    const compRes = await authFetch(`/api/analytics/grocery/compare?${qs.toString()}`);
    if (!compRes.ok) throw new Error(`Request failed (${compRes.status})`);
    setComparison((await compRes.json()) as MonthlyComparisonAnalytics);
  }, [accessToken]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    load(selectedMonthKey)
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, selectedMonthKey]));

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try { await load(selectedMonthKey); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setRefreshing(false); }
  }, [accessToken, load, selectedMonthKey]);

  const monthSpend = data?.monthSpend ?? 0;
  const { whole: spendWhole } = formatRupees(monthSpend);
  const sortedCats = data ? [...data.categories].sort((a, b) => b.total - a.total) : [];
  const maxCat = sortedCats[0]?.total ?? 1;

  // Monthly bar chart points from comparison
  const barPoints = comparison?.months ?? [];
  const maxBar = barPoints.length > 0 ? Math.max(1, ...barPoints.map((m) => m.total)) : 1;
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.terracotta} />}
      >
        {/* ── Header ── */}
        <View style={{ padding: 22, paddingBottom: 6 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3 }}>
            The ledger
          </Text>
          <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 40, color: T.ink, marginTop: 6, letterSpacing: -1, lineHeight: 44 }}>
            Insights
          </Text>
          <Text style={{ fontFamily: "System", fontSize: 14, color: T.ink3, marginTop: 4 }}>
            छह महीने का हिसाब
          </Text>
        </View>

        {/* ── Month filter strip ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 4, paddingHorizontal: 2,
            }}
          >
            {monthOptions.map(({ key, labelUpper }) => {
              const selected = key === selectedMonthKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => { setSelectedMonthKey(key); setData(null); setComparison(null); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: selected ? T.ink : "rgba(31,26,21,0.06)",
                  }}
                >
                  <Text style={{
                    fontFamily: selected ? FONTS.serifItalic : FONTS.sans,
                    fontSize: 12, letterSpacing: 0.3,
                    color: selected ? T.paper : T.ink3,
                  }}>{labelUpper}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Spend hero ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 6 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3 }}>
            Order total
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 30, color: T.ink2, transform: [{ translateY: -2 }] }}>₹</Text>
            {loading && !data ? (
              <ActivityIndicator color={T.terracotta} />
            ) : (
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 52, color: T.ink, letterSpacing: -2, lineHeight: 56 }}>
                {spendWhole}
              </Text>
            )}
          </View>
          {data && data.monthOrderCount > 0 && (
            <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink3, marginTop: 4 }}>
              {data.monthOrderCount} {data.monthOrderCount === 1 ? "order" : "orders"}
              {" · "}{formatRupeesShort(data.itemSpendTotal ?? 0)} in catalogued items
            </Text>
          )}
        </View>

        {/* ── Monthly bar chart ── */}
        {barPoints.length > 0 && (
          <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>Month by month</Text>
              {comparison && (
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: T.ink3, letterSpacing: 0.3 }}>
                  AVG{" "}
                  <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.ink }}>
                    ₹{Math.round(
                      barPoints.filter((_, i) => i < barPoints.length - 1)
                        .reduce((s, m) => s + m.total, 0) /
                      Math.max(1, barPoints.length - 1)
                    ).toLocaleString("en-IN")}
                  </Text>
                </Text>
              )}
            </View>
            <View style={[{ borderRadius: 22, padding: 18, backgroundColor: T.card }, shadowCard]}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140, paddingBottom: 4 }}>
                {barPoints.map((m, i) => {
                  const h = Math.max(4, (m.total / maxBar) * 120);
                  const selected = selectedBar === i;
                  return (
                    <Pressable key={i} onPress={() => setSelectedBar(selected ? null : i)}
                      style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <Text style={{
                        fontFamily: FONTS.serifItalic, fontSize: 11, color: selected ? T.ink : "transparent",
                      }}>
                        ₹{(m.total / 1000).toFixed(1)}k
                      </Text>
                      <View style={{
                        width: "100%", height: h, borderRadius: 6,
                        backgroundColor: selected ? T.terracotta : T.ink2,
                        opacity: selected ? 1 : 0.4,
                      }} />
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {barPoints.map((m, i) => (
                  <Text key={i} style={{
                    flex: 1, textAlign: "center",
                    fontFamily: selectedBar === i ? FONTS.serifBold : FONTS.sans,
                    fontSize: 11, letterSpacing: 0.4,
                    color: selectedBar === i ? T.ink : T.ink3,
                  }}>
                    {(m.monthShortLabel ?? shortMonthLabel(m.monthKey)).slice(0, 3).toUpperCase()}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Category breakdown ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>
              {utcMonthLabelFromKey(selectedMonthKey).split(" ")[0]} breakdown
            </Text>
            {data && (
              <Text style={{ fontFamily: FONTS.serifBold, fontSize: 20, color: T.ink }}>
                <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: T.ink2 }}>₹</Text>
                {spendWhole}
              </Text>
            )}
          </View>

          {error && !loading && (
            <View style={{ borderRadius: 14, backgroundColor: "#FEF2F2", padding: 14, marginBottom: 14 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: "#B91C1C" }}>{error}</Text>
              <Pressable onPress={onRefresh} style={{ marginTop: 6 }}>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: "#991B1B", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          )}

          {loading && !data ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={T.terracotta} />
            </View>
          ) : sortedCats.length > 0 ? (
            <View style={{ gap: 16 }}>
              {sortedCats.map((row) => {
                const style = CATEGORY_STYLES[row.category] ?? CATEGORY_STYLES.other;
                const barW = `${(row.total / maxCat) * 100}%` as `${number}%`;
                const pct = Math.round(row.percentage);
                return (
                  <Pressable
                    key={row.category}
                    onPress={() => router.push({ pathname: "/(auth)/grocery-category", params: { category: row.category, month: selectedMonthKey } })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>{style.icon}</Text>
                        <Text style={{ fontFamily: FONTS.serif, fontSize: 16, color: T.ink, letterSpacing: -0.2 }}>
                          {style.label}
                        </Text>
                        <Text style={{ fontFamily: "System", fontSize: 11, color: T.ink3 }}>
                          {style.hindi}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONTS.serifBold, fontSize: 16, color: T.ink }}>
                        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 12, color: T.ink2 }}>₹</Text>
                        {Math.round(row.total).toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: "rgba(31,26,21,0.07)", overflow: "hidden" }}>
                        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: barW, backgroundColor: style.color, borderRadius: 999 }} />
                      </View>
                      <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: T.ink3, minWidth: 30, textAlign: "right" }}>
                        {pct}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[{ borderRadius: 18, padding: 40, backgroundColor: T.card, alignItems: "center" }, shadowCard]}>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, textAlign: "center" }}>
                {error ? "Could not load categories." : `No spending in ${data?.monthLabel ?? "this month"} yet.`}
              </Text>
              <Pressable
                onPress={() => router.push("/(auth)/(tabs)/upload")}
                style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: T.terracotta }}
              >
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: T.paper, textTransform: "uppercase", letterSpacing: 1 }}>
                  Upload invoice
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Observation card ── */}
        {data && sortedCats.length > 0 && (
          <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
            <View style={[{ borderRadius: 22, padding: 18, backgroundColor: T.cardAlt }, shadowCard]}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
                A small observation
              </Text>
              <Text style={{ fontFamily: FONTS.serif, fontSize: 18, color: T.ink, lineHeight: 26, letterSpacing: -0.3 }}>
                You've spent{" "}
                <Text style={{ fontFamily: FONTS.serifItalic, color: T.terracotta }}>
                  {formatRupeesShort(sortedCats[0].total)}
                </Text>
                {" "}on{" "}
                <Text style={{ fontFamily: FONTS.serifItalic }}>
                  {(CATEGORY_STYLES[sortedCats[0].category] ?? CATEGORY_STYLES.other).label.toLowerCase()}
                </Text>{" "}
                this month — {Math.round(sortedCats[0].percentage)}% of everything.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
