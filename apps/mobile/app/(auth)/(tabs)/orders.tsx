import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { CATEGORY_STYLES } from "@/lib/groceryCategoryStyles";
import { T, FONTS, shadowCard } from "@/lib/theme";

const PLATFORM_CONFIG: Record<string, { bg: string; fg: string; glyph: string; label: string }> = {
  zepto: { bg: "#4B1B8C", fg: "#F5E9C0", glyph: "Z", label: "Zepto" },
  blinkit: { bg: "#F4D00A", fg: "#1A1A1A", glyph: "B", label: "Blinkit" },
  swiggy_instamart: { bg: "#FF5A2D", fg: "#FFF5E0", glyph: "S", label: "Swiggy Instamart" },
  other: { bg: T.ink2, fg: T.paper, glyph: "•", label: "Other" },
};

type OrderCard = {
  id: string;
  platform: string;
  orderedAt: string;
  total: number;
  itemCount: number;
  preview: string;
  categories: string[];
};

type OrdersSection = { label: string; total: number; orders: OrderCard[] };

type OrdersResponse = {
  month: string;
  bills: number;
  total: number;
  sections: OrdersSection[];
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  totalAmount: number;
  category: string;
};

type OrderDetail = {
  id: string;
  platform: string;
  invoiceNo: string;
  orderNo: string | null;
  orderedAt: string;
  itemTotal: number;
  handlingFee: number;
  deliveryFee: number;
  taxes: number;
  discounts: number;
  total: number;
  items: OrderItem[];
};

type PlatformKey = "all" | "zepto" | "blinkit" | "swiggy_instamart";

const PLATFORM_FILTERS: { key: PlatformKey; label: string }[] = [
  { key: "all", label: "All platforms" },
  { key: "zepto", label: "Zepto" },
  { key: "blinkit", label: "Blinkit" },
  { key: "swiggy_instamart", label: "Swiggy Instamart" },
];

function platformConfig(platform: string) {
  return PLATFORM_CONFIG[platform.toLowerCase().replace(/\s+/g, "_")] ?? PLATFORM_CONFIG.other;
}

