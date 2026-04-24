import { Tabs } from "expo-router";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/lib/theme";

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

function UploadFAB({ focused }: { focused: boolean }) {
  return (
    <View style={{
      width: 48, height: 48, borderRadius: 999,
      backgroundColor: T.terracotta,
      alignItems: "center", justifyContent: "center",
      borderWidth: focused ? 2 : 0,
      borderColor: "rgba(251,245,232,0.85)",
      shadowColor: T.terracotta,
      shadowOpacity: 0.55,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    }}>
      <View style={{
        width: 16, height: 1.8, backgroundColor: "#FBF5E8",
        borderRadius: 2, position: "absolute",
      }} />
      <View style={{
        width: 1.8, height: 16, backgroundColor: "#FBF5E8",
        borderRadius: 2, position: "absolute",
      }} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const activeColor = T.haldi;
  const inactiveColor = "rgba(243,234,219,0.5)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          start: 18,
          end: 18,
          bottom: insets.bottom + 16,
          height: 78,
          borderTopWidth: 0,
          borderRadius: 36,
          backgroundColor: T.ink,
          paddingTop: 14,
          paddingBottom: 14,
          shadowColor: T.ink,
          shadowOpacity: 0.28,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 20 },
          elevation: 16,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 9.5,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home" color={focused ? activeColor : inactiveColor} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-2" color={focused ? activeColor : inactiveColor} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => <UploadFAB focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused }) => <TabIcon name="file-text" color={focused ? activeColor : inactiveColor} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="user" color={focused ? activeColor : inactiveColor} />,
        }}
      />
    </Tabs>
  );
}
