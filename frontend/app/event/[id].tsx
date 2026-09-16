import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { api } from '@/src/api';
import { c } from '@/src/theme';
import { ScreenHeader, Button, SuccessMark } from '@/src/components/ui';
import { ErrorBanner, SkeletonCards } from '@/src/components/states';
import { dateLabel, money, sportsLabel } from '@/src/sports';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';
import { openCheckout, verifiedPayment } from '@/src/payments';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [event, setEvent] = useState<any>();
  const [error, setError] = useState<unknown>();
  const [actionError, setActionError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [registered, setRegistered] = useState<any>();

  async function load() {
    setError(null);
    try { setEvent(await api.event(String(id))); } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, [id]);

  async function join(authenticated = false) {
    if (!authenticated && !requireAuth(user, router, `/event/${id}`, () => join(true))) return;
    setJoining(true); setActionError(null);
    try {
      const result: any = await api.registerEvent(String(id), email.trim() || undefined);
      if (result.checkout_url && result.payment?.id) {
        await openCheckout(result);
        setRegistered(await verifiedPayment(result.payment.id));
      } else setRegistered(result.registration || result);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not reserve your place. Please try again.');
    } finally { setJoining(false); }
  }

  if (registered) return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}><ScreenHeader title="You’re in" onBack={() => router.back()} /><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}><SuccessMark /><Text style={{ color: c.text, fontSize: 28, fontWeight: '900' }}>Place reserved!</Text><Text style={{ color: c.textSecondary, textAlign: 'center', lineHeight: 22 }}>You’re registered for {event?.name}. See you on court.</Text><View style={{ alignSelf: 'stretch', marginTop: 12 }}><Button label="Explore more events" onPress={() => router.replace('/(tabs)/discover')} /></View></View></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}><ScreenHeader title="What’s Happening" onBack={() => router.back()} /><ErrorBanner error={error} retry={load} />{!event ? !error && <SkeletonCards /> : <ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center', paddingBottom: 48 }}>{event.image && <Image source={{ uri: event.image }} style={{ width: '100%', height: 230, borderRadius: 24 }} contentFit="cover" />}<Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: '900', color: c.text }}>{event.name}</Text><Text style={{ color: c.textSecondary }}>{dateLabel(event.date)} · {event.venue || event.city || 'Venue to be announced'}</Text><Text style={{ color: c.text }}>{sportsLabel(event)} · {money(event.price)}</Text>{event.description && <Text style={{ color: c.textSecondary, lineHeight: 24, fontSize: 16 }}>{event.description}</Text>}{event.game_id ? <Button label="Join game" onPress={() => router.push(`/game/${event.game_id}`)} /> : <View style={{ padding: 18, backgroundColor: c.bgRaised, borderRadius: 20, gap: 12 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Ready to play?</Text><Text style={{ color: c.textSecondary, lineHeight: 21 }}>Reserve your place in the app. Paid events use secure PayU checkout.</Text>{Number(event.price || 0) > 0 && <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Payment email" placeholderTextColor={c.textFaint} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c.text, backgroundColor: c.bg }} />}{actionError && <Text style={{ color: c.danger, lineHeight: 20 }}>{actionError}</Text>}<Button label={Number(event.price || 0) > 0 ? `Join · ${money(event.price)}` : 'Join event'} loading={joining} onPress={() => join()} /></View>}{event.facility_id && <Button label="View venue" variant="secondary" onPress={() => router.push(`/facility/${event.facility_id}`)} />}</ScrollView>}</SafeAreaView>;
}
