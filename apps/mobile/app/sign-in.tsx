import { View, Text, Pressable } from "react-native";

export default function SignInScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900 mb-8">Sign In</Text>
      <Pressable className="w-full bg-white border border-gray-200 rounded-2xl py-4 items-center flex-row justify-center gap-3">
        <Text className="text-gray-700 text-base font-medium">
          Continue with Google
        </Text>
      </Pressable>
    </View>
  );
}
