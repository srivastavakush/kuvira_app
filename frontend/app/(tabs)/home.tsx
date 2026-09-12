import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, useWindowDimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, radius, elevation } from '@/src/theme';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { Brand } from '@/src/components/brand';
import { Avatar, Button, EmptyState } from '@/src/components/ui';
import { ErrorBanner, SkeletonCards } from '@/src/components/states';
import { SPORTS, sportsLabel, money, dateLabel } from '@/src/sports';
import { FavoriteButton } from '@/src/components/favorite';

const SHORTCUTS = [
  { label: 'Book a Court', icon: 'tennisball-outline', color: '#E1FFD2', path: '/(tabs)/discover?category=facilities' },
  { label: 'Find Players', icon: 'people-outline', color: '#FFE0ED', path: '/(tabs)/play?tab=players' },
  { label: 'Play Tournaments', icon: 'trophy-outline', color: '#FFF1AA', path: '/(tabs)/discover?category=tournaments' },
  { label: 'What’s Happening', icon: 'calendar-outline', color: '#E9E0FF', path: '/(tabs)/discover?category=events' },
  { label: 'Gear Up', icon: 'bag-handle-outline', color: '#DBECFF', path: '/marketplace' },
  { label: 'Ask AI Coach', icon: 'sparkles-outline', color: '#FFE1EF', path: '/ai-coach' },
] as const;
type Feed = Record<'facilities' | 'events' | 'players' | 'tournaments' | 'games' | 'products', any[]>;
const EMPTY: Feed = { facilities: [], events: [], players: [], tournaments: [], games: [], products: [] };

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const [data, setData] = useState<Feed>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [cityError, setCityError] = useState<unknown>();
  const load = useCallback(async () => {
    const results = await Promise.allSettled([api.facilities(city ? { city } : {}), api.events(city ? { city } : undefined), api.players(), api.tournaments(city ? { city } : undefined), api.games(city ? { city } : {}), api.products()]);
    const keys = Object.keys(EMPTY) as (keyof Feed)[];
    const failed: string[] = [];
    const updates: Partial<Feed> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) updates[keys[index]] = result.value;
        else failed.push(keys[index]);
      });
    setData(previous => ({ ...previous, ...updates }));
    setErrors(failed); setLoading(false); setRefreshing(false);
  }, [city]);
  useEffect(() => { load(); }, [load]);
  async function openLocation() {
    setLocationOpen(true); setCityError(null);
    try { const list = await api.cities(); setCities((Array.isArray(list) ? list : list?.cities || []).map((x: any) => typeof x === 'string' ? x : x.name || x.city).filter(Boolean)); }
    catch (e) { setCityError(e); }
  }
  function navigate(path: string) { router.push(path as any); }
  const cardWidth = wide ? (Math.min(width, 1200) - 64) / 3 : Math.min(width - 52, 320);
  function Rail({ children }: { children: React.ReactNode }) {
    return wide ? <View style={s.grid}>{children}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>{children}</ScrollView>;
  }
  function empty(key: keyof Feed, title: string) { return data[key].length ? null : <EmptyState title={errors.includes(key) ? 'Taking a timeout' : title} subtitle={errors.includes(key) ? 'We couldn’t load this section. Please try again.' : 'Explore another area or check back for new activity.'} cta={errors.includes(key) ? 'Try again' : undefined} onCta={load} icon={errors.includes(key) ? 'cloud-offline-outline' : 'tennisball-outline'} />; }
  const clubs = data.facilities.filter((f, i, all) => f.org_name && all.findIndex(x => x.org_id === f.org_id) === i);
  return <SafeAreaView edges={['top']} style={s.wrap} testID="home-screen">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={s.header}><View style={{ flex: 1, gap: 5 }}><Brand /><Pressable accessibilityRole="button" accessibilityLabel="Choose location" onPress={openLocation} style={s.location}><Ionicons name="location" size={16} color={c.accent} /><Text style={s.meta}>{city || 'Explore India'}</Text><Ionicons name="chevron-down" size={14} color={c.text} /></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="Notifications and activity" onPress={() => navigate('/(tabs)/activity')} style={s.iconButton}><Ionicons name="notifications-outline" size={24} color={c.text} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => navigate('/(tabs)/profile')} style={s.iconButton}><Avatar uri={user?.avatar || undefined} name={user?.name || 'Player'} size={42} /></Pressable></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Search courts, players and events" onPress={() => navigate('/(tabs)/discover')} style={s.search}><Ionicons name="search-outline" size={23} color={c.text} /><Text style={[s.meta, { flex: 1 }]}>Search courts, players, events</Text><Ionicons name="options-outline" size={22} color={c.text} /></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shortcuts}>{SHORTCUTS.map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => navigate(item.path)} style={[s.shortcut, { backgroundColor: item.color }]}><Ionicons name={item.icon} size={30} color={c.text} /><Text style={s.shortcutText}>{item.label}</Text></Pressable>)}</ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Game On? Find your squad" onPress={() => navigate('/(tabs)/play')} style={s.hero}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1400&q=85' }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Tennis court" />
        <LinearGradient colors={['rgba(8,28,43,0.96)', 'rgba(8,28,43,0.45)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={s.heroBody}><Text style={s.eyebrow}>GOOD GAMES. GREAT PEOPLE.</Text><Text style={s.heroTitle}>Game On?</Text><Text style={s.heroSub}>Find your game.{`\n`}Find your people.</Text><View style={s.heroCta}><Text style={s.heroCtaText}>Find Your Squad</Text><Ionicons name="arrow-forward" size={20} color={c.text} /></View></View>
        {wide && <Text style={s.heroSticker}>SAME SPORT.{`\n`}MORE PEOPLE. ↗</Text>}
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sports}>{SPORTS.map(sport => <Pressable key={sport} accessibilityRole="button" onPress={() => navigate(`/(tabs)/discover?sport=${encodeURIComponent(sport)}`)} style={s.sport}><Text style={s.sportText}>{sport}</Text></Pressable>)}</ScrollView>
      {errors.length > 0 && <ErrorBanner error={`Some sections couldn’t load (${errors.join(', ')}). Your available results are shown below.`} retry={load} />}
      {loading ? <SkeletonCards /> : <>
        <Heading title="Popular Near You" action="All courts" onPress={() => navigate('/(tabs)/discover?category=facilities')} />
        {empty('facilities', 'Your next court is on its way')}
        <Rail>{data.facilities.slice(0, 6).map(f => <View key={f.id} style={[s.card, { width: cardWidth }]}><View><Photo uri={f.image} /><View style={s.favorite}><FavoriteButton id={f.id} /></View></View><View style={s.body}><Text style={s.cardTitle}>{f.name}</Text><Text style={s.meta}>{f.area || f.city || 'Location not listed'}{typeof f.distance_km === 'number' ? ` · ${f.distance_km.toFixed(1)} km` : ''}</Text><Text style={s.sportText}>{sportsLabel(f)}</Text><View style={s.cardFooter}><Text style={s.price}>{money(f.price_per_hour)}{typeof f.price_per_hour === 'number' ? '/hr' : ''}</Text></View><Button label="View slots" onPress={() => navigate(`/facility/${f.id}`)} iconRight={<Ionicons name="arrow-forward" size={18} color="white" />} /><Text style={s.caption}>Check live availability before booking</Text></View></View>)}</Rail>
        <Heading title="What’s Happening" action="All events" onPress={() => navigate('/(tabs)/discover?category=events')} />
        {empty('events', 'Make room for your next plan')}
        <Rail>{data.events.slice(0, 6).map((e, i) => <View key={e.id} style={[s.card, { width: cardWidth, backgroundColor: i % 2 ? '#F0E9FF' : '#FFF5CC' }]}><Photo uri={e.image} /><View style={s.body}><Text style={s.sportText}>{dateLabel(e.date)}</Text><Text style={s.cardTitle}>{e.name}</Text><Text style={s.meta}>{e.venue || e.city || 'Venue to be announced'}</Text><Text style={s.meta}>{sportsLabel(e)}{e.skill_level ? ` · ${e.skill_level}` : ''}</Text>{typeof e.spots_remaining === 'number' && <Text style={s.sportText}>{Math.max(0, e.spots_remaining)} spots left</Text>}<Button label="View event" variant="secondary" onPress={() => navigate(`/event/${e.id}`)} /></View></View>)}</Rail>
        <Heading title="Who’s Playing?" action="Find players" onPress={() => navigate('/(tabs)/play?tab=players')} />
        {empty('players', 'Find your people')}
        <Rail>{data.players.filter(p => !city || p.city === city).slice(0, 6).map(p => <Pressable accessibilityRole="button" key={p.id} onPress={() => navigate(`/player/${p.id}`)} style={[s.card, s.player, { width: cardWidth }]}><Avatar uri={p.avatar} name={p.name} size={64} /><View style={{ flex: 1, gap: 5 }}><Text style={s.cardTitle}>{p.name || 'Player'}</Text><Text style={s.meta}>{sportsLabel(p)}</Text><Text style={s.meta}>{[p.skill_level, p.city].filter(Boolean).join(' · ')}</Text>{p.availability && <Text style={s.sportText}>{p.availability}</Text>}</View></Pressable>)}</Rail>
        <Heading title="Open games" action="Find a game" onPress={() => navigate('/(tabs)/play')} />
        {empty('games', 'Start something worth showing up for')}
        <Rail>{data.games.slice(0, 6).map(g => <View key={g.id} style={[s.card, { width: cardWidth }]}><View style={s.body}><Text style={[s.eyebrow, { color: c.success }]}>OPEN GAME</Text><Text style={s.cardTitle}>{sportsLabel(g)} · {g.format || 'Game'}</Text><Text style={s.meta}>{dateLabel(g.date)}</Text><Text style={s.meta}>{g.facility?.name || 'Venue to be confirmed'}</Text><Text style={s.meta}>{g.skill_level || 'Level not listed'}{typeof g.slots_remaining === 'number' ? ` · ${g.slots_remaining} spots left` : ''}</Text><Button label="View game" onPress={() => navigate(`/game/${g.id}`)} /></View></View>)}</Rail>
        <Heading title="Play Tournaments" action="See all" onPress={() => navigate('/(tabs)/discover?category=tournaments')} />
        {empty('tournaments', 'Your next challenge is coming')}
        <Rail>{data.tournaments.slice(0, 6).map(t => <Pressable accessibilityRole="button" key={t.id} onPress={() => navigate(`/(tabs)/discover?category=tournaments&highlight=${t.id}`)} style={[s.card, s.body, { width: cardWidth, backgroundColor: '#E8EFFF' }]}><Ionicons name="trophy-outline" size={28} color={c.text} /><Text style={s.cardTitle}>{t.name}</Text><Text style={s.meta}>{dateLabel(t.date)} · {t.city}</Text><Text style={s.sportText}>{sportsLabel(t)} · Entry {money(t.entry_fee)}</Text></Pressable>)}</Rail>
        <Heading title="Clubs & communities" action="Explore" onPress={() => navigate('/(tabs)/discover')} />
        {clubs.length ? <Rail>{clubs.map(f => <Pressable key={f.org_id} accessibilityRole="button" onPress={() => navigate(`/facility/${f.id}`)} style={[s.card, s.body, { width: cardWidth }]}><Ionicons name="people-circle-outline" size={30} color={c.accent} /><Text style={s.cardTitle}>{f.org_name}</Text><Text style={s.meta}>{f.city}</Text></Pressable>)}</Rail> : <View style={s.callout}><Text style={s.cardTitle}>Good Games. Great People.</Text><Text style={s.meta}>Explore venues and open games to meet your local sporting community.</Text><Button label="Explore venues" variant="secondary" onPress={() => navigate('/(tabs)/discover?category=facilities')} /></View>}
        <Heading title="Gear Up" action="Shop all" onPress={() => navigate('/marketplace')} />
        {empty('products', 'Fresh gear is on its way')}
        <Rail>{data.products.slice(0, 6).map(p => <Pressable key={p.id} accessibilityRole="button" onPress={() => navigate(`/product/${p.id}`)} style={[s.card, { width: cardWidth }]}><Photo uri={p.image} /><View style={s.body}><Text style={s.cardTitle}>{p.name}</Text><Text style={s.price}>{money(p.price)}</Text></View></Pressable>)}</Rail>
      </>}
      <View style={[s.callout, { backgroundColor: c.text }]}><Text style={s.eyebrow}>YOUR GAME. YOUR NEXT LEVEL.</Text><Text style={[s.heroSub, { fontWeight: '800' }]}>Ready to Play?</Text><Text style={[s.meta, { color: '#DDE6EE' }]}>Choose your sport, level and goal. Get coaching grounded in what your match video actually shows.</Text><Button label="Meet your AI Coach" onPress={() => navigate('/ai-coach')} /></View>
      <Text style={s.endnote}>MatchDrome · Find your game. Find your people.</Text>
    </ScrollView>
    <Modal transparent visible={locationOpen} animationType="fade" onRequestClose={() => setLocationOpen(false)}><View style={s.modal}><View style={s.locationSheet}><Text style={s.cardTitle}>Where’s your next game?</Text><ErrorBanner error={cityError} retry={openLocation} /><ScrollView><Button label="Explore all India" variant="secondary" onPress={() => { setCity(''); setLocationOpen(false); }} />{cities.map(name => <Button key={name} label={name} variant="secondary" onPress={() => { setCity(name); setData(EMPTY); setLoading(true); setLocationOpen(false); }} style={{ marginTop: 8 }} />)}</ScrollView><Button label="Close" variant="ghost" onPress={() => setLocationOpen(false)} /></View></View></Modal>
  </SafeAreaView>;
}
function Photo({ uri }: { uri?: string }) { const [failed, setFailed] = useState(false); return uri && !failed ? <Image source={{ uri }} style={s.photo} contentFit="cover" onError={() => setFailed(true)} /> : <View style={[s.photo, s.placeholder]}><Ionicons name="tennisball-outline" size={36} color={c.textMuted} /><Text style={s.caption}>See details</Text></View>; }
function Heading({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={s.heading}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>{action} ↗</Text></Pressable></View>; }
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg }, page: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingBottom: 28 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }, location: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 36 }, iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, search: { marginHorizontal: 16, paddingHorizontal: 16, minHeight: 54, borderRadius: 18, backgroundColor: c.bgRaised, flexDirection: 'row', alignItems: 'center', gap: 12 }, shortcuts: { gap: 10, padding: 16 }, shortcut: { width: 118, minHeight: 112, borderRadius: 20, padding: 12, justifyContent: 'space-between' }, shortcutText: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: c.text }, hero: { marginHorizontal: 16, minHeight: 254, backgroundColor: c.text, borderRadius: 24, overflow: 'hidden' }, heroBody: { padding: 24, gap: 8 }, eyebrow: { fontSize: 11, fontWeight: '800', color: c.lime, letterSpacing: 1.2 }, heroTitle: { fontSize: 46, fontWeight: '900', color: 'white', letterSpacing: -2 }, heroSub: { fontSize: 22, lineHeight: 29, color: 'white' }, heroCta: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: c.lime, paddingHorizontal: 18, minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }, heroCtaText: { color: c.text, fontWeight: '800', fontSize: 15 }, heroSticker: { position: 'absolute', right: 36, top: 64, transform: [{ rotate: '8deg' }], color: c.lime, fontSize: 26, fontWeight: '900' }, sports: { padding: 16, gap: 8 }, sport: { paddingHorizontal: 14, minHeight: 44, borderWidth: 1, borderColor: c.border, backgroundColor: 'white', borderRadius: 22, justifyContent: 'center' }, sportText: { fontSize: 13, color: c.text, fontWeight: '600' }, heading: { marginHorizontal: 16, marginTop: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, sectionTitle: { color: c.text, fontSize: 24, fontWeight: '900', letterSpacing: -.7 }, link: { color: c.textSecondary, fontSize: 13, fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 16 }, rail: { gap: 12, paddingHorizontal: 16, paddingBottom: 8 }, card: { borderRadius: radius.lg, backgroundColor: 'white', overflow: 'hidden', borderWidth: 1, borderColor: c.border, ...elevation.low }, photo: { height: 156, width: '100%', backgroundColor: c.bgRaised }, placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8 }, body: { padding: 16, gap: 10 }, cardTitle: { fontSize: 19, fontWeight: '800', color: c.text, letterSpacing: -.3 }, meta: { fontSize: 14, lineHeight: 20, color: c.textSecondary }, caption: { fontSize: 12, lineHeight: 17, color: c.textMuted }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, price: { fontSize: 17, color: c.text, fontWeight: '800' }, favorite: { position: 'absolute', right: 10, top: 10 }, player: { padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }, callout: { padding: 22, margin: 16, borderRadius: 24, backgroundColor: '#E9FAD9', gap: 14 }, endnote: { padding: 16, color: c.textMuted, fontSize: 12, textAlign: 'center' }, modal: { flex: 1, backgroundColor: 'rgba(8,28,43,.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }, locationSheet: { maxHeight: '85%', width: '100%', maxWidth: 460, borderRadius: 24, backgroundColor: 'white', padding: 24, gap: 16 },
});
