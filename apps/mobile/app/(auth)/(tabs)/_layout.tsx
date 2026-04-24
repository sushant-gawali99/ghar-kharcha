import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { T, FONTS } from "@/lib/theme";

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

const TAB_META: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap | "fab" }
> = {
  home: { label: "HOME", icon: "home" },
  insights: { label: "INSIGHTS", icon: "bar-chart-2" },
  upload: { label: "", icon: "fab" },
  orders: { label: "ORDERS", icon: "file-text" },
  profile: { label: "PROFILE", icon: "user" },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeColor = T.haldi;
  const inactiveColor = "rgba(243,234,219,0.5)";

  return (
    <View
      style={{
        position: "absolute",
        left: 18,
        right: 18,
        bottom: insets.bottom + 16,
        height: 78,
        borderRadius: 36,
        backgroundColor: T.ink,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        shadowColor: T.ink,
        shadowOpacity: 0.28,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 20 },
        elevation: 16,
      }}
    >
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        if (meta.icon === "fab") {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  backgroundColor: T.terracotta,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isFocused ? 2 : 0,
                  borderColor: "rgba(251,245,232,0.85)",
                  shadowColor: T.terracotta,
                  shadowOpacity: 0.55,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 12,
                }}
              >
                <View
                  style={{
                    width: 16, height: 1.8, backgroundColor: "#FBF5E8",
                    borderRadius: 2, position: "absolute",
                  }}
                />
                <View
                  style={{
                    width: 1.8, height: 16, backgroundColor: "#FBF5E8",
                    borderRadius: 2, position: "absolute",
                  }}
                />
              </View>
            </Pressable>
          );
        }

        const color = isFocused ? activeColor : inactiveColor;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <TabIcon name={meta.icon} color={color} />
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 9.5,
                letterSpacing: 0.5,
                color,
                marginTop: 4,
              }}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="upload" options={{ title: "" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
