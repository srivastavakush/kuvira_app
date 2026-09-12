import { View, Text, Pressable } from 'react-native';
import { SPORTS, sportName } from '@/src/sports';
import { c } from '@/src/theme';
export function SportPicker({ value, onChange }: { value: string; onChange: (sport: string) => void }) {
  return <View style={{ gap: 10, marginVertical: 14 }}><Text style={{ fontWeight: '700', color: c.text }}>Choose your sport</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SPORTS.map(sport => <Pressable key={sport} accessibilityRole="radio" accessibilityState={{ checked: sportName(value) === sport }} onPress={() => onChange(sport.toLowerCase())} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: sportName(value) === sport ? c.text : c.bgRaised }}><Text style={{ fontSize: 13, fontWeight: '600', color: sportName(value) === sport ? 'white' : c.text }}>{sport}</Text></Pressable>)}</View></View>;
}
