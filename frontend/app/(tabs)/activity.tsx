import { verifiedPayment } from "@/src/payments";
import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useSession } from "@/src/session";
import { requireAuth } from "@/src/auth-gate";
import { c } from "@/src/theme";
import { Button, Card, EmptyState, Badge } from "@/src/components/ui";
import { SkeletonCards, ErrorBanner } from "@/src/components/states";
import { dateLabel, money } from "@/src/sports";
export default function Activity() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      api.myBookings(),
      api.myOrders(),
      api.aiCoach.listMatches(),
      api.myRegistrations(),
    ]);
    const labels = ["Booking", "Order", "Match report", "Tournament"];
    setItems(
      results
        .flatMap((r, i) =>
          r.status === "fulfilled" && Array.isArray(r.value)
            ? r.value.map((item) => ({ ...item, kind: labels[i] }))
            : [],
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    );
    if (results.some((r) => r.status === "rejected"))
      setError("Some activity couldn’t load. Please try again.");
    setLoading(false);
  }, [user?.id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          maxWidth: 1000,
          width: "100%",
          alignSelf: "center",
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: "900", color: c.text }}
        >
          Your game, in motion.
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 15 }}>
          Bookings, orders and coaching reports, together.
        </Text>
        <ErrorBanner error={error} retry={load} />
        {sessionLoading || loading ? (
          <SkeletonCards />
        ) : !user ? (
          <EmptyState
            title="Your next chapter starts here"
            subtitle="Sign in to see your activity."
            cta="Sign in"
            onCta={() => requireAuth(user, router, "/(tabs)/activity")}
          />
        ) : !items.length && !error ? (
          <EmptyState
            title="Ready to Play?"
            subtitle="Book a court or find a game to get started."
            cta="Explore"
            onCta={() => router.push("/(tabs)/discover")}
          />
        ) : (
          items.map((item) => (
            <Card key={`${item.kind}-${item.id}`}>
              <View style={{ gap: 10 }}>
                <Badge
                  label={
                    item.status ||
                    item.job?.status ||
                    (item.report ? "Report ready" : "Awaiting analysis")
                  }
                />
                <Text
                  style={{ color: c.text, fontSize: 19, fontWeight: "800" }}
                >
                  {item.kind} ·{" "}
                  {item.facility?.name ||
                    item.sport ||
                    String(item.id).slice(0, 8)}
                </Text>
                <Text style={{ color: c.textSecondary }}>
                  {dateLabel(item.date || item.created_at)}
                </Text>
                {item.payment?.status && (
                  <Text style={{ color: c.textSecondary }}>
                    Payment: {item.payment.status} ·{" "}
                    {money(item.payment.amount)}
                  </Text>
                )}
                {(item.payment?.id || item.payment?.payment_id) && (
                  <Button
                    label="Refresh payment status"
                    variant="secondary"
                    onPress={async () => {
                      try {
                        await verifiedPayment(
                          item.payment.payment_id || item.payment.id,
                        );
                        await load();
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  />
                )}
                <Button
                  label="Help with this booking / payment"
                  variant="secondary"
                  onPress={() => router.push("/support" as any)}
                />
                {item.kind === "Match report" && item.report && (
                  <Button
                    label="View report"
                    onPress={() => router.push(`/ai-coach/report/${item.id}`)}
                  />
                )}
                {item.kind === "Booking" && item.facility_id && (
                  <Button
                    label="View venue"
                    variant="secondary"
                    onPress={() => router.push(`/facility/${item.facility_id}`)}
                  />
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