function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatRupeesBig(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

function formatOrderedAt(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString("en-IN", { month: "short" });
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${day} ${month} · ${h12}:${mins} ${suffix}`;
}

function categoryStyle(id: string) {
  return CATEGORY_STYLES[id] ?? CATEGORY_STYLES.other;
}

function monthFromIso(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { month: "long" }).toUpperCase();
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function CategoryStrip({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
      {categories.map((id) => (
        <View
          key={id}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            backgroundColor: categoryStyle(id).color,
          }}
        />
      ))}
    </View>
  );
}

function PlatformChip({ platform }: { platform: string }) {
  const cfg = platformConfig(platform);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 4,
        paddingRight: 12,
        paddingVertical: 4,
        backgroundColor: T.paper,
        borderRadius: 999,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          backgroundColor: cfg.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: cfg.fg, fontFamily: FONTS.sansSemiBold, fontSize: 12 }}>{cfg.glyph}</Text>
      </View>
      <Text style={{ color: T.ink, fontFamily: FONTS.sansMedium, fontSize: 14 }}>{cfg.label}</Text>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: OrderCard; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: "#FFFBF0",
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(31,26,21,0.12)",
        opacity: pressed ? 0.92 : 1,
        shadowColor: "#1F1A15",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 }}>
          <PlatformChip platform={order.platform} />
          <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13 }}>
            {formatOrderedAt(order.orderedAt)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 26, lineHeight: 30 }}>
            ₹{formatRupeesBig(order.total)}
          </Text>
          <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13, marginTop: 4 }}>
            {order.itemCount} items
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: T.ink,
          fontFamily: FONTS.sans,
          fontSize: 16,
          marginTop: 14,
        }}
      >
        {order.preview}
      </Text>
      <CategoryStrip categories={order.categories} />
    </Pressable>
  );
}

function FilterChips({
  active,
  onChange,
}: {
  active: PlatformKey;
  onChange: (next: PlatformKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      style={{ marginTop: 18, marginBottom: 20, flexGrow: 0 }}
    >
      {PLATFORM_FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: isActive ? T.ink : T.paper2,
            }}
          >
            <Text
              style={{
                color: isActive ? T.paper : T.ink,
                fontFamily: FONTS.sansMedium,
                fontSize: 14,
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function OrderDetailSheet({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!orderId || !accessToken) return;
      let cancelled = false;
      setLoading(true);
      setDetail(null);
      authFetch(`/api/orders/${orderId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: OrderDetail) => {
          if (!cancelled) setDetail(data);
        })
        .catch(() => {
          if (!cancelled) setDetail(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [orderId, accessToken]),
  );

  return (
    <Modal
      visible={orderId !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(31,26,21,0.35)" }}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: T.paper,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 10,
          paddingHorizontal: 22,
          paddingBottom: 36,
          maxHeight: "86%",
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: "rgba(31,26,21,0.18)",
            marginBottom: 18,
          }}
        />

        {loading || !detail ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={T.ink3} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <PlatformChip platform={detail.platform} />
              <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 13 }}>
                {formatOrderedAt(detail.orderedAt)}
              </Text>
            </View>

            <Text
              style={{
                color: T.ink,
                fontFamily: FONTS.serifBold,
                fontSize: 60,
                lineHeight: 68,
                marginTop: 14,
              }}
            >
              ₹{formatRupeesBig(detail.total)}
            </Text>
            <Text style={{ color: T.ink3, fontFamily: FONTS.sans, fontSize: 14, marginTop: 2 }}>
              {detail.items.length} items delivered
            </Text>

            <View style={{ height: 1, backgroundColor: T.rule, marginVertical: 22 }} />

            <Text
              style={{
                color: T.ink,
                fontFamily: FONTS.serifBoldItalic,
                fontSize: 20,
                marginBottom: 14,
              }}
            >
              Line items
            </Text>

            {detail.items.map((item) => {
              const style = categoryStyle(item.category);
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 10,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: style.color,
                      marginTop: 6,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.ink, fontFamily: FONTS.sansMedium, fontSize: 16 }}>
                      {item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}
                    </Text>
                    <Text
                      style={{
                        color: T.ink3,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                        letterSpacing: 1,
                        marginTop: 2,
                      }}
                    >
                      {style.label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 16 }}>
                    ₹{formatRupeesBig(item.totalAmount)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export default function OrdersScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [month] = useState(currentMonthString());
  const [platform, setPlatform] = useState<PlatformKey>("all");
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({ month });
      if (platform !== "all") query.set("platform", platform);
      const res = await authFetch(`/api/orders?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
      const body: OrdersResponse = await res.json();
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, month, platform]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleString("en-IN", { month: "long", timeZone: "UTC" })
      .toUpperCase();
  }, [month]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              color: T.ink3,
              fontFamily: FONTS.sansMedium,
              fontSize: 11,
              letterSpacing: 1.4,
            }}
          >
            ALL DELIVERIES · {monthLabel}
          </Text>
          <Text
            style={{
              color: T.ink,
              fontFamily: FONTS.serifBoldItalic,
              fontSize: 48,
              lineHeight: 54,
              marginTop: 10,
            }}
          >
            Orders
          </Text>
          <Text
            style={{
              color: T.ink2,
              fontFamily: FONTS.serifItalic,
              fontSize: 21,
              marginTop: 8,
            }}
          >
            {data ? `${data.bills} bills · ${formatRupees(data.total)}` : " "}
          </Text>
        </View>

        <FilterChips active={platform} onChange={setPlatform} />

        {loading && !data ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={T.ink3} />
          </View>
        ) : error ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.terracotta, fontFamily: FONTS.sans }}>{error}</Text>
          </View>
        ) : data && data.sections.length === 0 ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 40 }}>
            <Text
              style={{
                color: T.ink3,
                fontFamily: FONTS.serifItalic,
                fontSize: 16,
                textAlign: "center",
              }}
            >
              No deliveries yet for this month.{"\n"}Upload an invoice to start your ledger.
            </Text>
          </View>
        ) : (
          data?.sections.map((section) => (
            <View key={section.label} style={{ paddingHorizontal: 20, marginTop: 6, marginBottom: 4 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 21 }}>
                  {section.label}
                </Text>
                <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 14 }}>
                  {formatRupees(section.total)}
                </Text>
              </View>
              {section.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => setSelectedOrderId(order.id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <OrderDetailSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </SafeAreaView>
  );
}
