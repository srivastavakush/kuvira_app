import { ScrollView, Text, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { policies } from "@/src/policies";
import { Button } from "@/src/components/ui";
import { c } from "@/src/theme";
export default function Policy() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const policy = policies[kind] || policies.privacy;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 20,
          maxWidth: 800,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "800", color: c.text }}
        >
          {policy.title}
        </Text>
        <Text
          selectable
          style={{ fontSize: 16, lineHeight: 26, color: c.text }}
        >
          {policy.body}
        </Text>
        <Button
          label="Email support"
          onPress={() => Linking.openURL("mailto:contact@kuvirasports.com")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
