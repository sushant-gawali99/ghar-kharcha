import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T, FONTS } from "@/lib/theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, letterSpacing: 1.2, color: T.ink3, textTransform: "uppercase" }}>
        {title}
      </Text>
      <Text style={{ fontFamily: FONTS.sans, fontSize: 15, color: T.ink2, lineHeight: 23, marginTop: 8 }}>
        {children}
      </Text>
    </View>
  );
}

export default function TermsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", paddingVertical: 8, paddingRight: 16 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 15, color: T.terracotta }}>Back</Text>
        </Pressable>

        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 42, color: T.ink, marginTop: 12, lineHeight: 46 }}>
          Terms
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: T.ink3, marginTop: 8 }}>
          Last updated: May 3, 2026
        </Text>

        <Section title="Use of the app">
          Ghar Kharcha helps you upload grocery invoices and view spending insights. You are responsible for uploading invoices
          you have the right to use and for keeping your device and Google account secure.
        </Section>

        <Section title="Age">
          You should be 18 or older to use the app. If a minor uses it, a parent or guardian must manage the account and consent
          to the processing of invoice and household data.
        </Section>

        <Section title="Accuracy">
          Invoice parsing can be imperfect. Check important amounts against your original bills before making financial decisions.
        </Section>

        <Section title="Households">
          Joining a household shares your ledger view with household members. Only share invite codes with people you trust.
        </Section>

        <Section title="Availability">
          We may change, suspend, or stop parts of the service, especially while the app is in early development.
        </Section>

        <Section title="Contact">
          Questions or complaints: privacy@gharkharcha.app
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
