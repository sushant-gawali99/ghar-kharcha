import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const QUICK_ACTIONS = [
  { id: "upload", label: "Upload Invoices", icon: "↑", accent: false },
  { id: "scan", label: "Quick Scan", icon: "◎", accent: true },
  { id: "manual", label: "Add Manual", icon: "≡", accent: false },
];

const TOP_CATEGORIES = [
  {
    id: "dairy",
    label: "Dairy",
    amount: "₹4,250",
    icon: "◉",
    iconBg: "#edf4ff",
    iconColor: "#2563eb",
  },
  {
    id: "snacks",
    label: "Snacks",
    amount: "₹2,840",
    icon: "✦",
    iconBg: "#fff1e8",
    iconColor: "#ea580c",
  },
  {
    id: "staples",
    label: "Staples",
    amount: "₹3,920",
    icon: "◌",
    iconBg: "#ecfdf3",
    iconColor: "#15803d",
  },
];

const RECENT_ORDERS = [
  {
    id: "1",
    title: "Quick Grocery Run",
    date: "Today, 2:45 PM",
    amount: "₹842",
    badge: "ZEPTO",
    badgeBg: "#4c1d95",
    badgeTextSize: "text-[10px]",
  },
  {
    id: "2",
    title: "Monthly Staples",
    date: "Yesterday, 10:20 AM",
    amount: "₹2,150",
    badge: "INSTA",
    badgeBg: "#f97316",
    badgeTextSize: "text-[10px]",
  },
  {
    id: "3",
    title: "Manual Entry",
    date: "12 Oct, 2023",
    amount: "₹120",
    badge: "⌂",
    badgeBg: "#56fe7c",
    badgeTextSize: "text-lg",
    badgeColor: "#006a28",
  },
];

function SectionTitle({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  return (
    <View className="flex-row items-end justify-between px-1">
      <Text className="text-[28px] font-extrabold tracking-tight text-[#2d2f31]">
        {title}
      </Text>
      <Pressable>
        <Text className="pb-1 text-[11px] font-bold uppercase tracking-[1.6px] text-[#006a28]">
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#f6f6f9]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-32"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between px-1 pb-3 pt-2">
          <View className="flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "#ffc2c6" }}
            >
              <Text className="text-base font-bold text-[#6e0020]">A</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#99a1ad]">
                Welcome Back
              </Text>
              <Text className="mt-0.5 text-[30px] font-extrabold tracking-tight text-[#006a28]">
                Hello, Arjun
              </Text>
            </View>
          </View>

          <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-white">
            <Text className="text-lg text-[#2d2f31]">•</Text>
          </Pressable>
        </View>

        <View
          className="mt-3 overflow-hidden rounded-[30px] px-6 py-6"
          style={{
            backgroundColor: "#006a28",
            shadowColor: "#2d2f31",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <View
            className="absolute -right-10 -top-10 h-36 w-36 rounded-full"
            style={{ backgroundColor: "rgba(86, 254, 124, 0.16)" }}
          />
          <View
            className="absolute right-10 top-16 h-20 w-20 rounded-full"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
          />

          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-sm font-medium text-[#d6ffe1]">
                This Month&apos;s Spending
              </Text>
              <View className="mt-2 flex-row items-end">
                <Text className="text-[50px] font-extrabold leading-none tracking-[-1.5px] text-white">
                  ₹14,580
                </Text>
                <Text className="mb-1 text-xl font-bold text-[#d6ffe1]">.00</Text>
              </View>
            </View>

            <View className="rounded-full bg-[rgba(255,255,255,0.16)] px-3 py-1.5">
              <Text className="text-xs font-bold text-white">↓ 8%</Text>
            </View>
          </View>

          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-[#d6ffe1]">
                Budget Progress
              </Text>
              <Text className="text-xs font-semibold text-[#d6ffe1]">
                72% of ₹20,000
              </Text>
            </View>

            <View className="h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.16)]">
              <View
                className="h-full rounded-full bg-[#56fe7c]"
                style={{ width: "72%" }}
              />
            </View>
          </View>
        </View>

        <View className="mt-6 flex-row justify-between px-3">
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              className="items-center"
              style={{ width: "30%" }}
            >
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: action.accent ? "#56fe7c" : "#ffffff",
                }}
              >
                <Text className="text-[24px] font-bold text-[#006a28]">
                  {action.icon}
                </Text>
              </View>
              <Text className="mt-3 text-center text-[11px] font-bold uppercase tracking-[1.2px] text-[#8c919a]">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-7">
          <SectionTitle title="Top Categories" action="View All" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 pt-4 pb-1"
          >
            {TOP_CATEGORIES.map((category) => (
              <View
                key={category.id}
                className="w-[138px] rounded-[28px] bg-white px-5 py-6"
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: category.iconBg }}
                >
                  <Text
                    className="text-lg font-bold"
                    style={{ color: category.iconColor }}
                  >
                    {category.icon}
                  </Text>
                </View>
                <Text className="mt-5 text-[11px] font-bold uppercase tracking-[1.8px] text-[#8c919a]">
                  {category.label}
                </Text>
                <Text className="mt-2 text-[28px] font-extrabold tracking-tight text-[#2d2f31]">
                  {category.amount}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View
          className="mt-7 flex-row items-center gap-4 overflow-hidden rounded-[28px] px-5 py-5"
          style={{ backgroundColor: "#fde991" }}
        >
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "#fdd400" }}
          >
            <Text className="text-lg font-bold text-[#433700]">!</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#857100]">
              Smart Insight
            </Text>
            <Text className="mt-1 text-[14px] leading-5 text-[#2d2f31]">
              You saved{" "}
              <Text className="font-extrabold text-[#006a28]">₹1,240</Text> on
              Dairy this month by choosing bundle deals on Instamart.
            </Text>
          </View>
        </View>

        <View className="mt-7">
          <SectionTitle title="Recent Orders" action="History" />
          <View className="gap-3 pt-4">
            {RECENT_ORDERS.map((order) => (
              <Pressable
                key={order.id}
                className="flex-row items-center justify-between rounded-[24px] bg-white px-4 py-4 active:opacity-80"
              >
                <View className="flex-row items-center gap-4">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: order.badgeBg }}
                  >
                    <Text
                      className={`${order.badgeTextSize} font-extrabold text-white`}
                      style={{ color: order.badgeColor ?? "#ffffff" }}
                    >
                      {order.badge}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-[16px] font-bold text-[#2d2f31]">
                      {order.title}
                    </Text>
                    <Text className="mt-1 text-xs text-[#8c919a]">
                      {order.date}
                    </Text>
                  </View>
                </View>
                <Text className="text-[24px] font-extrabold tracking-tight text-[#2d2f31]">
                  {order.amount}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
