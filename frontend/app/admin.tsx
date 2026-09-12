import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { EmptyState, Loader } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';

type AdminTab = 'clubs' | 'events' | 'tournaments' | 'products';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, capabilities, refresh } = useSession();
  const [tab, setTab] = useState<AdminTab>('clubs');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Clubs & Facilities
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('Bangalore');
  const [ownerMobile, setOwnerMobile] = useState('');

  const [showCourtModal, setShowCourtModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any>(null);
  const [facilityName, setFacilityName] = useState('');
  const [facilityArea, setFacilityArea] = useState('');
  const [facilityCity, setFacilityCity] = useState('');
  const [courtsCount, setCourtsCount] = useState('1');
  const [pricePerHour, setPricePerHour] = useState('600');
  const [facilityImage, setFacilityImage] = useState('');

  // Events
  const [events, setEvents] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState('Social Mixer');
  const [eventPrice, setEventPrice] = useState('400');
  const [eventImage, setEventImage] = useState('');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published'>('published');

  // Tournaments
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [showTournModal, setShowTournModal] = useState(false);
  const [editingTourn, setEditingTourn] = useState<any>(null);
  const [tournName, setTournName] = useState('');
  const [tournDate, setTournDate] = useState(new Date().toISOString().slice(0, 10));
  const [tournFormat, setTournFormat] = useState('Double Elimination');
  const [tournEntryFee, setTournEntryFee] = useState('1000');
  const [tournPrizePool, setTournPrizePool] = useState('50000');
  const [tournImage, setTournImage] = useState('');
  const [tournStatus, setTournStatus] = useState<'draft' | 'published'>('published');

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Paddles');
  const [prodPrice, setProdPrice] = useState('4999');
  const [prodStock, setProdStock] = useState('20');
  const [prodImage, setProdImage] = useState('');
  const [prodStatus, setProdStatus] = useState<'active' | 'inactive'>('active');

  const isAdmin = Boolean(capabilities?.is_platform_admin || user?.is_platform_admin);

  const loadAll = async () => {
    try {
      const [clubList, evList, trList, prList] = await Promise.all([
        api.adminClubs().catch(() => []),
        api.adminEvents().catch(() => []),
        api.adminTournaments().catch(() => []),
        api.adminProducts().catch(() => []),
      ]);
      setClubs(clubList || []);
      setEvents(evList || []);
      setTournaments(trList || []);
      setProducts(prList || []);

      if (selectedClub) {
        const refreshed = (clubList || []).find((x: any) => x.id === selectedClub.id);
        if (refreshed) setSelectedClub(refreshed);
        const facs = await api.adminFacilities(selectedClub.id).catch(() => []);
        setFacilities(facs || []);
      } else if (clubList && clubList.length > 0) {
        setSelectedClub(clubList[0]);
        const facs = await api.adminFacilities(clubList[0].id).catch(() => []);
        setFacilities(facs || []);
      }
    } catch (e) {
      console.warn('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const u = await refresh();
        const hasAdmin = Boolean(u?.is_platform_admin || u?.capabilities?.is_platform_admin);
        if (hasAdmin) {
          await loadAll();
        }
      } catch (err) {
        console.warn('Error checking admin session:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <Loader />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.cardBox}>
          <Ionicons name="lock-closed" size={48} color={colors.error} style={{ alignSelf: 'center', marginBottom: spacing.md }} />
          <Text style={[styles.title, { textAlign: 'center' }]}>Admin Access Required</Text>
          <Text style={[styles.muted, { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }]}>
            {user
              ? `Logged in as ${user.mobile || user.name || user.id}. This account does not have platform admin privileges.`
              : 'You are not logged in. Please sign in with an administrator account.'}
          </Text>
          {capabilities.organizations && capabilities.organizations.length > 0 ? (
            <Pressable
              onPress={() => router.replace(`/club/${capabilities.organizations[0].org_id}` as any)}
              style={[styles.primary, { backgroundColor: colors.brandSecondary, marginBottom: spacing.sm }]}
            >
              <Text style={styles.primaryText}>Go to Club Workspace</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.back()} style={styles.primary}>
            <Text style={styles.primaryText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Club Actions
  async function saveClub() {
    if (!clubName.trim() || !clubCity.trim()) return Alert.alert('Missing details', 'Please enter club name and city.');
    setBusy(true);
    try {
      const club = await api.adminCreateClub({ name: clubName.trim(), city: clubCity.trim() });
      if (ownerMobile.trim()) {
        await api.adminAssignOwner(club.id, { mobile: ownerMobile.trim() });
      }
      setClubName('');
      setOwnerMobile('');
      setShowClubModal(false);
      await loadAll();
      Alert.alert('Club created', 'Club has been successfully registered.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  // Facility / Court Actions
  async function saveFacility() {
    if (!selectedClub) return Alert.alert('Error', 'Please select a club first.');
    if (!facilityName.trim() || !facilityCity.trim() || !facilityArea.trim()) {
      return Alert.alert('Missing details', 'Please enter court name, city, and area.');
    }
    setBusy(true);
    try {
      const payload = {
        name: facilityName.trim(),
        city: facilityCity.trim(),
        area: facilityArea.trim(),
        courts_count: Number(courtsCount) || 1,
        price_per_hour: Number(pricePerHour) || 600,
        image: facilityImage.trim() || undefined,
        sports: ['sport-pickleball'],
      };
      if (editingFacility) {
        await api.adminUpdateFacility(selectedClub.id, editingFacility.id, payload);
      } else {
        await api.adminCreateFacility(selectedClub.id, payload);
      }
      setShowCourtModal(false);
      setEditingFacility(null);
      setFacilityName('');
      setFacilityArea('');
      setFacilityImage('');
      const facs = await api.adminFacilities(selectedClub.id);
      setFacilities(facs || []);
      Alert.alert('Success', editingFacility ? 'Court updated.' : 'Court added to club.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFacility(fid: string) {
    Alert.alert('Deactivate Court?', 'It will no longer appear in public searches.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminDeleteFacility(selectedClub.id, fid);
            setFacilities(await api.adminFacilities(selectedClub.id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  // Event Actions
  async function saveEvent() {
    if (!eventName.trim() || !eventDate.trim()) return Alert.alert('Missing details', 'Enter event name and date.');
    setBusy(true);
    try {
      const payload = {
        name: eventName.trim(),
        date: `${eventDate}T10:00:00Z`,
        type: eventType,
        sport: 'sport-pickleball',
        price: Number(eventPrice) || 0,
        image: eventImage.trim() || undefined,
        status: eventStatus,
      };
      if (editingEvent) {
        await api.adminUpdateEvent(editingEvent.id, payload);
      } else {
        await api.adminCreateEvent(payload);
      }
      setShowEventModal(false);
      setEditingEvent(null);
      setEventName('');
      setEventImage('');
      setEvents(await api.adminEvents());
      Alert.alert('Success', 'Event saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id: string) {
    Alert.alert('Delete Event?', 'This will remove the event from public listings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminDeleteEvent(id);
            setEvents(await api.adminEvents());
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  // Tournament Actions
  async function saveTournament() {
    if (!tournName.trim() || !tournDate.trim()) return Alert.alert('Missing details', 'Enter tournament name and date.');
    setBusy(true);
    try {
      const payload = {
        name: tournName.trim(),
        date: `${tournDate}T09:00:00Z`,
        format: tournFormat,
        sport: 'sport-pickleball',
        entry_fee: Number(tournEntryFee) || 0,
        prize_pool: Number(tournPrizePool) || 0,
        image: tournImage.trim() || undefined,
        status: tournStatus,
      };
      if (editingTourn) {
        await api.adminUpdateTournament(editingTourn.id, payload);
      } else {
        await api.adminCreateTournament(payload);
      }
      setShowTournModal(false);
      setEditingTourn(null);
      setTournName('');
      setTournImage('');
      setTournaments(await api.adminTournaments());
      Alert.alert('Success', 'Tournament saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTournament(id: string) {
    Alert.alert('Delete Tournament?', 'This will remove the tournament from public listings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminDeleteTournament(id);
            setTournaments(await api.adminTournaments());
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  // Product Actions
  async function saveProduct() {
    if (!prodName.trim() || !prodCategory.trim() || !prodPrice) {
      return Alert.alert('Missing details', 'Enter product name, category, and price.');
    }
    setBusy(true);
    try {
      const payload = {
        name: prodName.trim(),
        category: prodCategory.trim(),
        sport: 'sport-pickleball',
        price: Number(prodPrice) || 0,
        stock: Number(prodStock) || 0,
        image: prodImage.trim() || undefined,
        status: prodStatus,
      };
      if (editingProduct) {
        await api.adminUpdateProduct(editingProduct.id, payload);
      } else {
        await api.adminCreateProduct(payload);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProdName('');
      setProdImage('');
      setProducts(await api.adminProducts());
      Alert.alert('Success', 'Product saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(id: string) {
    Alert.alert('Deactivate Product?', 'It will be hidden from the public shop.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminDeleteProduct(id);
            setProducts(await api.adminProducts());
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.wrap} testID="admin-dashboard-screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="admin-back" style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PLATFORM ADMIN</Text>
            <Text style={styles.heading}>Kuchu Puchu Management</Text>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} />
            <Text style={styles.adminBadgeText}>Master Admin</Text>
          </View>
        </View>

        {/* Tab Pills */}
        <View style={styles.tabContainer}>
          <Pressable onPress={() => setTab('clubs')} style={[styles.tabBtn, tab === 'clubs' && styles.tabBtnActive]}>
            <Ionicons name="business-outline" size={16} color={tab === 'clubs' ? colors.onBrandPrimary : colors.onSurfaceMuted} />
            <Text style={[styles.tabBtnText, tab === 'clubs' && styles.tabBtnTextActive]}>Clubs & Courts ({clubs.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('events')} style={[styles.tabBtn, tab === 'events' && styles.tabBtnActive]}>
            <Ionicons name="calendar-outline" size={16} color={tab === 'events' ? colors.onBrandPrimary : colors.onSurfaceMuted} />
            <Text style={[styles.tabBtnText, tab === 'events' && styles.tabBtnTextActive]}>Events ({events.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('tournaments')} style={[styles.tabBtn, tab === 'tournaments' && styles.tabBtnActive]}>
            <Ionicons name="trophy-outline" size={16} color={tab === 'tournaments' ? colors.onBrandPrimary : colors.onSurfaceMuted} />
            <Text style={[styles.tabBtnText, tab === 'tournaments' && styles.tabBtnTextActive]}>Tournaments ({tournaments.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('products')} style={[styles.tabBtn, tab === 'products' && styles.tabBtnActive]}>
            <Ionicons name="bag-outline" size={16} color={tab === 'products' ? colors.onBrandPrimary : colors.onSurfaceMuted} />
            <Text style={[styles.tabBtnText, tab === 'products' && styles.tabBtnTextActive]}>Shop Products ({products.length})</Text>
          </Pressable>
        </View>

        {/* Main Content Area */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* TAB 1: CLUBS & COURTS */}
          {tab === 'clubs' && (
            <>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Registered Clubs</Text>
                  <Text style={styles.muted}>Select a club to manage its venues and courts.</Text>
                </View>
                <Pressable onPress={() => setShowClubModal(true)} style={styles.smallPrimary}>
                  <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.smallPrimaryText}>Add Club</Text>
                </Pressable>
              </View>

              {clubs.length === 0 ? (
                <EmptyState title="No clubs created" subtitle="Add your first club organization above." />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {clubs.map((club) => (
                    <Pressable
                      key={club.id}
                      onPress={async () => {
                        setSelectedClub(club);
                        setFacilities(await api.adminFacilities(club.id).catch(() => []));
                      }}
                      style={[styles.clubRow, selectedClub?.id === club.id && styles.selectedRow]}
                    >
                      <View style={styles.clubIcon}>
                        <Ionicons name="business" size={20} color={colors.brandPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{club.name}</Text>
                        <Text style={styles.muted}>{club.city} · {club.status || 'active'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
                    </Pressable>
                  ))}
                </View>
              )}

              {selectedClub && (
                <View style={{ marginTop: spacing.xxl }}>
                  <View style={styles.sectionHead}>
                    <View>
                      <Text style={styles.sectionTitle}>{selectedClub.name} — Courts</Text>
                      <Text style={styles.muted}>{selectedClub.city}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setEditingFacility(null);
                        setFacilityName('');
                        setFacilityCity(selectedClub.city);
                        setFacilityArea('');
                        setFacilityImage('');
                        setShowCourtModal(true);
                      }}
                      style={styles.smallPrimary}
                    >
                      <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                      <Text style={styles.smallPrimaryText}>Add Court</Text>
                    </Pressable>
                  </View>

                  {facilities.length === 0 ? (
                    <EmptyState title="No courts in this club" subtitle="Click Add Court to add venues for this club." />
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {facilities.map((f) => (
                        <View key={f.id} style={styles.facilityRow}>
                          {f.image ? (
                            <Image source={{ uri: f.image }} style={styles.itemThumb} contentFit="cover" />
                          ) : (
                            <View style={[styles.itemThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                              <Ionicons name="tennisball-outline" size={20} color={colors.onSurfaceMuted} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{f.name}</Text>
                            <Text style={styles.muted}>{f.area}, {f.city} · {f.courts_count} court(s) · ₹{f.price_per_hour}/hr</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setEditingFacility(f);
                              setFacilityName(f.name);
                              setFacilityCity(f.city);
                              setFacilityArea(f.area);
                              setCourtsCount(String(f.courts_count));
                              setPricePerHour(String(f.price_per_hour));
                              setFacilityImage(f.image || '');
                              setShowCourtModal(true);
                            }}
                            style={styles.actionIcon}
                          >
                            <Ionicons name="create-outline" size={18} color={colors.brandPrimary} />
                          </Pressable>
                          <Pressable onPress={() => deleteFacility(f.id)} style={styles.actionIcon}>
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* TAB 2: EVENTS */}
          {tab === 'events' && (
            <>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Events</Text>
                  <Text style={styles.muted}>Create and manage workshops, clinics, and mixers.</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingEvent(null);
                    setEventName('');
                    setEventDate(new Date().toISOString().slice(0, 10));
                    setEventPrice('400');
                    setEventImage('');
                    setEventStatus('published');
                    setShowEventModal(true);
                  }}
                  style={styles.smallPrimary}
                >
                  <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.smallPrimaryText}>New Event</Text>
                </Pressable>
              </View>

              {events.length === 0 ? (
                <EmptyState title="No events added" subtitle="Create your first event above." icon="calendar-outline" />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {events.map((e) => (
                    <View key={e.id} style={styles.facilityRow}>
                      {e.image ? (
                        <Image source={{ uri: e.image }} style={styles.itemThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.itemThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                          <Ionicons name="calendar-outline" size={20} color={colors.onSurfaceMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{e.name}</Text>
                        <Text style={styles.muted}>{e.date?.slice(0, 10)} · ₹{e.price} · {e.status?.toUpperCase() || 'PUBLISHED'}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setEditingEvent(e);
                          setEventName(e.name);
                          setEventDate(e.date?.slice(0, 10) || '');
                          setEventType(e.type || 'Social Mixer');
                          setEventPrice(String(e.price || 0));
                          setEventImage(e.image || '');
                          setEventStatus(e.status || 'published');
                          setShowEventModal(true);
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.brandPrimary} />
                      </Pressable>
                      <Pressable onPress={() => deleteEvent(e.id)} style={styles.actionIcon}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* TAB 3: TOURNAMENTS */}
          {tab === 'tournaments' && (
            <>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Tournaments</Text>
                  <Text style={styles.muted}>Manage championships and competitive leagues.</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingTourn(null);
                    setTournName('');
                    setTournDate(new Date().toISOString().slice(0, 10));
                    setTournEntryFee('1000');
                    setTournPrizePool('50000');
                    setTournImage('');
                    setTournStatus('published');
                    setShowTournModal(true);
                  }}
                  style={styles.smallPrimary}
                >
                  <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.smallPrimaryText}>New Tournament</Text>
                </Pressable>
              </View>

              {tournaments.length === 0 ? (
                <EmptyState title="No tournaments created" subtitle="Create your first tournament above." icon="trophy-outline" />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {tournaments.map((t) => (
                    <View key={t.id} style={styles.facilityRow}>
                      {t.image ? (
                        <Image source={{ uri: t.image }} style={styles.itemThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.itemThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                          <Ionicons name="trophy-outline" size={20} color={colors.onSurfaceMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{t.name}</Text>
                        <Text style={styles.muted}>{t.date?.slice(0, 10)} · ₹{t.entry_fee} entry · Prize: ₹{t.prize_pool} · {t.status?.toUpperCase() || 'PUBLISHED'}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setEditingTourn(t);
                          setTournName(t.name);
                          setTournDate(t.date?.slice(0, 10) || '');
                          setTournFormat(t.format || 'Double Elimination');
                          setTournEntryFee(String(t.entry_fee || 0));
                          setTournPrizePool(String(t.prize_pool || 0));
                          setTournImage(t.image || '');
                          setTournStatus(t.status || 'published');
                          setShowTournModal(true);
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.brandPrimary} />
                      </Pressable>
                      <Pressable onPress={() => deleteTournament(t.id)} style={styles.actionIcon}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* TAB 4: SHOP PRODUCTS */}
          {tab === 'products' && (
            <>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Shop Products</Text>
                  <Text style={styles.muted}>Manage paddles, gear, balls, and apparel catalog.</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingProduct(null);
                    setProdName('');
                    setProdCategory('Paddles');
                    setProdPrice('4999');
                    setProdStock('20');
                    setProdImage('');
                    setProdStatus('active');
                    setShowProductModal(true);
                  }}
                  style={styles.smallPrimary}
                >
                  <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.smallPrimaryText}>Add Product</Text>
                </Pressable>
              </View>

              {products.length === 0 ? (
                <EmptyState title="No products in shop" subtitle="Add products to display in the marketplace." icon="bag-outline" />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {products.map((p) => (
                    <View key={p.id} style={styles.facilityRow}>
                      {p.image ? (
                        <Image source={{ uri: p.image }} style={styles.itemThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.itemThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                          <Ionicons name="bag-outline" size={20} color={colors.onSurfaceMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{p.name}</Text>
                        <Text style={styles.muted}>{p.category} · ₹{p.price} · Stock: {p.stock} · {p.status?.toUpperCase() || 'ACTIVE'}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setEditingProduct(p);
                          setProdName(p.name);
                          setProdCategory(p.category || 'Paddles');
                          setProdPrice(String(p.price || 0));
                          setProdStock(String(p.stock || 0));
                          setProdImage(p.image || '');
                          setProdStatus(p.status || 'active');
                          setShowProductModal(true);
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.brandPrimary} />
                      </Pressable>
                      <Pressable onPress={() => deleteProduct(p.id)} style={styles.actionIcon}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* CREATE CLUB MODAL */}
      <Modal visible={showClubModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Club</Text>
              <Pressable onPress={() => setShowClubModal(false)}><Ionicons name="close" size={22} color={colors.onSurfaceMuted} /></Pressable>
            </View>
            <Text style={styles.inputLabel}>Club Name</Text>
            <TextInput placeholder="e.g. Bangalore Pickleball Club" placeholderTextColor={colors.onSurfaceMuted} value={clubName} onChangeText={setClubName} style={styles.input} />
            <Text style={styles.inputLabel}>City</Text>
            <TextInput placeholder="e.g. Bangalore" placeholderTextColor={colors.onSurfaceMuted} value={clubCity} onChangeText={setClubCity} style={styles.input} />
            <Text style={styles.inputLabel}>Owner Mobile (optional)</Text>
            <TextInput placeholder="e.g. +919876543210" placeholderTextColor={colors.onSurfaceMuted} value={ownerMobile} onChangeText={setOwnerMobile} keyboardType="phone-pad" style={styles.input} />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowClubModal(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              <Pressable disabled={busy} onPress={saveClub} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>{busy ? 'Saving…' : 'Create Club'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* COURT MODAL */}
      <Modal visible={showCourtModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingFacility ? 'Edit Court' : 'Add Court'}</Text>
                <Pressable onPress={() => setShowCourtModal(false)}><Ionicons name="close" size={22} color={colors.onSurfaceMuted} /></Pressable>
              </View>
              <Text style={styles.inputLabel}>Court / Venue Name</Text>
              <TextInput placeholder="e.g. Center Court 1" placeholderTextColor={colors.onSurfaceMuted} value={facilityName} onChangeText={setFacilityName} style={styles.input} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Area / Locality</Text>
                  <TextInput placeholder="e.g. Koramangala" placeholderTextColor={colors.onSurfaceMuted} value={facilityArea} onChangeText={setFacilityArea} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput placeholder="e.g. Bangalore" placeholderTextColor={colors.onSurfaceMuted} value={facilityCity} onChangeText={setFacilityCity} style={styles.input} />
                </View>
              </View>
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Number of Courts</Text>
                  <TextInput placeholder="1" placeholderTextColor={colors.onSurfaceMuted} value={courtsCount} onChangeText={setCourtsCount} keyboardType="numeric" style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price per hour (₹)</Text>
                  <TextInput placeholder="600" placeholderTextColor={colors.onSurfaceMuted} value={pricePerHour} onChangeText={setPricePerHour} keyboardType="numeric" style={styles.input} />
                </View>
              </View>
              
              <ImageUploadField label="Court Photo" value={facilityImage} onChange={setFacilityImage} />

              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowCourtModal(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                <Pressable disabled={busy} onPress={saveFacility} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>{busy ? 'Saving…' : 'Save Court'}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* EVENT MODAL */}
      <Modal visible={showEventModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'Create Event'}</Text>
                <Pressable onPress={() => setShowEventModal(false)}><Ionicons name="close" size={22} color={colors.onSurfaceMuted} /></Pressable>
              </View>
              <Text style={styles.inputLabel}>Event Name</Text>
              <TextInput placeholder="e.g. Sunday Morning Mixer" placeholderTextColor={colors.onSurfaceMuted} value={eventName} onChangeText={setEventName} style={styles.input} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput placeholder="2026-09-10" placeholderTextColor={colors.onSurfaceMuted} value={eventDate} onChangeText={setEventDate} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ticket Price (₹)</Text>
                  <TextInput placeholder="400" placeholderTextColor={colors.onSurfaceMuted} value={eventPrice} onChangeText={setEventPrice} keyboardType="numeric" style={styles.input} />
                </View>
              </View>
              <Text style={styles.inputLabel}>Event Type</Text>
              <TextInput placeholder="e.g. Social Mixer, Clinic, Open Play" placeholderTextColor={colors.onSurfaceMuted} value={eventType} onChangeText={setEventType} style={styles.input} />

              <ImageUploadField label="Event Cover Image" value={eventImage} onChange={setEventImage} />

              <Text style={styles.inputLabel}>Visibility Status</Text>
              <View style={styles.roleToggle}>
                <Pressable onPress={() => setEventStatus('draft')} style={[styles.toggle, eventStatus === 'draft' && styles.toggleActive]}><Text style={[styles.toggleText, eventStatus === 'draft' && styles.toggleTextActive]}>Draft (Hidden)</Text></Pressable>
                <Pressable onPress={() => setEventStatus('published')} style={[styles.toggle, eventStatus === 'published' && styles.toggleActive]}><Text style={[styles.toggleText, eventStatus === 'published' && styles.toggleTextActive]}>Published (Public)</Text></Pressable>
              </View>

              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowEventModal(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                <Pressable disabled={busy} onPress={saveEvent} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>{busy ? 'Saving…' : 'Save Event'}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* TOURNAMENT MODAL */}
      <Modal visible={showTournModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingTourn ? 'Edit Tournament' : 'Create Tournament'}</Text>
                <Pressable onPress={() => setShowTournModal(false)}><Ionicons name="close" size={22} color={colors.onSurfaceMuted} /></Pressable>
              </View>
              <Text style={styles.inputLabel}>Tournament Name</Text>
              <TextInput placeholder="e.g. Bangalore Open Championship" placeholderTextColor={colors.onSurfaceMuted} value={tournName} onChangeText={setTournName} style={styles.input} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput placeholder="2026-09-25" placeholderTextColor={colors.onSurfaceMuted} value={tournDate} onChangeText={setTournDate} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Format</Text>
                  <TextInput placeholder="Double Elimination" placeholderTextColor={colors.onSurfaceMuted} value={tournFormat} onChangeText={setTournFormat} style={styles.input} />
                </View>
              </View>
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Entry Fee (₹)</Text>
                  <TextInput placeholder="1000" placeholderTextColor={colors.onSurfaceMuted} value={tournEntryFee} onChangeText={setTournEntryFee} keyboardType="numeric" style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Prize Pool (₹)</Text>
                  <TextInput placeholder="50000" placeholderTextColor={colors.onSurfaceMuted} value={tournPrizePool} onChangeText={setTournPrizePool} keyboardType="numeric" style={styles.input} />
                </View>
              </View>

              <ImageUploadField label="Tournament Banner" value={tournImage} onChange={setTournImage} />

              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.roleToggle}>
                <Pressable onPress={() => setTournStatus('draft')} style={[styles.toggle, tournStatus === 'draft' && styles.toggleActive]}><Text style={[styles.toggleText, tournStatus === 'draft' && styles.toggleTextActive]}>Draft</Text></Pressable>
                <Pressable onPress={() => setTournStatus('published')} style={[styles.toggle, tournStatus === 'published' && styles.toggleActive]}><Text style={[styles.toggleText, tournStatus === 'published' && styles.toggleTextActive]}>Published</Text></Pressable>
              </View>

              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowTournModal(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                <Pressable disabled={busy} onPress={saveTournament} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>{busy ? 'Saving…' : 'Save Tournament'}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* PRODUCT MODAL */}
      <Modal visible={showProductModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
                <Pressable onPress={() => setShowProductModal(false)}><Ionicons name="close" size={22} color={colors.onSurfaceMuted} /></Pressable>
              </View>
              <Text style={styles.inputLabel}>Product Name</Text>
              <TextInput placeholder="e.g. Pro Carbon Paddle" placeholderTextColor={colors.onSurfaceMuted} value={prodName} onChangeText={setProdName} style={styles.input} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput placeholder="e.g. Paddles, Balls, Bags" placeholderTextColor={colors.onSurfaceMuted} value={prodCategory} onChangeText={setProdCategory} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price (₹)</Text>
                  <TextInput placeholder="4999" placeholderTextColor={colors.onSurfaceMuted} value={prodPrice} onChangeText={setProdPrice} keyboardType="numeric" style={styles.input} />
                </View>
              </View>
              <Text style={styles.inputLabel}>Stock Quantity</Text>
              <TextInput placeholder="20" placeholderTextColor={colors.onSurfaceMuted} value={prodStock} onChangeText={setProdStock} keyboardType="numeric" style={styles.input} />

              <ImageUploadField label="Product Photo" value={prodImage} onChange={setProdImage} />

              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.roleToggle}>
                <Pressable onPress={() => setProdStatus('active')} style={[styles.toggle, prodStatus === 'active' && styles.toggleActive]}><Text style={[styles.toggleText, prodStatus === 'active' && styles.toggleTextActive]}>Active</Text></Pressable>
                <Pressable onPress={() => setProdStatus('inactive')} style={[styles.toggle, prodStatus === 'inactive' && styles.toggleActive]}><Text style={[styles.toggleText, prodStatus === 'inactive' && styles.toggleTextActive]}>Inactive</Text></Pressable>
              </View>

              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowProductModal(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                <Pressable disabled={busy} onPress={saveProduct} style={styles.modalSubmit}><Text style={styles.modalSubmitText}>{busy ? 'Saving…' : 'Save Product'}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Image Upload Component (Photo Picker + Preview)
// ---------------------------------------------------------------------------
function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
}) {
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    setPicking(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        if (asset.base64) {
          onChange(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          onChange(asset.uri);
        }
      }
    } catch (e: any) {
      Alert.alert('Image Picker', e?.message || 'Could not pick image.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.uploadContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      {value ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: value }} style={styles.previewImg} contentFit="cover" />
          <View style={styles.previewMeta}>
            <Text style={styles.previewText}>Photo selected</Text>
            <View style={styles.previewBtns}>
              <Pressable onPress={handlePick} style={styles.changeBtn}>
                <Ionicons name="camera-reverse-outline" size={15} color={colors.onSurface} />
                <Text style={styles.changeBtnText}>Change Photo</Text>
              </Pressable>
              <Pressable onPress={() => onChange('')} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.error} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={handlePick} style={styles.uploadDropzone} disabled={picking}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="image-outline" size={24} color={colors.brandPrimary} />
          </View>
          <Text style={styles.uploadTitle}>{picking ? 'Opening Gallery…' : 'Choose Photo from Device'}</Text>
          <Text style={styles.uploadSubtitle}>Tap to browse photo gallery</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, marginRight: spacing.sm },
  eyebrow: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandSecondary },
  adminBadgeText: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '800' },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  tabBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabBtnText: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, fontWeight: '700' },
  tabBtnTextActive: { color: colors.onBrandPrimary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  cardBox: { maxWidth: 440, width: '100%', backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  muted: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  smallPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  smallPrimaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.xs },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  selectedRow: { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary },
  clubIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  itemThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  inputLabel: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.md, fontSize: font.sizes.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  primary: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', paddingHorizontal: spacing.xl },
  primaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.base },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, maxWidth: 540, width: '100%', alignSelf: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  modalBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.onSurfaceMuted, fontWeight: '700' },
  modalSubmit: { flex: 1, backgroundColor: colors.brandPrimary, paddingVertical: 12, alignItems: 'center', borderRadius: radius.pill },
  modalSubmitText: { color: colors.onBrandPrimary, fontWeight: '800' },
  roleToggle: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  toggle: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  toggleText: { color: colors.onSurfaceMuted, fontWeight: '700', fontSize: font.sizes.xs },
  toggleTextActive: { color: colors.onBrandPrimary },
  uploadContainer: { marginBottom: spacing.md },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle: { color: colors.onSurface, fontSize: font.sizes.sm, fontWeight: '700' },
  uploadSubtitle: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewImg: { width: 72, height: 72, borderRadius: radius.sm },
  previewMeta: { flex: 1, gap: 6 },
  previewText: { color: colors.onSurface, fontSize: font.sizes.sm, fontWeight: '700' },
  previewBtns: { flexDirection: 'row', gap: spacing.sm },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  changeBtnText: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,0,0,0.3)', backgroundColor: 'rgba(255,0,0,0.08)' },
  removeBtnText: { color: colors.error, fontSize: font.sizes.xs, fontWeight: '700' },
});
