import { Tabs } from "expo-router";
import { Text, View } from "react-native";

function TabGlyph({
  focused,
  glyph,
}: {
  focused: boolean;
  glyph: string;
}) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: 28,
        height: 28,
        backgroundColor: focused ? "#56fe7c" : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: focused ? "800" : "700",
          color: focused ? "#006a28" : "#9ca3af",
        }}
      >
        {glyph}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 12,
          height: 74,
          borderTopWidth: 0,
          borderRadius: 28,
          backgroundColor: "#ffffff",
          paddingTop: 10,
          paddingBottom: 10,
          shadowColor: "#2d2f31",
          shadowOpacity: 0.08,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 10,
        },
        tabBarActiveTintColor: "#006a28",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginTop: 4,
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
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="⌂" />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Analytics",
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="⌁" />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="▤" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="⚙" />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
