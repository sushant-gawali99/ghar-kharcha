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
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import type {
  GroceryCategoryItemsAnalytics,
  MonthlyComparisonAnalytics,
} from "@ghar-kharcha/shared-types";
import { CATEGORY_STYLES } from "@/lib/groceryCategoryStyles";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard } from "@/lib/theme";

function formatRupeesBig(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

function formatRupeesShort(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `₹${k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `₹${Math.round(amount)}`;
}

function MonthlyBarChart({
  points,
  currentKey,
  accent,
}: {
  points: { monthKey: string; monthShortLabel?: string; total: number }[];
  currentKey: string;
  accent: string;
}) {
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: "#FFFBF0",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "rgba(31,26,21,0.08)",
        ...shadowCard,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 180, gap: 10 }}>
        {points.map((p) => {
          const isCurrent = p.monthKey === currentKey;
          const pct = p.total > 0 ? (p.total / maxTotal) : 0;
          const height = Math.max(14, pct * 150);
          return (
            <View key={p.monthKey} style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontFamily: FONTS.serifBold,
                  fontSize: 12,
                  color: T.ink,
                  marginBottom: 6,
                }}
              >
                {formatRupeesShort(p.total)}
              </Text>
              <View
                style={{
                  width: "100%",
                  height,
                  borderRadius: 10,
                  backgroundColor: isCurrent ? accent : "#C9BBA0",
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 12, gap: 10 }}>
        {points.map((p) => {
          const isCurrent = p.monthKey === currentKey;
          const label =
            p.monthShortLabel ??
            new Date(`${p.monthKey}-01T00:00:00Z`).toLocaleString("en-IN", {
              month: "short",
              timeZone: "UTC",
            });
          return (
            <Text
              key={p.monthKey}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: isCurrent ? FONTS.sansSemiBold : FONTS.sans,
                fontSize: 13,
                color: isCurrent ? T.ink : T.ink3,
              }}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export default function GroceryCategoryScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { category, month } = useLocalSearchParams<{
    category?: string;
    month?: string;
  }>();

  const categoryKey = (category ?? "").trim();
  const monthKey = (month ?? "").trim();

  const style = useMemo(
    () => CATEGORY_STYLES[categoryKey] ?? CATEGORY_STYLES.other,
    [categoryKey],
  );

  const [data, setData] = useState<GroceryCategoryItemsAnalytics | null>(null);
  const [comparison, setComparison] = useState<MonthlyComparisonAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    if (!categoryKey || !monthKey) return;
    setError(null);
    const qs = new URLSearchParams({ category: categoryKey, month: monthKey });
    const res = await authFetch(`/api/analytics/grocery/category/items?${qs.toString()}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const body = (await res.json()) as GroceryCategoryItemsAnalytics;
    setData(body);

    const comparisonRes = await authFetch(`/api/analytics/grocery/compare?${qs.toString()}`);
    if (!comparisonRes.ok) throw new Error(`Request failed (${comparisonRes.status})`);
    const comparisonBody = (await comparisonRes.json()) as MonthlyComparisonAnalytics;
    setComparison(comparisonBody);
  }, [accessToken, categoryKey, monthKey]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, load]);

  const average =
    comparison && comparison.months.length > 0
      ? comparison.months.reduce((s, m) => s + m.total, 0) / comparison.months.length
      : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 60, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: 999, backgroundColor: T.paper2,
            }}
            hitSlop={8}
          >
            <Text style={{ color: T.ink, fontFamily: FONTS.serifItalic, fontSize: 14 }}>‹ </Text>
            <Text style={{ color: T.ink, fontFamily: FONTS.sansMedium, fontSize: 13 }}>Insights</Text>
          </Pressable>
          <View
            style={{
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: 999, backgroundColor: T.paper2,
            }}
          >
            <Text style={{ color: T.ink, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4 }}>
              CATEGORY
            </Text>
          </View>
        </View>

        {/* Category hero */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 26 }}>
          <View
            style={{
              width: 76, height: 76, borderRadius: 20,
              backgroundColor: style.iconBg,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 32 }}>{style.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 34, lineHeight: 38 }}>
              {style.label}
            </Text>
            <Text style={{ color: T.ink3, fontFamily: "System", fontSize: 15, marginTop: 4 }}>
              {style.hindi}
            </Text>
          </View>
        </View>

        {/* Big total */}
        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 22 }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 52, lineHeight: 58 }}>
            ₹{formatRupeesBig(data?.totalValue ?? 0)}
          </Text>
        </View>

        {/* Stats strip */}
        <View style={{ flexDirection: "row", gap: 20, marginTop: 10 }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.sans, fontSize: 15 }}>
            <Text style={{ fontFamily: FONTS.sansSemiBold }}>{data?.distinctItemCount ?? 0}</Text>{" "}
            <Text style={{ color: T.ink3 }}>items</Text>
          </Text>
          <Text style={{ color: T.ink, fontFamily: FONTS.sans, fontSize: 15 }}>
            <Text style={{ fontFamily: FONTS.sansSemiBold }}>{Math.round(data?.totalUnits ?? 0)}</Text>{" "}
            <Text style={{ color: T.ink3 }}>units</Text>
          </Text>
          <Text style={{ color: T.ink, fontFamily: FONTS.sans, fontSize: 15 }}>
            <Text style={{ fontFamily: FONTS.sansSemiBold }}>{data?.totalOrdersWithCategory ?? 0}</Text>{" "}
            <Text style={{ color: T.ink3 }}>orders</Text>
          </Text>
        </View>

        {/* Month by month */}
        <View style={{ marginTop: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 22 }}>Month by month</Text>
          {average > 0 && (
            <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 13 }}>
              <Text style={{ letterSpacing: 1 }}>AVG </Text>
              <Text style={{ color: T.ink, fontFamily: FONTS.serifBold }}>
                ₹{formatRupeesBig(average)}
              </Text>
            </Text>
          )}
        </View>

        {comparison && comparison.months.length > 0 ? (
          <MonthlyBarChart points={comparison.months} currentKey={data?.monthKey ?? monthKey} accent={style.color} />
        ) : (
          <View style={{ marginTop: 14, padding: 30, borderRadius: 24, backgroundColor: "#FFFBF0" }}>
            <ActivityIndicator color={T.ink3} />
          </View>
        )}

        {/* Items ordered */}
        <View style={{ marginTop: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 22 }}>Items ordered</Text>
          {data && data.items.length > 0 && (
            <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13 }}>
              {data.items.length} unique
            </Text>
          )}
        </View>

        {error && !loading && (
          <View style={{ marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: "rgba(200,92,60,0.1)", borderWidth: 1, borderColor: "rgba(200,92,60,0.2)" }}>
            <Text style={{ color: T.terracotta, fontFamily: FONTS.sans, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {loading && !data ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={T.ink3} />
          </View>
        ) : data && data.items.length > 0 ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 24,
              backgroundColor: "#FFFBF0",
              borderWidth: 1,
              borderColor: "rgba(31,26,21,0.08)",
              overflow: "hidden",
              ...shadowCard,
            }}
          >
            {data.items.map((item, idx) => {
              const unitPrice = item.units > 0 ? item.totalCost / item.units : 0;
              return (
                <View
                  key={item.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                    borderTopWidth: idx > 0 ? 0.5 : 0,
                    borderTopColor: T.rule,
                  }}
                >
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      backgroundColor: style.iconBg,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: T.ink, fontFamily: FONTS.serifItalic, fontSize: 16 }}>
                      {idx + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ color: T.ink, fontFamily: FONTS.sansSemiBold, fontSize: 15 }}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 12, marginTop: 2 }}>
                      {Math.round(item.units)} units · {item.timesOrdered} orders
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 18 }}>
                      ₹{formatRupeesBig(item.totalCost)}
                    </Text>
                    {unitPrice > 0 && (
                      <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 12, marginTop: 2 }}>
                        {Math.round(unitPrice)}/unit
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: 12, padding: 24, borderRadius: 24, backgroundColor: "#FFFBF0", alignItems: "center" }}>
            <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13, textAlign: "center" }}>
              {error ? "Could not load items." : "No items found in this category for the selected month."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
