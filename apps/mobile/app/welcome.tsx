import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Ghar Kharcha</Text>
      <Text className="text-base text-gray-500 text-center mb-10">
        Track your grocery spending from Zepto and Swiggy Instamart
      </Text>
      <Pressable
        className="w-full bg-indigo-600 rounded-2xl py-4 items-center"
        onPress={() => router.push("/sign-in")}
      >
        <Text className="text-white text-base font-semibold">Get Started</Text>
      </Pressable>
    </View>
  );
}
