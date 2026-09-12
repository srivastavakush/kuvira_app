import { useEffect, useState } from 'react';
import { View, Text, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/src/api';
import { c } from '@/src/theme';
import { Brand } from './brand';
import { Card, Button, Badge } from './ui';
import { ErrorBanner, SkeletonCards } from './states';
import { dateLabel } from '@/src/sports';
export function AdminOverview() {
  const router = useRouter(); const { width } = useWindowDimensions(); const wide = width >= 768;
  const [overview, setOverview] = useState<any>(); const [users, setUsers] = useState<any[]>([]); const [transactions, setTransactions] = useState<any[]>([]); const [health, setHealth] = useState<any>(); const [error, setError] = useState<unknown>(); const [query, setQuery] = useState(''); const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError(null);
    const results = await Promise.allSettled([api.adminOverview(), api.adminUsers(query), api.adminTransactions(), api.adminSystemHealth()]);
    const setters = [setOverview, setUsers, setTransactions, setHealth];
    results.forEach((r, i) => { if (r.status === 'fulfilled') setters[i](r.value); });
    if (results.some(r => r.status === 'rejected')) setError('Some dashboard data is unavailable. Retry to refresh it.'); setBusy(false);
  }
  useEffect(() => { load(); }, []);
  const received = overview?.payments?.find((p: any) => p._id === 'succeeded')?.amount;
  return <View style={{ gap: 20 }}><Brand /><Text accessibilityRole="header" style={{ fontSize: 30, color: c.text, fontWeight: '900' }}>The whole game, in view.</Text><Text style={{ color: c.textSecondary }}>Platform overview · {overview ? dateLabel(overview.generated_at) : 'Loading latest data'}</Text><ErrorBanner error={error} retry={load} />{busy && !overview ? <SkeletonCards /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{Object.entries(overview?.counts || {}).map(([key, value]) => <Card key={key} style={{ width: wide ? '30%' : '46%', minHeight: 100 }}><Text style={{ color: c.textSecondary, textTransform: 'capitalize', fontSize: 13 }}>{key.replace('ai_coach_jobs', 'AI analyses').replace('organizations', 'Clubs')}</Text><Text style={{ fontWeight: '900', fontSize: 30, color: c.text }}>{String(value)}</Text></Card>)}<Card style={{ width: wide ? '30%' : '46%' }}><Text style={{ color: c.textSecondary }}>Verified gateway receipts</Text><Text style={{ fontSize: 24, fontWeight: '900', color: c.text }}>{received == null ? '—' : `₹${received.toLocaleString('en-IN')}`}</Text></Card></View>}
    <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Players & accounts</Text><View style={{ flexDirection: 'row', gap: 10 }}><TextInput accessibilityLabel="Search users by name or phone" value={query} onChangeText={setQuery} onSubmitEditing={load} placeholder="Search name or phone" style={{ flex: 1, minWidth: 0, backgroundColor: 'white', padding: 14, borderRadius: 14, color: c.text }} /><Button label="Search" onPress={load} loading={busy} fullWidth={false} /></View>
    <Text style={{ color: c.textMuted }}>Up to 100 recent accounts. Club roles are managed in each club’s team workspace.</Text>
    {users.map(u => <Card key={u.id}><View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, alignItems: wide ? 'center' : undefined }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{u.name || 'New player'}</Text><Text style={{ color: c.textSecondary }}>{u.mobile} · {u.city || 'City not set'}</Text></View><Badge label={u.is_platform_admin ? 'Platform admin' : u.onboarded ? 'Player' : 'Onboarding'} /><Button label="View profile" variant="secondary" fullWidth={false} onPress={() => router.push(`/player/${u.id}`)} /></View></Card>)}
    <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Finance</Text><Text style={{ color: c.textSecondary }}>Latest 100 gateway transactions. Refund and reconciliation actions are not available in this backend.</Text>
    {wide && <View style={{ flexDirection: 'row', padding: 16, gap: 16 }}>{['Transaction', 'Amount', 'Status', 'Created'].map(k => <Text key={k} style={{ flex: 1, fontWeight: '800', color: c.text }}>{k}</Text>)}</View>}
    {transactions.length ? transactions.map(t => <Card key={t.id}><View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}><Text style={{ flex: 1, color: c.text }}>{t.txnid || t.id}</Text><Text style={{ flex: 1, color: c.text }}>₹{t.amount}</Text><View style={{ flex: 1 }}><Badge label={t.status || 'Unknown'} /></View><Text style={{ flex: 1, color: c.textSecondary }}>{dateLabel(t.created_at)}</Text></View></Card>) : <Text style={{ color: c.textMuted }}>No transactions loaded.</Text>}
    <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>System health</Text><Card><View style={{ gap: 10 }}><Text style={{ color: c.text }}>API: {health?.api || 'Unavailable'} · Database: {health?.database || 'Unavailable'}</Text><Text style={{ color: c.textSecondary }}>Last worker observation: {health?.worker_last_observation ? dateLabel(health.worker_last_observation.heartbeat_at) : 'None recorded'}</Text><Text style={{ color: c.textSecondary }}>Worker heartbeat freshness and knowledge refresh are not monitored by the current backend.</Text>{overview?.ai_jobs?.map((job: any) => <Text key={job._id || 'unknown'} style={{ color: c.text }}>AI {job._id || 'unknown'}: {job.count}</Text>)}</View></Card><Button label="Refresh dashboard" onPress={load} loading={busy} variant="secondary" />
  </View>;
}
