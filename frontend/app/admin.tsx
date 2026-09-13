import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSession } from "@/src/session";
import { api } from "@/src/api";
import { Button, Loader } from "@/src/components/ui";
import { ErrorBanner } from "@/src/components/states";
import {
  WorkspaceHeading,
  WorkspaceNav,
  WorkspaceEditor,
  DataRows,
  Field,
  workspaceStyles,
} from "@/src/components/workspace";
import { AdminOverview } from "@/src/components/admin-overview";
import { c } from "@/src/theme";
const sports = [
  "badminton",
  "cricket",
  "football",
  "tennis",
  "pickleball",
  "padel",
  "basketball",
  "other",
].map((s) => ({ value: `sport-${s}`, label: s }));
const name: Field = { key: "name", label: "Name", required: true };
const image: Field = { key: "image", label: "Image URL", image: true };
const description: Field = {
  key: "description",
  label: "Description",
  multiline: true,
};
const sport: Field = {
  key: "sport",
  label: "Sport",
  required: true,
  options: sports,
};
const status: Field = {
  key: "status",
  label: "Publish state",
  required: true,
  options: ["draft", "published", "cancelled"].map((value) => ({
    value,
    label: value,
  })),
};
const fields: Record<string, Field[]> = {
  clubs: [
    name,
    { key: "city", label: "City", required: true },
    description,
    { key: "logo", label: "Logo URL", image: true },
  ],
  events: [
    name,
    { key: "date", label: "Date (YYYY-MM-DD)", required: true },
    sport,
    description,
    image,
    { key: "type", label: "Event type" },
    { key: "price", label: "Price (₹)", numeric: true, required: true },
    {
      key: "max_participants",
      label: "Capacity",
      numeric: true,
      required: true,
    },
    status,
  ],
  tournaments: [
    name,
    { key: "date", label: "Date (YYYY-MM-DD)", required: true },
    sport,
    description,
    image,
    { key: "format", label: "Format", required: true },
    { key: "skill_level", label: "Skill level" },
    { key: "entry_fee", label: "Entry fee (₹)", numeric: true, required: true },
    { key: "prize_pool", label: "Prize pool (₹)", numeric: true },
    {
      key: "max_participants",
      label: "Capacity",
      numeric: true,
      required: true,
    },
    status,
  ],
  products: [
    name,
    sport,
    description,
    image,
    { key: "category", label: "Category", required: true },
    { key: "price", label: "Price (₹)", numeric: true, required: true },
    { key: "stock", label: "Stock", numeric: true, required: true },
    {
      key: "status",
      label: "Visibility",
      options: ["active", "inactive"].map((value) => ({ value, label: value })),
    },
  ],
};
export default function AdminDashboard() {
  const router = useRouter();
  const { user, capabilities, loading: authLoading } = useSession();
  const admin = !!(user?.is_platform_admin || capabilities.is_platform_admin);
  const [tab, setTab] = useState("overview");
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<any>();
  const version = useRef(0);
  const loaders: Record<string, () => Promise<any>> = {
    clubs: api.adminClubs,
    events: api.adminEvents,
    tournaments: api.adminTournaments,
    products: api.adminProducts,
  };
  async function load() {
    if (!loaders[tab]) return;
    const v = ++version.current;
    setBusy(true);
    setError(null);
    try {
      const result = await loaders[tab]();
      if (v === version.current) setRows(result || []);
    } catch (e) {
      if (v === version.current) setError(e);
    } finally {
      if (v === version.current) setBusy(false);
    }
  }
  useEffect(() => {
    setRows([]);
    setQuery("");
    setEditor(undefined);
    if (admin) load();
    return () => {
      version.current++;
    };
  }, [tab, admin]);
  function edit(
    title: string,
    form: Field[],
    initial: any,
    save: (v: any) => Promise<any>,
  ) {
    setEditor({
      title,
      fields: form,
      initial,
      save: async (v: any) => {
        if (v.date && !/^\d{4}-\d{2}-\d{2}$/.test(v.date))
          throw new Error("Use YYYY-MM-DD for the date.");
        await save(v);
        setNotice("Changes saved.");
        await load();
      },
    });
  }
  function catalog(item?: any) {
    const methods: Record<
      string,
      [(p: any) => Promise<any>, (id: string, p: any) => Promise<any>]
    > = {
      clubs: [api.adminCreateClub, () => Promise.resolve()],
      events: [api.adminCreateEvent, api.adminUpdateEvent],
      tournaments: [api.adminCreateTournament, api.adminUpdateTournament],
      products: [api.adminCreateProduct, api.adminUpdateProduct],
    };
    edit(
      `${item ? "Edit" : "Create"} ${tab === "clubs" ? "club" : tab.slice(0, -1)}`,
      fields[tab],
      item || {
        sport: "sport-badminton",
        status: tab === "products" ? "active" : "draft",
        date: new Date().toISOString().slice(0, 10),
        price: 0,
        entry_fee: 0,
        prize_pool: 0,
        max_participants: 32,
        stock: 0,
        format: "Doubles",
      },
      (v) => (item ? methods[tab][1](item.id, v) : methods[tab][0](v)),
    );
  }
  function remove(item: any) {
    const methods: Record<string, (id: string) => Promise<any>> = {
      events: api.adminDeleteEvent,
      tournaments: api.adminDeleteTournament,
      products: api.adminDeleteProduct,
    };
    edit(
      tab === "products" ? "Deactivate product" : "Delete content",
      [
        {
          key: "confirm",
          label: `Type CONFIRM to remove ${item.name}`,
          required: true,
        },
      ],
      {},
      async (v) => {
        if (v.confirm !== "CONFIRM")
          throw new Error("Type CONFIRM to continue.");
        return methods[tab](item.id);
      },
    );
  }
  if (authLoading) return <Loader />;
  if (!admin)
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
          Platform access required
        </Text>
        <Text style={{ color: c.textSecondary }}>
          Sign in with an authorised platform account to manage MatchDrome.
        </Text>
        <Button
          label="Back to home"
          onPress={() => router.replace("/(tabs)")}
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <WorkspaceHeading
        title="Platform workspace"
        subtitle="Manage the MatchDrome community"
        back={() => router.back()}
      />
      <WorkspaceNav
        active={tab}
        onChange={setTab}
        items={[
          { key: "overview", label: "Overview" },
          { key: "clubs", label: "Clubs & courts" },
          { key: "users", label: "Users" },
          { key: "events", label: "Events" },
          { key: "tournaments", label: "Tournaments" },
          { key: "products", label: "Products" },
          { key: "finance", label: "Finance" },
          { key: "issues", label: "Venue issues" },
          { key: "system", label: "System health" },
          { key: "audit", label: "Audit history" },
        ]}
      />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={workspaceStyles.content}
      >
        {loaders[tab] ? (
          <>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 28,
                fontWeight: "900",
                textTransform: "capitalize",
                color: c.text,
              }}
            >
              {tab === "clubs" ? "Clubs & courts" : tab}
            </Text>
            <ErrorBanner error={error} retry={load} />
            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: "#17603C" }}
              >
                {notice}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <TextInput
                accessibilityLabel={`Search ${tab}`}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${tab}`}
                style={{
                  flexGrow: 1,
                  flexBasis: 180,
                  minWidth: 0,
                  minHeight: 48,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  borderRadius: 14,
                  backgroundColor: "white",
                  color: c.text,
                  fontSize: 16,
                }}
              />
              <Button
                label={`Create ${tab === "clubs" ? "club" : tab.slice(0, -1)}`}
                fullWidth={false}
                onPress={() => catalog()}
              />
            </View>
            {busy ? (
              <Loader />
            ) : (
              <DataRows
                rows={rows.filter((r) =>
                  [r.name, r.city, r.sport, r.status]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )}
                columns={[
                  { key: "name", label: "Name" },
                  {
                    key:
                      tab === "clubs"
                        ? "city"
                        : tab === "products"
                          ? "category"
                          : "date",
                    label:
                      tab === "clubs"
                        ? "City"
                        : tab === "products"
                          ? "Category"
                          : "Date",
                  },
                  { key: "status", label: "Status" },
                ]}
                actions={(r) =>
                  tab === "clubs" ? (
                    <>
                      <Button
                        label="Open workspace"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() => router.push(`/club/${r.id}`)}
                      />
                      <Button
                        label="Assign owner"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          edit(
                            "Assign club owner",
                            [
                              {
                                key: "mobile",
                                label: "Owner mobile (+91…)",
                                required: true,
                              },
                              { key: "name", label: "Owner name" },
                            ],
                            {},
                            (v) => api.adminAssignOwner(r.id, v),
                          )
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Button
                        label="Edit"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() => catalog(r)}
                      />
                      <Button
                        label={tab === "products" ? "Deactivate" : "Delete"}
                        variant="secondary"
                        fullWidth={false}
                        onPress={() => remove(r)}
                      />
                    </>
                  )
                }
              />
            )}
            <Button
              label="Refresh"
              variant="secondary"
              loading={busy}
              onPress={load}
            />
          </>
        ) : (
          <AdminOverview key={tab} section={tab} />
        )}
      </ScrollView>
      {editor && (
        <WorkspaceEditor
          {...editor}
          context="MatchDrome · Platform admin"
          close={() => setEditor(undefined)}
        />
      )}
    </SafeAreaView>
  );
}
