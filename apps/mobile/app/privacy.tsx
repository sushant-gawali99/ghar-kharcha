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

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", paddingVertical: 8, paddingRight: 16 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 15, color: T.terracotta }}>Back</Text>
        </Pressable>

        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 42, color: T.ink, marginTop: 12, lineHeight: 46 }}>
          Privacy
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: T.ink3, marginTop: 8 }}>
          Last updated: May 3, 2026
        </Text>

        <Section title="Data we collect">
          We collect your Google account name, email, avatar, uploaded grocery invoice PDFs, parsed order details, item names,
          prices, taxes, categories, household members, invite codes, and app usage needed to run the service.
        </Section>

        <Section title="Why we use it">
          We use this data to sign you in, parse invoices, build your grocery ledger, show household analytics, prevent duplicate
          invoices, protect the service, and respond to support or legal requests.
        </Section>

        <Section title="AI processing">
          Invoice text and, when text extraction fails, the invoice PDF may be sent to Anthropic Claude to extract structured
          grocery data. We do not send your app password because we do not have one, and we do not send Google access tokens.
        </Section>

        <Section title="Age">
          The app is intended for adults. Do not use Ghar Kharcha if you are under 18 unless a parent or guardian manages the
          account and consents to the data processing.
        </Section>

        <Section title="Sharing">
          We use service providers such as Google for sign-in, Anthropic for invoice parsing, hosting/database providers for
          storage, and app store providers for distribution. They process data to provide the service, not for our advertising.
        </Section>

        <Section title="Retention">
          We keep account and invoice data while your account is active. Deleting an order removes that order and its stored PDF.
          Deleting your account removes your account, refresh tokens, orders, items, uploads, and stored PDFs, except where law
          requires limited retention.
        </Section>

        <Section title="Your choices">
          You can delete individual orders, delete your account from Profile, sign out, or contact us to request access,
          correction, deletion, consent withdrawal, or grievance redressal.
        </Section>

        <Section title="Contact">
          Privacy and grievance contact: privacy@gharkharcha.app
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
