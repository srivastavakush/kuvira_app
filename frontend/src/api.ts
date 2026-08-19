// API client for Kuvira Sports backend.
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'kuvira_auth_token';

export async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, '');
}
export async function setToken(token: string) { await storage.secureSet(TOKEN_KEY, token); }
export async function clearToken() { await storage.secureRemove(TOKEN_KEY); }

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.detail) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  health: () => request('/health'),

  // Auth
  otpStart: (mobile: string) => request('/auth/otp/start', { method: 'POST', body: JSON.stringify({ mobile }) }),
  otpVerify: (mobile: string, otp: string) => request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) }),
  me: () => request('/me'),
  onboarding: (payload: any) => request('/onboarding', { method: 'POST', body: JSON.stringify(payload) }),

  // Sports / Discovery
  sports: () => request('/sports'),
  facilities: (params: { city?: string; sport?: string } = {}) => {
    const q = new URLSearchParams(params as any).toString();
    return request(`/facilities${q ? '?' + q : ''}`);
  },
  facility: (id: string) => request(`/facilities/${id}`),
  availability: (id: string, date: string) => request(`/facilities/${id}/availability?date=${date}`),

  // Bookings
  createBooking: (payload: any) => request('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  myBookings: () => request('/bookings/mine'),

  // Games
  games: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/games${q ? '?' + q : ''}`);
  },
  game: (id: string) => request(`/games/${id}`),
  createGame: (payload: any) => request('/games', { method: 'POST', body: JSON.stringify(payload) }),
  joinGame: (id: string) => request(`/games/${id}/join`, { method: 'POST' }),

  // Players
  players: () => request('/players'),
  player: (id: string) => request(`/players/${id}`),

  // Community
  posts: () => request('/posts'),
  createPost: (payload: any) => request('/posts', { method: 'POST', body: JSON.stringify(payload) }),
  likePost: (id: string) => request(`/posts/${id}/like`, { method: 'POST' }),

  // Coaches / Events / Tournaments
  coaches: () => request('/coaches'),
  coach: (id: string) => request(`/coaches/${id}`),
  events: () => request('/events'),
  tournaments: () => request('/tournaments'),
  registerTournament: (id: string) => request(`/tournaments/${id}/register`, { method: 'POST' }),

  // Marketplace
  products: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? '?' + q : ''}`);
  },
  product: (id: string) => request(`/products/${id}`),
  recommendedProducts: () => request('/products/recommend/for-me'),
  cart: () => request('/cart'),
  addToCart: (product_id: string, qty = 1) => request('/cart/add', { method: 'POST', body: JSON.stringify({ product_id, qty }) }),
  removeFromCart: (product_id: string) => request('/cart/remove', { method: 'POST', body: JSON.stringify({ product_id, qty: 1 }) }),
  createOrder: (address: any) => request('/orders', { method: 'POST', body: JSON.stringify({ address }) }),
  myOrders: () => request('/orders/mine'),

  // AI Coach (legacy compat)
  aiChat: (text: string, session_id?: string) =>
    request('/ai/coach/chat', { method: 'POST', body: JSON.stringify({ text, session_id }) }),
  aiHistory: (session_id?: string) => request(`/ai/coach/history${session_id ? '?session_id=' + session_id : ''}`),
  aiInsights: () => request('/ai/insights'),
  aiRecommendations: () => request('/ai/recommendations'),

  // AI Coach v2 — video-first, grounded
  aiCoach: {
    createMatch: (payload: any) => request('/ai-coach/matches', { method: 'POST', body: JSON.stringify(payload) }),
    listMatches: () => request('/ai-coach/matches'),
    uploadVideo: async (fileUri: string, matchId?: string, fileName = 'match.mp4', mimeType = 'video/mp4') => {
      const form = new FormData();
      // React Native FormData file object
      form.append('file', { uri: fileUri, name: fileName, type: mimeType } as any);
      if (matchId) form.append('match_id', matchId);
      const token = await getToken();
      const res = await fetch(`${BASE}/api/ai-coach/videos`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form as any,
      });
      const text = await res.text();
      let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) throw new Error((data && (data.error?.message || data.detail)) || `HTTP ${res.status}`);
      return data;
    },
    startAnalysis: (match_id: string, video_id: string) =>
      request('/ai-coach/analyze', { method: 'POST', body: JSON.stringify({ match_id, video_id }) }),
    analysisStatus: (job_id: string) => request(`/ai-coach/analysis/${job_id}`),
    matchReport: (match_id: string, refresh = false) => request(`/ai-coach/match/${match_id}/report${refresh ? '?refresh=true' : ''}`),
    playerPerformance: () => request('/ai-coach/player-performance'),
    chat: (text: string, opts: { session_id?: string; match_id?: string } = {}) =>
      request('/ai-coach/chat', { method: 'POST', body: JSON.stringify({ text, ...opts }) }),
    history: (session_id?: string) => request(`/ai-coach/history${session_id ? '?session_id=' + session_id : ''}`),
    seedKnowledge: () => request('/ai-coach/knowledge/seed', { method: 'POST' }),
  },

  // Capabilities / workspace
  capabilities: () => request('/capabilities'),

  // Coach booking
  coachAvailability: (id: string, date: string) => request(`/coaches/${id}/availability?date=${date}`),
  bookCoachSession: (coach_id: string, date: string, slot: string) =>
    request('/coach-sessions', { method: 'POST', body: JSON.stringify({ coach_id, date, slot }) }),
  myCoachSessions: () => request('/coach-sessions/mine'),

  // Training plans
  trainingPlans: () => request('/training/plans'),
  createTrainingPlan: (goal: string, weeks = 4) =>
    request('/training/plans', { method: 'POST', body: JSON.stringify({ goal, weeks }) }),
  toggleDrill: (planId: string, drillId: string) =>
    request(`/training/plans/${planId}/drills/${drillId}/toggle`, { method: 'POST' }),
  trainingStreak: () => request('/training/streak'),

  // Rankings & achievements
  rankings: (scope: 'city' | 'global' = 'city') => request(`/rankings?scope=${scope}`),
  achievements: () => request('/achievements'),

  // Referrals
  myReferral: () => request('/referrals/me'),
  applyReferral: (code: string) => request('/referrals/apply', { method: 'POST', body: JSON.stringify({ code }) }),

  // Club workspace
  org: (orgId: string) => request(`/orgs/${orgId}`),
  orgAnalytics: (orgId: string) => request(`/orgs/${orgId}/analytics`),
  orgBookings: (orgId: string) => request(`/orgs/${orgId}/bookings`),
  orgMembers: (orgId: string) => request(`/orgs/${orgId}/members`),

  // Search
  search: (q: string) => request(`/search?q=${encodeURIComponent(q)}`),
};
