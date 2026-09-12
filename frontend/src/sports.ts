export const SPORTS = ['Badminton', 'Cricket', 'Football', 'Tennis', 'Pickleball', 'Padel', 'Basketball', 'Running'];
export function sportName(value: any): string {
  const name = typeof value === 'string' ? value : value?.name || '';
  return name.replace(/^sport-/, '').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}
export function sportsLabel(item: any): string { return (Array.isArray(item.sports) && item.sports.length ? item.sports.map(sportName).join(' · ') : sportName(item.primary_sport || item.sport)) || 'Sport not listed'; }
export function dateLabel(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function money(value: unknown): string { return typeof value === 'number' && Number.isFinite(value) ? `₹${value.toLocaleString('en-IN')}` : 'Price on request'; }
