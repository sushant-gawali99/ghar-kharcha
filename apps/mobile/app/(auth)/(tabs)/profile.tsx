import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard, shadowHero } from "@/lib/theme";

function SettingRow({ label, detail, onPress }: { label: string; detail?: string; onPress?: () => void }) {
  const inner = (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: T.ink }}>{label}</Text>
      {detail && <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3 }}>{detail}</Text>}
      <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink3, lineHeight: 20 }}>›</Text>
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

function BudgetModal({
  visible,
  initialValue,
  onCancel,
  onSave,
}: {
  visible: boolean;
  initialValue: number | null;
  onCancel: () => void;
  onSave: (value: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string>(initialValue !== null ? String(Math.round(initialValue)) : "");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDraft(initialValue !== null ? String(Math.round(initialValue)) : "");
    }, [initialValue, visible]),
  );

  const handleSave = async () => {
    const trimmed = draft.trim();
    let value: number | null = null;
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert("Invalid amount", "Enter a non-negative number.");
        return;
      }
      value = parsed;
    }
    try {
      setSaving(true);
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(31,26,21,0.35)" }} />
      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          backgroundColor: T.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingHorizontal: 22, paddingBottom: 40,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(31,26,21,0.18)", marginBottom: 20 }} />
        <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4 }}>
          MONTHLY BUDGET
        </Text>
        <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 30, marginTop: 6 }}>
          How much each month?
        </Text>
        <Text style={{ color: T.ink2, fontFamily: FONTS.sans, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
          We'll track your spend against this across the ghar. Leave empty to turn the bar off.
        </Text>

        <View
          style={{
            marginTop: 22,
            flexDirection: "row", alignItems: "center", gap: 10,
            borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
            backgroundColor: T.card,
            borderWidth: 1, borderColor: "rgba(31,26,21,0.1)",
          }}
        >
          <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 28 }}>₹</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="numeric"
            placeholder="12,000"
            placeholderTextColor="rgba(31,26,21,0.25)"
            style={{ flex: 1, color: T.ink, fontFamily: FONTS.serifBold, fontSize: 28, padding: 0 }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 14,
              backgroundColor: "transparent",
              borderWidth: 1, borderColor: "rgba(31,26,21,0.15)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: T.ink2, fontFamily: FONTS.sansMedium, fontSize: 14 }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 14,
              backgroundColor: T.ink,
              alignItems: "center",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: T.haldi, fontFamily: FONTS.sansSemiBold, fontSize: 14 }}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  return (
    <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
      <Text style={{
        fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4,
        textTransform: "uppercase", color: T.ink3, marginBottom: 10, paddingHorizontal: 4,
      }}>{title}</Text>
      <View style={[{ borderRadius: 18, backgroundColor: T.card, overflow: "hidden" }, shadowCard]}>
        {rows.map((child, i) => (
          <View key={i} style={{ borderBottomWidth: i < rows.length - 1 ? 0.5 : 0, borderBottomColor: T.rule }}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [stats, setStats] = useState<{
    totalInvoices: number;
    totalItems: number;
    monthSpend: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      let cancelled = false;
      authFetch("/api/me")
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data: {
          monthlyBudget: number | null;
          stats?: { totalInvoices: number; totalItems: number; monthSpend: number };
        }) => {
          if (cancelled) return;
          setMonthlyBudget(data.monthlyBudget);
          if (data.stats) setStats(data.stats);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [accessToken]),
  );

  const saveBudget = async (value: number | null) => {
    try {
      const res = await authFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: { monthlyBudget: number | null } = await res.json();
      setMonthlyBudget(body.monthlyBudget);
      setBudgetModalOpen(false);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await clearSession();
      router.replace("/sign-in");
    } catch (err) {
      Alert.alert("Logout failed", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";
  const initial = firstName ? firstName.charAt(0).toUpperCase() : "?";
  const budgetLabel =
    monthlyBudget !== null ? `₹${Math.round(monthlyBudget).toLocaleString("en-IN")}` : "Not set";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: T.ink3 }}>
            You · ghar
          </Text>
          <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 40, color: T.ink, marginTop: 6, letterSpacing: -1, lineHeight: 44 }}>
            Profile
          </Text>
        </View>

        {/* ── Household card ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
          <View style={[{
            borderRadius: 22, padding: 20, backgroundColor: T.ink, overflow: "hidden",
          }, shadowHero]}>
            {/* decorative glow */}
            <View style={{
              position: "absolute", top: -40, right: -40,
              width: 160, height: 160, borderRadius: 999,
              backgroundColor: "rgba(200,92,60,0.3)",
            }} />

            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              {/* initials tile */}
              <View style={{
                width: 56, height: 56, borderRadius: 14,
                backgroundColor: T.haldi,
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink }}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {user?.name && (
                  <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: T.paper, letterSpacing: -0.3 }}>
                    {user.name}
                  </Text>
                )}
                {user?.email && (
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: "rgba(243,234,219,0.6)", marginTop: 3 }} numberOfLines={1}>
                    {user.email}
                  </Text>
                )}
              </View>
            </View>

            {/* divider */}
            <View style={{ height: 0.5, backgroundColor: "rgba(243,234,219,0.15)", marginVertical: 16 }} />

            {/* stats */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                {
                  n: stats ? String(stats.totalInvoices) : "—",
                  l: "Invoices",
                },
                {
                  n: stats ? String(stats.totalItems) : "—",
                  l: "Items tracked",
                },
                {
                  n: stats
                    ? `₹${Math.round(stats.monthSpend).toLocaleString("en-IN")}`
                    : "—",
                  l: "This month",
                },
              ].map((s) => (
                <View key={s.l}>
                  <Text style={{ fontFamily: FONTS.serif, fontSize: 20, color: T.paper }}>{s.n}</Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 10, color: "rgba(243,234,219,0.55)", marginTop: 2, letterSpacing: 0.4, textTransform: "uppercase" }}>
                    {s.l}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Settings groups ── */}
        <SettingsGroup title="Household · घर">
          <SettingRow label="Monthly budget" detail={budgetLabel} onPress={() => setBudgetModalOpen(true)} />
          <SettingRow label="People in your ghar" detail="1" />
          <SettingRow label="Pantry staples" detail="Coming soon" />
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingRow label="Currency format" detail="en-IN (₹)" />
          <SettingRow label="Language" detail="English + Hindi" />
          <SettingRow label="Notifications" detail="Off" />
        </SettingsGroup>

        <SettingsGroup title="Data">
          <SettingRow label="Export CSV" />
          <SettingRow label="Privacy" />
        </SettingsGroup>

        {/* ── Sign out ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [{
              alignItems: "center", paddingVertical: 14, borderRadius: 14,
              backgroundColor: "rgba(200,92,60,0.1)",
              borderWidth: 0.5, borderColor: "rgba(200,92,60,0.2)",
              opacity: pressed ? 0.75 : 1,
            }]}
          >
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.terracotta }}>Sign out</Text>
          </Pressable>
          <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 12, color: T.ink3, textAlign: "center", marginTop: 18 }}>
            Ghar Kharcha · made with ghee
          </Text>
        </View>
      </ScrollView>
      <BudgetModal
        visible={budgetModalOpen}
        initialValue={monthlyBudget}
        onCancel={() => setBudgetModalOpen(false)}
        onSave={saveBudget}
      />
    </SafeAreaView>
  );
}
