import { Brand } from '@/src/components/brand';
import { SportPicker } from '@/src/components/sport-picker';
import { Button } from '@/src/components/ui';
import { useEffect, useState, useRef } from 'react';
import { Alert, TextInput, View, Text, ScrollView, StyleSheet, Pressable, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';
import { useCapabilities } from '@/src/hooks/use-capabilities';
import { roleLabel } from '@/src/capabilities';

type TabKey = 'overview' | 'courts' | 'slots' | 'bookings' | 'events' | 'team' | 'settings';

export default function ClubWorkspace() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const { capabilities, loading: capsLoading, roleForOrg, canForOrg } = useCapabilities();

  const loadVersion = useRef(0);
  const [selectedSport, setSelectedSport] = useState('badminton');
  const [tab, setTab] = useState<TabKey>('overview');
  const [org, setOrg] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forms
  const [staffMobile, setStaffMobile] = useState('');
  const [staffRole, setStaffRole] = useState<'CLUB_ADMIN' | 'CLUB_MANAGER' | 'CLUB_STAFF'>('CLUB_STAFF');
  const [transferMobile, setTransferMobile] = useState('');

  // New Court Modal / State
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtArea, setNewCourtArea] = useState('');
  const [newCourtCount, setNewCourtCount] = useState('1');
  const [newCourtPrice, setNewCourtPrice] = useState('600');

  // Slot management
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [selectedCourtNum, setSelectedCourtNum] = useState<number>(1);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().slice(0, 10));
  const [customSlots, setCustomSlots] = useState<any[]>([]);
  const [blockSlotTime, setBlockSlotTime] = useState('09:00-10:00');

  // New Event Modal / State
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventPrice, setEventPrice] = useState('500');
  const [eventType, setEventType] = useState('Social Mixer');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published'>('published');

  const currentOrgId = String(orgId);
  const role = roleForOrg(currentOrgId);
  const canView = canForOrg(currentOrgId, 'club.view');
  const canManageClub = canForOrg(currentOrgId, 'club.manage');
  const canCourtsCreate = canForOrg(currentOrgId, 'club.courts.create');
  const canCourtsEdit = canForOrg(currentOrgId, 'club.courts.edit');
  const canCourtsDelete = canForOrg(currentOrgId, 'club.courts.delete');
  const canSlotsManage = canForOrg(currentOrgId, 'club.slots.manage');
  const canBookingsManage = canForOrg(currentOrgId, 'club.bookings.manage');
  const canBookingsConfirm = canForOrg(currentOrgId, 'club.bookings.confirm');
  const canBookingsCancel = canForOrg(currentOrgId, 'club.bookings.cancel');
  const canEventsManage = canForOrg(currentOrgId, 'club.events.manage');
  const canStaff = canForOrg(currentOrgId, 'club.staff.manage');
  const canTransfer = canForOrg(currentOrgId, 'club.ownership.transfer');
  const canAnalytics = canForOrg(currentOrgId, 'club.analytics.view');

  const reloadAll = async () => {
    const version = ++loadVersion.current;
    setErr(null);
    try {
      const results = await Promise.allSettled([
        api.org(currentOrgId), canAnalytics ? api.orgAnalytics(currentOrgId) : Promise.resolve(null),
        api.orgFacilities(currentOrgId), canBookingsManage ? api.orgBookings(currentOrgId) : Promise.resolve([]),
        canStaff ? api.orgMembers(currentOrgId) : Promise.resolve([]),
        canEventsManage ? api.orgEvents(currentOrgId) : Promise.resolve([]),
        canEventsManage ? api.orgTournaments(currentOrgId) : Promise.resolve([]),
        canManageClub ? api.orgAuditLog(currentOrgId) : Promise.resolve({ entries: [] }),
      ]);
      if (version !== loadVersion.current) return;
      const setters = [setOrg, setAnalytics, setFacilities, setBookings, setMembers, setEvents, setTournaments];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index < 7) setters[index](result.value);
          else setAuditLogs(result.value?.entries || []);
        }
      });
      if (results[2].status === 'fulfilled' && results[2].value?.length && !selectedFacilityId) setSelectedFacilityId(results[2].value[0].id);
      if (results.some(r => r.status === 'rejected')) setErr('Some club data couldn’t load. Please retry before making changes.');
    } catch (e: any) { if (version === loadVersion.current) setErr(e.message || 'Club unavailable'); }
  };

  useEffect(() => {
    if (capsLoading) return;
    if (!canView) {
      setErr('You do not have access to this club workspace.');
      return;
    }
    setOrg(null); setFacilities([]); setBookings([]); setMembers([]); setEvents([]); setTournaments([]); setAnalytics(null); setSelectedFacilityId(''); setShowAddCourt(false); setShowAddEvent(false); setTab('overview');
    reloadAll();
    return () => { loadVersion.current++; };
  }, [currentOrgId, capsLoading, canView]);

  useEffect(() => {
    if (selectedFacilityId) {
      api.orgListSlots(currentOrgId, selectedFacilityId, slotDate)
        .then((res) => setCustomSlots(res?.slots || []))
        .catch(() => setCustomSlots([]));
    }
  }, [selectedFacilityId, slotDate]);

  // Actions
  async function handleAddCourt() {
    if (!canCourtsCreate || !newCourtName.trim()) return;
    setBusy(true);
    try {
      await api.orgCreateFacility(currentOrgId, {
        name: newCourtName.trim(),
        city: org?.city || 'Bangalore',
        area: newCourtArea.trim() || org?.city || 'Downtown',
        courts_count: parseInt(newCourtCount) || 1,
        price_per_hour: parseInt(newCourtPrice) || 600,
        sports: [`sport-${selectedSport}`],
      });
      setShowAddCourt(false);
      setNewCourtName('');
      setNewCourtArea('');
      await reloadAll();
      Alert.alert('Court created', 'The court is now live for bookings.');
    } catch (e: any) {
      Alert.alert('Failed to add court', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCourt(fid: string) {
    if (!canCourtsDelete) return;
    Alert.alert('Deactivate court?', 'This court will be hidden from new bookings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.orgDeleteFacility(currentOrgId, fid);
            await reloadAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function handleBlockSlot(status: 'open' | 'blocked') {
    if (!canSlotsManage || !selectedFacilityId) return;
    try {
      await api.orgCreateSlots(currentOrgId, selectedFacilityId, {
        court_number: selectedCourtNum,
        date: slotDate,
        slots: [blockSlotTime],
        status,
      });
      const res = await api.orgListSlots(currentOrgId, selectedFacilityId, slotDate);
      setCustomSlots(res?.slots || []);
      Alert.alert('Slot updated', `Slot ${blockSlotTime} marked as ${status}.`);
    } catch (e: any) {
      Alert.alert('Slot update failed', e.message);
    }
  }

  async function handleConfirmBooking(bid: string) {
    if (!canBookingsConfirm) return;
    try {
      await api.orgConfirmBooking(currentOrgId, bid);
      await reloadAll();
      Alert.alert('Confirmed', 'Booking status set to Confirmed.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  }

  async function handleCancelBooking(bid: string) {
    if (!canBookingsCancel) return;
    Alert.alert('Cancel booking?', 'This will free the slot for other players.', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.orgCancelBooking(currentOrgId, bid);
            await reloadAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function handleAddEvent() {
    if (!canEventsManage || !eventName.trim()) return;
    setBusy(true);
    try {
      await api.orgCreateEvent(currentOrgId, {
        name: eventName.trim(),
        date: `${eventDate}T10:00:00Z`,
        price: parseInt(eventPrice) || 0,
        type: eventType,
        sport: `sport-${selectedSport}`,
        status: eventStatus,
        facility_id: selectedFacilityId || undefined,
      });
      setShowAddEvent(false);
      setEventName('');
      await reloadAll();
      Alert.alert('Event saved', `Event saved as ${eventStatus}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleClubStatus(active: boolean) {
    if (!canManageClub) return;
    const nextStatus = active ? 'active' : 'inactive';
    try {
      await api.orgUpdateStatus(currentOrgId, nextStatus);
      setOrg((prev: any) => ({ ...prev, status: nextStatus }));
      Alert.alert('Status updated', `Club is now ${nextStatus}.`);
    } catch (e: any) {
      Alert.alert('Status update failed', e.message);
    }
  }

  async function addStaff() {
    if (!canStaff || !staffMobile.trim()) return;
    setBusy(true);
    try {
      await api.orgAddStaff(currentOrgId, { mobile: staffMobile.trim(), role: staffRole });
      setStaffMobile('');
      await reloadAll();
      Alert.alert('Staff added', `${roleLabel(staffRole as any)} assigned.`);
    } catch (e: any) {
      Alert.alert('Unable to add staff', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function transferOwnership() {
    if (!canTransfer || !transferMobile.trim()) return;
    Alert.alert('Transfer ownership?', 'You will become a Club Admin after the transfer.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.orgTransferOwnership(currentOrgId, { mobile: transferMobile.trim() });
            setTransferMobile('');
            Alert.alert('Ownership transferred', 'Role updated successfully.');
            router.back();
          } catch (e: any) {
            Alert.alert('Transfer failed', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (capsLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;
  if (err) {
    return (
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
          <Text style={styles.title}>Club</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={{ color: colors.error, padding: spacing.lg }}>{err}</Text>{canView && <Button label="Try again" onPress={reloadAll} />}
      </SafeAreaView>
    );
  }
  if (!org) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="club-workspace-screen">
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="club-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{org.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Brand compact /><Text style={{ color: colors.onSurfaceSecondary, marginTop: 8 }}>Active club: {org.name} · Changes apply to this club only.</Text></View>
      {/* Workspace Badge */}
      <View style={styles.badgeRow}>
        <View style={styles.workspaceBadge}>
          <Ionicons name="business" size={14} color={colors.brandPrimary} />
          <Text style={styles.workspaceText}>
            {org.city || 'India'} · {roleLabel(role as any)}
          </Text>
        </View>
        <View style={[styles.statusPill, org.status === 'inactive' && styles.statusInactive]}>
          <Text style={[styles.statusText, org.status === 'inactive' && styles.statusTextInactive]}>
            {org.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
          </Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        <TabItem label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
        <TabItem label={`Courts (${facilities.length})`} active={tab === 'courts'} onPress={() => setTab('courts')} />
        {canSlotsManage && <TabItem label="Slots" active={tab === 'slots'} onPress={() => setTab('slots')} />}
        <TabItem label={`Bookings (${bookings.length})`} active={tab === 'bookings'} onPress={() => setTab('bookings')} />
        {canEventsManage && <TabItem label="Events" active={tab === 'events'} onPress={() => setTab('events')} />}
        {canStaff && <TabItem label={`Team (${members.length})`} active={tab === 'team'} onPress={() => setTab('team')} />}
        {canManageClub && <TabItem label="Settings" active={tab === 'settings'} onPress={() => setTab('settings')} />}
      </ScrollView>

      {/* Content Area */}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>

        {/* 1. OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {canAnalytics && analytics && (
              <View style={styles.grid}>
                {canManageClub && <Metric label="Confirmed booking value" value={`₹${(analytics.revenue || 0).toLocaleString('en-IN')}`} icon="cash" />}
                <Metric label="Bookings" value={analytics.bookings_count || 0} icon="calendar" />
                <Metric label="Courts" value={facilities.length} icon="grid" />
                <Metric label="Team" value={members.length} icon="people" />
              </View>
            )}
            <Text style={styles.sectionH}>{canManageClub ? 'Club operations' : 'Today at the venue'}</Text>
            {!canManageClub && <View style={styles.grid}><Metric label="Today’s bookings" value={bookings.filter(b => b.date === new Date().toLocaleDateString('en-CA')).length} icon="calendar" /><Metric label="Courts" value={facilities.length} icon="grid" /></View>}
            <View style={styles.quickGrid}>
              {canCourtsCreate && (
                <Pressable onPress={() => setShowAddCourt(true)} style={styles.actionTile}>
                  <Ionicons name="add-circle-outline" size={24} color={colors.brandPrimary} />
                  <Text style={styles.actionTileText}>Add Court</Text>
                </Pressable>
              )}
              {canSlotsManage && (
                <Pressable onPress={() => setTab('slots')} style={styles.actionTile}>
                  <Ionicons name="time-outline" size={24} color={colors.brandPrimary} />
                  <Text style={styles.actionTileText}>Manage Slots</Text>
                </Pressable>
              )}
              {canEventsManage && (
                <Pressable onPress={() => setShowAddEvent(true)} style={styles.actionTile}>
                  <Ionicons name="trophy-outline" size={24} color={colors.brandPrimary} />
                  <Text style={styles.actionTileText}>New Event</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* 2. COURTS TAB (Owner + Admin) */}
        {tab === 'courts' && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionH}>All Courts ({facilities.length})</Text>
              {canCourtsCreate && (
                <Pressable onPress={() => setShowAddCourt(true)} style={styles.smallPrimary}>
                  <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.smallPrimaryText}>Add Court</Text>
                </Pressable>
              )}
            </View>
            {facilities.length === 0 ? (
              <Text style={styles.empty}>No courts added yet. Add your first court above.</Text>
            ) : (
              facilities.map((f) => (
                <View key={f.id} style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{f.name}</Text>
                    <Text style={styles.cardMeta}>{f.area} · {f.courts_count} court(s) · ₹{f.price_per_hour}/hr</Text>
                  </View>
                  {canCourtsDelete && (
                    <Pressable onPress={() => handleDeleteCourt(f.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* 3. SLOTS TAB (Owner + Admin + Manager) */}
        {tab === 'slots' && canSlotsManage && (
          <>
            <Text style={styles.sectionH}>Slot Availability Management</Text>
            <Text style={styles.muted}>Block maintenance hours or open custom time slots per court.</Text>

            {/* Select Facility */}
            <Text style={styles.fieldLabel}>Select Facility/Court Hub</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.sm }}>
              {facilities.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setSelectedFacilityId(f.id)}
                  style={[styles.chip, selectedFacilityId === f.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedFacilityId === f.id && styles.chipTextActive]}>{f.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Court Number & Date */}
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Court Number</Text>
                <TextInput
                  value={String(selectedCourtNum)}
                  onChangeText={(v) => setSelectedCourtNum(parseInt(v) || 1)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 2, marginLeft: spacing.sm }}>
                <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput value={slotDate} onChangeText={setSlotDate} style={styles.input} />
              </View>
            </View>

            {/* Time Slot input */}
            <Text style={styles.fieldLabel}>Time Slot (e.g. 09:00-10:00)</Text>
            <TextInput value={blockSlotTime} onChangeText={setBlockSlotTime} style={styles.input} />

            <View style={styles.slotActionRow}>
              <Pressable onPress={() => handleBlockSlot('blocked')} style={styles.blockBtn}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={styles.blockBtnText}>Block Slot</Text>
              </Pressable>
              <Pressable onPress={() => handleBlockSlot('open')} style={styles.openBtn}>
                <Ionicons name="lock-open" size={16} color="#fff" />
                <Text style={styles.openBtnText}>Open Slot</Text>
              </Pressable>
            </View>

            {/* Existing overrides list */}
            <Text style={[styles.sectionH, { marginTop: spacing.lg }]}>Overrides on {slotDate}</Text>
            {customSlots.length === 0 ? (
              <Text style={styles.empty}>All slots on default schedule.</Text>
            ) : (
              customSlots.map((s) => (
                <View key={s.id || s.slot} style={styles.row}>
                  <Text style={styles.rowTitle}>Court {s.court_number} · {s.slot}</Text>
                  <View style={[styles.statusPill, s.status === 'blocked' && styles.statusInactive]}>
                    <Text style={[styles.statusText, s.status === 'blocked' && styles.statusTextInactive]}>{s.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* 4. BOOKINGS TAB (All roles) */}
        {tab === 'bookings' && (
          <>
            <Text style={styles.sectionH}>Club Bookings ({bookings.length})</Text>
            {bookings.length === 0 ? (
              <Text style={styles.empty}>No bookings on record.</Text>
            ) : (
              bookings.map((b) => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Court {b.court_number} · {b.slot}</Text>
                    <Text style={styles.rowMeta}>{b.date} · ₹{b.price} · {b.user_name || b.user_id}</Text>
                    <Text style={[styles.bookingStatus, b.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                      Status: {b.status?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.bookingBtnRow}>
                    {canBookingsConfirm && b.status !== 'confirmed' && b.status !== 'cancelled' && (
                      <Pressable onPress={() => handleConfirmBooking(b.id)} style={styles.confirmSmallBtn}>
                        <Text style={styles.confirmSmallText}>Confirm</Text>
                      </Pressable>
                    )}
                    {canBookingsCancel && b.status !== 'cancelled' && (
                      <Pressable onPress={() => handleCancelBooking(b.id)} style={styles.cancelSmallBtn}>
                        <Text style={styles.cancelSmallText}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* 5. EVENTS TAB (Owner + Admin + Manager) */}
        {tab === 'events' && canEventsManage && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionH}>Events & Tournaments</Text>
              <Pressable onPress={() => setShowAddEvent(true)} style={styles.smallPrimary}>
                <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.smallPrimaryText}>New Event</Text>
              </Pressable>
            </View>
            {events.length === 0 && tournaments.length === 0 ? (
              <Text style={styles.empty}>No events created yet.</Text>
            ) : (
              <>
                {events.map((e) => (
                  <View key={e.id} style={styles.card}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{e.name}</Text>
                      <Text style={styles.cardMeta}>{e.date?.slice(0, 10)} · ₹{e.price} · {e.type}</Text>
                    </View>
                    <View style={[styles.statusPill, e.status === 'draft' && styles.statusInactive]}>
                      <Text style={[styles.statusText, e.status === 'draft' && styles.statusTextInactive]}>
                        {e.status?.toUpperCase() || 'PUBLISHED'}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* 6. TEAM TAB (Owner + Admin) */}
        {tab === 'team' && canStaff && (
          <>
            <Text style={styles.sectionH}>Team Members ({members.length})</Text>
            {members.map((m) => (
              <View key={m.id || m.user_id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{m.user?.name || m.user?.mobile || 'Staff'}</Text>
                  <Text style={styles.rowMeta}>{roleLabel(m.role)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.manageCard}>
              <Text style={styles.manageTitle}>Add Staff or Manager</Text>
              <TextInput
                placeholder="Mobile number (+91...)"
                placeholderTextColor={colors.onSurfaceMuted}
                value={staffMobile}
                onChangeText={setStaffMobile}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <View style={styles.roleToggle}>
                <Pressable
                  onPress={() => setStaffRole('CLUB_STAFF')}
                  style={[styles.toggle, staffRole === 'CLUB_STAFF' && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, staffRole === 'CLUB_STAFF' && styles.toggleTextActive]}>Staff</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStaffRole('CLUB_MANAGER')}
                  style={[styles.toggle, staffRole === 'CLUB_MANAGER' && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, staffRole === 'CLUB_MANAGER' && styles.toggleTextActive]}>Manager</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStaffRole('CLUB_ADMIN')}
                  style={[styles.toggle, staffRole === 'CLUB_ADMIN' && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, staffRole === 'CLUB_ADMIN' && styles.toggleTextActive]}>Admin</Text>
                </Pressable>
              </View>
              <Pressable disabled={busy || !staffMobile.trim()} onPress={addStaff} style={styles.primary}>
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Add Team Member'}</Text>
              </Pressable>
            </View>

            {canTransfer && (
              <View style={[styles.manageCard, { marginTop: spacing.xl }]}>
                <Text style={styles.manageTitle}>Transfer Club Ownership</Text>
                <Text style={styles.muted}>This action transfers primary club ownership. You will remain an Admin.</Text>
                <TextInput
                  placeholder="New owner mobile number"
                  placeholderTextColor={colors.onSurfaceMuted}
                  value={transferMobile}
                  onChangeText={setTransferMobile}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <Pressable
                  disabled={busy || !transferMobile.trim()}
                  onPress={transferOwnership}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerText}>Transfer Ownership</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* 7. SETTINGS TAB (Owner + Admin) */}
        {tab === 'settings' && canManageClub && (
          <>
            <Text style={styles.sectionH}>Club Settings</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Club Active Status</Text>
                <Text style={styles.settingSub}>When inactive, all courts under this club are hidden from public booking.</Text>
              </View>
              <Switch
                value={org.status !== 'inactive'}
                onValueChange={handleToggleClubStatus}
                trackColor={{ true: colors.brandPrimary, false: colors.border }}
              />
            </View>

            {/* Audit Log */}
            <Text style={[styles.sectionH, { marginTop: spacing.xl }]}>Audit Trail ({auditLogs.length})</Text>
            {auditLogs.length === 0 ? (
              <Text style={styles.empty}>No audit log entries yet.</Text>
            ) : (
              auditLogs.slice(0, 15).map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logAction}>{log.action}</Text>
                  <Text style={styles.logMeta}>{log.created_at?.slice(0, 19).replace('T', ' ')} · {log.actor?.name || log.actor_id}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add Court Modal */}
      <Modal visible={showAddCourt} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Court</Text><SportPicker value={selectedSport} onChange={setSelectedSport} />
            <TextInput placeholder="Court Name (e.g. Center Court)" placeholderTextColor={colors.onSurfaceMuted} value={newCourtName} onChangeText={setNewCourtName} style={styles.input} />
            <TextInput placeholder="Area/Location (e.g. Koramangala)" placeholderTextColor={colors.onSurfaceMuted} value={newCourtArea} onChangeText={setNewCourtArea} style={styles.input} />
            <TextInput placeholder="Number of courts (e.g. 2)" placeholderTextColor={colors.onSurfaceMuted} value={newCourtCount} onChangeText={setNewCourtCount} keyboardType="numeric" style={styles.input} />
            <TextInput placeholder="Price per hour ₹ (e.g. 600)" placeholderTextColor={colors.onSurfaceMuted} value={newCourtPrice} onChangeText={setNewCourtPrice} keyboardType="numeric" style={styles.input} />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowAddCourt(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              <Pressable onPress={handleAddCourt} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>Create Court</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={showAddEvent} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text><SportPicker value={selectedSport} onChange={setSelectedSport} />
            <TextInput placeholder="Event Name" placeholderTextColor={colors.onSurfaceMuted} value={eventName} onChangeText={setEventName} style={styles.input} />
            <TextInput placeholder="Date (YYYY-MM-DD)" placeholderTextColor={colors.onSurfaceMuted} value={eventDate} onChangeText={setEventDate} style={styles.input} />
            <TextInput placeholder="Price ₹" placeholderTextColor={colors.onSurfaceMuted} value={eventPrice} onChangeText={setEventPrice} keyboardType="numeric" style={styles.input} />
            <View style={styles.roleToggle}>
              <Pressable onPress={() => setEventStatus('draft')} style={[styles.toggle, eventStatus === 'draft' && styles.toggleActive]}><Text style={[styles.toggleText, eventStatus === 'draft' && styles.toggleTextActive]}>Draft</Text></Pressable>
              <Pressable onPress={() => setEventStatus('published')} style={[styles.toggle, eventStatus === 'published' && styles.toggleActive]}><Text style={[styles.toggleText, eventStatus === 'published' && styles.toggleTextActive]}>Published</Text></Pressable>
            </View>
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowAddEvent(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              <Pressable onPress={handleAddEvent} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>Save Event</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TabItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, icon }: { label: string; value: any; icon: any }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', textAlign: 'center', marginHorizontal: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  workspaceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  workspaceText: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '700' },
  statusPill: { backgroundColor: 'rgba(52, 199, 89, 0.15)', borderWidth: 1, borderColor: '#34C759', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  statusInactive: { backgroundColor: 'rgba(255, 69, 58, 0.15)', borderColor: colors.error },
  statusText: { color: '#34C759', fontSize: font.sizes.xs, fontWeight: '800' },
  statusTextInactive: { color: colors.error },
  tabBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  tabBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabBtnText: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, fontWeight: '700' },
  tabBtnTextActive: { color: colors.onBrandPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { width: '45%', flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  metricVal: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  metricLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase' },
  quickGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionTile: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 6 },
  actionTileText: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.md },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  empty: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  cardTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  cardMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  deleteBtn: { padding: spacing.sm },
  smallPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  smallPrimaryText: { color: colors.onBrandPrimary, fontSize: font.sizes.xs, fontWeight: '800' },
  fieldLabel: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700', marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, backgroundColor: colors.surfaceSecondary },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, fontWeight: '700' },
  chipTextActive: { color: colors.onBrandPrimary },
  formRow: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: spacing.xs, marginBottom: spacing.xs },
  slotActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  blockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.error, borderRadius: radius.pill, paddingVertical: 11 },
  blockBtnText: { color: '#fff', fontWeight: '800', fontSize: font.sizes.xs },
  openBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#34C759', borderRadius: radius.pill, paddingVertical: 11 },
  openBtnText: { color: '#fff', fontWeight: '800', fontSize: font.sizes.xs },
  bookingCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  bookingStatus: { fontSize: font.sizes.xs, fontWeight: '800', marginTop: 4 },
  statusConfirmed: { color: '#34C759' },
  statusPending: { color: '#FF9500' },
  bookingBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  confirmSmallBtn: { backgroundColor: '#34C759', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  confirmSmallText: { color: '#fff', fontSize: font.sizes.xs, fontWeight: '800' },
  cancelSmallBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  cancelSmallText: { color: colors.error, fontSize: font.sizes.xs, fontWeight: '800' },
  manageCard: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  manageTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '800', marginBottom: spacing.xs },
  muted: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, lineHeight: 18 },
  roleToggle: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  toggle: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  toggleText: { color: colors.onSurfaceMuted, fontWeight: '700', fontSize: font.sizes.xs },
  toggleTextActive: { color: colors.onBrandPrimary },
  primary: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginTop: spacing.md },
  primaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.sm },
  dangerButton: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: colors.error },
  dangerText: { color: colors.error, fontWeight: '800', fontSize: font.sizes.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowTitle: { color: colors.onSurface, fontSize: font.sizes.sm, fontWeight: '700' },
  rowMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  settingLabel: { color: colors.onSurface, fontSize: font.sizes.sm, fontWeight: '700' },
  settingSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, marginTop: 2 },
  logRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  logAction: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700' },
  logMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', marginBottom: spacing.md },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.onSurfaceMuted, fontWeight: '700' },
  modalSubmit: { flex: 1, backgroundColor: colors.brandPrimary, paddingVertical: 12, alignItems: 'center', borderRadius: radius.pill },
  modalSubmitText: { color: colors.onBrandPrimary, fontWeight: '800' },
});


