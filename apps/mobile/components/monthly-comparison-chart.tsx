import { Text, View } from "react-native";
import type { MonthlyComparisonPoint } from "@ghar-kharcha/shared-types";

function formatRupeesShort(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function MonthlyComparisonChart({
  title,
  subtitle,
  accentColor = "#006a28",
  points,
}: {
  title: string;
  subtitle: string;
  accentColor?: string;
  points: MonthlyComparisonPoint[];
}) {
  const max = Math.max(...points.map((point) => point.total), 0);

  return (
    <View className="rounded-[28px] bg-white px-5 py-5">
      <Text className="text-[18px] font-extrabold tracking-tight text-[#2d2f31]">
        {title}
      </Text>
      <Text className="mt-1 text-sm font-medium text-[#8c919a]">{subtitle}</Text>

      <View className="mt-6 flex-row items-end justify-between gap-3">
        {points.map((point) => {
          const height =
            max > 0 ? Math.max(22, Math.round((point.total / max) * 120)) : 22;

          return (
            <View key={point.monthKey} className="flex-1 items-center">
              <Text
                className="mb-2 text-[10px] font-bold tracking-tight text-[#5b616a]"
                numberOfLines={1}
              >
                {formatRupeesShort(point.total)}
              </Text>
              <View className="h-[126px] w-full items-center justify-end">
                <View
                  className="w-full rounded-t-[16px]"
                  style={{
                    height,
                    backgroundColor: accentColor,
                    opacity: point.total > 0 ? 1 : 0.18,
                  }}
                />
              </View>
              <Text className="mt-3 text-[11px] font-bold uppercase tracking-[1px] text-[#8c919a]">
                {point.monthShortLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
