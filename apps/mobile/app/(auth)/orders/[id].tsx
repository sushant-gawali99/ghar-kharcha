import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-white items-center justify-center">
      <Text className="text-xl font-semibold text-gray-900">Order {id}</Text>
    </View>
  );
}
