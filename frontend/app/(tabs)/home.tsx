import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet as NativeStyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, elevation, font, radius, spacing } from '@/src/theme';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { Avatar, Loader } from '@/src/components/ui';

const StyleSheet = Object.assign(NativeStyleSheet, { absoluteFillObject: NativeStyleSheet.absoluteFill });

const CREW = require('../../assets/images/brand/kuchu-puchu-crew.png');
const MASCOTS = require('../../assets/images/brand/kuchu-puchu-mascots-sticker.png');
const ACTIONS = [
  { label: 'Book a\nCourt', icon: 'tennisball-outline' as const, color: c.lime, to: '/(tabs)/discover' },
  { label: 'Find\nPlayers', icon: 'people-outline' as const, color: '#FFB9DD', to: '/(tabs)/play' },
  { label: 'Play\nTournaments', icon: 'trophy-outline' as const, color: c.yellow, to: '/(tabs)/discover' },
  { label: "What's\nHappening", icon: 'calendar-outline' as const, color: c.purple, to: '/(tabs)/discover' },
  { label: 'Gear Up', icon: 'bag-handle-outline' as const, color: c.blue, to: '/marketplace' },
  { label: 'Ask AI\nCoach', icon: 'sparkles-outline' as const, color: '#FFC2E2', to: '/ai-coach' },
];
const SPORTS = [
  { name: 'Badminton', icon: '🏸', color: c.lime }, { name: 'Cricket', icon: '🏏', color: c.yellow },
  { name: 'Football', icon: '⚽', color: c.blue }, { name: 'Tennis', icon: '🎾', color: c.purple }, { name: 'Pickleball', icon: '◉', color: '#FFB9DD' },
];
const PLAYER_VIBES = [
  { sport: 'Badminton', status: 'Looking for a rally', color: c.lime }, { sport: 'Football', status: 'Game on tonight', color: c.blue },
  { sport: 'Tennis', status: 'Ready to play', color: c.yellow }, { sport: 'Cricket', status: 'Weekend squad?', color: c.accentSoft },
  { sport: 'Pickleball', status: 'Dink partner wanted', color: c.purple }, { sport: 'Badminton', status: 'Let’s go!', color: c.lime },
];

