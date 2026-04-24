import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { T, FONTS, shadowCard, shadowHero } from "@/lib/theme";

type HouseholdMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type PendingInvite = {
  id: string;
  code: string;
  expiresAt: string;
  inviterId: string;
  createdAt: string;
};

type HouseholdResponse = {
  id: string;
  members: HouseholdMember[];
  pendingInvites: PendingInvite[];
};

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

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

function InviteSheet({
  visible,
  onClose,
  onRequestInvite,
  activeInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onRequestInvite: () => Promise<PendingInvite | null>;
  activeInvite: PendingInvite | null;
}) {
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<PendingInvite | null>(activeInvite);

  useFocusEffect(
    useCallback(() => {
      setInvite(activeInvite);
    }, [activeInvite, visible]),
  );

  const createInvite = async () => {
    setCreating(true);
    const created = await onRequestInvite();
    if (created) setInvite(created);
    setCreating(false);
  };

  const shareInvite = async () => {
    if (!invite) return;
    try {
      await Share.share({
        message: `Join my Ghar Kharcha household. Use code ${invite.code} (expires in ${daysUntil(invite.expiresAt)} days).`,
      });
    } catch {
      // user cancelled or share sheet unavailable — silent
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(31,26,21,0.35)" }} />
      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          backgroundColor: T.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingHorizontal: 22, paddingBottom: 40,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(31,26,21,0.18)", marginBottom: 20 }} />
        <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4 }}>
          INVITE TO YOUR GHAR
        </Text>
        <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 28, marginTop: 6, lineHeight: 34 }}>
          Send them a code
        </Text>

        {invite ? (
          <>
            <Text style={{ color: T.ink2, fontFamily: FONTS.sans, fontSize: 14, marginTop: 8 }}>
              Share this code. They enter it in "Join a household" and your ledgers merge.
            </Text>
            <View
              style={{
                marginTop: 22, paddingVertical: 24,
                borderRadius: 20, backgroundColor: T.card,
                borderWidth: 1, borderColor: "rgba(31,26,21,0.1)",
                alignItems: "center",
              }}
            >
              <Text style={{ color: T.ink, fontFamily: FONTS.serifBold, fontSize: 40, letterSpacing: 6 }}>
                {invite.code}
              </Text>
              <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 12, marginTop: 10, letterSpacing: 0.8 }}>
                EXPIRES IN {daysUntil(invite.expiresAt)} {daysUntil(invite.expiresAt) === 1 ? "DAY" : "DAYS"}
              </Text>
            </View>
            <Pressable
              onPress={shareInvite}
              style={{
                marginTop: 18, paddingVertical: 16, borderRadius: 18,
                backgroundColor: T.ink, alignItems: "center",
              }}
            >
              <Text style={{ color: T.haldi, fontFamily: FONTS.sansSemiBold, fontSize: 15 }}>Share invite →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: T.ink2, fontFamily: FONTS.sans, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
              Generate a one-time code. They enter it in "Join a household" and both your ledgers merge.
            </Text>
            <Pressable
              onPress={createInvite}
              disabled={creating}
              style={{
                marginTop: 22, paddingVertical: 16, borderRadius: 18,
                backgroundColor: T.ink, alignItems: "center", opacity: creating ? 0.6 : 1,
              }}
            >
              <Text style={{ color: T.haldi, fontFamily: FONTS.sansSemiBold, fontSize: 15 }}>
                {creating ? "Generating…" : "Generate invite code"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

function JoinSheet({
  visible,
  onClose,
  onJoin,
}: {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDraft("");
    }, [visible]),
  );

  const submit = async () => {
    const code = draft.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert("Invalid code", "Enter the 6-character code.");
      return;
    }
    setBusy(true);
    try {
      await onJoin(code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(31,26,21,0.35)" }} />
      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          backgroundColor: T.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingHorizontal: 22, paddingBottom: 40,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(31,26,21,0.18)", marginBottom: 20 }} />
        <Text style={{ color: T.ink3, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4 }}>
          JOIN A HOUSEHOLD
        </Text>
        <Text style={{ color: T.ink, fontFamily: FONTS.serifBoldItalic, fontSize: 28, marginTop: 6, lineHeight: 34 }}>
          Got a code?
        </Text>
        <Text style={{ color: T.ink2, fontFamily: FONTS.sans, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
          Paste the 6-character invite they shared. Your orders join their ledger from now on.
        </Text>

        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          placeholderTextColor="rgba(31,26,21,0.25)"
          style={{
            marginTop: 22,
            borderRadius: 20, paddingVertical: 20, paddingHorizontal: 18,
            textAlign: "center",
            fontFamily: FONTS.serifBold, fontSize: 32, letterSpacing: 6,
            color: T.ink,
            backgroundColor: T.card,
            borderWidth: 1, borderColor: "rgba(31,26,21,0.1)",
          }}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={onClose}
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
            onPress={submit}
            disabled={busy}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 14,
              backgroundColor: T.ink,
              alignItems: "center", opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: T.haldi, fontFamily: FONTS.sansSemiBold, fontSize: 14 }}>
              {busy ? "Joining…" : "Join"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [household, setHousehold] = useState<HouseholdResponse | null>(null);
  const [stats, setStats] = useState<{
    totalInvoices: number;
    totalItems: number;
    monthSpend: number;
  } | null>(null);

  const loadHousehold = useCallback(async () => {
    const res = await authFetch("/api/household");
    if (!res.ok) return;
    const body: HouseholdResponse = await res.json();
    setHousehold(body);
  }, []);

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
      loadHousehold().catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [accessToken, loadHousehold]),
  );

  const requestInvite = async (): Promise<PendingInvite | null> => {
    try {
      const res = await authFetch("/api/household/invites", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: PendingInvite = await res.json();
      await loadHousehold();
      return body;
    } catch (err) {
      Alert.alert("Couldn't generate invite", err instanceof Error ? err.message : "Please try again.");
      return null;
    }
  };

  const joinHousehold = async (code: string) => {
    try {
      const res = await authFetch("/api/household/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setJoinOpen(false);
      await loadHousehold();
      Alert.alert("Joined", "Welcome to the household. Your orders now share one ledger.");
    } catch (err) {
      Alert.alert("Couldn't join", err instanceof Error ? err.message : "Please try again.");
    }
  };

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
          <SettingRow label="Pantry staples" detail="Coming soon" />
        </SettingsGroup>

        {/* ── Your household members ── */}
        {household && (
          <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
            <Text style={{
              fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1.4,
              textTransform: "uppercase", color: T.ink3, marginBottom: 10, paddingHorizontal: 4,
            }}>Your ghar · {household.members.length} {household.members.length === 1 ? "person" : "people"}</Text>
            <View style={[{ borderRadius: 18, backgroundColor: T.card, overflow: "hidden" }, shadowCard]}>
              {household.members.map((m, i) => {
                const isMe = m.id === user?.id;
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: i < household.members.length - 1 ? 0.5 : 0,
                      borderBottomColor: T.rule,
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 999,
                      backgroundColor: T.haldi,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>
                        {initialsOf(m.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink }} numberOfLines={1}>
                        {m.name}{isMe ? " (you)" : ""}
                      </Text>
                      <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink3, marginTop: 1 }} numberOfLines={1}>
                        {m.email}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 0.5, backgroundColor: T.rule }} />
              <SettingRow
                label="Invite someone"
                detail={household.pendingInvites[0] ? household.pendingInvites[0].code : undefined}
                onPress={() => setInviteOpen(true)}
              />
              <View style={{ height: 0.5, backgroundColor: T.rule }} />
              <SettingRow label="Join a household" onPress={() => setJoinOpen(true)} />
            </View>
          </View>
        )}

        {/* ── Sign out ── */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Pressable
            onPress={handleLogout}
            style={{
              alignItems: "center", paddingVertical: 20, borderRadius: 20,
              backgroundColor: T.terracotta,
              shadowColor: T.terracotta,
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.paper, letterSpacing: 0.3 }}>Sign out</Text>
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
      <InviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onRequestInvite={requestInvite}
        activeInvite={household?.pendingInvites[0] ?? null}
      />
      <JoinSheet
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoin={joinHousehold}
      />
    </SafeAreaView>
  );
}
