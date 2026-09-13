import { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { c } from "@/src/theme";
import { Card, Button } from "./ui";
import { ErrorBanner, SkeletonCards } from "./states";
import { DataRows, WorkspaceEditor } from "./workspace";
export function AdminOverview({ section = "overview" }: { section?: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState<any>();
  const [refreshResult, setRefreshResult] = useState("");
  async function load() {
    setBusy(true);
    setError(null);
    try {
      setData(
        await (section === "users"
          ? api.adminUsers(query)
          : section === "finance"
            ? api.adminTransactions()
            : section === "system"
              ? api.adminSystemHealth()
              : section === "issues"
                ? api.adminIssues()
                : section === "audit"
                  ? api.adminAudit()
                  : api.adminOverview()),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [section]);
  const titles: Record<string, string> = {
    overview: "The whole game, in view.",
    users: "Players & accounts",
    finance: "Payment transactions",
    system: "System health",
    issues: "Venue issues",
    audit: "Platform audit history",
  };
  return (
    <View style={{ gap: 20 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 28, fontWeight: "900", color: c.text }}
      >
        {titles[section]}
      </Text>
      <ErrorBanner error={error} retry={load} />
      {busy && !data ? <SkeletonCards /> : null}
      {section === "overview" && (
        <>
          <Text style={{ color: c.textSecondary }}>
            Live platform totals. Gateway receipts include verified successful
            payments.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(data?.counts || {}).map(([key, value]) => (
              <Card
                key={key}
                style={{ flexBasis: 200, flexGrow: 1, minHeight: 120 }}
              >
                <Text
                  style={{
                    color: c.textSecondary,
                    textTransform: "capitalize",
                  }}
                >
                  {key
                    .replace("organizations", "Clubs")
                    .replace("ai_coach_jobs", "AI analyses")}
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: c.text,
                    marginTop: 12,
                  }}
                >
                  {String(value)}
                </Text>
              </Card>
            ))}
          </View>
          <DataRows
            rows={data?.payments || []}
            columns={[
              { key: "_id", label: "Payment status" },
              { key: "count", label: "Transactions" },
              {
                key: "amount",
                label: "Value (₹)",
                render: (r) => Number(r.amount || 0).toLocaleString("en-IN"),
              },
            ]}
          />
          <Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>
            AI analysis queue
          </Text>
          <DataRows
            rows={data?.ai_jobs || []}
            columns={[
              { key: "_id", label: "Status" },
              { key: "count", label: "Analyses" },
            ]}
          />
        </>
      )}
      {section === "users" && (
        <>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TextInput
              accessibilityLabel="Search users"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={load}
              placeholder="Name or phone"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 14,
                backgroundColor: "white",
                borderWidth: 1,
                borderColor: "#CBD5E1",
                borderRadius: 12,
                color: c.text,
                fontSize: 16,
              }}
            />
            <Button
              label="Search"
              fullWidth={false}
              onPress={load}
              loading={busy}
            />
          </View>
          <Text style={{ color: c.textSecondary }}>
            Latest 100 matching accounts. Manage club roles from the club’s Team
            section.
          </Text>
          <DataRows
            rows={data || []}
            columns={[
              { key: "name", label: "Name" },
              { key: "mobile", label: "Phone" },
              { key: "city", label: "City" },
              {
                key: "is_platform_admin",
                label: "Access",
                render: (u) =>
                  u.is_platform_admin ? "Platform admin" : "Player",
              },
            ]}
            actions={(u) => (
              <>
                <Button
                  label="Profile"
                  fullWidth={false}
                  variant="secondary"
                  onPress={() => router.push(`/player/${u.id}`)}
                />
                {!u.is_platform_admin && (
                  <Button
                    label="Grant platform role"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => setGrant(u)}
                  />
                )}
              </>
            )}
          />
        </>
      )}
      {section === "finance" && (
        <>
          <Text style={{ color: c.textSecondary }}>
            Latest 100 transactions. Cancelling a booking does not issue a
            refund. Reconcile refunds through the payment provider.
          </Text>
          <DataRows
            rows={data || []}
            columns={[
              {
                key: "txnid",
                label: "Transaction",
                render: (t) => t.txnid || t.id,
              },
              { key: "amount", label: "Amount (₹)" },
              { key: "status", label: "Status" },
              { key: "created_at", label: "Created" },
            ]}
          />
        </>
      )}
      {section === "system" && (
        <Card>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>
            Service observations
          </Text>
          <Text style={{ color: c.textSecondary, marginTop: 12 }}>
            API: {data?.api || "Unavailable"}
          </Text>
          <Text style={{ color: c.textSecondary, marginTop: 12 }}>
            Database: {data?.database || "Unavailable"}
          </Text>
          <Text style={{ color: c.textSecondary, marginTop: 12 }}>
            Last worker heartbeat:{" "}
            {data?.worker_last_observation?.heartbeat_at || "None recorded"}
          </Text>
          <Text style={{ color: c.textSecondary, marginTop: 12 }}>
            An observed heartbeat is not a live worker health check.
          </Text>
          <Button
            label="Refresh coaching knowledge"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await api.aiCoach.seedKnowledge();
                setRefreshResult(JSON.stringify(result));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          />
          {refreshResult ? (
            <Text style={{ color: c.textSecondary }}>{refreshResult}</Text>
          ) : null}
        </Card>
      )}
      {section === "issues" && (
        <DataRows
          rows={data || []}
          columns={[
            { key: "org_id", label: "Club" },
            { key: "title", label: "Issue" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Reported" },
          ]}
          actions={(i) => (
            <Button
              label="Open club"
              fullWidth={false}
              variant="secondary"
              onPress={() => router.push(`/club/${i.org_id}`)}
            />
          )}
        />
      )}
      {section === "audit" && (
        <DataRows
          rows={data || []}
          columns={[
            { key: "org_id", label: "Club" },
            { key: "action", label: "Action" },
            { key: "actor_id", label: "Actor" },
            { key: "created_at", label: "Time" },
          ]}
        />
      )}
      {grant && (
        <WorkspaceEditor
          title="Grant platform administrator"
          context={grant.name || grant.mobile || grant.id}
          fields={[
            {
              key: "confirmation",
              label: "Type GRANT to give full platform access",
              required: true,
            },
          ]}
          save={async (v) => {
            if (v.confirmation !== "GRANT")
              throw new Error("Type GRANT to continue.");
            await api.adminGrantRole(grant.id);
            await load();
          }}
          close={() => setGrant(undefined)}
        />
      )}
      <Button
        label="Refresh"
        loading={busy}
        variant="secondary"
        onPress={load}
      />
    </View>
  );
}