function dateLabel(value: string) {
  const d = new Date(value);
  return { day: String(d.getDate()), month: d.toLocaleString('en', { month: 'short' }).toUpperCase() };
}
function sportFor(index: number) { return SPORTS[index % SPORTS.length].name; }

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const [data, setData] = useState<any>();
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const [facilities, events, players, tournaments] = await Promise.all([
      api.facilities().catch(() => []), api.events().catch(() => []), api.players().catch(() => []), api.tournaments().catch(() => []),
    ]);
    setData({ facilities: facilities.slice(0, 5), events: events.slice(0, 4), players: players.slice(0, 7), tournaments: tournaments.slice(0, 3) });
  }, []);
  useEffect(() => { load(); }, [load]);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  if (!data) return <SafeAreaView style={styles.wrap}><Loader /></SafeAreaView>;

  return <SafeAreaView style={styles.wrap} edges={['top']} testID="home-screen">
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />} contentContainerStyle={styles.content}>
      <View style={[styles.header, mobileStyles.header]}>
        <View style={mobileStyles.wordmark} accessibilityLabel="Kuchu Puchu">
          <Text style={mobileStyles.wordmarkKuchu}>KUCHU</Text><Text style={mobileStyles.wordmarkPuchu}>PUCHU</Text><Ionicons name="sparkles" size={12} color={c.lime} style={mobileStyles.wordmarkSpark} />
        </View>
        <Pressable onPress={() => router.push('/(tabs)/discover')} style={styles.location}><Ionicons name="location" color={c.accent} size={17}/><Text style={styles.locationText}>{user?.city || 'Delhi NCR'}</Text><Ionicons name="chevron-down" color={c.text} size={15}/></Pressable>
        <Pressable onPress={() => router.push('/(tabs)/discover')} style={styles.headerCircle}><Ionicons name="search-outline" color={c.text} size={20}/></Pressable>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.headerCircle}><Ionicons name="notifications-outline" color={c.text} size={20}/><View style={styles.noticeDot}/></Pressable>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.profileDot}><Ionicons name="person-outline" color={c.text} size={20}/><View style={styles.onlineDot}/></Pressable>
      </View>

      <Pressable onPress={() => router.push('/(tabs)/discover')} style={styles.search} testID="home-search-btn"><Ionicons name="search-outline" color={c.text} size={22}/><Text style={styles.searchText}>Search courts, players, events...</Text><Ionicons name="options-outline" color={c.text} size={21}/></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRail}>
        {ACTIONS.map((item) => <Pressable key={item.label} onPress={() => router.push(item.to as any)} style={styles.action} testID={`home-quick-${item.label.replace(/\W/g, '')}`}><View style={[styles.actionIcon, { backgroundColor: item.color }]}><Ionicons name={item.icon} color={c.text} size={30}/></View><Text style={styles.actionLabel}>{item.label}</Text><View style={[styles.actionArrow, { backgroundColor: item.color }]}><Ionicons name="arrow-forward" color={c.text} size={16}/></View></Pressable>)}
      </ScrollView>

      <Pressable onPress={() => router.push('/(tabs)/play')} style={[styles.hero, mobileStyles.hero]} testID="home-hero">
        <Image source={CREW} style={styles.heroImage} contentFit="cover" />
        <View style={styles.heroShade}/><Image source={MASCOTS} style={styles.heroMascots} contentFit="contain"/><Text style={styles.zap}>⚡</Text><View style={styles.heroCopy}><Text style={styles.heroEyebrow}>★ DELHI PLAYS DIFFERENT</Text><Text style={styles.heroTitle}>GAME ON?</Text><Text style={styles.heroNote}>Find your squad{`\n`}in the city.</Text><View style={styles.heroButton}><Text style={styles.heroButtonText}>Explore now</Text><Ionicons name="arrow-forward" color={c.onAccent} size={18}/></View></View>
      </Pressable>

      <Header title="Popular Near You" icon="location" action="See all" onPress={() => router.push('/(tabs)/discover')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {data.facilities.map((f: any, index: number) => <Pressable key={f.id} style={styles.facility} onPress={() => router.push(`/facility/${f.id}`)} testID={`home-facility-${f.id}`}>
          {f.image ? <Image source={{ uri: f.image }} style={styles.facilityImage} contentFit="cover"/> : <View style={[styles.facilityImage, { backgroundColor: c.lime }]} />}
          <View style={[styles.distance, { backgroundColor: index % 2 ? c.blue : c.lime }]}><Text style={styles.distanceText}>{(2.1 + index * 1.3).toFixed(1)} km</Text></View>
          <Text style={styles.facilityTitle} numberOfLines={1}>{f.name}</Text><Text style={styles.facilityMeta}><Ionicons name="location-outline" size={11} /> {f.area || f.city}</Text>
          <View style={styles.tagRow}><Text style={styles.sportTag}>{sportFor(index)}</Text><Text style={styles.sportTag}>{SPORTS[(index + 2) % SPORTS.length].name}</Text><Text style={[styles.openTag, { backgroundColor: index % 3 === 2 ? '#FFF1A5' : '#D5FFE1' }]}>{index % 3 === 2 ? 'Few slots left' : 'Open now'}</Text></View>
        </Pressable>)}
      </ScrollView>

      <Header title="What’s Happening" icon="flame" action="See all" onPress={() => router.push('/(tabs)/discover')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {data.events.map((event: any, index: number) => { const date = dateLabel(event.date); return <Pressable key={event.id} style={styles.event} onPress={() => router.push('/(tabs)/discover')} testID={`home-event-${event.id}`}>
          {event.image ? <Image source={{ uri: event.image }} style={styles.eventImage} contentFit="cover"/> : <View style={[styles.eventImage, { backgroundColor: index % 2 ? c.lime : c.yellow }]} />}
          <View style={[styles.eventDoodle, { backgroundColor: SPORTS[index % SPORTS.length].color }]}><Text style={styles.eventDoodleText}>{sportFor(index)}</Text></View><View style={styles.date}><Text style={styles.dateDay}>{date.day}</Text><Text style={styles.dateMonth}>{date.month}</Text></View>
          <View style={styles.eventBody}><Text style={styles.eventName} numberOfLines={1}>{event.name}</Text><Text style={styles.eventMeta}>{event.city || 'Delhi NCR'} · {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text><View style={styles.eventFoot}><Text style={styles.eventLevel}>All levels · {event.participants_count || 12} playing</Text><View style={styles.join}><Text style={styles.joinText}>Let’s go!</Text></View></View></View>
        </Pressable>; })}
      </ScrollView>

      <Header title="Who’s Playing?" icon="people" action="Find your squad" onPress={() => router.push('/(tabs)/play')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.players}>
        {data.players.map((player: any, index: number) => { const vibe = PLAYER_VIBES[index % PLAYER_VIBES.length]; return <Pressable key={player.id} style={styles.player} onPress={() => router.push(`/player/${player.id}`)}><View style={[styles.avatarRing, { borderColor: vibe.color }]}><Avatar uri={player.avatar} name={player.name} size={52}/><View style={[styles.playerOnline, { backgroundColor: vibe.color }]} /></View><Text style={styles.playerName} numberOfLines={1}>{player.name}</Text><Text style={styles.playerSport}>{vibe.sport}</Text><Text style={styles.playerKm}>{index + 2} km</Text></Pressable>; })}
      </ScrollView>

      {data.tournaments.length > 0 && <><Header title="Play Tournaments" icon="trophy" action="See all" onPress={() => router.push('/(tabs)/discover')} /><View style={styles.tournamentList}>{data.tournaments.map((t: any, i: number) => <Pressable key={t.id} onPress={() => router.push('/(tabs)/discover')} style={[styles.tournament, { backgroundColor: i % 2 ? c.blue : c.yellow }]}><Ionicons name="trophy-outline" size={28} color={c.text}/><View style={{ flex: 1 }}><Text style={styles.tournamentName}>{t.name}</Text><Text style={styles.tournamentMeta}>{t.city || 'Delhi NCR'} · {t.sport?.name || 'Multi-sport'}</Text></View><Ionicons name="arrow-forward" size={20} color={c.text}/></Pressable>)}</View></>}

      <Pressable onPress={() => router.push('/ai-coach')} style={styles.coach}><Image source={MASCOTS} style={styles.coachMascot} contentFit="contain"/><View style={{ flex: 1 }}><Text style={styles.coachTitle}>Ready to Play?</Text><Text style={styles.coachText}>Ask AI Coach for smarter moves, drills and game-day confidence.</Text></View><View style={styles.coachBtn}><Ionicons name="sparkles" size={18} color={c.onAccent}/><Text style={styles.coachBtnText}>Ask Coach</Text></View></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Header({ title, icon, action, onPress }: { title: string; icon: any; action: string; onPress: () => void }) { return <View style={styles.sectionHead}><View style={styles.sectionTitle}><Ionicons name={icon} color={c.accent} size={21}/><Text style={styles.sectionText}>{title}</Text></View><Pressable onPress={onPress} style={styles.seeAll}><Text style={styles.seeAllText}>{action}</Text><Ionicons name="arrow-forward" color={c.text} size={15}/></Pressable></View>; }

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg }, content: { paddingBottom: 116 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 9 },
  logoImage: { width: 116, height: 105, marginTop: -15, marginBottom: -11 },
  location: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bgRaised, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 10 }, locationText: { fontWeight: font.weights.black, fontSize: 12 }, headerCircle: { width: 38, height: 38, borderRadius: 20, backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center', position: 'relative' }, noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, position: 'absolute', top: 6, right: 7 }, profileDot: { width: 38, height: 38, borderRadius: 20, backgroundColor: c.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.text, position: 'relative' }, onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: c.bg, backgroundColor: c.success },
  search: { marginHorizontal: spacing.lg, backgroundColor: c.bgRaised, height: 52, borderRadius: radius.pill, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 }, searchText: { flex: 1, color: c.textMuted, fontSize: 14 },
  sportRail: { paddingHorizontal: spacing.lg, paddingTop: 12, gap: 8 }, sportPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: c.text, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, sportEmoji: { fontSize: 14 }, sportPillText: { fontWeight: font.weights.black, fontSize: 11 },
  actionRail: { gap: 4, paddingHorizontal: 12, paddingVertical: 15 }, action: { width: 56, alignItems: 'center', gap: 5 }, actionIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.text }, actionLabel: { textAlign: 'center', color: c.text, fontWeight: font.weights.black, fontSize: 8.5, lineHeight: 10 }, actionArrow: { width: 20, height: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { marginHorizontal: spacing.lg, marginTop: 16, height: 218, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.text, ...elevation.med }, heroImage: { ...StyleSheet.absoluteFillObject }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.30)' }, heroMascots: { position: 'absolute', right: -9, bottom: -16, width: 230, height: 235 }, zap: { position: 'absolute', right: 14, top: 8, color: c.lime, fontSize: 30, fontWeight: font.weights.black, transform: [{ rotate: '15deg' }] }, heroCopy: { padding: 20, height: '100%', justifyContent: 'center' }, heroEyebrow: { color: c.lime, fontWeight: font.weights.black, fontSize: 10, letterSpacing: .8 }, heroTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: font.weights.black, letterSpacing: -1, marginTop: 3 }, heroNote: { color: '#FFFFFF', fontSize: 15, fontWeight: font.weights.bold, lineHeight: 18 }, heroButton: { marginTop: 13, flexDirection: 'row', backgroundColor: c.accent, borderRadius: radius.pill, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' }, heroButtonText: { color: c.onAccent, fontWeight: font.weights.black, fontSize: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: 26, marginBottom: 11 }, sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, sectionText: { fontSize: 21, fontWeight: font.weights.black, letterSpacing: -.6 }, seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 }, seeAllText: { fontWeight: font.weights.bold, fontSize: 12 }, rail: { paddingHorizontal: spacing.lg, gap: 12 },
  facility: { width: 166, backgroundColor: c.bgElevated, padding: 6, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, ...elevation.low }, facilityImage: { width: '100%', height: 96, borderRadius: 11 }, distance: { position: 'absolute', top: 84, right: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill }, distanceText: { fontSize: 10, fontWeight: font.weights.black }, facilityTitle: { fontWeight: font.weights.black, fontSize: 13, marginTop: 8 }, facilityMeta: { color: c.textSecondary, fontSize: 10, marginTop: 3 }, tagRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' }, sportTag: { backgroundColor: c.bgRaised, paddingHorizontal: 5, paddingVertical: 3, borderRadius: radius.pill, fontSize: 8, color: c.textSecondary }, openTag: { backgroundColor: '#D5FFE1', paddingHorizontal: 5, paddingVertical: 3, borderRadius: radius.pill, fontSize: 8, fontWeight: font.weights.black },
  event: { width: 174, overflow: 'hidden', borderRadius: radius.md, backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border }, eventImage: { height: 92, width: '100%' }, eventDoodle: { position: 'absolute', top: 10, left: 8, transform: [{ rotate: '-6deg' }], paddingHorizontal: 7, paddingVertical: 4 }, eventDoodleText: { fontWeight: font.weights.black, fontSize: 10 }, date: { position: 'absolute', top: 7, right: 7, width: 32, height: 35, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, dateDay: { fontWeight: font.weights.black, fontSize: 16, lineHeight: 15 }, dateMonth: { fontWeight: font.weights.black, fontSize: 7 }, eventBody: { padding: 9 }, eventName: { fontWeight: font.weights.black, fontSize: 12 }, eventMeta: { color: c.textSecondary, fontSize: 9, marginTop: 4 }, eventFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, eventLevel: { color: c.textSecondary, fontSize: 9 }, join: { backgroundColor: c.accentSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }, joinText: { color: c.accentDark, fontWeight: font.weights.black, fontSize: 10 },
  players: { paddingHorizontal: 12, gap: 8 }, player: { width: 63, alignItems: 'center' }, avatarRing: { borderWidth: 2, borderRadius: 30, padding: 2, position: 'relative' }, playerOnline: { width: 11, height: 11, borderRadius: 7, borderWidth: 2, borderColor: c.bg, position: 'absolute', right: -1, bottom: 0 }, playerName: { fontSize: 10, fontWeight: font.weights.black, marginTop: 5, maxWidth: 61 }, playerSport: { color: c.textSecondary, fontSize: 8, fontWeight: font.weights.bold, marginTop: 2 }, playerKm: { color: c.textMuted, fontSize: 9, marginTop: 2 },
  tournamentList: { gap: 9, marginHorizontal: spacing.lg }, tournament: { borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 2, borderColor: c.text }, tournamentName: { fontWeight: font.weights.black, fontSize: 14 }, tournamentMeta: { color: c.textSecondary, fontSize: 11, marginTop: 3 },
  coach: { marginHorizontal: spacing.lg, marginTop: 26, borderRadius: radius.lg, backgroundColor: c.text, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 9, overflow: 'hidden' }, coachMascot: { width: 72, height: 76, marginLeft: -15 }, coachTitle: { color: '#fff', fontSize: 17, fontWeight: font.weights.black }, coachText: { color: '#E6E3DE', fontSize: 11, marginTop: 4, lineHeight: 15 }, coachBtn: { backgroundColor: c.accent, padding: 10, borderRadius: radius.md, alignItems: 'center', gap: 3 }, coachBtnText: { color: c.onAccent, fontSize: 10, fontWeight: font.weights.black },
});

// Phone-first overrides: preserve the colourful content while preventing the
// brand header and social hero from dominating a 360–430 pt screen.
const mobileStyles = StyleSheet.create({
  header: { gap: 6, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 7 },
  wordmark: { width: 78, height: 40, borderRadius: 13, backgroundColor: c.text, paddingLeft: 9, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  wordmarkKuchu: { color: c.textInverse, fontSize: 11, lineHeight: 11, fontWeight: font.weights.black, letterSpacing: -0.4 },
  wordmarkPuchu: { color: c.accent, fontSize: 16, lineHeight: 16, fontWeight: font.weights.black, letterSpacing: -0.8 },
  wordmarkSpark: { position: 'absolute', right: 5, top: 4 },
  hero: { height: 194, marginTop: 8, marginHorizontal: 14 },
});
