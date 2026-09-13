import { useEffect, useState } from "react";
import { View, Text, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, clearToken } from "@/src/api";
import { useSession } from "@/src/session";
import { requireAuth } from "@/src/auth-gate";
import { signOutAuth } from "@/src/auth-provider";
import { Button } from "@/src/components/ui";
import { ErrorBanner } from "@/src/components/states";
import { WorkspaceEditor, DataRows } from "@/src/components/workspace";
import { policies } from "@/src/policies";
import { c } from "@/src/theme";
export default function Support() {
  const router = useRouter();
  const { user } = useSession();
  const [tickets, setTickets] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [error, setError] = useState<unknown>();
  const [editor, setEditor] = useState<any>();
  const [notice, setNotice] = useState("");
  async function load() {
    if (!user) return;
    try {
      const [ts, bs, bl] = await Promise.all([
        api.supportTickets(),
        api.supportResources(),
        api.blockedUsers(),
      ]);
      setTickets(ts);
      setBookings(bs);
      setBlocked(bl);
    } catch (e) {
      setError(e);
    }
  }
  useEffect(() => {
    load();
  }, [user?.id]);
  function ticket(cancellation: boolean, authenticated = false) {
    if (
      !authenticated &&
      !requireAuth(user, router, undefined, () =>
        router.replace("/support" as any),
      )
    )
      return;
    setEditor({
      title: cancellation ? "Cancellation inquiry" : "Contact support",
      fields: [
        { key: "email", label: "Reply email", required: true },
        ...(cancellation
          ? [
              {
                key: "resource",
                label: "Booking or registration",
                required: true,
                options: bookings.map((b) => ({
                  value: `${b.resource_type}:${b.id}`,
                  label: b.label,
                })),
              },
            ]
          : []),
        {
          key: "message",
          label: "How can we help?",
          multiline: true,
          required: true,
        },
      ],
      save: async (v: any) => {
        const [resource_type, resource_id] = (v.resource || "").split(":");
        const result = await api.createTicket({
          email: v.email,
          message: v.message,
          category: cancellation ? "cancellation" : "general",
          resource_type,
          resource_id,
        });
        setNotice(
          `Ticket ${result.id} created. Email delivery is queued; your booking is unchanged.`,
        );
        await load();
      },
    });
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          maxWidth: 900,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
        <Text style={{ fontSize: 28, color: c.text, fontWeight: "800" }}>
          Help & Privacy
        </Text>
        <ErrorBanner error={error} retry={load} />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>
            {notice}
          </Text>
        ) : null}
        <Text style={{ color: c.text, lineHeight: 23 }}>
          Cancellation inquiries must arrive at least 4 hours before the start.
          A ticket does not automatically cancel or refund your booking.
        </Text>
        <Button label="Cancellation inquiry" onPress={() => ticket(true)} />
        <Button
          label="Create help ticket"
          variant="secondary"
          onPress={() => ticket(false)}
        />
        <Button
          label="Email contact@kuvirasports.com"
          variant="secondary"
          onPress={() =>
            Linking.openURL("mailto:contact@kuvirasports.com").catch(setError)
          }
        />
        {Object.entries(policies).map(([kind, p]) => (
          <Button
            key={kind}
            label={p.title}
            variant="secondary"
            onPress={() => router.push(`/policies/${kind}` as any)}
          />
        ))}
        {user && (
          <>
            <DataRows
              rows={tickets}
              columns={[
                { key: "id", label: "Ticket reference" },
                { key: "category", label: "Topic" },
                { key: "status", label: "Status" },
                { key: "email_status", label: "Email delivery" },
                { key: "response", label: "Support response" },
              ]}
            />
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "800" }}>
              Blocked players
            </Text>
            <DataRows
              rows={blocked}
              columns={[{ key: "target_id", label: "Player reference" }]}
              actions={(b) => (
                <Button
                  label="Unblock"
                  variant="secondary"
                  onPress={() =>
                    api.unblockUser(b.target_id).then(load).catch(setError)
                  }
                />
              )}
            />
            <Button
              label="Delete account"
              variant="secondary"
              onPress={() =>
                setEditor({
                  title: "Delete account",
                  fields: [
                    {
                      key: "confirmation",
                      label:
                        "Type DELETE to disable access and request personal-data deletion",
                      required: true,
                    },
                  ],
                  save: async (v: any) => {
                    if (v.confirmation !== "DELETE")
                      throw new Error("Type DELETE to continue");
                    await api.deleteAccount();
                    await signOutAuth();
                    await clearToken();
                    router.replace("/policies/deletion" as any);
                  },
                })
              }
            />
          </>
        )}
      </ScrollView>
      {editor && (
        <WorkspaceEditor
          {...editor}
          context="MatchDrome · contact@kuvirasports.com"
          close={() => setEditor(undefined)}
        />
      )}
    </SafeAreaView>
  );
}
