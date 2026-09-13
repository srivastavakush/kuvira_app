import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, Share, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useCapabilities } from "@/src/hooks/use-capabilities";
import { roleLabel } from "@/src/capabilities";
import { Button, Card, Loader } from "@/src/components/ui";
import { ErrorBanner } from "@/src/components/states";
import {
  WorkspaceNav,
  WorkspaceHeading,
  WorkspaceEditor,
  DataRows,
  Field,
  workspaceStyles,
} from "@/src/components/workspace";
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
].map((s) => ({ value: `sport-${s}`, label: s[0].toUpperCase() + s.slice(1) }));
const name: Field = { key: "name", label: "Name", required: true };
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
const roles: Field = {
  key: "role",
  label: "Club role",
  required: true,
  options: ["CLUB_ADMIN", "CLUB_MANAGER", "CLUB_STAFF"].map((value) => ({
    value,
    label: roleLabel(value as any),
  })),
};
const date: Field = { key: "date", label: "Date (YYYY-MM-DD)", required: true };
const eventFields: Field[] = [
  name,
  date,
  sport,
  { key: "description", label: "Description", multiline: true },
  { key: "image", label: "Image URL", image: true },
  { key: "max_participants", label: "Capacity", numeric: true, required: true },
  status,
];
const courtFields: Field[] = [
  name,
  { key: "city", label: "City", required: true },
  { key: "area", label: "Area", required: true },
  { key: "address", label: "Address" },
  sport,
  {
    key: "courts_count",
    label: "Number of courts",
    numeric: true,
    required: true,
  },
  {
    key: "price_per_hour",
    label: "Hourly price (₹)",
    numeric: true,
    required: true,
  },
  { key: "image", label: "Image URL", image: true },
  { key: "description", label: "Description", multiline: true },
];
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
type Editor = {
  title: string;
  fields: Field[];
  initial?: any;
  save: (v: any) => Promise<any>;
};
export default function ClubWorkspace() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const id = String(orgId);
  const router = useRouter();
  const {
    loading: authLoading,
    capabilities,
    canForOrg,
    roleForOrg,
  } = useCapabilities();
  const can = (p: string) => canForOrg(id, `club.${p}`);
  const [tab, setTab] = useState("overview");
  const [org, setOrg] = useState<any>();
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [facility, setFacility] = useState("");
  const version = useRef(0);
  const permitted = can("view");
  const financial = can("manage");
  const nav = [
    { key: "overview", label: "Overview" },
    { key: "bookings", label: "Bookings & check-in" },
    { key: "courts", label: "Courts" },
    ...(can("slots.manage") ? [{ key: "slots", label: "Schedule" }] : []),
    ...(can("games.manage") ? [{ key: "games", label: "Open games" }] : []),
    ...(can("events.manage")
      ? [
          { key: "events", label: "Events" },
          { key: "tournaments", label: "Tournaments" },
        ]
      : []),
    ...(can("staff.manage") ? [{ key: "team", label: "Team" }] : []),
    { key: "issues", label: "Venue issues" },
    ...(financial
      ? [
          { key: "settings", label: "Settings" },
          { key: "audit", label: "Audit history" },
        ]
      : []),
  ];
  async function load() {
    const v = ++version.current;
    setLoading(true);
    setError(null);
    const jobs: [string, Promise<any>][] = [
      ["org", api.org(id)],
      ["courts", api.orgFacilities(id)],
      ["bookings", api.orgBookings(id)],
    ];
    if (can("analytics.view")) jobs.push(["analytics", api.orgAnalytics(id)]);
    if (can("events.manage"))
      jobs.push(
        ["events", api.orgEvents(id)],
        ["tournaments", api.orgTournaments(id)],
      );
    if (can("staff.manage")) jobs.push(["team", api.orgMembers(id)]);
    if (financial) jobs.push(["audit", api.orgAuditLog(id)]);
    if (can("games.manage")) jobs.push(["games", api.orgGames(id)]);
    jobs.push(["issues", api.orgIssues(id)]);
    const res = await Promise.allSettled(jobs.map((j) => j[1]));
    if (v !== version.current) return;
    const next: Record<string, any> = {};
    res.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (jobs[i][0] === "org") setOrg(r.value);
        else next[jobs[i][0]] = r.value;
      }
    });
    setData(next);
    if (res.some((r) => r.status === "rejected"))
      setError(
        "Some workspace data could not load. Retry before making changes.",
      );
    setLoading(false);
  }
  useEffect(() => {
    setOrg(undefined);
    setData({});
    setEditor(undefined);
    setTab("overview");
    setFacility("");
    setQuery("");
    setDay("");
    if (!authLoading && permitted) load();
    return () => {
      version.current++;
    };
  }, [id, authLoading, JSON.stringify(capabilities)]);
  const courts: any[] = data.courts || [];
  const bookings: any[] = data.bookings || [];
  const filtered = bookings.filter(
    (b) =>
      (!day || b.date?.slice(0, 10) === day) &&
      JSON.stringify([b.id, b.user_name, b.user_id, b.slot, b.court_number])
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function done(fn: () => Promise<any>) {
    await fn();
    setNotice("Changes saved.");
    await load();
  }
  function edit(
    title: string,
    fields: Field[],
    initial: any,
    save: (v: any) => Promise<any>,
  ) {
    setEditor({
      title,
      fields,
      initial,
      save: async (v) => {
        if (v.date && !(title === "Court availability" && v.date === "*") && !/^\d{4}-\d{2}-\d{2}$/.test(v.date))
          throw new Error("Use a date in YYYY-MM-DD format.");
        await done(() => save(v));
      },
    });
  }
  function confirm(title: string, action: () => Promise<any>) {
    edit(
      title,
      [{ key: "confirm", label: "Type CONFIRM to continue", required: true }],
      {},
      async (v) => {
        if (v.confirm !== "CONFIRM")
          throw new Error("Type CONFIRM to continue.");
        return action();
      },
    );
  }
  const action = (label: string, onPress: () => void) => (
    <Button
      label={label}
      onPress={onPress}
      variant="secondary"
      fullWidth={false}
    />
  );
  function eventEditor(kind: "events" | "tournaments", item?: any) {
    const tournament = kind === "tournaments";
    edit(
      `${item ? "Edit" : "Create"} ${tournament ? "tournament" : "event"}`,
      [
        ...eventFields,
        ...(tournament
          ? [
              { key: "format", label: "Format", required: true },
              { key: "skill_level", label: "Skill level" },
              {
                key: "entry_fee",
                label: "Entry fee (₹)",
                numeric: true,
                required: true,
              },
              { key: "prize_pool", label: "Prize pool (₹)", numeric: true },
            ]
          : [
              { key: "type", label: "Event type" },
              {
                key: "price",
                label: "Price (₹)",
                numeric: true,
                required: true,
              },
            ]),
        {
          key: "facility_id",
          label: "Venue",
          options: [
            { value: "", label: "Club-wide" },
            ...courts.map((f) => ({ value: f.id, label: f.name })),
          ],
        },
      ],
      item || {
        date: today(),
        sport: "sport-badminton",
        status: "draft",
        max_participants: 32,
        entry_fee: 0,
        prize_pool: 0,
        price: 0,
        format: "Doubles",
      },
      (v) =>
        tournament
          ? item
            ? api.orgUpdateTournament(id, item.id, v)
            : api.orgCreateTournament(id, v)
          : item
            ? api.orgUpdateEvent(id, item.id, v)
            : api.orgCreateEvent(id, v),
    );
  }
  if (authLoading) return <Loader />;
  if (!permitted)
    return (
      <SafeAreaView style={{ flex: 1, padding: 24 }}>
        <Text style={{ color: c.text, fontSize: 22 }}>
          Club access required
        </Text>
        <Text style={{ color: c.textSecondary, marginVertical: 16 }}>
          Your account does not have access to this club.
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
        title={org?.name || "Club workspace"}
        subtitle={`${roleLabel(roleForOrg(id) as any)} · ${org?.city || "India"} · ${org?.status || "Loading"}`}
        back={() => router.back()}
      />
      <WorkspaceNav
        items={nav}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setQuery("");
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={workspaceStyles.content}
      >
        <Text style={{ color: c.textSecondary }}>
          Active club: {org?.name || id}. Changes apply only to this club.
        </Text>
        {capabilities.organizations?.length > 1 && (
          <WorkspaceNav
            items={capabilities.organizations.map((o: any) => ({
              key: o.org_id,
              label: o.org_name || o.name || o.org_id,
            }))}
            active={id}
            onChange={(o) => router.replace(`/club/${o}`)}
          />
        )}
        <ErrorBanner error={error} retry={load} />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ color: "#17603C" }}>
            {notice}
          </Text>
        ) : null}
        {loading ? <Loader /> : null}
        {tab === "overview" && (
          <>
            <Text style={{ fontSize: 28, fontWeight: "900", color: c.text }}>
              {financial ? "Your club. In play." : "Ready for today?"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {[
                [
                  "Today’s bookings",
                  bookings.filter((b) => b.date?.slice(0, 10) === today())
                    .length,
                ],
                [
                  "Awaiting check-in",
                  bookings.filter(
                    (b) =>
                      b.date?.slice(0, 10) === today() &&
                      b.status === "confirmed" &&
                      !b.checked_in_at,
                  ).length,
                ],
                ["Venues", courts.length],
                ...(financial && data.analytics
                  ? [
                      [
                        "Confirmed booking value",
                        `₹${Number(data.analytics.revenue || 0).toLocaleString("en-IN")}`,
                      ],
                    ]
                  : []),
              ].map(([label, value]) => (
                <Card
                  key={String(label)}
                  style={{ flexGrow: 1, flexBasis: 180 }}
                >
                  <Text style={{ color: c.textSecondary }}>{label}</Text>
                  <Text
                    style={{
                      fontSize: 30,
                      fontWeight: "900",
                      color: c.text,
                      marginTop: 10,
                    }}
                  >
                    {value}
                  </Text>
                </Card>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {action("Today’s bookings", () => {
                setDay(today());
                setTab("bookings");
              })}
              {can("slots.manage") &&
                action("Manage court schedule", () => setTab("slots"))}
              {can("events.manage") &&
                action("Create event", () => eventEditor("events"))}
              {action("Report an issue", () => setTab("issues"))}
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>
              Workspace tools
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {nav
                .filter((n) => n.key !== "overview")
                .map((n) => (
                  <Card key={n.key} style={{ flexBasis: 240, flexGrow: 1 }}>
                    <Button
                      label={n.label}
                      variant="secondary"
                      onPress={() => setTab(n.key)}
                    />
                  </Card>
                ))}
            </View>
          </>
        )}
        {tab === "bookings" && (
          <>
            <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
              Bookings & check-in
            </Text>
            <TextInput
              accessibilityLabel="Search bookings or customers"
              placeholder="Search customer, booking or court"
              value={query}
              onChangeText={setQuery}
              style={{
                backgroundColor: "white",
                padding: 16,
                borderRadius: 14,
                fontSize: 16,
                color: c.text,
              }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {action("Today", () => setDay(today()))}
              {action("All dates", () => setDay(""))}
              {can("reports.export") &&
                action("Export bookings", () => {
                  api
                    .orgExportBookings(id)
                    .then((r) =>
                      exportBookings(r),
                    )
                    .catch(setError);
                })}
            </View>
            <TextInput
              accessibilityLabel="Filter booking date"
              placeholder="Filter date: YYYY-MM-DD"
              value={day}
              onChangeText={setDay}
              style={{
                padding: 14,
                backgroundColor: "white",
                borderRadius: 12,
                color: c.text,
              }}
            />
            <DataRows
              rows={filtered}
              columns={[
                {
                  key: "user_name",
                  label: "Customer",
                  render: (b) => b.user_name || b.user_id,
                },
                {
                  key: "slot",
                  label: "Court / slot",
                  render: (b) =>
                    `${courts.find((f) => f.id === b.facility_id)?.name || "Venue"} · Court ${b.court_number} · ${b.slot}`,
                },
                { key: "date", label: "Date" },
                {
                  key: "status",
                  label: "Status",
                  render: (b) => (b.checked_in_at ? "Checked in" : b.status),
                },
              ]}
              actions={(b) => (
                <>
                  {can("bookings.confirm") &&
                    b.status === "confirmed" &&
                    !b.checked_in_at &&
                    action("Check in", () =>
                      confirm("Check in this booking", () =>
                        api.orgCheckIn(id, b.id),
                      ),
                    )}
                  {can("bookings.confirm") &&
                    !["confirmed", "cancelled", "pending_payment"].includes(
                      b.status,
                    ) &&
                    action("Confirm", () =>
                      confirm("Confirm booking", () =>
                        api.orgConfirmBooking(id, b.id),
                      ),
                    )}
                  {can("bookings.cancel") &&
                    b.status !== "cancelled" &&
                    action("Cancel", () =>
                      confirm("Cancel booking (does not issue a refund)", () =>
                        api.orgCancelBooking(id, b.id),
                      ),
                    )}
                </>
              )}
            />
          </>
        )}
        {tab === "courts" && (
          <>
            {can("courts.create") &&
              action("Add court", () =>
                edit(
                  "Add court",
                  courtFields,
                  {
                    city: org?.city,
                    sport: "sport-badminton",
                    courts_count: 1,
                    price_per_hour: 0,
                  },
                  (v) => {
                    const { sport, ...rest } = v;
                    return api.orgCreateFacility(id, {
                      ...rest,
                      sports: [sport],
                    });
                  },
                ),
              )}
            <DataRows
              rows={courts}
              columns={[
                { key: "name", label: "Venue" },
                { key: "area", label: "Location" },
                { key: "courts_count", label: "Courts" },
                {
                  key: "sports",
                  label: "Sports",
                  render: (f) =>
                    (f.sports || []).join(", ").replace(/sport-/g, ""),
                },
              ]}
              actions={(f) => (
                <>
                  {can("courts.edit") &&
                    action("Edit", () =>
                      edit(
                        "Edit court",
                        courtFields,
                        { ...f, sport: f.sports?.[0] },
                        (v) => {
                          const { sport, ...rest } = v;
                          return api.orgUpdateFacility(id, f.id, {
                            ...rest,
                            sports: [
                              sport,
                              ...(f.sports || []).filter(
                                (s: string) =>
                                  s !== f.sports?.[0] && s !== sport,
                              ),
                            ],
                          });
                        },
                      ),
                    )}
                  {can("courts.delete") &&
                    action("Delete", () =>
                      confirm(`Delete ${f.name}`, () =>
                        api.orgDeleteFacility(id, f.id),
                      ),
                    )}
                </>
              )}
            />
          </>
        )}
        {tab === "slots" && can("slots.manage") && (
          <>
            <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
              Court availability
            </Text>
            <WorkspaceNav
              items={courts.map((f) => ({ key: f.id, label: f.name }))}
              active={facility}
              onChange={setFacility}
            />
            {facility ? (
              <SlotPanel
                key={`${id}:${facility}`}
                orgId={id}
                facility={courts.find((f) => f.id === facility)}
                edit={edit}
                confirm={confirm}
              />
            ) : (
              <Text style={{ color: c.textSecondary }}>
                Select a venue to view, block or reopen slots.
              </Text>
            )}
          </>
        )}
        {(tab === "events" || tab === "tournaments") &&
          can("events.manage") && (
            <>
              {action(
                `Create ${tab === "events" ? "event" : "tournament"}`,
                () => eventEditor(tab),
              )}
              <DataRows
                rows={data[tab] || []}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "date", label: "Date" },
                  { key: "sport", label: "Sport" },
                  { key: "status", label: "Publish state" },
                ]}
                actions={(item) => (
                  <>
                    {action("Edit", () => eventEditor(tab, item))}
                    {action("Delete", () =>
                      confirm(`Delete ${item.name}`, () =>
                        tab === "events"
                          ? api.orgDeleteEvent(id, item.id)
                          : api.orgDeleteTournament(id, item.id),
                      ),
                    )}
                  </>
                )}
              />
            </>
          )}
        {tab === "games" && can("games.manage") && (
          <DataRows
            rows={data.games || []}
            columns={[
              {
                key: "name",
                label: "Game",
                render: (g) => g.title || g.name || "Open game",
              },
              { key: "date", label: "Date" },
              { key: "sport", label: "Sport" },
              { key: "status", label: "Status" },
            ]}
            actions={(g) =>
              action("View game", () => router.push(`/game/${g.id}` as any))
            }
          />
        )}
        {tab === "team" && can("staff.manage") && (
          <>
            {action("Add team member", () =>
              edit(
                "Add team member",
                [
                  { key: "mobile", label: "Mobile (+91…)", required: true },
                  roles,
                ],
                { role: "CLUB_STAFF" },
                (v) => api.orgAddStaff(id, v),
              ),
            )}
            <DataRows
              rows={data.team || []}
              columns={[
                {
                  key: "user",
                  label: "Team member",
                  render: (m) => m.user?.name || m.user?.mobile || m.user_id,
                },
                {
                  key: "role",
                  label: "Role",
                  render: (m) => roleLabel(m.role),
                },
              ]}
              actions={(m) =>
                m.role !== "CLUB_OWNER" ? (
                  <>
                    {action("Change role", () =>
                      edit("Change club role", [roles], m, (v) =>
                        api.orgUpdateMemberRole(id, m.user_id, v.role),
                      ),
                    )}
                    {action("Remove", () =>
                      confirm("Remove club access", () =>
                        api.orgRemoveMember(id, m.user_id),
                      ),
                    )}
                  </>
                ) : null
              }
            />
          </>
        )}
        {tab === "issues" && (
          <>
            {action("Report venue issue", () =>
              edit(
                "Report venue issue",
                [
                  { key: "title", label: "Issue title", required: true },
                  {
                    key: "description",
                    label: "What happened?",
                    multiline: true,
                    required: true,
                  },
                ],
                {},
                (v) => api.orgCreateIssue(id, v),
              ),
            )}
            <DataRows
              rows={data.issues || []}
              columns={[
                { key: "title", label: "Issue" },
                { key: "description", label: "Details" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "Reported" },
              ]}
              actions={(i) =>
                i.status !== "resolved"
                  ? action("Resolve", () =>
                      confirm("Mark issue resolved", () =>
                        api.orgResolveIssue(id, i.id),
                      ),
                    )
                  : null
              }
            />
          </>
        )}
        {tab === "settings" && financial && (
          <>
            <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
              Club settings
            </Text>
            {action("Edit club details", () =>
              edit(
                "Club details",
                [
                  name,
                  { key: "city", label: "City", required: true },
                  {
                    key: "description",
                    label: "About the club",
                    multiline: true,
                  },
                  { key: "address", label: "Address" },
                  { key: "phone", label: "Phone" },
                  { key: "email", label: "Email" },
                  { key: "website", label: "Website" },
                  { key: "logo", label: "Logo URL", image: true },
                  { key: "cover_image", label: "Cover image URL", image: true },
                ],
                org,
                (v) => api.orgUpdate(id, v),
              ),
            )}
            {action("Set map location", () =>
              edit(
                "Map location",
                [
                  { key: "lat", label: "Latitude", required: true },
                  { key: "lng", label: "Longitude", required: true },
                  { key: "address", label: "Address" },
                ],
                org,
                (v) => {
                  const lat = Number(v.lat),
                    lng = Number(v.lng);
                  if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng) ||
                    Math.abs(lat) > 90 ||
                    Math.abs(lng) > 180
                  )
                    throw new Error("Enter valid latitude and longitude.");
                  return api.orgUpdateLocation(id, { ...v, lat, lng });
                },
              ),
            )}
            {action(
              org?.status === "inactive" ? "Activate club" : "Deactivate club",
              () =>
                confirm("Change club visibility", () =>
                  api.orgUpdateStatus(
                    id,
                    org?.status === "inactive" ? "active" : "inactive",
                  ),
                ),
            )}
            {can("ownership.transfer") &&
              action("Transfer ownership", () =>
                edit(
                  "Transfer ownership",
                  [
                    {
                      key: "mobile",
                      label: "New owner mobile",
                      required: true,
                    },
                    {
                      key: "confirm",
                      label: "Type TRANSFER to confirm",
                      required: true,
                    },
                  ],
                  {},
                  (v) => {
                    if (v.confirm !== "TRANSFER")
                      throw new Error("Type TRANSFER to confirm.");
                    return api.orgTransferOwnership(id, { mobile: v.mobile });
                  },
                ),
              )}
          </>
        )}
        {tab === "audit" && financial && (
          <DataRows
            rows={data.audit?.entries || []}
            columns={[
              { key: "action", label: "Action" },
              {
                key: "actor",
                label: "Changed by",
                render: (l) => l.actor?.name || l.actor_id,
              },
              { key: "created_at", label: "Time" },
            ]}
          />
        )}
        <Button
          label="Refresh workspace"
          variant="secondary"
          loading={loading}
          onPress={load}
        />
      </ScrollView>
      {editor && (
        <WorkspaceEditor
          key={`${id}:${editor.title}`}
          {...editor}
          context={org?.name || id}
          close={() => setEditor(undefined)}
        />
      )}
    </SafeAreaView>
  );
}
function SlotPanel({
  orgId,
  facility,
  edit,
  confirm,
}: {
  orgId: string;
  facility: any;
  edit: Function;
  confirm: Function;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true);
    setError(null);
    try {
      setRows((await api.orgListSlots(orgId, facility.id)).slots || []);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [orgId, facility.id]);
  return (
    <View style={{ gap: 16 }}>
      <ErrorBanner error={error} retry={load} />
      <Button
        label="Add availability override"
        onPress={() =>
          edit(
            "Court availability",
            [
              {
                key: "court_number",
                label: "Court number",
                numeric: true,
                required: true,
              },
              { key: "date", label: "Date (YYYY-MM-DD, or * for daily recurring)", required: true },
              {
                key: "slots",
                label: "Times, comma separated (09:00-10:00)",
                required: true,
              },
              {
                key: "status",
                label: "Availability",
                options: [
                  { value: "open", label: "Open" },
                  { value: "blocked", label: "Blocked" },
                ],
                required: true,
              },
            ],
            { date: today(), court_number: 1, status: "blocked" },
            async (v: any) => {
              if (
                !Number.isInteger(v.court_number) ||
                v.court_number < 1 ||
                v.court_number > facility.courts_count
              )
                throw new Error("Choose a valid court number.");
              const slots = v.slots.split(",").map((s: string) => s.trim());
              if (
                slots.some(
                  (s: string) =>
                    !/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(
                      s,
                    ),
                )
              )
                throw new Error("Use HH:MM-HH:MM for each slot.");
              await api.orgCreateSlots(orgId, facility.id, { ...v, slots });
              await load();
            },
          )
        }
      />
      {busy ? (
        <Loader />
      ) : (
        <DataRows
          rows={rows}
          columns={[
            { key: "court_number", label: "Court" },
            { key: "date", label: "Date" },
            {
              key: "slot",
              label: "Time",
              render: (s) => s.slot || s.time || s.slots?.join(", "),
            },
            { key: "status", label: "Availability" },
          ]}
          actions={(r) => (
            <>
              <Button
                label={r.status === "blocked" ? "Reopen" : "Block"}
                fullWidth={false}
                variant="secondary"
                onPress={() =>
                  confirm("Change slot availability", async () => {
                    await api.orgUpdateSlot(
                      orgId,
                      facility.id,
                      r.id,
                      r.status === "blocked" ? "open" : "blocked",
                    );
                    await load();
                  })
                }
              />
              <Button
                label="Reset"
                fullWidth={false}
                variant="secondary"
                onPress={() =>
                  confirm("Remove availability override", async () => {
                    await api.orgDeleteSlot(orgId, facility.id, r.id);
                    await load();
                  })
                }
              />
            </>
          )}
        />
      )}
    </View>
  );
}

async function exportBookings(report: any) {
  const content=JSON.stringify(report,null,2);
  if(Platform.OS!=='web')return Share.share({message:content});
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='matchdrome-bookings.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
