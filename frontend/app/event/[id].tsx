import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { api } from '@/src/api';
import { c } from '@/src/theme';
import { ScreenHeader, Button } from '@/src/components/ui';
import { ErrorBanner, SkeletonCards } from '@/src/components/states';
import { dateLabel, money, sportsLabel } from '@/src/sports';
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const [event, setEvent] = useState<any>(); const [error, setError] = useState<unknown>();
  async function load() { setError(null); try { setEvent(await api.event(String(id))); } catch (e) { setError(e); } }
  useEffect(() => { load(); }, [id]);
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}><ScreenHeader title="What’s Happening" onBack={() => router.back()} /><ErrorBanner error={error} retry={load} />{!event ? !error && <SkeletonCards /> : <ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center' }}>{event.image && <Image source={{ uri: event.image }} style={{ width: '100%', height: 230, borderRadius: 24 }} contentFit="cover" />}<Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: '900', color: c.text }}>{event.name}</Text><Text style={{ color: c.textSecondary }}>{dateLabel(event.date)} · {event.venue || event.city || 'Venue to be announced'}</Text><Text style={{ color: c.text }}>{sportsLabel(event)} · {money(event.price)}</Text>{event.description && <Text style={{ color: c.textSecondary, lineHeight: 24, fontSize: 16 }}>{event.description}</Text>}{event.game_id ? <Button label="Join game" onPress={() => router.push(`/game/${event.game_id}`)} /> : <View style={{ padding: 20, backgroundColor: c.bgRaised, borderRadius: 20 }}><Text style={{ color: c.textSecondary, lineHeight: 22 }}>In-app joining isn’t available for this event yet. Check with the venue for registration and remaining places.</Text></View>}{event.facility_id && <Button label="View venue" variant="secondary" onPress={() => router.push(`/facility/${event.facility_id}`)} />}</ScrollView>}</SafeAreaView>;
}
